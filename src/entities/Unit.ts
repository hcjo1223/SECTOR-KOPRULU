import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { AssetLoader } from '../core/AssetLoader';
import type {
  Faction,
  UnitActionState,
  UnitDefinition,
} from '../domain/types';

export class UnitEntity {
  public readonly container: Container;
  public readonly instanceId: string;
  public readonly unitId: string;
  public readonly faction: Faction;

  private readonly ringGraphics: Graphics;
  private readonly selectionGraphics: Graphics;
  private readonly sprite: Sprite;
  private readonly rightFrames: readonly [Texture, Texture];
  private readonly leftFrames: readonly [Texture, Texture];
  private readonly barsGraphics: Graphics;
  private readonly def: UnitDefinition;

  private targetX = 0;
  private targetY = 0;
  private logicalX = 0;
  private logicalY = 0;
  private currentHp: number;
  private maxHp: number;
  private currentShield: number;
  private maxShield: number;
  private facing: 1 | -1;
  private action: UnitActionState = 'IDLE';
  private isSelected = false;
  private animTimer = 0;
  private currentFrameIdx: 0 | 1 = 0;
  private attackBump = 0;

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
    this.maxHp = def.base_stats.hp;
    this.currentShield = def.base_stats.shield;
    this.maxShield = def.base_stats.shield;
    this.facing = faction === 'ALLY' ? 1 : -1;
    this.animTimer = (initialX * 7 + initialY * 13) % 25;

    this.container = new Container();
    this.container.eventMode = 'static';
    this.container.cursor = faction === 'ALLY' ? 'grab' : 'pointer';

    this.selectionGraphics = new Graphics();
    this.ringGraphics = new Graphics();
    this.barsGraphics = new Graphics();

    this.rightFrames = [
      AssetLoader.getUnitTexture(def, 1, 0),
      AssetLoader.getUnitTexture(def, 1, 1),
    ];
    this.leftFrames = [
      AssetLoader.getUnitTexture(def, -1, 0),
      AssetLoader.getUnitTexture(def, -1, 1),
    ];

    this.sprite = new Sprite(this.getActiveTexture());
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

  private getActiveTexture(): Texture {
    return this.facing === 1
      ? this.rightFrames[this.currentFrameIdx]
      : this.leftFrames[this.currentFrameIdx];
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

  public setFacing(facing: 1 | -1): void {
    if (this.facing !== facing) {
      this.facing = facing;
      this.sprite.texture = this.getActiveTexture();
    }
  }

  public setAction(action: UnitActionState): void {
    if (this.action !== action) {
      this.action = action;
      if (action === 'ATTACK') {
        this.attackBump = 3;
      }
    }
    this.container.visible = action !== 'DIE' && this.currentHp > 0;
  }

  public setVitals(
    hp: number,
    shield: number,
    maxHp: number = this.maxHp,
    maxShield: number = this.maxShield
  ): void {
    if (
      this.currentHp !== hp ||
      this.currentShield !== shield ||
      this.maxHp !== maxHp ||
      this.maxShield !== maxShield
    ) {
      this.currentHp = hp;
      this.currentShield = shield;
      this.maxHp = Math.max(1, maxHp);
      this.maxShield = Math.max(0, maxShield);
      this.container.visible = hp > 0;
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
    this.container.cursor =
      dragging ? 'grabbing' : this.faction === 'ALLY' ? 'grab' : 'pointer';
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

    if (this.attackBump > 0) {
      this.attackBump = Math.max(0, this.attackBump - dtFactor * 0.8);
    }

    const animRate = this.action === 'MOVE' ? 5.5 : 3.2;
    this.animTimer += dtFactor * animRate;
    if (this.animTimer >= 26) {
      this.animTimer = 0;
      this.currentFrameIdx = this.currentFrameIdx === 0 ? 1 : 0;
      this.sprite.texture = this.getActiveTexture();
    }

    this.sprite.x = Math.round(
      this.def.visual.pivot_offset[0] + this.facing * this.attackBump
    );
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
      Math.round(
        this.def.visual.pivot_offset[1] - this.def.visual.sprite_size / 2 - 2
      )
    );

    const hpRatio = Math.max(0, Math.min(1, this.currentHp / this.maxHp));
    const hpColor = this.faction === 'ALLY' ? 0x22c55e : 0xef4444;

    this.barsGraphics.rect(-halfW - 1, barY - 1, width + 2, 4);
    this.barsGraphics.fill({ color: 0x090d14 });
    this.barsGraphics.rect(-halfW, barY, Math.round(width * hpRatio), 2);
    this.barsGraphics.fill({ color: hpColor });

    if (this.maxShield > 0) {
      const shieldRatio = Math.max(
        0,
        Math.min(1, this.currentShield / this.maxShield)
      );
      this.barsGraphics.rect(-halfW - 1, barY - 4, width + 2, 3);
      this.barsGraphics.fill({ color: 0x090d14 });
      this.barsGraphics.rect(
        -halfW,
        barY - 3,
        Math.round(width * shieldRatio),
        2
      );
      this.barsGraphics.fill({ color: 0x38bdf8 });
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
