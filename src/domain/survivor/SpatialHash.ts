/**
 * 무한 평면용 균일 격자 공간 해시.
 * 매 틱 clear() → insert() 후 query()로 반경 내 후보 인덱스를 얻는다.
 * 버킷 배열은 재사용하여 틱마다 GC 부담을 줄인다.
 */
export class SpatialHash {
  private readonly buckets = new Map<number, number[]>();
  private readonly used: number[][] = [];
  private readonly inv: number;

  constructor(public readonly cellSize: number) {
    this.inv = 1 / cellSize;
  }

  private key(cx: number, cy: number): number {
    // 셀 좌표를 ±32767 범위의 정수 쌍으로 묶는다.
    return ((cx + 32768) & 0xffff) * 65536 + ((cy + 32768) & 0xffff);
  }

  public clear(): void {
    for (let i = 0; i < this.used.length; i += 1) {
      this.used[i].length = 0;
    }
    this.used.length = 0;
  }

  public insert(index: number, x: number, y: number): void {
    const k = this.key(Math.floor(x * this.inv), Math.floor(y * this.inv));
    let b = this.buckets.get(k);
    if (!b) {
      b = [];
      this.buckets.set(k, b);
    }
    if (b.length === 0) {
      this.used.push(b);
    }
    b.push(index);
  }

  /** (x, y) 반경 r 안에 걸치는 셀들의 인덱스를 out에 담는다 (정확한 거리 검사는 호출자 몫). */
  public query(x: number, y: number, r: number, out: number[]): number[] {
    out.length = 0;
    const minX = Math.floor((x - r) * this.inv);
    const maxX = Math.floor((x + r) * this.inv);
    const minY = Math.floor((y - r) * this.inv);
    const maxY = Math.floor((y + r) * this.inv);
    for (let cx = minX; cx <= maxX; cx += 1) {
      for (let cy = minY; cy <= maxY; cy += 1) {
        const b = this.buckets.get(this.key(cx, cy));
        if (b && b.length > 0) {
          for (let i = 0; i < b.length; i += 1) {
            out.push(b[i]);
          }
        }
      }
    }
    return out;
  }
}
