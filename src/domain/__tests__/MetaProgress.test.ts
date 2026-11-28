import { describe, expect, it } from 'vitest';
import {
  buyUpgrade,
  INITIAL_META,
  isCommanderUnlocked,
  metaBonuses,
  nextUpgradeCost,
  recordRun,
  runReward,
  sanitizeMeta,
  unlockCommander,
} from '../survivor/MetaProgress';
import { SurvivorEngine } from '../survivor/SurvivorEngine';

describe('MetaProgress (본부)', () => {
  it('only the field marshal is unlocked at first; others cost tactical data', () => {
    expect(isCommanderUnlocked(INITIAL_META, 'ic_marshal')).toBe(true);
    expect(isCommanderUnlocked(INITIAL_META, 'ic_engineer')).toBe(false);
    expect(unlockCommander(INITIAL_META, 'ic_engineer')).toBeNull();
    const rich = { ...INITIAL_META, data: 200 };
    const after = unlockCommander(rich, 'ic_engineer')!;
    expect(after.data).toBe(50);
    expect(isCommanderUnlocked(after, 'ic_engineer')).toBe(true);
    expect(unlockCommander(after, 'ic_engineer')).toBeNull();
  });

  it('run reward: 1 per 10s + 1 per 25 kills + 30 per mid-boss + 120 for victory', () => {
    expect(runReward({ elapsedSec: 300, kills: 400, minibossKills: 1, victory: false })).toBe(30 + 16 + 30);
    expect(runReward({ elapsedSec: 600, kills: 1000, minibossKills: 4, victory: true })).toBe(60 + 40 + 120 + 120);
    const { state, earned } = recordRun(INITIAL_META, { elapsedSec: 125, kills: 60, minibossKills: 0, victory: false });
    expect(earned).toBe(12 + 2);
    expect(state.data).toBe(14);
    expect(state.runs).toBe(1);
    expect(state.bestSec).toBe(125);
  });

  it('upgrades escalate in cost, cap at max level, and turn into run bonuses', () => {
    let s = { ...INITIAL_META, data: 10_000 };
    expect(nextUpgradeCost(s, 'HP')).toBe(40);
    for (let i = 0; i < 5; i += 1) s = buyUpgrade(s, 'HP')!;
    expect(nextUpgradeCost(s, 'HP')).toBeNull();
    expect(buyUpgrade(s, 'HP')).toBeNull();
    s = buyUpgrade(s, 'REROLL')!;
    const b = metaBonuses(s);
    expect(b.maxHpMul).toBeCloseTo(1.25, 5);
    expect(b.extraRerolls).toBe(1);
    expect(buyUpgrade({ ...INITIAL_META, data: 10 }, 'XP')).toBeNull();
  });

  it('sanitizes corrupted or old saves', () => {
    expect(sanitizeMeta(null)).toEqual(INITIAL_META);
    const s = sanitizeMeta({ data: -5, upgrades: { HP: 99, BOGUS: 3 }, unlockedCommanders: ['ic_vanguard', 7] });
    expect(s.data).toBe(0);
    expect(s.upgrades.HP).toBe(5);
    expect(s.unlockedCommanders).toContain('ic_marshal');
    expect(s.unlockedCommanders).toContain('ic_vanguard');
  });

  it('engine applies meta bonuses: commander HP, damage, pickup and rerolls', () => {
    const base = new SurvivorEngine('IRONCLAD', 'ic_marshal', 5);
    const boosted = new SurvivorEngine('IRONCLAD', 'ic_marshal', 5, { maxHpMul: 1.25, damageMul: 1.2, pickupMul: 1.3, extraRerolls: 2 });
    expect(boosted.commander.maxHp / base.commander.maxHp).toBeCloseTo(1.25, 5);
    expect(boosted.damageMul() / base.damageMul()).toBeCloseTo(1.2, 5);
    expect(boosted.pickupRadius / base.pickupRadius).toBeCloseTo(1.3, 5);
    expect(boosted.rerollsPerLevelUp).toBe(3);
  });
});
