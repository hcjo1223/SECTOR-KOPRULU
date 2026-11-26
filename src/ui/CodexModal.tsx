import React, { useState } from 'react';
import { AssetLoader } from '../core/AssetLoader';
import { RELIC_CATALOG } from '../domain/roguelike/RunGenerator';
import { getUnitsByRace } from '../domain/UnitCatalog';
import type { Race } from '../domain/types';
import { useGameStore } from '../store/useGameStore';

const RACES: readonly Race[] = ['TERRAN', 'ZERG', 'PROTOSS'];

export const CodexModal: React.FC = () => {
  const isCodexOpen = useGameStore((s) => s.isCodexOpen);
  const setCodexOpen = useGameStore((s) => s.setCodexOpen);
  const [tabRace, setTabRace] = useState<Race>('TERRAN');

  if (!isCodexOpen) {
    return null;
  }

  const units = getUnitsByRace(tabRace);

  return (
    <div
      data-testid="codex-modal"
      className="pointer-events-auto fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/90 p-3 backdrop-blur-xs sm:items-center sm:p-4"
    >
      <div className="my-auto flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded border border-slate-700 bg-[#0b111c] p-4 sm:p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <h2 className="font-pixel text-lg text-slate-100">
              병영 / 전술 도감 (CODEX)
            </h2>
            <div className="flex items-center gap-1 rounded border border-slate-800 bg-slate-900 p-0.5">
              {RACES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTabRace(r)}
                  className={`cursor-pointer rounded px-2.5 py-0.5 font-pixel text-[10px] ${
                    tabRace === r
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCodexOpen(false)}
            className="cursor-pointer rounded border border-slate-700 bg-slate-800 px-3 py-1 font-mono-tech text-xs text-slate-300 hover:bg-slate-700"
          >
            ✕ 닫기
          </button>
        </div>

        <div className="mt-3 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {units.map((unit) => (
              <div
                key={unit.unit_id}
                className="flex gap-2.5 rounded border border-slate-800 bg-slate-900/80 p-2.5"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-slate-800 bg-[#05080f]">
                  <img
                    src={AssetLoader.getUnitDataUrl(unit, 1, 0)}
                    alt={unit.name}
                    className="pixelated h-12 w-12 object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="truncate font-semibold text-slate-100">
                      {unit.name}
                    </span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono-tech text-[10px] text-amber-300">
                      T{unit.tier} · {unit.cost}광물
                    </span>
                  </div>
                  <div className="mt-1 font-mono-tech text-[10px] text-slate-400">
                    HP {unit.base_stats.hp} · SHD {unit.base_stats.shield} · ATK{' '}
                    {unit.base_stats.attack} · RNG {unit.base_stats.range}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-300">
                    <span className="text-amber-300">[{unit.skill.name}]</span>{' '}
                    {unit.skill.description}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-slate-800 pt-3">
            <div className="mb-2 font-pixel text-xs text-amber-400">
              코프룰루 전술 유물 (RELICS)
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {RELIC_CATALOG.map((relic) => (
                <div
                  key={relic.id}
                  className="rounded border border-slate-800 bg-slate-950/80 p-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-200">
                      {relic.name}
                    </span>
                    <span className="font-mono-tech text-[9px] text-slate-400">
                      {relic.race}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {relic.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
