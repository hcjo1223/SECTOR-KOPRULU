export type Race = 'TERRAN' | 'ZERG' | 'PROTOSS';

export type Faction = 'ALLY' | 'ENEMY';

export type GridSize = 3 | 4 | 5;

export type ZoneType = 'ALLY' | 'CENTER' | 'ENEMY';

export type ArmorType = 'LIGHT' | 'ARMORED' | 'MASSIVE';

export type UnitTag =
  | 'WORKER'
  | 'BIO'
  | 'MECH'
  | 'INFANTRY'
  | 'SIEGE'
  | 'AIR'
  | 'SPLASH'
  | 'SUPPORT'
  | 'MELEE'
  | 'RANGED'
  | 'SWARM'
  | 'PSIONIC'
  | 'CARRIER';

export type SkillTrigger = 'ON_COMBAT_START' | 'ON_ATTACK' | 'ON_KILL' | 'PASSIVE';

export type StageMode = 'ANNIHILATION' | 'DEFENSE' | 'BREAKTHROUGH';

export type GamePhase = 'TITLE' | 'MAP' | 'PREP' | 'BATTLE' | 'REWARD';

export type GameSpeed = 1 | 2 | 4;

export type CommanderSkillId = 'NUCLEAR_SCAN' | 'DARK_SWARM' | 'PSIONIC_STORM';

export interface UnitBaseStats {
  hp: number;
  shield: number;
  attack: number;
  attack_speed: number;
  range: number;
  move_speed: number;
  armor_type: ArmorType;
}

export interface UnitSkill {
  id: string;
  name: string;
  description: string;
  trigger: SkillTrigger;
  effect: string;
}

export interface UnitVisual {
  sprite_sheet: string;
  sprite_size: 24 | 32 | 48 | 64;
  pivot_offset: [number, number];
  projectile_id: string | null;
  short_code: string;
}

export interface UnitDefinition {
  unit_id: string;
  name: string;
  race: Race;
  tier: 1 | 2 | 3 | 4;
  cost: number;
  grid_size: 1;
  tags: UnitTag[];
  base_stats: UnitBaseStats;
  skill: UnitSkill;
  visual: UnitVisual;
}

export interface GridCoord {
  col: number;
  row: number;
}

export interface GridDimensions {
  allyCols: GridSize;
  centerCols: number;
  enemyCols: GridSize;
  totalCols: number;
  rows: GridSize;
}

export interface GridCell {
  col: number;
  row: number;
  zone: ZoneType;
  occupantInstanceId: string | null;
}

export interface PlacedUnit {
  instanceId: string;
  unitId: string;
  faction: Faction;
  col: number;
  row: number;
  currentHp: number;
  currentShield: number;
  isObjectiveStructure?: boolean;
  structureName?: string;
}

export type UnitActionState = 'IDLE' | 'MOVE' | 'ATTACK' | 'DIE';

export interface BattleUnitState {
  instanceId: string;
  unitId: string;
  faction: Faction;
  logicalX: number;
  logicalY: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  action: UnitActionState;
  facing: 1 | -1;
  cooldownSec: number;
  attackCount: number;
  stimpackActive: boolean;
  siegeModeActive: boolean;
  chargeActive: boolean;
  darkSwarmBuff: boolean;
  isObjectiveStructure: boolean;
  structureName?: string;
}

export interface BattleProjectileState {
  id: number;
  projectileId: string;
  sourceInstanceId: string;
  sourceFaction: Faction;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  targetInstanceId: string | null;
  damage: number;
  splashRadiusPx: number;
  speedPxPerSec: number;
  color: string;
  size: number;
  bouncesLeft: number;
  bonusVsArmoredPct: number;
  visitedIds: string[];
}

export type BattleEffectType =
  | 'EXPLOSION'
  | 'HEAL'
  | 'PSI_STORM'
  | 'DARK_SWARM'
  | 'NUCLEAR'
  | 'STIMPACK'
  | 'SPINE_LINE'
  | 'CLEAVE';

export interface BattleEffectState {
  id: number;
  type: BattleEffectType;
  x: number;
  y: number;
  endX?: number;
  endY?: number;
  radiusPx: number;
  color: string;
  ttlSec: number;
  maxTtlSec: number;
}

export interface SynergyCount {
  tag: UnitTag | Race;
  label: string;
  count: number;
  threshold: number;
  active: boolean;
  bonusText: string;
}

export interface SynergySummary {
  totalUnits: number;
  raceCounts: Record<Race, number>;
  tagCounts: Partial<Record<UnitTag, number>>;
  activeSynergies: SynergyCount[];
}

export interface ProjectileDefinition {
  projectile_id: string;
  speed: number;
  splash_radius: number;
  color: string;
  size: number;
}

export interface StageDefinition {
  stage_id: string;
  act: 1 | 2 | 3;
  name: string;
  mode: StageMode;
  grid_size: GridSize;
  time_limit_sec: number;
  description: string;
}

export type MapNodeType = 'COMBAT' | 'SUPPLY' | 'DEPOT';

export interface TacticalMapNode {
  id: string;
  act: 1 | 2 | 3;
  step: number;
  lane: 0 | 1 | 2;
  type: MapNodeType;
  title: string;
  subtitle: string;
  stageMode: StageMode;
  gridSize: GridSize;
  rewardMinerals: number;
  completed: boolean;
}

export interface RelicDefinition {
  id: string;
  name: string;
  description: string;
  race: Race | 'ALL';
  bonusType: 'ATK_PCT' | 'HP_PCT' | 'SHIELD_FLAT' | 'ATK_SPD_PCT' | 'START_MINERALS';
  value: number;
}
