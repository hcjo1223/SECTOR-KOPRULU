import React, { useEffect } from 'react';
import { getSpriteDataUrl } from '../core/SurvivorRenderer';
import { getSquadUnitDef } from '../domain/survivor/SurvivorCatalog';
import { useSurvivorStore } from '../store/useSurvivorStore';
import { describeOffer } from './survivorLabels';

export const ChestModal: React.FC = () => {
  const hud = useSurvivorStore((s) => s.hud);
  const engine = useSurvivorStore((s) => s.engine);
  const confirmChest = useSurvivorStore((s) => s.confirmChest);
  const result = hud?.phase === 'CHEST' ? hud.chestResult : null;

  useEffect(() => {
    if (!result) {
      return;
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === 'Enter' || e.code === 'Digit1') {
        confirmChest();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [result, confirmChest]);

  if (!result || !engine) {
    return null;
  }

  let body: React.ReactNode;
  if (result.kind === 'EVOLVE') {
    const from = getSquadUnitDef(result.fromId);
    const into = getSquadUnitDef(result.intoId);
    body = (
      <>
        <div className="font-pixel text-xl text-amber-300">EVOLUTION!</div>
        <div className="mt-3 flex items-center justify-center gap-3">
          <img src={getSpriteDataUrl(from.sprite, engine.paletteFor(from))} alt="" className="pixelated h-12 w-12 opacity-70" />
          <span className="text-amber-300">→</span>
          <img src={getSpriteDataUrl(into.sprite, engine.paletteFor(into))} alt="" className="pixelated h-16 w-16" />
        </div>
        <div className="mt-2 text-base font-semibold text-slate-100">{into.name}</div>
        <div className="mt-1 text-xs text-slate-300">{into.description}</div>
        <div className="mt-2 text-[11px] text-amber-200/90">분대가 Lv1(1명)로 돌아갑니다. 레벨업으로 다시 5명까지 모으세요.</div>
      </>
    );
  } else if (result.kind === 'UPGRADE') {
    const t = describeOffer(result.offer, engine.faction.unitPool);
    body = (
      <>
        <div className="font-pixel text-lg text-sky-300">보급 상자</div>
        <div className="mt-2 font-mono-tech text-[11px] text-amber-300">{t.tag}</div>
        <div className="text-base font-semibold text-slate-100">{t.title}</div>
        <div className="mt-1 text-xs text-slate-300">{t.body}</div>
        <div className="mt-2 text-[10px] text-slate-500">진화 조건(분대 Lv5 + 레시피 모듈)을 갖추면 상자에서 진화합니다.</div>
      </>
    );
  } else {
    body = (
      <>
        <div className="font-pixel text-lg text-sky-300">보급 상자</div>
        <div className="mt-2 text-sm text-slate-200">긴급 보급: 전원 회복</div>
      </>
    );
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-3">
      <div className="w-full max-w-sm rounded border border-amber-600/60 bg-slate-900/95 p-4 text-center">
        {body}
        <button type="button" onClick={confirmChest} className="mt-4 w-full cursor-pointer rounded bg-amber-500 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400">
          확인
        </button>
      </div>
    </div>
  );
};
