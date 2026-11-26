import type { FactionPalette, SpriteArchetype } from '../domain/survivor/types';

/**
 * 서바이벌 모드 고밀도 픽셀 스프라이트 엔진 (18x18 캔버스, 4x4 Bayer 디더링, 3D 볼륨 라이팅, 2프레임 애니메이션).
 * - 모든 아키타입은 1px 외곽선(OUTLINE_RGB = [7, 10, 16])과 내부 앰비언트 오클루전(AO) 경계선을 갖는다.
 * - 지휘관(COMMANDER)은 진영 팔레트(철갑 연합 / 적응 군체 / 성휘 교단)에 따라 고유 도트 실루엣으로 렌더링된다.
 */
export const SPRITE_SIZE = 18;

export type Rgb = [number, number, number];

export const OUTLINE_RGB: Rgb = [7, 10, 16];
const AO_SEAM_RGB: Rgb = [18, 23, 34];

const BAYER_4X4: readonly (readonly number[])[] = [
  [0 / 16, 8 / 16, 2 / 16, 10 / 16],
  [12 / 16, 4 / 16, 14 / 16, 6 / 16],
  [3 / 16, 11 / 16, 1 / 16, 9 / 16],
  [15 / 16, 7 / 16, 13 / 16, 5 / 16],
];

const ALL_ARCHETYPES: readonly SpriteArchetype[] = [
  'COMMANDER',
  'SOLDIER',
  'FLAMER',
  'WALKER',
  'DRONE',
  'CLAW',
  'SPITTER',
  'SPEWER',
  'BEETLE',
  'KNIGHT',
  'PRISM',
  'LANCER',
  'ORB',
  'MITE',
  'CRAWLER',
  'BLOATER',
  'BRUTE',
  'MATRON',
];

export function getAllArchetypes(): SpriteArchetype[] {
  return [...ALL_ARCHETYPES];
}

function hexToRgb(hex: string): Rgb {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

function lighten(c: Rgb, k: number): Rgb {
  return mixRgb(c, [255, 255, 255], k);
}

function darken(c: Rgb, k: number): Rgb {
  return mixRgb(c, [8, 10, 18], k);
}

interface ToneRamp {
  deep: Rgb;
  dark: Rgb;
  midDark: Rgb;
  mid: Rgb;
  light: Rgb;
  spec: Rgb;
}

function buildRamp(base: Rgb, shadowBase?: Rgb): ToneRamp {
  const sh = shadowBase ?? darken(base, 0.45);
  return {
    deep: darken(sh, 0.48),
    dark: sh,
    midDark: mixRgb(sh, base, 0.52),
    mid: base,
    light: lighten(base, 0.34),
    spec: lighten(base, 0.68),
  };
}

interface DerivedPalette {
  primary: ToneRamp;
  secondary: ToneRamp;
  accent: ToneRamp;
  steel: ToneRamp;
  bone: ToneRamp;
  flame: ToneRamp;
  white: Rgb;
  darkMetal: Rgb;
  crimson: Rgb;
  emerald: Rgb;
  cyan: Rgb;
}

function derivePalette(p: FactionPalette): DerivedPalette {
  const pri = hexToRgb(p.primary);
  const sec = hexToRgb(p.secondary);
  const acc = hexToRgb(p.accent);
  return {
    primary: buildRamp(pri, sec),
    secondary: buildRamp(sec, darken(sec, 0.45)),
    accent: buildRamp(acc, darken(acc, 0.42)),
    steel: buildRamp([128, 142, 165], [58, 68, 86]),
    bone: buildRamp([228, 220, 198], [124, 112, 92]),
    flame: buildRamp([255, 136, 36], [168, 34, 18]),
    white: [246, 250, 255],
    darkMetal: [30, 36, 48],
    crimson: [214, 48, 62],
    emerald: [88, 240, 148],
    cyan: [110, 232, 255],
  };
}

/**
 * 18x18 볼륨 픽셀 버퍼.
 * - 3D 법선 기반 Bayer 디더링 도형(dome, capsule, plate)
 * - 수제 픽셀 디테일(px, rect, line)
 * - 서브 레이어 AO 경계선 및 최종 1px 외곽선(OUTLINE_RGB) 패스
 */
class PixelCanvas {
  public readonly size = SPRITE_SIZE;
  public readonly data = new Uint8ClampedArray(SPRITE_SIZE * SPRITE_SIZE * 4);
  private readonly layerMask = new Uint8Array(SPRITE_SIZE * SPRITE_SIZE);

  public inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.size && y >= 0 && y < this.size;
  }

  public isOpaque(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) {
      return false;
    }
    return this.data[(y * this.size + x) * 4 + 3] > 0;
  }

  public px(x: number, y: number, c: Rgb): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (!this.inBounds(ix, iy)) {
      return;
    }
    const i = (iy * this.size + ix) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = 255;
    this.layerMask[iy * this.size + ix] = 1;
  }

  public rect(x: number, y: number, w: number, h: number, c: Rgb): void {
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) {
        this.px(x + dx, y + dy, c);
      }
    }
  }

  public hLine(x1: number, x2: number, y: number, c: Rgb): void {
    const a = Math.min(x1, x2);
    const b = Math.max(x1, x2);
    for (let x = a; x <= b; x += 1) {
      this.px(x, y, c);
    }
  }

  public vLine(x: number, y1: number, y2: number, c: Rgb): void {
    const a = Math.min(y1, y2);
    const b = Math.max(y1, y2);
    for (let y = a; y <= b; y += 1) {
      this.px(x, y, c);
    }
  }

  public sampleRamp(ramp: ToneRamp, x: number, y: number, light: number): Rgb {
    const tones: readonly Rgb[] = [ramp.deep, ramp.dark, ramp.midDark, ramp.mid, ramp.light, ramp.spec];
    const clamped = Math.max(0, Math.min(0.999, light));
    const scaled = clamped * (tones.length - 1);
    const idx = Math.floor(scaled);
    const frac = scaled - idx;
    const bayer = BAYER_4X4[((y % 4) + 4) % 4][((x % 4) + 4) % 4];
    const pick = frac > bayer ? Math.min(tones.length - 1, idx + 1) : idx;
    return tones[pick];
  }

  /** 3D 구형/타원 돔 볼륨 렌더링 (좌상단 조명: -0.45, -0.55, 0.70) */
  public dome(cx: number, cy: number, rx: number, ry: number, ramp: ToneRamp, specBoost = 0.08): void {
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const nx = (x - cx) / Math.max(0.5, rx);
        const ny = (y - cy) / Math.max(0.5, ry);
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) {
          continue;
        }
        const nz = Math.sqrt(Math.max(0, 1 - r2));
        const ndotl = Math.max(0, -0.45 * nx - 0.55 * ny + 0.7 * nz);
        const spec = Math.pow(Math.max(0, -0.35 * nx - 0.45 * ny + 0.82 * nz), 5) * specBoost;
        this.px(x, y, this.sampleRamp(ramp, x, y, Math.min(1, 0.15 + ndotl * 0.78 + spec)));
      }
    }
  }

  /** 두 점을 잇는 3D 원통 캡슐 렌더링 (팔, 다리, 포신, 촉수, 뿔) */
  public capsule(x0: number, y0: number, x1: number, y1: number, r: number, ramp: ToneRamp): void {
    const minX = Math.floor(Math.min(x0, x1) - r);
    const maxX = Math.ceil(Math.max(x0, x1) + r);
    const minY = Math.floor(Math.min(y0, y1) - r);
    const maxY = Math.ceil(Math.max(y0, y1) + r);
    const vx = x1 - x0;
    const vy = y1 - y0;
    const len2 = vx * vx + vy * vy || 1;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / len2));
        const px = x0 + vx * t;
        const py = y0 + vy * t;
        const dx = x - px;
        const dy = y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 > r * r) {
          continue;
        }
        const nx = dx / Math.max(0.5, r);
        const ny = dy / Math.max(0.5, r);
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const ndotl = Math.max(0, -0.45 * nx - 0.55 * ny + 0.7 * nz);
        this.px(x, y, this.sampleRamp(ramp, x, y, 0.18 + ndotl * 0.76));
      }
    }
  }

  /** 베벨 처리된 장갑판 렌더링 */
  public plate(x: number, y: number, w: number, h: number, ramp: ToneRamp): void {
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) {
        const px = x + dx;
        const py = y + dy;
        const u = w > 1 ? dx / (w - 1) : 0.5;
        const v = h > 1 ? dy / (h - 1) : 0.5;
        let light = 0.72 - u * 0.32 - v * 0.36;
        if (dy === 0 || dx === 0) {
          light += 0.16;
        } else if (dy === h - 1 || dx === w - 1) {
          light -= 0.18;
        }
        this.px(px, py, this.sampleRamp(ramp, px, py, light));
      }
    }
  }

  public beginLayer(): void {
    this.layerMask.fill(0);
  }

  /** 현재 서브 레이어 아래·왼쪽에 내부 AO 경계선을 넣어 부위 간 입체 분리감을 만든다 */
  public commitLayerWithAO(): void {
    const copy = new Uint8Array(this.layerMask);
    for (let y = 1; y < this.size - 1; y += 1) {
      for (let x = 1; x < this.size - 1; x += 1) {
        if (copy[y * this.size + x] !== 1) {
          continue;
        }
        // 아래쪽 또는 왼쪽 픽셀이 이전 레이어의 불투명 픽셀이면 AO 경계선 부여
        const belowIdx = (y + 1) * this.size + x;
        if (copy[belowIdx] === 0 && this.isOpaque(x, y + 1)) {
          const i = belowIdx * 4;
          this.data[i] = AO_SEAM_RGB[0];
          this.data[i + 1] = AO_SEAM_RGB[1];
          this.data[i + 2] = AO_SEAM_RGB[2];
        }
      }
    }
    this.layerMask.fill(0);
  }

  /** 모든 불투명 픽셀 둘레에 1px 암색 외곽선(OUTLINE_RGB)을 입힌다 */
  public applyOutline(): void {
    const snap = new Uint8ClampedArray(this.data);
    const isSnapOpaque = (x: number, y: number): boolean => {
      if (!this.inBounds(x, y)) {
        return false;
      }
      return snap[(y * this.size + x) * 4 + 3] > 0;
    };

    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        if (isSnapOpaque(x, y)) {
          continue;
        }
        let touches = false;
        for (const [dx, dy] of dirs) {
          if (isSnapOpaque(x + dx, y + dy)) {
            touches = true;
            break;
          }
        }
        if (touches) {
          const i = (y * this.size + x) * 4;
          this.data[i] = OUTLINE_RGB[0];
          this.data[i + 1] = OUTLINE_RGB[1];
          this.data[i + 2] = OUTLINE_RGB[2];
          this.data[i + 3] = 255;
        }
      }
    }

    // 가장자리(0 또는 size-1)에 닿은 불투명 픽셀은 실루엣 닫힘을 위해 외곽선 색으로 마감
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        if ((x === 0 || x === this.size - 1 || y === 0 || y === this.size - 1) && isSnapOpaque(x, y)) {
          const i = (y * this.size + x) * 4;
          this.data[i] = OUTLINE_RGB[0];
          this.data[i + 1] = OUTLINE_RGB[1];
          this.data[i + 2] = OUTLINE_RGB[2];
          this.data[i + 3] = 255;
        }
      }
    }
  }
}

