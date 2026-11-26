import React from 'react';
import type { GameSpeed } from '../domain/types';
import {
  getCommanderSkillForRace,
  useGameStore,
} from '../store/useGameStore';

const SPEEDS: readonly GameSpeed[] = [1, 2, 4];

export const BattleHUD: React.FC = () => {
  const selectedRace = useGameStore((s) => s.selectedRace);
  const speed = useGameStore((s) => s.speed);
  const battleSnapshot = useGameStore((s) => s.battleSnapshot);
  const statusBanner = useGameStore((s) => s.statusBanner);

  const setSpeed = useGameStore((s) => s.setSpeed);
  const triggerCommanderSkill = useGameStore((s) => s.triggerCommanderSkill);
  const returnToPrep = useGameStore((s) => s.returnToPrep);

  if (!battleSnapshot) {
    return null;
  }

  let aliveAllies = 0;
  let aliveEnemies = 0;
  for (let i = 0; i < battleSnapshot.units.length; i++) {
    const u = battleSnapshot.units[i];
    if (u.hp <= 0) {
      continue;
    }
    if (u.faction === 'ALLY') {
      aliveAllies += 1;
    } else {
      aliveEnemies += 1;
    }
  }

  const remainingSec = Math.max(
    0,
    Math.ceil(battleSnapshot.timeLimitSec - battleSnapshot.elapsedSec)
  );
  const commanderSkill = getCommanderSkillForRace(selectedRace);
  const modeTitle =
    battleSnapshot.mode === 'ANNIHILATION'
      ? '적 몰살 (ANNIHILATION)'
      : battleSnapshot.mode === 'DEFENSE'
        ? '거점 버티기 (DEFENSE)'
        : '적진 돌파 (BREAKTHROUGH)';

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-2.5 sm:p-3">
      {/* Top Battle Status Bar */}
      <div className="pointer-events-auto flex items-center justify-between gap-2 rounded border border-slate-700/85 bg-[#0b111c]/92 px-3 py-1.5 backdrop-blur-xs">
        <div className="flex items-center gap-2.5">
          <span className="rounded bg-rose-950/90 border border-rose-500/50 px-2 py-0.5 font-mono-tech text-[11px] font-semibold text-rose-300">
            ⚔ {modeTitle}
          </span>
          <span className="font-mono-tech text-xs text-slate-200">
            아군 <strong className="text-sky-400">{aliveAllies}</strong> vs 적군{' '}
            <strong className="text-rose-400">{aliveEnemies}</strong>
          </span>
        </div>

        <div className="rounded border border-slate-700 bg-slate-950 px-3 py-0.5 font-pixel text-sm text-amber-300">
          {remainingSec}s
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded border border-slate-700 bg-slate-900/90 p-0.5">
            {SPEEDS.map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSpeed(spd)}
                className={`cursor-pointer rounded px-2 py-0.5 font-mono-tech text-[11px] ${
                  speed === spd
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={returnToPrep}
            className="cursor-pointer rounded border border-slate-600 bg-slate-800 px-2.5 py-0.5 font-mono-tech text-[11px] text-slate-200 hover:bg-slate-700"
          >
            정비 복귀
          </button>
        </div>
      </div>

      {/* Center Status Banner & Outcome Modal */}
      <div className="relative flex flex-1 items-center justify-center">
        {statusBanner && battleSnapshot.outcome === 'ONGOING' && (
          <div className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 rounded border border-slate-700/80 bg-slate-950/85 px-3 py-0.5 font-mono-tech text-[11px] text-amber-300">
            {statusBanner}
          </div>
        )}

        {battleSnapshot.outcome !== 'ONGOING' && (
          <div
            data-testid="battle-outcome-modal"
            className="pointer-events-auto flex w-80 flex-col items-center rounded border border-slate-600 bg-[#0b111c]/96 p-5 text-center shadow-2xl backdrop-blur-sm"
          >
            <div
              className={`font-pixel text-2xl tracking-wider ${
                battleSnapshot.outcome === 'VICTORY'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {battleSnapshot.outcome === 'VICTORY' ? 'VICTORY!' : 'DEFEAT'}
            </div>
            <p className="mt-2 font-mono-tech text-xs text-slate-300">
              교전 시간: {battleSnapshot.elapsedSec.toFixed(1)}초 · 생존 아군:{' '}
              {aliveAllies}기
            </p>
            {selectedRace === 'PROTOSS' && (
              <p className="mt-1 text-[11px] text-sky-300">
                [프로토스 특성] 전투 종료 후 모든 아군 플라즈마 실드 100% 회복
              </p>
            )}
            <button
              type="button"
              data-testid="return-prep-btn"
              onClick={returnToPrep}
              className="mt-4 w-full cursor-pointer rounded bg-sky-600 px-4 py-2 font-mono-tech text-xs font-semibold text-white hover:bg-sky-500"
            >
              전술 정비 페이즈로 복귀
            </button>
          </div>
        )}
      </div>

      {/* Bottom Commander Intervention Bar */}
      <div className="pointer-events-auto flex items-center justify-between rounded border border-slate-700/80 bg-[#0b111c]/94 px-3 py-2 backdrop-blur-xs">
        <div className="text-xs text-slate-300">
          <span className="font-mono-tech text-[10px] text-amber-400 uppercase mr-2">
            COMMANDER SKILL (1회 개입)
          </span>
          <strong className="text-slate-100">[{commanderSkill.name}]</strong> —{' '}
          <span className="text-slate-400">{commanderSkill.desc}</span>
        </div>

        <button
          type="button"
          data-testid="commander-skill-btn"
          disabled={
            battleSnapshot.commanderSkillUsed ||
            battleSnapshot.outcome !== 'ONGOING'
          }
          onClick={() => triggerCommanderSkill()}
          className={`cursor-pointer rounded border px-3 py-1 font-mono-tech text-xs font-bold transition-colors ${
            battleSnapshot.commanderSkillUsed ||
            battleSnapshot.outcome !== 'ONGOING'
              ? 'border-slate-700 bg-slate-800/60 text-slate-500 cursor-not-allowed'
              : 'border-amber-400 bg-amber-500 text-slate-950 hover:bg-amber-400'
          }`}
        >
          {battleSnapshot.commanderSkillUsed
            ? '개입 완료'
            : `⚡ ${commanderSkill.name} 발동`}
        </button>
      </div>
    </div>
  );
};
