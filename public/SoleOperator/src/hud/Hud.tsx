import type { GameSpeed } from '../core/clock';
import { fireAction, type Action } from '../game/input';
import { setSpeed } from '../game/session';
import { useShallow } from 'zustand/react/shallow';
import { useHud } from '../state/hud';
import { useLogistics } from '../state/logistics';
import { useMode } from '../state/mode';
import { routeTo, type GraphPosition } from '../world/facility';
import { Compass } from './Compass';
import { Minimap } from './Minimap';
import { ModePanel } from './ModePanel';
import { fmt, formatClock, placeName } from './nav';
import './hud.css';

const ALARM_TEXT: Record<string, string> = {
  'core-temp-high': 'Core temperature high',
  'pressure-high': 'Primary pressure high',
  'power-high': 'Thermal power above 110%',
  'turbine-vibration': 'Turbine B vibration rising',
};

const NO_ALARMS: string[] = [];

function Warn() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 6v4M8 11.6v.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function liveDetail(detail: string | undefined, target: string | undefined, pos: GraphPosition) {
  if (!target || ('room' in pos && pos.room === target)) return detail;
  const r = routeTo(pos, target);
  const via = r.via && 'corridor' in r.via ? ` · through corridor ${r.via.corridor}` : '';
  return `${fmt(r.dist)} m${via}`;
}

