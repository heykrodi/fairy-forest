// Recognize one upright, mostly extended hand. The orb state checks that two
// such hands are close together for long enough to count as a prayer.
export function classifyPrayerHand(hand,aspect=4/3) {
  const landmarks=hand?.landmarks;
  if(landmarks?.length!==21||landmarks.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||(p.z!==undefined&&!Number.isFinite(p.z)))) return false;
  const ratio=Number.isFinite(aspect)&&aspect>0?aspect:4/3;
  const points=landmarks.map(p=>({x:p.x,y:p.y/ratio,z:p.z||0}));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  const wrist=points[0],middle=points[9];
  const palmLength=distance(wrist,middle);
  const projectedLength=Math.hypot(middle.x-wrist.x,middle.y-wrist.y);
  if(palmLength<0.008||projectedLength<palmLength*0.4||wrist.y-middle.y<projectedLength*0.55) return false;

  const extended=[5,9,13,17].filter(base=>{
    const knuckle=points[base],joint=points[base+1],tip=points[base+3];
    const chain=distance(knuckle,joint)+distance(joint,points[base+2])+distance(points[base+2],tip);
    return chain>palmLength*0.2
      &&distance(knuckle,tip)/chain>0.9
      &&distance(wrist,tip)>distance(wrist,joint)*1.08
      &&knuckle.y-tip.y>palmLength*0.25;
  });
  return extended.length>=3;
}
