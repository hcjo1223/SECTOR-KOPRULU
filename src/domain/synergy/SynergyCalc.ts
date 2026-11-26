import { getUnitDefinition } from '../UnitCatalog';
import type {
  PlacedUnit,
  Race,
  SynergyCount,
  SynergySummary,
  UnitTag,
} from '../types';

interface SynergyRule {
  tag: UnitTag | Race;
  label: string;
  threshold: number;
  bonusText: string;
}

const SYNERGY_RULES: readonly SynergyRule[] = [
  {
    tag: 'TERRAN',
    label: '테란 전술',
    threshold: 2,
    bonusText: '전투 시작 시 아군 공속/방어 태세 강화',
  },
  {
    tag: 'ZERG',
    label: '저그 군단',
    threshold: 2,
    bonusText: '점막(Creep) 위 이동/공격 속도 +20%',
  },
  {
    tag: 'PROTOSS',
    label: '프로토스 칼라',
    threshold: 2,
    bonusText: '최대 플라즈마 실드 +25%',
  },
  {
    tag: 'BIO',
    label: '생체 (BIO)',
    threshold: 2,
    bonusText: '스팀팩/생체 회복 효율 +25%',
  },
  {
    tag: 'MECH',
    label: '기갑 (MECH)',
    threshold: 2,
    bonusText: '아군 기갑 방어력 및 수리 효율 증가',
  },
  {
    tag: 'SPLASH',
    label: '광역 화력',
    threshold: 2,
    bonusText: '스플래시 범위 +20%',
  },
  {
    tag: 'SWARM',
    label: '군단 물량',
    threshold: 2,
    bonusText: '공격 속도 +15%',
  },
  {
    tag: 'PSIONIC',
    label: '사이오닉',
    threshold: 2,
    bonusText: '스킬 및 실드 재생 효율 +20%',
  },
];

export function calculateSynergies(
  allyUnits: readonly PlacedUnit[]
): SynergySummary {
  const raceCounts: Record<Race, number> = {
    TERRAN: 0,
    ZERG: 0,
    PROTOSS: 0,
  };
  const tagCounts: Partial<Record<UnitTag, number>> = {};

  for (let i = 0; i < allyUnits.length; i++) {
    const placed = allyUnits[i];
    if (placed.faction !== 'ALLY') {
      continue;
    }
    const def = getUnitDefinition(placed.unitId);
    if (!def) {
      continue;
    }

    raceCounts[def.race] += 1;
    for (let t = 0; t < def.tags.length; t++) {
      const tag = def.tags[t];
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }

  const activeSynergies: SynergyCount[] = [];
  for (let i = 0; i < SYNERGY_RULES.length; i++) {
    const rule = SYNERGY_RULES[i];
    const count =
      rule.tag === 'TERRAN' || rule.tag === 'ZERG' || rule.tag === 'PROTOSS'
        ? raceCounts[rule.tag]
        : tagCounts[rule.tag] ?? 0;

    if (count > 0) {
      activeSynergies.push({
        tag: rule.tag,
        label: rule.label,
        count,
        threshold: rule.threshold,
        active: count >= rule.threshold,
        bonusText: rule.bonusText,
      });
    }
  }

  activeSynergies.sort((a, b) => {
    if (a.active !== b.active) {
      return a.active ? -1 : 1;
    }
    return b.count - a.count;
  });

  return {
    totalUnits: allyUnits.filter((u) => u.faction === 'ALLY').length,
    raceCounts,
    tagCounts,
    activeSynergies,
  };
}
