import type { FactionPalette, SpriteArchetype } from '../domain/survivor/types';

/**
 * 서바이벌 모드 32x32 8방향(8-Dir) · 다중 상태(IDLE / WALK / ATTACK) 클러스터 픽셀 스프라이트 엔진.
 * - 사용자 레퍼런스 GIF 2종:
 *   1) Idle_rotations_8dir.gif (32x32 50색 대기 해병)
 *   2) 9ae4e7c5-19dd-452a-b23a-c089391faabb_rotations_8dir.gif (32x32 68색 사격 해병 — 대각선 소총 파지 + 탄피 배출 + 대형 총구 화염)
 * - 8방향('S' | 'SE' | 'E' | 'NE' | 'N' | 'NW' | 'W' | 'SW') 입체 턴테이블 회전(정면 S, 45도 반측면 SE/SW, 90도 완전 측면 E/W, 135도 후측면 NE/NW, 180도 완전 후면 N)과
 *   대기(IDLE, 2프레임 호흡) · 이동(WALK, 4프레임 보행) · 공격(ATTACK, 2프레임 사격/참격/방사) 애니메이션을 전 유닛 20종에 적용한다.
 */
export const SPRITE_SIZE = 32;

export type Rgb = [number, number, number];

/** 8방향 회전 열거형 (화면 좌표계: +x 우측/E, +y 하단/S) */
export type SpriteDir8 = 'S' | 'SE' | 'E' | 'NE' | 'N' | 'NW' | 'W' | 'SW';

/** 스프라이트 애니메이션 상태 */
export type SpriteAnim = 'IDLE' | 'WALK' | 'ATTACK';

export const ALL_DIRS_8: readonly SpriteDir8[] = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];

/** 라디안 각도(atan2(dy, dx))를 8방향(SpriteDir8)으로 양자화한다 */
export function angleToDir8(angleRad: number): SpriteDir8 {
  const deg = ((angleRad * 180) / Math.PI + 360) % 360;
  if (deg >= 337.5 || deg < 22.5) {
    return 'E';
  }
  if (deg < 67.5) {
    return 'SE';
  }
  if (deg < 112.5) {
    return 'S';
  }
  if (deg < 157.5) {
    return 'SW';
  }
  if (deg < 202.5) {
    return 'W';
  }
  if (deg < 247.5) {
    return 'NW';
  }
  if (deg < 292.5) {
    return 'N';
  }
  return 'NE';
}

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
 * 1) 레퍼런스 대기 해병(Idle_rotations_8dir.gif) 원본 50색 팔레트 & 32x32 픽셀 매트릭스.
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

/**
 * 2) 레퍼런스 사격 해병(9ae4e7c5-19dd-452a-b23a-c089391faabb_rotations_8dir.gif) 원본 68색 팔레트 & 32x32 픽셀 매트릭스.
 */
const MARINE_ATK_PALETTE: Readonly<Record<string, string>> = {
  '0': '#070a10',
  '1': '#6480ad',
  '2': '#414983',
  '3': '#3c4280',
  '4': '#505f93',
  '5': '#9fbadd',
  '6': '#d6f1fb',
  '7': '#070a10',
  '8': '#373970',
  '9': '#181836',
  a: '#bb692d',
  b: '#3d4179',
  c: '#586ea0',
  d: '#272554',
  e: '#302f64',
  f: '#647497',
  g: '#dc9a36',
  h: '#302d5a',
  i: '#272659',
  j: '#bed6de',
  k: '#f1cb65',
  l: '#464a7b',
  m: '#a85b31',
  n: '#7f7e7c',
  o: '#e7b047',
  p: '#061e20',
  q: '#b05329',
  r: '#b0cfeb',
  s: '#859fc4',
  t: '#bcdcf3',
  u: '#cbe8f8',
  v: '#d9ecee',
  w: '#8da6d4',
  x: '#cb812f',
  y: '#35ebda',
  z: '#c2762f',
  A: '#6d7e9a',
  B: '#984730',
  C: '#6b6d71',
  D: '#08394e',
  E: '#a04c2a',
  F: '#383664',
  G: '#423f6d',
  H: '#979696',
  I: '#555353',
  J: '#56587a',
  K: '#89462d',
  L: '#383454',
  M: '#46413d',
  N: '#768eb4',
  O: '#403a36',
  P: '#1f1c20',
  Q: '#2e2524',
  R: '#4d4945',
  S: '#69432f',
  T: '#323031',
  U: '#362b41',
  V: '#626262',
  W: '#070a10',
  X: '#5a4a3c',
  Y: '#2a254b',
  Z: '#eb7724',
  '!': '#fce856',
  '@': '#ffffff',
  '#': '#fff7b7',
  $: '#fcf684',
  '%': '#f8d354',
  '^': '#fefdd9',
};

const MARINE_ATK_GRID: readonly string[] = [
  '................................',
  '..........00.......00...........',
  '.........0120.....03400.........',
  '........0561200000721650........',
  '........7489724aa4b79bc0........',
  '........0d7e72fgg127h7i0........',
  '.....000720031jkkj1270l000......',
  '....724112m03noppgn30qb11l0.....',
  '...722r66rk030stts030ku6vgl7....',
  '...i2166t1k0w006600w0k166v130...',
  '..0d311111x030y12y0b0z11Az12e0..',
  '..0Bb31222q00CDCCDC00E22411FB0..',
  '...0EbbGzG0l0bCHHCl0b0GaGllq0...',
  '...00EzzAa0lE00CC00B27aAzzE00...',
  '....000000I0JK0000Bft9000000....',
  '....0LJF00MC000llAb6G0hJ4F0.....',
  '....0xkaF0MMICC0kzA8z00000......',
  '...0BlNv180OPQRn008f00mooq0.....',
  '...0ElAx6f00QSKTHI000bNvAF0.....',
  '...0Lazx690I00KaQHM00AuNAe0.....',
  '....0Uaxl0VHR0WXaQRHM7AAgS0.....',
  '.....00hh0VV0000TMSKHV00I0......',
  '.......000000Y0M00SBETHR0R.ZZZ..',
  '...Xk...0uu0lY0MV000SEM0WZ!!Z...',
  '....R..0011Y700MV00C0XPX!@@!#ZZ.',
  '.......0BGlBh0.0MV00C0PZ@@@$Z...',
  '.......0FBBYe0..000d700Z$@@@!Z..',
  '.......7YYbd7......7d88L%@$@@!Z.',
  '......0lt19d0......0d9fjZZ!Z!^!.',
  '......0z%zq00......00qzkxW..ZZ!Z',
  '.......0000..........000W.Z...Z.',
  '................................',
];

