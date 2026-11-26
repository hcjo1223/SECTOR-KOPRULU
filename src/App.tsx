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
    <main className="flex min-h-dvh w-full flex-col bg-[#06090f] lg:h-dvh lg:items-center lg:justify-center lg:overflow-hidden lg:p-4">
      <div className="relative flex w-full flex-1 flex-col bg-[#090d14] lg:flex-none lg:aspect-video lg:max-w-[1280px] lg:max-h-full lg:overflow-hidden lg:rounded lg:border lg:border-slate-800 lg:shadow-2xl">
        <div
          ref={canvasHostRef}
          className={`${
            phase === 'TITLE' ? 'hidden lg:block' : 'order-2 aspect-video w-full shrink-0 border-y border-slate-800/80'
          } pixelated lg:order-none lg:border-y-0 lg:absolute lg:inset-0 lg:h-full lg:w-full`}
        />
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
