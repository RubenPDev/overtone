import { ROD_SPEED_PER_S, SCRAM_SPEED_PER_S } from '../constants';
import type { SimSystem } from '../system';

/** Rod drives: each rod travels toward its target at drive speed (or scram speed). */
export const rodsSystem: SimSystem = {
  id: 'rods',
  step(state, ctx) {
    const speed = (state.scrammed ? SCRAM_SPEED_PER_S : ROD_SPEED_PER_S) * ctx.dt;
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
