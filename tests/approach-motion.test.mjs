import test from 'node:test';
import assert from 'node:assert/strict';
import {APPROACH_SECONDS, sampleApproach} from '../approach-motion.js';

test('approach starts and finishes on the exact safe pose without position overshoot', () => {
  assert.equal(APPROACH_SECONDS, 3.6);
  const start = {travel:0, lift:0, lean:0, yaw:0, birth:0};
  const end = {...start, travel:1};
  assert.deepEqual(sampleApproach(0), start);
  assert.deepEqual(sampleApproach(1), end);
  assert.deepEqual(sampleApproach(-0.5), start);
  assert.deepEqual(sampleApproach(1.5), end);
  let previous = 0;
  for (let i = 0; i <= 360; i++) {
    const pose = sampleApproach(i / 360);
    assert.ok(Object.values(pose).every(Number.isFinite));
    assert.ok(pose.travel >= previous - 1e-12 && pose.travel <= 1);
    assert.ok(pose.lift >= 0 && pose.lift <= 0.36);
    assert.ok(Math.abs(pose.lean) <= 0.15);
    assert.ok(pose.yaw >= 0 && pose.yaw <= 0.05);
    assert.ok(pose.birth >= 0 && pose.birth <= 1);
    previous = pose.travel;
  }
});

test('birth is readable before the lantern leaves and rotation settles after arrival', () => {
  const anticipation = sampleApproach(0.08);
  assert.equal(anticipation.travel, 0);
  assert.ok(anticipation.lift > 0 && anticipation.lean > 0 && anticipation.birth > 0);
  const moving = sampleApproach(0.5);
  assert.ok(moving.travel > 0.4 && moving.travel < 0.6);
  assert.ok(moving.lift > 0.2 && moving.lean < 0);
  assert.equal(moving.birth, 0);
  const arriving = sampleApproach(0.9);
  assert.equal(arriving.travel, 1);
  assert.equal(arriving.lift, 0);
  assert.ok(Math.abs(arriving.lean) > 0 && Math.abs(arriving.lean) < 0.025);
});

test('position and velocity stay continuous through timing joins and endpoint holds', () => {
  const h = 1e-5;
  for (const time of [0, 0.16, 0.22, 0.24, 0.70, 0.86, 1]) {
    const before = sampleApproach(time - h);
    const at = sampleApproach(time);
    const after = sampleApproach(time + h);
    for (const key of Object.keys(at)) {
      assert.ok(Math.abs(after[key] - before[key]) < 0.001, `${key} jumps at ${time}`);
      const inVelocity = (at[key] - before[key]) / h;
      const outVelocity = (after[key] - at[key]) / h;
      assert.ok(Math.abs(outVelocity - inVelocity) < 0.01, `${key} velocity jumps at ${time}`);
    }
  }
});

test('reduced motion keeps direct smooth travel and removes decorative movement', () => {
  let previous = 0;
  for (let i = 0; i <= 100; i++) {
    const pose = sampleApproach(i / 100, true);
    assert.deepEqual({lift:pose.lift, lean:pose.lean, yaw:pose.yaw, birth:pose.birth}, {lift:0, lean:0, yaw:0, birth:0});
    assert.ok(pose.travel >= previous - 1e-12 && pose.travel <= 1);
    previous = pose.travel;
  }
  assert.ok(sampleApproach(0.08, true).travel > 0);
  assert.equal(sampleApproach(0, true).travel, 0);
  assert.equal(sampleApproach(1, true).travel, 1);
});