function ObjectiveTracker() {
  const obj = useHud((s) => s.objective);
  const pos = useHud((s) => s.graphPos);
  const alarms = useHud(useShallow((s) => s.sim?.alarms ?? NO_ALARMS));
  const toasts = useHud((s) => s.toasts);
  return (
    <section className="hud-tl">
      {obj ? (
        <div className="objective">
          <div className="objective__eyebrow">
            {obj.kind === 'main' ? 'Main objective' : 'Side objective'}
          </div>
          <h2 className="objective__title">{obj.title}</h2>
          <ol className="objective__steps">
            {obj.steps.map((s, i) => (
              <li key={i} className={`step is-${s.state}`}>
                <i className="step__mark" />
                <div>
                  <div className="step__text">{s.text}</div>
                  {s.state === 'active' && s.detail && (
                    <div className="step__detail">{liveDetail(s.detail, obj.target?.room, pos)}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="objective objective--idle">
          <div className="objective__eyebrow">No active objective</div>
          <h2 className="objective__title">Keep the plant steady</h2>
        </div>
      )}
      {alarms.map((a) => (
        <div key={a} className="alarm-banner">
          <Warn />
          {ALARM_TEXT[a] ?? a}
        </div>
      ))}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast is-${t.level}`}>
            <b>{t.text}</b>
            {t.detail && <span>{t.detail}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Bar({
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

function CoreVitals() {
  const sim = useHud((s) => s.sim);
  if (!sim) return null;
  const tone = sim.stability === 'SHUTDOWN' ? 'is-down' : sim.alarms.length ? 'is-alarm' : '';
  return (
    <section className="hud-tr">
      <div className={`vitals__status ${tone}`}>
        CORE · {sim.criticality} · {sim.stability}
      </div>
      <div className="vitals__big">
        {fmt(sim.output)}
        <small>MWe</small>
      </div>
      <div className="vitals__sub">
        {fmt(sim.thermalPower)} MWt · k-eff {sim.keff.toFixed(4)}
      </div>
      <Bar
        label="Temp"
        value={fmt(sim.coreTemp)}
        unit="°C"
        fill={(sim.coreTemp - 280) / 60}
        tone="#ff9a4a"
        warn={sim.alarms.includes('core-temp-high')}
      />
      <Bar
        label="Pressure"
        value={sim.pressure.toFixed(1)}
        unit="MPa"
        fill={(sim.pressure - 14) / 3}
        tone="#5fe3ff"
        warn={sim.alarms.includes('pressure-high')}
      />
      <Bar label="Rods in" value={fmt(sim.rodsIn * 100)} unit="%" fill={sim.rodsIn} tone="#f2b81f" />
    </section>
  );
}

function Portrait() {
  return (
    <svg viewBox="0 0 100 100" className="portrait__svg" aria-hidden="true">
      <defs>
        <clipPath id="hex">
          <polygon points="50,3 93,27 93,73 50,97 7,73 7,27" />
        </clipPath>
        <linearGradient id="pbg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d4d5e" />
          <stop offset="1" stopColor="#0c1d26" />
        </linearGradient>
      </defs>
      <g clipPath="url(#hex)">
        <rect width="100" height="100" fill="url(#pbg)" />
        <path d="M18 100 Q22 70 50 68 Q78 70 82 100Z" fill="#ff8a2a" />
        <rect x="30" y="82" width="40" height="5" fill="#e8eef2" opacity=".85" />
        <circle cx="50" cy="50" r="17" fill="#e0b48c" />
        <path d="M30 44 Q31 24 50 24 Q69 24 70 44Z" fill="#f2b81f" />
        <rect x="26" y="42" width="48" height="5" rx="2" fill="#f2b81f" />
        <circle cx="44" cy="53" r="1.8" fill="#2b2018" />
        <circle cx="56" cy="53" r="1.8" fill="#2b2018" />
        <path d="M45 60 Q50 63 55 60" stroke="#8d5a3b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </g>
      <polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill="none" stroke="#6dffb6" strokeWidth="3" />
    </svg>
  );
}

function OperatorCard() {
  const p = useHud((s) => s.player);
  return (
    <section className="hud-bl">
      <div className="portrait">
        <Portrait />
        <span className="portrait__level">1</span>
      </div>
      <div className="operator">
        <div className="operator__name">
          THE OPERATOR <small>Sole operator · Unit 1</small>
        </div>
        <div className="meter">
          <span>Stamina</span>
          <i style={{ ['--v' as string]: p.stamina, ['--c' as string]: '#6dffb6' }} />
        </div>
        <div className="meter">
          <span>Focus</span>
          <i style={{ ['--v' as string]: p.focus, ['--c' as string]: '#5fe3ff' }} />
        </div>
        <div className="operator__dose">☢ Dose {p.dose.toFixed(2)} / 20 mSv</div>
      </div>
    </section>
  );
}

const HOTKEYS: { action: Action; key: string; label: string; icon: string }[] = [
  {
    action: 'inspect',
    key: 'Q',
    label: 'Inspect',
    icon: 'M7 7m-4.5 0a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0M10.3 10.3 14 14',
  },
  { action: 'refuel', key: 'R', label: 'Refuel', icon: 'M5 2h6v12H5zM5 6h6M5 10h6' },
  { action: 'rods', key: 'F', label: 'Rods', icon: 'M2 3h12M4 3v8M8 3v10M12 3v6' },
  {
    action: 'map',
    key: 'M',
    label: 'Map',
    icon: 'M1.5 3.5 5.5 2l5 1.5 4-1.5v10.5l-4 1.5-5-1.5-4 1.5zM5.5 2v10.5M10.5 3.5V14',
  },
];

function HotkeyBar() {
  const refuelReady = useLogistics(
    (s) => !s.cart.attached && s.cart.room === 'control-room' && s.cart.bay === 'core-bay',
  );
  return (
    <nav className="hud-bc">
      {HOTKEYS.map((h) => (
        <button
          key={h.action}
          className={`hotkey${h.action === 'refuel' && refuelReady ? ' is-active' : ''}`}
          onClick={() => fireAction(h.action)}
        >
          <kbd>{h.key}</kbd>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d={h.icon}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          <span>{h.label}</span>
        </button>
      ))}
    </nav>
  );
}

const SPEEDS: { s: GameSpeed; label: string }[] = [
  { s: 0, label: 'II' },
  { s: 1, label: '1×' },
  { s: 2, label: '2×' },
  { s: 3, label: '3×' },
];

function ClockAndSpeed() {
  const time = useHud((s) => s.sim?.time ?? 0);
  const speed = useHud((s) => s.speed);
  const pos = useHud((s) => s.graphPos);
  const c = formatClock(time);
  return (
    <section className="hud-br">
      <div className="clock">
        <div className="clock__time">{c.hhmm}</div>
        <div className="clock__day">
          DAY {c.day} · SHIFT {c.shift}
        </div>
        <div className="clock__place">{placeName(pos)} · B2</div>
        <div className="speed" role="group" aria-label="Game speed">
          {SPEEDS.map(({ s, label }) => (
            <button
              key={s}
              className={speed === s ? 'is-on' : ''}
              onClick={() => setSpeed(s)}
              title={s === 0 ? 'Pause (P)' : `${s}× (${s})`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Minimap />
    </section>
  );
}

/** The in-game overlay. Each widget subscribes to just the store slice it shows. */
/** Hotkeys while walking; the machine's panel while controlling one. */
function BottomCentre() {
  const walking = useMode((s) => s.mode.kind === 'walk');
  return walking ? <HotkeyBar /> : <ModePanel />;
}

export default function Hud() {
  return (
    <div className="hud">
      <ObjectiveTracker />
      <Compass />
      <CoreVitals />
      <OperatorCard />
      <BottomCentre />
      <ClockAndSpeed />
    </div>
  );
}
