export type FactionId = 'IRONCLAD' | 'HIVE' | 'LUMEN';

/** AUTO: 스스로 가장 가까운 적을 조준 / FACING: 지휘관이 바라보는 방향으로 공격 */
export type TargetingMode = 'AUTO' | 'FACING';

export type AttackStyle = 'PROJECTILE' | 'PIERCE' | 'MELEE' | 'CONE' | 'PULSE' | 'HEAL' | 'CHAIN' | 'MINE';

/** NEAREST: 가장 가까운 적 / HIGHEST_HP: 사거리 내 체력이 가장 높은 적 */
export type TargetPriority = 'NEAREST' | 'HIGHEST_HP';

/** FRONT: 바깥 링(근접·탱커) / BACK: 안쪽 링(원거리·지원) */
export type FormationRole = 'FRONT' | 'BACK';

export type SpriteArchetype =
  | 'COMMANDER'
  | 'SOLDIER'
  | 'FLAMER'
  | 'WALKER'
  | 'DRONE'
  | 'CLAW'
  | 'SPITTER'
  | 'SPEWER'
  | 'BEETLE'
  | 'KNIGHT'
  | 'PRISM'
  | 'LANCER'
  | 'ORB'
  | 'SNIPER'
  | 'SHIELDER'
  | 'SAPPER'
  | 'TESLA'
  | 'MITE'
  | 'CRAWLER'
  | 'BLOATER'
  | 'BRUTE'
  | 'MATRON'
  | 'CHARGER'
  | 'SPORER'
  | 'SPLITTER'
  | 'BOMBER'
  | 'SHELL'
  | 'NEST'
  | 'QUEEN'
  | 'SPIRE';

export interface AttackProfile {
  targeting: TargetingMode;
  style: AttackStyle;
  damage: number;
  cooldownSec: number;
  rangePx: number;
  projectileSpeed?: number;
  splashRadiusPx?: number;
  pierce?: number;
  coneHalfAngleDeg?: number;
  priority?: TargetPriority;
  /** 한 번에 발사하는 투사체 수 */
  multishot?: number;
  spreadDeg?: number;
  knockbackPx?: number;
  chainJumps?: number;
  chainRadiusPx?: number;
  /** 적중 지점에 남는 화염 장판 */
  burnDps?: number;
  burnSec?: number;
  /** 엘리트·보스 대상 피해 배수 */
  bonusVsElite?: number;
  /** 체력 비율이 이하로 떨어진 일반·엘리트 적 즉사 */
  executePct?: number;
}

export type ModuleId = 'RAPID' | 'MAGAZINE' | 'AREA' | 'SCOPE' | 'ARMOR' | 'CORE' | 'MOBILITY' | 'BEACON';

export interface ModuleDef {
  id: ModuleId;
  name: string;
  summary: string;
  perLevel: string;
}

export interface EvolutionRecipe {
  moduleId: ModuleId;
  intoId: string;
}

export interface SquadUnitDef {
  id: string;
  name: string;
  faction: FactionId;
  role: FormationRole;
  /** 카드용 한 줄 설명 */
  summary: string;
  description: string;
  evolved?: boolean;
  evolution?: EvolutionRecipe;
  /** 접촉한 적에게 받은 피해의 일부를 되돌려줌 */
  reflectPct?: number;
  /** 주기적으로 결원이 생긴 분대에 1명씩 증원 */
  reinforceIntervalSec?: number;
  paletteOverride?: FactionPalette;
  hp: number;
  shield: number;
  moveSpeed: number;
  radius: number;
  attack: AttackProfile;
  sprite: SpriteArchetype;
}

export type CommanderPassive = 'NONE' | 'GUNNERY' | 'FORTIFY' | 'VANGUARD';

export interface CommanderDef {
  id: string;
  name: string;
  title: string;
  passive: CommanderPassive;
  passiveName: string;
  passiveDesc: string;
  /** 추천 분대: 시작 시 지급하지 않고 첫 레벨업 선택지에 보장된다 */
  startingSquad: string;
  paletteOverride?: FactionPalette;
  hp: number;
  shield: number;
  moveSpeed: number;
  radius: number;
  pickupRadius: number;
  attack: AttackProfile;
  sprite: SpriteArchetype;
}

