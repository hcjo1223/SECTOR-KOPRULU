import { describe, expect, it } from 'vitest';
import {
  getGridDimensions,
  getMaxCapacity,
  getZoneAt,
  gridToLogicalCenter,
  logicalToGrid,
  moveOrSwapUnitOnGrid,
  placeUnitOnGrid,
  removeUnitFromGrid,
  resizeGridUnits,
} from '../grid/GridSystem';
import type { PlacedUnit } from '../types';

describe('GridSystem', () => {
  it('computes 8x3, 10x4, and 12x5 dimensions for 3x3, 4x4, and 5x5 grids', () => {
    expect(getGridDimensions(3)).toEqual({
      allyCols: 3,
      centerCols: 2,
      enemyCols: 3,
      totalCols: 8,
      rows: 3,
    });
    expect(getGridDimensions(4)).toEqual({
      allyCols: 4,
      centerCols: 2,
      enemyCols: 4,
      totalCols: 10,
      rows: 4,
    });
    expect(getGridDimensions(5)).toEqual({
      allyCols: 5,
      centerCols: 2,
      enemyCols: 5,
      totalCols: 12,
      rows: 5,
    });
    expect(getMaxCapacity(3)).toBe(9);
    expect(getMaxCapacity(4)).toBe(16);
    expect(getMaxCapacity(5)).toBe(25);
  });

  it('maps grid zones and logical coordinates accurately', () => {
    expect(getZoneAt(0, 0, 3)).toBe('ALLY');
    expect(getZoneAt(2, 2, 3)).toBe('ALLY');
    expect(getZoneAt(3, 1, 3)).toBe('CENTER');
    expect(getZoneAt(4, 1, 3)).toBe('CENTER');
    expect(getZoneAt(5, 0, 3)).toBe('ENEMY');
    expect(getZoneAt(8, 0, 3)).toBeNull();

    const center = gridToLogicalCenter(2, 1);
    expect(center).toEqual({ x: 80, y: 48 });
    expect(logicalToGrid(center.x, center.y, 3)).toEqual({ col: 2, row: 1 });
  });

  it('enforces ally-only placement and capacity limits', () => {
    let units: PlacedUnit[] = [];
    const invalidZone = placeUnitOnGrid(
      units,
      'u1',
      'terran_marine',
      3,
      0,
      3,
      'ALLY'
    );
    expect(invalidZone.ok).toBe(false);
    expect(invalidZone.reason).toBe('INVALID_ZONE');

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const res = placeUnitOnGrid(
          units,
          `u_${c}_${r}`,
          'terran_marine',
          c,
          r,
          3,
          'ALLY'
        );
        expect(res.ok).toBe(true);
        units = res.units;
      }
    }

    const overflow = placeUnitOnGrid(
      units,
      'u_extra',
      'terran_marine',
      0,
      0,
      3,
      'ALLY'
    );
    expect(overflow.ok).toBe(false);
    expect(overflow.reason).toBe('CAPACITY_FULL');
  });

  it('moves units to empty cells and swaps when target cell is occupied', () => {
    let units: PlacedUnit[] = [];
    units = placeUnitOnGrid(units, 'a1', 'terran_scv', 0, 0, 3, 'ALLY').units;
    units = placeUnitOnGrid(units, 'a2', 'terran_marine', 2, 1, 3, 'ALLY').units;

    const moveRes = moveOrSwapUnitOnGrid(units, 'a1', 1, 1, 3);
    expect(moveRes.ok).toBe(true);
    expect(moveRes.swapped).toBe(false);
    expect(moveRes.units.find((u) => u.instanceId === 'a1')).toMatchObject({
      col: 1,
      row: 1,
    });

    const swapRes = moveOrSwapUnitOnGrid(moveRes.units, 'a1', 2, 1, 3);
    expect(swapRes.ok).toBe(true);
    expect(swapRes.swapped).toBe(true);
    expect(swapRes.units.find((u) => u.instanceId === 'a1')).toMatchObject({
      col: 2,
      row: 1,
    });
    expect(swapRes.units.find((u) => u.instanceId === 'a2')).toMatchObject({
      col: 1,
      row: 1,
    });

    const removed = removeUnitFromGrid(swapRes.units, 'a1');
    expect(removed).toHaveLength(1);
  });

  it('relocates out-of-bounds units cleanly when shrinking grid size', () => {
    let units: PlacedUnit[] = [];
    units = placeUnitOnGrid(units, 'a1', 'terran_marine', 4, 4, 5, 'ALLY').units;
    const resized = resizeGridUnits(units, 5, 3);
    expect(resized.removedAllyUnits).toHaveLength(0);
    expect(resized.units[0].col).toBeLessThan(3);
    expect(resized.units[0].row).toBeLessThan(3);
  });
});
