import type { FormationRole, Vec2 } from './types';

/** 링 간 간격(px). 1링 반지름 = RING_SPACING */
export const RING_SPACING = 20;
export const MAX_RINGS = 3;

/** k번째 링(1부터)의 슬롯 수: 6k */
export function slotsInRing(ring: number): number {
  return ring * 6;
}

export function capacityForRings(rings: number): number {
  let total = 0;
  for (let r = 1; r <= rings; r += 1) {
    total += slotsInRing(r);
  }
  return total;
}

/**
 * 개방된 링 수에 대한 슬롯 오프셋 목록 (안쪽 링부터).
 * 링마다 반 칸씩 회전시켜 인접 링 슬롯이 겹치지 않게 한다.
 */
export function buildSlotOffsets(rings: number): Vec2[] {
  const out: Vec2[] = [];
  for (let r = 1; r <= rings; r += 1) {
    const n = slotsInRing(r);
    const radius = r * RING_SPACING;
    const phase = (r % 2 === 0 ? 0.5 : 0) * ((Math.PI * 2) / n) - Math.PI / 2;
    for (let i = 0; i < n; i += 1) {
      const a = phase + (i / n) * Math.PI * 2;
      out.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
    }
  }
  return out;
}

/**
 * 인원 수 n에 맞는 "사용 슬롯" 목록 (안쪽 → 바깥쪽 순).
 * 안쪽 링부터 꽉 채우고, 마지막으로 걸치는 링은 균등 간격으로 띄워 배치해 대형이 한쪽으로 쏠리지 않게 한다.
 */
export function pickActiveSlots(n: number, rings: number): number[] {
  const out: number[] = [];
  let base = 0;
  let remaining = Math.min(n, capacityForRings(rings));
  for (let r = 1; r <= rings && remaining > 0; r += 1) {
    const size = slotsInRing(r);
    const take = Math.min(size, remaining);
    for (let j = 0; j < take; j += 1) {
      out.push(base + Math.floor((j * size) / take));
    }
    remaining -= take;
    base += size;
  }
  return out;
}

/**
 * 부대원에게 슬롯을 배정한다.
 * BACK(원거리·지원) → 안쪽 슬롯, FRONT(근접·탱커) → 바깥쪽 슬롯.
 * 반환값: 입력 순서대로의 슬롯 인덱스 (정원 초과분은 -1).
 */
export function assignSlots(roles: readonly FormationRole[], rings: number): number[] {
  const active = pickActiveSlots(roles.length, rings);
  const result = new Array<number>(roles.length).fill(-1);
  let inner = 0;
  let outer = active.length - 1;
  for (let i = 0; i < roles.length; i += 1) {
    if (roles[i] === 'BACK' && inner <= outer) {
      result[i] = active[inner];
      inner += 1;
    }
  }
  for (let i = 0; i < roles.length; i += 1) {
    if (roles[i] === 'FRONT' && inner <= outer) {
      result[i] = active[outer];
      outer -= 1;
    }
  }
  return result;
}