export interface FactionPalette {
  primary: string;
  secondary: string;
  accent: string;
}

export interface FactionDef {
  id: FactionId;
  name: string;
  subtitle: string;
  traitName: string;
  traitDesc: string;
  commanders: CommanderDef[];
  unitPool: string[];
  palette: FactionPalette;
}

/**
 * CHASE 직진 / LINE 고정 방향 횡단 / CHARGER 조준 후 돌진 / SPITTER 거리 유지 원거리
 * SPLITTER 사망 시 분열 / BOMBER 접근 후 자폭 / SHELLED 정면 피해 감소 / NEST 고정 생산
 * QUEEN·SPIRE 중간 보스 / MATRON 최종 보스
 */
export type EnemyBehavior =
  | 'CHASE'
  | 'LINE'
  | 'CHARGER'
  | 'SPITTER'
  | 'SPLITTER'
  | 'BOMBER'
  | 'SHELLED'
  | 'NEST'
  | 'QUEEN'
  | 'SPIRE'
  | 'MATRON';

export type EliteAffix = 'SWIFT' | 'SPLIT' | 'AURA' | 'SHIELDED' | 'VOLATILE';

export interface EnemyDef {
  id: string;
  name: string;
  behavior?: EnemyBehavior;
  hp: number;
  damage: number;
  contactCooldownSec: number;
  speed: number;
  radius: number;
  xp: number;
  sprite: SpriteArchetype;
  scale: number;
  palette: FactionPalette;
}

export interface WaveStream {
  enemyId: string;
  fromSec: number;
  toSec: number;
  rateStart: number;
  rateEnd: number;
}

export type WaveEventKind = 'ELITE' | 'ENCIRCLE' | 'BOSS' | 'MINIBOSS' | 'CROSSING' | 'ACID' | 'NEST';

export interface WaveEvent {
  atSec: number;
  kind: WaveEventKind;
  enemyId: string;
  count: number;
}

export interface WaveTable {
  runLengthSec: number;
  maxEnemies: number;
  hpScalePerMinute: number;
  streams: WaveStream[];
  events: WaveEvent[];
}

export type LevelUpOffer =
  | { kind: 'NEW_SQUAD'; unitId: string }
  | { kind: 'SQUAD_LEVEL'; unitId: string; nextLevel: number }
  | { kind: 'NEW_MODULE'; moduleId: ModuleId }
  | { kind: 'MODULE_LEVEL'; moduleId: ModuleId; nextLevel: number }
  | { kind: 'REINFORCE'; missing: number }
  | { kind: 'OVERCHARGE'; stacks: number }
  | { kind: 'RESUPPLY' };

export type ChestResult =
  | { kind: 'EVOLVE'; fromId: string; intoId: string }
  | { kind: 'UPGRADE'; offer: LevelUpOffer }
  | { kind: 'RESUPPLY' };

export type RunPhase = 'RUNNING' | 'LEVEL_UP' | 'CHEST' | 'DEFEAT' | 'VICTORY';

/** 분대 = 같은 병종 부대원 묶음. 레벨 = 정원(레벨+1명) */
export interface SquadState {
  /** 슬롯 식별자 (진화 전 기본 유닛 id) */
  key: string;
  def: SquadUnitDef;
  level: number;
  reinforceTimer: number;
}