function detectCommanderFaction(palette: FactionPalette): 'IRONCLAD' | 'HIVE' | 'LUMEN' {
  const [r, g, b] = hexToRgb(palette.primary);
  if (r > 180 && g > 150 && b < 130) {
    return 'LUMEN';
  }
  if (r > g + 20 && b > g + 20) {
    return 'HIVE';
  }
  return 'IRONCLAD';
}

// ─────────────────────────── 진영별 지휘관 & 유닛 도트 렌더러 ───────────────────────────

function drawCommander(c: PixelCanvas, p: DerivedPalette, f: number): void {
  const kind = detectCommanderFaction({
    primary: `#${p.primary.mid.map((v) => v.toString(16).padStart(2, '0')).join('')}`,
    secondary: '#000000',
    accent: '#000000',
  });

  if (kind === 'HIVE') {
    // 적응 군체 지휘관: [군체 의지] — 4자루 뼈낫과 발광 신경관을 지닌 브루드 여왕
    c.beginLayer();
    // 꿈틀거리는 꼬리 + 점액선
    c.capsule(4, 14, 10 + f, 15, 1.8, p.secondary);
    c.capsule(6, 11, 5, 14, 2.0, p.primary);
    c.px(4, 15, p.accent.light);
    c.px(9 + f, 15, p.accent.mid);
    // 분절 흉부 갑피
    c.dome(9, 9, 3.8, 3.6, p.primary);
    c.hLine(7, 11, 8, p.secondary.dark);
    c.hLine(7, 11, 10, p.secondary.dark);
    c.px(9, 9, p.accent.light);
    c.commitLayerWithAO();

    // 네 자루 생체 뼈낫
    c.beginLayer();
    c.capsule(6, 7, 3, 4 - f, 1.1, p.secondary);
    c.hLine(2, 4, 3 - f, p.bone.light);
    c.px(2, 4 - f, p.accent.light);

    c.capsule(11, 7, 14, 4 - f, 1.1, p.secondary);
    c.hLine(13, 15, 3 - f, p.bone.light);
    c.px(15, 4 - f, p.bone.spec);
    c.px(15, 5 - f, p.accent.light);

    c.capsule(11, 10, 15, 9 + f, 1.1, p.primary);
    c.hLine(13, 15, 10 + f, p.bone.mid);
    c.commitLayerWithAO();

    // 여왕 두개골 & 발광 신경 크라운
    c.beginLayer();
    c.dome(9, 4.5, 3.5, 2.6, p.primary);
    c.px(7, 2, p.bone.light);
    c.px(9, 1, p.accent.spec);
    c.px(11, 2, p.bone.light);
    // 3개의 사이오닉 신경 핵 + 복안
    c.px(8, 3, p.accent.light);
    c.px(9, 3, p.white);
    c.px(10, 4, p.accent.spec);
    c.px(12, 4, p.accent.light);
    c.px(12, 6, p.bone.light);
    c.commitLayerWithAO();
    return;
  }

  if (kind === 'LUMEN') {
    // 성휘 교단 지휘관: [대주교] — 부유하는 광휘 헤일로와 쌍날 차원 창을 든 신관
    c.beginLayer();
    // 발밑 부유 공명 링
    c.hLine(6 - f, 11 + f, 15, p.accent.mid);
    c.hLine(7, 10, 15, p.accent.spec);
    // 등 뒤의 부유 카이다린 광배(Halo)
    c.px(4, 3 - f, p.accent.light);
    c.px(5, 2, p.primary.light);
    c.px(9, 1, p.accent.spec);
    c.px(12, 2, p.primary.light);
    c.px(13, 3 - f, p.accent.light);
    // 황금 예복 & 사이오닉 타바드
    c.capsule(8, 10, 7, 14, 1.8, p.secondary);
    c.capsule(10, 10, 11, 14, 1.8, p.secondary);
    c.vLine(9, 9, 14, p.accent.mid);
    c.px(9, 11, p.accent.spec);
    c.commitLayerWithAO();

    // 황금 흉갑 & 견갑
    c.beginLayer();
    c.dome(9, 8, 3.5, 3.0, p.primary);
    c.dome(5.5, 7, 1.8, 1.8, p.primary);
    c.dome(12.5, 7, 1.8, 1.8, p.primary);
    c.px(5, 7, p.accent.light);
    c.px(12, 7, p.accent.light);
    c.px(9, 8, p.accent.spec);
    c.commitLayerWithAO();

    // 대주교 투구
    c.beginLayer();
    c.dome(9, 4.5, 2.5, 2.3, p.primary);
    c.vLine(9, 2, 3, p.primary.spec);
    c.px(8, 5, p.accent.spec);
    c.px(10, 5, p.accent.spec);
    c.commitLayerWithAO();

    // 쌍날 광휘 차원 창 (Warp-Glaive)
    c.beginLayer();
    c.vLine(14, 4, 13, p.primary.mid);
    c.vLine(15, 2 - f, 6, p.accent.light);
    c.vLine(14, 2 - f, 4, p.white);
    c.vLine(15, 11, 14 + f, p.accent.mid);
    c.commitLayerWithAO();
    return;
  }

  // 철갑 연합 지휘관: [현장 사령관] — 전술 망토, 지휘 안테나, 황금 문장, 쌍열 가우스 소총
  c.beginLayer();
  // 전술 망토 (뒤쪽)
  c.plate(3, 7, 4, 7 + f, p.secondary);
  c.vLine(3, 8, 13 + f, p.crimson);
  // 장갑 부츠 (2프레임 보행)
  c.capsule(7, 11, 6 - f, 15, 1.5, p.primary);
  c.capsule(10, 11, 11 + f, 15, 1.5, p.primary);
  c.commitLayerWithAO();

  // 강화복 동체 & 대형 견갑
  c.beginLayer();
  c.dome(8.5, 8.5, 3.8, 3.2, p.primary);
  c.dome(5.5, 7, 2.0, 2.0, p.primary);
  c.dome(11.8, 7, 2.0, 2.0, p.primary);
  // 황금 독수리 흉부 문장 & 견갑 테두리
  c.hLine(7, 10, 7, p.accent.light);
  c.px(8, 8, p.accent.spec);
  c.px(9, 8, p.accent.mid);
  c.px(5, 6, p.accent.mid);
  c.px(12, 6, p.accent.mid);
  // 지휘 비콘 안테나
  c.vLine(5, 2, 5, p.steel.mid);
  c.px(5, 1, f === 0 ? p.accent.spec : p.crimson);
  c.commitLayerWithAO();

  // 사령관 헬멧 & 전술 바이저
  c.beginLayer();
  c.dome(8.5, 4.3, 2.7, 2.3, p.primary);
  c.hLine(8, 9, 2, p.accent.light);
  c.hLine(8, 11, 4, p.accent.spec);
  c.px(10, 4, p.white);
  c.commitLayerWithAO();

  // 쌍열 지휘관용 가우스 소총
  c.beginLayer();
  c.plate(7, 9, 8, 2, p.steel);
  c.hLine(8, 15, 9, p.darkMetal);
  c.hLine(9, 14, 8, p.steel.light);
  c.px(10, 8, p.accent.light);
  c.px(8, 11, p.darkMetal);
  if (f === 1) {
    c.px(16, 8, p.accent.spec);
    c.px(16, 9, p.white);
  }
  c.commitLayerWithAO();
}

