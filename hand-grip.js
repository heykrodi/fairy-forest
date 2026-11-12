// A comfortable rim grip can be a thumb/index pinch or three clearly bent fingers.
// Neither a missing hand nor an ambiguous relaxed pose is treated as a grip/open.
export function classifyHandGrip(hand,aspect=4/3,previous=false) {
  const neutral=()=>({grip:false,open:false,amount:0});
  const landmarks=hand?.landmarks;
  if(landmarks?.length!==21||landmarks.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||(p.z!==undefined&&!Number.isFinite(p.z)))) return neutral();
  const ratio=Number.isFinite(aspect)&&aspect>0?aspect:4/3;
  const p=landmarks.map(point=>[point.x,point.y/ratio,point.z||0]);
  const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
  const clamp=n=>Math.max(0,Math.min(1,n));
  const palmLength=distance(p[0],p[9]);
  if(palmLength<0.008) return neutral();
  const fingers=[5,9,13,17].map(base=>{
    const chain=distance(p[base],p[base+1])+distance(p[base+1],p[base+2])+distance(p[base+2],p[base+3]);
    if(chain<palmLength*0.20) return {curled:false,extended:false,amount:0};
    const reach=distance(p[base],p[base+3])/chain;
    const advances=distance(p[base+3],p[0])>distance(p[base+1],p[0])*1.10;
    return {
      curled:reach<(previous?0.88:0.82),
      extended:reach>0.94&&advances,
      amount:clamp((1-reach)/0.45),
    };
  });
  const pinchRatio=distance(p[4],p[8])/palmLength;
  const pinch=hand.pinching===true||pinchRatio<(previous?0.46:0.32);
  const grip=pinch||fingers.filter(f=>f.curled).length>=3;
  const curlAmount=fingers.map(f=>f.amount).sort((a,b)=>b-a).slice(0,3).reduce((sum,n)=>sum+n,0)/3;
  const amount=pinch?1:Math.max(curlAmount,clamp((0.75-pinchRatio)/0.55));
  const open=!grip&&pinchRatio>0.65&&fingers.every(f=>f.extended);
  return {grip,open,amount};
}
