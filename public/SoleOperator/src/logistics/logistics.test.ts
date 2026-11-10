import { describe, expect, it } from 'vitest';
import {
  CASK_CAPACITY,
  allAssemblies,
  caskFresh,
  caskReceive,
  caskTakeFresh,
  craneAtCask,
  craneAtSlot,
  initialLogistics,
  slotName,
} from './index';

describe('fuel logistics', () => {
  it('starts with fresh and spent assemblies in the pool and an empty docked cart', () => {
    const s = initialLogistics();
    expect(s.pool.filter((a) => a && a.burnup < 0.5)).toHaveLength(6);
    expect(s.pool.filter((a) => a && a.burnup >= 0.5)).toHaveLength(5);
    expect(s.cart.bay).toBe('pool-dock');
    expect(s.cart.cask).toEqual([]);
    expect(slotName(0)).toBe('A1');
    expect(slotName(7)).toBe('B3');
  });

  it('crane moves an assembly from the pool to the cask and back, never duplicating or losing it', () => {
    const s = initialLogistics();
    const before = allAssemblies(s).sort();
    expect(craneAtSlot(s, 0)).toEqual({ ok: false, reason: 'Nothing in that slot.' });
    const pick = craneAtSlot(s, 1);
    expect(pick.ok && pick.picked?.id).toBe('FA-31');
    expect(craneAtSlot(s, 2)).toMatchObject({ ok: false }); // occupied, hook full
    expect(craneAtCask(s)).toMatchObject({ ok: true, where: 'cask' });
    expect(caskFresh(s)?.id).toBe('FA-31');
    expect(allAssemblies(s).sort()).toEqual(before);

    expect(craneAtCask(s)).toMatchObject({ ok: true, picked: { id: 'FA-31' } });
    expect(craneAtSlot(s, 0)).toMatchObject({ ok: true, where: 'pool' });
    expect(allAssemblies(s).sort()).toEqual(before);
  });

  it('the cask holds at most two assemblies and hands out fresh fuel for loading', () => {
    const s = initialLogistics();
    caskReceive(s, { id: 'X1', burnup: 0.96 });
    caskReceive(s, { id: 'X2', burnup: 0 });
    expect(s.cart.cask).toHaveLength(CASK_CAPACITY);
    expect(caskReceive(s, { id: 'X3', burnup: 0 })).toBe(false);
    craneAtSlot(s, 1);
    expect(craneAtCask(s)).toEqual({ ok: false, reason: 'The cask is full.' });
    expect(caskTakeFresh(s)?.id).toBe('X2');
    expect(caskTakeFresh(s)).toBeNull();
  });

  it('the crane takes spent fuel out of the cask first', () => {
    const s = initialLogistics();
    caskReceive(s, { id: 'NEW', burnup: 0 });
    caskReceive(s, { id: 'OLD', burnup: 0.96 });
    expect(craneAtCask(s)).toMatchObject({ ok: true, picked: { id: 'OLD' } });
  });
});
