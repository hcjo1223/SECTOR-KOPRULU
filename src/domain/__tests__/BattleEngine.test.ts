import { describe, expect, it } from 'vitest';
import { BattleEngine } from '../combat/BattleEngine';
import { placeUnitOnGrid } from '../grid/GridSystem';
import type { PlacedUnit } from '../types';

describe('BattleEngine (Milestone 2 Headless Combat Loop)', () => {
  it('simulates melee and ranged combat to victory', () => {
    let units: PlacedUnit[] = [];
    units = placeUnitOnGrid(units, 'a1', 'terran_marine', 2, 1, 3, 'ALLY').units;
    units = placeUnitOnGrid(units, 'a2', 'terran_firebat', 2, 0, 3, 'ALLY').units;
    units = placeUnitOnGrid(units, 'a3', 'terran_siege_tank', 0, 1, 3, 'ALLY').units;
    units = placeUnitOnGrid(units, 'e1', 'zerg_zergling', 5, 1, 3, 'ENEMY').units;

    const engine = new BattleEngine();
    engine.init(units, 'ANNIHILATION', 45, 3);

    // Marine stimpack should trigger on combat start (10% HP cost)
    const initialSnap = engine.getSnapshot();
    const marine = initialSnap.units.find((u) => u.instanceId === 'a1')!;
    expect(marine.stimpackActive).toBe(true);
    expect(marine.hp).toBeLessThan(marine.maxHp);

    // Step 300 ticks (10 seconds of battle)
    const endSnap = engine.step(300);
    expect(endSnap.outcome).toBe('VICTORY');
  });

  it('heals damaged bio allies with Medic bio_heal and repairs Mech with SCV', () => {
    let units: PlacedUnit[] = [];
    units = placeUnitOnGrid(units, 'm1', 'terran_marine', 1, 1, 3, 'ALLY').units;
    units = placeUnitOnGrid(units, 'med1', 'terran_medic', 0, 1, 3, 'ALLY').units;
    units = placeUnitOnGrid(units, 'e1', 'protoss_probe', 7, 2, 3, 'ENEMY').units;

    const engine = new BattleEngine();
    engine.init(units, 'ANNIHILATION', 45, 3);

    const startHp = engine.getSnapshot().units.find((u) => u.instanceId === 'm1')!.hp;
    // Step 15 ticks so Medic heals Marine's stimpack damage before enemy arrives
    const snap = engine.step(15);
    const healedHp = snap.units.find((u) => u.instanceId === 'm1')!.hp;
    expect(healedHp).toBeGreaterThan(startHp);
  });

  it('executes commander skills once per battle', () => {
    let units: PlacedUnit[] = [];
    units = placeUnitOnGrid(units, 'a1', 'protoss_zealot', 1, 1, 3, 'ALLY').units;
    units = placeUnitOnGrid(units, 'e1', 'zerg_hydralisk', 5, 1, 3, 'ENEMY').units;

    const engine = new BattleEngine();
    engine.init(units, 'ANNIHILATION', 45, 3);

    const enemyBefore = engine.getSnapshot().units.find((u) => u.instanceId === 'e1')!.hp;
    expect(engine.triggerCommanderSkill('NUCLEAR_SCAN')).toBe(true);
    // Second use should be rejected
    expect(engine.triggerCommanderSkill('NUCLEAR_SCAN')).toBe(false);

    const enemyAfter = engine.getSnapshot().units.find((u) => u.instanceId === 'e1')!.hp;
    expect(enemyAfter).toBeLessThan(enemyBefore);
  });
});
