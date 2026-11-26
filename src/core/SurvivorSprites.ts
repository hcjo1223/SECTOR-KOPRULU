import type { FactionPalette, SpriteArchetype } from '../domain/survivor/types';

/**
 * 서바이벌 모드 32x32 하이엔드 픽셀 스프라이트 엔진.
 * - 사용자 레퍼런스 해병(Idle_rotations_8dir.gif, 32x32, 50색 클러스터 셰이딩 + 내부 1px 흑색 장갑 경계선 + 하이라이트 클러스터 + 금장 트림 + 발광 안구)의
 *   32x32 픽셀 밀도와 조형 규칙을 전 진영(철갑 연합 / 적응 군체 / 성휘 교단) 및 블라이트 무리 20종 전체에 동일하게 적용한다.
 */
export const SPRITE_SIZE = 32;

export type Rgb = [number, number, number];

/** 외곽선 및 내부 장갑판/갑피 분리선 색상 (#070a10) */
export const OUTLINE_RGB: Rgb = [7, 10, 16];

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
  return mixRgb(c, [10, 12, 24], k);
}

/**
 * 레퍼런스 해병(Idle_rotations_8dir.gif) 원본 50색 팔레트 & 32x32 픽셀 매트릭스.
 */
const MARINE_REF_PALETTE: Readonly<Record<string, string>> = {
  '0': '#070a10',
  '1': '#6586b5',
  '2': '#454d8b',
  '3': '#3f4584',
  '4': '#546a9f',
  '5': '#a0bee9',
  '6': '#daf4fd',
  '7': '#373874',
  '8': '#131b34',
  '9': '#d06d1a',
  a: '#5c75a8',
  b: '#29275a',
  c: '#31306a',
  d: '#e99a17',
  e: '#eea218',
  f: '#110e23',
  g: '#b9daf4',
  h: '#fed75a',
  i: '#aed1f1',
  j: '#c4551f',
  k: '#847f7a',
  l: '#f4ae1f',
  m: '#091d32',
  n: '#8ea9da',
  o: '#c1e3fa',
  p: '#ceecfc',
  q: '#d3781b',
  r: '#25ffe1',
  s: '#b44a23',
  t: '#717073',
  u: '#093953',
  v: '#9a9a9c',
  w: '#4d5e99',
  x: '#19213d',
  y: '#212226',
  z: '#809fcc',
  A: '#14102b',
  B: '#0d0e11',
  C: '#151b29',
  D: '#161921',
  E: '#919090',
  F: '#2a2b2f',
  G: '#625f65',
  H: '#88aad3',
  I: '#191534',
  J: '#69686d',
  K: '#3c414d',
  L: '#262850',
  M: '#222547',
  N: '#f9cc4b',
};

const MARINE_REF_GRID: readonly string[] = [
  '................................',
  '..........00.......00...........',
  '.........0120.....03400.........',
  '........0561300000021650........',
  '........04780349943083a0........',
  '........0b0c021de120cfb0........',
  '.....000020031ghhi12002000......',
  '....024112j03klmmlk30j31120.....',
  '...022i66ih030noon030hp66d20....',
  '...b2166o1h0n006600n0h1666120...',
  '..0b311111q030r13r030q111q1270..',
  '..0s331222j00tuttut00j224117s0..',
  '...0j333q30202tvvt20303q322j0...',
  '...00jqq190wj00tt00s2091qqj00...',
  '....b00000xows0000saox00000by...',
  '..0z032bA0276213313p320bb230z0..',
  '.09h900b003q31qhhq13q300b009h90.',
  '.0e626j0.003a300003a300.0j636a0.',
  '.0hBp430..0000b5570000..034p140.',
  '.0hB1130..00s0x66x0s00..03111e0.',
  '.0q6000..0730sC33Ds0b20..000p10.',
  '.030EFt0.01p30c44b03p10.0tFE020.',
  '..0GE0F0.00H3I0bb0I3zB0.0F0EJ0..',
  '..0yKt0.0660wb0000b20660.0tKy0..',
  '...000.0011b00....00b1100.000...',
  '.......0s32sc0....0cs32s0.......',
  '.......07ssbc0....0cbss30.......',
  '.......0LL3b0......0b3bM0.......',
  '......02g18b0......0b81g20......',
  '......09Nqj00......00jqN90......',
  '.......0000..........0000.......',
  '................................',
];

interface ClusterRamp8 {
  c0: Rgb;
  c1: Rgb;
  c2: Rgb;
  c3: Rgb;
  c4: Rgb;
  c5: Rgb;
  c6: Rgb;
  c7: Rgb;
}

interface TrimRamp5 {
  t0: Rgb;
  t1: Rgb;
  t2: Rgb;
  t3: Rgb;
  t4: Rgb;
}

interface StudioPalette {
  body: ClusterRamp8;
  trim: TrimRamp5;
  metal: TrimRamp5;
  bone: TrimRamp5;
  crimson: TrimRamp5;
  eyeGlow: Rgb;
  eyeSocket: Rgb;
  white: Rgb;
}

function makeRamp8(pri: Rgb, sec: Rgb, specTint: Rgb = [218, 244, 253]): ClusterRamp8 {
  return {
    c0: darken(sec, 0.58),
    c1: darken(sec, 0.28),
    c2: sec,
    c3: mixRgb(sec, pri, 0.32),
    c4: mixRgb(sec, pri, 0.68),
    c5: pri,
    c6: mixRgb(pri, specTint, 0.52),
    c7: mixRgb(pri, specTint, 0.88),
  };
}

function makeTrim5(acc: Rgb, rustShift: Rgb = [180, 74, 35]): TrimRamp5 {
  return {
    t0: mixRgb(rustShift, darken(acc, 0.5), 0.5),
    t1: mixRgb(rustShift, acc, 0.32),
    t2: mixRgb(rustShift, acc, 0.62),
    t3: acc,
    t4: lighten(acc, 0.48),
  };
}

function buildStudioPalette(p: FactionPalette): StudioPalette {
  const pri = hexToRgb(p.primary);
  const sec = hexToRgb(p.secondary);
  const acc = hexToRgb(p.accent);
  return {
    body: makeRamp8(pri, sec),
    trim: makeTrim5(acc),
    metal: {
      t0: [33, 34, 38],
      t1: [48, 52, 62],
      t2: [113, 112, 115],
      t3: [154, 154, 156],
      t4: [215, 224, 235],
    },
    bone: {
      t0: [64, 52, 42],
      t1: [108, 92, 76],
      t2: [162, 144, 122],
      t3: [216, 202, 180],
      t4: [248, 244, 232],
    },
    crimson: {
      t0: [62, 14, 26],
      t1: [112, 22, 38],
      t2: [168, 34, 52],
      t3: [224, 56, 72],
      t4: [255, 164, 168],
    },
    eyeGlow: [37, 255, 225],
    eyeSocket: [9, 29, 50],
    white: [248, 253, 255],
  };
}

