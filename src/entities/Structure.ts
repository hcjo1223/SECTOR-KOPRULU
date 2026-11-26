import { Container, Graphics } from 'pixi.js';
import type { Faction } from '../domain/types';

export class StructureEntity {
  public readonly container: Container;

  constructor(faction: Faction, x: number, y: number) {
    this.container = new Container();
    this.container.x = Math.round(x);
    this.container.y = Math.round(y);
    this.container.zIndex = Math.round(y);

    const body = new Graphics();
    const borderColor = faction === 'ALLY' ? 0x38bdf8 : 0xef4444;
    body.rect(-14, -14, 28, 28);
    body.fill({ color: 0x1e293b });
    body.stroke({ width: 2, color: borderColor });
    this.container.addChild(body);
  }
}
