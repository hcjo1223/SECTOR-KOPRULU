import { CanvasSource, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import { ATTACK_RELEASE_SEC, type SurvivorEngine } from '../domain/survivor/SurvivorEngine';
import type {
  EffectState,
  EnemyShotVisual,
  FactionPalette,
  ProjectileVisual,
  SpriteArchetype,
} from '../domain/survivor/types';
import {
  angleToDir8,
  EXPLOSION_FRAME_COUNT,
  FLAME_FRAME_COUNT,
  HIT_SPARK_FRAME_COUNT,
  OUTLINE_RGB,
  renderExplosionFramePixels,
  renderFlamePuffPixels,
  renderGemPixels,
  renderGroundTilePixels,
  renderHitSparkPixels,
  renderProjectilePixels,
  renderSlashFramePixels,
  renderSpriteFxPixels,
  renderSpritePixels,
  SLASH_FRAME_COUNT,
  SPRITE_FRAME_COUNT,
  SPRITE_FX_PAD,
  SPRITE_FX_SIZE,
  SPRITE_SIZE,
  type ExplosionVariant,
  type FlameVariant,
  type HitSparkVariant,
  type SlashVariant,
  type SpriteAnim,
  type SpriteDir8,
} from './SurvivorSprites';

export const VIRTUAL_WIDTH = 640;
export const VIRTUAL_HEIGHT = 360;

const OUTLINE_HEX = (OUTLINE_RGB[0] << 16) | (OUTLINE_RGB[1] << 8) | OUTLINE_RGB[2];
const BODY_ANCHOR_Y = 0.82;
const FX_ANCHOR_Y = (SPRITE_SIZE * BODY_ANCHOR_Y + SPRITE_FX_PAD) / SPRITE_FX_SIZE;

const textureCache = new Map<string, Texture>();

function pixelsToCanvas(buf: { width: number; height: number; data: Uint8ClampedArray }): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = buf.width;
  canvas.height = buf.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(buf.width, buf.height);
    img.data.set(buf.data);
    ctx.putImageData(img, 0, 0);
  }
  return canvas;
}

export function getSpriteTexture(
  archetype: SpriteArchetype,
  palette: FactionPalette,
  frame: number = 0,
  dir: SpriteDir8 = 'S',
  anim: SpriteAnim = 'IDLE'
): Texture {
  const f = Math.abs(Math.round(frame)) % SPRITE_FRAME_COUNT[anim];
  const key = `${archetype}|${palette.primary}|${palette.secondary}|${palette.accent}|${dir}|${anim}|${f}`;
  const hit = textureCache.get(key);
  if (hit) {
    return hit;
  }
  const source = new CanvasSource({
    resource: pixelsToCanvas(renderSpritePixels(archetype, palette, f, dir, anim)),
    scaleMode: 'nearest',
  });
  const tex = new Texture({ source });
  textureCache.set(key, tex);
  return tex;
}

const fxTextureCache = new Map<string, Texture | null>();

/** 같은 프레임의 48x48 확장 이펙트 레이어 텍스처 (총구 섬광·참격·번개 등). 없으면 null */
export function getSpriteFxTexture(
  archetype: SpriteArchetype,
  palette: FactionPalette,
  frame: number,
  dir: SpriteDir8,
  anim: SpriteAnim
): Texture | null {
  const f = Math.abs(Math.round(frame)) % SPRITE_FRAME_COUNT[anim];
  const key = `${archetype}|${palette.primary}|${palette.secondary}|${palette.accent}|${dir}|${anim}|${f}`;
  if (fxTextureCache.has(key)) {
    return fxTextureCache.get(key) ?? null;
  }
  const px = renderSpriteFxPixels(archetype, palette, f, dir, anim);
  const tex = px ? new Texture({ source: new CanvasSource({ resource: pixelsToCanvas(px), scaleMode: 'nearest' }) }) : null;
  fxTextureCache.set(key, tex);
  return tex;
}

/** 공격 상태 프레임: 예비동작 중 0, 발동 후 남은 시간에 따라 1(발사)·2(반동)·3(복귀) */
export function attackAnimFrame(windupSec: number, attackFlashSec: number): number {
  if (windupSec > 0) {
    return 0;
  }
  const t = 1 - attackFlashSec / ATTACK_RELEASE_SEC;
  return t < 1 / 3 ? 1 : t < 2 / 3 ? 2 : 3;
}

const dataUrlCache = new Map<string, string>();

export function getSpriteDataUrl(
  archetype: SpriteArchetype,
  palette: FactionPalette,
  frame: number = 0,
  dir: SpriteDir8 = 'S',
  anim: SpriteAnim = 'IDLE'
): string {
  const f = Math.abs(Math.round(frame)) % SPRITE_FRAME_COUNT[anim];
  const key = `${archetype}|${palette.primary}|${palette.secondary}|${palette.accent}|${dir}|${anim}|${f}`;
  const hit = dataUrlCache.get(key);
  if (hit) {
    return hit;
  }
  // UI 미리보기는 32x32 몸 + 48x48 이펙트의 중앙 32x32 영역을 합성해 보여준다
  const body = renderSpritePixels(archetype, palette, f, dir, anim);
  const fx = renderSpriteFxPixels(archetype, palette, f, dir, anim);
  if (fx) {
    for (let y = 0; y < SPRITE_SIZE; y += 1) {
      for (let x = 0; x < SPRITE_SIZE; x += 1) {
        const fi = ((y + SPRITE_FX_PAD) * SPRITE_FX_SIZE + (x + SPRITE_FX_PAD)) * 4;
        if (fx.data[fi + 3] > 0) {
          const bi = (y * SPRITE_SIZE + x) * 4;
          body.data[bi] = fx.data[fi];
          body.data[bi + 1] = fx.data[fi + 1];
          body.data[bi + 2] = fx.data[fi + 2];
          body.data[bi + 3] = fx.data[fi + 3];
        }
      }
    }
  }
  const url = pixelsToCanvas(body).toDataURL();
  dataUrlCache.set(key, url);
  return url;
}

function getGemTexture(tier: 1 | 2 | 3, frame: number): Texture {
  const f = Math.abs(Math.round(frame)) % 2;
  const key = `GEM|${tier}|${f}`;
  const hit = textureCache.get(key);
  if (hit) {
    return hit;
  }
  const source = new CanvasSource({
    resource: pixelsToCanvas(renderGemPixels(tier, f)),
    scaleMode: 'nearest',
  });
  const tex = new Texture({ source });
  textureCache.set(key, tex);
  return tex;
}

function getProjectileTexture(
  visual: ProjectileVisual | EnemyShotVisual,
  dir: SpriteDir8,
  frame: number
): Texture {
  const f = Math.abs(Math.round(frame)) % 2;
  const key = `PROJ|${visual}|${dir}|${f}`;
  const hit = textureCache.get(key);
  if (hit) return hit;
  const source = new CanvasSource({
    resource: pixelsToCanvas(renderProjectilePixels(visual, dir, f)),
    scaleMode: 'nearest',
  });
  const tex = new Texture({ source });
  textureCache.set(key, tex);
  return tex;
}

function getExplosionTexture(frame: number, variant: ExplosionVariant): Texture {
  const f = Math.max(0, Math.min(EXPLOSION_FRAME_COUNT - 1, Math.round(frame)));
  const key = `BOOM|${variant}|${f}`;
  const hit = textureCache.get(key);
  if (hit) return hit;
  const source = new CanvasSource({
    resource: pixelsToCanvas(renderExplosionFramePixels(f, variant)),
    scaleMode: 'nearest',
  });
  const tex = new Texture({ source });
  textureCache.set(key, tex);
  return tex;
}