function drawSoldier(c: PixelCanvas, p: DerivedPalette, f: number): void {
  // 소총병 (Rifleman): CMC 전투복 + 바이저 헬멧 + C-14 가우스 소총
  c.beginLayer();
  c.plate(4, 6, 3, 5, p.secondary); // 등 백팩
  c.capsule(7, 11, 7 - f, 15, 1.4, p.primary);
  c.capsule(10, 11, 10 + f, 15, 1.4, p.primary);
  c.commitLayerWithAO();

  c.beginLayer();
  c.dome(8.5, 8.5, 3.4, 3.0, p.primary);
  c.dome(6, 7.5, 1.8, 1.8, p.primary);
  c.dome(11.5, 7.5, 1.8, 1.8, p.primary);
  c.px(8, 7, p.primary.spec);
  c.commitLayerWithAO();

  c.beginLayer();
  c.dome(8.5, 4.5, 2.5, 2.2, p.primary);
  c.hLine(8, 11, 4, p.accent.light);
  c.px(10, 4, p.accent.spec);
  c.commitLayerWithAO();

  // 가우스 소총
  c.beginLayer();
  c.hLine(7, 15, 9, p.darkMetal);
  c.hLine(8, 14, 8, p.steel.mid);
  c.px(11, 8, p.steel.spec);
  c.px(9, 10, p.darkMetal);
  c.px(15, 9, p.steel.light);
  c.commitLayerWithAO();
}

function drawFlamer(c: PixelCanvas, p: DerivedPalette, f: number): void {
  // 화염 방사병 (Flamer): 등면 쌍열 연료통 + 방열 금색 안면 바이저 + 파일럿 화염 노즐
  c.beginLayer();
  // 등면 프로메튬 연료 실린더 2기
  c.capsule(3.5, 4.5, 3.5, 10.5, 1.6, p.flame);
  c.capsule(5.5, 4.5, 5.5, 10.5, 1.5, p.secondary);
  c.px(3, 5, p.accent.spec);
  c.px(3, 8, p.darkMetal);
  // 중장갑 다리
  c.capsule(7, 11, 6 - f, 15, 1.6, p.primary);
  c.capsule(10.5, 11, 11 + f, 15, 1.6, p.primary);
  c.commitLayerWithAO();

  // 방열 중장갑 흉갑 & 대형 견갑
  c.beginLayer();
  c.dome(9, 8.5, 3.8, 3.3, p.primary);
  c.dome(6, 7, 2.1, 2.0, p.primary);
  c.dome(12, 7, 2.1, 2.0, p.primary);
  c.px(6, 6, p.accent.mid);
  c.px(12, 6, p.accent.mid);
  c.commitLayerWithAO();

  // 방열 돔 헬멧 & 대형 금색 반사 바이저
  c.beginLayer();
  c.dome(9, 4.3, 2.7, 2.3, p.primary);
  c.rect(8, 3, 3, 2, p.accent.mid);
  c.px(9, 3, p.accent.spec);
  c.px(10, 4, p.white);
  c.commitLayerWithAO();

  // 화염 방사기 & 노즐 파일럿 불꽃
  c.beginLayer();
  c.plate(7, 8, 7, 3, p.steel);
  c.hLine(7, 14, 10, p.darkMetal);
  c.px(14, 9, p.flame.mid);
  c.px(15, 8 - f, p.flame.light);
  c.px(16, 8, f === 0 ? p.accent.spec : p.white);
  c.px(15, 9, p.flame.spec);
  c.commitLayerWithAO();
}

