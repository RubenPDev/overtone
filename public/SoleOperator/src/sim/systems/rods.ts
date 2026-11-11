import { ROD_SPEED_PER_S, SCRAM_SPEED_PER_S } from '../constants';
import { upgradeLevel } from '../economy';
import type { SimSystem } from '../system';

/** Rod drives: each rod travels toward its target at drive speed (or scram speed). */
export const rodsSystem: SimSystem = {
  id: 'rods',
  step(state, ctx) {
    const drive = ROD_SPEED_PER_S * (1 + 0.5 * upgradeLevel(state, 'rod-drives'));
    const speed = (state.scrammed ? SCRAM_SPEED_PER_S : drive) * ctx.dt;
    state.rods.forEach((rod, i) => {
      if (rod.insertion === rod.target) return;
      const delta = rod.target - rod.insertion;
      if (Math.abs(delta) <= speed) {
        rod.insertion = rod.target;
        ctx.emit({ type: 'rodSettled', rod: i, insertion: rod.insertion });
      } else {
        rod.insertion += Math.sign(delta) * speed;
      }
    });
  },
};
