export type FactionId = 'IRONCLAD' | 'HIVE' | 'LUMEN';

/** AUTO: 스스로 가장 가까운 적을 조준 / FACING: 지휘관이 바라보는 방향으로 공격 */
export type TargetingMode = 'AUTO' | 'FACING';

export type AttackStyle = 'PROJECTILE' | 'PIERCE' | 'MELEE' | 'CONE' | 'PULSE' | 'HEAL';

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
  | 'MITE'
  | 'CRAWLER'
  | 'BLOATER'
  | 'BRUTE'
  | 'MATRON';

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
}

export interface SquadUnitDef {
  id: string;
  name: string;
  faction: FactionId;
  role: FormationRole;
  description: string;
  hp: number;
  shield: number;
  moveSpeed: number;
  radius: number;
  attack: AttackProfile;
  sprite: SpriteArchetype;
}

export interface CommanderDef {
  id: string;
  name: string;
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
  commander: CommanderDef;
  unitPool: string[];
  startingUnits: string[];
  palette: FactionPalette;
}

export interface EnemyDef {
  id: string;
  name: string;
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

export type WaveEventKind = 'ELITE' | 'ENCIRCLE' | 'BOSS';

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

export type CommanderStat = 'HP' | 'SPEED' | 'MAGNET' | 'REGEN';

export type LevelUpOffer =
  | { kind: 'RECRUIT'; unitId: string }
  | { kind: 'UPGRADE'; unitId: string; nextLevel: number }
  | { kind: 'EXPAND'; nextRing: number }
  | { kind: 'COMMANDER'; stat: CommanderStat }
  | { kind: 'RESUPPLY' };

export type RunPhase = 'RUNNING' | 'LEVEL_UP' | 'DEFEAT' | 'VICTORY';

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
  slotIndex: number;
  cooldown: number;
  attackFlashSec: number;
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
  isElite: boolean;
  isBoss: boolean;
  alive: boolean;
  facingX: number;
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

export type EffectKind = 'SLASH' | 'CONE' | 'PULSE' | 'HEAL' | 'BOOM' | 'DEATH' | 'LEVEL';

export interface EffectState {
  kind: EffectKind;
  x: number;
  y: number;
  angle: number;
  radius: number;
  halfAngle: number;
  lifeSec: number;
  maxLifeSec: number;
  color: string;
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
  squadCount: number;
  squadCapacity: number;
  ringCount: number;
  traitActive: boolean;
  bossAlive: boolean;
  bossHp: number;
  bossMaxHp: number;
  unitLevels: Record<string, number>;
  squadByUnit: Record<string, number>;
}
