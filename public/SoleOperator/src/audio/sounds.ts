import { Bed, noise, tone, type Place } from './engine';

/**
 * The sound palette. One-shots are plain functions; beds are factories that
 * return a running Bed. Design notes: industrial and believable first: mains
 * hum, air handling, pumps, relays, steel. Interface sounds are soft sine and
 * triangle tones, never arcade blips. Alarms are the only harsh sounds.
 */

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// --- Interface --------------------------------------------------------------------------

export const ui = {
  click() {
    tone({ freq: 1800, type: 'sine', gain: 0.05, decay: 0.035, bus: 'ui' });
    noise({ freq: 4000, q: 2, gain: 0.025, decay: 0.02, bus: 'ui' });
  },
  open() {
    tone({ freq: 520, to: 780, type: 'triangle', gain: 0.07, attack: 0.01, decay: 0.12, bus: 'ui' });
    tone({ freq: 1040, type: 'sine', gain: 0.04, decay: 0.15, delay: 0.07, bus: 'ui' });
  },
  close() {
    tone({ freq: 780, to: 470, type: 'triangle', gain: 0.06, attack: 0.01, decay: 0.12, bus: 'ui' });
  },
  info() {
    tone({ freq: 1320, type: 'sine', gain: 0.06, decay: 0.18, bus: 'ui' });
  },
  ok() {
    tone({ freq: 880, type: 'sine', gain: 0.07, decay: 0.16, bus: 'ui' });
    tone({ freq: 1318, type: 'sine', gain: 0.06, decay: 0.3, delay: 0.09, bus: 'ui' });
  },
  warn() {
    tone({ freq: 740, type: 'triangle', gain: 0.08, decay: 0.16, bus: 'ui' });
    tone({ freq: 554, type: 'triangle', gain: 0.08, decay: 0.26, delay: 0.14, bus: 'ui' });
  },
  deny() {
    tone({ freq: 150, type: 'square', gain: 0.05, decay: 0.08, lowpass: 900, bus: 'ui' });
    tone({ freq: 150, type: 'square', gain: 0.05, decay: 0.1, lowpass: 900, delay: 0.12, bus: 'ui' });
  },
  /** Money in: a register latch and a bright two-note confirm. */
  cash() {
    noise({ freq: 2600, q: 3, gain: 0.05, decay: 0.03, bus: 'ui' });
    tone({ freq: 988, type: 'triangle', gain: 0.07, decay: 0.12, delay: 0.03, bus: 'ui' });
    tone({ freq: 1480, type: 'sine', gain: 0.06, decay: 0.35, delay: 0.11, bus: 'ui' });
  },
  /** Objective step done. */
  step() {
    tone({ freq: 1175, type: 'sine', gain: 0.05, decay: 0.25, bus: 'ui' });
  },
  /** Objective complete: a soft major chord swelling in. */
  complete() {
    [523.3, 659.3, 784, 1046.5].forEach((f, i) =>
      tone({
        freq: f,
        type: 'sine',
        gain: 0.05,
        attack: 0.08,
        hold: 0.25,
        decay: 1.4,
        delay: i * 0.06,
        bus: 'ui',
      }),
    );
  },
  /** Scanner sweep. */
  scan() {
    tone({ freq: 900, to: 2400, type: 'sine', gain: 0.05, attack: 0.01, decay: 0.25, bus: 'ui' });
    tone({ freq: 2400, type: 'sine', gain: 0.03, decay: 0.08, delay: 0.3, bus: 'ui' });
  },
  save() {
    tone({ freq: 660, type: 'sine', gain: 0.04, decay: 0.12, bus: 'ui' });
    tone({ freq: 990, type: 'sine', gain: 0.04, decay: 0.2, delay: 0.08, bus: 'ui' });
  },
};

// --- Mechanical one-shots ------------------------------------------------------------------