function drawWalker(c: PixelCanvas, p: DerivedPalette, f: number): void {
  // 박격 보행기 (Mortar Walker Mech): 상부 대구경 박격포 + 장갑 조종석 + 역관절 이족 보행 다리
  c.beginLayer();
  // 역관절 기계 다리 2기
  const lShift = f === 0 ? 0 : 1;
  const rShift = f === 0 ? 1 : 0;
  c.capsule(6, 10, 5, 13 - lShift, 1.3, p.steel);
  c.capsule(5, 13 - lShift, 6, 15, 1.3, p.secondary);
  c.hLine(4, 7, 15, p.steel.mid);

  c.capsule(11, 10, 12, 13 - rShift, 1.3, p.steel);
  c.capsule(12, 13 - rShift, 11, 15, 1.3, p.secondary);
  c.hLine(10, 13, 15, p.steel.mid);
  c.commitLayerWithAO();

  // 등면 대구경 박격포신 (대각선 상향)
  c.beginLayer();
  c.capsule(5, 5, 10, 2, 1.9, p.steel);
  c.px(10, 2, p.darkMetal);
  c.px(11, 2, p.darkMetal);
  c.px(7, 3, p.accent.mid);
  c.px(8, 4, p.accent.light);
  c.commitLayerWithAO();

  // 장갑 워커 동체 & 조종석 센서
  c.beginLayer();
  c.plate(4, 5, 9, 5, p.primary);
  c.hLine(5, 12, 5, p.primary.light);
  c.hLine(9, 12, 7, p.accent.spec);
  c.px(11, 7, p.white);
  c.hLine(5, 11, 9, p.secondary.dark);
  c.px(5, 7, p.accent.mid);
  c.commitLayerWithAO();
}

function drawDrone(c: PixelCanvas, p: DerivedPalette, f: number): void {
  // 수리 드론 (Repair Drone): 호버링 8각 동체 + 의무 십자(+) 마크 + 하부 나노 용접 암 & 추력 제트
  const yOff = f === 0 ? 0 : -1;
  c.beginLayer();
  // 좌우 호버링 추력 포드 & 분사광
  c.plate(3, 6 + yOff, 2, 4, p.steel);
  c.plate(13, 6 + yOff, 2, 4, p.steel);
  c.px(3, 10 + yOff, p.cyan);
  c.px(14, 10 + yOff, p.cyan);
  if (f === 1) {
    c.px(3, 11 + yOff, p.white);
    c.px(14, 11 + yOff, p.white);
  }
  c.commitLayerWithAO();

  // 중앙 돔 새시 & 의무 십자(+) 마크
  c.beginLayer();
  c.dome(9, 7 + yOff, 4.2, 3.2, p.primary);
  c.px(9, 3 + yOff, p.accent.spec);
  // 녹색/백색 나노 수리 십자 문양
  c.vLine(9, 5 + yOff, 9 + yOff, p.white);
  c.hLine(7, 11, 7 + yOff, p.white);
  c.px(9, 7 + yOff, p.emerald);
  c.commitLayerWithAO();

  // 하부 나노 수리 암 & 에메랄드 용접 스파크
  c.beginLayer();
  c.vLine(9, 10 + yOff, 12 + yOff, p.steel.mid);
  c.hLine(9, 12, 12 + yOff, p.steel.light);
  c.px(13, 12 + yOff, p.emerald);
  c.px(13 + f, 11 + yOff, p.white);
  c.commitLayerWithAO();
}

function drawClaw(c: PixelCanvas, p: DerivedPalette, f: number): void {
  // 갈퀴충 (Clawling): 4족 보행 돌격형 랩터 + 등면 대형 쌍뼈낫 + 산성 안구
  c.beginLayer();
  // 4족 다리 (2프레임 질주)
  c.capsule(5, 11, 4 - f, 14, 1.1, p.secondary);
  c.capsule(7, 11, 7 + f, 15, 1.1, p.primary);
  c.capsule(10, 11, 10 - f, 15, 1.1, p.primary);
  c.capsule(12, 11, 14 + f, 14, 1.1, p.secondary);
  c.commitLayerWithAO();

  // 분절 등껍질 & 척추 가시
  c.beginLayer();
  c.capsule(5, 9, 12, 8, 2.5, p.primary);
  c.px(5, 6, p.accent.mid);
  c.px(7, 6, p.accent.light);
  c.px(9, 5, p.accent.mid);
  c.hLine(6, 10, 9, p.secondary.dark);
  c.commitLayerWithAO();

  // 포식자 두개골 & 송곳니
  c.beginLayer();
  c.dome(12.5, 8, 2.4, 2.0, p.primary);
  c.px(13, 7, p.accent.spec);
  c.px(14, 7, p.white);
  c.px(14, 9, p.bone.light);
  c.px(15, 9, p.bone.spec);
  c.commitLayerWithAO();

  // 등면 대형 뼈낫 (Reaper Scythes)
  c.beginLayer();
  const sY = f === 0 ? 3 : 4;
  c.capsule(8, 6, 12, sY, 1.1, p.secondary);
  c.hLine(12, 15, sY, p.bone.light);
  c.px(15, sY + 1, p.bone.spec);
  c.px(16, sY + 2, p.accent.light);
  c.commitLayerWithAO();
}

function drawSpitter(c: PixelCanvas, p: DerivedPalette, f: number): void {
  // 가시 투척충 (Spitter): 히드라형 후드 갑피 + 등면 발사 골침 열 + 발광 독낭
  c.beginLayer();
  // 뱀형 하체 & 지지 발톱
  c.capsule(5, 13, 10 + f, 14, 1.7, p.secondary);
  c.capsule(6, 10, 5, 13, 1.9, p.primary);
  c.px(4, 15, p.bone.mid);
  c.px(11 + f, 15, p.bone.mid);
  c.commitLayerWithAO();

  // 등면 발사 대기 골침(Spines) 4개
  c.beginLayer();
  c.vLine(4, 4, 7, p.bone.light);
  c.px(4, 3, p.accent.spec);
  c.vLine(6, 3, 6, p.bone.spec);
  c.px(6, 2, p.accent.spec);
  c.vLine(8, 3, 6, p.bone.light);
  c.commitLayerWithAO();

  // 아치형 흉부 & 발광 생체 독낭
  c.beginLayer();
  c.dome(9, 8.5, 3.2, 3.2, p.primary);
  c.dome(11, 9.5, 2.0, 1.8, p.accent);
  c.px(11, 9, p.white);
  c.commitLayerWithAO();

  // 확장된 후드 크레스트 & 발사 턱
  c.beginLayer();
  c.dome(10.5, 5, 3.2, 2.2, p.primary);
  c.px(12, 5, p.accent.spec);
  c.hLine(13, 15 + f, 6, p.bone.light);
  c.hLine(13, 15, 8, p.bone.mid);
  if (f === 1) {
    c.px(16, 7, p.accent.spec);
  }
  c.commitLayerWithAO();
}

