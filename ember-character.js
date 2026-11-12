import * as THREE from 'three';

// Match the small tapered flame inside the lantern. The caller grows it with energy.
export function createEmberCharacter() {
  const group = new THREE.Group();
  const content = new THREE.Group();
  group.add(content);
  const geometry = new THREE.SphereGeometry(1, 24, 24);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const taper = 0.72 - 0.30 * y;
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
  outer.scale.set(0.425, 0.90, 0.425);
  content.add(outer);
  const inner = new THREE.Mesh(geometry, innerMaterial);
  inner.scale.set(0.235, 0.55, 0.235);
  inner.position.set(0, -0.20, 0.175);
  inner.renderOrder = 1;
  content.add(inner);

  function update({time = 0, opacity = 1, reducedMotion = false} = {}) {
    const alpha = THREE.MathUtils.clamp(opacity, 0, 1);
    content.visible = alpha > 0.001;
    outerMaterial.opacity = alpha;
    innerMaterial.opacity = alpha;
    content.scale.y = reducedMotion ? 1 : 1 + Math.sin(time * 4.1) * 0.035;
    content.rotation.z = reducedMotion ? 0 : Math.sin(time * 2.3) * 0.018;
  }
  update();
  return {group, update};
}
