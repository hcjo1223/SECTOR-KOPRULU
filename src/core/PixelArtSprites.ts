import type { Race, UnitDefinition, ZoneType } from '../domain/types';

const HEX_CACHE = new Map<string, readonly [number, number, number]>();

function parseHex(hex: string): readonly [number, number, number] {
  const cached = HEX_CACHE.get(hex);
  if (cached) {
    return cached;
  }
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  const rgb: readonly [number, number, number] = [r, g, b];
  HEX_CACHE.set(hex, rgb);
  return rgb;
}

// 7-stop curated pixel art material ramp:
// [0: deep outline/crevice, 1: dark shadow, 2: shadow, 3: base mid, 4: lit mid, 5: highlight, 6: specular]
export type ColorRamp = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

export const RAMPS = {
  TERRAN_BLUE: [
    '#071026',
    '#102048',
    '#1b3675',
    '#2550a8',
    '#3b73d9',
    '#68a0f7',
    '#cae0ff',
  ] as ColorRamp,
  TERRAN_STEEL_DARK: [
    '#080b12',
    '#141b29',
    '#232e42',
    '#364561',
    '#4f6285',
    '#7388ad',
    '#b5c7e6',
  ] as ColorRamp,
  TERRAN_STEEL_LIGHT: [
    '#121824',
    '#242f42',
    '#3e4d66',
    '#5e708f',
    '#879ab8',
    '#b8c8e0',
    '#f0f6ff',
  ] as ColorRamp,
  TERRAN_CRIMSON: [
    '#1f060a',
    '#420c14',
    '#701421',
    '#a31f30',
    '#d6384a',
    '#f56c7a',
    '#ffd1d6',
  ] as ColorRamp,
  TERRAN_HAZARD_GOLD: [
    '#241202',
    '#4a2604',
    '#7a4208',
    '#b3680e',
    '#e3961c',
    '#facc43',
    '#fff6b3',
  ] as ColorRamp,
  TERRAN_WHITE: [
    '#172133',
    '#2f405c',
    '#52678a',
    '#8097bd',
    '#b5c9e8',
    '#e3eefc',
    '#ffffff',
  ] as ColorRamp,

  ZERG_CHITIN_PURPLE: [
    '#120421',
    '#250940',
    '#3e1266',
    '#5c1f91',
    '#8036bd',
    '#ab60e8',
    '#e2bfff',
  ] as ColorRamp,
  ZERG_FLESH_CRIMSON: [
    '#1c040b',
    '#380916',
    '#5c1124',
    '#871c36',
    '#b53350',
    '#e05c79',
    '#ffb3c2',
  ] as ColorRamp,
  ZERG_CARAPACE_UMBER: [
    '#170b06',
    '#2e170e',
    '#4a2618',
    '#6e3a25',
    '#965438',
    '#c27655',
    '#edb093',
  ] as ColorRamp,
  ZERG_BONE_IVORY: [
    '#1f1916',
    '#3b302a',
    '#5e4f45',
    '#877567',
    '#b3a191',
    '#ded2c3',
    '#ffffff',
  ] as ColorRamp,
  ZERG_ACID_GREEN: [
    '#0a1c03',
    '#173b07',
    '#2a660f',
    '#47991b',
    '#70cc2d',
    '#a6f255',
    '#eaffb8',
  ] as ColorRamp,

  PROTOSS_GOLD: [
    '#211102',
    '#452505',
    '#73400a',
    '#a66311',
    '#d9901c',
    '#f7c43e',
    '#fff5ad',
  ] as ColorRamp,
  PROTOSS_BRONZE: [
    '#170e07',
    '#2e1c0e',
    '#4d3019',
    '#704826',
    '#996639',
    '#c48f5a',
    '#f0cba1',
  ] as ColorRamp,
  PROTOSS_ROYAL_BLUE: [
    '#061029',
    '#0c2152',
    '#153885',
    '#2256bd',
    '#3b7df0',
    '#6da8ff',
    '#c2dcff',
  ] as ColorRamp,
  PROTOSS_PSI_CYAN: [
    '#021d30',
    '#043c61',
    '#07679e',
    '#0c9be0',
    '#38bdf8',
    '#8ce3ff',
    '#f2fcff',
  ] as ColorRamp,
  FLAME_PLASMA: [
    '#330606',
    '#6b120b',
    '#a8240d',
    '#de4f0d',
    '#f58814',
    '#facc2e',
    '#ffffcc',
  ] as ColorRamp,
} as const;

// 4x4 Bayer matrix normalized to [-0.22, +0.22] for authentic pixel dithering
const BAYER_4X4: ReadonlyArray<ReadonlyArray<number>> = [
  [-0.21, 0.07, -0.14, 0.14],
  [0.21, -0.07, 0.28, 0.0],
  [-0.1, 0.17, -0.17, 0.1],
  [0.31, 0.03, 0.24, -0.03],
];

function sampleRamp(
  ramp: ColorRamp,
  intensity: number,
  x: number,
  y: number,
  ditherStrength: number = 0.85
): string {
  const bayer = BAYER_4X4[y & 3][x & 3] * ditherStrength;
  const v = Math.max(0, Math.min(1, intensity + bayer * 0.18));
  // Map [0..1] to indices [1..6] (index 0 is reserved for deep outline/crevice)
  const idx = Math.max(1, Math.min(6, 1 + Math.floor(v * 5.99)));
  return ramp[idx];
}

