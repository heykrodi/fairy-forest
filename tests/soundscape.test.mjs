import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoundscape } from '../soundscape.js';

function environment(t, { pending = false, reject = false, pendingResume = false } = {}) {
  const originals = Object.fromEntries(['AudioContext', 'fetch', 'document'].map(key => [key, globalThis[key]]));
  t.after(() => { for (const [key, value] of Object.entries(originals)) {
    if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  } });
  const parameter = () => ({ value: 0, cancelScheduledValues() {},
    setValueAtTime(value) { this.value = value; }, linearRampToValueAtTime(value) { this.value = value; },
    setTargetAtTime(value) { this.value = value; } });
  const node = () => ({ connect() {}, disconnect() {} });
  let context, resolveLoad, rejectResume, fetchCount = 0, resumeCalls = 0;
  const gate = pending ? new Promise(resolve => { resolveLoad = resolve; }) : Promise.resolve();
  const resumeGate = pendingResume ? new Promise((resolve, reject) => { rejectResume = reject; }) : Promise.resolve();
  const starts = [], sources = [], statuses = [];
  class MockContext {
    constructor() { context = this; this.state = 'suspended'; this.currentTime = 0; this.destination = node(); }
    resume() { this.state = 'running'; return resumeCalls++ === 0 ? resumeGate : Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    createGain() { return { ...node(), gain: parameter() }; }
    createBiquadFilter() { return { ...node(), frequency: parameter() }; }
    createDynamicsCompressor() { return { ...node(), ...Object.fromEntries(['threshold','knee','ratio','attack','release'].map(key => [key, parameter()])) }; }
    createBufferSource() {
      const source = { ...node(), stops: [], start(when, offset) { starts.push({ name: this.buffer.name, offset, source: this }); },
        stop(when) { this.stops.push(when); } };
      sources.push(source);
      return source;
    }
    decodeAudioData(data) { return Promise.resolve({ name: data, duration: data === 'flight' ? 26 : 24 }); }
  }
  const listeners = new Map();
  globalThis.document = { hidden: false, addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); } };
  globalThis.AudioContext = MockContext;
  globalThis.fetch = async url => {
    fetchCount++;
    await gate;
    if (reject) throw new Error('offline');
    return { ok: true, arrayBuffer: async () => String(url).split('/').at(-1).replace('.wav', '') };
  };
  const audio = createSoundscape({ onStatus: value => statuses.push(value) });
  t.after(() => audio.dispose());
  return { audio, starts, sources, statuses, resolveLoad, rejectResume, context: () => context, fetchCount: () => fetchCount,
    async visibility(hidden) { document.hidden = hidden; listeners.get('visibilitychange')?.(); await Promise.resolve(); } };
}
const state = (phase, extra = {}) => ({ active: true, phase, energy: 0.5, motion: 0.2, progress: 0, ...extra });

test('click unlocks before loading and stopping prevents a late download starting music', async t => {
  const env = environment(t, { pending: true });
  const started = env.audio.start();
  assert.equal(env.context().state, 'running');
  assert.equal(env.statuses.at(-1).state, 'loading');
  env.audio.reset();
  env.audio.stop();
  env.resolveLoad();
  await started;
  assert.equal(env.starts.length, 0);
  assert.equal(env.statuses.at(-1).state, 'idle');
});

test('late load follows the current flight offset and does not replay earlier effect cues', async t => {
  const env = environment(t, { pending: true });
  const started = env.audio.start();
  env.audio.update(state('approaching'));
  env.audio.update(state('igniting'));
  env.audio.update(state('released', { progress: 0.5 }));
  env.resolveLoad();
  await started;
  assert.deepEqual(env.starts.map(({name, offset}) => [name, offset]), [['flight', 12]]);
});

test('phase effects play once and long holding keeps a single looping background', async t => {
  const env = environment(t);
  await env.audio.start();
  for (const phase of ['gathering','approaching','igniting','waiting','holding','raised','released','complete']) {
    for (let i = 0; i < 100; i++) env.audio.update(state(phase));
  }
  assert.deepEqual(env.starts.map(({name}) => name),
    ['quiet-loop','birth','ignite','grip','release','flight','park-loop']);
  assert.equal(env.starts.find(item => item.name === 'quiet-loop').source.loop, true);
  assert.equal(env.starts.find(item => item.name === 'park-loop').source.loop, true);
  assert.equal(env.starts.find(item => item.name === 'flight').source.loop, false);
});

test('reset preserves mute and cached buffers; unmuting does not stack background tracks', async t => {
  const env = environment(t);
  await env.audio.start();
  env.audio.setMuted(true);
  env.audio.update(state('released'));
  env.audio.reset();
  assert.equal(env.statuses.at(-1).muted, true);
  const count = env.starts.length;
  await env.audio.setMuted(false);
  assert.equal(env.starts.length, count);
  assert.equal(env.fetchCount(), 7);
  assert.equal(env.starts.filter(item => item.name === 'release').length, 0);
  assert.equal(env.statuses.at(-1).state, 'playing');
});

test('reset during download starts at gathering and stop fades every live source', async t => {
  const env = environment(t, { pending: true });
  const started = env.audio.start();
  env.audio.update(state('released', { progress: 0.8 }));
  env.audio.reset();
  env.resolveLoad();
  await started;
  assert.deepEqual(env.starts.map(item => item.name), ['quiet-loop']);
  env.audio.update(state('approaching'));
  env.audio.stop();
  assert.ok(env.sources.every(source => source.stops.length > 0));
});

test('hidden tab pauses audio and does not replay phase events on return', async t => {
  const env = environment(t);
  await env.audio.start();
  await env.visibility(true);
  assert.equal(env.context().state, 'suspended');
  env.audio.update(state('approaching'));
  env.audio.update(state('igniting'));
  await env.visibility(false);
  assert.equal(env.context().state, 'running');
  assert.deepEqual(env.starts.map(item => item.name), ['quiet-loop']);
  env.audio.stop();
  await env.visibility(true);
  await env.visibility(false);
  assert.equal(env.context().state, 'suspended');
});

test('load failure is reported without rejecting the experience; disposal blocks late playback', async t => {
  const env = environment(t, { reject: true });
  await assert.doesNotReject(env.audio.start());
  assert.equal(env.statuses.at(-1).state, 'error');
  assert.equal(env.starts.length, 0);
});

test('disposing while decoding prevents playback and closes the audio context', async t => {
  const env = environment(t, { pending: true });
  const started = env.audio.start();
  env.audio.dispose();
  env.resolveLoad();
  await started;
  assert.equal(env.starts.length, 0);
  assert.equal(env.context().state, 'closed');
});

test('a rejected old resume cannot silence a newer start after stop', async t => {
  const env = environment(t, { pendingResume: true });
  const oldStart = env.audio.start();
  env.audio.stop();
  await env.audio.start();
  assert.equal(env.statuses.at(-1).state, 'playing');
  env.rejectResume(new Error('stale resume rejected'));
  await oldStart;
  assert.equal(env.statuses.at(-1).state, 'playing');
  assert.equal(env.starts.at(-1).source.stops.length, 0);
});
