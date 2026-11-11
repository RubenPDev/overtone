import { create } from 'zustand';
import type { Assembly, CartState } from '../logistics';

/**
 * React-facing copy of the fuel logistics state. The live state is a plain
 * object in game/runtime.ts (the cart moves every frame while pushed); this
 * copy is refreshed only when something changes hands or the cart docks.
 */
interface LogisticsView {
  pool: (Assembly | null)[];
  holding: Assembly | null;
  cart: Omit<CartState, 'x' | 'z' | 'yaw'>;
}

export const useLogistics = create<LogisticsView>()(() => ({
  pool: [],
  holding: null,
  cart: { room: 'fuel-storage', attached: false, bay: null, cask: [] },
}));