/** 레퍼런스 사격 GIF(9ae4e7c5...gif)에서 추출한 10x9 톱니형 총구 화염 템플릿 (우하단 +45도 기준) */
const MUZZLE_FLASH_TEMPLATE_SE: readonly string[] = [
  '.....ZZZ..',
  '...WZ!!Z..',
  '..X!@@!#ZZ',
  '..PZ@@@$Z.',
  '..Z$@@@!Z.',
  '..L%@$@@!Z',
  '..ZZ!Z!^!.',
  '......ZZ!Z',
  '....Z...Z.',
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

type CanonicalDir5 = 'S' | 'SE' | 'E' | 'NE' | 'N';

function toCanonicalDir(dir: SpriteDir8): { cDir: CanonicalDir5; flipX: boolean } {
  switch (dir) {
    case 'SW':
      return { cDir: 'SE', flipX: true };
    case 'W':
      return { cDir: 'E', flipX: true };
    case 'NW':
      return { cDir: 'NE', flipX: true };
    default:
      return { cDir: dir, flipX: false };
  }
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

  public sculptVisorFace(
    cy: number,
    body: ClusterRamp8,
    trim: TrimRamp5,
    eyeCol: Rgb,
    maskMode: 'RESPIRATOR' | 'TEMPLAR' | 'FANGS',
    xShift: number = 0
  ): void {
    const cxL = 15 + xShift;
    const cxR = 16 + xShift;
    this.px(cxL, cy - 3, trim.t3);
    this.px(cxR, cy - 3, trim.t3);
    this.px(cxL, cy - 2, trim.t4);
    this.px(cxR, cy - 2, trim.t4);
    this.px(cxL - 1, cy - 1, body.c6);
    this.px(cxL, cy - 1, body.c7);
    this.px(cxR, cy - 1, body.c7);
    this.px(cxR + 1, cy - 1, body.c6);

    for (const [ox, ex] of [
      [cxL - 3, cxL - 2],
      [cxR + 3, cxR + 2],
    ]) {
      this.px(ox, cy, OUTLINE_RGB);
      this.px(ex, cy - 1, OUTLINE_RGB);
      this.px(ex, cy, eyeCol);
      this.px(ex + (ex < cxL ? 1 : -1), cy, lighten(eyeCol, 0.55));
      this.px(ex, cy + 1, darken(eyeCol, 0.45));
      this.px(ox, cy + 1, OUTLINE_RGB);
    }
    this.px(cxL, cy, body.c4);
    this.px(cxR, cy, body.c4);
    this.px(cxL, cy + 1, body.c5);
    this.px(cxR, cy + 1, body.c5);

    if (maskMode === 'RESPIRATOR') {
      this.hLine(cxL - 2, cxR + 2, cy + 2, [113, 112, 115]);
      this.px(cxL, cy + 2, [210, 215, 222]);
      this.px(cxR, cy + 2, [154, 154, 156]);
      this.hLine(cxL - 1, cxR + 1, cy + 3, [113, 112, 115]);
      this.px(cxL - 2, cy + 3, OUTLINE_RGB);
      this.px(cxR + 2, cy + 3, OUTLINE_RGB);
    } else if (maskMode === 'TEMPLAR') {
      this.px(cxL, cy - 2, eyeCol);
      this.px(cxR, cy - 2, eyeCol);
      this.hLine(cxL - 1, cxR + 1, cy + 2, body.c6);
      this.hLine(cxL - 1, cxR + 1, cy + 3, trim.t4);
    } else {
      this.px(cxL - 3, cy + 2, [248, 244, 232]);
      this.px(cxR + 3, cy + 2, [248, 244, 232]);
      this.px(cxL - 2, cy + 2, OUTLINE_RGB);
      this.px(cxR + 2, cy + 2, OUTLINE_RGB);
      this.px(cxL - 1, cy + 2, [248, 244, 232]);
      this.px(cxR + 1, cy + 2, [248, 244, 232]);
      this.px(cxL, cy + 2, [112, 22, 38]);
      this.px(cxR, cy + 2, [112, 22, 38]);
      this.hLine(cxL - 1, cxR + 1, cy + 3, OUTLINE_RGB);
    }
  }

  public sculptSegmentedTorso(
    cy: number,
    body: ClusterRamp8,
    trim: TrimRamp5,
    coreCol: Rgb
  ): void {
    this.symRect(11, cy - 2, 4, 4, body.c3);
    this.symPx(12, cy - 1, body.c7);
    this.symPx(13, cy, body.c7);
    this.symPx(12, cy - 2, trim.t1);
    this.symPx(13, cy - 1, trim.t2);
    this.symPx(11, cy + 1, trim.t2);
    this.symPx(15, cy - 1, OUTLINE_RGB);
    this.symPx(15, cy, coreCol);
    this.symPx(14, cy + 1, trim.t3);
    this.symPx(15, cy + 1, trim.t4);
    this.hLine(11, 20, cy + 2, OUTLINE_RGB);
    this.symPx(15, cy + 3, body.c6);
    this.symPx(14, cy + 3, body.c3);
    this.symPx(15, cy + 4, body.c7);
    this.symPx(14, cy + 4, body.c2);
    this.symPx(13, cy + 4, trim.t1);
    this.symPx(13, cy + 5, trim.t2);
    this.symPx(15, cy + 5, body.c4);
  }

  /**
   * 레퍼런스 사격 GIF(9ae4e7c5...gif)의 C-14 가우스 소총(구리색 개머리판 + 건메탈 총열)을 임의의 두 점 사이에 조각한다.
   */
  public stampGaussRifle(x0: number, y0: number, x1: number, y1: number): void {
    const stockDark: Rgb = [70, 65, 61];
    const stockCopper: Rgb = [160, 76, 42];
    const stockAmber: Rgb = [203, 129, 47];
    const gunDark: Rgb = [46, 37, 36];
    const gunMid: Rgb = [98, 98, 98];
    const gunSpec: Rgb = [151, 150, 150];

    const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
    const vx = (x1 - x0) / steps;
    const vy = (y1 - y0) / steps;
    const nx = -vy;
    const ny = vx;

    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const cx = x0 + vx * i;
      const cy = y0 + vy * i;
      // 외곽 1px 흑색 테두리
      this.px(cx + nx * 2, cy + ny * 2, OUTLINE_RGB);
      this.px(cx - nx * 2, cy - ny * 2, OUTLINE_RGB);
      // 상단 총열 하이라이트 + 중앙 리시버 + 하단 구리 핸드가드
      if (t < 0.45) {
        this.px(cx + nx, cy + ny, stockAmber);
        this.px(cx, cy, stockCopper);
        this.px(cx - nx, cy - ny, stockDark);
      } else {
        this.px(cx + nx, cy + ny, gunSpec);
        this.px(cx, cy, gunMid);
        this.px(cx - nx, cy - ny, gunDark);
      }
    }
  }

  /**
   * 레퍼런스 사격 GIF(9ae4e7c5...gif) 원본 10x9 톱니형 총구 화염 매트릭스(MUZZLE_FLASH_TEMPLATE_SE)를
   * 목표 조준 방향(dirX, dirY)으로 역회전 샘플링(Inverse Rotation Sampling)하여 빈 픽셀 없이 스탬핑한다.
   */
  public stampMuzzleBlast(
    cx: number,
    cy: number,
    dirX: number,
    dirY: number,
    f: number,
    theme: 'FIRE' | 'ACID' | 'CYAN' | 'CRIMSON' = 'FIRE'
  ): void {
    const mapColor = (ch: string): Rgb | null => {
      if (ch === '.' || (f % 2 === 1 && ch === 'Z')) {
        return null;
      }
      if (ch === 'W' || ch === 'X' || ch === 'P' || ch === 'L') {
        // 원본에서 총열 끝단과 겹치던 픽셀은 화염 내부 황금색으로 채워 회전 시 검은 구멍이 생기지 않게 한다
        ch = '!';
      }
      if (ch === '@' || ch === '^') {
        return [255, 255, 255];
      }
      if (theme === 'ACID') {
        return ch === '$' || ch === '#'
          ? [242, 255, 175]
          : ch === '!' || ch === '%'
            ? [184, 238, 64]
            : [88, 168, 28];
      }
      if (theme === 'CYAN') {
        return ch === '$' || ch === '#'
          ? [215, 254, 255]
          : ch === '!' || ch === '%'
            ? [95, 224, 255]
            : [32, 136, 204];
      }
      if (theme === 'CRIMSON') {
        return ch === '$' || ch === '#'
          ? [255, 224, 195]
          : ch === '!' || ch === '%'
            ? [255, 96, 82]
            : [178, 28, 46];
      }
      const hex = MARINE_ATK_PALETTE[ch];
      return hex ? hexToRgb(hex) : [235, 119, 36];
    };

    const targetAng = Math.atan2(dirY, dirX);
    const refAng = Math.PI / 4;
    const dAng = targetAng - refAng;
    const cosA = Math.cos(dAng);
    const sinA = Math.sin(dAng);
    const h = MUZZLE_FLASH_TEMPLATE_SE.length;
    const w = MUZZLE_FLASH_TEMPLATE_SE[0].length;

    for (let dy = -6; dy <= 6; dy += 1) {
      for (let dx = -6; dx <= 6; dx += 1) {
        const tx = Math.round(dx * cosA + dy * sinA + 4.5);
        const ty = Math.round(-dx * sinA + dy * cosA + 4.0);
        if (ty < 0 || ty >= h || tx < 0 || tx >= w) {
          continue;
        }
        const col = mapColor(MUZZLE_FLASH_TEMPLATE_SE[ty][tx]);
        if (col) {
          this.px(Math.round(cx + dx), Math.round(cy + dy), col);
        }
      }
    }
  }

  public sculptDorsalBackplate(
    palette: FactionPalette,
    mode: 'MECH' | 'BIO' | 'TEMPLAR',
    xShift: number = 0
  ): void {
    const sp = buildStudioPalette(palette);
    this.partDome(15.5 + xShift, 8.5, 4.4, 4.0, sp.body, { trim: sp.trim, trimBottom: true });
    this.vLine(15 + xShift, 5, 11, sp.trim.t3);
    this.vLine(16 + xShift, 5, 11, sp.trim.t4);

    if (mode === 'MECH') {
      this.partDome(11.5 + xShift, 14, 3.6, 4.6, sp.body, { trim: sp.trim, trimBottom: true });
      this.partDome(19.5 + xShift, 14, 3.6, 4.6, sp.body, { trim: sp.trim, trimBottom: true });
      this.rect(14 + xShift, 12, 4, 6, OUTLINE_RGB);
      this.rect(15 + xShift, 13, 2, 4, sp.metal.t2);
      this.px(15 + xShift, 14, sp.eyeGlow);
      this.px(16 + xShift, 14, sp.eyeGlow);
    } else if (mode === 'BIO') {
      this.partDome(15.5 + xShift, 14.5, 6.2, 5.2, sp.body, { trim: sp.trim, trimBottom: true });
      for (let ty = 11; ty <= 17; ty += 2) {
        this.px(15 + xShift, ty, sp.trim.t4);
        this.px(16 + xShift, ty, sp.white);
      }
    } else {
      this.partDome(15.5 + xShift, 14.5, 5.8, 4.8, sp.body, { trim: sp.trim, trimBottom: true });
      this.partDome(15.5 + xShift, 14.5, 2.5, 2.5, makeRamp8(sp.trim.t3, sp.trim.t0, sp.white));
    }
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

function buildPaletteColorMap(
  sourcePalette: Readonly<Record<string, string>>,
  palette: FactionPalette,
  customEye?: Rgb
): Record<string, Rgb> {
  const isDefaultIronclad = palette.primary.toLowerCase() === '#4f7fb8' && !customEye;
  const sp = buildStudioPalette(palette);
  const eye = customEye ?? sp.eyeGlow;
  const colorMap: Record<string, Rgb> = {};

  for (const [k, hex] of Object.entries(sourcePalette)) {
    if (k === '0' || k === '7' || k === 'B' || k === 'W') {
      colorMap[k] = OUTLINE_RGB;
    } else if (isDefaultIronclad) {
      colorMap[k] = hexToRgb(hex);
    } else {
      const [r, g, b] = hexToRgb(hex);
      if (k === 'r' || k === 'y') {
        colorMap[k] = eye;
      } else if (k === 'u' || k === 'D') {
        colorMap[k] = darken(eye, 0.55);
      } else if (k === '@' || k === '^') {
        colorMap[k] = sp.white;
      } else if (k === '!' || k === '#' || k === '$' || k === '%') {
        colorMap[k] = sp.trim.t4;
      } else if (k === 'Z') {
        colorMap[k] = sp.trim.t2;
      } else if (r > b + 35) {
        colorMap[k] =
          r > 240
            ? sp.trim.t4
            : r > 220
              ? sp.trim.t3
              : r > 195
                ? sp.trim.t2
                : r > 175
                  ? sp.trim.t1
                  : sp.trim.t0;
      } else if (Math.abs(r - g) <= 12 && Math.abs(g - b) <= 14) {
        colorMap[k] = r > 140 ? sp.metal.t3 : r > 95 ? sp.metal.t2 : sp.metal.t0;
      } else {
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
  return colorMap;
}

/**
 * 완전 측면('E' / 'W') 32x32 프로파일 조형기:
 * - 좌측(뒤쪽)에 등면 원자로 백팩, 중앙에 단일 대구경 견갑, 우측(앞쪽)을 바라보는 측면 투구·바이저·호흡기,
 *   앞뒤로 교차 보행하는 측면 다리·부츠(우측 앞코)로 진짜 90도 측면 실루엣을 만든다!
 */
function sculptEastSideProfile32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  anim: SpriteAnim,
  yOffset: number,
  customEye?: Rgb,
  dorsalMode: 'MECH' | 'BIO' | 'TEMPLAR' = 'MECH',
  useRifle: boolean = true
): void {
  const sp = buildStudioPalette(palette);
  const eye = customEye ?? sp.eyeGlow;
  const walkCycle = anim === 'WALK' ? ((frame % 4) + 4) % 4 : frame % 2;
  const bob = anim === 'IDLE' && walkCycle === 1 ? -1 : anim === 'WALK' && walkCycle % 2 === 1 ? -1 : 0;
  const y0 = yOffset + bob;

  // 1) 다리 교차 보행 (측면 가위걸음: 뒷다리 vs 앞다리)
  const stride = anim === 'WALK' ? (walkCycle === 0 ? 3 : walkCycle === 2 ? -3 : 0) : 0;
  const backLegX = 12 - stride;
  const frontLegX = 18 + stride;

  // 뒷다리 (약간 어두운 톤)
  c.partDome(backLegX, 24, 3.0, 3.6, sp.body, { trim: sp.trim, trimBottom: true });
  c.partDome(backLegX + 1, 28, 3.4, 2.0, sp.body, { trim: sp.trim, trimBottom: true });

  // 2) 좌측(등 뒤) 백팩 / 생체 등갑 / 템플러 등판
  if (dorsalMode === 'MECH') {
    c.partDome(8.5, 11 + y0, 3.6, 5.2, sp.body, { trim: sp.trim, trimBottom: true });
    c.partDome(9.5, 4.5 + y0, 2.4, 2.4, sp.body);
  } else if (dorsalMode === 'BIO') {
    c.partDome(8.5, 12 + y0, 4.2, 5.5, sp.body, { trim: sp.trim, trimBottom: true });
  } else {
    c.partDome(9.5, 12 + y0, 3.2, 4.8, sp.body, { trim: sp.trim, trimBottom: true });
  }

  // 3) 측면 흉곽 & 골반
  c.partDome(15.5, 15.5 + y0, 5.2, 4.8, sp.body, { trim: sp.trim, trimBottom: true });
  c.partDome(15.5, 20.5 + y0, 4.2, 2.8, sp.body, { trim: sp.trim, trimBottom: true });

  // 4) 앞다리 (무릎 아이스화이트 캡 + 구리 스트랩 + 우측을 향한 황금 앞코 부츠!)
  c.partDome(frontLegX, 24, 3.2, 3.8, sp.body, { trim: sp.trim, trimBottom: true });
  c.rect(frontLegX, 22, 2, 2, sp.body.c7); // 무릎 스페큘러 캡
  c.partDome(frontLegX + 1.5, 28.5, 3.8, 2.1, sp.body, { trim: sp.trim, trimBottom: true });
  c.rect(frontLegX + 2, 28, 3, 2, sp.trim.t4); // 우측을 향한 부츠 앞코

  // 5) 측면 투구/두개골 (우측을 바라보는 측면 바이저 안구 & 호흡기/송곳니)
  c.partDome(16.5, 8.2 + y0, 4.6, 4.4, sp.body, { trim: sp.trim, trimBottom: true });
  c.hLine(14, 19, 5 + y0, sp.trim.t4); // 투구 정수리 금장 스트라이프
  // 측면 안구 소켓 (우측 전면 x: 18..21)
  c.rect(18, 8 + y0, 4, 3, OUTLINE_RGB);
  c.px(19, 9 + y0, eye);
  c.px(20, 9 + y0, lighten(eye, 0.55));
  if (dorsalMode === 'MECH') {
    // 우측으로 돌출된 호흡기 마스크
    c.rect(18, 11 + y0, 4, 3, sp.metal.t2);
    c.px(20, 11 + y0, sp.metal.t3);
  } else if (dorsalMode === 'BIO') {
    // 우측으로 튀어나온 포식 송곳니
    c.px(20, 11 + y0, sp.bone.t4);
    c.px(21, 12 + y0, sp.white);
  }

  // 6) 중앙에 위치한 측면 대구경 견갑(Shoulder Pauldron) & 전면 팔/무기
  c.partDome(14.0, 11.5 + y0, 4.6, 4.2, sp.body, {
    trim: sp.trim,
    trimBottom: true,
    trimInnerSide: 'RIGHT',
  });

  if (anim === 'ATTACK' && useRifle) {
    // 측면 수평 소총 사격 + 탄피 배출 + 우측 톱니형 총구 화염!
    c.stampGaussRifle(13, 16 + y0, 24, 17 + y0);
    c.partDome(15, 17 + y0, 2.4, 2.2, sp.body, { trim: sp.trim, trimBottom: true });
    c.px(11, 12 + y0 - (frame % 2), sp.trim.t4);
    c.px(10, 13 + y0, sp.metal.t2);
    c.stampMuzzleBlast(27, 17 + y0, 1, 0, frame % 2, 'FIRE');
  } else {
    // 측면 팔 & 건틀릿
    const armSwing = anim === 'WALK' ? -stride * 0.5 : 0;
    c.partDome(15 + armSwing, 18.5 + y0, 3.2, 3.6, sp.body, { trim: sp.trim, trimBottom: true });
    if (useRifle) {
      c.stampGaussRifle(14 + armSwing, 18 + y0, 23 + armSwing, 21 + y0);
    }
  }
}

/**
 * 레퍼런스 해병 매트릭스를 5방위(S, SE, E, NE, N) 및 3가지 상태(IDLE, WALK, ATTACK)에 맞춰 스탬핑한다.
 */
function stampDirectionalMarine(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim,
  yOffset: number = 0,
  customEye?: Rgb,
  dorsalMode: 'MECH' | 'BIO' | 'TEMPLAR' = 'MECH',
  useAttackRifleGrid: boolean = true
): void {
  // 완전 측면('E')일 때는 전용 90도 측면 프로파일 조형기로 렌더링
  if (cDir === 'E') {
    sculptEastSideProfile32(
      c,
      palette,
      frame,
      anim,
      yOffset,
      customEye,
      dorsalMode,
      useAttackRifleGrid
    );
    return;
  }

  const isAttack = anim === 'ATTACK';
  const useAtkGrid = isAttack && useAttackRifleGrid && (cDir === 'SE' || cDir === 'S');
  const grid = useAtkGrid ? MARINE_ATK_GRID : MARINE_REF_GRID;
  const colorMap = buildPaletteColorMap(
    useAtkGrid ? MARINE_ATK_PALETTE : MARINE_REF_PALETTE,
    palette,
    customEye
  );

  const walkCycle = anim === 'WALK' ? ((frame % 4) + 4) % 4 : frame % 2;
  const is34Turn = cDir === 'SE' || cDir === 'NE';

  for (let y = 0; y < 32; y += 1) {
    const row = grid[y] ?? '';
    for (let x = 0; x < 32; x += 1) {
      const ch = row[x];
      if (!ch || ch === '.') {
        continue;
      }
      if (useAtkGrid && frame % 2 === 1 && ch === 'Z' && (x + y) % 2 === 0) {
        continue;
      }
      // 정면('S') 사격 시 우하단 원본 총구 화염은 지우고 아래에서 정면 하단으로 회전 스탬핑
      if (useAtkGrid && cDir === 'S' && x >= 22 && y >= 22 && '!@#$%^Z'.includes(ch)) {
        continue;
      }

      const rgb = colorMap[ch];
      if (!rgb) {
        continue;
      }

      let dx = 0;
      let dy = yOffset;

      // 45도 반측면(SE / NE) 3/4 턴테이블 시차(Parallax):
      // 머리·흉부 중심선이 우측으로 +2px 회전하고, 좌측(뒤쪽) 견갑이 앞으로 나와 넓어지며 우측 다리가 반 보 앞으로 나간다
      if (!useAtkGrid && is34Turn) {
        if (y >= 3 && y <= 14 && x >= 11 && x <= 20) {
          dx += 2;
        } else if (y >= 13 && y <= 22 && x >= 10 && x <= 21) {
          dx += 1;
        } else if (x < 11 && y >= 6 && y <= 14) {
          dx += 1;
        } else if (y >= 23 && x >= 16) {
          dy += 1;
        }
      }

      // WALK 4프레임 보행 다리/팔 교차 모션 & IDLE 2프레임 호흡
      if (anim === 'WALK') {
        const isLeftHalf = x < 16;
        const isLeg = y >= 23;
        const isArm = y >= 15 && y <= 23 && (x <= 8 || x >= 23);
        if (walkCycle === 0) {
          if (isLeg) dy += isLeftHalf ? -2 : 1;
          else if (isArm) dy += isLeftHalf ? 1 : -1;
        } else if (walkCycle === 1) {
          if (y < 23) dy -= 1;
        } else if (walkCycle === 2) {
          if (isLeg) dy += isLeftHalf ? 1 : -2;
          else if (isArm) dy += isLeftHalf ? -1 : 1;
        } else {
          if (isArm) dy -= 1;
        }
      } else if (anim === 'IDLE' && walkCycle === 1) {
        if (y >= 6 && y <= 22) {
          dy -= 1;
        }
      } else if (anim === 'ATTACK' && frame % 2 === 1) {
        if (y <= 21) {
          dx -= is34Turn ? 1 : 0;
          dy -= cDir === 'S' ? 1 : 0;
        }
      }

      c.px(x + dx, y + dy, rgb);
    }
  }

  // 후면 방향('N' / 'NE')일 때 등면 원자로 백팩 / 생체 등껍질 / 광배 스탬핑
  if (cDir === 'N' || cDir === 'NE') {
    c.sculptDorsalBackplate(palette, dorsalMode, cDir === 'NE' ? 2 : 0);
  }

  // 화기 보유 유닛(소총병/사령관)의 방향별 구리·건메탈 소총 & 톱니형 총구 화염 ('S', 'NE', 'N')
  if (isAttack && useAttackRifleGrid) {
    if (cDir === 'S') {
      c.stampGaussRifle(13, 16 + yOffset, 17, 25 + yOffset);
      c.stampMuzzleBlast(17, 27 + yOffset, 0, 1, frame % 2, 'FIRE');
    } else if (cDir === 'NE') {
      c.stampGaussRifle(16, 17 + yOffset, 25, 8 + yOffset);
      c.stampMuzzleBlast(26, 6 + yOffset, 1, -1, frame % 2, 'FIRE');
    } else if (cDir === 'N') {
      c.stampGaussRifle(19, 13 + yOffset, 19, 5 + yOffset);
      c.stampMuzzleBlast(19, 4 + yOffset, 0, -1, frame % 2, 'FIRE');
    }
  }
}

/** 방향 벡터 조회 헬퍼 */
function dirVector(cDir: CanonicalDir5): { dx: number; dy: number } {
  switch (cDir) {
    case 'S':
      return { dx: 0, dy: 1 };
    case 'SE':
      return { dx: 0.75, dy: 0.75 };
    case 'E':
      return { dx: 1, dy: 0 };
    case 'NE':
      return { dx: 0.75, dy: -0.75 };
    case 'N':
      return { dx: 0, dy: -1 };
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

function drawSoldier32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  stampDirectionalMarine(c, palette, frame, cDir, anim, 0, undefined, 'MECH', true);
}

function drawIroncladCommander32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;

  const paintCape = (): void => {
    const capeShift = cDir === 'E' ? -4 : cDir === 'SE' || cDir === 'NE' ? -2 : 0;
    const minX = cDir === 'E' ? 4 : 3;
    const maxX = cDir === 'E' ? 14 : 28;
    for (let y = 11; y <= 28; y += 1) {
      const halfW = Math.min(13, 6 + Math.floor((y - 10) * 0.45));
      for (let x = 16 - halfW; x <= 15 + halfW; x += 1) {
        const cx = x + capeShift;
        if (cx < minX || cx > maxX) {
          continue;
        }
        if (x === 16 - halfW || x === 15 + halfW || cx === minX || cx === maxX || y === 28) {
          c.px(cx, y, OUTLINE_RGB);
        } else if (y === 27) {
          c.px(cx, y, sp.trim.t4);
        } else if (y === 26) {
          c.px(cx, y, sp.trim.t2);
        } else {
          const edgeDist = Math.min(x - (16 - halfW), 15 + halfW - x);
          c.px(
            cx,
            y,
            edgeDist <= 2 ? sp.crimson.t3 : edgeDist <= 4 ? sp.crimson.t2 : sp.crimson.t0
          );
        }
      }
    }
  };

  if (cDir !== 'N') {
    paintCape();
  }

  stampDirectionalMarine(c, palette, frame, cDir, anim, 0, undefined, 'MECH', true);

  if (cDir === 'N') {
    paintCape();
  }

  const hx = cDir === 'E' ? 2 : cDir === 'SE' || cDir === 'NE' ? 2 : 0;
  c.vLine(10 + hx, 0, 4, OUTLINE_RGB);
  c.vLine(9 + hx, 1, 4, sp.metal.t3);
  c.px(9 + hx, 0, f === 0 ? sp.eyeGlow : sp.crimson.t3);
  c.px(15 + hx, 3, sp.trim.t4);
  c.px(16 + hx, 3, sp.trim.t4);
}

function drawFlamer32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;
  const tankRamp = makeRamp8(sp.crimson.t3, sp.crimson.t0, sp.trim.t4);

  stampDirectionalMarine(c, palette, frame, cDir, anim, 0, undefined, 'MECH', false);

  if (cDir === 'N' || cDir === 'NE') {
    c.symPartDome(11, 11, 3.6, 5.8, tankRamp, { trim: sp.trim, trimBottom: true });
  } else if (cDir === 'E') {
    c.partDome(7.5, 10, 3.8, 5.5, tankRamp, { trim: sp.trim, trimBottom: true });
  } else {
    c.symPartDome(9, 4, 3.2, 3.5, tankRamp, { trim: sp.trim, trimBottom: true });
  }

  if (cDir !== 'N' && cDir !== 'NE') {
    const vx = cDir === 'E' ? 16 : cDir === 'SE' ? 14 : 12;
    const vw = cDir === 'E' ? 6 : 8;
    c.rect(vx, 7, vw, 7, OUTLINE_RGB);
    for (let y = 8; y <= 12; y += 1) {
      for (let x = vx + 1; x <= vx + vw - 2; x += 1) {
        const d = Math.hypot(x - (vx + 2.5), y - 9.5);
        c.px(x, y, d < 1.3 ? sp.white : d < 2.4 ? sp.trim.t4 : sp.crimson.t2);
      }
    }
  }

  if (anim === 'ATTACK') {
    const { dx, dy } = dirVector(cDir);
    c.stampMuzzleBlast(16 + dx * 10, 18 + dy * 9, dx, dy, f, 'FIRE');
  } else if (cDir !== 'E') {
    c.symRect(1, 20, 6, 6, OUTLINE_RGB);
    c.symRect(2, 21, 4, 4, sp.metal.t1);
    c.symPx(3, 25, sp.eyeGlow);
    c.symPx(3, 25 + f, sp.trim.t4);
  }
}

function drawWalker32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;
  const metalRamp = makeRamp8(sp.metal.t3, sp.metal.t0, sp.white);
  const recoil = anim === 'ATTACK' ? 1 : 0;

  if (cDir === 'E') {
    c.partCapsule(10, 8 + recoil, 7, 1 + recoil, 2.6, metalRamp);
  } else {
    c.symPartCapsule(9, 7 + recoil, 7, 1 + recoil, 2.5, metalRamp);
    c.symPx(6, 1 + recoil, OUTLINE_RGB);
    c.symPx(7, 1 + recoil, sp.crimson.t3);
    c.symPx(8, 3 + recoil, sp.trim.t4);
  }

  stampDirectionalMarine(c, palette, frame, cDir, anim, 1, undefined, 'MECH', false);
  if (cDir !== 'N' && cDir !== 'NE' && cDir !== 'E') {
    const hx = cDir === 'SE' ? 2 : 0;
    for (let y = 1; y <= 13; y += 1) {
      for (let x = 10; x <= 21; x += 1) {
        c.clearPx(x, y);
      }
    }
    c.partDome(15.5 + hx, 10, 6.2, 5.2, sp.body, { trim: sp.trim, trimBottom: true });
    c.sculptVisorFace(10, sp.body, sp.trim, sp.eyeGlow, 'RESPIRATOR', hx);
  }

  if (cDir !== 'E') {
    c.symRect(1, 18 - f, 6, 8, OUTLINE_RGB);
    c.symRect(2, 19 - f, 4, 6, sp.metal.t1);
    c.symVLine(2, 19 - f, 24 - f, sp.metal.t4);
    c.symVLine(4, 19 - f, 24 - f, sp.metal.t3);
    c.symPx(3, 18 - f, sp.trim.t4);
  }

  if (anim === 'ATTACK') {
    if (cDir === 'E') {
      c.stampMuzzleBlast(8, 3, -0.3, -1, f, 'FIRE');
      c.stampMuzzleBlast(25, 18, 1, 0, f, 'FIRE');
    } else {
      c.stampMuzzleBlast(7, 3, -0.3, -1, f, 'FIRE');
      c.stampMuzzleBlast(24, 3, 0.3, -1, f, 'FIRE');
    }
  }
}

function drawDrone32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;
  const metalRamp = makeRamp8(sp.metal.t3, sp.metal.t0, sp.white);
  const yOff = f === 0 ? 0 : -1;
  const hx = cDir === 'E' ? 2 : cDir === 'SE' || cDir === 'NE' ? 1 : 0;

  c.symVLine(11, 2 + yOff, 6 + yOff, OUTLINE_RGB);
  c.symVLine(10, 3 + yOff, 6 + yOff, sp.metal.t3);
  c.symPx(10, 2 + yOff, sp.eyeGlow);

  c.symPartCapsule(10, 19 + yOff, 7, 25 + yOff, 2.0, metalRamp);
  c.symPartCapsule(7, 25 + yOff, 12, 28 + yOff, 1.8, sp.body);
  c.partDome(15.5 + hx, 28 + yOff, 3.0, 2.0, makeRamp8(sp.eyeGlow, sp.eyeSocket, sp.white));

  c.symPartDome(4.5, 13 + yOff, 3.8, 5.2, sp.body, {
    trim: sp.trim,
    trimBottom: true,
    trimInner: true,
  });
  c.symRect(3, 12 + yOff, 3, 3, OUTLINE_RGB);
  c.symPx(4, 13 + yOff, sp.eyeGlow);
  c.symPx(4, 19 + yOff, sp.eyeGlow);
  c.symPx(5, 19 + yOff, sp.white);

  c.partDome(15.5 + hx, 13 + yOff, 7.2, 6.8, sp.body, { trim: sp.trim, trimBottom: true });
  if (cDir !== 'N') {
    c.sculptVisorFace(15 + yOff, sp.body, sp.trim, sp.eyeGlow, 'RESPIRATOR', hx);
  }

  c.rect(13 + hx, 6 + yOff, 6, 6, OUTLINE_RGB);
  c.rect(14 + hx, 7 + yOff, 4, 4, sp.trim.t3);
  c.vLine(15 + hx, 7 + yOff, 10 + yOff, sp.white);
  c.vLine(16 + hx, 7 + yOff, 10 + yOff, sp.white);
  c.hLine(14 + hx, 17 + hx, 8 + yOff, sp.white);
  c.hLine(14 + hx, 17 + hx, 9 + yOff, sp.eyeGlow);

  if (anim === 'ATTACK') {
    const { dx, dy } = dirVector(cDir);
    c.stampMuzzleBlast(16 + dx * 6, 26 + dy * 3, dx, dy, f, 'CYAN');
  }
}

// ─────────────────────────── 2. 적응 군체 (ADAPTIVE HIVE) ───────────────────────────

function drawHiveCommander32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;
  const acidRamp = makeRamp8(sp.trim.t3, sp.trim.t0, [242, 255, 170]);
  const boneRamp = makeRamp8(sp.bone.t3, sp.bone.t0, sp.white);
  const hx = cDir === 'E' ? 2 : cDir === 'SE' || cDir === 'NE' ? 2 : 0;

  c.symPartCapsule(10, 9, 3, 2 - f, 2.2, boneRamp);
  c.symPartCapsule(3, 2 - f, 1, 11 - f, 1.8, boneRamp);
  c.symPx(2, 5 - f, sp.trim.t4);
  c.symPartCapsule(9, 14, 2, 13 + f, 1.9, boneRamp);
  c.symPartCapsule(2, 13 + f, 1, 21 + f, 1.6, boneRamp);

  c.partDome(15.5 - hx, 27, 8.5, 3.2, sp.body, { trim: sp.trim, trimBottom: true });
  c.symPartDome(9, 27, 2.4, 2.0, acidRamp);

  stampDirectionalMarine(c, palette, frame, cDir, anim, 0, sp.trim.t4, 'BIO', false);

  c.symPartCapsule(13, 5, 10, 1, 1.5, boneRamp);
  c.partDome(15.5 + hx, 4.5, 2.6, 2.2, acidRamp);
  if (cDir !== 'N' && cDir !== 'NE' && cDir !== 'E') {
    c.sculptVisorFace(10, sp.body, sp.trim, sp.trim.t4, 'FANGS', hx);
    c.sculptSegmentedTorso(15, sp.body, sp.trim, sp.trim.t4);
  }

  if (anim === 'ATTACK') {
    const { dx, dy } = dirVector(cDir);
    c.stampMuzzleBlast(16 + dx * 10, 18 + dy * 9, dx, dy, f, 'ACID');
  }
}

