import type { MetaBonuses } from './types';

/**
 * 메타 성장 (본부): 런이 끝날 때마다 [전술 데이터]를 얻고, 본부에서 영구 강화·지휘관 해금에 쓴다.
 * 순수 도메인 로직 — 저장(localStorage)은 UI 계층의 메타 스토어가 맡는다.
 */

export type MetaUpgradeId = 'HP' | 'DAMAGE' | 'XP' | 'PICKUP' | 'REROLL';

export interface MetaUpgradeDef {
  id: MetaUpgradeId;
  name: string;
  /** 레벨당 효과 설명 */
  perLevel: string;
  /** 레벨별 비용 (길이 = 최대 레벨) */
  costs: readonly number[];
}

export const META_UPGRADES: readonly MetaUpgradeDef[] = [
  { id: 'HP', name: '강화 훈련', perLevel: '지휘관·부대원 최대 체력 +5%', costs: [40, 80, 140, 220, 320] },
  { id: 'DAMAGE', name: '화력 교리', perLevel: '모든 공격 피해 +4%', costs: [40, 80, 140, 220, 320] },
  { id: 'XP', name: '전투 분석', perLevel: '획득 경험치 +6%', costs: [30, 60, 110, 180, 270] },
  { id: 'PICKUP', name: '회수 체계', perLevel: '수집 반경 +10%', costs: [30, 70, 130] },
  { id: 'REROLL', name: '보급 계약', perLevel: '레벨업 다시 뽑기 +1회', costs: [120, 300] },
];

/** 지휘관 해금 비용 (0 = 기본 해금) */
export const COMMANDER_UNLOCK_COST: Readonly<Record<string, number>> = {
  ic_marshal: 0,
  ic_engineer: 150,
  ic_vanguard: 250,
};

export interface MetaState {
  /** 보유 전술 데이터 */
  data: number;
  totalEarned: number;
  upgrades: Partial<Record<MetaUpgradeId, number>>;
  unlockedCommanders: string[];
  runs: number;
  bestSec: number;
  victories: number;
}

export const INITIAL_META: MetaState = {
  data: 0,
  totalEarned: 0,
  upgrades: {},
  unlockedCommanders: Object.entries(COMMANDER_UNLOCK_COST)
    .filter(([, cost]) => cost === 0)
    .map(([id]) => id),
  runs: 0,
  bestSec: 0,
  victories: 0,
};

export function upgradeLevel(state: MetaState, id: MetaUpgradeId): number {
  return state.upgrades[id] ?? 0;
}

/** 다음 레벨 비용, 최대 레벨이면 null */
export function nextUpgradeCost(state: MetaState, id: MetaUpgradeId): number | null {
  const def = META_UPGRADES.find((u) => u.id === id);
  if (!def) {
    return null;
  }
  const lv = upgradeLevel(state, id);
  return lv < def.costs.length ? def.costs[lv] : null;
}

/** 업그레이드 구매. 데이터가 모자라거나 최대 레벨이면 null */
export function buyUpgrade(state: MetaState, id: MetaUpgradeId): MetaState | null {
  const cost = nextUpgradeCost(state, id);
  if (cost === null || state.data < cost) {
    return null;
  }
  return { ...state, data: state.data - cost, upgrades: { ...state.upgrades, [id]: upgradeLevel(state, id) + 1 } };
}

export function isCommanderUnlocked(state: MetaState, commanderId: string): boolean {
  return (COMMANDER_UNLOCK_COST[commanderId] ?? 0) === 0 || state.unlockedCommanders.includes(commanderId);
}

/** 지휘관 해금. 이미 해금됐거나 데이터가 모자라면 null */
export function unlockCommander(state: MetaState, commanderId: string): MetaState | null {
  const cost = COMMANDER_UNLOCK_COST[commanderId] ?? 0;
  if (isCommanderUnlocked(state, commanderId) || state.data < cost) {
    return null;
  }
  return { ...state, data: state.data - cost, unlockedCommanders: [...state.unlockedCommanders, commanderId] };
}

/** 본부 업그레이드가 런에 주는 보너스 */
export function metaBonuses(state: MetaState): MetaBonuses {
  return {
    maxHpMul: 1 + 0.05 * upgradeLevel(state, 'HP'),
    damageMul: 1 + 0.04 * upgradeLevel(state, 'DAMAGE'),
    xpMul: 1 + 0.06 * upgradeLevel(state, 'XP'),
    pickupMul: 1 + 0.1 * upgradeLevel(state, 'PICKUP'),
    extraRerolls: upgradeLevel(state, 'REROLL'),
  };
}

export interface RunSummary {
  elapsedSec: number;
  kills: number;
  minibossKills: number;
  victory: boolean;
}

/**
 * 런 보상: 생존 10초당 1 + 처치 25마리당 1 + 중간 보스 1기당 30 + 승리 120.
 * 예) 5분 생존·처치 400·중간 보스 1기 → 30 + 16 + 30 = 76
 */
export function runReward(r: RunSummary): number {
  return Math.floor(r.elapsedSec / 10) + Math.floor(r.kills / 25) + 30 * r.minibossKills + (r.victory ? 120 : 0);
}

/** 런 종료 기록 반영 */
export function recordRun(state: MetaState, r: RunSummary): { state: MetaState; earned: number } {
  const earned = runReward(r);
  return {
    earned,
    state: {
      ...state,
      data: state.data + earned,
      totalEarned: state.totalEarned + earned,
      runs: state.runs + 1,
      bestSec: Math.max(state.bestSec, Math.floor(r.elapsedSec)),
      victories: state.victories + (r.victory ? 1 : 0),
    },
  };
}

/** 저장본 정규화: 손상·구버전 데이터도 안전한 MetaState로 */
export function sanitizeMeta(raw: unknown): MetaState {
  if (!raw || typeof raw !== 'object') {
    return { ...INITIAL_META };
  }
  const r = raw as Partial<MetaState>;
  const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
  const upgrades: Partial<Record<MetaUpgradeId, number>> = {};
  for (const def of META_UPGRADES) {
    const lv = num(r.upgrades?.[def.id]);
    if (lv > 0) upgrades[def.id] = Math.min(lv, def.costs.length);
  }
  const unlocked = Array.isArray(r.unlockedCommanders) ? r.unlockedCommanders.filter((x): x is string => typeof x === 'string') : [];
  return {
    data: num(r.data),
    totalEarned: num(r.totalEarned),
    upgrades,
    unlockedCommanders: Array.from(new Set([...INITIAL_META.unlockedCommanders, ...unlocked])),
    runs: num(r.runs),
    bestSec: num(r.bestSec),
    victories: num(r.victories),
  };
}