export interface ModuleState {
  id: ModuleId;
  level: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Actor {
  id: number;
  x: number;
  y: number;
  /** 직전 틱 좌표 (렌더링 보간용) */
  px: number;
  py: number;
  radius: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  alive: boolean;
  /** 마지막 피격 이후 경과 시간 (보호막 재생·피격 연출용) */
  sinceHitSec: number;
  facingX: number;
  /** 8방향 스프라이트 회전용 조준·이동 각도 (라디안, +π/2 = 정면 S) */
  facingAngle: number;
  /** 현재 틱 이동 여부 (IDLE vs WALK 애니메이션 판정) */
  moving: boolean;
  /** 공격 모션(ATTACK 프레임) 유지 잔여 시간 */
  attackFlashSec: number;
}

export interface CommanderState extends Actor {
  def: CommanderDef;
  cooldown: number;
  dirX: number;
  dirY: number;
  idleSec: number;
}

export interface SquadMemberState extends Actor {
  def: SquadUnitDef;
  squadKey: string;
  baseMaxHp: number;
  slotIndex: number;
  cooldown: number;
}

export interface EnemyState {
  id: number;
  def: EnemyDef;
  x: number;
  y: number;
  px: number;
  py: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  damage: number;
  scale: number;
  contactCd: number;
  hitFlashSec: number;
  attackFlashSec: number;
  facingAngle: number;
  isElite: boolean;
  isBoss: boolean;
  /** 최종 보스 여부 (처치 시 승리) */
  isFinalBoss: boolean;
  alive: boolean;
  /** 경험치·처치 수 없이 조용히 제거 (횡단 무리 이탈, 자폭 등) */
  silent: boolean;
  facingX: number;
  behavior: EnemyBehavior;
  affixes: EliteAffix[];
  shield: number;
  maxShield: number;
  sinceHitSec: number;
  auraBuffed: boolean;
  /** 행동 상태 머신 */
  mode: 'CHASE' | 'AIM' | 'DASH' | 'REST' | 'FUSE';
  modeSec: number;
  dirX: number;
  dirY: number;
  attackTimer: number;
  spawnTimer: number;
  dashCount: number;
  ageSec: number;
  lifeSec: number;
}

export interface EnemyShotState {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  lifeSec: number;
  color: string;
  alive: boolean;
}

/** 적이 만든 위험 지대: armSec 동안 예고 후 burst 1회 + dps 지속 피해 */
export interface HazardState {
  x: number;
  y: number;
  radius: number;
  armSec: number;
  maxArmSec: number;
  lifeSec: number;
  dps: number;
  burst: number;
  burstDone: boolean;
  color: string;
}

export interface ProjectileState {
  id: number;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  lifeSec: number;
  pierceLeft: number;
  splashRadiusPx: number;
  color: string;
  hitIds: number[];
  bonusVsElite: number;
  executePct: number;
  alive: boolean;
}

export interface GemState {
  id: number;
  x: number;
  y: number;
  value: number;
  magnetized: boolean;
  alive: boolean;
}

export type EffectKind = 'SLASH' | 'CONE' | 'PULSE' | 'HEAL' | 'BOOM' | 'DEATH' | 'LEVEL' | 'CHAIN' | 'EVOLVE' | 'TELE_LINE' | 'TELE_CIRCLE' | 'SHIELD_PULSE';

export interface EffectState {
  kind: EffectKind;
  x: number;
  y: number;
  x2: number;
  y2: number;
  angle: number;
  radius: number;
  halfAngle: number;
  lifeSec: number;
  maxLifeSec: number;
  color: string;
}

export interface ChestState {
  id: number;
  x: number;
  y: number;
  alive: boolean;
}

export interface MineState {
  id: number;
  x: number;
  y: number;
  armSec: number;
  damage: number;
  splashRadiusPx: number;
  burnDps: number;
  burnSec: number;
  alive: boolean;
}

/** 아군이 만든 지속 피해 장판 (화염 등) */
export interface ZoneState {
  x: number;
  y: number;
  radius: number;
  dps: number;
  lifeSec: number;
  maxLifeSec: number;
}

export interface SlimePatch {
  x: number;
  y: number;
  lifeSec: number;
}

export interface HudSnapshot {
  phase: RunPhase;
  elapsedSec: number;
  runLengthSec: number;
  level: number;
  xp: number;
  xpToNext: number;
  kills: number;
  commanderHp: number;
  commanderMaxHp: number;
  commanderShield: number;
  commanderMaxShield: number;
  commanderName: string;
  squadCount: number;
  traitActive: boolean;
  bossAlive: boolean;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  banner: string | null;
  squads: SquadHud[];
  modules: ModuleState[];
  chestResult: ChestResult | null;
}

export interface SquadHud {
  key: string;
  unitId: string;
  name: string;
  level: number;
  alive: number;
  headcount: number;
  evolved: boolean;
  evolveReady: boolean;
}