function drawClaw32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;
  const boneRamp = makeRamp8(sp.bone.t3, sp.bone.t0, sp.white);
  const hx = cDir === 'E' ? 2 : cDir === 'SE' || cDir === 'NE' ? 2 : 0;

  c.symPartCapsule(11, 8, 5, 1 + f, 2.0, boneRamp);
  c.symPartCapsule(5, 1 + f, 2, 9 + f, 1.8, boneRamp);
  c.symPx(4, 3 + f, sp.trim.t4);

  stampDirectionalMarine(c, palette, frame, cDir, anim, 1, sp.trim.t4, 'BIO', false);
  if (cDir !== 'N' && cDir !== 'NE' && cDir !== 'E') {
    c.sculptVisorFace(11, sp.body, sp.trim, sp.trim.t4, 'FANGS', hx);
  }

  if (cDir !== 'E') {
    c.symVLine(2, 23 - f, 27 - f, OUTLINE_RGB);
    c.symVLine(3, 22 - f, 27 - f, sp.bone.t4);
    c.symVLine(5, 22 - f, 26 - f, sp.bone.t3);
    c.symPx(3, 27 - f, sp.white);
  }

  if (anim === 'ATTACK') {
    const { dx, dy } = dirVector(cDir);
    c.stampMuzzleBlast(16 + dx * 9, 17 + dy * 9, dx, dy, f, 'ACID');
  }
}

