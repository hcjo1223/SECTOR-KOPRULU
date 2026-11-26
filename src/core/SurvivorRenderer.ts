import { CanvasSource, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import type { SurvivorEngine } from '../domain/survivor/SurvivorEngine';
import type { FactionPalette, SpriteArchetype } from '../domain/survivor/types';
import { renderSpritePixels } from './SurvivorSprites';

export const VIRTUAL_WIDTH = 640;
export const VIRTUAL_HEIGHT = 360;

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

export function getSpriteTexture(archetype: SpriteArchetype, palette: FactionPalette): Texture {
  const key = `${archetype}|${palette.primary}|${palette.secondary}|${palette.accent}`;
  const hit = textureCache.get(key);
  if (hit) {
    return hit;
  }
  const source = new CanvasSource({ resource: pixelsToCanvas(renderSpritePixels(archetype, palette)), scaleMode: 'nearest' });
  const tex = new Texture({ source });
  textureCache.set(key, tex);
  return tex;
}

export function getSpriteDataUrl(archetype: SpriteArchetype, palette: FactionPalette): string {
  return pixelsToCanvas(renderSpritePixels(archetype, palette)).toDataURL();
}

function buildGroundTexture(): Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#11161f';
    ctx.fillRect(0, 0, size, size);
    // 결정적 잡티 패턴
    let s = 1337;
    const rnd = (): number => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    for (let i = 0; i < 70; i += 1) {
      const x = Math.floor(rnd() * size);
      const y = Math.floor(rnd() * size);
      ctx.fillStyle = rnd() < 0.5 ? '#161c27' : '#0d1118';
      ctx.fillRect(x, y, 1 + Math.floor(rnd() * 2), 1);
    }
    for (let i = 0; i < 6; i += 1) {
      ctx.fillStyle = '#1b2230';
      ctx.fillRect(Math.floor(rnd() * size), Math.floor(rnd() * size), 2, 2);
    }
    ctx.fillStyle = '#141a24';
    ctx.fillRect(0, 0, size, 1);
    ctx.fillRect(0, 0, 1, size);
  }
  return new Texture({ source: new CanvasSource({ resource: canvas, scaleMode: 'nearest' }) });
}

function hexNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

interface PooledSprite {
  sprite: Sprite;
  seenFrame: number;
}

/**
 * SurvivorEngine의 논리 상태를 읽어 그리기만 하는 렌더러.
 * - 지휘관 추종 카메라 + 무한 타일 지면
 * - 직전 틱 ↔ 현재 틱 좌표 보간(alpha)
 * - 엔티티 id 기반 스프라이트 풀
 */
export class SurvivorRenderer {
  public readonly root = new Container();
  private readonly ground: TilingSprite;
  private readonly world = new Container();
  private readonly groundFx = new Graphics();
  private readonly gemGfx = new Graphics();
  private readonly unitLayer = new Container();
  private readonly projGfx = new Graphics();
  private readonly fxGfx = new Graphics();
  private readonly barGfx = new Graphics();
  private readonly sprites = new Map<number, PooledSprite>();
  private frame = 0;
  private timeSec = 0;
  private viewW = VIRTUAL_WIDTH;
  private viewH = VIRTUAL_HEIGHT;

