import type { CommanderState, EffectKind, EnemyBehavior, EnemyShotVisual, EnemyState, Vec2 } from './types';

/** 적 AI가 엔진에 요청할 수 있는 동작 */
export interface EnemyAIContext {
  readonly commander: CommanderState;
  rng(): number;
  /** (x, y)에서 가장 가까운 아군(지휘관·부대원)까지의 거리 */
  nearestAllyDist(x: number, y: number): number;
  spawnMinion(enemyId: string, x: number, y: number): EnemyState | null;
  fireShot(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    speed: number,
    damage: number,
    radius: number,
    color: string,
    visual?: EnemyShotVisual
  ): void;
  addHazard(x: number, y: number, radius: number, armSec: number, lifeSec: number, dps: number, burst: number, color: string): void;
  shieldEnemiesNear(x: number, y: number, radius: number, amount: number): void;
  effect(kind: EffectKind, x: number, y: number, radius: number, life: number, color: string, x2?: number, y2?: number): void;
  announce(text: string): void;
  /** (x, y) 반경 r 안의 같은 행동 패턴 적 수 (자기 자신 포함) */
  countEnemiesNear(x: number, y: number, r: number, behavior: EnemyBehavior): number;
}

/** 군체 광란: 반경 안 동족 수 기준과 배속 */
export const SWARM_RADIUS_PX = 52;
export const SWARM_FRENZY_COUNT = 4;
export const SWARM_FRENZY_MUL = 1.5;

const ZERO: Vec2 = { x: 0, y: 0 };

function setMode(e: EnemyState, mode: EnemyState['mode'], sec: number): void {
  e.mode = mode;
  e.modeSec = sec;
}

function toCommander(e: EnemyState, ctx: EnemyAIContext): { dx: number; dy: number; dist: number } {
  const dx = ctx.commander.x - e.x;
  const dy = ctx.commander.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  return { dx: dx / dist, dy: dy / dist, dist };
}

function chase(e: EnemyState, ctx: EnemyAIContext, mul = 1): Vec2 {
  const t = toCommander(e, ctx);
  return { x: t.dx * e.speed * mul, y: t.dy * e.speed * mul };
}

/** 조준(예고선) → 돌진 → 휴식 공통 처리. 돌진 중이면 속도를 반환, 아니면 null */
function stepDash(e: EnemyState, dt: number, dashSec: number, restSec: number, dashMul: number): Vec2 | null {
  e.modeSec -= dt;
  if (e.mode === 'AIM') {
    if (e.modeSec <= 0) {
      setMode(e, 'DASH', dashSec);
    }
    return ZERO;
  }
  if (e.mode === 'DASH') {
    if (e.modeSec <= 0) {
      setMode(e, 'REST', restSec);
      return ZERO;
    }
    return { x: e.dirX * e.speed * dashMul, y: e.dirY * e.speed * dashMul };
  }
  if (e.mode === 'REST') {
    if (e.modeSec <= 0) {
      setMode(e, 'CHASE', 0);
    }
    return ZERO;
  }
  return null;
}

function beginAim(e: EnemyState, ctx: EnemyAIContext, aimSec: number, length: number, color: string): void {
  const t = toCommander(e, ctx);
  e.dirX = t.dx;
  e.dirY = t.dy;
  setMode(e, 'AIM', aimSec);
  ctx.effect('TELE_LINE', e.x, e.y, e.radius, aimSec, color, e.x + t.dx * length, e.y + t.dy * length);
}

function shotVisualFor(e: EnemyState): EnemyShotVisual {
  if (e.def.sprite === 'PRISM') return 'PRISM';
  if (e.def.sprite === 'SPITTER') return 'SPIKE';
  if (e.def.sprite === 'MATRON' || e.def.sprite === 'COMMANDER') return 'ROYAL';
  return 'SPORE';
}

function ringShots(e: EnemyState, ctx: EnemyAIContext, count: number, speed: number, damage: number, color: string): void {
  const offset = ctx.rng() * Math.PI * 2;
  const vis = shotVisualFor(e);
  for (let i = 0; i < count; i += 1) {
    const a = offset + (i / count) * Math.PI * 2;
    ctx.fireShot(e.x, e.y, Math.cos(a), Math.sin(a), speed, damage, 3, color, vis);
  }
}

function summonRing(e: EnemyState, ctx: EnemyAIContext, enemyId: string, count: number, radius: number): void {
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    ctx.spawnMinion(enemyId, e.x + Math.cos(a) * radius, e.y + Math.sin(a) * radius);
  }
}

/**
 * 적 1기의 행동을 한 틱 진행하고 이번 틱 이동 속도(px/s)를 반환한다.
 * 군집 분리·아군 충돌은 엔진이 공통으로 처리한다.
 */
