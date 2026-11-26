import { getUnitDefinition } from '../UnitCatalog';
import type {
  Faction,
  GridCell,
  GridCoord,
  GridDimensions,
  GridSize,
  PlacedUnit,
  ZoneType,
} from '../types';

export const TILE_SIZE = 32;
export const CENTER_GAP_COLS = 2;

export function getGridDimensions(gridSize: GridSize): GridDimensions {
  const allyCols = gridSize;
  const centerCols = CENTER_GAP_COLS;
  const enemyCols = gridSize;
  return {
    allyCols,
    centerCols,
    enemyCols,
    totalCols: allyCols + centerCols + enemyCols,
    rows: gridSize,
  };
}

export function getMaxCapacity(gridSize: GridSize): number {
  return gridSize * gridSize;
}

export function getZoneAt(
  col: number,
  row: number,
  gridSize: GridSize
): ZoneType | null {
  const dims = getGridDimensions(gridSize);
  if (col < 0 || col >= dims.totalCols || row < 0 || row >= dims.rows) {
    return null;
  }
  if (col < dims.allyCols) {
    return 'ALLY';
  }
  if (col < dims.allyCols + dims.centerCols) {
    return 'CENTER';
  }
  return 'ENEMY';
}

export function buildGridCells(
  gridSize: GridSize,
  placedUnits: readonly PlacedUnit[]
): GridCell[] {
  const dims = getGridDimensions(gridSize);
  const occupantByKey = new Map<string, string>();
  for (let i = 0; i < placedUnits.length; i++) {
    const u = placedUnits[i];
    occupantByKey.set(`${u.col},${u.row}`, u.instanceId);
  }

  const cells: GridCell[] = [];
  for (let row = 0; row < dims.rows; row++) {
    for (let col = 0; col < dims.totalCols; col++) {
      const zone = getZoneAt(col, row, gridSize) ?? 'CENTER';
      cells.push({
        col,
        row,
        zone,
        occupantInstanceId: occupantByKey.get(`${col},${row}`) ?? null,
      });
    }
  }
  return cells;
}

export function gridToLogicalCenter(col: number, row: number): { x: number; y: number } {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function logicalToGrid(
  logicalX: number,
  logicalY: number,
  gridSize: GridSize
): GridCoord | null {
  const col = Math.floor(logicalX / TILE_SIZE);
  const row = Math.floor(logicalY / TILE_SIZE);
  const zone = getZoneAt(col, row, gridSize);
  if (zone === null) {
    return null;
  }
  return { col, row };
}

export function canPlaceInCell(
  col: number,
  row: number,
  gridSize: GridSize,
  faction: Faction
): boolean {
  const zone = getZoneAt(col, row, gridSize);
  return zone === faction;
}

export function findFirstEmptyAllyCell(
  placedUnits: readonly PlacedUnit[],
  gridSize: GridSize
): GridCoord | null {
  const occupied = new Set<string>();
  for (let i = 0; i < placedUnits.length; i++) {
    const u = placedUnits[i];
    if (u.faction === 'ALLY') {
      occupied.add(`${u.col},${u.row}`);
    }
  }

  // Prefer front-to-back or left-to-right; scan column-major from front (allyCols - 1) or left-to-right
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (!occupied.has(`${col},${row}`)) {
        return { col, row };
      }
    }
  }
  return null;
}

export interface PlaceResult {
  ok: boolean;
  units: PlacedUnit[];
  placedInstanceId?: string;
  reason?: 'INVALID_ZONE' | 'CELL_OCCUPIED' | 'CAPACITY_FULL' | 'UNKNOWN_UNIT';
}

export function placeUnitOnGrid(
  placedUnits: readonly PlacedUnit[],
  instanceId: string,
  unitId: string,
  col: number,
  row: number,
  gridSize: GridSize,
  faction: Faction = 'ALLY'
): PlaceResult {
  const def = getUnitDefinition(unitId);
  if (!def) {
    return { ok: false, units: [...placedUnits], reason: 'UNKNOWN_UNIT' };
  }

  if (!canPlaceInCell(col, row, gridSize, faction)) {
    return { ok: false, units: [...placedUnits], reason: 'INVALID_ZONE' };
  }

  const factionUnits = placedUnits.filter((u) => u.faction === faction);
  if (factionUnits.length >= getMaxCapacity(gridSize)) {
    return { ok: false, units: [...placedUnits], reason: 'CAPACITY_FULL' };
  }

  const existingAtCell = placedUnits.find((u) => u.col === col && u.row === row);
  if (existingAtCell) {
    return { ok: false, units: [...placedUnits], reason: 'CELL_OCCUPIED' };
  }

  const newUnit: PlacedUnit = {
    instanceId,
    unitId,
    faction,
    col,
    row,
    currentHp: def.base_stats.hp,
    currentShield: def.base_stats.shield,
  };

  return {
    ok: true,
    units: [...placedUnits, newUnit],
    placedInstanceId: instanceId,
  };
}

