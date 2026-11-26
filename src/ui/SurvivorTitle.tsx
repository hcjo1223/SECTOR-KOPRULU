import React from 'react';
import { getSpriteDataUrl } from '../core/SurvivorRenderer';
import { getFactions, getSquadUnitDef } from '../domain/survivor/SurvivorCatalog';
import { useSurvivorStore } from '../store/useSurvivorStore';
import { STYLE_LABEL, TARGETING_LABEL } from './survivorLabels';

export const SurvivorTitle: React.FC = () => {
  const startRun = useSurvivorStore((s) => s.startRun);
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center overflow-y-auto bg-[#070b12]/95 px-4 py-6">
      <div className="mb-4 text-center">
        <div className="font-mono-tech text-[10px] tracking-[0.22em] text-sky-400/90 uppercase">Squad Horde Survival</div>
        <h1 className="font-pixel text-2xl tracking-wider text-slate-100 sm:text-4xl">SECTOR: KOPRULU</h1>
        <p className="mt-1.5 text-xs text-slate-400 sm:text-sm">
          지휘관을 움직여 부대를 이끌고, 몰려오는 블라이트 무리 속에서 10분을 버텨 모체를 처치하라.
        </p>
        <p className="mt-1 font-mono-tech text-[10px] text-slate-500">WASD / 방향키 이동 · Space 일시정지 · 모바일: 드래그 조이스틱</p>
      </div>
      <div className="grid w-full max-w-5xl grid-cols-1 gap-3 lg:grid-cols-3">
        {getFactions().map((f) => (
          <div key={f.id} className="flex flex-col justify-between rounded border border-slate-700 bg-slate-900/90 p-3.5" style={{ borderColor: `${f.palette.primary}88` }}>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="font-pixel text-base text-slate-100">{f.name}</span>
                <span className="font-mono-tech text-[10px] text-slate-400">{f.subtitle}</span>
              </div>
              <div className="mt-2 grid grid-cols-5 gap-1 rounded border border-slate-800 bg-[#05080f] p-1.5">
                <UnitChip src={getSpriteDataUrl(f.commander.sprite, f.palette)} label="지휘관" />
                {f.unitPool.map((id) => {
                  const u = getSquadUnitDef(id);
                  return <UnitChip key={id} src={getSpriteDataUrl(u.sprite, f.palette)} label={u.name} />;
                })}
              </div>
              <div className="mt-2 text-xs font-semibold" style={{ color: f.palette.accent }}>[{f.traitName}]</div>
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
    </div>
  );
};

const UnitChip: React.FC<{ src: string; label: string }> = ({ src, label }) => (
  <div className="flex flex-col items-center" title={label}>
    <img src={src} alt={label} className="pixelated h-9 w-9" />
    <span className="mt-0.5 w-full truncate text-center text-[8px] text-slate-400">{label}</span>
  </div>
);
