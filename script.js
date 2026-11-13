import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { startExperience } from './experience.js?v=approach-1';
import { sampleApproach } from './approach-motion.js';
import { createEmberCharacter } from './ember-character.js';
import { createLanternFinale } from './lantern-finale.js?v=park-2';
import { createParkFinale } from './park-finale.js?v=park-life-1';

// The lit paper lantern follows the hands, then travels into the same 3D sky.
const canvas = document.querySelector('#scene');
const status = document.querySelector('#status');

try {
  startExperience(createScene());
} catch (error) {
  status.hidden = false;
  status.textContent = '밤하늘을 열지 못했어요. Chrome에서 새로고침해 주세요.';
  console.error('Lantern scene:', error);
}

function createScene() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.90;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let tick = () => {};
  let afterFrame = () => {};
  let ritualView = { active: false, phase: 'gathering', energy: 0, motion: 0, turn: 0, phaseProgress: 0, lift: 0, offset: { x: 0, y: 0 }, tilt: 0, progress: 0, leftHeld: false, rightHeld: false, handLost: false };

  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uAspect: { value: 1 },
      uGlowCenter: { value: new THREE.Vector2(0.65, 0.51) },
      uTop: { value: new THREE.Color('#12182e') },
      uBottom: { value: new THREE.Color('#58404a') },
      uWarmth: { value: 1 },
      uLookUp: { value: 0 },
    },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uAspect, uWarmth, uLookUp;
      uniform vec2 uGlowCenter;
      uniform vec3 uTop, uBottom;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main() {
        float skyY = vUv.y + uLookUp * 0.29;
        vec3 color = mix(uBottom, uTop, smoothstep(0.0, 0.95, skyY));
        vec2 p = (vUv-uGlowCenter) * vec2(uAspect,1.0);
        color += vec3(0.032,0.012,0.009) * exp(-dot(p,p)*8.5) * uWarmth;
        float hill = 0.054 + 0.021*sin(vUv.x*7.0) + 0.013*sin(vUv.x*19.0+1.0);
        color = mix(color, vec3(0.018,0.017,0.032), 0.44*(1.0-smoothstep(hill-0.012,hill+0.024,skyY)));
        float hill2 = 0.016 + 0.018*sin(vUv.x*9.0+2.0);
        color = mix(color, vec3(0.010,0.014,0.026), 0.4*(1.0-smoothstep(hill2-0.01,hill2+0.01,skyY)));
        color += (hash(gl_FragCoord.xy)-0.5)*0.0012;
        gl_FragColor = vec4(color,1.0);
      }`,
  }));
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  scene.add(sky);

  // A repeatable star field; no background image or external texture needed.
  let seed = 2027;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const starPositions = [];
  const starSizes = [];
  for (let i = 0; i < 112; i++) {
    starPositions.push((random() - 0.5) * 48, i < 62 ? random() * 21 - 5 : 16 + random() * 24, -18 - random() * 10);
    starSizes.push(0.7 + random() * 1.6);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(starSizes, 1));
  const stars = new THREE.Points(starGeometry, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uPixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float aSize; uniform float uPixelRatio; varying float vLight;
      void main() { vLight=aSize/2.3; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uPixelRatio; }`,
    fragmentShader: `varying float vLight;
      void main() { float d=length(gl_PointCoord-0.5); float a=(1.0-smoothstep(0.12,0.5,d))*vLight*0.65;
      gl_FragColor=vec4(0.66,0.65,0.74,a); }`,
  }));
  scene.add(stars);

  const lantern = new THREE.Group();
  scene.add(lantern);

  const rimY = -1.20;
  const rimRadius = 0.78;
  // Long paper panels, almost straight sides, and an uneven folded crown.
  // The bottom remains open; the rim is wider than on the former egg-shaped shell.
  const profile = new THREE.CatmullRomCurve3([
    new THREE.Vector3(rimRadius, rimY, 0),
    new THREE.Vector3(0.80, -0.98, 0),
    new THREE.Vector3(0.83, -0.50, 0),
    new THREE.Vector3(0.84, 0.10, 0),
    new THREE.Vector3(0.83, 0.76, 0),
    new THREE.Vector3(0.81, 1.15, 0),
    new THREE.Vector3(0.73, 1.38, 0),
    new THREE.Vector3(0.42, 1.46, 0),
    new THREE.Vector3(0.002, 1.47, 0),
  ]);
  const profilePoints = profile.getPoints(96);
  const paperGeometry = new THREE.LatheGeometry(profilePoints.map(p => new THREE.Vector2(p.x, p.y)), 128);
  const positions = paperGeometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const angle = Math.atan2(x, z);
    const h = THREE.MathUtils.clamp((y - rimY) / 2.67, 0, 1);
    const fade = Math.sin(Math.PI * h);
    const wrinkle = 1 + fade * (0.018 * Math.cos(angle * 8) + 0.012 * Math.sin(angle * 5 + y * 1.7) + 0.006 * Math.sin(angle * 23 + y * 9) + 0.004 * Math.sin(y * 33 + angle * 11));
    const crown = THREE.MathUtils.smoothstep(h, 0.75, 1);
    const crownFold = crown * Math.min(1, Math.hypot(x, z) / 0.28);
    positions.setXYZ(i, x * wrinkle + crown * 0.055, y + crownFold * (0.042 * Math.sin(angle * 3) + 0.026 * Math.cos(angle * 5)), z * wrinkle);
  }
  paperGeometry.computeVertexNormals();

  const paperMaterial = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uWarmth: { value: 1 }, uIgnition: { value: 1 }, uBreath: { value: 0 }, uSway: { value: 0 } },
    vertexShader: `varying vec3 vLocal; varying vec3 vNormal; varying vec2 vUv;
      uniform float uBreath, uSway;
      void main() {
        vec3 p=position; float h=clamp((p.y+1.20)/2.67,0.0,1.0);
        p.xz*=1.0+uBreath*sin(h*3.14159265);
        p.y+=uBreath*(p.y+1.20)*0.5; p.x+=uSway*h*h;
        vLocal=p; vNormal=normalize(normalMatrix*normal); vUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader: `
      varying vec3 vLocal, vNormal; varying vec2 vUv; uniform float uWarmth, uIgnition;
      float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p) { vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
      void main() {
        float h=clamp((vLocal.y+1.20)/2.67,0.0,1.0);
        vec3 normal=normalize(vNormal);
        float facing=pow(abs(normal.z),1.05);
        float grain=noise(vUv*vec2(570.0,820.0));
        float fiber=noise(vUv*vec2(190.0,850.0));
        float wrinkles=noise(vUv*vec2(62.0,120.0));
        float panel=abs(sin(vUv.x*3.14159265*8.0));
        float seam=1.0-smoothstep(0.0,0.045,panel);
        vec3 honey=vec3(0.72,0.29,0.105);
        vec3 cream=vec3(0.88,0.46,0.20);
        vec3 color=mix(cream,honey,smoothstep(0.05,0.96,h));
        float centerLight=0.42 + 0.70*facing;
        float ember=exp(-pow((h-0.18)*3.8,2.0));
        float shading=0.80 + 0.15*dot(normal,normalize(vec3(-0.4,0.7,1.0)));
        color *= centerLight * shading * (0.94 + grain*0.07 + fiber*0.04 + wrinkles*0.045);
        float crease=pow(1.0-abs(noise(vUv*vec2(38.0,75.0))*2.0-1.0),14.0);
        color *= (1.0-seam*0.13)*(1.0-crease*0.10);
        color += vec3(0.13,0.045,0.012) * ember * (0.60+0.4*facing) * uWarmth;
        float edgeFold=1.0-smoothstep(0.0,0.017,h);
        color *= 1.0-edgeFold*0.22;
        vec3 unlit=vec3(0.086,0.064,0.057)*centerLight*shading*(0.92+grain*0.08+wrinkles*0.04);
        unlit*=1.0-seam*0.14;
        color=mix(unlit,color,smoothstep(h*0.33,h*0.33+0.60,uIgnition));
        gl_FragColor=vec4(color,1.0);
      }`,
  });
  lantern.add(new THREE.Mesh(paperGeometry, paperMaterial));

  scene.add(new THREE.HemisphereLight('#e0d9f7', '#3e2634', 1.6));
  const keyLight = new THREE.DirectionalLight('#ffdfac', 2.0);
  keyLight.position.set(-3, 5, 6);
  scene.add(keyLight);

  const bamboo = new THREE.MeshStandardMaterial({ color: '#ae6939', roughness: 0.9 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(rimRadius, 0.017, 8, 96), bamboo);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = rimY;
  lantern.add(rim);
  const innerRim = new THREE.Mesh(new THREE.TorusGeometry(rimRadius - 0.015, 0.007, 6, 96), bamboo);
  innerRim.rotation.x = Math.PI / 2;
  innerRim.position.y = rimY - 0.017;
  lantern.add(innerRim);

  const wireMaterial = new THREE.MeshStandardMaterial({ color: '#6c4635', roughness: 0.7 });
  for (const axis of ['x', 'z']) {
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, rimRadius * 2, 6), wireMaterial);
    wire.position.y = rimY;
    if (axis === 'x') wire.rotation.z = Math.PI / 2;
    else wire.rotation.x = Math.PI / 2;
    lantern.add(wire);
  }
  const burner = new THREE.Group();
  burner.position.y = rimY;
  lantern.add(burner);
  const bowlMaterial = new THREE.MeshStandardMaterial({ color: '#aa784a', roughness: 0.7, metalness: 0.25, emissive: '#9d5a20', emissiveIntensity: 0.18 });
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.015,-0.065), new THREE.Vector2(0.09,-0.055),
    new THREE.Vector2(0.16,0.01), new THREE.Vector2(0.155,0.025),
    new THREE.Vector2(0.12,0.006), new THREE.Vector2(0.06,-0.025), new THREE.Vector2(0.005,-0.03),
  ],32), bowlMaterial);
  burner.add(bowl);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.065,0.055,0.025,20), new THREE.MeshStandardMaterial({ color: '#44352e', roughness: 1 }));
  wick.position.y = -0.012;
  burner.add(wick);

  // Contact positions belong to the rigid rim, not to the breathing paper.
  const frontZ = 0.18;
  const contactX = Math.sqrt(rimRadius * rimRadius - frontZ * frontZ);
  const contacts = [new THREE.Vector3(-contactX, rimY, frontZ), new THREE.Vector3(contactX, rimY, frontZ)];
  const rimCenter = new THREE.Vector3(0, rimY, frontZ);
  const cueMaterials = contacts.map((point, index) => {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.0, 0.40), transparent: true, opacity: 0, depthWrite: false });
    const geometry = new THREE.TorusGeometry(rimRadius + 0.004, 0.010, 6, 24, 0.42);
    const angle = index === 0 ? Math.PI - Math.asin(frontZ / rimRadius) : Math.asin(frontZ / rimRadius);
    geometry.rotateZ(angle - 0.21);
    const cue = new THREE.Mesh(geometry, material);
    cue.rotation.x = Math.PI / 2;
    cue.position.y = rimY - 0.002;
    lantern.add(cue);
    return material;
  });

  const flame = new THREE.Group();
  flame.position.y = rimY + 0.03;
  const flameGeometry = new THREE.SphereGeometry(1, 20, 20);
  const flamePositions = flameGeometry.attributes.position;
  for (let i = 0; i < flamePositions.count; i++) {
    const y = flamePositions.getY(i);
    const taper = 0.72 - 0.30 * y;
    flamePositions.setXYZ(i, flamePositions.getX(i) * taper, y, flamePositions.getZ(i) * taper);
  }
  flameGeometry.computeVertexNormals();
  const outerFlame = new THREE.Mesh(flameGeometry, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.95, 0.13) }));
  outerFlame.scale.set(0.085, 0.18, 0.085);
  outerFlame.position.y = 0.13;
  flame.add(outerFlame);
  const innerFlame = new THREE.Mesh(flameGeometry, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 1.8, 0.8) }));
  innerFlame.scale.set(0.047, 0.11, 0.047);
  innerFlame.position.set(0, 0.09, 0.035);
  flame.add(innerFlame);
  lantern.add(flame);
  const emberLight = new THREE.PointLight('#ffad4e', 1.4, 3, 2);
  emberLight.position.y = rimY + 0.15;
  lantern.add(emberLight);

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 512;
  const context = glowCanvas.getContext('2d');
  const gradient = context.createRadialGradient(256, 256, 0, 256, 256, 256);
  gradient.addColorStop(0, 'rgba(255,186,102,0.09)');
  gradient.addColorStop(0.34, 'rgba(255,137,74,0.025)');
  gradient.addColorStop(1, 'rgba(255,107,51,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 512);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(3.7, 3.7, 1);
  glow.position.z = -0.3;
  lantern.add(glow);
  const parkView = { height: 6, pullback: 27, pitch: 0.085, fov: 50 };
  const finale = createLanternFinale(profile, glowTexture, random, parkView);
  scene.add(finale.group);
  const park = createParkFinale(random);
  scene.add(park.group);
  const finaleOrigin = new THREE.Vector3();

  // The open arcs invite both hands into one shared pocket of warm air.
  const orb = new THREE.Group();
  scene.add(orb);
  const warmthRadius = 0.76;
  const emberCharacter = createEmberCharacter();
  orb.add(emberCharacter.group);
  const warmthCanvas = document.createElement('canvas');
  warmthCanvas.width = warmthCanvas.height = 256;
  const warmthContext = warmthCanvas.getContext('2d');
  const warmthGradient = warmthContext.createRadialGradient(128, 128, 0, 128, 128, 128);
  warmthGradient.addColorStop(0, 'rgba(255,207,124,0.62)');
  warmthGradient.addColorStop(0.08, 'rgba(255,192,105,0.32)');
  warmthGradient.addColorStop(0.26, 'rgba(255,167,86,0.10)');
  warmthGradient.addColorStop(0.62, 'rgba(255,139,73,0.025)');
  warmthGradient.addColorStop(1, 'rgba(255,128,64,0)');
  warmthContext.fillStyle = warmthGradient;
  warmthContext.fillRect(0, 0, 256, 256);
  const warmthTexture = new THREE.CanvasTexture(warmthCanvas);
  warmthTexture.colorSpace = THREE.SRGBColorSpace;
  const orbGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: warmthTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  orbGlow.scale.set(3.5, 3.5, 1);
  orb.add(orbGlow);
  const currents = new THREE.Group();
  currents.position.z = -0.06;
  orb.add(currents);
  const currentMaterials = [];
  for (let strand = 0; strand < 2; strand++) {
    const points = [];
    for (let i = 0; i <= 72; i++) {
      const t = i / 72;
      const angle = t * Math.PI * 0.76 + strand * Math.PI + 0.32;
      const radius = warmthRadius + Math.sin(t * Math.PI) * 0.018;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
    }
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 0.45 }, uEnergy: { value: 0 } },
      vertexShader: `varying vec2 vUv;
        void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `varying vec2 vUv; uniform float uOpacity,uEnergy;
        void main(){
          float taper=pow(sin(vUv.x*3.14159265),1.4);
          vec3 color=mix(vec3(1.0,0.55,0.19),vec3(1.6,1.04,0.40),uEnergy);
          gl_FragColor=vec4(color,taper*uOpacity);
        }`,
    });
    const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 72, 0.004, 6, false), material);
    currents.add(line);
    currentMaterials.push(material);
  }
  const sparkCount = 112;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkAlphas = new Float32Array(sparkCount);
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  sparkGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(sparkAlphas, 1));
  const sparkMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uRatio: { value: renderer.getPixelRatio() }, uEnergy: { value: 0 } },
    vertexShader: `attribute float aAlpha; varying float vAlpha; uniform float uRatio;
      void main(){vAlpha=aAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=(1.3+aAlpha*2.0)*uRatio;}`,
    fragmentShader: `varying float vAlpha; uniform float uEnergy;
      void main(){float d=length(gl_PointCoord-0.5)*2.0;vec3 color=mix(vec3(1.0,0.61,0.29),vec3(1.4,0.91,0.43),uEnergy);
      gl_FragColor=vec4(color,(1.0-smoothstep(0.0,1.0,d))*vAlpha);}`,
  });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.frustumCulled = false;
  orb.add(sparks);

  const ray = new THREE.Raycaster();
  const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const desiredRim = new THREE.Vector3();
  const targetPosition = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  const anchorOffset = new THREE.Vector3();
  const orbHome = new THREE.Vector3();
  const ignitionGate = new THREE.Vector3();
  const burnerWorld = new THREE.Vector3();

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.14, 0.35, 1.10);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let distance = 8.6;
  let narrow = false;
  let initialized = false;
  let lastTime = 0;
  let elapsed = 0;
  let flight = null;
  let approach = null;
  let lastPhase = null;
  let orbTime = 0;
  let shownTurn = 0;
  let wasActive = false;

  function resize() {
    const width = window.innerWidth, height = window.innerHeight;
    const aspect = width / height;
    narrow = width <= 700;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = aspect;
    // Keep both rim contacts inside a portrait screen; desktop brings it closer.
    distance = narrow ? Math.max(8.6, 4.5 / aspect) : 7.3;
    camera.position.set(0, -2.2, distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    sky.material.uniforms.uAspect.value = aspect;
    // Resizing the viewport should not animate the hands away from their rim.
    if (!flight) initialized = false;
    render(performance.now());
  }
  window.addEventListener('resize', resize);

  function worldFromScreen(x, y, z, output) {
    ray.setFromCamera(new THREE.Vector2(x * 2 - 1, 1 - y * 2), camera);
    interactionPlane.constant = -z;
    ray.ray.intersectPlane(interactionPlane, output);
    return output;
  }

  function screenToRim(x, y, z = 0) {
    worldFromScreen(x, y, z, desiredRim);
    anchorOffset.copy(rimCenter).multiply(lantern.scale).applyQuaternion(lantern.quaternion);
    return targetPosition.copy(desiredRim).sub(anchorOffset);
  }

  // An exact critically damped spring avoids frame-rate dependent overshoot.
  function springTo(target, dt) {
    const frequency = 9;
    const decay = Math.exp(-frequency * dt);
    for (const axis of ['x', 'y', 'z']) {
      const delta = lantern.position[axis] - target[axis];
      const change = velocity[axis] + frequency * delta;
      lantern.position[axis] = target[axis] + (delta + change * dt) * decay;
      velocity[axis] = (velocity[axis] - frequency * change * dt) * decay;
    }
  }

  function render(now = 0) {
    const dt = lastTime ? Math.max(0, Math.min((now - lastTime) / 1000, 0.05)) : 0;
    lastTime = now;
    elapsed += dt;
    tick(dt, elapsed);
    const phase = ritualView.phase;
    const reducedMotion = motionPreference.matches;
    const flying = phase === 'released' || phase === 'complete';
    const flightProgress = flying ? THREE.MathUtils.clamp(ritualView.progress, 0, 1) : 0;
    const lookUp = reducedMotion ? 0 : THREE.MathUtils.smoothstep(flightProgress, 0.075, 0.92);
    const restPitch = Math.atan2(2.2, distance);
    const finalPitch = reducedMotion ? restPitch : THREE.MathUtils.degToRad(32);
    const retreat = flying && flight ? THREE.MathUtils.smoothstep(flight.ending, 2, 16) : 0;
    // Reduced-motion viewers get a fixed wide shot instead of a travelling camera.
    const cameraRetreat = reducedMotion ? (phase === 'complete' ? 1 : 0) : retreat;
    camera.position.set(0, THREE.MathUtils.lerp(-2.2, parkView.height, cameraRetreat), distance + cameraRetreat * parkView.pullback);
    camera.fov = THREE.MathUtils.lerp(36, parkView.fov, cameraRetreat);
    camera.updateProjectionMatrix();
    camera.rotation.x = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(restPitch, finalPitch, lookUp), parkView.pitch, cameraRetreat);
    park.update(retreat, flying && flight ? flight.ending : 0, reducedMotion);
    finaleOrigin.set(0, -2.2, distance);
    camera.updateMatrixWorld();
    sky.material.uniforms.uLookUp.value = lookUp;
    const prelude = ritualView.active && ['gathering', 'approaching', 'igniting'].includes(phase);
    const phaseProgress = THREE.MathUtils.clamp(ritualView.phaseProgress || 0, 0, 1);
    const energy = phase === 'gathering' ? THREE.MathUtils.clamp(ritualView.energy || 0, 0, 1) : 1;
    const motion = THREE.MathUtils.clamp(ritualView.motion || 0, 0, 1);
    const arrival = sampleApproach(phase === 'approaching' ? phaseProgress : 1, reducedMotion);
    const orbX = 0.5;
    worldFromScreen(orbX, narrow ? 0.67 : 0.65, 0, orbHome);

    if (ritualView.active !== wasActive || (phase === 'gathering' && lastPhase !== 'gathering')) {
      approach = null;
      orbTime = shownTurn = 0;
    }
    if (!ritualView.active || phase === 'gathering') approach = null;

    if (flying && !flight) {
      // Capture the exact held pose before starting any flight movement.
      flight = { position: lantern.position.clone(), rotation: lantern.rotation.clone(), scale: lantern.scale.clone(), ending: 0 };
      velocity.set(0, 0, 0);
    } else if (!flying && flight) {
      // A deliberate restart begins again within reach, never at the far endpoint.
      flight = null;
      finale.group.visible = false;
      velocity.set(0, 0, 0);
      initialized = false;
    }

    if (flying && flight) {
      const p = flightProgress;
      if (phase === 'complete') flight.ending += dt;
      const afterglow = reducedMotion ? 0 : 1 - Math.exp(-flight.ending * 0.16);
      lantern.position.copy(flight.position).add(new THREE.Vector3(
        reducedMotion ? 0 : 0.9 * p + Math.sin(p * Math.PI) * 0.18,
        2.5 * p + (reducedMotion ? 15 : 25.5) * p * p + afterglow * 1.3,
        -8 * p - 26 * p * p - afterglow * 2.2,
      ));
      lantern.scale.copy(flight.scale);
      lantern.rotation.copy(flight.rotation);
      if (!reducedMotion) {
        lantern.rotation.z += Math.sin(p * Math.PI * 0.8) * 0.055;
        lantern.rotation.y += p * 0.22;
      }
      finale.update(camera, finalPitch, p, afterglow, elapsed, reducedMotion, finaleOrigin, 1 - Math.exp(-flight.ending * 0.16));
    } else if (prelude) {
      if (phase === 'gathering') {
        lantern.rotation.x = -0.035;
        lantern.rotation.y = -0.08;
        lantern.rotation.z = THREE.MathUtils.damp(lantern.rotation.z, 0, 10, dt);
        lantern.scale.setScalar(narrow ? 0.43 : 0.82);
        const target = screenToRim(narrow ? 0.87 : 0.84, narrow ? 0.49 : 0.40, -5);
        if (!initialized) lantern.position.copy(target);
        else springTo(target, dt);
      } else {
        if (phase === 'approaching') {
          if (!approach) approach = {
            rim: lantern.localToWorld(rimCenter.clone()),
            rotation: lantern.rotation.clone(), scale: lantern.scale.x,
          };
          lantern.rotation.set(
            THREE.MathUtils.lerp(approach.rotation.x, -0.035, arrival.travel),
            THREE.MathUtils.lerp(approach.rotation.y, -0.08, arrival.travel) + arrival.yaw,
            THREE.MathUtils.lerp(approach.rotation.z, 0, arrival.travel) + arrival.lean,
          );
          lantern.scale.setScalar(THREE.MathUtils.lerp(approach.scale, narrow ? 1 : 1.10, arrival.travel));
          // Animate the actual open rim: scaling and banking must not pull it off its path.
          worldFromScreen(orbX, 0.605, 0, targetPosition);
          desiredRim.lerpVectors(approach.rim, targetPosition, arrival.travel);
          desiredRim.y += arrival.lift;
          anchorOffset.copy(rimCenter).multiply(lantern.scale).applyQuaternion(lantern.quaternion);
          lantern.position.copy(desiredRim).sub(anchorOffset);
        } else {
          lantern.rotation.set(-0.035, -0.08, 0);
          lantern.scale.setScalar(narrow ? 1 : 1.10);
          // Once the ember has entered the bowl, offer the rim to the waiting hands.
          const handover = THREE.MathUtils.smootherstep(phaseProgress, 0.68, 1);
          lantern.position.copy(screenToRim(
            THREE.MathUtils.lerp(orbX, narrow ? 0.54 : 0.58, handover),
            THREE.MathUtils.lerp(0.605, 0.71, handover),
          ));
        }
        velocity.set(0, 0, 0);
      }
      initialized = true;
    } else {
      const active = ritualView.active;
      const lift = THREE.MathUtils.clamp(ritualView.lift || 0, 0, 1);
      const offset = ritualView.offset || { x: 0, y: 0 };
      const oneHeld = ritualView.leftHeld !== ritualView.rightHeld;
      const tilt = THREE.MathUtils.clamp(ritualView.tilt || 0, -0.16, 0.16) + (oneHeld ? (ritualView.leftHeld ? 0.025 : -0.025) : 0);
      const desiredTilt = active ? tilt : -0.035;
      lantern.rotation.z = THREE.MathUtils.damp(lantern.rotation.z, desiredTilt, 10, dt);
      lantern.rotation.x = -0.035;
      lantern.rotation.y = -0.08;
      lantern.scale.setScalar(narrow ? (active ? 1 : 0.58) : 1.10);
      const centerX = active ? (narrow ? 0.54 : 0.58) : (narrow ? 0.77 : 0.71);
      const centerY = active ? 0.71 : (narrow ? 0.42 : 0.79);
      const x = centerX + (active ? THREE.MathUtils.clamp(offset.x || 0, -0.18, 0.18) : 0);
      const y = centerY - (active ? lift * 0.14 : 0) + (active ? THREE.MathUtils.clamp(offset.y || 0, -0.10, 0.10) : 0);
      const target = screenToRim(x, y);
      if (!initialized) {
        lantern.position.copy(target);
        velocity.set(0, 0, 0);
        initialized = true;
      } else springTo(target, dt);
    }

    // The soft body breathes above the rigid rim while the two fingertips stay put.
    const ignition = !prelude ? 1 : phase === 'igniting' ? THREE.MathUtils.smoothstep(phaseProgress, 0.58, 1) : 0;
    paperMaterial.uniforms.uBreath.value = reducedMotion ? 0 : Math.sin(elapsed * 1.55) * 0.005;
    paperMaterial.uniforms.uSway.value = reducedMotion ? 0 : Math.sin(elapsed * 0.75) * 0.014;
    paperMaterial.uniforms.uWarmth.value = 1 + (reducedMotion ? 0 : Math.sin(elapsed * 1.35) * 0.018);
    paperMaterial.uniforms.uIgnition.value = ignition;
    flame.visible = ignition > 0;
    flame.scale.setScalar(Math.min(1, ignition * 1.8));
    flame.scale.y *= reducedMotion ? 1 : 1 + Math.sin(elapsed * 4.1) * 0.035;
    emberLight.intensity = (1.4 + (reducedMotion ? 0 : Math.sin(elapsed * 2.1) * 0.04)) * ignition;
    bowlMaterial.emissiveIntensity = ignition * 0.18;
    glow.material.opacity = (flying ? 0.70 : 0.55) * ignition;
    cueMaterials.forEach((material, index) => {
      const held = index === 0 ? ritualView.leftHeld : ritualView.rightHeld;
      material.opacity = ritualView.active && !flying && !prelude ? (held ? 0.75 : 0.34 + (reducedMotion ? 0 : Math.sin(elapsed * 1.8) * 0.055)) : 0;
    });
    lantern.updateMatrixWorld(true);
    burnerWorld.copy(burner.localToWorld(new THREE.Vector3(0, 0.015, 0)));
    orb.visible = prelude && (phase !== 'igniting' || phaseProgress < 0.82);
    orb.position.copy(orbHome);
    if (phase === 'igniting' && prelude) {
      ignitionGate.copy(lantern.localToWorld(new THREE.Vector3(0, rimY - 0.20, 0)));
      // Stay below the open rim first, then rise along its center to the bowl.
      if (phaseProgress < 0.30) orb.position.lerpVectors(orbHome, ignitionGate, THREE.MathUtils.smoothstep(phaseProgress, 0, 0.30));
      else orb.position.lerpVectors(ignitionGate, burnerWorld, THREE.MathUtils.smoothstep(phaseProgress, 0.30, 0.60));
    }
    if (prelude) {
      orbTime += reducedMotion ? 0 : dt * (0.025 + motion * 0.72);
      shownTurn = THREE.MathUtils.damp(shownTurn, ritualView.turn || 0, 7, dt);
      const born = THREE.MathUtils.smoothstep(energy, 0.35, 0.90);
      const fading = phase === 'igniting' ? 1 - THREE.MathUtils.smoothstep(phaseProgress, 0.60, 0.82) : 1;
      const transferScale = phase === 'igniting' ? THREE.MathUtils.lerp(1, 0.42, THREE.MathUtils.smoothstep(phaseProgress, 0.15, 0.58)) : 1;
      const birthPulse = arrival.birth;
      const emberScale = (0.015 + THREE.MathUtils.smoothstep(energy, 0, 1) * 0.225) * transferScale;
      emberCharacter.group.scale.set(emberScale * (1 - birthPulse * 0.04), emberScale * (1 + birthPulse * 0.16), emberScale);
      emberCharacter.group.quaternion.copy(camera.quaternion);
      emberCharacter.update({time:elapsed,energy,opacity:THREE.MathUtils.smoothstep(energy,0.04,0.32)*fading,motion,reducedMotion});
      orbGlow.material.opacity = (0.32 + energy * 0.76) * (1 + birthPulse * 0.20) * fading;
      orbGlow.scale.setScalar(3.5 * (1 + birthPulse * 0.18));
      const currentFade = phase === 'gathering' ? 1 : phase === 'approaching' ? 1 - THREE.MathUtils.smootherstep(phaseProgress, 0, 0.20) : 0;
      currents.visible = currentFade > 0;
      currents.rotation.z = reducedMotion ? 0 : orbTime * 0.30 + shownTurn * 0.18;
      currentMaterials.forEach(material => {
        material.uniforms.uOpacity.value = (0.32 + energy * 0.32 + motion * 0.10) * (1 - born * 0.45) * currentFade;
        material.uniforms.uEnergy.value = energy;
      });
      sparkMaterial.uniforms.uEnergy.value = energy;
      for (let i = 0; i < sparkCount; i++) {
        const t = (i / sparkCount + orbTime * 0.14) % 1;
        const angle = i * 2.39996 + orbTime * 0.55 + shownTurn * 0.24;
        const radius = (0.025 + (1 - t) * warmthRadius) * (1 - born * 0.56);
        sparkPositions[i * 3] = Math.cos(angle) * radius;
        sparkPositions[i * 3 + 1] = Math.sin(angle) * radius;
        sparkPositions[i * 3 + 2] = Math.sin(i * 1.9 + orbTime) * radius * 0.24;
        sparkAlphas[i] = Math.sin(t * Math.PI) * (0.40 + energy * 0.38) * (1 - born * 0.45) * fading;
      }
      sparkGeometry.attributes.position.needsUpdate = true;
      sparkGeometry.attributes.aAlpha.needsUpdate = true;
    }
    orb.updateMatrixWorld(true);
    const projectedCenter = (prelude ? orb.position.clone() : lantern.localToWorld(new THREE.Vector3(0, 0.1, 0))).project(camera);
    sky.material.uniforms.uGlowCenter.value.set((projectedCenter.x + 1) / 2, (projectedCenter.y + 1) / 2);
    sky.material.uniforms.uWarmth.value = prelude ? 0.35 + energy * 0.65 : 1;
    composer.render();
    lastPhase = phase;
    wasActive = ritualView.active;
    afterFrame(dt, elapsed);
  }
  resize();
  renderer.setAnimationLoop(render);
  document.addEventListener('visibilitychange', () => {
    lastTime = 0;
    renderer.setAnimationLoop(document.hidden ? null : render);
  });
  status.hidden = true;
  return {
    onFrame(callback) { tick = callback; },
    onAfterFrame(callback) { afterFrame = callback; },
    setState(next) { ritualView = { ...ritualView, ...next }; },
    getLayout() {
      const project = point => {
        const p = lantern.localToWorld(point.clone()).project(camera);
        return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
      };
      const left = project(contacts[0]), right = project(contacts[1]);
      const screen = point => {
        const p = point.clone().project(camera);
        return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
      };
      const born = THREE.MathUtils.smoothstep(ritualView.energy || 0, 0.35, 0.90);
      const handSpread = 1.18 + born * 0.06;
      const handHeight = -0.10 - born * 0.08;
      const orbCenter = screen(orb.position);
      const orbEdge = screen(orb.position.clone().add(new THREE.Vector3(warmthRadius, warmthRadius, 0)));
      return {
        left, right, center: { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 },
        orb: orbCenter,
        orbRadius: { x: Math.abs(orbEdge.x - orbCenter.x), y: Math.abs(orbEdge.y - orbCenter.y) },
        orbLeft: screen(orbHome.clone().add(new THREE.Vector3(-handSpread, handHeight, 0))),
        orbRight: screen(orbHome.clone().add(new THREE.Vector3(handSpread, handHeight, 0))),
        burner: screen(burnerWorld), reducedMotion: motionPreference.matches,
      };
    },
  };
}
