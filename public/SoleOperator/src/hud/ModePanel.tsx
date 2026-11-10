import { exitMode } from '../game/modes';
import { ProductionPanel, RfPanel, ShuttlePanel } from './AccelPanels';
import { isFresh } from '../logistics';
import { useHud } from '../state/hud';
import { useLogistics } from '../state/logistics';
import { useMode, type RefuelPhase } from '../state/mode';
import { fmt } from './nav';

const pad2 = (n: number) => String(n).padStart(2, '0');

function Keys({ items }: { items: [string, string][] }) {
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

function Readouts() {
  const sim = useHud((s) => s.sim);
  if (!sim) return null;
  return (
    <div className="mp__readouts">
      <span>
        <b>{fmt(sim.output)}</b> MWe
      </span>
      <span>
        <b>{fmt(sim.thermalPower)}</b> MWt
      </span>
      <span>
        <b>{sim.coreTemp.toFixed(0)}</b> °C
      </span>
      <span>
        k <b>{sim.keff.toFixed(4)}</b>
      </span>
      <span className={sim.reactivity > 60 ? 'up' : sim.reactivity < -60 ? 'down' : ''}>
        ρ{' '}
        <b>
          {sim.reactivity > 0 ? '+' : ''}
          {sim.reactivity.toFixed(0)}
        </b>{' '}
        pcm
      </span>
    </div>
  );
}

function RodPanel({ selected, bank }: { selected: number; bank: boolean }) {
  const rods = useHud((s) => s.sim?.rods);
  const cells = useHud((s) => s.sim?.cells);
  const select = (i: number) => useMode.setState({ mode: { kind: 'rods', selected: i, bank: false } });
  return (
    <div className="mp">
      <div className="mp__head">
        <span className="mp__eyebrow">Rod control</span>
        <h3>{bank ? 'All rods · bank mode' : `Rod ${pad2(selected + 1)}`}</h3>
        <button className="mp__close" onClick={exitMode}>
          ESC
        </button>
      </div>
      <Readouts />
      <div className="mp__rods">
        {(rods ?? []).map((ins, i) => {
          const cell = cells?.[i];
          return (
            <button
              key={i}
              className={`rodcol${bank || i === selected ? ' is-on' : ''}`}
              onClick={() => select(i)}
            >
              <span className="rodcol__bar">
                <i style={{ height: `${ins * 100}%` }} />
              </span>
              <b>{pad2(i + 1)}</b>
              <small className={cell && cell.loaded && cell.burnup > 0.9 ? 'hot' : ''}>
                {cell ? (cell.loaded ? `${Math.round(cell.burnup * 100)}%` : 'EMPTY') : ''}
              </small>
            </button>
          );
        })}
      </div>
      <Keys
        items={[
          ['← →', 'select'],
          ['W', 'withdraw'],
          ['S', 'insert'],
          ['B', 'bank'],
          ['Esc', 'exit'],
        ]}
      />
    </div>
  );
}

function CranePanel() {
  const crane = useMode((s) => s.crane);
  const holding = useLogistics((s) => s.holding);
  const cart = useLogistics((s) => s.cart);
  const docked = !cart.attached && cart.room === 'fuel-storage' && cart.bay === 'pool-dock';
  return (
    <div className="mp">
      <div className="mp__head">
        <span className="mp__eyebrow">Fuel crane</span>
        <h3>{crane.busy ? 'Hoist moving…' : crane.target || 'Line up over a slot'}</h3>
        <button className="mp__close" onClick={exitMode}>
          ESC
        </button>
      </div>
      <div className="mp__rows">
        <div>
          <span>Hook</span>
          <b className={holding ? (isFresh(holding) ? 'fresh' : 'spent') : ''}>
            {holding
              ? `${holding.id} · ${isFresh(holding) ? 'fresh' : `spent ${Math.round(holding.burnup * 100)}%`}`
              : 'empty'}
          </b>
        </div>
        <div>
          <span>Transfer cask</span>
          <b>
            {docked
              ? cart.cask.length
                ? cart.cask.map((a) => `${a.id} ${isFresh(a) ? 'fresh' : 'spent'}`).join(' · ')
                : 'docked · empty'
              : 'cart not at the dock'}
          </b>
        </div>
      </div>
      <Keys
        items={[
          ['WASD', 'move'],
          ['E', 'lower · grab / release'],
          ['Esc', 'exit'],
        ]}
      />
    </div>
  );
}

const PHASES: { id: RefuelPhase; label: string }[] = [
  { id: 'insert-rod', label: 'Rod fully in' },
  { id: 'extract', label: 'Extract spent' },
  { id: 'load', label: 'Load fresh' },
  { id: 'done', label: 'Done' },
];

function RefuelPanel() {
  const r = useMode((s) => s.refuel);
  const rod = useHud((s) => s.sim?.rods[r.cell] ?? 0);
  const cell = useHud((s) => s.sim?.cells[r.cell]);
  const cask = useLogistics((s) => s.cart.cask);
  const idx = PHASES.findIndex((p) => p.id === r.phase);
  const hint =
    r.phase === 'insert-rod'
      ? 'Hold S to drive the rod into the port. The cell unlocks when it is home.'
      : r.phase === 'extract'
        ? 'Hold E: the arm unbolts the cassette and sends it down the chute to the cask.'
        : r.phase === 'load'
          ? r.busy
            ? 'Fresh assembly coming up the chute…'
            : r.armLoaded
              ? 'Hold E: the arm seats the fresh cassette on the face.'
              : 'No fresh assembly in the cask.'
          : `Cell ${pad2(r.cell + 1)} refuelled. Rod ${pad2(r.cell + 1)} stays in: withdraw it slowly from rod control (F).`;
  return (
    <div className="mp">
      <div className="mp__head">
        <span className="mp__eyebrow">Refuelling machine</span>
        <h3>
          Cell {pad2(r.cell + 1)}
          <small>
            {cell ? (cell.loaded ? ` · burn-up ${Math.round(cell.burnup * 100)}%` : ' · empty') : ''}
          </small>
        </h3>
        <button className="mp__close" onClick={exitMode}>
          ESC
        </button>
      </div>
      <ol className="mp__steps">
        {PHASES.map((p, i) => (
          <li key={p.id} className={i < idx ? 'done' : i === idx ? 'active' : ''}>
            <i />
            {p.label}
          </li>
        ))}
      </ol>
      <div className="mp__rows">
        <div>
          <span>Rod {pad2(r.cell + 1)}</span>
          <span className="mp__meter">
            <i style={{ width: `${rod * 100}%` }} />
          </span>
          <b>{Math.round(rod * 100)}%</b>
        </div>
        {(r.phase === 'extract' || r.phase === 'load') && (
          <div>
            <span>Progress</span>
            <span className="mp__meter is-progress">
              <i style={{ width: `${r.progress * 100}%` }} />
            </span>
            <b>{Math.round(r.progress * 100)}%</b>
          </div>
        )}
        <div>
          <span>Cask</span>
          <b>
            {cask.length ? cask.map((a) => `${a.id} ${isFresh(a) ? 'fresh' : 'spent'}`).join(' · ') : 'empty'}
          </b>
        </div>
      </div>
      <p className="mp__hint">{hint}</p>
      <Keys
        items={
          r.phase === 'insert-rod'
            ? [
                ['← →', 'cell'],
                ['S', 'hold: rod in'],
                ['Esc', 'exit'],
              ]
            : [
                ['E', 'hold: operate'],
                ['Esc', 'exit'],
              ]
        }
      />
    </div>
  );
}

/** Bottom-centre panel for whichever machine the Operator is controlling. */
export function ModePanel() {
  const mode = useMode((s) => s.mode);
  if (mode.kind === 'rods') return <RodPanel selected={mode.selected} bank={mode.bank} />;
  if (mode.kind === 'crane') return <CranePanel />;
  if (mode.kind === 'refuel') return <RefuelPanel />;
  if (mode.kind === 'rf') return <RfPanel cavity={mode.cavity} />;
  if (mode.kind === 'production') return <ProductionPanel index={mode.index} />;
  if (mode.kind === 'shuttle') return <ShuttlePanel index={mode.index} />;
  return null;
}
