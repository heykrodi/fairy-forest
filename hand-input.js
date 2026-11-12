// Camera frames stay on this PC. Only landmark numbers return from the Worker.
export function createHandInput({ onFrame = () => {}, onStatus = () => {} } = {}) {
  let current = null;
  let nextHandId = 1;

  function clearSession(session) {
    cancelAnimationFrame(session.raf);
    clearTimeout(session.timeout);
    clearTimeout(session.frameTimeout);
    session.rejectInit?.(new Error('Stopped'));
    session.rejectInit = null;
    session.worker?.terminate();
    session.stream?.getTracks().forEach(track => track.stop());
    if (session.video) {
      session.video.pause();
      session.video.srcObject = null;
    }
    document.removeEventListener('visibilitychange', session.visibility);
  }

  function stop() {
    const old = current;
    current = null;
    if (old) clearSession(old);
    onFrame({ hands: [], timestamp: performance.now() });
    onStatus({ state: 'stopped', message: '카메라를 껐어요.' });
  }

  function fail(session, error) {
    if (current !== session) return;
    current = null;
    clearSession(session);
    onFrame({ hands: [], timestamp: performance.now() });
    let message = '손 인식을 준비하지 못했어요. 다시 켜거나 마우스로 체험해 주세요.';
    if (error.name === 'NotAllowedError') message = '카메라 사용이 허용되지 않았어요. 마우스로 체험할 수 있어요.';
    else if (error.name === 'NotFoundError') message = '사용할 카메라를 찾지 못했어요. 연결을 확인해 주세요.';
    else if (error.name === 'NotReadableError') message = '카메라를 열지 못했어요. 다른 앱에서 사용 중인지 확인해 주세요.';
    onStatus({ state: 'error', message });
    console.error('Hand input:', error.message || error);
  }

  async function start() {
    if (current) {
      const old = current;
      current = null;
      clearSession(old);
    }
    const session = { raf: 0, timeout: 0, frameTimeout: 0, minTimestamp: 0, busy: false, tracks: [], lastVideo: -1, lastFrame: -Infinity };
    current = session;
    onFrame({ hands: [], timestamp: performance.now() });
    onStatus({ state: 'loading', message: '두 손을 알아볼 준비를 하고 있어요…' });
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera requires localhost or HTTPS.');
      session.worker = new Worker(new URL('./hand-worker.js', import.meta.url), { type: 'module' });
      await new Promise((resolve, reject) => {
        session.rejectInit = reject;
        session.timeout = setTimeout(() => reject(new Error('Hand model loading timed out.')), 30000);
        session.worker.onerror = event => {
          const error = new Error(event.message || 'Hand worker failed.');
          if (session.rejectInit) reject(error);
          else fail(session, error);
        };
        session.worker.onmessage = ({ data }) => {
          if (current !== session) return;
          if (data.type === 'ready') {
            clearTimeout(session.timeout);
            session.rejectInit = null;
            resolve();
          } else if (data.type === 'result') {
            session.busy = false;
            clearTimeout(session.frameTimeout);
            if (!document.hidden && data.timestamp >= session.minTimestamp) {
              const { hands, tracks } = describeHands(data, session.tracks, () => `hand-${nextHandId++}`);
              session.tracks = tracks;
              onFrame({ hands, timestamp: data.timestamp, sourceAspect: data.aspect });
            }
          } else if (data.type === 'error') {
            const error = new Error(data.message);
            if (session.rejectInit) reject(error);
            else fail(session, error);
          }
        };
        session.worker.postMessage({ type: 'init' });
      });
      if (current !== session) return false;
      onStatus({ state: 'loading', message: '카메라 사용을 허용하면 두 손을 만날 수 있어요.' });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
        audio: false,
      });
      if (current !== session) {
        stream.getTracks().forEach(track => track.stop());
        return false;
      }
      session.stream = stream;
      session.video = document.createElement('video');
      session.video.muted = true;
      session.video.playsInline = true;
      session.video.srcObject = stream;
      await session.video.play();
      if (current !== session) return false;
      stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
        if (current === session) fail(session, new Error('Camera stream ended.'));
      }, { once: true }));

      session.visibility = () => {
        cancelAnimationFrame(session.raf);
        session.minTimestamp = performance.now();
        if (document.hidden) {
          session.video.pause();
          session.tracks = [];
          onFrame({ hands: [], timestamp: performance.now() });
        } else {
          session.lastVideo = -1;
          const resumeTimestamp = session.minTimestamp;
          session.video.play().then(() => {
            if (current === session && !document.hidden && session.minTimestamp === resumeTimestamp) session.raf = requestAnimationFrame(tick);
          }).catch(error => fail(session, error));
        }
      };
      document.addEventListener('visibilitychange', session.visibility);
      onStatus({ state: 'ready', message: '카메라가 준비됐어요. 두 손을 작은 그릇처럼 모아보세요.' });
      if (document.hidden) session.visibility();
      else session.raf = requestAnimationFrame(tick);
      return true;

      async function tick(now) {
        if (current !== session || document.hidden) return;
        session.raf = requestAnimationFrame(tick);
        const video = session.video;
        if (session.busy || video.paused || video.readyState < 2 || now - session.lastFrame < 1000 / 12 || video.currentTime === session.lastVideo) return;
        session.busy = true;
        session.lastFrame = now;
        session.lastVideo = video.currentTime;
        try {
          const scale = Math.min(1, 640 / video.videoWidth, 480 / video.videoHeight);
          const bitmap = await createImageBitmap(video, {
            resizeWidth: Math.round(video.videoWidth * scale),
            resizeHeight: Math.round(video.videoHeight * scale),
          });
          if (current !== session || document.hidden || now < session.minTimestamp) {
            bitmap.close();
            session.busy = false;
            return;
          }
          try {
            session.worker.postMessage({ type: 'frame', bitmap, timestamp: now }, [bitmap]);
            session.frameTimeout = setTimeout(() => fail(session, new Error('Hand inference timed out.')), 10000);
          } catch (error) {
            bitmap.close();
            throw error;
          }
        } catch (error) {
          fail(session, error);
        }
      }
    } catch (error) {
      fail(session, error);
      return false;
    }
  }

  return { start, stop };
}

