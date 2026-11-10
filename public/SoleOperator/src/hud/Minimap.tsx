import { useMemo } from 'react';
import { getRoom } from '../rooms/registry';
import { useHud } from '../state/hud';
import { PALETTE } from '../styles/palette';
import { getNode } from '../world/facility';
import { doorPosition } from '../world/geometry';
import { CORRIDOR_WIDTH, corridorFrame, corridorPoint } from '../world/spaces';
import type { Vec2 } from '../world/types';
import { exitPointToward, toScreenPlane } from './nav';

const R = 92; // svg radius of the map disc

/** Round minimap of the current space, drawn in the camera's orientation. */
export function Minimap() {
  const pos = useHud((s) => s.graphPos);
  const player = useHud((s) => s.player);
  const target = useHud((s) => s.objective?.target ?? null);

  const inRoom = 'room' in pos;
  const roomId = inRoom ? pos.room : null;
  const corridorKey = inRoom ? null : `${pos.corridor}|${pos.from}`;

  // Static geometry for the space (recomputed only when the space changes).
  const geo = useMemo(() => {
    if (roomId) {
      const room = getRoom(roomId);
      const b = room.bounds;
      const corners: Vec2[] = [
        { x: b.minX, z: b.minZ },
        { x: b.maxX, z: b.minZ },
        { x: b.maxX, z: b.maxZ },
        { x: b.minX, z: b.maxZ },
      ];
      const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * Math.SQRT2;
      return {
        scale: (R * 1.55) / span,
        center: { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 },
        poly: corners,
        doors: room.doorways.map((d) => doorPosition(b, d)),
        dots: room.workstations.filter((w) => w.staff).map((w) => w.position),
        accent: getNode(room.id).accent,
      };
    }
    const [cid, from] = corridorKey!.split('|') as [string, string];
    const f = corridorFrame(cid, getRoom(from));
    const h = CORRIDOR_WIDTH / 2;
    return {
      scale: 2.2,
      center: null as Vec2 | null,
      poly: [
        corridorPoint(f, -3, -h),
        corridorPoint(f, f.length + 3, -h),
        corridorPoint(f, f.length + 3, h),
        corridorPoint(f, -3, h),
      ],
      doors: [corridorPoint(f, -3), corridorPoint(f, f.length + 3)],
      dots: [] as Vec2[],
      accent: PALETTE.cyan,
    };
  }, [roomId, corridorKey]);

  const origin = geo.center ?? player;
  const project = (p: Vec2) => {
    const a = toScreenPlane({ x: p.x - origin.x, z: p.z - origin.z });
    return { x: a.u * geo.scale, y: a.v * geo.scale };
  };
  const pts = geo.poly.map(project);
  const me = project(player);
  // Heading: yaw 0 faces +z (screen down-left).
  const head = toScreenPlane({ x: Math.sin(player.yaw), z: Math.cos(player.yaw) });
  const headAngle = (Math.atan2(head.v, head.u) * 180) / Math.PI + 90;

  let goal: { x: number; y: number } | null = null;
  if (target) {
    if (roomId && target.room === roomId) {
      const it = getRoom(roomId).interactables.find((i) => i.id === target.interactable);
      if (it) goal = project(it.position);
    } else {
      const exit = exitPointToward(pos, target.room);
      if (exit) goal = project(exit);
    }
  }
  const clampToDisc = (p: { x: number; y: number }) => {
    const d = Math.hypot(p.x, p.y);
    return d > R - 8 ? { x: (p.x / d) * (R - 8), y: (p.y / d) * (R - 8) } : p;
  };

  return (
    <div className="minimap">
      <svg viewBox={`${-R - 6} ${-R - 6} ${2 * R + 12} ${2 * R + 12}`}>
        <defs>
          <clipPath id="mm-clip">
            <circle r={R} />
          </clipPath>
          <radialGradient id="mm-bg">
            <stop offset="0" stopColor="rgba(20,34,46,0.85)" />
            <stop offset="1" stopColor="rgba(8,14,20,0.9)" />
          </radialGradient>
        </defs>
        <circle r={R} fill="url(#mm-bg)" stroke="rgba(159,233,255,0.35)" strokeWidth="1.5" />
        <g clipPath="url(#mm-clip)">
          <polygon
            points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="rgba(95,227,255,0.10)"
            stroke={geo.accent}
            strokeWidth="1.5"
          />
          {geo.doors.map((d, i) => {
            const p = project(d);
            return <circle key={i} cx={p.x} cy={p.y} r="2.6" fill={PALETTE.hazard} />;
          })}
          {roomId === 'control-room' && (
            <circle
              r={4.4 * geo.scale}
              cx={project({ x: 0, z: 0 }).x}
              cy={project({ x: 0, z: 0 }).y}
              fill="rgba(95,227,255,0.45)"
            />
          )}
          {geo.dots.map((d, i) => {
            const p = project(d);
            return <circle key={i} cx={p.x} cy={p.y} r="2.2" fill="#e8eef3" />;
          })}
          {goal && (
            <g transform={`translate(${clampToDisc(goal).x} ${clampToDisc(goal).y})`}>
              <circle r="5.5" fill="none" stroke={PALETTE.amber} strokeWidth="1.6" />
              <circle r="2" fill={PALETTE.amber} />
            </g>
          )}
          <g transform={`translate(${me.x} ${me.y}) rotate(${headAngle})`}>
            <circle r="7" fill="rgba(109,255,182,0.18)" />
            <path d="M0,-7 L5,5 L0,2.5 L-5,5 Z" fill={PALETTE.player} />
          </g>
        </g>
        <text y={-R + 13} textAnchor="middle" className="minimap__n">
          N
        </text>
      </svg>
    </div>
  );
}
