import type { CueKind, GameCue } from '../domain/survivor/types';

/**
 * 효과음 합성기: 오디오 파일 없이 WebAudio 발진기·노이즈로 8비트풍 효과음을 만든다.
 * - 같은 종류는 최소 간격(MIN_GAP_MS) 안에 다시 울리지 않고, 동시 발음 수도 제한한다 (수백 기 호드에서도 소리가 뭉개지지 않게).
 * - 위치가 있는 소리는 지휘관(카메라)에서 멀수록 작아진다.
 * - 브라우저 정책상 첫 사용자 입력에서 unlock()으로 오디오를 깨워야 한다.
 */

const MIN_GAP_MS: Partial<Record<CueKind, number>> = {
  SHOT: 55,
  HEAVY_SHOT: 100,
  FLAME: 130,
  ZAP: 90,
  MELEE: 80,
  TURRET: 160,
  EXPLOSION: 80,
  ENEMY_DOWN: 50,
  ELITE_DOWN: 120,
  PICKUP: 40,
  COMMANDER_HIT: 140,
  MEMBER_DOWN: 160,
  ALERT: 400,
};

/** 화면 연출(위치 무관)로 다루는 소리 */
const GLOBAL_CUES: ReadonlySet<CueKind> = new Set<CueKind>([
  'LEVEL_UP',
  'CHEST',
  'RELIC',
  'EVOLVE',
  'ALERT',
  'DEFEAT',
  'VICTORY',
  'BOSS_SPAWN',
  'COMMANDER_HIT',
]);

const MAX_VOICES = 20;
const HEARING_RADIUS = 420;

