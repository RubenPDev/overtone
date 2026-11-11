import { closeMenu } from '../game/session';
import { formatClock, fmt } from '../hud/nav';
import { isRoomBuilt } from '../rooms/registry';
import { useHud } from '../state/hud';
import { useWorld } from '../state/world';
import {
  CORRIDORS,
  NODES,
  RING_MAP,
  TOTAL_CORRIDOR_M,
  getNode,
  routeTo,
  type FacilityNode,
} from '../world/facility';
import { RING_CIRCUMFERENCE_M } from '../sim';

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;
const H = 10; // block height on the map

const iso = (x: number, z: number, y = 0) => ({ x: (x - z) * COS30, y: (x + z) * SIN30 - y });
const pts = (list: { x: number; y: number }[]) =>
  list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

function statusLine(n: FacilityNode, alarms: string[]): string {
  if (n.clearance) return `Locked · clearance L${n.clearance}`;
  switch (n.id) {
    case 'control-room':
      return '6 scientists on shift';
    case 'fuel-storage':
      return 'Fresh assemblies ready';
    case 'turbine-hall':
      return alarms.includes('turbine-vibration') ? 'Turbine B vibration rising' : 'Turbines nominal';
    default:
      return isRoomBuilt(n.id) ? 'Nominal' : 'Sealed · not built yet';
  }
}

/** Edge midpoint of a node's footprint facing another node, in map-plane metres. */
function edgeToward(a: FacilityNode, b: FacilityNode) {
  const dx = b.map.x - a.map.x;
  const dz = b.map.z - a.map.z;
  return Math.abs(dx) > Math.abs(dz)
    ? { x: a.map.x + Math.sign(dx) * (a.map.w / 2), z: a.map.z }
    : { x: a.map.x, z: a.map.z + Math.sign(dz) * (a.map.d / 2) };
}

