import { getUnitsByRace } from '../UnitCatalog';
import type {
  GridSize,
  PlacedUnit,
  Race,
  RelicDefinition,
  StageMode,
  TacticalMapNode,
} from '../types';

export const RELIC_CATALOG: readonly RelicDefinition[] = [
  {
    id: 'relic_gauss_accelerator',
    name: '가우스 자기 가속기',
    description: '모든 아군 유닛의 공격력이 +20% 증가합니다.',
    race: 'TERRAN',
    bonusType: 'ATK_PCT',
    value: 0.2,
  },
  {
    id: 'relic_titanium_plating',
    name: '네오-티타늄 장갑판',
    description: '모든 아군 유닛의 최대 체력이 +25% 증가합니다.',
    race: 'TERRAN',
    bonusType: 'HP_PCT',
    value: 0.25,
  },
  {
    id: 'relic_adrenal_mutagen',
    name: '변이 아드레날린 분비선',
    description: '모든 아군 유닛의 공격 속도가 +25% 증가합니다.',
    race: 'ZERG',
    bonusType: 'ATK_SPD_PCT',
    value: 0.25,
  },
  {
    id: 'relic_overmind_carapace',
    name: '초월체 재생 외피',
    description: '모든 아군 유닛의 최대 체력이 +30% 증가합니다.',
    race: 'ZERG',
    bonusType: 'HP_PCT',
    value: 0.3,
  },
  {
    id: 'relic_khaydarin_capacitor',
    name: '케이다린 결정 축전기',
    description: '모든 아군 유닛에게 추가 플라즈마 실드 +35를 부여합니다.',
    race: 'PROTOSS',
    bonusType: 'SHIELD_FLAT',
    value: 35,
  },
  {
    id: 'relic_rich_vespene_extractor',
    name: '고순도 광물 채취기',
    description: '즉시 광물 +8을 획득하고 모든 유닛 공격력이 +15% 상승합니다.',
    race: 'ALL',
    bonusType: 'START_MINERALS',
    value: 8,
  },
];

export function generateTacticalMap(): TacticalMapNode[] {
  const nodes: TacticalMapNode[] = [
    // Act 1 (3x3 / 9 units max)
    {
      id: 'act1_s1_l0',
      act: 1,
      step: 1,
      lane: 0,
      type: 'COMBAT',
      title: '마 사라 전초기지',
      subtitle: '적 몰살 (3x3)',
      stageMode: 'ANNIHILATION',
      gridSize: 3,
      rewardMinerals: 6,
      completed: false,
    },
    {
      id: 'act1_s1_l1',
      act: 1,
      step: 1,
      lane: 1,
      type: 'SUPPLY',
      title: '유기된 보급고',
      subtitle: '보급품·유물 및 광물 +5',
      stageMode: 'ANNIHILATION',
      gridSize: 3,
      rewardMinerals: 5,
      completed: false,
    },
    {
      id: 'act1_s1_l2',
      act: 1,
      step: 1,
      lane: 2,
      type: 'COMBAT',
      title: '협곡 방어선',
      subtitle: '거점 버티기 (3x3)',
      stageMode: 'DEFENSE',
      gridSize: 3,
      rewardMinerals: 7,
      completed: false,
    },

    // Act 2 (4x4 / 16 units max — Grid Expansion Event!)
    {
      id: 'act2_s2_l0',
      act: 2,
      step: 2,
      lane: 0,
      type: 'COMBAT',
      title: '타르소니스 궤도 방어',
      subtitle: '거점 버티기 (4x4 확장)',
      stageMode: 'DEFENSE',
      gridSize: 4,
      rewardMinerals: 8,
      completed: false,
    },
    {
      id: 'act2_s2_l1',
      act: 2,
      step: 2,
      lane: 1,
      type: 'DEPOT',
      title: '전술 정비소·강화',
      subtitle: '4x4 그리드 확장 + 정예 병력 보충',
      stageMode: 'ANNIHILATION',
      gridSize: 4,
      rewardMinerals: 6,
      completed: false,
    },
    {
      id: 'act2_s2_l2',
      act: 2,
      step: 2,
      lane: 2,
      type: 'COMBAT',
      title: '안티가 프라임 돌파',
      subtitle: '적진 돌파 (4x4 확장)',
      stageMode: 'BREAKTHROUGH',
      gridSize: 4,
      rewardMinerals: 9,
      completed: false,
    },

    // Act 3 (5x5 / 25 units max — Total War Grid Expansion!)
    {
      id: 'act3_s3_l0',
      act: 3,
      step: 3,
      lane: 0,
      type: 'COMBAT',
      title: '차 행성 용암지대',
      subtitle: '적 몰살 총력전 (5x5 확장)',
      stageMode: 'ANNIHILATION',
      gridSize: 5,
      rewardMinerals: 12,
      completed: false,
    },
    {
      id: 'act3_s3_l1',
      act: 3,
      step: 3,
      lane: 1,
      type: 'COMBAT',
      title: '아이어 차원 관문 방어',
      subtitle: '거점 버티기 총력전 (5x5 확장)',
      stageMode: 'DEFENSE',
      gridSize: 5,
      rewardMinerals: 12,
      completed: false,
    },
    {
      id: 'act3_s3_l2',
      act: 3,
      step: 3,
      lane: 2,
      type: 'COMBAT',
      title: '코프룰루 최종 결전',
      subtitle: '적진 돌파 총력전 (5x5 확장)',
      stageMode: 'BREAKTHROUGH',
      gridSize: 5,
      rewardMinerals: 15,
      completed: false,
    },
  ];

  return nodes;
}

