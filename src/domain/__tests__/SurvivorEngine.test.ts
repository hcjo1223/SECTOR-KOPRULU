import { describe, expect, it } from 'vitest';
import { assignSlots, buildSlotOffsets, capacityForRings, pickActiveSlots } from '../survivor/Formation';
import { SpatialHash } from '../survivor/SpatialHash';
import { getAllEnemies, getAllModules, getAllSquadUnits, getFactions, getSquadUnitDef, getWaveTable } from '../survivor/SurvivorCatalog';
import { ATTACK_RELEASE_SEC, attackWindupSec, MAX_SQUADS, squadHeadcount, SURVIVOR_DT, SurvivorEngine } from '../survivor/SurvivorEngine';

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
    const e = withStarter(new SurvivorEngine('IRONCLAD', undefined, 2), 'ic_rifle');
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

  it('attacks play a windup (ATTACK 0) before the hit lands, then the release frames', () => {
    const e = withStarter(new SurvivorEngine('IRONCLAD', 'ic_marshal', 21), 'ic_rifle');
    e.step(60);
    const m = e.squad[0];
    m.cooldown = 0;
    e.commander.cooldown = 99;
    const target = e.spawnEnemyAt('brute', m.x + 50, m.y);
    const hp0 = target.hp;
    e.step(1);
    expect(m.windupSec).toBeGreaterThan(0);
    expect(m.attackFlashSec).toBe(0);
    // 예비동작 중에는 아무 탄도 나가지 않는다
    expect(e.projectiles.length).toBe(0);
    const windupTicks = Math.ceil(attackWindupSec(m.def.attack.cooldownSec) / SURVIVOR_DT);
    e.step(windupTicks);
    expect(m.windupSec).toBe(0);
    expect(m.attackFlashSec).toBeGreaterThan(0);
    expect(m.attackFlashSec).toBeLessThanOrEqual(ATTACK_RELEASE_SEC);
    expect(e.projectiles.length + (target.hp < hp0 ? 1 : 0)).toBeGreaterThan(0);
  });

  it('windup does not change damage per second: attack cadence still equals the cooldown', () => {
    const e = withStarter(new SurvivorEngine('IRONCLAD', 'ic_marshal', 22), 'ic_rifle');
    e.step(60);
    const m = e.squad[0];
    e.commander.cooldown = 1e9;
    const t = e.spawnEnemyAt('brute', m.x + 40, m.y);
    let shots = 0;
    let prev = 0;
    const seconds = 12;
    for (let i = 0; i < seconds / SURVIVOR_DT; i += 1) {
      t.hp = t.maxHp;
      t.x = m.x + 40;
      t.y = m.y;
      e.step(1);
      if (m.attackFlashSec > prev) shots += 1;
      prev = m.attackFlashSec;
    }
    const expected = seconds / m.def.attack.cooldownSec;
    expect(Math.abs(shots - expected)).toBeLessThanOrEqual(2);
  });

  it('enemy bites wind up first and whiff if the target escapes the reach in time', () => {
    const e = new SurvivorEngine('IRONCLAD', 'ic_marshal', 23);
    e.commander.cooldown = 1e9;
    const c = e.commander;
    const mite = e.spawnEnemyAt('mite', c.x + c.radius + 4, c.y);
    const hp0 = c.hp + c.shield;
    e.step(1);
    expect(mite.windupSec).toBeGreaterThan(0);
    expect(c.hp + c.shield).toBe(hp0);
    // 예비동작 사이에 멀리 벗어나면 빗나간다
    c.x -= 60;
    e.step(8);
    expect(c.hp + c.shield).toBe(hp0);
    expect(mite.attackFlashSec).toBe(0);
  });

  it('Nova Taskforce is the only player faction; hive and lumen units fight as enemies', () => {
    const factions = getFactions();
    expect(factions.map((f) => f.id)).toEqual(['IRONCLAD']);
    expect(factions[0].name).toBe('노바 기동군');
    expect(getAllSquadUnits().every((u) => u.id.startsWith('ic_'))).toBe(true);
    const enemyIds = new Set(getAllEnemies().map((e) => e.id));
    for (const id of ['clawling', 'hive_spiker', 'hive_acid', 'hive_beetle', 'hive_will', 'lumen_warden', 'lumen_prism', 'lumen_lancer', 'lumen_orb', 'lumen_archbishop']) {
      expect(enemyIds.has(id), id).toBe(true);
    }
    const w = getWaveTable();
    const scheduled = new Set([...w.streams.map((s) => s.enemyId), ...w.events.map((ev) => ev.enemyId)]);
    for (const id of enemyIds) {
      if (id !== 'splitter_half') expect(scheduled.has(id) || ['matron', 'queen', 'spire', 'nest'].includes(id), `${id} scheduled`).toBe(true);
    }
  });

  it('the hive mid-boss summons clawlings instead of mites', () => {
    const e = new SurvivorEngine('IRONCLAD', 'ic_marshal', 31);
    e.commander.cooldown = 1e9;
    const boss = e.spawnEnemyAt('hive_will', e.commander.x + 120, e.commander.y);
    boss.isBoss = false;
    for (let i = 0; i < 30 * 30 && !e.enemies.some((x) => x.def.id === 'clawling'); i += 1) {
      e.commander.hp = e.commander.maxHp;
      e.step(1);
    }
    expect(e.enemies.some((x) => x.def.id === 'clawling')).toBe(true);
    // 갈퀴충 웨이브는 1:30부터라 그 전에 나타난 갈퀴충은 소환된 하수인이다
    expect(e.elapsedSec).toBeLessThan(90);
  });
});

