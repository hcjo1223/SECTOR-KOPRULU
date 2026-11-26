import { Assets, CanvasSource, Texture, TextureStyle } from 'pixi.js';
import type { UnitDefinition } from '../domain/types';
import { renderUnitPixelBuffer } from './PixelArtSprites';

export class AssetLoader {
  private static initialized = false;
  private static textureCache = new Map<string, Texture>();
  private static dataUrlCache = new Map<string, string>();

  public static init(): void {
    if (this.initialized) {
      return;
    }
    TextureStyle.defaultOptions.scaleMode = 'nearest';
    this.initialized = true;
  }

  public static async preloadAtlasIfAvailable(atlasPath: string): Promise<boolean> {
    this.init();
    try {
      await Assets.load(atlasPath);
      return true;
    } catch {
      return false;
    }
  }

  public static getUnitTexture(
    def: UnitDefinition,
    facing: 1 | -1 = 1,
    frame: number = 0
  ): Texture {
    this.init();
    const normFrame = frame % 2;
    const cacheKey = `${def.unit_id}_${def.visual.sprite_size}_${facing}_f${normFrame}`;
    const existing = this.textureCache.get(cacheKey);
    if (existing) {
      return existing;
    }

    const canvas = this.createPixelCanvas(def, facing, normFrame);
    const source = new CanvasSource({
      resource: canvas,
      scaleMode: 'nearest',
    });
    const texture = new Texture({ source });
    this.textureCache.set(cacheKey, texture);
    return texture;
  }

  public static getUnitDataUrl(
    def: UnitDefinition,
    facing: 1 | -1 = 1,
    frame: number = 0
  ): string {
    this.init();
    const normFrame = frame % 2;
    const cacheKey = `${def.unit_id}_${def.visual.sprite_size}_${facing}_f${normFrame}`;
    const existing = this.dataUrlCache.get(cacheKey);
    if (existing) {
      return existing;
    }

    const canvas = this.createPixelCanvas(def, facing, normFrame);
    const url = canvas.toDataURL('image/png');
    this.dataUrlCache.set(cacheKey, url);
    return url;
  }

  private static createPixelCanvas(
    def: UnitDefinition,
    facing: 1 | -1,
    frame: number
  ): HTMLCanvasElement {
    const pixelBuf = renderUnitPixelBuffer(def, facing, frame);
    const canvas = document.createElement('canvas');
    canvas.width = pixelBuf.width;
    canvas.height = pixelBuf.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      const imageData = ctx.createImageData(pixelBuf.width, pixelBuf.height);
      imageData.data.set(pixelBuf.data);
      ctx.putImageData(imageData, 0, 0);
    }
    return canvas;
  }
}
