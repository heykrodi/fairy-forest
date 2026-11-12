import { FilesetResolver, HandLandmarker } from './vendor/mediapipe/vision_bundle.mjs';

let detector;

self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      // The module loader works inside a module Worker without a document.
      const files = await FilesetResolver.forVisionTasks(
        new URL('./vendor/mediapipe/wasm', import.meta.url).href, true,
      );
      detector = await HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: new URL('./vendor/mediapipe/hand_landmarker.task', import.meta.url).href,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'error', message: String(error.message || error) });
    }
    return;
  }

  if (data.type === 'frame') {
    try {
      if (!detector) throw new Error('Hand detector is not ready.');
      const result = detector.detectForVideo(data.bitmap, data.timestamp);
      self.postMessage({
        type: 'result',
        landmarks: result.landmarks,
        handedness: result.handedness,
        timestamp: data.timestamp,
        aspect: data.bitmap.width / data.bitmap.height,
      });
    } catch (error) {
      self.postMessage({ type: 'error', message: String(error.message || error) });
    } finally {
      data.bitmap.close();
    }
  }
};
