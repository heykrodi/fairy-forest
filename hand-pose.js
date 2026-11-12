// Geometric guidance for two open/softly curved palms held side by side.
// Image landmarks alone do not prove whether the camera sees palm or back.
export function classifyCuppedHands(hands, sourceAspect = 4 / 3) {
  const result = (reason, center = null) => ({ ready: reason === 'ready', reason, center });
  if (!hands?.length) return result('missing');
  if (hands.length < 2) return result('one-hand');
  const aspect = Number.isFinite(sourceAspect) && sourceAspect > 0 ? sourceAspect : 4 / 3;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const average = points => ({ x: points.reduce((n, p) => n + p.x, 0) / points.length, y: points.reduce((n, p) => n + p.y, 0) / points.length });
  const palms = hands.slice(0, 2).map(hand => {
    if (hand.landmarks?.length !== 21 || hand.landmarks.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
    const points = hand.landmarks.map(p => ({ x: p.x, y: p.y / aspect }));
    const upper = average([5, 9, 13, 17].map(i => points[i]));
    const length = distance(points[0], points[9]);
    const width = distance(points[5], points[17]);
    if (length < 0.012 || width < 0.012) return null;
    const directionLength = distance(points[0], upper);
    if (directionLength < 0.005) return null;
    const up = { x: (upper.x - points[0].x) / directionLength, y: (upper.y - points[0].y) / directionLength };
    const fingers = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
    const openFingers = fingers.filter(indices => {
      const [base, joint, distal, tip] = indices.map(i => points[i]);
      const chain = distance(base, joint) + distance(joint, distal) + distance(distal, tip);
      const reach = distance(base, tip);
      const advance = ((tip.x - base.x) * up.x + (tip.y - base.y) * up.y) / length;
      // Allow curled fingertips while rejecting fingers folded into a fist.
      return advance > 0.10 && reach > length * 0.30 && reach / Math.max(chain, 0.001) > 0.34;
    }).length;
    const outline = [0, 5, 9, 13, 17].map(i => points[i]);
    let area = 0;
    outline.forEach((p, i) => {
      const next = outline[(i + 1) % outline.length];
      area += p.x * next.y - next.x * p.y;
    });
    const visiblePalm = Math.abs(area) / 2 > length * length * 0.13;
    const open = !hand.pinching && openFingers >= 3 && visiblePalm && up.y < -0.20;
    return { wrist: points[0], upper, center: average([points[0], upper]), length, width, up, open };
  });
  if (palms.some(palm => !palm)) return result('open');
  palms.sort((a, b) => a.center.x - b.center.x);
  const [left, right] = palms;
  const length = (left.length + right.length) / 2;
  const width = (left.width + right.width) / 2;
  const center = {
    x: (left.upper.x + right.upper.x) / 2 - (left.up.x + right.up.x) * length * 0.09,
    y: ((left.upper.y + right.upper.y) / 2 - (left.up.y + right.up.y) * length * 0.09) * aspect,
  };
  const horizontalGap = right.center.x - left.center.x;
  const wristOrder = right.wrist.x - left.wrist.x;
  if (horizontalGap < width * 0.72 || wristOrder < -width * 0.15) return result('overlap', center);
  if (Math.abs(left.center.y - right.center.y) > length * 0.90) return result('height', center);
  if (distance(left.center, right.center) > length * 3.25) return result('apart', center);
  if (!left.open || !right.open) return result('open', center);
  return result('ready', center);
}

// Letterbox the mirrored camera image into the interaction space. Using one
// physical scale for x, y, and z preserves the shape of palms and fingers.
export function createHandProjection(width, height, sourceAspect = 4 / 3) {
  const w = Number.isFinite(width) && width > 0 ? width : 1;
  const h = Number.isFinite(height) && height > 0 ? height : 1;
  const aspect = Number.isFinite(sourceAspect) && sourceAspect > 0 ? sourceAspect : 4 / 3;
  const scaleX = Math.min(0.88, 0.62 * h * aspect / w);
  const scaleY = scaleX * w / (aspect * h);
  return point => ({
    ...point,
    x: 0.5 + (point.x - 0.5) * scaleX,
    y: 0.66 + (point.y - 0.5) * scaleY,
    z: (point.z || 0) * scaleX,
  });
}
