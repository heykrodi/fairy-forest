import { FLIGHT_SECONDS } from './release-state.js';

const clamp = value => Math.max(0, Math.min(1, value));
const smootherstep = value => {
  const t = clamp(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

// Clear the fingertips upward first, then gradually travel back into the sky.
// The extra lift fades into the original flight endpoint without a downward dip.
export function sampleReleaseMotion(progress, reducedMotion = false, initialVelocity = {x:0, y:0, z:0}) {
  const p = Number.isFinite(progress) ? clamp(progress) : 0;
  if (p === 0) return { x: 0, y: 0, z: 0 };
  const time = p * FLIGHT_SECONDS;
  const departure = smootherstep(time / 0.55);
  if (reducedMotion) {
    return {
      x: 0,
      y: (2.5 * p + 15 * p * p) * departure,
      z: (-8 * p - 26 * p * p) * departure,
    };
  }
  const pose = {
    x: (0.9 * p + Math.sin(p * Math.PI) * 0.18) * departure,
    y: (2.5 * p + 25.5 * p * p) * departure
      + 0.62 * smootherstep(time / 1.6) * (1 - p) ** 2,
    z: (-8 * p - 26 * p * p) * smootherstep(time / 0.9),
  };
  const carry = 0.4 * (1 - Math.exp(-time / 0.4));
  for (const axis of ['x', 'y', 'z']) {
    if (Number.isFinite(initialVelocity?.[axis])) pose[axis] += initialVelocity[axis] * carry;
  }
  return pose;
}
