import { hueFor, NEUTRAL } from './melodies.js';

/* ============================================================
   The Cadence engine.

   Deliberately framework-free. It owns the AudioContext, the
   requestAnimationFrame loop and the pointer handlers — all of
   which are timing-sensitive and would gain nothing from living
   inside React's render cycle. It reports to React only on
   discrete events (a tap, a reset, a finish), never per frame,
   so the 60fps loop never triggers a re-render.
   ============================================================ */

const TOL_LOW = 0.60;
const TOL_HIGH = 1.65;
const MIN_STEP = 1.15; // how much longer a long note must be than a shorter neighbour
const POINTS = 288;
const STUCK_MS = 1500;
const GESTURES = ['touchend', 'pointerup', 'click', 'keydown'];

/* The piano's overtones: [multiple of the note, loudness, how much faster than the
   note itself it fades]. Exact multiples, so the scope's trace holds still. */
const PARTIALS = [[1, 1, 0], [2, 0.3, 1.6], [3, 0.11, 3], [4, 0.045, 4.5], [5, 0.02, 6]];
const NOTE_SECONDS = 3.2;

/* -1 held too short, 0 fine, 1 held too long, at a given tempo. The range alone
   is generous enough that steady tapping could slip through, so the shape has to
   be there too: a note written longer than its neighbour must be played longer. */
function markGaps(played, target, scale) {
  return played.map((gap, k) => {
    const ratio = gap / scale / target[k];
    if (ratio <= TOL_LOW) return -1;
    if (ratio >= TOL_HIGH) return 1;
    for (const j of [k - 1, k + 1]) {
      if (j >= 0 && j < played.length && target[j] < target[k] && gap < played[j] * MIN_STEP) return -1;
    }
    return 0;
  });
}

/* The tempo is whichever one the most notes agree with, not an average. An average
   leans on the long notes, so holding one a little short made every short note
   look wrong. Each note proposes a tempo, and ties go to the closest overall fit. */
export function gradeGaps(played, target) {
  let num = 0, den = 0;
  for (let k = 0; k < played.length; k++) { num += played[k] * target[k]; den += target[k] * target[k]; }

  let best = null;
  for (const scale of [num / den, ...played.map((gap, k) => gap / target[k])]) {
    const marks = markGaps(played, target, scale);
    const correct = marks.filter((m) => m === 0).length;
    const error = played.reduce((sum, gap, k) => sum + Math.abs(Math.log(gap / scale / target[k])), 0);
    if (!best || correct > best.correct || (correct === best.correct && error < best.error)) {
      best = { scale, marks, correct, error };
    }
  }
  const { scale, marks, correct } = best;
  return { scale, marks, correct, total: played.length, bpm: Math.round(60 / scale) };
}

