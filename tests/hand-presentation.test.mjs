import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandPresentation, presentedCupCenter } from '../hand-presentation.js';
import { createHandProjection } from '../hand-pose.js';
import { exampleCuppedHands } from '../hand-example.js';

const viewport = { width: 1280, height: 800 };
const options = { ...viewport, phase: 'prayer', gathering: true, dt: 1 / 60 };
const shift = (hands, dx, dy = 0) => hands.map(hand => ({
  ...hand,
  landmarks: hand.landmarks.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })),
}));

function input(size = viewport) {
  const project = createHandProjection(size.width, size.height, 4 / 3);
  return exampleCuppedHands({ curled: false }).map(hand => ({
    ...hand, landmarks: hand.landmarks.map(project),
    palm: project(hand.palm), pointer: project(hand.pointer),
  }));
}

function settle(presentation, hands, overrides = {}, frames = 240) {
  let result;
  for (let i = 0; i < frames; i++) result = presentation.present(hands, { ...options, ...overrides });
  return result;
}

const pixelDistance = (a, b, size = viewport) => Math.hypot((a.x - b.x) * size.width, (a.y - b.y) * size.height);
function assertSamePosition(a, b, tolerance = 1) {
  for (const hand of a) {
    const other = b.find(item => item.id === hand.id);
    assert.ok(other, 'the same hand ID must remain present');
    hand.landmarks.forEach((point, i) => assert.ok(pixelDistance(point, other.landmarks[i]) < tolerance));
  }
}

test('pickup pointer follows the final displayed thumb and index, including smoothing', () => {
  const presentation = createHandPresentation();
  const hands = input();
  for (let frame = 0; frame < 100; frame++) {
    const moved = shift(hands, Math.sin(frame / 12) * 0.06);
    const displayed = presentation.present(moved, options);
    for (const hand of displayed) {
      assert.equal(hand.pointer.x, (hand.landmarks[4].x + hand.landmarks[8].x) / 2);
      assert.equal(hand.pointer.y, (hand.landmarks[4].y + hand.landmarks[8].y) / 2);
    }
  }
});

test('different starting positions form a stable lower-center cup on wide and tall screens', () => {
  for (const size of [viewport, { width: 390, height: 844 }]) {
    for (const dx of [-0.12, 0.12]) {
      const presentation = createHandPresentation();
      const hands = shift(input(size), dx, -0.07);
      const displayed = settle(presentation, hands, size);
      const center = presentedCupCenter(displayed);
      assert.ok(Math.abs(center.x - 0.5) < 0.025, 'the cup should settle at the screen center');
      assert.ok(center.y > 0.65 && center.y < 0.87, 'the cup belongs below the lantern');
      assert.ok(displayed[0].landmarks[0].x < center.x);
      assert.ok(displayed[1].landmarks[0].x > center.x);
      const drifted = settle(presentation, shift(hands, 0.08), size, 120);
      assert.ok(Math.abs(presentedCupCenter(drifted).x - center.x) < 0.04, 'small body drift should stay calm');
      assert.deepEqual(presentation.present([], { ...options, ...size }), []);
      assert.equal(presentedCupCenter([]), null);
      assert.equal(presentedCupCenter(displayed.slice(0, 1)), null);
    }
  }
});

test('reveal and ready keep the last composition without a position jump', () => {
  const presentation = createHandPresentation();
  const hands = input();
  const prayer = settle(presentation, hands);
  const reveal = presentation.present(hands, { ...options, phase: 'reveal', gathering: false });
  assertSamePosition(prayer, reveal);
  settle(presentation, hands, { phase: 'reveal', gathering: false }, 96);
  const ready = presentation.present(hands, { ...options, phase: 'ready', gathering: false });
  assertSamePosition(prayer, ready);
});

test('a ready hand moves right with the real hand instead of being pulled back into the cup', () => {
  const presentation = createHandPresentation();
  const hands = input();
  const initial = settle(presentation, hands);
  const moved = shift(hands, 0.08);
  const ready = settle(presentation, moved, { phase: 'ready', gathering: false }, 60);
  for (let i = 0; i < ready.length; i++) {
    const dx = ready[i].pointer.x - initial[i].pointer.x;
    assert.ok(dx > 0.06 && dx < 0.16, 'intentional travel must remain visible');
  }
  const carrying = presentation.present(moved, { ...options, phase: 'carrying', gathering: false });
  assertSamePosition(ready, carrying);
});

test('a right hand detected first does not take the left hand slot when the pair arrives', () => {
  const presentation = createHandPresentation();
  const [left, right] = input();
  presentation.present([right], { ...options, gathering: false });
  const displayed = settle(presentation, [right, left]);
  const leftWrist = displayed.find(hand => hand.id === left.id).landmarks[0];
  const rightWrist = displayed.find(hand => hand.id === right.id).landmarks[0];
  assert.ok(leftWrist.x < 0.5 && rightWrist.x > 0.5);
  assert.ok((rightWrist.x - leftWrist.x) * viewport.width > 40);
  const reordered = presentation.present([left, right], options);
  assertSamePosition(displayed, reordered);
});

test('presentation preserves gesture flags and real finger articulation without mutating input', () => {
  const presentation = createHandPresentation();
  const hands = input();
  settle(presentation, hands);
  hands[0].pinching = true;
  hands[0].open = false;
  hands[0].landmarks[8] = { ...hands[0].landmarks[4] };
  const before = structuredClone(hands);
  const displayed = settle(presentation, hands, { phase: 'ready', gathering: false }, 120);
  assert.deepEqual(hands, before);
  displayed.forEach((hand, i) => {
    assert.equal(hand.id, hands[i].id);
    assert.equal(hand.pinching, hands[i].pinching);
    assert.equal(hand.open, hands[i].open);
  });
  assert.ok(pixelDistance(displayed[0].landmarks[4], displayed[0].landmarks[8]) < 0.1);
  assert.ok(pixelDistance(displayed[1].landmarks[4], displayed[1].landmarks[8]) > 10);
});

test('reset clears old composition and missing hands never produce synthetic tracking', () => {
  const presentation = createHandPresentation();
  const hands = input();
  settle(presentation, hands);
  assert.deepEqual(presentation.present([], { ...options, phase: 'ready', gathering: false }), []);
  presentation.reset();
  const fresh = presentation.present(hands, { ...options, gathering: false });
  assertSamePosition(fresh, hands, 1e-8);
});