export function generateDraftOffers(
  race: Race,
  act: 1 | 2 | 3,
  rollSeed: number
): string[] {
  const pool = getUnitsByRace(race).filter((u) => {
    if (act === 1) return u.tier <= 2;
    if (act === 2) return u.tier <= 3;
    return true;
  });

  const offers: string[] = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.abs(rollSeed * 7 + i * 3 + act * 5) % pool.length;
    offers.push(pool[idx].unit_id);
  }
  return offers;
}

export function getRelicChoicesForRace(
  race: Race,
  ownedRelicIds: readonly string[]
): RelicDefinition[] {
  const available = RELIC_CATALOG.filter(
    (r) =>
      (r.race === race || r.race === 'ALL') && !ownedRelicIds.includes(r.id)
  );
  if (available.length >= 2) {
    return available.slice(0, 3);
  }
  return RELIC_CATALOG.slice(0, 3);
}

const ZERG_EVOLUTION_CHAIN: Readonly<Record<string, string>> = {
  zerg_drone: 'zerg_zergling',
  zerg_zergling: 'zerg_hydralisk',
  zerg_hydralisk: 'zerg_lurker',
  zerg_lurker: 'zerg_mutalisk',
  zerg_mutalisk: 'zerg_ultralisk',
};

export function getNextZergEvolutionId(unitId: string): string | null {
  return ZERG_EVOLUTION_CHAIN[unitId] ?? null;
}

export function findEvolvableZergPair(
  placedUnits: readonly PlacedUnit[]
): { primary: PlacedUnit; secondary: PlacedUnit; targetUnitId: string } | null {
  const allies = placedUnits.filter((u) => u.faction === 'ALLY');
  for (let i = 0; i < allies.length; i++) {
    const a = allies[i];
    const nextId = getNextZergEvolutionId(a.unitId);
    if (!nextId) {
      continue;
    }
    for (let j = i + 1; j < allies.length; j++) {
      const b = allies[j];
      if (b.unitId === a.unitId) {
        return { primary: a, secondary: b, targetUnitId: nextId };
      }
    }
  }
  return null;
}

export function getActForGridSize(gridSize: GridSize): 1 | 2 | 3 {
  if (gridSize === 3) return 1;
  if (gridSize === 4) return 2;
  return 3;
}

export function getStageDescription(mode: StageMode): string {
  switch (mode) {
    case 'ANNIHILATION':
      return '제한 시간 내 적의 모든 병력을 섬멸하십시오.';
    case 'DEFENSE':
      return '30초 동안 적 공세로부터 아군 핵심 거점을 방어하십시오.';
    case 'BREAKTHROUGH':
      return '적진 최후방의 핵심 목표물을 파괴하면 즉시 승리합니다.';
  }
}