export class PixelBuffer {
  public readonly width: number;
  public readonly height: number;
  public readonly data: Uint8ClampedArray;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  public set(x: number, y: number, hex: string, alpha: number = 255): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) {
      return;
    }
    const [r, g, b] = parseHex(hex);
    const idx = (iy * this.width + ix) * 4;
    if (alpha >= 255 || this.data[idx + 3] === 0) {
      this.data[idx] = r;
      this.data[idx + 1] = g;
      this.data[idx + 2] = b;
      this.data[idx + 3] = alpha;
    } else {
      const a = alpha / 255;
      const inv = 1 - a;
      this.data[idx] = Math.round(r * a + this.data[idx] * inv);
      this.data[idx + 1] = Math.round(g * a + this.data[idx + 1] * inv);
      this.data[idx + 2] = Math.round(b * a + this.data[idx + 2] * inv);
      this.data[idx + 3] = Math.min(255, this.data[idx + 3] + alpha);
    }
  }

  public isOpaque(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }
    return this.data[(y * this.width + x) * 4 + 3] > 120;
  }

  public rect(x: number, y: number, w: number, h: number, hex: string): void {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const rw = Math.round(w);
    const rh = Math.round(h);
    for (let py = y0; py < y0 + rh; py++) {
      for (let px = x0; px < x0 + rw; px++) {
        this.set(px, py, hex);
      }
    }
  }

  public line(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    hex: string,
    thickness: number = 1
  ): void {
    let ix0 = Math.round(x0);
    let iy0 = Math.round(y0);
    const ix1 = Math.round(x1);
    const iy1 = Math.round(y1);

    const dx = Math.abs(ix1 - ix0);
    const dy = Math.abs(iy1 - iy0);
    const sx = ix0 < ix1 ? 1 : -1;
    const sy = iy0 < iy1 ? 1 : -1;
    let err = dx - dy;

    const r = Math.floor((thickness - 1) / 2);
    while (true) {
      if (thickness <= 1) {
        this.set(ix0, iy0, hex);
      } else {
        this.rect(ix0 - r, iy0 - r, thickness, thickness, hex);
      }
      if (ix0 === ix1 && iy0 === iy1) {
        break;
      }
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        ix0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        iy0 += sy;
      }
    }
  }

  // 3D-lit volumetric ellipsoid with Bayer dithering, rim light, and specular hotspot
  public dome(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    ramp: ColorRamp,
    options?: {
      lx?: number;
      ly?: number;
      lz?: number;
      specular?: boolean;
      ridgeFreq?: number;
    }
  ): void {
    const lx = options?.lx ?? 0.38;
    const ly = options?.ly ?? -0.62;
    const lz = options?.lz ?? 0.68;
    const specular = options?.specular ?? true;
    const ridgeFreq = options?.ridgeFreq ?? 0;

    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);

    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const nx = (px - cx) / Math.max(0.5, rx);
        const ny = (py - cy) / Math.max(0.5, ry);
        const r2 = nx * nx + ny * ny;
        if (r2 > 1.02) {
          continue;
        }
        const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, r2)));
        let ndotl = nx * lx + ny * ly + nz * lz;

        // Subtle rim bounce light on the lower/back edge
        const rim = (1 - nz) * 0.22;
        let intensity = Math.max(0.04, Math.min(0.98, ndotl * 0.78 + 0.25 + rim));

        if (ridgeFreq > 0) {
          const wave = Math.sin((px - cx) * ridgeFreq);
          if (wave < -0.65) {
            intensity *= 0.55;
          } else if (wave > 0.7) {
            intensity = Math.min(0.98, intensity + 0.14);
          }
        }

        if (specular && ndotl > 0.87) {
          this.set(px, py, ramp[6]);
        } else {
          this.set(px, py, sampleRamp(ramp, intensity, px, py));
        }
      }
    }
  }

  // 3D-lit volumetric capsule / tapered limb / tail / cannon barrel / ribbed carapace
  public capsule(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
    ramp: ColorRamp,
    options?: {
      ribStep?: number;
      specular?: boolean;
    }
  ): void {
    const ribStep = options?.ribStep ?? 0;
    const specular = options?.specular ?? true;
    const maxR = Math.max(r0, r1) + 1;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1) - maxR));
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(x0, x1) + maxR));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1) - maxR));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(y0, y1) + maxR));

    const vx = x1 - x0;
    const vy = y1 - y0;
    const len2 = Math.max(0.001, vx * vx + vy * vy);
    const len = Math.sqrt(len2);
    // Perpendicular normal pointing "up/right" toward light
    let pxNorm = -vy / len;
    let pyNorm = vx / len;
    if (pyNorm > 0) {
      pxNorm = -pxNorm;
      pyNorm = -pyNorm;
    }

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const wx = px - x0;
        const wy = py - y0;
        const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
        const projX = x0 + t * vx;
        const projY = y0 + t * vy;
        const dx = px - projX;
        const dy = py - projY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const rad = Math.max(0.6, r0 + (r1 - r0) * t);

        if (dist > rad + 0.25) {
          continue;
        }

        const signedCross = (dx * pxNorm + dy * pyNorm) / rad;
        const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, (dist / rad) ** 2)));
        let intensity = 0.22 + signedCross * 0.44 + nz * 0.36;

        if (ribStep > 0) {
          const arcPos = Math.round(t * len);
          if (arcPos % ribStep === 0) {
            intensity *= 0.48;
          } else if (arcPos % ribStep === 1) {
            intensity = Math.min(0.98, intensity + 0.16);
          }
        }

        if (specular && intensity > 0.88 && nz > 0.7) {
          this.set(px, py, ramp[6]);
        } else {
          this.set(px, py, sampleRamp(ramp, intensity, px, py));
        }
      }
    }
  }

  // Beveled 3D armor plate polygon with top-right highlight bevel, bottom-left shadow bevel, and dithered face
  public beveledPlate(
    points: ReadonlyArray<readonly [number, number]>,
    ramp: ColorRamp,
    options?: {
      bevelDist?: number;
      panelEveryY?: number;
      panelEveryX?: number;
      slopeBias?: number;
    }
  ): void {
    if (points.length < 3) {
      return;
    }
    const bevelDist = options?.bevelDist ?? 1.8;
    const panelEveryY = options?.panelEveryY ?? 0;
    const panelEveryX = options?.panelEveryX ?? 0;
    const slopeBias = options?.slopeBias ?? 0;

    let minX = this.width;
    let maxX = 0;
    let minY = this.height;
    let maxY = 0;
    for (let i = 0; i < points.length; i++) {
      minX = Math.min(minX, Math.floor(points[i][0]));
      maxX = Math.max(maxX, Math.ceil(points[i][0]));
      minY = Math.min(minY, Math.floor(points[i][1]));
      maxY = Math.max(maxY, Math.ceil(points[i][1]));
    }
    minX = Math.max(0, minX);
    maxX = Math.min(this.width - 1, maxX);
    minY = Math.max(0, minY);
    maxY = Math.min(this.height - 1, maxY);

    // First rasterize interior mask
    const mask = new Uint8Array(this.width * this.height);
    for (let y = minY; y <= maxY; y++) {
      const nodes: number[] = [];
      let j = points.length - 1;
      for (let i = 0; i < points.length; i++) {
        const yi = points[i][1];
        const yj = points[j][1];
        const xi = points[i][0];
        const xj = points[j][0];
        if ((yi < y && yj >= y) || (yj < y && yi >= y)) {
          nodes.push(xi + ((y - yi) / (yj - yi)) * (xj - xi));
        }
        j = i;
      }
      nodes.sort((a, b) => a - b);
      for (let i = 0; i < nodes.length - 1; i += 2) {
        const xStart = Math.max(0, Math.round(nodes[i]));
        const xEnd = Math.min(this.width - 1, Math.round(nodes[i + 1]));
        for (let x = xStart; x <= xEnd; x++) {
          mask[y * this.width + x] = 1;
        }
      }
    }

    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!mask[y * this.width + x]) {
          continue;
        }

        const topOpen = y === 0 || !mask[(y - 1) * this.width + x];
        const rightOpen = x === this.width - 1 || !mask[y * this.width + (x + 1)];
        const bottomOpen = y === this.height - 1 || !mask[(y + 1) * this.width + x];
        const leftOpen = x === 0 || !mask[y * this.width + (x - 1)];

        const u = (x - minX) / spanX;
        const v = (y - minY) / spanY;
        let intensity = 0.52 + (u * 0.25 - v * 0.35) + slopeBias;

        if (topOpen || rightOpen) {
          intensity = topOpen && rightOpen ? 0.96 : 0.82 * (bevelDist / 1.8);
        } else if (bottomOpen || leftOpen) {
          intensity = bottomOpen && leftOpen ? 0.16 : 0.26;
        }

        if (panelEveryY > 0 && (y - minY) > 1 && (y - minY) % panelEveryY === 0) {
          intensity = 0.18;
        }
        if (panelEveryX > 0 && (x - minX) > 1 && (x - minX) % panelEveryX === 0) {
          intensity = 0.22;
        }

        this.set(x, y, sampleRamp(ramp, intensity, x, y));
      }
    }
  }

  // Selective outline + Ambient Occlusion layer compositor
  public layer(
    drawFn: (sub: PixelBuffer) => void,
    outlineHex: string | null = '#070a10',
    aoShadow: boolean = true
  ): void {
    const sub = new PixelBuffer(this.width, this.height);
    drawFn(sub);

    // 1. Cast 1px Ambient Occlusion contact shadow onto existing underlying pixels
    if (aoShadow) {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          if (sub.isOpaque(x, y)) {
            continue;
          }
          // Cast contact shadow primarily downward and leftward onto underlying layers
          if (
            this.isOpaque(x, y) &&
            (sub.isOpaque(x, y - 1) ||
              sub.isOpaque(x + 1, y) ||
              sub.isOpaque(x - 1, y) ||
              sub.isOpaque(x, y + 1))
          ) {
            const idx = (y * this.width + x) * 4;
            this.data[idx] = Math.round(this.data[idx] * 0.52);
            this.data[idx + 1] = Math.round(this.data[idx + 1] * 0.52);
            this.data[idx + 2] = Math.round(this.data[idx + 2] * 0.58);
          }
        }
      }
    }

    // 2. Apply crisp 1px outer outline
    if (outlineHex) {
      const toOutline: Array<readonly [number, number]> = [];
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          if (sub.isOpaque(x, y)) {
            continue;
          }
          if (
            sub.isOpaque(x - 1, y) ||
            sub.isOpaque(x + 1, y) ||
            sub.isOpaque(x, y - 1) ||
            sub.isOpaque(x, y + 1)
          ) {
            toOutline.push([x, y]);
          }
        }
      }
      for (let i = 0; i < toOutline.length; i++) {
        sub.set(toOutline[i][0], toOutline[i][1], outlineHex);
      }
    }

    this.composite(sub);
  }

  public composite(other: PixelBuffer, offsetX: number = 0, offsetY: number = 0): void {
    const ox = Math.round(offsetX);
    const oy = Math.round(offsetY);
    for (let y = 0; y < other.height; y++) {
      for (let x = 0; x < other.width; x++) {
        const srcIdx = (y * other.width + x) * 4;
        const a = other.data[srcIdx + 3];
        if (a === 0) {
          continue;
        }
        this.set(
          x + ox,
          y + oy,
          `#${other.data[srcIdx].toString(16).padStart(2, '0')}${other.data[srcIdx + 1].toString(16).padStart(2, '0')}${other.data[srcIdx + 2].toString(16).padStart(2, '0')}`,
          a
        );
      }
    }
  }

  public flipHorizontal(): PixelBuffer {
    const out = new PixelBuffer(this.width, this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const srcIdx = (y * this.width + x) * 4;
        const dstX = this.width - 1 - x;
        const dstIdx = (y * this.width + dstX) * 4;
        out.data[dstIdx] = this.data[srcIdx];
        out.data[dstIdx + 1] = this.data[srcIdx + 1];
        out.data[dstIdx + 2] = this.data[srcIdx + 2];
        out.data[dstIdx + 3] = this.data[srcIdx + 3];
      }
    }
    return out;
  }
}

// ============================================================================
// I. TERRAN DOMINION — HIGH-DETAIL 3/4 TACTICAL PIXEL SPRITES (6 Units)
// ============================================================================

function drawTerranSCV(buf: PixelBuffer, frame: number): void {
  const bob = frame % 2 === 1 ? -1 : 0;

  // 1. Rear Twin Fusion Thrusters & Exhaust Plumes
  buf.layer((l) => {
    l.capsule(6, 7 + bob, 2.6, 6, 17 + bob, 2.8, RAMPS.TERRAN_STEEL_DARK, {
      ribStep: 3,
    });
    l.capsule(10, 6 + bob, 2.5, 10, 16 + bob, 2.5, RAMPS.TERRAN_BLUE);
    // Thruster plasma exhaust jets at bottom-left of pods
    l.set(4, 17 + bob, '#0284c7');
    l.set(3, 18 + bob, '#38bdf8');
    l.set(4, 18 + bob, '#e0f2fe');
    if (frame % 2 === 1) {
      l.set(2, 19 + bob, '#38bdf8');
      l.set(3, 19 + bob, '#ffffff');
    }
  });

  // 2. Articulated Hydraulic Legs & Heavy Industrial Treads/Boots
  buf.layer((l) => {
    // Back leg
    l.capsule(11, 19, 2.4, 10, 26, 2.6, RAMPS.TERRAN_STEEL_DARK);
    l.beveledPlate(
      [
        [7, 26],
        [14, 26],
        [14, 28],
        [7, 28],
      ],
      RAMPS.TERRAN_STEEL_LIGHT
    );
    // Front leg with hazard knee pad
    l.capsule(18, 19, 2.6, 18, 26, 2.8, RAMPS.TERRAN_STEEL_DARK);
    l.dome(19, 22, 2.2, 1.8, RAMPS.TERRAN_HAZARD_GOLD);
    l.beveledPlate(
      [
        [15, 26],
        [23, 26],
        [23, 28],
        [15, 28],
      ],
      RAMPS.TERRAN_STEEL_LIGHT
    );
    l.set(22, 27, '#f59e0b');
  });

  // 3. Industrial Exo-Frame Torso, Hazard Roll-Cage & Cockpit Dome
  buf.layer((l) => {
    // Main armored torso chassis
    l.beveledPlate(
      [
        [8, 9 + bob],
        [21, 9 + bob],
        [22, 19 + bob],
        [8, 20 + bob],
      ],
      RAMPS.TERRAN_BLUE,
      { panelEveryY: 4 }
    );
    // Top yellow-and-black striped hazard roll-bar shoulder frame
    l.beveledPlate(
      [
        [7, 8 + bob],
        [22, 8 + bob],
        [22, 11 + bob],
        [7, 11 + bob],
      ],
      RAMPS.TERRAN_HAZARD_GOLD
    );
    for (let hx = 9; hx <= 19; hx += 3) {
      l.set(hx, 9 + bob, '#141b29');
      l.set(hx + 1, 10 + bob, '#141b29');
    }
    // Recessed armored cockpit canopy glass
    l.dome(16, 14 + bob, 4.2, 3.3, RAMPS.PROTOSS_PSI_CYAN);
    // Glowing amber pilot visor inside cockpit
    l.rect(16, 14 + bob, 3, 2, '#f59e0b');
    l.set(17, 14 + bob, '#fef08a');
    l.set(15, 12 + bob, '#ffffff');
  });

  // 4. Left Servo Clamp & Right Fusion Welding Cutter with Electric Arc
  buf.layer((l) => {
    // Upper articulated industrial clamp
    l.capsule(20, 11 + bob, 1.8, 25, 11 + bob, 1.6, RAMPS.TERRAN_STEEL_LIGHT);
    l.line(25, 9 + bob, 28, 10 + bob, '#cbd5e1');
    l.line(25, 13 + bob, 28, 12 + bob, '#64748b');

    // Lower heavy orange/steel fusion cutter arm
    l.capsule(16, 17 + bob, 2.3, 23, 17 + bob, 2.2, RAMPS.TERRAN_HAZARD_GOLD);
    l.capsule(23, 17 + bob, 1.6, 26, 17 + bob, 1.3, RAMPS.TERRAN_STEEL_LIGHT);
    // Welding plasma torch core + spark particles
    l.dome(28, 17 + bob, 1.8, 1.8, RAMPS.PROTOSS_PSI_CYAN);
    l.set(28, 17 + bob, '#ffffff');
    if (frame % 2 === 1) {
      l.set(30, 15 + bob, '#7dd3fc');
      l.set(30, 19 + bob, '#fde047');
      l.set(29, 14 + bob, '#ffffff');
    }
  });
}

