import * as THREE from 'three';

// A small, stylized riverside gathering, viewed from behind the seated visitors.
export function createParkFinale(random) {
  const group = new THREE.Group();
  group.visible = false;
  const materials = [];
  function material(color, glow = false) {
    const mat = glow ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
    mat.transparent = true;
    materials.push(mat);
    return mat;
  }
  const grass = material('#243b39'), path = material('#655969');
  const water = material('#203743', true), stone = material('#424554');
  const warm = material('#e6b97a', true), reflection = material('#837658', true);
  const buildings = material('#222a3b');
  const skin = material('#ae8570'), hair = material('#302a36');
  const coats = ['#bc866d', '#657f94', '#b6a285', '#647e70', '#8b7187'].map(c => material(c));
  const mats = ['#887c89', '#6f8590', '#988368'].map(c => material(c));
  const sphere = new THREE.SphereGeometry(1, 12, 10);
  const box = new THREE.BoxGeometry(1, 1, 1);
  function mesh(geometry, mat, x, y, z, sx, sy, sz, parent = group) {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(x, y, z);
    object.scale.set(sx, sy, sz);
    parent.add(object);
    return object;
  }
  mesh(box, grass, 0, -4.2, 4, 130, 0.4, 54);
  mesh(box, path, 0, -3.98, -19, 130, 0.06, 3);
  mesh(box, water, 0, -4.18, -49, 160, 0.12, 54);
  // Far-bank skyline and a low, warmly lit bridge across the river.
  for (let i = 0; i < 40; i++) {
    const x = -70 + i * 3.6, h = 1.5 + random() * 6;
    mesh(box, buildings, x, -4 + h / 2, -80 - random() * 5, 2 + random(), h, 2);
    for (let j = 0; j < 3; j++) mesh(box, warm, x + (j - 1) * 0.48, -3 + random() * (h - 1), -78.9, 0.16, 0.22, 0.05);
  }
  mesh(box, stone, 0, -1.7, -57, 135, 0.38, 2);
  for (let i = -6; i <= 6; i++) {
    mesh(box, stone, i * 10, -2.9, -57, 0.8, 2.5, 1.2);
    mesh(sphere, warm, i * 10, -1.2, -56.5, 0.16, 0.16, 0.16);
  }
  for (let i = 0; i < 90; i++) {
    mesh(box, reflection, (random() - 0.5) * 110, -4.10, -26 - random() * 45,
      0.3 + random() * 1.3, 0.01, 0.025 + random() * 0.08);
  }
  // Each mat has a small group of rounded avatars with folded legs, facing the sky.
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 7; col++) {
      const x = (col - 3) * 5.2 + (random() - 0.5), z = 19 - row * 10 + random() * 2;
      const mat = mesh(box, mats[(col + row) % mats.length], x, -3.94, z, 3.6, 0.06, 2.7);
      mat.rotation.y = (random() - 0.5) * 0.24;
      for (let person = 0; person < 2 + (col % 2); person++) {
        const avatar = new THREE.Group();
        avatar.position.set(x + (person - 0.7) * 1.02, -3.9, z);
        avatar.rotation.y = (random() - 0.5) * 0.3;
        group.add(avatar);
        const coat = coats[(col + row + person) % coats.length];
        const height = 0.9 + random() * 0.2;
        mesh(sphere, coat, 0, 0.64, 0, 0.36, 0.61 * height, 0.27, avatar);
        mesh(sphere, skin, 0, 1.32 * height, -0.03, 0.25, 0.28, 0.25, avatar);
        mesh(sphere, hair, 0, 1.40 * height, 0.035, 0.26, 0.23, 0.24, avatar);
        for (const side of [-1, 1]) {
          const leg = mesh(sphere, coat, side * 0.25, 0.17, -0.22, 0.39, 0.16, 0.20, avatar);
          leg.rotation.y = side * 0.45;
          const arm = mesh(sphere, coat, side * 0.36, 0.62, -0.08, 0.12, 0.40, 0.14, avatar);
          arm.rotation.x = -0.32;
          mesh(sphere, skin, side * 0.38, 0.31, -0.24, 0.11, 0.12, 0.11, avatar);
        }
      }
      mesh(sphere, warm, x + 1.4, -3.73, z + 0.8, 0.10, 0.17, 0.10);
    }
  }
  // Batch static scenery so the crowd does not add hundreds of draw calls.
  group.updateMatrixWorld(true);
  const batches = new Map();
  group.traverse(object => {
    if (!object.isMesh) return;
    const key = object.geometry.uuid + object.material.uuid;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(object);
  });
  group.clear();
  for (const objects of batches.values()) {
    const batch = new THREE.InstancedMesh(objects[0].geometry, objects[0].material, objects.length);
    objects.forEach((object, index) => batch.setMatrixAt(index, object.matrixWorld));
    batch.computeBoundingSphere();
    group.add(batch);
  }
  function update(reveal) {
    group.visible = reveal > 0;
    for (const mat of materials) {
      mat.opacity = reveal;
      mat.depthWrite = reveal > 0.95;
    }
  }
  return { group, update };
}
