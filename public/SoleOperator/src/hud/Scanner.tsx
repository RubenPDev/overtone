import { useLogistics } from '../state/logistics';
import { useHud, type HudSim } from '../state/hud';
import { useWorld } from '../state/world';
import { MAX_FIELD, RECIPE_BY_ID } from '../sim';
import type { Interactable } from '../world/types';
import { fmt } from './nav';

export interface Reading {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad';
}

type Pool = ReturnType<typeof useLogistics.getState>['pool'];

/**
 * What the handheld scanner shows: readings for the equipment in range, else
 * the room's headline numbers. Rooms with their own equipment add a case here.
 */
export function scanReadings(
  room: string,
  near: Interactable | null,
  sim: HudSim,
  pool: Pool,
): { title: string; readings: Reading[] } {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  if (room === 'control-room') {
    if (near?.action.type === 'corePort' || near?.id === 'core-panel') {
      return {
        title: 'Core · fuel burn-up',
        readings: sim.cells.map((c, i) => ({
          label: `Cell ${String(i + 1).padStart(2, '0')}`,
          value: c.loaded ? pct(c.burnup) : 'empty',
          tone: !c.loaded ? 'warn' : c.burnup > 0.9 ? 'bad' : c.burnup > 0.75 ? 'warn' : 'ok',
        })),
      };
    }
    return {
      title: 'Primary circuit',
      readings: [
        { label: 'k-eff', value: sim.keff.toFixed(4) },
        { label: 'Reactivity', value: `${fmt(sim.reactivity)} pcm` },
        { label: 'Core temp', value: `${fmt(sim.coreTemp)} °C`, tone: sim.coreTemp > 325 ? 'bad' : 'ok' },
        {
          label: 'Pressure',
          value: `${sim.pressure.toFixed(2)} MPa`,
          tone: sim.pressure > 16.2 ? 'bad' : 'ok',
        },
        { label: 'Coolant flow', value: pct(sim.coolantFlow) },
        { label: 'Rods in', value: pct(sim.rodsIn) },
      ],
    };
  }
  if (room === 'fuel-storage') {
    const fresh = pool.filter((a) => a && a.burnup < 0.5).length;
    const spent = pool.filter((a) => a && a.burnup >= 0.5).length;
    return {
      title: 'Spent fuel pool',
      readings: [
        { label: 'Fresh assemblies', value: String(fresh), tone: fresh ? 'ok' : 'warn' },
        { label: 'Spent assemblies', value: String(spent) },
        { label: 'Free rack slots', value: String(pool.length - fresh - spent) },
        { label: 'Pool temp', value: '31 °C', tone: 'ok' },
        { label: 'Dose rate at rim', value: '0.02 mSv/h', tone: 'ok' },
      ],
    };
  }
  if (room === 'water-containers') {
    const w = sim.water;
    const i = near?.action.type === 'tankStation' ? near.action.tank : -1;
    if (i >= 0 && w.tanks[i]) {
      const t = w.tanks[i]!;
      return {
        title: `Tank T-${i + 1}`,
        readings: [
          { label: 'Level', value: `${Math.round((t.level / 2000) * 100)}%` },
          { label: 'Valve', value: `${Math.round(t.valve * 100)}%`, tone: t.valve > 0.02 ? 'ok' : 'warn' },
          {
            label: 'Shell wall',
            value: pct(t.integrity),
            tone: t.integrity < 0.55 ? 'bad' : t.integrity < 0.7 ? 'warn' : 'ok',
          },
          {
            label: 'Acoustic leak',
            value: t.leak > 0 ? `${t.leak.toFixed(0)} m³/h · ${Math.round(t.leakHeight * 100)}% up` : 'none',
            tone: t.leak > 0 ? 'bad' : 'ok',
          },
        ],
      };
    }
    return {
      title: 'Tank farm',
      readings: [
        ...w.tanks.map((t, k) => ({
          label: `T-${k + 1}`,
          value: `${Math.round((t.level / 2000) * 100)}% · shell ${pct(t.integrity)}${t.leak > 0 ? ' · LEAK' : ''}`,
          tone: (t.leak > 0 ? 'bad' : t.integrity < 0.55 ? 'warn' : 'ok') as Reading['tone'],
        })),
        { label: 'Supply', value: pct(w.supply), tone: w.supply < 1 ? 'bad' : 'ok' },
        { label: 'Conductivity', value: '0.06 µS/cm', tone: 'ok' },
      ],
    };
  }
  if (room === 'turbine-hall') {
    const t = sim.turbine;
    const tone = (v: number): Reading['tone'] => (v > 7.1 ? 'bad' : v > 2.8 ? 'warn' : 'ok');
    return {
      title: 'Turbine B',
      readings: [
        { label: 'Speed', value: `${fmt(t.rpm)} rpm`, tone: t.tripped ? 'bad' : 'ok' },
        ...t.bearings.map((b, i) => ({
          label: `Bearing B${i + 1}`,
          value: `${b.toFixed(1)} mm/s`,
          tone: tone(b),
        })),
        { label: 'Vacuum', value: `${t.vacuum.toFixed(3)} bar`, tone: t.vacuum > 0.08 ? 'warn' : 'ok' },
        { label: 'Lube oil', value: `${t.lubeOilTemp.toFixed(0)} °C`, tone: 'ok' },
        {
          label: 'Feed pump B',
          value: `${t.feedPump.temp.toFixed(0)} °C · grease ${pct(t.feedPump.lube)}`,
          tone: t.feedPump.tripped ? 'bad' : t.feedPump.temp > 80 ? 'warn' : 'ok',
        },
      ],
    };
  }
  if (room.startsWith('ring-')) {
    const a = sim.accel;
    const r = a.recipe ? RECIPE_BY_ID.get(a.recipe) : null;
    return {
      title: 'Accelerator',
      readings: [
        ...a.cavities.map((c, i) => ({
          label: `Cavity ${String(i + 1).padStart(2, '0')}`,
          value: `${c.field.toFixed(1)} MV/m · ${c.detune >= 0 ? '+' : ''}${c.detune.toFixed(1)} kHz`,
          tone: (c.field < MAX_FIELD * 0.9
            ? 'bad'
            : c.field < MAX_FIELD * 0.97
              ? 'warn'
              : 'ok') as Reading['tone'],
        })),
        { label: 'Cryo', value: `${a.cryo.toFixed(2)} K`, tone: a.cryo > 3.5 ? 'bad' : 'ok' },
        { label: 'Beam loss', value: `${(a.loss * 100).toFixed(2)}%`, tone: a.loss > 0.012 ? 'warn' : 'ok' },
        { label: 'On target', value: r ? `${r.name} · ${pct(a.progress)}` : 'nothing' },
      ],
    };
  }
  return {
    title: 'Plant',
    readings: [
      { label: 'Net output', value: `${fmt(sim.netOutput)} MWe` },
      { label: 'Grid price', value: `${sim.econ.price.toFixed(2)} CR/MWh` },
      { label: 'Turbine B vibration', value: `${Math.max(...sim.turbine.bearings).toFixed(1)} mm/s` },
    ],
  };
}

/** Handheld scanner readout (Q), under the vitals. */
export function ScannerPanel() {
  const on = useHud((s) => s.scanner);
  const sim = useHud((s) => s.sim);
  const space = useWorld((s) => s.space);
  const near = useWorld((s) => s.near);
  const pool = useLogistics((s) => s.pool);
  if (!on || !sim) return null;
  const room = space.kind === 'room' ? space.room : '';
  const { title, readings } = scanReadings(room, near, sim, pool);
  return (
    <section className="hud-scan" aria-label="Scanner">
      <div className="scan__head">
        <span>Scanner</span>
        <b>{title}</b>
      </div>
      <dl className="scan__list">
        {readings.map((r) => (
          <div key={r.label} className={r.tone ? `is-${r.tone}` : ''}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="scan__foot">Q to put away</div>
    </section>
  );
}
