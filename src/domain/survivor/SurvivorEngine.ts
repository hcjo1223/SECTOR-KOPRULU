import { shellReduction, stepEnemyAI, type EnemyAIContext } from './EnemyBehaviors';
import { assignSlots, buildSlotOffsets, capacityForRings, MAX_RINGS } from './Formation';
import { getCommander, getEnemyDef, getFaction, getSquadUnitDef, getWaveTable } from './SurvivorCatalog';
import { SpatialHash } from './SpatialHash';
import type {
  Actor,
  AttackProfile,
  ChestResult,
  ChestState,
  CommanderDef,
  CommanderState,
  EffectKind,
  EffectState,
  EliteAffix,
  EnemyShotState,
  EnemyState,
  FactionDef,
  FactionId,
  FactionPalette,
  GemState,
  HazardState,
  HudSnapshot,
  LevelUpOffer,
  MineState,
  ModuleId,
  ModuleState,
  ProjectileState,
  RunPhase,
  SlimePatch,
  SquadMemberState,
  SquadState,
  SquadUnitDef,
  Vec2,
  WaveTable,
  ZoneState,
} from './types';

/** 고정 타임스텝 (초). 배속은 틱 실행 횟수로만 조절한다. */
export const SURVIVOR_DT = 1 / 30;

export const MAX_SQUADS = 4;
export const MAX_MODULES = 4;
export const MAX_SQUAD_LEVEL = 5;
export const MAX_MODULE_LEVEL = 5;

const MELEE_LEASH_PX = 46;
const MAX_GEMS = 320;
const MAX_EFFECTS = 260;
const MAX_SLIME = 48;
const MAX_MINES = 80;
const MAX_ZONES = 48;
const SLIME_RADIUS = 14;
const SLIME_LIFE_SEC = 4;
const SHIELD_REGEN_DELAY_SEC = 2.5;
const GEM_MAGNET_SPEED = 240;
const MINE_TRIGGER_PX = 9;
const MAX_ENEMY_SHOTS = 260;
const MAX_HAZARDS = 40;
const ALL_AFFIXES: readonly EliteAffix[] = ['SWIFT', 'SPLIT', 'AURA', 'SHIELDED', 'VOLATILE'];

export const AFFIX_LABEL: Record<EliteAffix, string> = {
  SWIFT: '신속',
  SPLIT: '분열',
  AURA: '오라',
  SHIELDED: '보호막',
  VOLATILE: '폭발',
};

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
  // 후반으로 갈수록 가파르게: 눈덩이 성장 억제
  return 3 + level * 3 + Math.floor((level * level) / 12);
}

/** 분대 레벨 = 정원 (Lv1 1명 → Lv5 5명) */
export function squadHeadcount(level: number): number {
  return level;
}

export function squadLevelDamageMult(level: number): number {
  return 1 + 0.12 * (level - 1);
}

export class SurvivorEngine {
  public readonly faction: FactionDef;
  public readonly commanderDef: CommanderDef;
  public readonly waves: WaveTable;
  public phase: RunPhase = 'RUNNING';
  public elapsedSec = 0;
  public level = 1;
  public xp = 0;
  public kills = 0;
  public rings = 1;

  public readonly commander: CommanderState;
  /** 전장의 모든 부대원 (분대 구분은 squadKey) */
  public readonly squad: SquadMemberState[] = [];
  public readonly squads: SquadState[] = [];
  public readonly modules: ModuleState[] = [];
  public readonly enemies: EnemyState[] = [];
  public readonly projectiles: ProjectileState[] = [];
  public readonly gems: GemState[] = [];
  public readonly chests: ChestState[] = [];
  public readonly mines: MineState[] = [];
  public readonly zones: ZoneState[] = [];
  public readonly effects: EffectState[] = [];
  public readonly slime: SlimePatch[] = [];
  public readonly enemyShots: EnemyShotState[] = [];
  public readonly hazards: HazardState[] = [];

  public slotOffsets: Vec2[] = [];
  public offers: LevelUpOffer[] = [];
  public chestResult: ChestResult | null = null;
  /** HUD에 체력바를 표시할 현재 보스 (중간 보스 포함) */
  public boss: EnemyState | null = null;
  public finalBoss: EnemyState | null = null;
  public bossSpawned = false;
  public banner: string | null = null;
  public overchargeStacks = 0;

  private readonly rng: () => number;
  private readonly hash = new SpatialHash(32);
  private readonly scratch: number[] = [];
  private readonly scratch2: number[] = [];
  private nextId = 1;
  private moveX = 0;
  private moveY = 0;
  private pendingLevelUps = 0;
  private pendingChests = 0;
  private regenPerSec = 0;
  private slimeTimer = 0;
  private readonly streamAccum: number[];
  private nextEventIndex = 0;
  /** 화면 밖 스폰 반경 (뷰 크기에 맞춰 렌더 계층이 조정) */
  private spawnRadius = 300;
  private bannerSec = 0;
  private readonly ai: EnemyAIContext;

  constructor(factionId: FactionId, commanderId?: string, seed: number = Date.now()) {
    this.faction = getFaction(factionId);
    this.commanderDef = getCommander(factionId, commanderId);
    this.waves = getWaveTable();
    this.rng = mulberry32(seed);
    this.streamAccum = this.waves.streams.map(() => 0);

    const cd = this.commanderDef;
    this.commander = {
      ...this.makeActor(0, 0, cd.radius, cd.hp, cd.shield),
      def: cd,
      cooldown: 0,
      dirX: 1,
      dirY: 0,
      idleSec: 0,
    };

    // 시작 분대 없이 지휘관 단독 출격. 지휘관의 추천 분대(startingSquad)는 첫 레벨업 선택지에 보장된다.
    this.ai = this.makeAIContext();
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

  public get xpToNext(): number {
    return xpToNextLevel(this.level);
  }

  public get entrenchDelaySec(): number {
    return this.commanderDef.passive === 'FORTIFY' ? 0.2 : 0.5;
  }

  public get isEntrenched(): boolean {
    return this.faction.id === 'IRONCLAD' && this.commander.idleSec >= this.entrenchDelaySec;
  }

  public get pickupRadius(): number {
    return this.commanderDef.pickupRadius * (1 + 0.2 * this.moduleLevel('BEACON'));
  }

  public get speedMul(): number {
    return (1 + 0.06 * this.moduleLevel('MOBILITY')) * (this.commanderDef.passive === 'VANGUARD' ? 1.08 : 1);
  }

  public get overchargeMul(): number {
    return 1 + 0.03 * this.overchargeStacks;
  }

  public moduleLevel(id: ModuleId): number {
    for (const m of this.modules) {
      if (m.id === id) {
        return m.level;
      }
    }
    return 0;
  }

  public getSquad(key: string): SquadState | undefined {
    return this.squads.find((s) => s.key === key);
  }

  public aliveInSquad(key: string): number {
    let n = 0;
    for (const m of this.squad) {
      if (m.squadKey === key) {
        n += 1;
      }
    }
    return n;
  }

  /** 분대 Lv5 + 레시피 모듈 보유 → 다음 보급 상자에서 진화 */
  public canEvolve(s: SquadState): boolean {
    const evo = s.def.evolution;
    return !s.def.evolved && !!evo && s.level >= MAX_SQUAD_LEVEL && this.moduleLevel(evo.moduleId) > 0;
  }

  public paletteFor(def: { paletteOverride?: FactionPalette }): FactionPalette {
    return def.paletteOverride ?? this.faction.palette;
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
      this.offers = this.rollOffers(3);
    } else {
      this.offers = [];
      this.phase = 'RUNNING';
    }
    return true;
  }

