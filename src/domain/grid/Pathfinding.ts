import { getGridDimensions } from './GridSystem';
import type { GridCoord, GridSize } from '../types';

export function manhattanDistance(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

export function euclideanTileDistance(
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

const CARDINAL_DIRS: readonly GridCoord[] = [
  { col: 1, row: 0 },
  { col: -1, row: 0 },
  { col: 0, row: 1 },
  { col: 0, row: -1 },
];

export function findNextStepBFS(
  start: GridCoord,
  goal: GridCoord,
  gridSize: GridSize,
  blockedKeys: ReadonlySet<string>
): GridCoord | null {
  if (start.col === goal.col && start.row === goal.row) {
    return null;
  }

  const dims = getGridDimensions(gridSize);
  const startKey = `${start.col},${start.row}`;
  const goalKey = `${goal.col},${goal.row}`;

  const queue: GridCoord[] = [start];
  const visited = new Set<string>([startKey]);
  const parent = new Map<string, GridCoord>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = `${current.col},${current.row}`;

    if (currentKey === goalKey) {
      let step: GridCoord = goal;
      let stepKey = goalKey;
      while (true) {
        const prev = parent.get(stepKey);
        if (!prev) {
          return null;
        }
        if (prev.col === start.col && prev.row === start.row) {
          return step;
        }
        step = prev;
        stepKey = `${prev.col},${prev.row}`;
      }
    }

    for (let i = 0; i < CARDINAL_DIRS.length; i++) {
      const dir = CARDINAL_DIRS[i];
      const nextCol = current.col + dir.col;
      const nextRow = current.row + dir.row;

      if (
        nextCol < 0 ||
        nextCol >= dims.totalCols ||
        nextRow < 0 ||
        nextRow >= dims.rows
      ) {
        continue;
      }

      const nextKey = `${nextCol},${nextRow}`;
      if (visited.has(nextKey)) {
        continue;
      }
      if (nextKey !== goalKey && blockedKeys.has(nextKey)) {
        continue;
      }

      visited.add(nextKey);
      parent.set(nextKey, current);
      queue.push({ col: nextCol, row: nextRow });
    }
  }

  return null;
}
