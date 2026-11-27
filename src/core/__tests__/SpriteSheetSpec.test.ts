import { describe, expect, it } from 'vitest';
import enemies from '../../data/survivor_enemies.json';
import factions from '../../data/survivor_factions.json';
import units from '../../data/survivor_units.json';
import type { FactionPalette, SpriteArchetype } from '../../domain/survivor/types';
import {
  ALL_DIRS_8,
  SPRITE_BASELINE_Y,
  SPRITE_FRAME_COUNT,
  SPRITE_MAX_COLORS,
  SPRITE_SIZE,
  renderSpritePixels,
  renderSpriteSheet,
  type SpriteAnim,
} from '../SurvivorSprites';

/**
 * 스프라이트 시트 사양:
 * 32x32 논리 프레임 · 스프라이트당 16색 · IDLE 2 / WALK 4 / ATTACK 4
 * 프레임별 얼굴·의상·크기·중심점·발 기준선 유지 · 여백·텍스트·그림자·안티앨리어싱 없음
 */

// 게임에 실제로 등장하는 (아키타입, 팔레트) 조합 전부: 지휘관·분대·진화형·적
const cases = new Map<string, { id: string; sprite: SpriteArchetype; palette: FactionPalette }>();
const factionOf = new Map<string, FactionPalette>();
for (const f of factions as unknown as Array<{ palette: FactionPalette; unitPool: string[]; commanders: Array<{ id: string; sprite: SpriteArchetype; paletteOverride?: FactionPalette }> }>) {
  for (const u of f.unitPool) factionOf.set(u, f.palette);
  for (const c of f.commanders) {
    const palette = c.paletteOverride ?? f.palette;
    cases.set(c.sprite + JSON.stringify(palette), { id: c.id, sprite: c.sprite, palette });
  }
}
for (const u of units as unknown as Array<{ id: string; sprite: SpriteArchetype; paletteOverride?: FactionPalette; evolvesFrom?: string }>) {
  const palette = u.paletteOverride ?? factionOf.get(u.id) ?? (factions as unknown as Array<{ palette: FactionPalette }>)[0].palette;
  cases.set(u.sprite + JSON.stringify(palette), { id: u.id, sprite: u.sprite, palette });
}
for (const e of enemies as unknown as Array<{ id: string; sprite: SpriteArchetype; palette: FactionPalette }>) {
  cases.set(e.sprite + JSON.stringify(e.palette), { id: e.id, sprite: e.sprite, palette: e.palette });
}
const ANIMS: SpriteAnim[] = ['IDLE', 'WALK', 'ATTACK'];

/** 몸통 중심: 몸통 띠(10~23행) 불투명 픽셀 x의 중앙값. 다리를 드는 걷기·무기 휘두름에 흔들리지 않는다 */
const bodyCenter = (d: Uint8ClampedArray): number => {
  const xs: number[] = [];
  for (let y = 10; y <= 23; y += 1) {
    for (let x = 0; x < SPRITE_SIZE; x += 1) {
      if (d[(y * SPRITE_SIZE + x) * 4 + 3] > 0) xs.push(x);
    }
  }
  xs.sort((p, q) => p - q);
  return xs.length ? xs[xs.length >> 1] : 0;
};

describe('sprite sheet spec', () => {
  it('covers every unit, commander, evolution and enemy sprite in the game', () => {
    expect(cases.size).toBeGreaterThanOrEqual(40);
  });

  for (const { id, sprite, palette } of cases.values()) {
    it(`${id} (${sprite}): 32x32, <=16 colors, 2/4/4 distinct frames, fixed baseline & pivot, no alpha blending`, () => {
      const colors = new Set<string>();
      for (const dir of ALL_DIRS_8) {
        const ref = renderSpritePixels(sprite, palette, 0, dir, 'IDLE');
        const refCenter = bodyCenter(ref.data);
        for (const anim of ANIMS) {
          const frames = new Set<string>();
          for (let f = 0; f < SPRITE_FRAME_COUNT[anim]; f += 1) {
            const b = renderSpritePixels(sprite, palette, f, dir, anim);
            expect(b.width).toBe(SPRITE_SIZE);
            expect(b.height).toBe(SPRITE_SIZE);
            let bottom = -1;
            for (let i = 0; i < b.data.length; i += 4) {
              const a = b.data[i + 3];
              // 안티앨리어싱·반투명 그림자 금지: 완전 투명 또는 완전 불투명
              expect(a === 0 || a === 255).toBe(true);
              if (a === 255) {
                colors.add(`${b.data[i]},${b.data[i + 1]},${b.data[i + 2]}`);
                bottom = Math.max(bottom, Math.floor(i / 4 / SPRITE_SIZE));
              }
            }
            // 발 기준선 고정
            expect(bottom, `${dir} ${anim} ${f} baseline`).toBe(SPRITE_BASELINE_Y);
            // 중심점 유지: 몸통은 예비동작·반동의 1px 기울기 외에는 움직이지 않는다
            expect(Math.abs(bodyCenter(b.data) - refCenter), `${dir} ${anim} ${f} pivot`).toBeLessThanOrEqual(2);
            frames.add(Array.from(b.data).join(','));
            // 프레임 번호는 상태별 프레임 수로 순환한다
            expect(Array.from(renderSpritePixels(sprite, palette, f + SPRITE_FRAME_COUNT[anim], dir, anim).data).join(',')).toBe(
              Array.from(b.data).join(',')
            );
          }
          expect(frames.size, `${dir} ${anim} distinct frames`).toBe(SPRITE_FRAME_COUNT[anim]);
        }
      }
      expect(colors.size).toBeLessThanOrEqual(SPRITE_MAX_COLORS);
    });
  }

  it('packs a margin-free 320x256 sheet (10 frames x 8 directions) per sprite', () => {
    const { sprite, palette } = [...cases.values()][0];
    const sheet = renderSpriteSheet(sprite, palette);
    expect(sheet.width).toBe(10 * SPRITE_SIZE);
    expect(sheet.height).toBe(8 * SPRITE_SIZE);
    expect(sheet.pivot).toEqual({ x: 16, y: SPRITE_BASELINE_Y });
    expect(sheet.palette.length).toBeLessThanOrEqual(SPRITE_MAX_COLORS);
    // 첫 셀 = S 방향 IDLE 0
    const cell = renderSpritePixels(sprite, palette, 0, 'S', 'IDLE').data;
    for (let y = 0; y < SPRITE_SIZE; y += 1) {
      for (let x = 0; x < SPRITE_SIZE * 4; x += 1) {
        expect(sheet.data[y * sheet.width * 4 + x]).toBe(cell[y * SPRITE_SIZE * 4 + x]);
      }
    }
  });
});
