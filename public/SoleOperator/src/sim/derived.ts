import { NOMINAL_THERMAL_MW } from './constants';
import type { PlantState } from './types';

export type Criticality = 'SUBCRITICAL' | 'CRITICAL' | 'SUPERCRITICAL';
export type Stability = 'STABLE' | 'RISING' | 'FALLING' | 'SHUTDOWN';

/** Reactor status words for the HUD ("CRITICAL · STABLE"). */
export function coreStatus(s: Readonly<PlantState>): { criticality: Criticality; stability: Stability } {
  const criticality: Criticality =
    s.reactivity > 60 ? 'SUPERCRITICAL' : s.reactivity < -60 ? 'SUBCRITICAL' : 'CRITICAL';
  let stability: Stability = 'STABLE';
  if (s.scrammed || s.thermalPower < NOMINAL_THERMAL_MW * 0.02) stability = 'SHUTDOWN';
  else if (s.powerTrend > 0.004) stability = 'RISING';
  else if (s.powerTrend < -0.004) stability = 'FALLING';
  return { criticality, stability };
}

/** Average rod insertion, 0–1. */
export function averageInsertion(s: Readonly<PlantState>): number {
  return s.rods.reduce((a, r) => a + r.insertion, 0) / s.rods.length;
}

/** Day number (from 1), hours, minutes and shift (1–3, eight hours each). */
export function clockOf(timeSeconds: number) {
  const day = Math.floor(timeSeconds / 86400) + 1;
  const secOfDay = timeSeconds % 86400;
  const hours = Math.floor(secOfDay / 3600);
  const minutes = Math.floor((secOfDay % 3600) / 60);
  return { day, hours, minutes, shift: Math.floor(hours / 8) + 1 };
}
