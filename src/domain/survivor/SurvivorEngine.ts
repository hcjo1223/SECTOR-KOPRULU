import { assignSlots, buildSlotOffsets, capacityForRings, MAX_RINGS } from './Formation';
import { getEnemyDef, getFaction, getSquadUnitDef, getWaveTable } from './SurvivorCatalog';
import { SpatialHash } from './SpatialHash';
import type {
  Actor,
  AttackProfile,
  CommanderState,
  EffectKind,
  EffectState,
  EnemyState,
  FactionDef,
  FactionId,
  GemState,
  HudSnapshot,
  LevelUpOffer,
  ProjectileState,
  RunPhase,
  SlimePatch,
  SquadMemberState,
  Vec2,
  WaveTable,
} from './types';

/** 고정 타임스텝 (초). 배속은 틱 실행 횟수로만 조절한다. */
export const SURVIVOR_DT = 1 / 30;

export const MAX_UNIT_LEVEL = 5;
const MELEE_LEASH_PX = 46;
const MAX_GEMS = 320;
const MAX_EFFECTS = 220;
const MAX_SLIME = 48;
const SLIME_RADIUS = 14;
const SLIME_LIFE_SEC = 4;
const ENTRENCH_DELAY_SEC = 0.5;
const SHIELD_REGEN_DELAY_SEC = 2.5;
const GEM_MAGNET_SPEED = 240;

/** 결정적 의사난수 (테스트 재현성) */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function xpToNextLevel(level: number): number {
  return 3 + level * 3;
}

export function unitLevelDamageMult(level: number): number {
  return 1 + 0.25 * (level - 1);
}

export function unitLevelCooldownMult(level: number): number {
  return 1 - 0.08 * (level - 1);
}

export class SurvivorEngine {
  public readonly faction: FactionDef;
  public readonly waves: WaveTable;
  public phase: RunPhase = 'RUNNING';
  public elapsedSec = 0;
  public level = 1;
  public xp = 0;
  public kills = 0;
  public rings = 1;

  public readonly commander: CommanderState;
  public readonly squad: SquadMemberState[] = [];
  public readonly enemies: EnemyState[] = [];
  public readonly projectiles: ProjectileState[] = [];
  public readonly gems: GemState[] = [];
  public readonly effects: EffectState[] = [];
  public readonly slime: SlimePatch[] = [];
  public readonly unitLevels = new Map<string, number>();

  public slotOffsets: Vec2[] = [];
  public offers: LevelUpOffer[] = [];
  public boss: EnemyState | null = null;
  public bossSpawned = false;

  private readonly rng: () => number;
  private readonly hash = new SpatialHash(32);
  private readonly scratch: number[] = [];
  private readonly scratch2: number[] = [];
  private nextId = 1;
  private moveX = 0;
  private moveY = 0;
  private pendingLevelUps = 0;
  private pickupRadius: number;
  private speedMul = 1;
  private regenPerSec = 0;
  private slimeTimer = 0;
  private readonly streamAccum: number[];
  private nextEventIndex = 0;
  /** 화면 밖 스폰 반경 (뷰 크기에 맞춰 렌더 계층이 조정) */
  private spawnRadius = 300;

  constructor(factionId: FactionId, seed: number = Date.now()) {
    this.faction = getFaction(factionId);
    this.waves = getWaveTable();
    this.rng = mulberry32(seed);
    this.streamAccum = this.waves.streams.map(() => 0);

    const cd = this.faction.commander;
    this.commander = {
      ...this.makeActor(0, 0, cd.radius, cd.hp, cd.shield),
      def: cd,
      cooldown: 0,
      dirX: 1,
      dirY: 0,
      idleSec: 0,
    };
    this.pickupRadius = cd.pickupRadius;

    this.slotOffsets = buildSlotOffsets(this.rings);
    for (const unitId of this.faction.startingUnits) {
      this.addSquadMember(unitId, false);
    }
    this.reassignSlots();
    for (const m of this.squad) {
      const o = this.slotOffsets[m.slotIndex];
      m.x = m.px = o.x;
      m.y = m.py = o.y;
    }
  }

  // ─────────────────────────── 공개 API ───────────────────────────

  /** 이동 입력 (-1..1). 길이가 1을 넘으면 정규화한다. */
  public setMoveInput(x: number, y: number): void {
    const len = Math.hypot(x, y);
    if (len > 1) {
      this.moveX = x / len;
      this.moveY = y / len;
    } else {
      this.moveX = x;
      this.moveY = y;
    }
  }

  /** 뷰포트 반대각선 길이에 맞춰 스폰 반경을 조정한다 (180~420px). */
  public setSpawnRadius(r: number): void {
    this.spawnRadius = Math.max(180, Math.min(420, r));
  }

  public get squadCapacity(): number {
    return capacityForRings(this.rings);
  }

  public get xpToNext(): number {
    return xpToNextLevel(this.level);
  }

  public get isEntrenched(): boolean {
    return this.faction.id === 'IRONCLAD' && this.commander.idleSec >= ENTRENCH_DELAY_SEC;
  }

  public getUnitLevel(unitId: string): number {
    return this.unitLevels.get(unitId) ?? 1;
  }

