import { Application } from 'pixi.js';
import { FIXED_DT } from '../domain/combat/BattleEngine';
import { useGameStore } from '../store/useGameStore';
import { AssetLoader } from './AssetLoader';
import { SceneManager, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './SceneManager';

const FIXED_DT_MS = FIXED_DT * 1000;

export class GameApp {
  private app: Application | null = null;
  private sceneManager: SceneManager | null = null;
  private unsubscribeStore: (() => void) | null = null;
  private hostElement: HTMLElement | null = null;
  private destroyed = false;
  private tickAccumulatorMs = 0;

  public async mount(container: HTMLElement): Promise<void> {
    if (this.app || this.destroyed) {
      return;
    }
    this.hostElement = container;
    AssetLoader.init();

    const app = new Application();
    await app.init({
      width: VIRTUAL_WIDTH,
      height: VIRTUAL_HEIGHT,
      backgroundColor: 0x090d14,
      antialias: false,
      resolution: 1,
      roundPixels: true,
    });

    if (this.destroyed) {
      app.destroy(true);
      return;
    }

    this.app = app;
    const canvas = app.canvas;
    canvas.className = 'w-full h-full block';
    canvas.style.imageRendering = 'pixelated';
    canvas.style.touchAction = 'none';
    canvas.addEventListener('contextmenu', this.preventContextMenu);
    container.appendChild(canvas);

    const sceneManager = new SceneManager();
    this.sceneManager = sceneManager;
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.addChild(sceneManager.root);

    sceneManager.setCompactMobile(this.isMobileViewport());
    sceneManager.initializeLayout();
    window.addEventListener('resize', this.handleResize);

    this.unsubscribeStore = useGameStore.subscribe(() => {
      sceneManager.syncFromStore();
    });

    app.ticker.add((ticker) => {
      const store = useGameStore.getState();
      if (
        store.phase === 'BATTLE' &&
        store.battleSnapshot?.outcome === 'ONGOING'
      ) {
        this.tickAccumulatorMs += Math.min(100, ticker.deltaMS);
        let baseTicks = 0;
        while (this.tickAccumulatorMs >= FIXED_DT_MS) {
          this.tickAccumulatorMs -= FIXED_DT_MS;
          baseTicks += 1;
        }
        if (baseTicks > 0) {
          store.stepBattleTicks(baseTicks * store.speed);
        }
      } else {
        this.tickAccumulatorMs = 0;
      }

      sceneManager.update(ticker.deltaMS);
    });
  }

  public clientToStage(
    clientX: number,
    clientY: number
  ): { x: number; y: number } | null {
    const canvas = this.app?.canvas;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    return {
      x: ((clientX - rect.left) / rect.width) * VIRTUAL_WIDTH,
      y: ((clientY - rect.top) / rect.height) * VIRTUAL_HEIGHT,
    };
  }

  public handleRosterDragMove(clientX: number, clientY: number): void {
    const pt = this.clientToStage(clientX, clientY);
    if (pt && this.sceneManager) {
      this.sceneManager.handleExternalPointerMove(pt.x, pt.y);
    }
  }

  public handleRosterDragDrop(
    unitId: string,
    clientX: number,
    clientY: number
  ): boolean {
    const pt = this.clientToStage(clientX, clientY);
    if (!pt || !this.sceneManager) {
      return false;
    }
    return this.sceneManager.handleExternalPointerDrop(unitId, pt.x, pt.y);
  }

  public destroy(): void {
    this.destroyed = true;
    window.removeEventListener('resize', this.handleResize);
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;

    if (this.app) {
      this.app.canvas.removeEventListener('contextmenu', this.preventContextMenu);
      if (this.hostElement && this.app.canvas.parentElement === this.hostElement) {
        this.hostElement.removeChild(this.app.canvas);
      }
      this.app.destroy(true);
      this.app = null;
    }
    this.sceneManager = null;
  }

  private isMobileViewport(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }

  private readonly handleResize = (): void => {
    this.sceneManager?.setCompactMobile(this.isMobileViewport());
  };

  private readonly preventContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };
}