export function stepEnemyAI(e: EnemyState, ctx: EnemyAIContext, dt: number): Vec2 {
  e.ageSec += dt;
  switch (e.behavior) {
    case 'LINE':
      e.lifeSec -= dt;
      if (e.lifeSec <= 0) {
        e.alive = false;
        e.silent = true;
      }
      return { x: e.dirX * e.speed, y: e.dirY * e.speed };

    case 'CHARGER': {
      const dash = stepDash(e, dt, 0.55, 0.6, 5);
      if (dash) {
        return dash;
      }
      e.attackTimer -= dt;
      const t = toCommander(e, ctx);
      if (t.dist < 110 && e.attackTimer <= 0) {
        e.attackTimer = 2.8;
        beginAim(e, ctx, 0.7, 150, '#ff6060');
        return ZERO;
      }
      return chase(e, ctx);
    }

    case 'SPITTER': {
      const t = toCommander(e, ctx);
      e.attackTimer -= dt;
      if (e.attackTimer <= 0 && t.dist < 170) {
        e.attackTimer = 2.6;
        e.facingAngle = Math.atan2(t.dy, t.dx);
        e.attackFlashSec = 0.21;
        ctx.fireShot(e.x, e.y, t.dx, t.dy, 95, e.damage, 3, e.def.palette.accent, shotVisualFor(e));
      }
      if (t.dist > 130) {
        return chase(e, ctx);
      }
      if (t.dist < 90) {
        return { x: -t.dx * e.speed, y: -t.dy * e.speed };
      }
      // 거리 유지하며 옆으로 맴돌기
      return { x: -t.dy * e.speed * 0.6, y: t.dx * e.speed * 0.6 };
    }

    case 'BOMBER': {
      if (e.mode === 'FUSE') {
        e.modeSec -= dt;
        if (e.modeSec <= 0) {
          ctx.addHazard(e.x, e.y, 30, 0, 0.05, 0, e.damage, '#ff8a3a');
          ctx.effect('BOOM', e.x, e.y, 30, 0.35, '#ff8a3a');
          e.alive = false;
          e.silent = true;
        }
        return ZERO;
      }
      if (ctx.nearestAllyDist(e.x, e.y) < e.radius + 16) {
        setMode(e, 'FUSE', 0.6);
        ctx.effect('TELE_CIRCLE', e.x, e.y, 30, 0.6, '#ff8a3a');
        return ZERO;
      }
      return chase(e, ctx);
    }

    case 'NEST':
      e.spawnTimer -= dt;
      if (e.spawnTimer <= 0) {
        e.spawnTimer = 3.2;
        e.attackFlashSec = 0.21;
        for (let i = 0; i < 2; i += 1) {
          const a = ctx.rng() * Math.PI * 2;
          ctx.spawnMinion(e.def.minionId ?? 'mite', e.x + Math.cos(a) * (e.radius + 6), e.y + Math.sin(a) * (e.radius + 6));
        }
      }
      return ZERO;

    case 'QUEEN': {
      // 추격 3.5초 → (조준·돌진) ×3 → 진드기 소환
      const dash = stepDash(e, dt, 0.5, 0.35, 5.5);
      if (dash) {
        if (e.mode === 'CHASE' && e.dashCount > 0) {
          e.dashCount -= 1;
          if (e.dashCount > 0) {
            beginAim(e, ctx, 0.5, 200, '#ff4a4a');
          } else {
            summonRing(e, ctx, e.def.minionId ?? 'mite', 8, e.radius + 14);
            ctx.effect('PULSE', e.x, e.y, 40, 0.4, '#ff4a4a');
            e.attackTimer = 3.5;
          }
        }
        return dash;
      }
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) {
        e.dashCount = 3;
        beginAim(e, ctx, 0.75, 200, '#ff4a4a');
        return ZERO;
      }
      return chase(e, ctx);
    }

    case 'SPIRE': {
      // 고정형. 포자 고리 발사 + 주변 적 보호막. 오래 둘수록 고리가 촘촘해진다.
      e.attackTimer -= dt;
      e.spawnTimer -= dt;
      if (e.attackTimer <= 0) {
        e.attackTimer = 2.4;
        e.attackFlashSec = 0.21;
        const count = Math.min(26, 10 + Math.floor(e.ageSec / 20) * 3);
        ringShots(e, ctx, count, 70, e.damage, e.def.palette.accent);
      }
      if (e.spawnTimer <= 0) {
        e.spawnTimer = 6;
        ctx.shieldEnemiesNear(e.x, e.y, 110, 30);
        ctx.effect('SHIELD_PULSE', e.x, e.y, 110, 0.6, '#7fe3ff');
      }
      return ZERO;
    }

    case 'MATRON': {
      const ratio = e.hp / e.maxHp;
      const phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
      if (phase !== e.dashCount && e.dashCount !== 0) {
        ctx.announce(phase === 2 ? '블라이트 모체: 산성 분비 시작' : '블라이트 모체: 광폭화');
      }
      e.dashCount = phase;
      e.spawnTimer -= dt;
      e.attackTimer -= dt;
      e.modeSec -= dt;
      if (e.spawnTimer <= 0) {
        e.spawnTimer = phase === 3 ? 5 : 7;
        summonRing(e, ctx, phase === 1 ? 'mite' : 'crawler', 10, e.radius + 16);
      }
      if (phase >= 2 && e.attackTimer <= 0) {
        e.attackTimer = 4;
        const c = ctx.commander;
        ctx.addHazard(c.x, c.y, 28, 1.0, 6, 14, 0, '#9be04a');
      }
      if (phase === 3 && e.modeSec <= 0) {
        e.modeSec = 3;
        e.attackFlashSec = 0.21;
        ringShots(e, ctx, 14, 80, 12, '#ffd040');
      }
      return chase(e, ctx, phase === 3 ? 1.6 : 1);
    }

    case 'SWARM': {
      // 동족이 뭉쳐 있으면 광란: 이동속도 ×1.5 (뭉치기 전에 끊어내야 한다)
      const n = ctx.countEnemiesNear(e.x, e.y, SWARM_RADIUS_PX, 'SWARM');
      return chase(e, ctx, n >= SWARM_FRENZY_COUNT ? SWARM_FRENZY_MUL : 1);
    }

    case 'VOLLEY': {
      // 가시 3갈래 일제 사격, 거리 유지
      const t = toCommander(e, ctx);
      e.attackTimer -= dt;
      if (e.attackTimer <= 0 && t.dist < 170) {
        e.attackTimer = 3.0;
        e.facingAngle = Math.atan2(t.dy, t.dx);
        e.attackFlashSec = 0.21;
        const base = Math.atan2(t.dy, t.dx);
        for (const off of [-0.26, 0, 0.26]) {
          ctx.fireShot(e.x, e.y, Math.cos(base + off), Math.sin(base + off), 100, e.damage, 3, e.def.palette.accent, 'SPIKE');
        }
      }
      if (t.dist > 135) {
        return chase(e, ctx);
      }
      if (t.dist < 95) {
        return { x: -t.dx * e.speed, y: -t.dy * e.speed };
      }
      return { x: t.dy * e.speed * 0.55, y: -t.dx * e.speed * 0.55 };
    }

    case 'WARDEN': {
      // 정면 방패(피해 감소는 shellReduction) + 5초마다 주변 교단에 보호막
      e.spawnTimer -= dt;
      if (e.spawnTimer <= 0) {
        e.spawnTimer = 5;
        ctx.shieldEnemiesNear(e.x, e.y, 80, 16);
        ctx.effect('SHIELD_PULSE', e.x, e.y, 80, 0.5, e.def.palette.accent);
      }
      return chase(e, ctx);
    }

    case 'PRISM': {
      // 조준선 0.55초 예고 → 광자탄 3연사(0.14초 간격). 연사 중에는 멈춘다.
      const t = toCommander(e, ctx);
      if (e.mode === 'AIM') {
        e.modeSec -= dt;
        if (e.modeSec <= 0) {
          e.dashCount -= 1;
          e.attackFlashSec = 0.21;
          ctx.fireShot(e.x, e.y, e.dirX, e.dirY, 135, e.damage, 3, e.def.palette.accent, 'PRISM');
          if (e.dashCount > 0) {
            e.modeSec = 0.14;
          } else {
            setMode(e, 'CHASE', 0);
            e.attackTimer = 3.4;
          }
        }
        return ZERO;
      }
      e.attackTimer -= dt;
      if (e.attackTimer <= 0 && t.dist < 175) {
        e.dashCount = 3;
        e.facingAngle = Math.atan2(t.dy, t.dx);
        beginAim(e, ctx, 0.55, 170, e.def.palette.accent);
        return ZERO;
      }
      if (t.dist > 140) {
        return chase(e, ctx);
      }
      if (t.dist < 100) {
        return { x: -t.dx * e.speed, y: -t.dy * e.speed };
      }
      return { x: -t.dy * e.speed * 0.5, y: t.dx * e.speed * 0.5 };
    }

    case 'SPLITTER':
    case 'SHELLED':
    case 'CHASE':
    default:
      return chase(e, ctx);
  }
}

/** 갑각충: 진행 방향(지휘관 쪽) 정면에서 들어온 피해 70% 감소 */
export function shellReduction(e: EnemyState, commander: CommanderState, srcX: number, srcY: number): number {
  if (e.behavior !== 'SHELLED' && e.behavior !== 'WARDEN') {
    return 1;
  }
  const hx = commander.x - e.x;
  const hy = commander.y - e.y;
  const sx = srcX - e.x;
  const sy = srcY - e.y;
  const hl = Math.hypot(hx, hy) || 1;
  const sl = Math.hypot(sx, sy) || 1;
  return (hx * sx + hy * sy) / (hl * sl) > 0.35 ? 0.3 : 1;
}
