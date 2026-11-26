import { describe, expect, it } from 'vitest';
import { getAllUnits } from '../../domain/UnitCatalog';
import { renderUnitPixelBuffer } from '../PixelArtSprites';

describe('PixelArtSprites (18 StarCraft Units)', () => {
  it('renders crisp non-empty pixel art buffers with 1px dark outline and 2-frame animation for all 18 units', () => {
    const units = getAllUnits();
    expect(units).toHaveLength(18);

    for (const unit of units) {
      const f0 = renderUnitPixelBuffer(unit, 1, 0);
      const f1 = renderUnitPixelBuffer(unit, 1, 1);
      const flipped = renderUnitPixelBuffer(unit, -1, 0);

      expect(f0.width).toBe(unit.visual.sprite_size);
      expect(f0.height).toBe(unit.visual.sprite_size);

      let opaqueCount = 0;
      let outlineCount = 0;
      let diffBetweenFrames = 0;
      const colorSet = new Set<string>();

      for (let i = 0; i < f0.data.length; i += 4) {
        const a0 = f0.data[i + 3];
        if (a0 > 0) {
          opaqueCount += 1;
          const r = f0.data[i];
          const g = f0.data[i + 1];
          const b = f0.data[i + 2];
          colorSet.add(`${r},${g},${b}`);
          if (r === 7 && g === 10 && b === 16) {
            outlineCount += 1;
          }
        }
        if (
          f0.data[i] !== f1.data[i] ||
          f0.data[i + 1] !== f1.data[i + 1] ||
          f0.data[i + 2] !== f1.data[i + 2] ||
          f0.data[i + 3] !== f1.data[i + 3]
        ) {
          diffBetweenFrames += 1;
        }
      }

      expect(opaqueCount).toBeGreaterThan(80);
      expect(outlineCount).toBeGreaterThan(30);
      expect(colorSet.size).toBeGreaterThanOrEqual(5);
      expect(diffBetweenFrames).toBeGreaterThan(0);

      let flippedOpaqueCount = 0;
      for (let i = 0; i < flipped.data.length; i += 4) {
        if (flipped.data[i + 3] > 0) {
          flippedOpaqueCount += 1;
        }
      }
      expect(flippedOpaqueCount).toBe(opaqueCount);
    }
  });
});
