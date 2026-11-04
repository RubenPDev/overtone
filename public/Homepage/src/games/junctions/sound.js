/* ============================================================
   Junctions — sound.

   All synthesised, nothing to load. The town gets one soft bed of distant
   traffic that swells with how many cars are about, and the odd single car
   passing, rather than a sound per car, which would be a din at fast forward.
   Cars leaving town pop like small bubbles, but never more than a few a
   second, however fast the rush is running.
   ============================================================ */

import { safeGet, safeSet } from '../../lib/progress.js';

const STUCK_MS = 1500;
const POP_GAP = [0.16, 0.3]; // seconds between pops: watching, and fast forward
const PASS_EVERY = [4, 8];   // seconds between cars passing close by, at normal speed

let ctx = null;
let resumeAskedAt = 0;
let enabled = safeGet('junctions:sound') !== 'off';

let bed = null;     // the traffic: { src, gain, filter }
let lastPop = 0;
let nextPass = 0;

function ac() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor({ latencyHint: 'interactive' });
  }
  // Not just 'suspended': iOS reports 'interrupted' after the app is left.
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}

/* Soft noise, mostly low: what a road sounds like from a few streets away. */
function brownNoise(a, seconds) {
  const len = Math.floor(a.sampleRate * seconds);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.2;
  }
  // Fade the ends together so the loop doesn't click.
  const fade = Math.floor(a.sampleRate * 0.05);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    d[i] *= k;
    d[len - 1 - i] *= k;
  }
  return buf;
}

function tone(freq, at, gain, dur, { type = 'sine', to = null, out = null } = {}) {
  const a = ac(); if (!a) return;
  const osc = a.createOscillator();
  const amp = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + dur * 0.6);
  amp.gain.setValueAtTime(0, at);
  amp.gain.linearRampToValueAtTime(gain, at + 0.006);
  amp.gain.exponentialRampToValueAtTime(0.0005, at + dur);
  osc.connect(amp); amp.connect(out || a.destination);
  osc.start(at);
  osc.stop(at + dur + 0.03);
}

/** A bubble: a sine whose pitch flicks up as it bursts. */
function bubble(at, base, gain) {
  tone(base, at, gain, 0.09, { to: base * 1.9 });
}

export const sound = {
  get enabled() { return enabled; },
  setEnabled(on) {
    enabled = on;
    safeSet('junctions:sound', on ? 'on' : 'off');
    if (!on) this.quiet();
    else this.tick();
  },

  /** Call from a tap so iOS unlocks the context; a context stuck after an earlier ask is replaced. */
  unlock() {
    const a = ac(); if (!a) return;
    if (a.state === 'running') { resumeAskedAt = 0; return; }
    const now = performance.now();
    if (!resumeAskedAt) resumeAskedAt = now;
    else if (now - resumeAskedAt > STUCK_MS) {
      a.close().catch(() => {});
      ctx = null;
      bed = null;
      resumeAskedAt = now;
      ac();
    }
  },

  tick() {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    tone(1800, a.currentTime, 0.02, 0.03, { type: 'triangle' });
  },

  /** Building a junction: a soft pop, lower for taking one out. */
  place(removing = false) {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    bubble(a.currentTime, removing ? 300 : 420, 0.09);
  },

  /** The budget won't stretch: two low, gentle notes, falling. */
  refuse() {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    const t = a.currentTime;
    tone(220, t, 0.06, 0.12, { type: 'triangle' });
    tone(175, t + 0.1, 0.06, 0.16, { type: 'triangle' });
  },

  /** A car leaving town. Many at once still make only a few pops. */
  pop(fast = false) {
    if (!enabled) return;
    const a = ac(); if (!a || a.state !== 'running') return;
    const t = a.currentTime;
    if (t - lastPop < POP_GAP[fast ? 1 : 0] * (0.8 + Math.random() * 0.5)) return;
    lastPop = t;
    bubble(t, 520 + Math.random() * 380, 0.035);
  },

  /** The town's traffic: louder and a touch brighter the more cars are about (0 to 1). */
  traffic(level, fast = false) {
    if (!enabled) return;
    const a = ac(); if (!a || a.state !== 'running') return;
    if (!bed) {
      const src = a.createBufferSource();
      src.buffer = brownNoise(a, 4);
      src.loop = true;
      const filter = a.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 260;
      const gain = a.createGain();
      gain.gain.value = 0;
      src.connect(filter); filter.connect(gain); gain.connect(a.destination);
      src.start();
      bed = { src, gain, filter };
      nextPass = a.currentTime + 2;
    }
    const t = a.currentTime;
    const l = Math.max(0, Math.min(1, level));
    bed.gain.gain.setTargetAtTime(0.012 + l * 0.05, t, 0.4);
    bed.filter.frequency.setTargetAtTime(220 + l * 260, t, 0.6);

    // Now and then, one car goes by close: a soft swell of engine and tyre.
    if (!fast && l > 0.05 && t >= nextPass) {
      nextPass = t + PASS_EVERY[0] + Math.random() * (PASS_EVERY[1] - PASS_EVERY[0]);
      const src = a.createBufferSource();
      src.buffer = brownNoise(a, 1.6);
      const bp = a.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(280, t);
      bp.frequency.linearRampToValueAtTime(520, t + 0.7);
      bp.frequency.linearRampToValueAtTime(240, t + 1.5);
      const amp = a.createGain();
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(0.06, t + 0.7);
      amp.gain.linearRampToValueAtTime(0, t + 1.5);
      const pan = a.createStereoPanner ? a.createStereoPanner() : null;
      src.connect(bp); bp.connect(amp);
      if (pan) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        pan.pan.setValueAtTime(-0.7 * dir, t);
        pan.pan.linearRampToValueAtTime(0.7 * dir, t + 1.5);
        amp.connect(pan); pan.connect(a.destination);
      } else {
        amp.connect(a.destination);
      }
      src.start(t);
    }
  },

  /** The traffic fades out: the rush is over, or stopped. */
  quiet() {
    if (!bed || !ctx) return;
    const { src, gain } = bed;
    bed = null;
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    src.stop(ctx.currentTime + 1.5);
  },

  /** Every car through: a bright chord. Perfect adds a little shower of pops. */
  win(perfect) {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    const t = a.currentTime;
    if (!perfect) {
      tone(659.25, t, 0.11, 0.6);
      tone(987.77, t + 0.12, 0.1, 0.9);
      return;
    }
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, t + i * 0.08, 0.11, 1.1));
    tone(261.63, t, 0.08, 1.4, { type: 'triangle' });
    for (let i = 0; i < 9; i++) bubble(t + 0.35 + i * 0.07 + Math.random() * 0.04, 600 + Math.random() * 700, 0.04);
  },
};
