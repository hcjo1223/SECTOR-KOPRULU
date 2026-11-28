import React, { useEffect } from 'react';
import { getRelic } from '../domain/survivor/SurvivorCatalog';
import { useSurvivorStore } from '../store/useSurvivorStore';

/** 중간 보스 격파 보상: 유물 3개 중 1개 선택 (1/2/3 키 또는 클릭) */
export const RelicModal: React.FC = () => {
  const hud = useSurvivorStore((s) => s.hud);
  const chooseRelic = useSurvivorStore((s) => s.chooseRelic);
  const offers = hud?.phase === 'RELIC' ? hud.relicOffers : [];
  const open = offers.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent): void => {
      const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (n >= 0) {
        chooseRelic(n);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, chooseRelic]);

  if (!open) {
    return null;
  }
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/70 p-2">
      <div className="w-full max-w-3xl">
        <div className="mb-1 text-center font-pixel text-base text-amber-300 sm:text-xl">RELIC</div>
        <div className="mb-2 text-center font-mono-tech text-[10px] text-slate-400">중간 보스 격파 보상 · 유물은 이번 런 동안 계속 유지됩니다</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {offers.map((id, i) => {
            const r = getRelic(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => chooseRelic(i)}
                className="flex cursor-pointer items-start gap-2 rounded border border-amber-700/80 bg-slate-900/95 p-2.5 text-left hover:border-amber-300 hover:bg-slate-800 sm:flex-col"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-amber-600/60 bg-amber-950/60 text-xl text-amber-300">
                  {r.icon}
                </div>
                <div className="min-w-0">
                  <div className="font-mono-tech text-[10px] text-amber-300">{i + 1}. 유물</div>
                  <div className="text-sm font-semibold text-slate-100">{r.name}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-slate-300">{r.summary}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
