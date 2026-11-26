import React from 'react';
import { AssetLoader } from '../core/AssetLoader';
import { getUnitsByRace } from '../domain/UnitCatalog';
import type { Race } from '../domain/types';
import { useGameStore } from '../store/useGameStore';

interface RaceOption {
  race: Race;
  title: string;
  subtitle: string;
  starter: string;
  traitTitle: string;
  traitDesc: string;
  accentClass: string;
  buttonClass: string;
}

const RACE_OPTIONS: readonly RaceOption[] = [
  {
    race: 'TERRAN',
    title: 'TERRAN',
    subtitle: '테란 자치령',
    starter: '스타팅: SCV 1기 (메카닉 수리)',
    traitTitle: '전술 개조 / 애드온',
    traitDesc:
      '생체(BIO) 유닛 스팀팩 공속 버프 및 기갑(MECH) 유닛 공성 모드 스탠스 전환.',
    accentClass: 'border-sky-500/50 hover:border-sky-400 bg-slate-900/92',
    buttonClass: 'bg-sky-600 hover:bg-sky-500 text-white',
  },
  {
    race: 'ZERG',
    title: 'ZERG',
    subtitle: '저그 군단',
    starter: '스타팅: 드론 1기 (처치 시 흡혈)',
    traitTitle: '군단 변이 / 점막',
    traitDesc:
      '하위 개체 변태 진화 및 아군 진영 점막(Creep) 위 이동·공격 속도 가속.',
    accentClass: 'border-fuchsia-500/50 hover:border-fuchsia-400 bg-slate-900/92',
    buttonClass: 'bg-fuchsia-700 hover:bg-fuchsia-600 text-white',
  },
  {
    race: 'PROTOSS',
    title: 'PROTOSS',
    subtitle: '프로토스 함대',
    starter: '스타팅: 프로브 1기 (플라즈마 실드)',
    traitTitle: '플라즈마 실드 / 차원 관문',
    traitDesc:
      '전투 종료 후 자동 회복되는 실드 보유 및 대기열 병력 즉시 차원 소환.',
    accentClass: 'border-amber-500/50 hover:border-amber-400 bg-slate-900/92',
    buttonClass: 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold',
  },
];

export const TitleScreen: React.FC = () => {
  const startGame = useGameStore((s) => s.startGame);
  const setCodexOpen = useGameStore((s) => s.setCodexOpen);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#070b12]/95 px-6 py-5">
      <div className="mb-4 text-center">
        <div className="font-mono-tech text-[11px] tracking-[0.28em] text-sky-400/90 uppercase mb-1">
          SECTOR: KOPRULU · TACTICAL GRID AUTO-BATTLER ROGUELIKE
        </div>
        <h1 className="font-pixel text-3xl sm:text-4xl tracking-wider text-slate-100">
          SECTOR: KOPRULU
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400">
          3종족 18종 픽셀 유닛 · 가변 그리드(3x3→4x4→5x5) · 로그라이크 전술 캠페인
        </p>
        <div className="mt-2.5 flex items-center justify-center gap-2">
          <button
            type="button"
            data-testid="title-codex-btn"
            onClick={() => setCodexOpen(true)}
            className="cursor-pointer rounded border border-slate-700 bg-slate-900/90 px-3 py-1 font-mono-tech text-xs text-amber-300 hover:border-amber-500/60 hover:bg-slate-800"
          >
            📖 병영 / 전술 도감 확인
          </button>
        </div>
      </div>

      <div className="grid w-full max-w-5xl grid-cols-1 gap-3.5 sm:grid-cols-3">
        {RACE_OPTIONS.map((opt) => {
          const raceUnits = getUnitsByRace(opt.race);
          return (
            <div
              key={opt.race}
              className={`flex flex-col justify-between rounded border p-4 transition-colors ${opt.accentClass}`}
            >
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="font-pixel text-lg text-slate-100">
                    {opt.title}
                  </span>
                  <span className="text-xs text-slate-400">{opt.subtitle}</span>
                </div>

                {/* Handcrafted Pixel Roster Preview Strip */}
                <div className="mt-2.5 flex items-center justify-between gap-1 rounded border border-slate-800 bg-[#05080f] px-2 py-2">
                  {raceUnits.map((unit) => (
                    <div
                      key={unit.unit_id}
                      title={unit.name}
                      className="flex flex-col items-center"
                    >
                      <div className="flex h-10 w-10 items-center justify-center">
                        <img
                          src={AssetLoader.getUnitDataUrl(unit, 1, 0)}
                          alt={unit.name}
                          className="pixelated max-h-10 max-w-10 object-contain"
                        />
                      </div>
                      <span className="font-mono-tech text-[8px] text-slate-400">
                        {unit.visual.short_code}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-2.5 rounded bg-slate-950/70 px-2.5 py-1.5 font-mono-tech text-[11px] text-slate-200 border border-slate-800">
                  {opt.starter}
                </div>
                <div className="mt-2.5">
                  <div className="text-xs font-semibold text-slate-200">
                    [{opt.traitTitle}]
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {opt.traitDesc}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => startGame(opt.race)}
                className={`mt-4 w-full cursor-pointer rounded px-3 py-2 font-mono-tech text-xs tracking-wide transition-colors ${opt.buttonClass}`}
              >
                {opt.title} 출격 시작
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
