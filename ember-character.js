import * as THREE from 'three';

// A rounded, breathing ember with soft waves rising through its surface.
export function createEmberCharacter() {
  const group = new THREE.Group();
  const content = new THREE.Group();
  group.add(content);
  const geometry = new THREE.SphereGeometry(1, 24, 24);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const taper = 0.88 - 0.08 * y;
    positions.setXYZ(i, positions.getX(i) * taper, y, positions.getZ(i) * taper);
  }
  geometry.computeVertexNormals();
  const outerMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(2.4, 0.95, 0.13), transparent: true, depthWrite: false,
  });
  const innerMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(2.8, 1.8, 0.8), transparent: true, depthWrite: false,
  });
  const outer = new THREE.Mesh(geometry, outerMaterial);
  outer.scale.set(0.66, 0.78, 0.52);
  content.add(outer);
  const inner = new THREE.Mesh(geometry, innerMaterial);
  inner.scale.set(0.43, 0.57, 0.35);
  inner.position.set(0, -0.08, 0.23);
  inner.renderOrder = 1;
  content.add(inner);

  const waves = Array.from({ length: 3 }, () => {
    const mat = new THREE.MeshBasicMaterial({
      color: '#ffc477', transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0,
    });
    const shell = new THREE.Mesh(geometry, mat);
    content.add(shell);
    return shell;
  });
  const rest = positions.array.slice();
  function update({time = 0, opacity = 1, reducedMotion = false} = {}) {
    const alpha = THREE.MathUtils.clamp(opacity, 0, 1);
    content.visible = alpha > 0.001;
    outerMaterial.opacity = alpha;
    innerMaterial.opacity = alpha;
    for (let i = 0; i < positions.count; i++) {
      const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
      const wave = reducedMotion ? 0 : Math.sin(y * 5.5 - time * 3.2) * 0.065
        + Math.sin(y * 9 + time * 2.1 + x * 3) * 0.025;
      positions.setXYZ(i, x * (1 + wave) + wave * (y + 1) * 0.45,
        y * (1 + wave * 0.35), z * (1 + wave));
    }
    positions.needsUpdate = true;
    waves.forEach((shell, index) => {
      const phase = reducedMotion ? index / 3 : (time * 0.3 + index / 3) % 1;
      const radius = 1 + phase * 0.55;
      shell.scale.set(0.66 * radius, 0.78 * radius, 0.52 * radius);
      shell.material.opacity = alpha * Math.sin(phase * Math.PI) * 0.075;
    });
    content.scale.y = reducedMotion ? 1 : 1 + Math.sin(time * 2.8) * 0.07;
    content.scale.x = reducedMotion ? 1 : 1 - Math.sin(time * 2.8) * 0.045;
    content.rotation.z = reducedMotion ? 0 : Math.sin(time * 2.3) * 0.018;
  }
  update();
  return {group, update};
}
