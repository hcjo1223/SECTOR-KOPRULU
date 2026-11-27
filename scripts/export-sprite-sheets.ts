/**
 * 스프라이트 시트 내보내기: 게임에 등장하는 모든 (아키타입, 팔레트) 조합을
 * 여백 없는 320x256 PNG(행 = 8방향, 열 = IDLE 2 + WALK 4 + ATTACK 4) + JSON 메타로 저장한다.
 * Godot / Aseprite 등 외부 엔진에서 그대로 쓴다 (Nearest 필터, 압축 끔, 피벗 = meta.pivot).
 *
 *   npm run sprites:export            → sprite-sheets/
 *   npm run sprites:export -- out/dir
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import enemies from '../src/data/survivor_enemies.json';
import factions from '../src/data/survivor_factions.json';
import units from '../src/data/survivor_units.json';
import { ALL_DIRS_8, renderSpriteSheet, SPRITE_FRAME_COUNT, SPRITE_SHEET_COLUMNS, SPRITE_SIZE } from '../src/core/SurvivorSprites';
import type { FactionPalette, SpriteArchetype } from '../src/domain/survivor/types';

const outDir = path.resolve(process.argv.slice(2).find((a) => a !== '--') ?? 'sprite-sheets');
fs.mkdirSync(outDir, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer): number => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer): Buffer => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function encodePng(width: number, height: number, rgba: Uint8ClampedArray): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

type Entry = { id: string; sprite: SpriteArchetype; palette: FactionPalette };
const entries: Entry[] = [];
const factionOf = new Map<string, FactionPalette>();
for (const f of factions as unknown as Array<{ palette: FactionPalette; unitPool: string[]; commanders: Array<{ id: string; sprite: SpriteArchetype; paletteOverride?: FactionPalette }> }>) {
  for (const u of f.unitPool) factionOf.set(u, f.palette);
  for (const c of f.commanders) entries.push({ id: c.id, sprite: c.sprite, palette: c.paletteOverride ?? f.palette });
}
for (const u of units as unknown as Array<{ id: string; sprite: SpriteArchetype; paletteOverride?: FactionPalette }>) {
  entries.push({ id: u.id, sprite: u.sprite, palette: u.paletteOverride ?? factionOf.get(u.id)! });
}
for (const e of enemies as unknown as Entry[]) entries.push({ id: e.id, sprite: e.sprite, palette: e.palette });

const hex = (c: readonly number[]): string => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
for (const { id, sprite, palette } of entries) {
  const sheet = renderSpriteSheet(sprite, palette);
  fs.writeFileSync(path.join(outDir, `${id}.png`), encodePng(sheet.width, sheet.height, sheet.data));
  const frames: Record<string, { frame: { x: number; y: number; w: number; h: number }; duration: number }> = {};
  ALL_DIRS_8.forEach((dir, row) => {
    SPRITE_SHEET_COLUMNS.forEach(({ anim, frame }, col) => {
      frames[`${dir}_${anim}_${frame}`] = {
        frame: { x: col * SPRITE_SIZE, y: row * SPRITE_SIZE, w: SPRITE_SIZE, h: SPRITE_SIZE },
        duration: anim === 'IDLE' ? 333 : anim === 'WALK' ? 100 : 70,
      };
    });
  });
  const meta = {
    frames,
    meta: {
      image: `${id}.png`,
      size: { w: sheet.width, h: sheet.height },
      frameSize: SPRITE_SIZE,
      pivot: sheet.pivot,
      directions: ALL_DIRS_8,
      animations: SPRITE_FRAME_COUNT,
      palette: sheet.palette.map(hex),
      archetype: sprite,
    },
  };
  fs.writeFileSync(path.join(outDir, `${id}.json`), `${JSON.stringify(meta, null, 1)}\n`);
}
console.log(`exported ${entries.length} sprite sheets → ${outDir}`);
