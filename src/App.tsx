import React, { useEffect, useRef } from 'react';
import { GameApp } from './core/GameApp';
import { useGameStore } from './store/useGameStore';
import { BattleHUD } from './ui/BattleHUD';
import { CodexModal } from './ui/CodexModal';
import { PrepOverlay } from './ui/PrepOverlay';
import { TacticalMapModal } from './ui/TacticalMapModal';
import { TitleScreen } from './ui/TitleScreen';

export const App: React.FC = () => {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const gameAppRef = useRef<GameApp | null>(null);
  const phase = useGameStore((s) => s.phase);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) {
      return;
    }

    const app = new GameApp();
    gameAppRef.current = app;
    void app.mount(host);

    return () => {
      app.destroy();
      if (gameAppRef.current === app) {
        gameAppRef.current = null;
      }
    };
  }, []);

  return (
    <main className="flex h-screen w-screen items-center justify-center bg-[#06090f] p-2 sm:p-4">
      <div className="relative aspect-video w-full max-w-[1280px] max-h-full overflow-hidden rounded border border-slate-800 bg-[#090d14] shadow-2xl">
        <div ref={canvasHostRef} className="h-full w-full pixelated" />
        {phase === 'TITLE' && <TitleScreen />}
        {phase === 'PREP' && <PrepOverlay gameAppRef={gameAppRef} />}
        {phase === 'BATTLE' && <BattleHUD />}
        <TacticalMapModal />
        <CodexModal />
      </div>
    </main>
  );
};

export default App;
