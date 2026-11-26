import { Container, Graphics, Sprite, type FederatedPointerEvent } from 'pixi.js';
import {
  canPlaceInCell,
  getGridDimensions,
  getZoneAt,
  gridToLogicalCenter,
  logicalToGrid,
  TILE_SIZE,
} from '../domain/grid/GridSystem';
import { getUnitDefinition } from '../domain/UnitCatalog';
import type { GridCoord, GridSize, PlacedUnit, Race } from '../domain/types';
import { UnitEntity } from '../entities/Unit';
import { useGameStore } from '../store/useGameStore';
import { AssetLoader } from './AssetLoader';

export const VIRTUAL_WIDTH = 640;
export const VIRTUAL_HEIGHT = 360;

const SAFE_TOP = 64;
const SAFE_BOTTOM = 250;
const SAFE_LEFT = 104;
const SAFE_RIGHT = 524;

interface ActiveCanvasDrag {
  instanceId: string;
  unitId: string;
  startX: number;
  startY: number;
  moved: boolean;
}

export class SceneManager {
  public readonly root: Container;
  public readonly worldContainer: Container;

  private readonly gridBgLayer: Container;
  private readonly tilesContainer: Container;
  private readonly gridGraphics: Graphics;
  private readonly highlightGraphics: Graphics;
  private readonly unitsLayer: Container;
  private readonly dragGhostLayer: Container;

  private readonly unitEntities = new Map<string, UnitEntity>();
  private currentGridSize: GridSize = 3;
  private currentRace: Race = 'TERRAN';
  private hoverCell: GridCoord | null = null;
  private activeCanvasDrag: ActiveCanvasDrag | null = null;
  private dragGhostSprite: Sprite | null = null;
  private externalDragUnitId: string | null = null;

  constructor() {
    this.root = new Container();
    this.root.eventMode = 'static';

    this.worldContainer = new Container();
    this.gridBgLayer = new Container();
    this.tilesContainer = new Container();
    this.gridGraphics = new Graphics();
    this.highlightGraphics = new Graphics();
    this.unitsLayer = new Container();
    this.unitsLayer.sortableChildren = true;
    this.dragGhostLayer = new Container();

    this.gridBgLayer.addChild(this.tilesContainer);
    this.gridBgLayer.addChild(this.gridGraphics);
    this.gridBgLayer.addChild(this.highlightGraphics);

    this.worldContainer.addChild(this.gridBgLayer);
    this.worldContainer.addChild(this.unitsLayer);
    this.worldContainer.addChild(this.dragGhostLayer);

    this.root.addChild(this.worldContainer);
    this.bindStageEvents();
  }

  public syncFromStore(): void {
    const state = useGameStore.getState();

    if (
      this.currentGridSize !== state.gridSize ||
      this.currentRace !== state.selectedRace
    ) {
      this.currentGridSize = state.gridSize;
      this.currentRace = state.selectedRace;
      this.redrawGrid();
      this.updateCameraFit();
    }

    this.syncUnits(state.placedUnits, state.selectedInstanceId);

    const rosterDrag =
      state.dragPayload?.source === 'ROSTER' ? state.dragPayload.unitId : null;
    if (rosterDrag !== this.externalDragUnitId) {
      this.externalDragUnitId = rosterDrag;
      if (rosterDrag) {
        this.spawnDragGhost(rosterDrag);
      } else if (!this.activeCanvasDrag) {
        this.clearDragGhost();
      }
    }
  }

  public initializeLayout(): void {
    const state = useGameStore.getState();
    this.currentGridSize = state.gridSize;
    this.currentRace = state.selectedRace;
    this.redrawGrid();
    this.updateCameraFit();
    this.syncUnits(state.placedUnits, state.selectedInstanceId);
  }

  public update(deltaMs: number): void {
    const factor = Math.min(1, (deltaMs / 16.67) * 0.3);
    for (const entity of this.unitEntities.values()) {
      entity.update(factor);
    }
  }

  public handleExternalPointerMove(stageX: number, stageY: number): void {
    const worldPt = this.stageToWorld(stageX, stageY);
    this.hoverCell = logicalToGrid(worldPt.x, worldPt.y, this.currentGridSize);
    if (this.dragGhostSprite) {
      this.dragGhostSprite.x = Math.round(worldPt.x);
      this.dragGhostSprite.y = Math.round(worldPt.y);
    }
    this.redrawHighlight();
  }

  public handleExternalPointerDrop(
    unitId: string,
    stageX: number,
    stageY: number
  ): boolean {
    const worldPt = this.stageToWorld(stageX, stageY);
    const cell = logicalToGrid(worldPt.x, worldPt.y, this.currentGridSize);
    this.hoverCell = null;
    this.externalDragUnitId = null;
    this.clearDragGhost();
    this.redrawHighlight();

    if (!cell) {
      return false;
    }
    return useGameStore.getState().placeFromRosterAt(unitId, cell.col, cell.row);
  }