function drawTerranMarine(buf: PixelBuffer, frame: number): void {
  const bob = frame % 2 === 1 ? -1 : 0;

  // 1. CMC-300 Dorsal Reactor Pack & Stimpack Reservoir
  buf.layer((l) => {
    l.capsule(9, 6 + bob, 3.2, 9, 15 + bob, 3.0, RAMPS.TERRAN_BLUE, {
      ribStep: 3,
    });
    l.capsule(14, 5 + bob, 3.0, 14, 14 + bob, 2.8, RAMPS.TERRAN_STEEL_DARK);
    // Glowing green stimpack vial on left reactor
    l.set(7, 9 + bob, '#22c55e');
    l.set(7, 10 + bob, frame % 2 === 0 ? '#86efac' : '#ffffff');
  });

  // 2. Sculpted Power-Armor Greaves & Magnetic Combat Boots
  buf.layer((l) => {
    // Back leg
    l.capsule(11, 19, 2.8, 10, 27, 2.6, RAMPS.TERRAN_BLUE);
    l.dome(11, 22, 2.2, 1.8, RAMPS.TERRAN_STEEL_LIGHT);
    l.beveledPlate(
      [
        [8, 26],
        [14, 26],
        [14, 28],
        [8, 28],
      ],
      RAMPS.TERRAN_STEEL_DARK
    );
    // Front leg planted forward
    l.capsule(18, 19, 3.0, 19, 27, 2.8, RAMPS.TERRAN_BLUE);
    l.dome(19, 22, 2.4, 2.0, RAMPS.TERRAN_BLUE);
    l.beveledPlate(
      [
        [16, 26],
        [23, 26],
        [23, 28],
        [16, 28],
      ],
      RAMPS.TERRAN_STEEL_DARK
    );
  });

  // 3. Bulky CMC-300 Chest Cuirass, Oversized Spherical Pauldrons & Domed Visor Helmet
  buf.layer((l) => {
    // Sculpted chest plate
    l.dome(15, 15 + bob, 5.5, 5.0, RAMPS.TERRAN_BLUE);
    // Sternum seam & chest eagle specular
    l.line(15, 12 + bob, 15, 18 + bob, '#102048');
    l.set(17, 13 + bob, '#cae0ff');

    // Left massive spherical pauldron
    l.dome(8, 13 + bob, 4.4, 4.8, RAMPS.TERRAN_BLUE);
    l.set(7, 11 + bob, '#cae0ff');
    l.set(8, 15 + bob, '#102048');

    // Right massive spherical pauldron
    l.dome(21, 12 + bob, 4.2, 4.6, RAMPS.TERRAN_BLUE);

    // Armored neck collar ring & recessed helmet dome
    l.dome(15, 9 + bob, 4.2, 3.8, RAMPS.TERRAN_BLUE);
    // Iconic curved golden-amber combat visor
    l.dome(16.5, 9.2 + bob, 3.2, 2.1, RAMPS.TERRAN_HAZARD_GOLD);
    l.set(18, 8 + bob, '#ffffff');
  });

  // 4. C-14 Impaler Gauss Rifle & Armored Gauntlets
  buf.layer((l) => {
    // Left gauntlet gripping stock
    l.dome(11, 16 + bob, 2.4, 2.2, RAMPS.TERRAN_BLUE);
    // Heavy diagonal C-14 Gauss Rifle receiver, barrel shroud & magazine
    l.capsule(11, 17 + bob, 2.2, 27, 12 + bob, 1.6, RAMPS.TERRAN_STEEL_DARK, {
      ribStep: 3,
    });
    l.line(13, 15 + bob, 27, 11 + bob, '#b8c8e0');
    // Heavy box ammo magazine & scope
    l.beveledPlate(
      [
        [18, 15 + bob],
        [21, 15 + bob],
        [20, 20 + bob],
        [17, 20 + bob],
      ],
      RAMPS.TERRAN_STEEL_DARK
    );
    // Front gauntlet on handguard
    l.dome(20, 15 + bob, 2.1, 2.0, RAMPS.TERRAN_BLUE);
    // Muzzle tip & firing flash
    l.set(28, 11 + bob, '#f0f6ff');
    if (frame % 2 === 1) {
      l.set(29, 11 + bob, '#fde047');
      l.set(30, 10 + bob, '#f97316');
      l.set(30, 12 + bob, '#f97316');
    }
  });
}

function drawTerranFirebat(buf: PixelBuffer, frame: number): void {
  const bob = frame % 2 === 1 ? -1 : 0;

  // 1. Twin Pressurized Napalm Fuel Cylinders & Valves
  buf.layer((l) => {
    l.capsule(7, 5 + bob, 3.0, 7, 15 + bob, 3.0, RAMPS.TERRAN_CRIMSON, {
      ribStep: 4,
    });
    l.capsule(13, 4 + bob, 3.0, 13, 14 + bob, 3.0, RAMPS.TERRAN_CRIMSON, {
      ribStep: 4,
    });
    // Brass pressure gauges on top of tanks
    l.dome(7, 5 + bob, 1.8, 1.5, RAMPS.TERRAN_HAZARD_GOLD);
    l.dome(13, 4 + bob, 1.8, 1.5, RAMPS.TERRAN_HAZARD_GOLD);
  });

  // 2. Heavy CMC-660 Heat-Shielded Greaves
  buf.layer((l) => {
    l.capsule(11, 19, 3.0, 10, 27, 2.8, RAMPS.TERRAN_BLUE);
    l.dome(11, 22, 2.5, 2.0, RAMPS.TERRAN_CRIMSON);
    l.capsule(18, 19, 3.2, 19, 27, 3.0, RAMPS.TERRAN_BLUE);
    l.dome(19, 22, 2.6, 2.1, RAMPS.TERRAN_CRIMSON);
    l.rect(8, 27, 6, 2, '#232e42');
    l.rect(16, 27, 6, 2, '#232e42');
  });

  // 3. Hulking Heat-Shielded Torso, Crimson Pauldrons & Blast Respirator Helmet
  buf.layer((l) => {
    l.dome(15, 15 + bob, 6.0, 5.2, RAMPS.TERRAN_BLUE);
    // Hazard blast collar
    l.capsule(11, 12 + bob, 1.8, 19, 12 + bob, 1.8, RAMPS.TERRAN_HAZARD_GOLD, {
      ribStep: 2,
    });
    // Massive crimson-red ribbed pauldrons
    l.dome(8, 13 + bob, 4.6, 5.0, RAMPS.TERRAN_CRIMSON, { ridgeFreq: 1.2 });
    l.dome(22, 13 + bob, 4.4, 4.8, RAMPS.TERRAN_CRIMSON, { ridgeFreq: 1.2 });

    // Heavy dark-steel blast helmet with wide fiery thermal visor
    l.dome(15, 8 + bob, 4.6, 4.0, RAMPS.TERRAN_STEEL_DARK);
    l.dome(16.5, 8.5 + bob, 3.5, 2.2, RAMPS.FLAME_PLASMA);
    l.set(18, 7 + bob, '#ffffff');
  });

  // 4. Dual Perdition Flamethrower Gauntlets & Roaring Pilot Flame Jets
  buf.layer((l) => {
    l.capsule(13, 16 + bob, 2.6, 21, 16 + bob, 2.4, RAMPS.TERRAN_CRIMSON);
    l.capsule(20, 16 + bob, 2.2, 26, 16 + bob, 1.8, RAMPS.TERRAN_STEEL_LIGHT, {
      ribStep: 2,
    });
    // Roaring multi-stop plasma flame jet at nozzle
    const flameLen = frame % 2 === 1 ? 30 : 29;
    l.capsule(26, 16 + bob, 1.6, flameLen, 15 + bob, 2.4, RAMPS.FLAME_PLASMA);
    l.set(27, 16 + bob, '#ffffff');
    l.set(28, 15 + bob, '#ffffcc');
  });
}

