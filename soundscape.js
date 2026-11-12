const FILES = ['quiet-loop', 'flight', 'park-loop', 'birth', 'ignite', 'grip', 'release'];
const clamp = (value, low, high) => Math.max(low, Math.min(high, Number.isFinite(value) ? value : low));

// Audio follows experience states, so holding a lantern never outruns the music.
export function createSoundscape({ onStatus = () => {} } = {}) {
  let context, master, filter, limiter, loading, track;
  let active = false, muted = false, disposed = false, failed = false;
  let latest = { phase: 'gathering', energy: 0, motion: 0, progress: 0 };
  let lastStatus = '', filterTarget = 0, session = 0;
  const buffers = new Map(), voices = new Set();
  const hidden = () => typeof document !== 'undefined' && document.hidden;
  const ready = () => buffers.size === FILES.length;
  const playable = () => active && ready() && !disposed && !failed && !hidden() && context?.state === 'running';

  function report() {
    const state = failed ? 'error' : !active ? 'idle' : muted ? 'muted' : !ready() ? 'loading' : 'playing';
    const signature = `${state}:${muted}`;
    if (signature === lastStatus) return;
    lastStatus = signature;
    onStatus({ state, muted });
  }
  function masterLevel() {
    if (!master) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(active && !muted ? 0.76 : 0, now, 0.035);
  }
  function remove(voice) {
    voices.delete(voice);
    voice.source.disconnect();
    voice.gain.disconnect();
    if (track === voice) track = null;
  }
  function fadeOut(voice, seconds, force = false) {
    if (!voice || (voice.stopping && !force)) return;
    voice.stopping = true;
    const now = context.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + seconds);
    voice.source.stop(now + seconds + 0.025);
  }
  function clear() {
    for (const voice of voices) fadeOut(voice, 0.08, true);
    track = null;
  }
  function voice(name, { loop = false, offset = 0, level = 1, fade = 0.2 } = {}) {
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffers.get(name);
    source.loop = loop;
    source.connect(gain);
    gain.connect(filter);
    const entry = { source, gain, name, target: level, fadeUntil: context.currentTime + fade, stopping: false };
    voices.add(entry);
    source.onended = () => remove(entry);
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(level, context.currentTime + fade);
    source.start(context.currentTime, Math.min(offset, Math.max(0, source.buffer.duration - 0.05)));
    return entry;
  }
  function reconcile() {
    if (!playable()) return;
    const name = latest.phase === 'released' ? 'flight' : latest.phase === 'complete' ? 'park-loop' : 'quiet-loop';
    if (track?.name !== name) {
      const crossfade = name === 'park-loop' ? 2.4 : 1.2;
      fadeOut(track, crossfade);
      track = voice(name, {
        loop: name !== 'flight', offset: name === 'flight' ? clamp(latest.progress, 0, 1) * 24 : 0,
        level: name === 'quiet-loop' ? 0.85 : 1, fade: crossfade,
      });
    }
    const gathering = latest.phase === 'gathering';
    const energy = clamp(latest.energy, 0, 1), motion = clamp(latest.motion, 0, 1);
    const level = gathering ? 0.72 + energy * 0.2 + motion * 0.06 : latest.phase === 'complete' ? 0.92 : 1;
    const now = context.currentTime;
    if (track && now > track.fadeUntil && Math.abs(track.target - level) > 0.015) {
      track.target = level;
      track.gain.gain.setTargetAtTime(level, now, 0.45);
    }
    const brightness = gathering ? 1600 + energy * 1100 + motion * 250 : latest.phase === 'complete' ? 2400 : 3400;
    if (Math.abs(filterTarget - brightness) > 25) {
      filterTarget = brightness;
      filter.frequency.setTargetAtTime(brightness, now, 0.45);
    }
  }
  function ensureContext() {
    if (context) return;
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Web Audio unavailable');
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = 0;
    filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 10;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.005;
    limiter.release.value = 0.2;
    filter.connect(limiter);
    limiter.connect(master);
    master.connect(context.destination);
  }
  async function load() {
    if (ready()) return;
    if (!loading) {
      loading = Promise.all(FILES.map(async name => {
        if (buffers.has(name)) return;
        const response = await fetch(new URL(`./audio/${name}.wav`, import.meta.url));
        if (!response.ok) throw new Error(`Audio asset unavailable: ${name}`);
        const data = await response.arrayBuffer();
        const buffer = await context.decodeAudioData(data);
        if (!disposed) buffers.set(name, buffer);
      })).finally(() => { loading = null; });
    }
    await loading;
  }
  function unlock() {
    // Called before the first await, directly within the user's button click.
    const resumed = context.resume();
    return Promise.resolve(resumed).then(() => {
      if (disposed) return;
      if (hidden()) return context.suspend();
      masterLevel();
      reconcile();
    });
  }
  async function start() {
    if (disposed) return;
    const attempt = ++session;
    active = true;
    failed = false;
    try {
      ensureContext();
      const resumed = unlock();
      report();
      await Promise.all([resumed, load()]);
      if (disposed || !active || attempt !== session) return;
      reconcile();
      report();
    } catch {
      if (disposed || !active || attempt !== session) return;
      failed = true;
      clear();
      report();
    }
  }
  function stop() {
    session++;
    active = false;
    clear();
    masterLevel();
    report();
  }
  function reset() {
    latest = { phase: 'gathering', energy: 0, motion: 0, progress: 0 };
    clear();
    reconcile();
    report();
  }
  function setMuted(value) {
    muted = !!value;
    masterLevel();
    if (!muted && active) return start();
    report();
  }
  function update(value) {
    if (disposed) return;
    if (!value.active) { if (active) stop(); return; }
    const previous = latest.phase;
    latest = { ...latest, ...value };
    if (previous !== latest.phase && playable() && !muted) {
      const effect = { approaching: 'birth', igniting: 'ignite', holding: 'grip', released: 'release' }[latest.phase];
      if (effect) voice(effect, { level: effect === 'grip' ? 0.75 : 0.9, fade: 0.025 });
    }
    reconcile();
  }
  function visibilityChanged() {
    if (!context || disposed) return;
    if (hidden()) {
      // One-shots must not arrive late when a hidden tab becomes visible again.
      for (const entry of [...voices]) if (entry !== track) {
        entry.source.stop();
        entry.source.onended = null;
        remove(entry);
      }
      context.suspend().catch(() => {});
    } else if (active) {
      unlock().catch(() => { if (active && !disposed) { failed = true; report(); } });
    }
  }
  function dispose() {
    if (disposed) return;
    stop();
    disposed = true;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibilityChanged);
    if (typeof globalThis.removeEventListener === 'function') globalThis.removeEventListener('pagehide', stop);
    for (const entry of [...voices]) { entry.source.onended = null; remove(entry); }
    context?.close().catch(() => {});
    buffers.clear();
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibilityChanged);
  if (typeof globalThis.addEventListener === 'function') globalThis.addEventListener('pagehide', stop);
  return { start, stop, reset, setMuted, update, dispose };
}