class SculptCanvas32 {
  public readonly size = SPRITE_SIZE;
  public readonly data = new Uint8ClampedArray(SPRITE_SIZE * SPRITE_SIZE * 4);

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
  }

  public clearPx(x: number, y: number): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (!this.inBounds(ix, iy)) {
      return;
    }
    const i = (iy * this.size + ix) * 4;
    this.data[i] = 0;
    this.data[i + 1] = 0;
    this.data[i + 2] = 0;
    this.data[i + 3] = 0;
  }

  public symClearPx(x: number, y: number): void {
    this.clearPx(x, y);
    this.clearPx(31 - x, y);
  }

  public symPx(x: number, y: number, c: Rgb): void {
    this.px(x, y, c);
    this.px(31 - x, y, c);
  }

  public rect(x: number, y: number, w: number, h: number, c: Rgb): void {
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) {
        this.px(x + dx, y + dy, c);
      }
    }
  }

  public symRect(x: number, y: number, w: number, h: number, c: Rgb): void {
    this.rect(x, y, w, h, c);
    this.rect(32 - x - w, y, w, h, c);
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

  public symVLine(x: number, y1: number, y2: number, c: Rgb): void {
    this.vLine(x, y1, y2, c);
    this.vLine(31 - x, y1, y2, c);
  }

  public partDome(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    ramp: ClusterRamp8,
    opts?: {
      trim?: TrimRamp5;
      trimBottom?: boolean;
      trimInnerSide?: 'LEFT' | 'RIGHT' | 'BOTH';
      specOffsetX?: number;
      specOffsetY?: number;
    }
  ): void {
    const x0 = Math.floor(cx - rx - 1);
    const x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1);
    const y1 = Math.ceil(cy + ry + 1);

    const inside = (x: number, y: number): boolean => {
      const nx = (x - cx) / Math.max(0.5, rx);
      const ny = (y - cy) / Math.max(0.5, ry);
      return nx * nx + ny * ny <= 1.0;
    };

    const sx = opts?.specOffsetX ?? -0.22;
    const sy = opts?.specOffsetY ?? -0.32;

    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if (!inside(x, y)) {
          if (
            inside(x - 1, y) ||
            inside(x + 1, y) ||
            inside(x, y - 1) ||
            inside(x, y + 1)
          ) {
            this.px(x, y, OUTLINE_RGB);
          }
          continue;
        }

        const nx = (x - cx) / Math.max(0.5, rx);
        const ny = (y - cy) / Math.max(0.5, ry);

        if (opts?.trim) {
          const tr = opts.trim;
          const isBottomRim = opts.trimBottom && !inside(x, y + 1);
          const isLeftRim =
            (opts.trimInnerSide === 'LEFT' || opts.trimInnerSide === 'BOTH') &&
            !inside(x - 1, y) &&
            Math.abs(ny) < 0.72;
          const isRightRim =
            (opts.trimInnerSide === 'RIGHT' || opts.trimInnerSide === 'BOTH') &&
            !inside(x + 1, y) &&
            Math.abs(ny) < 0.72;

          if (isLeftRim || isRightRim) {
            const tc = ny < -0.2 ? tr.t4 : ny < 0.25 ? tr.t3 : tr.t1;
            this.px(x, y, tc);
            continue;
          }
          if (isBottomRim) {
            const tc = Math.abs(nx) < 0.35 ? tr.t2 : tr.t0;
            this.px(x, y, tc);
            continue;
          }
        }

        const dSpec = Math.hypot(nx - sx, ny - sy);
        let col: Rgb;
        if (dSpec < 0.34) {
          col = ramp.c7;
        } else if (dSpec < 0.56) {
          col = ramp.c6;
        } else if (dSpec < 0.85) {
          col = ramp.c5;
        } else if (dSpec < 1.1) {
          col = ramp.c4;
        } else if (ny < 0.45) {
          col = ramp.c3;
        } else if (ny < 0.75) {
          col = ramp.c2;
        } else {
          col = ramp.c1;
        }
        this.px(x, y, col);
      }
    }
  }

  public symPartDome(
    leftCx: number,
    cy: number,
    rx: number,
    ry: number,
    ramp: ClusterRamp8,
    opts?: {
      trim?: TrimRamp5;
      trimBottom?: boolean;
      trimInner?: boolean;
    }
  ): void {
    this.partDome(leftCx, cy, rx, ry, ramp, {
      trim: opts?.trim,
      trimBottom: opts?.trimBottom,
      trimInnerSide: opts?.trimInner ? 'RIGHT' : undefined,
      specOffsetX: 0.1,
      specOffsetY: -0.28,
    });
    this.partDome(31 - leftCx, cy, rx, ry, ramp, {
      trim: opts?.trim,
      trimBottom: opts?.trimBottom,
      trimInnerSide: opts?.trimInner ? 'LEFT' : undefined,
      specOffsetX: -0.1,
      specOffsetY: -0.28,
    });
  }

  public partCapsule(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    r: number,
    ramp: ClusterRamp8
  ): void {
    const minX = Math.floor(Math.min(x0, x1) - r - 1);
    const maxX = Math.ceil(Math.max(x0, x1) + r + 1);
    const minY = Math.floor(Math.min(y0, y1) - r - 1);
    const maxY = Math.ceil(Math.max(y0, y1) + r + 1);
    const vx = x1 - x0;
    const vy = y1 - y0;
    const len2 = vx * vx + vy * vy || 1;

    const distSq = (x: number, y: number): { d2: number; nx: number; ny: number } => {
      const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / len2));
      const px = x0 + vx * t;
      const py = y0 + vy * t;
      const dx = x - px;
      const dy = y - py;
      return {
        d2: dx * dx + dy * dy,
        nx: dx / Math.max(0.5, r),
        ny: dy / Math.max(0.5, r),
      };
    };

    const r2 = r * r;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const cur = distSq(x, y);
        if (cur.d2 > r2) {
          if (
            distSq(x - 1, y).d2 <= r2 ||
            distSq(x + 1, y).d2 <= r2 ||
            distSq(x, y - 1).d2 <= r2 ||
            distSq(x, y + 1).d2 <= r2
          ) {
            this.px(x, y, OUTLINE_RGB);
          }
          continue;
        }
        const dSpec = Math.hypot(cur.nx + 0.2, cur.ny + 0.35);
        const col =
          dSpec < 0.42
            ? ramp.c7
            : dSpec < 0.72
              ? ramp.c5
              : dSpec < 1.05
                ? ramp.c3
                : ramp.c1;
        this.px(x, y, col);
      }
    }
  }

  public symPartCapsule(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    r: number,
    ramp: ClusterRamp8
  ): void {
    this.partCapsule(x0, y0, x1, y1, r, ramp);
    this.partCapsule(31 - x0, y0, 31 - x1, y1, r, ramp);
  }

  /**
   * 레퍼런스 해병의 두개골·바이저·마스크 구조처럼 콧대(Nasal Bridge)로 분리된 V자형 발광 안구 및 장갑 마스크를 조각한다.
   * (단순 검은 직사각형 막대가 아니라 입체적인 눈구멍 + 콧대 + 발광 눈동자 + 하악골 구조)
   */
  public sculptVisorFace(
    cy: number,
    body: ClusterRamp8,
    trim: TrimRamp5,
    eyeCol: Rgb,
    maskMode: 'RESPIRATOR' | 'TEMPLAR' | 'FANGS'
  ): void {
    // 이마 중앙 볏 & 아이스화이트 브로우
    this.symPx(15, cy - 3, trim.t3);
    this.symPx(15, cy - 2, trim.t4);
    this.symPx(14, cy - 1, body.c6);
    this.symPx(15, cy - 1, body.c7);
    // 좌우 분리된 V자형 안구 소켓 (중앙 15,16번 픽셀은 콧대 장갑으로 분리!)
    this.symPx(13, cy - 1, OUTLINE_RGB);
    this.symPx(12, cy, OUTLINE_RGB);
    this.symPx(13, cy, eyeCol);
    this.symPx(14, cy, lighten(eyeCol, 0.55));
    this.symPx(15, cy, body.c4); // 콧대
    this.symPx(12, cy + 1, OUTLINE_RGB);
    this.symPx(13, cy + 1, darken(eyeCol, 0.45));
    this.symPx(14, cy + 1, OUTLINE_RGB);
    this.symPx(15, cy + 1, body.c5);

    if (maskMode === 'RESPIRATOR') {
      // 해병식 금속 호흡기 마스크
      this.symPx(13, cy + 2, [113, 112, 115]);
      this.symPx(14, cy + 2, [154, 154, 156]);
      this.symPx(15, cy + 2, [210, 215, 222]);
      this.symPx(14, cy + 3, [113, 112, 115]);
      this.symPx(15, cy + 3, [154, 154, 156]);
      this.symPx(13, cy + 3, OUTLINE_RGB);
    } else if (maskMode === 'TEMPLAR') {
      // 프로토스/성휘 교단식 매끈한 황금 면갑 + 이마 카이다린 보석
      this.symPx(15, cy - 2, eyeCol);
      this.symPx(14, cy + 2, body.c5);
      this.symPx(15, cy + 2, body.c6);
      this.symPx(14, cy + 3, trim.t2);
      this.symPx(15, cy + 3, trim.t4);
    } else {
      // 저그/블라이트식 포식자 송곳니 아가리
      this.symPx(12, cy + 2, [248, 244, 232]); // 외측 대송곳니
      this.symPx(13, cy + 2, OUTLINE_RGB);
      this.symPx(14, cy + 2, [248, 244, 232]); // 내측 송곳니
      this.symPx(15, cy + 2, [112, 22, 38]);
      this.symPx(12, cy + 3, [216, 202, 180]);
      this.symPx(14, cy + 3, OUTLINE_RGB);
      this.symPx(15, cy + 3, OUTLINE_RGB);
    }
  }

  /**
   * 레퍼런스 해병의 흉갑(y: 13..18)처럼 좌·우 분할 흉근 장갑 + 스페큘러 도트 + 대각선 리벳 + 중앙 코어를 조각한다.
   */
  public sculptSegmentedTorso(
    cy: number,
    body: ClusterRamp8,
    trim: TrimRamp5,
    coreCol: Rgb
  ): void {
    // 좌·우 흉근 플레이트 & 중앙 흑색 분리선
    this.symRect(11, cy - 2, 4, 4, body.c3);
    this.symPx(12, cy - 1, body.c7);
    this.symPx(13, cy, body.c7);
    this.symPx(12, cy - 2, trim.t1);
    this.symPx(13, cy - 1, trim.t2);
    this.symPx(11, cy + 1, trim.t2);
    // 흉부 중앙 코어 & 금장 클래스프
    this.symPx(15, cy - 1, OUTLINE_RGB);
    this.symPx(15, cy, coreCol);
    this.symPx(14, cy + 1, trim.t3);
    this.symPx(15, cy + 1, trim.t4);
    this.hLine(11, 20, cy + 2, OUTLINE_RGB);
    // 복부 코어 장갑 (y: cy+3..cy+5)
    this.symPx(15, cy + 3, body.c6);
    this.symPx(14, cy + 3, body.c3);
    this.symPx(15, cy + 4, body.c7);
    this.symPx(14, cy + 4, body.c2);
    this.symPx(13, cy + 4, trim.t1);
    this.symPx(13, cy + 5, trim.t2);
    this.symPx(15, cy + 5, body.c4);
  }

  public finalizeOutline(): void {
    const snap = new Uint8ClampedArray(this.data);
    const isOp = (x: number, y: number): boolean =>
      this.inBounds(x, y) && snap[(y * this.size + x) * 4 + 3] > 0;

    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        if (isOp(x, y)) {
          continue;
        }
        if (isOp(x - 1, y) || isOp(x + 1, y) || isOp(x, y - 1) || isOp(x, y + 1)) {
          this.px(x, y, OUTLINE_RGB);
        }
      }
    }
  }
}