function drawSpewer(c: PixelCanvas, p: DerivedPalette, f: number): void {
  // 산성 분사체 (Acid Spewer): 등 위에 거대하게 부풀어 오른 형광 산성 주머니 + 산성 침 흘리는 중장갑 주둥이
  c.beginLayer();
  c.capsule(5, 12, 4 - f, 15, 1.3, p.secondary);
  c.capsule(8, 12, 8 + f, 15, 1.3, p.secondary);
  c.capsule(11, 12, 12 - f, 15, 1.3, p.secondary);
  c.commitLayerWithAO();

  // 하부 키틴 복부
  c.beginLayer();
  c.dome(8.5, 10, 4.5, 2.6, p.primary);
  c.commitLayerWithAO();

  // 거대 발광 산성 주머니 (2프레임 맥동)
  c.beginLayer();
  c.dome(7.5, 6.2, 4.4 + f * 0.3, 3.6 + f * 0.2, p.accent, 0.2);
  // 주머니 위 혈관 무늬 & 하이라이트
  c.px(6, 4, p.white);
  c.px(7, 4, p.white);
  c.px(8, 7, p.primary.dark);
  c.px(6, 8, p.primary.dark);
  c.commitLayerWithAO();

  // 전면 장갑 두개골 & 산성 분사구
  c.beginLayer();
  c.dome(12.5, 8.5, 2.6, 2.4, p.primary);
  c.px(13, 8, p.accent.spec);
  c.px(15, 9, p.accent.light);
  c.px(15, 10 + f, p.accent.spec);
  c.px(14, 12, p.accent.mid);
  c.commitLayerWithAO();
}

function drawBeetle(c: PixelCanvas, p: DerivedPalette, f: number): void {
  // 껍질 갑충 (Carapace Beetle): 18x18을 가득 채우는 중장갑 갑충 + 거대 초승달 카이저 뿔 한 쌍
  c.beginLayer();
  // 6개의 육중한 다리
  for (let i = 0; i < 3; i += 1) {
    const lx = 4 + i * 3;
    const shift = (i + f) % 2 === 0 ? 0 : 1;
    c.capsule(lx, 12, lx - 1 + shift, 15, 1.3, p.secondary);
  }
  c.commitLayerWithAO();

  // 다중 분절 돔 등껍질
  c.beginLayer();
  c.dome(7.5, 8, 5.2, 4.5, p.primary);
  c.vLine(5, 4, 11, p.secondary.dark);
  c.vLine(8, 4, 11, p.secondary.dark);
  // 등껍질 생체 발광 통기공
  c.px(4, 7, p.accent.light);
  c.px(7, 6, p.accent.spec);
  c.px(10, 7, p.accent.light);
  c.commitLayerWithAO();

  // 장갑 두부 & 거대 카이저 뿔(Kaiser Blades)
  c.beginLayer();
  c.dome(12, 8.5, 2.5, 2.6, p.secondary);
  c.px(13, 8, p.accent.spec);
  // 상단 거대 뿔
  c.capsule(12, 6, 15, 3 - f, 1.3, p.bone);
  c.px(16, 3 - f, p.bone.spec);
  // 하단 거대 턱뿔
  c.capsule(12, 11, 15, 13 + f, 1.3, p.bone);
  c.px(16, 13 + f, p.bone.spec);
  c.commitLayerWithAO();
}

function drawKnight(c: PixelCanvas, p: DerivedPalette, f: number): void {
  // 수호 기사 (Aegis Warden): 황금 성기사 갑주 + 이지스 타워 실드 + 푸른 광휘 차원검
  c.beginLayer();
  c.capsule(7, 11, 7 - f, 15, 1.4, p.primary);
  c.capsule(10, 11, 10 + f, 15, 1.4, p.primary);
  c.commitLayerWithAO();

  // 황금 흉갑 & 견갑
  c.beginLayer();
  c.dome(8.5, 8.5, 3.4, 3.0, p.primary);
  c.dome(11.5, 7, 1.8, 1.8, p.primary);
  c.px(9, 8, p.accent.spec);
  c.commitLayerWithAO();

  // 성기사 투구 & 볏
  c.beginLayer();
  c.dome(8.5, 4.5, 2.5, 2.3, p.primary);
  c.vLine(8, 1, 3, p.primary.spec);
  c.hLine(8, 10, 4, p.accent.spec);
  c.commitLayerWithAO();

  // 좌측 이지스 타워 실드
  c.beginLayer();
  c.plate(3, 6, 3, 6, p.primary);
  c.vLine(4, 7, 11, p.accent.light);
  c.px(4, 9, p.white);
  c.commitLayerWithAO();

  // 우측 광휘 차원검 (Psionic Warp-Blade)
  c.beginLayer();
  c.hLine(12, 15, 9, p.primary.light);
  c.vLine(14, 2 - f, 8, p.accent.light);
  c.vLine(13, 3 - f, 8, p.white);
  c.px(14, 1, p.white);
  c.commitLayerWithAO();
}

function drawPrism(c: PixelCanvas, p: DerivedPalette, f: number): void {
  // 프리즘 포대 (Prism Turret): 4개의 황금 부유 파일런에 둘러싸인 다면체 굴절 수정 코어
  const yOff = f === 0 ? 0 : -1;
  c.beginLayer();
  // 하부 반중력 파동 링
  c.hLine(6, 11, 15, p.accent.mid);
  c.hLine(7, 10, 15, p.accent.spec);

  // 4개의 황금 구속 파일런 (좌상/우상/좌하/우하)
  c.plate(3, 3 + yOff, 2, 3, p.primary);
  c.plate(13, 3 + yOff, 2, 3, p.primary);
  c.plate(3, 10 + yOff, 2, 3, p.primary);
  c.plate(13, 10 + yOff, 2, 3, p.primary);
  c.commitLayerWithAO();

  // 중앙 팔면체 프리즘 결정 코어
  c.beginLayer();
  for (let dy = -5; dy <= 5; dy += 1) {
    const span = 5 - Math.abs(dy);
    for (let dx = -span; dx <= span; dx += 1) {
      const x = 9 + dx;
      const y = 8 + yOff + dy;
      const light = 0.78 - dx * 0.08 - dy * 0.08;
      c.px(x, y, c.sampleRamp(p.accent, x, y, light));
    }
  }
  // 내부 굴절 백색광 십자 코어
  c.vLine(9, 5 + yOff, 11 + yOff, p.white);
  c.hLine(6, 12, 8 + yOff, p.white);
  if (f === 1) {
    c.px(2, 8 + yOff, p.accent.spec);
    c.px(15, 8 + yOff, p.accent.spec);
  }
  c.commitLayerWithAO();
}

function drawLancer(c: PixelCanvas, p: DerivedPalette, f: number): void {
  // 광선 창병 (Radiant Lancer): 후방으로 뻗은 황금 투구 볏 + 전방을 꿰뚫는 장대한 프리즘 광선창
  c.beginLayer();
  c.capsule(6, 11, 5 - f, 15, 1.3, p.primary);
  c.capsule(9, 11, 10 + f, 15, 1.3, p.primary);
  c.commitLayerWithAO();

  c.beginLayer();
  c.dome(8, 8.5, 3.1, 2.8, p.primary);
  c.dome(5.5, 7, 1.6, 1.6, p.primary);
  c.commitLayerWithAO();

  // 뒤로 젖혀진 유선형 황금 투구
  c.beginLayer();
  c.dome(8, 4.5, 2.6, 2.1, p.primary);
  c.hLine(4, 7, 3, p.primary.light);
  c.hLine(8, 10, 4, p.accent.spec);
  c.commitLayerWithAO();

  // 장대한 프리즘 광선창 (x: 3..16 가로 관통)
  c.beginLayer();
  const thrust = f;
  c.hLine(3, 10 + thrust, 8, p.primary.mid);
  c.vLine(10 + thrust, 6, 10, p.primary.spec); // 황금 창 코등이
  c.hLine(11 + thrust, 15 + thrust, 8, p.white);
  c.hLine(11 + thrust, 14 + thrust, 7, p.accent.light);
  c.hLine(11 + thrust, 14 + thrust, 9, p.accent.mid);
  c.px(16, 8, p.white);
  c.commitLayerWithAO();
}

