import React, { useEffect } from 'react';
import { getSpriteDataUrl } from '../core/SurvivorRenderer';
import { getSquadUnitDef } from '../domain/survivor/SurvivorCatalog';
import { useSurvivorStore } from '../store/useSurvivorStore';
import { describeOffer } from './survivorLabels';

export const LevelUpModal: React.FC = () => {
  const hud = useSurvivorStore((s) => s.hud);
  const offers = useSurvivorStore((s) => s.offers);
  const engine = useSurvivorStore((s) => s.engine);
  const chooseOffer = useSurvivorStore((s) => s.chooseOffer);
  const rerollOffer = useSurvivorStore((s) => s.rerollOffer);
  const open = hud?.phase === 'LEVEL_UP' && offers.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent): void => {
      const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (n >= 0) {
        // Shift + 숫자: 그 선택지 다시 뽑기
        if (e.shiftKey) {
          rerollOffer(n);
        } else {
          chooseOffer(n);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, chooseOffer, rerollOffer]);

  if (!open || !engine || !hud) {
    return null;
  }
  const rerolls = engine.rerollsLeft;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/65 p-2">
      <div className="w-full max-w-3xl">
        <div className="mb-2 text-center font-pixel text-base text-amber-300 sm:text-xl">LEVEL {hud.level}</div>
        <div className="mb-2 text-center font-mono-tech text-[10px] text-slate-400">
          다시 뽑기 {rerolls}회 남음 · 카드 아래 ↻ 또는 Shift + 1/2/3
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {offers.map((offer, i) => {
            const t = describeOffer(offer, engine.faction.unitPool);
            const def = t.unitId ? getSquadUnitDef(t.unitId) : null;
            const sprite = def ? getSpriteDataUrl(def.sprite, engine.paletteFor(def)) : null;
            const isModule = !!t.moduleId;
            return (
              <div key={i} className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => chooseOffer(i)}
                  className={`flex cursor-pointer items-start gap-2 rounded border bg-slate-900/95 p-2.5 text-left hover:border-amber-400 hover:bg-slate-800 sm:flex-col ${
                    isModule ? 'border-cyan-700' : 'border-slate-600'
                  }`}
                >
                  {sprite ? (
                    <img src={sprite} alt="" className="pixelated h-10 w-10 shrink-0" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-800 text-lg">{isModule ? '⚙' : '✚'}</div>
                  )}
                  <div className="min-w-0">
                    <div className={`font-mono-tech text-[10px] ${isModule ? 'text-cyan-300' : 'text-amber-300'}`}>
                      {i + 1}. {t.tag}
                    </div>
                    <div className="text-sm font-semibold text-slate-100">{t.title}</div>
                    {t.tagLine && <div className="font-mono-tech text-[10px] text-slate-400">{t.tagLine}</div>}
                    <div className="mt-0.5 text-[11px] leading-snug text-slate-300">{t.body}</div>
                    {t.hint && <div className="mt-1 text-[10px] leading-snug text-amber-200/80">{t.hint}</div>}
                  </div>
                </button>
                <button
                  type="button"
                  disabled={rerolls <= 0}
                  onClick={() => rerollOffer(i)}
                  className="cursor-pointer rounded border border-slate-700 bg-slate-950/90 py-0.5 font-mono-tech text-[10px] text-slate-300 hover:border-sky-500 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  ↻ 다시 뽑기
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
