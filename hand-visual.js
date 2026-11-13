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
  [-145,230],
  [-124,176,-105,140,-97,111], [-94,92,-87,76,-77,62],
  [-69,45,-59,21,-43,3], [-37,-4,-29,-5,-25,1],
  [-21,7,-27,16,-34,25], [-44,39,-50,52,-52,60],
  [-47,35,-33,6,-14,-20], [-7,-30,2,-33,8,-26],
  [14,-19,6,-8,-1,2], [-13,20,-20,40,-23,49],
  [-19,23,-2,-17,19,-48], [27,-60,36,-66,42,-58],
  [48,-50,40,-38,32,-26], [20,-6,11,19,7,31],
  [9,7,24,-40,48,-82], [58,-98,69,-105,76,-96],
  [83,-86,75,-69,68,-56], [54,-32,43,-8,37,10],
  [29,30,21,43,16,47], [29,26,44,9,59,5],
  [73,1,83,8,82,19], [81,29,66,38,53,50],
  [35,69,26,91,20,115], [8,157,-3,197,-9,230],
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
  [-25,125], [-15,90,0,65,16,47], [29,26,44,9,59,5],
  [73,1,83,8,82,19], [81,29,66,38,53,50],
  [35,69,26,91,20,115], [3,139,-13,141,-25,125],
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
  const local={width:300,height:420,x:180,y:150};
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
    skin.addColorStop(0,'rgba(224,197,194,0.10)');
    skin.addColorStop(0.58,'rgba(242,212,189,0.20)');
    skin.addColorStop(1,'rgba(255,229,189,0.28)');
    ctx.fillStyle=skin;
    ctx.shadowColor='rgba(255,196,121,0.25)';
    ctx.shadowBlur=12;
    ctx.fill(body);
    ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(255,226,187,0.54)';
    ctx.lineWidth=1.0;
    ctx.stroke(body);

    // One soft light wash gives volume without introducing joint pieces.
    ctx.save();
    ctx.clip(body);
    const glow=ctx.createRadialGradient(40,-18,3,26,2,150);
    glow.addColorStop(0,`rgba(255,206,134,${0.15+grip*0.06+pulse*0.018})`);
    glow.addColorStop(1,'rgba(255,215,158,0)');
    ctx.fillStyle=glow;
    ctx.fillRect(-180,-150,300,420);
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
        [-34,9,0.50,-112,-35,-93,24], [-2,-17,0.50,-79,-71,-59,-2],
        [33,-49,0.48,-45,-94,-25,-22], [67,-87,0.42,-1,-85,12,-24],
        [69,14,0.70,43,10,15,17],
      ];
      for(const [x,y,angle,openX,openY,closedX,closedY] of nails){
        const [cx,cy]=cupPoint(x,y);
        ctx.save();
        ctx.translate(mix(mix(openX,closedX,grip),cx,orbBlend),mix(mix(openY,closedY,grip),cy,orbBlend));
        ctx.rotate(angle);
        ctx.fillStyle='rgba(255,242,216,0.14)';
        ctx.strokeStyle='rgba(255,242,216,0.10)';
        ctx.lineWidth=0.7;
        ctx.beginPath();ctx.roundRect(-4.6,-3.5,9.2,7,2.8);ctx.fill();ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle='rgba(255,239,211,0.25)';
      ctx.lineWidth=0.85;
      ctx.beginPath();
      for(const crease of [
        [-62,54,-58,48,-51,45,-47,48], [-34,29,-29,22,-22,20,-17,24],
        [-6,4,1,-3,8,-5,13,-1], [25,-25,33,-31,40,-32,44,-28],
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

    const fade=ctx.createLinearGradient(0,mix(118,150,orbBlend),0,mix(190,230,orbBlend));
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
      const scale=clamp(Math.min(width,height)/680,0.64,1.5)*clamp(hand.scale??1,0.45,2)*mix(1,1.08,orbBlend);
      context.save();
      context.setTransform(ratio,0,0,ratio,0,0);
      context.translate(hand.contact.x*width,hand.contact.y*height);
      const cupAngle=(hand.side==='right'?-0.08:0.08)+roll*0.10;
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
