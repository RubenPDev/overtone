import { ANALYZE_SECONDS, SERVICE_SECONDS } from '../game/turbine';
import {
  BEARING_COUPLING,
  MAX_WEIGHT_G,
  MM_S_PER_GRAM,
  PUMP_HOT_C,
  PUMP_TRIP_C,
  SYNC_RPM,
  VIB_ALERT,
  VIB_GOOD,
  VIB_TRIP,
  residual,
} from '../sim';
import { useHud } from '../state/hud';
import { useMode } from '../state/mode';
import { Head, Keys, SegBar } from './AccelPanels';
import { fmt } from './nav';

const tone = (v: number) => (v > VIB_ALERT ? 'bad' : v > VIB_GOOD ? 'warn' : 'ok');
const deg = (rad: number) => ((Math.round((rad * 180) / Math.PI) % 360) + 360) % 360;

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

function useAnalyzer() {
  return useHud((s) => (s.sim?.econ.upgrades['vibration-analyzer'] ?? 0) > 0);
}

/** Vibration spectrum for one bearing: running-speed orders, with 1× (imbalance) usually on top. */
function Spectrum({ bearing, levels }: { bearing: number; levels: number[] }) {
  const W = 300;
  const H = 96;
  const max = Math.max(VIB_ALERT + 1, ...levels);
  const labels = ['1×', '2×', '3×', '4×', '5×', 'BPF'];
  const bw = 30;
  return (
    <svg className="mp__curve" viewBox={`0 0 ${W} ${H}`} aria-label={`B${bearing + 1} spectrum`}>
      <line
        x1={0}
        x2={W}
        y1={H - 16 - ((H - 26) * VIB_ALERT) / max}
        y2={H - 16 - ((H - 26) * VIB_ALERT) / max}
        stroke="rgba(255,93,93,0.5)"
        strokeDasharray="4 4"
      />
      <line
        x1={0}
        x2={W}
        y1={H - 16 - ((H - 26) * VIB_GOOD) / max}
        y2={H - 16 - ((H - 26) * VIB_GOOD) / max}
        stroke="rgba(255,179,92,0.4)"
        strokeDasharray="4 4"
      />
      {levels.map((v, i) => {
        const h = ((H - 26) * v) / max;
        const x = 18 + i * (bw + 18);
        const c = i === 0 ? (v > VIB_ALERT ? '#ff5d5d' : v > VIB_GOOD ? '#ffb35c' : '#6dffb6') : '#5fe3ff';
        return (
          <g key={i}>
            <rect x={x} y={H - 16 - h} width={bw} height={h} fill={c} opacity={0.9} />
            <text
              x={x + bw / 2}
              y={H - 3}
              textAnchor="middle"
              fill="#9fb0c2"
              fontSize="10"
              fontFamily="Oxanium"
            >
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function AnalyzePanel({ bearing }: { bearing: number }) {
  const t = useHud((s) => s.sim?.turbine);
  const job = useMode((s) => s.job);
  const analysis = useMode((s) => s.analysis);
  const analyzer = useAnalyzer();
  if (!t) return null;
  const v = t.bearings[bearing] ?? 0;
  const done = analysis?.bearing === bearing;
  const r = residual(t);
  const one = BEARING_COUPLING[bearing]! * Math.hypot(r.x, r.y) * MM_S_PER_GRAM * (t.rpm / SYNC_RPM) ** 2;
  const base = Math.max(0.2, v - one);
  const levels = [one + base * 0.35, base * 0.45, base * 0.25, base * 0.12, base * 0.08, base * 0.3];
  const heavy = deg(Math.atan2(r.y, r.x));
  const lp = bearing >= 1 && bearing <= 3;
  return (
    <div className="mp">
      <Head eyebrow="Vibration analysis" title={`Bearing B${bearing + 1} · ${v.toFixed(1)} mm/s`} />
      <div className="mp__readouts">
        {t.bearings.map((b, i) => (
          <span key={i} className={i === bearing ? 'is-sel' : tone(b) !== 'ok' ? 'up' : ''}>
            B{i + 1} <b>{b.toFixed(1)}</b>
          </span>
        ))}
        <span>
          <b>{fmt(t.rpm)}</b> rpm
        </span>
      </div>
      {done ? (
        <div className="mp__rf">
          <Spectrum bearing={bearing} levels={levels} />
          <div className="mp__rows">
            <div>
              <span>1× · 50 Hz</span>
              <b>{levels[0]!.toFixed(1)} mm/s</b>
            </div>
            <div>
              <span>Phase</span>
              <b>{analyzer ? `${heavy}° heavy spot` : '— (needs analyzer)'}</b>
            </div>
            <div>
              <span>Diagnosis</span>
              <b className={levels[0]! > VIB_GOOD ? 'spent' : ''}>
                {levels[0]! > VIB_GOOD
                  ? lp
                    ? 'Imbalance · LP rotor A'
                    : 'Imbalance (transmitted)'
                  : 'Within limits'}
              </b>
            </div>
          </div>
        </div>
      ) : (
        <div className="mp__rows">
          <div>
            <span>Accelerometer</span>
            <Meter v={job.progress} c="#5fe3ff" />
            <b>{job.progress > 0 ? `${Math.round(job.progress * 100)}%` : `hold E · ${ANALYZE_SECONDS} s`}</b>
          </div>
        </div>
      )}
      <div className="mp__hint">
        {done
          ? levels[0]! > VIB_GOOD
            ? analyzer
              ? `Fit a weight opposite the heavy spot: about ${(heavy + 180) % 360}°, ${Math.round(Math.hypot(r.x, r.y) / 10) * 10} g, at the LP rotor station.`
              : 'The 1× peak means imbalance. Without the vibration analyzer (Ops tablet → Tools) you’ll find the angle with trial weights.'
            : 'Running speed peak is low. Nothing to do here.'
          : 'Hold E with the probe on the bearing cap.'}
      </div>
      <Keys
        items={[
          ['←/→', 'bearing'],
          ['hold E', 'analyse'],
          ['ESC', 'leave'],
        ]}
      />
    </div>
  );
}

/** Polar plot of the LP rotor: the heavy spot (with the analyzer) and the weight you're about to fit. */
function Polar({
  angle,
  mass,
  heavy,
  analyzer,
}: {
  angle: number;
  mass: number;
  heavy: { a: number; m: number } | null;
  analyzer: boolean;
}) {
  const S = 110;
  const c = S / 2;
  const R = S / 2 - 8;
  const pt = (a: number, m: number) => {
    const k = Math.min(1, m / MAX_WEIGHT_G);
    const rad = (a * Math.PI) / 180;
    return [c + Math.cos(rad) * R * k, c - Math.sin(rad) * R * k] as const;
  };
  const [wx, wy] = pt(angle, mass);
  return (
    <svg className="mp__polar" viewBox={`0 0 ${S} ${S}`} aria-label="Balance plane">
      {[1, 0.66, 0.33].map((k) => (
        <circle key={k} cx={c} cy={c} r={R * k} fill="none" stroke="rgba(200,220,235,0.18)" />
      ))}
      <line x1={c - R} x2={c + R} y1={c} y2={c} stroke="rgba(200,220,235,0.14)" />
      <line y1={c - R} y2={c + R} x1={c} x2={c} stroke="rgba(200,220,235,0.14)" />
      {[0, 90, 180, 270].map((a) => {
        const [x, y] = pt(a, MAX_WEIGHT_G * 1.12);
        return (
          <text key={a} x={x} y={y + 3} textAnchor="middle" fontSize="7" fill="#64768a" fontFamily="Oxanium">
            {a}°
          </text>
        );
      })}
      {analyzer && heavy && (
        <line
          x1={c}
          y1={c}
          x2={pt(heavy.a, heavy.m)[0]}
          y2={pt(heavy.a, heavy.m)[1]}
          stroke="#ff5d5d"
          strokeWidth="2.5"
        />
      )}
      <line x1={c} y1={c} x2={wx} y2={wy} stroke="#ffb35c" strokeWidth="2.5" />
      <circle cx={wx} cy={wy} r="4" fill="#ffb35c" />
    </svg>
  );
}

export function BalancePanel({ angle, mass }: { angle: number; mass: number }) {
  const t = useHud((s) => s.sim?.turbine);
  const job = useMode((s) => s.job);
  const trials = useMode((s) => s.trials);
  const analyzer = useAnalyzer();
  if (!t) return null;
  const b3 = t.bearings[2] ?? 0;
  const im = t.imbalance;
  const heavy = { a: deg(Math.atan2(im.y, im.x)), m: Math.hypot(im.x, im.y) };
  return (
    <div className="mp">
      <Head
        eyebrow="LP rotor A · balance plane"
        title={`B3 ${b3.toFixed(1)} mm/s · ${tone(b3) === 'ok' ? 'balanced' : 'out of balance'}`}
      />
      <div className="mp__balance">
        <Polar angle={angle} mass={mass} heavy={heavy} analyzer={analyzer} />
        <div className="mp__rows">
          <div>
            <span>Weight angle</span>
            <b>{Math.round(angle)}°</b>
          </div>
          <div>
            <span>Weight mass</span>
            <Meter v={mass / MAX_WEIGHT_G} c="#ffb35c" />
            <b>{Math.round(mass)} g</b>
          </div>
          <div>
            <span>Fitted now</span>
            <b>{t.weight ? `${Math.round(t.weight.mass)} g at ${Math.round(t.weight.angle)}°` : 'none'}</b>
          </div>
          <div>
            <span>Crew</span>
            {job.fitting ? (
              <>
                <Meter v={job.progress} c="#5fe3ff" />
                <b>fitting · {Math.round(job.progress * 100)}%</b>
              </>
            ) : (
              <b>ready · E to fit</b>
            )}
          </div>
        </div>
        <ol className="mp__trials">
          {trials.length ? (
            trials.map((tr, i) => (
              <li key={i} className={tr.vib === null ? '' : `is-${tone(tr.vib)}`}>
                {tr.mass} g @ {tr.angle}° → <b>{tr.vib === null ? '…' : `${tr.vib.toFixed(1)} mm/s`}</b>
              </li>
            ))
          ) : (
            <li className="is-empty">No trials yet</li>
          )}
        </ol>
      </div>
      <div className="mp__hint">
        {analyzer
          ? 'Red: heavy spot. Put the weight opposite it, about the same size, and fit.'
          : 'Try a weight, fit it, read B3. Worse means you’re near the heavy spot: go round the other way. Target under 2.8 mm/s.'}
      </div>
      <Keys
        items={[
          ['hold A/D', 'angle'],
          ['hold W/S', 'mass'],
          ['Shift', 'fine'],
          ['E', 'crew fits weight'],
          ['ESC', 'leave'],
        ]}
      />
    </div>
  );
}

export function ServicePanel() {
  const fp = useHud((s) => s.sim?.turbine.feedPump);
  const job = useMode((s) => s.job);
  if (!fp) return null;
  const status = fp.tripped ? 'TRIPPED' : fp.temp > PUMP_HOT_C ? 'RUNNING HOT' : 'RUNNING';
  return (
    <div className="mp">
      <Head eyebrow="Feed pump motor B" title={`Winding ${fp.temp.toFixed(0)} °C · ${status}`} />
      <div className="mp__rows">
        <div>
          <span>Winding</span>
          <Meter v={(fp.temp - 30) / (PUMP_TRIP_C - 30)} c={fp.temp > PUMP_HOT_C ? '#ff5d5d' : '#6dffb6'} />
          <b>
            {fp.temp.toFixed(0)} / {PUMP_TRIP_C} °C
          </b>
        </div>
        <div>
          <span>Bearing grease</span>
          <Meter v={fp.lube} c={fp.lube < 0.4 ? '#ffb35c' : '#5fe3ff'} />
          <b>{Math.round(fp.lube * 100)}%</b>
        </div>
        <div>
          <span>Service</span>
          <Meter v={job.progress} c="#ffc070" />
          <b>{job.progress > 0 ? `${Math.round(job.progress * 100)}%` : `hold E · ${SERVICE_SECONDS} s`}</b>
        </div>
      </div>
      <div className="mp__hint">
        {fp.tripped
          ? 'Grease the bearings; the motor restarts once the winding cools below 70 °C.'
          : fp.lube < 0.6
            ? 'Grease the motor bearings and check the winding (hold E).'
            : 'Freshly greased. Check back in a few days.'}
      </div>
      <Keys
        items={[
          ['hold E', 'service'],
          ['ESC', 'leave'],
        ]}
      />
    </div>
  );
}

export function DeskPanel() {
  const t = useHud((s) => s.sim?.turbine);
  const output = useHud((s) => s.sim?.output ?? 0);
  if (!t) return null;
  return (
    <div className="mp">
      <Head
        eyebrow="Turbine B · local desk"
        title={t.tripped ? 'TRIPPED · vibration' : t.rpm < SYNC_RPM - 5 ? 'RUNNING UP' : 'ON LOAD'}
      />
      <div className="mp__readouts">
        <span>
          <b>{fmt(output / 2)}</b> MWe
        </span>
        <span>
          <b>{fmt(t.rpm)}</b> rpm
        </span>
        <span>
          vacuum <b>{t.vacuum.toFixed(2)}</b> bar
        </span>
        <span>
          lube oil <b>{t.lubeOilTemp.toFixed(0)}</b> °C
        </span>
      </div>
      <div className="mp__rows">
        {t.bearings.map((b, i) => (
          <div key={i}>
            <span>Bearing B{i + 1}</span>
            <Meter v={b / VIB_TRIP} c={b > VIB_ALERT ? '#ff5d5d' : b > VIB_GOOD ? '#ffb35c' : '#6dffb6'} />
            <b>{b.toFixed(1)} mm/s</b>
          </div>
        ))}
      </div>
      <div className="mp__hint">
        {t.tripped
          ? 'Protection tripped on vibration. Balance the rotor, then press E to reset and run up.'
          : `Trip at ${VIB_TRIP} mm/s. Alert above ${VIB_ALERT}.`}
      </div>
      <Keys
        items={[
          ['E', 'reset trip'],
          ['ESC', 'leave'],
        ]}
      />
    </div>
  );
}

/** Top-right vitals in the Turbine Hall (after the mockup: speed, vibration, vacuum). */
export function TurbineVitals() {
  const t = useHud((s) => s.sim?.turbine);
  const output = useHud((s) => s.sim?.output ?? 0);
  if (!t) return null;
  const worst = Math.max(...t.bearings);
  const status = t.tripped
    ? 'TRIPPED'
    : t.rpm < SYNC_RPM - 5
      ? t.rpm < 100
        ? 'STOPPED'
        : 'COASTING'
      : 'ON LOAD';
  return (
    <section className="hud-tr">
      <div className={`vitals__status ${t.tripped ? 'is-alarm' : worst > VIB_ALERT ? 'is-warn' : ''}`}>
        TURBINE B · {status}
      </div>
      <div className="vitals__big">
        {fmt(output / 2)}
        <small>MWe</small>
      </div>
      <div className="vitals__sub">Generator B · 612 MVA rating</div>
      <SegBar label="Speed" value={fmt(t.rpm)} unit="rpm" fill={t.rpm / SYNC_RPM} tone="#6dffb6" />
      <SegBar
        label="Vibration"
        value={worst.toFixed(1)}
        unit="mm/s"
        fill={worst / VIB_TRIP}
        tone="#ff9a4a"
        warn={worst > VIB_ALERT}
      />
      <SegBar
        label="Vacuum"
        value={t.vacuum.toFixed(2)}
        unit="bar"
        fill={1 - (t.vacuum - 0.03) / 0.15}
        tone="#5fe3ff"
      />
      <SegBar
        label="Feed pump B"
        value={t.feedPump.temp.toFixed(0)}
        unit="°C"
        fill={(t.feedPump.temp - 30) / 65}
        tone="#ffb35c"
        warn={t.feedPump.temp > PUMP_HOT_C}
      />
    </section>
  );
}
