import * as THREE from 'three';

// A settled dog with planted paws; only the gaze and loose tail move.
export function createSeatedDalmatian({ mesh, limb, sphere, white, spots, collar, random }) {
  const group = new THREE.Group();
  group.position.set(2.20, 0.03, 0.85);
  group.rotation.y = 0.78;

  mesh(sphere, white, -0.10, 0.59, 0, 0.40, 0.56, 0.32, group);
  mesh(sphere, white, -0.31, 0.29, 0, 0.36, 0.29, 0.36, group);
  mesh(sphere, white, 0.14, 0.94, 0, 0.27, 0.43, 0.27, group);
  for (const side of [-1, 1]) {
    // Folded hind legs and two straight front legs make the seated silhouette.
    mesh(sphere, white, -0.20, 0.23, side * 0.27, 0.31, 0.23, 0.17, group);
    mesh(sphere, white, 0.01, 0.09, side * 0.31, 0.24, 0.09, 0.12, group);
    limb(group, white, [0.23, 0.92, side * 0.19], [0.36, 0.13, side * 0.20], 0.085);
    mesh(sphere, white, 0.45, 0.09, side * 0.20, 0.19, 0.09, 0.12, group);
    mesh(sphere, spots, 0.33, 0.37, side * 0.27, 0.06, 0.085, 0.025, group);
  }
  mesh(sphere, collar, 0.21, 1.15, 0, 0.25, 0.05, 0.26, group);

  const head = new THREE.Group();
  head.position.set(0.22, 1.16, 0);
  head.userData.animated = true;
  group.add(head);
  mesh(sphere, white, 0.08, 0.21, 0, 0.28, 0.27, 0.235, head);
  mesh(sphere, white, 0.34, 0.17, 0, 0.28, 0.14, 0.16, head);
  mesh(sphere, spots, 0.60, 0.19, 0, 0.065, 0.065, 0.09, head);
  mesh(sphere, spots, 0.05, 0.455, 0.07, 0.09, 0.025, 0.065, head);
  for (const side of [-1, 1]) {
    const ear = mesh(sphere, spots, -0.07, 0.09, side * 0.23, 0.135, 0.255, 0.07, head);
    ear.rotation.z = 0.12;
    mesh(sphere, spots, 0.20, 0.28, side * 0.205, 0.033, 0.043, 0.025, head);
  }

  for (let i = 0; i < 21; i++) {
    const angle = i * 2.399963, latitude = (random() - 0.5) * 2.5;
    const x = 0.40 * Math.cos(latitude) * Math.cos(angle);
    const y = 0.56 * Math.sin(latitude), z = 0.32 * Math.cos(latitude) * Math.sin(angle);
    const size = 0.05 + random() * 0.035;
    const patch = mesh(sphere, spots, -0.10 + x * 1.01, 0.59 + y * 1.01, z * 1.01,
      size, size * (0.8 + random() * 0.45), 0.015, group);
    patch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(x / 0.16, y / (0.56 ** 2), z / (0.32 ** 2)).normalize());
  }

  const tail = new THREE.Group();
  tail.position.set(-0.44, 0.25, 0.12);
  tail.userData.animated = true;
  group.add(tail);
  limb(tail, white, [0, 0, 0], [-0.48, -0.07, 0.25], 0.065);
  const tip = new THREE.Group();
  tip.position.set(-0.48, -0.07, 0.25);
  tail.add(tip);
  limb(tip, white, [0, 0, 0], [-0.36, 0.10, 0.18], 0.045);
  mesh(sphere, spots, -0.30, 0.075, 0.15, 0.09, 0.043, 0.05, tip);

  function update(time = 0, reducedMotion = false) {
    if (reducedMotion) {
      tail.rotation.set(0, 0, 0);
      tip.rotation.y = 0;
      head.rotation.set(0, 0, 0.32);
      return;
    }
    const wave = Math.sin(time * 1.65);
    tail.rotation.y = 0.34 * wave + 0.04 * Math.sin(time * 2.4);
    tail.rotation.z = 0.025 * Math.sin(time * 1.65 + 0.7);
    tip.rotation.y = 0.16 * Math.sin(time * 1.65 - 0.6);
    head.rotation.z = 0.32 + 0.025 * Math.sin(time * 0.53);
    head.rotation.y = 0.035 * Math.sin(time * 0.31 + 1.1);
  }
  update(0, true);
  return { group, update };
}