function getSlashTexture(frame: number, dir: SpriteDir8, variant: SlashVariant): Texture {
  const f = Math.max(0, Math.min(SLASH_FRAME_COUNT - 1, Math.round(frame)));
  const key = `SLASH|${variant}|${dir}|${f}`;
  const hit = textureCache.get(key);
  if (hit) return hit;
  const source = new CanvasSource({
    resource: pixelsToCanvas(renderSlashFramePixels(f, dir, variant)),
    scaleMode: 'nearest',
  });
  const tex = new Texture({ source });
  textureCache.set(key, tex);
  return tex;
}

function getFlamePuffTexture(frame: number, variant: FlameVariant): Texture {
  const f = Math.max(0, Math.min(FLAME_FRAME_COUNT - 1, Math.round(frame)));
  const key = `FLAME|${variant}|${f}`;
  const hit = textureCache.get(key);
  if (hit) return hit;
  const source = new CanvasSource({
    resource: pixelsToCanvas(renderFlamePuffPixels(f, variant)),
    scaleMode: 'nearest',
  });
  const tex = new Texture({ source });
  textureCache.set(key, tex);
  return tex;
}

function getHitSparkTexture(frame: number, dir: SpriteDir8, variant: HitSparkVariant): Texture {
  const f = Math.max(0, Math.min(HIT_SPARK_FRAME_COUNT - 1, Math.round(frame)));
  const key = `SPARK|${variant}|${dir}|${f}`;
  const hit = textureCache.get(key);
  if (hit) return hit;
  const source = new CanvasSource({
    resource: pixelsToCanvas(renderHitSparkPixels(f, dir, variant)),
    scaleMode: 'nearest',
  });
  const tex = new Texture({ source });
  textureCache.set(key, tex);
  return tex;
}

function buildGroundTexture(): Texture {
  const canvas = pixelsToCanvas(renderGroundTilePixels());
  return new Texture({ source: new CanvasSource({ resource: canvas, scaleMode: 'nearest' }) });
}

function hexNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** 정수 격자에 맞춘 픽셀 원(Stepped Pixel Circle) 도트 렌더링 */
function drawPixelCircle(
  g: Graphics,
  cx: number,
  cy: number,
  radius: number,
  color: number,
  alpha: number = 1,
  pixelSize: number = 1,
  stepStride: number = 1
): void {
  const r = Math.max(2, Math.round(radius));
  const steps = Math.max(12, Math.min(64, Math.round((r * 2.2) / stepStride)));
  const ix = Math.round(cx);
  const iy = Math.round(cy);
  for (let i = 0; i < steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    const px = ix + Math.round(Math.cos(a) * r);
    const py = iy + Math.round(Math.sin(a) * r);
    g.rect(px, py, pixelSize, pixelSize).fill({ color, alpha });
  }
}

/** 정수 격자에 맞춘 계단식 디더링 픽셀 원판(Stepped Dithered Pixel Disc) */
function drawPixelDisc(
  g: Graphics,
  cx: number,
  cy: number,
  radius: number,
  color: number,
  alpha: number = 1,
  cellSize: number = 2,
  checkerboard: boolean = true
): void {
  const r = Math.max(2, Math.round(radius));
  const r2 = r * r;
  const ix = Math.round(cx);
  const iy = Math.round(cy);
  const steps = Math.floor(r / cellSize);
  for (let gy = -steps; gy <= steps; gy += 1) {
    const dy = gy * cellSize;
    const maxDx = Math.floor(Math.sqrt(Math.max(0, r2 - dy * dy)));
    if (maxDx <= 0) continue;
    if (!checkerboard) {
      g.rect(ix - maxDx, iy + dy, maxDx * 2, cellSize).fill({ color, alpha });
    } else {
      for (let gx = -steps; gx <= steps; gx += 1) {
        const dx = gx * cellSize;
        if (dx * dx + dy * dy > r2) continue;
        if (((gx + gy) & 1) !== 0) continue;
        g.rect(ix + dx, iy + dy, cellSize, cellSize).fill({ color, alpha });
      }
    }
  }
}

/** 정수 격자에 맞춘 픽셀 선분(Bresenham Stepped Line) */
function drawPixelLine(
  g: Graphics,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: number,
  alpha: number = 1,
  pixelSize: number = 1,
  everyN: number = 1
): void {
  const ix0 = Math.round(x0);
  const iy0 = Math.round(y0);
  const ix1 = Math.round(x1);
  const iy1 = Math.round(y1);
  const dx = ix1 - ix0;
  const dy = iy1 - iy0;
  const steps = Math.max(1, Math.max(Math.abs(dx), Math.abs(dy)));
  for (let i = 0; i <= steps; i += everyN) {
    const t = i / steps;
    const px = Math.round(ix0 + dx * t);
    const py = Math.round(iy0 + dy * t);
    g.rect(px, py, pixelSize, pixelSize).fill({ color, alpha });
  }
}

/** 1px 외곽선이 있는 5x5 픽셀 십자(+) / 별 아이콘 */
function drawPixelCross(
  g: Graphics,
  cx: number,
  cy: number,
  fillCol: number,
  coreCol: number,
  alpha: number = 1
): void {
  const x = Math.round(cx);
  const y = Math.round(cy);
  // 암색 1px 외곽선 배경
  g.rect(x - 1, y - 3, 3, 7).fill({ color: OUTLINE_HEX, alpha: alpha * 0.85 });
  g.rect(x - 3, y - 1, 7, 3).fill({ color: OUTLINE_HEX, alpha: alpha * 0.85 });
  // 십자 본체
  g.rect(x, y - 2, 1, 5).fill({ color: fillCol, alpha });
  g.rect(x - 2, y, 5, 1).fill({ color: fillCol, alpha });
  // 중앙 하이라이트 코어
  g.rect(x, y, 1, 1).fill({ color: coreCol, alpha });
}

interface PooledSprite {
  sprite: Sprite;
  seenFrame: number;
}

/**
 * SurvivorEngine의 논리 상태를 읽어 픽셀 아트로 그리는 렌더러.
 * - 지휘관 추종 카메라 + 64x64 코프룰루 황무지/격자 심리스 픽셀 타일
 * - 32x32 본체 + 48x48 확장 공격 이펙트(FX) 8방향 다중 상태 스프라이트
 * - 노바 기동군 포진 전술 방어선(Entrench)
 * - 3티어 픽셀 광물 결정(XP Gem) + 10종 8방향 픽셀 투사체 + 다중 프레임 픽셀 전투 이펙트
 */
export class SurvivorRenderer {
  public readonly root = new Container();
  private readonly ground: TilingSprite;
  private readonly world = new Container();
  private readonly groundFx = new Graphics();
  private readonly gemLayer = new Container();
  private readonly gemFx = new Graphics();
  private readonly unitLayer = new Container();
  private readonly projGfx = new Graphics();
  private readonly projLayer = new Container();
  private readonly fxGfx = new Graphics();
  private readonly fxLayer = new Container();
  private readonly barGfx = new Graphics();
  private readonly sprites = new Map<number, PooledSprite>();
  private readonly gemSprites = new Map<number, PooledSprite>();
  private readonly projSprites = new Map<number, PooledSprite>();
  private readonly fxSprites = new Map<number, PooledSprite>();
  private fxSpriteCursor = 0;
  private frame = 0;
  private timeSec = 0;
  private viewW = VIRTUAL_WIDTH;
  private viewH = VIRTUAL_HEIGHT;