export const sfx = {
  /** Boot on steel grating / sealed concrete / tile. */
  step(surface: 'grate' | 'concrete' | 'tile', place: Place, heavy = false) {
    const g = (heavy ? 1.3 : 1) * (place.gain ?? 1);
    const p = { pan: place.pan };
    if (surface === 'grate') {
      noise({ freq: rnd(2200, 3000), q: 3, gain: 0.05 * g, decay: 0.05, place: p });
      tone({ freq: rnd(300, 340), type: 'triangle', gain: 0.025 * g, decay: 0.06, place: p });
    } else {
      noise({
        freq: surface === 'tile' ? rnd(1400, 1900) : rnd(700, 1000),
        q: 1.2,
        gain: 0.06 * g,
        decay: 0.06,
        place: p,
      });
    }
    tone({ freq: rnd(70, 90), type: 'sine', gain: 0.07 * g, decay: 0.07, place: p });
  },
  /** Pneumatic sliding door. */
  door(open: boolean, place: Place) {
    noise({
      freq: open ? 3500 : 2500,
      to: open ? 1500 : 4000,
      filter: 'bandpass',
      q: 0.9,
      gain: 0.07,
      attack: 0.03,
      decay: 0.45,
      place,
    });
    tone({ freq: 95, type: 'sine', gain: 0.09, decay: 0.12, delay: open ? 0.38 : 0.42, place });
    noise({ freq: 600, q: 2, gain: 0.05, decay: 0.05, delay: open ? 0.38 : 0.42, place });
  },
  /** Heavy steel latch: cart docking, cell seating, cask lid. */
  clunk(place: Place = {}, size = 1) {
    tone({ freq: 70 / size, to: 45 / size, type: 'sine', gain: 0.22, decay: 0.25, place });
    noise({ freq: 900 / size, q: 1.5, gain: 0.12, decay: 0.09, place });
    noise({ freq: 3200, q: 4, gain: 0.04, decay: 0.05, delay: 0.02, place });
  },
  /** Relay click (control panels, scram reset). */
  relay(place: Place = {}) {
    noise({ freq: 5200, q: 5, gain: 0.07, decay: 0.012, place });
    noise({ freq: 2400, q: 3, gain: 0.05, decay: 0.02, delay: 0.035, place });
  },
  /** Reactor scram: rods slamming in, a deep shudder and a relay cascade. */
  scram() {
    tone({ freq: 48, to: 30, type: 'sine', gain: 0.45, attack: 0.01, decay: 1.6 });
    noise({ color: 'brown', filter: 'lowpass', freq: 400, gain: 0.5, decay: 1.2 });
    for (let i = 0; i < 12; i++)
      noise({ freq: rnd(1800, 3200), q: 4, gain: 0.08, decay: 0.03, delay: 0.05 + i * 0.045 });
    for (let i = 0; i < 4; i++) sfx.relay({ pan: rnd(-0.6, 0.6) });
  },
  /** Beam trip: an electrical crack and the RF winding down. */
  beamTrip(place: Place = {}) {
    noise({ freq: 6000, filter: 'highpass', gain: 0.18, decay: 0.12, place });
    noise({ color: 'pink', freq: 1200, q: 0.6, gain: 0.12, decay: 0.4, place });
    tone({
      freq: 2600,
      to: 90,
      type: 'sawtooth',
      gain: 0.05,
      attack: 0.005,
      decay: 2.2,
      lowpass: 3000,
      place,
    });
  },
  beamStart(place: Place = {}) {
    tone({
      freq: 120,
      to: 1600,
      type: 'sawtooth',
      gain: 0.035,
      attack: 0.3,
      decay: 1.4,
      lowpass: 2500,
      place,
    });
    tone({ freq: 60, type: 'sine', gain: 0.12, attack: 0.2, decay: 1.2, place });
  },
  /** RF cavity locks onto resonance. */
  lock(place: Place = {}) {
    tone({ freq: 1760, type: 'sine', gain: 0.06, decay: 0.2, place });
    tone({ freq: 2637, type: 'sine', gain: 0.045, decay: 0.45, delay: 0.08, place });
  },
  /** Crane hook: chain rattle (moving) and the clamp. */
  chain(place: Place = {}) {
    for (let i = 0; i < 6; i++)
      noise({ freq: rnd(2500, 4500), q: 6, gain: 0.05, decay: 0.03, delay: i * rnd(0.04, 0.07), place });
  },
  splash(place: Place = {}) {
    noise({ color: 'pink', freq: 1800, to: 500, q: 0.5, gain: 0.16, attack: 0.01, decay: 0.7, place });
    for (let i = 0; i < 5; i++)
      tone({
        freq: rnd(900, 1800),
        to: rnd(1800, 2600),
        gain: 0.03,
        decay: 0.06,
        delay: 0.1 + i * rnd(0.05, 0.12),
        place,
      });
  },
  drip(place: Place = {}) {
    const f = rnd(900, 1500);
    tone({ freq: f, to: f * 1.8, type: 'sine', gain: 0.05, attack: 0.002, decay: 0.07, place });
  },
  /** Pressurised air or cryo valve venting. */
  hiss(place: Place = {}, seconds = 0.8) {
    noise({
      freq: 5000,
      filter: 'highpass',
      gain: 0.05,
      attack: 0.05,
      hold: seconds * 0.4,
      decay: seconds * 0.6,
      place,
    });
  },
  /** A distant metallic knock somewhere in the structure. */
  knock(place: Place = {}) {
    const f = rnd(180, 420);
    tone({ freq: f, type: 'triangle', gain: 0.05, decay: 0.4, place });
    tone({ freq: f * 2.76, type: 'sine', gain: 0.02, decay: 0.25, place });
  },
  /** Keyboard clatter from a crew console. */
  keys(place: Place = {}) {
    const n = 3 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++)
      noise({ freq: rnd(3000, 5000), q: 3, gain: 0.025, decay: 0.015, delay: i * rnd(0.07, 0.16), place });
  },
  /** Rail drone scan pings. */
  dronePing(place: Place = {}) {
    for (let i = 0; i < 3; i++)
      tone({ freq: 2093, type: 'sine', gain: 0.04, decay: 0.08, delay: i * 0.22, place });
  },
  /** PA chime before an announcement. */
  pa() {
    [784, 659.3, 523.3].forEach((f, i) =>
      tone({ freq: f, type: 'sine', gain: 0.05, attack: 0.02, decay: 0.7, delay: i * 0.35, bus: 'amb' }),
    );
  },
};