  public step(ticks: number = 1): void {
    for (let i = 0; i < ticks; i += 1) {
      if (this.phase !== 'RUNNING') {
        return;
      }
      this.tick(SURVIVOR_DT);
    }
  }

  public chooseOffer(index: number): boolean {
    if (this.phase !== 'LEVEL_UP') {
      return false;
    }
    const offer = this.offers[index];
    if (!offer) {
      return false;
    }
    this.applyOffer(offer);
    this.pendingLevelUps -= 1;
    if (this.pendingLevelUps > 0) {
      this.offers = this.rollOffers();
    } else {
      this.offers = [];
      this.phase = 'RUNNING';
    }
    return true;
  }

  public getHud(): HudSnapshot {
    const squadByUnit: Record<string, number> = {};
    for (const m of this.squad) {
      squadByUnit[m.def.id] = (squadByUnit[m.def.id] ?? 0) + 1;
    }
    const unitLevels: Record<string, number> = {};
    for (const id of this.faction.unitPool) {
      unitLevels[id] = this.getUnitLevel(id);
    }
    const c = this.commander;
    return {
      phase: this.phase,
      elapsedSec: this.elapsedSec,
      runLengthSec: this.waves.runLengthSec,
      level: this.level,
      xp: this.xp,
      xpToNext: this.xpToNext,
      kills: this.kills,
      commanderHp: Math.max(0, c.hp),
      commanderMaxHp: c.maxHp,
      commanderShield: c.shield,
      commanderMaxShield: c.maxShield,
      squadCount: this.squad.length,
      squadCapacity: this.squadCapacity,
      ringCount: this.rings,
      traitActive: this.isTraitActive(),
      bossAlive: !!this.boss && this.boss.alive,
      bossHp: this.boss ? Math.max(0, this.boss.hp) : 0,
      bossMaxHp: this.boss ? this.boss.maxHp : 0,
      unitLevels,
      squadByUnit,
    };
  }

  /** 테스트·디버그용: 경험치를 직접 지급 */
  public grantXp(amount: number): void {
    this.gainXp(amount);
    this.maybeEnterLevelUp();
  }

  /** 테스트·디버그용: 지정 위치에 적 생성 */
  public spawnEnemyAt(enemyId: string, x: number, y: number, elite = false): EnemyState {
    return this.spawnEnemy(enemyId, x, y, elite, false);
  }

  // ─────────────────────────── 틱 ───────────────────────────

  private tick(dt: number): void {
    this.elapsedSec += dt;
    this.savePrevPositions();

    this.updateCommanderMovement(dt);
    this.updateSlime(dt);
    this.updateSpawning(dt);

    this.rebuildHash();
    this.updateSquad(dt);
    this.updateCommanderAttack(dt);

    this.updateEnemies(dt);
    this.rebuildHash();
    this.updateProjectiles(dt);

    this.cleanupEnemies();
    this.updateGems(dt);
    this.updateRegen(dt);
    this.updateEffects(dt);
    this.cleanupSquad();

    if (!this.commander.alive) {
      this.phase = 'DEFEAT';
      return;
    }
    if (this.bossSpawned && this.boss && !this.boss.alive) {
      this.phase = 'VICTORY';
      return;
    }
    this.maybeEnterLevelUp();
  }

  private savePrevPositions(): void {
    const c = this.commander;
    c.px = c.x;
    c.py = c.y;
    for (const m of this.squad) {
      m.px = m.x;
      m.py = m.y;
    }
    for (const e of this.enemies) {
      e.px = e.x;
      e.py = e.y;
    }
    for (const p of this.projectiles) {
      p.px = p.x;
      p.py = p.y;
    }
  }

  // ─────────────────────────── 지휘관 ───────────────────────────

  private updateCommanderMovement(dt: number): void {
    const c = this.commander;
    const moving = this.moveX !== 0 || this.moveY !== 0;
    if (moving) {
      const len = Math.hypot(this.moveX, this.moveY);
      c.dirX = this.moveX / len;
      c.dirY = this.moveY / len;
      if (Math.abs(c.dirX) > 0.15) {
        c.facingX = c.dirX > 0 ? 1 : -1;
      }
      const slimeMul = this.faction.id === 'HIVE' && this.isOnSlime(c.x, c.y) ? 1.2 : 1;
      const speed = c.def.moveSpeed * this.speedMul * slimeMul;
      c.x += this.moveX * speed * dt;
      c.y += this.moveY * speed * dt;
      c.idleSec = 0;
    } else {
      c.idleSec += dt;
    }
  }

  private updateCommanderAttack(dt: number): void {
    const c = this.commander;
    c.cooldown -= dt;
    if (c.cooldown > 0) {
      return;
    }
    const a = c.def.attack;
    const target = this.findNearestEnemy(c.x, c.y, a.rangePx);
    if (!target) {
      return;
    }
    this.fireProjectileAt(c.x, c.y, target.x, target.y, a, a.damage, a.rangePx, this.faction.palette.accent);
    c.cooldown = a.cooldownSec;
  }

  // ─────────────────────────── 진영 특성 ───────────────────────────

