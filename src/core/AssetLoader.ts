import { Assets, CanvasSource, Texture, TextureStyle } from 'pixi.js';
import type { Race, UnitDefinition } from '../domain/types';

interface RacePalette {
  primary: string;
  highlight: string;
  accent: string;
  dark: string;
}

const RACE_PALETTES: Record<Race, RacePalette> = {
  TERRAN: {
    primary: '#2563eb',
    highlight: '#60a5fa',
    accent: '#f59e0b',
    dark: '#1e3a8a',
  },
  ZERG: {
    primary: '#9333ea',
    highlight: '#d946ef',
    accent: '#a3e635',
    dark: '#581c87',
  },
  PROTOSS: {
    primary: '#ca8a04',
    highlight: '#facc15',
    accent: '#38bdf8',
    dark: '#713f12',
  },
};

export class AssetLoader {
  private static initialized = false;
  private static textureCache = new Map<string, Texture>();

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
    facing: 1 | -1 = 1
  ): Texture {
    this.init();
    const cacheKey = `${def.unit_id}_${def.visual.sprite_size}_${facing}`;
    const existing = this.textureCache.get(cacheKey);
    if (existing) {
      return existing;
    }

    const texture = this.createPlaceholderUnitTexture(def, facing);
    this.textureCache.set(cacheKey, texture);
    return texture;
  }

  private static createPlaceholderUnitTexture(
    def: UnitDefinition,
    facing: 1 | -1
  ): Texture {
    const size = def.visual.sprite_size;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      const palette = RACE_PALETTES[def.race];
      const pad = Math.max(2, Math.floor(size * 0.1));
      const bodyW = size - pad * 2;
      const bodyH = size - pad * 2;

      const isAir = def.tags.includes('AIR');
      const isSiege = def.tags.includes('SIEGE');
      const isWorker = def.tags.includes('WORKER');

      ctx.save();
      if (facing === -1) {
        ctx.translate(size, 0);
        ctx.scale(-1, 1);
      }

      // Dark 1px pixel outline + silhouette by archetype
      ctx.fillStyle = '#090d14';
      if (isAir) {
        const cx = Math.floor(size / 2);
        const cy = Math.floor(size / 2);
        ctx.beginPath();
        ctx.moveTo(cx, pad);
        ctx.lineTo(size - pad, cy);
        ctx.lineTo(cx, size - pad);
        ctx.lineTo(pad, cy);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = palette.primary;
        ctx.beginPath();
        ctx.moveTo(cx, pad + 2);
        ctx.lineTo(size - pad - 2, cy);
        ctx.lineTo(cx, size - pad - 2);
        ctx.lineTo(pad + 2, cy);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = palette.highlight;
        ctx.fillRect(cx - Math.floor(size * 0.2), cy - 3, Math.floor(size * 0.4), 6);
        ctx.fillStyle = palette.accent;
        ctx.fillRect(cx - 2, cy - 2, 4, 4);
      } else if (isSiege) {
        ctx.fillRect(pad, pad + 2, bodyW, bodyH - 4);
        ctx.fillStyle = palette.dark;
        ctx.fillRect(pad + 1, pad + 3, bodyW - 2, bodyH - 6);
        ctx.fillStyle = palette.primary;
        ctx.fillRect(pad + 3, pad + 5, bodyW - 6, bodyH - 10);
        // Cannon barrel facing forward
        ctx.fillStyle = '#090d14';
        ctx.fillRect(
          Math.floor(size * 0.55),
          Math.floor(size * 0.25),
          Math.floor(size * 0.4),
          6
        );
        ctx.fillStyle = palette.highlight;
        ctx.fillRect(
          Math.floor(size * 0.57),
          Math.floor(size * 0.25) + 1,
          Math.floor(size * 0.34),
          4
        );
      } else if (isWorker) {
        ctx.fillRect(pad + 2, pad + 2, bodyW - 4, bodyH - 4);
        ctx.fillStyle = palette.primary;
        ctx.fillRect(pad + 3, pad + 3, bodyW - 6, bodyH - 6);
        ctx.fillStyle = palette.accent;
        ctx.fillRect(pad + 5, pad + 4, bodyW - 10, 4);
      } else {
        ctx.fillRect(pad + 1, pad, bodyW - 2, bodyH);
        ctx.fillStyle = palette.dark;
        ctx.fillRect(pad + 2, pad + 1, bodyW - 4, bodyH - 2);
        ctx.fillStyle = palette.primary;
        ctx.fillRect(pad + 3, pad + 2, bodyW - 6, bodyH - 5);
        ctx.fillStyle = palette.highlight;
        ctx.fillRect(pad + 4, pad + 2, bodyW - 8, 3);
        ctx.fillStyle = palette.accent;
        ctx.fillRect(Math.floor(size / 2) - 2, pad + 6, 6, 3);
      }
      ctx.restore();

      // Un-flipped crisp short-code label centered at bottom half
      const fontSize = size >= 64 ? 11 : size >= 48 ? 9 : 7;
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelY = Math.floor(size * 0.68);
      const labelX = Math.floor(size / 2);

      ctx.fillStyle = '#090d14';
      ctx.fillText(def.visual.short_code, labelX + 1, labelY + 1);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(def.visual.short_code, labelX, labelY);
    }

    const source = new CanvasSource({
      resource: canvas,
      scaleMode: 'nearest',
    });
    return new Texture({ source });
  }
}
