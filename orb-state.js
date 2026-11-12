// sampleTime is a monotonic camera/performance timestamp in milliseconds.
// Charge uses relative two-hand motion only, never repeated render frames.
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const mix=(a,b,t)=>a+(b-a)*t;

export function createOrbState() {
  const state={phase:'gathering',energy:0,motion:0,turn:0,phaseProgress:0};
  let previous=null,filtered=null,anchor=null;
  let phaseTime=0,motionTarget=0,sinceSample=0,chargeWindow=0;
  const tracked=hand=>hand?.tracked===true&&hand.id!==undefined&&hand.id!==null&&Number.isFinite(hand.x)&&Number.isFinite(hand.y);

  function forgetMotion() {
    previous=filtered=anchor=null;
    motionTarget=chargeWindow=0;
  }
  function establish(sample) {
    previous=sample;
    filtered={x:sample.x,y:sample.y,roll:sample.roll};
    anchor={...filtered};
    motionTarget=chargeWindow=0;
  }
  function update(dt,{left,right,sampleTime,sourceAspect=4/3}={}) {
    const elapsed=Number.isFinite(dt)?clamp(dt,0,0.1):0;
    sinceSample+=elapsed;
    state.motion=mix(state.motion,motionTarget*Math.exp(-sinceSample*7),1-Math.exp(-elapsed*14));
    if(state.phase!=='gathering') {
      motionTarget=0;
      if(state.phase==='ready') return state;
      const duration=state.phase==='approaching'?2.6:1.8;
      phaseTime=Math.min(duration,phaseTime+elapsed);
      state.phaseProgress=phaseTime/duration;
      if(phaseTime>=duration-1e-9) {
        state.phase=state.phase==='approaching'?'igniting':'ready';
        phaseTime=0;
        state.phaseProgress=state.phase==='ready'?1:0;
      }
      return state;
    }
    if(!tracked(left)||!tracked(right)||left.id===right.id||!Number.isFinite(sampleTime)) {
      forgetMotion();
      return state;
    }
    if(previous&&sampleTime<=previous.time) return state;
    const aspect=Number.isFinite(sourceAspect)&&sourceAspect>0?sourceAspect:4/3;
    const hasRoll=Number.isFinite(left.roll)&&Number.isFinite(right.roll);
    const sample={
      ids:[left.id,right.id],time:sampleTime,aspect,
      x:right.x-left.x,y:(right.y-left.y)/aspect,
      roll:hasRoll?angleDifference(right.roll,left.roll):null,
    };
    if(!previous||sample.ids.some((id,i)=>id!==previous.ids[i])||aspect!==previous.aspect||sampleTime-previous.time>450) {
      establish(sample);
      sinceSample=0;
      return state;
    }
    const sampleDt=(sampleTime-previous.time)/1000;
    if(sampleDt<0.008) return state;
    const span=Math.max(0.20,Math.hypot(sample.x,sample.y),Math.hypot(previous.x,previous.y));
    const positionJump=Math.hypot(sample.x-previous.x,sample.y-previous.y)/span;
    const rollDelta=sample.roll!==null&&previous.roll!==null?angleDifference(sample.roll,previous.roll):0;
    // Detection jumps and crossing/reassigned hands do not become stored energy.
    if(positionJump/sampleDt>4||Math.abs(rollDelta)/sampleDt>8) {
      establish(sample);
      sinceSample=0;
      return state;
    }
    const blend=1-Math.exp(-sampleDt/0.09);
    filtered.x=mix(filtered.x,sample.x,blend);
    filtered.y=mix(filtered.y,sample.y,blend);
    if(sample.roll!==null&&previous.roll!==null&&filtered.roll!==null) {
      filtered.roll+=angleDifference(sample.roll,filtered.roll)*blend;
    } else {
      filtered.roll=sample.roll;
      anchor.roll=sample.roll;
    }
    previous=sample;
    sinceSample=0;
    chargeWindow=Math.min(0.25,chargeWindow+sampleDt);

    // Keep an anchor inside each deadband: slow deliberate movements accumulate
    // enough distance to count, while bounded camera jitter never crosses it.
    const positionDistance=Math.hypot(filtered.x-anchor.x,filtered.y-anchor.y)/span;
    const rotationDistance=filtered.roll!==null&&anchor.roll!==null?Math.abs(angleDifference(filtered.roll,anchor.roll)):0;
    const positionStep=positionDistance>0.035?positionDistance:0;
    const rotationStep=rotationDistance>0.07?rotationDistance:0;
    if(positionStep) {anchor.x=filtered.x;anchor.y=filtered.y;}
    if(rotationStep) anchor.roll=filtered.roll;
    const evidence=positionStep+rotationStep*0.35;
    if(evidence>0) {
      const earned=Math.min(evidence*0.82,chargeWindow*0.25);
      state.energy=clamp(state.energy+earned);
      state.turn+=evidence*5;
      motionTarget=clamp(evidence/Math.max(chargeWindow,0.008)/0.55);
      chargeWindow=0;
    } else motionTarget*=Math.exp(-sampleDt*5);
    state.phaseProgress=state.energy;
    if(state.energy>=1-1e-9) {
      state.energy=1;
      state.phase='approaching';
      state.phaseProgress=phaseTime=0;
      forgetMotion();
    }
    return state;
  }
  function reset() {
    Object.assign(state,{phase:'gathering',energy:0,motion:0,turn:0,phaseProgress:0});
    phaseTime=sinceSample=0;
    forgetMotion();
    return state;
  }
  return {state,update,reset};
}
