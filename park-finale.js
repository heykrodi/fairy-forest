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
  const skins = ['#bd9478', '#986e58', '#d4b096'].map(c => material(c));
  const hairs = ['#302a36', '#554039', '#8a786d'].map(c => material(c));
  const trousers = material('#424e5c'), dogWhite = material('#eee8d9'), dogSpots = material('#25252d');
  const collar = material('#aa6756');
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
  function limb(parent, mat, from, to, radius) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const center = a.clone().add(b).multiplyScalar(0.5);
    const part = mesh(sphere, mat, center.x, center.y, center.z, radius, a.distanceTo(b) / 2 + radius, radius, parent);
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    return part;
  }
  function visitor(parent, x, z, style, child = false) {
    const avatar = new THREE.Group();
    avatar.position.set(x, 0.04, z);
    avatar.rotation.y = (random() - 0.5) * 0.58;
    const height = child ? 0.68 : 0.91 + random() * 0.18;
    avatar.scale.setScalar(height);
    parent.add(avatar);
    const coat = coats[style % coats.length], skin = skins[style % skins.length], hair = hairs[style % hairs.length];
    const stretched = style % 3 === 1, leaning = style % 3 === 2;
    const torso = new THREE.Group();
    torso.position.set(0, 0.32, 0);
    torso.rotation.x = leaning ? -0.22 : stretched ? -0.08 : 0.03;
    avatar.add(torso);
    mesh(sphere, coat, 0, 0.37, 0, 0.35, 0.50, 0.26, torso);
    mesh(sphere, skin, 0, 1.0, -0.035, 0.245, 0.275, 0.24, torso);
    mesh(sphere, hair, 0, 1.09, 0.035, 0.255, 0.21, 0.245, torso);
    if (style % 4 === 1) {
      // A low bun seen from behind.
      mesh(sphere, hair, 0, 1.04, 0.26, 0.13, 0.13, 0.12, torso);
    } else if (style % 4 === 2) {
      mesh(sphere, hair, 0, 0.94, 0.12, 0.27, 0.28, 0.18, torso);
    } else if (style % 4 === 3) {
      mesh(sphere, coats[(style + 2) % coats.length], 0, 1.19, 0.025, 0.28, 0.17, 0.27, torso);
      mesh(sphere, coats[(style + 2) % coats.length], 0, 1.10, -0.18, 0.31, 0.045, 0.23, torso);
    }
    for (const side of [-1, 1]) {
      if (stretched || leaning) {
        limb(avatar, trousers, [side * 0.16, 0.16, -0.04], [side * 0.24, 0.12, -0.92], 0.13);
        mesh(sphere, hair, side * 0.24, 0.11, -1.04, 0.15, 0.11, 0.22, avatar);
      } else {
        const leg = mesh(sphere, trousers, side * 0.24, 0.16, -0.22, 0.39, 0.15, 0.20, avatar);
        leg.rotation.y = side * 0.5;
      }
      const hand = leaning ? [side * 0.48, 0.12, 0.42] : [side * 0.30, 0.30, -0.38];
      limb(avatar, coat, [side * 0.30, 0.94, 0.02], hand, 0.115);
      mesh(sphere, skin, ...hand, 0.10, 0.11, 0.10, avatar);
    }
  }
  function dalmatian(parent) {
    const dog = new THREE.Group();
    dog.position.set(2.20, 0.03, 0.85);
    dog.rotation.y = -0.12;
    parent.add(dog);
    mesh(sphere, dogWhite, 0, 0.66, 0, 0.84, 0.34, 0.31, dog);
    limb(dog, dogWhite, [0.52, 0.63, 0], [0.72, 0.98, 0], 0.23);
    mesh(sphere, dogWhite, 0.88, 1.10, 0, 0.29, 0.28, 0.24, dog);
    mesh(sphere, dogWhite, 1.13, 1.04, 0, 0.29, 0.15, 0.17, dog);
    mesh(sphere, dogSpots, 1.39, 1.07, 0, 0.065, 0.075, 0.10, dog);
    mesh(sphere, collar, 0.65, 0.87, 0, 0.24, 0.055, 0.25, dog);
    for (const side of [-1, 1]) {
      const ear = mesh(sphere, dogSpots, 0.72, 0.98, side * 0.235, 0.14, 0.27, 0.075, dog);
      ear.rotation.z = 0.25;
      mesh(sphere, dogSpots, 1.00, 1.16, side * 0.207, 0.035, 0.045, 0.025, dog);
      for (const x of [-0.55, 0.53]) {
        limb(dog, dogWhite, [x, 0.63, side * 0.20], [x + 0.04, 0.12, side * 0.23], 0.085);
        mesh(sphere, dogWhite, x + 0.10, 0.10, side * 0.23, 0.17, 0.09, 0.11, dog);
        mesh(sphere, dogSpots, x + 0.035, 0.32, side * 0.29, 0.065, 0.08, 0.025, dog);
      }
    }
    limb(dog, dogWhite, [-0.72, 0.76, 0], [-1.14, 0.93, 0.03], 0.065);
    limb(dog, dogWhite, [-1.14, 0.93, 0.03], [-1.36, 1.17, 0.04], 0.045);
    // Small patches sit on the curved white coat, not on a flat decal plane.
    for (let i = 0; i < 22; i++) {
      const angle = i * 2.399963, latitude = (random() - 0.5) * 2.4;
      const x = 0.84 * Math.cos(latitude) * Math.cos(angle);
      const y = 0.34 * Math.sin(latitude), z = 0.31 * Math.cos(latitude) * Math.sin(angle);
      const size = 0.05 + random() * 0.04;
      const patch = mesh(sphere, dogSpots, x * 1.008, 0.66 + y * 1.008, z * 1.008,
        size, size * (0.8 + random() * 0.45), 0.015, dog);
      patch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(x / (0.84 ** 2), y / (0.34 ** 2), z / (0.31 ** 2)).normalize());
    }
    mesh(sphere, dogSpots, 0.88, 1.34, 0.04, 0.08, 0.025, 0.065, dog);
  }
  // Loose picnic islands leave broad stretches of grass; no rows or crowd grid.
  const picnics = [
    { x: -18.6, z: -13.1, people: 1, angle: -0.22 },
    { x: -7.8, z: -15.5, people: 2, angle: 0.17 },
    { x: 4.1, z: -12.5, people: 2, angle: -0.12 },
    { x: 16.2, z: -9.5, people: 1, angle: 0.33 },
    { x: -12.1, z: -4.2, people: 3, angle: -0.31 },
    { x: -2.6, z: -6.3, people: 2, angle: 0.24 },
    { x: 7.0, z: -2.7, people: 3, angle: -0.08, family: true },
    { x: -19.5, z: 4.1, people: 1, angle: 0.27 },
    { x: -3.4, z: 3.2, people: 2, angle: -0.18 },
  ];
  picnics.forEach((picnic, index) => {
    const island = new THREE.Group();
    island.position.set(picnic.x, -3.94, picnic.z);
    island.rotation.y = picnic.angle;
    group.add(island);
    const width = picnic.people === 1 ? 2.5 : picnic.people === 2 ? 3.5 : 4.5;
    mesh(box, mats[index % mats.length], 0, 0, 0, width, 0.06, 2.8, island);
    for (let person = 0; person < picnic.people; person++) {
      const child = picnic.family && person === 1;
      visitor(island, (person - (picnic.people - 1) / 2) * 1.10,
        (person % 2 ? -0.10 : 0.18), index + person, child);
    }
    if (picnic.family) dalmatian(island);
    if (index % 3 === 0) mesh(sphere, warm, -width / 2 + 0.25, 0.20, 0.92, 0.10, 0.17, 0.10, island);
    if (index % 3 === 1) {
      mesh(box, coats[(index + 1) % coats.length], width / 2 - 0.32, 0.25, 0.83, 0.48, 0.48, 0.35, island);
    }
  });
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
