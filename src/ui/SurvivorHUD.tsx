import React from 'react';
import { getSquadUnitDef } from '../domain/survivor/SurvivorCatalog';
import { useSurvivorStore } from '../store/useSurvivorStore';
import { formatTime } from './survivorLabels';

export const SurvivorHUD: React.FC = () => {
  const hud = useSurvivorStore((s) => s.hud);
  const engine = useSurvivorStore((s) => s.engine);
  const paused = useSurvivorStore((s) => s.paused);
  const togglePause = useSurvivorStore((s) => s.togglePause);
  const returnToTitle = useSurvivorStore((s) => s.returnToTitle);
  if (!hud || !engine) {
    return null;
  }
  const f = engine.faction;
  const xpRatio = hud.xp / hud.xpToNext;
  const hpRatio = hud.commanderHp / hud.commanderMaxHp;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-1.5 font-mono-tech text-[10px] text-slate-200 sm:p-2.5 sm:text-xs">
      <div>
        <div className="h-1.5 w-full overflow-hidden rounded-sm bg-slate-900/80 sm:h-2">
          <div className="h-full bg-sky-400" style={{ width: `${Math.min(100, xpRatio * 100)}%` }} />
        </div>
        <div className="mt-1 flex items-start justify-between gap-2">
          <div className="rounded bg-slate-950/70 px-1.5 py-0.5">
            <span className="text-sky-300">Lv {hud.level}</span>
            <span className="ml-2 text-slate-400">처치 {hud.kills}</span>
          </div>
          <div className="text-center">
            <div className="font-pixel text-sm text-slate-100 sm:text-lg">{formatTime(hud.elapsedSec)}</div>
            {hud.bossAlive && (
              <div className="mt-0.5 w-36 sm:w-56">
                <div className="text-[9px] text-rose-300">블라이트 모체</div>
                <div className="h-1.5 overflow-hidden rounded-sm bg-slate-900/80">
                  <div className="h-full bg-rose-500" style={{ width: `${(hud.bossHp / hud.bossMaxHp) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
          <div className="pointer-events-auto flex gap-1">
            <button type="button" onClick={togglePause} className="cursor-pointer rounded border border-slate-700 bg-slate-950/80 px-2 py-0.5 hover:bg-slate-800">
              {paused ? '▶' : 'II'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="rounded bg-slate-950/70 px-1.5 py-1">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">지휘관</span>
            <div className="h-1.5 w-20 overflow-hidden rounded-sm bg-slate-800 sm:w-28">
              <div className="h-full bg-emerald-400" style={{ width: `${hpRatio * 100}%` }} />
            </div>
            <span>{Math.ceil(hud.commanderHp)}</span>
          </div>
          {hud.commanderMaxShield > 0 && (
            <div className="mt-0.5 h-1 w-full overflow-hidden rounded-sm bg-slate-800">
              <div className="h-full bg-cyan-300" style={{ width: `${(hud.commanderShield / hud.commanderMaxShield) * 100}%` }} />
            </div>
          )}
          <div className="mt-0.5" style={{ color: hud.traitActive ? f.palette.accent : '#64748b' }}>
            [{f.traitName}] {hud.traitActive ? 'ON' : 'OFF'}
          </div>
        </div>
        <div className="rounded bg-slate-950/70 px-1.5 py-1 text-right">
          <div className="text-slate-400">
            부대 {hud.squadCount}/{hud.squadCapacity} · {hud.ringCount}링
          </div>
          {Object.entries(hud.squadByUnit).map(([id, n]) => (
            <div key={id}>
              {getSquadUnitDef(id).name} ×{n} <span className="text-amber-300">Lv{hud.unitLevels[id] ?? 1}</span>
            </div>
          ))}
        </div>
      </div>

      {paused && hud.phase === 'RUNNING' && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
          <div className="font-pixel text-xl">PAUSED</div>
          <button type="button" onClick={togglePause} className="cursor-pointer rounded bg-sky-600 px-4 py-1.5 text-white hover:bg-sky-500">계속</button>
          <button type="button" onClick={returnToTitle} className="cursor-pointer rounded border border-slate-600 px-4 py-1.5 hover:bg-slate-800">타이틀로</button>
        </div>
      )}
    </div>
  );
};
