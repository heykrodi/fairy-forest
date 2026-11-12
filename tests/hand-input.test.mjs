import test from 'node:test';
import assert from 'node:assert/strict';
import { describeHands } from '../hand-input.js';

function landmarks(pinched) {
  const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const set = (i, x, y) => Object.assign(points[i], { x, y });
  set(0, 0.5, 0.8);
  set(5, 0.45, 0.6); set(9, 0.5, 0.6); set(13, 0.55, 0.62); set(17, 0.6, 0.65);
  set(6, 0.44, 0.45); set(8, 0.44, 0.3);
  set(10, 0.5, 0.45); set(12, 0.5, 0.3);
  set(14, 0.56, 0.48); set(16, 0.56, 0.35);
  set(18, 0.62, 0.5); set(20, 0.62, 0.4);
  set(4, pinched ? 0.425 : 0.32, pinched ? 0.3 : 0.55);
  return points;
}

function tracker() {
  let tracks = [], sequence = 0, timestamp = 0;
  return (label, pinched, confidence = 0.95) => {
    const result = describeHands({
      landmarks: [landmarks(pinched)],
      handedness: [[{ categoryName: label, score: confidence }]],
      timestamp: timestamp += 85,
      aspect: 4 / 3,
    }, tracks, () => `test-hand-${++sequence}`);
    tracks = result.tracks;
    return result.hands[0];
  };
}

test('an open opposite hand at the same location cannot inherit the held hand ID', () => {
  const frame = tracker();
  const held = frame('Right', true);
  const replacement = frame('Left', false);
  assert.equal(held.pinching, true);
  assert.equal(replacement.pinching, false);
  assert.notEqual(replacement.id, held.id);
});

test('opening the same confidently identified hand preserves its ID', () => {
  const frame = tracker();
  const held = frame('Right', true);
  const released = frame('Right', false);
  assert.equal(released.id, held.id);
  assert.equal(released.pinching, false);
});

test('a brief uncertain handedness flip preserves identity without replacing its reliable label', () => {
  const frame = tracker();
  const held = frame('Right', true);
  const uncertain = frame('Left', true, 0.55);
  const recovered = frame('Right', false);
  assert.equal(uncertain.id, held.id);
  assert.equal(uncertain.identityLabel, 'Right');
  assert.equal(recovered.id, held.id);
});

test('uncertain label noise cannot bridge into a confidently opposite replacement hand', () => {
  const frame = tracker();
  const held = frame('Right', true);
  frame('Left', true, 0.55);
  const replacement = frame('Left', false);
  assert.notEqual(replacement.id, held.id);
});

test('an uncertain opposite open hand does not emit a release for the held track', () => {
  const frame = tracker();
  const held = frame('Right', true);
  const uncertain = frame('Left', false, 0.55);
  const confirmed = frame('Right', false);
  assert.equal(uncertain.id, held.id);
  assert.equal(uncertain.pinching, true);
  assert.equal(confirmed.id, held.id);
  assert.equal(confirmed.pinching, false);
});
