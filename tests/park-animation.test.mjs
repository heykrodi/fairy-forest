import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'three'
      ? new URL('../vendor/three.module.js', import.meta.url).href
      : specifier, context);
  },
});
const THREE = await import('../vendor/three.module.js');
const { createParkFinale } = await import('../park-finale.js');
const { createSeatedDalmatian } = await import('../park-dalmatian.js');

function randomSource() {
  let seed = 2027;
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function matrices(park) {
  return park.group.children.map(batch => Array.from(batch.instanceMatrix.array));
}
function assertFinite(park) {
  for (const matrix of matrices(park)) assert.ok(matrix.every(Number.isFinite));
}

test('park visitors animate while static scenery stays in place', () => {
  const park = createParkFinale(randomSource());
  park.update(1, 0, false);
  const before = matrices(park);
  park.update(1, 7.25, false);
  const after = matrices(park);
  let changed = 0, staticBatches = 0;
  park.group.children.forEach((batch, index) => {
    if (batch.instanceMatrix.usage === THREE.DynamicDrawUsage) {
      if (before[index].some((value, i) => value !== after[index][i])) changed++;
    } else {
      staticBatches++;
      assert.deepEqual(after[index], before[index], 'static ground and skyline must not drift');
    }
  });
  assert.ok(changed > 0, 'the rendered instances must actually move');
  assert.ok(staticBatches > 0, 'environment remains separate from animation');
  assertFinite(park);
});

test('reduced motion restores a fixed pose even after normal animation', () => {
  const park = createParkFinale(randomSource());
  park.update(1, 0, true);
  const rest = matrices(park);
  park.update(1, 23, false);
  park.update(1, 23, true);
  assert.deepEqual(matrices(park), rest);
  park.update(1, 1_000_000, true);
  assert.deepEqual(matrices(park), rest);
});

test('hiding and showing the park restores the same initial visible pose', () => {
  const park = createParkFinale(randomSource());
  assert.equal(park.group.visible, false);
  park.update(1, 0, false);
  const initial = matrices(park);
  park.update(1, 42, false);
  park.update(0, 42, false);
  assert.equal(park.group.visible, false);
  park.update(0, 600, false);
  park.update(1, 0, false);
  assert.equal(park.group.visible, true);
  assert.deepEqual(matrices(park), initial);
});

test('repeated timestamps do not accumulate drift and long sessions stay finite', () => {
  const park = createParkFinale(randomSource());
  park.update(1, 11.8, false);
  const expected = matrices(park);
  for (let frame = 0; frame < 120; frame++) park.update(1, 11.8, false);
  assert.deepEqual(matrices(park), expected);
  for (const time of [3600, 86400, 1_000_000_000]) {
    park.update(1, time, false);
    assertFinite(park);
  }
});

function dogFixture() {
  const sphere = new THREE.SphereGeometry(1, 8, 6);
  const material = new THREE.MeshBasicMaterial();
  function mesh(geometry, mat, x, y, z, sx, sy, sz, parent) {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(x, y, z);
    object.scale.set(sx, sy, sz);
    parent.add(object);
    return object;
  }
  function limb(parent, mat, from, to, radius) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const center = a.clone().add(b).multiplyScalar(0.5);
    const object = mesh(sphere, mat, center.x, center.y, center.z,
      radius, a.distanceTo(b) / 2 + radius, radius, parent);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    return object;
  }
  return createSeatedDalmatian({ mesh, limb, sphere, white: material,
    spots: material, collar: material, random: randomSource() });
}

test('seated dog moves its head and tail while its body and planted paws stay fixed', () => {
  const dog = dogFixture();
  dog.update(0, false);
  dog.group.updateMatrixWorld(true);
  const moving = [], fixed = [], paws = [];
  dog.group.traverse(object => {
    if (!object.isMesh) return;
    let animated = false;
    for (let parent = object; parent; parent = parent.parent) animated ||= !!parent.userData.animated;
    (animated ? moving : fixed).push({ object, initial: object.matrixWorld.toArray() });
    if (!animated && object.parent === dog.group && object.position.y <= 0.1) paws.push(object);
  });
  assert.ok(paws.length >= 4, 'front and folded hind paws should remain planted');
  assert.ok(moving.length > 0);
  for (const time of [0.8, 2.2, 9.5, 10000]) {
    dog.update(time, false);
    dog.group.updateMatrixWorld(true);
    for (const { object, initial } of fixed) assert.deepEqual(object.matrixWorld.toArray(), initial);
    assert.ok(moving.some(({ object, initial }) => object.matrixWorld.elements.some((v, i) => v !== initial[i])));
  }
  dog.update(0, true);
  dog.group.updateMatrixWorld(true);
  const still = moving.map(({ object }) => object.matrixWorld.toArray());
  dog.update(10000, true);
  dog.group.updateMatrixWorld(true);
  assert.deepEqual(moving.map(({ object }) => object.matrixWorld.toArray()), still);
});