function drawOrb(c: PixelCanvas, p: DerivedPalette, f: number): void {
  // 공명 구체 (Resonance Orb): 교차하는 황금 자이로 링 + 백열하는 사이오닉 특이점 코어 + 방전 아크
  c.beginLayer();
  // 외부 황금 자이로 링
  c.dome(9, 9, 5.5, 5.5, p.primary);
  // 내부 사이오닉 플라즈마 구체
  c.dome(9, 9, 3.8, 3.8, p.accent, 0.25);
  c.dome(9, 9, 2.0, 2.0, buildRamp(p.white, p.accent.light));
  // 황금 궤도 밴드
  c.hLine(4, 14, 9, p.primary.light);
  c.px(9, 9, p.white);

  // 2프레임 교차 사이오닉 방전 스파크
  if (f === 0) {
    c.px(3, 3, p.accent.spec);
    c.px(15, 3, p.accent.spec);
    c.px(3, 15, p.accent.spec);
    c.px(15, 15, p.accent.spec);
  } else {
    c.px(9, 2, p.white);
    c.px(9, 16, p.white);
    c.px(2, 9, p.white);
    c.px(16, 9, p.white);
  }
  c.commitLayerWithAO();
}

// ─────────────────────────── 블라이트 무리 (적 5종) ───────────────────────────

function drawMite(c: PixelCanvas, p: DerivedPalette, f: number): void {
  // 블라이트 진드기 (Mite): 재빠른 기생 진드기 — 부푼 핏빛 복부 + 6개의 관절 다리 + 노란 집게턱
  c.beginLayer();
  for (let i = 0; i < 3; i += 1) {
    const lx = 6 + i * 2;
    const s = (i + f) % 2 === 0 ? 0 : 1;
    c.px(lx, 5 - s, p.secondary.mid);
    c.px(lx, 13 + s, p.secondary.mid);
  }
  c.dome(8, 9, 3.6, 2.8, p.primary);
  c.px(7, 8, p.accent.mid);
  c.dome(11.5, 9, 1.8, 1.8, p.secondary);
  c.px(12, 8, p.accent.spec);
  c.px(13 + f, 8, p.accent.light);
  c.px(13 + f, 10, p.accent.light);
  c.commitLayerWithAO();
}

function drawCrawler(c: PixelCanvas, p: DerivedPalette, f: number): void {
  // 블라이트 기어충 (Crawler): 다중 분절 갑각과 등가시, 겹눈과 톱니 턱을 지닌 절지 괴수
  c.beginLayer();
  for (let i = 0; i < 3; i += 1) {
    const lx = 5 + i * 3;
    const s = (i + f) % 2 === 0 ? 0 : 1;
    c.capsule(lx, 11, lx - 1 + s, 14, 1.0, p.secondary);
  }
  c.commitLayerWithAO();

  c.beginLayer();
  c.dome(6, 9, 2.6, 2.4, p.primary);
  c.dome(9, 8.5, 2.8, 2.6, p.primary);
  c.px(5, 5, p.accent.mid);
  c.px(8, 5, p.accent.light);
  c.commitLayerWithAO();

  c.beginLayer();
  c.dome(12.2, 8.2, 2.4, 2.2, p.secondary);
  c.px(12, 7, p.accent.spec);
  c.px(13, 7, p.white);
  c.hLine(13, 15, 9 + f, p.bone.light);
  c.px(15, 8, p.bone.spec);
  c.commitLayerWithAO();
}

function drawBloater(c: PixelCanvas, p: DerivedPalette, f: number): void {
  // 블라이트 부풀이 (Bloater): 비대칭 맹독 농포 3개가 맥동하며 부풀어 오른 자폭·맹독 괴체
  c.beginLayer();
  c.capsule(6, 12, 5 - f, 15, 1.4, p.secondary);
  c.capsule(11, 12, 12 + f, 15, 1.4, p.secondary);
  c.commitLayerWithAO();

  // 괴사한 외피 & 3개의 거대 발광 독성 농포
  c.beginLayer();
  c.dome(8.5, 9.5, 5.0, 3.8, p.primary);
  c.dome(6.5, 6.0, 2.8 + f * 0.3, 2.6 + f * 0.3, p.accent, 0.22);
  c.dome(10.5, 5.8, 2.4, 2.3 + f * 0.3, p.accent, 0.22);
  c.dome(8.0, 8.5, 2.2, 2.0, p.accent);
  c.px(6, 5, p.white);
  c.px(10, 5, p.white);
  c.commitLayerWithAO();

  // 일그러진 두부 & 흘러내리는 독액
  c.beginLayer();
  c.dome(13, 10, 2.0, 2.0, p.secondary);
  c.px(13, 9, p.accent.spec);
  c.px(15, 11 + f, p.accent.light);
  c.px(14, 13, p.accent.spec);
  c.commitLayerWithAO();
}

function drawBrute(c: PixelCanvas, p: DerivedPalette, f: number): void {
  // 블라이트 파쇄충 (Brute): 황소 뿔과 붉게 타오르는 흉부 코어, 대지를 내려치는 거대 주먹의 중장갑 괴수
  c.beginLayer();
  c.capsule(6, 11, 5, 15 - f, 1.7, p.secondary);
  c.capsule(11, 11, 12, 15 - (1 - f), 1.7, p.secondary);
  c.commitLayerWithAO();

  // 거대 보랏빛 장갑 흉곽 & 붉은 노출 코어
  c.beginLayer();
  c.dome(8.5, 7.8, 4.8, 4.2, p.primary);
  c.vLine(8, 6, 10, p.accent.mid);
  c.vLine(9, 6, 10, p.accent.spec);
  c.hLine(7, 10, 8, p.accent.light);
  c.commitLayerWithAO();

  // 쌍황소 뿔 & 4안 포식자 두개골
  c.beginLayer();
  c.dome(9.5, 5.2, 3.0, 2.4, p.secondary);
  c.capsule(6, 4, 4, 2, 1.2, p.bone);
  c.capsule(12, 4, 14, 2, 1.2, p.bone);
  c.px(9, 5, p.accent.spec);
  c.px(11, 5, p.accent.spec);
  c.px(10, 6, p.white);
  c.commitLayerWithAO();

  // 대지 분쇄 거대 주먹 (전면)
  c.beginLayer();
  const slam = f === 1 ? 1 : 0;
  c.capsule(12, 7, 14, 12 + slam, 2.0, p.primary);
  c.px(15, 11 + slam, p.bone.light);
  c.px(15, 13 + slam, p.bone.spec);
  c.commitLayerWithAO();
}

