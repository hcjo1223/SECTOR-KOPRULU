import { create } from 'zustand';

const STORAGE_KEY = 'sector-koprulu.settings.v1';

export interface GameSettings {
  soundOn: boolean;
  /** 0 ~ 1 */
  volume: number;
  shakeOn: boolean;
}

const DEFAULTS: GameSettings = { soundOn: true, volume: 0.7, shakeOn: true };

function load(): GameSettings {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) {
      return { ...DEFAULTS };
    }
    const r = JSON.parse(raw) as Partial<GameSettings>;
    return {
      soundOn: typeof r.soundOn === 'boolean' ? r.soundOn : DEFAULTS.soundOn,
      volume: typeof r.volume === 'number' && r.volume >= 0 && r.volume <= 1 ? r.volume : DEFAULTS.volume,
      shakeOn: typeof r.shakeOn === 'boolean' ? r.shakeOn : DEFAULTS.shakeOn,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(s: GameSettings): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    }
  } catch {
    // 저장 불가 환경: 세션 동안만 유지
  }
}

interface SettingsStore extends GameSettings {
  toggleSound: () => void;
  toggleShake: () => void;
  setVolume: (v: number) => void;
}

/** 사운드·화면 흔들림 설정 (브라우저에 저장) */
export const useSettingsStore = create<SettingsStore>((set, get) => {
  const persist = (patch: Partial<GameSettings>): void => {
    const next: GameSettings = { soundOn: get().soundOn, volume: get().volume, shakeOn: get().shakeOn, ...patch };
    save(next);
    set(next);
  };
  return {
    ...load(),
    toggleSound: () => persist({ soundOn: !get().soundOn }),
    toggleShake: () => persist({ shakeOn: !get().shakeOn }),
    setVolume: (v) => persist({ volume: Math.max(0, Math.min(1, v)) }),
  };
});