/**
 * 레퍼런스 해병 32x32 매트릭스를 주어진 진영 팔레트 및 재질 모드에 맞춰 스탬핑한다.
 * - 기본 철갑 연합 팔레트(#4f7fb8)일 때는 레퍼런스 원본 50색을 100% 그대로 재현한다.
 * - 다른 진영(성휘 교단 / 적응 군체 / 블라이트)의 인간형·중장갑 유닛에 사용할 때는
 *   해병의 50색 명암·트림·하이라이트·내부 흑색선 구조를 해당 진영 팔레트로 완벽히 재매핑한다!
 */
function stampReferenceMarine(
  c: SculptCanvas32,
  palette: FactionPalette,
  f: number,
  yOffset: number = 0,
  customEye?: Rgb
): void {
  const isDefaultIronclad =
    palette.primary.toLowerCase() === '#4f7fb8' && !customEye;
  const sp = buildStudioPalette(palette);
  const eye = customEye ?? sp.eyeGlow;

  const colorMap: Record<string, Rgb> = {};
  for (const [k, hex] of Object.entries(MARINE_REF_PALETTE)) {
    if (k === '0' || k === 'B') {
      colorMap[k] = OUTLINE_RGB;
    } else if (isDefaultIronclad) {
      colorMap[k] = hexToRgb(hex);
    } else {
      const [r, g, b] = hexToRgb(hex);
      if (k === 'r') {
        colorMap[k] = eye;
      } else if (k === 'u') {
        colorMap[k] = darken(eye, 0.55);
      } else if (r > b + 35) {
        // 금장/구리 트림 계열 -> 진영 accent 트림 램프로 매핑
        colorMap[k] =
          r > 240
            ? sp.trim.t4
            : r > 220
              ? sp.trim.t3
              : r > 198
                ? sp.trim.t2
                : r > 185
                  ? sp.trim.t1
                  : sp.trim.t0;
      } else if (Math.abs(r - g) <= 10 && Math.abs(g - b) <= 12) {
        // 금속 마스크/주먹 계열
        colorMap[k] = r > 140 ? sp.metal.t3 : r > 100 ? sp.metal.t2 : sp.metal.t0;
      } else {
        // 주 장갑 8단계 클러스터 매핑
        const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        colorMap[k] =
          lum > 0.86
            ? sp.body.c7
            : lum > 0.72
              ? sp.body.c6
              : lum > 0.52
                ? sp.body.c5
                : lum > 0.4
                  ? sp.body.c4
                  : lum > 0.3
                    ? sp.body.c3
                    : lum > 0.22
                      ? sp.body.c2
                      : lum > 0.14
                        ? sp.body.c1
                        : sp.body.c0;
      }
    }
  }

  for (let y = 0; y < 32; y += 1) {
    const row = MARINE_REF_GRID[y] ?? '';
    for (let x = 0; x < 32; x += 1) {
      const ch = row[x];
      if (!ch || ch === '.') {
        continue;
      }
      const rgb = colorMap[ch];
      if (!rgb) {
        continue;
      }
      let dy = yOffset;
      if (f === 1) {
        if (y >= 24 && x < 16) {
          dy -= 1;
        } else if (y >= 15 && y <= 23 && (x <= 7 || x >= 24)) {
          dy -= 1;
        }
      }
      c.px(x, y + dy, rgb);
    }
  }

  if (f === 1) {
    c.symPx(14, 10 + yOffset, lighten(eye, 0.45));
    c.symPx(15, 16 + yOffset, sp.trim.t4);
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

// ─────────────────────────── 1. 철갑 연합 (IRONCLAD UNION) ───────────────────────────

function drawSoldier32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  stampReferenceMarine(c, palette, f, 0);
}

function drawIroncladCommander32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  const sp = buildStudioPalette(palette);
  for (let y = 11; y <= 28; y += 1) {
    const halfW = Math.min(13, 6 + Math.floor((y - 10) * 0.45));
    for (let x = 16 - halfW; x <= 15 + halfW; x += 1) {
      if (x === 16 - halfW || x === 15 + halfW || y === 28) {
        c.px(x, y, OUTLINE_RGB);
      } else if (y === 27) {
        c.px(x, y, sp.trim.t4);
      } else if (y === 26) {
        c.px(x, y, sp.trim.t2);
      } else {
        const edgeDist = Math.min(x - (16 - halfW), 15 + halfW - x);
        c.px(x, y, edgeDist <= 2 ? sp.crimson.t3 : edgeDist <= 4 ? sp.crimson.t2 : sp.crimson.t0);
      }
    }
  }

  stampReferenceMarine(c, palette, f, 0);

  c.vLine(10, 0, 4, OUTLINE_RGB);
  c.vLine(9, 1, 4, sp.metal.t3);
  c.px(9, 0, f === 0 ? sp.eyeGlow : sp.crimson.t3);
  c.symPx(15, 3, sp.trim.t4);
  c.symPx(14, 4, sp.trim.t4);
  c.symPx(13, 5, sp.trim.t3);
  c.symPx(15, 5, sp.white);

  c.symPx(6, 9, sp.trim.t4);
  c.symPx(7, 9, sp.trim.t3);
  c.symPx(8, 9, sp.eyeGlow);
  c.symPx(6, 10, sp.trim.t2);
  c.symPx(7, 10, sp.trim.t4);

  c.symPx(13, 15, sp.trim.t4);
  c.symPx(14, 15, sp.trim.t4);
  c.symPx(15, 15, sp.white);
  c.symPx(12, 16, sp.trim.t3);

  c.rect(24, 18 - f, 7, 7, OUTLINE_RGB);
  c.rect(25, 19 - f, 5, 5, sp.metal.t1);
  c.hLine(25, 29, 20 - f, sp.metal.t4);
  c.px(27, 19 - f, sp.trim.t4);
  c.px(26, 22 - f, sp.eyeGlow);
  c.px(28, 22 - f, sp.eyeGlow);
  if (f === 1) {
    c.px(30, 21 - f, sp.white);
    c.px(30, 22 - f, sp.eyeGlow);
  }
}

