import { exitMode, rideShuttle } from '../game/modes';
import { CAVITY_BANDWIDTH_KHZ, CRYO_TRIP_K, MAX_FIELD, RECIPES, STOCK_LABEL, beamPower } from '../sim';
import { useHud } from '../state/hud';
import { useMode } from '../state/mode';
import { NODES, routeTo } from '../world/facility';
import { fmt } from './nav';

const pad2 = (n: number) => String(n).padStart(2, '0');

export function Keys({ items }: { items: [string, string][] }) {
  return (
    <div className="mp__keys">
      {items.map(([k, label]) => (
        <span key={k + label}>
          <kbd>{k}</kbd>
          {label}
        </span>
      ))}
    </div>
  );
}

export function Head({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mp__head">
      <span className="mp__eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
      <button className="mp__close" onClick={exitMode}>
        ESC
      </button>
    </div>
  );
}

/** Resonance curve for one cavity: field vs detune, with the cavity's current point. */
function Resonance({ detune }: { detune: number }) {
  const W = 300;
  const H = 90;
  const span = 60;
  const xOf = (d: number) => W / 2 + (d / span) * (W / 2);
  const yOf = (f: number) => H - 8 - (f / MAX_FIELD) * (H - 18);
  const pts = Array.from({ length: 61 }, (_, i) => {
    const d = -span + (i * 2 * span) / 60;
    return `${xOf(d).toFixed(1)},${yOf(MAX_FIELD / (1 + (d / CAVITY_BANDWIDTH_KHZ) ** 2)).toFixed(1)}`;
  }).join(' ');
  const d = Math.max(-span, Math.min(span, detune));
  const f = MAX_FIELD / (1 + (detune / CAVITY_BANDWIDTH_KHZ) ** 2);
  return (
    <svg className="mp__curve" viewBox={`0 0 ${W} ${H}`}>
      <line x1={W / 2} y1={4} x2={W / 2} y2={H - 6} stroke="rgba(109,255,182,0.45)" strokeDasharray="3 3" />
      <polyline points={pts} fill="none" stroke="#5fe3ff" strokeWidth="2" />
      <circle cx={xOf(d)} cy={yOf(f)} r="5" fill={Math.abs(detune) < 1 ? '#6dffb6' : '#ffb35c'} />
    </svg>
  );
}

export function RfPanel({ cavity }: { cavity: number }) {
  const accel = useHud((s) => s.sim?.accel);
  if (!accel) return null;
  const c = accel.cavities[cavity]!;
  return (
    <div className="mp">
      <Head eyebrow="RF console · sector 1" title={`Cavity ${pad2(cavity + 1)} · 1.3 GHz`} />
      <div className="mp__readouts">
        <span>
          <b>{accel.energy.toFixed(2)}</b> GeV
        </span>
        <span>
          <b>{accel.current.toFixed(2)}</b> mA
        </span>
        <span className={accel.loss > 0.004 ? 'up' : ''}>
          loss <b>{(accel.loss * 100).toFixed(2)}</b>%
        </span>
        <span>
          <b>{accel.cryo.toFixed(2)}</b> K
        </span>
      </div>
      <div className="mp__rf">
        <Resonance detune={c.detune} />
        <div className="mp__rows">
          <div>
            <span>Detune</span>
            <b className={Math.abs(c.detune) < 1 ? 'fresh' : ''}>
              {c.detune > 0 ? '+' : ''}
              {c.detune.toFixed(1)} kHz
            </b>
          </div>
          <div>
            <span>Field</span>
            <span className="mp__meter is-progress">
              <i style={{ width: `${(c.field / MAX_FIELD) * 100}%` }} />
            </span>
            <b>
              {c.field.toFixed(1)} / {MAX_FIELD} MV/m
            </b>
          </div>
        </div>
      </div>
      <div className="mp__rods">
        {accel.cavities.map((cv, i) => (
          <button
            key={i}
            className={`rodcol${i === cavity ? ' is-on' : ''}`}
            onClick={() => useMode.setState({ mode: { kind: 'rf', cavity: i } })}
          >
            <span className="rodcol__bar is-field">
              <i style={{ height: `${(cv.field / MAX_FIELD) * 100}%` }} />
            </span>
            <b>{pad2(i + 1)}</b>
            <small className={cv.field < MAX_FIELD * 0.9 ? 'hot' : ''}>{cv.field.toFixed(0)}</small>
          </button>
        ))}
      </div>
      <Keys
        items={[
          ['← →', 'cavity'],
          ['W / S', 'hold: sweep frequency'],
          ['Shift', 'fine'],
          ['Esc', 'exit'],
        ]}
      />
    </div>
  );
}