function drawMatron(c: PixelCanvas, p: DerivedPalette, f: number): void {
  // 블라이트 모체 (MATRON — 최종 보스): 5개의 황금 생체 왕관 뿔, 5개의 안구, 중앙 심연 아가리, 좌우 집게발과 하부 촉수
  c.beginLayer();
  // 하부 꿈틀거리는 촉수 4가닥
  for (let i = 0; i < 4; i += 1) {
    const tx = 4 + i * 3;
    const wave = (i + f) % 2 === 0 ? -1 : 1;
    c.capsule(tx, 12, tx + wave, 15, 1.2, p.secondary);
    c.px(tx + wave, 15, p.accent.light);
  }
  c.commitLayerWithAO();

  // 좌우 거대 분쇄 집게발
  c.beginLayer();
  c.capsule(4, 8, 2, 6 - f, 1.6, p.primary);
  c.px(2, 5 - f, p.bone.spec);
  c.capsule(13, 8, 15, 6 - f, 1.6, p.primary);
  c.px(15, 5 - f, p.bone.spec);
  c.commitLayerWithAO();

  // 모체 거대 흉부 & 황금 왕관 뿔 5개
  c.beginLayer();
  c.dome(8.5, 8.2, 5.6, 5.0, p.primary);
  const hornXs = [4, 6, 9, 11, 13];
  for (const hx of hornXs) {
    c.vLine(hx, 2, 4, p.accent.light);
    c.px(hx, 1, p.accent.spec);
  }
  // 5개의 황금빛 포식 안구 아치
  c.px(5, 5, p.accent.spec);
  c.px(7, 4, p.white);
  c.px(9, 4, p.accent.spec);
  c.px(11, 4, p.white);
  c.px(12, 5, p.accent.spec);
  c.commitLayerWithAO();

  // 흉부 한가운데의 심연 아가리 (이빨 링 + 암흑 식도)
  c.beginLayer();
  c.dome(8.5, 9.2, 3.0, 2.4 + f * 0.4, p.secondary);
  c.rect(7, 8, 4, 3 + f, [14, 6, 12]);
  // 날카로운 송곳니 배열
  c.px(7, 8, p.bone.spec);
  c.px(9, 8, p.bone.spec);
  c.px(10, 8, p.bone.spec);
  c.px(7, 10 + f, p.bone.light);
  c.px(9, 10 + f, p.bone.light);
  c.px(10, 10 + f, p.bone.light);
  c.commitLayerWithAO();
}

/**
 * 순수 함수: 아키타입 + 팔레트 + 애니메이션 프레임(0|1) → 18x18 RGBA 픽셀 버퍼.
 * DOM에 의존하지 않으므로 단위 테스트와 프리렌더 양쪽에서 즉시 동작한다.
 */
export function renderSpritePixels(
  archetype: SpriteArchetype,
  palette: FactionPalette,
  frame: number = 0
): { width: number; height: number; data: Uint8ClampedArray } {
  const canvas = new PixelCanvas();
  const derived = derivePalette(palette);
  const f = Math.abs(Math.round(frame)) % 2;

  switch (archetype) {
    case 'COMMANDER':
      drawCommander(canvas, derived, f);
      break;
    case 'SOLDIER':
      drawSoldier(canvas, derived, f);
      break;
    case 'FLAMER':
      drawFlamer(canvas, derived, f);
      break;
    case 'WALKER':
      drawWalker(canvas, derived, f);
      break;
    case 'DRONE':
      drawDrone(canvas, derived, f);
      break;
    case 'CLAW':
      drawClaw(canvas, derived, f);
      break;
    case 'SPITTER':
      drawSpitter(canvas, derived, f);
      break;
    case 'SPEWER':
      drawSpewer(canvas, derived, f);
      break;
    case 'BEETLE':
      drawBeetle(canvas, derived, f);
      break;
    case 'KNIGHT':
      drawKnight(canvas, derived, f);
      break;
    case 'PRISM':
      drawPrism(canvas, derived, f);
      break;
    case 'LANCER':
      drawLancer(canvas, derived, f);
      break;
    case 'ORB':
      drawOrb(canvas, derived, f);
      break;
    case 'MITE':
      drawMite(canvas, derived, f);
      break;
    case 'CRAWLER':
      drawCrawler(canvas, derived, f);
      break;
    case 'BLOATER':
      drawBloater(canvas, derived, f);
      break;
    case 'BRUTE':
      drawBrute(canvas, derived, f);
      break;
    case 'MATRON':
      drawMatron(canvas, derived, f);
      break;
  }

  canvas.applyOutline();
  return { width: canvas.size, height: canvas.size, data: canvas.data };
}

/** 하위 호환용 ASCII 실루엣 맵 추출기 */
export function getSpriteMap(archetype: SpriteArchetype): readonly string[] {
  const buf = renderSpritePixels(archetype, {
    primary: '#4f7fb8',
    secondary: '#2d4a6e',
    accent: '#f2c14e',
  });
  const rows: string[] = [];
  for (let y = 0; y < buf.height; y += 1) {
    let row = '';
    for (let x = 0; x < buf.width; x += 1) {
      const i = (y * buf.width + x) * 4;
      if (buf.data[i + 3] === 0) {
        row += '.';
      } else if (
        buf.data[i] === OUTLINE_RGB[0] &&
        buf.data[i + 1] === OUTLINE_RGB[1] &&
        buf.data[i + 2] === OUTLINE_RGB[2]
      ) {
        row += 'o';
      } else {
        row += 'p';
      }
    }
    rows.push(row);
  }
  return rows;
}

/**
 * 3단계 경험치 결정(XP Gem) 11x11 픽셀 스프라이트 생성기 (2프레임 반짝임).
 * - tier 1: 청록 광물 파편 (Cyan Mineral Shard)
 * - tier 2: 에메랄드 생체 결정 (Emerald Bio-Core)
 * - tier 3: 황금 카이다린 코어 (Golden Khaydarin Cluster)
 */
export function renderGemPixels(
  tier: 1 | 2 | 3,
  frame: number = 0
): { width: number; height: number; data: Uint8ClampedArray } {
  const size = 11;
  const data = new Uint8ClampedArray(size * size * 4);
  const f = Math.abs(Math.round(frame)) % 2;

  const setPx = (x: number, y: number, c: Rgb): void => {
    if (x < 0 || x >= size || y < 0 || y >= size) {
      return;
    }
    const i = (y * size + x) * 4;
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
    data[i + 3] = 255;
  };

  const base: Rgb =
    tier === 3 ? [242, 172, 58] : tier === 2 ? [64, 224, 130] : [78, 212, 242];
  const dark: Rgb =
    tier === 3 ? [118, 58, 16] : tier === 2 ? [22, 92, 54] : [24, 78, 108];
  const light: Rgb = lighten(base, 0.42);
  const white: Rgb = [248, 252, 255];

  const radius = tier === 3 ? 4 : tier === 2 ? 3 : 2;
  const cx = 5;
  const cy = 5;

  // 다이아몬드 결정 다면체 렌더링
  for (let dy = -radius; dy <= radius; dy += 1) {
    const span = radius - Math.abs(dy);
    for (let dx = -span; dx <= span; dx += 1) {
      let col = base;
      if (dx < 0 && dy <= 0) {
        col = light;
      } else if (dx > 0 && dy >= 0) {
        col = dark;
      }
      setPx(cx + dx, cy + dy, col);
    }
  }
  // 중심 코어 하이라이트
  setPx(cx, cy, white);
  setPx(cx - 1, cy - 1, white);
  if (tier >= 2) {
    setPx(cx, cy - 1, light);
    setPx(cx - 1, cy, light);
  }

  // 1px 외곽선 패스
  const snap = new Uint8ClampedArray(data);
  const isOp = (x: number, y: number): boolean =>
    x >= 0 && x < size && y >= 0 && y < size && snap[(y * size + x) * 4 + 3] > 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (isOp(x, y)) {
        continue;
      }
      if (isOp(x - 1, y) || isOp(x + 1, y) || isOp(x, y - 1) || isOp(x, y + 1)) {
        setPx(x, y, OUTLINE_RGB);
      }
    }
  }

  // 프레임별 반짝임 스파크 픽셀
  if (f === 0) {
    setPx(cx - radius, cy - radius + 1, white);
  } else {
    setPx(cx + radius, cy - radius + 1, white);
    if (tier === 3) {
      setPx(cx, cy - radius - 1, white);
    }
  }

  return { width: size, height: size, data };
}

