import { create } from 'zustand';
import {
  BattleEngine,
  type BattleSnapshot,
} from '../domain/combat/BattleEngine';
import {
  CENTER_GAP_COLS,
  findFirstEmptyAllyCell,
  getMaxCapacity,
  moveOrSwapUnitOnGrid,
  placeUnitOnGrid,
  removeUnitFromGrid,
  resizeGridUnits,
} from '../domain/grid/GridSystem';
import { calculateSynergies } from '../domain/synergy/SynergyCalc';
import {
  getStartingWorkerId,
  getUnitDefinition,
  getUnitsByRace,
} from '../domain/UnitCatalog';
import type {
  CommanderSkillId,
  GamePhase,
  GameSpeed,
  GridSize,
  PlacedUnit,
  Race,
  StageMode,
  SynergySummary,
} from '../domain/types';

export interface DragPayload {
  source: 'GRID' | 'ROSTER';
  unitId: string;
  instanceId?: string;
  clientX: number;
  clientY: number;
}

interface GameStoreState {
  phase: GamePhase;
  selectedRace: Race;
  gridSize: GridSize;
  stageMode: StageMode;
  speed: GameSpeed;
  placedUnits: PlacedUnit[];
  selectedInstanceId: string | null;
  selectedRosterUnitId: string | null;
  dragPayload: DragPayload | null;
  statusBanner: string | null;
  synergySummary: SynergySummary;
  battleSnapshot: BattleSnapshot | null;

  startGame: (race: Race) => void;
  returnToTitle: () => void;
  setGridSize: (size: GridSize) => void;
  setStageMode: (mode: StageMode) => void;
  setSpeed: (speed: GameSpeed) => void;
  selectPlacedUnit: (instanceId: string | null) => void;
  selectRosterUnit: (unitId: string | null) => void;
  setDragPayload: (payload: DragPayload | null) => void;
  placeFromRosterAt: (unitId: string, col: number, row: number) => boolean;
  quickDeployFromRoster: (unitId: string) => boolean;
  moveOrSwapGridUnit: (instanceId: string, col: number, row: number) => boolean;
  removePlacedUnit: (instanceId: string) => void;
  populateSampleFormation: () => void;
  clearAllyUnits: () => void;
  setStatusBanner: (msg: string | null) => void;

  startBattle: () => void;
  stepBattleTicks: (ticks: number) => void;
  triggerCommanderSkill: () => boolean;
  returnToPrep: () => void;
}

let nextInstanceSeq = 1;
function createInstanceId(prefix: string): string {
  const id = `${prefix}_${nextInstanceSeq}`;
  nextInstanceSeq += 1;
  return id;
}

const battleEngine = new BattleEngine();

function buildEnemyPreviewUnits(gridSize: GridSize, playerRace: Race): PlacedUnit[] {
  const enemyRace: Race =
    playerRace === 'TERRAN' ? 'ZERG' : playerRace === 'ZERG' ? 'PROTOSS' : 'TERRAN';
  const enemyPool = getUnitsByRace(enemyRace);
  const enemyStartCol = gridSize + CENTER_GAP_COLS;
  const units: PlacedUnit[] = [];

  const worker = enemyPool[0];
  const frontline = enemyPool[1] ?? worker;
  const ranged = enemyPool[2] ?? worker;
  const siege = enemyPool[3] ?? ranged;
  const boss = enemyPool[enemyPool.length - 1] ?? siege;

  const addEnemy = (unitId: string, localCol: number, row: number) => {
    const def = getUnitDefinition(unitId);
    if (!def || localCol >= gridSize || row >= gridSize) {
      return;
    }
    units.push({
      instanceId: createInstanceId('enemy'),
      unitId,
      faction: 'ENEMY',
      col: enemyStartCol + localCol,
      row,
      currentHp: def.base_stats.hp,
      currentShield: def.base_stats.shield,
    });
  };

  addEnemy(frontline.unit_id, 0, 0);
  addEnemy(frontline.unit_id, 0, Math.min(2, gridSize - 1));
  if (gridSize >= 4) {
    addEnemy(worker.unit_id, 0, 1);
    addEnemy(frontline.unit_id, 0, 3);
  }
  if (gridSize >= 5) {
    addEnemy(frontline.unit_id, 0, 4);
  }

  addEnemy(ranged.unit_id, Math.min(1, gridSize - 1), 1);
  if (gridSize >= 4) {
    addEnemy(siege.unit_id, 2, 1);
    addEnemy(ranged.unit_id, 2, 2);
  }
  if (gridSize >= 5) {
    addEnemy(boss.unit_id, 4, 2);
  }

  return units;
}

