import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrbState} from '../orb-state.js';

const frame=(t,left={},right={})=>({
  sampleTime:t*1000,sourceAspect:4/3,
  left:{tracked:true,id:'left',x:0.32,y:0.65,roll:-Math.PI/2,...left},
  right:{tracked:true,id:'right',x:0.68,y:0.65,roll:-Math.PI/2,...right},
});
const rolling=(t,withRoll=true)=>{
  const s=Math.sin(t*1.8),value=frame(t,
    {x:0.5-(0.18+0.018*s),y:0.65+0.045*s,roll:-Math.PI/2+0.24*s},
    {x:0.5+(0.18+0.018*s),y:0.65-0.045*s,roll:-Math.PI/2-0.24*s});
  if(!withRoll) {delete value.left.roll;delete value.right.roll;}
  return value;
};
function run(orb,seconds,makeFrame,start=0,fps=60) {
  for(let i=0;i<Math.round(seconds*fps);i++) {
    const time=start+i/fps;
    orb.update(1/fps,makeFrame(time,i));
  }
}
function completeGathering(orb,cameraFps=12,withRoll=true) {
  let time=0;
  for(;time<12&&orb.state.phase==='gathering';time+=1/60) {
    const sample=Math.floor(time*cameraFps+1e-8)/cameraFps;
    orb.update(1/60,rolling(sample,withRoll));
  }
  return time;
}

test('stationary hands, shared translation and shared roll do not charge',()=>{
  for(const makeFrame of [t=>frame(t),t=>{
    const dx=0.09*Math.sin(t*1.6),dy=0.08*Math.cos(t*1.6),roll=Math.sin(t);
    return frame(t,{x:0.32+dx,y:0.65+dy,roll},{x:0.68+dx,y:0.65+dy,roll});
  }]) {
    const orb=createOrbState();
    run(orb,10,makeFrame);
    assert.equal(orb.state.energy,0);
    assert.equal(orb.state.turn,0);
    assert.equal(orb.state.phase,'gathering');
  }
});

test('small bounded position and wrist jitter never becomes stored energy',()=>{
  const orb=createOrbState();
  run(orb,20,t=>frame(t,
    {x:0.32+0.0015*Math.sin(t*31),y:0.65+0.0015*Math.cos(t*37),roll:-1.57+0.012*Math.sin(t*23)},
    {x:0.68+0.0015*Math.cos(t*29),y:0.65+0.0015*Math.sin(t*41),roll:-1.57+0.012*Math.cos(t*19)}),0,12);
  assert.equal(orb.state.energy,0);
  assert.equal(orb.state.turn,0);
});

test('gentle representative rolling completes in four to six seconds at camera and mouse rates',()=>{
  for(const cameraFps of [12,24,60]) for(const withRoll of [false,true]) {
    const orb=createOrbState(),duration=completeGathering(orb,cameraFps,withRoll);
    assert.equal(orb.state.phase,'approaching');
    assert.ok(duration>=4&&duration<=6,`${cameraFps} fps, roll ${withRoll}: ${duration}s`);
    assert.equal(orb.state.energy,1);
    assert.ok(orb.state.turn>0);
  }
});

test('relative wrist rotation alone contributes, including crossing the angle wrap',()=>{
  const orb=createOrbState();
  run(orb,2,t=>frame(t,{roll:2.9+0.4*Math.sin(t*2)},{roll:-0.2-0.4*Math.sin(t*2)}));
  assert.ok(orb.state.energy>0.15);
  assert.ok(orb.state.energy<0.51);
  assert.ok(orb.state.turn>0);
});

test('repeated render frames and out-of-order samples do not charge the same movement again',()=>{
  const orb=createOrbState();
  run(orb,1,rolling);
  const energy=orb.state.energy,turn=orb.state.turn;
  run(orb,1,()=>rolling(0.9));
  assert.equal(orb.state.energy,energy);
  assert.equal(orb.state.turn,turn);
  assert.ok(orb.state.motion<0.01);
});

test('missing hands keep stored energy but reacquisition cannot contribute a jump',()=>{
  const orb=createOrbState();
  run(orb,1,rolling);
  const energy=orb.state.energy;
  run(orb,0.6,t=>frame(t,{tracked:false}),1);
  assert.equal(orb.state.energy,energy);
  orb.update(1/60,frame(2,{x:0.15,y:0.35,roll:0},{x:0.85,y:0.55,roll:2}));
  assert.equal(orb.state.energy,energy);
  run(orb,1,t=>frame(t,{x:0.15,y:0.35,roll:0},{x:0.85,y:0.55,roll:2}),2+1/60);
  assert.equal(orb.state.energy,energy);
});

test('identity changes, source-aspect changes and long frame gaps reset the motion reference',()=>{
  for(const mutation of [
    value=>{value.left.id='replacement';},
    value=>{value.sourceAspect=16/9;},
    value=>{value.sampleTime+=1000;},
  ]) {
    const orb=createOrbState();
    run(orb,1,rolling);
    const energy=orb.state.energy;
    const next=frame(1,{x:0.15,y:0.35,roll:0},{x:0.85,y:0.55,roll:2});
    mutation(next);
    orb.update(1/60,next);
    assert.equal(orb.state.energy,energy);
  }
});

test('an implausible detection jump and duplicate hand identity cannot charge',()=>{
  const orb=createOrbState();
  orb.update(1/60,frame(0));
  orb.update(1/60,frame(1/60,{x:0.01,roll:0},{x:0.99,roll:2}));
  assert.equal(orb.state.energy,0);
  run(orb,1,t=>frame(t,{id:'same'},{id:'same'}),0.1);
  assert.equal(orb.state.energy,0);
});

test('moving faster cannot skip the minimum charging time',()=>{
  const orb=createOrbState();
  run(orb,3.5,t=>{
    const angle=Math.sin(t*6)*0.65;
    const dx=Math.cos(angle)*0.36,dy=Math.sin(angle)*0.36;
    return frame(t,{x:0.5-dx/2,y:0.65-dy*2/3,roll:-angle},{x:0.5+dx/2,y:0.65+dy*2/3,roll:angle});
  });
  assert.equal(orb.state.phase,'gathering');
  assert.ok(orb.state.energy<=3.5*0.25+1e-9);
});

test('completed energy runs automatic approach and ignition once, without requiring tracked hands',()=>{
  const orb=createOrbState();
  completeGathering(orb);
  assert.equal(orb.state.phaseProgress,0);
  run(orb,1.3,()=>({}));
  assert.equal(orb.state.phase,'approaching');
  assert.ok(Math.abs(orb.state.phaseProgress-0.5)<1e-9);
  run(orb,1.3,()=>({}));
  assert.equal(orb.state.phase,'igniting');
  assert.equal(orb.state.phaseProgress,0);
  run(orb,1.8,()=>({}));
  assert.equal(orb.state.phase,'ready');
  assert.equal(orb.state.phaseProgress,1);
  run(orb,2,rolling);
  assert.equal(orb.state.phase,'ready');
  assert.equal(orb.state.energy,1);
});

test('reset clears the motion reference, energy and phase without replacing the state',()=>{
  const orb=createOrbState(),state=orb.state;
  run(orb,1,rolling);
  assert.ok(state.energy>0);
  orb.reset();
  assert.equal(orb.state,state);
  assert.deepEqual(state,{phase:'gathering',energy:0,motion:0,turn:0,phaseProgress:0});
  orb.update(1/60,frame(100,{x:0.1},{x:0.9}));
  assert.equal(state.energy,0);
});