// --- Beds ------------------------------------------------------------------------------------

/** Mains transformer hum: 50 Hz with its harmonics, slightly uneven. */
export function humBed() {
  return new Bed('amb', (ctx, out, b) => {
    const lp = b.filter('lowpass', 420);
    [
      [50, 0.5],
      [100, 0.8],
      [150, 0.35],
      [200, 0.2],
      [300, 0.08],
    ].forEach(([f, g]) => {
      const o = b.osc('sine', f!);
      o.detune.value = rnd(-4, 4);
      o.connect(b.gain(g!)).connect(lp);
    });
    lp.connect(out);
    void ctx;
  });
}

/** Air handling: broadband air with a slow breathing swell. */
export function airBed(bright = 600) {
  return new Bed('amb', (_ctx, out, b) => {
    const n = b.noise('pink');
    const hp = b.filter('highpass', 70);
    const lp = b.filter('lowpass', bright);
    const swell = b.lfoGain(0.07, 0.8, 0.2);
    n.connect(hp).connect(lp).connect(swell).connect(out);
    b.params.bright = lp.frequency;
  });
}

/**
 * Reactor coolant pumps: a deep rumble with the shaft rate (≈ 29.7 Hz) and its
 * vane-pass tone. `flow` sets level, `power` adds turbulence.
 */
export function pumpBed() {
  return new Bed('amb', (_ctx, out, b) => {
    const rumble = b.noise('brown');
    const lp = b.filter('lowpass', 160);
    rumble.connect(lp).connect(b.gain(1.1)).connect(out);
    const shaft = b.osc('sine', 29.7);
    const mod = b.lfoGain(29.7 / 2, 0.5, 0.25);
    shaft.connect(mod).connect(b.gain(0.5)).connect(out);
    const vane = b.osc('triangle', 29.7 * 7);
    const vlp = b.filter('lowpass', 500);
    vane.connect(vlp).connect(b.gain(0.05)).connect(out);
    const turb = b.noise('pink');
    const bp = b.filter('bandpass', 380, 0.6);
    const tg = b.gain(0.2);
    turb.connect(bp).connect(tg).connect(out);
    b.params.turbulence = tg.gain;
  });
}

