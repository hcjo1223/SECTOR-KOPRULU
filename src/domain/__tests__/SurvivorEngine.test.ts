import { describe, expect, it } from 'vitest';
import { assignSlots, buildSlotOffsets, capacityForRings, pickActiveSlots } from '../survivor/Formation';
import { SpatialHash } from '../survivor/SpatialHash';
import { getAllEnemies, getAllModules, getAllSquadUnits, getFactions, getSquadUnitDef, getWaveTable } from '../survivor/SurvivorCatalog';
import { MAX_SQUADS, squadHeadcount, SurvivorEngine } from '../survivor/SurvivorEngine';

/** 시작 분대가 없어졌으므로, 분대 보유를 전제로 한 테스트는 추천 분대를 직접 지급한다 */
function withStarter(e: SurvivorEngine, unitId: string): SurvivorEngine {
  e.applyOfferDirect({ kind: 'NEW_SQUAD', unitId });
  return e;
}

describe('Survivor data contracts', () => {
  it('every faction pool, commander start and evolution references existing data', () => {
    const unitIds = new Set(getAllSquadUnits().map((u) => u.id));
    const moduleIds = new Set(getAllModules().map((m) => m.id));
    for (const f of getFactions()) {
      expect(f.commanders.length).toBeGreaterThan(0);
      for (const id of f.unitPool) expect(unitIds.has(id)).toBe(true);
      for (const c of f.commanders) expect(f.unitPool).toContain(c.startingSquad);
      for (const id of f.unitPool) {
        const evo = getSquadUnitDef(id).evolution;
        if (evo) {
          expect(moduleIds.has(evo.moduleId)).toBe(true);
          expect(getSquadUnitDef(evo.intoId).evolved).toBe(true);
        }
      }
    }
  });

  it('IRONCLAD has 3 commanders, 8 squads with 8 distinct evolutions, both targeting modes', () => {
    const f = getFactions().find((x) => x.id === 'IRONCLAD')!;
    expect(f.commanders).toHaveLength(3);
    expect(f.unitPool).toHaveLength(8);
    const defs = f.unitPool.map(getSquadUnitDef);
    expect(new Set(defs.map((d) => d.evolution?.intoId)).size).toBe(8);
    expect(new Set(defs.map((d) => d.attack.targeting))).toEqual(new Set(['AUTO', 'FACING']));
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
  it('starts with the commander alone; first level-up guarantees the recommended squad', () => {
    const e = new SurvivorEngine('IRONCLAD', 'ic_engineer', 1);
    expect(e.phase).toBe('RUNNING');
    expect(e.squads).toHaveLength(0);
    expect(e.squad).toHaveLength(0);
    for (let seed = 1; seed <= 20; seed += 1) {
      const r = new SurvivorEngine('IRONCLAD', 'ic_engineer', seed);
      const offers = (r as unknown as { rollOffers(n: number): { kind: string; unitId?: string }[] }).rollOffers(3);
      expect(offers.some((o) => o.kind === 'NEW_SQUAD' && o.unitId === 'ic_sapper')).toBe(true);
    }
  });

  it('squad headcount equals level: Lv1 1 member -> Lv5 5 members', () => {
    expect(squadHeadcount(1)).toBe(1);
    expect(squadHeadcount(5)).toBe(5);
    const e = new SurvivorEngine('IRONCLAD', 'ic_marshal', 1);
    e.applyOfferDirect({ kind: 'NEW_SQUAD', unitId: 'ic_rifle' });
    expect(e.squad).toHaveLength(1);
    for (let lv = 2; lv <= 5; lv += 1) e.applyOfferDirect({ kind: 'SQUAD_LEVEL', unitId: 'ic_rifle', nextLevel: lv });
    expect(e.squad).toHaveLength(5);
  });

  it('squad follows the commander when it moves', () => {
    const e = new SurvivorEngine('LUMEN', undefined, 2);
    e.setMoveInput(1, 0);
    e.step(90);
    const c = e.commander;
    expect(c.x).toBeGreaterThan(150);
    for (const m of e.squad) {
      expect(Math.hypot(m.x - c.x, m.y - c.y)).toBeLessThan(60);
    }
  });

  it('kills nearby enemies', () => {
    const e = new SurvivorEngine('IRONCLAD', 'ic_marshal', 3);
    e.spawnEnemyAt('mite', 60, 0);
    e.step(60);
    expect(e.kills).toBeGreaterThanOrEqual(1);
  });

  it('caps squads and modules at 4 slots and squad level adds a member', () => {
    const e = withStarter(new SurvivorEngine('IRONCLAD', 'ic_marshal', 4), 'ic_rifle');
    for (const id of ['ic_flamer', 'ic_mortar', 'ic_sniper', 'ic_shield']) e.applyOfferDirect({ kind: 'NEW_SQUAD', unitId: id });
    expect(e.squads).toHaveLength(MAX_SQUADS);
    for (const id of ['RAPID', 'AREA', 'CORE', 'SCOPE', 'BEACON'] as const) e.applyOfferDirect({ kind: 'NEW_MODULE', moduleId: id });
    expect(e.modules).toHaveLength(4);
    const before = e.aliveInSquad('ic_rifle');
    e.applyOfferDirect({ kind: 'SQUAD_LEVEL', unitId: 'ic_rifle', nextLevel: 2 });
    expect(e.aliveInSquad('ic_rifle')).toBe(before + 1);
  });

  it('level-up offers never exceed slot limits', () => {
    const e = withStarter(new SurvivorEngine('IRONCLAD', 'ic_marshal', 5), 'ic_rifle');
    for (const id of ['ic_flamer', 'ic_mortar', 'ic_sniper']) e.applyOfferDirect({ kind: 'NEW_SQUAD', unitId: id });
    for (const id of ['RAPID', 'AREA', 'CORE', 'SCOPE'] as const) e.applyOfferDirect({ kind: 'NEW_MODULE', moduleId: id });
    for (let i = 0; i < 20; i += 1) {
      e.grantXp(e.xpToNext);
      for (const o of e.offers) {
        expect(o.kind).not.toBe('NEW_SQUAD');
        expect(o.kind).not.toBe('NEW_MODULE');
      }
      e.chooseOffer(0);
    }
  });

  it('chest evolves a Lv5 squad that owns its recipe module', () => {
    const e = withStarter(new SurvivorEngine('IRONCLAD', 'ic_marshal', 6), 'ic_rifle');
    for (let lv = 2; lv <= 5; lv += 1) e.applyOfferDirect({ kind: 'SQUAD_LEVEL', unitId: 'ic_rifle', nextLevel: lv });
    expect(e.canEvolve(e.getSquad('ic_rifle')!)).toBe(false);
    e.applyOfferDirect({ kind: 'NEW_MODULE', moduleId: 'RAPID' });
    expect(e.canEvolve(e.getSquad('ic_rifle')!)).toBe(true);
    e.grantChest();
    expect(e.phase).toBe('CHEST');
    expect(e.chestResult).toEqual({ kind: 'EVOLVE', fromId: 'ic_rifle', intoId: 'ic_gatling' });
    expect(e.squad.every((m) => m.def.id === 'ic_gatling')).toBe(true);
    e.confirmChest();
    expect(e.phase).toBe('RUNNING');
  });

  it('elites drop a supply chest', () => {
    const e = new SurvivorEngine('IRONCLAD', 'ic_marshal', 7);
    const elite = e.spawnEnemyAt('crawler', 40, 0, true);
    elite.hp = 1;
    for (let i = 0; i < 300 && e.phase === 'RUNNING' && e.chests.length === 0; i += 1) e.step(1);
    expect(e.chests.length + (e.phase === 'CHEST' ? 1 : 0)).toBeGreaterThan(0);
  });

  it('mines and chain lightning damage enemies', () => {
    const e = withStarter(new SurvivorEngine('IRONCLAD', 'ic_engineer', 8), 'ic_sapper');
    e.applyOfferDirect({ kind: 'NEW_SQUAD', unitId: 'ic_tesla' });
    e.step(90);
    expect(e.mines.length).toBeGreaterThan(0);
    for (let i = 0; i < 5; i += 1) e.spawnEnemyAt('crawler', 30 + i * 10, 20);
    e.step(90);
    expect(e.kills).toBeGreaterThan(0);
  });

  it('dead members vanish permanently; reinforce refills; commander death is immediate defeat', () => {
    const e = withStarter(new SurvivorEngine('IRONCLAD', 'ic_marshal', 9), 'ic_rifle');
    e.applyOfferDirect({ kind: 'SQUAD_LEVEL', unitId: 'ic_rifle', nextLevel: 2 });
    e.step(60); // 진형 슬롯에 자리 잡을 때까지
    const startCount = e.squad.length;
    const victim = e.squad[0];
    victim.hp = 1;
    e.spawnEnemyAt('brute', victim.x, victim.y);
    e.step(5);
    expect(e.squad.includes(victim)).toBe(false);
    expect(e.squad).toHaveLength(startCount - 1);
    e.applyOfferDirect({ kind: 'REINFORCE', missing: 1 });
    expect(e.squad).toHaveLength(startCount);

    e.commander.hp = 1;
    e.commander.shield = 0;
    e.spawnEnemyAt('brute', e.commander.x, e.commander.y);
    e.step(5);
    expect(e.phase).toBe('DEFEAT');
  });
});
