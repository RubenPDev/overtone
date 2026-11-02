/* ============================================================
   Facet — sound.

   Everything is synthesised at play time; there are no files to load,
   which keeps the game offline-capable and the payload at zero.

   Moves ring a soft mallet note in a small room. Its pitch is how far the
   board is from solved, settling down the scale as it comes right, so the
   win chord, which starts on C, lands as the resolution.
   ============================================================ */

// Moves still needed -> note: 1 is D4, a step above the win's C, up to D5 for 6 or more.
const NOTES = [293.66, 329.63, 392.0, 440.0, 523.25, 587.33]; // D E G A C D

let ctx = null;
let room = null;
let enabled = true;
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

/* A short, dark echo that the move sounds go through, so they have somewhere
   to ring rather than stopping dead. */
function roomIn(a) {
  if (room && room.context === a) return room;
  const input = a.createGain();
  const delay = a.createDelay(1);
  const feedback = a.createGain();
  const damp = a.createBiquadFilter();
  const wet = a.createGain();
  delay.delayTime.value = 0.21;
  feedback.gain.value = 0.28;
  damp.type = 'lowpass';
  damp.frequency.value = 1400;
  wet.gain.value = 0.22;
  input.connect(a.destination);
  input.connect(delay);
  delay.connect(damp); damp.connect(feedback); feedback.connect(delay);
  damp.connect(wet); wet.connect(a.destination);
  room = input;
  return room;
}

/** A felt mallet on wood: the fundamental, plus the overtones a bar has, which die first. */
function mallet(freq, at, gain) {
  const a = ac(); if (!a) return;
  const out = roomIn(a);
  [[1, 1, 1.1], [2, 0.18, 0.35], [3.98, 0.06, 0.12]].forEach(([ratio, level, dur]) => {
    const osc = a.createOscillator();
    const amp = a.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * ratio;
    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(gain * level, at + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0005, at + dur);
    osc.connect(amp); amp.connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.03);
  });
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
function noise(at, dur, fromHz, toHz, gain, q = 1.1, out = null) {
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
  src.connect(bp); bp.connect(amp); amp.connect(out || a.destination);
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

  /** The soft knock of one block trading places with another. */
  swap() {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    noise(a.currentTime, 0.05, 900, 500, 0.05, 1.2, roomIn(a));
  },

  /** The ring sliding round: a low breath, rising clockwise and falling anticlockwise. */
  turn(dir) {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    noise(a.currentTime, 0.26, dir > 0 ? 380 : 900, dir > 0 ? 900 : 380, 0.05, 0.8, roomIn(a));
  },

  /** The note after a move, for how many moves are still needed. */
  note(distance) {
    if (!enabled) return;
    const a = ac(); if (!a) return;
    mallet(NOTES[Math.min(distance, NOTES.length) - 1], a.currentTime, 0.16);
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
    noise(a.currentTime, 0.022, 1500, 1000, 0.022, 1.6);
  },
};
