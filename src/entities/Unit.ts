import { Container, Graphics, Sprite } from 'pixi.js';
import { AssetLoader } from '../core/AssetLoader';
import type { Faction, UnitDefinition } from '../domain/types';

export class UnitEntity {
  public readonly container: Container;
  public readonly instanceId: string;
  public readonly unitId: string;
  public readonly faction: Faction;

  private readonly ringGraphics: Graphics;
  private readonly selectionGraphics: Graphics;
  private readonly sprite: Sprite;
  private readonly barsGraphics: Graphics;
  private readonly def: UnitDefinition;

  private targetX = 0;
  private targetY = 0;
  private logicalX = 0;
  private logicalY = 0;
  private currentHp: number;
  private currentShield: number;
  private isSelected = false;

  constructor(
    instanceId: string,
    def: UnitDefinition,
    faction: Faction,
    initialX: number,
    initialY: number
  ) {
    this.instanceId = instanceId;
    this.unitId = def.unit_id;
    this.faction = faction;
    this.def = def;
    this.logicalX = initialX;
    this.logicalY = initialY;
    this.targetX = initialX;
    this.targetY = initialY;
    this.currentHp = def.base_stats.hp;
    this.currentShield = def.base_stats.shield;

    this.container = new Container();
    this.container.eventMode = 'static';
    this.container.cursor = faction === 'ALLY' ? 'grab' : 'pointer';

    this.selectionGraphics = new Graphics();
    this.ringGraphics = new Graphics();
    this.barsGraphics = new Graphics();

    const facing = faction === 'ALLY' ? 1 : -1;
    const texture = AssetLoader.getUnitTexture(def, facing);
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5, 0.5);
    this.sprite.x = Math.round(def.visual.pivot_offset[0]);
    this.sprite.y = Math.round(def.visual.pivot_offset[1]);

    this.container.addChild(this.selectionGraphics);
    this.container.addChild(this.ringGraphics);
    this.container.addChild(this.sprite);
    this.container.addChild(this.barsGraphics);

    this.drawTeamRing();
    this.drawBars();
    this.syncTransform();
  }

  public setTargetPosition(x: number, y: number, immediate: boolean = false): void {
    this.targetX = x;
    this.targetY = y;
    if (immediate) {
      this.logicalX = x;
      this.logicalY = y;
      this.syncTransform();
    }
  }

  public setVitals(hp: number, shield: number): void {
    if (this.currentHp !== hp || this.currentShield !== shield) {
      this.currentHp = hp;
      this.currentShield = shield;
      this.drawBars();
    }
  }

  public setSelected(selected: boolean): void {
    if (this.isSelected === selected) {
      return;
    }
    this.isSelected = selected;
    this.drawSelectionRing();
  }

  public setDragging(dragging: boolean): void {
    this.container.alpha = dragging ? 0.45 : 1;
    this.container.cursor = dragging ? 'grabbing' : this.faction === 'ALLY' ? 'grab' : 'pointer';
  }

  public update(dtFactor: number = 0.28): void {
    const dx = this.targetX - this.logicalX;
    const dy = this.targetY - this.logicalY;
    if (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) {
      this.logicalX = this.targetX;
      this.logicalY = this.targetY;
    } else {
      this.logicalX += dx * dtFactor;
      this.logicalY += dy * dtFactor;
    }
    this.syncTransform();
  }

  private syncTransform(): void {
    this.container.x = Math.round(this.logicalX);
    this.container.y = Math.round(this.logicalY);
    this.container.zIndex = Math.round(this.logicalY);
  }

  private drawTeamRing(): void {
    const color = this.faction === 'ALLY' ? 0x38bdf8 : 0xef4444;
    const radiusX = this.def.visual.sprite_size >= 64 ? 14 : 11;
    const radiusY = 5;

    this.ringGraphics.clear();
    this.ringGraphics.ellipse(0, 9, radiusX, radiusY);
    this.ringGraphics.stroke({ width: 1.5, color, alpha: 0.9 });
  }

  private drawSelectionRing(): void {
    this.selectionGraphics.clear();
    if (!this.isSelected) {
      return;
    }
    const radiusX = this.def.visual.sprite_size >= 64 ? 17 : 14;
    this.selectionGraphics.ellipse(0, 9, radiusX, 7);
    this.selectionGraphics.stroke({ width: 2, color: 0xfacc15, alpha: 1 });
  }

  private drawBars(): void {
    this.barsGraphics.clear();
    const width = this.def.visual.sprite_size >= 64 ? 24 : 18;
    const halfW = Math.round(width / 2);
    const barY = Math.max(
      -34,
      Math.round(this.def.visual.pivot_offset[1] - this.def.visual.sprite_size / 2 - 2)
    );

    const maxHp = Math.max(1, this.def.base_stats.hp);
    const hpRatio = Math.max(0, Math.min(1, this.currentHp / maxHp));
    const hpColor = this.faction === 'ALLY' ? 0x22c55e : 0xef4444;

    // HP background + fill
    this.barsGraphics.rect(-halfW - 1, barY - 1, width + 2, 4);
    this.barsGraphics.fill({ color: 0x090d14 });
    this.barsGraphics.rect(-halfW, barY, Math.round(width * hpRatio), 2);
    this.barsGraphics.fill({ color: hpColor });

    // Optional Protoss Shield bar above HP
    if (this.def.base_stats.shield > 0) {
      const shieldRatio = Math.max(
        0,
        Math.min(1, this.currentShield / this.def.base_stats.shield)
      );
      this.barsGraphics.rect(-halfW - 1, barY - 4, width + 2, 3);
      this.barsGraphics.fill({ color: 0x090d14 });
      this.barsGraphics.rect(-halfW, barY - 3, Math.round(width * shieldRatio), 2);
      this.barsGraphics.fill({ color: 0x38bdf8 });
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