  private isTraitActive(): boolean {
    switch (this.faction.id) {
      case 'IRONCLAD':
        return this.isEntrenched;
      case 'HIVE':
        return this.isOnSlime(this.commander.x, this.commander.y);
      case 'LUMEN':
        return this.commander.sinceHitSec >= SHIELD_REGEN_DELAY_SEC;
    }
  }

  private updateSlime(dt: number): void {
    for (let i = this.slime.length - 1; i >= 0; i -= 1) {
      this.slime[i].lifeSec -= dt;
      if (this.slime[i].lifeSec <= 0) {
        this.slime.splice(i, 1);
      }
    }
    if (this.faction.id !== 'HIVE') {
      return;
    }
    this.slimeTimer -= dt;
    if (this.slimeTimer <= 0 && this.commander.idleSec === 0) {
      this.slimeTimer = 0.18;
      if (this.slime.length >= MAX_SLIME) {
        this.slime.shift();
      }
      this.slime.push({ x: this.commander.x, y: this.commander.y, lifeSec: SLIME_LIFE_SEC });
    }
  }

  public isOnSlime(x: number, y: number): boolean {
    const r2 = SLIME_RADIUS * SLIME_RADIUS;
    for (let i = 0; i < this.slime.length; i += 1) {
      const dx = this.slime[i].x - x;
      const dy = this.slime[i].y - y;
      if (dx * dx + dy * dy <= r2) {
        return true;
      }
    }
    return false;
  }

  // ─────────────────────────── 부대 ───────────────────────────

  private addSquadMember(unitId: string, nearCommander: boolean): SquadMemberState {
    const def = getSquadUnitDef(unitId);
    const c = this.commander;
    const actor = this.makeActor(
      nearCommander ? c.x : 0,
      nearCommander ? c.y : 0,
      def.radius,
      def.hp,
      def.shield
    );
    const m: SquadMemberState = {
      ...actor,
      def,
      slotIndex: 0,
      cooldown: this.rng() * def.attack.cooldownSec,
      attackFlashSec: 0,
    };
    this.squad.push(m);
    if (!this.unitLevels.has(unitId)) {
      this.unitLevels.set(unitId, 1);
    }
    return m;
  }

  private reassignSlots(): void {
    const roles = this.squad.map((m) => m.def.role);
    const slots = assignSlots(roles, this.rings);
    for (let i = 0; i < this.squad.length; i += 1) {
      this.squad[i].slotIndex = Math.max(0, slots[i]);
    }
  }

