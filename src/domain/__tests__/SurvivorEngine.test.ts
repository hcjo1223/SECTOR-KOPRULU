import { describe, expect, it } from 'vitest';
import { assignSlots, buildSlotOffsets, capacityForRings, pickActiveSlots } from '../survivor/Formation';
import { SpatialHash } from '../survivor/SpatialHash';
import { getAllEnemies, getAllSquadUnits, getFactions, getWaveTable } from '../survivor/SurvivorCatalog';
import { SurvivorEngine } from '../survivor/SurvivorEngine';

describe('Survivor data contracts', () => {
  it('every faction references existing units and has both targeting modes in its pool', () => {
    const unitIds = new Set(getAllSquadUnits().map((u) => u.id));
    for (const f of getFactions()) {
      for (const id of [...f.unitPool, ...f.startingUnits]) {
        expect(unitIds.has(id)).toBe(true);
      }
      const modes = new Set(getAllSquadUnits().filter((u) => f.unitPool.includes(u.id)).map((u) => u.attack.targeting));
      expect(modes.has('AUTO')).toBe(true);
      expect(modes.has('FACING')).toBe(true);
    }
  });

  it('wave table references existing enemies and has exactly one boss event', () => {
    const ids = new Set(getAllEnemies().map((e) => e.id));
    const w = getWaveTable();
    for (const s of w.streams) expect(ids.has(s.enemyId)).toBe(true);
    for (const e of w.events) expect(ids.has(e.enemyId)).toBe(true);
    expect(w.events.filter((e) => e.kind === 'BOSS')).toHaveLength(1);
  });
});

describe('Formation', () => {
  it('rings hold 6k slots', () => {
    expect(capacityForRings(1)).toBe(6);
    expect(capacityForRings(2)).toBe(18);
    expect(capacityForRings(3)).toBe(36);
    expect(buildSlotOffsets(2)).toHaveLength(18);
  });

  it('spreads a partial ring evenly', () => {
    expect(pickActiveSlots(2, 1)).toEqual([0, 3]);
    expect(pickActiveSlots(8, 2)).toEqual([0, 1, 2, 3, 4, 5, 6, 12]);
  });

  it('puts BACK units inside and FRONT units outside', () => {
    const slots = assignSlots(['FRONT', 'BACK', 'FRONT', 'BACK', 'BACK', 'BACK', 'BACK', 'BACK'], 2);
    // 8명: 1링 6칸 + 2링 2칸. FRONT 두 명이 바깥 2링 슬롯을 받는다.
    expect(slots[0]).toBeGreaterThanOrEqual(6);
    expect(slots[2]).toBeGreaterThanOrEqual(6);
    expect(slots[1]).toBeLessThan(6);
    expect(new Set(slots).size).toBe(8);
  });
});

describe('SpatialHash', () => {
  it('returns candidates in neighbouring cells only', () => {
    const h = new SpatialHash(32);
    h.insert(0, 10, 10);
    h.insert(1, 40, 10);
    h.insert(2, 500, 500);
    h.insert(3, -20, -20);
    const out: number[] = [];
    h.query(12, 12, 30, out);
    expect(out.sort()).toEqual([0, 1, 3]);
    h.clear();
    expect(h.query(12, 12, 30, out)).toHaveLength(0);
  });
});

describe('SurvivorEngine', () => {
  it('starts with commander and starting squad in formation', () => {
    const e = new SurvivorEngine('IRONCLAD', 1);
    expect(e.phase).toBe('RUNNING');
    expect(e.squad).toHaveLength(e.faction.startingUnits.length);
    expect(e.squadCapacity).toBe(6);
  });

  it('squad follows the commander when it moves', () => {
    const e = new SurvivorEngine('LUMEN', 2);
    e.setMoveInput(1, 0);
    e.step(90); // 3초
    const c = e.commander;
    expect(c.x).toBeGreaterThan(150);
    for (const m of e.squad) {
      expect(Math.hypot(m.x - c.x, m.y - c.y)).toBeLessThan(60);
    }
  });

  it('kills nearby enemies and drops xp gems', () => {
    const e = new SurvivorEngine('IRONCLAD', 3);
    e.spawnEnemyAt('mite', 60, 0);
    e.step(60);
    expect(e.kills).toBeGreaterThanOrEqual(1);
  });

  it('RECRUIT offer adds a unit to the squad', () => {
    const e = new SurvivorEngine('HIVE', 4);
    // 산성 분사체 합류
    e.grantXp(e.xpToNext);
    expect(e.phase).toBe('LEVEL_UP');
    e.offers = [{ kind: 'RECRUIT', unitId: 'hv_spewer' }, { kind: 'RESUPPLY' }, { kind: 'RESUPPLY' }];
    e.chooseOffer(0);
    expect(e.squad.some((m) => m.def.id === 'hv_spewer')).toBe(true);
    expect(e.phase).toBe('RUNNING');
  });

  it('level-up pauses the run with 3 offers and resumes after choosing', () => {
    const e = new SurvivorEngine('IRONCLAD', 5);
    e.grantXp(e.xpToNext * 3);
    expect(e.phase).toBe('LEVEL_UP');
    expect(e.offers).toHaveLength(3);
    const before = e.elapsedSec;
    e.step(30);
    expect(e.elapsedSec).toBe(before); // 일시정지 중엔 진행 안 함
    e.chooseOffer(0);
    e.chooseOffer(0);
    e.chooseOffer(0);
    expect(e.phase).toBe('RUNNING');
  });

  it('dead squad members vanish permanently and commander death is immediate defeat', () => {
    const e = new SurvivorEngine('IRONCLAD', 6);
    const startCount = e.squad.length;
    const victim = e.squad[0];
    victim.hp = 1;
    e.spawnEnemyAt('brute', victim.x, victim.y);
    e.step(5);
    expect(e.squad.includes(victim)).toBe(false);
    expect(e.squad).toHaveLength(startCount - 1);

    e.commander.hp = 1;
    e.commander.shield = 0;
    e.spawnEnemyAt('brute', e.commander.x, e.commander.y);
    e.step(5);
    expect(e.phase).toBe('DEFEAT');
  });

  it('survives the opening minute idle and keeps enemy count bounded', () => {
    const e = new SurvivorEngine('HIVE', 7);
    for (let t = 0; t < 60 * 30 && e.phase !== 'DEFEAT'; t += 1) {
      if (e.phase === 'LEVEL_UP') e.chooseOffer(0);
      e.setMoveInput(Math.cos(t / 90), Math.sin(t / 90));
      e.step(1);
    }
    expect(e.phase).not.toBe('DEFEAT');
    expect(e.enemies.length).toBeLessThanOrEqual(getWaveTable().maxEnemies + 60);
    expect(e.kills).toBeGreaterThan(20);
  });
});
