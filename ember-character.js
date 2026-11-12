import * as THREE from 'three';

// A volume of soft light, with no solid shell. The caller owns the group transform.
export function createEmberCharacter() {
  const group = new THREE.Group();
  const content = new THREE.Group();
  group.add(content);
  const BODY=126, TIPS=27, EMBERS=20, count=BODY+TIPS+EMBERS;
  const positions=new Float32Array(count*3), colors=new Float32Array(count*3);
  const sizes=new Float32Array(count), alphas=new Float32Array(count);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('aColor',new THREE.BufferAttribute(colors,3));
  geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
  geometry.setAttribute('aAlpha',new THREE.BufferAttribute(alphas,1));
  const material=new THREE.ShaderMaterial({
    transparent:true, depthWrite:false,
    uniforms:{uViewport:{value:1},uOpacity:{value:1}},
    vertexShader:`
      attribute vec3 aColor; attribute float aSize,aAlpha;
      uniform float uViewport; varying vec3 vColor; varying float vAlpha;
      void main(){
        vec4 view=modelViewMatrix*vec4(position,1.0);
        float scale=length(modelViewMatrix[0].xyz);
        gl_Position=projectionMatrix*view;
        gl_PointSize=max(1.0,aSize*scale*projectionMatrix[1][1]*uViewport*0.5/max(-view.z,0.1));
        vColor=aColor;vAlpha=aAlpha;
      }`,
    fragmentShader:`
      varying vec3 vColor; varying float vAlpha; uniform float uOpacity;
      void main(){
        vec2 p=(gl_PointCoord-0.5)*2.0;float r=dot(p,p);
        float softness=exp(-r*4.5)*(1.0-smoothstep(0.80,1.0,r));
        vec3 color=vColor*mix(vec3(0.90,0.65,0.50),vec3(1.0),exp(-r*2.0));
        gl_FragColor=vec4(color,softness*vAlpha*uOpacity);
      }`,
  });
  const cloud=new THREE.Points(geometry,material);
  cloud.frustumCulled=false;
  const bufferSize=new THREE.Vector2();
  cloud.onBeforeRender=renderer=>{
    renderer.getDrawingBufferSize(bufferSize);
    material.uniforms.uViewport.value=bufferSize.y;
  };
  content.add(cloud);

  // A faint warm field joins the particles without outlining a disc or surface.
  const fieldMaterial=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,
    uniforms:{uOpacity:{value:1},uEnergy:{value:0}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`varying vec2 vUv;uniform float uOpacity,uEnergy;
      void main(){
        vec2 p=(vUv-vec2(0.5,0.43))*2.0;
        float d=p.x*p.x*1.8+p.y*p.y*1.2;
        float glow=exp(-d*3.8);
        vec3 color=mix(vec3(0.77,0.24,0.055),vec3(1.08,0.58,0.16),glow);
        gl_FragColor=vec4(color,glow*(0.11+uEnergy*0.08)*uOpacity);
      }`,
  });
  const field=new THREE.Mesh(new THREE.PlaneGeometry(2.5,2.7),fieldMaterial);
  field.position.set(0,0.05,-0.50);
  field.renderOrder=-1;
  content.add(field);

  const face=new THREE.Group();
  content.add(face);
  const eyeMaterial=new THREE.MeshBasicMaterial({color:'#61371e',transparent:true,depthWrite:false});
  const glintMaterial=new THREE.MeshBasicMaterial({color:'#ffdda0',transparent:true,depthWrite:false});
  const sphere=new THREE.SphereGeometry(1,16,10);
  const eyes=[];
  function oval(parent,mat,x,y,z,sx,sy,sz) {
    const mesh=new THREE.Mesh(sphere,mat);
    mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.renderOrder=2;
    parent.add(mesh);return mesh;
  }
  for(const side of [-1,1]){
    const eye=new THREE.Group();eye.position.set(side*0.23,-0.035,0.59);
    face.add(eye);eyes.push(eye);
    oval(eye,eyeMaterial,0,0,0,0.052,0.075,0.014);
    oval(eye,glintMaterial,-0.013,0.024,0.015,0.012,0.017,0.005);
  }
  const smile=new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.12,-0.19,0.61),new THREE.Vector3(-0.06,-0.23,0.61),
    new THREE.Vector3(0,-0.24,0.61),new THREE.Vector3(0.06,-0.23,0.61),new THREE.Vector3(0.12,-0.19,0.61),
  ]);
  const mouth=new THREE.Mesh(new THREE.TubeGeometry(smile,20,0.013,6,false),eyeMaterial);
  mouth.renderOrder=2;face.add(mouth);

  function fraction(value){return value-Math.floor(value);}
  let flow=0,lastTime=null;
  function update({time=0,energy=0,opacity=1,motion=0,reducedMotion=false}={}) {
    const e=THREE.MathUtils.clamp(energy,0,1),alpha=THREE.MathUtils.clamp(opacity,0,1);
    const dt=lastTime===null?0:THREE.MathUtils.clamp(time-lastTime,0,0.1);
    lastTime=time;
    if(!reducedMotion)flow+=dt*(0.045+THREE.MathUtils.clamp(motion,0,1)*0.13);
    content.visible=alpha>0.001;
    material.uniforms.uOpacity.value=alpha;
    fieldMaterial.uniforms.uOpacity.value=alpha;
    fieldMaterial.uniforms.uEnergy.value=e;
    const facial=THREE.MathUtils.smoothstep(e,0.22,0.65);
    eyeMaterial.opacity=alpha*facial*0.80;
    glintMaterial.opacity=alpha*facial*0.76;
    const blink=reducedMotion?1:1-0.90*Math.exp(-((((time+1.7)%6.3-3)/0.11)**2));
    eyes.forEach(eye=>{eye.scale.y=blink;});

    for(let i=0;i<count;i++){
      const a=fraction((i+1)*0.61803398875),b=fraction((i+1)*0.754877666),c=fraction((i+1)*0.569840291);
      let x,y,z,size,strength;
      if(i<BODY){
        const life=fraction(a+flow);
        y=-0.94+life*1.73;
        const profile=Math.sqrt(Math.max(0.02,1-((y+0.18)/1.03)**2));
        const radius=profile*(0.15+Math.sqrt(b)*0.57);
        const angle=c*Math.PI*2+flow*0.45;
        x=Math.cos(angle)*radius;z=Math.sin(angle)*radius*0.70;
        size=0.52+b*0.25;
        strength=(0.17+c*0.12)*Math.pow(Math.sin(life*Math.PI),0.42);
      } else if(i<BODY+TIPS){
        const n=i-BODY,lobe=n%3,life=fraction(Math.floor(n/3)/9+flow*0.7);
        const side=lobe-1;
        y=0.30+life*(lobe===1?1.02:0.78);
        x=side*(0.43+Math.sin(life*Math.PI)*0.11)+(b-0.5)*0.12;
        z=(c-0.5)*0.31;
        size=0.48-life*0.23;
        strength=0.18*Math.pow(1-life,0.68);
      } else {
        const life=fraction(a+flow*0.62),angle=b*Math.PI*2+flow*0.30;
        x=Math.cos(angle)*(0.74+life*0.18);y=-0.20+life*1.83;
        z=Math.sin(angle)*0.45;size=0.055+c*0.075;
        strength=Math.sin(life*Math.PI)*(0.22+c*0.20);
      }
      const hot=Math.exp(-(x*x*3.2+(y+0.30)**2*1.65));
      positions[i*3]=x;positions[i*3+1]=y;positions[i*3+2]=z;
      colors[i*3]=0.83+hot*0.38;
      colors[i*3+1]=0.25+hot*0.43;
      colors[i*3+2]=0.055+hot*0.12;
      sizes[i]=size;
      alphas[i]=strength*(0.42+e*0.58);
    }
    for(const name of ['position','aColor','aSize','aAlpha'])geometry.attributes[name].needsUpdate=true;
  }
  update();
  return {group,update};
}