export class SurvivorAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly lastPlayed = new Map<CueKind, number>();
  private voiceEnds: number[] = [];
  private enabled = true;
  private volume = 0.7;

  /** 사용자 입력 핸들러 안에서 호출: 오디오 컨텍스트 생성·재개 */
  public unlock(): void {
    if (typeof window === 'undefined') {
      return;
    }
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        return;
      }
      try {
        this.ctx = new Ctor();
      } catch {
        this.ctx = null;
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume * 0.5 : 0;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      let seed = 1234567;
      for (let i = 0; i < len; i += 1) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        d[i] = (seed / 0x7fffffff) * 2 - 1;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => undefined);
    }
  }

  public configure(enabled: boolean, volume: number): void {
    this.enabled = enabled;
    this.volume = volume;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(enabled ? volume * 0.5 : 0, this.ctx.currentTime, 0.02);
    }
  }

  /** 연출 신호 재생. (lx, ly)는 청자(지휘관) 위치 */
  public play(cue: GameCue, lx: number, ly: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.enabled || ctx.state !== 'running') {
      return;
    }
    const nowMs = ctx.currentTime * 1000;
    const gap = MIN_GAP_MS[cue.kind] ?? 0;
    const last = this.lastPlayed.get(cue.kind) ?? -1e9;
    if (nowMs - last < gap) {
      return;
    }
    const t = ctx.currentTime;
    this.voiceEnds = this.voiceEnds.filter((e) => e > t);
    if (this.voiceEnds.length >= MAX_VOICES && !GLOBAL_CUES.has(cue.kind)) {
      return;
    }
    let gain = Math.max(0.2, Math.min(1.5, cue.power));
    if (!GLOBAL_CUES.has(cue.kind)) {
      const dist = Math.hypot(cue.x - lx, cue.y - ly);
      const fall = 1 - dist / HEARING_RADIUS;
      if (fall <= 0.05) {
        return;
      }
      gain *= Math.max(0.15, fall);
    }
    this.lastPlayed.set(cue.kind, nowMs);
    const dur = this.synth(cue.kind, t, gain);
    this.voiceEnds.push(t + dur);
  }

  // ─────────────── 합성 레시피 (반환: 길이 초) ───────────────

  private synth(kind: CueKind, t: number, g: number): number {
    switch (kind) {
      case 'SHOT':
        this.tone(t, 'square', 900, 420, 0.05, 0.035 * g);
        this.burst(t, 0.03, 'highpass', 3000, 0.02 * g);
        return 0.06;
      case 'HEAVY_SHOT':
        this.tone(t, 'sawtooth', 240, 70, 0.16, 0.06 * g);
        this.burst(t, 0.12, 'lowpass', 1400, 0.07 * g);
        return 0.17;
      case 'FLAME':
        this.burst(t, 0.2, 'bandpass', 900, 0.06 * g, 0.8);
        return 0.2;
      case 'ZAP':
        this.tone(t, 'sawtooth', 1500, 280, 0.1, 0.04 * g);
        this.tone(t + 0.02, 'square', 2100, 1700, 0.05, 0.02 * g);
        return 0.12;
      case 'MELEE':
        this.burst(t, 0.05, 'highpass', 2400, 0.05 * g);
        this.tone(t, 'triangle', 320, 140, 0.07, 0.05 * g);
        return 0.08;
      case 'TURRET':
        this.tone(t, 'triangle', 420, 820, 0.08, 0.05 * g);
        this.tone(t + 0.08, 'square', 640, 640, 0.04, 0.03 * g);
        return 0.13;
      case 'EXPLOSION':
        this.burst(t, 0.32, 'lowpass', 700, 0.13 * g, 0.7, 180);
        this.tone(t, 'sine', 95, 38, 0.3, 0.12 * g);
        return 0.33;
      case 'ENEMY_DOWN':
        this.tone(t, 'square', 320, 110, 0.06, 0.022 * g);
        return 0.06;
      case 'ELITE_DOWN':
        this.tone(t, 'triangle', 660, 220, 0.25, 0.07 * g);
        this.burst(t, 0.18, 'lowpass', 900, 0.06 * g);
        return 0.26;
      case 'BOSS_SPAWN':
        this.tone(t, 'sawtooth', 110, 82, 0.9, 0.08 * g, 6);
        this.tone(t + 0.3, 'sawtooth', 147, 110, 0.6, 0.06 * g, 5);
        return 0.95;
      case 'BOSS_DOWN':
        this.burst(t, 0.9, 'lowpass', 900, 0.16 * g, 0.7, 120);
        this.tone(t, 'sine', 80, 30, 0.8, 0.14 * g);
        this.arp(t + 0.25, [523, 659, 784, 1047], 0.09, 'square', 0.05);
        return 1;
      case 'COMMANDER_HIT':
        this.tone(t, 'square', 210, 85, 0.13, 0.08 * g);
        this.burst(t, 0.06, 'bandpass', 600, 0.05 * g);
        return 0.14;
      case 'MEMBER_DOWN':
        this.tone(t, 'triangle', 520, 180, 0.22, 0.06);
        return 0.22;
      case 'PICKUP':
        this.tone(t, 'sine', 1250, 1700, 0.045, 0.02 * g + 0.01);
        return 0.05;
      case 'LEVEL_UP':
        this.arp(t, [523, 659, 784, 1047], 0.07, 'square', 0.05);
        return 0.3;
      case 'CHEST':
        this.arp(t, [392, 523, 659, 784, 988], 0.06, 'triangle', 0.06);
        this.tone(t + 0.3, 'sine', 1568, 2093, 0.2, 0.025);
        return 0.5;
      case 'RELIC':
        this.arp(t, [587, 740, 880, 1175, 1480], 0.07, 'triangle', 0.06);
        this.tone(t + 0.35, 'sine', 2349, 2349, 0.3, 0.02);
        return 0.65;
      case 'EVOLVE':
        this.tone(t, 'sawtooth', 300, 1200, 0.4, 0.05);
        this.arp(t + 0.35, [784, 988, 1175, 1568], 0.07, 'square', 0.05);
        return 0.7;
      case 'ALERT':
        this.arp(t, [880, 660, 880, 660], 0.09, 'square', 0.035);
        return 0.36;
      case 'DEFEAT':
        this.tone(t, 'square', 440, 110, 0.9, 0.07);
        this.tone(t + 0.1, 'triangle', 330, 82, 0.9, 0.05);
        return 1;
      case 'VICTORY':
        this.arp(t, [523, 659, 784, 1047, 784, 1047, 1319], 0.11, 'square', 0.06);
        return 0.8;
    }
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, gain: number, vibratoHz = 0): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    if (vibratoHz > 0) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = vibratoHz;
      depth.gain.value = f0 * 0.04;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur);
    }
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private burst(t: number, dur: number, filter: BiquadFilterType, freq: number, gain: number, q = 1, freqEnd = freq): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.Q.value = q;
    biquad.frequency.setValueAtTime(freq, t);
    biquad.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + dur);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(Math.max(0.0002, gain), t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(biquad).connect(amp).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private arp(t: number, notes: readonly number[], step: number, type: OscillatorType, gain: number): void {
    notes.forEach((f, i) => this.tone(t + i * step, type, f, f, step * 1.6, gain));
  }
}