function drawFlamer32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  const sp = buildStudioPalette(palette);
  stampReferenceMarine(c, palette, f, 0);

  c.symPartDome(9, 4, 3.2, 3.5, makeRamp8(sp.crimson.t3, sp.crimson.t0, sp.trim.t4), {
    trim: sp.trim,
    trimBottom: true,
  });
  c.symPx(9, 2, sp.trim.t4);
  c.symPx(10, 3, sp.white);

  c.rect(12, 7, 8, 7, OUTLINE_RGB);
  for (let y = 8; y <= 12; y += 1) {
    for (let x = 13; x <= 18; x += 1) {
      const d = Math.hypot(x - 15, y - 9.5);
      const vc =
        d < 1.3
          ? sp.white
          : d < 2.3
            ? sp.trim.t4
            : d < 3.2
              ? sp.trim.t3
              : sp.crimson.t2;
      c.px(x, y, vc);
    }
  }
  c.hLine(14, 17, 13, sp.metal.t2);

  c.symPx(5, 8, sp.trim.t4);
  c.symPx(6, 9, sp.crimson.t3);
  c.symPx(7, 10, sp.trim.t4);
  c.symPx(8, 11, sp.crimson.t2);

  c.symRect(1, 20, 6, 6, OUTLINE_RGB);
  c.symRect(2, 21, 4, 4, sp.metal.t1);
  c.symPx(3, 21, sp.metal.t4);
  c.symPx(4, 22, sp.trim.t3);
  const flameY = 25 + f;
  c.symPx(3, 25, sp.eyeGlow);
  c.symPx(4, 25, sp.white);
  c.symPx(2, flameY, sp.crimson.t3);
  c.symPx(3, flameY, sp.trim.t4);
  c.symPx(4, flameY, sp.trim.t3);
  c.symPx(3, flameY + 1, sp.crimson.t2);
}

function drawWalker32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  // 골리앗/바이킹 스타일 중장갑 전투 보행기: 해병 아머의 하체·흉갑 디테일과 쌍열 박격포탑·개틀링 암 결합
  const sp = buildStudioPalette(palette);
  const metalRamp = makeRamp8(sp.metal.t3, sp.metal.t0, sp.white);

  // 1) 등면 쌍열 대구경 박격포신 (냉각핀 + 구리 급탄 벨트 + 포구 화염)
  c.symPartCapsule(9, 7, 7, 1, 2.5, metalRamp);
  c.symPx(6, 1, OUTLINE_RGB);
  c.symPx(7, 1, sp.crimson.t3);
  c.symPx(8, 3, sp.trim.t4);
  c.symPx(8, 5, sp.trim.t2);

  // 2) 해병 파워아머의 고밀도 역관절 하체·흉갑 구조 스탬핑 후 워커 조종석으로 개조
  stampReferenceMarine(c, palette, f, 1);
  // 상단 인간형 머리/백팩 영역 정리 후 각진 골리앗 조종석 포탑 조형
  for (let y = 1; y <= 13; y += 1) {
    for (let x = 10; x <= 21; x += 1) {
      c.clearPx(x, y);
    }
  }
  c.partDome(15.5, 10, 6.2, 5.2, sp.body, { trim: sp.trim, trimBottom: true });
  c.sculptVisorFace(10, sp.body, sp.trim, sp.eyeGlow, 'RESPIRATOR');
  // 조종석 상단 해치 금장 줄무늬 & 센서 안테나
  c.symPx(15, 6, sp.trim.t4);
  c.symPx(15, 7, sp.trim.t3);

  // 3) 양팔을 3연장 개틀링 오토캐논 배럴 포드로 개조
  c.symRect(1, 18 - f, 6, 8, OUTLINE_RGB);
  c.symRect(2, 19 - f, 4, 6, sp.metal.t1);
  c.symVLine(2, 19 - f, 24 - f, sp.metal.t4);
  c.symVLine(4, 19 - f, 24 - f, sp.metal.t3);
  c.symPx(3, 18 - f, sp.trim.t4);
  c.symPx(4, 18 - f, sp.trim.t3);
  c.symPx(3, 25 - f, f === 1 ? sp.trim.t4 : sp.crimson.t3);
}

function drawDrone32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  // 사이언스 베슬/메디백 스타일 고밀도 전술 나노 수리 드론
  const sp = buildStudioPalette(palette);
  const metalRamp = makeRamp8(sp.metal.t3, sp.metal.t0, sp.white);
  const yOff = f === 0 ? 0 : -1;

  // 1) 상단 듀얼 센서 안테나 & 비콘
  c.symVLine(11, 2 + yOff, 6 + yOff, OUTLINE_RGB);
  c.symVLine(10, 3 + yOff, 6 + yOff, sp.metal.t3);
  c.symPx(10, 2 + yOff, sp.eyeGlow);

  // 2) 하부 다관절 로봇 용접 집게팔 & 나노 수리 플라즈마 아크
  c.symPartCapsule(10, 19 + yOff, 7, 25 + yOff, 2.0, metalRamp);
  c.symPartCapsule(7, 25 + yOff, 12, 28 + yOff, 1.8, sp.body);
  c.symPx(8, 25 + yOff, sp.trim.t4);
  // 집게 끝단 나노 수리 광선 코어
  c.partDome(15.5, 28 + yOff, 3.0, 2.0, makeRamp8(sp.eyeGlow, sp.eyeSocket, sp.white));

  // 3) 좌우 틸트로터 터보팬 엔진 나셀 (해병 견갑 수준의 금장 트림 & 배기구 디테일)
  c.symPartDome(4.5, 13 + yOff, 3.8, 5.2, sp.body, {
    trim: sp.trim,
    trimBottom: true,
    trimInner: true,
  });
  c.symRect(3, 12 + yOff, 3, 3, OUTLINE_RGB);
  c.symPx(4, 13 + yOff, sp.eyeGlow);
  c.symPx(4, 19 + yOff, sp.eyeGlow);
  c.symPx(5, 19 + yOff, sp.white);
  c.symPx(4, 20 + yOff + f, sp.eyeGlow);

  // 4) 중앙 장갑 코어 돔 & 분할 패널 라인
  c.partDome(15.5, 13 + yOff, 7.2, 6.8, sp.body, { trim: sp.trim, trimBottom: true });
  c.sculptVisorFace(15 + yOff, sp.body, sp.trim, sp.eyeGlow, 'RESPIRATOR');

  // 5) 상부 금장 베젤 의무 십자(+) 마크
  c.rect(13, 6 + yOff, 6, 6, OUTLINE_RGB);
  c.rect(14, 7 + yOff, 4, 4, sp.trim.t3);
  c.vLine(15, 7 + yOff, 10 + yOff, sp.white);
  c.vLine(16, 7 + yOff, 10 + yOff, sp.white);
  c.hLine(14, 17, 8 + yOff, sp.white);
  c.hLine(14, 17, 9 + yOff, sp.eyeGlow);
}

