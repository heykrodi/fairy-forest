import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyCuppedHands, createHandProjection } from '../hand-pose.js';
import { exampleCuppedHands } from '../hand-example.js';

const classify = (hands, aspect = 4 / 3) => classifyCuppedHands(hands, aspect);
const shifted = (hand, dx, dy) => ({ ...hand, landmarks: hand.landmarks.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })) });

test('straight side-by-side palms and softly curved palms both form a cup', () => {
  for (const curled of [false, true]) {
    const hands = exampleCuppedHands({ curled });
    // The new classifier must not depend on the old straight-finger boolean.
    hands.forEach(hand => { hand.open = false; });
    const result = classify(hands);
    assert.equal(result.ready, true);
    assert.equal(result.reason, 'ready');
    assert.ok(result.center.x > hands[0].palm.x && result.center.x < hands[1].palm.x);
    assert.ok(result.center.y < (hands[0].palm.y + hands[1].palm.y) / 2);
  }
});

test('waiting guidance distinguishes no hands from one hand', () => {
  assert.equal(classify([]).reason, 'missing');
  assert.equal(classify(exampleCuppedHands().slice(0, 1)).reason, 'one-hand');
});

test('hands far apart do not collect light', () => {
  assert.equal(classify(exampleCuppedHands({ separation: 2.4 })).reason, 'apart');
});

test('overlapping palms and crossed wrists are not a side-by-side cup', () => {
  assert.equal(classify(exampleCuppedHands({ separation: 0.15 })).reason, 'overlap');
  const hands = exampleCuppedHands();
  const firstWrist = hands[0].landmarks[0].x;
  hands[0].landmarks[0].x = hands[1].landmarks[0].x;
  hands[1].landmarks[0].x = firstWrist;
  assert.equal(classify(hands).reason, 'overlap');
});

test('one hand much lower than the other gets alignment guidance', () => {
  const hands = exampleCuppedHands();
  hands[1] = shifted(hands[1], 0, 0.27);
  assert.equal(classify(hands).reason, 'height');
});

test('closed fists and pinches do not begin the prayer', () => {
  const fists = exampleCuppedHands();
  for (const hand of fists) {
    for (const base of [5, 9, 13, 17]) {
      const p = hand.landmarks[base];
      hand.landmarks[base + 3] = { ...p, y: p.y + 0.025 };
    }
  }
  assert.equal(classify(fists).reason, 'open');
  const pinched = exampleCuppedHands();
  pinched[0].pinching = true;
  assert.equal(classify(pinched).reason, 'open');
});

test('upside-down hands do not satisfy the fingertips-up gesture', () => {
  const hands = exampleCuppedHands().map(hand => ({ ...hand, landmarks: hand.landmarks.map(p => ({ ...p, y: 1 - p.y })) }));
  assert.equal(classify(hands).reason, 'open');
});

test('pose classification is independent of camera aspect and distance', () => {
  for (const aspect of [1, 4 / 3, 16 / 9]) {
    for (const scale of [0.55, 1, 1.25]) {
      assert.equal(classify(exampleCuppedHands({ aspect, scale }), aspect).ready, true, `${aspect} at ${scale}`);
    }
  }
});

test('mirroring the scene or swapping detection order preserves the cup', () => {
  const original = exampleCuppedHands();
  const mirrored = original.map(hand => ({ ...hand, landmarks: hand.landmarks.map(p => ({ ...p, x: 1 - p.x })) })).reverse();
  const a = classify(original), b = classify(mirrored);
  assert.equal(b.ready, true);
  assert.ok(Math.abs(a.center.y - b.center.y) < 1e-10);
  assert.ok(Math.abs(1 - a.center.x - b.center.x) < 1e-10);
});

test('projection preserves physical hand proportions and depth', () => {
  for (const [width, height] of [[1920,1080], [390,1000]]) {
    const aspect = 4 / 3;
    const project = createHandProjection(width,height,aspect);
    const origin = project({ x:0.5,y:0.5,z:0 });
    const horizontal = project({ x:0.6,y:0.5,z:0.1 });
    const vertical = project({ x:0.5,y:0.5+0.1*aspect,z:0 });
    assert.ok(Math.abs((horizontal.x-origin.x)*width-(vertical.y-origin.y)*height) < 1e-9);
    assert.ok(Math.abs(horizontal.z-(horizontal.x-origin.x)) < 1e-10);
    assert.equal(origin.x,0.5);
    assert.equal(origin.y,0.66);
    assert.ok(project({x:0,y:0}).x>=0.06-1e-10);
    assert.ok(project({x:1,y:1}).y<=0.97+1e-10);
  }
});

test('invalid landmarks wait without producing a misleading center', () => {
  const hands = exampleCuppedHands();
  hands[0].landmarks[8].x = NaN;
  assert.deepEqual(classify(hands),{ready:false,reason:'open',center:null});
});
