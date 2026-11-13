export const APPROACH_SECONDS = 3.6;

const clamp = value => Math.max(0, Math.min(1, value));
const smootherstep = value => {
  const t = clamp(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const bell = value => {
  if (value <= 0 || value >= 1) return 0;
  return Math.sin(Math.PI * value) ** 2;
};

// The open rim never overshoots its destination: only the paper's small
// rotation follows through, so the ember can enter the opening safely.
export function sampleApproach(progress, reducedMotion = false) {
  const p = clamp(progress);
  if (reducedMotion) {
    return { travel: smootherstep(p), lift: 0, lean: 0, yaw: 0, birth: 0 };
  }
  const travel = smootherstep((p - 0.16) / 0.70);
  const anticipation = bell(p / 0.22);
  const arc = bell(travel);
  const settle = clamp((p - 0.70) / 0.30);
  const followThrough = 0.025 * Math.sin(settle * Math.PI * 2) * bell(settle) * Math.exp(-2 * settle);
  return {
    travel,
    lift: 0.10 * anticipation + 0.26 * arc,
    lean: 0.035 * anticipation - 0.09 * arc + followThrough,
    yaw: 0.05 * arc,
    birth: bell(p / 0.24),
  };
}