// ─────────────────────────── 2. 적응 군체 (ADAPTIVE HIVE) ───────────────────────────

function drawHiveCommander32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  // [군체 의지] 칼날 여왕/브루드 여제: 32x32 해병 밀도의 생체 키틴 갑주 + 등면 4자루 거대 뼈낫 날개 + 발광 신경관
  const sp = buildStudioPalette(palette);
  const acidRamp = makeRamp8(sp.trim.t3, sp.trim.t0, [242, 255, 170]);
  const boneRamp = makeRamp8(sp.bone.t3, sp.bone.t0, sp.white);

  // 1) 등 뒤로 거대하게 펼쳐진 4자루의 칼날 여왕 뼈낫 날개(Bone-Scythe Wings)
  c.symPartCapsule(10, 9, 3, 2 - f, 2.2, boneRamp);
  c.symPartCapsule(3, 2 - f, 1, 11 - f, 1.8, boneRamp);
  c.symPx(2, 5 - f, sp.trim.t4);
  c.symPartCapsule(9, 14, 2, 13 + f, 1.9, boneRamp);
  c.symPartCapsule(2, 13 + f, 1, 21 + f, 1.6, boneRamp);

  // 2) 하부 똬리를 튼 여왕 꼬리 & 산성 점액선
  c.partDome(15.5, 27, 8.5, 3.2, sp.body, { trim: sp.trim, trimBottom: true });
  c.symPartDome(9, 27, 2.4, 2.0, acidRamp);

  // 3) 50색 고밀도 키틴 생체 갑주 본체 스탬핑 (보랏빛 키틴 + 형광 산성 생체맥 + 발광 안구)
  stampReferenceMarine(c, palette, f, 0, sp.trim.t4);

  // 4) 여왕 전용 3갈래 생체 뿔 왕관 & 발광 신경 뇌엽 + 포식 송곳니 조형
  c.symPartCapsule(13, 5, 10, 1, 1.5, boneRamp);
  c.partDome(15.5, 4.5, 2.6, 2.2, acidRamp);
  c.sculptVisorFace(10, sp.body, sp.trim, sp.trim.t4, 'FANGS');
  c.sculptSegmentedTorso(15, sp.body, sp.trim, sp.trim.t4);
}

function drawClaw32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  // 갈퀴충 (Zergling Raptor): 해병급 32x32 키틴 근육·갑피 디테일 + 등면 쌍뼈낫 + 3발톱 갈퀴손 + 송곳니 두개골
  const sp = buildStudioPalette(palette);
  const boneRamp = makeRamp8(sp.bone.t3, sp.bone.t0, sp.white);

  // 1) 등 뒤로 치솟은 한 쌍의 대형 사신 뼈낫(Reaper Scythes)
  c.symPartCapsule(11, 8, 5, 1 + f, 2.0, boneRamp);
  c.symPartCapsule(5, 1 + f, 2, 9 + f, 1.8, boneRamp);
  c.symPx(4, 3 + f, sp.trim.t4);

  // 2) 고밀도 키틴 아머 바디 스탬핑 후 포식 랩터 형태로 조형
  stampReferenceMarine(c, palette, f, 1, sp.trim.t4);
  c.sculptVisorFace(11, sp.body, sp.trim, sp.trim.t4, 'FANGS');

  // 3) 양손 건틀릿 끝에 돋아난 3가닥 장검형 뼈갈퀴(Razor Claws)
  c.symVLine(2, 23 - f, 27 - f, OUTLINE_RGB);
  c.symVLine(3, 22 - f, 27 - f, sp.bone.t4);
  c.symVLine(5, 22 - f, 26 - f, sp.bone.t3);
  c.symPx(3, 27 - f, sp.white);
  // 발끝 랩터 갈고리 발톱
  c.symPx(7, 30, sp.bone.t4);
  c.symPx(9, 30, sp.bone.t4);
}

function drawSpitter32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  // 가시 투척충 (Hydralisk Spine Spitter): 확장된 코브라 후드 갑피 + 상단 6발사 골침 + 흉부 산성 독낭 + 뱀 하체
  const sp = buildStudioPalette(palette);
  const acidRamp = makeRamp8(sp.trim.t3, sp.trim.t0, [242, 255, 170]);
  const boneRamp = makeRamp8(sp.bone.t3, sp.bone.t0, sp.white);

  // 1) 코브라 후드 위로 솟아오른 6개의 발사 대기 골침(Spines)
  c.symPartCapsule(13, 5, 11, 1, 1.5, boneRamp);
  c.symPartCapsule(9, 6, 6, 1, 1.5, boneRamp);
  c.symPartCapsule(6, 9, 2, 4, 1.5, boneRamp);

  // 2) 고밀도 생체 갑피 본체 스탬핑
  stampReferenceMarine(c, palette, f, 0, sp.trim.t4);

  // 3) 하체를 똬리 튼 히드라리스크 뱀 꼬리로 변환
  for (let y = 24; y <= 31; y += 1) {
    for (let x = 5; x <= 26; x += 1) {
      c.clearPx(x, y);
    }
  }
  c.partCapsule(9, 23, 7 - f, 27, 2.8, sp.body);
  c.partCapsule(7 - f, 27, 23 + f, 29, 2.8, sp.body);
  c.hLine(8, 22, 28, sp.trim.t3);

  // 4) 히드라리스크 송곳니 두개골 & 흉부 발광 독낭 + 양팔 낫발톱
  c.sculptVisorFace(10, sp.body, sp.trim, sp.trim.t4, 'FANGS');
  c.partDome(15.5, 16, 3.2, 2.6 + f * 0.3, acidRamp);
  c.symPartCapsule(4, 21, 2, 26 - f, 1.8, boneRamp);
}

function drawSpewer32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  // 산성 분사체 (Volatile Acid Spewer): 양어깨 위에 솟은 거대 형광 산성 주머니 한 쌍 + 중장갑 키틴 바디 + 산성 분사구
  const sp = buildStudioPalette(palette);
  const acidRamp = makeRamp8(sp.trim.t3, sp.trim.t0, [245, 255, 185]);

  // 1) 고밀도 중장갑 키틴 바디 스탬핑
  stampReferenceMarine(c, palette, f, 1, sp.trim.t4);

  // 2) 양어깨 위에 거대하게 부풀어 올라 맥동하는 쌍둥이 맹독 산성 주머니(Volatile Acid Sacs)
  const pulse = f * 0.4;
  c.symPartDome(6.5, 7.5, 4.8 + pulse, 4.8 + pulse, acidRamp, {
    trim: sp.trim,
    trimBottom: true,
  });
  c.symPx(5, 6, sp.white);
  c.symPx(7, 8, sp.body.c2);
  c.symPx(6, 9, sp.body.c2);

  // 3) 산성 분사 노즐 아가리 & 흘러내리는 강산성 방울
  c.sculptVisorFace(11, sp.body, sp.trim, sp.trim.t4, 'FANGS');
  c.partDome(15.5, 16, 3.4, 2.8 + pulse, acidRamp);
  c.symPx(14, 19 + f, sp.trim.t4);
  c.symPx(15, 20 + f, sp.white);
}

function drawBeetle32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  // 껍질 갑충 (Ultralisk Kaiser Beetle): 고밀도 중장갑 갑피 + 좌우 거대 초승달 카이저 뿔(Kaiser Blades) 한 쌍!
  const sp = buildStudioPalette(palette);
  const boneRamp = makeRamp8(sp.bone.t3, sp.bone.t0, sp.white);
  const acidRamp = makeRamp8(sp.trim.t3, sp.trim.t0, [242, 255, 170]);

  // 1) 등면 중장갑 요새 돔 & 생체 통기공
  c.partDome(15.5, 7, 8.5, 5.5, sp.body, { trim: sp.trim, trimBottom: true });
  c.symPartDome(10, 5, 2.0, 1.8, acidRamp);

  // 2) 해병급 50색 고밀도 중장갑 흉갑·사지 스탬핑
  stampReferenceMarine(c, palette, f, 1, sp.trim.t4);
  c.sculptVisorFace(11, sp.body, sp.trim, sp.trim.t4, 'FANGS');
  c.sculptSegmentedTorso(16, sp.body, sp.trim, sp.trim.t4);

  // 3) 좌·우 양옆에서 전방으로 거대하게 휘어지는 초승달 카이저 뿔(Kaiser Blades) 한 쌍!
  c.symPartCapsule(6, 15, 2, 7 - f, 2.5, boneRamp);
  c.symPartCapsule(2, 7 - f, 6, 1, 2.2, boneRamp);
  c.symPx(6, 1, sp.white);
  c.symPx(3, 5 - f, sp.white);
}

