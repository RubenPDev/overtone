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

const TOL_LOW = 0.72;
const TOL_HIGH = 1.38;
const POINTS = 288;
const STUCK_MS = 1500;
const GESTURES = ['touchend', 'pointerup', 'click', 'keydown'];

export function gradeGaps(played, target) {
  let num = 0, den = 0;
  for (let k = 0; k < played.length; k++) { num += played[k] * target[k]; den += target[k] * target[k]; }
  const scale = num / den;
  const marks = [];
  let correct = 0;
  for (let k = 0; k < played.length; k++) {
    const ratio = played[k] / scale / target[k];
    const good = ratio > TOL_LOW && ratio < TOL_HIGH;
    if (good) correct++;
    marks.push(good ? 0 : (ratio < 1 ? -1 : 1));
  }
  return { scale, marks, correct, total: played.length, bpm: Math.round(60 / scale) };
}

export function createCadenceEngine({ pad, canvas, onChange }) {
  const ctx = canvas.getContext('2d');

  let melody = null;
  let ac = null, analyser = null, scopeData = null;
  const buffers = new Map();
  let warmTimer = 0, pendingFreq = null, resumeAskedAt = 0;

  let taps = [], index = 0, finished = false;
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

  /* A soft electric piano: a phase-modulated sine whose brightness fades
     within the first few hundred ms, leaving a mellow, nearly pure tone.
     All partials are harmonic, so the scope trace stays steady. The strike
     itself stays sharp; that matters more than tone in a timing game. */
  function synth(freq) {
    const sr = ac.sampleRate;
    const len = 2.2;
    const n = Math.floor(sr * len);
    const b = ac.createBuffer(1, n, sr);
    const d = b.getChannelData(0);
    const w = Math.PI * 2 * freq;
    const wDetuned = w * 1.0012;         // ~2 cents: a slow, warm beating
    const decay = 1.2 + freq / 400;      // higher notes fade sooner
    for (let k = 0; k < n; k++) {
      const t = k / sr;
      const attack = t < 0.006 ? t / 0.006 : 1;
      const release = Math.min(1, (len - t) / 0.06);
      const body = Math.exp(-t * decay);
      const index = 1.1 * Math.exp(-t * 9);  // strike brightness
      const tine = Math.exp(-t * 32);
      d[k] = 0.3 * attack * release * (
        body * 0.78 * Math.sin(w * t + index * Math.sin(w * t)) +
        body * 0.22 * Math.sin(wDetuned * t) +
        body * 0.05 * Math.sin(2 * w * t) +
        tine * 0.03 * Math.sin(7 * w * t)
      );
    }
    return b;
  }

  /* Synthesised room: decaying stereo noise that darkens as it fades. */
  function roomImpulse(seconds = 2.6) {
    const sr = ac.sampleRate;
    const n = Math.floor(sr * seconds);
    const pre = Math.floor(sr * 0.014);
    const b = ac.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let y = 0;
      for (let k = pre; k < n; k++) {
        const t = (k - pre) / sr;
        const x = (Math.random() * 2 - 1) * Math.exp(-t * 2.6);
        y += (x - y) * (0.55 * Math.exp(-t * 1.8) + 0.05);
        d[k] = y;
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

    // analyser (dry, so the scope reads the clean note) -> soft top end
    //   -> dry + reverb -> gentle glue compression -> out
    const tone = ac.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 5200;
    tone.Q.value = 0.5;
    const dry = ac.createGain();
    dry.gain.value = 0.85;
    const room = ac.createConvolver();
    room.buffer = roomImpulse();
    const wet = ac.createGain();
    wet.gain.value = 0.28;
    const glue = ac.createDynamicsCompressor();
    glue.threshold.value = -14;
    glue.knee.value = 10;
    glue.ratio.value = 3;
    analyser.connect(tone);
    tone.connect(dry); dry.connect(glue);
    tone.connect(room); room.connect(wet); wet.connect(glue);
    glue.connect(ac.destination);
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
  const theme = { faint: 'rgba(128,128,128,0.2)', ok: '#1D9E75', warn: '#EF9F27', bad: '#E24B4A' };
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
    const dot = Math.max(1.8, W * 0.0085);
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
    ctx.strokeStyle = `rgba(${rgb},${(0.26 + Math.min(0.50, rms * 6) + flash * 0.10).toFixed(3)})`;
    ctx.lineWidth = 1 + Math.min(1.3, rms * 5) + flash * 0.4;
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

    if (e && e.clientX !== undefined) {
      const r = pad.getBoundingClientRect();
      ripple = { x: e.clientX - r.left, y: e.clientY - r.top, t: now };
    } else {
      ripple = { x: W / 2, y: H / 2, t: now };
    }

    if (finished) { reset(); return; }
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
