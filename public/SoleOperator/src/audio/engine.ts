/**
 * Procedural audio engine. Every sound in the game is synthesized with the Web
 * Audio API (no sample downloads): noise beds, oscillators, filters and a
 * generated convolution reverb sized to the space the Operator is in.
 *
 * Signal flow:
 *   voice → bus (sfx | amb | ui) → master → compressor → speakers
 *                 └─ reverb send ─→ convolver ─┘
 *
 * Nothing here knows about the game; audio/director.ts maps game events and
 * plant state onto these primitives. The context is created on the first user
 * gesture (browsers block audio before that).
 */

export type BusName = 'sfx' | 'amb' | 'ui';
export type NoiseColor = 'white' | 'pink' | 'brown';
export type SpaceAcoustics = 'hall' | 'room' | 'corridor' | 'tunnel' | 'big-hall';

export interface Volumes {
  master: number;
  sfx: number;
  ambience: number;
}

const REVERB: Record<SpaceAcoustics, { seconds: number; decay: number; wet: number }> = {
  room: { seconds: 0.9, decay: 3.2, wet: 0.16 },
  hall: { seconds: 1.8, decay: 2.6, wet: 0.22 },
  'big-hall': { seconds: 2.8, decay: 2.2, wet: 0.28 },
  corridor: { seconds: 1.3, decay: 3.0, wet: 0.24 },
  tunnel: { seconds: 3.4, decay: 1.9, wet: 0.32 },
};

class Engine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses!: Record<BusName, GainNode>;
  private convolver!: ConvolverNode;
  private wet!: GainNode;
  private noise = new Map<NoiseColor, AudioBuffer>();
  private volumes: Volumes = { master: 0.7, sfx: 1, ambience: 1 };
  private acoustics: SpaceAcoustics | null = null;
  private readyFns: (() => void)[] = [];

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  get now() {
    return this.ctx?.currentTime ?? 0;
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx({ latencyHint: 'interactive' });
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 10;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.25;
      comp.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.connect(comp);
      this.convolver = ctx.createConvolver();
      this.wet = ctx.createGain();
      this.convolver.connect(this.wet).connect(this.master);
      const mk = (send: number) => {
        const g = ctx.createGain();
        g.connect(this.master);
        const s = ctx.createGain();
        s.gain.value = send;
        g.connect(s).connect(this.convolver);
        return [g, s] as const;
      };
      const [sfx] = mk(1);
      const [amb] = mk(0.6);
      const [ui] = mk(0);
      this.buses = { sfx, amb, ui };
      this.applyVolumes();
      this.setAcoustics('hall');
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.readyFns.length) {
      const fns = this.readyFns;
      this.readyFns = [];
      fns.forEach((f) => f());
    }
  }

  /** Run once the context exists (beds started before the first gesture). */
  whenReady(fn: () => void) {
    if (this.ctx) fn();
    else this.readyFns.push(fn);
  }

  suspend() {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  resume() {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(v: Volumes) {
    this.volumes = v;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const v = this.volumes;
    this.master.gain.setTargetAtTime(v.master * 0.9, t, 0.05);
    this.buses.sfx.gain.setTargetAtTime(v.sfx, t, 0.05);
    this.buses.ui.gain.setTargetAtTime(v.sfx * 0.8, t, 0.05);
    this.buses.amb.gain.setTargetAtTime(v.ambience, t, 0.05);
  }

  private meterNode: AnalyserNode | null = null;
  /** Dev: RMS and peak of the master output (dBFS). */
  meter(): { rms: number; peak: number } {
    if (!this.ctx) return { rms: -Infinity, peak: -Infinity };
    if (!this.meterNode) {
      this.meterNode = this.ctx.createAnalyser();
      this.meterNode.fftSize = 4096;
      this.master.connect(this.meterNode);
    }
    const d = new Float32Array(this.meterNode.fftSize);
    this.meterNode.getFloatTimeDomainData(d);
    let sum = 0;
    let peak = 0;
    for (const v of d) {
      sum += v * v;
      peak = Math.max(peak, Math.abs(v));
    }
    const db = (x: number) => 20 * Math.log10(Math.max(1e-9, x));
    return { rms: db(Math.sqrt(sum / d.length)), peak: db(peak) };
  }

  bus(name: BusName): AudioNode {
    return this.buses[name];
  }

  /** Rebuild the reverb impulse for the current space (exponentially decaying stereo noise). */
  setAcoustics(a: SpaceAcoustics) {
    if (!this.ctx || a === this.acoustics) return;
    this.acoustics = a;
    const { seconds, decay, wet } = REVERB[a];
    const rate = this.ctx.sampleRate;
    const len = Math.floor(seconds * rate);
    const ir = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // Low-passed noise: darker tail, like concrete and steel rather than glass.
        lp += (Math.random() * 2 - 1 - lp) * (0.55 - 0.35 * t);
        d[i] = lp * Math.pow(1 - t, decay) * (i < rate * 0.004 ? i / (rate * 0.004) : 1);
      }
    }
    this.convolver.buffer = ir;
    this.wet.gain.setTargetAtTime(wet, this.ctx.currentTime, 0.3);
  }

  noiseBuffer(color: NoiseColor): AudioBuffer {
    const ctx = this.ctx!;
    let b = this.noise.get(color);
    if (b) return b;
    const len = ctx.sampleRate * 3;
    b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0,
      last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'white') d[i] = w * 0.5;
      else if (color === 'pink') {
        // Paul Kellet's refined pink filter.
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    this.noise.set(color, b);
    return b;
  }
}