/**
 * 적응 군체(HIVE) 점액 자취(Slime Patch) 28x28 디더링 픽셀 데칼 생성기 (2프레임 기포 애니메이션).
 */
export function renderSlimeTilePixels(
  palette: FactionPalette,
  frame: number = 0
): { width: number; height: number; data: Uint8ClampedArray } {
  const size = 28;
  const data = new Uint8ClampedArray(size * size * 4);
  const f = Math.abs(Math.round(frame)) % 2;
  const pri = hexToRgb(palette.primary);
  const sec = hexToRgb(palette.secondary);
  const acc = hexToRgb(palette.accent);
  const crust = darken(sec, 0.45);
  const midPool = mixRgb(sec, acc, 0.38);
  const brightAcid = lighten(acc, 0.25);

  const cx = 13.5;
  const cy = 13.5;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const angle = Math.atan2(dy, dx);
      // 유기적인 비정형 점막 경계
      const wobble =
        Math.sin(angle * 3 + 0.7) * 1.4 +
        Math.cos(angle * 5 - 1.1) * 0.9 +
        (f === 1 ? Math.sin(angle * 4) * 0.4 : 0);
      const dist = Math.hypot(dx, dy) + wobble;
      if (dist > 12.6) {
        continue;
      }
      const bayer = BAYER_4X4[y % 4][x % 4];
      let col: Rgb;
      let alpha = 215;
      if (dist > 11.2) {
        if (bayer > 0.65) {
          continue;
        }
        col = crust;
        alpha = 180;
      } else if (dist > 8.6) {
        col = bayer < 0.5 ? sec : pri;
      } else if (dist > 4.8) {
        col = bayer < 0.45 ? midPool : acc;
      } else {
        col = bayer < 0.35 ? brightAcid : acc;
      }
      const i = (y * size + x) * 4;
      data[i] = col[0];
      data[i + 1] = col[1];
      data[i + 2] = col[2];
      data[i + 3] = alpha;
    }
  }

  // 점막 기포(Bubbles) & 신경 줄기 디테일
  const setBubble = (bx: number, by: number, c: Rgb): void => {
    const i = (by * size + bx) * 4;
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
    data[i + 3] = 245;
  };
  if (f === 0) {
    setBubble(10, 11, brightAcid);
    setBubble(11, 11, [245, 255, 210]);
    setBubble(17, 15, brightAcid);
    setBubble(13, 18, sec);
  } else {
    setBubble(10, 10, [245, 255, 210]);
    setBubble(16, 14, [245, 255, 210]);
    setBubble(17, 14, brightAcid);
    setBubble(12, 17, brightAcid);
  }

  return { width: size, height: size, data };
}

/**
 * 코프룰루 변경 황무지(Badlands & Outpost Grating) 64x64 심리스 픽셀 지면 타일 생성기.
 */
export function renderGroundTilePixels(): { width: number; height: number; data: Uint8ClampedArray } {
  const size = 64;
  const data = new Uint8ClampedArray(size * size * 4);
  const baseDark: Rgb = [14, 18, 26];
  const baseMid: Rgb = [18, 24, 34];
  const baseLight: Rgb = [23, 30, 42];
  const plateDark: Rgb = [20, 27, 39];
  const plateLight: Rgb = [28, 37, 52];
  const seam: Rgb = [10, 13, 20];

  const setPx = (x: number, y: number, c: Rgb): void => {
    const wx = ((x % size) + size) % size;
    const wy = ((y % size) + size) % size;
    const i = (wy * size + wx) * 4;
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
    data[i + 3] = 255;
  };

  // 1) Bayer 디더링 기반 현무암 지층 배경
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const wave =
        Math.sin((x + y) * ((Math.PI * 2) / 32)) * 0.25 +
        Math.cos((x - y * 2) * ((Math.PI * 2) / 64)) * 0.2;
      const bayer = BAYER_4X4[y % 4][x % 4] - 0.5;
      const v = wave + bayer * 0.35;
      const col = v < -0.12 ? baseDark : v > 0.16 ? baseLight : baseMid;
      setPx(x, y, col);
    }
  }

  // 2) 매립된 구형 전초기지 금속 격자 패널 (좌상단 16x16 구역)
  for (let py = 6; py < 22; py += 1) {
    for (let px = 8; px < 24; px += 1) {
      if (px === 8 || py === 6) {
        setPx(px, py, plateLight);
      } else if (px === 23 || py === 21) {
        setPx(px, py, seam);
      } else if ((px + py) % 4 === 0) {
        setPx(px, py, plateLight);
      } else {
        setPx(px, py, plateDark);
      }
    }
  }
  // 패널 모서리 리벳
  setPx(10, 8, [40, 52, 72]);
  setPx(21, 8, [40, 52, 72]);
  setPx(10, 19, [40, 52, 72]);
  setPx(21, 19, [40, 52, 72]);

  // 3) 피탄 크레이터 2개 (좌상단 그늘 + 우하단 하이라이트 림)
  const craters = [
    { cx: 44, cy: 18, r: 4 },
    { cx: 26, cy: 46, r: 5 },
  ];
  for (const cr of craters) {
    for (let dy = -cr.r; dy <= cr.r; dy += 1) {
      for (let dx = -cr.r; dx <= cr.r; dx += 1) {
        const d = Math.hypot(dx, dy);
        if (d <= cr.r - 1.2) {
          setPx(cr.cx + dx, cr.cy + dy, seam);
        } else if (d <= cr.r + 0.3) {
          setPx(cr.cx + dx, cr.cy + dy, dx + dy < 0 ? seam : plateLight);
        }
      }
    }
  }

  // 4) 미세 균열 및 광물 자갈 디테일
  const pebbles: readonly [number, number, Rgb][] = [
    [52, 42, plateLight],
    [53, 42, seam],
    [14, 36, plateLight],
    [15, 37, seam],
    [36, 10, plateLight],
    [48, 54, [38, 56, 76]],
    [12, 56, plateLight],
  ];
  for (const [px, py, col] of pebbles) {
    setPx(px, py, col);
  }

  // 5) 전술 그리드 미세 가이드 도트 (32px 간격)
  for (let g = 0; g < size; g += 4) {
    setPx(g, 0, plateDark);
    setPx(0, g, plateDark);
  }

  return { width: size, height: size, data };
}

