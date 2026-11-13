import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleReleaseMotion} from '../release-motion.js';
import {FLIGHT_SECONDS} from '../release-state.js';

const atSeconds = (time, reduced = false) => sampleReleaseMotion(time / FLIGHT_SECONDS, reduced);

test('release begins at the captured pose and preserves both original flight endpoints', () => {
  const origin = {x:0, y:0, z:0};
  for (const value of [0, -1, NaN, Infinity, undefined]) {
    assert.deepEqual(sampleReleaseMotion(value), origin);
    assert.deepEqual(sampleReleaseMotion(value, true), origin);
  }
  assert.deepEqual(sampleReleaseMotion(1), {x:0.9, y:28, z:-34});
  assert.deepEqual(sampleReleaseMotion(2), sampleReleaseMotion(1));
  assert.deepEqual(sampleReleaseMotion(1, true), {x:0, y:17.5, z:-34});
});

test('departure has no initial velocity jump and clears the fingers upward before retreating', () => {
  const h = 1e-4;
  for (const reduced of [false, true]) {
    const first = atSeconds(h, reduced);
    for (const coordinate of Object.values(first)) {
      assert.ok(Math.abs(coordinate / h) < 1e-5);
    }
  }
  const clearing = atSeconds(0.5);
  assert.ok(clearing.y > 0.1, 'the initial lift should be visible');
  assert.ok(clearing.y > Math.abs(clearing.z), 'upward separation leads the backward movement');
});

test('flight remains finite and moves only up and away after the extra lift subsides', () => {
  for (const reduced of [false, true]) {
    let previous = sampleReleaseMotion(0, reduced);
    for (let i = 1; i <= 2400; i++) {
      const pose = sampleReleaseMotion(i / 2400, reduced);
      assert.ok(Object.values(pose).every(Number.isFinite));
      assert.ok(pose.x >= previous.x - 1e-12 && pose.x <= 0.9);
      assert.ok(pose.y >= previous.y - 1e-12 && pose.y <= (reduced ? 17.5 : 28));
      assert.ok(pose.z <= previous.z + 1e-12 && pose.z >= -34);
      previous = pose;
    }
  }
});

test('position and velocity remain continuous when the departure curves finish', () => {
  const h = 1e-4;
  for (const reduced of [false, true]) for (const time of [0.55, 0.9, 1.6]) {
    const before = atSeconds(time - h, reduced);
    const at = atSeconds(time, reduced);
    const after = atSeconds(time + h, reduced);
    for (const axis of ['x', 'y', 'z']) {
      assert.ok(Math.abs(after[axis] - before[axis]) < 0.001);
      const incoming = (at[axis] - before[axis]) / h;
      const outgoing = (after[axis] - at[axis]) / h;
      assert.ok(Math.abs(outgoing - incoming) < 0.001, `${axis} speed changes at ${time}s`);
    }
  }
});

test('reduced motion removes the launch flourish and sideways travel', () => {
  const plain = atSeconds(1, true);
  const expressive = atSeconds(1);
  assert.equal(plain.x, 0);
  assert.ok(plain.y < expressive.y * 0.4);
  assert.equal(plain.z, expressive.z);
  assert.equal(sampleReleaseMotion(0.5, true).y, 5);
});

test('release inherits the measured velocity without an initial position jump', () => {
  const velocity = {x:0.2, y:0.8, z:-0.3};
  assert.deepEqual(sampleReleaseMotion(0, false, velocity), {x:0, y:0, z:0});
  const seconds = 1e-5;
  const next = sampleReleaseMotion(seconds / FLIGHT_SECONDS, false, velocity);
  for (const axis of ['x', 'y', 'z']) {
    assert.ok(Math.abs(next[axis] / seconds - velocity[axis]) < 0.001, `${axis} does not inherit its release speed`);
  }
});

test('inherited drift stays bounded and invalid velocity components are ignored', () => {
  const velocity = {x:-0.4, y:1.2, z:0.7};
  for (let i = 0; i <= 240; i++) {
    const p = i / 240;
    const base = sampleReleaseMotion(p);
    const carried = sampleReleaseMotion(p, false, velocity);
    for (const axis of ['x', 'y', 'z']) {
      const drift = carried[axis] - base[axis];
      assert.ok(Number.isFinite(carried[axis]));
      assert.ok(Math.abs(drift) <= Math.abs(velocity[axis]) * 0.4 + 1e-12);
      assert.ok(drift * velocity[axis] >= -1e-12);
    }
    assert.deepEqual(sampleReleaseMotion(p, true, velocity), sampleReleaseMotion(p, true));
  }
  assert.deepEqual(sampleReleaseMotion(0.5, false, {x:NaN, y:Infinity}), sampleReleaseMotion(0.5));
  assert.deepEqual(sampleReleaseMotion(1, false, {x:0, y:0, z:0}), {x:0.9, y:28, z:-34});
});