export const engine = new Engine();

// --- Voices -------------------------------------------------------------------------

export interface Place {
  /** Stereo position −1..1. */
  pan?: number;
  /** Extra gain for distance (0..1). */
  gain?: number;
}

function output(bus: BusName, place?: Place): AudioNode {
  const ctx = engine.ctx!;
  let node: AudioNode = engine.bus(bus);
  if (place?.pan) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, place.pan));
    p.connect(node);
    node = p;
  }
  if (place?.gain !== undefined && place.gain !== 1) {
    const g = ctx.createGain();
    g.gain.value = place.gain;
    g.connect(node);
    node = g;
  }
  return node;
}

function envelope(g: GainNode, t: number, peak: number, attack: number, decay: number, hold = 0) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  if (hold) g.gain.setValueAtTime(Math.max(0.0002, peak), t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
  return t + attack + hold + decay;
}

export interface ToneOpts {
  freq: number;
  /** Glide to this frequency over the note. */
  to?: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  decay?: number;
  hold?: number;
  delay?: number;
  bus?: BusName;
  place?: Place;
  /** Low-pass cutoff, Hz. */
  lowpass?: number;
  detune?: number;
}

export function tone(o: ToneOpts) {
  if (!engine.ready) return;
  const ctx = engine.ctx!;
  const t = ctx.currentTime + (o.delay ?? 0);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.detune) osc.detune.value = o.detune;
  const g = ctx.createGain();
  const end = envelope(g, t, o.gain ?? 0.2, o.attack ?? 0.005, o.decay ?? 0.2, o.hold);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), end);
  let head: AudioNode = osc;
  if (o.lowpass) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lowpass;
    head.connect(f);
    head = f;
  }
  head.connect(g).connect(output(o.bus ?? 'sfx', o.place));
  osc.start(t);
  osc.stop(end + 0.05);
}

export interface NoiseOpts {
  color?: NoiseColor;
  filter?: BiquadFilterType;
  freq?: number;
  /** Sweep the filter to this frequency over the burst. */
  to?: number;
  q?: number;
  gain?: number;
  attack?: number;
  decay?: number;
  hold?: number;
  delay?: number;
  bus?: BusName;
  place?: Place;
  rate?: number;
}

