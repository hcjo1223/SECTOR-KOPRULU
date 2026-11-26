import type { Race } from '../domain/types';

export class SoundManager {
  private static ctx: AudioContext | null = null;
  private static muted = false;

  public static isMuted(): boolean {
    return this.muted;
  }

  public static setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public static toggleMute(): boolean {
    this.muted = !this.muted;
    if (!this.muted) {
      this.playClick();
    }
    return this.muted;
  }

  private static getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') {
      return null;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private static playTone(
    freqStart: number,
    freqEnd: number,
    durationSec: number,
    type: OscillatorType = 'square',
    gainPeak: number = 0.06,
    delaySec: number = 0
  ): void {
    const ctx = this.getContext();
    if (!ctx) {
      return;
    }

    try {
      const now = ctx.currentTime + delaySec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, now);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, freqEnd),
        now + durationSec
      );

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(gainPeak, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + durationSec + 0.02);
    } catch {
      // Ignore audio errors in restricted headless contexts
    }
  }

  public static playClick(): void {
    this.playTone(540, 720, 0.045, 'square', 0.04);
  }

  public static playDeploy(): void {
    this.playTone(320, 640, 0.07, 'triangle', 0.05);
    this.playTone(640, 960, 0.06, 'square', 0.035, 0.05);
  }

  public static playEvolution(): void {
    this.playTone(180, 360, 0.12, 'sawtooth', 0.06);
    this.playTone(360, 720, 0.14, 'triangle', 0.06, 0.09);
  }

  public static playWarpIn(): void {
    this.playTone(440, 880, 0.1, 'sine', 0.06);
    this.playTone(880, 1320, 0.14, 'triangle', 0.05, 0.07);
  }

  public static playBattleStart(): void {
    this.playTone(220, 330, 0.11, 'sawtooth', 0.06);
    this.playTone(330, 440, 0.14, 'sawtooth', 0.07, 0.11);
  }

  public static playCommanderSkill(race: Race): void {
    if (race === 'TERRAN') {
      // Nuclear siren + low boom
      this.playTone(680, 920, 0.15, 'sawtooth', 0.07);
      this.playTone(140, 40, 0.3, 'sawtooth', 0.09, 0.14);
    } else if (race === 'ZERG') {
      this.playTone(160, 290, 0.22, 'sawtooth', 0.07);
    } else {
      // Psionic thunder
      this.playTone(960, 240, 0.25, 'square', 0.07);
    }
  }

  public static playVictory(): void {
    this.playTone(523.25, 523.25, 0.1, 'square', 0.05, 0);
    this.playTone(659.25, 659.25, 0.1, 'square', 0.05, 0.1);
    this.playTone(783.99, 1046.5, 0.22, 'square', 0.06, 0.2);
  }

  public static playDefeat(): void {
    this.playTone(330, 260, 0.15, 'sawtooth', 0.05, 0);
    this.playTone(260, 165, 0.25, 'sawtooth', 0.06, 0.15);
  }
}
