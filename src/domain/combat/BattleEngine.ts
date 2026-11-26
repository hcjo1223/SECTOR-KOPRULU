import { getUnitDefinition } from '../UnitCatalog';
import { gridToLogicalCenter } from '../grid/GridSystem';
import { evaluateStageOutcome, type StageOutcome } from './StageRule';
import type {
  BattleUnitState,
  PlacedUnit,
  StageMode,
} from '../types';

export const FIXED_DT = 1 / 30;

export interface BattleSnapshot {
  tick: number;
  elapsedSec: number;
  outcome: StageOutcome;
  units: readonly BattleUnitState[];
}

export class BattleEngine {
  private units: BattleUnitState[] = [];
  private tickCount = 0;
  private elapsedSec = 0;
  private mode: StageMode = 'ANNIHILATION';
  private timeLimitSec = 45;
  private outcome: StageOutcome = 'ONGOING';

  public init(
    placedUnits: readonly PlacedUnit[],
    mode: StageMode = 'ANNIHILATION',
    timeLimitSec: number = 45
  ): void {
    this.tickCount = 0;
    this.elapsedSec = 0;
    this.mode = mode;
    this.timeLimitSec = timeLimitSec;
    this.outcome = 'ONGOING';

    this.units = [];
    for (let i = 0; i < placedUnits.length; i++) {
      const placed = placedUnits[i];
      const def = getUnitDefinition(placed.unitId);
      if (!def) {
        continue;
      }
      const center = gridToLogicalCenter(placed.col, placed.row);
      this.units.push({
        instanceId: placed.instanceId,
        unitId: placed.unitId,
        faction: placed.faction,
        logicalX: center.x,
        logicalY: center.y,
        hp: placed.currentHp,
        maxHp: def.base_stats.hp,
        shield: placed.currentShield,
        maxShield: def.base_stats.shield,
        action: 'IDLE',
        facing: placed.faction === 'ALLY' ? 1 : -1,
      });
    }
  }

  public step(ticks: number = 1): BattleSnapshot {
    for (let i = 0; i < ticks; i++) {
      if (this.outcome !== 'ONGOING') {
        break;
      }
      this.tickCount += 1;
      this.elapsedSec = this.tickCount * FIXED_DT;
      this.outcome = evaluateStageOutcome(
        this.mode,
        this.units,
        this.elapsedSec,
        this.timeLimitSec
      );
    }

    return this.getSnapshot();
  }

  public getSnapshot(): BattleSnapshot {
    return {
      tick: this.tickCount,
      elapsedSec: this.elapsedSec,
      outcome: this.outcome,
      units: this.units,
    };
  }
}
