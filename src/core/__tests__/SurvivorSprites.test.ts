import { describe, expect, it } from 'vitest';
import {
  ALL_DIRS_8,
  angleToDir8,
  getAllArchetypes,
  OUTLINE_RGB,
  renderGemPixels,
  renderGroundTilePixels,
  renderSlimeTilePixels,
  renderSpritePixels,
  SPRITE_SIZE,
} from '../SurvivorSprites';

describe('SurvivorSprites', () => {
  const ironcladPalette = { primary: '#4f7fb8', secondary: '#2d4a6e', accent: '#f2c14e' };
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

    // 정면(S), 측면(E), 후면(N) 실루엣이 서로 다르고, 좌측면(W)은 우측면(E)의 정확한 좌우 대칭이어야 한다
    const sView = renderSpritePixels('SOLDIER', ironcladPalette, 0, 'S', 'IDLE');
    const eView = renderSpritePixels('SOLDIER', ironcladPalette, 0, 'E', 'IDLE');
    const wView = renderSpritePixels('SOLDIER', ironcladPalette, 0, 'W', 'IDLE');
    const nView = renderSpritePixels('SOLDIER', ironcladPalette, 0, 'N', 'IDLE');

    expect(sView.data.some((v, idx) => v !== eView.data[idx])).toBe(true);
    expect(sView.data.some((v, idx) => v !== nView.data[idx])).toBe(true);
    for (let y = 0; y < SPRITE_SIZE; y += 1) {
      for (let x = 0; x < SPRITE_SIZE; x += 1) {
        const ei = (y * SPRITE_SIZE + x) * 4;
        const wi = (y * SPRITE_SIZE + (SPRITE_SIZE - 1 - x)) * 4;
        expect(wView.data[wi]).toBe(eView.data[ei]);
        expect(wView.data[wi + 3]).toBe(eView.data[ei + 3]);
      }
    }
  });

  it('renders distinct faction commander pixel designs for IRONCLAD, HIVE, and LUMEN', () => {
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

  it('renders pixel XP gems, slime decals, and ground tiles cleanly', () => {
    for (const tier of [1, 2, 3] as const) {
      const g0 = renderGemPixels(tier, 0);
      const g1 = renderGemPixels(tier, 1);
      expect(g0.width).toBe(11);
      expect(g0.data.some((v, idx) => idx % 4 === 3 && v > 0)).toBe(true);
      expect(g0.data.some((v, idx) => v !== g1.data[idx])).toBe(true);
    }

    const slime0 = renderSlimeTilePixels(hivePalette, 0);
    const slime1 = renderSlimeTilePixels(hivePalette, 1);
    expect(slime0.width).toBe(28);
    expect(slime0.data.some((v, idx) => idx % 4 === 3 && v > 0)).toBe(true);
    expect(slime0.data.some((v, idx) => v !== slime1.data[idx])).toBe(true);

    const ground = renderGroundTilePixels();
    expect(ground.width).toBe(64);
    expect(ground.height).toBe(64);
    expect(ground.data[3]).toBe(255);
  });
});