function drawTerranMedic(buf: PixelBuffer, frame: number): void {
  const bob = frame % 2 === 1 ? -1 : 0;

  // 1. Cryo-Medical Dorsal Pack & Telemetry Mast
  buf.layer((l) => {
    l.capsule(9, 6 + bob, 3.0, 9, 15 + bob, 2.8, RAMPS.TERRAN_WHITE);
    l.line(8, 3 + bob, 8, 6 + bob, '#879ab8');
    l.set(8, 3 + bob, frame % 2 === 0 ? '#38bdf8' : '#e0f2fe');
  });

  // 2. Ceramic-White & Royal-Blue Armored Greaves
  buf.layer((l) => {
    l.capsule(11, 19, 2.6, 11, 27, 2.4, RAMPS.TERRAN_WHITE);
    l.capsule(17, 19, 2.6, 17, 27, 2.4, RAMPS.TERRAN_WHITE);
    l.dome(11, 27, 2.4, 1.4, RAMPS.TERRAN_BLUE);
    l.dome(17, 27, 2.4, 1.4, RAMPS.TERRAN_BLUE);
  });

  // 3. White/Blue Medic Cuirass, Red-Cross Pauldron & Cyan-Visor Helmet
  buf.layer((l) => {
    l.dome(14, 15 + bob, 5.0, 4.8, RAMPS.TERRAN_WHITE);
    l.dome(15, 15 + bob, 3.0, 3.2, RAMPS.TERRAN_BLUE);
    // Left spherical white pauldron with crimson Red Cross
    l.dome(8, 13 + bob, 4.0, 4.2, RAMPS.TERRAN_WHITE);
    l.line(8, 11 + bob, 8, 15 + bob, '#d6384a');
    l.line(6, 13 + bob, 10, 13 + bob, '#d6384a');

    // Sleek white helmet with glowing cyan medical visor
    l.dome(14, 9 + bob, 4.0, 3.6, RAMPS.TERRAN_WHITE);
    l.dome(15.5, 9 + bob, 2.8, 1.8, RAMPS.PROTOSS_PSI_CYAN);
    l.set(16, 8 + bob, '#ffffff');
  });

  // 4. Heavy Ballistic Riot Shield with Bold Red Cross & Caduceus Healing Beam
  buf.layer((l) => {
    // Beveled ceramic-white tower shield
    l.beveledPlate(
      [
        [18, 10 + bob],
        [26, 11 + bob],
        [26, 24 + bob],
        [18, 25 + bob],
      ],
      RAMPS.TERRAN_WHITE
    );
    // Recessed viewport slit at top of shield
    l.line(20, 12 + bob, 24, 12 + bob, '#0c9be0');
    // Shaded crimson Red Cross emblem in center of shield
    l.rect(21, 14 + bob, 2, 8, '#a31f30');
    l.rect(19, 17 + bob, 6, 2, '#a31f30');
    l.line(22, 14 + bob, 22, 21 + bob, '#f56c7a');
    l.line(19, 17 + bob, 24, 17 + bob, '#f56c7a');

    // Caduceus restoration emitter projecting emerald-cyan beam
    l.capsule(25, 12 + bob, 1.4, 28, 12 + bob, 1.4, RAMPS.TERRAN_STEEL_LIGHT);
    l.set(29, 12 + bob, '#34d399');
    l.set(30, 12 + bob, '#a7f3d0');
    if (frame % 2 === 1) {
      l.set(30, 11 + bob, '#6ee7b7');
      l.set(30, 13 + bob, '#6ee7b7');
    }
  });
}

function drawTerranSiegeTank(buf: PixelBuffer, frame: number): void {
  const recoil = frame % 2 === 1 ? -1 : 0;

  // 1. Far Caterpillar Track Unit & Outrigger Stabilizer
  buf.layer((l) => {
    l.capsule(9, 16, 3.6, 37, 16, 3.6, RAMPS.TERRAN_STEEL_DARK, { ribStep: 3 });
    l.beveledPlate(
      [
        [11, 13],
        [35, 13],
        [37, 17],
        [9, 17],
      ],
      RAMPS.TERRAN_BLUE,
      { panelEveryX: 6 }
    );
  });

  // 2. Wide Beveled Armored Hull Chassis & Hazard Front Dozer Blade
  buf.layer((l) => {
    l.beveledPlate(
      [
        [8, 18],
        [38, 18],
        [41, 29],
        [6, 29],
      ],
      RAMPS.TERRAN_BLUE,
      { panelEveryX: 7 }
    );
    // Recessed engine deck & exhaust grilles
    l.beveledPlate(
      [
        [11, 20],
        [34, 20],
        [35, 27],
        [10, 27],
      ],
      RAMPS.TERRAN_STEEL_DARK,
      { panelEveryX: 4 }
    );
    // Sloped front hazard bumper
    l.beveledPlate(
      [
        [36, 19],
        [40, 20],
        [41, 28],
        [36, 28],
      ],
      RAMPS.TERRAN_HAZARD_GOLD
    );
    l.set(38, 21, '#141b29');
    l.set(39, 24, '#141b29');
    l.set(39, 27, '#141b29');
  });

  // 3. Near Heavy Caterpillar Track Pod & Individual Road Wheels
  buf.layer((l) => {
    l.capsule(8, 34, 4.5, 39, 34, 4.5, RAMPS.TERRAN_STEEL_DARK, { ribStep: 3 });
    l.beveledPlate(
      [
        [8, 29],
        [39, 29],
        [41, 33],
        [6, 33],
      ],
      RAMPS.TERRAN_STEEL_LIGHT,
      { panelEveryX: 6 }
    );
    // 5 Bogie road wheels along lower track
    for (let wx = 11; wx <= 35; wx += 6) {
      l.dome(wx, 35, 2.2, 2.2, RAMPS.TERRAN_STEEL_LIGHT);
      l.set(wx, 35, '#141b29');
    }
  });

  // 4. Crucio/Arclite Heavy Turret & Twin 120mm Shock Cannons
  buf.layer((l) => {
    // Sculpted 3D turret hull
    l.dome(21, 21, 9.5, 6.2, RAMPS.TERRAN_BLUE);
    l.beveledPlate(
      [
        [13, 16],
        [27, 16],
        [29, 23],
        [12, 23],
      ],
      RAMPS.TERRAN_BLUE,
      { panelEveryX: 5 }
    );
    // Commander hatch & glowing amber targeting optics
    l.dome(18, 18, 3.2, 2.2, RAMPS.TERRAN_STEEL_LIGHT);
    l.dome(24, 19, 2.2, 1.6, RAMPS.TERRAN_HAZARD_GOLD);
    l.set(25, 18, '#ffffff');

    // Twin 120mm Shock Cannon barrels with recoil jackets & muzzle brakes
    l.capsule(
      27 + recoil,
      17,
      2.1,
      44 + recoil,
      17,
      1.7,
      RAMPS.TERRAN_STEEL_LIGHT,
      { ribStep: 5 }
    );
    l.capsule(
      27 + recoil,
      21,
      2.1,
      44 + recoil,
      21,
      1.7,
      RAMPS.TERRAN_STEEL_DARK,
      { ribStep: 5 }
    );
    // Slotted muzzle brakes
    l.dome(44 + recoil, 17, 1.8, 2.0, RAMPS.TERRAN_HAZARD_GOLD);
    l.dome(44 + recoil, 21, 1.8, 2.0, RAMPS.TERRAN_HAZARD_GOLD);
  });
}

function drawTerranBattlecruiser(buf: PixelBuffer, frame: number): void {
  const hover = frame % 2 === 1 ? -1 : 0;

  // 1. Stern Fusion Engine Array & Swept Delta Battle-Wings
  buf.layer((l) => {
    // 4 Rear engine nacelles & cyan plasma plumes
    for (let ey = 23; ey <= 41; ey += 6) {
      l.capsule(5, ey + hover, 2.2, 11, ey + hover, 2.5, RAMPS.TERRAN_STEEL_DARK);
      l.dome(4, ey + hover, 2.4, 1.8, RAMPS.PROTOSS_PSI_CYAN);
      if (frame % 2 === 1) {
        l.set(2, ey + hover, '#ffffff');
      }
    }

    // Broad swept mid-ship delta wings tapering into the spinal hull
    l.beveledPlate(
      [
        [12, 24 + hover],
        [24, 9 + hover],
        [36, 12 + hover],
        [41, 24 + hover],
        [41, 40 + hover],
        [36, 52 + hover],
        [24, 55 + hover],
        [12, 40 + hover],
      ],
      RAMPS.TERRAN_BLUE,
      { panelEveryX: 5, panelEveryY: 6 }
    );

    // Wing-tip heavy turbolaser battery pods & forward barrels
    l.capsule(23, 13 + hover, 2.5, 35, 14 + hover, 2.2, RAMPS.TERRAN_STEEL_LIGHT, {
      ribStep: 4,
    });
    l.line(35, 13 + hover, 39, 13 + hover, '#b8c8e0');
    l.capsule(23, 51 + hover, 2.5, 35, 50 + hover, 2.2, RAMPS.TERRAN_STEEL_LIGHT, {
      ribStep: 4,
    });
    l.line(35, 50 + hover, 39, 50 + hover, '#b8c8e0');
  });

  // 2. Central Armored Fuselage Superstructure & Ribbed Spinal Neck
  buf.layer((l) => {
    l.beveledPlate(
      [
        [10, 21 + hover],
        [38, 23 + hover],
        [43, 27 + hover],
        [43, 37 + hover],
        [38, 41 + hover],
        [10, 43 + hover],
      ],
      RAMPS.TERRAN_STEEL_LIGHT,
      { panelEveryX: 6, panelEveryY: 5 }
    );
    l.beveledPlate(
      [
        [13, 25 + hover],
        [37, 26 + hover],
        [37, 38 + hover],
        [13, 39 + hover],
      ],
      RAMPS.TERRAN_BLUE,
      { panelEveryX: 5 }
    );
    // Reinforced ribbed neck connecting hull to Hammerhead prow
    l.capsule(37, 32 + hover, 5.2, 47, 32 + hover, 4.8, RAMPS.TERRAN_STEEL_DARK, {
      ribStep: 2,
    });
    // Illuminated micro-deck viewports along fuselage
    for (let wx = 16; wx <= 34; wx += 4) {
      l.set(wx, 28 + hover, '#fef08a');
      l.set(wx, 36 + hover, '#38bdf8');
    }
    l.line(13, 32 + hover, 46, 32 + hover, '#080b12', 2);
  });

  // 3. T-Shaped Command Bridge Tower & Sculpted Hammerhead Prow with Yamato Core
  buf.layer((l) => {
    // Elevated T-shaped Command Bridge Tower at stern
    l.capsule(17, 17 + hover, 2.4, 17, 24 + hover, 2.8, RAMPS.TERRAN_STEEL_DARK);
    l.beveledPlate(
      [
        [12, 13 + hover],
        [24, 14 + hover],
        [25, 20 + hover],
        [12, 20 + hover],
      ],
      RAMPS.TERRAN_STEEL_LIGHT,
      { panelEveryX: 4 }
    );
    l.rect(20, 15 + hover, 3, 3, '#facc43');
    l.set(22, 16 + hover, '#ffffff');

    // Upper & Lower Angled Hammerhead Weapon Pods
    l.beveledPlate(
      [
        [44, 15 + hover],
        [54, 14 + hover],
        [58, 19 + hover],
        [56, 26 + hover],
        [44, 26 + hover],
      ],
      RAMPS.TERRAN_BLUE,
      { panelEveryX: 4 }
    );
    l.beveledPlate(
      [
        [44, 38 + hover],
        [56, 38 + hover],
        [58, 45 + hover],
        [54, 50 + hover],
        [44, 49 + hover],
      ],
      RAMPS.TERRAN_BLUE,
      { panelEveryX: 4 }
    );
    // Forward Hammerhead prow snout housing the Yamato Cannon
    l.beveledPlate(
      [
        [45, 24 + hover],
        [58, 25 + hover],
        [61, 32 + hover],
        [58, 39 + hover],
        [45, 40 + hover],
      ],
      RAMPS.TERRAN_STEEL_LIGHT,
      { panelEveryX: 4 }
    );
    // Glowing Yamato Cannon Plasma Core recessed in the bow
    l.dome(58, 32 + hover, 3.2, 4.2, RAMPS.FLAME_PLASMA);
    l.set(59, 31 + hover, '#ffffff');
    l.set(59, 33 + hover, '#ffffff');
    if (frame % 2 === 1) {
      l.set(61, 32 + hover, '#ffffcc');
    }
  });
}

