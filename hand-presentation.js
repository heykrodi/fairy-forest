// Compose the wish as two palms cradling a light. Finger articulation and
// gesture decisions still come from the real hands; no absent hand is invented.
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const unit=a=>mul(a,1/Math.max(0.001,Math.hypot(...a)));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const mix=(a,b,t)=>a+(b-a)*t;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export function createHandPresentation() {
  const tracks=new Map();
  let initialCenter=null;

  function reset() { tracks.clear(); initialCenter=null; }

  function present(hands,{width,height,phase='prayer',gathering=false,dt=1/60}={}) {
    const pixels=p=>[p.x*width,p.y*height,(p.z||0)*width];
    const screen=p=>({x:p[0]/width,y:p[1]/height,z:p[2]/width});
    const blend=1-Math.exp(-Math.max(0,dt)*18);
    const sorted=[...hands].sort((a,b)=>a.landmarks[0].x-b.landmarks[0].x);
    const pairCenter=hands.length===2?hands.reduce((n,h)=>n+h.landmarks[0].x/2,0):null;
    if (gathering&&pairCenter!==null&&initialCenter===null) initialCenter=pairCenter;
    const live=new Set(hands.map(hand=>hand.id));
    // Keep the last composition through short tracking gaps, but never draw it.
    for (const [id,track] of tracks) {
      track.missing=live.has(id)?0:track.missing+dt;
      if(track.missing>2) tracks.delete(id);
      else if(!live.has(id)) track.previous=null;
    }

    return hands.map(hand=>{
      const points=hand.landmarks.map(pixels), wrist=points[0];
      let track=tracks.get(hand.id);
      if(!track) {
        track={side:sorted.indexOf(hand)===0?-1:1,weight:0,reference:null,previous:null,missing:0};
        tracks.set(hand.id,track);
      }
      if(!track.reference&&hands.length===2) track.side=sorted.indexOf(hand)===0?-1:1;
      if(phase==='prayer'&&gathering&&hands.length===2) {
        // The palm plane supplies a local frame. Face it toward the viewer,
        // while preserving which side the real thumb is on and every finger bend.
        const up=unit(sub(points[9],wrist));
        const rawAcross=sub(points[17],points[5]);
        let across=unit(sub(rawAcross,mul(up,dot(rawAcross,up))));
        if(across[0]<0) across=mul(across,-1);
        const normal=unit(cross(across,up));
        const length=Math.max(10,Math.hypot(...sub(points[9],wrist)));
        const size=Math.min(width*0.135,height*0.095);
        // Small real movements remain visible inside the deliberately calm framing.
        const drift=clamp((pairCenter-initialCenter)*width*0.25,-size*0.4,size*0.4);
        const angle=track.side*22*Math.PI/180;
        track.reference={
          up,across,normal,scale:clamp(size/length,0.55,2.6),angle,
          sourceWrist:[...wrist],
          targetWrist:[width*0.5+drift+track.side*size*0.62,height*0.865,0],
        };
        track.weight=mix(track.weight,1,1-Math.exp(-dt*4));
      }
      let target=points;
      if(track.reference) {
        const ref=track.reference;
        // Once the wish is formed, freeze the framing reference. Translation
        // follows the user's screen axes so moving right still moves right.
        const travel=sub(wrist,ref.sourceWrist);
        const origin=add(ref.targetWrist,[travel[0]*1.35,travel[1]*1.35,0]);
        const c=Math.cos(ref.angle),s=Math.sin(ref.angle);
        target=points.map(p=>{
          const local=sub(p,wrist);
          const x=dot(local,ref.across)*ref.scale;
          const y=dot(local,ref.up)*ref.scale;
          const z=dot(local,ref.normal)*ref.scale;
          const composed=add(origin,[c*x+s*y,s*x-c*y,-z*0.75]);
          return p.map((v,i)=>mix(v,composed[i],track.weight));
        });
      }
      const rendered=track.previous?target.map((p,i)=>p.map((v,j)=>mix(track.previous[i][j],v,blend))):target;
      track.previous=rendered;
      const landmarks=rendered.map(screen);
      const palm=[0,5,9,13,17].reduce((p,i)=>({x:p.x+landmarks[i].x/5,y:p.y+landmarks[i].y/5}),{x:0,y:0});
      const pointer={x:(landmarks[4].x+landmarks[8].x)/2,y:(landmarks[4].y+landmarks[8].y)/2};
      return {...hand,landmarks,palm,pointer};
    });
  }
  return {present,reset};
}

export function presentedCupCenter(hands) {
  if(hands.length!==2) return null;
  const upper=hands.map(hand=>[5,9,13,17].reduce((p,i)=>({x:p.x+hand.landmarks[i].x/4,y:p.y+hand.landmarks[i].y/4}),{x:0,y:0}));
  return {x:(upper[0].x+upper[1].x)/2,y:(upper[0].y+upper[1].y)/2};
}