export function ProductionPanel({ index }: { index: number }) {
  const accel = useHud((s) => s.sim?.accel);
  const net = useHud((s) => s.sim?.netOutput ?? 0);
  if (!accel) return null;
  const power = beamPower(accel);
  const sel = RECIPES[index]!;
  const products = RECIPES.map((r) => r.stock).filter((k, i, a) => a.indexOf(k) === i && accel.stock[k] > 0);
  const state = accel.tripped ? 'TRIPPED' : accel.beamOn ? 'BEAM ON' : 'BEAM OFF';
  return (
    <div className="mp mp--wide">
      <Head eyebrow={`Ring · ${state}`} title="Production runs" />
      <div className="mp__readouts">
        <span>
          <b>{accel.energy.toFixed(2)}</b> GeV
        </span>
        <span>
          <b>{power.toFixed(2)}</b> MW beam
        </span>
        <span>
          draw <b>{fmt(accel.powerDraw)}</b> MWe
        </span>
        <span>
          plant net <b>{fmt(net)}</b> MWe
        </span>
        <span className={accel.cryo > CRYO_TRIP_K - 0.8 ? 'up' : ''}>
          <b>{accel.cryo.toFixed(2)}</b> K
        </span>
        <span>
          clearance <b>L{accel.clearance}</b>
        </span>
      </div>
      <ul className="recipes">
        {RECIPES.map((r, i) => {
          const locked = r.tier > accel.clearance;
          const running = accel.recipe === r.id;
          const lowE = accel.energy < r.minEnergy;
          const feedOk = r.inputs.every((inp) => accel.stock[inp.stock] >= inp.perUnit);
          return (
            <li
              key={r.id}
              className={`${i === index ? 'is-sel' : ''}${locked ? ' is-locked' : ''}${running ? ' is-running' : ''}`}
              onClick={() => useMode.setState({ mode: { kind: 'production', index: i } })}
            >
              <b>{r.name}</b>
              <span>
                {locked
                  ? `Clearance L${r.tier}`
                  : running
                    ? `Running · ${(r.perMWh * power).toFixed(1)} ${r.unit}/h`
                    : lowE
                      ? `Needs ${r.minEnergy} GeV`
                      : !feedOk
                        ? 'No feedstock'
                        : r.station}
              </span>
              <em>{Math.floor(accel.stock[r.stock])}</em>
            </li>
          );
        })}
      </ul>
      <p className="mp__hint">
        <b>{sel.name}.</b> {sel.blurb}{' '}
        {sel.inputs.length
          ? `Uses ${sel.inputs.map((i) => `${i.perUnit} ${STOCK_LABEL[i.stock].toLowerCase()} (${fmt(accel.stock[i.stock], i.stock === 'spent-fuel' ? 1 : 0)} in stock)`).join(' + ')} per ${sel.unit === 'kg' || sel.unit === 'g' ? sel.unit : 'unit'}.`
          : 'No feedstock needed.'}
      </p>
      {products.length > 0 && (
        <div className="mp__stock">
          {products.map((k) => (
            <span key={k}>
              {STOCK_LABEL[k]} <b>{Math.floor(accel.stock[k])}</b>
            </span>
          ))}
        </div>
      )}
      <Keys
        items={[
          ['W / S', 'select'],
          ['E', accel.recipe === sel.id ? 'stop run' : 'start run'],
          ['B', accel.beamOn ? 'beam off' : 'beam on'],
          ['Esc', 'exit'],
        ]}
      />
    </div>
  );
}

