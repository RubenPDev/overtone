/* ============================================================
   Facet — sound.

   Everything is synthesised at play time; there are no files to load,
   which keeps the game offline-capable and the payload at zero.

   Swaps walk up a pentatonic scale rather than repeating one sample,
   so a run of moves sounds like a phrase instead of a ratchet.
   ============================================================ */

const SCALE = [523.25, 587.33, 698.46, 783.99, 880.0, 1046.5]; // C D F G A C

let ctx = null;
let enabled = true;
let step = 0;
let resumeAskedAt = 0;
const STUCK_MS = 1500;

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

function blip(freq, at, gain, dur, type = 'triangle') {
  const a = ac(); if (!a) return;
  const osc = a.createOscillator();
  const amp = a.createGain();
  const lp = a.createBiquadFilter();
  osc.type = type;
  osc.frequency.value = freq;
  lp.type = 'lowpass';
  lp.frequency.value = 3200;
  amp.gain.setValueAtTime(0, at);
  amp.gain.linearRampToValueAtTime(gain, at + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0007, at + dur);
  osc.connect(lp); lp.connect(amp); amp.connect(a.destination);
  osc.start(at);
  osc.stop(at + dur + 0.03);
}

/** Short filtered-noise burst — the "click" under everything. */
function noise(at, dur, fromHz, toHz, gain, q = 1.1) {
  const a = ac(); if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(fromHz, at);
  bp.frequency.exponentialRampToValueAtTime(toHz, at + dur);
  bp.Q.value = q;
  const amp = a.createGain();
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.0005, at + dur);
  src.connect(bp); bp.connect(amp); amp.connect(a.destination);
  src.start(at);
}

export const sound = {
  get enabled() { return enabled; },
  setEnabled(v) {
    enabled = v;
    if (v) this.tick();
  },
  /** Call from a user gesture so iOS unlocks the context. If an earlier gesture
      already asked and it's still stuck, only a new context brings the sound back. */
  unlock() {
    const a = ac(); if (!a) return;
    if (a.state === 'running') { resumeAskedAt = 0; return; }
    const now = performance.now();
    if (!resumeAskedAt) resumeAskedAt = now;
    else if (now - resumeAskedAt > STUCK_MS) {
      a.close().catch(() => {});
      ctx = null;
      resumeAskedAt = now;
      ac();
    }
  },
  resetPhrase() { step = 0; },

  swap() {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    const t = a.currentTime;
    noise(t, 0.045, 2400, 1100, 0.1, 1.4);
    blip(SCALE[step % SCALE.length], t, 0.13, 0.38);
    step++;
  },

  /** Rising sweep clockwise, falling anticlockwise, so direction is audible. */
  turn(dir) {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    const t = a.currentTime;
    noise(t, 0.22, dir > 0 ? 700 : 2000, dir > 0 ? 2200 : 650, 0.075, 0.9);
    blip(dir > 0 ? 196 : 174.61, t, 0.1, 0.3, 'sine');
  },

  win() {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    const t = a.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      blip(f, t + i * 0.09, 0.14, 0.9, 'sine');
    });
    noise(t, 0.5, 900, 3000, 0.05, 0.8);
  },

  tick() {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    noise(a.currentTime, 0.025, 3000, 1800, 0.035, 2);
  },
};