// ============================================================================
// II. ZERG SWARM — HIGH-DETAIL 3/4 TACTICAL ORGANIC PIXEL SPRITES (6 Units)
// ============================================================================

function drawZergDrone(buf: PixelBuffer, frame: number): void {
  const flap = frame % 2 === 1 ? -2 : 0;

  // 1. Ventral Tendrils & Translucent Far Wing
  buf.layer((l) => {
    l.capsule(10, 20, 1.6, 7, 27, 1.0, RAMPS.ZERG_FLESH_CRIMSON);
    l.capsule(15, 21, 1.8, 13, 28, 1.0, RAMPS.ZERG_FLESH_CRIMSON);
    l.capsule(19, 20, 1.6, 19, 27, 1.0, RAMPS.ZERG_FLESH_CRIMSON);
    l.beveledPlate(
      [
        [11, 12],
        [6, 4 + flap],
        [17, 5 + flap],
        [16, 12],
      ],
      RAMPS.ZERG_CHITIN_PURPLE
    );
  });

  // 2. Plump Ribbed Chitin Carapace & Fleshy Underbelly
  buf.layer((l) => {
    l.dome(14, 17, 7.8, 5.2, RAMPS.ZERG_FLESH_CRIMSON);
    l.capsule(8, 15, 4.5, 20, 15, 4.8, RAMPS.ZERG_CHITIN_PURPLE, {
      ribStep: 3,
    });
    l.capsule(9, 13, 2.2, 19, 13, 2.5, RAMPS.ZERG_CARAPACE_UMBER, {
      ribStep: 3,
    });
  });

  // 3. Veined Near Bio-Wing, Glowing Acid Eyes & Serrated Harvesting Pincers
  buf.layer((l) => {
    l.beveledPlate(
      [
        [13, 13],
        [9, 5 - flap],
        [20, 6 - flap],
        [18, 13],
      ],
      RAMPS.ZERG_CHITIN_PURPLE
    );
    l.line(13, 12, 9, 5 - flap, '#ded2c3');

    l.dome(21, 16, 4.2, 3.8, RAMPS.ZERG_CHITIN_PURPLE);
    l.dome(23, 15, 1.8, 1.5, RAMPS.ZERG_ACID_GREEN);
    l.set(23, 14, '#ffffff');

    l.capsule(24, 14, 1.8, 29, 12, 1.0, RAMPS.ZERG_BONE_IVORY);
    l.capsule(24, 18, 1.8, 29, 20, 1.0, RAMPS.ZERG_BONE_IVORY);
  });
}

function drawZergZergling(buf: PixelBuffer, frame: number): void {
  const stride = frame % 2 === 1 ? 1 : 0;

  // 1. Spiked Whip Tail & Muscular Hind/Fore Raptor Limbs
  buf.layer((l) => {
    l.capsule(6, 13, 1.6, 2, 9 - stride, 0.9, RAMPS.ZERG_CHITIN_PURPLE, {
      ribStep: 2,
    });
    l.set(1, 8 - stride, '#ded2c3');
    // Muscular crouched hind leg & front limb
    l.capsule(8, 14, 2.4, 5, 17, 1.8, RAMPS.ZERG_CHITIN_PURPLE);
    l.capsule(5, 17, 1.6, 6 - stride, 21, 1.2, RAMPS.ZERG_FLESH_CRIMSON);
    l.capsule(15, 15, 2.0, 18 + stride, 21, 1.3, RAMPS.ZERG_FLESH_CRIMSON);
    l.set(7 - stride, 21, '#ffffff');
    l.set(19 + stride, 21, '#ffffff');
  });

  // 2. Arched Ribbed Raptor Torso & Horned Predator Skull
  buf.layer((l) => {
    l.capsule(7, 14, 3.4, 15, 13, 3.2, RAMPS.ZERG_CHITIN_PURPLE, {
      ribStep: 2,
    });
    l.dome(17, 13, 3.5, 2.8, RAMPS.ZERG_CHITIN_PURPLE);
    // Swept skull horn, glowing acid eye & fangs
    l.line(15, 10, 11, 8, '#c27655');
    l.set(19, 12, '#a6f255');
    l.set(19, 15, '#ffffff');
    l.set(20, 14, '#ded2c3');
  });

  // 3. Forward-Raking Adrenal Mantis Scythe-Limb
  buf.layer((l) => {
    l.capsule(13, 11, 1.5, 17, 7 + stride, 1.3, RAMPS.ZERG_CARAPACE_UMBER);
    l.capsule(17, 7 + stride, 1.4, 22, 11 + stride, 0.8, RAMPS.ZERG_BONE_IVORY);
  });
}

function drawZergHydralisk(buf: PixelBuffer, frame: number): void {
  const sway = frame % 2 === 1 ? -1 : 0;

  // 1. Coiled Serpentine Tail Base
  buf.layer((l) => {
    l.capsule(6, 26, 2.8, 18, 26, 3.6, RAMPS.ZERG_CHITIN_PURPLE, {
      ribStep: 3,
    });
    l.capsule(16, 25, 4.0, 14, 15 + sway, 4.2, RAMPS.ZERG_FLESH_CRIMSON, {
      ribStep: 2,
    });
  });

  // 2. Ribbed Exoskeleton Torso & Flared 3-Horned Cobra Hood Crest
  buf.layer((l) => {
    l.capsule(15, 13 + sway, 3.8, 15, 22 + sway, 3.5, RAMPS.ZERG_FLESH_CRIMSON, {
      ribStep: 2,
    });
    for (let ry = 14; ry <= 20; ry += 2) {
      l.line(13, ry + sway, 18, ry + sway, '#ded2c3');
    }

    l.beveledPlate(
      [
        [7, 4 + sway],
        [21, 4 + sway],
        [24, 11 + sway],
        [11, 13 + sway],
      ],
      RAMPS.ZERG_CARAPACE_UMBER,
      { panelEveryX: 3 }
    );
    l.dome(17, 9 + sway, 5.2, 3.8, RAMPS.ZERG_CHITIN_PURPLE, {
      ridgeFreq: 1.3,
    });

    l.capsule(11, 6 + sway, 1.5, 5, 3 + sway, 0.8, RAMPS.ZERG_BONE_IVORY);
    l.capsule(10, 9 + sway, 1.5, 5, 8 + sway, 0.8, RAMPS.ZERG_BONE_IVORY);
    l.capsule(11, 12 + sway, 1.4, 6, 12 + sway, 0.8, RAMPS.ZERG_BONE_IVORY);

    l.dome(20, 8 + sway, 1.6, 1.4, RAMPS.ZERG_ACID_GREEN);
    l.set(21, 8 + sway, '#ffffff');
    l.line(22, 11 + sway, 25, 10 + sway, '#ffffff');
    l.line(21, 12 + sway, 24, 13 + sway, '#ded2c3');
  });

  // 3. Twin Massive Curved Ivory Scythe-Blade Arms
  buf.layer((l) => {
    l.capsule(17, 14 + sway, 2.0, 24, 12 + sway, 1.8, RAMPS.ZERG_CHITIN_PURPLE);
    l.beveledPlate(
      [
        [23, 10 + sway],
        [29, 13 + sway],
        [26, 23 + sway],
        [23, 16 + sway],
      ],
      RAMPS.ZERG_BONE_IVORY
    );
    l.line(24, 11 + sway, 28, 14 + sway, '#ffffff');
  });
}

