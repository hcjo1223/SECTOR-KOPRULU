import React, { useEffect, useState } from 'react';
import { AssetLoader } from '../core/AssetLoader';
import type { GameApp } from '../core/GameApp';
import { getMaxCapacity } from '../domain/grid/GridSystem';
import { getUnitDefinition, getUnitsByRace } from '../domain/UnitCatalog';
import type {
  GameSpeed,
  GridSize,
  Race,
  StageMode,
  UnitDefinition,
} from '../domain/types';
import { useGameStore } from '../store/useGameStore';

interface PrepOverlayProps {
  gameAppRef: React.RefObject<GameApp | null>;
}

const RACES: readonly Race[] = ['TERRAN', 'ZERG', 'PROTOSS'];
const GRID_SIZES: readonly GridSize[] = [3, 4, 5];
const STAGE_MODES: ReadonlyArray<{ mode: StageMode; label: string }> = [
  { mode: 'ANNIHILATION', label: '섬멸' },
  { mode: 'DEFENSE', label: '방어' },
  { mode: 'BREAKTHROUGH', label: '돌파' },
];
const SPEEDS: readonly GameSpeed[] = [1, 2, 4];

export const PrepOverlay: React.FC<PrepOverlayProps> = ({ gameAppRef }) => {
  const selectedRace = useGameStore((s) => s.selectedRace);
  const act = useGameStore((s) => s.act);
  const minerals = useGameStore((s) => s.minerals);
  const gridSize = useGameStore((s) => s.gridSize);
  const stageMode = useGameStore((s) => s.stageMode);
  const speed = useGameStore((s) => s.speed);
  const placedUnits = useGameStore((s) => s.placedUnits);
  const selectedInstanceId = useGameStore((s) => s.selectedInstanceId);
  const selectedRosterUnitId = useGameStore((s) => s.selectedRosterUnitId);
  const dragPayload = useGameStore((s) => s.dragPayload);
  const statusBanner = useGameStore((s) => s.statusBanner);
  const synergySummary = useGameStore((s) => s.synergySummary);
  const draftOffers = useGameStore((s) => s.draftOffers);
  const relics = useGameStore((s) => s.relics);

  const startGame = useGameStore((s) => s.startGame);
  const returnToTitle = useGameStore((s) => s.returnToTitle);
  const setGridSize = useGameStore((s) => s.setGridSize);
  const setStageMode = useGameStore((s) => s.setStageMode);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const setMapOpen = useGameStore((s) => s.setMapOpen);
  const setCodexOpen = useGameStore((s) => s.setCodexOpen);
  const selectRosterUnit = useGameStore((s) => s.selectRosterUnit);
  const setDragPayload = useGameStore((s) => s.setDragPayload);
  const quickDeployFromRoster = useGameStore((s) => s.quickDeployFromRoster);
  const draftFromShop = useGameStore((s) => s.draftFromShop);
  const rerollDraftShop = useGameStore((s) => s.rerollDraftShop);
  const evolveZergUnits = useGameStore((s) => s.evolveZergUnits);
  const warpInProtossUnit = useGameStore((s) => s.warpInProtossUnit);
  const activateTerranAddon = useGameStore((s) => s.activateTerranAddon);
  const soundMuted = useGameStore((s) => s.soundMuted);
  const toggleSoundMute = useGameStore((s) => s.toggleSoundMute);
  const removePlacedUnit = useGameStore((s) => s.removePlacedUnit);
  const populateSampleFormation = useGameStore((s) => s.populateSampleFormation);
  const clearAllyUnits = useGameStore((s) => s.clearAllyUnits);
  const startBattle = useGameStore((s) => s.startBattle);

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
      if (
        !dropped &&
        Math.hypot(
          ev.clientX - dragPayload.clientX,
          ev.clientY - dragPayload.clientY
        ) < 6
      ) {
        const currentSelected = useGameStore.getState().selectedRosterUnitId;
        selectRosterUnit(
          currentSelected === dragPayload.unitId ? null : dragPayload.unitId
        );
      }
      setDragPayload(null);
    };

    const handlePointerCancel = () => {
      setDragPayload(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [dragPayload, gameAppRef, selectRosterUnit, setDragPayload]);

  const handleRosterPointerDown = (
    unitId: string,
    ev: React.PointerEvent<HTMLDivElement>
  ) => {
    if (ev.button !== 0 || ev.pointerType === 'touch') {
      return;
    }
    setDragPayload({
      source: 'ROSTER',
      unitId,
      clientX: ev.clientX,
      clientY: ev.clientY,
    });
  };

  const handleRosterCardClick = (unitId: string) => {
    // Allow tap-to-select on touch (and fallback click) for tap-grid placement
    const currentSelected = useGameStore.getState().selectedRosterUnitId;
    selectRosterUnit(currentSelected === unitId ? null : unitId);
  };

  return (
    <div className="contents lg:pointer-events-none lg:absolute lg:inset-0 lg:z-10 lg:flex lg:flex-col lg:justify-between lg:p-3">
      {/* Top HUD Bar (order-1 above canvas on mobile, floating top bar on desktop) */}
      <div className="order-1 pointer-events-auto flex flex-wrap items-center justify-between gap-1 border-b border-slate-700/80 bg-[#0b111c]/95 px-2 py-1.5 lg:order-none lg:flex-nowrap lg:gap-1.5 lg:rounded lg:border lg:px-2.5 lg:py-1.5 lg:backdrop-blur-xs">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={returnToTitle}
            className="cursor-pointer rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 font-mono-tech text-[10px] text-slate-300 hover:border-slate-500 hover:text-white"
          >
            ◀ 타이틀
          </button>

          {/* Direct Race Switcher Tabs */}
          <div className="flex items-center rounded border border-slate-700/90 bg-slate-900/90 p-0.5">
            {RACES.map((race) => (
              <button
                key={race}
                type="button"
                onClick={() => {
                  const prevSize = useGameStore.getState().gridSize;
                  startGame(race);
                  if (prevSize !== 3) {
                    setGridSize(prevSize);
                  }
                }}
                className={`cursor-pointer rounded px-1.5 py-0.5 font-pixel text-[9px] transition-colors ${
                  selectedRace === race
                    ? race === 'TERRAN'
                      ? 'bg-sky-600 text-white'
                      : race === 'ZERG'
                        ? 'bg-fuchsia-700 text-white'
                        : 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {race}
              </button>
            ))}
          </div>

          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono-tech text-[10px] text-amber-300">
            ACT {act}
          </span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono-tech text-[10px] text-slate-200">
            {allyCount}/{maxCapacity}
          </span>
          <span
            data-testid="minerals-badge"
            className="rounded border border-sky-500/40 bg-sky-950/70 px-1.5 py-0.5 font-mono-tech text-[10px] text-sky-300"
          >
            💎 {minerals}
          </span>
        </div>

        {/* Tactical Map, Codex, Grid Size & Stage Mode */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            data-testid="open-map-btn"
            onClick={() => setMapOpen(true)}
            className="cursor-pointer rounded border border-sky-500/60 bg-sky-950/70 px-1.5 py-0.5 font-mono-tech text-[10px] text-sky-200 hover:bg-sky-900"
          >
            🗺 지도
          </button>
          <button
            type="button"
            data-testid="open-codex-btn"
            onClick={() => setCodexOpen(true)}
            className="cursor-pointer rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 font-mono-tech text-[10px] text-slate-300 hover:bg-slate-700"
          >
            📖 도감
          </button>

          <div className="flex items-center gap-0.5">
            {GRID_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setGridSize(size)}
                className={`cursor-pointer rounded px-1.5 py-0.5 font-mono-tech text-[10px] border transition-colors ${
                  gridSize === size
                    ? 'border-sky-400 bg-sky-500/20 text-sky-200 font-semibold'
                    : 'border-slate-700 bg-slate-800/70 text-slate-400 hover:text-slate-200'
                }`}
              >
                {size}x{size}
              </button>
            ))}
          </div>

          <div className="flex items-center rounded border border-slate-700 bg-slate-900/90 p-0.5">
            {STAGE_MODES.map((m) => (
              <button
                key={m.mode}
                type="button"
                onClick={() => setStageMode(m.mode)}
                className={`cursor-pointer rounded px-1.5 py-0.5 font-mono-tech text-[10px] ${
                  stageMode === m.mode
                    ? 'bg-sky-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Race Trait Action, Utility, Sound, Speed & Battle Start */}
        <div className="flex flex-wrap items-center gap-1">
          {selectedRace === 'TERRAN' && (
            <button
              type="button"
              data-testid="terran-addon-btn"
              onClick={activateTerranAddon}
              className="cursor-pointer rounded border border-sky-500/70 bg-sky-950/70 px-1.5 py-0.5 font-mono-tech text-[10px] text-sky-200 hover:bg-sky-900"
            >
              ⚙ 애드온(2💎)
            </button>
          )}
          {selectedRace === 'ZERG' && (
            <button
              type="button"
              data-testid="zerg-evolve-btn"
              onClick={evolveZergUnits}
              className="cursor-pointer rounded border border-fuchsia-500/70 bg-fuchsia-950/70 px-1.5 py-0.5 font-mono-tech text-[10px] text-fuchsia-200 hover:bg-fuchsia-900"
            >
              🧬 변이
            </button>
          )}
          {selectedRace === 'PROTOSS' && (
            <button
              type="button"
              data-testid="protoss-warp-btn"
              onClick={warpInProtossUnit}
              className="cursor-pointer rounded border border-amber-500/70 bg-amber-950/70 px-1.5 py-0.5 font-mono-tech text-[10px] text-amber-200 hover:bg-amber-900"
            >
              🌀 소환(2💎)
            </button>
          )}
          <button
            type="button"
            onClick={populateSampleFormation}
            className="cursor-pointer rounded border border-emerald-700/70 bg-emerald-950/60 px-1.5 py-0.5 font-mono-tech text-[10px] text-emerald-300 hover:bg-emerald-900/70"
          >
            샘플 편대
          </button>
          <button
            type="button"
            onClick={clearAllyUnits}
            className="cursor-pointer rounded border border-slate-700 bg-slate-800/70 px-1.5 py-0.5 font-mono-tech text-[10px] text-slate-300 hover:bg-slate-700"
          >
            초기화
          </button>
          <button
            type="button"
            data-testid="sound-toggle-btn"
            onClick={toggleSoundMute}
            title={soundMuted ? '사운드 켜기' : '사운드 끄기'}
            className="cursor-pointer rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 font-mono-tech text-[10px] text-slate-300 hover:bg-slate-700"
          >
            {soundMuted ? '🔇' : '🔊'}
          </button>
          <div className="flex items-center rounded border border-slate-700 bg-slate-900/90 p-0.5">
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
          <button
            type="button"
            data-testid="start-battle-btn"
            onClick={startBattle}
            className="cursor-pointer rounded border border-amber-400/80 bg-amber-500 px-2 py-0.5 font-mono-tech text-[10px] font-bold text-slate-950 shadow hover:bg-amber-400"
          >
            ⚔ 전투 개시
          </button>
        </div>
      </div>

      {/* Mobile scrollable workspace below canvas; dissolves via lg:contents on desktop */}
      <div className="order-3 flex flex-1 flex-col gap-2.5 overflow-y-auto p-2.5 pb-6 lg:contents">
        {/* Middle Floating Side Panels on Desktop / Stacked Cards on Mobile */}
        <div className="relative flex flex-col gap-2 lg:flex-1 lg:flex-row lg:items-start lg:justify-between lg:py-2">
          {/* Center Top Banner */}
          {statusBanner && (
            <div
              data-testid="status-banner"
              className="pointer-events-none truncate rounded border border-slate-700/80 bg-slate-950/85 px-3 py-1 text-center font-mono-tech text-[11px] text-sky-200 lg:absolute lg:left-1/2 lg:top-0.5 lg:-translate-x-1/2 lg:whitespace-nowrap lg:py-0.5"
            >
              {statusBanner}
            </div>
          )}

          {/* Left: Active Synergies, Owned Relics & 3-Choose-1 Draft Shop */}
          <div className="pointer-events-auto flex w-full flex-col gap-1.5 lg:w-[184px]">
            <div className="flex flex-wrap gap-1 lg:flex-col">
              {synergySummary.activeSynergies.slice(0, 4).map((syn) => (
                <div
                  key={syn.tag}
                  title={syn.bonusText}
                  className={`rounded border px-2 py-0.5 text-[10px] backdrop-blur-xs ${
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

            {relics.length > 0 && (
              <div className="rounded border border-amber-500/40 bg-slate-950/85 p-1.5">
                <div className="font-mono-tech text-[9px] text-amber-400">
                  보유 유물 ({relics.length})
                </div>
                {relics.map((r) => (
                  <div
                    key={r.id}
                    title={r.description}
                    className="truncate text-[10px] text-slate-200"
                  >
                    • {r.name}
                  </div>
                ))}
              </div>
            )}

            {/* 3-Choose-1 Draft Shop */}
            <div className="rounded border border-slate-700/90 bg-[#0b111c]/94 p-2 backdrop-blur-xs">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-mono-tech text-[10px] font-semibold text-sky-300">
                  3택 1 상점 드래프트
                </span>
                <button
                  type="button"
                  data-testid="reroll-shop-btn"
                  onClick={rerollDraftShop}
                  className="cursor-pointer rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono-tech text-[9px] text-amber-300 hover:bg-slate-700"
                >
                  ↻ 리롤(1)
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1 lg:flex lg:flex-col">
                {draftOffers.map((unitId, idx) => {
                  const def = getUnitDefinition(unitId);
                  if (!def) return null;
                  return (
                    <button
                      key={`${unitId}_${idx}`}
                      type="button"
                      data-testid={`draft-offer-${idx}`}
                      onClick={() => draftFromShop(idx)}
                      className="flex cursor-pointer items-center justify-between rounded border border-slate-800 bg-slate-900/90 px-1.5 py-1 text-left hover:border-sky-500/60"
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <img
                          src={AssetLoader.getUnitDataUrl(def, 1, 0)}
                          alt={def.name}
                          className="pixelated h-6 w-6 shrink-0 object-contain"
                        />
                        <span className="truncate text-[10px] text-slate-200">
                          {def.name.split(' (')[0]}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono-tech text-[9px] text-sky-300">
                        {def.cost}💎
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Unit Inspector with Pixel Portrait */}
          {inspectedDef && (
            <div className="pointer-events-auto w-full rounded border border-slate-700/90 bg-[#0b111c]/92 p-2.5 text-xs backdrop-blur-xs lg:w-[198px]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-slate-700/80 bg-[#05080f]">
                  <img
                    src={AssetLoader.getUnitDataUrl(inspectedDef, 1, 0)}
                    alt={inspectedDef.name}
                    className="pixelated h-10 w-10 object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-100">
                    {inspectedDef.name.split(' (')[0]}
                  </div>
                  <div className="font-mono-tech text-[10px] text-slate-400">
                    T{inspectedDef.tier} · {inspectedDef.visual.sprite_size}px ·{' '}
                    {inspectedDef.base_stats.armor_type}
                  </div>
                  {selectedPlaced && selectedPlaced.faction === 'ALLY' && (
                    <button
                      type="button"
                      onClick={() => removePlacedUnit(selectedPlaced.instanceId)}
                      className="mt-1 cursor-pointer rounded border border-rose-700/80 bg-rose-950/70 px-1.5 py-0.5 font-mono-tech text-[9px] text-rose-300 hover:bg-rose-900/80"
                    >
                      회수
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2 grid grid-cols-4 gap-x-2 gap-y-1 font-mono-tech text-[10px] text-slate-300 lg:grid-cols-2">
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

        {/* Bottom Dock: Roster Recruitment & Drag-to-Place with Pixel Art Portraits */}
        <div className="pointer-events-auto rounded border border-slate-700/80 bg-[#0b111c]/94 px-3 py-2 backdrop-blur-xs">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              <strong className="text-slate-200">병력 배치</strong> —{' '}
              <span className="hidden sm:inline">
                카드를 드래그하거나
              </span>{' '}
              카드 선택 후 그리드 탭 · <kbd className="rounded bg-slate-800 px-1 text-[10px] text-slate-200">+배치</kbd>
            </span>
            <span className="hidden sm:inline font-mono-tech text-[10px] text-slate-500">
              PIXEL SPRITE ROSTER ({selectedRace})
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {rosterUnits.map((unit) => {
              const isSelected = selectedRosterUnitId === unit.unit_id;
              return (
                <div
                  key={unit.unit_id}
                  data-testid={`roster-card-${unit.unit_id}`}
                  onPointerDown={(ev) => handleRosterPointerDown(unit.unit_id, ev)}
                  onClick={() => handleRosterCardClick(unit.unit_id)}
                  onMouseEnter={() => setHoveredRosterDef(unit)}
                  onMouseLeave={() => setHoveredRosterDef(null)}
                  className={`group flex cursor-pointer lg:cursor-grab items-center gap-2 rounded border px-2 py-1.5 transition-colors active:cursor-grabbing ${
                    isSelected
                      ? 'border-sky-400 bg-sky-950/60'
                      : 'border-slate-700/80 bg-slate-900/90 hover:border-slate-500'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-slate-800 bg-[#05080f]">
                    <img
                      src={AssetLoader.getUnitDataUrl(unit, 1, 0)}
                      alt={unit.name}
                      className="pixelated h-9 w-9 object-contain"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[11px] font-medium text-slate-200">
                        {unit.name.split(' (')[0]}
                      </span>
                      <span className="rounded bg-slate-800 px-1 font-mono-tech text-[9px] text-amber-300">
                        T{unit.tier}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-mono-tech text-[9px] text-slate-500">
                        {unit.visual.short_code}
                      </span>
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          quickDeployFromRoster(unit.unit_id);
                        }}
                        className="cursor-pointer rounded bg-sky-600/85 px-1.5 py-0.5 font-mono-tech text-[9px] text-white hover:bg-sky-500"
                      >
                        +배치
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating drag sprite for desktop mouse drag feedback */}
      {dragPayload && dragPayload.source === 'ROSTER' && (() => {
        const dragDef = getUnitDefinition(dragPayload.unitId);
        return (
          <div
            className="pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded border border-sky-400 bg-slate-950/92 px-2 py-1 font-pixel text-[11px] text-sky-200 shadow-lg"
            style={{ left: dragPayload.clientX, top: dragPayload.clientY }}
          >
            {dragDef && (
              <img
                src={AssetLoader.getUnitDataUrl(dragDef, 1, 0)}
                alt={dragDef.name}
                className="pixelated h-7 w-7 object-contain"
              />
            )}
            <span>{dragDef?.visual.short_code ?? dragPayload.unitId}</span>
          </div>
        );
      })()}
    </div>
  );
};
