import { describe, expect, it } from 'vitest';
import { placeUnitOnGrid } from '../grid/GridSystem';
import {
  findEvolvableZergPair,
  generateDraftOffers,
  generateTacticalMap,
  getNextZergEvolutionId,
  getRelicChoicesForRace,
} from '../roguelike/RunGenerator';
import type { PlacedUnit } from '../types';

describe('RunGenerator (Milestone 3 Roguelike Loop)', () => {
  it('generates 9 tactical map nodes across Acts 1, 2, and 3 with 3x3, 4x4, and 5x5 grids', () => {
    const nodes = generateTacticalMap();
    expect(nodes).toHaveLength(9);
    expect(nodes.filter((n) => n.act === 1)[0].gridSize).toBe(3);
    expect(nodes.filter((n) => n.act === 2)[0].gridSize).toBe(4);
    expect(nodes.filter((n) => n.act === 3)[0].gridSize).toBe(5);
  });

  it('generates 3-choose-1 draft offers and race-appropriate relics', () => {
    const offers = generateDraftOffers('TERRAN', 1, 42);
    expect(offers).toHaveLength(3);
    for (const id of offers) {
      expect(id.startsWith('terran_')).toBe(true);
    }

    const relics = getRelicChoicesForRace('PROTOSS', []);
    expect(relics.length).toBeGreaterThanOrEqual(2);
  });

  it('detects evolvable Zerg pairs along the Swarm evolution chain', () => {
    expect(getNextZergEvolutionId('zerg_drone')).toBe('zerg_zergling');
    expect(getNextZergEvolutionId('zerg_mutalisk')).toBe('zerg_ultralisk');
    expect(getNextZergEvolutionId('zerg_ultralisk')).toBeNull();

    let units: PlacedUnit[] = [];
    units = placeUnitOnGrid(units, 'z1', 'zerg_drone', 0, 0, 3, 'ALLY').units;
    expect(findEvolvableZergPair(units)).toBeNull();

    units = placeUnitOnGrid(units, 'z2', 'zerg_drone', 1, 0, 3, 'ALLY').units;
    const pair = findEvolvableZergPair(units);
    expect(pair).not.toBeNull();
    expect(pair?.targetUnitId).toBe('zerg_zergling');
  });
});
