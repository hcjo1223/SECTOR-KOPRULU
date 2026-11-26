import { create } from 'zustand';
import { SoundManager } from '../core/SoundManager';
import {
  BattleEngine,
  type BattleSnapshot,
} from '../domain/combat/BattleEngine';
import {
  CENTER_GAP_COLS,
  findFirstEmptyAllyCell,
  getMaxCapacity,
  gridToLogicalCenter,
  moveOrSwapUnitOnGrid,
  placeUnitOnGrid,
  removeUnitFromGrid,
  resizeGridUnits,
} from '../domain/grid/GridSystem';
import {
  findEvolvableZergPair,
  generateDraftOffers,
  generateTacticalMap,
  getActForGridSize,
  getRelicChoicesForRace,
  RELIC_CATALOG,
} from '../domain/roguelike/RunGenerator';
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
  RelicDefinition,
  StageMode,
  SynergySummary,
  TacticalMapNode,
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
  act: 1 | 2 | 3;
  currentStep: number;
  minerals: number;
  rollSeed: number;
  gridSize: GridSize;
  stageMode: StageMode;
  speed: GameSpeed;
  soundMuted: boolean;
  placedUnits: PlacedUnit[];
  selectedInstanceId: string | null;
  selectedRosterUnitId: string | null;
  dragPayload: DragPayload | null;
  statusBanner: string | null;
  synergySummary: SynergySummary;
  battleSnapshot: BattleSnapshot | null;

  mapNodes: TacticalMapNode[];
  activeNodeId: string | null;
  draftOffers: string[];
  relics: RelicDefinition[];
  isMapOpen: boolean;
  isCodexOpen: boolean;

  startGame: (race: Race) => void;
  returnToTitle: () => void;
  setGridSize: (size: GridSize) => void;
  setStageMode: (mode: StageMode) => void;
  setSpeed: (speed: GameSpeed) => void;
  toggleSoundMute: () => void;
  setMapOpen: (open: boolean) => void;
  setCodexOpen: (open: boolean) => void;
  selectMapNode: (nodeId: string) => void;

  selectPlacedUnit: (instanceId: string | null) => void;
  selectRosterUnit: (unitId: string | null) => void;
  setDragPayload: (payload: DragPayload | null) => void;
  placeFromRosterAt: (unitId: string, col: number, row: number) => boolean;
  quickDeployFromRoster: (unitId: string) => boolean;
  draftFromShop: (offerIndex: number) => boolean;
  rerollDraftShop: () => boolean;
  evolveZergUnits: () => boolean;
  warpInProtossUnit: () => boolean;
  activateTerranAddon: () => boolean;
  moveOrSwapGridUnit: (instanceId: string, col: number, row: number) => boolean;
  removePlacedUnit: (instanceId: string) => void;
  populateSampleFormation: () => void;
  clearAllyUnits: () => void;
  setStatusBanner: (msg: string | null) => void;

  startBattle: () => void;
  stepBattleTicks: (ticks: number) => void;
  triggerCommanderSkill: () => boolean;
  claimVictoryReward: (rewardUnitId?: string, rewardRelicId?: string) => void;
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
  act: 1,
  currentStep: 1,
  minerals: 12,
  rollSeed: 1,
  gridSize: 3,
  stageMode: 'ANNIHILATION',
  speed: 1,
  soundMuted: false,
  placedUnits: initialUnits,
  selectedInstanceId: initialUnits[0]?.instanceId ?? null,
  selectedRosterUnitId: null,
  dragPayload: null,
  statusBanner: null,
  synergySummary: calculateSynergies(initialUnits),
  battleSnapshot: null,

  mapNodes: generateTacticalMap(),
  activeNodeId: 'act1_s1_l0',
  draftOffers: generateDraftOffers('TERRAN', 1, 1),
  relics: [],
  isMapOpen: false,
  isCodexOpen: false,

  startGame: (race) => {
    SoundManager.playClick();
    const gridSize: GridSize = 3;
    const placedUnits = createInitialPlacement(race, gridSize);
    const mapNodes = generateTacticalMap();
    set({
      phase: 'PREP',
      selectedRace: race,
      act: 1,
      currentStep: 1,
      minerals: 12,
      rollSeed: 1,
      gridSize,
      stageMode: 'ANNIHILATION',
      placedUnits,
      selectedInstanceId: placedUnits[0]?.instanceId ?? null,
      selectedRosterUnitId: null,
      dragPayload: null,
      statusBanner: `${race} 전술 지휘소 초기화 완료 (3x3 그리드)`,
      synergySummary: calculateSynergies(placedUnits),
      battleSnapshot: null,
      mapNodes,
      activeNodeId: mapNodes[0].id,
      draftOffers: generateDraftOffers(race, 1, 1),
      relics: [],
      isMapOpen: false,
      isCodexOpen: false,
    });
  },

  returnToTitle: () => {
    SoundManager.playClick();
    set({
      phase: 'TITLE',
      dragPayload: null,
      statusBanner: null,
      battleSnapshot: null,
      isMapOpen: false,
      isCodexOpen: false,
    });
  },

  setGridSize: (newSize) => {
    const state = get();
    if (state.gridSize === newSize) {
      return;
    }
    SoundManager.playClick();
    const onlyAllies = state.placedUnits.filter((u) => u.faction === 'ALLY');
    const resized = resizeGridUnits(onlyAllies, state.gridSize, newSize);
    const nextUnits = [
      ...resized.units,
      ...buildEnemyPreviewUnits(newSize, state.selectedRace),
    ];
    const nextAct = getActForGridSize(newSize);

    const removedMsg =
      resized.removedAllyUnits.length > 0
        ? ` (초과 병력 ${resized.removedAllyUnits.length}기 해제됨)`
        : '';

    set({
      gridSize: newSize,
      act: nextAct,
      placedUnits: nextUnits,
      selectedInstanceId: null,
      draftOffers: generateDraftOffers(state.selectedRace, nextAct, state.rollSeed + 1),
      statusBanner: `전장 그리드 ${newSize}x${newSize} (최대 ${getMaxCapacity(newSize)}기) 전환${removedMsg}`,
      synergySummary: calculateSynergies(nextUnits),
    });
  },

  setStageMode: (mode) => {
    SoundManager.playClick();
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
    SoundManager.playClick();
    set({ speed });
  },

  toggleSoundMute: () => {
    const muted = SoundManager.toggleMute();
    set({ soundMuted: muted });
  },

  setMapOpen: (open) => {
    SoundManager.playClick();
    set({ isMapOpen: open });
  },

  setCodexOpen: (open) => {
    SoundManager.playClick();
    set({ isCodexOpen: open });
  },

  selectMapNode: (nodeId) => {
    const state = get();
    const node = state.mapNodes.find((n) => n.id === nodeId);
    if (!node) {
      return;
    }
    SoundManager.playDeploy();

    const updatedNodes = state.mapNodes.map((n) =>
      n.id === nodeId ? { ...n, completed: true } : n
    );

    if (node.gridSize !== state.gridSize) {
      state.setGridSize(node.gridSize);
    }

    if (node.type === 'SUPPLY') {
      const choices = getRelicChoicesForRace(
        state.selectedRace,
        state.relics.map((r) => r.id)
      );
      const grantedRelic = choices[0];
      const nextRelics = grantedRelic
        ? [...state.relics, grantedRelic]
        : state.relics;
      set({
        mapNodes: updatedNodes,
        activeNodeId: nodeId,
        act: node.act,
        currentStep: Math.min(3, node.step + 1),
        minerals: get().minerals + node.rewardMinerals,
        relics: nextRelics,
        isMapOpen: false,
        statusBanner: `[보급품 확보] 광물 +${node.rewardMinerals} 및 유물 '${grantedRelic?.name ?? '보급품'}' 획득!`,
      });
      return;
    }

    if (node.type === 'DEPOT') {
      const pool = getUnitsByRace(state.selectedRace);
      const eliteDef = pool[Math.min(3, pool.length - 1)];
      if (eliteDef) {
        get().quickDeployFromRoster(eliteDef.unit_id);
      }
      set({
        mapNodes: updatedNodes,
        activeNodeId: nodeId,
        act: node.act,
        currentStep: Math.min(3, node.step + 1),
        minerals: get().minerals + node.rewardMinerals,
        isMapOpen: false,
        statusBanner: `[전술 정비소] ${node.gridSize}x${node.gridSize} 그리드 확장 및 정예 '${eliteDef?.name ?? ''}' 합류!`,
      });
      return;
    }

    set({
      mapNodes: updatedNodes,
      activeNodeId: nodeId,
      act: node.act,
      currentStep: node.step,
      stageMode: node.stageMode,
      isMapOpen: false,
      statusBanner: `[작전 구역 진입] ${node.title} — ${node.subtitle}`,
    });
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
      SoundManager.playDeploy();
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

    SoundManager.playDeploy();
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

  draftFromShop: (offerIndex) => {
    const state = get();
    const unitId = state.draftOffers[offerIndex];
    if (!unitId) {
      return false;
    }
    const def = getUnitDefinition(unitId);
    if (!def) {
      return false;
    }
    if (state.minerals < def.cost) {
      set({
        statusBanner: `광물이 부족합니다 (필요: ${def.cost}, 보유: ${state.minerals})`,
      });
      return false;
    }

    const empty = findFirstEmptyAllyCell(state.placedUnits, state.gridSize);
    if (!empty) {
      set({
        statusBanner: `전장 그리드가 가득 찼습니다 (${getMaxCapacity(state.gridSize)}기 최대)`,
      });
      return false;
    }

    const placed = state.placeFromRosterAt(unitId, empty.col, empty.row);
    if (!placed) {
      return false;
    }

    const nextSeed = state.rollSeed + 1;
    set({
      minerals: state.minerals - def.cost,
      rollSeed: nextSeed,
      draftOffers: generateDraftOffers(state.selectedRace, state.act, nextSeed),
      statusBanner: `[드래프트 모집] ${def.name} 합류 (-${def.cost} 광물)`,
    });
    return true;
  },

  rerollDraftShop: () => {
    const state = get();
    if (state.minerals < 1) {
      set({ statusBanner: '상점 리롤에 필요한 광물(1)이 부족합니다.' });
      return false;
    }
    SoundManager.playClick();
    const nextSeed = state.rollSeed + 1;
    set({
      minerals: state.minerals - 1,
      rollSeed: nextSeed,
      draftOffers: generateDraftOffers(state.selectedRace, state.act, nextSeed),
      statusBanner: '병력 드래프트 상점을 갱신했습니다 (-1 광물)',
    });
    return true;
  },

  evolveZergUnits: () => {
    const state = get();
    if (state.selectedRace !== 'ZERG') {
      return false;
    }
    const pair = findEvolvableZergPair(state.placedUnits);
    if (!pair) {
      set({
        statusBanner: '변이 진화하려면 동일한 하위 저그 유닛 2기가 그리드에 있어야 합니다.',
      });
      return false;
    }
    const targetDef = getUnitDefinition(pair.targetUnitId);
    if (!targetDef) {
      return false;
    }

    SoundManager.playEvolution();
    const filtered = state.placedUnits.filter(
      (u) =>
        u.instanceId !== pair.secondary.instanceId &&
        u.instanceId !== pair.primary.instanceId
    );
    const evolvedUnit: PlacedUnit = {
      instanceId: pair.primary.instanceId,
      unitId: targetDef.unit_id,
      faction: 'ALLY',
      col: pair.primary.col,
      row: pair.primary.row,
      currentHp: targetDef.base_stats.hp,
      currentShield: targetDef.base_stats.shield,
    };
    const nextUnits = [...filtered, evolvedUnit];

    set({
      placedUnits: nextUnits,
      selectedInstanceId: evolvedUnit.instanceId,
      statusBanner: `[저그 군단 변이] 2기 융합 → '${targetDef.name}' 진화 완료!`,
      synergySummary: calculateSynergies(nextUnits),
    });
    return true;
  },

  warpInProtossUnit: () => {
    const state = get();
    if (state.selectedRace !== 'PROTOSS') {
      return false;
    }
    if (state.minerals < 2) {
      set({ statusBanner: '차원 소환에 필요한 광물(2💎)이 부족합니다.' });
      return false;
    }

    if (state.phase === 'BATTLE') {
      const center = gridToLogicalCenter(
        Math.max(0, state.gridSize - 1),
        Math.floor(state.gridSize / 2)
      );
      const ok = battleEngine.warpInAllyUnit(
        createInstanceId('warp_ally'),
        'protoss_zealot',
        center.x,
        center.y
      );
      if (!ok) {
        return false;
      }
      SoundManager.playWarpIn();
      set({
        minerals: state.minerals - 2,
        battleSnapshot: { ...battleEngine.getSnapshot() },
        statusBanner: '[차원 관문] 전장에 광전사(Zealot) 즉시 차원 소환! (-2 광물)',
      });
      return true;
    }

    const deployed = state.quickDeployFromRoster('protoss_zealot');
    if (!deployed) {
      return false;
    }
    SoundManager.playWarpIn();
    set({
      minerals: state.minerals - 2,
      statusBanner: '[차원 관문] 전열에 광전사(Zealot) 즉시 차원 소환! (-2 광물)',
    });
    return true;
  },

  activateTerranAddon: () => {
    const state = get();
    if (state.selectedRace !== 'TERRAN') {
      return false;
    }
    if (state.minerals < 2) {
      set({ statusBanner: '전술 애드온 개조에 필요한 광물(2💎)이 부족합니다.' });
      return false;
    }
    SoundManager.playDeploy();
    const upgraded = state.placedUnits.map((u) =>
      u.faction === 'ALLY'
        ? {
            ...u,
            currentHp: Math.round(u.currentHp * 1.25),
          }
        : u
    );
    set({
      minerals: state.minerals - 2,
      placedUnits: upgraded,
      statusBanner: '[테란 전술 개조] 전 병력 반응로/애드온 장갑 강화 (+25% 내구도, -2 광물)',
    });
    return true;
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
    SoundManager.playDeploy();
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
    SoundManager.playClick();
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
    SoundManager.playDeploy();
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
    SoundManager.playClick();
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

    SoundManager.playBattleStart();

    let hpBonusPct = 0;
    let shieldBonusFlat = 0;
    for (let i = 0; i < state.relics.length; i++) {
      const r = state.relics[i];
      if (r.bonusType === 'HP_PCT') hpBonusPct += r.value;
      if (r.bonusType === 'SHIELD_FLAT') shieldBonusFlat += r.value;
    }

    const combatUnits = state.placedUnits.map((u) => {
      if (u.faction !== 'ALLY') {
        return u;
      }
      return {
        ...u,
        currentHp: Math.round(u.currentHp * (1 + hpBonusPct)),
        currentShield: u.currentShield + shieldBonusFlat,
      };
    });

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
    const prevOutcome = state.battleSnapshot?.outcome;
    const snap = battleEngine.step(ticks);
    if (prevOutcome === 'ONGOING' && snap.outcome === 'VICTORY') {
      SoundManager.playVictory();
    } else if (prevOutcome === 'ONGOING' && snap.outcome === 'DEFEAT') {
      SoundManager.playDefeat();
    }
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
      SoundManager.playCommanderSkill(state.selectedRace);
      set({
        battleSnapshot: { ...battleEngine.getSnapshot() },
        statusBanner: `[지휘관 개입] ${skill.name} 발동!`,
      });
    }
    return ok;
  },

  claimVictoryReward: (rewardUnitId, rewardRelicId) => {
    const state = get();
    SoundManager.playDeploy();
    let nextRelics = state.relics;
    let extraMinerals = 6 + state.act * 2;

    if (rewardRelicId) {
      const found = RELIC_CATALOG.find((r) => r.id === rewardRelicId);
      if (found && !nextRelics.some((r) => r.id === found.id)) {
        nextRelics = [...nextRelics, found];
        if (found.bonusType === 'START_MINERALS') {
          extraMinerals += found.value;
        }
      }
    }

    const nextStep = Math.min(3, state.currentStep + 1);
    const nextSize: GridSize = nextStep === 1 ? 3 : nextStep === 2 ? 4 : 5;

    set({
      phase: 'PREP',
      battleSnapshot: null,
      minerals: state.minerals + extraMinerals,
      currentStep: nextStep,
      relics: nextRelics,
    });

    if (nextSize !== state.gridSize) {
      get().setGridSize(nextSize);
    }

    if (rewardUnitId) {
      get().quickDeployFromRoster(rewardUnitId);
    }

    const nextSeed = get().rollSeed + 1;
    set({
      rollSeed: nextSeed,
      draftOffers: generateDraftOffers(state.selectedRace, get().act, nextSeed),
      statusBanner: `[전투 승리 보상] 광물 +${extraMinerals} 획득 및 Act ${nextStep} (${nextSize}x${nextSize} 그리드) 진입!`,
    });
  },

  returnToPrep: () => {
    const state = get();
    SoundManager.playClick();
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
