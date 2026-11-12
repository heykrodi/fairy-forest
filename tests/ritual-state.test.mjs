import test from 'node:test';
import assert from 'node:assert/strict';
import { createRitual } from '../ritual-state.js';

const open = { tracked: true, grip: false };
const praying = { ...open, praying: true };
const pinch = { tracked: true, grip: true, canPick: true };

function runFor(ritual, seconds, input = open) {
  const steps = Math.round(seconds * 100);
  for (let i = 0; i < steps; i++) ritual.update(0.01, input);
}

function readyRitual() {
  const ritual = createRitual();
  runFor(ritual, 4, praying);
  runFor(ritual, 1.6, open);
  assert.equal(ritual.state.phase, 'ready');
  return ritual;
}

function carryingRitual() {
  const ritual = readyRitual();
  ritual.update(0.01, pinch);
  assert.equal(ritual.state.phase, 'carrying');
  return ritual;
}

test('starts unlit and waits for two palms gathered together', () => {
  const ritual = createRitual();
  assert.deepEqual(ritual.state, { phase: 'prayer', progress: 0, phaseTime: 0, handLost: false });
  // The input adapter reports praying=false for one hand or separated palms.
  runFor(ritual, 10, { tracked: true, praying: false });
  assert.equal(ritual.state.progress, 0);
  assert.equal(ritual.state.phase, 'prayer');
});

test('prayer pauses without losing the collected light when hands disappear', () => {
  const ritual = createRitual();
  runFor(ritual, 2, praying);
  const collected = ritual.state.progress;
  runFor(ritual, 10, { tracked: false, praying: true });
  assert.equal(ritual.state.progress, collected);
  assert.equal(ritual.state.phase, 'prayer');
  assert.equal(ritual.state.handLost, true);
  runFor(ritual, 2, praying);
  assert.equal(ritual.state.phase, 'reveal');
});

test('finishes the camera reveal before accepting a fresh pickup', () => {
  const ritual = createRitual();
  runFor(ritual, 4, praying);
  runFor(ritual, 1.5, pinch);
  assert.equal(ritual.state.phase, 'reveal');
  runFor(ritual, 0.1, pinch);
  runFor(ritual, 1, pinch);
  assert.equal(ritual.state.phase, 'ready');
  ritual.update(0.01, open);
  ritual.update(0.01, pinch);
  assert.equal(ritual.state.phase, 'carrying');
});

test('a pinch away from the seed does not collect it', () => {
  const ritual = readyRitual();
  ritual.update(0.01, { ...pinch, canPick: false });
  ritual.update(0.01, pinch);
  assert.equal(ritual.state.phase, 'ready');
  ritual.update(0.01, open);
  ritual.update(0.01, pinch);
  assert.equal(ritual.state.phase, 'carrying');
});

test('release away from the burner preserves the seed for another try', () => {
  const ritual = carryingRitual();
  ritual.update(0.01, { ...open, nearTarget: false });
  assert.equal(ritual.state.phase, 'ready');
  assert.equal(ritual.state.progress, 1);
  ritual.update(0.01, pinch);
  assert.equal(ritual.state.phase, 'carrying');
});

test('a deliberate release near the burner settles, lights, and stays lit', () => {
  const ritual = carryingRitual();
  runFor(ritual, 2, { ...pinch, nearTarget: true });
  assert.equal(ritual.state.phase, 'carrying');
  ritual.update(0.01, { ...open, nearTarget: true });
  assert.equal(ritual.state.phase, 'settling');
  runFor(ritual, 1.2, {});
  assert.equal(ritual.state.phase, 'lighting');
  runFor(ritual, 1.5, {});
  assert.ok(Math.abs(ritual.state.progress - 0.5) < 1e-9);
  runFor(ritual, 1.5, {});
  assert.equal(ritual.state.phase, 'lit');
  runFor(ritual, 20, pinch);
  assert.equal(ritual.state.phase, 'lit');
});

test('a lost or replaced hand returning open cannot trigger ignition', () => {
  const ritual = carryingRitual();
  // The input adapter reports tracked=false if the selected hand changes identity.
  ritual.update(0.01, { tracked: false, grip: false, nearTarget: true });
  runFor(ritual, 5, { ...open, nearTarget: true });
  assert.equal(ritual.state.phase, 'carrying');
  assert.equal(ritual.state.handLost, true);
  ritual.update(0.01, { ...pinch, nearTarget: true });
  assert.equal(ritual.state.handLost, false);
  ritual.update(0.01, { ...open, nearTarget: true });
  assert.equal(ritual.state.phase, 'settling');
});

test('reset cancels a pending ignition and keeps the public state reference', () => {
  const ritual = carryingRitual();
  const state = ritual.state;
  ritual.update(0.01, { ...open, nearTarget: true });
  ritual.reset();
  assert.equal(ritual.state, state);
  runFor(ritual, 10, { ...open, nearTarget: true });
  assert.deepEqual(state, { phase: 'prayer', progress: 0, phaseTime: 0, handLost: false });
});

test('frame gaps and invalid time values cannot skip the prayer', () => {
  const ritual = createRitual();
  ritual.update(100, praying);
  assert.equal(ritual.state.phaseTime, 0.1);
  for (const dt of [-2, Infinity, NaN, undefined]) ritual.update(dt, praying);
  assert.equal(ritual.state.phaseTime, 0.1);
  assert.equal(ritual.state.phase, 'prayer');
});