// ─────────────────────────── 3. 성휘 교단 (LUMEN ORDER) ───────────────────────────

function drawLumenCommander32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  // [대주교] 아르타니스/고위 신관 스타일: 32x32 황금 템플러 갑주 + 등 뒤 3수정 카이다린 광배 + 예복 타바드 + 쌍날 차원검
  const sp = buildStudioPalette(palette);
  const crystalRamp = makeRamp8(sp.trim.t3, sp.trim.t0, sp.white);

  // 1) 등 뒤 공중에 부유하는 3개의 카이다린 광배(Khaydarin Crown Halo) 수정 첨탑
  c.partCapsule(15.5, 5, 15.5, 0, 1.8, crystalRamp);
  c.symPartCapsule(9, 5, 5, 1, 1.8, crystalRamp);

  // 2) 레퍼런스 해병의 50색 정밀 갑주 구조를 성휘 교단 황금·카이다린 팔레트로 스탬핑
  stampReferenceMarine(c, palette, f, 0, sp.trim.t4);

  // 3) 프로토스 신관 면갑(입 마스크 없는 황금 면갑 + 이마 카이다린 보석) & 흉부 대형 카이다린 코어
  c.sculptVisorFace(10, sp.body, sp.trim, sp.trim.t4, 'TEMPLAR');
  c.sculptSegmentedTorso(15, sp.body, sp.trim, sp.trim.t4);
  // 견갑 중앙 카이다린 수정 코어
  c.symPartDome(6, 9, 2.0, 2.0, crystalRamp);

  // 4) 다리 사이로 늘어지는 대주교 사이오닉 타바드(예복)
  c.rect(13, 21, 6, 8, OUTLINE_RGB);
  c.rect(14, 22, 4, 6, sp.body.c2);
  c.vLine(15, 22, 27, sp.trim.t4);
  c.vLine(16, 22, 27, sp.white);

  // 5) 양팔 건틀릿에서 뻗어 나오는 쌍날 사이오닉 차원검(Dual Psionic Warp-Blades)
  c.symPartCapsule(3, 21 - f, 2, 29, 1.8, crystalRamp);
  c.symVLine(2, 22 - f, 28, sp.white);
}

function drawKnight32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  // 수호 기사 (Zealot / Aegis Warden): 32x32 황금 성기사 갑주 + 왼손 이지스 타워 실드 + 오른손 광휘 차원검
  const sp = buildStudioPalette(palette);
  const crystalRamp = makeRamp8(sp.trim.t3, sp.trim.t0, sp.white);

  // 1) 50색 황금 성기사 아머 본체 스탬핑
  stampReferenceMarine(c, palette, f, 0, sp.trim.t4);
  c.sculptVisorFace(10, sp.body, sp.trim, sp.trim.t4, 'TEMPLAR');
  c.sculptSegmentedTorso(15, sp.body, sp.trim, sp.trim.t4);
  // 투구 좌우 황금 뿔 볏
  c.symPartCapsule(12, 5, 10, 1, 1.5, sp.body);

  // 2) 왼팔: 황금 테두리 & 카이다린 십자 코어가 박힌 이지스 타워 실드 (x: 1..8, y: 15..26)
  c.partDome(4.5, 20.5, 4.0, 5.5, sp.body, { trim: sp.trim, trimBottom: true });
  c.vLine(4, 17, 24, sp.trim.t4);
  c.vLine(5, 17, 24, sp.white);
  c.hLine(2, 7, 20, sp.trim.t4);

  // 3) 오른팔: 높이 치켜든 푸른 광휘 차원검 (Psionic Warp-Blade, x: 26..30, y: 3..23)
  c.partCapsule(27, 20, 29, 3 - f, 2.0, crystalRamp);
  c.vLine(28, 4 - f, 18, sp.white);
  c.rect(25, 19, 5, 3, OUTLINE_RGB);
  c.hLine(26, 29, 20, sp.body.c7);
}

function drawPrism32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  // 프리즘 포대 (Phase Prism Construct): 정교한 황금 날개 파일런 4기 + 다면체 카이다린 굴절 코어 + 방전 아크
  const sp = buildStudioPalette(palette);
  const crystalRamp = makeRamp8(sp.trim.t3, sp.trim.t0, sp.white);
  const yOff = f === 0 ? 0 : -1;

  // 1) 상·하 황금 반중력 링 & 크라운
  c.partDome(15.5, 4 + yOff, 5.5, 2.2, sp.body, { trim: sp.trim, trimBottom: true });
  c.partDome(15.5, 27, 6.5, 2.4, sp.body, { trim: sp.trim, trimBottom: true });
  c.symPx(14, 27, sp.trim.t4);

  // 2) 좌·우 다중 분절 황금 날개 파일런 (내부 카이다린 동력원 슬롯 포함)
  c.symPartDome(5, 9 - yOff, 3.8, 4.5, sp.body, {
    trim: sp.trim,
    trimBottom: true,
    trimInner: true,
  });
  c.symPx(5, 9 - yOff, sp.trim.t4);
  c.symPx(4, 9 - yOff, sp.white);

  c.symPartDome(5, 20 + yOff, 3.8, 4.5, sp.body, {
    trim: sp.trim,
    trimBottom: true,
    trimInner: true,
  });
  c.symPx(5, 20 + yOff, sp.trim.t4);
  c.symPx(4, 20 + yOff, sp.white);

  // 파일런과 코어를 잇는 사이오닉 동력선
  c.symPx(9, 12, sp.trim.t4);
  c.symPx(9, 17, sp.trim.t4);

  // 3) 중앙 다면체 카이다린 프리즘 코어 + 황금 적도 벨트
  const cy = 15 + yOff;
  for (let dy = -9; dy <= 9; dy += 1) {
    const span = Math.round((9 - Math.abs(dy)) * 0.72);
    for (let dx = -span; dx <= span; dx += 1) {
      const x = 15 + dx;
      const y = cy + dy;
      if (Math.abs(dx) === span || Math.abs(dy) === 9) {
        c.px(x, y, OUTLINE_RGB);
      } else if (Math.abs(dy) === 1 && Math.abs(dx) >= span - 2) {
        c.px(x, y, sp.body.c6); // 황금 적도 클램프
      } else if (dx === 0 || dy === 0) {
        c.px(x, y, sp.white);
      } else if (dx < 0 && dy < 0) {
        c.px(x, y, crystalRamp.c7);
      } else if (dx > 0 && dy < 0) {
        c.px(x, y, crystalRamp.c5);
      } else if (dx < 0 && dy > 0) {
        c.px(x, y, crystalRamp.c4);
      } else {
        c.px(x, y, crystalRamp.c2);
      }
    }
  }
  c.rect(14, cy - 1, 4, 3, sp.white);
}

