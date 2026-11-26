import React from 'react';
import { useGameStore } from '../store/useGameStore';

export const BattleHUD: React.FC = () => {
  const speed = useGameStore((s) => s.speed);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3">
      <div className="rounded border border-slate-700 bg-slate-950/85 px-3 py-1 font-mono-tech text-xs text-slate-200">
        BATTLE PHASE · {speed}x
      </div>
    </div>
  );
};
