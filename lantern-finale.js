import * as THREE from 'three';

export function createLanternFinale(profile, glowTexture, random) {
  const columns = 12;
  const rows = 8;
  const count = columns * rows;
  const group = new THREE.Group();
  group.visible = false;

  // Distant paper lanterns share a small mesh and a single halo texture.
  const geometry = new THREE.LatheGeometry(profile.getPoints(16).map(({ x, y }) => new THREE.Vector2(x, y)), 20);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const honey = new THREE.Color('#e28c49');
  const gold = new THREE.Color('#ffd29a');
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const height = positions.getY(i);
    const angle = Math.atan2(positions.getX(i), positions.getZ(i));
    const warmth = Math.exp(-((height + 0.53) ** 2) * 1.25);
    const panel = 0.94 + 0.06 * Math.cos(angle * 8);
    color.copy(honey).lerp(gold, warmth).multiplyScalar(panel * (1.11 + 0.16 * Math.cos(angle)));
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const lanterns = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), count);
  const halos = new THREE.InstancedMesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({
    map: glowTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }), count);
  for (const mesh of [lanterns, halos]) {
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh);
  }

  const paths = Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    let across = ((column + 0.18 + random() * 0.64) / columns * 2 - 1) * 0.93;
    const above = -0.62 + (row + 0.13 + random() * 0.74) / rows * 1.49;
    // Leave a small gap near the center for the lantern the visitor released.
    if (Math.abs(across) < 0.22 && above > 0.02 && above < 0.58) across += across < 0 ? -0.17 : 0.17;
    return {
      across, above,
      depth: 35 + random() * 39,
      size: 0.22 + random() * 0.40,
      start: 0.16 + (rows - 1 - row) * 0.03 + random() * 0.17,
      roll: (random() - 0.5) * 0.23,
      phase: random() * Math.PI * 2,
      light: 0.63 + random() * 0.37,
    };
  });
  const transform = new THREE.Object3D();

  function update(camera, finalPitch, progress, afterglow, time, reducedMotion, origin) {
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(18));
    const sinPitch = Math.sin(finalPitch), cosPitch = Math.cos(finalPitch);
    let visible = 0;
    for (const path of paths) {
      if (progress <= path.start) continue;
      const t = (progress - path.start) / (1 - path.start);
      const travel = THREE.MathUtils.smoothstep(t, 0, 1);
      const entrance = THREE.MathUtils.smoothstep(t, 0, 0.12);
      const up = path.above * path.depth * halfHeight;
      const sway = reducedMotion ? 0 : Math.sin(time * 0.36 + path.phase);
      const size = path.size * entrance;
      transform.position.set(
        path.across * path.depth * halfHeight * camera.aspect * (0.78 + 0.22 * travel) + sway * 0.22 * entrance,
        origin.y + path.depth * sinPitch + up * cosPitch - path.depth * 0.84 * (1 - travel) + afterglow * 1.3,
        origin.z - path.depth * cosPitch + up * sinPitch + path.depth * 0.10 * (1 - travel) - afterglow * 2.2,
      );
      transform.rotation.set(0, path.phase, path.roll + sway * 0.07);
      transform.scale.setScalar(size);
      transform.updateMatrix();
      lanterns.setMatrixAt(visible, transform.matrix);
      lanterns.setColorAt(visible, color.setScalar(path.light));

      transform.position.z -= size;
      transform.quaternion.copy(camera.quaternion);
      transform.scale.setScalar(size * 5.4);
      transform.updateMatrix();
      halos.setMatrixAt(visible++, transform.matrix);
    }
    group.visible = visible > 0;
    lanterns.count = halos.count = visible;
    lanterns.instanceMatrix.needsUpdate = halos.instanceMatrix.needsUpdate = true;
    if (lanterns.instanceColor) lanterns.instanceColor.needsUpdate = true;
  }

  return { group, update };
}
