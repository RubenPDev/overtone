import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { createThrottle } from '../core/clock';
import { bus } from '../core/events';
import { GAME_SECONDS_PER_TICK, averageInsertion } from '../sim';
import { player, simHost } from '../game/runtime';
import { toHudSim, useHud } from '../state/hud';
import { corridorT } from '../world/spaces';
import { stage } from './stage';

/** Live frame stats for the dev overlay (read directly; never React state). */
export const frameStats = { fps: 0, ticksThisSecond: 0, tps: 0 };

/**
 * Drives the simulation from the render loop and publishes throttled snapshots
 * to the HUD store: plant data at 5 Hz, player data at 10 Hz. This is the
 * only bridge from per-frame state into React.
 */
export function SimDriver() {
  const simThrottle = useMemo(() => createThrottle(5), []);
  const playerThrottle = useMemo(() => createThrottle(10), []);
  const statThrottle = useMemo(() => createThrottle(1), []);
  const counters = useMemo(() => ({ frames: 0, ticks: 0 }), []);

  useFrame((_, dt) => {
    const n = simHost.frame(dt);
    // Focus drains with game time (4% per game hour); coffee brings it back.
    player.focus = Math.max(0, player.focus - (n * GAME_SECONDS_PER_TICK * 0.04) / 3600);
    counters.frames += 1;
    counters.ticks += n;
    if (statThrottle(dt)) {
      frameStats.fps = counters.frames;
      frameStats.tps = counters.ticks;
      const st = simHost.state;
      bus.emit('plant/sample', {
        output: st.output,
        thermalPower: st.thermalPower,
        coreTemp: st.coreTemp,
        rodsIn: averageInsertion(st),
      });
      counters.frames = 0;
      counters.ticks = 0;
    }

    if (simThrottle(dt)) useHud.setState({ sim: toHudSim(simHost.state) });

    if (playerThrottle(dt)) {
      const c = stage.corridor;
      useHud.setState({
        player: {
          x: player.pos.x,
          z: player.pos.z,
          yaw: player.yaw,
          stamina: player.stamina,
          focus: player.focus,
          dose: player.dose,
        },
        ...(c
          ? {
              graphPos: {
                corridor: c.corridor,
                from: c.from,
                t: Math.max(0, Math.min(c.length, corridorT(c, player.pos))),
              },
            }
          : {}),
      });
    }
  });
  return null;
}