export function ShuttlePanel({ index }: { index: number }) {
  const pos = useHud((s) => s.graphPos);
  const sectors = NODES.filter((n) => n.sector).sort((a, b) => a.sector! - b.sector!);
  return (
    <div className="mp">
      <Head eyebrow="Ring shuttle · level B4" title="Choose a sector" />
      <ul className="recipes">
        {sectors.map((n, i) => {
          const here = 'room' in pos && pos.room === n.id;
          const d = routeTo(pos, n.id).dist;
          return (
            <li
              key={n.id}
              className={`${i === index ? 'is-sel' : ''}${here ? ' is-locked' : ''}`}
              onClick={() =>
                i === index ? rideShuttle(i + 1) : useMode.setState({ mode: { kind: 'shuttle', index: i } })
              }
            >
              <b style={{ color: n.accent }}>{n.name}</b>
              <span>{here ? 'You are here' : `${(d / 1000).toFixed(2)} km · ${Math.round(d / 14)} s`}</span>
              <em>S{n.sector}</em>
            </li>
          );
        })}
      </ul>
      <Keys
        items={[
          ['W / S', 'select'],
          ['E', 'ride'],
          ['Esc', 'exit'],
        ]}
      />
    </div>
  );
}

/** Top-right vitals while on the ring: beam state, energy, current, RF field and cryo. */
export function RingVitals() {
  const accel = useHud((s) => s.sim?.accel);
  const net = useHud((s) => s.sim?.netOutput ?? 0);
  if (!accel) return null;
  const minField = Math.min(...accel.cavities.map((c) => c.field));
  const status = accel.tripped ? 'BEAM TRIPPED' : accel.beamOn ? 'BEAM CIRCULATING' : 'BEAM OFF';
  return (
    <section className="hud-tr">
      <div className={`vitals__status ${accel.tripped ? 'is-alarm' : accel.beamOn ? 'is-ring' : 'is-down'}`}>
        RING · {status}
      </div>
      <div className="vitals__big">
        {accel.energy.toFixed(2)}
        <small className="is-ring">GeV</small>
      </div>
      <div className="vitals__sub">
        {beamPower(accel).toFixed(2)} MW beam · plant net {fmt(net)} MWe
      </div>
      <SegBar
        label="Current"
        value={accel.current.toFixed(2)}
        unit="mA"
        fill={accel.current / 2.8}
        tone="#a58cff"
      />
      <SegBar
        label="RF field"
        value={minField.toFixed(0)}
        unit="MV/m"
        fill={minField / MAX_FIELD}
        tone="#ff9a4a"
        warn={minField < MAX_FIELD * 0.9}
      />
      <SegBar
        label="Cryo"
        value={accel.cryo.toFixed(2)}
        unit="K"
        fill={1 - (accel.cryo - 1.8) / 3}
        tone="#5fe3ff"
        warn={accel.cryo > CRYO_TRIP_K - 0.8}
      />
    </section>
  );
}

export function SegBar({
  label,
  value,
  unit,
  fill,
  tone,
  warn,
}: {
  label: string;
  value: string;
  unit: string;
  fill: number;
  tone: string;
  warn?: boolean;
}) {
  const segs = 14;
  const on = Math.round(Math.max(0, Math.min(1, fill)) * segs);
  return (
    <div className={`vbar${warn ? ' is-warn' : ''}`} style={{ ['--tone' as string]: tone }}>
      <div className="vbar__label">
        <span>{label}</span>
        <b>
          {value}
          <small>{unit}</small>
        </b>
      </div>
      <div className="vbar__segs">
        {Array.from({ length: segs }, (_, i) => (
          <i key={i} className={i < on ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}
