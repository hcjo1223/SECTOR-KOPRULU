import { Application, TextureStyle } from 'pixi.js';
import { SURVIVOR_DT } from '../domain/survivor/SurvivorEngine';
import { useSurvivorStore } from '../store/useSurvivorStore';
import { SurvivorInput } from './SurvivorInput';
import { SurvivorRenderer, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './SurvivorRenderer';

/** 화면 짧은 변이 대략 이 논리 픽셀 수가 되도록 정수 배율을 고른다 (32x32 스프라이트 최적 해상도) */
const TARGET_SHORT_SIDE = 320;

const DT_MS = SURVIVOR_DT * 1000;
const HUD_SYNC_MS = 100;

/** PixiJS 앱 수명주기 + 고정 타임스텝 루프 + HUD 동기화 */
export class SurvivorApp {
  private app: Application | null = null;
  private renderer: SurvivorRenderer | null = null;
  private host: HTMLElement | null = null;
  private destroyed = false;
  private accMs = 0;
  private hudMs = 0;
  private lastRunToken = -1;
  private resizeObserver: ResizeObserver | null = null;
  private viewW = VIRTUAL_WIDTH;
  private viewH = VIRTUAL_HEIGHT;

  public async mount(container: HTMLElement): Promise<void> {
    if (this.app || this.destroyed) {
      return;
    }
    this.host = container;
    TextureStyle.defaultOptions.scaleMode = 'nearest';

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
    canvas.className = 'block h-full w-full';
    canvas.style.imageRendering = 'pixelated';
    canvas.style.touchAction = 'none';
    container.appendChild(canvas);

    const renderer = new SurvivorRenderer();
    this.renderer = renderer;
    app.stage.addChild(renderer.root);

    this.resizeObserver = new ResizeObserver(() => this.fitToHost());
    this.resizeObserver.observe(container);
    this.fitToHost();

    SurvivorInput.attach(() => useSurvivorStore.getState().togglePause());

    app.ticker.add((ticker) => this.frame(ticker.deltaMS));
  }

  /** 호스트 크기에 맞춰 논리 해상도를 정하고, CSS 정수 배율로 확대해 도트를 선명하게 유지한다. */
  private fitToHost(): void {
    const host = this.host;
    const app = this.app;
    if (!host || !app || !this.renderer) {
      return;
    }
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w <= 0 || h <= 0) {
      return;
    }
    const zoom = Math.max(1, Math.min(6, Math.round(Math.min(w, h) / TARGET_SHORT_SIDE)));
    this.viewW = Math.ceil(w / zoom);
    this.viewH = Math.ceil(h / zoom);
    app.renderer.resize(this.viewW, this.viewH);
    this.renderer.resize(this.viewW, this.viewH);
  }

  private frame(deltaMs: number): void {
    const renderer = this.renderer;
    if (!renderer) {
      return;
    }
    const store = useSurvivorStore.getState();
    const engine = store.engine;

    if (store.runToken !== this.lastRunToken) {
      this.lastRunToken = store.runToken;
      renderer.clear();
      this.accMs = 0;
    }
    if (!engine) {
      renderer.root.visible = false;
      return;
    }
    renderer.root.visible = true;
    engine.setSpawnRadius(Math.hypot(this.viewW, this.viewH) / 2 + 28);

    const running = engine.phase === 'RUNNING' && !store.paused;
    if (running) {
      const move = SurvivorInput.getMove();
      engine.setMoveInput(move.x, move.y);
      this.accMs += Math.min(100, deltaMs);
      while (this.accMs >= DT_MS && engine.phase === 'RUNNING') {
        this.accMs -= DT_MS;
        engine.step(1);
      }
    }

    const alpha = running ? Math.min(1, this.accMs / DT_MS) : 1;
    renderer.render(engine, alpha, running ? deltaMs : 0);

    this.hudMs += deltaMs;
    const phaseChanged = store.hud?.phase !== engine.phase;
    if (this.hudMs >= HUD_SYNC_MS || phaseChanged) {
      this.hudMs = 0;
      store.syncFromEngine();
    }
  }

  public destroy(): void {
    this.destroyed = true;
    SurvivorInput.detach();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.app) {
      if (this.host && this.app.canvas.parentElement === this.host) {
        this.host.removeChild(this.app.canvas);
      }
      this.app.destroy(true);
      this.app = null;
    }
    this.renderer = null;
  }
}
