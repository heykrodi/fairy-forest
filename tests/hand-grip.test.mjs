import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyHandGrip} from '../hand-grip.js';
import {exampleCuppedHands} from '../hand-example.js';

const example=(curled=false,aspect=4/3)=>exampleCuppedHands({curled,aspect})[0];
function bendFingers(hand,count) {
  const bent=example(true);
  for(const base of [5,9,13,17].slice(0,count)) {
    for(let i=1;i<4;i++) hand.landmarks[base+i]={...bent.landmarks[base+i]};
  }
  return hand;
}

test('four extended fingers are an open hand, not an inferred grip',()=>{
  const result=classifyHandGrip(example());
  assert.equal(result.open,true);
  assert.equal(result.grip,false);
  assert.ok(result.amount<0.1);
});

test('three comfortably bent fingers grip the rim without a pinch',()=>{
  const hand=bendFingers(example(),3);
  assert.equal(hand.pinching,false);
  const result=classifyHandGrip(hand);
  assert.equal(result.grip,true);
  assert.equal(result.open,false);
  assert.ok(result.amount>0.5);
});

test('one or two bent fingers leave an ambiguous pose instead of gripping or releasing',()=>{
  for(const count of [1,2]) {
    const result=classifyHandGrip(bendFingers(example(),count));
    assert.equal(result.grip,false);
    assert.equal(result.open,false);
  }
});

test('an explicit pinch or touching thumb/index can grip with other fingers extended',()=>{
  const explicit=example();
  explicit.pinching=true;
  assert.deepEqual(classifyHandGrip(explicit),{grip:true,open:false,amount:1});
  const touching=example();
  touching.landmarks[4]={...touching.landmarks[8]};
  assert.deepEqual(classifyHandGrip(touching),{grip:true,open:false,amount:1});
});

test('a partly relaxed pinch persists only with a previous held grip',()=>{
  const hand=example();
  const wrist=hand.landmarks[0],middle=hand.landmarks[9];
  const length=Math.hypot(wrist.x-middle.x,(wrist.y-middle.y)/(4/3),wrist.z-middle.z);
  hand.landmarks[4]={...hand.landmarks[8],x:hand.landmarks[8].x+length*0.40};
  assert.equal(classifyHandGrip(hand,4/3,false).grip,false);
  assert.equal(classifyHandGrip(hand,4/3,false).open,false);
  assert.equal(classifyHandGrip(hand,4/3,true).grip,true);
});

test('camera aspect, translation, mirroring and distance preserve clear grip/open poses',()=>{
  for(const aspect of [1,4/3,16/9]) for(const curled of [false,true]) for(const scale of [0.55,1.25]) {
    const hand=example(curled,aspect);
    hand.landmarks=hand.landmarks.map(p=>({x:0.4-(p.x-0.5)*scale,y:0.45+(p.y-0.5)*scale,z:p.z*scale}));
    const result=classifyHandGrip(hand,aspect);
    assert.equal(result.grip,curled);
    assert.equal(result.open,!curled);
  }
});

test('missing, invalid or collapsed landmarks are neutral even if pinching is claimed',()=>{
  const invalid=example();
  invalid.landmarks[8].x=NaN;
  const collapsed={pinching:true,landmarks:Array.from({length:21},()=>({x:0.5,y:0.5,z:0}))};
  for(const hand of [undefined,{},invalid,collapsed]) {
    assert.deepEqual(classifyHandGrip(hand),{grip:false,open:false,amount:0});
  }
});

test('classifying does not modify the actual input hand',()=>{
  const hand=example(true),original=structuredClone(hand);
  classifyHandGrip(hand);
  assert.deepEqual(hand,original);
});