function drawLancer32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  // 광선 창병 (Radiant Lancer): 32x32 황금 성기사 아머 + 등면 태양광 날개 핀 + 전장을 꿰뚫는 프리즘 광선창
  const sp = buildStudioPalette(palette);
  const crystalRamp = makeRamp8(sp.trim.t3, sp.trim.t0, sp.white);

  // 1) 등 뒤로 뻗은 한 쌍의 황금 태양광 날개 핀(Solar Wing Fins)
  c.symPartCapsule(10, 7, 4, 1, 1.8, sp.body);
  c.symPx(5, 2, sp.trim.t4);

  // 2) 50색 황금 성기사 아머 본체 스탬핑
  stampReferenceMarine(c, palette, f, 0, sp.trim.t4);
  c.sculptVisorFace(10, sp.body, sp.trim, sp.trim.t4, 'TEMPLAR');
  c.sculptSegmentedTorso(15, sp.body, sp.trim, sp.trim.t4);

  // 3) 오른손에 쥔 장대한 프리즘 광선창 (y: 1..30 전체를 관통하는 광선 창날 + 황금 코등이)
  const thrust = f === 1 ? -1 : 0;
  c.partCapsule(27, 29, 27, 1 + thrust, 2.0, crystalRamp);
  c.partDome(27, 14 + thrust, 3.4, 2.0, sp.body, { trim: sp.trim, trimBottom: true });
  c.vLine(27, 2 + thrust, 28, sp.white);
}

function drawOrb32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  // 공명 구체 (Archon / Disruptor Resonance Orb): 8방위 황금 룬 자이로 링 + V자형 집정관 안구를 지닌 플라즈마 코어
  const sp = buildStudioPalette(palette);
  const crystalRamp = makeRamp8(sp.trim.t3, sp.trim.t0, sp.white);

  // 1) 외곽 황금 자이로 구속 링 & 심연 공동
  c.partDome(15.5, 15.5, 13.0, 13.0, sp.body, { trim: sp.trim, trimBottom: true });
  c.partDome(15.5, 15.5, 10.2, 10.2, makeRamp8([16, 40, 68], [6, 12, 24], sp.trim.t3));

  // 2) 중앙 사이오닉 특이점 플라즈마 구체 & V자형 집정관(Archon) 발광 안구
  c.partDome(15.5, 15.5, 7.2 + f * 0.4, 7.2 + f * 0.4, crystalRamp);
  c.sculptVisorFace(15, crystalRamp, sp.trim, sp.white, 'TEMPLAR');

  // 3) 외곽 4방위 황금 파일런 클램프 + 카이다린 보석
  c.partDome(15.5, 3.5, 3.2, 2.2, sp.body);
  c.partDome(15.5, 27.5, 3.2, 2.2, sp.body);
  c.symPartDome(3.5, 15.5, 2.2, 3.2, sp.body);
  c.px(15, 3, sp.trim.t4);
  c.px(15, 27, sp.trim.t4);
  c.symPx(3, 15, sp.trim.t4);

  // 4) 코어에서 외곽 링으로 방전되는 사이오닉 번개 줄기
  if (f === 0) {
    c.symPx(9, 9, sp.white);
    c.symPx(8, 8, sp.trim.t4);
    c.symPx(9, 22, sp.white);
    c.symPx(8, 23, sp.trim.t4);
  } else {
    c.symPx(15, 7, sp.white);
    c.symPx(15, 24, sp.white);
    c.symPx(7, 15, sp.white);
  }
}

// ─────────────────────────── 4. 블라이트 무리 (BLIGHT HORDE 5종) ───────────────────────────

function drawMite32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  const sp = buildStudioPalette(palette);
  const boneRamp = makeRamp8(sp.bone.t3, sp.bone.t0, sp.white);

  for (let i = 0; i < 3; i += 1) {
    const ly = 11 + i * 5;
    const shift = (i + f) % 2 === 0 ? -1 : 1;
    c.symPartCapsule(9, ly, 3, ly + 2 + shift, 1.5, sp.body);
  }

  c.partDome(15.5, 13, 8.2, 7.2, sp.body, { trim: sp.trim, trimBottom: true });
  c.symPartDome(11, 11, 2.2, 2.0, makeRamp8(sp.trim.t3, sp.trim.t0, sp.white));

  c.partDome(15.5, 20, 5.5, 4.2, sp.body, { trim: sp.trim, trimBottom: true });
  c.sculptVisorFace(20, sp.body, sp.trim, sp.trim.t4, 'FANGS');
  c.symPartCapsule(12, 24, 10 + f, 28, 1.8, boneRamp);
}

function drawCrawler32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  const sp = buildStudioPalette(palette);
  const boneRamp = makeRamp8(sp.bone.t3, sp.bone.t0, sp.white);

  c.symPartCapsule(11, 7, 8, 2, 1.6, boneRamp);
  c.symPartCapsule(7, 11, 3, 6, 1.6, boneRamp);

  for (let i = 0; i < 3; i += 1) {
    const ly = 13 + i * 5;
    const shift = (i + f) % 2 === 0 ? -1 : 1;
    c.symPartCapsule(8, ly, 2, ly + 3 + shift, 1.6, sp.body);
  }

  c.partDome(15.5, 9, 7.5, 4.5, sp.body, { trim: sp.trim, trimBottom: true });
  c.partDome(15.5, 14, 8.2, 4.8, sp.body, { trim: sp.trim, trimBottom: true });
  c.partDome(15.5, 19, 7.0, 4.5, sp.body, { trim: sp.trim, trimBottom: true });

  c.partDome(15.5, 22.5, 5.6, 4.2, sp.body, { trim: sp.trim, trimBottom: true });
  c.sculptVisorFace(22, sp.body, sp.trim, sp.trim.t4, 'FANGS');
  c.symPartCapsule(10, 24, 6, 29 - f, 2.0, boneRamp);
}

function drawBloater32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  // 블라이트 부풀이 (Bloater): 고밀도 감염체 바디 + 온몸에서 불거져 나와 맥동하는 5개의 거대 맹독 농포
  const sp = buildStudioPalette(palette);
  const pustuleRamp = makeRamp8(sp.trim.t3, sp.trim.t0, [246, 255, 190]);
  const pBoost = f * 0.45;

  // 1) 감염된 중장갑 하체·몸통 스탬핑
  stampReferenceMarine(c, palette, f, 1, sp.trim.t4);

  // 2) 어깨·등·옆구리에서 기형적으로 부풀어 오른 5개의 맹독 농포(Toxic Pustules)
  c.symPartDome(6.5, 8.5, 4.8 + pBoost, 4.6 + pBoost, pustuleRamp);
  c.partDome(15.5, 5.5, 4.5 + pBoost, 3.8 + pBoost, pustuleRamp);
  c.symPartDome(5.5, 18.5, 3.8, 3.8 + pBoost, pustuleRamp);
  // 농포 위 핏줄 & 하이라이트
  c.symPx(5, 7, sp.white);
  c.symPx(7, 9, sp.body.c1);

  // 3) 파묻힌 감염체 얼굴 & 맹독 토사물
  c.sculptVisorFace(11, sp.body, sp.trim, sp.trim.t4, 'FANGS');
  c.partDome(15.5, 17, 3.6, 3.0 + pBoost, pustuleRamp);
}

function drawBrute32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  // 블라이트 파쇄충 (Brute): 해병의 50색 중장갑 아머 밀도를 계승한 보랏빛 심연 거수 + 쌍황소뿔 + 흉부 노출 심장 + 가시 파쇄 주먹
  const sp = buildStudioPalette(palette);
  const boneRamp = makeRamp8(sp.bone.t3, sp.bone.t0, sp.white);
  const coreRamp = makeRamp8(sp.trim.t3, sp.trim.t0, sp.white);

  // 1) 투구 양옆으로 거대하게 굽이치는 미노타우로스 황소 뿔 한 쌍
  c.symPartCapsule(10, 6, 4, 1, 2.3, boneRamp);
  c.symPartCapsule(4, 1, 2, 6, 1.9, boneRamp);

  // 2) 레퍼런스 해병의 50색 고밀도 장갑 근육·다리·견갑 스탬핑
  stampReferenceMarine(c, palette, f, 0, sp.trim.t4);

  // 3) 4안 포식자 송곳니 얼굴 & 흉부 한가운데 노출된 진홍빛 심장 코어
  c.sculptVisorFace(10, sp.body, sp.trim, sp.trim.t4, 'FANGS');
  c.sculptSegmentedTorso(15, sp.body, sp.trim, sp.trim.t4);
  c.partDome(15.5, 16, 3.2, 2.8, coreRamp);
  // 견갑 위 뼈가시 돌기
  c.symPx(5, 6, sp.bone.t4);
  c.symPx(4, 7, sp.bone.t3);

  // 4) 양손의 초거대 가시 파쇄 주먹(Spiked Crusher Fists)
  const slam = f === 1 ? 1 : 0;
  c.symPartDome(4, 21 + slam, 3.6, 4.2, sp.body, { trim: sp.trim, trimBottom: true });
  c.symPx(2, 21 + slam, sp.bone.t4);
  c.symPx(4, 25 + slam, sp.bone.t4);
}

