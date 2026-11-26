import React from 'react';
import { useGameStore } from '../store/useGameStore';

export const TacticalMapModal: React.FC = () => {
  const isMapOpen = useGameStore((s) => s.isMapOpen);
  const mapNodes = useGameStore((s) => s.mapNodes);
  const activeNodeId = useGameStore((s) => s.activeNodeId);
  const act = useGameStore((s) => s.act);
  const setMapOpen = useGameStore((s) => s.setMapOpen);
  const selectMapNode = useGameStore((s) => s.selectMapNode);

  if (!isMapOpen) {
    return null;
  }

  const acts: ReadonlyArray<1 | 2 | 3> = [1, 2, 3];

  return (
    <div
      data-testid="tactical-map-modal"
      className="pointer-events-auto fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/88 p-3 backdrop-blur-xs sm:items-center sm:p-4"
    >
      <div className="my-auto flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-y-auto rounded border border-slate-700 bg-[#0b111c] p-4 sm:p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="font-mono-tech text-[10px] tracking-widest text-sky-400 uppercase">
              KOPRULU SECTOR TACTICAL NAVIGATION
            </div>
            <h2 className="font-pixel text-lg text-slate-100">
              전술 지도 (3갈래 경로 선택)
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setMapOpen(false)}
            className="cursor-pointer rounded border border-slate-700 bg-slate-800 px-3 py-1 font-mono-tech text-xs text-slate-300 hover:bg-slate-700"
          >
            ✕ 닫기
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {acts.map((actNum) => {
            const actNodes = mapNodes.filter((n) => n.act === actNum);
            const gridLabel =
              actNum === 1 ? '3x3 (최대 9기)' : actNum === 2 ? '4x4 (최대 16기)' : '5x5 (최대 25기)';
            return (
              <div
                key={actNum}
                className={`flex flex-col rounded border p-3 ${
                  act === actNum
                    ? 'border-sky-500/70 bg-slate-900/90'
                    : 'border-slate-800 bg-slate-950/70'
                }`}
              >
                <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="font-pixel text-xs text-amber-400">
                    ACT {actNum}
                  </span>
                  <span className="font-mono-tech text-[10px] text-slate-400">
                    {gridLabel}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {actNodes.map((node) => {
                    const isActive = node.id === activeNodeId;
                    const typeBadge =
                      node.type === 'COMBAT'
                        ? '⚔ 전투'
                        : node.type === 'SUPPLY'
                          ? '📦 보급·유물'
                          : '🔧 정비·확장';
                    const badgeClass =
                      node.type === 'COMBAT'
                        ? 'bg-rose-950 text-rose-300 border-rose-700/60'
                        : node.type === 'SUPPLY'
                          ? 'bg-amber-950 text-amber-300 border-amber-700/60'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-700/60';

                    return (
                      <button
                        key={node.id}
                        type="button"
                        data-testid={`map-node-${node.id}`}
                        onClick={() => selectMapNode(node.id)}
                        className={`flex cursor-pointer flex-col rounded border p-2.5 text-left transition-colors ${
                          isActive
                            ? 'border-sky-400 bg-sky-950/50'
                            : node.completed
                              ? 'border-emerald-700/50 bg-slate-900/60'
                              : 'border-slate-800 bg-slate-900/90 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`rounded border px-1.5 py-0.5 font-mono-tech text-[9px] ${badgeClass}`}
                          >
                            {typeBadge}
                          </span>
                          <span className="font-mono-tech text-[10px] text-sky-300">
                            +{node.rewardMinerals} 광물
                          </span>
                        </div>
                        <div className="mt-1.5 text-xs font-semibold text-slate-100">
                          {node.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {node.subtitle}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
