import { Application, TextureStyle } from 'pixi.js';
import { SURVIVOR_DT } from '../domain/survivor/SurvivorEngine';
import { useSurvivorStore } from '../store/useSurvivorStore';
import { SurvivorInput } from './SurvivorInput';
import { SurvivorRenderer, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './SurvivorRenderer';

/** 화면 짧은 변이 대략 이 논리 픽셀 수가 되도록 정수 배율을 고른다 (32x32 스프라이트 최적 해상도) */
const TARGET_SHORT_SIDE = 320;

const DT_MS = SURVIVOR_DT * 1000;
/**
 * 진형 링 수에 따른 카메라 배율: 부대가 커질수록 전장을 넓게 보여준다.
 * 1링 1.00x → 2링 0.84x(표시 면적 +42%) → 3링 0.72x(+93%).
 * 논리 해상도를 키우고 캔버스는 nearest(pixelated)로 화면에 맞추므로 안티앨리어싱은 생기지 않는다.
 */
export function ringZoomFactor(rings: number): number {
  return rings >= 3 ? 0.72 : rings === 2 ? 0.84 : 1;
}
/** 줌 전환 속도 (배율/초) */
const ZOOM_EASE_PER_SEC = 0.6;
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
  /** 정수 배율 기준 논리 해상도 (줌아웃 전) */
  private baseW = VIRTUAL_WIDTH;
  private baseH = VIRTUAL_HEIGHT;
  private zoomFactor = 1;

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
    this.baseW = Math.ceil(w / zoom);
    this.baseH = Math.ceil(h / zoom);
    this.applyView(true);
  }

  /** 현재 줌 배율로 논리 해상도를 맞춘다. 2px 미만 변화는 무시해 매 프레임 리사이즈를 피한다. */
  private applyView(force = false): void {
    const app = this.app;
    if (!app || !this.renderer) {
      return;
    }
    const w = Math.ceil(this.baseW / this.zoomFactor);
    const h = Math.ceil(this.baseH / this.zoomFactor);
    if (!force && Math.abs(w - this.viewW) < 2 && Math.abs(h - this.viewH) < 2) {
      return;
    }
    this.viewW = w;
    this.viewH = h;
    app.renderer.resize(w, h);
    this.renderer.resize(w, h);
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
      this.zoomFactor = 1;
      this.applyView(true);
    }
    if (!engine) {
      renderer.root.visible = false;
      return;
    }
    renderer.root.visible = true;
    const targetZoom = ringZoomFactor(engine.rings);
    if (this.zoomFactor !== targetZoom) {
      const stepZ = (ZOOM_EASE_PER_SEC * Math.min(100, deltaMs)) / 1000;
      this.zoomFactor =
        this.zoomFactor > targetZoom ? Math.max(targetZoom, this.zoomFactor - stepZ) : Math.min(targetZoom, this.zoomFactor + stepZ);
      this.applyView();
    }
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
