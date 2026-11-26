import enemiesJson from '../../data/survivor_enemies.json';
import factionsJson from '../../data/survivor_factions.json';
import unitsJson from '../../data/survivor_units.json';
import wavesJson from '../../data/survivor_waves.json';
import type {
  EnemyDef,
  FactionDef,
  FactionId,
  SquadUnitDef,
  WaveTable,
} from './types';

const FACTIONS = factionsJson as FactionDef[];
const UNITS = unitsJson as SquadUnitDef[];
const ENEMIES = enemiesJson as EnemyDef[];
const WAVES = wavesJson as WaveTable;

const unitById = new Map<string, SquadUnitDef>(UNITS.map((u) => [u.id, u]));
const enemyById = new Map<string, EnemyDef>(ENEMIES.map((e) => [e.id, e]));

export function getFactions(): readonly FactionDef[] {
  return FACTIONS;
}

export function getFaction(id: FactionId): FactionDef {
  const f = FACTIONS.find((x) => x.id === id);
  if (!f) {
    throw new Error(`Unknown faction: ${id}`);
  }
  return f;
}

export function getSquadUnitDef(id: string): SquadUnitDef {
  const u = unitById.get(id);
  if (!u) {
    throw new Error(`Unknown squad unit: ${id}`);
  }
  return u;
}

export function getAllSquadUnits(): readonly SquadUnitDef[] {
  return UNITS;
}

export function getEnemyDef(id: string): EnemyDef {
  const e = enemyById.get(id);
  if (!e) {
    throw new Error(`Unknown enemy: ${id}`);
  }
  return e;
}

export function getAllEnemies(): readonly EnemyDef[] {
  return ENEMIES;
}

export function getWaveTable(): WaveTable {
  return WAVES;
}
