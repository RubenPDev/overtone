import { useRef } from 'react';
import { exitMode } from '../game/modes';
import { useHud, type HudSim } from '../state/hud';
import { useMode } from '../state/mode';
import { fmt } from './nav';
import './rodhud.css';

/**
 * Rod control "focus mode": the hall falls into shadow, the holo core swells
 * over the operator desk, and this overlay frames it with live panels:
 * reactivity and period, thermal power trend, a ring selector laid out like
 * the core, the selected rod's depth, worth and axial flux, interlocks, the
 * drive lever and the keys.
 */

const pad2 = (n: number) => String(n).padStart(2, '0');
const TOTAL_ROD_WORTH = 14000;
const ROD_RATE = 100 / 300; // % per game second

/** Integral rod worth for an insertion (S-curve), pcm. */
const worth = (x: number) => (TOTAL_ROD_WORTH / 12) * (x - Math.sin(2 * Math.PI * x) / (2 * Math.PI));

function periodOf(trend: number) {
  const tau = 60 / trend; // game seconds
  // Slower than an hour either way reads as steady.
  return Math.abs(trend) < 1e-6 || Math.abs(tau) > 3600 ? Infinity : tau;
}

function Gauge({ rho }: { rho: number }) {
  const r = 74;
  const c = 90;
  const k = Math.max(-1, Math.min(1, rho / 500));
  const na = Math.PI + (0.5 + k / 2) * Math.PI;
  const ticks = Array.from({ length: 21 }, (_, i) => {
    const a = Math.PI + (i / 20) * Math.PI;
    const r1 = i % 5 ? r - 6 : r - 12;
    const col = i > 14 ? '#ffb35c' : i < 6 ? '#5fe3ff' : '#9fb0c2';
    return (
      <line
        key={i}
        x1={c + Math.cos(a) * r}
        y1={c + Math.sin(a) * r}
        x2={c + Math.cos(a) * r1}
        y2={c + Math.sin(a) * r1}
        stroke={col}
        strokeWidth={i % 5 ? 1 : 2}
      />
    );
  });
  return (
    <svg width="180" height="104" viewBox="0 0 180 104" aria-hidden="true">
      <path d="M16 90 A74 74 0 0 1 164 90" fill="none" stroke="rgba(95,227,255,.18)" strokeWidth="8" />
      <path
        d={`M90 16 A74 74 0 0 ${k >= 0 ? 1 : 0} ${c + Math.cos(na) * r} ${c + Math.sin(na) * r}`}
        fill="none"
        stroke={k >= 0 ? '#ffb35c' : '#5fe3ff'}
        strokeWidth="8"
      />
      {ticks}
      <line
        x1={c}
        y1={c}
        x2={c + Math.cos(na) * 64}
        y2={c + Math.sin(na) * 64}
        stroke="#fff"
        strokeWidth="2.5"
      />
      <circle cx={c} cy={c} r="5" fill="#fff" />
      <text x="10" y="103" fill="#64768a" fontFamily="Oxanium" fontSize="10">
        −500
      </text>
      <text x="146" y="103" fill="#64768a" fontFamily="Oxanium" fontSize="10">
        +500
      </text>
    </svg>
  );
}