/** Still water: slow lapping against a pool wall, with circulation underneath. */
export function waterBed() {
  return new Bed('amb', (_ctx, out, b) => {
    const n = b.noise('pink');
    const bp = b.filter('bandpass', 700, 0.5);
    const lap = b.lfoGain(0.23, 0.45, 0.35);
    const lap2 = b.lfoGain(0.37, 0.7, 0.3);
    n.connect(bp).connect(lap).connect(lap2).connect(out);
    const circ = b.noise('brown');
    circ.connect(b.filter('lowpass', 220)).connect(b.gain(0.5)).connect(out);
  });
}

/** Helium compressor: a slow mechanical thump with a vacuum-pump drone. */
export function cryoBed() {
  return new Bed('amb', (_ctx, out, b) => {
    const n = b.noise('brown');
    const lp = b.filter('lowpass', 130);
    const thump = b.lfoGain(1.25, 0.55, 0.45, 'square');
    n.connect(lp).connect(thump).connect(b.gain(1.2)).connect(out);
    const drone = b.osc('sawtooth', 60);
    drone.connect(b.filter('lowpass', 240)).connect(b.gain(0.05)).connect(out);
    const valve = b.noise('white');
    valve.connect(b.filter('highpass', 6000)).connect(b.gain(0.012)).connect(out);
  });
}

/** Klystron and RF: a faint high whine with a slight warble; `current` scales it. */
export function rfBed() {
  return new Bed('amb', (_ctx, out, b) => {
    const o = b.osc('sine', 2810);
    const o2 = b.osc('sine', 5620);
    const vib = b.osc('sine', 5.3);
    vib.connect(b.gain(6)).connect(o.frequency);
    o.connect(b.gain(0.5)).connect(out);
    o2.connect(b.gain(0.12)).connect(out);
    const buzz = b.osc('sawtooth', 100);
    buzz
      .connect(b.filter('bandpass', 400, 2))
      .connect(b.gain(0.18))
      .connect(out);
  });
}

/** Magnet string hum along the ring (deeper than the mains hum, wider). */
export function magnetBed() {
  return new Bed('amb', (_ctx, out, b) => {
    const a = b.osc('sawtooth', 75);
    const c = b.osc('sawtooth', 75.4);
    const lp = b.filter('lowpass', 300);
    a.connect(lp);
    c.connect(lp);
    lp.connect(b.lfoGain(0.11, 0.8, 0.2)).connect(out);
  });
}

/** Electric motor with a gearbox: rod drives, crane bridge, hoist. `rate` sets the pitch. */
export function motorBed(base = 180, place?: Place) {
  return new Bed(
    'sfx',
    (_ctx, out, b) => {
      const o = b.osc('sawtooth', base);
      const o2 = b.osc('square', base * 0.5);
      const bp = b.filter('bandpass', base * 3, 1.5);
      o.connect(bp);
      o2.connect(b.gain(0.4)).connect(bp);
      bp.connect(out);
      const gear = b.noise('white');
      const gbp = b.filter('bandpass', 2400, 2);
      gear
        .connect(gbp)
        .connect(b.lfoGain(base / 9, 0.06, 0.05, 'square'))
        .connect(out);
      b.params.rate = o.frequency;
      b.params.rate2 = o2.frequency;
      b.params.tone = bp.frequency;
    },
    place,
  );
}

/** Stepper rod drive: a rapid ratchet over a servo whine. */
export function rodDriveBed() {
  return new Bed('sfx', (_ctx, out, b) => {
    const whine = b.osc('triangle', 620);
    whine
      .connect(b.filter('bandpass', 1200, 2))
      .connect(b.gain(0.25))
      .connect(out);
    const tick = b.noise('white');
    tick
      .connect(b.filter('bandpass', 3500, 3))
      .connect(b.lfoGain(14, 0.25, 0.25, 'square'))
      .connect(out);
    b.params.rate = whine.frequency;
  });
}