function drawZergLurker(buf: PixelBuffer, frame: number): void {
  const pulse = frame % 2 === 1 ? -1 : 0;

  // 1. Far Pair of Multi-Jointed Arachnid Burrowing Legs
  buf.layer((l) => {
    const rearLegs: ReadonlyArray<readonly [number, number, number, number]> = [
      [14, 21, 4, 32],
      [22, 20, 16, 34],
      [30, 21, 43, 32],
    ];
    for (let i = 0; i < rearLegs.length; i++) {
      const [x0, y0, x1, y1] = rearLegs[i];
      const kx = Math.round((x0 + x1) / 2);
      const ky = y0 - 6;
      l.capsule(x0, y0, 2.1, kx, ky, 1.8, RAMPS.ZERG_CARAPACE_UMBER);
      l.capsule(kx, ky, 1.8, x1, y1, 1.3, RAMPS.ZERG_FLESH_CRIMSON);
      l.capsule(x1, y1, 1.4, x1, y1 + 3, 0.8, RAMPS.ZERG_BONE_IVORY);
    }
  });

  // 2. Broad Spiky Arachnid Carapace & Swept Horn-Like Dorsal Spines
  buf.layer((l) => {
    l.dome(23, 24, 13.5, 6.5, RAMPS.ZERG_FLESH_CRIMSON);
    l.capsule(12, 21, 5.8, 33, 21, 5.5, RAMPS.ZERG_CHITIN_PURPLE, {
      ribStep: 4,
    });
    l.capsule(14, 19, 3.5, 31, 19, 3.2, RAMPS.ZERG_CARAPACE_UMBER, {
      ribStep: 4,
    });
    // Swept dorsal horn spines (umber base tapering to sharp bone tips)
    for (let sx = 14; sx <= 29; sx += 5) {
      l.capsule(sx, 18, 2.2, sx - 2, 14 + pulse, 1.5, RAMPS.ZERG_CARAPACE_UMBER);
      l.capsule(sx - 2, 14 + pulse, 1.5, sx - 4, 10 + pulse, 0.7, RAMPS.ZERG_BONE_IVORY);
    }
  });

  // 3. Near Articulated Spider Legs, Armored Head & Glowing Orange Eyes
  buf.layer((l) => {
    const frontLegs: ReadonlyArray<readonly [number, number, number, number]> = [
      [15, 25, 8, 40],
      [23, 26, 21, 42],
      [31, 25, 36, 40],
    ];
    for (let i = 0; i < frontLegs.length; i++) {
      const [x0, y0, x1, y1] = frontLegs[i];
      const kx = Math.round((x0 + x1) / 2);
      const ky = y0 + 4;
      l.capsule(x0, y0, 2.4, kx, ky, 1.9, RAMPS.ZERG_CHITIN_PURPLE);
      l.capsule(kx, ky, 1.9, x1, y1, 1.4, RAMPS.ZERG_FLESH_CRIMSON);
      l.capsule(x1, y1, 1.5, x1 + 1, y1 + 3, 0.8, RAMPS.ZERG_BONE_IVORY);
    }

    l.dome(35, 23, 5.2, 4.2, RAMPS.ZERG_CHITIN_PURPLE);
    l.dome(37, 22, 1.8, 1.5, RAMPS.FLAME_PLASMA);
    l.set(38, 21, '#ffffff');
    l.capsule(38, 23, 1.6, 44, 21, 0.8, RAMPS.ZERG_BONE_IVORY);
    l.capsule(38, 26, 1.6, 44, 27, 0.8, RAMPS.ZERG_BONE_IVORY);
  });
}

function drawZergMutalisk(buf: PixelBuffer, frame: number): void {
  const flap = frame % 2 === 1 ? 3 : -2;

  // 1. Far Leathery Bat-Wing & Coiled Segmented Glave-Wurm Abdomen
  buf.layer((l) => {
    l.beveledPlate(
      [
        [20, 20],
        [9, 5 + flap],
        [25, 8 + flap],
        [25, 20],
      ],
      RAMPS.ZERG_CHITIN_PURPLE,
      { panelEveryX: 4 }
    );
    l.line(20, 19, 9, 5 + flap, '#b3a191');

    l.capsule(20, 23, 3.5, 14, 32, 2.8, RAMPS.ZERG_FLESH_CRIMSON, {
      ribStep: 2,
    });
    l.capsule(14, 32, 2.8, 20, 40, 3.2, RAMPS.ZERG_FLESH_CRIMSON, {
      ribStep: 2,
    });
    l.dome(21, 40, 3.6, 3.2, RAMPS.ZERG_ACID_GREEN);
  });

  // 2. Near Spread Bat-Like Leathery Wing with Bone Struts
  buf.layer((l) => {
    l.beveledPlate(
      [
        [22, 22],
        [13, 6 - flap],
        [35, 7 - flap],
        [30, 21],
      ],
      RAMPS.ZERG_CHITIN_PURPLE,
      { panelEveryX: 5 }
    );
    l.beveledPlate(
      [
        [23, 20],
        [16, 9 - flap],
        [32, 10 - flap],
        [28, 20],
      ],
      RAMPS.ZERG_FLESH_CRIMSON
    );
    l.capsule(22, 21, 1.6, 13, 6 - flap, 1.0, RAMPS.ZERG_BONE_IVORY);
    l.capsule(23, 20, 1.3, 34, 7 - flap, 0.9, RAMPS.ZERG_BONE_IVORY);
  });

  // 3. Thorax, Crested Flyer Head & Acid Jaws
  buf.layer((l) => {
    l.dome(27, 22, 6.2, 4.4, RAMPS.ZERG_CHITIN_PURPLE, { ridgeFreq: 1.1 });
    l.dome(31, 20, 1.8, 1.6, RAMPS.ZERG_ACID_GREEN);
    l.set(32, 20, '#ffffff');
    l.capsule(32, 22, 1.5, 38, 21, 0.8, RAMPS.ZERG_BONE_IVORY);
    l.capsule(32, 24, 1.5, 37, 25, 1.0, RAMPS.ZERG_ACID_GREEN);
  });
}

function drawZergUltralisk(buf: PixelBuffer, frame: number): void {
  const stomp = frame % 2 === 1 ? -1 : 0;

  // 1. Far Pair of Legs in 3/4 Depth & Swept Dorsal Bone Ridges
  buf.layer((l) => {
    // Far-rear & far-front legs (planted slightly higher in 3/4 depth)
    l.capsule(12, 33, 4.2, 10, 48, 3.8, RAMPS.ZERG_CARAPACE_UMBER, {
      ribStep: 4,
    });
    l.dome(10, 49, 4.2, 2.0, RAMPS.ZERG_BONE_IVORY);
    l.capsule(30, 34 + stomp, 4.2, 31, 48 + stomp, 3.8, RAMPS.ZERG_CARAPACE_UMBER, {
      ribStep: 4,
    });
    l.dome(31, 49 + stomp, 4.2, 2.0, RAMPS.ZERG_BONE_IVORY);

    // Swept dorsal horn ridges along the spine
    for (let sx = 14; sx <= 34; sx += 5) {
      l.capsule(sx, 19 + stomp, 2.4, sx - 4, 11 + stomp, 0.9, RAMPS.ZERG_BONE_IVORY);
    }
  });

  // 2. Colossal Hunched Segmented Carapace, Muscular Near Legs & Behemoth Skull
  buf.layer((l) => {
    l.dome(25, 30 + stomp, 15.5, 10.0, RAMPS.ZERG_FLESH_CRIMSON);
    l.capsule(12, 25 + stomp, 9.2, 36, 26 + stomp, 8.5, RAMPS.ZERG_CHITIN_PURPLE, {
      ribStep: 5,
    });
    l.capsule(14, 21 + stomp, 5.2, 34, 22 + stomp, 5.0, RAMPS.ZERG_CARAPACE_UMBER, {
      ribStep: 5,
    });

    // Near-rear muscular haunch & leg
    l.dome(17, 35, 5.5, 5.0, RAMPS.ZERG_CHITIN_PURPLE);
    l.capsule(17, 37, 4.4, 18, 53, 4.2, RAMPS.ZERG_CHITIN_PURPLE, {
      ribStep: 4,
    });
    l.dome(18, 54, 5.0, 2.2, RAMPS.ZERG_BONE_IVORY);

    // Near-front muscular shoulder & leg
    l.dome(36, 35, 5.5, 5.0, RAMPS.ZERG_CHITIN_PURPLE);
    l.capsule(36, 37, 4.6, 38, 53, 4.4, RAMPS.ZERG_CHITIN_PURPLE, {
      ribStep: 4,
    });
    l.dome(38, 54, 5.2, 2.2, RAMPS.ZERG_BONE_IVORY);

    // Armored behemoth skull & glowing fiery eyes
    l.dome(41, 28 + stomp, 7.0, 5.8, RAMPS.ZERG_CHITIN_PURPLE);
    l.dome(44, 26 + stomp, 2.2, 1.8, RAMPS.FLAME_PLASMA);
    l.set(45, 26 + stomp, '#ffffff');
  });

  // 3. Twin Colossal Multi-Segment Crescent Kaiser Blades
  buf.layer((l) => {
    // Upper sweeping Kaiser Blade (shoulder socket -> curved bone arm -> razor crescent scythe)
    l.dome(33, 21 + stomp, 3.8, 3.5, RAMPS.ZERG_CARAPACE_UMBER);
    l.capsule(34, 20 + stomp, 3.2, 47, 11 + stomp, 3.8, RAMPS.ZERG_BONE_IVORY);
    l.capsule(47, 11 + stomp, 3.8, 60, 18 + stomp, 1.2, RAMPS.ZERG_BONE_IVORY);
    l.line(36, 18 + stomp, 47, 10 + stomp, '#ffffff', 2);
    l.line(47, 10 + stomp, 60, 17 + stomp, '#ffffff', 2);

    // Lower sweeping Kaiser Blade
    l.dome(34, 33 + stomp, 3.8, 3.5, RAMPS.ZERG_CARAPACE_UMBER);
    l.capsule(35, 34 + stomp, 3.2, 49, 41 + stomp, 3.8, RAMPS.ZERG_BONE_IVORY);
    l.capsule(49, 41 + stomp, 3.8, 61, 33 + stomp, 1.2, RAMPS.ZERG_BONE_IVORY);
    l.line(37, 36 + stomp, 49, 42 + stomp, '#ffffff', 2);
    l.line(49, 42 + stomp, 61, 34 + stomp, '#ffffff', 2);
  });
}

