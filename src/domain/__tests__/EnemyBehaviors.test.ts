import { describe, expect, it } from 'vitest';
import { SurvivorEngine } from '../survivor/SurvivorEngine';

/** 부대·지휘관 공격이 끼어들지 않도록 아군을 멀리 치운 엔진 */
function isolated(seed = 1): SurvivorEngine {
  const e = new SurvivorEngine('IRONCLAD', 'ic_marshal', seed);
  for (const m of e.squad) m.alive = false;
  e.step(1);
  e.commander.def = { ...e.commander.def, attack: { ...e.commander.def.attack, damage: 0 } };
  return e;
}

describe('Enemy behaviors', () => {
  it('charger telegraphs then dashes much faster than its walk speed', () => {
    const e = isolated(1);
    const ch = e.spawnEnemyAt('charger', 105, 0);
    ch.attackTimer = 0;
    e.step(1);
    expect(ch.mode).toBe('AIM');
    expect(e.effects.some((f) => f.kind === 'TELE_LINE')).toBe(true);
    const x0 = ch.x;
    e.step(Math.ceil((0.7 + 0.55) * 30) + 2);
    // 조준 0.7초 + 돌진 0.55초: 걷기라면 ~1.25×speed, 돌진이면 훨씬 멀리 이동
    expect(Math.abs(ch.x - x0)).toBeGreaterThan(ch.speed * 2);
  });

  it('spitter fires hostile shots that damage the commander', () => {
    const e = isolated(2);
    const sp = e.spawnEnemyAt('spitter_e', 110, 0);
    sp.attackTimer = 0;
    const hp0 = e.commander.hp;
    e.step(60);
    expect(e.commander.hp).toBeLessThan(hp0);
  });

  it('splitter spawns mites on death', () => {
    const e = isolated(3);
    const s = e.spawnEnemyAt('splitter', 200, 0);
    s.hp = 0;
    s.alive = false;
    const before = e.enemies.filter((x) => x.def.id === 'mite').length;
    e.step(1);
    expect(e.enemies.filter((x) => x.def.id === 'mite').length).toBe(before + 3);
  });

  it('bomber fuses next to an ally and explodes without granting a kill', () => {
    const e = isolated(4);
    e.spawnEnemyAt('bomber', 14, 0);
    const hp0 = e.commander.hp;
    e.step(40);
    expect(e.commander.hp).toBeLessThan(hp0);
    expect(e.enemies.some((x) => x.def.id === 'bomber')).toBe(false);
    expect(e.kills).toBe(0);
  });

  it('crossing swarm leaves silently after passing', () => {
    const e = isolated(5);
    const m = e.spawnEnemyAt('mite', 0, -200);
    m.behavior = 'LINE';
    m.dirX = 0;
    m.dirY = -1;
    m.lifeSec = 0.5;
    e.step(20);
    expect(e.enemies.includes(m)).toBe(false);
    expect(e.kills).toBe(0);
  });

  it('nest keeps producing mites and drops a chest when destroyed', () => {
    const e = isolated(6);
    const n = e.spawnEnemyAt('nest', 150, 0);
    e.step(30 * 4);
    expect(e.enemies.filter((x) => x.def.id === 'mite').length).toBeGreaterThan(0);
    n.hp = 0;
    n.alive = false;
    e.step(1);
    expect(e.chests.length + (e.phase === 'CHEST' ? 1 : 0)).toBeGreaterThan(0);
  });

  it('elite affixes: SHIELDED gets a shield, SPLIT spawns mites', () => {
    let shielded = false;
    for (let seed = 1; seed < 40 && !shielded; seed += 1) {
      const e = isolated(seed);
      const el = e.spawnEnemyAt('crawler', 200, 0, true);
      expect(el.affixes.length).toBeGreaterThan(0);
      if (el.affixes.includes('SHIELDED')) {
        expect(el.shield).toBeGreaterThan(0);
        shielded = true;
      }
    }
    expect(shielded).toBe(true);
  });

  it('mini-boss drops two chests and the final boss ends the run', () => {
    const e = isolated(7);
    e.commander.hp = 99999;
    e.commander.maxHp = 99999;
    const q = e.spawnEnemyAt('queen', 200, 0);
    q.isBoss = true;
    q.hp = 0;
    q.alive = false;
    e.step(1);
    expect(e.chests.length).toBeGreaterThanOrEqual(2);
  });

  it('overcharge appears once every slot is maxed', () => {
    const e = new SurvivorEngine('IRONCLAD', 'ic_marshal', 8);
    for (const id of ['ic_flamer', 'ic_mortar', 'ic_sniper']) e.applyOfferDirect({ kind: 'NEW_SQUAD', unitId: id });
    for (const id of ['RAPID', 'AREA', 'CORE', 'SCOPE'] as const) e.applyOfferDirect({ kind: 'NEW_MODULE', moduleId: id });
    for (const s of [...e.squads]) for (let lv = s.level + 1; lv <= 5; lv += 1) e.applyOfferDirect({ kind: 'SQUAD_LEVEL', unitId: s.key, nextLevel: lv });
    for (const m of [...e.modules]) for (let lv = m.level + 1; lv <= 5; lv += 1) e.applyOfferDirect({ kind: 'MODULE_LEVEL', moduleId: m.id, nextLevel: lv });
    e.grantXp(e.xpToNext);
    expect(e.offers.some((o) => o.kind === 'OVERCHARGE')).toBe(true);
  });
});
