/** 키보드 + 가상 조이스틱 입력을 하나의 이동 벡터로 합친다. */
class SurvivorInputImpl {
  private readonly keys = new Set<string>();
  private joyX = 0;
  private joyY = 0;
  private attached = false;
  private onPauseKey: (() => void) | null = null;

  public attach(onPauseKey: () => void): void {
    this.onPauseKey = onPauseKey;
    if (this.attached) {
      return;
    }
    this.attached = true;
    window.addEventListener('keydown', this.handleDown);
    window.addEventListener('keyup', this.handleUp);
    window.addEventListener('blur', this.handleBlur);
  }

  public detach(): void {
    if (!this.attached) {
      return;
    }
    this.attached = false;
    window.removeEventListener('keydown', this.handleDown);
    window.removeEventListener('keyup', this.handleUp);
    window.removeEventListener('blur', this.handleBlur);
    this.keys.clear();
    this.onPauseKey = null;
  }

  public setJoystick(x: number, y: number): void {
    this.joyX = x;
    this.joyY = y;
  }

  public getMove(): { x: number; y: number } {
    let x = this.joyX;
    let y = this.joyY;
    if (this.keys.has('left')) x -= 1;
    if (this.keys.has('right')) x += 1;
    if (this.keys.has('up')) y -= 1;
    if (this.keys.has('down')) y += 1;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  private mapKey(code: string): string | null {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        return 'up';
      case 'KeyS':
      case 'ArrowDown':
        return 'down';
      case 'KeyA':
      case 'ArrowLeft':
        return 'left';
      case 'KeyD':
      case 'ArrowRight':
        return 'right';
      default:
        return null;
    }
  }

  private readonly handleDown = (e: KeyboardEvent): void => {
    if (e.code === 'Space' || e.code === 'KeyP' || e.code === 'Escape') {
      if (!e.repeat) {
        this.onPauseKey?.();
      }
      e.preventDefault();
      return;
    }
    const k = this.mapKey(e.code);
    if (k) {
      this.keys.add(k);
      e.preventDefault();
    }
  };

  private readonly handleUp = (e: KeyboardEvent): void => {
    const k = this.mapKey(e.code);
    if (k) {
      this.keys.delete(k);
    }
  };

  private readonly handleBlur = (): void => {
    this.keys.clear();
  };
}

export const SurvivorInput = new SurvivorInputImpl();