  private updateCameraFit(): void {
    const dims = getGridDimensions(this.currentGridSize);
    const worldWidth = dims.totalCols * TILE_SIZE;
    const worldHeight = dims.rows * TILE_SIZE;

    const safeWidth = SAFE_RIGHT - SAFE_LEFT;
    const safeHeight = SAFE_BOTTOM - SAFE_TOP;

    const rawScale = Math.min(safeWidth / worldWidth, safeHeight / worldHeight, 2);
    const quantizedScale = Math.floor(rawScale * 20) / 20;

    this.worldContainer.scale.set(quantizedScale);
    this.worldContainer.x = Math.round(
      SAFE_LEFT + (safeWidth - worldWidth * quantizedScale) / 2
    );
    this.worldContainer.y = Math.round(
      SAFE_TOP + (safeHeight - worldHeight * quantizedScale) / 2
    );
  }

  private stageToWorld(stageX: number, stageY: number): { x: number; y: number } {
    const scale = this.worldContainer.scale.x || 1;
    return {
      x: (stageX - this.worldContainer.x) / scale,
      y: (stageY - this.worldContainer.y) / scale,
    };
  }

  private redrawGrid(): void {
    const g = this.gridGraphics;
    const dims = getGridDimensions(this.currentGridSize);
    const totalWidth = dims.totalCols * TILE_SIZE;
    const totalHeight = dims.rows * TILE_SIZE;

    g.clear();
    const oldTiles = this.tilesContainer.removeChildren();
    for (let i = 0; i < oldTiles.length; i++) {
      oldTiles[i].destroy();
    }

    // Outer chassis frame
    g.rect(-4, -4, totalWidth + 8, totalHeight + 8);
    g.stroke({ width: 2, color: 0x1e293b });

    for (let row = 0; row < dims.rows; row++) {
      for (let col = 0; col < dims.totalCols; col++) {
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        const zone = getZoneAt(col, row, this.currentGridSize) ?? 'CENTER';
        const variant: 0 | 1 = (row + col) % 2 === 0 ? 0 : 1;

        const tileTex = AssetLoader.getTerrainTileTexture(
          zone,
          this.currentRace,
          variant
        );
        const tileSprite = new Sprite(tileTex);
        tileSprite.x = x;
        tileSprite.y = y;
        this.tilesContainer.addChild(tileSprite);
      }
    }

    // Tactical Zone boundary outlines
    const allyBorderColor =
      this.currentRace === 'ZERG'
        ? 0xa855f7
        : this.currentRace === 'PROTOSS'
          ? 0xfacc15
          : 0x38bdf8;
    g.rect(0, 0, dims.allyCols * TILE_SIZE, totalHeight);
    g.stroke({ width: 1.5, color: allyBorderColor, alpha: 0.65 });

    const enemyX = (dims.allyCols + dims.centerCols) * TILE_SIZE;
    g.rect(enemyX, 0, dims.enemyCols * TILE_SIZE, totalHeight);
    g.stroke({ width: 1.5, color: 0xef4444, alpha: 0.6 });

    this.redrawHighlight();
  }

  private redrawHighlight(): void {
    const h = this.highlightGraphics;
    h.clear();

    if (!this.hoverCell) {
      return;
    }

    const { col, row } = this.hoverCell;
    const isAlly = canPlaceInCell(col, row, this.currentGridSize, 'ALLY');
    const state = useGameStore.getState();
    const isPlacing =
      Boolean(this.activeCanvasDrag) ||
      Boolean(this.externalDragUnitId) ||
      Boolean(state.selectedRosterUnitId);

    if (!isPlacing && !isAlly) {
      return;
    }

    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;
    const color = isAlly ? 0x38bdf8 : 0xef4444;
    const fillAlpha = isPlacing ? 0.22 : 0.1;

    h.rect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    h.fill({ color, alpha: fillAlpha });
    h.stroke({ width: 1.5, color, alpha: 0.95 });
  }

  private syncUnits(
    placedUnits: readonly PlacedUnit[],
    selectedInstanceId: string | null
  ): void {
    const activeIds = new Set<string>();

    for (let i = 0; i < placedUnits.length; i++) {
      const placed = placedUnits[i];
      activeIds.add(placed.instanceId);
      const center = gridToLogicalCenter(placed.col, placed.row);

      let entity = this.unitEntities.get(placed.instanceId);
      if (!entity) {
        const def = getUnitDefinition(placed.unitId);
        if (!def) {
          continue;
        }
        entity = new UnitEntity(
          placed.instanceId,
          def,
          placed.faction,
          center.x,
          center.y
        );
        this.bindUnitEvents(entity);
        this.unitEntities.set(placed.instanceId, entity);
        this.unitsLayer.addChild(entity.container);
      } else if (entity.unitId !== placed.unitId) {
        // Unit replaced in cell -> recreate sprite entity cleanly
        this.unitsLayer.removeChild(entity.container);
        entity.destroy();

        const def = getUnitDefinition(placed.unitId);
        if (!def) {
          continue;
        }
        entity = new UnitEntity(
          placed.instanceId,
          def,
          placed.faction,
          center.x,
          center.y
        );
        this.bindUnitEvents(entity);
        this.unitEntities.set(placed.instanceId, entity);
        this.unitsLayer.addChild(entity.container);
      }

      entity.setTargetPosition(center.x, center.y);
      entity.setVitals(placed.currentHp, placed.currentShield);
      entity.setSelected(placed.instanceId === selectedInstanceId);
    }

    for (const [id, entity] of this.unitEntities.entries()) {
      if (!activeIds.has(id)) {
        this.unitsLayer.removeChild(entity.container);
        entity.destroy();
        this.unitEntities.delete(id);
      }
    }
  }

