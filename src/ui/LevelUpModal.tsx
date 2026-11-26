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
  const open = hud?.phase === 'LEVEL_UP' && offers.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent): void => {
      const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (n >= 0) {
        chooseOffer(n);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, chooseOffer]);

  if (!open || !engine || !hud) {
    return null;
  }
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-2">
      <div className="w-full max-w-2xl">
        <div className="mb-2 text-center font-pixel text-base text-amber-300 sm:text-xl">LEVEL {hud.level}</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {offers.map((offer, i) => {
            const t = describeOffer(offer);
            const sprite = t.unitId ? getSpriteDataUrl(getSquadUnitDef(t.unitId).sprite, engine.faction.palette) : null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => chooseOffer(i)}
                className="flex cursor-pointer items-start gap-2 rounded border border-slate-600 bg-slate-900/95 p-2.5 text-left hover:border-amber-400 hover:bg-slate-800 sm:flex-col"
              >
                {sprite && <img src={sprite} alt="" className="pixelated h-10 w-10 shrink-0" />}
                <div>
                  <div className="font-mono-tech text-[10px] text-amber-300">
                    {i + 1}. {t.tag}
                  </div>
                  <div className="text-sm font-semibold text-slate-100">{t.title}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-slate-400">{t.body}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