  /** 보급 상자 결과 확인 → 진행 재개 */
  public confirmChest(): boolean {
    if (this.phase !== 'CHEST') {
      return false;
    }
    this.chestResult = null;
    this.phase = 'RUNNING';
    this.maybeOpenChestOrLevelUp();
    return true;
  }

  public getHud(): HudSnapshot {
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
      commanderName: this.commanderDef.name,
      squadCount: this.squad.length,
      traitActive: this.isTraitActive(),
      bossAlive: !!this.boss && this.boss.alive,
      bossName: this.boss ? this.boss.def.name : '',
      banner: this.banner,
      bossHp: this.boss ? Math.max(0, this.boss.hp) : 0,
      bossMaxHp: this.boss ? this.boss.maxHp : 0,
      squads: this.squads.map((s) => ({
        key: s.key,
        unitId: s.def.id,
        name: s.def.name,
        level: s.level,
        alive: this.aliveInSquad(s.key),
        headcount: squadHeadcount(s.level),
        evolved: !!s.def.evolved,
        evolveReady: this.canEvolve(s),
      })),
      modules: this.modules.map((m) => ({ ...m })),
      chestResult: this.chestResult,
    };
  }

  /** 테스트·디버그용: 경험치를 직접 지급 */
  public grantXp(amount: number): void {
    this.gainXp(amount);
    this.maybeOpenChestOrLevelUp();
  }

  /** 테스트·디버그용: 보급 상자 즉시 획득 */
  public grantChest(): void {
    this.pendingChests += 1;
    this.maybeOpenChestOrLevelUp();
  }

  /** 테스트·디버그용: 선택지를 직접 적용 */
  public applyOfferDirect(offer: LevelUpOffer): void {
    this.applyOffer(offer);
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
    this.updateMines(dt);
    this.updateZones(dt);
    this.updateEnemyShots(dt);
    this.updateHazards(dt);

    this.cleanupEnemies();
    this.updatePickups(dt);
    this.updateRegen(dt);
    this.updateReinforcements(dt);
    this.updateEffects(dt);
    this.cleanupSquad();
    if (this.bannerSec > 0) {
      this.bannerSec -= dt;
      if (this.bannerSec <= 0) {
        this.banner = null;
      }
    }

    if (!this.commander.alive) {
      this.phase = 'DEFEAT';
      return;
    }
    if (this.bossSpawned && this.finalBoss && !this.finalBoss.alive) {
      this.phase = 'VICTORY';
      return;
    }
    this.maybeOpenChestOrLevelUp();
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
    c.moving = moving;
    if (moving) {
      const len = Math.hypot(this.moveX, this.moveY);
      c.dirX = this.moveX / len;
      c.dirY = this.moveY / len;
      if (Math.abs(c.dirX) > 0.15) {
        c.facingX = c.dirX > 0 ? 1 : -1;
      }
      if (c.attackFlashSec <= 0) {
        c.facingAngle = Math.atan2(c.dirY, c.dirX);
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
    c.attackFlashSec = Math.max(0, c.attackFlashSec - dt);
    c.cooldown -= dt;
    if (c.cooldown > 0) {
      return;
    }
    const a = c.def.attack;
    const target = this.findNearestEnemy(c.x, c.y, a.rangePx);
    if (!target) {
      return;
    }
    c.facingAngle = Math.atan2(target.y - c.y, target.x - c.x);
    c.facingX = target.x >= c.x ? 1 : -1;
    c.attackFlashSec = 0.22;
    const dmg = a.damage * (1 + 0.1 * this.moduleLevel('CORE')) * this.overchargeMul;
    this.spawnProjectile(c.x, c.y, target.x - c.x, target.y - c.y, a, dmg, a.rangePx, this.paletteFor(c.def).accent);
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

  // ─────────────────────────── 분대 구성 ───────────────────────────

  private addSquad(unitId: string): SquadState {
    const def = getSquadUnitDef(unitId);
    const s: SquadState = { key: unitId, def, level: 1, reinforceTimer: 0 };
    this.squads.push(s);
    for (let i = 0; i < squadHeadcount(1); i += 1) {
      this.spawnMember(s);
    }
    this.reassignSlots();
    return s;
  }

  private spawnMember(s: SquadState): SquadMemberState {
    const def = s.def;
    const c = this.commander;
    const hpMult = 1 + 0.15 * this.moduleLevel('ARMOR');
    const actor = this.makeActor(c.x + (this.rng() - 0.5) * 8, c.y + (this.rng() - 0.5) * 8, def.radius, def.hp * hpMult, def.shield);
    const m: SquadMemberState = {
      ...actor,
      def,
      squadKey: s.key,
      baseMaxHp: def.hp,
      slotIndex: 0,
      cooldown: this.rng() * def.attack.cooldownSec,
      attackFlashSec: 0,
    };
    this.squad.push(m);
    return m;
  }

  private missingInSquad(s: SquadState): number {
    return Math.max(0, squadHeadcount(s.level) - this.aliveInSquad(s.key));
  }

  private totalMissing(): number {
    let n = 0;
    for (const s of this.squads) {
      n += this.missingInSquad(s);
    }
    return n;
  }

  private reinforceAll(): void {
    for (const s of this.squads) {
      const missing = this.missingInSquad(s);
      for (let i = 0; i < missing; i += 1) {
        const m = this.spawnMember(s);
        this.addEffect('LEVEL', m.x, m.y, 0, 10, 0, 0.4, this.paletteFor(s.def).accent);
      }
    }
    this.reassignSlots();
  }

  private evolveSquad(s: SquadState): string {
    const evo = s.def.evolution;
    if (!evo) {
      return s.def.id;
    }
    const from = s.def.id;
    const into = getSquadUnitDef(evo.intoId);
    s.def = into;
    const hpMult = 1 + 0.15 * this.moduleLevel('ARMOR');
    for (const m of this.squad) {
      if (m.squadKey !== s.key) {
        continue;
      }
      const ratio = m.hp / m.maxHp;
      m.def = into;
      m.radius = into.radius;
      m.baseMaxHp = into.hp;
      m.maxHp = into.hp * hpMult;
      m.hp = Math.max(1, m.maxHp * Math.max(ratio, 0.6));
      this.addEffect('EVOLVE', m.x, m.y, 0, 16, 0, 0.8, '#ffcf4a');
    }
    this.reassignSlots();
    return from;
  }

  /** 강화 장갑 레벨 변화 시 최대 체력 재계산 */
  private refreshMaxHp(): void {
    const hpMult = 1 + 0.15 * this.moduleLevel('ARMOR');
    for (const m of this.squad) {
      const next = m.baseMaxHp * hpMult;
      m.hp += next - m.maxHp;
      m.maxHp = next;
    }
    const c = this.commander;
    const nextC = this.commanderDef.hp * hpMult;
    c.hp += nextC - c.maxHp;
    c.maxHp = nextC;
  }

  private reassignSlots(): void {
    let rings = 1;
    while (rings < MAX_RINGS && capacityForRings(rings) < this.squad.length) {
      rings += 1;
    }
    if (rings !== this.rings || this.slotOffsets.length === 0) {
      this.rings = rings;
      this.slotOffsets = buildSlotOffsets(rings);
    }
    const roles = this.squad.map((m) => m.def.role);
    const slots = assignSlots(roles, this.rings);
    for (let i = 0; i < this.squad.length; i += 1) {
      this.squad[i].slotIndex = Math.max(0, slots[i]);
    }
  }

  private updateReinforcements(dt: number): void {
    for (const s of this.squads) {
      const interval = s.def.reinforceIntervalSec;
      if (!interval || this.aliveInSquad(s.key) === 0) {
        continue;
      }
      s.reinforceTimer += dt;
      if (s.reinforceTimer < interval) {
        continue;
      }
      s.reinforceTimer = 0;
      let target: SquadState | null = null;
      for (const o of this.squads) {
        if (this.missingInSquad(o) > 0 && (!target || this.missingInSquad(o) > this.missingInSquad(target))) {
          target = o;
        }
      }
      if (target) {
        const m = this.spawnMember(target);
        this.addEffect('LEVEL', m.x, m.y, 0, 12, 0, 0.5, '#7cf2a0');
        this.reassignSlots();
      }
    }
  }

  private cleanupSquad(): void {
    let removed = false;
    for (let i = this.squad.length - 1; i >= 0; i -= 1) {
      const m = this.squad[i];
      if (!m.alive) {
        this.addEffect('DEATH', m.x, m.y, 0, 10, 0, 0.5, this.paletteFor(m.def).primary);
        this.squad.splice(i, 1);
        removed = true;
      }
    }
    if (removed) {
      this.reassignSlots();
    }
  }

  // ─────────────────────────── 부대 전투 ───────────────────────────

  private updateSquad(dt: number): void {
    const c = this.commander;
    const entrenched = this.isEntrenched;
    const hive = this.faction.id === 'HIVE';
    const passive = this.commanderDef.passive;
    const moving = c.idleSec === 0;
    const rapid = 1 - 0.07 * this.moduleLevel('RAPID');
    const rangeMul = (1 + 0.08 * this.moduleLevel('SCOPE')) * (entrenched ? 1.25 : 1);
    const coreMul = (1 + 0.1 * this.moduleLevel('CORE')) * this.overchargeMul;
    const critChance = 0.05 * this.moduleLevel('SCOPE');
    const speedMul = this.speedMul;

    for (let i = 0; i < this.squad.length; i += 1) {
      const m = this.squad[i];
      const a = m.def.attack;
      const sq = this.getSquad(m.squadKey);
      const sqLevel = sq ? sq.level : 1;
      const onSlime = hive && this.isOnSlime(m.x, m.y);
      const range = a.rangePx * rangeMul;
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
      m.moving = dist > 1.2 || c.moving;
      if (dist > 0.5) {
        const catchUp = dist > 40 ? 1.7 : 1;
        const maxSpeed = m.def.moveSpeed * speedMul * catchUp * (onSlime ? 1.2 : 1);
        // 스프링 추종: 가까울수록 감속해 대형에 부드럽게 안착
        const speed = Math.min(maxSpeed, dist * 7);
        const stepLen = Math.min(dist, speed * dt);
        m.x += (dx / dist) * stepLen;
        m.y += (dy / dist) * stepLen;
        if (Math.abs(dx) > 1) {
          m.facingX = dx > 0 ? 1 : -1;
        }
        if (m.attackFlashSec <= 0 && dist > 1.5) {
          m.facingAngle = Math.atan2(dy, dx);
        }
      } else if (m.attackFlashSec <= 0 && a.targeting === 'FACING') {
        m.facingAngle = Math.atan2(c.dirY, c.dirX);
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
      const gunnery = passive === 'GUNNERY' && (a.style === 'PROJECTILE' || a.style === 'PIERCE') ? 1.15 : 1;
      m.cooldown -= dt * (onSlime ? 1.3 : 1) * gunnery;
      if (m.cooldown > 0) {
        continue;
      }
      let dmg = a.damage * squadLevelDamageMult(sqLevel) * coreMul * (entrenched ? 1.35 : 1);
      if (passive === 'VANGUARD' && moving && a.targeting === 'FACING') {
        dmg *= 1.25;
      }
      if (passive === 'FORTIFY' && entrenched && (a.style === 'MINE' || a.style === 'CHAIN')) {
        dmg *= 1.4;
      }
      if (a.style !== 'HEAL' && critChance > 0 && this.rng() < critChance) {
        dmg *= 2;
      }
      if (this.performSquadAttack(m, a, dmg, range)) {
        m.cooldown = a.cooldownSec * rapid;
        m.attackFlashSec = 0.22;
      }
    }
  }

  /** @returns 실제로 공격이 발동했는지 */
  private performSquadAttack(m: SquadMemberState, a: AttackProfile, dmg: number, range: number): boolean {
    const color = this.paletteFor(m.def).accent;
    const areaMul = 1 + 0.1 * this.moduleLevel('AREA');
    const extra = Math.ceil(this.moduleLevel('MAGAZINE') / 2);
    switch (a.style) {
      case 'HEAL': {
        const target = this.findMostWoundedAlly(m.x, m.y, range);
        if (!target) {
          return false;
        }
        target.hp = Math.min(target.maxHp, target.hp + dmg);
        m.facingAngle = Math.atan2(target.y - m.y, target.x - m.x);
        this.addEffect('HEAL', target.x, target.y, 0, 8, 0, 0.35, '#7cf2a0');
        return true;
      }
      case 'PULSE': {
        const r = range * areaMul;
        const nearest = this.findNearestEnemy(m.x, m.y, r);
        if (!nearest) {
          return false;
        }
        m.facingAngle = Math.atan2(nearest.y - m.y, nearest.x - m.x);
        this.damageEnemiesInRadius(m.x, m.y, r, dmg);
        this.addEffect('PULSE', m.x, m.y, 0, r, 0, 0.3, color);
        return true;
      }
      case 'MELEE': {
        const target = this.findNearestEnemy(m.x, m.y, range + m.radius);
        if (!target) {
          return false;
        }
        this.damageEnemy(target, dmg, a.bonusVsElite ?? 1, a.executePct ?? 0, m.x, m.y);
        const ang = Math.atan2(target.y - m.y, target.x - m.x);
        if (a.knockbackPx && !target.isBoss) {
          const kb = a.knockbackPx * (target.isElite ? 0.4 : 1);
          target.x += Math.cos(ang) * kb;
          target.y += Math.sin(ang) * kb;
        }
        m.facingX = target.x >= m.x ? 1 : -1;
        m.facingAngle = ang;
        this.addEffect('SLASH', (m.x + target.x) / 2, (m.y + target.y) / 2, ang, 8, 0, 0.15, '#f4f4f4');
        return true;
      }
      case 'CONE': {
        const r = range * areaMul;
        const { aimX, aimY, hasTarget } = this.resolveAim(m, a, r);
        if (!hasTarget) {
          return false;
        }
        const half = ((a.coneHalfAngleDeg ?? 30) * Math.PI) / 180;
        const hits = this.damageEnemiesInCone(m.x, m.y, aimX, aimY, r, half, dmg);
        if (hits === 0 && a.targeting === 'AUTO') {
          return false;
        }
        if (a.burnDps && hits > 0) {
          this.addZone(m.x + aimX * r * 0.65, m.y + aimY * r * 0.65, r * 0.45, a.burnDps * (dmg / a.damage), a.burnSec ?? 2);
        }
        m.facingX = aimX >= 0 ? 1 : -1;
        m.facingAngle = Math.atan2(aimY, aimX);
        this.addEffect('CONE', m.x, m.y, Math.atan2(aimY, aimX), r, half, 0.2, color);
        return true;
      }
      case 'PROJECTILE':
      case 'PIERCE': {
        const { aimX, aimY, hasTarget } = this.resolveAim(m, a, range);
        if (!hasTarget) {
          return false;
        }
        m.facingX = aimX >= 0 ? 1 : -1;
        m.facingAngle = Math.atan2(aimY, aimX);
        const shots = (a.multishot ?? 1) + extra;
        const spread = ((a.spreadDeg ?? 9) * Math.PI) / 180;
        const base = Math.atan2(aimY, aimX);
        const splashA: AttackProfile = a.splashRadiusPx ? { ...a, splashRadiusPx: a.splashRadiusPx * areaMul } : a;
        for (let k = 0; k < shots; k += 1) {
          const ang = base + (k - (shots - 1) / 2) * spread;
          this.spawnProjectile(m.x, m.y, Math.cos(ang), Math.sin(ang), splashA, dmg, range, color);
        }
        return true;
      }
      case 'CHAIN': {
        const first = this.findTarget(m.x, m.y, range, a.priority ?? 'NEAREST');
        if (!first) {
          return false;
        }
        m.facingAngle = Math.atan2(first.y - m.y, first.x - m.x);
        const jumps = (a.chainJumps ?? 2) + extra;
        const jumpR = (a.chainRadiusPx ?? 50) * areaMul;
        const hit: number[] = [];
        let fromX = m.x;
        let fromY = m.y;
        let cur: EnemyState | null = first;
        for (let k = 0; k <= jumps && cur; k += 1) {
          this.damageEnemy(cur, dmg, a.bonusVsElite ?? 1, 0, fromX, fromY);
          hit.push(cur.id);
          this.addEffect('CHAIN', fromX, fromY, 0, 0, 0, 0.18, '#9fe8ff', cur.x, cur.y);
          fromX = cur.x;
          fromY = cur.y;
          cur = this.findNearestExcluding(fromX, fromY, jumpR, hit);
        }
        return true;
      }
      case 'MINE': {
        if (this.mines.length >= MAX_MINES) {
          return false;
        }
        this.mines.push({
          id: this.nextId++,
          x: m.x,
          y: m.y,
          armSec: 0.4,
          damage: dmg,
          splashRadiusPx: (a.splashRadiusPx ?? 24) * areaMul,
          burnDps: a.burnDps ? a.burnDps * (dmg / a.damage) : 0,
          burnSec: a.burnSec ?? 0,
          alive: true,
        });
        return true;
      }
    }
  }

  /**
   * 조준 방향 결정.
   * AUTO: 우선순위(가까운 적 / 체력 높은 적)에 따른 표적 방향.
   * FACING: 지휘관이 바라보는 방향의 원뿔 안 가장 가까운 적 → 없으면 사거리 안에 적이 있을 때 정면 방향 그대로.
   */
  private resolveAim(m: Actor, a: AttackProfile, range: number): { aimX: number; aimY: number; hasTarget: boolean } {
    if (a.targeting === 'AUTO') {
      const t = this.findTarget(m.x, m.y, range, a.priority ?? 'NEAREST');
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
      switch (ev.kind) {
        case 'ENCIRCLE': {
          const r = this.spawnRadius * 0.7;
          for (let i = 0; i < ev.count; i += 1) {
            const ang = (i / ev.count) * Math.PI * 2;
            this.spawnEnemy(ev.enemyId, c.x + Math.cos(ang) * r, c.y + Math.sin(ang) * r, false, false);
          }
          this.announce('포위 경보!');
          break;
        }
        case 'ELITE':
          for (let i = 0; i < ev.count; i += 1) {
            const p = this.pickSpawnPoint();
            this.spawnEnemy(ev.enemyId, p.x, p.y, true, false);
          }
          break;
        case 'CROSSING':
          this.spawnCrossing(ev.enemyId, ev.count);
          this.announce('횡단 무리 접근!');
          break;
        case 'ACID':
          for (let i = 0; i < ev.count; i += 1) {
            const a = this.rng() * Math.PI * 2;
            const r = 30 + this.rng() * 120;
            this.addHazard(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, 26 + this.rng() * 10, 1.2, 12, 9, 0, '#9be04a');
          }
          this.announce('산성 지대 발생!');
          break;
        case 'NEST':
          for (let i = 0; i < ev.count; i += 1) {
            const a = Math.atan2(c.dirY, c.dirX) + (this.rng() - 0.5) * 1.6;
            const r = this.spawnRadius * 0.55;
            this.spawnEnemy(ev.enemyId, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, false, false);
          }
          this.announce('둥지 출현: 파괴하지 않으면 무리가 계속 나온다');
          break;
        case 'MINIBOSS':
        case 'BOSS': {
          const p = this.pickSpawnPoint();
          const b = this.spawnEnemy(ev.enemyId, p.x, p.y, false, true);
          if (b.behavior === 'SPIRE') {
            const a = Math.atan2(c.dirY, c.dirX);
            b.x = b.px = c.x + Math.cos(a) * this.spawnRadius * 0.6;
            b.y = b.py = c.y + Math.sin(a) * this.spawnRadius * 0.6;
          }
          this.boss = b;
          if (ev.kind === 'BOSS') {
            b.isFinalBoss = true;
            this.finalBoss = b;
            this.bossSpawned = true;
          }
          this.announce(`${ev.kind === 'BOSS' ? '최종 보스' : '중간 보스'}: ${b.def.name}`);
          break;
        }
      }
    }
  }

  /** 화면 한쪽 바깥에서 반대편으로 일직선 횡단하는 무리 */
  private spawnCrossing(enemyId: string, count: number): void {
    const c = this.commander;
    const a = this.rng() * Math.PI * 2;
    const dirX = -Math.cos(a);
    const dirY = -Math.sin(a);
    const startX = c.x + Math.cos(a) * this.spawnRadius;
    const startY = c.y + Math.sin(a) * this.spawnRadius;
    const perpX = -dirY;
    const perpY = dirX;
    const width = this.spawnRadius * 0.9;
    for (let i = 0; i < count; i += 1) {
      const off = (i / Math.max(1, count - 1) - 0.5) * width * 2;
      const back = this.rng() * 30;
      const e = this.spawnEnemy(enemyId, startX + perpX * off - dirX * back, startY + perpY * off - dirY * back, false, false);
      e.behavior = 'LINE';
      e.dirX = dirX;
      e.dirY = dirY;
      e.speed = Math.max(e.speed, 40) * 1.4;
      e.lifeSec = (this.spawnRadius * 2.4) / e.speed;
    }
  }

  public announce(text: string): void {
    this.banner = text;
    this.bannerSec = 3;
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
    const eliteMul = elite ? 5 : 1;
    const hp = boss ? def.hp : def.hp * hpScale * eliteMul;
    const affixes: EliteAffix[] = [];
    if (elite) {
      const n = this.elapsedSec >= 300 ? 2 : 1;
      const pool = [...ALL_AFFIXES];
      for (let i = 0; i < n; i += 1) {
        affixes.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
      }
    }
    const shielded = affixes.includes('SHIELDED');
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
      speed: def.speed * (elite ? 1.1 : 1) * (affixes.includes('SWIFT') ? 1.5 : 1) * (boss ? 1 : 0.9 + this.rng() * 0.2),
      damage: def.damage * (elite ? 1.5 : 1),
      scale: def.scale * (elite ? 1.4 : 1),
      contactCd: 0,
      hitFlashSec: 0,
      attackFlashSec: 0,
      facingAngle: Math.PI / 2,
      isElite: elite,
      isBoss: boss,
      isFinalBoss: false,
      alive: true,
      silent: false,
      facingX: 1,
      behavior: def.behavior ?? 'CHASE',
      affixes,
      shield: shielded ? hp * 0.5 : 0,
      maxShield: shielded ? hp * 0.5 : 0,
      sinceHitSec: 99,
      auraBuffed: false,
      mode: 'CHASE',
      modeSec: 0,
      dirX: 1,
      dirY: 0,
      attackTimer: 1 + this.rng() * 2,
      spawnTimer: 1.5,
      dashCount: 0,
      ageSec: 0,
      lifeSec: 0,
    };
    this.enemies.push(e);
    return e;
  }

  private makeAIContext(): EnemyAIContext {
    return {
      commander: this.commander,
      rng: () => this.rng(),
      nearestAllyDist: (x, y) => {
        let best = Math.hypot(this.commander.x - x, this.commander.y - y);
        for (const m of this.squad) {
          const d = Math.hypot(m.x - x, m.y - y);
          if (d < best) {
            best = d;
          }
        }
        return best;
      },
      spawnMinion: (id, x, y) => (this.enemies.length < this.waves.maxEnemies + 80 ? this.spawnEnemy(id, x, y, false, false) : null),
      fireShot: (x, y, dx, dy, speed, damage, radius, color) => {
        if (this.enemyShots.length >= MAX_ENEMY_SHOTS) {
          return;
        }
        const l = Math.hypot(dx, dy) || 1;
        this.enemyShots.push({ x, y, px: x, py: y, vx: (dx / l) * speed, vy: (dy / l) * speed, damage, radius, lifeSec: 4, color, alive: true });
      },
      addHazard: (x, y, r, arm, life, dps, burst, color) => this.addHazard(x, y, r, arm, life, dps, burst, color),
      shieldEnemiesNear: (x, y, r, amount) => {
        for (const o of this.enemies) {
          if (o.alive && !o.isBoss && Math.hypot(o.x - x, o.y - y) <= r) {
            o.maxShield = Math.max(o.maxShield, amount);
            o.shield = Math.min(o.maxShield, o.shield + amount);
          }
        }
      },
      effect: (kind, x, y, radius, life, color, x2, y2) => this.addEffect(kind, x, y, 0, radius, 0, life, color, x2 ?? x, y2 ?? y),
      announce: (text) => this.announce(text),
    };
  }

  private addHazard(x: number, y: number, radius: number, armSec: number, lifeSec: number, dps: number, burst: number, color: string): void {
    if (this.hazards.length >= MAX_HAZARDS) {
      this.hazards.shift();
    }
    this.hazards.push({ x, y, radius, armSec, maxArmSec: armSec, lifeSec, dps, burst, burstDone: burst <= 0, color });
  }

  private damageAlliesInRadius(x: number, y: number, r: number, dmg: number): void {
    const hit = (a: Actor): void => {
      if (a.alive && Math.hypot(a.x - x, a.y - y) <= r + a.radius) {
        this.damageAlly(a, dmg);
      }
    };
    hit(this.commander);
    for (const m of this.squad) {
      hit(m);
    }
  }

  private updateHazards(dt: number): void {
    let w = 0;
    for (let i = 0; i < this.hazards.length; i += 1) {
      const h = this.hazards[i];
      if (h.armSec > 0) {
        h.armSec -= dt;
        this.hazards[w++] = h;
        continue;
      }
      if (!h.burstDone) {
        h.burstDone = true;
        this.damageAlliesInRadius(h.x, h.y, h.radius, h.burst);
      }
      if (h.dps > 0) {
        this.damageAlliesInRadius(h.x, h.y, h.radius, h.dps * dt);
      }
      h.lifeSec -= dt;
      if (h.lifeSec > 0) {
        this.hazards[w++] = h;
      }
    }
    this.hazards.length = w;
  }

  private updateEnemyShots(dt: number): void {
    let w = 0;
    const c = this.commander;
    for (let i = 0; i < this.enemyShots.length; i += 1) {
      const p = this.enemyShots[i];
      p.px = p.x;
      p.py = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.lifeSec -= dt;
      const tryHit = (a: Actor): boolean => {
        if (!a.alive) {
          return false;
        }
        const r = a.radius + p.radius;
        const dx = a.x - p.x;
        const dy = a.y - p.y;
        if (dx * dx + dy * dy <= r * r) {
          this.damageAlly(a, p.damage);
          return true;
        }
        return false;
      };
      let hit = tryHit(c);
      for (let k = 0; k < this.squad.length && !hit; k += 1) {
        hit = tryHit(this.squad[k]);
      }
      if (!hit && p.lifeSec > 0) {
        this.enemyShots[w++] = p;
      }
    }
    this.enemyShots.length = w;
  }

  private updateEnemies(dt: number): void {
    const c = this.commander;
    const hive = this.faction.id === 'HIVE';
    const despawnR = this.spawnRadius + 200;
    const despawn2 = despawnR * despawnR;

    // 오라 엘리트: 주변 적 피해 30% 감소
    for (const e of this.enemies) {
      e.auraBuffed = false;
    }
    for (const e of this.enemies) {
      if (e.alive && e.affixes.includes('AURA')) {
        const cand = this.hash.query(e.x, e.y, 60, this.scratch2);
        for (let k = 0; k < cand.length; k += 1) {
          const o = this.enemies[cand[k]];
          if (o && o !== e && Math.hypot(o.x - e.x, o.y - e.y) <= 56) {
            o.auraBuffed = true;
          }
        }
      }
    }

    for (let i = 0; i < this.enemies.length; i += 1) {
      const e = this.enemies[i];
      if (!e.alive) {
        continue;
      }
      e.contactCd -= dt;
      e.hitFlashSec = Math.max(0, e.hitFlashSec - dt);
      e.attackFlashSec = Math.max(0, e.attackFlashSec - dt);

      e.sinceHitSec += dt;
      if (e.maxShield > 0 && e.sinceHitSec > 3 && e.shield < e.maxShield) {
        e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.2 * dt);
      }

      const dxc = c.x - e.x;
      const dyc = c.y - e.y;
      const d2c = dxc * dxc + dyc * dyc;
      const anchored = e.isBoss || e.isElite || e.behavior === 'LINE' || e.behavior === 'NEST';
      if (d2c > despawn2 && !anchored) {
        const p = this.pickSpawnPoint();
        e.x = e.px = p.x;
        e.y = e.py = p.y;
        continue;
      }
      if (e.behavior === 'NEST' && d2c > despawn2 * 3) {
        e.alive = false;
        e.silent = true;
        continue;
      }
      const v = stepEnemyAI(e, this.ai, dt);
      if (!e.alive) {
        continue;
      }
      const slow = hive && this.isOnSlime(e.x, e.y) ? 0.7 : 1;
      e.x += v.x * slow * dt;
      e.y += v.y * slow * dt;
      if (Math.abs(v.x) > 1) {
        e.facingX = v.x > 0 ? 1 : -1;
      }
      if (Math.abs(v.x) + Math.abs(v.y) > 1) {
        e.facingAngle = Math.atan2(v.y, v.x);
      } else if (e.mode === 'AIM') {
        e.facingAngle = Math.atan2(e.dirY, e.dirX);
      }

      // 군집 분리 (반경 가중). 고정형(둥지·포자 탑)은 밀리지 않는다.
      const immovable = e.behavior === 'NEST' || e.behavior === 'SPIRE';
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
        if (!immovable && d2 < minD * minD && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const w = o.behavior === 'NEST' || o.behavior === 'SPIRE' ? 1 : o.radius / (e.radius + o.radius);
          const push = (minD - d) * w * 0.6;
          e.x += (ox / d) * push;
          e.y += (oy / d) * push;
        }
      }

      // 아군과 충돌: 부대원은 방벽 역할, 접촉 시 피해
      if (e.damage > 0) {
        this.collideEnemyWithAlly(e, c, immovable ? 1 : 0, 0);
        for (let s = 0; s < this.squad.length; s += 1) {
          const m = this.squad[s];
          this.collideEnemyWithAlly(e, m, immovable ? 1 : e.isBoss ? 0.6 : 0.15, m.def.reflectPct ?? 0);
        }
      } else {
        this.collideEnemyWithAlly(e, c, 1, 0);
      }
    }
  }

  private collideEnemyWithAlly(e: EnemyState, a: Actor, allyShare: number, reflectPct: number): void {
    if (!a.alive || !e.alive) {
      return;
    }
    const dx = e.x - a.x;
    const dy = e.y - a.y;
    const minD = e.radius + a.radius;
    const d2 = dx * dx + dy * dy;
    if (d2 >= (minD + 1.5) * (minD + 1.5)) {
      return;
    }
    if (e.contactCd <= 0 && e.damage > 0) {
      this.damageAlly(a, e.damage);
      e.contactCd = e.def.contactCooldownSec;
      e.attackFlashSec = 0.22;
      e.facingAngle = Math.atan2(a.y - e.y, a.x - e.x);
      if (reflectPct > 0) {
        this.damageEnemy(e, e.damage * reflectPct, 1, 0);
      }
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
    const n = this.enemies.length;
    for (let i = 0; i < n; i += 1) {
      const e = this.enemies[i];
      if (e.alive) {
        this.enemies[w++] = e;
        continue;
      }
      if (e.silent) {
        continue;
      }
      this.kills += 1;
      this.addEffect('DEATH', e.x, e.y, 0, e.radius + 2, 0, 0.35, e.def.palette.primary);
      if (e.def.xp > 0) {
        this.dropGem(e.x, e.y, e.def.xp * (e.isElite ? 8 : 1));
      }
      if (e.isElite || e.behavior === 'NEST') {
        this.chests.push({ id: this.nextId++, x: e.x, y: e.y, alive: true });
      }
      if (e.isBoss && !e.isFinalBoss) {
        this.chests.push({ id: this.nextId++, x: e.x - 8, y: e.y, alive: true });
        this.chests.push({ id: this.nextId++, x: e.x + 8, y: e.y, alive: true });
        this.announce(`${e.def.name} 격파! 보급 상자 2개`);
      }
      const splits = e.behavior === 'SPLITTER' ? 3 : 0;
      const affixSplits = e.affixes.includes('SPLIT') ? 4 : 0;
      for (let k = 0; k < splits + affixSplits; k += 1) {
        const a = (k / (splits + affixSplits)) * Math.PI * 2;
        this.spawnEnemy('mite', e.x + Math.cos(a) * 6, e.y + Math.sin(a) * 6, false, false);
      }
      if (e.affixes.includes('VOLATILE')) {
        this.addHazard(e.x, e.y, 40, 0.7, 0.05, 0, 28, '#ff8a3a');
        this.addEffect('TELE_CIRCLE', e.x, e.y, 0, 40, 0, 0.7, '#ff8a3a');
      }
    }
    // 루프 중 분열로 추가된 개체 보존
    for (let i = n; i < this.enemies.length; i += 1) {
      this.enemies[w++] = this.enemies[i];
    }
    this.enemies.length = w;
  }

  // ─────────────────────────── 투사체·지뢰·장판 ───────────────────────────

  private spawnProjectile(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    a: AttackProfile,
    damage: number,
    range: number,
    color: string
  ): void {
    const d = Math.hypot(dirX, dirY) || 1;
    const speed = a.projectileSpeed ?? 250;
    this.projectiles.push({
      id: this.nextId++,
      x,
      y,
      px: x,
      py: y,
      vx: (dirX / d) * speed,
      vy: (dirY / d) * speed,
      damage,
      radius: a.style === 'PIERCE' ? 3 : 2,
      lifeSec: (range * 1.15) / speed,
      pierceLeft: a.style === 'PIERCE' ? a.pierce ?? 1 : 0,
      splashRadiusPx: a.splashRadiusPx ?? 0,
      color,
      hitIds: [],
      bonusVsElite: a.bonusVsElite ?? 1,
      executePct: a.executePct ?? 0,
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
          this.explode(p.x, p.y, p.splashRadiusPx, p.damage, 0, 0);
          p.alive = false;
          break;
        }
        this.damageEnemy(e, p.damage, p.bonusVsElite, p.executePct, p.px, p.py);
        p.hitIds.push(e.id);
        p.pierceLeft -= 1;
        if (p.pierceLeft < 0) {
          p.alive = false;
        }
      }

      if (p.alive && p.lifeSec <= 0) {
        if (p.splashRadiusPx > 0) {
          this.explode(p.x, p.y, p.splashRadiusPx, p.damage, 0, 0);
        }
        p.alive = false;
      }
      if (p.alive) {
        this.projectiles[w++] = p;
      }
    }
    this.projectiles.length = w;
  }

  private explode(x: number, y: number, r: number, dmg: number, burnDps: number, burnSec: number): void {
    this.damageEnemiesInRadius(x, y, r, dmg);
    this.addEffect('BOOM', x, y, 0, r, 0, 0.3, '#ffb347');
    if (burnDps > 0) {
      this.addZone(x, y, r * 0.8, burnDps, burnSec);
    }
  }

  private updateMines(dt: number): void {
    let w = 0;
    for (let i = 0; i < this.mines.length; i += 1) {
      const mine = this.mines[i];
      mine.armSec -= dt;
      if (mine.armSec <= 0 && this.findNearestEnemy(mine.x, mine.y, MINE_TRIGGER_PX)) {
        this.explode(mine.x, mine.y, mine.splashRadiusPx, mine.damage, mine.burnDps, mine.burnSec);
        mine.alive = false;
      }
      if (mine.alive) {
        this.mines[w++] = mine;
      }
    }
    this.mines.length = w;
  }

  private addZone(x: number, y: number, radius: number, dps: number, life: number): void {
    if (this.zones.length >= MAX_ZONES) {
      this.zones.shift();
    }
    this.zones.push({ x, y, radius, dps, lifeSec: life, maxLifeSec: life });
  }

  private updateZones(dt: number): void {
    let w = 0;
    for (let i = 0; i < this.zones.length; i += 1) {
      const z = this.zones[i];
      z.lifeSec -= dt;
      const cand = this.hash.query(z.x, z.y, z.radius + 24, this.scratch);
      for (let k = 0; k < cand.length; k += 1) {
        const e = this.enemies[cand[k]];
        if (!e || !e.alive) {
          continue;
        }
        const reach = z.radius + e.radius;
        const dx = e.x - z.x;
        const dy = e.y - z.y;
        if (dx * dx + dy * dy <= reach * reach) {
          e.hp -= z.dps * dt * (e.auraBuffed ? 0.7 : 1);
          if (e.hp <= 0) {
            e.alive = false;
          }
        }
      }
      if (z.lifeSec > 0) {
        this.zones[w++] = z;
      }
    }
    this.zones.length = w;
  }

  // ─────────────────────────── 피해 ───────────────────────────

  private damageEnemy(e: EnemyState, dmg: number, bonusVsElite: number, executePct: number, srcX = e.x, srcY = e.y): void {
    if (!e.alive) {
      return;
    }
    let amount = e.isElite || e.isBoss ? dmg * bonusVsElite : dmg;
    if (e.auraBuffed) {
      amount *= 0.7;
    }
    amount *= shellReduction(e, this.commander, srcX, srcY);
    e.sinceHitSec = 0;
    if (e.shield > 0) {
      const absorbed = Math.min(e.shield, amount);
      e.shield -= absorbed;
      amount -= absorbed;
    }
    e.hp -= amount;
    e.hitFlashSec = 0.1;
    if (executePct > 0 && !e.isBoss && e.hp > 0 && e.hp / e.maxHp <= executePct) {
      e.hp = 0;
    }
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
        this.damageEnemy(e, dmg, 1, 0, x, y);
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
        this.damageEnemy(e, dmg, 1, 0, x, y);
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
    return this.findTarget(x, y, range, 'NEAREST');
  }

  private findTarget(x: number, y: number, range: number, priority: 'NEAREST' | 'HIGHEST_HP'): EnemyState | null {
    const cand = this.hash.query(x, y, range + 24, this.scratch);
    let best: EnemyState | null = null;
    let bestScore = Infinity;
    for (let k = 0; k < cand.length; k += 1) {
      const e = this.enemies[cand[k]];
      if (!e || !e.alive) {
        continue;
      }
      const dx = e.x - x;
      const dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      const reach = range + e.radius;
      if (d2 > reach * reach) {
        continue;
      }
      const score = priority === 'HIGHEST_HP' ? -e.hp : d2;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  private findNearestExcluding(x: number, y: number, range: number, exclude: number[]): EnemyState | null {
    const cand = this.hash.query(x, y, range + 24, this.scratch2);
    let best: EnemyState | null = null;
    let bestD2 = Infinity;
    for (let k = 0; k < cand.length; k += 1) {
      const e = this.enemies[cand[k]];
      if (!e || !e.alive || exclude.includes(e.id)) {
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

  // ─────────────────────────── 획득물·회복·이펙트 ───────────────────────────

  private dropGem(x: number, y: number, value: number): void {
    if (this.gems.length >= MAX_GEMS) {
      const g = this.gems[Math.floor(this.rng() * this.gems.length)];
      g.value += value;
      return;
    }
    this.gems.push({ id: this.nextId++, x, y, value, magnetized: false, alive: true });
  }

  private updatePickups(dt: number): void {
    const c = this.commander;
    const pick2 = this.pickupRadius * this.pickupRadius;
    const collectR = c.radius + 4;
    const pull = (p: { x: number; y: number }, magnetized: boolean): { magnetized: boolean; collected: boolean } => {
      const dx = c.x - p.x;
      const dy = c.y - p.y;
      const d2 = dx * dx + dy * dy;
      const mag = magnetized || d2 <= pick2;
      if (!mag) {
        return { magnetized: false, collected: false };
      }
      const d = Math.sqrt(d2) || 1;
      const stepLen = Math.min(d, GEM_MAGNET_SPEED * dt);
      p.x += (dx / d) * stepLen;
      p.y += (dy / d) * stepLen;
      return { magnetized: true, collected: d - stepLen <= collectR };
    };

    let w = 0;
    for (let i = 0; i < this.gems.length; i += 1) {
      const g = this.gems[i];
      const r = pull(g, g.magnetized);
      g.magnetized = r.magnetized;
      if (r.collected) {
        this.gainXp(g.value);
      } else {
        this.gems[w++] = g;
      }
    }
    this.gems.length = w;

    w = 0;
    for (let i = 0; i < this.chests.length; i += 1) {
      const ch = this.chests[i];
      if (pull(ch, false).collected) {
        this.pendingChests += 1;
      } else {
        this.chests[w++] = ch;
      }
    }
    this.chests.length = w;
  }

  private gainXp(amount: number): void {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.pendingLevelUps += 1;
    }
  }

  /** 보급 상자가 우선, 그다음 레벨업 */
  private maybeOpenChestOrLevelUp(): void {
    if (this.phase !== 'RUNNING') {
      return;
    }
    if (this.pendingChests > 0) {
      this.pendingChests -= 1;
      this.chestResult = this.openChest();
      this.phase = 'CHEST';
      return;
    }
    if (this.pendingLevelUps > 0) {
      this.offers = this.rollOffers(3);
      this.phase = 'LEVEL_UP';
      this.addEffect('LEVEL', this.commander.x, this.commander.y, 0, 30, 0, 0.6, '#f2e27a');
    }
  }

  private openChest(): ChestResult {
    const ready = this.squads.find((s) => this.canEvolve(s));
    if (ready) {
      const fromId = this.evolveSquad(ready);
      return { kind: 'EVOLVE', fromId, intoId: ready.def.id };
    }
    const offer = this.rollOffers(1).find((o) => o.kind !== 'RESUPPLY' && o.kind !== 'OVERCHARGE');
    if (offer) {
      this.applyOffer(offer);
      return { kind: 'UPGRADE', offer };
    }
    this.applyOffer({ kind: 'RESUPPLY' });
    return { kind: 'RESUPPLY' };
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
    color: string,
    x2 = x,
    y2 = y
  ): void {
    if (this.effects.length >= MAX_EFFECTS) {
      this.effects.shift();
    }
    this.effects.push({ kind, x, y, x2, y2, angle, radius, halfAngle, lifeSec: life, maxLifeSec: life, color });
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

  private rollOffers(count: number): LevelUpOffer[] {
    const pool: { offer: LevelUpOffer; weight: number }[] = [];
    const ownedSquads = new Set(this.squads.map((s) => s.key));
    const ownedModules = new Set(this.modules.map((m) => m.id));
    const wantedModules = new Set<ModuleId>();
    for (const s of this.squads) {
      if (s.def.evolution && !s.def.evolved) {
        wantedModules.add(s.def.evolution.moduleId);
      }
    }

    if (this.squads.length < MAX_SQUADS) {
      for (const unitId of this.faction.unitPool) {
        if (!ownedSquads.has(unitId)) {
          pool.push({ offer: { kind: 'NEW_SQUAD', unitId }, weight: 2.6 });
        }
      }
    }
    for (const s of this.squads) {
      if (s.level < MAX_SQUAD_LEVEL) {
        pool.push({ offer: { kind: 'SQUAD_LEVEL', unitId: s.key, nextLevel: s.level + 1 }, weight: 3 });
      }
    }
    if (this.modules.length < MAX_MODULES) {
      for (const id of ALL_MODULE_IDS) {
        if (!ownedModules.has(id)) {
          pool.push({ offer: { kind: 'NEW_MODULE', moduleId: id }, weight: wantedModules.has(id) ? 3.2 : 1.6 });
        }
      }
    }
    for (const m of this.modules) {
      if (m.level < MAX_MODULE_LEVEL) {
        pool.push({ offer: { kind: 'MODULE_LEVEL', moduleId: m.id, nextLevel: m.level + 1 }, weight: 1.8 });
      }
    }
    const missing = this.totalMissing();
    if (missing >= 2) {
      pool.push({ offer: { kind: 'REINFORCE', missing }, weight: 1 + missing * 0.4 });
    }

    const picked: LevelUpOffer[] = [];
    // 첫 분대 선택: 지휘관 추천 분대를 선택지 하나로 보장
    if (this.squads.length === 0) {
      const sig = pool.findIndex((p) => p.offer.kind === 'NEW_SQUAD' && p.offer.unitId === this.commanderDef.startingSquad);
      if (sig >= 0 && count > 0) {
        picked.push(pool[sig].offer);
        pool.splice(sig, 1);
      }
    }
    while (picked.length < count && pool.length > 0) {
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
    // 모든 슬롯이 최대치면 과충전(무한 성장)과 긴급 보급으로 채운다
    if (picked.length < count) {
      picked.push({ kind: 'OVERCHARGE', stacks: this.overchargeStacks + 1 });
    }
    while (picked.length < count) {
      picked.push({ kind: 'RESUPPLY' });
    }
    return picked;
  }

  private applyOffer(offer: LevelUpOffer): void {
    switch (offer.kind) {
      case 'NEW_SQUAD':
        if (this.squads.length < MAX_SQUADS && !this.getSquad(offer.unitId)) {
          this.addSquad(offer.unitId);
        }
        return;
      case 'SQUAD_LEVEL': {
        const s = this.getSquad(offer.unitId);
        if (!s || s.level >= MAX_SQUAD_LEVEL) {
          return;
        }
        s.level += 1;
        const m = this.spawnMember(s);
        this.addEffect('LEVEL', m.x, m.y, 0, 14, 0, 0.5, this.paletteFor(s.def).accent);
        this.reassignSlots();
        return;
      }
      case 'NEW_MODULE':
        if (this.modules.length < MAX_MODULES && this.moduleLevel(offer.moduleId) === 0) {
          this.modules.push({ id: offer.moduleId, level: 1 });
          if (offer.moduleId === 'ARMOR') {
            this.refreshMaxHp();
          }
        }
        return;
      case 'MODULE_LEVEL': {
        const m = this.modules.find((x) => x.id === offer.moduleId);
        if (m && m.level < MAX_MODULE_LEVEL) {
          m.level += 1;
          if (m.id === 'ARMOR') {
            this.refreshMaxHp();
          }
        }
        return;
      }
      case 'REINFORCE':
        this.reinforceAll();
        return;
      case 'OVERCHARGE':
        this.overchargeStacks += 1;
        return;
      case 'RESUPPLY': {
        const c = this.commander;
        c.hp = c.maxHp;
        c.shield = c.maxShield;
        for (const m of this.squad) {
          m.hp = m.maxHp;
          m.shield = m.maxShield;
        }
        return;
      }
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
      facingAngle: Math.PI / 2,
      moving: false,
      attackFlashSec: 0,
    };
  }
}

export const ALL_MODULE_IDS: readonly ModuleId[] = ['RAPID', 'MAGAZINE', 'AREA', 'SCOPE', 'ARMOR', 'CORE', 'MOBILITY', 'BEACON'];

/** 유닛 정의의 진화 결과 (UI용) */
export function getEvolutionTarget(def: SquadUnitDef): SquadUnitDef | null {
  return def.evolution ? getSquadUnitDef(def.evolution.intoId) : null;
}