function drawSpitter32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;
  const acidRamp = makeRamp8(sp.trim.t3, sp.trim.t0, [242, 255, 170]);
  const boneRamp = makeRamp8(sp.bone.t3, sp.bone.t0, sp.white);
  const hx = cDir === 'E' ? 2 : cDir === 'SE' || cDir === 'NE' ? 2 : 0;

  c.symPartCapsule(13, 5, 11, 1, 1.5, boneRamp);
  c.symPartCapsule(9, 6, 6, 1, 1.5, boneRamp);
  c.symPartCapsule(6, 9, 2, 4, 1.5, boneRamp);

  stampDirectionalMarine(c, palette, frame, cDir, anim, 0, sp.trim.t4, 'BIO', false);

  for (let y = 24; y <= 31; y += 1) {
    for (let x = 5; x <= 26; x += 1) {
      c.clearPx(x, y);
    }
  }
  c.partCapsule(9, 23, 7 - f, 27, 2.8, sp.body);
  c.partCapsule(7 - f, 27, 23 + f, 29, 2.8, sp.body);
  c.hLine(8, 22, 28, sp.trim.t3);

  if (cDir !== 'N' && cDir !== 'NE' && cDir !== 'E') {
    c.sculptVisorFace(10, sp.body, sp.trim, sp.trim.t4, 'FANGS', hx);
    c.partDome(15.5 + hx, 16, 3.2, 2.6 + f * 0.3, acidRamp);
  }
  c.symPartCapsule(4, 21, 2, 26 - f, 1.8, boneRamp);

  if (anim === 'ATTACK') {
    const { dx, dy } = dirVector(cDir);
    c.stampMuzzleBlast(16 + dx * 10, 16 + dy * 9, dx, dy, f, 'ACID');
  }
}