// ============================================================================
// III. PROTOSS FLEET — HIGH-DETAIL 3/4 TACTICAL KHALAI PIXEL SPRITES (6 Units)
// ============================================================================

function drawProtossProbe(buf: PixelBuffer, frame: number): void {
  const hover = frame % 2 === 1 ? -1 : 0;

  // 1. Lower Gravitic Pendulum & Warp-Harvesting Plasma Spark
  buf.layer((l) => {
    l.capsule(16, 19 + hover, 3.0, 16, 26 + hover, 1.2, RAMPS.PROTOSS_BRONZE);
    l.dome(16, 26 + hover, 2.0, 2.0, RAMPS.PROTOSS_PSI_CYAN);
    if (frame % 2 === 1) {
      l.set(16, 28 + hover, '#ffffff');
    }
  });

  // 2. Sculpted Golden Gyro-Body & Floating Side Stabilizer Vanes
  buf.layer((l) => {
    l.beveledPlate(
      [
        [5, 10 + hover],
        [13, 8 + hover],
        [11, 20 + hover],
        [6, 17 + hover],
      ],
      RAMPS.PROTOSS_GOLD
    );
    l.dome(16, 15 + hover, 6.5, 6.0, RAMPS.PROTOSS_GOLD, { ridgeFreq: 0.9 });
  });

  // 3. Giant Glowing Psionic Optic Crystal Lens
  buf.layer((l) => {
    l.dome(19, 15 + hover, 3.5, 3.5, RAMPS.PROTOSS_PSI_CYAN);
    l.set(20, 14 + hover, '#ffffff');
  });
}

function drawProtossZealot(buf: PixelBuffer, frame: number): void {
  const bob = frame % 2 === 1 ? -1 : 0;

  // 1. Flowing Khalai Nerve-Cord Ponytail & Ornate Golden Greaves
  buf.layer((l) => {
    l.capsule(13, 8 + bob, 1.8, 5, 13 + bob, 1.2, RAMPS.PROTOSS_ROYAL_BLUE, {
      ribStep: 2,
    });
    l.set(5, 13 + bob, '#f7c43e');
    l.capsule(11, 19, 2.6, 10, 27, 2.2, RAMPS.PROTOSS_GOLD);
    l.capsule(18, 19, 2.6, 19, 27, 2.2, RAMPS.PROTOSS_GOLD);
  });

  // 2. Masterwork Golden Cuirass, Swept Wing-Pauldrons & Khaydarin Chest Gem
  buf.layer((l) => {
    l.dome(15, 15 + bob, 5.2, 4.8, RAMPS.PROTOSS_GOLD);
    l.beveledPlate(
      [
        [4, 9 + bob],
        [12, 10 + bob],
        [11, 16 + bob],
        [5, 14 + bob],
      ],
      RAMPS.PROTOSS_GOLD
    );
    l.beveledPlate(
      [
        [18, 10 + bob],
        [26, 9 + bob],
        [24, 15 + bob],
        [19, 16 + bob],
      ],
      RAMPS.PROTOSS_GOLD
    );
    l.dome(16, 14 + bob, 2.0, 2.0, RAMPS.PROTOSS_PSI_CYAN);

    l.dome(15, 8 + bob, 3.5, 3.5, RAMPS.PROTOSS_ROYAL_BLUE);
    l.capsule(14, 5 + bob, 1.4, 16, 7 + bob, 1.4, RAMPS.PROTOSS_GOLD);
    l.rect(16, 8 + bob, 3, 2, '#8ce3ff');
    l.set(17, 8 + bob, '#ffffff');
  });

  // 3. Dual Blazing Cyan-White Psi-Blades & Golden Wrist Gauntlets
  buf.layer((l) => {
    l.capsule(9, 16 + bob, 1.6, 3, 21 + bob, 1.0, RAMPS.PROTOSS_PSI_CYAN);
    l.dome(21, 16 + bob, 2.2, 2.0, RAMPS.PROTOSS_GOLD);
    l.capsule(22, 16 + bob, 2.0, 30, 12 + bob, 1.0, RAMPS.PROTOSS_PSI_CYAN);
    l.line(22, 16 + bob, 30, 12 + bob, '#ffffff');
  });
}

function drawProtossDragoon(buf: PixelBuffer, frame: number): void {
  const step = frame % 2 === 1 ? -1 : 0;

  // 1. Rear Reverse-Jointed Cybernetic Walker Legs
  buf.layer((l) => {
    l.capsule(18, 21, 2.4, 9, 11 - step, 2.0, RAMPS.PROTOSS_BRONZE);
    l.capsule(9, 11 - step, 2.0, 5, 24 - step, 1.5, RAMPS.PROTOSS_GOLD);
    l.dome(9, 11 - step, 2.0, 2.0, RAMPS.PROTOSS_PSI_CYAN);
    l.capsule(30, 21, 2.4, 39, 11 + step, 2.0, RAMPS.PROTOSS_BRONZE);
    l.capsule(39, 11 + step, 2.0, 43, 24 + step, 1.5, RAMPS.PROTOSS_GOLD);
    l.dome(39, 11 + step, 2.0, 2.0, RAMPS.PROTOSS_PSI_CYAN);
  });

  // 2. Sculpted Hexagonal Golden Walker Pod & Glowing Phase-Disruptor Shrine Dome
  buf.layer((l) => {
    l.dome(24, 24 + step, 12.0, 7.5, RAMPS.PROTOSS_GOLD, { ridgeFreq: 0.7 });
    l.dome(24, 21 + step, 6.5, 4.2, RAMPS.PROTOSS_PSI_CYAN);
    l.dome(33, 24 + step, 2.2, 1.8, RAMPS.PROTOSS_PSI_CYAN);
  });

  // 3. Front Reverse-Jointed Walker Legs with Cyan Knee Nodes
  buf.layer((l) => {
    l.capsule(17, 26, 2.8, 10, 31 + step, 2.4, RAMPS.PROTOSS_GOLD);
    l.capsule(10, 31 + step, 2.4, 8, 42, 1.6, RAMPS.PROTOSS_BRONZE);
    l.dome(10, 31 + step, 2.2, 2.2, RAMPS.PROTOSS_PSI_CYAN);
    l.capsule(31, 26, 2.8, 38, 31 - step, 2.4, RAMPS.PROTOSS_GOLD);
    l.capsule(38, 31 - step, 2.4, 40, 42, 1.6, RAMPS.PROTOSS_BRONZE);
    l.dome(38, 31 - step, 2.2, 2.2, RAMPS.PROTOSS_PSI_CYAN);
  });
}

function drawProtossHighTemplar(buf: PixelBuffer, frame: number): void {
  const floatY = frame % 2 === 1 ? -1 : 0;

  // 1. Levitation Psionic Ground Aura & Pleated Royal-Blue Khalai Mantle
  buf.layer((l) => {
    l.dome(16, 27, 7.5, 2.0, RAMPS.PROTOSS_PSI_CYAN);
    l.beveledPlate(
      [
        [11, 13 + floatY],
        [21, 13 + floatY],
        [24, 26],
        [8, 26],
      ],
      RAMPS.PROTOSS_ROYAL_BLUE,
      { panelEveryX: 3 }
    );
    l.capsule(9, 25, 1.5, 23, 25, 1.5, RAMPS.PROTOSS_GOLD);
    l.capsule(16, 14 + floatY, 1.8, 16, 25, 1.6, RAMPS.PROTOSS_GOLD);
  });

  // 2. Towering Golden Sun-Collar, Pauldron Gems & Psionic Master Head
  buf.layer((l) => {
    l.beveledPlate(
      [
        [5, 8 + floatY],
        [27, 8 + floatY],
        [23, 16 + floatY],
        [9, 16 + floatY],
      ],
      RAMPS.PROTOSS_GOLD,
      { panelEveryX: 5 }
    );
    l.dome(16, 14 + floatY, 2.2, 2.2, RAMPS.PROTOSS_PSI_CYAN);
    l.dome(16, 8 + floatY, 3.6, 3.4, RAMPS.TERRAN_STEEL_LIGHT);
    l.rect(15, 7 + floatY, 4, 2, '#f2fcff');
  });

  // 3. Crackling Psionic Storm Lightning Orb & Arcs
  buf.layer((l) => {
    l.dome(26, 13 + floatY, 3.2, 3.2, RAMPS.PROTOSS_PSI_CYAN);
    const arcY = frame % 2 === 0 ? 8 : 18;
    l.line(26, 13 + floatY, 30, arcY, '#ffffff');
    l.line(26, 13 + floatY, 30, 13 + floatY, '#8ce3ff');
  });
}

function drawProtossReaver(buf: PixelBuffer, frame: number): void {
  const pulse = frame % 2 === 1 ? 1 : 0;

  // 1. Armored Crawling Under-Chassis
  buf.layer((l) => {
    l.capsule(10, 32, 3.8, 37, 32, 3.8, RAMPS.TERRAN_STEEL_DARK, {
      ribStep: 4,
    });
    for (let tx = 11; tx <= 35; tx += 5) {
      l.dome(tx, 33, 2.0, 1.8, RAMPS.PROTOSS_BRONZE);
    }
  });

  // 2. Six Overlapping Arched Golden Trilobite Carapace Segments & Cyan Vents
  buf.layer((l) => {
    const segs: ReadonlyArray<readonly [number, number, number, number]> = [
      [12, 26, 5.5, 6.5],
      [17, 24, 6.5, 8.0],
      [23, 22, 7.5, 9.5],
      [29, 21, 8.0, 10.2],
    ];
    for (let i = 0; i < segs.length; i++) {
      const [cx, cy, rx, ry] = segs[i];
      l.dome(cx, cy, rx, ry, i % 2 === 0 ? RAMPS.PROTOSS_GOLD : RAMPS.PROTOSS_BRONZE);
      l.line(cx + 2, cy - ry + 3, cx + 2, cy + ry - 3, '#38bdf8');
    }
  });

  // 3. Armored Fore-Shield & Blazing Blue Scarab Manufacturing Bay
  buf.layer((l) => {
    l.dome(35, 22, 7.2, 9.8, RAMPS.PROTOSS_GOLD);
    l.dome(38, 23, 3.6 + pulse * 0.4, 4.8, RAMPS.PROTOSS_PSI_CYAN);
    l.rect(38, 21, 3, 4, '#ffffff');
  });
}

