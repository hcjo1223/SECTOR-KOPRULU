import { create } from 'zustand';
import {
  buyUpgrade,
  INITIAL_META,
  recordRun,
  sanitizeMeta,
  unlockCommander,
  type MetaState,
  type MetaUpgradeId,
  type RunSummary,
} from '../domain/survivor/MetaProgress';

const STORAGE_KEY = 'sector-koprulu.meta.v1';

function load(): MetaState {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    return raw ? sanitizeMeta(JSON.parse(raw)) : { ...INITIAL_META };
  } catch {
    return { ...INITIAL_META };
  }
}

function save(state: MetaState): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // 저장 불가(사생활 보호 모드 등): 이번 세션 동안만 유지
  }
}

interface MetaStoreState {
  meta: MetaState;
  buy: (id: MetaUpgradeId) => boolean;
  unlock: (commanderId: string) => boolean;
  /** 런 종료 보상 반영 → 획득량 */
  award: (run: RunSummary) => number;
}

/** 본부(메타 성장) 상태: 브라우저에 저장되어 런 사이에 유지된다 */
export const useMetaStore = create<MetaStoreState>((set, get) => ({
  meta: load(),

  buy: (id) => {
    const next = buyUpgrade(get().meta, id);
    if (!next) {
      return false;
    }
    save(next);
    set({ meta: next });
    return true;
  },

  unlock: (commanderId) => {
    const next = unlockCommander(get().meta, commanderId);
    if (!next) {
      return false;
    }
    save(next);
    set({ meta: next });
    return true;
  },

  award: (run) => {
    const { state, earned } = recordRun(get().meta, run);
    save(state);
    set({ meta: state });
    return earned;
  },
}));
