import React from 'react';
import { META_UPGRADES, nextUpgradeCost, upgradeLevel } from '../domain/survivor/MetaProgress';
import { useMetaStore } from '../store/useMetaStore';
import { formatTime } from './survivorLabels';

/** 본부: 런마다 모은 전술 데이터로 영구 강화를 산다 */
export const HQPanel: React.FC = () => {
  const meta = useMetaStore((s) => s.meta);
  const buy = useMetaStore((s) => s.buy);
  return (
    <div className="mt-3 w-full max-w-5xl rounded border border-cyan-900/70 bg-slate-950/85 p-2.5">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono-tech text-[11px] tracking-wider text-cyan-300 uppercase">본부 · 영구 강화</span>
        <span className="font-mono-tech text-[11px] text-slate-400">
          전술 데이터 <span className="text-cyan-200">{meta.data}</span> · 출격 {meta.runs}회 · 최고 생존 {formatTime(meta.bestSec)}
          {meta.victories > 0 ? ` · 승리 ${meta.victories}` : ''}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
        {META_UPGRADES.map((u) => {
          const lv = upgradeLevel(meta, u.id);
          const cost = nextUpgradeCost(meta, u.id);
          const affordable = cost !== null && meta.data >= cost;
          return (
            <div key={u.id} className="flex flex-col justify-between rounded border border-slate-800 bg-slate-900/80 p-2">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-slate-100">{u.name}</span>
                  <span className="font-mono-tech text-[10px] text-slate-400">
                    Lv {lv}/{u.costs.length}
                  </span>
                </div>
                <div className="text-[10px] leading-snug text-slate-400">{u.perLevel}</div>
              </div>
              <button
                type="button"
                disabled={!affordable}
                onClick={() => buy(u.id)}
                className="mt-1.5 cursor-pointer rounded border border-cyan-800 py-0.5 font-mono-tech text-[10px] text-cyan-200 hover:bg-cyan-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {cost === null ? '최대' : `강화 · ${cost}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
