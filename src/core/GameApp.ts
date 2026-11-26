import { Application } from 'pixi.js';
import { useGameStore } from '../store/useGameStore';
import { AssetLoader } from './AssetLoader';
import { SceneManager, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './SceneManager';

export class GameApp {
  private app: Application | null = null;
  private sceneManager: SceneManager | null = null;
  private unsubscribeStore: (() => void) | null = null;
  private hostElement: HTMLElement | null = null;
  private destroyed = false;

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
    canvas.addEventListener('contextmenu', this.preventContextMenu);
    container.appendChild(canvas);

    const sceneManager = new SceneManager();
    this.sceneManager = sceneManager;
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.addChild(sceneManager.root);

    sceneManager.initializeLayout();
    this.unsubscribeStore = useGameStore.subscribe(() => {
      sceneManager.syncFromStore();
    });

    app.ticker.add((ticker) => {
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

  private readonly preventContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };
}
