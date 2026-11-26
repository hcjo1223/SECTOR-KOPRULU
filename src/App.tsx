import React, { useEffect, useRef } from 'react';
import { SurvivorApp } from './core/SurvivorApp';
import { useSurvivorStore } from './store/useSurvivorStore';
import { LevelUpModal } from './ui/LevelUpModal';
import { ResultModal } from './ui/ResultModal';
import { SurvivorHUD } from './ui/SurvivorHUD';
import { SurvivorTitle } from './ui/SurvivorTitle';
import { VirtualJoystick } from './ui/VirtualJoystick';

export const App: React.FC = () => {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const screen = useSurvivorStore((s) => s.screen);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) {
      return;
    }
    const app = new SurvivorApp();
    void app.mount(host);
    return () => app.destroy();
  }, []);

  const inRun = screen === 'RUN';

  return (
    <main className="flex h-dvh w-full items-center justify-center overflow-hidden bg-[#06090f] lg:p-4">
      <div className="relative h-full w-full overflow-hidden bg-[#090d14] lg:aspect-video lg:h-auto lg:max-h-full lg:max-w-[1280px] lg:rounded lg:border lg:border-slate-800 lg:shadow-2xl">
        <div ref={canvasHostRef} className="pixelated absolute inset-0" />
        {inRun && (
          <>
            {/* 화면 어디든 누르고 드래그하면 플로팅 조이스틱 (마우스 드래그도 동작) */}
            <VirtualJoystick className="absolute inset-0" />
            <SurvivorHUD />
            <LevelUpModal />
            <ResultModal />
          </>
        )}
        {screen === 'TITLE' && <SurvivorTitle />}
      </div>
    </main>
  );
};

export default App;