  private updateSquad(dt: number): void {
    const c = this.commander;
    const entrenched = this.isEntrenched;
    const hive = this.faction.id === 'HIVE';

    for (let i = 0; i < this.squad.length; i += 1) {
      const m = this.squad[i];
      const a = m.def.attack;
      const lvl = this.getUnitLevel(m.def.id);
      const onSlime = hive && this.isOnSlime(m.x, m.y);
      const range = a.rangePx * (entrenched ? 1.25 : 1);
      const slot = this.slotOffsets[m.slotIndex] ?? { x: 0, y: 0 };
      const slotX = c.x + slot.x;
      const slotY = c.y + slot.y;

      // 이동 목표: 기본은 진형 슬롯. 근접 AUTO는 리쉬 안의 적에게 돌진.
      let goalX = slotX;
      let goalY = slotY;
      if (a.style === 'MELEE' && a.targeting === 'AUTO') {
        const prey = this.findNearestEnemy(m.x, m.y, MELEE_LEASH_PX);
        if (prey && Math.hypot(prey.x - slotX, prey.y - slotY) <= MELEE_LEASH_PX) {
          goalX = prey.x;
          goalY = prey.y;
        }
      }
      const dx = goalX - m.x;
      const dy = goalY - m.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.5) {
        const catchUp = dist > 40 ? 1.7 : 1;
        const maxSpeed = m.def.moveSpeed * this.speedMul * catchUp * (onSlime ? 1.2 : 1);
        // 스프링 추종: 가까울수록 감속해 대형에 부드럽게 안착
        const speed = Math.min(maxSpeed, dist * 7);
        const stepLen = Math.min(dist, speed * dt);
        m.x += (dx / dist) * stepLen;
        m.y += (dy / dist) * stepLen;
        if (Math.abs(dx) > 1) {
          m.facingX = dx > 0 ? 1 : -1;
        }
      }

      // 부대원끼리 겹침 해소
      for (let j = i + 1; j < this.squad.length; j += 1) {
        const o = this.squad[j];
        const ox = o.x - m.x;
        const oy = o.y - m.y;
        const minD = m.radius + o.radius;
        const d2 = ox * ox + oy * oy;
        if (d2 < minD * minD && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = (minD - d) * 0.5;
          m.x -= (ox / d) * push;
          m.y -= (oy / d) * push;
          o.x += (ox / d) * push;
          o.y += (oy / d) * push;
        }
      }

      // 공격
      m.attackFlashSec = Math.max(0, m.attackFlashSec - dt);
      m.cooldown -= dt * (onSlime ? 1.3 : 1);
      if (m.cooldown > 0) {
        continue;
      }
      const dmg = a.damage * unitLevelDamageMult(lvl) * (entrenched ? 1.35 : 1);
      if (this.performSquadAttack(m, a, dmg, range)) {
        m.cooldown = a.cooldownSec * unitLevelCooldownMult(lvl);
        m.attackFlashSec = 0.12;
      }
    }
  }

  /** @returns 실제로 공격이 발동했는지 */
  private performSquadAttack(m: SquadMemberState, a: AttackProfile, dmg: number, range: number): boolean {
    const color = this.faction.palette.accent;
    switch (a.style) {
      case 'HEAL': {
        const target = this.findMostWoundedAlly(m.x, m.y, range);
        if (!target) {
          return false;
        }
        target.hp = Math.min(target.maxHp, target.hp + dmg);
        this.addEffect('HEAL', target.x, target.y, 0, 8, 0, 0.35, '#7cf2a0');
        return true;
      }
      case 'PULSE': {
        if (!this.findNearestEnemy(m.x, m.y, range)) {
          return false;
        }
        this.damageEnemiesInRadius(m.x, m.y, range, dmg);
        this.addEffect('PULSE', m.x, m.y, 0, range, 0, 0.3, color);
        return true;
      }
      case 'MELEE': {
        const target = this.findNearestEnemy(m.x, m.y, range + m.radius);
        if (!target) {
          return false;
        }
        this.damageEnemy(target, dmg);
        const ang = Math.atan2(target.y - m.y, target.x - m.x);
        m.facingX = target.x >= m.x ? 1 : -1;
        this.addEffect('SLASH', (m.x + target.x) / 2, (m.y + target.y) / 2, ang, 8, 0, 0.15, '#f4f4f4');
        return true;
      }
      case 'CONE': {
        const { aimX, aimY, hasTarget } = this.resolveAim(m, a, range);
        if (!hasTarget) {
          return false;
        }
        const half = ((a.coneHalfAngleDeg ?? 30) * Math.PI) / 180;
        const hits = this.damageEnemiesInCone(m.x, m.y, aimX, aimY, range, half, dmg);
        if (hits === 0 && a.targeting === 'AUTO') {
          return false;
        }
        m.facingX = aimX >= 0 ? 1 : -1;
        this.addEffect('CONE', m.x, m.y, Math.atan2(aimY, aimX), range, half, 0.2, color);
        return true;
      }
      case 'PROJECTILE':
      case 'PIERCE': {
        const { aimX, aimY, hasTarget } = this.resolveAim(m, a, range);
        if (!hasTarget) {
          return false;
        }
        m.facingX = aimX >= 0 ? 1 : -1;
        this.fireProjectileAt(m.x, m.y, m.x + aimX * range, m.y + aimY * range, a, dmg, range, color);
        return true;
      }
    }
  }

  /**
   * 조준 방향 결정.
   * AUTO: 가장 가까운 적 방향.
   * FACING: 지휘관이 바라보는 방향의 원뿔 안 가장 가까운 적 → 없으면 사거리 안에 적이 있을 때 정면 방향 그대로.
   */
  private resolveAim(m: Actor, a: AttackProfile, range: number): { aimX: number; aimY: number; hasTarget: boolean } {
    if (a.targeting === 'AUTO') {
      const t = this.findNearestEnemy(m.x, m.y, range);
      if (!t) {
        return { aimX: 0, aimY: 0, hasTarget: false };
      }
      const d = Math.hypot(t.x - m.x, t.y - m.y) || 1;
      return { aimX: (t.x - m.x) / d, aimY: (t.y - m.y) / d, hasTarget: true };
    }
    const fx = this.commander.dirX;
    const fy = this.commander.dirY;
    const half = ((a.coneHalfAngleDeg ?? 30) * Math.PI) / 180;
    const cosHalf = Math.cos(half);
    const cand = this.hash.query(m.x, m.y, range + 24, this.scratch);
    let best: EnemyState | null = null;
    let bestD2 = Infinity;
    let anyInRange = false;
    for (let k = 0; k < cand.length; k += 1) {
      const e = this.enemies[cand[k]];
      if (!e || !e.alive) {
        continue;
      }
      const dx = e.x - m.x;
      const dy = e.y - m.y;
      const d2 = dx * dx + dy * dy;
      const reach = range + e.radius;
      if (d2 > reach * reach) {
        continue;
      }
      anyInRange = true;
      const d = Math.sqrt(d2) || 1;
      if ((dx * fx + dy * fy) / d >= cosHalf && d2 < bestD2) {
        bestD2 = d2;
        best = e;
      }
    }
    if (best) {
      const d = Math.sqrt(bestD2) || 1;
      return { aimX: (best.x - m.x) / d, aimY: (best.y - m.y) / d, hasTarget: true };
    }
    return { aimX: fx, aimY: fy, hasTarget: anyInRange };
  }

  private cleanupSquad(): void {
    let removed = false;
    for (let i = this.squad.length - 1; i >= 0; i -= 1) {
      const m = this.squad[i];
      if (!m.alive) {
        this.addEffect('DEATH', m.x, m.y, 0, 10, 0, 0.5, this.faction.palette.primary);
        this.squad.splice(i, 1);
        removed = true;
      }
    }
    if (removed) {
      this.reassignSlots();
    }
  }

  // ─────────────────────────── 적 ───────────────────────────

  private updateSpawning(dt: number): void {
    const t = this.elapsedSec;
    const runLen = this.waves.runLengthSec;
    const streams = this.waves.streams;
    for (let s = 0; s < streams.length; s += 1) {
      const st = streams[s];
      if (t < st.fromSec || t > st.toSec) {
        continue;
      }
      const span = Math.max(1, runLen - st.fromSec);
      const k = Math.min(1, (t - st.fromSec) / span);
      const rate = st.rateStart + (st.rateEnd - st.rateStart) * k;
      this.streamAccum[s] += rate * dt;
      while (this.streamAccum[s] >= 1) {
        this.streamAccum[s] -= 1;
        if (this.enemies.length < this.waves.maxEnemies) {
          const p = this.pickSpawnPoint();
          this.spawnEnemy(st.enemyId, p.x, p.y, false, false);
        }
      }
    }

    const events = this.waves.events;
    while (this.nextEventIndex < events.length && events[this.nextEventIndex].atSec <= t) {
      const ev = events[this.nextEventIndex];
      this.nextEventIndex += 1;
      const c = this.commander;
      if (ev.kind === 'ENCIRCLE') {
        for (let i = 0; i < ev.count; i += 1) {
          const ang = (i / ev.count) * Math.PI * 2;
          this.spawnEnemy(ev.enemyId, c.x + Math.cos(ang) * this.spawnRadius * 0.7, c.y + Math.sin(ang) * this.spawnRadius * 0.7, false, false);
        }
      } else if (ev.kind === 'ELITE') {
        for (let i = 0; i < ev.count; i += 1) {
          const p = this.pickSpawnPoint();
          this.spawnEnemy(ev.enemyId, p.x, p.y, true, false);
        }
      } else {
        const p = this.pickSpawnPoint();
        this.boss = this.spawnEnemy(ev.enemyId, p.x, p.y, false, true);
        this.bossSpawned = true;
      }
    }
  }

  /** 화면 밖 원형 경계. 이동 중이면 진행 방향 앞쪽에 가중치를 둔다. */
  private pickSpawnPoint(): Vec2 {
    const radius = this.spawnRadius;
    const c = this.commander;
    let ang = this.rng() * Math.PI * 2;
    if (c.idleSec === 0 && this.rng() < 0.45) {
      ang = Math.atan2(c.dirY, c.dirX) + (this.rng() - 0.5) * Math.PI * 0.9;
    }
    const r = radius + this.rng() * 40;
    return { x: c.x + Math.cos(ang) * r, y: c.y + Math.sin(ang) * r };
  }

  private spawnEnemy(enemyId: string, x: number, y: number, elite: boolean, boss: boolean): EnemyState {
    const def = getEnemyDef(enemyId);
    const hpScale = 1 + this.waves.hpScalePerMinute * (this.elapsedSec / 60);
    const eliteMul = elite ? 6 : 1;
    const hp = boss ? def.hp : def.hp * hpScale * eliteMul;
    const e: EnemyState = {
      id: this.nextId++,
      def,
      x,
      y,
      px: x,
      py: y,
      hp,
      maxHp: hp,
      radius: def.radius * (elite ? 1.35 : 1),
      speed: def.speed * (elite ? 1.1 : 1) * (0.9 + this.rng() * 0.2),
      damage: def.damage * (elite ? 1.5 : 1),
      scale: def.scale * (elite ? 1.4 : 1),
      contactCd: 0,
      hitFlashSec: 0,
      isElite: elite,
      isBoss: boss,
      alive: true,
      facingX: 1,
    };
    this.enemies.push(e);
    return e;
  }

  private updateEnemies(dt: number): void {
    const c = this.commander;
    const hive = this.faction.id === 'HIVE';
    const despawnR = this.spawnRadius + 200;
    const despawn2 = despawnR * despawnR;

    for (let i = 0; i < this.enemies.length; i += 1) {
      const e = this.enemies[i];
      if (!e.alive) {
        continue;
      }
      e.contactCd -= dt;
      e.hitFlashSec = Math.max(0, e.hitFlashSec - dt);

      let dx = c.x - e.x;
      let dy = c.y - e.y;
      const d2c = dx * dx + dy * dy;
      if (d2c > despawn2 && !e.isBoss) {
        const p = this.pickSpawnPoint();
        e.x = e.px = p.x;
        e.y = e.py = p.y;
        continue;
      }
      const dc = Math.sqrt(d2c) || 1;
      dx /= dc;
      dy /= dc;
      const slow = hive && this.isOnSlime(e.x, e.y) ? 0.7 : 1;
      e.x += dx * e.speed * slow * dt;
      e.y += dy * e.speed * slow * dt;
      if (Math.abs(dx) > 0.1) {
        e.facingX = dx > 0 ? 1 : -1;
      }

      // 군집 분리 (반경 가중)
      const cand = this.hash.query(e.x, e.y, e.radius + 20, this.scratch2);
      for (let k = 0; k < cand.length; k += 1) {
        const j = cand[k];
        if (j === i) {
          continue;
        }
        const o = this.enemies[j];
        if (!o || !o.alive) {
          continue;
        }
        const ox = e.x - o.x;
        const oy = e.y - o.y;
        const minD = e.radius + o.radius;
        const d2 = ox * ox + oy * oy;
        if (d2 < minD * minD && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const w = o.radius / (e.radius + o.radius);
          const push = (minD - d) * w * 0.6;
          e.x += (ox / d) * push;
          e.y += (oy / d) * push;
        }
      }

      // 아군과 충돌: 부대원은 방벽 역할, 접촉 시 피해
      this.collideEnemyWithAlly(e, c, 0);
      for (let s = 0; s < this.squad.length; s += 1) {
        this.collideEnemyWithAlly(e, this.squad[s], e.isBoss ? 0.6 : 0.15);
      }
    }
  }

  private collideEnemyWithAlly(e: EnemyState, a: Actor, allyShare: number): void {
    if (!a.alive) {
      return;
    }
    const dx = e.x - a.x;
    const dy = e.y - a.y;
    const minD = e.radius + a.radius;
    const d2 = dx * dx + dy * dy;
    if (d2 >= (minD + 1.5) * (minD + 1.5)) {
      return;
    }
    if (e.contactCd <= 0) {
      this.damageAlly(a, e.damage);
      e.contactCd = e.def.contactCooldownSec;
    }
    if (d2 < minD * minD) {
      const d = Math.sqrt(d2) || 0.01;
      const overlap = minD - d;
      const nx = d2 > 0.0001 ? dx / d : 1;
      const ny = d2 > 0.0001 ? dy / d : 0;
      e.x += nx * overlap * (1 - allyShare);
      e.y += ny * overlap * (1 - allyShare);
      a.x -= nx * overlap * allyShare;
      a.y -= ny * overlap * allyShare;
    }
  }

  private cleanupEnemies(): void {
    let w = 0;
    for (let i = 0; i < this.enemies.length; i += 1) {
      const e = this.enemies[i];
      if (e.alive) {
        this.enemies[w++] = e;
        continue;
      }
      this.kills += 1;
      this.addEffect('DEATH', e.x, e.y, 0, e.radius + 2, 0, 0.35, e.def.palette.primary);
      if (e.def.xp > 0) {
        this.dropGem(e.x, e.y, e.def.xp * (e.isElite ? 8 : 1));
      }
    }
    this.enemies.length = w;
  }

  // ─────────────────────────── 투사체 ───────────────────────────

  private fireProjectileAt(
    x: number,
    y: number,
    tx: number,
    ty: number,
    a: AttackProfile,
    damage: number,
    range: number,
    color: string
  ): void {
    const dx = tx - x;
    const dy = ty - y;
    const d = Math.hypot(dx, dy) || 1;
    const speed = a.projectileSpeed ?? 250;
    this.projectiles.push({
      id: this.nextId++,
      x,
      y,
      px: x,
      py: y,
      vx: (dx / d) * speed,
      vy: (dy / d) * speed,
      damage,
      radius: a.style === 'PIERCE' ? 3 : 2,
      lifeSec: (range * 1.15) / speed,
      pierceLeft: a.style === 'PIERCE' ? a.pierce ?? 1 : 0,
      splashRadiusPx: a.splashRadiusPx ?? 0,
      color,
      hitIds: [],
      alive: true,
    });
  }

  private updateProjectiles(dt: number): void {
    let w = 0;
    for (let i = 0; i < this.projectiles.length; i += 1) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.lifeSec -= dt;

      const cand = this.hash.query(p.x, p.y, p.radius + 28, this.scratch);
      for (let k = 0; k < cand.length && p.alive; k += 1) {
        const e = this.enemies[cand[k]];
        if (!e || !e.alive || p.hitIds.includes(e.id)) {
          continue;
        }
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const r = e.radius + p.radius;
        if (dx * dx + dy * dy > r * r) {
          continue;
        }
        if (p.splashRadiusPx > 0) {
          this.explode(p);
          break;
        }
        this.damageEnemy(e, p.damage);
        p.hitIds.push(e.id);
        p.pierceLeft -= 1;
        if (p.pierceLeft < 0) {
          p.alive = false;
        }
      }

      if (p.alive && p.lifeSec <= 0) {
        if (p.splashRadiusPx > 0) {
          this.explode(p);
        }
        p.alive = false;
      }
      if (p.alive) {
        this.projectiles[w++] = p;
      }
    }
    this.projectiles.length = w;
  }

  private explode(p: ProjectileState): void {
    this.damageEnemiesInRadius(p.x, p.y, p.splashRadiusPx, p.damage);
    this.addEffect('BOOM', p.x, p.y, 0, p.splashRadiusPx, 0, 0.3, '#ffb347');
    p.alive = false;
  }

  // ─────────────────────────── 피해 ───────────────────────────

  private damageEnemy(e: EnemyState, dmg: number): void {
    if (!e.alive) {
      return;
    }
    e.hp -= dmg;
    e.hitFlashSec = 0.1;
    if (e.hp <= 0) {
      e.alive = false;
    }
  }

  private damageEnemiesInRadius(x: number, y: number, r: number, dmg: number): number {
    const cand = this.hash.query(x, y, r + 24, this.scratch);
    let hits = 0;
    for (let k = 0; k < cand.length; k += 1) {
      const e = this.enemies[cand[k]];
      if (!e || !e.alive) {
        continue;
      }
      const reach = r + e.radius;
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy <= reach * reach) {
        this.damageEnemy(e, dmg);
        hits += 1;
      }
    }
    return hits;
  }

  private damageEnemiesInCone(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    r: number,
    half: number,
    dmg: number
  ): number {
    const cosHalf = Math.cos(half);
    const cand = this.hash.query(x, y, r + 24, this.scratch);
    let hits = 0;
    for (let k = 0; k < cand.length; k += 1) {
      const e = this.enemies[cand[k]];
      if (!e || !e.alive) {
        continue;
      }
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.hypot(dx, dy);
      if (d > r + e.radius) {
        continue;
      }
      if (d < e.radius + 2 || (dx * dirX + dy * dirY) / (d || 1) >= cosHalf) {
        this.damageEnemy(e, dmg);
        hits += 1;
      }
    }
    return hits;
  }

  private damageAlly(a: Actor, dmg: number): void {
    a.sinceHitSec = 0;
    let rest = dmg;
    if (a.shield > 0) {
      const absorbed = Math.min(a.shield, rest);
      a.shield -= absorbed;
      rest -= absorbed;
    }
    a.hp -= rest;
    if (a.hp <= 0) {
      a.hp = 0;
      a.alive = false;
    }
  }

  private findNearestEnemy(x: number, y: number, range: number): EnemyState | null {
    const cand = this.hash.query(x, y, range + 24, this.scratch);
    let best: EnemyState | null = null;
    let bestD2 = Infinity;
    for (let k = 0; k < cand.length; k += 1) {
      const e = this.enemies[cand[k]];
      if (!e || !e.alive) {
        continue;
      }
      const dx = e.x - x;
      const dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      const reach = range + e.radius;
      if (d2 <= reach * reach && d2 < bestD2) {
        bestD2 = d2;
        best = e;
      }
    }
    return best;
  }

  private findMostWoundedAlly(x: number, y: number, range: number): Actor | null {
    let best: Actor | null = null;
    let bestRatio = 0.999;
    const consider = (a: Actor): void => {
      if (!a.alive) {
        return;
      }
      const ratio = a.hp / a.maxHp;
      if (ratio < bestRatio && Math.hypot(a.x - x, a.y - y) <= range) {
        bestRatio = ratio;
        best = a;
      }
    };
    consider(this.commander);
    for (const m of this.squad) {
      consider(m);
    }
    return best;
  }

  private rebuildHash(): void {
    this.hash.clear();
    for (let i = 0; i < this.enemies.length; i += 1) {
      const e = this.enemies[i];
      if (e.alive) {
        this.hash.insert(i, e.x, e.y);
      }
    }
  }

  // ─────────────────────────── 경험치·회복·이펙트 ───────────────────────────

  private dropGem(x: number, y: number, value: number): void {
    if (this.gems.length >= MAX_GEMS) {
      const g = this.gems[Math.floor(this.rng() * this.gems.length)];
      g.value += value;
      return;
    }
    this.gems.push({ id: this.nextId++, x, y, value, magnetized: false, alive: true });
  }

  private updateGems(dt: number): void {
    const c = this.commander;
    const pick2 = this.pickupRadius * this.pickupRadius;
    const collectR = c.radius + 4;
    let w = 0;
    for (let i = 0; i < this.gems.length; i += 1) {
      const g = this.gems[i];
      const dx = c.x - g.x;
      const dy = c.y - g.y;
      const d2 = dx * dx + dy * dy;
      if (!g.magnetized && d2 <= pick2) {
        g.magnetized = true;
      }
      if (g.magnetized) {
        const d = Math.sqrt(d2) || 1;
        const stepLen = Math.min(d, GEM_MAGNET_SPEED * dt);
        g.x += (dx / d) * stepLen;
        g.y += (dy / d) * stepLen;
        if (d - stepLen <= collectR) {
          this.gainXp(g.value);
          g.alive = false;
        }
      }
      if (g.alive) {
        this.gems[w++] = g;
      }
    }
    this.gems.length = w;
  }

  private gainXp(amount: number): void {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.pendingLevelUps += 1;
    }
  }

  private maybeEnterLevelUp(): void {
    if (this.phase === 'RUNNING' && this.pendingLevelUps > 0) {
      this.offers = this.rollOffers();
      this.phase = 'LEVEL_UP';
      this.addEffect('LEVEL', this.commander.x, this.commander.y, 0, 30, 0, 0.6, '#f2e27a');
    }
  }

  private updateRegen(dt: number): void {
    const regenShield = (a: Actor): void => {
      a.sinceHitSec += dt;
      if (a.maxShield > 0 && a.sinceHitSec >= SHIELD_REGEN_DELAY_SEC && a.shield < a.maxShield) {
        a.shield = Math.min(a.maxShield, a.shield + a.maxShield * 0.25 * dt);
      }
    };
    const c = this.commander;
    regenShield(c);
    if (this.regenPerSec > 0 && c.alive) {
      c.hp = Math.min(c.maxHp, c.hp + this.regenPerSec * dt);
    }
    for (const m of this.squad) {
      regenShield(m);
    }
  }

  private addEffect(
    kind: EffectKind,
    x: number,
    y: number,
    angle: number,
    radius: number,
    halfAngle: number,
    life: number,
    color: string
  ): void {
    if (this.effects.length >= MAX_EFFECTS) {
      this.effects.shift();
    }
    this.effects.push({ kind, x, y, angle, radius, halfAngle, lifeSec: life, maxLifeSec: life, color });
  }

  private updateEffects(dt: number): void {
    let w = 0;
    for (let i = 0; i < this.effects.length; i += 1) {
      const fx = this.effects[i];
      fx.lifeSec -= dt;
      if (fx.lifeSec > 0) {
        this.effects[w++] = fx;
      }
    }
    this.effects.length = w;
  }

  // ─────────────────────────── 레벨업 선택지 ───────────────────────────

  private rollOffers(): LevelUpOffer[] {
    const pool: { offer: LevelUpOffer; weight: number }[] = [];
    const hasRoom = this.squad.length < this.squadCapacity;

    if (hasRoom) {
      for (const unitId of this.faction.unitPool) {
        pool.push({ offer: { kind: 'RECRUIT', unitId }, weight: 3 });
      }
    }
    const owned = new Set(this.squad.map((m) => m.def.id));
    for (const unitId of owned) {
      const lv = this.getUnitLevel(unitId);
      if (lv < MAX_UNIT_LEVEL) {
        pool.push({ offer: { kind: 'UPGRADE', unitId, nextLevel: lv + 1 }, weight: 2.2 });
      }
    }
    if (this.rings < MAX_RINGS) {
      const nearlyFull = this.squad.length >= this.squadCapacity - 1;
      pool.push({ offer: { kind: 'EXPAND', nextRing: this.rings + 1 }, weight: nearlyFull ? 5 : 0.8 });
    }
    pool.push({ offer: { kind: 'COMMANDER', stat: 'HP' }, weight: 1 });
    if (this.speedMul < 1.4) {
      pool.push({ offer: { kind: 'COMMANDER', stat: 'SPEED' }, weight: 1 });
    }
    if (this.pickupRadius < 120) {
      pool.push({ offer: { kind: 'COMMANDER', stat: 'MAGNET' }, weight: 0.8 });
    }
    pool.push({ offer: { kind: 'COMMANDER', stat: 'REGEN' }, weight: 0.8 });

    const picked: LevelUpOffer[] = [];
    while (picked.length < 3 && pool.length > 0) {
      const total = pool.reduce((s, p) => s + p.weight, 0);
      let r = this.rng() * total;
      let idx = 0;
      for (; idx < pool.length - 1; idx += 1) {
        r -= pool[idx].weight;
        if (r <= 0) {
          break;
        }
      }
      picked.push(pool[idx].offer);
      pool.splice(idx, 1);
    }
    while (picked.length < 3) {
      picked.push({ kind: 'RESUPPLY' });
    }
    return picked;
  }

  private applyOffer(offer: LevelUpOffer): void {
    const c = this.commander;
    switch (offer.kind) {
      case 'RECRUIT': {
        if (this.squad.length >= this.squadCapacity) {
          return;
        }
        const m = this.addSquadMember(offer.unitId, true);
        this.reassignSlots();
        this.addEffect('LEVEL', m.x, m.y, 0, 14, 0, 0.5, this.faction.palette.accent);
        return;
      }
      case 'UPGRADE':
        this.unitLevels.set(offer.unitId, Math.min(MAX_UNIT_LEVEL, this.getUnitLevel(offer.unitId) + 1));
        return;
      case 'EXPAND':
        this.rings = Math.min(MAX_RINGS, this.rings + 1);
        this.slotOffsets = buildSlotOffsets(this.rings);
        this.reassignSlots();
        return;
      case 'COMMANDER':
        if (offer.stat === 'HP') {
          c.maxHp += 25;
          c.hp += 25;
        } else if (offer.stat === 'SPEED') {
          this.speedMul = Math.min(1.4, this.speedMul + 0.08);
        } else if (offer.stat === 'MAGNET') {
          this.pickupRadius += 16;
        } else {
          this.regenPerSec += 0.8;
        }
        return;
      case 'RESUPPLY':
        c.hp = c.maxHp;
        c.shield = c.maxShield;
        for (const m of this.squad) {
          m.hp = m.maxHp;
          m.shield = m.maxShield;
        }
        return;
    }
  }

  // ─────────────────────────── 유틸 ───────────────────────────

  private makeActor(x: number, y: number, radius: number, hp: number, shield: number): Actor {
    return {
      id: this.nextId++,
      x,
      y,
      px: x,
      py: y,
      radius,
      hp,
      maxHp: hp,
      shield,
      maxShield: shield,
      alive: true,
      sinceHitSec: 99,
      facingX: 1,
    };
  }
}
