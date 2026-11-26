import React from 'react';
import { useSurvivorStore } from '../store/useSurvivorStore';
import { formatTime } from './survivorLabels';

export const ResultModal: React.FC = () => {
  const hud = useSurvivorStore((s) => s.hud);
  const restartRun = useSurvivorStore((s) => s.restartRun);
  const returnToTitle = useSurvivorStore((s) => s.returnToTitle);
  if (!hud || (hud.phase !== 'DEFEAT' && hud.phase !== 'VICTORY')) {
    return null;
  }
  const win = hud.phase === 'VICTORY';
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-3">
      <div className="w-full max-w-sm rounded border border-slate-700 bg-slate-900/95 p-4 text-center">
        <div className={`font-pixel text-2xl ${win ? 'text-amber-300' : 'text-rose-400'}`}>{win ? 'VICTORY' : 'DEFEAT'}</div>
        <div className="mt-1 text-xs text-slate-400">{win ? '블라이트 모체를 처치했습니다.' : '지휘관이 쓰러졌습니다.'}</div>
        <dl className="mt-3 grid grid-cols-2 gap-1 font-mono-tech text-xs">
          <dt className="text-left text-slate-400">생존 시간</dt>
          <dd className="text-right">{formatTime(hud.elapsedSec)}</dd>
          <dt className="text-left text-slate-400">처치 수</dt>
          <dd className="text-right">{hud.kills}</dd>
          <dt className="text-left text-slate-400">도달 레벨</dt>
          <dd className="text-right">{hud.level}</dd>
          <dt className="text-left text-slate-400">남은 부대원</dt>
          <dd className="text-right">{hud.squadCount}</dd>
        </dl>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={restartRun} className="flex-1 cursor-pointer rounded bg-sky-600 py-2 text-sm text-white hover:bg-sky-500">다시 출격</button>
          <button type="button" onClick={returnToTitle} className="flex-1 cursor-pointer rounded border border-slate-600 py-2 text-sm hover:bg-slate-800">타이틀</button>
        </div>
      </div>
    </div>
  );
};
