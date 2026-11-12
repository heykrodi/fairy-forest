export const FLIGHT_SECONDS = 24;
// A release is an intentional sequence: hold, raise, then open both tracked hands.
// Missing/replaced hands must regrip before this sequence can continue.
export function createReleaseState() {
  const state={phase:'waiting',lift:0,progress:0,handLost:false,leftHeld:false,rightHeld:false,needsRegrip:false};
  let heldIds=null, candidateIds=null, baseline=0;
  let gripTime=0, raiseTime=0, openTime=0, flightTime=0;
  const sameIds=(a,b)=>a&&b&&a[0]===b[0]&&a[1]===b[1];
  const tracked=hand=>hand?.tracked===true&&hand.id!==undefined&&hand.id!==null&&Number.isFinite(hand.y);
  const gripping=hand=>hand?.grip===true&&hand.open!==true;

  function stableGrip(dt,left,right,allowed) {
    if(!allowed) { gripTime=0; candidateIds=null; return; }
    const ids=[left.id,right.id];
    if(!sameIds(ids,candidateIds)) { candidateIds=ids; gripTime=0; }
    gripTime+=dt;
  }
  function recordGrip(left,right) {
    heldIds=[left.id,right.id];
    state.leftHeld=state.rightHeld=true;
    state.needsRegrip=false;
    state.handLost=false;
    gripTime=raiseTime=openTime=0;
    candidateIds=null;
  }
  function update(dt,input={}) {
    const elapsed=Number.isFinite(dt)?Math.max(0,Math.min(dt,0.1)):0;
    if(state.phase==='complete') return state;
    if(state.phase==='released') {
      flightTime=Math.min(FLIGHT_SECONDS,flightTime+elapsed);
      state.progress=flightTime/FLIGHT_SECONDS;
      if(flightTime>=FLIGHT_SECONDS-1e-9) { state.phase='complete'; state.progress=1; }
      return state;
    }
    const left=input.left,right=input.right;
    const leftTracked=tracked(left),rightTracked=tracked(right);
    const bothTracked=leftTracked&&rightTracked;
    const bothGrip=bothTracked&&gripping(left)&&gripping(right);
    state.handLost=!bothTracked;

    if(state.phase==='waiting') {
      state.leftHeld=leftTracked&&left.near===true&&gripping(left);
      state.rightHeld=rightTracked&&right.near===true&&gripping(right);
      stableGrip(elapsed,left,right,bothGrip&&left.near===true&&right.near===true);
      if(gripTime>=0.25-1e-9) {
        baseline=(left.y+right.y)/2;
        recordGrip(left,right);
        state.phase='holding';
      }
      return state;
    }

    const identityChanged=bothTracked&&!sameIds(heldIds,[left.id,right.id]);
    if(!bothTracked||identityChanged) {
      state.needsRegrip=true;
      raiseTime=openTime=0;
      state.handLost=true;
    }
    if(!leftTracked||left.id!==heldIds?.[0]) state.leftHeld=false;
    if(!rightTracked||right.id!==heldIds?.[1]) state.rightHeld=false;
    if(state.needsRegrip) {
      // A returning open hand, even at the right height, never counts as release.
      stableGrip(elapsed,left,right,bothGrip);
      if(gripTime>=0.2-1e-9) {
        if(state.phase==='holding') { baseline=(left.y+right.y)/2; state.lift=0; }
        recordGrip(left,right);
      }
      return state;
    }

    if(gripping(left)) state.leftHeld=true;
    else if(left.open===true) state.leftHeld=false;
    if(gripping(right)) state.rightHeld=true;
    else if(right.open===true) state.rightHeld=false;
    state.lift=Math.max(0,Math.min(1,(baseline-(left.y+right.y)/2)/0.10));

    if(state.phase==='holding') {
      raiseTime=bothGrip&&state.lift>=1-1e-9?raiseTime+elapsed:0;
      if(raiseTime>=0.15-1e-9) { state.phase='raised'; openTime=0; }
    } else if(state.phase==='raised') {
      openTime=left.open===true&&right.open===true&&!left.grip&&!right.grip?openTime+elapsed:0;
      if(openTime>=0.18-1e-9) {
        state.phase='released';
        state.leftHeld=state.rightHeld=false;
        state.handLost=state.needsRegrip=false;
        state.progress=flightTime=0;
      }
    }
    return state;
  }
  function reset() {
    Object.assign(state,{phase:'waiting',lift:0,progress:0,handLost:false,leftHeld:false,rightHeld:false,needsRegrip:false});
    heldIds=candidateIds=null;
    baseline=gripTime=raiseTime=openTime=flightTime=0;
    return state;
  }
  return {state,update,reset};
}
