import { describe, expect, it } from 'vitest';
import { BattleEngine, FIXED_DT } from '../combat/BattleEngine';
import { calculateDamage } from '../combat/DamageCalc';
import { evaluateStageOutcome } from '../combat/StageRule';
import { placeUnitOnGrid } from '../grid/GridSystem';
import { calculateSynergies } from '../synergy/SynergyCalc';
import { getAllUnits, getStartingWorkerId } from '../UnitCatalog';
import type { PlacedUnit } from '../types';

describe('Domain Contracts & Catalog', () => {
  it('loads all 3 races and starting workers cleanly', () => {
    const units = getAllUnits();
    expect(units.length).toBeGreaterThanOrEqual(15);
    expect(getStartingWorkerId('TERRAN')).toBe('terran_scv');
    expect(getStartingWorkerId('ZERG')).toBe('zerg_drone');
    expect(getStartingWorkerId('PROTOSS')).toBe('protoss_probe');
  });

  it('computes active synergies from placed ally units', () => {
    let units: PlacedUnit[] = [];
    units = placeUnitOnGrid(units, 'a1', 'terran_marine', 0, 0, 3, 'ALLY').units;
    units = placeUnitOnGrid(units, 'a2', 'terran_firebat', 1, 0, 3, 'ALLY').units;

    const summary = calculateSynergies(units);
    expect(summary.totalUnits).toBe(2);
    expect(summary.raceCounts.TERRAN).toBe(2);
    const bio = summary.activeSynergies.find((s) => s.tag === 'BIO');
    expect(bio?.active).toBe(true);
    expect(bio?.count).toBe(2);
  });

  it('computes shield-first damage and armored bonus', () => {
    const res = calculateDamage({
      baseAttack: 20,
      targetArmorType: 'ARMORED',
      targetShield: 10,
      targetHp: 50,
      bonusVsArmoredPct: 0.25,
    });
    expect(res.shieldDamage).toBe(10);
    expect(res.hpDamage).toBe(15);
    expect(res.remainingShield).toBe(0);
    expect(res.remainingHp).toBe(35);
    expect(res.killed).toBe(false);
  });

  it('evaluates stage outcomes and headless BattleEngine fixed timestep', () => {
    let units: PlacedUnit[] = [];
    units = placeUnitOnGrid(units, 'a1', 'protoss_probe', 0, 0, 3, 'ALLY').units;
    units = placeUnitOnGrid(units, 'e1', 'zerg_drone', 5, 0, 3, 'ENEMY').units;

    const engine = new BattleEngine();
    engine.init(units, 'ANNIHILATION', 45);
    const snap = engine.step(30);
    expect(snap.tick).toBe(30);
    expect(snap.elapsedSec).toBeCloseTo(30 * FIXED_DT, 5);
    expect(snap.outcome).toBe('ONGOING');

    expect(
      evaluateStageOutcome('BREAKTHROUGH', snap.units, 5, 60, true)
    ).toBe('VICTORY');
  });
});