function createInitialPlacement(race: Race, gridSize: GridSize): PlacedUnit[] {
  const workerId = getStartingWorkerId(race);
  const workerDef = getUnitDefinition(workerId);
  const allies: PlacedUnit[] = [];

  if (workerDef) {
    allies.push({
      instanceId: createInstanceId('ally'),
      unitId: workerId,
      faction: 'ALLY',
      col: Math.max(0, gridSize - 1),
      row: Math.floor(gridSize / 2),
      currentHp: workerDef.base_stats.hp,
      currentShield: workerDef.base_stats.shield,
    });
  }

  return [...allies, ...buildEnemyPreviewUnits(gridSize, race)];
}

export function getCommanderSkillForRace(race: Race): {
  id: CommanderSkillId;
  name: string;
  desc: string;
} {
  switch (race) {
    case 'TERRAN':
      return {
        id: 'NUCLEAR_SCAN',
        name: '전술 핵 타격',
        desc: '적 밀집 구역에 전술 핵을 투하해 광역 110 피해를 입힙니다.',
      };
    case 'ZERG':
      return {
        id: 'DARK_SWARM',
        name: '다크 스웜',
        desc: '모든 아군 체력 35% 회복 및 공격 속도 +45% 가속.',
      };
    case 'PROTOSS':
      return {
        id: 'PSIONIC_STORM',
        name: '사이오닉 폭풍',
        desc: '적 밀집 구역 85 피해 및 모든 아군 플라즈마 실드 +40 충전.',
      };
  }
}

const initialUnits = createInitialPlacement('TERRAN', 3);

