import { describe, expect, it } from 'vitest';
import {
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

  it('every archetype renders an 18x18 multi-shaded pixel sprite with dark outline and 2-frame animation', () => {
    for (const a of getAllArchetypes()) {
      const buf0 = renderSpritePixels(a, ironcladPalette, 0);
      const buf1 = renderSpritePixels(a, ironcladPalette, 1);
      expect(buf0.width).toBe(SPRITE_SIZE);
      expect(buf0.height).toBe(SPRITE_SIZE);

      let opaque = 0;
      let outline = 0;
      const colorSet = new Set<string>();
      let diffPixels = 0;

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
          diffPixels += 1;
        }
      }

      expect(opaque).toBeGreaterThan(45);
      expect(outline).toBeGreaterThan(16);
      expect(colorSet.size).toBeGreaterThanOrEqual(6);
      expect(diffPixels).toBeGreaterThan(0);
    }
  });

  it('renders distinct faction commander pixel designs for IRONCLAD, HIVE, and LUMEN', () => {
    const ic = renderSpritePixels('COMMANDER', ironcladPalette, 0);
    const hv = renderSpritePixels('COMMANDER', hivePalette, 0);
    const lm = renderSpritePixels('COMMANDER', lumenPalette, 0);

    // 각 진영 지휘관의 불투명 실루엣 마스크가 서로 달라야 한다
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
