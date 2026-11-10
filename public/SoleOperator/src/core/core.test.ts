import { describe, expect, it } from 'vitest';
import { FixedStepClock, createThrottle } from './clock';
import { EventBus, type GameEvents } from './events';
import { SimHost } from './simHost';
import { initialLogistics } from '../logistics';
import { latestSave, migrate, readSave, writeSave, type SaveData, type StorageLike } from './save';

class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  getItem = (k: string) => this.map.get(k) ?? null;
  setItem = (k: string, v: string) => void this.map.set(k, v);
  removeItem = (k: string) => void this.map.delete(k);
}

describe('FixedStepClock', () => {
  it('runs 10 ticks per real second at 1×, 30 at 3×, none when paused', () => {
    const c = new FixedStepClock();
    let n = 0;
    for (let i = 0; i < 60; i++) n += c.advance(1 / 60);
    expect(n).toBe(10);
    c.speed = 3;
    n = 0;
    for (let i = 0; i < 144; i++) n += c.advance(1 / 144);
    expect(n).toBe(30);
    c.speed = 0;
    expect(c.advance(1)).toBe(0);
  });

  it('is frame-rate independent over time', () => {
    const a = new FixedStepClock();
    const b = new FixedStepClock();
    let na = 0;
    let nb = 0;
    for (let i = 0; i < 30 * 20; i++) na += a.advance(1 / 30);
    for (let i = 0; i < 165 * 20; i++) nb += b.advance(1 / 165);
    expect(Math.abs(na - 200)).toBeLessThanOrEqual(1);
    expect(Math.abs(nb - 200)).toBeLessThanOrEqual(1);
  });

  it('drops long gaps instead of spiralling', () => {
    const c = new FixedStepClock();
    expect(c.advance(10)).toBe(2); // clamped to 0.25 s
  });

  it('throttle fires at the requested rate', () => {
    const t = createThrottle(5);
    let fires = 0;
    for (let i = 0; i < 120; i++) if (t(1 / 60)) fires++;
    expect(fires).toBeGreaterThanOrEqual(10);
    expect(fires).toBeLessThanOrEqual(11);
  });
});

describe('EventBus', () => {
  it('delivers typed events, unsubscribes and survives throwing listeners', () => {
    const bus = new EventBus<GameEvents>();
    const got: string[] = [];
    const off = bus.on('room/entered', (e) => got.push(e.room));
    bus.on('room/entered', () => {
      throw new Error('boom');
    });
    const err = console.error;
    console.error = () => {};
    bus.emit('room/entered', { room: 'a' });
    off();
    bus.emit('room/entered', { room: 'b' });
    console.error = err;
    expect(got).toEqual(['a']);
  });

  it('once fires a single time', () => {
    const bus = new EventBus<GameEvents>();
    let n = 0;
    bus.once('room/left', () => n++);
    bus.emit('room/left', { room: 'x' });
    bus.emit('room/left', { room: 'x' });
    expect(n).toBe(1);
  });
});

describe('SimHost', () => {
  it('routes bus commands into the sim and sim events back onto the bus', () => {
    const bus = new EventBus<GameEvents>();
    const host = new SimHost(bus, 'host');
    const seen: string[] = [];
    bus.on('sim', (e) => seen.push(e.type));
    bus.emit('cmd/sim', { type: 'scram' });
    host.frame(0.1);
    expect(host.state.scrammed).toBe(true);
    expect(seen).toContain('scram');
  });

  it('runs no ticks while paused', () => {
    const host = new SimHost(new EventBus<GameEvents>(), 'pause');
    host.setSpeed(0);
    const t = host.state.tick;
    host.frame(0.2);
    expect(host.state.tick).toBe(t);
  });
});

describe('save', () => {
  const sample = (savedAt: string): SaveData => {
    const host = new SimHost(new EventBus<GameEvents>(), 'save');
    return {
      version: 2,
      savedAt,
      seed: 'save',
      sim: host.snapshot(),
      world: { room: 'control-room', player: { x: 1, z: 2 }, focus: 0.9, dose: 0.1 },
      objectives: { active: 'swap-cell-07', step: 0, completed: [] },
      logistics: initialLogistics(),
    };
  };

  it('round-trips and restores the exact sim state', () => {
    const storage = new MemoryStorage();
    const data = sample('2026-01-01T00:00:00Z');
    expect(writeSave(storage, 'manual', data)).toBe(true);
    const back = readSave(storage, 'manual');
    expect(back).toEqual(data);
    const host = new SimHost(new EventBus<GameEvents>(), 'x');
    host.restore(back!.sim);
    expect(host.snapshot()).toEqual(data.sim);
  });

  it('picks the latest slot for Continue and ignores garbage', () => {
    const storage = new MemoryStorage();
    writeSave(storage, 'manual', sample('2026-01-01T00:00:00Z'));
    writeSave(storage, 'auto', sample('2026-01-02T00:00:00Z'));
    expect(latestSave(storage)?.slot).toBe('auto');
    storage.setItem('sole-operator:save:auto', '{not json');
    expect(latestSave(storage)?.slot).toBe('manual');
    expect(readSave(null, 'auto')).toBeNull();
  });

  it('migrates a real v1 save: a carried assembly ends up in the cart cask', () => {
    const storage = new MemoryStorage();
    const v2 = sample('2026-01-01T00:00:00Z');
    const v1 = {
      ...v2,
      version: 1,
      world: { room: 'fuel-storage', player: { x: 2, z: 0 }, carrying: 'FA-31' },
      logistics: undefined,
    };
    storage.setItem('sole-operator:save:auto', JSON.stringify(v1));
    const back = readSave(storage, 'auto')!;
    expect(back.version).toBe(2);
    expect(back.world).toEqual({ room: 'fuel-storage', player: { x: 2, z: 0 }, focus: 0.88, dose: 0 });
    expect(back.logistics.cart.cask).toEqual([{ id: 'FA-31', burnup: 0 }]);
    expect(back.logistics.cart.room).toBe('fuel-storage');
    expect(back.logistics.pool.some((a) => a?.id === 'FA-31')).toBe(false);
  });

  it('upgrades old saves through the migration chain', () => {
    const v0 = { version: 0, legacy: true };
    const migrations = { 0: (o: { version: number }) => ({ ...o, version: 1, upgraded: true }) };
    expect(migrate(v0, migrations, 1)).toEqual({ version: 1, legacy: true, upgraded: true });
    expect(migrate({ version: 0 }, {}, 1)).toBeNull(); // no path
  });
});