function drawProtossCarrier(buf: PixelBuffer, frame: number): void {
  const hover = frame % 2 === 1 ? -1 : 0;

  // 1. Stern Gravitic Thruster Array, Swept Wing Vanes & 3 Mini Interceptors
  buf.layer((l) => {
    // 3 Rear gravitic plasma engine nozzles
    for (let ey = 26; ey <= 38; ey += 6) {
      l.capsule(4, ey + hover, 2.2, 10, ey + hover, 2.6, RAMPS.PROTOSS_PSI_CYAN);
      if (frame % 2 === 1) {
        l.set(2, ey + hover, '#ffffff');
      }
    }

    // Swept dorsal & ventral golden stabilizer fins
    l.beveledPlate(
      [
        [16, 24 + hover],
        [25, 12 + hover],
        [37, 15 + hover],
        [37, 49 + hover],
        [25, 52 + hover],
        [16, 40 + hover],
      ],
      RAMPS.PROTOSS_BRONZE,
      { panelEveryX: 5 }
    );

    // 3 Orbiting Mini Interceptors
    const ix = frame % 2 === 0 ? 50 : 52;
    const interceptors: ReadonlyArray<readonly [number, number]> = [
      [ix, 9 + hover],
      [58, 19 + hover],
      [ix - 3, 53 + hover],
    ];
    for (let i = 0; i < interceptors.length; i++) {
      const [cx, cy] = interceptors[i];
      l.dome(cx, cy, 3.0, 1.8, RAMPS.PROTOSS_GOLD);
      l.set(cx + 2, cy, '#38bdf8');
      l.set(cx - 3, cy, '#8ce3ff');
    }
  });

  // 2. Elongated Sculpted Golden Cathedral Hull & Twin Forward Launch Prongs
  buf.layer((l) => {
    // Upper forward golden hull mandible
    l.beveledPlate(
      [
        [10, 23 + hover],
        [28, 17 + hover],
        [47, 19 + hover],
        [60, 24 + hover],
        [54, 29 + hover],
        [10, 30 + hover],
      ],
      RAMPS.PROTOSS_GOLD,
      { panelEveryX: 6 }
    );
    // Lower forward golden hull mandible
    l.beveledPlate(
      [
        [10, 34 + hover],
        [54, 35 + hover],
        [60, 40 + hover],
        [47, 45 + hover],
        [28, 47 + hover],
        [10, 41 + hover],
      ],
      RAMPS.PROTOSS_BRONZE,
      { panelEveryX: 6 }
    );
    // Glowing cyan central gravitic launch bay corridor between prongs
    l.capsule(20, 32 + hover, 2.8, 56, 32 + hover, 2.5, RAMPS.PROTOSS_PSI_CYAN);
  });

  // 3. Sleek Overlapping Golden Dorsal Cowlings & 3 Khaydarin Crystal Cores
  buf.layer((l) => {
    // Sculpted elongated golden dorsal cowling
    l.capsule(14, 32 + hover, 7.2, 46, 32 + hover, 5.2, RAMPS.PROTOSS_GOLD, {
      ribStep: 7,
    });
    // Longitudinal golden trim ribs
    l.line(15, 27 + hover, 47, 28 + hover, '#fff5ad');
    l.line(15, 37 + hover, 47, 36 + hover, '#73400a');

    // 3 Embedded glowing cyan Khaydarin crystal cores along the spine
    l.dome(20, 32 + hover, 3.8, 2.8, RAMPS.PROTOSS_PSI_CYAN);
    l.dome(32, 32 + hover, 3.4, 2.5, RAMPS.PROTOSS_PSI_CYAN);
    l.dome(43, 32 + hover, 2.8, 2.2, RAMPS.PROTOSS_PSI_CYAN);
  });
}

// ============================================================================
// IV. PIXEL-ART BATTLEFIELD TERRAIN TILES (32x32)
// ============================================================================

export function renderTerrainTileBuffer(
  zone: ZoneType,
  race: Race,
  variant: 0 | 1
): PixelBuffer {
  const buf = new PixelBuffer(32, 32);

  if (zone === 'ALLY') {
    if (race === 'TERRAN') {
      // UED/Dominion Metallic Deck Plating with corner rivets & vent grates
      const bg = variant === 0 ? '#0e1826' : '#0b1420';
      buf.rect(0, 0, 32, 32, bg);
      // Beveled deck border
      buf.line(1, 1, 30, 1, '#1b2e47');
      buf.line(1, 1, 1, 30, '#1b2e47');
      buf.line(1, 30, 30, 30, '#060b12');
      buf.line(30, 1, 30, 30, '#060b12');
      // Corner rivets
      const corners = [
        [3, 3],
        [28, 3],
        [3, 28],
        [28, 28],
      ];
      for (const [cx, cy] of corners) {
        buf.set(cx, cy, '#2c486e');
        buf.set(cx + 1, cy + 1, '#060b12');
      }
      // Subtle recessed ventilation grate slats in center
      for (let gy = 13; gy <= 19; gy += 2) {
        buf.line(11, gy, 20, gy, '#070c14');
      }
      buf.set(2, 2, '#38bdf8');
    } else if (race === 'ZERG') {
      // Living Zerg Creep Biomass with organic vein network & spore nodes
      const bg = variant === 0 ? '#160d24' : '#130b1f';
      buf.rect(0, 0, 32, 32, bg);
      for (let y = 1; y < 31; y++) {
        for (let x = 1; x < 31; x++) {
          const n = Math.sin(x * 0.45 + y * 0.3) * Math.cos(y * 0.5 - x * 0.2);
          if (n > 0.45) {
            buf.set(x, y, '#231338');
          } else if (n < -0.55) {
            buf.set(x, y, '#0d0717');
          }
        }
      }
      // Organic creep veins
      buf.line(2, 8, 15, 16, '#331a4d');
      buf.line(15, 16, 29, 11, '#331a4d');
      buf.line(15, 16, 19, 29, '#2b1542');
      buf.set(15, 16, '#4c1d95');
      buf.set(8, 23, '#4c1d95');
      buf.line(0, 0, 31, 0, '#2e1647');
      buf.line(0, 0, 0, 31, '#2e1647');
    } else {
      // Protoss Khalai Temple Stone with Golden Filigree & Psionic Conduits
      const bg = variant === 0 ? '#0d1526' : '#0a1120';
      buf.rect(0, 0, 32, 32, bg);
      buf.line(1, 1, 30, 1, '#1e3252');
      buf.line(1, 1, 1, 30, '#1e3252');
      // Subtle cyan psionic circuit trace
      buf.line(6, 16, 25, 16, '#0c2d48');
      buf.line(16, 6, 16, 25, '#0c2d48');
      buf.rect(14, 14, 4, 4, '#133b5c');
      // Golden corner inlays
      buf.set(2, 2, '#854d0e');
      buf.set(3, 2, '#713f12');
      buf.set(2, 3, '#713f12');
      buf.set(29, 29, '#854d0e');
    }
  } else if (zone === 'CENTER') {
    // Koprulu Badlands No-Man's-Land with craters & hazard border ticks
    const bg = variant === 0 ? '#0a0e17' : '#080b12';
    buf.rect(0, 0, 32, 32, bg);
    buf.line(0, 0, 31, 0, '#172030');
    buf.line(0, 0, 0, 31, '#172030');
    // Subtle rock grit & micro-crater
    buf.set(9, 11, '#161f2e');
    buf.set(22, 20, '#161f2e');
    buf.rect(14, 15, 4, 2, '#283548');
  } else {
    // Enemy Scorched Crimson Badlands Sector
    const bg = variant === 0 ? '#1a0f14' : '#140c10';
    buf.rect(0, 0, 32, 32, bg);
    buf.line(1, 1, 30, 1, '#331822');
    buf.line(1, 1, 1, 30, '#331822');
    buf.line(1, 30, 30, 30, '#0d0609');
    buf.line(30, 1, 30, 30, '#0d0609');
    buf.set(29, 2, '#991b1b');
    buf.set(16, 16, '#29131b');
  }

  return buf;
}

// ============================================================================
// PUBLIC PIXEL SPRITE FACTORY
// ============================================================================

type UnitPixelDrawer = (buf: PixelBuffer, frame: number) => void;

const UNIT_DRAWERS: Readonly<Record<string, UnitPixelDrawer>> = {
  terran_scv: drawTerranSCV,
  terran_marine: drawTerranMarine,
  terran_firebat: drawTerranFirebat,
  terran_medic: drawTerranMedic,
  terran_siege_tank: drawTerranSiegeTank,
  terran_battlecruiser: drawTerranBattlecruiser,

  zerg_drone: drawZergDrone,
  zerg_zergling: drawZergZergling,
  zerg_hydralisk: drawZergHydralisk,
  zerg_lurker: drawZergLurker,
  zerg_mutalisk: drawZergMutalisk,
  zerg_ultralisk: drawZergUltralisk,

  protoss_probe: drawProtossProbe,
  protoss_zealot: drawProtossZealot,
  protoss_dragoon: drawProtossDragoon,
  protoss_high_templar: drawProtossHighTemplar,
  protoss_reaver: drawProtossReaver,
  protoss_carrier: drawProtossCarrier,
};

export function renderUnitPixelBuffer(
  def: UnitDefinition,
  facing: 1 | -1 = 1,
  frame: number = 0
): PixelBuffer {
  const size = def.visual.sprite_size;
  const buf = new PixelBuffer(size, size);
  const drawer = UNIT_DRAWERS[def.unit_id];

  if (drawer) {
    drawer(buf, frame);
  } else {
    const pad = Math.max(3, Math.floor(size * 0.15));
    buf.layer((l) => {
      l.dome(size / 2, size / 2, size / 2 - pad, size / 2 - pad, RAMPS.TERRAN_BLUE);
    });
  }

  return facing === -1 ? buf.flipHorizontal() : buf;
}
