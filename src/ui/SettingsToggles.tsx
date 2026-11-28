import React, { useEffect } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';

/** 사운드·화면 흔들림 토글 (M 키로 음소거) */
export const SettingsToggles: React.FC<{ className?: string }> = ({ className = '' }) => {
  const soundOn = useSettingsStore((s) => s.soundOn);
  const shakeOn = useSettingsStore((s) => s.shakeOn);
  const toggleSound = useSettingsStore((s) => s.toggleSound);
  const toggleShake = useSettingsStore((s) => s.toggleShake);
  const btn =
    'cursor-pointer rounded border px-2 py-0.5 font-mono-tech text-[10px] hover:bg-slate-800';
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <button type="button" onClick={toggleSound} className={`${btn} ${soundOn ? 'border-sky-600 text-sky-200' : 'border-slate-700 text-slate-500'}`}>
        {soundOn ? '🔊 사운드 켜짐' : '🔇 사운드 꺼짐'} (M)
      </button>
      <button type="button" onClick={toggleShake} className={`${btn} ${shakeOn ? 'border-sky-600 text-sky-200' : 'border-slate-700 text-slate-500'}`}>
        화면 흔들림 {shakeOn ? '켜짐' : '꺼짐'}
      </button>
    </div>
  );
};

/** 어디서든 M 키로 음소거 토글 */
export function useMuteHotkey(): void {
  const toggleSound = useSettingsStore((s) => s.toggleSound);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === 'KeyM' && !e.repeat) {
        toggleSound();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSound]);
}
