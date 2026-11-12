// Explicitly synthetic demonstration landmarks, never a fallback for tracking.
// They are used by the labelled hand-shape preview and geometric regression tests.
export function exampleCuppedHands({ curled = true, aspect = 4 / 3, scale = 1, separation = 1 } = {}) {
  const shape = [
    [0, 0, 0], [-0.28, -0.16, -0.01], [-0.52, -0.42, -0.02], [-0.78, -0.62, -0.04], [-0.92, -0.83, -0.06],
    [-0.42, -0.95, 0], [-0.46, -1.52, -0.02], [-0.48, -1.85, -0.04], [-0.47, -2.10, -0.05],
    [-0.08, -1.07, 0], [-0.09, -1.70, -0.02], [-0.10, -2.04, -0.04], [-0.10, -2.30, -0.05],
    [0.25, -1.02, 0], [0.29, -1.57, -0.02], [0.29, -1.88, -0.04], [0.26, -2.08, -0.05],
    [0.53, -0.85, 0], [0.66, -1.26, -0.02], [0.69, -1.51, -0.04], [0.67, -1.70, -0.05],
  ];
  if (curled) {
    for (const base of [5, 9, 13, 17]) {
      const [x, y] = shape[base];
      const reach = base === 17 ? 0.82 : 1;
      shape[base + 1] = [x + 0.05, y - 0.52 * reach, -0.07];
      shape[base + 2] = [x + 0.07, y - 0.73 * reach, -0.27];
      shape[base + 3] = [x + 0.04, y - 0.57 * reach, -0.45];
    }
  }
  return [-1, 1].map((side, index) => {
    const wristX = 0.5 + side * 0.15 * separation;
    const direction = -side;
    const landmarks = shape.map(([x, y, z]) => ({
      x: 0.5 + (wristX + direction * x * 0.14 - 0.5) * scale,
      y: 0.62 + (0.80 + y * 0.14 * aspect - 0.62) * scale,
      z: z * 0.14 * scale,
    }));
    const palm = [0, 5, 9, 13, 17].reduce((p, i) => ({ x: p.x + landmarks[i].x / 5, y: p.y + landmarks[i].y / 5 }), { x: 0, y: 0 });
    const pointer = { x: (landmarks[4].x + landmarks[8].x) / 2, y: (landmarks[4].y + landmarks[8].y) / 2 };
    return {
      id: `example-hand-${index + 1}`, synthetic: true, landmarks, palm, pointer,
      palmScale: Math.hypot(landmarks[0].x - landmarks[9].x, (landmarks[0].y - landmarks[9].y) / aspect),
      pinching: false, open: true,
    };
  });
}
