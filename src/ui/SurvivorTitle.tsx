import React, { useEffect, useState } from 'react';
import { getSpriteDataUrl } from '../core/SurvivorRenderer';
import { ALL_DIRS_8, type SpriteAnim, type SpriteDir8 } from '../core/SurvivorSprites';
import { getAllEnemies, getFactions, getSquadUnitDef } from '../domain/survivor/SurvivorCatalog';
import type { FactionDef } from '../domain/survivor/types';
import { useSurvivorStore } from '../store/useSurvivorStore';
import { evolutionHint, unitTagLine } from './survivorLabels';

interface Pose {
  frame: number;
  dir: SpriteDir8;
  anim: SpriteAnim;
}

/** 8방향 턴테이블 프리뷰: 2틱마다 방향 회전, 대기→보행→공격 순환 */
function usePose(): Pose {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 180);
    return () => window.clearInterval(id);
  }, []);
  const dir = ALL_DIRS_8[Math.floor(tick / 2) % ALL_DIRS_8.length];
  const anim: SpriteAnim = tick % 6 >= 4 ? 'ATTACK' : tick % 6 >= 2 ? 'WALK' : 'IDLE';
  return { frame: anim === 'WALK' ? tick % 4 : tick % 2, dir, anim };
}

export const SurvivorTitle: React.FC = () => {
  const [faction, setFaction] = useState<FactionDef | null>(null);
  const pose = usePose();
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center overflow-y-auto bg-[#070b12]/95 px-4 py-6">
      <div className="mb-4 text-center">
        <div className="font-mono-tech text-[10px] tracking-[0.22em] text-sky-400/90 uppercase">Squad Horde Survival</div>
        <h1 className="font-pixel text-2xl tracking-wider text-slate-100 sm:text-4xl">SECTOR: KOPRULU</h1>
        <p className="mt-1.5 text-xs text-slate-400 sm:text-sm">
          분대 4개와 모듈 4개로 빌드를 짜고, 엘리트의 보급 상자로 분대를 진화시켜 10분을 버텨라.
        </p>
        <p className="mt-1 font-mono-tech text-[10px] text-slate-500">WASD / 방향키 이동 · Space 일시정지 · 모바일: 드래그 조이스틱</p>
      </div>
      {faction ? <CommanderSelect faction={faction} pose={pose} onBack={() => setFaction(null)} /> : <FactionSelect pose={pose} onPick={setFaction} />}
      <EnemyRoster pose={pose} />
    </div>
  );
};