export function createCadenceEngine({ pad, canvas, onChange }) {
  const ctx = canvas.getContext('2d');

  let melody = null;
  let ac = null, analyser = null, scopeData = null;
  const buffers = new Map();
  let warmTimer = 0, pendingFreq = null, resumeAskedAt = 0;

  let taps = [], index = 0, finished = false;
  let locked = false; // showing a solved puzzle: the pad waits for Try again
  let lastTapTime = 0, fastestGap = Infinity, lastFreq = 330;
  let flash = 0, ripple = null, result = null;
  let revealTimers = [], revealLit = -1;

  let visual = { lobes: 3, spike: 1.9, uneven: 0.30, steady: 0.18 };

  let W = 0, H = 0, raf = 0, disposed = false;
  const displayed = new Float32Array(POINTS + 1);
  const targets = new Float32Array(POINTS + 1);
  let colour = NEUTRAL.slice();
  let colourTarget = NEUTRAL.slice();

  /* ---------------- audio ---------------- */

  /* A soft felt piano. A few pure overtones, the higher ones fading first, over a
     body that settles quickly from the strike into a long, quiet ring. The strike
     is rounded rather than hit, but still lands within a hundredth of a second,
     which matters in a timing game. No modulation and no noise, so nothing in it
     can buzz; it ends in a slow fade rather than being cut off. */
  function synth(freq) {
    const sr = ac.sampleRate;
    const n = Math.floor(sr * NOTE_SECONDS);
    const b = ac.createBuffer(1, n, sr);
    const d = b.getChannelData(0);
    const w = Math.PI * 2 * freq;
    const settle = 2.6 + freq / 500;  // the strike's quick drop; higher notes drop sooner
    const ring = 0.6 + freq / 1000;   // and the long ring after it
    const dull = 1 + freq / 600;      // higher notes lose their overtones sooner too
    const rise = 0.01;
    const fade = 0.8;
    for (let k = 0; k < n; k++) {
      const t = k / sr;
      const attack = t < rise ? 0.5 - 0.5 * Math.cos((Math.PI * t) / rise) : 1;
      const r = Math.min(1, (NOTE_SECONDS - t) / fade);
      const release = 0.5 - 0.5 * Math.cos(Math.PI * r);
      const body = 0.55 * Math.exp(-t * settle) + 0.45 * Math.exp(-t * ring);
      let s = 0;
      for (const [mult, level, faster] of PARTIALS) s += level * Math.exp(-t * faster * dull) * Math.sin(w * mult * t);
      d[k] = 0.2 * attack * release * body * s;
    }
    return b;
  }

  /* A small, warm room: a smooth decay of uncorrelated left and right noise,
     softened so the tail is a hush, not a hiss or a rumble, and faded in over
     its first few milliseconds so it never clicks. */
  function roomImpulse(seconds = 2.4) {
    const sr = ac.sampleRate;
    const n = Math.floor(sr * seconds);
    const pre = Math.floor(sr * 0.02);
    const b = ac.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lo = 0;
      let lo2 = 0;
      for (let k = pre; k < n; k++) {
        const t = (k - pre) / sr;
        const x = (Math.random() * 2 - 1) * Math.exp(-t * 3.2) * Math.min(1, t / 0.008);
        // Two gentle lowpasses: the room loses its top as it fades, but never goes muddy.
        const a = 0.35 * Math.exp(-t * 0.9) + 0.12;
        lo += (x - lo) * a;
        lo2 += (lo - lo2) * a;
        d[k] = lo2;
      }
    }
    return b;
  }

  function buildGraph() {
    ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    ac.onstatechange = onAudioState;
    analyser = ac.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;
    scopeData = new Float32Array(analyser.fftSize);

    // analyser (dry, so the scope reads the clean note) -> soft top, no rumble
    //   -> dry + a little room -> a limiter that only ever touches peaks -> out.
    // Nothing here turns quiet sound up, so a fading note just fades.
    const tone = ac.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 4200;
    tone.Q.value = 0.5;
    const low = ac.createBiquadFilter();
    low.type = 'highpass';
    low.frequency.value = 110;
    low.Q.value = 0.5;
    const dry = ac.createGain();
    dry.gain.value = 0.9;
    const room = ac.createConvolver();
    room.buffer = roomImpulse();
    const roomLow = ac.createBiquadFilter();
    roomLow.type = 'highpass';
    roomLow.frequency.value = 240;
    const wet = ac.createGain();
    wet.gain.value = 0.2;
    const limit = ac.createDynamicsCompressor();
    limit.threshold.value = -3;
    limit.knee.value = 0;
    limit.ratio.value = 20;
    limit.attack.value = 0.002;
    limit.release.value = 0.12;
    analyser.connect(tone); tone.connect(low);
    low.connect(dry); dry.connect(limit);
    low.connect(room); room.connect(roomLow); roomLow.connect(wet); wet.connect(limit);
    limit.connect(ac.destination);
  }

  function bufferFor(freq) {
    if (!buffers.has(freq)) buffers.set(freq, synth(freq));
    return buffers.get(freq);
  }

  /* Synthesising every note on the first tap would stall the very taps being
     timed, so it happens ahead of time, one step at a time, between frames.
     The context can be built without a gesture; it just starts out suspended. */
  function warmUp() {
    clearTimeout(warmTimer);
    warmTimer = setTimeout(() => {
      if (!melody) return;
      if (!ac) { buildGraph(); warmUp(); return; }
      const next = melody.notes.find((f) => !buffers.has(f));
      if (next !== undefined) { bufferFor(next); warmUp(); }
    }, 30);
  }

  function ensureAudio() {
    if (!ac) buildGraph();
    // Not just 'suspended': iOS reports 'interrupted' after the app is left.
    if (ac.state !== 'running') ac.resume().catch(() => {});
  }

  /* iOS only lets audio start from the end of a touch, not from pointerdown,
     so every gesture on the page gets a chance to unlock it. If a gesture
     already asked and the context is still stuck (iOS can leave one dead after
     an interruption), only a new context will bring the sound back. */
  function onGesture() {
    if (!ac) buildGraph();
    if (ac.state === 'running') return;
    const now = performance.now();
    if (!resumeAskedAt) resumeAskedAt = now;
    else if (now - resumeAskedAt > STUCK_MS) {
      ac.onstatechange = null;
      ac.close().catch(() => {});
      buildGraph();
      resumeAskedAt = now;
    }
    ac.resume().catch(() => {});
    const s = ac.createBufferSource();
    s.buffer = ac.createBuffer(1, 1, ac.sampleRate);
    s.connect(ac.destination);
    s.start();
  }

  function onAudioState() {
    if (ac.state !== 'running') return;
    resumeAskedAt = 0;
    if (pendingFreq !== null) {
      const freq = pendingFreq;
      pendingFreq = null;
      fire(freq);
    }
  }

  /* Coming back to the page: worth trying, though iOS may insist on a gesture. */
  function onReturn() {
    pendingFreq = null;
    if (ac && !document.hidden && ac.state !== 'running') ac.resume().catch(() => {});
  }

  function fire(freq) {
    lastFreq = freq;
    // Notes started while silent would all sound at once on waking, so only
    // the latest is kept, to play as soon as the context is running.
    if (ac.state !== 'running') { pendingFreq = freq; return; }
    const s = ac.createBufferSource();
    s.buffer = bufferFor(freq);
    s.connect(analyser);
    s.start(0);
  }

  /* ---------------- reporting ---------------- */

  function snapshot() {
    return {
      index,
      total: melody ? melody.notes.length : 0,
      finished,
      lastGapMs: lastTapTime && taps.length > 1
        ? Math.round((taps[taps.length - 1] - taps[taps.length - 2]) * 1000)
        : null,
      fastestMs: Number.isFinite(fastestGap) ? fastestGap : null,
      result,
    };
  }

  function report() { if (onChange) onChange(snapshot()); }

  /* ---------------- drawing ---------------- */

  function sizeCanvas() {
    const r = pad.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    W = Math.max(1, Math.floor(r.width));
    H = Math.max(1, Math.floor(r.height));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function sharpen(v) {
    let n = v / 0.42;
    if (n > 1) n = 1; else if (n < -1) n = -1;
    return (n < 0 ? -1 : 1) * Math.pow(Math.abs(n), visual.spike);
  }

  /* Theme colours, re-read every half second or so, so the light/dark
     toggle reaches the canvas without a getComputedStyle every frame. */
  const theme = { faint: 'rgba(128,128,128,0.2)', ok: '#2fc4a0', warn: '#efa93a', bad: '#ec6f78' };
  let themeAge = Infinity;
  function readTheme() {
    const cs = getComputedStyle(pad);
    const get = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
    theme.faint = get('--rule-2', theme.faint);
    theme.ok = get('--ok', theme.ok);
    theme.warn = get('--warn', theme.warn);
    theme.bad = get('--bad', theme.bad);
    themeAge = 0;
  }

  /* One dot per note around the rim, evenly spaced (spacing them by the
     real gaps would give the rhythm away). Played notes take their pitch
     colour; once graded, each dot shows how long that note was held. Nothing
     follows the last note, so it can't be wrong. */
  function noteDots(cx, cy, rim) {
    if (!melody) return;
    const n = melody.notes.length;
    const dot = Math.max(2.4, W * 0.012);
    const lit = Math.max(index, revealLit + 1);
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (k / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * rim, y = cy + Math.sin(a) * rim;
      let fill = null;
      if (result) {
        const m = result.marks[k] ?? 0;
        fill = m === 0 ? theme.ok : m === -1 ? theme.warn : theme.bad;
      } else if (k < lit) {
        const [r, g, b] = hueFor(melody.notes[k]);
        fill = `rgb(${r},${g},${b})`;
      }
      ctx.beginPath();
      ctx.arc(x, y, dot, 0, Math.PI * 2);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      } else {
        ctx.strokeStyle = theme.faint;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  function draw() {
    if (disposed) return;
    raf = requestAnimationFrame(draw);
    if (!W) sizeCanvas();
    ctx.clearRect(0, 0, W, H);

    if (++themeAge > 30) readTheme();

    const cx = W / 2, cy = H / 2, amp = W * 0.15;
    let R = W * 0.27, rms = 0, k;

    for (k = 0; k < 3; k++) colour[k] += (colourTarget[k] - colour[k]) * 0.12;
    const rgb = `${Math.round(colour[0])},${Math.round(colour[1])},${Math.round(colour[2])}`;

    if (analyser) {
      analyser.getFloatTimeDomainData(scopeData);
      for (k = 0; k < 512; k += 4) rms += scopeData[k] * scopeData[k];
      rms = Math.sqrt(rms / 128);
    }
    const energy = Math.min(1, rms * 8);

    // The face lights up in the note's colour while it rings.
    const glowA = 0.16 * energy + 0.08 * Math.max(0, flash);
    if (glowA > 0.004) {
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.5);
      glow.addColorStop(0, `rgba(${rgb},${glowA.toFixed(3)})`);
      glow.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    }

    noteDots(cx, cy, W * 0.43);

    // At rest the trace breathes slowly, so the pad reads as live.
    R *= 1 + 0.018 * (1 - energy) * Math.sin(performance.now() / 1000 * 1.3);

    if (ripple) {
      const age = (performance.now() - ripple.t) / 460;
      if (age >= 1) ripple = null;
      else {
        ctx.strokeStyle = `rgba(${rgb},${((1 - age) * 0.30).toFixed(3)})`;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, 6 + age * W * 0.3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (flash > 0) flash -= 0.06;

    if (analyser) {
      const n = scopeData.length, sr = ac.sampleRate;
      let span = Math.round((sr / lastFreq) * visual.lobes);
      if (span < 24) span = 24;
      if (span > n - 80) span = n - 80;

      let start = 0;
      const limit = n - span - 1;
      for (k = 1; k < limit; k++) {
        if (scopeData[k - 1] < 0 && scopeData[k] >= 0) { start = k; break; }
      }
      for (k = 0; k <= POINTS; k++) {
        targets[k] = sharpen(scopeData[start + Math.floor((k % POINTS) / POINTS * span)]);
      }
    } else {
      for (k = 0; k <= POINTS; k++) targets[k] = 0;
    }

    for (k = 0; k <= POINTS; k++) displayed[k] += (targets[k] - displayed[k]) * visual.steady;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.miterLimit = 1;
    ctx.beginPath();
    for (k = 0; k <= POINTS; k++) {
      const a = -Math.PI / 2 + Math.PI * 2 * (k % POINTS) / POINTS;
      const scale = 1 + visual.uneven * (
        Math.sin(a * 2 + 0.9) * 0.62 +
        Math.sin(a * 3 - 1.7) * 0.46 +
        Math.sin(a * 5 + 2.4) * 0.30
      );
      let r = R + displayed[k] * amp * scale;
      if (r < 8) r = 8;
      if (r > W / 2 - 4) r = W / 2 - 4;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(${rgb},${(0.5 + Math.min(0.45, rms * 6) + flash * 0.05).toFixed(3)})`;
    ctx.lineWidth = 2 + Math.min(1.6, rms * 5) + flash * 0.5;
    ctx.stroke();
  }

  /* ---------------- flow ---------------- */

  function clearReveal() {
    revealTimers.forEach(clearTimeout);
    revealTimers = [];
    revealLit = -1;
  }

  function reset() {
    clearReveal();
    pendingFreq = null;
    taps = [];
    index = 0;
    finished = false;
    lastTapTime = 0;
    fastestGap = Infinity;
    result = null;
    colourTarget = NEUTRAL.slice();
    report();
  }

  function finish() {
    const played = [];
    for (let k = 1; k < taps.length; k++) played.push(taps[k] - taps[k - 1]);
    result = gradeGaps(played, melody.gaps);
    finished = true;
    report();
  }

  function onPress(e) {
    const now = performance.now();
    if (e && e.preventDefault) e.preventDefault();
    // A finished run stays on the pad until Try again, so stray taps can't wipe it.
    if (finished || locked) return;

    if (e && e.clientX !== undefined) {
      const r = pad.getBoundingClientRect();
      ripple = { x: e.clientX - r.left, y: e.clientY - r.top, t: now };
    } else {
      ripple = { x: W / 2, y: H / 2, t: now };
    }

    if (!melody) return;

    ensureAudio();
    if (index >= melody.notes.length) return;

    const freq = melody.notes[index];
    fire(freq);
    flash = 1;

    colourTarget = hueFor(freq);

    taps.push(now / 1000);

    if (lastTapTime) {
      const gap = Math.round(now - lastTapTime);
      if (gap < fastestGap) fastestGap = gap;
    }
    lastTapTime = now;

    index++;
    report();
    if (index === melody.notes.length) setTimeout(finish, 10);
  }

  function reveal() {
    if (!melody) return;
    ensureAudio();
    clearReveal();
    let t = ac.currentTime + 0.08;
    let offset = 0;
    for (let k = 0; k < melody.notes.length; k++) {
      const freq = melody.notes[k];
      const hue = hueFor(freq);
      revealTimers.push(setTimeout(() => {
        colourTarget = hue;
        revealLit = k;
      }, offset * 1000));
      const s = ac.createBufferSource();
      s.buffer = bufferFor(freq);
      s.connect(analyser);
      s.start(t);
      lastFreq = freq;
      if (k < melody.gaps.length) {
        t += melody.gaps[k] * melody.playback;
        offset += melody.gaps[k] * melody.playback;
      }
    }
    revealTimers.push(setTimeout(() => { revealLit = -1; }, (offset + 1.2) * 1000));
  }

  /* ---------------- wiring ---------------- */

  const onResize = () => { W = 0; };
  const noSelect = (e) => e.preventDefault();

  if (window.PointerEvent) {
    pad.addEventListener('pointerdown', onPress);
  } else {
    pad.addEventListener('touchstart', (e) => { e.preventDefault(); onPress(null); }, { passive: false });
    pad.addEventListener('mousedown', onPress);
  }
  pad.addEventListener('dblclick', noSelect);
  pad.addEventListener('contextmenu', noSelect);
  window.addEventListener('resize', onResize);
  GESTURES.forEach((type) => window.addEventListener(type, onGesture, true));
  document.addEventListener('visibilitychange', onReturn);
  window.addEventListener('pageshow', onReturn);

  sizeCanvas();
  draw();

  return {
    loadMelody(m) {
      melody = m;
      warmUp();
      reset();
    },
    reset,
    reveal,
    setLocked(on) { locked = on; },
    unlock: onGesture,
    setVisual(next) { visual = { ...visual, ...next }; },
    getState: snapshot,
    destroy() {
      disposed = true;
      cancelAnimationFrame(raf);
      clearReveal();
      clearTimeout(warmTimer);
      GESTURES.forEach((type) => window.removeEventListener(type, onGesture, true));
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('pageshow', onReturn);
      pad.removeEventListener('pointerdown', onPress);
      pad.removeEventListener('mousedown', onPress);
      pad.removeEventListener('dblclick', noSelect);
      pad.removeEventListener('contextmenu', noSelect);
      window.removeEventListener('resize', onResize);
      if (ac) ac.close().catch(() => {});
    },
  };
}
