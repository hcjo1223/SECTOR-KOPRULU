import { Container, Graphics } from 'pixi.js';
import type { BattleProjectileState } from '../domain/types';

export class ProjectileEntity {
  public readonly graphic: Graphics;
  public active = false;

  constructor() {
    this.graphic = new Graphics();
    this.graphic.visible = false;
  }

  public sync(state: BattleProjectileState): void {
    this.active = true;
    this.graphic.visible = true;
    this.graphic.clear();

    const s = state.size;
    const half = Math.floor(s / 2);
    // Dark 1px pixel outline + glowing core
    this.graphic.rect(-half - 1, -half - 1, s + 2, s + 2);
    this.graphic.fill({ color: 0x070a10 });
    this.graphic.rect(-half, -half, s, s);
    this.graphic.fill({ color: state.color });

    this.graphic.x = Math.round(state.x);
    this.graphic.y = Math.round(state.y);
  }

  public recycle(): void {
    this.active = false;
    this.graphic.visible = false;
  }
}

export class ProjectilePool {
  private readonly pool: ProjectileEntity[] = [];
  private readonly container: Container;

  constructor(container: Container, initialSize: number = 48) {
    this.container = container;
    for (let i = 0; i < initialSize; i++) {
      const entity = new ProjectileEntity();
      this.pool.push(entity);
      this.container.addChild(entity.graphic);
    }
  }

  public syncProjectiles(states: readonly BattleProjectileState[]): void {
    while (this.pool.length < states.length) {
      const entity = new ProjectileEntity();
      this.pool.push(entity);
      this.container.addChild(entity.graphic);
    }

    for (let i = 0; i < states.length; i++) {
      this.pool[i].sync(states[i]);
    }

    for (let i = states.length; i < this.pool.length; i++) {
      if (this.pool[i].active) {
        this.pool[i].recycle();
      }
    }
  }

  public clearAll(): void {
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) {
        this.pool[i].recycle();
      }
    }
  }
}
