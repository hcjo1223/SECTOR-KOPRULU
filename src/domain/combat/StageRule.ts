import type { BattleUnitState, StageMode } from '../types';

export type StageOutcome = 'ONGOING' | 'VICTORY' | 'DEFEAT';

export function evaluateStageOutcome(
  mode: StageMode,
  units: readonly BattleUnitState[],
  elapsedSec: number,
  timeLimitSec: number,
  objectiveDestroyed: boolean = false
): StageOutcome {
  let aliveAllies = 0;
  let aliveEnemies = 0;

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    if (unit.hp <= 0) {
      continue;
    }
    if (unit.faction === 'ALLY') {
      aliveAllies += 1;
    } else {
      aliveEnemies += 1;
    }
  }

  if (aliveAllies === 0) {
    return 'DEFEAT';
  }

  switch (mode) {
    case 'ANNIHILATION':
      if (aliveEnemies === 0) {
        return 'VICTORY';
      }
      return elapsedSec >= timeLimitSec ? 'DEFEAT' : 'ONGOING';

    case 'DEFENSE':
      if (objectiveDestroyed) {
        return 'DEFEAT';
      }
      return elapsedSec >= timeLimitSec ? 'VICTORY' : 'ONGOING';

    case 'BREAKTHROUGH':
      if (objectiveDestroyed) {
        return 'VICTORY';
      }
      if (aliveEnemies === 0) {
        return 'VICTORY';
      }
      return elapsedSec >= timeLimitSec ? 'DEFEAT' : 'ONGOING';
  }
}