const EnemyRoster: React.FC<{ pose: Pose }> = ({ pose }) => (
  <div className="mt-3 w-full max-w-5xl rounded border border-rose-900/50 bg-slate-950/85 px-3 py-2">
    <div className="mb-1 font-mono-tech text-[10px] tracking-wider text-rose-400 uppercase">위협 개체 · 블라이트 무리</div>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {getAllEnemies().map((e) => (
        <div key={e.id} className="flex items-center gap-1" title={e.name}>
          <img src={getSpriteDataUrl(e.sprite, e.palette, pose.frame, pose.dir, pose.anim)} alt={e.name} className="pixelated h-8 w-8" />
          <span className="font-mono-tech text-[10px] text-slate-300">
            {e.name}
            {e.id === 'matron' && <span className="ml-1 text-rose-400">[최종]</span>}
            {(e.id === 'queen' || e.id === 'spire') && <span className="ml-1 text-amber-300">[중간]</span>}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const FactionSelect: React.FC<{ pose: Pose; onPick: (f: FactionDef) => void }> = ({ pose, onPick }) => (
  <div className="grid w-full max-w-5xl grid-cols-1 gap-3 lg:grid-cols-3">
    {getFactions().map((f) => (
      <button
        key={f.id}
        type="button"
        onClick={() => onPick(f)}
        className="flex cursor-pointer flex-col rounded border bg-slate-900/90 p-3.5 text-left hover:bg-slate-800/90"
        style={{ borderColor: `${f.palette.primary}99` }}
      >
        <div className="flex items-baseline justify-between">
          <span className="font-pixel text-base text-slate-100">{f.name}</span>
          <span className="font-mono-tech text-[10px] text-slate-400">{f.subtitle}</span>
        </div>
        <div className="mt-2 grid grid-cols-8 gap-0.5 rounded border border-slate-800 bg-[#05080f] p-1">
          {f.unitPool.map((id) => {
            const u = getSquadUnitDef(id);
            return (
              <img
                key={id}
                src={getSpriteDataUrl(u.sprite, u.paletteOverride ?? f.palette, pose.frame, pose.dir, pose.anim)}
                alt={u.name}
                title={u.name}
                className="pixelated h-10 w-10"
              />
            );
          })}
        </div>
        <div className="mt-2 text-xs font-semibold" style={{ color: f.palette.accent }}>[{f.traitName}]</div>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{f.traitDesc}</p>
        <div className="mt-2 font-mono-tech text-[10px] text-slate-500">
          분대 {f.unitPool.length}종 · 지휘관 {f.commanders.length}명{f.unitPool.length < 8 ? ' · 프로토타입' : ''}
        </div>
      </button>
    ))}
  </div>
);

const CommanderSelect: React.FC<{ faction: FactionDef; pose: Pose; onBack: () => void }> = ({ faction: f, pose, onBack }) => {
  const startRun = useSurvivorStore((s) => s.startRun);
  return (
    <div className="w-full max-w-5xl">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={onBack} className="cursor-pointer rounded border border-slate-700 px-2 py-1 font-mono-tech text-xs text-slate-300 hover:bg-slate-800">
          ← 진영 선택
        </button>
        <span className="font-pixel text-sm" style={{ color: f.palette.accent }}>{f.name} · 지휘관 선택</span>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {f.commanders.map((c) => {
          const start = getSquadUnitDef(c.startingSquad);
          const pal = c.paletteOverride ?? f.palette;
          return (
            <div key={c.id} className="flex flex-col justify-between rounded border border-slate-700 bg-slate-900/90 p-3">
              <div>
                <div className="flex items-center gap-2">
                  <img src={getSpriteDataUrl(c.sprite, pal, pose.frame, pose.dir, pose.anim)} alt="" className="pixelated h-14 w-14" />
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{c.name}</div>
                    <div className="font-mono-tech text-[10px] text-slate-400">{c.title}</div>
                  </div>
                </div>
                <div className="mt-2 text-xs font-semibold" style={{ color: pal.accent }}>[{c.passiveName}]</div>
                <p className="text-xs leading-relaxed text-slate-400">{c.passiveDesc}</p>
                <div className="mt-2 rounded border border-slate-800 bg-slate-950/70 px-2 py-1 font-mono-tech text-[10px] text-slate-300">
                  추천 분대: {start.name} · 체력 {c.hp} · 이동 {c.moveSpeed}
                </div>
              </div>
              <button
                type="button"
                onClick={() => startRun(f.id, c.id)}
                className="mt-3 w-full cursor-pointer rounded px-3 py-2 font-mono-tech text-xs font-bold text-slate-950"
                style={{ backgroundColor: pal.accent }}
              >
                {c.name} 출격
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-3 rounded border border-slate-800 bg-slate-950/70 p-2.5">
        <div className="mb-1 font-mono-tech text-[11px] text-amber-300">진화 레시피 (분대 Lv5 + 모듈 → 엘리트 보급 상자)</div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
          {f.unitPool.map((id) => {
            const u = getSquadUnitDef(id);
            const hint = evolutionHint(u);
            return (
              <div key={id} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                <img src={getSpriteDataUrl(u.sprite, f.palette)} alt="" className="pixelated h-7 w-7" />
                <span className="font-semibold">{u.name}</span>
                <span className="text-slate-500">{unitTagLine(u)}</span>
                {hint && <span className="ml-auto text-amber-200/80">{hint.replace(/^Lv5 \+ /, '+ ')}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
