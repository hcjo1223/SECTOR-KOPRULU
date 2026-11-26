import { describe, expect, it } from 'vitest';
import { getAllArchetypes, OUTLINE_RGB, renderSpritePixels, SPRITE_SIZE } from '../SurvivorSprites';

describe('SurvivorSprites', () => {
  it('every archetype renders a 12x12 image with outline pixels', () => {
    const palette = { primary: '#4f7fb8', secondary: '#2d4a6e', accent: '#f2c14e' };
    for (const a of getAllArchetypes()) {
      const buf = renderSpritePixels(a, palette);
      expect(buf.width).toBe(SPRITE_SIZE);
      let opaque = 0;
      let outline = 0;
      for (let i = 0; i < buf.data.length; i += 4) {
        if (buf.data[i + 3] > 0) {
          opaque += 1;
          if (buf.data[i] === OUTLINE_RGB[0] && buf.data[i + 1] === OUTLINE_RGB[1] && buf.data[i + 2] === OUTLINE_RGB[2]) outline += 1;
        }
      }
      expect(opaque).toBeGreaterThan(20);
      expect(outline).toBeGreaterThan(8);
    }
  });
});