export interface MoveResult {
  ok: boolean;
  swapped: boolean;
  units: PlacedUnit[];
  reason?: 'NOT_FOUND' | 'INVALID_ZONE';
}

export function moveOrSwapUnitOnGrid(
  placedUnits: readonly PlacedUnit[],
  instanceId: string,
  targetCol: number,
  targetRow: number,
  gridSize: GridSize
): MoveResult {
  const source = placedUnits.find((u) => u.instanceId === instanceId);
  if (!source) {
    return { ok: false, swapped: false, units: [...placedUnits], reason: 'NOT_FOUND' };
  }

  if (!canPlaceInCell(targetCol, targetRow, gridSize, source.faction)) {
    return { ok: false, swapped: false, units: [...placedUnits], reason: 'INVALID_ZONE' };
  }

  if (source.col === targetCol && source.row === targetRow) {
    return { ok: true, swapped: false, units: [...placedUnits] };
  }

  const occupant = placedUnits.find(
    (u) => u.col === targetCol && u.row === targetRow && u.instanceId !== instanceId
  );

  const nextUnits = placedUnits.map((unit) => {
    if (unit.instanceId === instanceId) {
      return { ...unit, col: targetCol, row: targetRow };
    }
    if (occupant && unit.instanceId === occupant.instanceId) {
      return { ...unit, col: source.col, row: source.row };
    }
    return unit;
  });

  return {
    ok: true,
    swapped: Boolean(occupant),
    units: nextUnits,
  };
}

export function removeUnitFromGrid(
  placedUnits: readonly PlacedUnit[],
  instanceId: string
): PlacedUnit[] {
  return placedUnits.filter((u) => u.instanceId !== instanceId);
}

export interface ResizeGridResult {
  units: PlacedUnit[];
  removedAllyUnits: PlacedUnit[];
}

export function resizeGridUnits(
  placedUnits: readonly PlacedUnit[],
  oldGridSize: GridSize,
  newGridSize: GridSize
): ResizeGridResult {
  const oldEnemyStart = oldGridSize + CENTER_GAP_COLS;
  const newEnemyStart = newGridSize + CENTER_GAP_COLS;

  const keptAllies: PlacedUnit[] = [];
  const relocatedQueue: PlacedUnit[] = [];
  const removedAllyUnits: PlacedUnit[] = [];
  const enemyUnits: PlacedUnit[] = [];

  const occupiedAlly = new Set<string>();

  for (let i = 0; i < placedUnits.length; i++) {
    const u = placedUnits[i];
    if (u.faction === 'ALLY') {
      if (u.col >= 0 && u.col < newGridSize && u.row >= 0 && u.row < newGridSize) {
        keptAllies.push(u);
        occupiedAlly.add(`${u.col},${u.row}`);
      } else {
        relocatedQueue.push(u);
      }
    } else {
      const localEnemyCol = u.col - oldEnemyStart;
      if (
        localEnemyCol >= 0 &&
        localEnemyCol < newGridSize &&
        u.row >= 0 &&
        u.row < newGridSize
      ) {
        enemyUnits.push({
          ...u,
          col: newEnemyStart + localEnemyCol,
        });
      }
    }
  }

  for (let i = 0; i < relocatedQueue.length; i++) {
    const unit = relocatedQueue[i];
    let placed = false;
    for (let row = 0; row < newGridSize && !placed; row++) {
      for (let col = 0; col < newGridSize && !placed; col++) {
        const key = `${col},${row}`;
        if (!occupiedAlly.has(key)) {
          occupiedAlly.add(key);
          keptAllies.push({ ...unit, col, row });
          placed = true;
        }
      }
    }
    if (!placed) {
      removedAllyUnits.push(unit);
    }
  }

  return {
    units: [...keptAllies, ...enemyUnits],
    removedAllyUnits,
  };
}
