import { WELD_SECONDS } from '../game/tanks';
import { TANK_CAPACITY, VALVE_CLOSED } from '../sim';
import { useHud } from '../state/hud';
import { useMode } from '../state/mode';

function Meter({ v, c }: { v: number; c: string }) {
  return (
    <span className="mp__meter">
      <i
        style={{
          width: `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`,
          background: c,
          boxShadow: `0 0 6px ${c}`,
        }}
      />
    </span>
  );
}
import { Head, Keys, SegBar } from './AccelPanels';
import { fmt } from './nav';

const name = (i: number) => `T-${i + 1}`;

/** Tank service: level with the leak height marked, valve, shell condition, weld progress. */
export function TankPanel({ tank }: { tank: number }) {
  const water = useHud((s) => s.sim?.water);
  const sensors = useHud((s) => (s.sim?.econ.upgrades['leak-sensors'] ?? 0) > 0);
  const weld = useMode((s) => s.weld);
  if (!water) return null;
  const t = water.tanks[tank];
  if (!t) return null;
  const frac = t.level / TANK_CAPACITY;
  const closed = t.valve <= VALVE_CLOSED;
  const status = t.leak > 0 ? (closed ? 'LEAKING · ISOLATED' : 'LEAKING') : closed ? 'ISOLATED' : 'ONLINE';
  const next =
    t.leak > 0
      ? closed
        ? 'Hold E to weld a patch over the hole.'
        : 'Hold S to close the outlet valve, then weld.'
      : closed
        ? 'Hold W to open the valve and bring the tank back online.'
        : 'Tank sound. ←/→ to check the others.';
  return (
    <div className="mp">
      <Head eyebrow={`Tank service · ${water.tanks.length} tanks`} title={`Tank ${name(tank)} · ${status}`} />
      <div className="mp__readouts">
        <span>
          reserve <b>{Math.round(water.inventory * 100)}</b>%
        </span>
        <span>
          demand <b>{fmt(water.demand)}</b> m³/h
        </span>
        <span>
          treatment <b>{fmt(water.treatment)}</b> m³/h
        </span>
        <span className={water.supply < 1 ? 'up' : ''}>
          supply <b>{Math.round(water.supply * 100)}</b>%
        </span>
      </div>
      <div className="mp__tank">
        <div className="tankgauge" aria-label="Tank level">
          <i className="tankgauge__fill" style={{ height: `${frac * 100}%` }} />
          {t.leak > 0 && <i className="tankgauge__hole" style={{ bottom: `${t.leakHeight * 100}%` }} />}
          <span>{Math.round(frac * 100)}%</span>
        </div>
        <div className="mp__rows">
          <div>
            <span>Level</span>
            <b>
              {fmt(t.level)} / {fmt(TANK_CAPACITY)} m³
            </b>
          </div>
          <div>
            <span>Valve</span>
            <Meter v={t.valve} c="#f07a2a" />
            <b>{Math.round(t.valve * 100)}%</b>
          </div>
          <div>
            <span>Shell</span>
            <Meter v={t.integrity} c={t.integrity < 0.55 ? '#ff5d5d' : '#6dffb6'} />
            <b>{Math.round(t.integrity * 100)}%</b>
          </div>
          <div>
            <span>Leak</span>
            <b className={t.leak > 0 ? 'spent' : ''}>
              {t.leak > 0 ? `${t.leak.toFixed(0)} m³/h at ${Math.round(t.leakHeight * 100)}% height` : 'none'}
            </b>
          </div>
          <div>
            <span>Weld</span>
            <Meter v={weld} c="#ffc070" />
            <b>{weld > 0 ? `${Math.round(weld * 100)}%` : `${WELD_SECONDS} s hold`}</b>
          </div>
        </div>
      </div>
      <div className="mp__hint">
        {next}
        {!sensors && ' No leak sensors: check the sight glasses and the floor.'}
      </div>
      <Keys
        items={[
          ['←/→', 'tank'],
          ['W/S', 'open / close valve'],
          ['hold E', 'weld patch'],
          ['ESC', 'leave'],
        ]}
      />
    </div>
  );
}

/** Top-right vitals in the Water Containers hall. */
export function WaterVitals() {
  const water = useHud((s) => s.sim?.water);
  const low = useHud((s) => s.sim?.alarms.includes('water-low') ?? false);
  if (!water) return null;
  const leaking = water.tanks.filter((t) => t.leak > 0).length;
  const status = low ? 'RESERVE LOW' : leaking ? 'LEVEL FALLING' : 'RESERVE NORMAL';
  return (
    <section className="hud-tr">
      <div className={`vitals__status ${low ? 'is-alarm' : leaking ? 'is-warn' : ''}`}>WATER · {status}</div>
      <div className="vitals__big">
        {Math.round(water.inventory * 100)}
        <small className="is-water">%</small>
      </div>
      <div className="vitals__sub">
        {fmt(water.tanks.reduce((s, t) => s + t.level, 0))} m³ in {water.tanks.length} tanks
      </div>
      {water.tanks.map((t, i) => (
        <SegBar
          key={i}
          label={name(i)}
          value={String(Math.round((t.level / TANK_CAPACITY) * 100))}
          unit={t.valve <= VALVE_CLOSED ? '% off' : '%'}
          fill={t.level / TANK_CAPACITY}
          tone={t.valve <= VALVE_CLOSED ? '#64768a' : '#4fb6ff'}
          warn={t.leak > 0}
        />
      ))}
    </section>
  );
}