export const useGameStore = create<GameStoreState>((set, get) => ({
  phase: 'TITLE',
  selectedRace: 'TERRAN',
  gridSize: 3,
  stageMode: 'ANNIHILATION',
  speed: 1,
  placedUnits: initialUnits,
  selectedInstanceId: initialUnits[0]?.instanceId ?? null,
  selectedRosterUnitId: null,
  dragPayload: null,
  statusBanner: null,
  synergySummary: calculateSynergies(initialUnits),
  battleSnapshot: null,

  startGame: (race) => {
    const gridSize: GridSize = 3;
    const placedUnits = createInitialPlacement(race, gridSize);
    set({
      phase: 'PREP',
      selectedRace: race,
      gridSize,
      stageMode: 'ANNIHILATION',
      placedUnits,
      selectedInstanceId: placedUnits[0]?.instanceId ?? null,
      selectedRosterUnitId: null,
      dragPayload: null,
      statusBanner: `${race} 전술 지휘소 초기화 완료 (3x3 그리드)`,
      synergySummary: calculateSynergies(placedUnits),
      battleSnapshot: null,
    });
  },

  returnToTitle: () => {
    set({
      phase: 'TITLE',
      dragPayload: null,
      statusBanner: null,
      battleSnapshot: null,
    });
  },

  setGridSize: (newSize) => {
    const state = get();
    if (state.gridSize === newSize) {
      return;
    }
    const onlyAllies = state.placedUnits.filter((u) => u.faction === 'ALLY');
    const resized = resizeGridUnits(onlyAllies, state.gridSize, newSize);
    const nextUnits = [
      ...resized.units,
      ...buildEnemyPreviewUnits(newSize, state.selectedRace),
    ];

    const removedMsg =
      resized.removedAllyUnits.length > 0
        ? ` (초과 병력 ${resized.removedAllyUnits.length}기 해제됨)`
        : '';

    set({
      gridSize: newSize,
      placedUnits: nextUnits,
      selectedInstanceId: null,
      statusBanner: `전장 그리드 ${newSize}x${newSize} (최대 ${getMaxCapacity(newSize)}기) 전환${removedMsg}`,
      synergySummary: calculateSynergies(nextUnits),
    });
  },

  setStageMode: (mode) => {
    const modeLabel =
      mode === 'ANNIHILATION'
        ? '적 몰살 (Annihilation)'
        : mode === 'DEFENSE'
          ? '거점 버티기 (Defense · 30초)'
          : '적진 돌파 (Breakthrough · 목표물 타격)';
    set({
      stageMode: mode,
      statusBanner: `전투 규칙 변경: ${modeLabel}`,
    });
  },

  setSpeed: (speed) => {
    set({ speed });
  },

  selectPlacedUnit: (instanceId) => {
    set({
      selectedInstanceId: instanceId,
      selectedRosterUnitId: instanceId ? null : get().selectedRosterUnitId,
    });
  },

  selectRosterUnit: (unitId) => {
    set({
      selectedRosterUnitId: unitId,
      selectedInstanceId: unitId ? null : get().selectedInstanceId,
    });
  },

  setDragPayload: (payload) => {
    set({ dragPayload: payload });
  },

  placeFromRosterAt: (unitId, col, row) => {
    const state = get();
    if (state.phase !== 'PREP') {
      return false;
    }
    const occupant = state.placedUnits.find(
      (u) => u.faction === 'ALLY' && u.col === col && u.row === row
    );

    let workingUnits = state.placedUnits;
    if (occupant) {
      const def = getUnitDefinition(unitId);
      if (!def) {
        return false;
      }
      workingUnits = state.placedUnits.map((u) =>
        u.instanceId === occupant.instanceId
          ? {
              ...u,
              unitId,
              currentHp: def.base_stats.hp,
              currentShield: def.base_stats.shield,
            }
          : u
      );
      set({
        placedUnits: workingUnits,
        selectedInstanceId: occupant.instanceId,
        selectedRosterUnitId: null,
        statusBanner: `${def.name} 교체 배치 (${col + 1}, ${row + 1})`,
        synergySummary: calculateSynergies(workingUnits),
      });
      return true;
    }

    const instanceId = createInstanceId('ally');
    const result = placeUnitOnGrid(
      workingUnits,
      instanceId,
      unitId,
      col,
      row,
      state.gridSize,
      'ALLY'
    );

    if (!result.ok) {
      const reasonText =
        result.reason === 'CAPACITY_FULL'
          ? `배치 한도 초과 (${getMaxCapacity(state.gridSize)}기 최대)`
          : '아군 진영 칸에만 배치할 수 있습니다.';
      set({ statusBanner: reasonText });
      return false;
    }

    const def = getUnitDefinition(unitId);
    set({
      placedUnits: result.units,
      selectedInstanceId: instanceId,
      selectedRosterUnitId: null,
      statusBanner: `${def?.name ?? unitId} 배치 완료 (${col + 1}, ${row + 1})`,
      synergySummary: calculateSynergies(result.units),
    });
    return true;
  },

  quickDeployFromRoster: (unitId) => {
    const state = get();
    const empty = findFirstEmptyAllyCell(state.placedUnits, state.gridSize);
    if (!empty) {
      set({
        statusBanner: `배치 공간이 가득 찼습니다 (${getMaxCapacity(state.gridSize)}/${getMaxCapacity(state.gridSize)})`,
      });
      return false;
    }
    return state.placeFromRosterAt(unitId, empty.col, empty.row);
  },

  moveOrSwapGridUnit: (instanceId, col, row) => {
    const state = get();
    if (state.phase !== 'PREP') {
      return false;
    }
    const result = moveOrSwapUnitOnGrid(
      state.placedUnits,
      instanceId,
      col,
      row,
      state.gridSize
    );
    if (!result.ok) {
      set({ statusBanner: '아군 전술 구역 내부로만 이동할 수 있습니다.' });
      return false;
    }
    set({
      placedUnits: result.units,
      selectedInstanceId: instanceId,
      statusBanner: result.swapped
        ? `유닛 위치 교대 (${col + 1}, ${row + 1})`
        : `유닛 이동 (${col + 1}, ${row + 1})`,
      synergySummary: calculateSynergies(result.units),
    });
    return true;
  },

  removePlacedUnit: (instanceId) => {
    const state = get();
    if (state.phase !== 'PREP') {
      return;
    }
    const target = state.placedUnits.find((u) => u.instanceId === instanceId);
    if (!target || target.faction !== 'ALLY') {
      return;
    }
    const nextUnits = removeUnitFromGrid(state.placedUnits, instanceId);
    const def = getUnitDefinition(target.unitId);
    set({
      placedUnits: nextUnits,
      selectedInstanceId:
        state.selectedInstanceId === instanceId ? null : state.selectedInstanceId,
      statusBanner: `${def?.name ?? target.unitId} 대기열로 회수`,
      synergySummary: calculateSynergies(nextUnits),
    });
  },

  populateSampleFormation: () => {
    const state = get();
    const pool = getUnitsByRace(state.selectedRace);
    const enemies = state.placedUnits.filter((u) => u.faction === 'ENEMY');
    const allies: PlacedUnit[] = [];
    const size = state.gridSize;

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const isFront = col === size - 1;
        const isBack = col === 0;
        let def = pool[0];
        if (isFront) {
          def = pool[1] ?? pool[0];
        } else if (isBack && size >= 4) {
          def = pool[pool.length - 1] ?? pool[2] ?? pool[0];
        } else if (pool.length > 2) {
          def = pool[(row + col) % pool.length];
        }

        if (allies.length < getMaxCapacity(size) && (row + col) % 2 === 0) {
          allies.push({
            instanceId: createInstanceId('ally'),
            unitId: def.unit_id,
            faction: 'ALLY',
            col,
            row,
            currentHp: def.base_stats.hp,
            currentShield: def.base_stats.shield,
          });
        }
      }
    }

    const nextUnits = [...allies, ...enemies];
    set({
      placedUnits: nextUnits,
      selectedInstanceId: allies[0]?.instanceId ?? null,
      statusBanner: `${state.selectedRace} 샘플 편대 배치 완료 (${allies.length}/${getMaxCapacity(size)}기)`,
      synergySummary: calculateSynergies(nextUnits),
    });
  },

  clearAllyUnits: () => {
    const state = get();
    const enemies = state.placedUnits.filter((u) => u.faction === 'ENEMY');
    const workerId = getStartingWorkerId(state.selectedRace);
    const workerDef = getUnitDefinition(workerId);
    const workerList: PlacedUnit[] = workerDef
      ? [
          {
            instanceId: createInstanceId('ally'),
            unitId: workerId,
            faction: 'ALLY',
            col: Math.max(0, state.gridSize - 1),
            row: Math.floor(state.gridSize / 2),
            currentHp: workerDef.base_stats.hp,
            currentShield: workerDef.base_stats.shield,
          },
        ]
      : [];

    const nextUnits = [...workerList, ...enemies];
    set({
      placedUnits: nextUnits,
      selectedInstanceId: workerList[0]?.instanceId ?? null,
      statusBanner: '기본 일꾼만 남기고 전열을 초기화했습니다.',
      synergySummary: calculateSynergies(nextUnits),
    });
  },

  setStatusBanner: (msg) => {
    set({ statusBanner: msg });
  },

  startBattle: () => {
    const state = get();
    const allyCount = state.placedUnits.filter((u) => u.faction === 'ALLY').length;
    if (allyCount === 0) {
      set({ statusBanner: '전투를 시작하려면 최소 1기의 아군 유닛을 배치하세요!' });
      return;
    }

    const combatUnits = [...state.placedUnits];
    const midRow = Math.floor(state.gridSize / 2);

    if (state.stageMode === 'DEFENSE') {
      const hasAllyObj = combatUnits.some(
        (u) => u.faction === 'ALLY' && u.col === 0 && u.row === midRow
      );
      if (!hasAllyObj) {
        const workerId = getStartingWorkerId(state.selectedRace);
        const def = getUnitDefinition(workerId);
        if (def) {
          combatUnits.push({
            instanceId: createInstanceId('ally_hq'),
            unitId: workerId,
            faction: 'ALLY',
            col: 0,
            row: midRow,
            currentHp: def.base_stats.hp * 4,
            currentShield: def.base_stats.shield * 3,
            isObjectiveStructure: true,
            structureName:
              state.selectedRace === 'TERRAN'
                ? '사령부 (Command Center)'
                : state.selectedRace === 'ZERG'
                  ? '부화장 (Hatchery)'
                  : '연결체 (Nexus)',
          });
        }
      } else {
        combatUnits.forEach((u, idx) => {
          if (u.faction === 'ALLY' && u.col === 0 && u.row === midRow) {
            combatUnits[idx] = {
              ...u,
              isObjectiveStructure: true,
              structureName: '핵심 방어 거점',
            };
          }
        });
      }
    } else if (state.stageMode === 'BREAKTHROUGH') {
      const backEnemyCol = state.gridSize + CENTER_GAP_COLS + state.gridSize - 1;
      const existingEnemyBack = combatUnits.findIndex(
        (u) => u.faction === 'ENEMY' && u.col === backEnemyCol && u.row === midRow
      );
      if (existingEnemyBack >= 0) {
        combatUnits[existingEnemyBack] = {
          ...combatUnits[existingEnemyBack],
          isObjectiveStructure: true,
          structureName: '적 핵심 목표물 (사이오닉 분열기)',
        };
      } else {
        combatUnits.push({
          instanceId: createInstanceId('enemy_obj'),
          unitId: 'terran_siege_tank',
          faction: 'ENEMY',
          col: backEnemyCol,
          row: midRow,
          currentHp: 280,
          currentShield: 100,
          isObjectiveStructure: true,
          structureName: '적 핵심 목표물 (사이오닉 분열기)',
        });
      }
    }

    const timeLimitSec =
      state.stageMode === 'DEFENSE'
        ? 30
        : state.stageMode === 'BREAKTHROUGH'
          ? 60
          : 45;

    battleEngine.init(combatUnits, state.stageMode, timeLimitSec, state.gridSize);

    set({
      phase: 'BATTLE',
      selectedInstanceId: null,
      selectedRosterUnitId: null,
      dragPayload: null,
      battleSnapshot: battleEngine.getSnapshot(),
      statusBanner: '실시간 교전 개시!',
    });
  },

  stepBattleTicks: (ticks) => {
    const state = get();
    if (state.phase !== 'BATTLE') {
      return;
    }
    const snap = battleEngine.step(ticks);
    set({ battleSnapshot: { ...snap } });
  },

  triggerCommanderSkill: () => {
    const state = get();
    if (state.phase !== 'BATTLE') {
      return false;
    }
    const skill = getCommanderSkillForRace(state.selectedRace);
    const ok = battleEngine.triggerCommanderSkill(skill.id);
    if (ok) {
      set({
        battleSnapshot: { ...battleEngine.getSnapshot() },
        statusBanner: `[지휘관 개입] ${skill.name} 발동!`,
      });
    }
    return ok;
  },

  returnToPrep: () => {
    const state = get();
    set({
      phase: 'PREP',
      battleSnapshot: null,
      statusBanner:
        state.selectedRace === 'PROTOSS'
          ? '전투 종료 — 프로토스 플라즈마 실드가 100% 자동 충전되었습니다.'
          : '전술 정비 페이즈로 복귀했습니다.',
    });
  },
}));