function Spark({ data, set }: { data: number[]; set: number }) {
  const W = 260;
  const H = 70;
  if (data.length < 2) return <svg width={W} height={H} />;
  const lo = Math.min(set * 0.98, ...data);
  const hi = Math.max(set * 1.02, ...data);
  const y = (v: number) => H - 6 - ((v - lo) / (hi - lo || 1)) * (H - 12);
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${(i / (data.length - 1)) * (W - 6)} ${y(v)}`).join('');
  const last = data[data.length - 1]!;
  return (
    <svg width={W} height={H} aria-hidden="true">
      <line x1="0" x2={W} y1={y(set)} y2={y(set)} stroke="rgba(109,255,182,.5)" strokeDasharray="4 4" />
      <path d={d} fill="none" stroke="#5fe3ff" strokeWidth="2.5" />
      <circle cx={W - 6} cy={y(last)} r="4" fill="#5fe3ff" />
    </svg>
  );
}

function RingSelect({ sim, selected, bank }: { sim: HudSim; selected: number; bank: boolean }) {
  const cx = 120;
  const R = 86;
  const pick = (i: number) => useMode.setState({ mode: { kind: 'rods', selected: i, bank: false } });
  return (
    <svg width="240" height="240" viewBox="0 0 240 240" className="rh-ring">
      {sim.rods.map((ins, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * R;
        const y = cx + Math.sin(a) * R;
        const sel = bank || i === selected;
        const rr = sel ? 19 : 15;
        const cell = sim.cells[i];
        const hot = cell?.loaded && cell.burnup > 0.9;
        return (
          <g key={i} onClick={() => pick(i)} className="rh-node">
            <circle
              cx={x}
              cy={y}
              r={rr}
              fill={sel ? 'rgba(95,227,255,.25)' : 'rgba(8,20,28,.85)'}
              stroke={sel ? '#dffcff' : hot ? '#ffb35c' : 'rgba(95,227,255,.5)'}
              strokeWidth={sel ? 2.5 : 1.2}
            />
            <circle
              cx={x}
              cy={y}
              r={rr + 4}
              fill="none"
              stroke={sel ? '#5fe3ff' : '#f2b81f'}
              strokeWidth="2.5"
              strokeDasharray={`${ins * 2 * Math.PI * (rr + 4)} 999`}
              transform={`rotate(-90 ${x} ${y})`}
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fill={sel ? '#fff' : '#9fb0c2'}
              fontFamily="Oxanium"
              fontWeight="700"
              fontSize={sel ? 13 : 11}
            >
              {pad2(i + 1)}
            </text>
          </g>
        );
      })}
      <g
        className="rh-node"
        onClick={() => useMode.setState({ mode: { kind: 'rods', selected, bank: !bank } })}
      >
        <circle
          cx={cx}
          cy={cx}
          r="42"
          fill={bank ? 'rgba(95,227,255,.18)' : 'rgba(8,20,28,.6)'}
          stroke="rgba(95,227,255,.35)"
        />
        <text
          x={cx}
          y={cx - 4}
          textAnchor="middle"
          fill="#64768a"
          fontFamily="Oxanium"
          fontSize="10"
          letterSpacing="2"
        >
          BANK
        </text>
        <text
          x={cx}
          y={cx + 13}
          textAnchor="middle"
          fill={bank ? '#5fe3ff' : '#eef4fa'}
          fontFamily="Oxanium"
          fontWeight="700"
          fontSize="15"
        >
          {bank ? 'ON' : 'OFF'}
        </text>
      </g>
    </svg>
  );
}

function AxialFlux({ ins }: { ins: number }) {
  // Flux shape up the cell; above the rod tip it's suppressed.
  const tip = 1 - ins;
  const pts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const z = i / 40;
    const shade = 1 - 0.7 / (1 + Math.exp(-(z - tip) * 24));
    pts.push(`${Math.sin(z * Math.PI) * 150 * shade} ${120 - z * 120}`);
  }
  const ty = 120 - tip * 120;
  return (
    <svg width="176" height="128" viewBox="-6 -4 182 130" aria-hidden="true">
      <line x1="0" x2="0" y1="0" y2="120" stroke="rgba(200,220,235,.25)" />
      <line x1="0" y1={ty} x2="172" y2={ty} stroke="#5fe3ff" strokeDasharray="3 3" />
      <path
        d={`M0 120 L${pts.join(' L')} L0 0`}
        fill="rgba(255,138,58,.18)"
        stroke="#ff9a4a"
        strokeWidth="2"
      />
      <text x="104" y={Math.max(10, ty - 5)} fill="#5fe3ff" fontFamily="Oxanium" fontSize="10">
        ROD TIP
      </text>
    </svg>
  );
}

export function RodControlHud() {
  const sim = useHud((s) => s.sim);
  const toasts = useHud((s) => s.toasts);
  const mode = useMode((s) => s.mode);
  const hold = useMode((s) => s.hold);
  const hist = useRef<{ tick: number; data: number[] }>({ tick: -1, data: [] });
  if (!sim || mode.kind !== 'rods') return null;
  if (sim.tick !== hist.current.tick) {
    hist.current.tick = sim.tick;
    hist.current.data = [...hist.current.data.slice(-89), sim.thermalPower];
  }
  const { selected, bank } = mode;
  const ins = bank ? sim.rodsIn : (sim.rods[selected] ?? 0);
  const target = bank ? sim.rodTargets.reduce((a, b) => a + b, 0) / 12 : (sim.rodTargets[selected] ?? ins);
  const dir = target < ins - 1e-3 ? 'withdrawing' : target > ins + 1e-3 ? 'inserting' : 'holding';
  const cell = sim.cells[selected];
  const tau = periodOf(sim.powerTrend);
  const tauText = !Number.isFinite(tau)
    ? '∞'
    : `${tau < 0 ? '−' : ''}${fmt(Math.min(9999, Math.abs(tau)))} s`;
  const dpm = Number.isFinite(tau) ? 26.06 / tau : 0;
  const dev = (Math.max(...sim.rods) - Math.min(...sim.rods)) * 100;
  const avgPower = 1;
  const cellTemp = sim.coreTemp + (cell?.loaded ? (1 - (cell.burnup - 0.4)) * 6 * avgPower : -30);
  const lever = dir === 'withdrawing' ? 1 : dir === 'inserting' ? -1 : 0;
  const label = bank ? 'Bank · all 12 rods' : `Rod ${pad2(selected + 1)}`;

  return (
    <div className="rh">
      <div className="rh-dim" />
      <div className="rh-scan" />
      <header className="rh-title">
        <div className="rh-eyebrow">Rod control · {bank ? 'bank' : 'manual'}</div>
        <h2>
          {label} · {dir}
        </h2>
        <div className="rh-sub">
          {bank
            ? `Average insertion ${Math.round(sim.rodsIn * 100)}%`
            : `Cell ${pad2(selected + 1)} · ${cell?.loaded ? `burn-up ${Math.round(cell.burnup * 100)}%${cell.burnup > 0.9 ? ' · swap due' : ''}` : 'empty'}`}
        </div>
      </header>
      <div className="rh-ribbon">
        <span className={sim.scrammed ? 'is-bad' : ''}>{sim.scrammed ? 'SCRAM' : sim.criticality}</span>
        <span>k {sim.keff.toFixed(4)}</span>
        <span className={sim.reactivity > 30 ? 'is-warn' : ''}>
          ρ {sim.reactivity >= 0 ? '+' : ''}
          {fmt(sim.reactivity)} pcm · {sim.stability}
        </span>
      </div>
      <div className="rh-toasts">
        {toasts.slice(-2).map((t) => (
          <div key={t.id} className={`rh-toast is-${t.level}`}>
            <b>{t.text}</b>
            {t.detail && <span>{t.detail}</span>}
          </div>
        ))}
      </div>

      <section className="rh-panel rh-l1">
        <div className="rh-ph">
          Reactivity <i>pcm</i>
        </div>
        <div className="rh-center">
          <Gauge rho={sim.reactivity} />
        </div>
        <div className="rh-big rh-center">
          {sim.reactivity >= 0 ? '+' : ''}
          {fmt(sim.reactivity)}
          <small>pcm</small>
        </div>
        <div className="rh-row">
          <span>Period</span>
          <b>{tauText}</b>
        </div>
        <div className="rh-row">
          <span>Startup rate</span>
          <b>
            {dpm >= 0 ? '+' : ''}
            {dpm.toFixed(2)} DPM
          </b>
        </div>
      </section>

      <section className="rh-panel rh-l2">
        <div className="rh-ph">
          Thermal power <i>trend</i>
        </div>
        <div className="rh-big">
          {fmt(sim.thermalPower)}
          <small>MWt</small>
        </div>
        <Spark data={hist.current.data} set={3700} />
        <div className="rh-row">
          <span>Gross output</span>
          <b>{fmt(sim.output)} MWe</b>
        </div>
      </section>

      <section className="rh-panel rh-l3">
        <div className="rh-ph">
          Rod select <i>A / D · click</i>
        </div>
        <div className="rh-center">
          <RingSelect sim={sim} selected={selected} bank={bank} />
        </div>
      </section>

      <section className="rh-panel rh-r1">
        <div className="rh-ph">
          {label} <i>{bank ? 'bank' : 'selected'}</i>
        </div>
        <div className="rh-big rh-hi">
          {Math.round(ins * 100)}
          <small>% inserted</small>
        </div>
        <div className="rh-row">
          <span>Drive</span>
          <b className={dir === 'holding' ? '' : 'rh-cyan'}>
            {dir === 'withdrawing' ? '▲' : dir === 'inserting' ? '▼' : '■'} {dir}
            {dir !== 'holding' ? ` · ${ROD_RATE.toFixed(2)} %/s` : ''}
          </b>
        </div>
        <div className="rh-row">
          <span>Rod worth in</span>
          <b>{fmt(bank ? worth(ins) * 12 : worth(ins))} pcm</b>
        </div>
        {!bank && (
          <>
            <div className="rh-row">
              <span>Cell temp</span>
              <b>{cell?.loaded ? `${cellTemp.toFixed(0)} °C` : '—'}</b>
            </div>
            <div className="rh-row">
              <span>Burn-up</span>
              <b className={cell && cell.burnup > 0.9 ? 'rh-amber' : ''}>
                {cell?.loaded ? `${Math.round(cell.burnup * 100)}%` : 'empty'}
              </b>
            </div>
          </>
        )}
        <div className="rh-ph rh-mt">
          Axial flux <i>{bank ? 'core average' : `cell ${pad2(selected + 1)}`}</i>
        </div>
        <div className="rh-center">
          <AxialFlux ins={ins} />
        </div>
      </section>

      <section className="rh-panel rh-r2">
        <div className="rh-ph">
          Interlocks <i>{sim.scrammed ? 'scram latched' : 'all clear'}</i>
        </div>
        <div className="rh-row">
          <span>Rod withdrawal block</span>
          <b className={sim.scrammed ? 'rh-red' : 'rh-green'}>{sim.scrammed ? 'ACTIVE' : 'CLEAR'}</b>
        </div>
        <div className="rh-row">
          <span>Period &gt; 30 s</span>
          <b className={Number.isFinite(tau) && tau > 0 && tau < 30 ? 'rh-red' : 'rh-green'}>
            {Number.isFinite(tau) && tau > 0 && tau < 30 ? 'SHORT' : 'OK'}
          </b>
        </div>
        <div className="rh-row">
          <span>Bank deviation</span>
          <b className={dev > 15 ? 'rh-amber' : 'rh-green'}>
            {dev.toFixed(0)}%{dev > 15 ? ' · watch' : ''}
          </b>
        </div>
        <div className="rh-row">
          <span>Scram breakers</span>
          <b className={sim.scrammed ? 'rh-red' : 'rh-green'}>{sim.scrammed ? 'OPEN' : 'CLOSED'}</b>
        </div>
      </section>

      <section className="rh-panel rh-lever">
        <div className="rh-ph">
          Drive lever <i>{label}</i>
        </div>
        <svg width="268" height="56" viewBox="-6 0 280 56" aria-hidden="true">
          <rect
            x="0"
            y="16"
            width="268"
            height="14"
            rx="7"
            fill="rgba(95,227,255,.12)"
            stroke="rgba(95,227,255,.4)"
          />
          {lever !== 0 && (
            <rect
              x={lever > 0 ? 134 : 34}
              y="16"
              width="100"
              height="14"
              rx="7"
              fill={lever > 0 ? '#5fe3ff' : '#f2b81f'}
            />
          )}
          <line x1="134" y1="8" x2="134" y2="38" stroke="#9fb0c2" />
          <circle cx={134 + lever * 100} cy="23" r="12" fill="#0b1118" stroke="#fff" strokeWidth="2.5" />
          <text
            x="0"
            y="52"
            fill={lever < 0 ? '#f2b81f' : '#64768a'}
            fontFamily="Oxanium"
            fontSize="10"
            letterSpacing="2"
          >
            INSERT · S
          </text>
          <text x="118" y="52" fill="#64768a" fontFamily="Oxanium" fontSize="10">
            HOLD
          </text>
          <text
            x="172"
            y="52"
            fill={lever > 0 ? '#5fe3ff' : '#64768a'}
            fontFamily="Oxanium"
            fontSize="10"
            letterSpacing="2"
          >
            WITHDRAW · W
          </text>
        </svg>
      </section>

      <nav className="rh-keys">
        <span>
          <kbd>A</kbd>
          <kbd>D</kbd>Select
        </span>
        <span>
          <kbd>W</kbd>Withdraw
        </span>
        <span>
          <kbd>S</kbd>Insert
        </span>
        <span>
          <kbd>B</kbd>Bank
        </span>
        <span className="rh-danger">
          <kbd className="rh-hold" style={{ ['--p' as string]: hold }}>
            X
          </kbd>
          Hold · {sim.scrammed ? 'reset scram' : 'scram'}
        </span>
        <span>
          <button className="rh-esc" onClick={exitMode}>
            <kbd>ESC</kbd>Leave
          </button>
        </span>
      </nav>
    </div>
  );
}
