import React, { useRef, useState } from 'react';
import { SurvivorInput } from '../core/SurvivorInput';

const RADIUS = 44;

/** 영역 어디든 누른 지점을 중심으로 생기는 플로팅 조이스틱 */
export const VirtualJoystick: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerId = useRef<number | null>(null);

  const update = (e: React.PointerEvent, o: { x: number; y: number }): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    let dx = e.clientX - rect.left - o.x;
    let dy = e.clientY - rect.top - o.y;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    // 데드존 15%, 60% 이상 기울이면 최대 속도
    const mag = Math.min(1, len / RADIUS);
    if (mag < 0.15 || len === 0) {
      SurvivorInput.setJoystick(0, 0);
      return;
    }
    const power = Math.min(1, mag / 0.6);
    SurvivorInput.setJoystick((dx / Math.hypot(dx, dy)) * power, (dy / Math.hypot(dx, dy)) * power);
  };

  const end = (): void => {
    pointerId.current = null;
    setOrigin(null);
    setKnob({ x: 0, y: 0 });
    SurvivorInput.setJoystick(0, 0);
  };

  return (
    <div
      className={`touch-none select-none ${className}`}
      onPointerDown={(e) => {
        if (pointerId.current !== null) {
          return;
        }
        pointerId.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        const o = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        setOrigin(o);
        update(e, o);
      }}
      onPointerMove={(e) => {
        if (pointerId.current === e.pointerId && origin) {
          update(e, origin);
        }
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {origin && (
        <div className="pointer-events-none absolute" style={{ left: origin.x - RADIUS, top: origin.y - RADIUS }}>
          <div className="relative rounded-full border border-slate-400/40 bg-slate-500/10" style={{ width: RADIUS * 2, height: RADIUS * 2 }}>
            <div
              className="absolute rounded-full bg-sky-300/60"
              style={{ width: 28, height: 28, left: RADIUS - 14 + knob.x, top: RADIUS - 14 + knob.y }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
