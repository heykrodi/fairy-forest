import * as THREE from 'three';
import { createSeatedDalmatian } from './park-dalmatian.js?v=park-life-1';

// A small, stylized riverside gathering, viewed from behind the seated visitors.
export function createParkFinale(random) {
  const group = new THREE.Group();
  group.visible = false;
  const materials = [];
  const visitors = [];
  let dogAnimation;
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
    torso.userData.animated = true;
    avatar.add(torso);
    mesh(sphere, coat, 0, 0.37, 0, 0.35, 0.50, 0.26, torso);
    const head = new THREE.Group();
    head.position.y = 0.82;
    torso.add(head);
    mesh(sphere, skin, 0, 0.18, -0.035, 0.245, 0.275, 0.24, head);
    mesh(sphere, hair, 0, 0.27, 0.035, 0.255, 0.21, 0.245, head);
    if (style % 4 === 1) {
      // A low bun seen from behind.
      mesh(sphere, hair, 0, 0.22, 0.26, 0.13, 0.13, 0.12, head);
    } else if (style % 4 === 2) {
      mesh(sphere, hair, 0, 0.12, 0.12, 0.27, 0.28, 0.18, head);
    } else if (style % 4 === 3) {
      mesh(sphere, coats[(style + 2) % coats.length], 0, 0.37, 0.025, 0.28, 0.17, 0.27, head);
      mesh(sphere, coats[(style + 2) % coats.length], 0, 0.28, -0.18, 0.31, 0.045, 0.23, head);
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
      const local = point => new THREE.Vector3(...point).sub(torso.position)
        .applyAxisAngle(new THREE.Vector3(1, 0, 0), -torso.rotation.x).toArray();
      const localHand = local(hand);
      limb(torso, coat, local([side * 0.30, 0.94, 0.02]), localHand, 0.115);
      mesh(sphere, skin, ...localHand, 0.10, 0.11, 0.10, torso);
    }
    visitors.push({ torso, head, restPitch: torso.rotation.x, phase: random() * Math.PI * 2, pace: 0.19 + random() * 0.16 });
  }
  function dalmatian(parent) {
    dogAnimation = createSeatedDalmatian({mesh, limb, sphere, white: dogWhite, spots: dogSpots, collar, random});
    parent.add(dogAnimation.group);
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
  // Keep the pose hierarchy off-scene; draw both static and moving parts in batches.
  group.updateMatrixWorld(true);
  const batches = new Map();
  group.traverse(object => {
    if (!object.isMesh) return;
    const key = object.geometry.uuid + object.material.uuid;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(object);
  });
  const rig = new THREE.Group();
  rig.add(...group.children);
  const animatedBatches = [];
  for (const objects of batches.values()) {
    const batch = new THREE.InstancedMesh(objects[0].geometry, objects[0].material, objects.length);
    const moving = [];
    objects.forEach((object, index) => {
      batch.setMatrixAt(index, object.matrixWorld);
      for (let parent = object; parent; parent = parent.parent) {
        if (parent.userData.animated) { moving.push({object, index}); break; }
      }
    });
    if (moving.length) {
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      batch.frustumCulled = false;
      animatedBatches.push({batch, moving});
    }
    batch.computeBoundingSphere();
    group.add(batch);
  }
  let wasVisible = false;
  function update(reveal, time = 0, reducedMotion = false) {
    group.visible = reveal > 0;
    if (!group.visible && !wasVisible) return;
    wasVisible = group.visible;
    const motion = reducedMotion ? 0 : THREE.MathUtils.smoothstep(reveal, 0, 0.65);
    const clock = reveal > 0 ? time : 0;
    for (const visitor of visitors) {
      const {torso, head, phase, pace, restPitch} = visitor;
      const shift = Math.sin(clock * pace + phase) - Math.sin(phase);
      const breath = Math.sin(clock * 0.85 + phase) - Math.sin(phase);
      torso.rotation.x = restPitch + motion * shift * 0.014;
      torso.rotation.z = motion * (Math.sin(clock * pace * 0.71 + phase * 2) - Math.sin(phase * 2)) * 0.009;
      torso.position.y = 0.32 + motion * breath * 0.004;
      head.rotation.y = motion * (Math.sin(clock * pace * 0.62 + phase) - Math.sin(phase)) * 0.055;
      head.rotation.x = motion * shift * 0.018;
    }
    dogAnimation.update(clock, reducedMotion || reveal <= 0);
    rig.updateMatrixWorld(true);
    for (const {batch, moving} of animatedBatches) {
      for (const {object, index} of moving) batch.setMatrixAt(index, object.matrixWorld);
      batch.instanceMatrix.needsUpdate = true;
    }
    for (const mat of materials) {
      mat.opacity = reveal;
      mat.depthWrite = reveal > 0.95;
    }
  }
  return { group, update };
}
