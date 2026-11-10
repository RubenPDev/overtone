import { useEffect, useRef, useState } from 'react';
import type { GameSpeed } from '../core/clock';
import { bus } from '../core/events';
import { onAction } from '../game/input';
import { objectives, simHost } from '../game/runtime';
import { setSpeed } from '../game/session';
import { ROOMS } from '../rooms/registry';
import type { PlantCommand } from '../sim';
import { frameStats } from '../scene/SimDriver';
import { useHud } from '../state/hud';
import './dev.css';

/**
 * Developer overlay (dev builds only; toggle with the ` key). FPS and tick
 * readouts are written straight to the DOM a few times a second, not via React state.
 */
export default function DevOverlay() {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const stats = useRef<HTMLDivElement>(null);
  const speed = useHud((s) => s.speed);
  const sim = useHud((s) => s.sim);

  useEffect(() => onAction((a) => a === 'dev' && setOpen((o) => !o)), []);

  useEffect(() => {
    const id = setInterval(() => {
      const s = simHost.state;
      if (stats.current)
        stats.current.textContent = `${frameStats.fps} fps · ${frameStats.tps} ticks/s · tick ${s.tick} · ρ ${s.reactivity.toFixed(1)} pcm`;
    }, 250);
    return () => clearInterval(id);
  }, []);

  useEffect(
    () =>
      bus.onAny((type, payload) => {
        if (type === 'cmd/sim' || type === 'toast') return;
        const p = payload as Record<string, unknown>;
        const brief = typeof p === 'object' ? JSON.stringify(p).slice(0, 70) : String(p);
        setLog((l) => [`${String(type)} ${brief}`, ...l].slice(0, 10));
      }),
    [],
  );

  if (!open)
    return (
      <button className="dev-chip" onClick={() => setOpen(true)}>
        ` DEV
      </button>
    );
  const rods = sim ? sim.rods.reduce((a, b) => a + b, 0) / sim.rods.length : 0;
  const cmd = (c: PlantCommand) => bus.emit('cmd/sim', c);

  return (
    <div className="dev">
      <div className="dev__head">
        DEV <small>` to hide</small>
      </div>
      <div className="dev__stats" ref={stats} />

      <div className="dev__row">
        <span>Speed</span>
        {([0, 1, 2, 3] as GameSpeed[]).map((s) => (
          <button key={s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>
            {s === 0 ? 'II' : `${s}×`}
          </button>
        ))}
        <button onClick={() => simHost.tick()} title="Run one tick">
          step
        </button>
      </div>

      <div className="dev__row">
        <span>Teleport</span>
        {[...ROOMS.values()].map((r) => (
          <button key={r.id} onClick={() => bus.emit('cmd/teleport', { room: r.id })}>
            {r.name}
          </button>
        ))}
      </div>

      <label className="dev__slider">
        <span>All rods {Math.round(rods * 100)}%</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(rods * 100)}
          onChange={(e) => cmd({ type: 'setAllRods', insertion: +e.target.value / 100 })}
        />
      </label>
      <label className="dev__slider">
        <span>Coolant flow {Math.round((sim?.coolantFlow ?? 1) * 100)}%</span>
        <input
          type="range"
          min={0}
          max={120}
          value={Math.round((sim?.coolantFlow ?? 1) * 100)}
          onChange={(e) => cmd({ type: 'setCoolantFlow', fraction: +e.target.value / 100 })}
        />
      </label>

      <div className="dev__row dev__wrap">
        <button onClick={() => cmd({ type: 'injectFault', fault: 'turbine-vibration', severity: 0.6 })}>
          Turbine vibration
        </button>
        <button onClick={() => cmd({ type: 'injectFault', fault: 'cooling-loss', severity: 0.5 })}>
          Cooling loss
        </button>
        <button onClick={() => cmd({ type: 'clearFaults' })}>Clear faults</button>
        <button onClick={() => cmd({ type: 'scram' })}>SCRAM</button>
        <button onClick={() => cmd({ type: 'resetScram' })}>Reset scram</button>
        <button
          onClick={() =>
            bus.emit('toast', { text: 'Test toast', detail: 'From the dev overlay', level: 'info' })
          }
        >
          Toast
        </button>
        <button onClick={() => objectives.forceAdvance()}>Complete step</button>
      </div>

      <div className="dev__log">
        {log.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
