import test from 'node:test';
import assert from 'node:assert/strict';
import {createReleaseState} from '../release-state.js';

const hand=(id,overrides={})=>({id,tracked:true,grip:true,open:false,y:0.68,near:true,...overrides});
const input=(left={},right={})=>({left:hand('left',left),right:hand('right',right)});
const opened={grip:false,open:true};
function advance(ritual,seconds,value) {
  for(let elapsed=0;elapsed<seconds-1e-9;) {
    const dt=Math.min(0.01,seconds-elapsed);
    ritual.update(dt,value);
    elapsed+=dt;
  }
  return ritual.state;
}
function holding() {
  const ritual=createReleaseState();
  advance(ritual,0.25,input());
  assert.equal(ritual.state.phase,'holding');
  return ritual;
}
function raised() {
  const ritual=holding();
  advance(ritual,0.15,input({y:0.57},{y:0.57}));
  assert.equal(ritual.state.phase,'raised');
  return ritual;
}

test('holding needs two stable tracked grips near the rim',()=>{
  const ritual=createReleaseState();
  advance(ritual,1,input({}, {tracked:false}));
  assert.equal(ritual.state.phase,'waiting');
  advance(ritual,1,input({}, {near:false}));
  assert.equal(ritual.state.phase,'waiting');
  advance(ritual,0.24,input());
  assert.equal(ritual.state.phase,'waiting');
  ritual.update(0.01,input());
  assert.equal(ritual.state.phase,'holding');
  assert.equal(ritual.state.leftHeld,true);
  assert.equal(ritual.state.rightHeld,true);
});

test('switching hand IDs during the initial grip restarts its stability period',()=>{
  const ritual=createReleaseState();
  advance(ritual,0.2,input());
  advance(ritual,0.1,input({id:'replacement'}));
  assert.equal(ritual.state.phase,'waiting');
  advance(ritual,0.15,input({id:'replacement'}));
  assert.equal(ritual.state.phase,'holding');
});

test('slow upward movement arms release without a throwing speed requirement',()=>{
  const ritual=holding();
  for(let i=1;i<=160;i++) {
    const y=0.68-i/160*0.12;
    ritual.update(0.01,input({y},{y}));
  }
  assert.equal(ritual.state.phase,'raised');
  assert.equal(ritual.state.lift,1);
});

test('opening hands before raising and a brief high position cannot release',()=>{
  const ritual=holding();
  advance(ritual,1,input(opened,opened));
  assert.equal(ritual.state.phase,'holding');
  advance(ritual,0.1,input({y:0.55},{y:0.55}));
  advance(ritual,1,input(opened,opened));
  assert.equal(ritual.state.phase,'holding');
  assert.equal(ritual.state.progress,0);
});

test('one open hand leaves the other holding until both tracked hands open',()=>{
  const ritual=raised();
  advance(ritual,0.4,input({...opened,y:0.57},{y:0.57}));
  assert.equal(ritual.state.phase,'raised');
  assert.equal(ritual.state.leftHeld,false);
  assert.equal(ritual.state.rightHeld,true);
  advance(ritual,0.17,input({...opened,y:0.57},{...opened,y:0.57}));
  assert.equal(ritual.state.phase,'raised');
  ritual.update(0.01,input({...opened,y:0.57},{...opened,y:0.57}));
  assert.equal(ritual.state.phase,'released');
  assert.equal(ritual.state.leftHeld,false);
  assert.equal(ritual.state.rightHeld,false);
});

test('ambiguous relaxed hands do not count as deliberate opening',()=>{
  const ritual=raised();
  advance(ritual,1,input({grip:false,open:false},{grip:false,open:false}));
  assert.equal(ritual.state.phase,'raised');
  assert.equal(ritual.state.leftHeld,true);
  assert.equal(ritual.state.rightHeld,true);
});

test('losing either hand disarms release and returning open cannot let go',()=>{
  for(const side of ['left','right']) {
    const ritual=raised();
    advance(ritual,0.1,input(opened,opened));
    const lost=input(opened,opened);
    lost[side].tracked=false;
    ritual.update(0.01,lost);
    assert.equal(ritual.state.needsRegrip,true);
    assert.equal(ritual.state.handLost,true);
    advance(ritual,1,input(opened,opened));
    assert.equal(ritual.state.phase,'raised');
    assert.equal(ritual.state.needsRegrip,true);
    advance(ritual,0.19,input());
    assert.equal(ritual.state.needsRegrip,true);
    ritual.update(0.01,input());
    assert.equal(ritual.state.needsRegrip,false);
    advance(ritual,0.18,input(opened,opened));
    assert.equal(ritual.state.phase,'released');
  }
});

test('a replacement hand or swapped identities must regrip before opening',()=>{
  for(const ids of [['new-left','right'],['right','left']]) {
    const ritual=raised();
    const replacement=input({id:ids[0],...opened},{id:ids[1],...opened});
    advance(ritual,1,replacement);
    assert.equal(ritual.state.phase,'raised');
    assert.equal(ritual.state.needsRegrip,true);
    advance(ritual,0.2,input({id:ids[0]},{id:ids[1]}));
    assert.equal(ritual.state.needsRegrip,false);
    advance(ritual,0.18,replacement);
    assert.equal(ritual.state.phase,'released');
  }
});

test('losing an already open first hand prevents the second hand completing release',()=>{
  const ritual=raised();
  advance(ritual,0.3,input(opened));
  advance(ritual,1,input({...opened,tracked:false},opened));
  assert.equal(ritual.state.phase,'raised');
  assert.equal(ritual.state.needsRegrip,true);
});

test('after raising, lowering a little before opening is still intentional release',()=>{
  const ritual=raised();
  advance(ritual,0.5,input({y:0.66},{y:0.66}));
  assert.equal(ritual.state.phase,'raised');
  advance(ritual,0.18,input({...opened,y:0.66},{...opened,y:0.66}));
  assert.equal(ritual.state.phase,'released');
});

test('flight completes once after twelve seconds and ignores further hand loss',()=>{
  const ritual=raised();
  advance(ritual,0.18,input(opened,opened));
  advance(ritual,6,{});
  assert.equal(ritual.state.phase,'released');
  assert.ok(Math.abs(ritual.state.progress-0.5)<1e-9);
  advance(ritual,6,{});
  assert.equal(ritual.state.phase,'complete');
  assert.equal(ritual.state.progress,1);
  advance(ritual,2,input());
  assert.equal(ritual.state.phase,'complete');
  assert.equal(ritual.state.handLost,false);
});

test('reset clears intent and timers without replacing the public state object',()=>{
  const ritual=raised(), original=ritual.state;
  ritual.reset();
  assert.equal(ritual.state,original);
  assert.deepEqual(ritual.state,{phase:'waiting',lift:0,progress:0,handLost:false,leftHeld:false,rightHeld:false,needsRegrip:false});
  advance(ritual,1,input(opened,opened));
  assert.equal(ritual.state.phase,'waiting');
});

test('invalid frames and long timing gaps cannot skip the hold gesture',()=>{
  const ritual=createReleaseState();
  ritual.update(10,input());
  assert.equal(ritual.state.phase,'waiting');
  ritual.update(NaN,input());
  ritual.update(-10,input());
  advance(ritual,1,input({y:NaN}));
  assert.equal(ritual.state.phase,'waiting');
  assert.equal(ritual.state.handLost,true);
});