// Pure landmark interpretation also lets the hand-identity guard be tested.
export function describeHands(data, previousTracks, allocateId) {
    const aspect = data.aspect;
    const distance = (a, b) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);
    const hands = data.landmarks.map((points, index) => {
      const landmarks = points.map(point => ({ x: 1 - point.x, y: point.y, z: point.z }));
      const palm = [0, 5, 9, 13, 17].reduce((p, index) => ({ x: p.x + landmarks[index].x / 5, y: p.y + landmarks[index].y / 5 }), { x: 0, y: 0 });
      const palmScale = Math.max(0.025, distance(landmarks[0], landmarks[9])) / aspect;
      const pointer = { x: (landmarks[4].x + landmarks[8].x) / 2, y: (landmarks[4].y + landmarks[8].y) / 2 };
      const category = data.handedness[index]?.[0];
      return { landmarks, palm, pointer, palmScale, label: category?.categoryName || '', handednessConfidence: category?.score || 0 };
    });
    const reliableLabel = hand => hand.handednessConfidence >= 0.8 && (hand.label === 'Left' || hand.label === 'Right');
    const previous = previousTracks.filter(track => data.timestamp - track.lastSeen < 500);
    const pairs = hands.flatMap((hand, hi) => previous.map((track, ti) => {
      // An opposite hand must never inherit a pinched hand's held ember.
      // Keep the last reliable identity through brief low-confidence label noise.
      const oppositeHand = track.identityLabel && reliableLabel(hand) && hand.label !== track.identityLabel;
      return { hi, ti, cost: oppositeHand ? Infinity : distance(hand.palm, track.palm) + (hand.label === track.label ? 0 : 0.12 * Math.min(hand.handednessConfidence, track.handednessConfidence)) };
    }));
    pairs.sort((a, b) => a.cost - b.cost);
    const usedHands = new Set(), usedTracks = new Set();
    for (const pair of pairs) {
      if (pair.cost > 0.55 || usedHands.has(pair.hi) || usedTracks.has(pair.ti)) continue;
      hands[pair.hi].previous = previous[pair.ti];
      usedHands.add(pair.hi);
      usedTracks.add(pair.ti);
    }
    for (const hand of hands) {
      const old = hand.previous;
      hand.id = old?.id || allocateId();
      hand.identityLabel = old?.identityLabel || (reliableLabel(hand) ? hand.label : null);
      const pinchRatio = distance(hand.landmarks[4], hand.landmarks[8]) / (hand.palmScale * aspect);
      hand.pinching = pinchRatio < (old?.pinching ? 0.58 : 0.36);
      // Uncertain opposite labels may retain the track briefly, but cannot turn
      // a held pinch into a release until the original identity is recognized.
      if (old?.pinching && old.identityLabel && hand.label !== old.identityLabel && !reliableLabel(hand)) hand.pinching = true;
      // Cupped palms may bend their fingers: two visibly extended fingers suffice.
      const extended = [[8, 6], [12, 10], [16, 14], [20, 18]].filter(([tip, joint]) => distance(hand.landmarks[tip], hand.landmarks[0]) > distance(hand.landmarks[joint], hand.landmarks[0]) * 1.08).length;
      hand.open = extended >= 2 && !hand.pinching;
      hand.lastSeen = data.timestamp;
      delete hand.previous;
    }
    return { hands, tracks: [...hands, ...previous.filter((_, index) => !usedTracks.has(index))] };
}
