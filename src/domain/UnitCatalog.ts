import terranUnitsRaw from '../data/units_terran.json';
import zergUnitsRaw from '../data/units_zerg.json';
import protossUnitsRaw from '../data/units_protoss.json';
import projectilesRaw from '../data/projectiles.json';
import stagesRaw from '../data/stages.json';
import type {
  ProjectileDefinition,
  Race,
  StageDefinition,
  UnitDefinition,
} from './types';

const TERRAN_UNITS = terranUnitsRaw as UnitDefinition[];
const ZERG_UNITS = zergUnitsRaw as UnitDefinition[];
const PROTOSS_UNITS = protossUnitsRaw as UnitDefinition[];
const ALL_UNITS: readonly UnitDefinition[] = [
  ...TERRAN_UNITS,
  ...ZERG_UNITS,
  ...PROTOSS_UNITS,
];

const PROJECTILES = projectilesRaw as ProjectileDefinition[];
const STAGES = stagesRaw as StageDefinition[];

const UNIT_MAP = new Map<string, UnitDefinition>(
  ALL_UNITS.map((unit) => [unit.unit_id, unit])
);

const PROJECTILE_MAP = new Map<string, ProjectileDefinition>(
  PROJECTILES.map((proj) => [proj.projectile_id, proj])
);

export function getUnitDefinition(unitId: string): UnitDefinition | undefined {
  return UNIT_MAP.get(unitId);
}

export function getUnitsByRace(race: Race): readonly UnitDefinition[] {
  switch (race) {
    case 'TERRAN':
      return TERRAN_UNITS;
    case 'ZERG':
      return ZERG_UNITS;
    case 'PROTOSS':
      return PROTOSS_UNITS;
  }
}

export function getAllUnits(): readonly UnitDefinition[] {
  return ALL_UNITS;
}

export function getStartingWorkerId(race: Race): string {
  switch (race) {
    case 'TERRAN':
      return 'terran_scv';
    case 'ZERG':
      return 'zerg_drone';
    case 'PROTOSS':
      return 'protoss_probe';
  }
}

export function getProjectileDefinition(
  projectileId: string
): ProjectileDefinition | undefined {
  return PROJECTILE_MAP.get(projectileId);
}

export function getAllStages(): readonly StageDefinition[] {
  return STAGES;
}