/** Pause-screen facility map (M), after docs/design/facility-map-v2.png. */
export function MapScreen() {
  const pos = useHud((s) => s.graphPos);
  const time = useHud((s) => s.sim?.time ?? 0);
  const alarms = useHud((s) => s.sim?.alarms) ?? [];
  const target = useHud((s) => s.objective?.target?.room ?? null);
  const waypoint = useWorld((s) => s.waypoint);
  const here = 'room' in pos ? pos.room : null;
  const clock = formatClock(time);
  const rooms = NODES.filter((n) => n.kind === 'room');
  // The list shows plant rooms and named ring stations, nearest first; plain junction sectors only on the map.
  const listed = rooms
    .filter((n) => !n.sector || n.station)
    .map((n) => ({ n, d: routeTo(pos, n.id).dist }))
    .sort((a, b) => a.d - b.d);
  const onRing =
    ('room' in pos && pos.room.startsWith('ring-')) || ('corridor' in pos && pos.corridor.startsWith('R-'));
  const ringPath = Array.from({ length: 97 }, (_, i) => {
    const a = (i / 96) * Math.PI * 2;
    return iso(RING_MAP.cx + Math.cos(a) * RING_MAP.r, RING_MAP.cz + Math.sin(a) * RING_MAP.r, 2);
  });
  const setWaypoint = (id: string) => useWorld.setState({ waypoint: waypoint === id ? null : id });

  // Player marker on the map.
  let me = { x: 0, z: 0 };
  if ('room' in pos) me = getNode(pos.room).map;
  else {
    const c = CORRIDORS.find((c) => c.id === pos.corridor)!;
    const a = getNode(pos.from);
    const b = getNode(c.a === pos.from ? c.b : c.a);
    const k = pos.t / c.length;
    me = { x: a.map.x + (b.map.x - a.map.x) * k, z: a.map.z + (b.map.z - a.map.z) * k };
  }
  const meP = iso(me.x, me.z, H);

  // Fit the viewBox around everything.
  const all = rooms
    .flatMap((n) => [
      iso(n.map.x - n.map.w / 2, n.map.z - n.map.d / 2, H + 40),
      iso(n.map.x + n.map.w / 2, n.map.z + n.map.d / 2, 0),
      iso(n.map.x + n.map.w / 2, n.map.z - n.map.d / 2),
      iso(n.map.x - n.map.w / 2, n.map.z + n.map.d / 2),
    ])
    .concat(ringPath);
  const minX = Math.min(...all.map((p) => p.x)) - 90;
  const maxX = Math.max(...all.map((p) => p.x)) + 90;
  const minY = Math.min(...all.map((p) => p.y)) - 20;
  const maxY = Math.max(...all.map((p) => p.y)) + 20;

  return (
    <div className="mapscreen">
      <header className="mapscreen__top">
        <div className="mapscreen__left">
          <span className="tag">PAUSED</span>
          <span>UNIT 1 · {onRing ? 'RING LEVEL B4' : 'LEVEL B2'}</span>
        </div>
        <nav className="mapscreen__tabs">
          <button className="is-on">MAP</button>
          {/* TODO(screens): staff, research and logbook tabs. */}
          <button disabled>STAFF</button>
          <button disabled>RESEARCH</button>
          <button disabled>LOGBOOK</button>
        </nav>
        <div className="mapscreen__time">
          {clock.hhmm} <small>DAY {clock.day}</small>
        </div>
      </header>

      <aside className="mapscreen__list">
        <div className="eyebrow">Facility</div>
        <h2>Unit 1 Plant</h2>
        <p>
          A {(RING_CIRCUMFERENCE_M / 1000).toFixed(1)} km accelerator ring runs under the whole plant ·{' '}
          {(TOTAL_CORRIDOR_M / 1000).toFixed(1)} km of tunnel to walk
        </p>
        <ul>
          {listed.map(({ n, d }) => {
            const isTarget = n.id === target || n.id === waypoint;
            return (
              <li key={n.id} className={`${isTarget ? 'is-target' : ''}${n.clearance ? ' is-locked' : ''}`}>
                <button onClick={() => setWaypoint(n.id)}>
                  <i style={{ background: n.accent, boxShadow: `0 0 8px ${n.accent}` }} />
                  <span>
                    <b>{n.name}</b>
                    <small>
                      {n.id === waypoint ? 'Waypoint set · ' : n.id === target ? 'Objective · ' : ''}
                      {statusLine(n, alarms)}
                    </small>
                  </span>
                  <em>
                    {n.id === here ? 'HERE' : d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${fmt(d)} m`}
                  </em>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <svg
        className="mapscreen__map"
        viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="mapgrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="rgba(95,227,255,0.06)" />
          </pattern>
        </defs>
        <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="url(#mapgrid)" />

        {/* The ring: a glowing loop round the plant; ring segments aren't drawn as straight corridors. */}
        <polyline points={pts(ringPath)} fill="none" stroke="rgba(165,140,255,0.28)" strokeWidth="14" />
        <polyline points={pts(ringPath)} fill="none" stroke="#a58cff" strokeWidth="2.5" />
        {'corridor' in pos && pos.corridor.startsWith('R-') && (
          <polyline
            points={pts(ringPath)}
            fill="none"
            stroke="#6dffb6"
            strokeWidth="2"
            strokeDasharray="8 7"
          />
        )}
        {CORRIDORS.filter((c) => c.kind !== 'ring').map((c) => {
          const a = getNode(c.a);
          const b = getNode(c.b);
          const p = edgeToward(a, b);
          const q = edgeToward(b, a);
          const A = iso(p.x, p.z, 2);
          const B = iso(q.x, q.z, 2);
          const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
          const angle = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI;
          const upright = angle > 90 || angle < -90 ? angle + 180 : angle;
          const active = 'corridor' in pos && pos.corridor === c.id;
          return (
            <g key={c.id}>
              <line
                x1={A.x}
                y1={A.y}
                x2={B.x}
                y2={B.y}
                stroke="rgba(160,190,210,0.35)"
                strokeWidth="9"
                strokeLinecap="round"
              />
              <line
                x1={A.x}
                y1={A.y}
                x2={B.x}
                y2={B.y}
                stroke={active ? '#6dffb6' : 'rgba(10,18,26,0.9)'}
                strokeWidth="5"
                strokeDasharray={active ? '6 5' : undefined}
              />
              <text
                x={mid.x}
                y={mid.y - 9}
                transform={`rotate(${upright} ${mid.x} ${mid.y - 9})`}
                className="map__corridor"
                textAnchor="middle"
              >
                {c.id} · {c.length} m
              </text>
            </g>
          );
        })}

        {rooms.map((n) => {
          const { x, z, w, d } = n.map;
          const x0 = x - w / 2,
            x1 = x + w / 2,
            z0 = z - d / 2,
            z1 = z + d / 2;
          const top = [iso(x0, z0, H), iso(x1, z0, H), iso(x1, z1, H), iso(x0, z1, H)];
          const right = [iso(x1, z0, H), iso(x1, z1, H), iso(x1, z1, 0), iso(x1, z0, 0)];
          const left = [iso(x0, z1, H), iso(x1, z1, H), iso(x1, z1, 0), iso(x0, z1, 0)];
          const built = isRoomBuilt(n.id);
          const label = iso(x, z0, H + 30);
          const anchor = iso(x, z, H);
          const isTarget = n.id === target || n.id === waypoint;
          return (
            <g
              key={n.id}
              className="map__room"
              onClick={() => setWaypoint(n.id)}
              style={{ opacity: n.clearance ? 0.65 : 1 }}
            >
              <polygon
                points={pts(left)}
                fill={n.accent}
                fillOpacity="0.16"
                stroke={n.accent}
                strokeOpacity="0.6"
              />
              <polygon
                points={pts(right)}
                fill={n.accent}
                fillOpacity="0.26"
                stroke={n.accent}
                strokeOpacity="0.6"
              />
              <polygon
                points={pts(top)}
                fill={n.accent}
                fillOpacity={built ? 0.32 : 0.12}
                stroke={n.accent}
                strokeWidth="1.6"
              />
              {/* Plain junction sectors get no callout, unless you are there or it is the target. */}
              {(!n.sector || n.station || n.id === here || isTarget) && (
                <>
                  <line
                    x1={anchor.x}
                    y1={anchor.y}
                    x2={label.x}
                    y2={label.y + 10}
                    stroke={n.accent}
                    strokeOpacity="0.7"
                  />
                  <g transform={`translate(${label.x} ${label.y})`}>
                    <rect
                      x={-78}
                      y={-22}
                      width={156}
                      height={32}
                      fill="rgba(6,10,14,0.85)"
                      stroke={n.accent}
                      strokeOpacity={isTarget ? 1 : 0.6}
                    />
                    <text y={-6} textAnchor="middle" className="map__label">
                      {n.name.toUpperCase()}
                    </text>
                    <text y={6} textAnchor="middle" className="map__sub" fill={n.accent}>
                      {n.id === here
                        ? 'YOU ARE HERE'
                        : isTarget
                          ? `WAYPOINT · ${fmt(routeTo(pos, n.id).dist)} m`
                          : statusLine(n, alarms).toUpperCase()}
                    </text>
                  </g>
                </>
              )}
            </g>
          );
        })}

        <g transform={`translate(${meP.x} ${meP.y})`}>
          <circle r="11" fill="rgba(109,255,182,0.2)" />
          <path d="M0,-12 L8,8 L0,3 L-8,8 Z" fill="#6dffb6" stroke="#0b1118" strokeWidth="1.2" />
        </g>
      </svg>

      <footer className="mapscreen__hints">
        <span>
          <kbd>LMB</kbd> SET WAYPOINT
        </span>
        <span>
          <kbd>M</kbd>
          <button onClick={closeMenu}>CLOSE MAP</button>
        </span>
      </footer>
    </div>
  );
}
