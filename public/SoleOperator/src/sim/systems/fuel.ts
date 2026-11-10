import { BURN_TIME_S, NOMINAL_FISSION_MW, ROD_SHADING, SPENT_BURNUP } from '../constants';
import type { SimSystem } from '../system';

/**
 * Splits core power between the 12 cells and burns their fuel. A cell's share
 * drops when its own rod is in and as its fuel depletes. Burn-up never decreases.
 */
export const fuelSystem: SimSystem = {
  id: 'fuel',
  step(state, ctx) {
    const weights = state.cells.map((c, i) =>
      c.loaded ? (1 - ROD_SHADING * state.rods[i]!.insertion) * (1.15 - 0.3 * c.burnup) : 0,
    );
    const total = weights.reduce((a, b) => a + b, 0);
    const loaded = state.cells.filter((c) => c.loaded).length;

    state.cells.forEach((cell, i) => {
      const w = weights[i]!;
      cell.power = total > 0 ? (state.thermalPower * w) / total : 0;
      if (!cell.loaded || total <= 0) return;
      // Relative share vs the average loaded cell, times relative core power.
      const share = (w * loaded) / total;
      const burn = (share * (state.fissionPower / NOMINAL_FISSION_MW) * ctx.dt) / BURN_TIME_S;
      const before = cell.burnup;
      cell.burnup = Math.min(1, cell.burnup + Math.max(0, burn));
      if (before < SPENT_BURNUP && cell.burnup >= SPENT_BURNUP) ctx.emit({ type: 'cellSpent', cell: i });
    });
  },
};
