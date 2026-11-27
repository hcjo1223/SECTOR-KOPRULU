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

  startRun: (faction: FactionId, commanderId?: string) => void;
  confirmChest: () => void;
  restartRun: () => void;
  returnToTitle: () => void;
  togglePause: () => void;
  setPaused: (paused: boolean) => void;
  chooseOffer: (index: number) => void;
  rerollOffer: (index: number) => void;
  chooseRelic: (index: number) => void;
  syncFromEngine: () => void;
}

export const useSurvivorStore = create<SurvivorStoreState>((set, get) => ({
  screen: 'TITLE',
  engine: null,
  hud: null,
  offers: [],
  paused: false,
  runToken: 0,

  startRun: (faction, commanderId) => {
    const engine = new SurvivorEngine(faction, commanderId);
    fastForwardFromUrl(engine);
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
      get().startRun(current.faction.id, current.commanderDef.id);
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

  rerollOffer: (index) => {
    const engine = get().engine;
    if (engine && engine.rerollOffer(index)) {
      set({ hud: engine.getHud(), offers: [...engine.offers] });
    }
  },

  chooseRelic: (index) => {
    const engine = get().engine;
    if (engine && engine.chooseRelic(index)) {
      set({ hud: engine.getHud(), offers: [...engine.offers] });
    }
  },

  confirmChest: () => {
    const engine = get().engine;
    if (engine && engine.confirmChest()) {
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

/**
 * 디버그: URL에 ?skip=초 를 붙이면 런 시작 시 해당 시간만큼 빨리 감는다.
 * (레벨업은 첫 선택지, 보급 상자는 즉시 확인. 지휘관은 무적 처리)
 */
function fastForwardFromUrl(engine: SurvivorEngine): void {
  if (typeof window === 'undefined') {
    return;
  }
  const skip = Number(new URLSearchParams(window.location.search).get('skip') ?? 0);
  if (!Number.isFinite(skip) || skip <= 0) {
    return;
  }
  const c = engine.commander;
  const ticks = Math.floor(skip * 30);
  for (let t = 0; t < ticks && engine.phase !== 'VICTORY'; t += 1) {
    if (engine.phase === 'LEVEL_UP') {
      engine.chooseOffer(0);
      continue;
    }
    if (engine.phase === 'CHEST') {
      engine.confirmChest();
      continue;
    }
    if (engine.phase === 'RELIC') {
      engine.chooseRelic(0);
      continue;
    }
    c.hp = c.maxHp;
    c.alive = true;
    engine.setMoveInput(Math.cos(t / 150), Math.sin(t / 150));
    engine.step(1);
  }
  engine.setMoveInput(0, 0);
}