function drawSpewer32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;
  const acidRamp = makeRamp8(sp.trim.t3, sp.trim.t0, [245, 255, 185]);
  const hx = cDir === 'E' ? 2 : cDir === 'SE' || cDir === 'NE' ? 2 : 0;

  stampDirectionalMarine(c, palette, frame, cDir, anim, 1, sp.trim.t4, 'BIO', false);

  const pulse = anim === 'ATTACK' ? 0.8 : f * 0.4;
  if (cDir === 'E') {
    c.partDome(10, 8, 5.2 + pulse, 5.2 + pulse, acidRamp, { trim: sp.trim, trimBottom: true });
  } else {
    c.symPartDome(6.5, 7.5, 4.8 + pulse, 4.8 + pulse, acidRamp, {
      trim: sp.trim,
      trimBottom: true,
    });
    c.symPx(5, 6, sp.white);
    c.symPx(7, 8, sp.body.c2);
  }

  if (cDir !== 'N' && cDir !== 'NE' && cDir !== 'E') {
    c.sculptVisorFace(11, sp.body, sp.trim, sp.trim.t4, 'FANGS', hx);
    c.partDome(15.5 + hx, 16, 3.4, 2.8 + pulse, acidRamp);
  }

  if (anim === 'ATTACK') {
    const { dx, dy } = dirVector(cDir);
    c.stampMuzzleBlast(16 + dx * 10, 17 + dy * 9, dx, dy, f, 'ACID');
  }
}