  constructor() {
    this.ground = new TilingSprite({
      texture: buildGroundTexture(),
      width: VIRTUAL_WIDTH,
      height: VIRTUAL_HEIGHT,
    });
    this.unitLayer.sortableChildren = true;
    this.world.addChild(
      this.groundFx,
      this.gemFx,
      this.gemLayer,
      this.unitLayer,
      this.projGfx,
      this.projLayer,
      this.fxGfx,
      this.fxLayer,
      this.barGfx
    );
    this.root.addChild(this.ground, this.world);
  }

  public resize(viewW: number, viewH: number): void {
    this.viewW = viewW;
    this.viewH = viewH;
    this.ground.width = viewW;
    this.ground.height = viewH;
  }

  public clear(): void {
    for (const p of this.sprites.values()) {
      p.sprite.destroy();
    }
    this.sprites.clear();
    for (const g of this.gemSprites.values()) {
      g.sprite.destroy();
    }
    this.gemSprites.clear();
    for (const pr of this.projSprites.values()) {
      pr.sprite.destroy();
    }
    this.projSprites.clear();
    for (const fx of this.fxSprites.values()) {
      fx.sprite.destroy();
    }
    this.fxSprites.clear();
    this.groundFx.clear();
    this.gemFx.clear();
    this.projGfx.clear();
    this.fxGfx.clear();
    this.barGfx.clear();
  }

