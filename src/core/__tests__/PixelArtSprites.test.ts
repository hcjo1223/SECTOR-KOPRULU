import { describe, expect, it } from 'vitest';
import { getAllUnits } from '../../domain/UnitCatalog';
import {
  renderTerrainTileBuffer,
  renderUnitPixelBuffer,
} from '../PixelArtSprites';

describe('PixelArtSprites (High-Detail Volumetric Dithered 18 StarCraft Units)', () => {
  it('renders rich multi-stop dithered pixel art with ambient occlusion and 1px outline for all 18 units', () => {
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

      // Every unit must have rich color depth (12+ distinct shaded/dithered colors), 1px outline, and frame animation
      expect(opaqueCount).toBeGreaterThan(80);
      expect(outlineCount).toBeGreaterThan(30);
      expect(colorSet.size).toBeGreaterThanOrEqual(12);
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

  it('renders 32x32 detailed pixel terrain tiles for all races and zones', () => {
    const tTile = renderTerrainTileBuffer('ALLY', 'TERRAN', 0);
    const zTile = renderTerrainTileBuffer('ALLY', 'ZERG', 0);
    const pTile = renderTerrainTileBuffer('ALLY', 'PROTOSS', 0);
    const cTile = renderTerrainTileBuffer('CENTER', 'TERRAN', 0);
    const eTile = renderTerrainTileBuffer('ENEMY', 'TERRAN', 0);

    for (const tile of [tTile, zTile, pTile, cTile, eTile]) {
      expect(tile.width).toBe(32);
      expect(tile.height).toBe(32);
      expect(tile.isOpaque(16, 16)).toBe(true);
    }
  });
});