function drawBeetle32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;
  const boneRamp = makeRamp8(sp.bone.t3, sp.bone.t0, sp.white);
  const acidRamp = makeRamp8(sp.trim.t3, sp.trim.t0, [242, 255, 170]);
  const hx = cDir === 'E' ? 2 : cDir === 'SE' || cDir === 'NE' ? 2 : 0;

  c.partDome(15.5, 7, 8.5, 5.5, sp.body, { trim: sp.trim, trimBottom: true });
  c.symPartDome(10, 5, 2.0, 1.8, acidRamp);

  stampDirectionalMarine(c, palette, frame, cDir, anim, 1, sp.trim.t4, 'BIO', false);
  if (cDir !== 'N' && cDir !== 'NE' && cDir !== 'E') {
    c.sculptVisorFace(11, sp.body, sp.trim, sp.trim.t4, 'FANGS', hx);
    c.sculptSegmentedTorso(16, sp.body, sp.trim, sp.trim.t4);
  }

  const swing = anim === 'ATTACK' ? 2 : f;
  c.symPartCapsule(6, 15, 2, 7 - swing, 2.5, boneRamp);
  c.symPartCapsule(2, 7 - swing, 6 + swing, 1, 2.2, boneRamp);
  c.symPx(6 + swing, 1, sp.white);

  if (anim === 'ATTACK') {
    const { dx, dy } = dirVector(cDir);
    c.stampMuzzleBlast(16 + dx * 9, 16 + dy * 9, dx, dy, f, 'ACID');
  }
}

// ─────────────────────────── 3. 성휘 교단 (LUMEN ORDER) ───────────────────────────

function drawLumenCommander32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;
  const crystalRamp = makeRamp8(sp.trim.t3, sp.trim.t0, sp.white);
  const hx = cDir === 'E' ? 2 : cDir === 'SE' || cDir === 'NE' ? 2 : 0;

  c.partCapsule(15.5, 5, 15.5, 0, 1.8, crystalRamp);
  c.symPartCapsule(9, 5, 5, 1, 1.8, crystalRamp);

  stampDirectionalMarine(c, palette, frame, cDir, anim, 0, sp.trim.t4, 'TEMPLAR', false);

  if (cDir !== 'N' && cDir !== 'NE' && cDir !== 'E') {
    c.sculptVisorFace(10, sp.body, sp.trim, sp.trim.t4, 'TEMPLAR', hx);
    c.sculptSegmentedTorso(15, sp.body, sp.trim, sp.trim.t4);
  }
  if (cDir !== 'E') {
    c.symPartDome(6, 9, 2.0, 2.0, crystalRamp);
  }

  c.rect(13 + hx, 21, 6, 8, OUTLINE_RGB);
  c.rect(14 + hx, 22, 4, 6, sp.body.c2);
  c.vLine(15 + hx, 22, 27, sp.trim.t4);
  c.vLine(16 + hx, 22, 27, sp.white);

  c.symPartCapsule(3, 21 - f, 2, 29, 1.8, crystalRamp);
  c.symVLine(2, 22 - f, 28, sp.white);

  if (anim === 'ATTACK') {
    const { dx, dy } = dirVector(cDir);
    c.stampMuzzleBlast(16 + dx * 10, 18 + dy * 9, dx, dy, f, 'CYAN');
  }
}

function drawKnight32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;
  const crystalRamp = makeRamp8(sp.trim.t3, sp.trim.t0, sp.white);
  const hx = cDir === 'E' ? 2 : cDir === 'SE' || cDir === 'NE' ? 2 : 0;

  stampDirectionalMarine(c, palette, frame, cDir, anim, 0, sp.trim.t4, 'TEMPLAR', false);
  if (cDir !== 'N' && cDir !== 'NE' && cDir !== 'E') {
    c.sculptVisorFace(10, sp.body, sp.trim, sp.trim.t4, 'TEMPLAR', hx);
    c.sculptSegmentedTorso(15, sp.body, sp.trim, sp.trim.t4);
  }
  c.symPartCapsule(12, 5, 10, 1, 1.5, sp.body);

  c.partDome(4.5, 20.5, 4.0, 5.5, sp.body, { trim: sp.trim, trimBottom: true });
  c.vLine(4, 17, 24, sp.trim.t4);
  c.vLine(5, 17, 24, sp.white);
  c.hLine(2, 7, 20, sp.trim.t4);

  if (anim === 'ATTACK') {
    const { dx, dy } = dirVector(cDir);
    c.partCapsule(24, 18, 16 + dx * 12, 16 + dy * 12, 2.2, crystalRamp);
    c.stampMuzzleBlast(16 + dx * 10, 16 + dy * 10, dx, dy, f, 'CYAN');
  } else {
    c.partCapsule(27, 20, 29, 3 - f, 2.0, crystalRamp);
    c.vLine(28, 4 - f, 18, sp.white);
    c.rect(25, 19, 5, 3, OUTLINE_RGB);
    c.hLine(26, 29, 20, sp.body.c7);
  }
}

