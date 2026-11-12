// Input-independent timing and intent checks for the lantern's ignition ritual.
// The caller derives these booleans from either tracked hands or mouse controls.
export function createRitual() {
  const state = { phase: 'prayer', progress: 0, phaseTime: 0, handLost: false };
  let previousGrip = false;
  let releaseArmed = false;

  function enter(phase) {
    state.phase = phase;
    state.phaseTime = 0;
    state.progress = ['ready', 'carrying', 'lit'].includes(phase) ? 1 : 0;
    state.handLost = false;
  }

  function advance(dt, duration, nextPhase) {
    state.phaseTime = Math.min(duration, state.phaseTime + dt);
    state.progress = state.phaseTime / duration;
    if (state.phaseTime >= duration - 1e-9) enter(nextPhase);
  }

  function update(dt, input = {}) {
    const elapsed = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
    const tracked = input.tracked === true;
    const grip = tracked && input.grip === true;
    const picked = grip && !previousGrip;

    switch (state.phase) {
      case 'prayer':
        state.handLost = !tracked;
        if (tracked && input.praying === true) advance(elapsed, 4, 'reveal');
        break;
      case 'reveal':
        advance(elapsed, 1.6, 'ready');
        break;
      case 'ready':
        state.handLost = !tracked;
        if (picked && input.canPick === true) {
          enter('carrying');
          releaseArmed = true;
        }
        break;
      case 'carrying':
        if (!tracked) {
          // Missing hands (including an identity change) never count as release.
          state.handLost = true;
          releaseArmed = false;
        } else if (!releaseArmed) {
          // An open hand returning to the camera must not light the lantern.
          if (grip) {
            releaseArmed = true;
            state.handLost = false;
          }
        } else if (!grip && previousGrip) {
          releaseArmed = false;
          enter(input.nearTarget === true ? 'settling' : 'ready');
        }
        break;
      case 'settling':
        advance(elapsed, 1.2, 'lighting');
        break;
      case 'lighting':
        advance(elapsed, 3, 'lit');
        break;
      case 'lit':
        break;
    }

    previousGrip = grip;
    return state;
  }

  function reset() {
    previousGrip = false;
    releaseArmed = false;
    enter('prayer');
    return state;
  }

  return { state, update, reset };
}