/** Steel wheels on floor plates: the transfer cart being pushed. */
export function cartBed() {
  return new Bed('sfx', (_ctx, out, b) => {
    const n = b.noise('brown');
    n.connect(b.filter('lowpass', 260)).connect(b.gain(1.4)).connect(out);
    const rattle = b.noise('white');
    rattle
      .connect(b.filter('bandpass', 1800, 4))
      .connect(b.lfoGain(7.5, 0.04, 0.04, 'square'))
      .connect(out);
  });
}

/** Hydraulics: refuelling machine arm and gripper. */
export function hydraulicBed() {
  return new Bed('sfx', (_ctx, out, b) => {
    const n = b.noise('pink');
    n.connect(b.filter('bandpass', 900, 1.2))
      .connect(b.gain(0.4))
      .connect(out);
    const pump = b.osc('sawtooth', 110);
    pump
      .connect(b.filter('lowpass', 400))
      .connect(b.lfoGain(18, 0.15, 0.1))
      .connect(out);
  });
}

/**
 * The plant alarm: a slow hi-lo two-tone (≈ 0.55 s per tone) through a horn-like
 * band-pass. Harsh on purpose; it stops when the alarm is acknowledged.
 */
export function klaxonBed() {
  return new Bed('sfx', (_ctx, out, b) => {
    const o = b.osc('square', 660);
    const lfo = b.osc('square', 0.9);
    lfo.connect(b.gain(110)).connect(o.frequency);
    const bp = b.filter('bandpass', 1100, 1.1);
    const lp = b.filter('lowpass', 2600);
    o.connect(bp).connect(lp).connect(out);
    const o2 = b.osc('square', 1320);
    lfo.connect(b.gain(220)).connect(o2.frequency);
    o2.connect(b.filter('bandpass', 2200, 2))
      .connect(b.gain(0.25))
      .connect(out);
  });
}

/** A pressurised leak: water jetting out of a hole and splattering on the floor. */
export function sprayBed() {
  return new Bed('sfx', (_ctx, out, b) => {
    const jet = b.noise('white');
    jet
      .connect(b.filter('bandpass', 2600, 0.7))
      .connect(b.lfoGain(9, 0.7, 0.3))
      .connect(out);
    const splat = b.noise('pink');
    splat
      .connect(b.filter('lowpass', 900))
      .connect(b.lfoGain(3.3, 0.6, 0.4))
      .connect(b.gain(0.8))
      .connect(out);
  });
}

/** Arc welding: a crackling, buzzing hiss. */
export function weldBed() {
  return new Bed('sfx', (_ctx, out, b) => {
    const hiss = b.noise('white');
    hiss
      .connect(b.filter('highpass', 3000))
      .connect(b.lfoGain(23, 0.5, 0.5, 'square'))
      .connect(out);
    const buzz = b.osc('sawtooth', 100);
    buzz
      .connect(b.filter('bandpass', 300, 3))
      .connect(b.gain(0.4))
      .connect(out);
    const crackle = b.noise('white');
    crackle
      .connect(b.filter('bandpass', 6000, 4))
      .connect(b.lfoGain(41, 0.4, 0.4, 'square'))
      .connect(out);
  });
}

/** Ring shuttle: an electric drive spooling up. */
export function shuttleRide() {
  tone({
    freq: 90,
    to: 900,
    type: 'sawtooth',
    gain: 0.05,
    attack: 0.4,
    hold: 0.6,
    decay: 0.6,
    lowpass: 1600,
  });
  tone({ freq: 45, to: 90, type: 'sine', gain: 0.14, attack: 0.3, hold: 0.7, decay: 0.6 });
  noise({ color: 'pink', freq: 400, to: 2400, q: 0.5, gain: 0.08, attack: 0.5, hold: 0.4, decay: 0.7 });
}
