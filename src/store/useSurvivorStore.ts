import { create } from 'zustand';
import { SurvivorEngine } from '../domain/survivor/SurvivorEngine';
import type { FactionId, HudSnapshot, LevelUpOffer } from '../domain/survivor/types';

export type SurvivorScreen = 'TITLE' | 'RUN';

interface SurvivorStoreState {
  screen: SurvivorScreen;
  engine: SurvivorEngine | null;
  hud: HudSnapshot | null;
  offers: LevelUpOffer[];
  paused: boolean;
  /** 엔진 교체 시 증가 → 렌더러가 스프라이트 풀을 비운다 */
  runToken: number;

  startRun: (faction: FactionId) => void;
  restartRun: () => void;
  returnToTitle: () => void;
  togglePause: () => void;
  setPaused: (paused: boolean) => void;
  chooseOffer: (index: number) => void;
  syncFromEngine: () => void;
}

export const useSurvivorStore = create<SurvivorStoreState>((set, get) => ({
  screen: 'TITLE',
  engine: null,
  hud: null,
  offers: [],
  paused: false,
  runToken: 0,

  startRun: (faction) => {
    const engine = new SurvivorEngine(faction);
    set((s) => ({
      screen: 'RUN',
      engine,
      hud: engine.getHud(),
      offers: [],
      paused: false,
      runToken: s.runToken + 1,
    }));
  },

  restartRun: () => {
    const current = get().engine;
    if (current) {
      get().startRun(current.faction.id);
    }
  },

  returnToTitle: () => {
    set((s) => ({ screen: 'TITLE', engine: null, hud: null, offers: [], paused: false, runToken: s.runToken + 1 }));
  },

  togglePause: () => {
    const { engine, paused } = get();
    if (!engine || engine.phase !== 'RUNNING') {
      return;
    }
    set({ paused: !paused });
  },

  setPaused: (paused) => set({ paused }),

  chooseOffer: (index) => {
    const engine = get().engine;
    if (!engine) {
      return;
    }
    if (engine.chooseOffer(index)) {
      set({ hud: engine.getHud(), offers: [...engine.offers] });
    }
  },

  syncFromEngine: () => {
    const engine = get().engine;
    if (!engine) {
      return;
    }
    const prevPhase = get().hud?.phase;
    const hud = engine.getHud();
    if (prevPhase !== hud.phase || hud.phase === 'LEVEL_UP') {
      set({ hud, offers: [...engine.offers] });
    } else {
      set({ hud });
    }
  },
}));
