import React, { useEffect, useState } from 'react';
import { getSpriteDataUrl } from '../core/SurvivorRenderer';
import { ALL_DIRS_8, type SpriteAnim, type SpriteDir8 } from '../core/SurvivorSprites';
import { getAllEnemies, getFactions, getSquadUnitDef } from '../domain/survivor/SurvivorCatalog';
import { useSurvivorStore } from '../store/useSurvivorStore';
import { STYLE_LABEL, TARGETING_LABEL } from './survivorLabels';

type PreviewMode = 'AUTO' | 'IDLE' | 'WALK' | 'ATTACK';

export const SurvivorTitle: React.FC = () => {
  const startRun = useSurvivorStore((s) => s.startRun);
  const enemies = getAllEnemies();
  const [tick, setTick] = useState(0);
  const [mode, setMode] = useState<PreviewMode>('AUTO');

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, 180);
    return () => window.clearInterval(id);
  }, []);

  // 8방향 턴테이블 회전(S -> SE -> E -> NE -> N -> NW -> W -> SW) 및 모션 프레임 계산
  const dirIndex = Math.floor(tick / 2) % ALL_DIRS_8.length;
  const currentDir: SpriteDir8 = ALL_DIRS_8[dirIndex];
  const currentAnim: SpriteAnim =
    mode === 'AUTO'
      ? tick % 6 >= 4
        ? 'ATTACK'
        : tick % 6 >= 2
          ? 'WALK'
          : 'IDLE'
      : mode;
  const currentFrame = currentAnim === 'WALK' ? tick % 4 : tick % 2;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center overflow-y-auto bg-[#070b12]/95 px-4 py-4">
      <div className="mb-2.5 text-center">
        <div className="font-mono-tech text-[10px] tracking-[0.22em] text-sky-400/90 uppercase">Squad Horde Survival</div>
        <h1 className="font-pixel text-2xl tracking-wider text-slate-100 sm:text-4xl">SECTOR: KOPRULU</h1>
        <p className="mt-1 text-xs text-slate-400 sm:text-sm">
          지휘관을 움직여 부대를 이끌고, 몰려오는 블라이트 무리 속에서 10분을 버텨 모체를 처치하라.
        </p>
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5 font-mono-tech text-[10px]">
          <span className="text-slate-500">프리뷰 모션 ({currentDir} · {currentAnim}):</span>
          {(
            [
              ['AUTO', '8방향 자동순환'],
              ['IDLE', '대기(IDLE)'],
              ['WALK', '보행(WALK)'],
              ['ATTACK', '사격·공격(ATTACK)'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`cursor-pointer rounded border px-2 py-0.5 transition-colors ${
                mode === m
                  ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid w-full max-w-5xl grid-cols-1 gap-3 lg:grid-cols-3">
        {getFactions().map((f) => (
          <div
            key={f.id}
            className="flex flex-col justify-between rounded border border-slate-700 bg-slate-900/90 p-3.5"
            style={{ borderColor: `${f.palette.primary}88` }}
          >
            <div>
              <div className="flex items-baseline justify-between">
                <span className="font-pixel text-base text-slate-100">{f.name}</span>
                <span className="font-mono-tech text-[10px] text-slate-400">{f.subtitle}</span>
              </div>
              <div className="mt-2 grid grid-cols-5 gap-1 rounded border border-slate-800 bg-[#05080f] p-1.5">
                <UnitChip
                  src={getSpriteDataUrl(f.commander.sprite, f.palette, currentFrame, currentDir, currentAnim)}
                  label="지휘관"
                />
                {f.unitPool.map((id) => {
                  const u = getSquadUnitDef(id);
                  return (
                    <UnitChip
                      key={id}
                      src={getSpriteDataUrl(u.sprite, f.palette, currentFrame, currentDir, currentAnim)}
                      label={u.name}
                    />
                  );
                })}
              </div>
              <div className="mt-2 text-xs font-semibold" style={{ color: f.palette.accent }}>
                [{f.traitName}]
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{f.traitDesc}</p>
              <ul className="mt-2 space-y-0.5 font-mono-tech text-[10px] text-slate-400">
                {f.unitPool.map((id) => {
                  const u = getSquadUnitDef(id);
                  return (
                    <li key={id}>
                      · {u.name} — {TARGETING_LABEL[u.attack.targeting]} / {STYLE_LABEL[u.attack.style]}
                    </li>
                  );
                })}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => startRun(f.id)}
              className="mt-3 w-full cursor-pointer rounded px-3 py-2.5 font-mono-tech text-xs font-bold tracking-wide text-slate-950"
              style={{ backgroundColor: f.palette.accent }}
            >
              {f.name} 출격
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 rounded border border-rose-900/50 bg-slate-950/85 px-3 py-2">
        <div className="font-mono-tech text-[10px] tracking-wider text-rose-400 uppercase">
          위협 개체 · 블라이트 무리 (BLIGHT HORDE)
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {enemies.map((e) => (
            <div key={e.id} className="flex items-center gap-1.5">
              <img
                src={getSpriteDataUrl(e.sprite, e.palette, currentFrame, currentDir, currentAnim)}
                alt={e.name}
                className="pixelated h-9 w-9"
              />
              <span className="font-mono-tech text-[10px] text-slate-300">
                {e.name}
                {e.id === 'matron' && <span className="ml-1 text-rose-400">[BOSS]</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const UnitChip: React.FC<{ src: string; label: string }> = ({ src, label }) => (
  <div className="flex flex-col items-center" title={label}>
    <img src={src} alt={label} className="pixelated h-11 w-11" />
    <span className="mt-0.5 w-full truncate text-center text-[8px] text-slate-400">{label}</span>
  </div>
);