function drawPrism32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;
  const crystalRamp = makeRamp8(sp.trim.t3, sp.trim.t0, sp.white);
  const yOff = f === 0 ? 0 : -1;
  const hx = cDir === 'E' ? 2 : cDir === 'SE' || cDir === 'NE' ? 1 : 0;

  c.partDome(15.5, 4 + yOff, 5.5, 2.2, sp.body, { trim: sp.trim, trimBottom: true });
  c.partDome(15.5, 27, 6.5, 2.4, sp.body, { trim: sp.trim, trimBottom: true });
  c.symPx(14, 27, sp.trim.t4);

  const spread = anim === 'ATTACK' ? 1 : 0;
  c.symPartDome(5 - spread, 9 - yOff, 3.8, 4.5, sp.body, {
    trim: sp.trim,
    trimBottom: true,
    trimInner: true,
  });
  c.symPx(5 - spread, 9 - yOff, sp.trim.t4);
  c.symPartDome(5 - spread, 20 + yOff, 3.8, 4.5, sp.body, {
    trim: sp.trim,
    trimBottom: true,
    trimInner: true,
  });
  c.symPx(5 - spread, 20 + yOff, sp.trim.t4);

  const cy = 15 + yOff;
  for (let dy = -9; dy <= 9; dy += 1) {
    const span = Math.round((9 - Math.abs(dy)) * 0.72);
    for (let dx = -span; dx <= span; dx += 1) {
      const x = 15 + hx + dx;
      const y = cy + dy;
      if (Math.abs(dx) === span || Math.abs(dy) === 9) {
        c.px(x, y, OUTLINE_RGB);
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
  c.rect(14 + hx, cy - 1, 4, 3, sp.white);

  if (anim === 'ATTACK') {
    const { dx, dy } = dirVector(cDir);
    c.stampMuzzleBlast(16 + dx * 8, 15 + dy * 8, dx, dy, f, 'CYAN');
  }
}

function drawLancer32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;
  const crystalRamp = makeRamp8(sp.trim.t3, sp.trim.t0, sp.white);
  const hx = cDir === 'E' ? 2 : cDir === 'SE' || cDir === 'NE' ? 2 : 0;

  c.symPartCapsule(10, 7, 4, 1, 1.8, sp.body);
  c.symPx(5, 2, sp.trim.t4);

  stampDirectionalMarine(c, palette, frame, cDir, anim, 0, sp.trim.t4, 'TEMPLAR', false);
  if (cDir !== 'N' && cDir !== 'NE' && cDir !== 'E') {
    c.sculptVisorFace(10, sp.body, sp.trim, sp.trim.t4, 'TEMPLAR', hx);
    c.sculptSegmentedTorso(15, sp.body, sp.trim, sp.trim.t4);
  }

  if (anim === 'ATTACK') {
    const { dx, dy } = dirVector(cDir);
    c.partCapsule(16 - dx * 6, 17 - dy * 6, 16 + dx * 13, 17 + dy * 13, 2.0, crystalRamp);
    c.stampMuzzleBlast(16 + dx * 11, 17 + dy * 11, dx, dy, f, 'CYAN');
  } else {
    const thrust = f === 1 ? -1 : 0;
    c.partCapsule(27, 29, 27, 1 + thrust, 2.0, crystalRamp);
    c.partDome(27, 14 + thrust, 3.4, 2.0, sp.body, { trim: sp.trim, trimBottom: true });
    c.vLine(27, 2 + thrust, 28, sp.white);
  }
}

function drawOrb32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;
  const crystalRamp = makeRamp8(sp.trim.t3, sp.trim.t0, sp.white);
  const hx = cDir === 'E' ? 2 : cDir === 'SE' || cDir === 'NE' ? 1 : 0;

  c.partDome(15.5, 15.5, 13.0, 13.0, sp.body, { trim: sp.trim, trimBottom: true });
  c.partDome(15.5, 15.5, 10.2, 10.2, makeRamp8([16, 40, 68], [6, 12, 24], sp.trim.t3));

  const coreR = (anim === 'ATTACK' ? 8.4 : 7.2) + f * 0.4;
  c.partDome(15.5 + hx * 0.5, 15.5, coreR, coreR, crystalRamp);
  if (cDir !== 'N') {
    c.sculptVisorFace(15, crystalRamp, sp.trim, sp.white, 'TEMPLAR', hx);
  }

  c.partDome(15.5, 3.5, 3.2, 2.2, sp.body);
  c.partDome(15.5, 27.5, 3.2, 2.2, sp.body);
  c.symPartDome(3.5, 15.5, 2.2, 3.2, sp.body);

  if (anim === 'ATTACK') {
    const { dx, dy } = dirVector(cDir);
    c.stampMuzzleBlast(16 + dx * 6, 16 + dy * 6, dx, dy, f, 'CYAN');
  } else if (f === 0) {
    c.symPx(9, 9, sp.white);
    c.symPx(9, 22, sp.white);
  } else {
    c.symPx(15, 7, sp.white);
    c.symPx(7, 15, sp.white);
  }
}

// ─────────────────────────── 4. 블라이트 무리 (BLIGHT HORDE 5종) ───────────────────────────

function drawMite32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;
  const boneRamp = makeRamp8(sp.bone.t3, sp.bone.t0, sp.white);
  const hx = cDir === 'E' ? 2 : cDir === 'SE' || cDir === 'NE' ? 1 : 0;

  for (let i = 0; i < 3; i += 1) {
    const ly = 11 + i * 5;
    const shift = (i + frame) % 2 === 0 ? -1 : 1;
    c.symPartCapsule(9, ly, 3, ly + 2 + shift, 1.5, sp.body);
  }

  c.partDome(15.5, 13, 8.2, 7.2, sp.body, { trim: sp.trim, trimBottom: true });
  c.symPartDome(11, 11, 2.2, 2.0, makeRamp8(sp.trim.t3, sp.trim.t0, sp.white));

  if (cDir !== 'N') {
    c.partDome(15.5 + hx, 20, 5.5, 4.2, sp.body, { trim: sp.trim, trimBottom: true });
    c.sculptVisorFace(20, sp.body, sp.trim, sp.trim.t4, 'FANGS', hx);
    c.symPartCapsule(12 + hx, 24, 10 + f + hx, 28, 1.8, boneRamp);
  }
  if (anim === 'ATTACK') {
    const { dx, dy } = dirVector(cDir);
    c.stampMuzzleBlast(16 + dx * 8, 20 + dy * 7, dx, dy, f, 'CRIMSON');
  }
}

function drawCrawler32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;
  const boneRamp = makeRamp8(sp.bone.t3, sp.bone.t0, sp.white);
  const hx = cDir === 'E' ? 2 : cDir === 'SE' || cDir === 'NE' ? 1 : 0;

  c.symPartCapsule(11, 7, 8, 2, 1.6, boneRamp);
  c.symPartCapsule(7, 11, 3, 6, 1.6, boneRamp);

  for (let i = 0; i < 3; i += 1) {
    const ly = 13 + i * 5;
    const shift = (i + frame) % 2 === 0 ? -1 : 1;
    c.symPartCapsule(8, ly, 2, ly + 3 + shift, 1.6, sp.body);
  }

  c.partDome(15.5, 9, 7.5, 4.5, sp.body, { trim: sp.trim, trimBottom: true });
  c.partDome(15.5, 14, 8.2, 4.8, sp.body, { trim: sp.trim, trimBottom: true });
  c.partDome(15.5, 19, 7.0, 4.5, sp.body, { trim: sp.trim, trimBottom: true });

  if (cDir !== 'N') {
    c.partDome(15.5 + hx, 22.5, 5.6, 4.2, sp.body, { trim: sp.trim, trimBottom: true });
    c.sculptVisorFace(22, sp.body, sp.trim, sp.trim.t4, 'FANGS', hx);
  }
  c.symPartCapsule(10, 24, 6, 29 - f, 2.0, boneRamp);

  if (anim === 'ATTACK') {
    const { dx, dy } = dirVector(cDir);
    c.stampMuzzleBlast(16 + dx * 9, 22 + dy * 7, dx, dy, f, 'CRIMSON');
  }
}

