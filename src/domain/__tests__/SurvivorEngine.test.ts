import { describe, expect, it } from 'vitest';
import { assignSlots, buildSlotOffsets, capacityForRings, pickActiveSlots } from '../survivor/Formation';
import { SpatialHash } from '../survivor/SpatialHash';
import { getAllEnemies, getAllModules, getAllSquadUnits, getFactions, getSquadUnitDef, getWaveTable } from '../survivor/SurvivorCatalog';
import {
  ATTACK_RELEASE_SEC,
  attackWindupSec,
  MARK_DAMAGE_MUL,
  MAX_SQUADS,
  squadHeadcount,
  SURVIVOR_DT,
  SurvivorEngine,
  VANGUARD_FRONT_DAMAGE_TAKEN_MUL,
} from '../survivor/SurvivorEngine';

/** 시작 분대가 없어졌으므로, 분대 보유를 전제로 한 테스트는 추천 분대를 직접 지급한다 */
/** 레벨업·상자 창이 뜨면 첫 선택지로 넘기며 한 틱 진행 */
function stepAuto(e: SurvivorEngine): void {
  if (e.phase === 'LEVEL_UP') e.chooseOffer(0);
  if (e.phase === 'CHEST') e.confirmChest();
  e.step(1);
}

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
    // 진화하면 분대는 Lv1(1명)로 돌아가고, 다시 5명까지 모을 수 있다
    const sq = e.getSquad('ic_rifle')!;
    expect(sq.level).toBe(1);
    expect(e.squad).toHaveLength(1);
    expect(e.squad[0].hp).toBe(e.squad[0].maxHp);
    expect(e.canEvolve(sq)).toBe(false);
    e.confirmChest();
    expect(e.phase).toBe('RUNNING');
    for (let lv = 2; lv <= 5; lv += 1) e.applyOfferDirect({ kind: 'SQUAD_LEVEL', unitId: 'ic_rifle', nextLevel: lv });
    expect(sq.level).toBe(5);
    expect(e.squad).toHaveLength(5);
    expect(e.squad.every((m) => m.def.id === 'ic_gatling')).toBe(true);
  });

  it('elites drop a supply chest', () => {
    const e = new SurvivorEngine('IRONCLAD', 'ic_marshal', 7);
    const elite = e.spawnEnemyAt('crawler', 40, 0, true);
    elite.hp = 1;
    for (let i = 0; i < 300 && e.phase === 'RUNNING' && e.chests.length === 0; i += 1) e.step(1);
    expect(e.chests.length + (e.phase === 'CHEST' ? 1 : 0)).toBeGreaterThan(0);
  });

  it('turret engineers deploy sentry turrets that shoot, and chain lightning damages enemies', () => {
    const e = withStarter(new SurvivorEngine('IRONCLAD', 'ic_engineer', 8), 'ic_sapper');
    e.applyOfferDirect({ kind: 'NEW_SQUAD', unitId: 'ic_tesla' });
    e.step(60);
    for (let i = 0; i < 5; i += 1) e.spawnEnemyAt('crawler', 40 + i * 10, 20);
    e.step(150);
    expect(e.turrets.length).toBeGreaterThan(0);
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

  it('emits dedicated combat effects: BASH, RAIL_TRAIL, HIT_SPARK, DEFLECT, REFLECT, EXECUTE and evolved PLASMA zones', () => {
    const collectEffects = (eng: SurvivorEngine, ticks: number): Set<string> => {
      const seen = new Set<string>();
      for (let i = 0; i < ticks; i += 1) {
        eng.step(1);
        for (const f of eng.effects) {
          seen.add(f.kind + (f.evolved ? ':EVO' : ''));
          seen.add(f.kind);
        }
      }
      return seen;
    };

    // 1. 방패병(ic_shield) 근접 공격 시 SLASH 대신 BASH 이펙트가 생성된다
    const e1 = withStarter(new SurvivorEngine('IRONCLAD', 'ic_vanguard', 41), 'ic_shield');
    e1.step(60);
    e1.commander.cooldown = 1e9;
    const shielder = e1.squad[0];
    shielder.cooldown = 0;
    e1.spawnEnemyAt('brute', shielder.x + 12, shielder.y);
    const seen1 = collectEffects(e1, 20);
    expect(seen1.has('BASH')).toBe(true);

    // 2. 처형자(ic_executioner) 사격 시 EXECUTIONER 탄환과 RAIL_TRAIL이 생성되고, 빈사(<=15%) 적 타격 시 EXECUTE 이펙트가 발생한다
    const e2 = withStarter(new SurvivorEngine('IRONCLAD', 'ic_marshal', 42), 'ic_sniper');
    for (let lv = 2; lv <= 5; lv += 1) e2.applyOfferDirect({ kind: 'SQUAD_LEVEL', unitId: 'ic_sniper', nextLevel: lv });
    e2.applyOfferDirect({ kind: 'NEW_MODULE', moduleId: 'SCOPE' });
    e2.grantChest();
    e2.confirmChest();
    e2.step(60);
    e2.commander.cooldown = 1e9;
    for (const m of e2.squad) m.cooldown = 1e9;
    const exec = e2.squad[0];
    exec.cooldown = 0;
    const dying = e2.spawnEnemyAt('brute', exec.x + 40, exec.y);
    dying.maxHp = 10000;
    dying.hp = 1200; // 12% HP -> 사격 피해 후 15% 이하이므로 즉사(EXECUTE) 발동
    const seen2 = collectEffects(e2, 25);
    expect(seen2.has('RAIL_TRAIL:EVO')).toBe(true);
    expect(seen2.has('EXECUTE')).toBe(true);

    // 3. 갑각충(shelled) 정면 피격 시 DEFLECT 이펙트가 발생한다
    const e3 = withStarter(new SurvivorEngine('IRONCLAD', 'ic_marshal', 43), 'ic_rifle');
    e3.step(60);
    e3.commander.cooldown = 1e9;
    const rifle = e3.squad[0];
    rifle.cooldown = 0;
    const shelled = e3.spawnEnemyAt('shelled', rifle.x + 45, rifle.y);
    shelled.facingAngle = Math.PI; // 아군(왼쪽)을 정면으로 바라봄
    const seen3 = collectEffects(e3, 30);
    expect(seen3.has('DEFLECT')).toBe(true);
    expect(seen3.has('HIT_SPARK')).toBe(true);

    // 4. 성벽 분대(ic_bulwark) 피격 반사 시 REFLECT 이펙트가 발생한다
    const e4 = withStarter(new SurvivorEngine('IRONCLAD', 'ic_vanguard', 44), 'ic_shield');
    for (let lv = 2; lv <= 5; lv += 1) e4.applyOfferDirect({ kind: 'SQUAD_LEVEL', unitId: 'ic_shield', nextLevel: lv });
    e4.applyOfferDirect({ kind: 'NEW_MODULE', moduleId: 'ARMOR' });
    e4.grantChest();
    e4.confirmChest();
    e4.step(60);
    e4.commander.cooldown = 1e9;
    for (const m of e4.squad) m.cooldown = 1e9;
    const bulwark = e4.squad[0];
    e4.spawnEnemyAt('mite', bulwark.x + 4, bulwark.y);
    const seen4 = collectEffects(e4, 25);
    expect(seen4.has('REFLECT')).toBe(true);

    // 5. 소각 분대(ic_incinerator) 공격 시 PLASMA 화염 장판이 생성된다
    const e5 = withStarter(new SurvivorEngine('IRONCLAD', 'ic_marshal', 45), 'ic_flamer');
    for (let lv = 2; lv <= 5; lv += 1) e5.applyOfferDirect({ kind: 'SQUAD_LEVEL', unitId: 'ic_flamer', nextLevel: lv });
    e5.applyOfferDirect({ kind: 'NEW_MODULE', moduleId: 'AREA' });
    e5.grantChest();
    e5.confirmChest();
    e5.step(60);
    e5.commander.cooldown = 1e9;
    const incin = e5.squad[0];
    incin.cooldown = 0;
    e5.spawnEnemyAt('brute', incin.x + 25, incin.y);
    collectEffects(e5, 20);
    expect(e5.zones.some((z) => z.kind === 'PLASMA')).toBe(true);
  });

  it('triggers attackFlashSec and assigns EnemyShotVisual when ranged/summoner enemies fire', () => {
    const e = new SurvivorEngine('IRONCLAD', 'ic_marshal', 46);
    e.commander.cooldown = 1e9;
    const spiker = e.spawnEnemyAt('hive_spiker', e.commander.x + 90, e.commander.y);
    const prism = e.spawnEnemyAt('lumen_prism', e.commander.x + 95, e.commander.y + 20);
    spiker.attackTimer = 0.01;
    prism.attackTimer = 0.01;
    e.step(2);
    expect(spiker.attackFlashSec).toBeGreaterThan(0);
    expect(prism.attackFlashSec).toBeGreaterThan(0);
    const visuals = new Set(e.enemyShots.map((s) => s.visual));
    expect(visuals.has('SPIKE')).toBe(true);
    expect(visuals.has('PRISM')).toBe(true);
  });

  describe('commander passive overhaul', () => {
    it('Field Marshal: commander shots mark targets (+25% damage taken) and bullets pierce one extra enemy', () => {
      const e = withStarter(new SurvivorEngine('IRONCLAD', 'ic_marshal', 51), 'ic_rifle');
      e.step(60);
      for (const m of e.squad) m.cooldown = 1e9;
      const c = e.commander;
      const target = e.spawnEnemyAt('brute', c.x + 50, c.y);
      c.cooldown = 0;
      for (let i = 0; i < 40 && target.markedSec <= 0; i += 1) e.step(1);
      expect(target.markedSec).toBeGreaterThan(0);
      // 표식 대상은 같은 피해에 25% 더 아프다
      const hp0 = target.hp;
      (e as unknown as { damageEnemy(t: unknown, d: number, b: number, x: number): void }).damageEnemy(target, 10, 1, 0);
      expect(hp0 - target.hp).toBeCloseTo(10 * MARK_DAMAGE_MUL, 5);
      // 소총탄 관통 +1
      const m = e.squad[0];
      m.cooldown = 0;
      let maxPierce = -1;
      for (let i = 0; i < 40; i += 1) {
        stepAuto(e);
        for (const p of e.projectiles) if (p.visual === 'RIFLE' && !p.marks) maxPierce = Math.max(maxPierce, p.pierceLeft);
      }
      expect(maxPierce).toBe(1);
    });

    it('Engineer: entrenches in 0.15s, overdrives turrets and charges ally shields only while entrenched', () => {
      const e = withStarter(new SurvivorEngine('IRONCLAD', 'ic_engineer', 52), 'ic_sapper');
      expect(e.entrenchDelaySec).toBeCloseTo(0.15, 5);
      const c = e.commander;
      expect(c.maxShield).toBeCloseTo(c.maxHp * 0.3, 5);
      e.setMoveInput(1, 0);
      e.step(30);
      expect(c.shield).toBe(0);
      e.setMoveInput(0, 0);
      e.step(60);
      expect(e.isEntrenched).toBe(true);
      expect(c.shield).toBeGreaterThan(0);
    });

    it('Vanguard: keeps the entrench damage bonus while moving and front squads take 25% less damage', () => {
      const e = withStarter(new SurvivorEngine('IRONCLAD', 'ic_vanguard', 53), 'ic_shield');
      e.step(60);
      const front = e.squad[0];
      expect(front.def.role).toBe('FRONT');
      const hp0 = front.hp;
      (e as unknown as { damageAlly(a: unknown, d: number): void }).damageAlly(front, 20);
      expect(hp0 - front.hp).toBeCloseTo(20 * VANGUARD_FRONT_DAMAGE_TAKEN_MUL, 5);
      const marshal = withStarter(new SurvivorEngine('IRONCLAD', 'ic_marshal', 53), 'ic_shield');
      marshal.step(60);
      const f2 = marshal.squad[0];
      const h2 = f2.hp;
      (marshal as unknown as { damageAlly(a: unknown, d: number): void }).damageAlly(f2, 20);
      expect(h2 - f2.hp).toBeCloseTo(20, 5);
    });
  });

  it('range hierarchy: shield < flamer < rifle/tesla/turret < mortar < sniper, and mortars ignore enemies inside 45px', () => {
    const r = (id: string): number => getSquadUnitDef(id).attack.rangePx;
    expect(r('ic_shield')).toBeLessThan(r('ic_flamer'));
    expect(r('ic_flamer')).toBeLessThan(r('ic_rifle'));
    expect(r('ic_rifle')).toBeLessThan(r('ic_mortar'));
    expect(r('ic_mortar')).toBeLessThan(r('ic_sniper'));
    expect(r('ic_sniper') / r('ic_rifle')).toBeGreaterThan(3);
    expect(getSquadUnitDef('ic_mortar').attack.minRangePx).toBe(45);

    const e = withStarter(new SurvivorEngine('IRONCLAD', 'ic_marshal', 54), 'ic_mortar');
    e.step(60);
    e.commander.cooldown = 1e9;
    const mortar = e.squad[0];
    mortar.cooldown = 0;
    e.spawnEnemyAt('brute', mortar.x + 20, mortar.y);
    e.step(20);
    expect(e.projectiles.some((p) => p.visual === 'MORTAR')).toBe(false);
  });

  it('turrets: cap is 2 + squad level, last 12s, and the evolved heavy turret lobs grenades and leaves fire when it expires', () => {
    const e = withStarter(new SurvivorEngine('IRONCLAD', 'ic_engineer', 55), 'ic_sapper');
    for (let lv = 2; lv <= 5; lv += 1) e.applyOfferDirect({ kind: 'SQUAD_LEVEL', unitId: 'ic_sapper', nextLevel: lv });
    e.commander.cooldown = 1e9;
    let maxOwned = 0;
    for (let i = 0; i < 30 * 20; i += 1) {
      if (i % 30 === 0) e.spawnEnemyAt('brute', e.commander.x + 70, e.commander.y + ((i / 30) % 5) * 8 - 16);
      e.commander.hp = e.commander.maxHp;
      stepAuto(e);
      maxOwned = Math.max(maxOwned, e.turrets.length);
    }
    expect(maxOwned).toBeGreaterThan(2);
    expect(maxOwned).toBeLessThanOrEqual(7);
    expect(e.turrets.every((t) => t.lifeSec <= 12)).toBe(true);

    const h = withStarter(new SurvivorEngine('IRONCLAD', 'ic_engineer', 56), 'ic_sapper');
    for (let lv = 2; lv <= 5; lv += 1) h.applyOfferDirect({ kind: 'SQUAD_LEVEL', unitId: 'ic_sapper', nextLevel: lv });
    h.applyOfferDirect({ kind: 'NEW_MODULE', moduleId: 'MOBILITY' });
    h.grantChest();
    h.confirmChest();
    expect(h.squad[0].def.id).toBe('ic_minelayer');
    h.commander.cooldown = 1e9;
    let sawGrenade = false;
    for (let i = 0; i < 30 * 16; i += 1) {
      if (i % 20 === 0) h.spawnEnemyAt('brute', h.commander.x + 60, h.commander.y);
      h.commander.hp = h.commander.maxHp;
      stepAuto(h);
      if (h.projectiles.some((p) => p.visual === 'MORTAR')) sawGrenade = true;
    }
    expect(sawGrenade).toBe(true);
    expect(h.zones.some((z) => z.kind === 'PLASMA')).toBe(true);
  });

  it('flamers channel a continuous stream, then cool down; cooldown shrinks with squad level', () => {
    const e = withStarter(new SurvivorEngine('IRONCLAD', 'ic_marshal', 57), 'ic_flamer');
    e.step(60);
    e.commander.cooldown = 1e9;
    const f = e.squad[0];
    f.cooldown = 0;
    const brute = e.spawnEnemyAt('brute', f.x + 30, f.y);
    brute.speed = 0;
    let channelTicks = 0;
    let sawCooldown = false;
    for (let i = 0; i < 30 * 4; i += 1) {
      brute.hp = brute.maxHp;
      e.step(1);
      channelTicks = Math.max(channelTicks, f.channelTicks);
      if (channelTicks > 0 && f.channelSec === 0 && f.cooldown > 1) sawCooldown = true;
    }
    // 2초 / 0.13초 ≈ 15회 판정
    expect(channelTicks).toBeGreaterThanOrEqual(13);
    expect(sawCooldown).toBe(true);
    const cd = (eng: SurvivorEngine, lv: number): number =>
      (eng as unknown as { channelCooldown(a: unknown, l: number, r: number): number }).channelCooldown(getSquadUnitDef('ic_flamer').attack, lv, 1);
    expect(cd(e, 1)).toBeCloseTo(2.4, 5);
    expect(cd(e, 5)).toBeLessThan(cd(e, 1));
    expect((e as unknown as { channelCooldown(a: unknown, l: number, r: number): number }).channelCooldown(getSquadUnitDef('ic_flamer').attack, 5, 0.3)).toBeCloseTo(0.7, 5);
  });

  it('fast sniper rounds never tunnel through small enemies (swept collision)', () => {
    let shots = 0;
    let hits = 0;
    for (let trial = 0; trial < 20; trial += 1) {
      const e = withStarter(new SurvivorEngine('IRONCLAD', 'ic_engineer', 100 + trial), 'ic_sniper');
      e.step(60);
      e.commander.cooldown = 1e9;
      const m = e.squad[0];
      const ang = trial * 0.31;
      const dist = 120 + trial * 6;
      const t = e.spawnEnemyAt('mite', m.x + Math.cos(ang) * dist, m.y + Math.sin(ang) * dist);
      t.speed = 0;
      t.maxHp = t.hp = 1000;
      m.cooldown = 0;
      let fired = false;
      for (let i = 0; i < 45; i += 1) {
        e.step(1);
        if (e.projectiles.some((p) => p.visual === 'SNIPER')) fired = true;
      }
      if (fired) {
        shots += 1;
        if (t.hp < 1000) hits += 1;
      }
    }
    expect(shots).toBe(20);
    expect(hits).toBe(20);
  });
});

