// A connected, illustrated hand. Matching cubic curves let opening and gripping
// deform one silhouette, without separating any finger from the palm.
const OPEN = [
  [-108,194],
  [-107,163,-105,139,-102,116], [-107,95,-111,75,-111,53],
  [-113,29,-121,-4,-122,-27], [-124,-42,-119,-49,-112,-49],
  [-103,-49,-100,-39,-99,-29], [-97,-10,-92,9,-87,19],
  [-89,-3,-95,-41,-93,-66], [-93,-80,-86,-87,-78,-85],
  [-68,-83,-67,-74,-67,-62], [-67,-42,-63,-13,-60,1],
  [-62,-24,-65,-66,-61,-92], [-59,-106,-53,-112,-45,-110],
  [-35,-108,-33,-100,-33,-86], [-34,-60,-31,-27,-28,-11],
  [-24,-34,-24,-67,-16,-88], [-11,-101,-4,-104,4,-98],
  [12,-92,10,-81,6,-66], [2,-44,-3,-18,-4,6],
  [-5,23,-5,36,0,43], [9,27,21,10,30,2],
  [39,-7,49,-4,53,4], [59,15,50,27,40,38],
  [26,53,17,70,13,89], [10,119,7,154,10,194],
];
const CLOSED = [
  [-108,194],
  [-107,163,-105,139,-102,116], [-106,95,-109,73,-105,54],
  [-108,39,-106,28,-101,23], [-97,18,-91,16,-87,19],
  [-81,22,-79,25,-79,29], [-79,32,-75,32,-75,27],
  [-76,12,-76,1,-69,-5], [-65,-10,-57,-11,-51,-7],
  [-46,-3,-45,3,-46,9], [-46,12,-42,13,-42,7],
  [-43,-8,-41,-22,-34,-27], [-30,-32,-22,-33,-16,-28],
  [-11,-24,-10,-17,-12,-10], [-12,-7,-8,-7,-8,-13],
  [-9,-25,-7,-34,-1,-36], [8,-39,16,-34,21,-27],
  [28,-17,23,-7,15,0], [6,8,-3,16,-7,22],
  [-12,29,-14,34,-13,39], [-7,27,0,16,5,8],
  [12,1,22,6,24,16], [26,24,19,30,12,36],
  [1,49,-2,66,-3,83], [-7,119,-7,154,0,194],
];
// A three-quarter cup: the fingers curl away around the light, while the thumb
// crosses its near edge. This is a separate pose, not a rotated open palm.
const ORB = [
  [-122,194],
  [-119,163,-115,140,-107,117], [-106,97,-103,82,-102,68],
  [-111,54,-117,37,-113,25], [-109,13,-99,9,-91,14],
  [-82,19,-80,24,-78,26], [-77,28,-74,26,-75,21],
  [-81,5,-78,-10,-69,-18], [-58,-26,-49,-19,-43,-10],
  [-38,-4,-34,-1,-31,-5], [-29,-8,-29,-13,-30,-18],
  [-35,-31,-29,-45,-18,-49], [-7,-53,3,-43,8,-32],
  [12,-24,15,-22,19,-26], [22,-29,22,-33,21,-38],
  [22,-49,31,-56,40,-49], [52,-39,54,-24,47,-14],
  [43,-7,36,-8,29,-13], [11,-19,-1,-8,-11,11],
  [-21,28,-21,37,-14,44], [-10,22,5,10,20,9],
  [33,7,42,16,38,27], [35,37,21,43,11,53],
  [-3,67,-7,83,-9,103], [-13,131,-15,163,-13,194],
];
const THUMB_OPEN = [
  [-37,89], [-18,63,-12,49,0,43], [9,27,21,10,30,2],
  [39,-7,49,-4,53,4], [59,15,50,27,40,38],
  [26,53,17,70,13,89], [-2,102,-22,103,-37,89],
];
const THUMB_CLOSED = [
  [-37,89], [-31,65,-25,47,-13,39], [-7,27,0,16,5,8],
  [12,1,22,6,24,16], [26,24,19,30,12,36],
  [1,49,-2,66,-3,83], [-9,98,-26,103,-37,89],
];
const THUMB_ORB = [
  [-43,99], [-36,65,-33,47,-14,44], [-10,22,5,10,20,9],
  [33,7,42,16,38,27], [35,37,21,43,11,53],
  [-3,67,-7,83,-9,103], [-20,112,-34,112,-43,99],
];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,value)=>{const t=clamp((value-a)/(b-a),0,1);return t*t*(3-2*t);};

function posePath(open,closed,grip,orb,orbBlend,roll) {
  const path=new Path2D();
  const point=(i,j)=>{
    const bend=clamp((80-orb[i][j-j%2+1])/130,0,1);
    const cupped=orb[i][j]+roll*bend*(j%2===0?3:4);
    return mix(mix(open[i][j],closed[i][j],grip),cupped,orbBlend);
  };
  path.moveTo(point(0,0),point(0,1));
  for(let i=1;i<open.length;i++) path.bezierCurveTo(...open[i].map((_,j)=>point(i,j)));
  path.closePath();
  return path;
}