  constructor() {
    this.ground = new TilingSprite({ texture: buildGroundTexture(), width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT });
    this.unitLayer.sortableChildren = true;
    this.world.addChild(this.groundFx, this.gemGfx, this.unitLayer, this.projGfx, this.fxGfx, this.barGfx);
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
    this.groundFx.clear();
    this.gemGfx.clear();
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

    // ── 지면 이펙트: 점액, 포진 링, 지휘관 방향 표시
    const gf = this.groundFx;
    gf.clear();
    for (const s of engine.slime) {
      const a = Math.min(1, s.lifeSec / 1.2) * 0.35;
      gf.circle(Math.round(s.x), Math.round(s.y), 14).fill({ color: hexNum(palette.accent), alpha: a * 0.6 });
    }
    if (engine.isEntrenched) {
      const pulse = 0.25 + 0.1 * Math.sin(this.timeSec * 6);
      gf.circle(Math.round(camX), Math.round(camY), 20 * engine.rings + 10).stroke({ width: 1, color: hexNum(palette.accent), alpha: pulse });
    }
    // 바라보는 방향 화살표 (지휘관 방향형 부대원의 조준선)
    const fx = c.dirX;
    const fy = c.dirY;
    const tipX = camX + fx * 22;
    const tipY = camY + fy * 22;
    gf.moveTo(camX + fx * 12, camY + fy * 12).lineTo(tipX, tipY).stroke({ width: 1, color: 0xf2e27a, alpha: 0.7 });
    gf.moveTo(tipX, tipY)
      .lineTo(tipX - fx * 4 - fy * 3, tipY - fy * 4 + fx * 3)
      .lineTo(tipX - fx * 4 + fy * 3, tipY - fy * 4 - fx * 3)
      .closePath()
      .fill({ color: 0xf2e27a, alpha: 0.8 });

    // ── 경험치 결정
    const gg = this.gemGfx;
    gg.clear();
    for (const g of engine.gems) {
      const big = g.value >= 8;
      const x = Math.round(g.x);
      const y = Math.round(g.y);
      const s = big ? 3 : 2;
      gg.poly([x, y - s, x + s, y, x, y + s, x - s, y]).fill({ color: big ? 0xf2a65a : 0x5fd8f0 });
    }

    // ── 유닛 스프라이트
    const bob = Math.sin(this.timeSec * 8) > 0 ? 1 : 0;
    this.placeSprite(c.id, getSpriteTexture(c.def.sprite, palette), lerp(c.px, c.x), lerp(c.py, c.y), c.facingX, 1, bob, c.sinceHitSec < 0.12 ? 0xff7070 : 0xffffff);
    for (const m of engine.squad) {
      const tint = m.sinceHitSec < 0.1 ? 0xff7070 : 0xffffff;
      this.placeSprite(m.id, getSpriteTexture(m.def.sprite, palette), lerp(m.px, m.x), lerp(m.py, m.y), m.facingX, 1, m.attackFlashSec > 0 ? 0 : bob, tint);
    }
    for (const e of engine.enemies) {
      const tint = e.hitFlashSec > 0 ? 0xff9090 : e.isElite ? 0xffe0a0 : 0xffffff;
      this.placeSprite(e.id, getSpriteTexture(e.def.sprite, e.def.palette), lerp(e.px, e.x), lerp(e.py, e.y), e.facingX, e.scale, 0, tint);
    }
    for (const [id, p] of this.sprites) {
      if (p.seenFrame !== this.frame) {
        p.sprite.destroy();
        this.sprites.delete(id);
      }
    }

    // ── 투사체
    const pg = this.projGfx;
    pg.clear();
    for (const p of engine.projectiles) {
      const x = lerp(p.px, p.x);
      const y = lerp(p.py, p.y);
      const col = hexNum(p.color);
      if (p.pierceLeft > 0 || p.radius >= 3) {
        const len = Math.hypot(p.vx, p.vy) || 1;
        pg.moveTo(x - (p.vx / len) * 6, y - (p.vy / len) * 6).lineTo(x, y).stroke({ width: 2, color: col });
      } else if (p.splashRadiusPx > 0) {
        pg.circle(Math.round(x), Math.round(y), 2.5).fill({ color: 0xffb347 });
      } else {
        pg.rect(Math.round(x) - 1, Math.round(y) - 1, 2, 2).fill({ color: col });
      }
    }

    // ── 이펙트
    const eg = this.fxGfx;
    eg.clear();
    for (const f of engine.effects) {
      const t = f.lifeSec / f.maxLifeSec;
      const col = hexNum(f.color);
      switch (f.kind) {
        case 'CONE': {
          eg.moveTo(f.x, f.y).arc(f.x, f.y, f.radius, f.angle - f.halfAngle, f.angle + f.halfAngle).closePath().fill({ color: col, alpha: 0.35 * t });
          break;
        }
        case 'PULSE':
          eg.circle(f.x, f.y, f.radius * (1.1 - t * 0.4)).stroke({ width: 2, color: col, alpha: t });
          break;
        case 'BOOM':
          eg.circle(f.x, f.y, f.radius * (1 - t * 0.5)).fill({ color: 0xff8c3a, alpha: 0.4 * t });
          eg.circle(f.x, f.y, f.radius * 0.5 * (1 - t * 0.5)).fill({ color: 0xffe08a, alpha: 0.6 * t });
          break;
        case 'SLASH': {
          const dx = Math.cos(f.angle + Math.PI / 2) * f.radius;
          const dy = Math.sin(f.angle + Math.PI / 2) * f.radius;
          eg.moveTo(f.x - dx, f.y - dy).lineTo(f.x + dx, f.y + dy).stroke({ width: 1.5, color: col, alpha: t });
          break;
        }
        case 'HEAL':
          eg.rect(Math.round(f.x) - 1, Math.round(f.y) - 6 - (1 - t) * 6, 2, 5).fill({ color: col, alpha: t });
          eg.rect(Math.round(f.x) - 3, Math.round(f.y) - 4 - (1 - t) * 6, 6, 1).fill({ color: col, alpha: t });
          break;
        case 'DEATH':
          for (let k = 0; k < 4; k += 1) {
            const a = (k / 4) * Math.PI * 2 + 0.6;
            const r = f.radius * (1 - t);
            eg.rect(Math.round(f.x + Math.cos(a) * r), Math.round(f.y + Math.sin(a) * r), 2, 2).fill({ color: col, alpha: t });
          }
          break;
        case 'LEVEL':
          eg.circle(f.x, f.y, f.radius * (1.2 - t)).stroke({ width: 2, color: col, alpha: t });
          break;
      }
    }

    // ── 체력바 (지휘관·부대원·엘리트·보스)
    const bg = this.barGfx;
    bg.clear();
    const bar = (x: number, y: number, w: number, ratio: number, color: number, shieldRatio = 0): void => {
      const bx = Math.round(x - w / 2);
      const by = Math.round(y);
      bg.rect(bx - 1, by - 1, w + 2, 4).fill({ color: 0x05070b });
      bg.rect(bx, by, Math.max(0, Math.round(w * ratio)), 2).fill({ color });
      if (shieldRatio > 0) {
        bg.rect(bx, by + 2, Math.max(0, Math.round(w * shieldRatio)), 1).fill({ color: 0x7fe3ff });
      }
    };
    bar(camX, camY - 11, 14, c.hp / c.maxHp, 0x5ee37a, c.maxShield > 0 ? c.shield / c.maxShield : 0);
    for (const m of engine.squad) {
      if (m.hp < m.maxHp || (m.maxShield > 0 && m.shield < m.maxShield)) {
        bar(lerp(m.px, m.x), lerp(m.py, m.y) - 9, 10, m.hp / m.maxHp, 0x9be37a, m.maxShield > 0 ? m.shield / m.maxShield : 0);
      }
    }
    for (const e of engine.enemies) {
      if (e.isElite) {
        bar(lerp(e.px, e.x), lerp(e.py, e.y) - 6 * e.scale - 4, 14, e.hp / e.maxHp, 0xf05a5a);
      }
    }
  }

  private placeSprite(
    id: number,
    tex: Texture,
    x: number,
    y: number,
    facingX: number,
    scale: number,
    bob: number,
    tint: number
  ): void {
    let p = this.sprites.get(id);
    if (!p) {
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 0.75);
      this.unitLayer.addChild(sprite);
      p = { sprite, seenFrame: this.frame };
      this.sprites.set(id, p);
    }
    p.seenFrame = this.frame;
    const s = p.sprite;
    if (s.texture !== tex) {
      s.texture = tex;
    }
    s.position.set(Math.round(x), Math.round(y) - bob);
    s.scale.set(scale * (facingX < 0 ? -1 : 1), scale);
    s.tint = tint;
    s.zIndex = Math.round(y);
  }
}
