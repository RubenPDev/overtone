import { useHud } from '../state/hud';
import { useWorld } from '../state/world';
import { compassMarkers, fmt } from './nav';

const SPAN = 180; // the whole circle maps onto the strip, so no room ever drops off it
const MIN_GAP = 15; // % of strip width between markers, so labels never overlap

/** Top-centre strip: rooms placed by the direction of their route, with real walking distances. */
export function Compass() {
  const pos = useHud((s) => s.graphPos);
  const player = useHud((s) => s.player);
  const target = useHud((s) => s.objective?.target?.room ?? null);
  const waypoint = useWorld((s) => s.waypoint);

  const markers = compassMarkers(pos, player)
    .filter((m) => !m.locked || m.id === waypoint)
    .map((m) => ({ ...m, x: 50 + (Math.max(-SPAN, Math.min(SPAN, m.bearing)) / SPAN) * 46 }))
    .sort((a, b) => a.x - b.x || a.dist - b.dist);
  // Rooms reached through the same door share a bearing: fan them out, then keep the row on the strip.
  for (let i = 1; i < markers.length; i++)
    markers[i]!.x = Math.max(markers[i]!.x, markers[i - 1]!.x + MIN_GAP);
  const overflow = (markers.at(-1)?.x ?? 0) - 97;
  if (overflow > 0) for (const m of markers) m.x -= overflow;

  return (
    <div className="compass" aria-label="Compass">
      <div className="compass__ticks" />
      <div className="compass__notch" />
      {markers.map((m) => {
        const focus = m.id === target || m.id === waypoint;
        return (
          <div
            key={m.id}
            className={`compass__mark${focus ? ' is-focus' : ''}${m.locked ? ' is-locked' : ''}`}
            style={{ left: `${m.x}%`, ['--accent' as string]: m.accent }}
          >
            <i />
            <b>{m.label}</b>
            <span>{fmt(m.dist)} m</span>
          </div>
        );
      })}
    </div>
  );
}
