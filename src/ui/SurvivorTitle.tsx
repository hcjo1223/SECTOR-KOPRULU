import React, { useEffect, useState } from 'react';
import { getSpriteDataUrl } from '../core/SurvivorRenderer';
import { ALL_DIRS_8, type SpriteAnim, type SpriteDir8 } from '../core/SurvivorSprites';
import { getAllEnemies, getFactions, getSquadUnitDef, getWaveTable } from '../domain/survivor/SurvivorCatalog';
import type { FactionDef } from '../domain/survivor/types';
import { COMMANDER_UNLOCK_COST, isCommanderUnlocked } from '../domain/survivor/MetaProgress';
import { useMetaStore } from '../store/useMetaStore';
import { useSurvivorStore } from '../store/useSurvivorStore';
import { HQPanel } from './HQPanel';
import { SettingsToggles } from './SettingsToggles';
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
  return { frame: anim === 'IDLE' ? tick % 2 : tick % 4, dir, anim };
}

export const SurvivorTitle: React.FC = () => {
  // 플레이어 진영은 노바 기동군 하나: 진영 소개 후 바로 지휘관을 고른다
  const faction = getFactions()[0];
  const pose = usePose();
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center overflow-y-auto bg-[#070b12]/95 px-4 py-6">
      <div className="mb-4 text-center">
        <div className="font-mono-tech text-[10px] tracking-[0.22em] text-sky-400/90 uppercase">Squad Horde Survival</div>
        <h1 className="font-pixel text-2xl tracking-wider text-slate-100 sm:text-4xl">SECTOR: KOPRULU</h1>
        <p className="mt-1.5 text-xs text-slate-400 sm:text-sm">
          분대 4개와 모듈 4개로 빌드를 짜고, 엘리트의 보급 상자로 분대를 진화시켜 10분을 버텨라.
        </p>
        <p className="mt-1 font-mono-tech text-[10px] text-slate-500">WASD / 방향키 이동 · Space 일시정지 · M 음소거 · 모바일: 드래그 조이스틱</p>
        <SettingsToggles className="mt-1.5 justify-center" />
      </div>
      <FactionBanner faction={faction} pose={pose} />
      <CommanderSelect faction={faction} pose={pose} />
      <HQPanel />
      <EnemyRoster pose={pose} />
    </div>
  );
};

const ENEMY_GROUPS: ReadonlyArray<{ label: string; test: (id: string) => boolean }> = [
  { label: '블라이트 무리', test: (id) => !id.startsWith('hive_') && !id.startsWith('lumen_') && id !== 'clawling' },
  { label: '적응 군체', test: (id) => id.startsWith('hive_') || id === 'clawling' },
  { label: '성휘 교단', test: (id) => id.startsWith('lumen_') },
];

const EnemyRoster: React.FC<{ pose: Pose }> = ({ pose }) => {
  const events = getWaveTable().events;
  const bossIds = new Set(events.filter((e) => e.kind === 'BOSS').map((e) => e.enemyId));
  const midIds = new Set(events.filter((e) => e.kind === 'MINIBOSS').map((e) => e.enemyId));
  const enemies = getAllEnemies();
  return (
    <div className="mt-3 w-full max-w-5xl rounded border border-rose-900/50 bg-slate-950/85 px-3 py-2">
      <div className="mb-1 font-mono-tech text-[10px] tracking-wider text-rose-400 uppercase">위협 개체</div>
      {ENEMY_GROUPS.map((g) => (
        <div key={g.label} className="mb-1">
          <div className="font-mono-tech text-[10px] text-slate-500">{g.label}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {enemies
              .filter((e) => g.test(e.id))
              .map((e) => (
                <div key={e.id} className="flex items-center gap-1" title={e.name}>
                  <img src={getSpriteDataUrl(e.sprite, e.palette, pose.frame, pose.dir, pose.anim)} alt={e.name} className="pixelated h-8 w-8" />
                  <span className="font-mono-tech text-[10px] text-slate-300">
                    {e.name}
                    {bossIds.has(e.id) && <span className="ml-1 text-rose-400">[최종]</span>}
                    {midIds.has(e.id) && <span className="ml-1 text-amber-300">[중간]</span>}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const FactionBanner: React.FC<{ faction: FactionDef; pose: Pose }> = ({ faction: f, pose }) => (
  <div className="mb-3 w-full max-w-5xl rounded border bg-slate-900/90 p-3.5" style={{ borderColor: `${f.palette.primary}99` }}>
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
  </div>
);

const CommanderSelect: React.FC<{ faction: FactionDef; pose: Pose }> = ({ faction: f, pose }) => {
  const startRun = useSurvivorStore((s) => s.startRun);
  const meta = useMetaStore((s) => s.meta);
  const unlock = useMetaStore((s) => s.unlock);
  return (
    <div className="w-full max-w-5xl">
      <div className="mb-2 flex items-center justify-end">
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
              {isCommanderUnlocked(meta, c.id) ? (
                <button
                  type="button"
                  onClick={() => startRun(f.id, c.id)}
                  className="mt-3 w-full cursor-pointer rounded px-3 py-2 font-mono-tech text-xs font-bold text-slate-950"
                  style={{ backgroundColor: pal.accent }}
                >
                  {c.name} 출격
                </button>
              ) : (
                <button
                  type="button"
                  disabled={meta.data < (COMMANDER_UNLOCK_COST[c.id] ?? 0)}
                  onClick={() => unlock(c.id)}
                  className="mt-3 w-full cursor-pointer rounded border border-cyan-700 px-3 py-2 font-mono-tech text-xs text-cyan-200 hover:bg-cyan-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  🔒 해금 · 전술 데이터 {COMMANDER_UNLOCK_COST[c.id]}
                </button>
              )}
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
