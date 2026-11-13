import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPrayerHand} from '../hand-prayer.js';
import {exampleCuppedHands} from '../hand-example.js';

const example=(curled=false,aspect=4/3)=>exampleCuppedHands({curled,aspect})[0];
function rotate(hand,angle,aspect=4/3) {
  const wrist=hand.landmarks[0];
  hand.landmarks=hand.landmarks.map(p=>{
    const x=p.x-wrist.x,y=(p.y-wrist.y)/aspect;
    return {...p,x:wrist.x+x*Math.cos(angle)-y*Math.sin(angle),y:wrist.y+(x*Math.sin(angle)+y*Math.cos(angle))*aspect};
  });
  return hand;
}

test('upright extended hands qualify even with thumb touching index or narrow palms',()=>{
  const touching=example();
  touching.pinching=true;
  touching.landmarks[4]={...touching.landmarks[8]};
  const edgeOn=example();
  const wrist=edgeOn.landmarks[0];
  edgeOn.landmarks=edgeOn.landmarks.map(p=>({...p,x:wrist.x+(p.x-wrist.x)*0.1,z:p.z+(p.x-wrist.x)*0.9}));
  for(const hand of [example(),touching,edgeOn,rotate(example(),Math.PI/5)]) {
    assert.equal(classifyPrayerHand(hand),true);
  }
});

test('one curled finger is tolerated but two curled fingers or a cupped hand do not qualify',()=>{
  for(const count of [1,2,4]) {
    const hand=example(),curled=example(true);
    for(const base of [5,9,13,17].slice(0,count)) {
      for(let i=1;i<4;i++) hand.landmarks[base+i]={...curled.landmarks[base+i]};
    }
    assert.equal(classifyPrayerHand(hand),count===1);
  }
});

test('sideways and downward hands do not count as an upright prayer',()=>{
  for(const angle of [Math.PI/2,-Math.PI/2,Math.PI]) {
    assert.equal(classifyPrayerHand(rotate(example(),angle)),false);
  }
});

test('camera aspect, scale, translation and mirroring preserve upright posture',()=>{
  for(const aspect of [1,4/3,16/9]) for(const scale of [0.4,1.3]) {
    const hand=example(false,aspect);
    hand.landmarks=hand.landmarks.map(p=>({x:0.6-(p.x-0.5)*scale,y:0.7+(p.y-0.5)*scale,z:p.z*scale}));
    assert.equal(classifyPrayerHand(hand,aspect),true);
  }
});

test('missing, malformed, collapsed and excessively foreshortened hands fail safely',()=>{
  const invalid=example();
  invalid.landmarks[8]=null;
  const nonfinite=example();
  nonfinite.landmarks[12].z=Infinity;
  const foreshortened=example();
  const wrist=foreshortened.landmarks[0];
  foreshortened.landmarks=foreshortened.landmarks.map(p=>({...p,x:wrist.x+(p.x-wrist.x)*0.05,y:wrist.y+(p.y-wrist.y)*0.05,z:p.z+(p.y-wrist.y)}));
  const collapsed={landmarks:Array.from({length:21},()=>({x:0.5,y:0.5,z:0}))};
  for(const hand of [undefined,{},invalid,nonfinite,collapsed,foreshortened]) {
    assert.equal(classifyPrayerHand(hand),false);
  }
});

test('classifying a prayer hand leaves the input unchanged',()=>{
  const hand=example(),before=structuredClone(hand);
  classifyPrayerHand(hand);
  assert.deepEqual(hand,before);
});