export function noise(o: NoiseOpts) {
  if (!engine.ready) return;
  const ctx = engine.ctx!;
  const t = ctx.currentTime + (o.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = engine.noiseBuffer(o.color ?? 'white');
  src.playbackRate.value = o.rate ?? 1;
  const off = Math.random() * 2;
  const f = ctx.createBiquadFilter();
  f.type = o.filter ?? 'bandpass';
  f.frequency.setValueAtTime(o.freq ?? 1000, t);
  f.Q.value = o.q ?? 0.8;
  const g = ctx.createGain();
  const end = envelope(g, t, o.gain ?? 0.2, o.attack ?? 0.003, o.decay ?? 0.15, o.hold);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, end);
  src
    .connect(f)
    .connect(g)
    .connect(output(o.bus ?? 'sfx', o.place));
  src.start(t, off);
  src.stop(end + 0.05);
}

// --- Beds (continuous loops) ----------------------------------------------------------

/**
 * A continuous sound with live parameters: hums, beds, motors. Build it with a
 * function that wires sources into `out`; drive it with level() and the
 * returned AudioParams; stop() fades it out and frees the nodes.
 */
export class Bed {
  readonly out: GainNode;
  private panner: StereoPannerNode;
  private sources: AudioScheduledSourceNode[] = [];
  params: Record<string, AudioParam> = {};
  private stopped = false;

  constructor(bus: BusName, build: (ctx: AudioContext, out: GainNode, bed: Bed) => void, place?: Place) {
    const ctx = engine.ctx!;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.panner = ctx.createStereoPanner();
    this.panner.pan.value = place?.pan ?? 0;
    this.out
      .connect(this.panner)
      .connect(output(bus, place?.gain !== undefined ? { gain: place.gain } : undefined));
    build(ctx, this.out, this);
  }

  /** Register a source so stop() can end it; starts it now. */
  add<T extends AudioScheduledSourceNode>(src: T): T {
    this.sources.push(src);
    if (src instanceof AudioBufferSourceNode) src.start(0, Math.random() * 2);
    else src.start();
    return src;
  }

  osc(type: OscillatorType, freq: number): OscillatorNode {
    const o = engine.ctx!.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return this.add(o);
  }

  noise(color: NoiseColor, rate = 1): AudioBufferSourceNode {
    const s = engine.ctx!.createBufferSource();
    s.buffer = engine.noiseBuffer(color);
    s.loop = true;
    s.playbackRate.value = rate;
    return this.add(s);
  }

  filter(type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
    const f = engine.ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  gain(v: number): GainNode {
    const g = engine.ctx!.createGain();
    g.gain.value = v;
    return g;
  }

  /** Amplitude LFO: returns a gain node whose level wobbles around `base` by `depth`. */
  lfoGain(rate: number, base: number, depth: number, type: OscillatorType = 'sine'): GainNode {
    const g = this.gain(base);
    const lfo = this.osc(type, rate);
    const d = this.gain(depth);
    lfo.connect(d).connect(g.gain);
    return g;
  }

  level(v: number, seconds = 0.4) {
    if (this.stopped || !engine.ctx) return;
    this.out.gain.setTargetAtTime(Math.max(0, v), engine.ctx.currentTime, Math.max(0.01, seconds / 3));
  }

  /** Stereo position −1..1 (for machines at a place in the room). */
  pan(v: number) {
    if (!this.stopped && engine.ctx)
      this.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, v)), engine.ctx.currentTime, 0.05);
  }

  set(name: string, v: number, seconds = 0.2) {
    const p = this.params[name];
    if (p && engine.ctx) p.setTargetAtTime(v, engine.ctx.currentTime, Math.max(0.01, seconds / 3));
  }

  stop(seconds = 0.6) {
    if (this.stopped || !engine.ctx) return;
    this.level(0, seconds);
    this.stopped = true;
    const end = engine.ctx.currentTime + seconds + 0.1;
    for (const s of this.sources) s.stop(end);
    setTimeout(() => this.out.disconnect(), (seconds + 0.3) * 1000);
  }
}