  public render(engine: SurvivorEngine, alpha: number, deltaMs: number): void {
    this.frame += 1;
    this.timeSec += deltaMs / 1000;
    const lerp = (a: number, b: number): number => a + (b - a) * alpha;
    const c = engine.commander;
    const camX = lerp(c.px, c.x);
    const camY = lerp(c.py, c.y);
    const ox = Math.round(this.viewW / 2 - camX);
    const oy = Math.round(this.viewH / 2 - camY);
    this.world.position.set(ox, oy);
    this.ground.tilePosition.set(ox, oy);

    const palette = engine.faction.palette;
    const accentCol = hexNum(palette.accent);
    const primaryCol = hexNum(palette.primary);
    const animTick = Math.floor(this.timeSec * 6);

    const gf = this.groundFx;
    gf.clear();

    // ── 2. 노바 기동군 포진(Entrench) 전술 방어선
    if (engine.isEntrenched) {
      const perimR = 26 * engine.rings + 16;
      const pulse = 0.45 + 0.18 * Math.sin(this.timeSec * 6);
      drawPixelCircle(gf, camX, camY, perimR, accentCol, pulse, 1, 2);
      drawPixelCircle(gf, camX, camY, 14, accentCol, pulse * 0.85, 1, 2);
      // 4방향 전술 바리케이드 셰브론 파일런
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dx, dy] of dirs) {
        const px = Math.round(camX + dx * perimR);
        const py = Math.round(camY + dy * perimR);
        gf.rect(px - 2, py - 2, 5, 5).fill({ color: OUTLINE_HEX, alpha: 0.85 });
        gf.rect(px - 1, py - 1, 3, 3).fill({ color: accentCol, alpha: 0.95 });
        gf.rect(px, py, 1, 1).fill({ color: 0xffffff, alpha: 0.95 });
      }
    }

    // ── 3. 지휘관 발밑 지휘 링 & 바라보는 방향 전술 조준선 (FACING 가이드)
    const cx = Math.round(camX);
    const cy = Math.round(camY);
    // 지휘관 발밑 그림자 & 진영 오라 링
    gf.rect(cx - 8, cy + 2, 16, 4).fill({ color: 0x04060a, alpha: 0.55 });
    drawPixelCircle(gf, cx, cy + 1, 12, primaryCol, 0.55, 1, 2);

    const fx = c.dirX;
    const fy = c.dirY;
    const faceAngle = Math.atan2(fy, fx);
    const hasFacingUnit = engine.squad.some((m) => m.def.attack.targeting === 'FACING');
    if (hasFacingUnit) {
      // 방향형 부대원 보유 시 전방 사격 원뿔 가이드 도트 표시
      const guideHalf = (32 * Math.PI) / 180;
      for (const sign of [-1, 1]) {
        const ga = faceAngle + sign * guideHalf;
        drawPixelLine(
          gf,
          cx + Math.cos(ga) * 18,
          cy + Math.sin(ga) * 18,
          cx + Math.cos(ga) * 42,
          cy + Math.sin(ga) * 42,
          accentCol,
          0.32,
          1,
          4
        );
      }
    }

    // 전방 조준 셰브론 레티클 (1px 외곽선 + 황금 픽셀 화살촉)
    const tipX = Math.round(camX + fx * 30);
    const tipY = Math.round(camY + fy * 30);
    drawPixelLine(gf, camX + fx * 16, camY + fy * 16, tipX, tipY, 0xf2e27a, 0.75, 1, 2);
    const wing1X = Math.round(tipX - fx * 4 - fy * 3);
    const wing1Y = Math.round(tipY - fy * 4 + fx * 3);
    const wing2X = Math.round(tipX - fx * 4 + fy * 3);
    const wing2Y = Math.round(tipY - fy * 4 - fx * 3);
    gf.rect(tipX - 1, tipY - 1, 3, 3).fill({ color: OUTLINE_HEX, alpha: 0.9 });
    drawPixelLine(gf, wing1X, wing1Y, tipX, tipY, 0xf2e27a, 0.95, 2, 1);
    drawPixelLine(gf, wing2X, wing2Y, tipX, tipY, 0xf2e27a, 0.95, 2, 1);
    gf.rect(tipX, tipY, 1, 1).fill({ color: 0xffffff, alpha: 1 });

    // ── 4. 경험치 결정 (3티어 픽셀 크리스탈 스프라이트 + 자석 끌림 잔상)
    const gemFx = this.gemFx;
    gemFx.clear();
    for (const g of engine.gems) {
      const tier: 1 | 2 | 3 = g.value >= 8 ? 3 : g.value >= 3 ? 2 : 1;
      const gFrame = (animTick + g.id) % 2;
      const gx = Math.round(g.x);
      const gy = Math.round(g.y);
      // 결정 바닥 그림자
      gemFx.rect(gx - 2, gy + 3, 4, 1).fill({ color: 0x05070c, alpha: 0.5 });
      if (g.magnetized) {
        // 자석 흡입 시 반짝이는 픽셀 궤적
        const dx = camX - gx;
        const dy = camY - gy;
        const d = Math.hypot(dx, dy) || 1;
        const tx = Math.round(gx - (dx / d) * 4);
        const ty = Math.round(gy - (dy / d) * 4);
        gemFx.rect(tx, ty, 1, 1).fill({
          color: tier === 3 ? 0xffe070 : tier === 2 ? 0x7cf2a0 : 0x8ef4ff,
          alpha: 0.85,
        });
      }
      this.placeGemSprite(g.id, getGemTexture(tier, gFrame), gx, gy);
    }
    for (const [id, p] of this.gemSprites) {
      if (p.seenFrame !== this.frame) {
        p.sprite.destroy();
        this.gemSprites.delete(id);
      }
    }

    // ── 4b. 불길/플라즈마 장판 · 지뢰 · 적 위험 지대 · 엘리트 특성 표시 · 보급 상자
    const blink = Math.sin(this.timeSec * 10) > 0;
    for (const z of engine.zones) {
      const a = Math.min(1, z.lifeSec / 0.6);
      const zx = Math.round(z.x);
      const zy = Math.round(z.y);
      const isPlasma = z.kind === 'PLASMA';
      const outerCol = isPlasma ? 0x6eeeff : 0xff6a2a;
      const innerCol = isPlasma ? 0xffcf4a : 0xffc04a;
      drawPixelDisc(gf, zx, zy, z.radius, outerCol, 0.24 * a, 2, true);
      drawPixelDisc(gf, zx, zy, z.radius * 0.56, innerCol, 0.22 * a, 2, true);
      drawPixelCircle(gf, zx, zy, z.radius, outerCol, 0.65 * a, 1, 2);
      // 장판 내부 타오르는 픽셀 불씨 4개
      for (let k = 0; k < 4; k += 1) {
        const ang = (k / 4) * Math.PI * 2 + animTick * 0.45;
        const rr = z.radius * (0.28 + (k % 2) * 0.25);
        const ex = Math.round(zx + Math.cos(ang) * rr);
        const ey = Math.round(zy + Math.sin(ang) * rr);
        gf.rect(ex - 1, ey - 1, 3, 3).fill({ color: OUTLINE_HEX, alpha: 0.55 * a });
        gf.rect(ex, ey, 2, 2).fill({ color: k % 2 === 0 ? innerCol : outerCol, alpha: 0.9 * a });
      }
    }
    for (const mine of engine.mines) {
      const x = Math.round(mine.x);
      const y = Math.round(mine.y);
      gf.rect(x - 3, y - 2, 7, 5).fill({ color: OUTLINE_HEX });
      gf.rect(x - 2, y - 1, 5, 3).fill({ color: mine.evolved ? 0x7c5a20 : 0x4a505c });
      gf.rect(x - 1, y - 1, 3, 1).fill({ color: mine.evolved ? 0xffcf4a : 0x788296 });
      if (mine.armSec <= 0 && blink) {
        gf.rect(x, y, 1, 1).fill({ color: mine.evolved ? 0x6eeeff : 0xff4040 });
      }
    }
    for (const h of engine.hazards) {
      const col = hexNum(h.color);
      const x = Math.round(h.x);
      const y = Math.round(h.y);
      if (h.armSec > 0) {
        const k = 1 - h.armSec / Math.max(0.01, h.maxArmSec);
        drawPixelCircle(gf, x, y, h.radius, col, blink ? 0.92 : 0.48, 1, 2);
        drawPixelDisc(gf, x, y, Math.max(2, h.radius * k), col, 0.22, 2, true);
        drawPixelCross(gf, x, y, col, 0xffffff, blink ? 0.85 : 0.45);
      } else if (h.dps > 0) {
        drawPixelDisc(gf, x, y, h.radius, col, 0.3, 2, true);
        drawPixelCircle(gf, x, y, h.radius, col, 0.72, 1, 2);
        // 산성 기포 픽셀 도트
        for (let k = 0; k < 4; k += 1) {
          const ang = (k / 4) * Math.PI * 2 + animTick * 0.35;
          const bx = Math.round(x + Math.cos(ang) * h.radius * 0.48);
          const by = Math.round(y + Math.sin(ang) * h.radius * 0.48);
          gf.rect(bx - 1, by - 1, 3, 3).fill({ color: OUTLINE_HEX, alpha: 0.6 });
          gf.rect(bx, by, 1, 1).fill({ color: 0xeaff98, alpha: 0.9 });
        }
      }
    }
    for (const e of engine.enemies) {
      if (e.affixes.includes('AURA')) {
        drawPixelCircle(gf, Math.round(e.x), Math.round(e.y), 56, 0xc070ff, 0.4, 1, 3);
      }
      if (e.shield > 0) {
        drawPixelCircle(gf, Math.round(e.x), Math.round(e.y) - 6, Math.round(e.radius + 4), 0x7fe3ff, 0.85, 1, 2);
      }
    }
    for (const ch of engine.chests) {
      const x = Math.round(ch.x);
      const y = Math.round(ch.y) - (blink ? 1 : 0);
      gemFx.rect(x - 6, y - 5, 12, 10).fill({ color: OUTLINE_HEX });
      gemFx.rect(x - 5, y - 4, 10, 8).fill({ color: 0xc08a3a });
      gemFx.rect(x - 5, y - 1, 10, 1).fill({ color: 0x7a5420 });
      gemFx.rect(x - 1, y - 2, 2, 3).fill({ color: 0xffe08a });
    }

    // ── 5. 지휘관 · 부대원 · 블라이트 무리 8방향(8-Dir) & 다중 상태(IDLE / WALK / ATTACK) 32x32 본체 + 48x48 이펙트
    const walkTick = Math.floor(this.timeSec * 10);
    const idleTick = Math.floor(this.timeSec * 3);

    const cmdDir = angleToDir8(c.facingAngle);
    const cmdAnim: SpriteAnim = c.windupSec > 0 || c.attackFlashSec > 0 ? 'ATTACK' : c.moving ? 'WALK' : 'IDLE';
    const cmdFrame =
      cmdAnim === 'ATTACK'
        ? attackAnimFrame(c.windupSec, c.attackFlashSec)
        : cmdAnim === 'WALK'
          ? walkTick % 4
          : idleTick % 2;
    this.placeSprite(
      c.id,
      getSpriteTexture(c.def.sprite, engine.paletteFor(c.def), cmdFrame, cmdDir, cmdAnim),
      camX,
      camY,
      1,
      c.sinceHitSec < 0.12 ? 0xff7070 : 0xffffff
    );
    this.placeFx(c.id, getSpriteFxTexture(c.def.sprite, engine.paletteFor(c.def), cmdFrame, cmdDir, cmdAnim), camX, camY, 1);

    for (const m of engine.squad) {
      const mx = lerp(m.px, m.x);
      const my = lerp(m.py, m.y);
      const imx = Math.round(mx);
      const imy = Math.round(my);
      // 부대원 발밑 그림자 & 보호막 링 / 포진 버프 마크
      gf.rect(imx - 7, imy + 2, 14, 3).fill({ color: 0x04060a, alpha: 0.45 });
      if (m.shield > 0) {
        drawPixelCircle(gf, imx, imy - 6, 11, 0x5fd8f0, 0.25, 1, 3);
      }
      if (engine.isEntrenched && (animTick + m.id) % 2 === 0) {
        gf.rect(imx + 9, imy - 16, 1, 3).fill({ color: accentCol, alpha: 0.85 });
      }
      const mDir = angleToDir8(m.facingAngle);
      const mAnim: SpriteAnim = m.windupSec > 0 || m.attackFlashSec > 0 ? 'ATTACK' : m.moving ? 'WALK' : 'IDLE';
      const mFrame =
        mAnim === 'ATTACK'
          ? attackAnimFrame(m.windupSec, m.attackFlashSec)
          : mAnim === 'WALK'
            ? (walkTick + m.id) % 4
            : (idleTick + m.id) % 2;
      const tint = m.sinceHitSec < 0.1 ? 0xff7070 : 0xffffff;
      this.placeSprite(
        m.id,
        getSpriteTexture(m.def.sprite, engine.paletteFor(m.def), mFrame, mDir, mAnim),
        mx,
        my,
        1,
        tint
      );
      this.placeFx(m.id, getSpriteFxTexture(m.def.sprite, engine.paletteFor(m.def), mFrame, mDir, mAnim), mx, my, 1);
    }

    for (const e of engine.enemies) {
      const ex = lerp(e.px, e.x);
      const ey = lerp(e.py, e.y);
      const iex = Math.round(ex);
      const iey = Math.round(ey);
      const sw = Math.round(12 * e.scale);
      gf.rect(iex - Math.floor(sw / 2), iey + 2, sw, 3).fill({ color: 0x04060a, alpha: 0.5 });

      if (e.isBoss) {
        // 최종 보스 [블라이트 모체] 발밑 위협 오라 링
        drawPixelCircle(gf, iex, iey - 4, 28, 0xff3858, 0.65, 2, 2);
        drawPixelCircle(gf, iex, iey - 4, 22, 0xffd040, 0.45, 1, 2);
      } else if (e.isElite) {
        // 엘리트 개체 발밑 황금 픽셀 마커
        drawPixelCircle(gf, iex, iey, Math.round(11 * e.scale), 0xffc840, 0.6, 1, 2);
      }

      const eDir = angleToDir8(e.facingAngle);
      const eAnim: SpriteAnim = e.windupSec > 0 || e.attackFlashSec > 0 ? 'ATTACK' : 'WALK';
      const eFrame = eAnim === 'ATTACK' ? attackAnimFrame(e.windupSec, e.attackFlashSec) : (walkTick + e.id) % 4;
      const tint = e.hitFlashSec > 0 ? 0xff9090 : e.isElite ? 0xffe6a8 : 0xffffff;
      this.placeSprite(
        e.id,
        getSpriteTexture(e.def.sprite, e.def.palette, eFrame, eDir, eAnim),
        ex,
        ey,
        e.scale,
        tint
      );
      this.placeFx(e.id, getSpriteFxTexture(e.def.sprite, e.def.palette, eFrame, eDir, eAnim), ex, ey, e.scale);
    }

    for (const [id, p] of this.sprites) {
      if (p.seenFrame !== this.frame) {
        p.sprite.destroy();
        this.sprites.delete(id);
      }
    }

    // ── 6. 10종 8방향 픽셀 투사체 스프라이트 + 계단식 픽셀 예광/연기 궤적
    const pg = this.projGfx;
    pg.clear();
    for (const p of engine.projectiles) {
      const x = Math.round(lerp(p.px, p.x));
      const y = Math.round(lerp(p.py, p.y));
      const col = hexNum(p.color);
      const len = Math.hypot(p.vx, p.vy) || 1;
      const ux = p.vx / len;
      const uy = p.vy / len;
      const pDir = angleToDir8(Math.atan2(p.vy, p.vx));
      const pFrame = (animTick + p.id) % 2;
      const visual: ProjectileVisual =
        p.visual ??
        (p.splashRadiusPx > 0
          ? p.evolved
            ? 'MLRS'
            : 'MORTAR'
          : p.pierceLeft > 0
            ? p.evolved
              ? 'EXECUTIONER'
              : 'SNIPER'
            : p.evolved
              ? 'GATLING'
              : 'RIFLE');

      if (visual === 'MORTAR' || visual === 'MLRS') {
        // 박격포탄 / 다연장 로켓: 3단계 픽셀 추진 연기 퍼프
        for (let s = 1; s <= 3; s += 1) {
          const sx = Math.round(x - ux * (s * 3.5 + 3));
          const sy = Math.round(y - uy * (s * 3.5 + 3));
          const sc =
            visual === 'MLRS'
              ? s === 1
                ? 0x6eeeff
                : s === 2
                  ? 0xffcf4a
                  : 0x485874
              : s === 1
                ? 0xff9838
                : s === 2
                  ? 0x707c90
                  : 0x3e4656;
          pg.rect(sx - 1, sy - 1, 2, 2).fill({ color: sc, alpha: 0.9 - s * 0.2 });
        }
      } else if (visual === 'SNIPER' || visual === 'EXECUTIONER') {
        // 저격 / 처형자 레일건: 장거리 관통 예광 꼬리
        const tailLen = visual === 'EXECUTIONER' ? 14 : 10;
        const tailX = Math.round(x - ux * tailLen);
        const tailY = Math.round(y - uy * tailLen);
        drawPixelLine(pg, tailX, tailY, x, y, OUTLINE_HEX, 0.85, 3, 2);
        drawPixelLine(pg, tailX, tailY, x, y, visual === 'EXECUTIONER' ? 0xff3858 : col, 0.95, 2, 1);
        drawPixelLine(
          pg,
          Math.round(x - ux * 6),
          Math.round(y - uy * 6),
          x,
          y,
          visual === 'EXECUTIONER' ? 0xffcf4a : 0xffffff,
          1,
          1,
          1
        );
      } else {
        // 소총 / 개틀링: 간결한 픽셀 예광 잔상
        const tx = Math.round(x - ux * 5);
        const ty = Math.round(y - uy * 5);
        drawPixelLine(pg, tx, ty, x, y, visual === 'GATLING' ? 0xffcf4a : col, 0.8, 1, 1);
      }

      this.placeProjSprite(p.id, getProjectileTexture(visual, pDir, pFrame), x, y);
    }

    // ── 6b. 적 투사체 (포자 산성탄 · 가시 골침 · 프리즘 광자탄 · 모체/대주교 왕실 탄막)
    for (let i = 0; i < engine.enemyShots.length; i += 1) {
      const sh = engine.enemyShots[i];
      const x = Math.round(lerp(sh.px, sh.x));
      const y = Math.round(lerp(sh.py, sh.y));
      const len = Math.hypot(sh.vx, sh.vy) || 1;
      const ux = sh.vx / len;
      const uy = sh.vy / len;
      const sDir = angleToDir8(Math.atan2(sh.vy, sh.vx));
      const sFrame = (animTick + i) % 2;
      const visual: EnemyShotVisual = sh.visual ?? 'SPORE';
      // 후방 1px 픽셀 잔상 도트
      const tx = Math.round(x - ux * 5);
      const ty = Math.round(y - uy * 5);
      pg.rect(tx - 1, ty - 1, 3, 3).fill({ color: OUTLINE_HEX, alpha: 0.65 });
      pg.rect(tx, ty, 1, 1).fill({ color: hexNum(sh.color), alpha: 0.9 });
      this.placeProjSprite(-(i + 1), getProjectileTexture(visual, sDir, sFrame), x, y);
    }

    for (const [id, pr] of this.projSprites) {
      if (pr.seenFrame !== this.frame) {
        pr.sprite.destroy();
        this.projSprites.delete(id);
      }
    }

    // ── 7. 다중 프레임 픽셀 전투 이펙트 (CONE, BOOM, PULSE, SLASH, BASH, CHAIN, RAIL_TRAIL, HIT_SPARK, DEFLECT, EXECUTE, REFLECT 등)
    const eg = this.fxGfx;
    eg.clear();
    this.fxSpriteCursor = 0;
    for (const f of engine.effects) {
      this.renderPixelEffect(eg, f);
    }
    for (const [id, fxSp] of this.fxSprites) {
      if (fxSp.seenFrame !== this.frame) {
        fxSp.sprite.destroy();
        this.fxSprites.delete(id);
      }
    }

    // ── 8. 픽셀 체력바 & 보호막바 (지휘관 · 부대원 · 엘리트 · 보스)
    const bg = this.barGfx;
    bg.clear();
    const bar = (
      x: number,
      y: number,
      w: number,
      ratio: number,
      color: number,
      shieldRatio = 0
    ): void => {
      const bx = Math.round(x - w / 2);
      const by = Math.round(y);
      const hasShield = shieldRatio > 0;
      const bh = hasShield ? 5 : 4;
      bg.rect(bx - 1, by - 1, w + 2, bh).fill({ color: OUTLINE_HEX });
      bg.rect(bx, by, w, 2).fill({ color: 0x161d2a });
      const fillW = Math.max(0, Math.min(w, Math.round(w * ratio)));
      if (fillW > 0) {
        bg.rect(bx, by, fillW, 2).fill({ color });
        bg.rect(bx, by, fillW, 1).fill({ color: 0xd8ffe4, alpha: 0.35 });
      }
      if (hasShield) {
        const sW = Math.max(0, Math.min(w, Math.round(w * shieldRatio)));
        bg.rect(bx, by + 2, w, 1).fill({ color: 0x102230 });
        if (sW > 0) {
          bg.rect(bx, by + 2, sW, 1).fill({ color: 0x6eeeff });
        }
      }
    };

    bar(
      camX,
      camY - 26,
      20,
      c.hp / c.maxHp,
      0x5ee37a,
      c.maxShield > 0 ? c.shield / c.maxShield : 0
    );
    for (const m of engine.squad) {
      if (m.hp < m.maxHp || (m.maxShield > 0 && m.shield < m.maxShield)) {
        bar(
          lerp(m.px, m.x),
          lerp(m.py, m.y) - 24,
          16,
          m.hp / m.maxHp,
          0x9be37a,
          m.maxShield > 0 ? m.shield / m.maxShield : 0
        );
      }
    }
    for (const e of engine.enemies) {
      if (e.isBoss) {
        bar(lerp(e.px, e.x), lerp(e.py, e.y) - 22 * e.scale - 6, 34, e.hp / e.maxHp, 0xff3858);
      } else if (e.isElite) {
        bar(lerp(e.px, e.x), lerp(e.py, e.y) - 20 * e.scale - 4, 18, e.hp / e.maxHp, 0xf05a5a);
      }
    }
  }

  /**
   * 13종 전투 이펙트를 다중 프레임 픽셀 스프라이트 시트 + 정수 격자 도트 파티클로 렌더링한다.
   */
  private renderPixelEffect(eg: Graphics, f: EffectState): void {
    const t = Math.max(0, Math.min(1, f.lifeSec / Math.max(0.001, f.maxLifeSec)));
    const p = 1 - t; // 진행률 0 -> 1
    const col = hexNum(f.color);
    const fx = Math.round(f.x);
    const fy = Math.round(f.y);

    switch (f.kind) {
      case 'CONE': {
        // 화염 방사병(FIRE) vs 소각 분대(PLASMA) vs 산성 분사체(ACID): 4프레임 볼륨 클러스터 퍼프 스프라이트
        const isAcid = f.color === '#98e030' || f.color === '#a6e22e' || f.color === '#9be04a';
        const variant: FlameVariant = f.evolved ? 'PLASMA' : isAcid ? 'ACID' : 'FIRE';
        const puffs = 9;
        for (let i = 0; i < puffs; i += 1) {
          const lane = (i / (puffs - 1)) * 2 - 1; // -1..1
          const jitter = Math.sin(i * 4.7) * 0.16;
          const ang = f.angle + (lane + jitter) * f.halfAngle * 0.9;
          const distNorm = Math.min(1, ((i % 3) / 2) * 0.58 + p * 0.52 + 0.15);
          const dist = distNorm * f.radius;
          const px = Math.round(fx + Math.cos(ang) * dist);
          const py = Math.round(fy + Math.sin(ang) * dist);
          const puffFrame = Math.min(
            FLAME_FRAME_COUNT - 1,
            Math.floor(distNorm * 2.2 + p * 1.8)
          );
          this.placeFxSprite(
            this.fxSpriteCursor++,
            getFlamePuffTexture(puffFrame, variant),
            px,
            py,
            1,
            Math.min(1, t * 1.25)
          );
        }
        // 원뿔 선단 픽셀 충격파 아크
        const frontR = Math.round(f.radius * (0.55 + p * 0.45));
        const arcCol = variant === 'PLASMA' ? 0x6eeeff : variant === 'ACID' ? 0xc8ff68 : 0xffae38;
        const arcSteps = 9;
        for (let k = 0; k <= arcSteps; k += 1) {
          const a = f.angle - f.halfAngle + (k / arcSteps) * (f.halfAngle * 2);
          const ax = Math.round(fx + Math.cos(a) * frontR);
          const ay = Math.round(fy + Math.sin(a) * frontR);
          eg.rect(ax - 1, ay - 1, 3, 3).fill({ color: OUTLINE_HEX, alpha: t * 0.65 });
          eg.rect(ax, ay, 2, 2).fill({ color: arcCol, alpha: t * 0.9 });
        }
        break;
      }

      case 'BOOM': {
        // 박격포·다연장·지뢰·자폭충 고폭 스플래시: 5프레임 28x28 볼륨 픽셀 폭발 시트 + 충격파 링
        const isAcid = f.color === '#a8e838' || f.color === '#98e030' || f.color === '#9be04a';
        const variant: ExplosionVariant = f.evolved ? 'PLASMA' : isAcid ? 'ACID' : 'STANDARD';
        const frameIdx = Math.min(
          EXPLOSION_FRAME_COUNT - 1,
          Math.floor(p * EXPLOSION_FRAME_COUNT)
        );
        const scale = Math.max(1, Math.round((f.radius / 14) * 2) / 2);
        this.placeFxSprite(
          this.fxSpriteCursor++,
          getExplosionTexture(frameIdx, variant),
          fx,
          fy,
          scale,
          Math.min(1, t * 1.35)
        );

        const ringR = Math.round(f.radius * (0.4 + p * 0.6));
        const ringCol = variant === 'PLASMA' ? 0x6eeeff : variant === 'ACID' ? 0xb8f248 : 0xff7820;
        const coreCol = variant === 'PLASMA' ? 0xffcf4a : variant === 'ACID' ? 0xf2ffa8 : 0xffe068;
        drawPixelCircle(eg, fx, fy, ringR, ringCol, t * 0.85, 2, 2);
        drawPixelCircle(eg, fx, fy, Math.round(ringR * 0.72), coreCol, t * 0.85, 1, 2);
        break;
      }

      case 'PULSE': {
        // 공명 구체 사이오닉 파동: 2중 동심 픽셀 링 + 8방향 공명 다이아몬드 노드
        const rOuter = Math.max(4, Math.round(f.radius * (0.4 + p * 0.65)));
        const rInner = Math.max(2, Math.round(rOuter * 0.62));
        drawPixelCircle(eg, fx, fy, rOuter, f.evolved ? 0xffcf4a : col, t * 0.95, 2, 2);
        drawPixelCircle(eg, fx, fy, rInner, 0xffffff, t * 0.8, 1, 2);
        for (let k = 0; k < 8; k += 1) {
          const a = (k / 8) * Math.PI * 2 + p * 0.8;
          const nx = Math.round(fx + Math.cos(a) * rOuter);
          const ny = Math.round(fy + Math.sin(a) * rOuter);
          eg.rect(nx - 1, ny - 1, 3, 3).fill({ color: OUTLINE_HEX, alpha: t * 0.75 });
          eg.rect(nx, ny, 1, 1).fill({ color: 0xffffff, alpha: t });
        }
        break;
      }

      case 'SLASH':
      case 'BASH': {
        // 근접 참격(BLADE / CLAW) 및 중장갑 방패병 강타(BASH / GOLD_BASH): 3프레임 24x24 8방향 픽셀 스프라이트
        const dir = angleToDir8(f.angle);
        const frameIdx = Math.min(SLASH_FRAME_COUNT - 1, Math.floor(p * SLASH_FRAME_COUNT));
        const variant: SlashVariant =
          f.kind === 'BASH'
            ? f.evolved
              ? 'GOLD_BASH'
              : 'BASH'
            : f.color === '#b8ee40'
              ? 'CLAW'
              : 'BLADE';
        this.placeFxSprite(
          this.fxSpriteCursor++,
          getSlashTexture(frameIdx, dir, variant),
          fx,
          fy,
          1,
          Math.min(1, t * 1.3)
        );
        // 타격 스파크 픽셀 4개
        const sparkCol = variant === 'GOLD_BASH' ? 0xffcf4a : variant === 'CLAW' ? 0xd8ff78 : 0xffffff;
        for (let k = -1; k <= 2; k += 1) {
          const spA = f.angle + k * 0.45;
          const spR = 4 + p * 7;
          const sx = Math.round(fx + Math.cos(spA) * spR);
          const sy = Math.round(fy + Math.sin(spA) * spR);
          eg.rect(sx - 1, sy - 1, 3, 3).fill({ color: OUTLINE_HEX, alpha: t * 0.7 });
          eg.rect(sx, sy, 1, 1).fill({ color: sparkCol, alpha: t });
        }
        break;
      }

      case 'HIT_SPARK':
      case 'DEFLECT':
      case 'EXECUTE':
      case 'REFLECT': {
        // 탄착 스파크 · 정면 갑각 도탄(DEFLECT) · 처형자 단두대(EXECUTE) · 성벽 반사(REFLECT) 3프레임 16x16 스프라이트
        const dir = angleToDir8(f.angle);
        const frameIdx = Math.min(HIT_SPARK_FRAME_COUNT - 1, Math.floor(p * HIT_SPARK_FRAME_COUNT));
        const variant: HitSparkVariant =
          f.kind === 'EXECUTE'
            ? 'EXECUTE'
            : f.kind === 'REFLECT'
              ? 'REFLECT'
              : f.kind === 'DEFLECT'
                ? 'DEFLECT'
                : f.evolved || f.radius >= 9
                  ? 'PIERCE'
                  : 'SPARK';
        this.placeFxSprite(
          this.fxSpriteCursor++,
          getHitSparkTexture(frameIdx, dir, variant),
          fx,
          fy,
          f.kind === 'EXECUTE' ? 1.5 : 1,
          Math.min(1, t * 1.35)
        );
        if (f.kind === 'EXECUTE') {
          drawPixelCircle(eg, fx, fy, Math.round(6 + p * 10), 0xff3858, t * 0.9, 2, 2);
          drawPixelCircle(eg, fx, fy, Math.round(4 + p * 7), 0xffcf4a, t * 0.9, 1, 2);
        } else if (f.kind === 'REFLECT') {
          drawPixelCircle(eg, fx, fy, Math.round(5 + p * 8), 0xffcf4a, t * 0.9, 2, 2);
        }
        break;
      }

      case 'RAIL_TRAIL': {
        // 저격수 / 처형자 분대 고속 관통 레일건 궤적 + 수직 소닉 쇼크 링
        const x2 = Math.round(f.x2);
        const y2 = Math.round(f.y2);
        const mainCol = f.evolved ? 0xff3858 : col;
        const subCol = f.evolved ? 0xffcf4a : 0xffffff;
        drawPixelLine(eg, fx, fy, x2, y2, OUTLINE_HEX, t * 0.85, 3, 1);
        drawPixelLine(eg, fx, fy, x2, y2, mainCol, t * 0.95, 2, 1);
        drawPixelLine(eg, fx, fy, x2, y2, subCol, t, 1, 1);

        // 궤적을 따라 퍼지는 수직 충격파 고리 3개
        const dx = x2 - fx;
        const dy = y2 - fy;
        const len = Math.hypot(dx, dy) || 1;
        const perpX = -dy / len;
        const perpY = dx / len;
        for (const u of [0.28, 0.58, 0.86]) {
          const rx = Math.round(fx + dx * u);
          const ry = Math.round(fy + dy * u);
          const span = Math.round(2 + p * (f.evolved ? 5 : 3.5));
          drawPixelLine(
            eg,
            rx - perpX * span,
            ry - perpY * span,
            rx + perpX * span,
            ry + perpY * span,
            subCol,
            t * 0.85,
            1,
            1
          );
        }
        break;
      }

      case 'HEAL': {
        // 수리 드론 나노 회복: 에메랄드/황금 픽셀 링 + 상승하는 3개의 픽셀 의무 십자(+)
        drawPixelCircle(eg, fx, fy, Math.round(6 + p * 4), f.evolved ? 0xffcf4a : 0x42e88c, t * 0.65, 1, 2);
        const offsets: readonly [number, number][] = [
          [0, -5 - p * 8],
          [-5, -2 - p * 6],
          [5, -3 - p * 7],
        ];
        for (let i = 0; i < offsets.length; i += 1) {
          const [ox, oy] = offsets[i];
          if (i === 0 || t > 0.35) {
            drawPixelCross(eg, fx + ox, fy + oy, col, 0xffffff, t);
          }
        }
        break;
      }

      case 'DEATH': {
        // 적·부대원 처치 파편 폭발: 중심 타격 플래시 + 8방향 포물선 픽셀 파편
        if (t > 0.72) {
          eg.rect(fx - 3, fy - 3, 6, 6).fill({ color: 0xffffff, alpha: t });
        }
        const grav = p * p * 5;
        for (let k = 0; k < 8; k += 1) {
          const a = (k / 8) * Math.PI * 2 + 0.4;
          const r = (0.2 + p * 0.95) * f.radius * (k % 2 === 0 ? 1.15 : 0.8);
          const dx = Math.round(fx + Math.cos(a) * r);
          const dy = Math.round(fy + Math.sin(a) * r + grav);
          const sz = k % 2 === 0 ? 2 : 1;
          eg.rect(dx - 1, dy - 1, sz + 1, sz + 1).fill({ color: OUTLINE_HEX, alpha: t * 0.85 });
          eg.rect(dx, dy, sz, sz).fill({ color: col, alpha: t });
          if (k % 3 === 0) {
            eg.rect(dx, dy, 1, 1).fill({ color: 0xffe8a0, alpha: t });
          }
        }
        break;
      }

      case 'CHAIN': {
        // 테슬라 / 폭풍 포대 연쇄 번개: 4분절 지그재그 Bresenham 픽셀 아크 + 분기 스파크 + 타격 십자
        const x2 = Math.round(f.x2);
        const y2 = Math.round(f.y2);
        const dx = x2 - fx;
        const dy = y2 - fy;
        const len = Math.hypot(dx, dy) || 1;
        const perpX = -dy / len;
        const perpY = dx / len;
        const seed = Math.floor(f.lifeSec * 60) + fx * 7 + fy * 13;
        const j1 = ((seed & 1) === 0 ? 1 : -1) * 3.5;
        const j2 = (((seed >> 1) & 1) === 0 ? -1 : 1) * 4.2;
        const j3 = (((seed >> 2) & 1) === 0 ? 1 : -1) * 2.8;

        const pts: ReadonlyArray<readonly [number, number]> = [
          [fx, fy],
          [Math.round(fx + dx * 0.25 + perpX * j1), Math.round(fy + dy * 0.25 + perpY * j1)],
          [Math.round(fx + dx * 0.52 + perpX * j2), Math.round(fy + dy * 0.52 + perpY * j2)],
          [Math.round(fx + dx * 0.78 + perpX * j3), Math.round(fy + dy * 0.78 + perpY * j3)],
          [x2, y2],
        ];
        const glowCol = f.evolved ? 0xc070ff : col;
        const coreCol = f.evolved ? 0x6eeeff : 0xffffff;

        for (let i = 0; i < pts.length - 1; i += 1) {
          const [ax, ay] = pts[i];
          const [bx, by] = pts[i + 1];
          drawPixelLine(eg, ax, ay, bx, by, OUTLINE_HEX, t * 0.85, 3, 1);
        }
        for (let i = 0; i < pts.length - 1; i += 1) {
          const [ax, ay] = pts[i];
          const [bx, by] = pts[i + 1];
          drawPixelLine(eg, ax, ay, bx, by, glowCol, t * 0.95, 2, 1);
          drawPixelLine(eg, ax, ay, bx, by, coreCol, t, 1, 1);
        }
        // 중간 노드 곁가지 방전 아크
        const [mx, my] = pts[2];
        const forkX = Math.round(mx + dx * 0.16 - perpX * j2 * 1.4);
        const forkY = Math.round(my + dy * 0.16 - perpY * j2 * 1.4);
        drawPixelLine(eg, mx, my, forkX, forkY, glowCol, t * 0.85, 1, 1);
        drawPixelCross(eg, x2, y2, glowCol, 0xffffff, t);
        break;
      }

      case 'EVOLVE':
        drawPixelCircle(eg, fx, fy, Math.round(f.radius * (1.4 - t)), col, t, 2, 2);
        eg.rect(fx - 1, Math.round(fy - 14 * p - 6), 2, 6).fill({ color: 0xffffff, alpha: t });
        break;

      case 'TELE_LINE': {
        // 돌진충·보스 돌진 픽셀 경고 레일: 양측 점선 경계선 + 전진하는 픽셀 셰브론 화살표
        const x2 = Math.round(f.x2);
        const y2 = Math.round(f.y2);
        const dx = x2 - fx;
        const dy = y2 - fy;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const perpX = -uy;
        const perpY = ux;
        const pulseA = (Math.round(this.timeSec * 10) % 2 === 0 ? 0.85 : 0.45) * (0.4 + 0.6 * p);
        for (const side of [-1, 1]) {
          drawPixelLine(
            eg,
            fx + perpX * side * 5,
            fy + perpY * side * 5,
            x2 + perpX * side * 5,
            y2 + perpY * side * 5,
            col,
            pulseA,
            1,
            3
          );
        }
        drawPixelLine(eg, fx, fy, x2, y2, col, pulseA * 0.8, 2, 4);
        // 돌진 방향 픽셀 셰브론 3개
        for (const u of [0.3, 0.6, 0.88]) {
          const cx2 = Math.round(fx + dx * u);
          const cy2 = Math.round(fy + dy * u);
          drawPixelLine(eg, cx2 - ux * 4 + perpX * 4, cy2 - uy * 4 + perpY * 4, cx2, cy2, 0xffffff, pulseA, 1, 1);
          drawPixelLine(eg, cx2 - ux * 4 - perpX * 4, cy2 - uy * 4 - perpY * 4, cx2, cy2, 0xffffff, pulseA, 1, 1);
        }
        break;
      }

      case 'TELE_CIRCLE': {
        const pulseA = Math.round(this.timeSec * 10) % 2 === 0 ? 0.9 : 0.45;
        drawPixelCircle(eg, fx, fy, Math.round(f.radius), col, pulseA, 1, 2);
        drawPixelDisc(eg, fx, fy, Math.max(2, Math.round(f.radius * p)), col, 0.22, 2, true);
        drawPixelCross(eg, fx, fy, col, 0xffffff, pulseA * 0.85);
        break;
      }

      case 'SHIELD_PULSE':
        drawPixelCircle(eg, fx, fy, Math.round(f.radius * (1 - t * 0.8)), col, t, 2, 2);
        break;

      case 'LEVEL': {
        // 레벨업 팡파르: 수직 황금 픽셀 빛기둥 + 8방위 확장 픽셀 스타 링
        const ringR = Math.round(f.radius * (0.25 + p * 0.85));
        if (t > 0.35) {
          const beamW = Math.max(2, Math.round(8 * t));
          eg.rect(Math.round(fx - beamW / 2), fy - 28, beamW, 30).fill({
            color: col,
            alpha: t * 0.35,
          });
          eg.rect(fx - 1, fy - 28, 2, 30).fill({ color: 0xffffff, alpha: t * 0.7 });
        }
        drawPixelCircle(eg, fx, fy, ringR, col, t * 0.9, 2, 2);
        for (let k = 0; k < 8; k += 1) {
          const a = (k / 8) * Math.PI * 2 + p * 0.6;
          const sx = Math.round(fx + Math.cos(a) * ringR);
          const sy = Math.round(fy + Math.sin(a) * ringR);
          drawPixelCross(eg, sx, sy, col, 0xffffff, t);
        }
        break;
      }
    }
  }

  private placeGemSprite(id: number, tex: Texture, x: number, y: number): void {
    let p = this.gemSprites.get(id);
    if (!p) {
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 0.5);
      this.gemLayer.addChild(sprite);
      p = { sprite, seenFrame: this.frame };
      this.gemSprites.set(id, p);
    }
    p.seenFrame = this.frame;
    const s = p.sprite;
    if (s.texture !== tex) {
      s.texture = tex;
    }
    s.position.set(x, y);
  }

  private placeProjSprite(id: number, tex: Texture, x: number, y: number): void {
    let p = this.projSprites.get(id);
    if (!p) {
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 0.5);
      this.projLayer.addChild(sprite);
      p = { sprite, seenFrame: this.frame };
      this.projSprites.set(id, p);
    }
    p.seenFrame = this.frame;
    const s = p.sprite;
    if (s.texture !== tex) {
      s.texture = tex;
    }
    s.position.set(x, y);
  }

  private placeFxSprite(
    slot: number,
    tex: Texture,
    x: number,
    y: number,
    scale: number,
    alpha: number
  ): void {
    let p = this.fxSprites.get(slot);
    if (!p) {
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 0.5);
      this.fxLayer.addChild(sprite);
      p = { sprite, seenFrame: this.frame };
      this.fxSprites.set(slot, p);
    }
    p.seenFrame = this.frame;
    const s = p.sprite;
    if (s.texture !== tex) {
      s.texture = tex;
    }
    s.position.set(x, y);
    s.scale.set(scale, scale);
    s.alpha = alpha;
  }

  private placeSprite(
    id: number,
    tex: Texture,
    x: number,
    y: number,
    scale: number,
    tint: number,
    anchorY: number = BODY_ANCHOR_Y
  ): void {
    let p = this.sprites.get(id);
    if (!p) {
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, anchorY);
      this.unitLayer.addChild(sprite);
      p = { sprite, seenFrame: this.frame };
      this.sprites.set(id, p);
    }
    p.seenFrame = this.frame;
    const s = p.sprite;
    if (s.texture !== tex) {
      s.texture = tex;
    }
    s.anchor.set(0.5, anchorY);
    s.position.set(Math.round(x), Math.round(y));
    s.scale.set(scale, scale);
    s.tint = tint;
    s.zIndex = Math.round(y);
  }

  /** 48x48 확장 이펙트 레이어: 32x32 몸 스프라이트와 동일한 월드 피벗 좌표에 정밀 정렬해 덧그린다 */
  private placeFx(id: number, tex: Texture | null, x: number, y: number, scale: number): void {
    if (!tex) {
      return;
    }
    const fxId = -(id + 1);
    this.placeSprite(fxId, tex, x, y, scale, 0xffffff, FX_ANCHOR_Y);
    const p = this.sprites.get(fxId);
    if (p) {
      p.sprite.zIndex = Math.round(y) + 1;
    }
  }
}