  private bindUnitEvents(entity: UnitEntity): void {
    entity.container.on('pointerdown', (ev: FederatedPointerEvent) => {
      if (ev.button === 2) {
        if (entity.faction === 'ALLY') {
          useGameStore.getState().removePlacedUnit(entity.instanceId);
        }
        return;
      }

      ev.stopPropagation();
      useGameStore.getState().selectPlacedUnit(entity.instanceId);

      if (entity.faction !== 'ALLY') {
        return;
      }

      const worldPt = this.stageToWorld(ev.global.x, ev.global.y);
      this.activeCanvasDrag = {
        instanceId: entity.instanceId,
        unitId: entity.unitId,
        startX: worldPt.x,
        startY: worldPt.y,
        moved: false,
      };
    });
  }

  private bindStageEvents(): void {
    this.root.on('pointerdown', (ev: FederatedPointerEvent) => {
      if (ev.button === 2) {
        return;
      }
      const worldPt = this.stageToWorld(ev.global.x, ev.global.y);
      const cell = logicalToGrid(worldPt.x, worldPt.y, this.currentGridSize);
      const store = useGameStore.getState();

      if (cell && store.selectedRosterUnitId) {
        store.placeFromRosterAt(store.selectedRosterUnitId, cell.col, cell.row);
        return;
      }

      if (!cell) {
        store.selectPlacedUnit(null);
      }
    });

    this.root.on('pointermove', (ev: FederatedPointerEvent) => {
      const worldPt = this.stageToWorld(ev.global.x, ev.global.y);
      this.hoverCell = logicalToGrid(worldPt.x, worldPt.y, this.currentGridSize);

      if (this.activeCanvasDrag) {
        const dist = Math.hypot(
          worldPt.x - this.activeCanvasDrag.startX,
          worldPt.y - this.activeCanvasDrag.startY
        );
        if (!this.activeCanvasDrag.moved && dist > 4) {
          this.activeCanvasDrag.moved = true;
          const draggingEntity = this.unitEntities.get(
            this.activeCanvasDrag.instanceId
          );
          draggingEntity?.setDragging(true);
          this.spawnDragGhost(this.activeCanvasDrag.unitId);
        }

        if (this.dragGhostSprite) {
          this.dragGhostSprite.x = Math.round(worldPt.x);
          this.dragGhostSprite.y = Math.round(worldPt.y);
        }
      }

      this.redrawHighlight();
    });

    this.root.on('pointerup', (ev: FederatedPointerEvent) => {
      this.finishCanvasDrag(ev.global.x, ev.global.y);
    });

    this.root.on('pointerupoutside', (ev: FederatedPointerEvent) => {
      this.finishCanvasDrag(ev.global.x, ev.global.y);
    });
  }

  private finishCanvasDrag(stageX: number, stageY: number): void {
    if (!this.activeCanvasDrag) {
      return;
    }

    const drag = this.activeCanvasDrag;
    this.activeCanvasDrag = null;

    const entity = this.unitEntities.get(drag.instanceId);
    entity?.setDragging(false);
    this.clearDragGhost();

    if (drag.moved) {
      const worldPt = this.stageToWorld(stageX, stageY);
      const cell = logicalToGrid(worldPt.x, worldPt.y, this.currentGridSize);
      if (cell) {
        useGameStore
          .getState()
          .moveOrSwapGridUnit(drag.instanceId, cell.col, cell.row);
      } else if (stageY > SAFE_BOTTOM) {
        // Dragged down into roster dock -> recall unit
        useGameStore.getState().removePlacedUnit(drag.instanceId);
      }
    }

    this.redrawHighlight();
  }

  private spawnDragGhost(unitId: string): void {
    this.clearDragGhost();
    const def = getUnitDefinition(unitId);
    if (!def) {
      return;
    }
    const texture = AssetLoader.getUnitTexture(def);
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    sprite.alpha = 0.8;
    this.dragGhostSprite = sprite;
    this.dragGhostLayer.addChild(sprite);
  }

  private clearDragGhost(): void {
    if (this.dragGhostSprite) {
      this.dragGhostLayer.removeChild(this.dragGhostSprite);
      this.dragGhostSprite.destroy();
      this.dragGhostSprite = null;
    }
  }
}