function drawMatron32(c: SculptCanvas32, palette: FactionPalette, f: number): void {
  // 최종 보스 [블라이트 모체 (MATRON)]: 5황금 왕관뿔 + 고밀도 키틴 갑주 + V자형 다중 포식 안구 + 흉부 한가운데 거대 이빨 아가리 + 하부 6촉수
  const sp = buildStudioPalette(palette);
  const goldRamp = makeRamp8(sp.trim.t3, sp.trim.t0, sp.white);
  const boneRamp = makeRamp8(sp.bone.t3, sp.bone.t0, sp.white);

  // 1) 상단 5개의 황금 생체 왕관 첨탑 (Royal Bio-Spire Crown)
  c.partCapsule(15.5, 6, 15.5, 0, 2.0, goldRamp);
  c.symPartCapsule(11, 6, 9, 1, 1.8, goldRamp);
  c.symPartCapsule(7, 8, 4, 3, 1.8, goldRamp);

  // 2) 고밀도 모체 상체·견갑·집게팔 아머 스탬핑
  stampReferenceMarine(c, palette, f, 0, sp.trim.t4);

  // 3) 하부 다리를 지우고 꿈틀거리는 6가닥의 산란 촉수(Brood Tentacles) 조형
  for (let y = 23; y <= 31; y += 1) {
    for (let x = 5; x <= 26; x += 1) {
      c.clearPx(x, y);
    }
  }
  for (let i = 0; i < 3; i += 1) {
    const tx = 7 + i * 4;
    const wave = (i + f) % 2 === 0 ? -1 : 1;
    c.symPartCapsule(tx, 22, tx + wave, 30, 1.8, sp.body);
    c.symPx(tx + wave, 29, sp.trim.t4);
  }

  // 4) 모체 다중 포식 안구 & 송곳니 두개골
  c.sculptVisorFace(10, sp.body, sp.trim, sp.trim.t4, 'FANGS');
  c.symPx(11, 9, sp.trim.t4); // 외측 보조 복안

  // 5) 흉부~복부 한가운데에 쩍 벌어진 심연 아가리(Abyssal Maw) & 10개의 송곳니 링
  const mawRy = 4.6 + f * 0.5;
  c.partDome(15.5, 18.5, 5.8, mawRy, makeRamp8([24, 8, 18], [6, 2, 6], sp.crimson.t3));
  for (let k = 11; k <= 20; k += 2) {
    c.px(k, 15, sp.bone.t4);
    c.px(k, 16, sp.white);
    c.px(k, 22, sp.bone.t4);
    c.px(k, 21, sp.white);
  }
  c.symPx(15, 18, sp.trim.t4);

  // 6) 양팔 끝의 거대 분쇄 집게발톱
  c.symPartCapsule(3, 21 - f, 2, 26 - f, 1.8, boneRamp);
  c.symPartCapsule(5, 21 - f, 6, 26 - f, 1.6, boneRamp);
}

/**
 * 순수 함수: 아키타입 + 팔레트 + 애니메이션 프레임(0|1) → 32x32 RGBA 픽셀 버퍼.
 */
export function renderSpritePixels(
  archetype: SpriteArchetype,
  palette: FactionPalette,
  frame: number = 0
): { width: number; height: number; data: Uint8ClampedArray } {
  const canvas = new SculptCanvas32();
  const f = Math.abs(Math.round(frame)) % 2;

  switch (archetype) {
    case 'COMMANDER': {
      const kind = detectCommanderFaction(palette);
      if (kind === 'HIVE') {
        drawHiveCommander32(canvas, palette, f);
      } else if (kind === 'LUMEN') {
        drawLumenCommander32(canvas, palette, f);
      } else {
        drawIroncladCommander32(canvas, palette, f);
      }
      break;
    }
    case 'SOLDIER':
      drawSoldier32(canvas, palette, f);
      break;
    case 'FLAMER':
      drawFlamer32(canvas, palette, f);
      break;
    case 'WALKER':
      drawWalker32(canvas, palette, f);
      break;
    case 'DRONE':
      drawDrone32(canvas, palette, f);
      break;
    case 'CLAW':
      drawClaw32(canvas, palette, f);
      break;
    case 'SPITTER':
      drawSpitter32(canvas, palette, f);
      break;
    case 'SPEWER':
      drawSpewer32(canvas, palette, f);
      break;
    case 'BEETLE':
      drawBeetle32(canvas, palette, f);
      break;
    case 'KNIGHT':
      drawKnight32(canvas, palette, f);
      break;
    case 'PRISM':
      drawPrism32(canvas, palette, f);
      break;
    case 'LANCER':
      drawLancer32(canvas, palette, f);
      break;
    case 'ORB':
      drawOrb32(canvas, palette, f);
      break;
    case 'MITE':
      drawMite32(canvas, palette, f);
      break;
    case 'CRAWLER':
      drawCrawler32(canvas, palette, f);
      break;
    case 'BLOATER':
      drawBloater32(canvas, palette, f);
      break;
    case 'BRUTE':
      drawBrute32(canvas, palette, f);
      break;
    case 'MATRON':
      drawMatron32(canvas, palette, f);
      break;
  }

  canvas.finalizeOutline();
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
  setPx(cx, cy, white);
  setPx(cx - 1, cy - 1, white);
  if (tier >= 2) {
    setPx(cx, cy - 1, light);
    setPx(cx - 1, cy, light);
  }

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
 * 적응 군체(HIVE) 점액 자취(Slime Patch) 28x28 픽셀 데칼 생성기 (2프레임 기포 애니메이션).
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
      const wobble =
        Math.sin(angle * 3 + 0.7) * 1.4 +
        Math.cos(angle * 5 - 1.1) * 0.9 +
        (f === 1 ? Math.sin(angle * 4) * 0.4 : 0);
      const dist = Math.hypot(dx, dy) + wobble;
      if (dist > 12.6) {
        continue;
      }
      let col: Rgb;
      let alpha = 215;
      if (dist > 11.2) {
        col = OUTLINE_RGB;
        alpha = 195;
      } else if (dist > 9.4) {
        col = crust;
      } else if (dist > 7.2) {
        col = sec;
      } else if (dist > 5.0) {
        col = pri;
      } else if (dist > 2.8) {
        col = midPool;
      } else {
        col = acc;
      }
      const i = (y * size + x) * 4;
      data[i] = col[0];
      data[i + 1] = col[1];
      data[i + 2] = col[2];
      data[i + 3] = alpha;
    }
  }

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
  } else {
    setBubble(10, 10, [245, 255, 210]);
    setBubble(16, 14, [245, 255, 210]);
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

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const wave =
        Math.sin((x + y) * ((Math.PI * 2) / 32)) * 0.25 +
        Math.cos((x - y * 2) * ((Math.PI * 2) / 64)) * 0.2;
      const col = wave < -0.1 ? baseDark : wave > 0.14 ? baseLight : baseMid;
      setPx(x, y, col);
    }
  }

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
  setPx(10, 8, [40, 52, 72]);
  setPx(21, 8, [40, 52, 72]);
  setPx(10, 19, [40, 52, 72]);
  setPx(21, 19, [40, 52, 72]);

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

  for (let g = 0; g < size; g += 4) {
    setPx(g, 0, plateDark);
    setPx(0, g, plateDark);
  }

  return { width: size, height: size, data };
}
