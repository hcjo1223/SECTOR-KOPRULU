import { describe, expect, it } from 'vitest';
import {
  ALL_DIRS_8,
  angleToDir8,
  EXPLOSION_FRAME_COUNT,
  FLAME_FRAME_COUNT,
  getAllArchetypes,
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
  SPRITE_FX_SIZE,
  SPRITE_SIZE,
} from '../SurvivorSprites';

describe('SurvivorSprites', () => {
  const ironcladPalette = { primary: '#4f7fb8', secondary: '#2d4a6e', accent: '#f2c14e' };
  const evolvedPalette = { primary: '#5a8fd4', secondary: '#34588a', accent: '#ffcf4a' };
  const hivePalette = { primary: '#8f4fa8', secondary: '#4e2a5e', accent: '#b8e04a' };
  const lumenPalette = { primary: '#e0c060', secondary: '#7a5a20', accent: '#5fd8f0' };

  it('every archetype renders a 32x32 studio cluster-shaded pixel sprite with dark outline and animation frames', () => {
    for (const a of getAllArchetypes()) {
      const buf0 = renderSpritePixels(a, ironcladPalette, 0, 'S', 'IDLE');
      const buf1 = renderSpritePixels(a, ironcladPalette, 1, 'S', 'IDLE');
      const bufAtk = renderSpritePixels(a, ironcladPalette, 0, 'SE', 'ATTACK');
      expect(buf0.width).toBe(32);
      expect(buf0.width).toBe(SPRITE_SIZE);
      expect(buf0.height).toBe(SPRITE_SIZE);

      let opaque = 0;
      let outline = 0;
      const colorSet = new Set<string>();
      let diffIdle = 0;
      let diffAtk = 0;

      for (let i = 0; i < buf0.data.length; i += 4) {
        if (buf0.data[i + 3] > 0) {
          opaque += 1;
          const r = buf0.data[i];
          const g = buf0.data[i + 1];
          const b = buf0.data[i + 2];
          colorSet.add(`${r},${g},${b}`);
          if (r === OUTLINE_RGB[0] && g === OUTLINE_RGB[1] && b === OUTLINE_RGB[2]) {
            outline += 1;
          }
        }
        if (
          buf0.data[i] !== buf1.data[i] ||
          buf0.data[i + 1] !== buf1.data[i + 1] ||
          buf0.data[i + 2] !== buf1.data[i + 2] ||
          buf0.data[i + 3] !== buf1.data[i + 3]
        ) {
          diffIdle += 1;
        }
        if (
          buf0.data[i] !== bufAtk.data[i] ||
          buf0.data[i + 1] !== bufAtk.data[i + 1] ||
          buf0.data[i + 2] !== bufAtk.data[i + 2] ||
          buf0.data[i + 3] !== bufAtk.data[i + 3]
        ) {
          diffAtk += 1;
        }
      }

      expect(opaque).toBeGreaterThan(220);
      expect(outline).toBeGreaterThan(60);
      expect(colorSet.size).toBeGreaterThanOrEqual(12);
      expect(diffIdle).toBeGreaterThan(0);
      expect(diffAtk).toBeGreaterThan(20);
    }
  });

  it('M5.1/M6 new archetypes use dedicated 32x32 drawings, not 2x-upscaled 12x12 blocks', () => {
    const fresh = ['SNIPER', 'SHIELDER', 'SAPPER', 'TESLA', 'CHARGER', 'SPORER', 'SPLITTER', 'BOMBER', 'SHELL', 'NEST', 'QUEEN', 'SPIRE'] as const;
    for (const a of fresh) {
      const buf = renderSpritePixels(a, ironcladPalette, 0, 'S', 'IDLE');
      // 2배 업스케일이면 모든 2x2 블록이 단색이다 — 전용 드로잉은 1px 디테일이 블록을 깨뜨린다
      let brokenBlocks = 0;
      for (let y = 0; y < 32; y += 2) {
        for (let x = 0; x < 32; x += 2) {
          const at = (xx: number, yy: number): string => {
            const i = (yy * 32 + xx) * 4;
            return buf.data.slice(i, i + 4).join(',');
          };
          const c0 = at(x, y);
          if (at(x + 1, y) !== c0 || at(x, y + 1) !== c0 || at(x + 1, y + 1) !== c0) brokenBlocks += 1;
        }
      }
      expect(brokenBlocks, a).toBeGreaterThan(60);
      const views = new Set(ALL_DIRS_8.map((d) => renderSpritePixels(a, ironcladPalette, 0, d, 'IDLE').data.join(',')));
      if (a !== 'NEST' && a !== 'SPIRE') {
        expect(views.size, a).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('quantizes 360-degree angles into 8 directions and renders distinct 8-way turntable views and 4-frame WALK cycle', () => {
    expect(angleToDir8(0)).toBe('E');
    expect(angleToDir8(Math.PI / 4)).toBe('SE');
    expect(angleToDir8(Math.PI / 2)).toBe('S');
    expect(angleToDir8((3 * Math.PI) / 4)).toBe('SW');
    expect(angleToDir8(Math.PI)).toBe('W');
    expect(angleToDir8((-3 * Math.PI) / 4)).toBe('NW');
    expect(angleToDir8(-Math.PI / 2)).toBe('N');
    expect(angleToDir8(-Math.PI / 4)).toBe('NE');

    // 8방향 전체에서 IDLE, WALK(4프레임), ATTACK(2프레임) 렌더링 검증
    for (const dir of ALL_DIRS_8) {
      const idle = renderSpritePixels('SOLDIER', ironcladPalette, 0, dir, 'IDLE');
      const walk0 = renderSpritePixels('SOLDIER', ironcladPalette, 0, dir, 'WALK');
      const walk2 = renderSpritePixels('SOLDIER', ironcladPalette, 2, dir, 'WALK');
      const atk0 = renderSpritePixels('SOLDIER', ironcladPalette, 0, dir, 'ATTACK');
      const atk1 = renderSpritePixels('SOLDIER', ironcladPalette, 1, dir, 'ATTACK');
      expect(idle.data.some((v, idx) => idx % 4 === 3 && v > 0)).toBe(true);
      expect(walk0.data.some((v, idx) => v !== walk2.data[idx])).toBe(true);
      expect(atk0.data.some((v, idx) => v !== atk1.data[idx])).toBe(true);
    }

    // IMG_2485.png / IMG_2486.png 기반 8방향(S, SE, E, NE, N, NW, W, SW) 각 뷰가 모두 고유한 32x32 픽셀 데이터를 가져야 한다
    const dirHashes = new Set<string>();
    for (const dir of ALL_DIRS_8) {
      const view = renderSpritePixels('SOLDIER', ironcladPalette, 0, dir, 'IDLE');
      dirHashes.add(Array.from(view.data.slice(0, 1024)).join(','));
    }
    expect(dirHashes.size).toBe(8);
  });

  it('renders 48x48 detached attack FX across all 30 archetypes and all 8 directions (including NW) with distinct windup/blast/recoil stages', () => {
    for (const dir of ALL_DIRS_8) {
      const fx0 = renderSpriteFxPixels('SOLDIER', ironcladPalette, 0, dir, 'ATTACK');
      const fx1 = renderSpriteFxPixels('SOLDIER', ironcladPalette, 1, dir, 'ATTACK');
      const fx2 = renderSpriteFxPixels('SOLDIER', ironcladPalette, 2, dir, 'ATTACK');
      expect(fx0, `SOLDIER ATTACK 0 ${dir}`).not.toBeNull();
      expect(fx1, `SOLDIER ATTACK 1 ${dir}`).not.toBeNull();
      expect(fx2, `SOLDIER ATTACK 2 ${dir}`).not.toBeNull();
      expect(fx1!.width).toBe(SPRITE_FX_SIZE);
      expect(fx1!.height).toBe(SPRITE_FX_SIZE);
      // ATTACK 0(차징) vs ATTACK 1(총구 화염) vs ATTACK 2(연기·탄피)가 서로 달라야 한다
      expect(fx0!.data.some((v, idx) => v !== fx1!.data[idx])).toBe(true);
      expect(fx1!.data.some((v, idx) => v !== fx2!.data[idx])).toBe(true);
    }

    for (const a of getAllArchetypes()) {
      const fx1 = renderSpriteFxPixels(a, ironcladPalette, 1, 'SE', 'ATTACK');
      const fx2 = renderSpriteFxPixels(a, ironcladPalette, 2, 'SE', 'ATTACK');
      expect(fx1, `${a} ATTACK 1 FX`).not.toBeNull();
      expect(fx2, `${a} ATTACK 2 FX`).not.toBeNull();
      expect(fx1!.width).toBe(48);
      expect(fx1!.height).toBe(48);

      let hasOutline = false;
      for (let i = 0; i < fx1!.data.length; i += 4) {
        const alpha = fx1!.data[i + 3];
        expect(alpha === 0 || alpha === 255).toBe(true);
        if (
          alpha === 255 &&
          fx1!.data[i] === OUTLINE_RGB[0] &&
          fx1!.data[i + 1] === OUTLINE_RGB[1] &&
          fx1!.data[i + 2] === OUTLINE_RGB[2]
        ) {
          hasOutline = true;
        }
      }
      expect(hasOutline, `${a} FX has 1px dark outline`).toBe(true);
    }

    // 진화 팔레트(#ffcf4a) 적용 시 FLAMER / TESLA / SNIPER / SHIELDER 이펙트 색상이 진화 테마로 바뀌어야 한다
    for (const a of ['FLAMER', 'TESLA', 'SNIPER', 'SHIELDER', 'SOLDIER'] as const) {
      const baseFx = renderSpriteFxPixels(a, ironcladPalette, 1, 'E', 'ATTACK')!;
      const evoFx = renderSpriteFxPixels(a, evolvedPalette, 1, 'E', 'ATTACK')!;
      expect(baseFx.data.some((v, idx) => v !== evoFx.data[idx]), `${a} evolved FX differs`).toBe(true);
    }
  });

  it('renders multi-frame world combat effect and projectile pixel art sprites with binary alpha and 1px outline', () => {
    const checkPixelSprite = (buf: { width: number; height: number; data: Uint8ClampedArray }, label: string): void => {
      let opaque = 0;
      let outline = 0;
      for (let i = 0; i < buf.data.length; i += 4) {
        const a = buf.data[i + 3];
        expect(a === 0 || a === 255, label).toBe(true);
        if (a === 255) {
          opaque += 1;
          if (
            buf.data[i] === OUTLINE_RGB[0] &&
            buf.data[i + 1] === OUTLINE_RGB[1] &&
            buf.data[i + 2] === OUTLINE_RGB[2]
          ) {
            outline += 1;
          }
        }
      }
      expect(opaque, `${label} opaque`).toBeGreaterThan(8);
      expect(outline, `${label} outline`).toBeGreaterThan(4);
    };

    for (const variant of ['STANDARD', 'PLASMA', 'ACID'] as const) {
      const frames = Array.from({ length: EXPLOSION_FRAME_COUNT }, (_, f) => renderExplosionFramePixels(f, variant));
      frames.forEach((b, f) => checkPixelSprite(b, `BOOM ${variant} ${f}`));
      expect(frames[0].data.some((v, i) => v !== frames[2].data[i])).toBe(true);
    }

    for (const variant of ['BLADE', 'BASH', 'GOLD_BASH', 'CLAW'] as const) {
      for (let f = 0; f < SLASH_FRAME_COUNT; f += 1) {
        checkPixelSprite(renderSlashFramePixels(f, 'SE', variant), `SLASH ${variant} ${f}`);
      }
    }

    for (const variant of ['FIRE', 'PLASMA', 'ACID'] as const) {
      for (let f = 0; f < FLAME_FRAME_COUNT; f += 1) {
        checkPixelSprite(renderFlamePuffPixels(f, variant), `FLAME ${variant} ${f}`);
      }
    }

    for (const variant of ['SPARK', 'PIERCE', 'DEFLECT', 'EXECUTE', 'REFLECT'] as const) {
      for (let f = 0; f < HIT_SPARK_FRAME_COUNT; f += 1) {
        checkPixelSprite(renderHitSparkPixels(f, 'E', variant), `SPARK ${variant} ${f}`);
      }
    }

    for (const visual of ['RIFLE', 'GATLING', 'SNIPER', 'EXECUTIONER', 'MORTAR', 'MLRS', 'SPORE', 'SPIKE', 'PRISM', 'ROYAL'] as const) {
      for (const dir of ALL_DIRS_8) {
        checkPixelSprite(renderProjectilePixels(visual, dir, 0), `PROJ ${visual} ${dir}`);
      }
    }
  });

  it('renders distinct commander designs for the Nova player and the hive / lumen enemy commanders', () => {
    const ic = renderSpritePixels('COMMANDER', ironcladPalette, 0);
    const hv = renderSpritePixels('COMMANDER', hivePalette, 0);
    const lm = renderSpritePixels('COMMANDER', lumenPalette, 0);

    const mask = (d: Uint8ClampedArray): string => {
      let s = '';
      for (let i = 3; i < d.length; i += 4) {
        s += d[i] > 0 ? '1' : '0';
      }
      return s;
    };
    expect(mask(ic.data)).not.toBe(mask(hv.data));
    expect(mask(ic.data)).not.toBe(mask(lm.data));
    expect(mask(hv.data)).not.toBe(mask(lm.data));
  });

  it('renders pixel XP gems and ground tiles cleanly', () => {
    for (const tier of [1, 2, 3] as const) {
      const g0 = renderGemPixels(tier, 0);
      const g1 = renderGemPixels(tier, 1);
      expect(g0.width).toBe(11);
      expect(g0.data.some((v, idx) => idx % 4 === 3 && v > 0)).toBe(true);
      expect(g0.data.some((v, idx) => v !== g1.data[idx])).toBe(true);
    }

    const ground = renderGroundTilePixels();
    expect(ground.width).toBe(64);
    expect(ground.height).toBe(64);
    expect(ground.data[3]).toBe(255);
  });
});