export function createHandVisual(canvas) {
  const context=canvas.getContext('2d',{alpha:true});
  if(!context) throw new Error('The illustrated hands need a fresh 2D canvas.');
  // Isolate each hand: the rim cutout must not erase the other hand.
  const layers=Array.from({length:2},()=>{
    const element=document.createElement('canvas');
    return {element,context:element.getContext('2d',{alpha:true})};
  });
  const local={width:280,height:350,x:170,y:130};
  let width=1,height=1,ratio=1;

  function resize() {
    width=Math.max(1,window.innerWidth);
    height=Math.max(1,window.innerHeight);
    ratio=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(width*ratio);
    canvas.height=Math.round(height*ratio);
    for(const layer of layers){
      layer.element.width=Math.round(local.width*ratio*1.5);
      layer.element.height=Math.round(local.height*ratio*1.5);
    }
  }

  function drawHand(layer,grip,orbBlend,roll,phase,time,reducedMotion) {
    const ctx=layer.context, density=ratio*1.5;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,layer.element.width,layer.element.height);
    ctx.setTransform(density,0,0,density,local.x*density,local.y*density);
    ctx.lineCap=ctx.lineJoin='round';
    const body=posePath(OPEN,CLOSED,grip,ORB,orbBlend,roll);
    const thumb=posePath(THUMB_OPEN,THUMB_CLOSED,grip,THUMB_ORB,orbBlend,roll);
    const pulse=reducedMotion?0.5:0.5+Math.sin(time*1.7)*0.5;
    const skin=ctx.createLinearGradient(-104,160,12,-24);
    skin.addColorStop(0,'rgba(205,219,226,0.20)');
    skin.addColorStop(0.58,'rgba(239,233,216,0.35)');
    skin.addColorStop(1,'rgba(255,238,200,0.44)');
    ctx.fillStyle=skin;
    ctx.shadowColor='rgba(255,216,161,0.12)';
    ctx.shadowBlur=9;
    ctx.fill(body);
    ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(255,246,225,0.66)';
    ctx.lineWidth=1.15;
    ctx.stroke(body);

    // One soft light wash gives volume without introducing joint pieces.
    ctx.save();
    ctx.clip(body);
    const glow=ctx.createRadialGradient(0,5,3,-3,12,118);
    glow.addColorStop(0,`rgba(255,211,143,${0.09+grip*0.06+pulse*0.012})`);
    glow.addColorStop(1,'rgba(255,215,158,0)');
    ctx.fillStyle=glow;
    ctx.fillRect(-160,-125,270,340);
    ctx.restore();

    // Only a confirmed rim hold gets this small slot. Its lower edge will be
    // covered by the thumb; the palm and finger roots stay connected.
    if(['holding','raised'].includes(phase)&&grip>0.65&&orbBlend<0.15){
      ctx.save();
      ctx.globalCompositeOperation='destination-out';
      ctx.globalAlpha=smooth(0.65,0.95,grip)*(1-orbBlend/0.15)*0.86;
      ctx.fillStyle='#000';
      ctx.beginPath();
      ctx.roundRect(-3,4,24,5,2.5);
      ctx.fill();
      ctx.restore();
    }

    // The foreground thumb blends into the same palm instead of adding a
    // separately outlined piece. Its outer curve matches the main silhouette.
    const thumbLight=ctx.createLinearGradient(10,4,-16,100);
    thumbLight.addColorStop(0,'rgba(255,241,211,0.32)');
    thumbLight.addColorStop(0.48,'rgba(247,230,203,0.14)');
    thumbLight.addColorStop(1,'rgba(241,227,207,0)');
    ctx.fillStyle=thumbLight;
    ctx.fill(thumb);
    ctx.save();
    ctx.clip(thumb);
    ctx.strokeStyle='rgba(255,243,218,0.32)';
    ctx.lineWidth=0.9;
    ctx.beginPath();
    ctx.moveTo(mix(mix(-34,-33,grip),-39,orbBlend),mix(mix(83,86,grip),96,orbBlend));
    ctx.bezierCurveTo(mix(-26,-34,orbBlend),mix(68,72,orbBlend),mix(mix(-17,-23,grip),-32,orbBlend),mix(mix(56,49,grip),48,orbBlend),mix(mix(0,-12,grip),-14,orbBlend),mix(mix(43,39,grip),44,orbBlend));
    ctx.stroke();
    ctx.restore();

    // Faint nail highlights distinguish the back of an open first-person hand.
    ctx.save();ctx.clip(body);
    ctx.fillStyle=`rgba(255,248,229,${0.10*(1-grip)*(1-orbBlend)})`;
    for(const [x,y,closedX,closedY] of [[-112,-35,-93,24],[-79,-71,-59,-2],[-45,-94,-25,-22],[-1,-85,12,-24]]){
      ctx.beginPath();ctx.ellipse(mix(x,closedX,grip),mix(y,closedY,grip),4.4,8.2,0.06,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
    // Foreshortened nails and short bend creases identify each curled finger.
    // These are surface marks, always clipped inside the one connected hand.
    if(orbBlend>0){
      const cupPoint=(x,y)=>{const bend=clamp((80-y)/130,0,1);return [x+roll*bend*3,y+roll*bend*4];};
      ctx.save();ctx.clip(body);
      ctx.globalAlpha=orbBlend*orbBlend;
      const nails=[
        [-98,23,-0.45,-112,-35,-93,24], [-62,-12,-0.32,-79,-71,-59,-2],
        [-13,-38,0.15,-45,-94,-25,-22], [35,-40,0.48,-1,-85,12,-24],
        [28,19,0.70,43,10,15,17],
      ];
      for(const [x,y,angle,openX,openY,closedX,closedY] of nails){
        const [cx,cy]=cupPoint(x,y);
        ctx.save();
        ctx.translate(mix(mix(openX,closedX,grip),cx,orbBlend),mix(mix(openY,closedY,grip),cy,orbBlend));
        ctx.rotate(angle);
        ctx.fillStyle='rgba(255,248,230,0.20)';
        ctx.strokeStyle='rgba(255,248,231,0.18)';
        ctx.lineWidth=0.7;
        ctx.beginPath();ctx.roundRect(-4.6,-3.5,9.2,7,2.8);ctx.fill();ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle='rgba(255,239,211,0.25)';
      ctx.lineWidth=0.85;
      ctx.beginPath();
      for(const crease of [
        [-103,45,-96,36,-84,38,-79,46], [-73,7,-65,-2,-53,2,-47,11],
        [-25,-19,-17,-28,-6,-24,0,-15], [21,-25,29,-33,40,-28,44,-19],
      ]){
        ctx.moveTo(...cupPoint(crease[0],crease[1]));
        ctx.bezierCurveTo(...cupPoint(crease[2],crease[3]),...cupPoint(crease[4],crease[5]),...cupPoint(crease[6],crease[7]));
      }
      ctx.stroke();
      ctx.restore();
    }
    // Quiet skin folds, with no skeletal lines or individual joint outlines.
    ctx.save();ctx.clip(body);
    ctx.strokeStyle=`rgba(255,242,217,${0.08+grip*0.10})`;
    ctx.lineWidth=0.8;
    ctx.beginPath();
    ctx.moveTo(-90,85);ctx.bezierCurveTo(-79,75,-67,71,-54,73);
    ctx.moveTo(-78,108);ctx.bezierCurveTo(-64,99,-48,96,-35,100);
    ctx.stroke();
    ctx.restore();

    const fade=ctx.createLinearGradient(0,118,0,190);
    fade.addColorStop(0,'rgba(0,0,0,1)');
    fade.addColorStop(0.35,'rgba(0,0,0,0.93)');
    fade.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalCompositeOperation='destination-in';
    ctx.fillStyle=fade;
    ctx.fillRect(-local.x,-local.y,local.width,local.height);
    ctx.globalCompositeOperation='source-over';
  }

  function render({hands=[],phase='',time=0,reducedMotion=false}={}) {
    context.setTransform(1,0,0,1,0,0);
    context.clearRect(0,0,canvas.width,canvas.height);
    const visible=hands.filter(hand=>Number.isFinite(hand.contact?.x)&&Number.isFinite(hand.contact?.y)).slice(0,2);
    visible.forEach((hand,index)=>{
      const grip=smooth(0,1,clamp(hand.grip??0,0,1));
      const orbBlend=clamp(hand.orbBlend??(hand.pose==='orb'?1:0),0,1);
      const roll=clamp(hand.roll??0,-1,1);
      const opacity=clamp(hand.opacity??1,0,1);
      if(!opacity) return;
      drawHand(layers[index],grip,orbBlend,roll,phase,time,reducedMotion);
      const scale=clamp(Math.min(width,height)/680,0.64,1.5)*clamp(hand.scale??1,0.45,2);
      context.save();
      context.setTransform(ratio,0,0,ratio,0,0);
      context.translate(hand.contact.x*width,hand.contact.y*height);
      const cupAngle=(hand.side==='right'?-0.12:0.12)+roll*0.12;
      context.rotate((Number.isFinite(hand.angle)?hand.angle:0)+cupAngle*orbBlend);
      context.scale((hand.side==='right'?-1:1)*scale,scale);
      context.globalAlpha=opacity;
      context.drawImage(layers[index].element,-local.x,-local.y,local.width,local.height);
      context.restore();
    });
  }

  resize();
  return {render,resize,dispose(){
    context.setTransform(1,0,0,1,0,0);
    context.clearRect(0,0,canvas.width,canvas.height);
    layers.forEach(layer=>{layer.element.width=layer.element.height=1;});
  }};
}
