import { Graphics } from 'pixi.js';
import type { ProjectileDefinition } from '../domain/types';

export class ProjectileEntity {
  public readonly graphic: Graphics;
  public active = false;

  constructor() {
    this.graphic = new Graphics();
    this.graphic.visible = false;
  }

  public spawn(def: ProjectileDefinition, x: number, y: number): void {
    this.active = true;
    this.graphic.visible = true;
    this.graphic.clear();
    this.graphic.rect(
      -Math.floor(def.size / 2),
      -Math.floor(def.size / 2),
      def.size,
      def.size
    );
    this.graphic.fill({ color: def.color });
    this.setPosition(x, y);
  }

  public setPosition(x: number, y: number): void {
    this.graphic.x = Math.round(x);
    this.graphic.y = Math.round(y);
  }

  public recycle(): void {
    this.active = false;
    this.graphic.visible = false;
  }
}
