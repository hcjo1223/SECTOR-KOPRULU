import type { UnitDefinition } from '../domain/types';

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
    this.data[idx] = r;
    this.data[idx + 1] = g;
    this.data[idx + 2] = b;
    this.data[idx + 3] = alpha;
  }

  public isOpaque(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }
    return this.data[(y * this.width + x) * 4 + 3] > 0;
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

  public shadedBox(
    x: number,
    y: number,
    w: number,
    h: number,
    lightHex: string,
    midHex: string,
    darkHex: string
  ): void {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const rw = Math.round(w);
    const rh = Math.round(h);
    for (let py = y0; py < y0 + rh; py++) {
      for (let px = x0; px < x0 + rw; px++) {
        if (py === y0 || (px === x0 + rw - 1 && py < y0 + rh - 1)) {
          this.set(px, py, lightHex);
        } else if (py === y0 + rh - 1 || px === x0) {
          this.set(px, py, darkHex);
        } else {
          this.set(px, py, midHex);
        }
      }
    }
  }

  public ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    hex: string
  ): void {
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const nx = (px - cx) / Math.max(0.5, rx);
        const ny = (py - cy) / Math.max(0.5, ry);
        if (nx * nx + ny * ny <= 1.05) {
          this.set(px, py, hex);
        }
      }
    }
  }

  public shadedEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    lightHex: string,
    midHex: string,
    darkHex: string
  ): void {
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const nx = (px - cx) / Math.max(0.5, rx);
        const ny = (py - cy) / Math.max(0.5, ry);
        const d2 = nx * nx + ny * ny;
        if (d2 <= 1.05) {
          const lightScore = nx * 0.45 - ny * 0.75;
          if (lightScore > 0.28) {
            this.set(px, py, lightHex);
          } else if (lightScore < -0.25) {
            this.set(px, py, darkHex);
          } else {
            this.set(px, py, midHex);
          }
        }
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

  public poly(
    points: ReadonlyArray<readonly [number, number]>,
    hex: string
  ): void {
    if (points.length < 3) {
      return;
    }
    let minY = this.height;
    let maxY = 0;
    for (let i = 0; i < points.length; i++) {
      minY = Math.min(minY, Math.floor(points[i][1]));
      maxY = Math.max(maxY, Math.ceil(points[i][1]));
    }
    minY = Math.max(0, minY);
    maxY = Math.min(this.height - 1, maxY);

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
          this.set(x, y, hex);
        }
      }
    }
  }

  public outline(outlineHex: string = '#070a10'): void {
    const toOutline: Array<readonly [number, number]> = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.isOpaque(x, y)) {
          continue;
        }
        if (
          this.isOpaque(x - 1, y) ||
          this.isOpaque(x + 1, y) ||
          this.isOpaque(x, y - 1) ||
          this.isOpaque(x, y + 1)
        ) {
          toOutline.push([x, y]);
        }
      }
    }
    for (let i = 0; i < toOutline.length; i++) {
      this.set(toOutline[i][0], toOutline[i][1], outlineHex);
    }
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
        const tx = x + ox;
        const ty = y + oy;
        if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) {
          continue;
        }
        const dstIdx = (ty * this.width + tx) * 4;
        this.data[dstIdx] = other.data[srcIdx];
        this.data[dstIdx + 1] = other.data[srcIdx + 1];
        this.data[dstIdx + 2] = other.data[srcIdx + 2];
        this.data[dstIdx + 3] = a;
      }
    }
  }

  public layer(
    drawFn: (sub: PixelBuffer) => void,
    outlineHex: string | null = '#070a10',
    offsetX: number = 0,
    offsetY: number = 0
  ): void {
    const sub = new PixelBuffer(this.width, this.height);
    drawFn(sub);
    if (outlineHex) {
      sub.outline(outlineHex);
    }
    this.composite(sub, offsetX, offsetY);
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
// TERRAN PIXEL SPRITES (6 Units)
// ============================================================================

function drawTerranSCV(buf: PixelBuffer, frame: number): void {
  const bob = frame % 2 === 1 ? -1 : 0;

  // Layer 1: Rear Thruster Pack & Hydraulic Legs
  buf.layer((l) => {
    // Thruster pods on back
    l.shadedBox(5, 8 + bob, 4, 10, '#60a5fa', '#2563eb', '#1e3a8a');
    l.set(4, 15 + bob, frame % 2 === 0 ? '#38bdf8' : '#7dd3fc');
    l.set(4, 16 + bob, '#e0f2fe');
    // Heavy legs
    l.shadedBox(9, 21, 5, 7, '#64748b', '#334155', '#1e293b');
    l.shadedBox(16, 21, 5, 7, '#64748b', '#334155', '#1e293b');
    // Steel boots with yellow hazard toe
    l.rect(9, 26, 6, 2, '#475569');
    l.rect(16, 26, 6, 2, '#475569');
    l.set(14, 27, '#f59e0b');
    l.set(21, 27, '#f59e0b');
  });

  // Layer 2: Industrial Exo-Cab, Roll-cage & Cockpit Visor
  buf.layer((l) => {
    // Main torso frame
    l.shadedBox(8, 10 + bob, 13, 12, '#60a5fa', '#2563eb', '#172554');
    // Yellow/amber industrial hazard shoulder bars
    l.rect(8, 10 + bob, 13, 2, '#f59e0b');
    l.set(10, 10 + bob, '#1e293b');
    l.set(14, 10 + bob, '#1e293b');
    l.set(18, 10 + bob, '#1e293b');
    // Recessed cockpit glass dome
    l.shadedBox(12, 12 + bob, 8, 6, '#38bdf8', '#0284c7', '#0c4a6e');
    // Pilot visor glow inside cab
    l.rect(15, 14 + bob, 4, 2, '#fde047');
    l.set(17, 13 + bob, '#ffffff');
    // Lower chest engine grill
    l.rect(11, 19 + bob, 7, 2, '#334155');
  });

  // Layer 3: Front Industrial Pincer Arm & Fusion Cutter Torch
  buf.layer((l) => {
    // Upper clamp arm
    l.shadedBox(18, 12 + bob, 6, 3, '#94a3b8', '#475569', '#1e293b');
    l.line(24, 11 + bob, 27, 11 + bob, '#cbd5e1');
    l.line(24, 15 + bob, 27, 15 + bob, '#94a3b8');
    // Lower fusion cutter arm
    l.shadedBox(17, 17 + bob, 7, 4, '#f59e0b', '#d97706', '#78350f');
    l.rect(24, 18 + bob, 3, 2, '#94a3b8');
    // Glowing blue/white plasma welding spark
    l.set(27, 18 + bob, '#38bdf8');
    l.set(28, 18 + bob, '#e0f2fe');
    if (frame % 2 === 1) {
      l.set(29, 17 + bob, '#7dd3fc');
      l.set(28, 19 + bob, '#38bdf8');
    }
  });
}

function drawTerranMarine(buf: PixelBuffer, frame: number): void {
  const bob = frame % 2 === 1 ? -1 : 0;

  // Layer 1: CMC-300 Reactor Backpack & Armored Greaves
  buf.layer((l) => {
    // High twin-vent reactor hump behind helmet
    l.shadedBox(8, 6 + bob, 11, 10, '#60a5fa', '#1d4ed8', '#172554');
    l.rect(9, 7 + bob, 2, 4, '#93c5fd');
    // Legs in wide stance
    l.shadedBox(9, 20, 5, 8, '#60a5fa', '#2563eb', '#172554');
    l.shadedBox(17, 20, 5, 8, '#60a5fa', '#2563eb', '#172554');
    // Knee pads & combat boots
    l.rect(10, 22, 3, 2, '#93c5fd');
    l.rect(18, 22, 3, 2, '#93c5fd');
    l.rect(9, 27, 6, 2, '#334155');
    l.rect(17, 27, 6, 2, '#334155');
  });

  // Layer 2: Bulky Chest Armor, Oversized Round Pauldrons & Domed Visor Helmet
  buf.layer((l) => {
    // Torso armor
    l.shadedBox(10, 11 + bob, 11, 10, '#60a5fa', '#2563eb', '#1e3a8a');
    // Oversized left & right spherical pauldrons
    l.shadedEllipse(8, 13 + bob, 4, 5, '#93c5fd', '#2563eb', '#172554');
    l.shadedEllipse(21, 13 + bob, 4, 5, '#93c5fd', '#3b82f6', '#1e3a8a');
    // Stimpack LED indicator on shoulder
    l.set(7, 11 + bob, frame % 2 === 0 ? '#22c55e' : '#86efac');
    // Recessed domed helmet
    l.shadedEllipse(15, 9 + bob, 4, 4, '#93c5fd', '#2563eb', '#172554');
    // Golden-amber curved combat visor
    l.rect(14, 8 + bob, 5, 3, '#d97706');
    l.rect(15, 8 + bob, 4, 2, '#f59e0b');
    l.set(17, 8 + bob, '#fef08a');
  });

  // Layer 3: C-14 Impaler Gauss Rifle & Gauntlets
  buf.layer((l) => {
    // Rifle body held diagonally across chest
    l.line(10, 17 + bob, 26, 13 + bob, '#475569', 3);
    l.line(11, 16 + bob, 26, 12 + bob, '#94a3b8', 1);
    // Box magazine & barrel tip
    l.rect(18, 16 + bob, 3, 4, '#334155');
    l.rect(26, 12 + bob, 3, 2, '#cbd5e1');
    // Armored blue gauntlets gripping rifle
    l.rect(11, 16 + bob, 3, 3, '#3b82f6');
    l.rect(20, 14 + bob, 3, 3, '#60a5fa');
    if (frame % 2 === 1) {
      l.set(29, 12 + bob, '#fde047');
    }
  });
}

function drawTerranFirebat(buf: PixelBuffer, frame: number): void {
  const bob = frame % 2 === 1 ? -1 : 0;

  // Layer 1: Twin Volatile Fuel Tanks & Heavy Greaves
  buf.layer((l) => {
    // Twin red/orange fuel cylinders behind shoulders
    l.shadedBox(5, 5 + bob, 5, 12, '#f87171', '#dc2626', '#7f1d1d');
    l.shadedBox(11, 4 + bob, 5, 11, '#f87171', '#dc2626', '#7f1d1d');
    l.rect(6, 7 + bob, 3, 2, '#facc15');
    // Heavy legs
    l.shadedBox(9, 20, 5, 8, '#3b82f6', '#1d4ed8', '#172554');
    l.shadedBox(17, 20, 5, 8, '#3b82f6', '#1d4ed8', '#172554');
    l.rect(9, 21, 5, 2, '#dc2626');
    l.rect(17, 21, 5, 2, '#dc2626');
  });

  // Layer 2: CMC-660 Heavy Heat-Shielded Armor & Blast Helmet
  buf.layer((l) => {
    l.shadedBox(9, 11 + bob, 13, 10, '#60a5fa', '#1d4ed8', '#172554');
    // Massive crimson & blue heat-shielded pauldrons
    l.shadedEllipse(8, 13 + bob, 4, 5, '#f87171', '#dc2626', '#7f1d1d');
    l.shadedEllipse(22, 13 + bob, 4, 5, '#f87171', '#dc2626', '#7f1d1d');
    // Blast helmet with wide thermal gold visor & respirator
    l.shadedEllipse(15, 9 + bob, 5, 4, '#94a3b8', '#475569', '#1e293b');
    l.rect(14, 8 + bob, 6, 3, '#f97316');
    l.rect(15, 8 + bob, 4, 2, '#fde047');
  });

  // Layer 3: Dual Perdition Flamethrower Gauntlets & Pilot Flames
  buf.layer((l) => {
    l.shadedBox(15, 15 + bob, 10, 4, '#94a3b8', '#475569', '#1e293b');
    l.rect(14, 15 + bob, 4, 4, '#dc2626');
    l.rect(24, 15 + bob, 3, 3, '#cbd5e1');
    // Flickering pilot flame jet at nozzle
    l.rect(27, 14 + bob, 3, 4, '#f97316');
    l.rect(27, 15 + bob, 2, 2, '#fef08a');
    if (frame % 2 === 1) {
      l.set(30, 13 + bob, '#ef4444');
      l.set(30, 15 + bob, '#fde047');
    }
  });
}

function drawTerranMedic(buf: PixelBuffer, frame: number): void {
  const bob = frame % 2 === 1 ? -1 : 0;

  // Layer 1: Medical Power Pack & White/Blue Armored Boots
  buf.layer((l) => {
    l.shadedBox(8, 7 + bob, 9, 10, '#f8fafc', '#cbd5e1', '#64748b');
    l.shadedBox(10, 20, 4, 8, '#e2e8f0', '#94a3b8', '#475569');
    l.shadedBox(16, 20, 4, 8, '#e2e8f0', '#94a3b8', '#475569');
    l.rect(10, 26, 5, 2, '#2563eb');
    l.rect(16, 26, 5, 2, '#2563eb');
  });

  // Layer 2: White/Blue Medic Suit & Helmet
  buf.layer((l) => {
    l.shadedBox(10, 11 + bob, 10, 10, '#ffffff', '#e2e8f0', '#94a3b8');
    l.rect(12, 13 + bob, 6, 6, '#2563eb');
    // White pauldrons with red cross
    l.shadedEllipse(9, 13 + bob, 4, 4, '#ffffff', '#e2e8f0', '#94a3b8');
    l.set(9, 13 + bob, '#dc2626');
    l.set(9, 12 + bob, '#dc2626');
    l.set(9, 14 + bob, '#dc2626');
    l.set(8, 13 + bob, '#dc2626');
    l.set(10, 13 + bob, '#dc2626');
    // Helmet with cyan medical visor
    l.shadedEllipse(15, 9 + bob, 4, 4, '#ffffff', '#e2e8f0', '#94a3b8');
    l.rect(14, 8 + bob, 5, 2, '#38bdf8');
    l.set(17, 8 + bob, '#e0f2fe');
  });

  // Layer 3: Heavy Riot Tower Shield with Red Cross & Caduceus Emitter
  buf.layer((l) => {
    // Tower shield held in front
    l.shadedBox(18, 11 + bob, 8, 13, '#ffffff', '#e2e8f0', '#94a3b8');
    l.rect(19, 12 + bob, 6, 11, '#f8fafc');
    // Bold crimson cross emblem on shield
    l.rect(21, 14 + bob, 2, 7, '#dc2626');
    l.rect(19, 16 + bob, 6, 3, '#dc2626');
    // Healing emitter beacon above shield
    l.set(27, 13 + bob, '#22c55e');
    l.set(28, 13 + bob, frame % 2 === 0 ? '#86efac' : '#bbf7d0');
  });
}

function drawTerranSiegeTank(buf: PixelBuffer, frame: number): void {
  const recoil = frame % 2 === 1 ? -1 : 0;

  // Layer 1: Rear/Upper Caterpillar Tread & Outrigger Stabilizer
  buf.layer((l) => {
    l.shadedBox(6, 13, 34, 7, '#64748b', '#334155', '#1e293b');
    for (let tx = 8; tx <= 36; tx += 4) {
      l.rect(tx, 14, 2, 5, '#1e293b');
    }
  });

  // Layer 2: Heavy Armored Hull Chassis & Front Caterpillar Tread
  buf.layer((l) => {
    // Main armored hull
    l.shadedBox(8, 18, 30, 14, '#60a5fa', '#2563eb', '#1e3a8a');
    l.shadedBox(11, 20, 24, 9, '#94a3b8', '#475569', '#1e293b');
    // Hazard stripes on front bumper
    l.rect(35, 20, 3, 9, '#f59e0b');
    l.set(36, 22, '#1e293b');
    l.set(36, 25, '#1e293b');
    l.set(36, 28, '#1e293b');
    // Lower/Front Heavy Tread
    l.shadedBox(5, 30, 36, 9, '#94a3b8', '#475569', '#1e293b');
    for (let tx = 8; tx <= 36; tx += 5) {
      l.shadedBox(tx, 32, 3, 5, '#64748b', '#334155', '#0f172a');
    }
  });

  // Layer 3: Crucio/Arclite Turret & Twin 120mm Shock Cannons
  buf.layer((l) => {
    // Rotating turret base
    l.shadedEllipse(20, 21, 10, 7, '#93c5fd', '#2563eb', '#172554');
    l.shadedBox(14, 16, 13, 9, '#60a5fa', '#1d4ed8', '#1e3a8a');
    // Commander hatch & amber sensor optics
    l.rect(17, 18, 4, 3, '#f59e0b');
    l.set(19, 18, '#fef08a');
    // Twin heavy cannon barrels extending right
    l.shadedBox(27 + recoil, 17, 17, 3, '#e2e8f0', '#94a3b8', '#475569');
    l.shadedBox(27 + recoil, 21, 17, 3, '#cbd5e1', '#64748b', '#334155');
    // Muzzle brakes
    l.rect(42 + recoil, 16, 3, 8, '#475569');
    l.rect(43 + recoil, 17, 2, 2, '#f59e0b');
  });
}

function drawTerranBattlecruiser(buf: PixelBuffer, frame: number): void {
  const hover = frame % 2 === 1 ? -1 : 0;

  // Layer 1: Engine Thruster Plumes & Swept Broad Wings
  buf.layer((l) => {
    // Swept mid-ship wings (top and bottom fins)
    l.poly(
      [
        [14, 32 + hover],
        [28, 12 + hover],
        [38, 14 + hover],
        [36, 50 + hover],
        [26, 52 + hover],
      ],
      '#1e3a8a'
    );
    l.poly(
      [
        [16, 32 + hover],
        [28, 15 + hover],
        [36, 16 + hover],
        [34, 48 + hover],
        [27, 49 + hover],
      ],
      '#2563eb'
    );
    // Wing weapon pods & blue panels
    l.shadedBox(26, 15 + hover, 9, 6, '#93c5fd', '#3b82f6', '#1d4ed8');
    l.shadedBox(26, 43 + hover, 9, 6, '#93c5fd', '#3b82f6', '#1d4ed8');
    // Rear plasma engine bank
    l.shadedBox(6, 23 + hover, 6, 18, '#64748b', '#334155', '#0f172a');
    const glow = frame % 2 === 0 ? '#38bdf8' : '#7dd3fc';
    l.rect(3, 25 + hover, 3, 4, glow);
    l.rect(3, 30 + hover, 4, 4, '#e0f2fe');
    l.rect(3, 35 + hover, 3, 4, glow);
  });

  // Layer 2: Central Spinal Fuselage & Narrow Neck
  buf.layer((l) => {
    // Main heavy fuselage
    l.shadedBox(10, 22 + hover, 29, 20, '#94a3b8', '#475569', '#1e293b');
    l.shadedBox(12, 25 + hover, 26, 14, '#60a5fa', '#2563eb', '#172554');
    // Narrow armored neck connecting to Hammerhead bow
    l.shadedBox(38, 27 + hover, 9, 10, '#94a3b8', '#475569', '#1e293b');
    // Hull trench lines
    l.line(14, 32 + hover, 45, 32 + hover, '#1e293b', 2);
  });

  // Layer 3: Iconic Hammerhead Fore-Section, Yamato Core & Command Bridge Tower
  buf.layer((l) => {
    // Elevated Dorsal Command Bridge Tower at stern
    l.shadedBox(14, 18 + hover, 10, 8, '#cbd5e1', '#64748b', '#334155');
    l.rect(20, 20 + hover, 3, 4, '#fde047');
    // Massive Hammerhead Bow at the front
    l.shadedBox(45, 16 + hover, 12, 32, '#93c5fd', '#2563eb', '#172554');
    l.shadedBox(47, 19 + hover, 8, 26, '#cbd5e1', '#475569', '#1e293b');
    // Yamato Cannon charging core in the nose
    l.shadedBox(55, 27 + hover, 5, 10, '#fb923c', '#ea580c', '#9a3412');
    l.rect(57, 29 + hover, 3, 6, '#fde047');
    if (frame % 2 === 1) {
      l.rect(59, 30 + hover, 2, 4, '#ffffff');
    }
  });
}

// ============================================================================
// ZERG PIXEL SPRITES (6 Units)
// ============================================================================

function drawZergDrone(buf: PixelBuffer, frame: number): void {
  const flap = frame % 2 === 1 ? -2 : 0;

  // Layer 1: Buzzing Lateral Wing Membranes & Ventral Tendrils
  buf.layer((l) => {
    l.poly(
      [
        [12, 13],
        [7, 5 + flap],
        [18, 6 + flap],
        [17, 13],
      ],
      '#d8b4fe'
    );
    l.line(9, 7 + flap, 16, 8 + flap, '#f3e8ff');
    // Lower fleshy tendrils
    l.line(10, 22, 8, 26, '#9f1239', 2);
    l.line(15, 22, 14, 27, '#9f1239', 2);
  });

  // Layer 2: Ribbed Chitin Carapace & Fleshy Abdomen
  buf.layer((l) => {
    l.shadedEllipse(14, 16, 8, 6, '#fb7185', '#9f1239', '#4c0519');
    l.shadedEllipse(14, 15, 7, 5, '#c084fc', '#7e22ce', '#3b0764');
    // Segmented carapace ribs
    l.line(10, 12, 10, 19, '#581c87');
    l.line(13, 11, 13, 19, '#581c87');
    l.line(16, 11, 16, 19, '#581c87');
  });

  // Layer 3: Head, Glowing Bio-Eyes & Curved Ivory Harvesting Mandibles
  buf.layer((l) => {
    l.shadedEllipse(21, 17, 4, 4, '#a855f7', '#6b21a8', '#3b0764');
    // Glowing acid-green eyes
    l.rect(22, 15, 2, 2, '#bef264');
    // Upper and lower curved bone harvesting pincers
    l.line(24, 14, 29, 12, '#f5f5f4', 2);
    l.line(24, 19, 29, 20, '#d6d3d1', 2);
    l.set(29, 13, '#ffffff');
  });
}

function drawZergZergling(buf: PixelBuffer, frame: number): void {
  const stride = frame % 2 === 1 ? 1 : 0;

  // Layer 1: Spiked Tail & Muscular Hind Legs
  buf.layer((l) => {
    // Tail whipping back
    l.line(6, 13, 2, 9 - stride, '#7e22ce', 2);
    l.set(2, 8 - stride, '#f5f5f4');
    // Hind legs & forelimbs
    l.line(8, 16, 6 - stride, 21, '#9f1239', 2);
    l.line(15, 16, 17 + stride, 21, '#9f1239', 2);
    l.set(7 - stride, 21, '#f5f5f4');
    l.set(18 + stride, 21, '#f5f5f4');
  });

  // Layer 2: Arched Segmented Raptor Body & Horned Head
  buf.layer((l) => {
    l.shadedEllipse(11, 14, 6, 4, '#c084fc', '#7e22ce', '#3b0764');
    l.shadedEllipse(17, 13, 4, 3, '#a855f7', '#6b21a8', '#3b0764');
    // Glowing orange-green eye & open fangs
    l.set(19, 12, '#bef264');
    l.set(20, 14, '#f5f5f4');
    l.set(21, 13, '#f5f5f4');
  });

  // Layer 3: Dorsal Adrenal Scythe-Claws
  buf.layer((l) => {
    l.line(13, 10, 20, 6 + stride, '#f5f5f4', 2);
    l.line(20, 6 + stride, 22, 10 + stride, '#ffffff', 1);
  });
}

function drawZergHydralisk(buf: PixelBuffer, frame: number): void {
  const sway = frame % 2 === 1 ? -1 : 0;

  // Layer 1: Coiled Serpentine Tail Base
  buf.layer((l) => {
    l.shadedEllipse(13, 25, 8, 3, '#a855f7', '#6b21a8', '#3b0764');
    l.line(6, 26, 11, 21, '#7e22ce', 3);
    l.line(13, 24, 15, 15, '#9f1239', 5);
  });

  // Layer 2: Ribbed Torso & Flared 3-Pronged Armored Hood Crest
  buf.layer((l) => {
    // Ribbed torso
    l.shadedBox(12, 13 + sway, 7, 10, '#fb7185', '#9f1239', '#4c0519');
    l.line(13, 15 + sway, 18, 15 + sway, '#fecdd3');
    l.line(13, 18 + sway, 18, 18 + sway, '#fecdd3');
    // Wide flared Hydralisk head crest
    l.poly(
      [
        [9, 5 + sway],
        [21, 4 + sway],
        [24, 11 + sway],
        [12, 13 + sway],
      ],
      '#7e22ce'
    );
    l.poly(
      [
        [11, 6 + sway],
        [20, 6 + sway],
        [22, 10 + sway],
        [13, 11 + sway],
      ],
      '#a855f7'
    );
    // Crest spikes, glowing acid eyes & roaring jaws
    l.line(9, 5 + sway, 6, 3 + sway, '#d6d3d1', 2);
    l.line(11, 8 + sway, 7, 7 + sway, '#d6d3d1', 2);
    l.rect(20, 8 + sway, 2, 2, '#bef264');
    l.set(23, 11 + sway, '#f5f5f4');
  });

  // Layer 3: Dual Ivory Scythe-Blade Arms
  buf.layer((l) => {
    l.line(18, 14 + sway, 25, 11 + sway, '#7e22ce', 2);
    // Massive curving bone scythes
    l.poly(
      [
        [24, 10 + sway],
        [29, 13 + sway],
        [26, 21 + sway],
        [24, 15 + sway],
      ],
      '#f5f5f4'
    );
    l.line(25, 11 + sway, 28, 14 + sway, '#ffffff');
  });
}

function drawZergLurker(buf: PixelBuffer, frame: number): void {
  const pulse = frame % 2 === 1 ? 1 : 0;

  // Layer 1: Six Jointed Arachnid Burrowing Legs
  buf.layer((l) => {
    const legCoords: ReadonlyArray<readonly [number, number, number, number]> = [
      [14, 24, 6, 36],
      [22, 25, 17, 39],
      [30, 25, 29, 39],
      [34, 23, 42, 35],
    ];
    for (let i = 0; i < legCoords.length; i++) {
      const [x0, y0, x1, y1] = legCoords[i];
      l.line(x0, y0, (x0 + x1) / 2, y0 - 5, '#7e22ce', 2);
      l.line((x0 + x1) / 2, y0 - 5, x1, y1, '#9f1239', 2);
      l.line(x1, y1, x1 + 1, y1 + 3, '#f5f5f4', 2);
    }
  });

  // Layer 2: Wide Spiky Carapace & Subterranean Spine Nodes
  buf.layer((l) => {
    l.shadedEllipse(23, 22, 13, 7, '#c084fc', '#7e22ce', '#3b0764');
    l.shadedEllipse(23, 24, 11, 5, '#fb7185', '#9f1239', '#4c0519');
    // Dorsal bone spines erupting along the back
    const spineXs = [14, 19, 24, 29];
    for (let i = 0; i < spineXs.length; i++) {
      const sx = spineXs[i];
      l.poly(
        [
          [sx - 2, 18],
          [sx, 10 - pulse],
          [sx + 2, 18],
        ],
        '#f5f5f4'
      );
    }
  });

  // Layer 3: Armored Arachnid Head, Glowing Orange Eyes & Mandibles
  buf.layer((l) => {
    l.shadedEllipse(34, 23, 5, 4, '#a855f7', '#581c87', '#3b0764');
    l.set(36, 21, '#f97316');
    l.set(38, 22, '#fde047');
    l.line(38, 24, 43, 22, '#f5f5f4', 2);
    l.line(38, 26, 43, 27, '#d6d3d1', 2);
  });
}

function drawZergMutalisk(buf: PixelBuffer, frame: number): void {
  const wingOffset = frame % 2 === 1 ? 3 : -2;

  // Layer 1: Rear Wing & Segmented Coiled Glave-Wurm Tail Sac
  buf.layer((l) => {
    // Far wing
    l.poly(
      [
        [20, 20],
        [10, 6 + wingOffset],
        [25, 9 + wingOffset],
        [25, 20],
      ],
      '#6b21a8'
    );
    // Curving segmented tail ending in glowing acid-green glave sac
    l.line(19, 23, 14, 31, '#9f1239', 4);
    l.line(14, 31, 18, 38, '#be123c', 4);
    l.shadedEllipse(20, 39, 3, 3, '#bef264', '#84cc16', '#3f6212');
  });

  // Layer 2: Large Leathery Bat-Like Front Wing & Ribbed Membrane
  buf.layer((l) => {
    l.poly(
      [
        [22, 22],
        [13, 7 - wingOffset],
        [33, 8 - wingOffset],
        [29, 21],
      ],
      '#a855f7'
    );
    l.poly(
      [
        [22, 21],
        [16, 10 - wingOffset],
        [30, 10 - wingOffset],
        [27, 20],
      ],
      '#e879f9'
    );
    // Wing bone struts & claw tip
    l.line(22, 21, 14, 7 - wingOffset, '#d6d3d1', 2);
    l.line(22, 20, 32, 8 - wingOffset, '#d6d3d1', 1);
    l.set(13, 6 - wingOffset, '#ffffff');
  });

  // Layer 3: Horned Flyer Head & Glowing Acid Jaws
  buf.layer((l) => {
    l.shadedEllipse(27, 22, 6, 4, '#c084fc', '#7e22ce', '#3b0764');
    l.rect(30, 20, 2, 2, '#bef264');
    l.line(32, 22, 37, 21, '#f5f5f4', 2);
    l.line(32, 24, 36, 25, '#84cc16', 2);
  });
}

function drawZergUltralisk(buf: PixelBuffer, frame: number): void {
  const stomp = frame % 2 === 1 ? -1 : 0;

  // Layer 1: Four Colossal Armored Legs & Dorsal Bone Ridges
  buf.layer((l) => {
    // Rear & front massive pillar legs
    l.shadedBox(12, 36, 9, 18, '#a855f7', '#581c87', '#3b0764');
    l.shadedBox(23, 38 + stomp, 8, 17, '#c084fc', '#6b21a8', '#3b0764');
    l.shadedBox(34, 36, 9, 18, '#c084fc', '#7e22ce', '#3b0764');
    // Ivory hoof claws
    l.rect(12, 52, 10, 3, '#f5f5f4');
    l.rect(23, 53 + stomp, 9, 3, '#d6d3d1');
    l.rect(34, 52, 10, 3, '#f5f5f4');
  });

  // Layer 2: Towering Hunched Carapace & Armored Behemoth Head
  buf.layer((l) => {
    // Giant hunched dorsal shell
    l.shadedEllipse(25, 28 + stomp, 16, 12, '#c084fc', '#6b21a8', '#3b0764');
    l.shadedEllipse(26, 32 + stomp, 14, 8, '#fb7185', '#881337', '#4c0519');
    // Heavy armor segments & dorsal spikes
    for (let sx = 14; sx <= 32; sx += 6) {
      l.line(sx, 17 + stomp, sx - 2, 33 + stomp, '#3b0764', 2);
      l.poly(
        [
          [sx - 2, 18 + stomp],
          [sx, 11 + stomp],
          [sx + 3, 18 + stomp],
        ],
        '#d6d3d1'
      );
    }
    // Brutal armored head
    l.shadedEllipse(40, 29 + stomp, 7, 6, '#a855f7', '#581c87', '#3b0764');
    l.rect(42, 27 + stomp, 3, 2, '#f97316');
    l.set(43, 27 + stomp, '#fef08a');
  });

  // Layer 3: Twin Massive Crescent Ivory Kaiser Blades
  buf.layer((l) => {
    // Upper sweeping Kaiser Blade
    l.poly(
      [
        [35, 22 + stomp],
        [52, 10 + stomp],
        [59, 17 + stomp],
        [52, 26 + stomp],
        [46, 22 + stomp],
      ],
      '#f5f5f4'
    );
    l.line(37, 21 + stomp, 56, 15 + stomp, '#ffffff', 2);
    // Lower sweeping Kaiser Blade
    l.poly(
      [
        [37, 32 + stomp],
        [55, 29 + stomp],
        [60, 38 + stomp],
        [50, 42 + stomp],
        [46, 35 + stomp],
      ],
      '#e7e5e4'
    );
    l.line(39, 33 + stomp, 57, 36 + stomp, '#ffffff', 2);
  });
}

// ============================================================================
// PROTOSS PIXEL SPRITES (6 Units)
// ============================================================================

function drawProtossProbe(buf: PixelBuffer, frame: number): void {
  const hover = frame % 2 === 1 ? -1 : 0;

  // Layer 1: Floating Lower Warp Prong & Plasma Harvesting Beacon
  buf.layer((l) => {
    l.poly(
      [
        [13, 20 + hover],
        [19, 20 + hover],
        [16, 27 + hover],
      ],
      '#ca8a04'
    );
    l.rect(15, 25 + hover, 2, 2, '#38bdf8');
    if (frame % 2 === 1) {
      l.set(16, 28 + hover, '#e0f2fe');
    }
  });

  // Layer 2: Golden Gyro-Sphere Body & Curved Side Wing Vanes
  buf.layer((l) => {
    // Wing vanes
    l.poly(
      [
        [6, 11 + hover],
        [13, 9 + hover],
        [11, 20 + hover],
      ],
      '#eab308'
    );
    // Central golden pyramid/sphere hull
    l.shadedEllipse(16, 15 + hover, 6, 6, '#fef08a', '#eab308', '#a16207');
  });

  // Layer 3: Glowing Cyan Psionic Optic Core
  buf.layer((l) => {
    l.shadedEllipse(19, 15 + hover, 3, 3, '#e0f2fe', '#38bdf8', '#0284c7');
    l.set(20, 14 + hover, '#ffffff');
  });
}

function drawProtossZealot(buf: PixelBuffer, frame: number): void {
  const bob = frame % 2 === 1 ? -1 : 0;

  // Layer 1: Khalai Nerve-Cord Ponytail & Golden Greaves
  buf.layer((l) => {
    // Flowing blue/gold nerve cords behind head
    l.line(12, 8 + bob, 6, 12 + bob, '#0284c7', 2);
    l.set(6, 12 + bob, '#facc15');
    // Golden armored legs
    l.shadedBox(10, 20, 4, 8, '#facc15', '#ca8a04', '#713f12');
    l.shadedBox(17, 20, 4, 8, '#facc15', '#ca8a04', '#713f12');
  });

  // Layer 2: Ornate Golden Power Armor, High Collar & Khaydarin Chest Crystal
  buf.layer((l) => {
    // Torso & high collar
    l.shadedBox(10, 11 + bob, 11, 9, '#fef08a', '#eab308', '#a16207');
    // Swept golden shoulder pauldrons
    l.poly(
      [
        [5, 10 + bob],
        [12, 11 + bob],
        [10, 16 + bob],
      ],
      '#facc15'
    );
    l.poly(
      [
        [19, 11 + bob],
        [25, 10 + bob],
        [22, 16 + bob],
      ],
      '#fef08a'
    );
    // Glowing blue chest crystal
    l.rect(15, 14 + bob, 3, 3, '#38bdf8');
    l.set(16, 14 + bob, '#e0f2fe');
    // Protoss head with glowing cyan eyes
    l.shadedEllipse(16, 8 + bob, 3, 3, '#94a3b8', '#475569', '#1e293b');
    l.rect(16, 8 + bob, 3, 2, '#38bdf8');
    l.set(18, 8 + bob, '#ffffff');
  });

  // Layer 3: Dual Blazing Cyan-White Psi-Blades
  buf.layer((l) => {
    // Left/rear psi-blade
    l.line(8, 17 + bob, 3, 21 + bob, '#38bdf8', 2);
    l.line(8, 17 + bob, 4, 20 + bob, '#e0f2fe', 1);
    // Right/front extended psi-blade
    l.rect(20, 15 + bob, 3, 3, '#eab308');
    l.line(23, 16 + bob, 30, 13 + bob, '#38bdf8', 3);
    l.line(23, 16 + bob, 30, 13 + bob, '#e0f2fe', 1);
  });
}

function drawProtossDragoon(buf: PixelBuffer, frame: number): void {
  const step = frame % 2 === 1 ? -1 : 0;

  // Layer 1: Rear Mechanical Walker Legs
  buf.layer((l) => {
    // Upper-left & upper-right articulated legs
    l.line(18, 20, 9, 11 - step, '#ca8a04', 3);
    l.line(9, 11 - step, 6, 22 - step, '#475569', 2);
    l.line(30, 20, 39, 11 + step, '#eab308', 3);
    l.line(39, 11 + step, 42, 22 + step, '#475569', 2);
    l.set(9, 11 - step, '#38bdf8');
    l.set(39, 11 + step, '#38bdf8');
  });

  // Layer 2: Golden Hexagonal Armored Walker Hull & Phase Disruptor Core
  buf.layer((l) => {
    l.shadedEllipse(24, 23 + step, 11, 7, '#fef08a', '#eab308', '#854d0e');
    l.shadedEllipse(24, 21 + step, 6, 4, '#7dd3fc', '#0284c7', '#0c4a6e');
    l.rect(23, 19 + step, 3, 2, '#e0f2fe');
    // Front sensor array
    l.rect(32, 22 + step, 3, 3, '#38bdf8');
  });

  // Layer 3: Front Articulated Walker Legs with Cyan Knee Nodes
  buf.layer((l) => {
    // Front-left leg
    l.line(17, 26, 10, 31 + step, '#facc15', 3);
    l.line(10, 31 + step, 8, 41, '#eab308', 3);
    l.rect(9, 30 + step, 3, 3, '#38bdf8');
    // Front-right leg
    l.line(31, 26, 38, 31 - step, '#fef08a', 3);
    l.line(38, 31 - step, 40, 41, '#eab308', 3);
    l.rect(37, 30 - step, 3, 3, '#38bdf8');
  });
}

function drawProtossHighTemplar(buf: PixelBuffer, frame: number): void {
  const floatY = frame % 2 === 1 ? -1 : 0;

  // Layer 1: Translucent Psionic Aura & Floating Royal Mantle
  buf.layer((l) => {
    l.poly(
      [
        [8, 27],
        [11, 13 + floatY],
        [21, 13 + floatY],
        [24, 27],
      ],
      '#1d4ed8'
    );
    l.poly(
      [
        [10, 26],
        [12, 15 + floatY],
        [20, 15 + floatY],
        [22, 26],
      ],
      '#2563eb'
    );
    // Golden hem trim
    l.line(9, 26, 23, 26, '#facc15', 2);
  });

  // Layer 2: High Golden Collar, Khaydarin Amulet & Psionic Head
  buf.layer((l) => {
    // Tall ornate golden collar & pauldrons
    l.poly(
      [
        [6, 8 + floatY],
        [26, 8 + floatY],
        [23, 16 + floatY],
        [9, 16 + floatY],
      ],
      '#eab308'
    );
    l.rect(10, 10 + floatY, 12, 6, '#facc15');
    // Glowing chest crystal
    l.rect(15, 13 + floatY, 3, 3, '#38bdf8');
    l.set(16, 14 + floatY, '#ffffff');
    // Head with blazing white-cyan psionic eyes
    l.shadedEllipse(16, 8 + floatY, 3, 3, '#cbd5e1', '#64748b', '#1e293b');
    l.rect(15, 7 + floatY, 4, 2, '#e0f2fe');
  });

  // Layer 3: Crackling Psionic Storm Lightning Hands
  buf.layer((l) => {
    const sparkY = frame % 2 === 0 ? 11 : 9;
    l.shadedEllipse(26, 13 + floatY, 3, 3, '#ffffff', '#38bdf8', '#0284c7');
    l.line(26, 13 + floatY, 29, sparkY, '#e0f2fe', 1);
    l.line(26, 13 + floatY, 29, 17, '#7dd3fc', 1);
  });
}

function drawProtossReaver(buf: PixelBuffer, frame: number): void {
  const pulse = frame % 2 === 1 ? 1 : 0;

  // Layer 1: Lower Segmented Caterpillar Under-Chassis
  buf.layer((l) => {
    l.shadedBox(8, 28, 32, 9, '#64748b', '#334155', '#0f172a');
    for (let x = 10; x <= 36; x += 5) {
      l.rect(x, 31, 3, 5, '#ca8a04');
    }
  });

  // Layer 2: Arched Multi-Segmented Golden Trilobite Carapace
  buf.layer((l) => {
    // Rear tail segment
    l.shadedEllipse(13, 25, 6, 7, '#eab308', '#ca8a04', '#713f12');
    // Mid-rear segment
    l.shadedEllipse(20, 23, 7, 9, '#facc15', '#eab308', '#854d0e');
    // Mid-front segment
    l.shadedEllipse(27, 21, 8, 10, '#fef08a', '#eab308', '#a16207');
    // Cyan psionic vents between segments
    l.line(16, 17, 16, 28, '#38bdf8');
    l.line(23, 15, 23, 29, '#38bdf8');
  });

  // Layer 3: Armored Fore-Section & Glowing Scarab Launch Aperture
  buf.layer((l) => {
    l.shadedEllipse(34, 22, 7, 10, '#fef08a', '#facc15', '#a16207');
    // Glowing blue Scarab bay at the front
    l.shadedBox(36, 19, 5, 8, '#7dd3fc', '#0284c7', '#0c4a6e');
    l.rect(38, 21, 3, 4, pulse ? '#ffffff' : '#e0f2fe');
  });
}

function drawProtossCarrier(buf: PixelBuffer, frame: number): void {
  const hover = frame % 2 === 1 ? -1 : 0;

  // Layer 1: Stern Gravitic Thrusters & Orbiting Mini Interceptors
  buf.layer((l) => {
    // Cyan engine exhaust at stern
    l.shadedBox(5, 26 + hover, 6, 12, '#38bdf8', '#0284c7', '#0c4a6e');
    l.rect(3, 28 + hover, 3, 8, frame % 2 === 0 ? '#7dd3fc' : '#e0f2fe');
    // Two orbiting pixel Interceptors above & below bow
    const ix = frame % 2 === 0 ? 50 : 52;
    l.rect(ix, 11 + hover, 5, 3, '#facc15');
    l.set(ix + 4, 12 + hover, '#38bdf8');
    l.rect(ix - 4, 49 + hover, 5, 3, '#facc15');
    l.set(ix, 50 + hover, '#38bdf8');
  });

  // Layer 2: Sculpted Golden Flagship Hull & Twin Forward Prongs
  buf.layer((l) => {
    // Upper & lower curved forward hull prongs framing the launch bay
    l.poly(
      [
        [14, 23 + hover],
        [36, 17 + hover],
        [57, 22 + hover],
        [52, 28 + hover],
        [14, 29 + hover],
      ],
      '#eab308'
    );
    l.poly(
      [
        [14, 35 + hover],
        [52, 36 + hover],
        [57, 42 + hover],
        [36, 47 + hover],
        [14, 41 + hover],
      ],
      '#ca8a04'
    );
    // Glowing cyan central gravitic launch bay trench
    l.rect(24, 29 + hover, 29, 6, '#0284c7');
    l.line(26, 32 + hover, 52, 32 + hover, '#7dd3fc', 2);
  });

  // Layer 3: Ornate Dorsal Golden Armor Plates & Khaydarin Crystal Cores
  buf.layer((l) => {
    l.shadedEllipse(27, 32 + hover, 13, 10, '#fef08a', '#facc15', '#a16207');
    l.shadedEllipse(40, 32 + hover, 8, 7, '#fef08a', '#eab308', '#854d0e');
    // Glowing blue Khaydarin crystal domes along spine
    l.shadedEllipse(24, 32 + hover, 4, 4, '#e0f2fe', '#38bdf8', '#0284c7');
    l.shadedEllipse(37, 32 + hover, 3, 3, '#e0f2fe', '#38bdf8', '#0284c7');
    l.set(25, 31 + hover, '#ffffff');
    l.set(38, 31 + hover, '#ffffff');
  });
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
    // Fallback for any newly added custom unit before custom pixel art is registered
    const pad = Math.max(3, Math.floor(size * 0.15));
    buf.layer((l) => {
      l.shadedBox(
        pad,
        pad,
        size - pad * 2,
        size - pad * 2,
        '#93c5fd',
        '#2563eb',
        '#1e3a8a'
      );
    });
  }

  return facing === -1 ? buf.flipHorizontal() : buf;
}
