import { createHandInput } from './hand-input.js';
import { createHandVisual } from './hand-visual.js?v=warmth-design-1';
import { createReleaseState, FLIGHT_SECONDS } from './release-state.js';
import { classifyHandGrip } from './hand-grip.js';
import { classifyPrayerHand } from './hand-prayer.js';
import { createOrbState } from './orb-state.js';
import { createSoundscape } from './soundscape.js';

export function startExperience(view) {
  const ritual=createReleaseState();
  const orb=createOrbState();
  const visual=createHandVisual(document.getElementById('hand-light'));
  const ids=['camera-start','mouse-start','stop-camera','restart','sound-toggle','mouse-action','instruction-title','instruction-detail','tracking-status','lift-progress','status','input-note','gather-zone','gather-status','gather-progress'];
  const ui=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
  let soundStatus={state:'idle',muted:false};
  const sound=createSoundscape({onStatus(status){
    soundStatus=status;
    const button=ui['sound-toggle'];
    button.textContent=status.state==='error'?'소리 다시 켜기':status.state==='idle'?'소리 켜기':status.muted?'소리 꺼짐':status.state==='loading'?'소리 준비 중…':'소리 켜짐';
    button.setAttribute('aria-pressed',String(!status.muted&&!['idle','error'].includes(status.state)));
    button.title=status.state==='error'?'소리를 불러오지 못했어요. 눌러서 다시 시도해 주세요.':status.muted||status.state==='idle'?'음악과 효과음 켜기':'음악과 효과음 끄기';
  }});
  const surface=document.getElementById('scene');
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const sides=['left','right'];
  let mode=null,cameraState='stopped',frame={hands:[],timestamp:-Infinity,sourceAspect:4/3};
  let lastFrame=-Infinity,slotIds={left:null,right:null},inputs={},baseline=null;
  let offset={x:0,y:0},tilt=0,releaseAnchors=null,dragId=null,dragStart=null;
  const grips=new Map(),drawn=new Map(),rollOrigins=new Map();
  const mouse={grip:false,open:true,y:0.65,targetY:0.65,x:0.5,orbit:0,targetOrbit:0,keyHeld:false,lastMotion:-Infinity};
  const phase=()=>orb.state.phase==='ready'?ritual.state.phase:orb.state.phase;
  const prelude=()=>orb.state.phase!=='ready';
  const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

  const text=(id,value)=>{if(ui[id].textContent!==value) ui[id].textContent=value;};
  function showActive() {
    document.body.dataset.active=String(!!mode);
    document.body.dataset.mode=mode||'';
    ui['stop-camera'].hidden=!mode;
    text('stop-camera',mode==='camera'?'카메라 끄기':'체험 닫기');
    ui.restart.hidden=!mode;
    ui['sound-toggle'].hidden=!mode;
    ui['mouse-action'].hidden=mode!=='mouse';
    ui['input-note'].hidden=mode!=='mouse';
    surface.tabIndex=mode==='mouse'?0:-1;
    if(mode==='mouse') surface.focus({preventScroll:true});
  }
  function clearPointer() {
    const pointerId=dragId;
    dragId=null;dragStart=null;
    if(pointerId!==null&&surface.hasPointerCapture(pointerId)) surface.releasePointerCapture(pointerId);
    mouse.targetOrbit=mouse.orbit;
  }
  function reset() {
    sound.reset();
    ritual.reset();
    orb.reset();
    slotIds={left:null,right:null};
    inputs={};baseline=null;offset={x:0,y:0};tilt=0;releaseAnchors=null;
    clearPointer();lastFrame=-Infinity;
    mouse.grip=false;mouse.open=true;mouse.y=mouse.targetY=0.65;mouse.x=0.5;
    mouse.orbit=mouse.targetOrbit=0;mouse.keyHeld=false;mouse.lastMotion=-Infinity;
    grips.clear();drawn.clear();rollOrigins.clear();
    ui.status.hidden=true;
  }
  const handInput=createHandInput({
    onFrame(value){frame=value;},
    onStatus({state,message}) {
      cameraState=state;
      if(mode!=='camera') return;
      text('tracking-status',message);
      if(state==='error') {
        sound.stop();
        mode=null;reset();showActive();text('status',message);ui.status.hidden=false;
      }
    },
  });
  ui['camera-start'].addEventListener('click',async()=>{
    sound.start();
    mode='camera';reset();showActive();await handInput.start();
  });
  ui['mouse-start'].addEventListener('click',()=>{
    sound.start();
    mode='mouse';handInput.stop();reset();showActive();
  });
  ui['stop-camera'].addEventListener('click',()=>{
    sound.stop();
    mode=null;handInput.stop();reset();showActive();
  });
  ui.restart.addEventListener('click',reset);
  ui['sound-toggle'].addEventListener('click',()=>{
    if(['error','idle'].includes(soundStatus.state)) {
      sound.setMuted(false);
      sound.start();
    } else sound.setMuted(!soundStatus.muted);
  });
  addEventListener('pagehide',()=>handInput.stop());
  addEventListener('resize',()=>{visual.resize();drawn.clear();});

  // Hold the same light area still to gather, or move while holding to roll.
  // Space offers the same held gesture when the scene has keyboard focus.
  surface.addEventListener('keydown',event=>{
    if(event.code!=='Space'||mode!=='mouse'||phase()!=='gathering'||event.ctrlKey||event.metaKey||event.altKey||dragId!==null) return;
    event.preventDefault();
    if(!event.repeat) {mouse.keyHeld=true;mouse.lastMotion=-Infinity;}
  });
  surface.addEventListener('keyup',event=>{
    if(event.code!=='Space'||!mouse.keyHeld) return;
    event.preventDefault();mouse.keyHeld=false;
  });
  surface.addEventListener('blur',()=>{mouse.keyHeld=false;});
  ui['mouse-action'].addEventListener('click',()=>{
    if(prelude()) return;
    const state=ritual.state;
    if(state.phase==='waiting'||state.needsRegrip) {
      mouse.grip=true;mouse.open=false;
    } else if(state.phase==='holding') {
      mouse.grip=true;mouse.open=false;mouse.targetY=mouse.y-0.16;
    } else if(state.phase==='raised') {
      mouse.grip=false;mouse.open=true;
    }
  });
  surface.addEventListener('pointerdown',event=>{
    if(mode!=='mouse'||!event.isPrimary||event.button!==0||dragId!==null||mouse.keyHeld) return;
    if(phase()==='gathering') {
      const layout=view.getLayout();
      const radiusX=layout.orbRadius?layout.orbRadius.x*innerWidth*1.25:Math.max(120,innerHeight*0.25);
      const radiusY=layout.orbRadius?layout.orbRadius.y*innerHeight*1.25:Math.max(120,innerHeight*0.25);
      if(Math.hypot((event.clientX-layout.orb.x*innerWidth)/radiusX,(event.clientY-layout.orb.y*innerHeight)/radiusY)>1) return;
      mouse.lastMotion=-Infinity;
      dragId=event.pointerId;dragStart={x:event.clientX,y:event.clientY,orb:true};
      surface.focus({preventScroll:true});
      surface.setPointerCapture(event.pointerId);event.preventDefault();return;
    }
    if(prelude()||!['waiting','holding','raised'].includes(ritual.state.phase)) return;
    const layout=view.getLayout();
    const near=sides.some(side=>Math.hypot(event.clientX-layout[side].x*innerWidth,event.clientY-layout[side].y*innerHeight)<Math.max(95,innerHeight*0.18));
    if(!near&&ritual.state.phase==='waiting') return;
    dragId=event.pointerId;dragStart={x:event.clientX,y:event.clientY,handY:mouse.y};
    mouse.grip=true;mouse.open=false;
    surface.setPointerCapture(event.pointerId);event.preventDefault();
  });
  surface.addEventListener('pointermove',event=>{
    if(event.pointerId!==dragId||!dragStart) return;
    if(dragStart.orb) {
      const dx=event.clientX-dragStart.x,dy=event.clientY-dragStart.y;
      if(Math.hypot(dx,dy)<1) return;
      mouse.targetOrbit+=dx*0.014+dy*0.008;
      mouse.lastMotion=performance.now();
      dragStart.x=event.clientX;dragStart.y=event.clientY;return;
    }
    mouse.targetY=clamp(dragStart.handY+(event.clientY-dragStart.y)/innerHeight,0.15,0.85);
    mouse.x=clamp(0.5+(event.clientX-dragStart.x)/innerWidth,0.15,0.85);
  });
  surface.addEventListener('pointerup',event=>{
    if(event.pointerId!==dragId) return;
    mouse.grip=false;mouse.open=true;clearPointer();
  });
  function cancelPointer() {
    if(dragId===null) return;
    // Cancellation is lost input, never an intentional opening of the fingers.
    if(!prelude()) ritual.update(0,{left:{tracked:false},right:{tracked:false}});
    clearPointer();mouse.grip=false;mouse.open=false;
  }
  surface.addEventListener('pointercancel',cancelPointer);
  surface.addEventListener('lostpointercapture',cancelPointer);
  addEventListener('blur',()=>{mouse.keyHeld=false;cancelPointer();});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden) {mouse.keyHeld=false;cancelPointer();}
  });

  function freeContact(side,hand,layout) {
    const nominal=side==='left'?0.3:0.7;
    return {
      x:layout[side].x+clamp((hand.palm.x-nominal)*0.24,-0.1,0.1),
      y:layout[side].y+clamp((hand.palm.y-0.55)*0.23,-0.12,0.12),
    };
  }
  function cameraInputs(layout) {
    const fresh=cameraState==='ready'&&performance.now()-frame.timestamp<350?frame.hands:[];
    if(frame.timestamp!==lastFrame) {
      lastFrame=frame.timestamp;
      const live=new Set(fresh.map(hand=>hand.id));
      for(const id of grips.keys()) if(!live.has(id)) grips.delete(id);
      for(const hand of fresh) {
        const old=grips.get(hand.id);
        const pose=classifyHandGrip(hand,frame.sourceAspect||4/3,old?.grip||false);
        // Two separate camera observations must agree before an opening is accepted.
        grips.set(hand.id,{...pose,openFrames:pose.open?(old?.openFrames||0)+1:0});
      }
    }
    const sorted=[...fresh].sort((a,b)=>a.palm.x-b.palm.x);
    // Close prayer palms can cross on screen without changing hand identity.
    if(sorted.length===2&&((!prelude()&&ritual.state.phase==='waiting')||sides.some(side=>!fresh.some(hand=>hand.id===slotIds[side])))) {
      slotIds={left:sorted[0].id,right:sorted[1].id};
    } else if(sorted.length===1&&ritual.state.phase==='waiting'&&!sides.some(side=>slotIds[side]===sorted[0].id)) {
      const side=sorted[0].palm.x<0.5?'left':'right';slotIds[side]=sorted[0].id;
      if(slotIds[side==='left'?'right':'left']===sorted[0].id) slotIds[side==='left'?'right':'left']=null;
    }
    return Object.fromEntries(sides.map(side=>{
      const hand=fresh.find(item=>item.id===slotIds[side]);
      if(!hand) return [side,{tracked:false,grip:false,open:false}];
      const pose=grips.get(hand.id)||{grip:false,open:false,amount:0};
      const wrist=hand.landmarks[0],knuckle=hand.landmarks[9];
      const roll=Math.atan2((knuckle.y-wrist.y)/(frame.sourceAspect||4/3),knuckle.x-wrist.x);
      if(!rollOrigins.has(hand.id)) rollOrigins.set(hand.id,roll);
      const displayRoll=clamp(angleDifference(roll,rollOrigins.get(hand.id))*1.6,-1,1);
      const contact=freeContact(side,hand,layout);
      const near=Math.hypot((contact.x-layout[side].x)*innerWidth,(contact.y-layout[side].y)*innerHeight)<Math.max(100,innerHeight*0.18);
      return [side,{id:hand.id,tracked:true,grip:pose.grip,open:pose.open&&pose.openFrames>=2,amount:pose.amount,y:hand.palm.y,x:hand.palm.x,roll,displayRoll,near,contact,palmScale:hand.palmScale,prayerPose:classifyPrayerHand(hand,frame.sourceAspect)}];
    }));
  }
  function updateUI() {
    const state=ritual.state,currentPhase=phase();
    document.body.dataset.phase=currentPhase;
    document.body.dataset.tracking=state.handLost?'lost':'ready';
    const lost=state.needsRegrip&&['holding','raised'].includes(currentPhase);
    const messages={
      gathering:['손끝에 온기를 모아요','빛을 감싸듯 천천히 굴리거나, 두 손을 모아 3초간 머물러 주세요.'],
      approaching:['당신의 온기를 만나러 와요.','작은 불씨가 태어났어요. 잠시 손을 편하게 두세요.'],
      igniting:['소원의 불이 밝아집니다.','불씨가 열린 입구로 들어가 풍등을 따뜻하게 밝혀요.'],
      waiting:['따뜻한 빛을, 두 손에.','두 손을 조금 벌리고, 테두리를 잡듯 손가락을 오므려주세요.'],
      holding:['하늘로 가고 싶은 빛이에요.','잠시 소원을 담고, 두 손을 천천히 조금 올려보세요.'],
      raised:['준비되었다면, 놓아주세요.','두 손의 손가락을 편하게 펴면 하늘로 떠나요.'],
      released:['당신의 소원이 떠오릅니다.','손을 내려놓고, 함께 떠오르는 풍등을 바라보세요.'],
      complete:['마음에 품은 빛, 하늘에 닿기를.','새해의 소망이 오래도록 따뜻하게 빛나기를.'],
    };
    text('instruction-title',lost?'풍등은 여기서 기다릴게요.':messages[currentPhase][0]);
    text('instruction-detail',lost?'두 손을 다시 보여주고, 테두리를 잡듯 오므려주세요.':mode==='mouse'&&currentPhase==='waiting'?'아래 버튼으로 잡거나, 테두리 근처를 누른 채 위로 움직여보세요.':messages[currentPhase][1]);
    ui['lift-progress'].hidden=!mode||!['holding','raised'].includes(currentPhase);
    ui['lift-progress'].value=state.lift;
    const warmth=Math.max(orb.state.energy,orb.state.prayerProgress);
    const engaged=orb.state.praying||orb.state.motion>0.12;
    ui['gather-zone'].hidden=!mode||currentPhase!=='gathering';
    ui['gather-zone'].dataset.engaged=String(engaged);
    ui['gather-progress'].value=warmth;
    let gatherHint=engaged?'온기가 모이고 있어요':warmth>0?'모은 온기가 기다리고 있어요':'빛이 머무는 곳에 두 손을 가까이 해주세요';
    if(mode==='camera') {
      const count=sides.filter(side=>inputs[side]?.tracked).length;
      if(cameraState!=='ready') gatherHint='카메라를 준비하고 있어요';
      else if(count===0) gatherHint='카메라 앞에 두 손을 보여주세요';
      else if(count===1) gatherHint='두 손이 함께 보이도록 조금 벌려주세요';
    } else if(mode==='mouse'&&!engaged&&warmth===0) gatherHint='빛이 머무는 곳을 꾹 눌러보세요';
    text('gather-status',gatherHint);
    if(mode==='mouse') {
      const label=lost?'테두리 다시 잡기':currentPhase==='approaching'?'풍등이 다가오는 중…':currentPhase==='igniting'?'온기를 받는 중…':currentPhase==='waiting'?(mouse.grip?'손을 맞추는 중…':'테두리 잡기'):currentPhase==='holding'?'풍등 들어 올리기':currentPhase==='raised'?'손을 펴서 보내기':'하늘로 보내는 중…';
      text('mouse-action',label);
      ui['mouse-action'].hidden=['gathering','released','complete'].includes(currentPhase);
      ui['mouse-action'].disabled=['approaching','igniting'].includes(currentPhase)||(currentPhase==='waiting'&&mouse.grip);
      ui['input-note'].hidden=['approaching','igniting','released','complete'].includes(currentPhase);
      text('input-note',currentPhase==='gathering'?'빛을 누른 채 움직이거나, 3초간 머물러 주세요. 스페이스 키를 꾹 눌러도 좋아요.':'마우스 체험 · 화면의 두 손을 함께 움직여요');
      text('tracking-status','');
    } else if(mode==='camera'&&cameraState==='ready') {
      let hint='';
      if(lost) hint='손이 잠깐 사라져도 풍등은 날아가지 않아요.';
      else if(currentPhase==='waiting') {
        const count=sides.filter(side=>inputs[side]?.tracked).length;
        hint=count===0?'카메라 앞에 두 손을 보여주세요.':count===1?'한 손이 보여요. 두 손이 모두 보이도록 조금 벌려주세요.':'작은 점을 맞추지 않아도 괜찮아요. 양손으로 가볍게 잡아보세요.';
      } else if(state.leftHeld!==state.rightHeld) {
        if(currentPhase==='holding') hint='다시 두 손으로 잡고, 천천히 조금 올려주세요.';
        if(currentPhase==='raised') hint='한 손으로도 잠시 붙잡고 있어요. 준비되면 다른 손도 펴주세요.';
      }
      text('tracking-status',hint);
    }
  }

  view.onFrame((dt)=>{
    const oldPhase=phase(),layout=view.getLayout();
    if(mode==='mouse') {
      mouse.y=mix(mouse.y,mouse.targetY,1-Math.exp(-dt*6));
      mouse.orbit=mix(mouse.orbit,mouse.targetOrbit,1-Math.exp(-dt*9));
      const held=mouse.keyHeld||dragStart?.orb===true;
      const praying=oldPhase==='gathering'&&held&&performance.now()-mouse.lastMotion>250;
      const rolling=prelude()&&!praying,wave=praying?0:Math.sin(mouse.orbit);
      inputs=Object.fromEntries(sides.map((side,i)=>{
        const sign=i?1:-1;
        return [side,{id:`mouse-${side}`,tracked:true,grip:mouse.grip,open:mouse.open,amount:mouse.grip?1:0,y:mouse.y+(rolling?sign*0.045*wave:0),x:mouse.x+sign*(praying?0.04:rolling?0.18+0.018*Math.cos(mouse.orbit):0.2),roll:-Math.PI/2+sign*0.24*wave,displayRoll:sign*0.6*wave,near:true,contact:layout[side],palmScale:0.08,prayerPose:praying}];
      }));
    } else inputs=mode==='camera'?cameraInputs(layout):{};
    if(mode) {
      if(prelude()) orb.update(dt,{...inputs,sampleTime:mode==='mouse'?performance.now():frame.timestamp,sourceAspect:mode==='mouse'?4/3:frame.sourceAspect||4/3});
      else ritual.update(dt,inputs);
    }
    if(oldPhase==='gathering'&&phase()!=='gathering') {
      mouse.keyHeld=false;clearPointer();
    }
    if(oldPhase==='igniting'&&phase()==='waiting') {mouse.grip=false;mouse.open=true;}
    const state=ritual.state;
    if(oldPhase==='waiting'&&state.phase==='holding') baseline={x:(inputs.left.x+inputs.right.x)/2,y:(inputs.left.y+inputs.right.y)/2};
    if(['holding','raised'].includes(state.phase)&&!state.handLost&&inputs.left?.tracked&&inputs.right?.tracked&&baseline) {
      const x=(inputs.left.x+inputs.right.x)/2,y=(inputs.left.y+inputs.right.y)/2;
      offset={x:clamp((x-baseline.x)*0.35,-0.11,0.11),y:clamp((y-baseline.y)*0.12,-0.02,0.04)};
      tilt=clamp((inputs.right.y-inputs.left.y)*0.5,-0.14,0.14);
      if(state.leftHeld!==state.rightHeld) tilt+=state.leftHeld?-0.06:0.06;
    }
    if(oldPhase!=='released'&&state.phase==='released') releaseAnchors={left:{...layout.left},right:{...layout.right}};
    const energy=Math.max(orb.state.energy,orb.state.prayerProgress);
    view.setState({active:!!mode,phase:phase(),energy,motion:orb.state.motion,turn:orb.state.turn,phaseProgress:orb.state.phaseProgress,lift:state.lift,offset,tilt,progress:state.progress,leftHeld:state.leftHeld,rightHeld:state.rightHeld,handLost:state.handLost});
    sound.update({active:!!mode,phase:phase(),energy,motion:orb.state.motion,progress:state.progress});
    updateUI();
  });

  // Draw from this frame's projected rim, after the 3D lantern has moved.
  view.onAfterFrame((dt,time)=>{
    const layout=view.getLayout(),state=ritual.state,currentPhase=phase();
    const praying=currentPhase==='gathering'&&orb.state.praying;
    const flight=['released','complete'].includes(state.phase);
    const elapsed=state.progress*FLIGHT_SECONDS;
    const hands=[];
    for(const side of sides) {
      const input=inputs[side];
      if(!mode||!input?.tracked||(flight&&elapsed>2.4)) {drawn.delete(side);continue;}
      const held=state[`${side}Held`];
      let contact=held?layout[side]:input.contact||layout[side];
      const orbBlend=prelude()?(currentPhase==='igniting'?1-orb.state.phaseProgress:1):0;
      if(orbBlend>0&&layout.orbLeft) {
        const anchor=side==='left'?layout.orbLeft:layout.orbRight;
        const relativeY=inputs.left?.tracked&&inputs.right?.tracked?input.y-(inputs.left.y+inputs.right.y)/2:0;
        const centerX=(layout.orbLeft.x+layout.orbRight.x)/2;
        const orbContact={
          x:praying?mix(anchor.x,centerX,0.1):anchor.x+clamp((input.x-(side==='left'?0.3:0.7))*0.18,-0.045,0.045),
          y:anchor.y+clamp(relativeY*0.5,-0.045,0.045),
        };
        contact={x:mix(contact.x,orbContact.x,orbBlend),y:mix(contact.y,orbContact.y,orbBlend)};
      }
      if(flight&&releaseAnchors) contact={x:releaseAnchors[side].x+(side==='left'?-1:1)*0.025*Math.min(1,elapsed),y:releaseAnchors[side].y+Math.min(0.11,elapsed*0.07)};
      const previous=drawn.get(side);
      const blend=1-Math.exp(-dt*14);
      const gripTarget=prelude()?0.3:flight?0:held||input.grip?1:input.open?0:(input.amount||0);
      const item={side,contact:held||!previous?contact:{x:mix(previous.contact.x,contact.x,blend),y:mix(previous.contact.y,contact.y,blend)},grip:mix(previous?.grip||0,gripTarget,blend),opacity:flight?clamp(1-elapsed/2.4,0,1):0.9,pose:orbBlend>0?'orb':'rim',orbBlend:mix(previous?.orbBlend??orbBlend,orbBlend,blend),angle:0,roll:mix(previous?.roll||0,input.displayRoll||0,blend)};
      drawn.set(side,item);hands.push(item);
    }
    visual.render({hands,phase:currentPhase,time,reducedMotion:layout.reducedMotion});
  });
}
