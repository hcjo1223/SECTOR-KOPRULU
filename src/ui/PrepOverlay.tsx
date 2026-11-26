import React, { useEffect, useState } from 'react';
import type { GameApp } from '../core/GameApp';
import { getMaxCapacity } from '../domain/grid/GridSystem';
import { getUnitDefinition, getUnitsByRace } from '../domain/UnitCatalog';
import type { GameSpeed, GridSize, UnitDefinition } from '../domain/types';
import { useGameStore } from '../store/useGameStore';

interface PrepOverlayProps {
  gameAppRef: React.RefObject<GameApp | null>;
}

const GRID_SIZES: readonly GridSize[] = [3, 4, 5];
const SPEEDS: readonly GameSpeed[] = [1, 2, 4];

export const PrepOverlay: React.FC<PrepOverlayProps> = ({ gameAppRef }) => {
  const selectedRace = useGameStore((s) => s.selectedRace);
  const gridSize = useGameStore((s) => s.gridSize);
  const speed = useGameStore((s) => s.speed);
  const placedUnits = useGameStore((s) => s.placedUnits);
  const selectedInstanceId = useGameStore((s) => s.selectedInstanceId);
  const selectedRosterUnitId = useGameStore((s) => s.selectedRosterUnitId);
  const dragPayload = useGameStore((s) => s.dragPayload);
  const statusBanner = useGameStore((s) => s.statusBanner);
  const synergySummary = useGameStore((s) => s.synergySummary);

  const returnToTitle = useGameStore((s) => s.returnToTitle);
  const setGridSize = useGameStore((s) => s.setGridSize);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const selectRosterUnit = useGameStore((s) => s.selectRosterUnit);
  const setDragPayload = useGameStore((s) => s.setDragPayload);
  const quickDeployFromRoster = useGameStore((s) => s.quickDeployFromRoster);
  const removePlacedUnit = useGameStore((s) => s.removePlacedUnit);
  const populateSampleFormation = useGameStore((s) => s.populateSampleFormation);
  const clearAllyUnits = useGameStore((s) => s.clearAllyUnits);

  const [hoveredRosterDef, setHoveredRosterDef] = useState<UnitDefinition | null>(
    null
  );

  const rosterUnits = getUnitsByRace(selectedRace);
  const allyCount = placedUnits.filter((u) => u.faction === 'ALLY').length;
  const maxCapacity = getMaxCapacity(gridSize);

  const selectedPlaced = selectedInstanceId
    ? placedUnits.find((u) => u.instanceId === selectedInstanceId)
    : undefined;
  const inspectedDef = selectedPlaced
    ? getUnitDefinition(selectedPlaced.unitId)
    : hoveredRosterDef ??
      (selectedRosterUnitId ? getUnitDefinition(selectedRosterUnitId) : undefined);

  useEffect(() => {
    if (!dragPayload || dragPayload.source !== 'ROSTER') {
      return;
    }

    const handlePointerMove = (ev: PointerEvent) => {
      setDragPayload({
        ...dragPayload,
        clientX: ev.clientX,
        clientY: ev.clientY,
      });
      gameAppRef.current?.handleRosterDragMove(ev.clientX, ev.clientY);
    };

    const handlePointerUp = (ev: PointerEvent) => {
      const dropped = gameAppRef.current?.handleRosterDragDrop(
        dragPayload.unitId,
        ev.clientX,
        ev.clientY
      );
      if (!dropped && Math.hypot(ev.clientX - dragPayload.clientX, ev.clientY - dragPayload.clientY) < 6) {
        // Short click on card -> toggle selection for click-to-place
        const currentSelected = useGameStore.getState().selectedRosterUnitId;
        selectRosterUnit(
          currentSelected === dragPayload.unitId ? null : dragPayload.unitId
        );
      }
      setDragPayload(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragPayload, gameAppRef, selectRosterUnit, setDragPayload]);

  const handleRosterPointerDown = (
    unitId: string,
    ev: React.PointerEvent<HTMLDivElement>
  ) => {
    if (ev.button !== 0) {
      return;
    }
    setDragPayload({
      source: 'ROSTER',
      unitId,
      clientX: ev.clientX,
      clientY: ev.clientY,
    });
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-2.5 sm:p-3">
      {/* Top HUD Bar */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2 rounded border border-slate-700/80 bg-[#0b111c]/92 px-3 py-1.5 backdrop-blur-xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={returnToTitle}
            className="cursor-pointer rounded border border-slate-700 bg-slate-800/80 px-2 py-1 font-mono-tech text-[11px] text-slate-300 hover:border-slate-500 hover:text-white"
          >
            ◀ 종족
          </button>
          <div className="flex items-center gap-2">
            <span className="font-pixel text-xs text-sky-400">{selectedRace}</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono-tech text-[11px] text-slate-200">
              병력 {allyCount}/{maxCapacity}
            </span>
          </div>
        </div>

        {/* Grid Expansion Controls (3x3 -> 4x4 -> 5x5) */}
        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline font-mono-tech text-[10px] text-slate-400">
            GRID
          </span>
          {GRID_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setGridSize(size)}
              className={`cursor-pointer rounded px-2 py-0.5 font-mono-tech text-[11px] border transition-colors ${
                gridSize === size
                  ? 'border-sky-400 bg-sky-500/20 text-sky-200 font-semibold'
                  : 'border-slate-700 bg-slate-800/70 text-slate-400 hover:text-slate-200'
              }`}
            >
              {size}x{size}
            </button>
          ))}
        </div>

        {/* Utility & Speed Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={populateSampleFormation}
            className="cursor-pointer rounded border border-emerald-700/70 bg-emerald-950/60 px-2 py-0.5 font-mono-tech text-[11px] text-emerald-300 hover:bg-emerald-900/70"
          >
            샘플 편대
          </button>
          <button
            type="button"
            onClick={clearAllyUnits}
            className="cursor-pointer rounded border border-slate-700 bg-slate-800/70 px-2 py-0.5 font-mono-tech text-[11px] text-slate-300 hover:bg-slate-700"
          >
            초기화
          </button>
          <div className="ml-1 flex items-center rounded border border-slate-700 bg-slate-900/90 p-0.5">
            {SPEEDS.map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSpeed(spd)}
                className={`cursor-pointer rounded px-1.5 py-0.5 font-mono-tech text-[10px] ${
                  speed === spd
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Middle Floating Side Panels (Synergies & Inspector) */}
      <div className="relative flex flex-1 items-start justify-between py-2">
        {/* Left: Active Synergies */}
        <div className="pointer-events-auto flex w-[176px] flex-col gap-1">
          {synergySummary.activeSynergies.slice(0, 5).map((syn) => (
            <div
              key={syn.tag}
              title={syn.bonusText}
              className={`rounded border px-2 py-1 text-[11px] backdrop-blur-xs ${
                syn.active
                  ? 'border-amber-400/70 bg-amber-950/75 text-amber-200'
                  : 'border-slate-700/70 bg-slate-900/75 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between gap-2 font-mono-tech">
                <span className="truncate">{syn.label}</span>
                <span>
                  {syn.count}/{syn.threshold}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Center Top Banner */}
        {statusBanner && (
          <div
            data-testid="status-banner"
            className="pointer-events-none absolute left-1/2 top-0.5 -translate-x-1/2 whitespace-nowrap rounded border border-slate-700/80 bg-slate-950/85 px-3 py-0.5 font-mono-tech text-[11px] text-sky-200"
          >
            {statusBanner}
          </div>
        )}

        {/* Right: Unit Inspector */}
        {inspectedDef && (
          <div className="pointer-events-auto w-[196px] rounded border border-slate-700/90 bg-[#0b111c]/92 p-2.5 text-xs backdrop-blur-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-100">
                  {inspectedDef.name}
                </div>
                <div className="font-mono-tech text-[10px] text-slate-400">
                  T{inspectedDef.tier} · {inspectedDef.visual.sprite_size}px ·{' '}
                  {inspectedDef.base_stats.armor_type}
                </div>
              </div>
              {selectedPlaced && selectedPlaced.faction === 'ALLY' && (
                <button
                  type="button"
                  onClick={() => removePlacedUnit(selectedPlaced.instanceId)}
                  className="cursor-pointer rounded border border-rose-700/80 bg-rose-950/70 px-1.5 py-0.5 font-mono-tech text-[10px] text-rose-300 hover:bg-rose-900/80"
                >
                  회수
                </button>
              )}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 font-mono-tech text-[10px] text-slate-300">
              <span>HP: {inspectedDef.base_stats.hp}</span>
              <span>SHD: {inspectedDef.base_stats.shield}</span>
              <span>ATK: {inspectedDef.base_stats.attack}</span>
              <span>RNG: {inspectedDef.base_stats.range}</span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              {inspectedDef.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-slate-800 px-1.5 py-0.5 font-mono-tech text-[9px] text-slate-300"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-2 border-t border-slate-800 pt-1.5 text-[10px] text-slate-400">
              <span className="font-semibold text-amber-300">
                [{inspectedDef.skill.name}]
              </span>{' '}
              {inspectedDef.skill.description}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Dock: Roster Recruitment & Drag-to-Place */}
      <div className="pointer-events-auto rounded border border-slate-700/80 bg-[#0b111c]/94 px-3 py-2 backdrop-blur-xs">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            <strong className="text-slate-200">병력 배치</strong> — 카드를 드래그하여 아군(파랑) 그리드에 놓거나 <kbd className="rounded bg-slate-800 px-1 text-[10px] text-slate-200">+배치</kbd> 클릭 · 그리드 유닛 우클릭 시 회수
          </span>
          <span className="font-mono-tech text-[10px] text-slate-500">
            M1 · GRID CORE SANDBOX
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {rosterUnits.map((unit) => {
            const isSelected = selectedRosterUnitId === unit.unit_id;
            return (
              <div
                key={unit.unit_id}
                data-testid={`roster-card-${unit.unit_id}`}
                onPointerDown={(ev) => handleRosterPointerDown(unit.unit_id, ev)}
                onMouseEnter={() => setHoveredRosterDef(unit)}
                onMouseLeave={() => setHoveredRosterDef(null)}
                className={`group flex cursor-grab flex-col justify-between rounded border px-2 py-1.5 transition-colors active:cursor-grabbing ${
                  isSelected
                    ? 'border-sky-400 bg-sky-950/60'
                    : 'border-slate-700/80 bg-slate-900/90 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-pixel text-[11px] text-slate-100">
                    {unit.visual.short_code}
                  </span>
                  <span className="rounded bg-slate-800 px-1 font-mono-tech text-[9px] text-amber-300">
                    T{unit.tier}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-slate-300">
                  {unit.name.split(' (')[0]}
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono-tech text-[9px] text-slate-500">
                    {unit.visual.sprite_size}px
                  </span>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => quickDeployFromRoster(unit.unit_id)}
                    className="cursor-pointer rounded bg-sky-600/80 px-1.5 py-0.5 font-mono-tech text-[9px] text-white hover:bg-sky-500"
                  >
                    +배치
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating drag pill for roster drag feedback */}
      {dragPayload && dragPayload.source === 'ROSTER' && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded border border-sky-400 bg-slate-950/90 px-2 py-1 font-pixel text-[11px] text-sky-200 shadow-lg"
          style={{ left: dragPayload.clientX, top: dragPayload.clientY }}
        >
          {getUnitDefinition(dragPayload.unitId)?.visual.short_code ?? dragPayload.unitId}
        </div>
      )}
    </div>
  );
};