function drawBloater32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;
  const pustuleRamp = makeRamp8(sp.trim.t3, sp.trim.t0, [246, 255, 190]);
  const pBoost = anim === 'ATTACK' ? 0.8 : f * 0.45;
  const hx = cDir === 'E' ? 2 : cDir === 'SE' || cDir === 'NE' ? 2 : 0;

  stampDirectionalMarine(c, palette, frame, cDir, anim, 1, sp.trim.t4, 'BIO', false);

  c.symPartDome(6.5, 8.5, 4.8 + pBoost, 4.6 + pBoost, pustuleRamp);
  c.partDome(15.5, 5.5, 4.5 + pBoost, 3.8 + pBoost, pustuleRamp);
  c.symPartDome(5.5, 18.5, 3.8, 3.8 + pBoost, pustuleRamp);
  c.symPx(5, 7, sp.white);

  if (cDir !== 'N' && cDir !== 'NE' && cDir !== 'E') {
    c.sculptVisorFace(11, sp.body, sp.trim, sp.trim.t4, 'FANGS', hx);
    c.partDome(15.5 + hx, 17, 3.6, 3.0 + pBoost, pustuleRamp);
  }

  if (anim === 'ATTACK') {
    const { dx, dy } = dirVector(cDir);
    c.stampMuzzleBlast(16 + dx * 9, 17 + dy * 8, dx, dy, f, 'ACID');
  }
}

function drawBrute32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;
  const boneRamp = makeRamp8(sp.bone.t3, sp.bone.t0, sp.white);
  const coreRamp = makeRamp8(sp.trim.t3, sp.trim.t0, sp.white);
  const hx = cDir === 'E' ? 2 : cDir === 'SE' || cDir === 'NE' ? 2 : 0;

  c.symPartCapsule(10, 6, 4, 1, 2.3, boneRamp);
  c.symPartCapsule(4, 1, 2, 6, 1.9, boneRamp);

  stampDirectionalMarine(c, palette, frame, cDir, anim, 0, sp.trim.t4, 'BIO', false);

  if (cDir !== 'N' && cDir !== 'NE' && cDir !== 'E') {
    c.sculptVisorFace(10, sp.body, sp.trim, sp.trim.t4, 'FANGS', hx);
    c.sculptSegmentedTorso(15, sp.body, sp.trim, sp.trim.t4);
    c.partDome(15.5 + hx, 16, 3.2, 2.8, coreRamp);
  }

  const slam = anim === 'ATTACK' ? 2 : f;
  c.symPartDome(4, 21 + slam, 3.6, 4.2, sp.body, { trim: sp.trim, trimBottom: true });
  c.symPx(2, 21 + slam, sp.bone.t4);
  c.symPx(4, 25 + slam, sp.bone.t4);

  if (anim === 'ATTACK') {
    const { dx, dy } = dirVector(cDir);
    c.stampMuzzleBlast(16 + dx * 9, 20 + dy * 8, dx, dy, f, 'CRIMSON');
  }
}

function drawMatron32(
  c: SculptCanvas32,
  palette: FactionPalette,
  frame: number,
  cDir: CanonicalDir5,
  anim: SpriteAnim
): void {
  const sp = buildStudioPalette(palette);
  const f = frame % 2;
  const goldRamp = makeRamp8(sp.trim.t3, sp.trim.t0, sp.white);
  const boneRamp = makeRamp8(sp.bone.t3, sp.bone.t0, sp.white);
  const hx = cDir === 'E' ? 2 : cDir === 'SE' || cDir === 'NE' ? 2 : 0;

  c.partCapsule(15.5, 6, 15.5, 0, 2.0, goldRamp);
  c.symPartCapsule(11, 6, 9, 1, 1.8, goldRamp);
  c.symPartCapsule(7, 8, 4, 3, 1.8, goldRamp);

  stampDirectionalMarine(c, palette, frame, cDir, anim, 0, sp.trim.t4, 'BIO', false);

  for (let y = 23; y <= 31; y += 1) {
    for (let x = 5; x <= 26; x += 1) {
      c.clearPx(x, y);
    }
  }
  for (let i = 0; i < 3; i += 1) {
    const tx = 7 + i * 4;
    const wave = (i + frame) % 2 === 0 ? -1 : 1;
    c.symPartCapsule(tx, 22, tx + wave, 30, 1.8, sp.body);
    c.symPx(tx + wave, 29, sp.trim.t4);
  }

  if (cDir !== 'N') {
    c.sculptVisorFace(10, sp.body, sp.trim, sp.trim.t4, 'FANGS', hx);
    c.symPx(11, 9, sp.trim.t4);
    const mawRy = (anim === 'ATTACK' ? 5.4 : 4.6) + f * 0.5;
    c.partDome(15.5 + hx, 18.5, 5.8, mawRy, makeRamp8([24, 8, 18], [6, 2, 6], sp.crimson.t3));
    for (let k = 11; k <= 20; k += 2) {
      c.px(k + hx, 15, sp.bone.t4);
      c.px(k + hx, 16, sp.white);
      c.px(k + hx, 22, sp.bone.t4);
      c.px(k + hx, 21, sp.white);
    }
    c.symPx(15, 18, sp.trim.t4);
  }

  c.symPartCapsule(3, 21 - f, 2, 26 - f, 1.8, boneRamp);
  c.symPartCapsule(5, 21 - f, 6, 26 - f, 1.6, boneRamp);

  if (anim === 'ATTACK') {
    const { dx, dy } = dirVector(cDir);
    c.stampMuzzleBlast(16 + dx * 10, 19 + dy * 9, dx, dy, f, 'CRIMSON');
  }
}

function flipBufferHorizontally(
  buf: { width: number; height: number; data: Uint8ClampedArray }
): { width: number; height: number; data: Uint8ClampedArray } {
  const { width, height, data } = buf;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = (y * width + (width - 1 - x)) * 4;
      out[dstIdx] = data[srcIdx];
      out[dstIdx + 1] = data[srcIdx + 1];
      out[dstIdx + 2] = data[srcIdx + 2];
      out[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  return { width, height, data: out };
}

/**
 * 순수 함수: 아키타입 + 팔레트 + 프레임 + 8방향(SpriteDir8) + 상태(IDLE|WALK|ATTACK) → 32x32 RGBA 픽셀 버퍼.
 */
export function renderSpritePixels(
  archetype: SpriteArchetype,
  palette: FactionPalette,
  frame: number = 0,
  dir: SpriteDir8 = 'S',
  anim: SpriteAnim = 'IDLE'
): { width: number; height: number; data: Uint8ClampedArray } {
  const canvas = new SculptCanvas32();
  const f = Math.abs(Math.round(frame));
  const { cDir, flipX } = toCanonicalDir(dir);

  switch (archetype) {
    case 'COMMANDER': {
      const kind = detectCommanderFaction(palette);
      if (kind === 'HIVE') {
        drawHiveCommander32(canvas, palette, f, cDir, anim);
      } else if (kind === 'LUMEN') {
        drawLumenCommander32(canvas, palette, f, cDir, anim);
      } else {
        drawIroncladCommander32(canvas, palette, f, cDir, anim);
      }
      break;
    }
    case 'SOLDIER':
      drawSoldier32(canvas, palette, f, cDir, anim);
      break;
    case 'FLAMER':
      drawFlamer32(canvas, palette, f, cDir, anim);
      break;
    case 'WALKER':
      drawWalker32(canvas, palette, f, cDir, anim);
      break;
    case 'DRONE':
      drawDrone32(canvas, palette, f, cDir, anim);
      break;
    case 'CLAW':
      drawClaw32(canvas, palette, f, cDir, anim);
      break;
    case 'SPITTER':
      drawSpitter32(canvas, palette, f, cDir, anim);
      break;
    case 'SPEWER':
      drawSpewer32(canvas, palette, f, cDir, anim);
      break;
    case 'BEETLE':
      drawBeetle32(canvas, palette, f, cDir, anim);
      break;
    case 'KNIGHT':
      drawKnight32(canvas, palette, f, cDir, anim);
      break;
    case 'PRISM':
      drawPrism32(canvas, palette, f, cDir, anim);
      break;
    case 'LANCER':
      drawLancer32(canvas, palette, f, cDir, anim);
      break;
    case 'ORB':
      drawOrb32(canvas, palette, f, cDir, anim);
      break;
    case 'MITE':
      drawMite32(canvas, palette, f, cDir, anim);
      break;
    case 'CRAWLER':
      drawCrawler32(canvas, palette, f, cDir, anim);
      break;
    case 'BLOATER':
      drawBloater32(canvas, palette, f, cDir, anim);
      break;
    case 'BRUTE':
      drawBrute32(canvas, palette, f, cDir, anim);
      break;
    case 'MATRON':
      drawMatron32(canvas, palette, f, cDir, anim);
      break;
  }

  canvas.finalizeOutline();
  const result = { width: canvas.size, height: canvas.size, data: canvas.data };
  return flipX ? flipBufferHorizontally(result) : result;
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
