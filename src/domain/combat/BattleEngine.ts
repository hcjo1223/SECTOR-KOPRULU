import {
  getProjectileDefinition,
  getUnitDefinition,
} from '../UnitCatalog';
import { gridToLogicalCenter, TILE_SIZE } from '../grid/GridSystem';
import { euclideanTileDistance } from '../grid/Pathfinding';
import { calculateSynergies } from '../synergy/SynergyCalc';
import type {
  ArmorType,
  BattleEffectState,
  BattleEffectType,
  BattleProjectileState,
  BattleUnitState,
  CommanderSkillId,
  Faction,
  GridSize,
  PlacedUnit,
  StageMode,
} from '../types';
import { calculateDamage } from './DamageCalc';
import { evaluateStageOutcome, type StageOutcome } from './StageRule';

export const FIXED_DT = 1 / 30;

export interface BattleSnapshot {
  tick: number;
  elapsedSec: number;
  timeLimitSec: number;
  mode: StageMode;
  outcome: StageOutcome;
  commanderSkillUsed: boolean;
  units: readonly BattleUnitState[];
  projectiles: readonly BattleProjectileState[];
  effects: readonly BattleEffectState[];
}

export class BattleEngine {
  private units: BattleUnitState[] = [];
  private projectiles: BattleProjectileState[] = [];
  private effects: BattleEffectState[] = [];

  private tickCount = 0;
  private elapsedSec = 0;
  private mode: StageMode = 'ANNIHILATION';
  private timeLimitSec = 45;
  private gridSize: GridSize = 3;
  private outcome: StageOutcome = 'ONGOING';
  private commanderSkillUsed = false;

  private nextProjectileId = 1;
  private nextEffectId = 1;

  // Cached synergy flags for ally faction
  private hasTerranSynergy = false;
  private hasZergSynergy = false;
  private hasProtossSynergy = false;
  private hasBioSynergy = false;
  private hasMechSynergy = false;
  private hasSplashSynergy = false;
  private hasSwarmSynergy = false;

  public init(
    placedUnits: readonly PlacedUnit[],
    mode: StageMode = 'ANNIHILATION',
    timeLimitSec: number = 45,
    gridSize: GridSize = 3
  ): void {
    this.tickCount = 0;
    this.elapsedSec = 0;
    this.mode = mode;
    this.timeLimitSec = timeLimitSec;
    this.gridSize = gridSize;
    this.outcome = 'ONGOING';
    this.commanderSkillUsed = false;
    this.projectiles = [];
    this.effects = [];

    const synergies = calculateSynergies(placedUnits);
    this.hasTerranSynergy = false;
    this.hasZergSynergy = false;
    this.hasProtossSynergy = false;
    this.hasBioSynergy = false;
    this.hasMechSynergy = false;
    this.hasSplashSynergy = false;
    this.hasSwarmSynergy = false;

    for (let i = 0; i < synergies.activeSynergies.length; i++) {
      const s = synergies.activeSynergies[i];
      if (!s.active) {
        continue;
      }
      if (s.tag === 'TERRAN') this.hasTerranSynergy = true;
      if (s.tag === 'ZERG') this.hasZergSynergy = true;
      if (s.tag === 'PROTOSS') this.hasProtossSynergy = true;
      if (s.tag === 'BIO') this.hasBioSynergy = true;
      if (s.tag === 'MECH') this.hasMechSynergy = true;
      if (s.tag === 'SPLASH') this.hasSplashSynergy = true;
      if (s.tag === 'SWARM') this.hasSwarmSynergy = true;
    }

    this.units = [];
    for (let i = 0; i < placedUnits.length; i++) {
      const placed = placedUnits[i];
      const def = getUnitDefinition(placed.unitId);
      if (!def) {
        continue;
      }
      const center = gridToLogicalCenter(placed.col, placed.row);
      const isAlly = placed.faction === 'ALLY';

      let maxHp = placed.isObjectiveStructure
        ? Math.round(def.base_stats.hp * 3.5)
        : def.base_stats.hp;
      if (isAlly && this.hasMechSynergy && def.tags.includes('MECH')) {
        maxHp = Math.round(maxHp * 1.15);
      }

      let maxShield = placed.isObjectiveStructure
        ? Math.round(def.base_stats.shield * 2.5)
        : def.base_stats.shield;
      if (isAlly && this.hasProtossSynergy && maxShield > 0) {
        maxShield = Math.round(maxShield * 1.25);
      }

      let hp = maxHp;
      let stimpackActive = false;
      let siegeModeActive = false;
      let chargeActive = false;

      if (!placed.isObjectiveStructure) {
        if (def.skill.id === 'stimpack') {
          stimpackActive = true;
          hp = Math.max(1, Math.round(maxHp * 0.9));
          this.spawnEffect('STIMPACK', center.x, center.y, 12, '#22c55e', 0.45);
        } else if (def.skill.id === 'siege_mode') {
          siegeModeActive = true;
        } else if (def.skill.id === 'psionic_charge') {
          chargeActive = true;
        }
      }

      this.units.push({
        instanceId: placed.instanceId,
        unitId: placed.unitId,
        faction: placed.faction,
        logicalX: center.x,
        logicalY: center.y,
        hp,
        maxHp,
        shield: maxShield,
        maxShield,
        action: 'IDLE',
        facing: isAlly ? 1 : -1,
        cooldownSec: 0,
        attackCount: 0,
        stimpackActive,
        siegeModeActive,
        chargeActive,
        darkSwarmBuff: false,
        isObjectiveStructure: Boolean(placed.isObjectiveStructure),
        structureName: placed.structureName,
      });
    }
  }

  public triggerCommanderSkill(skillId: CommanderSkillId): boolean {
    if (this.commanderSkillUsed || this.outcome !== 'ONGOING') {
      return false;
    }

    this.commanderSkillUsed = true;

    if (skillId === 'NUCLEAR_SCAN') {
      const target = this.findClusterCenter('ENEMY');
      if (target) {
        const radiusPx = 2.8 * TILE_SIZE;
        this.spawnEffect('NUCLEAR', target.x, target.y, radiusPx, '#ef4444', 0.8);
        this.applyAoEDamage('ALLY', target.x, target.y, radiusPx, 110);
      }
      return true;
    }

    if (skillId === 'DARK_SWARM') {
      for (let i = 0; i < this.units.length; i++) {
        const u = this.units[i];
        if (u.faction === 'ALLY' && u.hp > 0) {
          u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * 0.35));
          u.darkSwarmBuff = true;
          this.spawnEffect(
            'DARK_SWARM',
            u.logicalX,
            u.logicalY,
            22,
            '#f97316',
            0.7
          );
        }
      }
      return true;
    }

    if (skillId === 'PSIONIC_STORM') {
      const target = this.findClusterCenter('ENEMY');
      if (target) {
        const radiusPx = 2.4 * TILE_SIZE;
        this.spawnEffect('PSI_STORM', target.x, target.y, radiusPx, '#38bdf8', 0.75);
        this.applyAoEDamage('ALLY', target.x, target.y, radiusPx, 85);
      }
      for (let i = 0; i < this.units.length; i++) {
        const u = this.units[i];
        if (u.faction === 'ALLY' && u.hp > 0 && u.maxShield > 0) {
          u.shield = Math.min(u.maxShield, u.shield + 40);
        }
      }
      return true;
    }

    return false;
  }

  public warpInAllyUnit(
    instanceId: string,
    unitId: string,
    logicalX: number,
    logicalY: number
  ): boolean {
    if (this.outcome !== 'ONGOING') {
      return false;
    }
    const def = getUnitDefinition(unitId);
    if (!def) {
      return false;
    }
    const maxShield = this.hasProtossSynergy
      ? Math.round(def.base_stats.shield * 1.25)
      : def.base_stats.shield;

    this.units.push({
      instanceId,
      unitId,
      faction: 'ALLY',
      logicalX,
      logicalY,
      hp: def.base_stats.hp,
      maxHp: def.base_stats.hp,
      shield: maxShield,
      maxShield,
      action: 'IDLE',
      facing: 1,
      cooldownSec: 0,
      attackCount: 0,
      stimpackActive: false,
      siegeModeActive: false,
      chargeActive: def.skill.id === 'psionic_charge',
      darkSwarmBuff: false,
      isObjectiveStructure: false,
    });
    this.spawnEffect('PSI_STORM', logicalX, logicalY, 18, '#38bdf8', 0.45);
    return true;
  }

  public step(ticks: number = 1): BattleSnapshot {
    for (let t = 0; t < ticks; t++) {
      if (this.outcome !== 'ONGOING') {
        break;
      }
      this.stepSingleTick();
    }
    return this.getSnapshot();
  }

  private stepSingleTick(): void {
    this.tickCount += 1;
    this.elapsedSec = this.tickCount * FIXED_DT;

    // 1. Update Units
    for (let i = 0; i < this.units.length; i++) {
      const unit = this.units[i];
      if (unit.hp <= 0) {
        unit.action = 'DIE';
        continue;
      }

      if (unit.cooldownSec > 0) {
        unit.cooldownSec = Math.max(0, unit.cooldownSec - FIXED_DT);
      }

      if (unit.isObjectiveStructure) {
        unit.action = 'IDLE';
        continue;
      }

      const def = getUnitDefinition(unit.unitId);
      if (!def) {
        continue;
      }

      // Passive SCV adjacent mechanic repair once per second
      if (def.skill.id === 'scv_repair' && this.tickCount % 30 === 0) {
        this.performScvPassiveRepair(unit);
      }

      // Dedicated Medic bio healer AI
      if (def.skill.id === 'bio_heal') {
        this.stepMedicUnit(unit, def.base_stats.range, def.base_stats.move_speed, def.base_stats.attack_speed);
        continue;
      }

      const target = this.findNearestEnemy(unit);
      if (!target) {
        unit.action = 'IDLE';
        continue;
      }

      const dx = target.logicalX - unit.logicalX;
      if (Math.abs(dx) > 1) {
        unit.facing = dx >= 0 ? 1 : -1;
      }

      const distTiles =
        euclideanTileDistance(
          unit.logicalX,
          unit.logicalY,
          target.logicalX,
          target.logicalY
        ) / TILE_SIZE;

      let effectiveRange = def.base_stats.range;
      if (unit.siegeModeActive) {
        effectiveRange += 2.5;
      } else if (def.skill.id === 'grooved_spines') {
        effectiveRange += 1.0;
      }

      const isOnAllyCreep =
        unit.faction === 'ALLY' &&
        def.race === 'ZERG' &&
        unit.logicalX <= (this.gridSize + 1) * TILE_SIZE;

      if (distTiles <= effectiveRange + 0.35) {
        // In attack range
        let atkSpd = def.base_stats.attack_speed;
        if (unit.stimpackActive) {
          atkSpd *= this.hasBioSynergy ? 1.5 : 1.4;
        }
        if (unit.darkSwarmBuff) {
          atkSpd *= 1.45;
        }
        if (isOnAllyCreep) {
          if (this.hasZergSynergy) atkSpd *= 1.2;
          if (def.skill.id === 'adrenal_glands') atkSpd *= 1.35;
        }
        if (unit.faction === 'ALLY' && this.hasTerranSynergy && def.race === 'TERRAN') {
          atkSpd *= 1.15;
        }
        if (unit.faction === 'ALLY' && this.hasSwarmSynergy && def.tags.includes('SWARM')) {
          atkSpd *= 1.15;
        }

        if (unit.cooldownSec <= 0) {
          unit.action = 'ATTACK';
          unit.chargeActive = false;
          unit.attackCount += 1;
          unit.cooldownSec = 1 / Math.max(0.2, atkSpd);
          this.performAttack(unit, target);
        } else if (unit.cooldownSec < 0.25) {
          unit.action = 'IDLE';
        }
      } else if (!unit.siegeModeActive) {
        // Move toward target
        unit.action = 'MOVE';
        let moveSpd = def.base_stats.move_speed;
        if (unit.chargeActive) {
          moveSpd *= 2.1;
        }
        if (isOnAllyCreep && this.hasZergSynergy) {
          moveSpd *= 1.2;
        }
        this.moveUnitToward(unit, target.logicalX, target.logicalY, moveSpd);
      } else {
        unit.action = 'IDLE';
      }
    }

    // 2. Update Projectiles
    this.updateProjectiles();

    // 3. Update Visual Effects TTL
    this.updateEffects();

    // 4. Evaluate Stage Outcome
    const objectiveDestroyed = this.checkObjectiveDestroyed();
    this.outcome = evaluateStageOutcome(
      this.mode,
      this.units,
      this.elapsedSec,
      this.timeLimitSec,
      objectiveDestroyed
    );
  }

  private performScvPassiveRepair(scv: BattleUnitState): void {
    let bestTarget: BattleUnitState | null = null;
    let lowestRatio = 1;

    for (let i = 0; i < this.units.length; i++) {
      const candidate = this.units[i];
      if (
        candidate.faction !== scv.faction ||
        candidate.hp <= 0 ||
        candidate.hp >= candidate.maxHp
      ) {
        continue;
      }
      const cDef = getUnitDefinition(candidate.unitId);
      if (!cDef || !cDef.tags.includes('MECH')) {
        continue;
      }
      const distTiles =
        euclideanTileDistance(
          scv.logicalX,
          scv.logicalY,
          candidate.logicalX,
          candidate.logicalY
        ) / TILE_SIZE;
      if (distTiles <= 1.8) {
        const ratio = candidate.hp / candidate.maxHp;
        if (ratio < lowestRatio) {
          lowestRatio = ratio;
          bestTarget = candidate;
        }
      }
    }

    if (bestTarget) {
      bestTarget.hp = Math.min(bestTarget.maxHp, bestTarget.hp + 6);
      this.spawnEffect(
        'HEAL',
        bestTarget.logicalX,
        bestTarget.logicalY,
        11,
        '#38bdf8',
        0.35
      );
    }
  }

  private stepMedicUnit(
    medic: BattleUnitState,
    rangeTiles: number,
    moveSpeed: number,
    healRate: number
  ): void {
    let injuredBio: BattleUnitState | null = null;
    let lowestRatio = 1.01;

    for (let i = 0; i < this.units.length; i++) {
      const ally = this.units[i];
      if (
        ally.faction !== medic.faction ||
        ally.instanceId === medic.instanceId ||
        ally.hp <= 0
      ) {
        continue;
      }
      const aDef = getUnitDefinition(ally.unitId);
      if (!aDef || !aDef.tags.includes('BIO')) {
        continue;
      }
      const ratio = ally.hp / ally.maxHp;
      if (ratio < lowestRatio) {
        lowestRatio = ratio;
        injuredBio = ally;
      }
    }

    if (!injuredBio) {
      medic.action = 'IDLE';
      return;
    }

    const distTiles =
      euclideanTileDistance(
        medic.logicalX,
        medic.logicalY,
        injuredBio.logicalX,
        injuredBio.logicalY
      ) / TILE_SIZE;

    if (distTiles <= rangeTiles + 0.3) {
      if (injuredBio.hp < injuredBio.maxHp && medic.cooldownSec <= 0) {
        medic.action = 'ATTACK';
        const healAmt = this.hasBioSynergy ? 15 : 12;
        injuredBio.hp = Math.min(injuredBio.maxHp, injuredBio.hp + healAmt);
        medic.cooldownSec = 1 / Math.max(0.4, healRate);
        this.spawnEffect(
          'HEAL',
          injuredBio.logicalX,
          injuredBio.logicalY,
          13,
          '#22c55e',
          0.35
        );
      } else {
        medic.action = 'IDLE';
      }
    } else {
      medic.action = 'MOVE';
      this.moveUnitToward(
        medic,
        injuredBio.logicalX,
        injuredBio.logicalY,
        moveSpeed
      );
    }
  }

  private moveUnitToward(
    unit: BattleUnitState,
    targetX: number,
    targetY: number,
    moveSpeed: number
  ): void {
    const dx = targetX - unit.logicalX;
    const dy = targetY - unit.logicalY;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) {
      return;
    }

    const stepPx = moveSpeed * TILE_SIZE * FIXED_DT;
    let vx = (dx / dist) * stepPx;
    let vy = (dy / dist) * stepPx;

    // Soft separation from overlapping nearby units to avoid stacking
    for (let i = 0; i < this.units.length; i++) {
      const other = this.units[i];
      if (other.instanceId === unit.instanceId || other.hp <= 0) {
        continue;
      }
      const ox = unit.logicalX - other.logicalX;
      const oy = unit.logicalY - other.logicalY;
      const oDist = Math.hypot(ox, oy);
      if (oDist > 0.1 && oDist < 15) {
        const push = ((15 - oDist) / 15) * 0.7;
        vx += (ox / oDist) * push;
        vy += (oy / oDist) * push;
      }
    }

    unit.logicalX += vx;
    unit.logicalY += vy;
  }

  private performAttack(
    attacker: BattleUnitState,
    target: BattleUnitState
  ): void {
    const def = getUnitDefinition(attacker.unitId);
    if (!def) {
      return;
    }

    let baseDamage = def.base_stats.attack;
    if (def.skill.id === 'yamato_cannon' && attacker.attackCount % 4 === 0) {
      baseDamage = Math.round(baseDamage * 2.5);
      this.spawnEffect(
        'EXPLOSION',
        target.logicalX,
        target.logicalY,
        24,
        '#f97316',
        0.45
      );
    }

    const bonusVsArmoredPct =
      def.skill.id === 'phase_disruptor' ? 0.25 : 0;

    // Special Lurker subterranean line attack
    if (def.skill.id === 'burrow_spines') {
      this.spawnEffect(
        'SPINE_LINE',
        attacker.logicalX,
        attacker.logicalY,
        14,
        '#d8b4fe',
        0.35,
        target.logicalX,
        target.logicalY
      );
      this.applyLineSplashDamage(
        attacker,
        target.logicalX,
        target.logicalY,
        baseDamage,
        15
      );
      return;
    }

    // Special High Templar Psionic Storm on every 2nd attack
    if (def.skill.id === 'psionic_storm' && attacker.attackCount % 2 === 0) {
      const stormRadius = 1.9 * TILE_SIZE;
      this.spawnEffect(
        'PSI_STORM',
        target.logicalX,
        target.logicalY,
        stormRadius,
        '#38bdf8',
        0.55
      );
      this.applyAoEDamage(
        attacker.faction,
        target.logicalX,
        target.logicalY,
        stormRadius,
        Math.round(baseDamage * 1.25)
      );
      return;
    }

    // Ranged projectile attack
    if (def.visual.projectile_id) {
      const projDef = getProjectileDefinition(def.visual.projectile_id);
      if (projDef) {
        let splashRadiusPx = projDef.splash_radius * TILE_SIZE;
        if (
          attacker.faction === 'ALLY' &&
          this.hasSplashSynergy &&
          splashRadiusPx > 0
        ) {
          splashRadiusPx *= 1.2;
        }

        const bouncesLeft = def.skill.id === 'glave_wurm' ? 2 : 0;
        this.projectiles.push({
          id: this.nextProjectileId++,
          projectileId: projDef.projectile_id,
          sourceInstanceId: attacker.instanceId,
          sourceFaction: attacker.faction,
          x: attacker.logicalX,
          y: attacker.logicalY - 4,
          targetX: target.logicalX,
          targetY: target.logicalY,
          targetInstanceId: target.instanceId,
          damage: baseDamage,
          splashRadiusPx,
          speedPxPerSec: projDef.speed * TILE_SIZE,
          color: projDef.color,
          size: projDef.size,
          bouncesLeft,
          bonusVsArmoredPct,
          visitedIds: [target.instanceId],
        });
        return;
      }
    }

    // Melee direct hit
    const killed = this.applySingleTargetDamage(
      attacker,
      target,
      baseDamage,
      bonusVsArmoredPct
    );
    if (killed && def.skill.id === 'drone_siphon') {
      attacker.hp = Math.min(
        attacker.maxHp,
        attacker.hp + Math.round(attacker.maxHp * 0.2)
      );
      this.spawnEffect(
        'HEAL',
        attacker.logicalX,
        attacker.logicalY,
        10,
        '#a3e635',
        0.3
      );
    }

    // Firebat cone flame splash
    if (def.skill.id === 'flame_wave') {
      this.spawnEffect(
        'EXPLOSION',
        target.logicalX,
        target.logicalY,
        22,
        '#f97316',
        0.3
      );
      this.applyAoEDamage(
        attacker.faction,
        target.logicalX,
        target.logicalY,
        1.5 * TILE_SIZE,
        Math.round(baseDamage * 0.65),
        target.instanceId
      );
    }

    // Ultralisk Kaiser Blades cleave
    if (def.skill.id === 'kaiser_blades') {
      this.spawnEffect(
        'CLEAVE',
        target.logicalX,
        target.logicalY,
        26,
        '#f5f5f4',
        0.28
      );
      this.applyAoEDamage(
        attacker.faction,
        target.logicalX,
        target.logicalY,
        1.6 * TILE_SIZE,
        Math.round(baseDamage * 0.75),
        target.instanceId
      );
    }
  }

  private updateProjectiles(): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];

      // Track moving target if still alive
      if (proj.targetInstanceId) {
        const liveTarget = this.findUnitById(proj.targetInstanceId);
        if (liveTarget && liveTarget.hp > 0) {
          proj.targetX = liveTarget.logicalX;
          proj.targetY = liveTarget.logicalY;
        }
      }

      const dx = proj.targetX - proj.x;
      const dy = proj.targetY - proj.y;
      const dist = Math.hypot(dx, dy);
      const step = proj.speedPxPerSec * FIXED_DT;

      if (dist <= step + 2) {
        this.onProjectileImpact(proj);
        this.projectiles.splice(i, 1);
      } else {
        proj.x += (dx / dist) * step;
        proj.y += (dy / dist) * step;
      }
    }
  }

  private onProjectileImpact(proj: BattleProjectileState): void {
    const attacker = this.findUnitById(proj.sourceInstanceId);
    const primaryTarget = proj.targetInstanceId
      ? this.findUnitById(proj.targetInstanceId)
      : null;

    if (primaryTarget && primaryTarget.hp > 0) {
      this.applySingleTargetDamage(
        attacker,
        primaryTarget,
        proj.damage,
        proj.bonusVsArmoredPct
      );
    }

    if (proj.splashRadiusPx > 0) {
      this.spawnEffect(
        'EXPLOSION',
        proj.targetX,
        proj.targetY,
        proj.splashRadiusPx,
        proj.color,
        0.35
      );
      this.applyAoEDamage(
        proj.sourceFaction,
        proj.targetX,
        proj.targetY,
        proj.splashRadiusPx,
        Math.round(proj.damage * 0.65),
        primaryTarget?.instanceId
      );
    }

    // Mutalisk Glave Wurm bounce
    if (proj.bouncesLeft > 0) {
      const nextTarget = this.findBounceTarget(
        proj.sourceFaction,
        proj.targetX,
        proj.targetY,
        proj.visitedIds
      );
      if (nextTarget) {
        this.projectiles.push({
          ...proj,
          id: this.nextProjectileId++,
          x: proj.targetX,
          y: proj.targetY,
          targetX: nextTarget.logicalX,
          targetY: nextTarget.logicalY,
          targetInstanceId: nextTarget.instanceId,
          damage: Math.max(2, Math.round(proj.damage * 0.67)),
          bouncesLeft: proj.bouncesLeft - 1,
          visitedIds: [...proj.visitedIds, nextTarget.instanceId],
        });
      }
    }
  }

  private applySingleTargetDamage(
    attacker: BattleUnitState | null,
    target: BattleUnitState,
    damage: number,
    bonusVsArmoredPct: number = 0
  ): boolean {
    if (target.hp <= 0) {
      return false;
    }
    const tDef = getUnitDefinition(target.unitId);
    const armorType: ArmorType = tDef?.base_stats.armor_type ?? 'LIGHT';

    const res = calculateDamage({
      baseAttack: damage,
      targetArmorType: armorType,
      targetShield: target.shield,
      targetHp: target.hp,
      bonusVsArmoredPct,
    });

    target.shield = res.remainingShield;
    target.hp = res.remainingHp;

    if (res.killed) {
      target.action = 'DIE';
      this.spawnEffect(
        'EXPLOSION',
        target.logicalX,
        target.logicalY,
        14,
        target.faction === 'ALLY' ? '#38bdf8' : '#ef4444',
        0.35
      );
      if (attacker) {
        const aDef = getUnitDefinition(attacker.unitId);
        if (aDef?.skill.id === 'drone_siphon' && attacker.hp > 0) {
          attacker.hp = Math.min(
            attacker.maxHp,
            attacker.hp + Math.round(attacker.maxHp * 0.2)
          );
        }
      }
    }

    return res.killed;
  }

  private applyAoEDamage(
    attackerFaction: Faction,
    cx: number,
    cy: number,
    radiusPx: number,
    damage: number,
    excludeInstanceId?: string
  ): void {
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (
        u.faction === attackerFaction ||
        u.hp <= 0 ||
        u.instanceId === excludeInstanceId
      ) {
        continue;
      }
      const d = euclideanTileDistance(cx, cy, u.logicalX, u.logicalY);
      if (d <= radiusPx) {
        this.applySingleTargetDamage(null, u, damage, 0);
      }
    }
  }

  private applyLineSplashDamage(
    attacker: BattleUnitState,
    tx: number,
    ty: number,
    damage: number,
    corridorRadiusPx: number
  ): void {
    const x0 = attacker.logicalX;
    const y0 = attacker.logicalY;
    const vx = tx - x0;
    const vy = ty - y0;
    const len2 = Math.max(1, vx * vx + vy * vy);

    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (u.faction === attacker.faction || u.hp <= 0) {
        continue;
      }
      const wx = u.logicalX - x0;
      const wy = u.logicalY - y0;
      const t = Math.max(0, Math.min(1.15, (wx * vx + wy * vy) / len2));
      const px = x0 + t * vx;
      const py = y0 + t * vy;
      const dist = Math.hypot(u.logicalX - px, u.logicalY - py);
      if (dist <= corridorRadiusPx) {
        this.applySingleTargetDamage(attacker, u, damage, 0);
      }
    }
  }

  private findNearestEnemy(source: BattleUnitState): BattleUnitState | null {
    let nearest: BattleUnitState | null = null;
    let bestDist = Infinity;

    for (let i = 0; i < this.units.length; i++) {
      const candidate = this.units[i];
      if (candidate.faction === source.faction || candidate.hp <= 0) {
        continue;
      }
      const d = euclideanTileDistance(
        source.logicalX,
        source.logicalY,
        candidate.logicalX,
        candidate.logicalY
      );
      if (d < bestDist) {
        bestDist = d;
        nearest = candidate;
      }
    }
    return nearest;
  }

  private findBounceTarget(
    sourceFaction: Faction,
    fromX: number,
    fromY: number,
    visitedIds: readonly string[]
  ): BattleUnitState | null {
    let best: BattleUnitState | null = null;
    let bestDist = 3.2 * TILE_SIZE;

    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (
        u.faction === sourceFaction ||
        u.hp <= 0 ||
        visitedIds.includes(u.instanceId)
      ) {
        continue;
      }
      const d = euclideanTileDistance(fromX, fromY, u.logicalX, u.logicalY);
      if (d < bestDist) {
        bestDist = d;
        best = u;
      }
    }
    return best;
  }

  private findClusterCenter(targetFaction: Faction): { x: number; y: number } | null {
    let bestUnit: BattleUnitState | null = null;
    let bestNeighbors = -1;

    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (u.faction !== targetFaction || u.hp <= 0) {
        continue;
      }
      let neighbors = 0;
      for (let j = 0; j < this.units.length; j++) {
        const other = this.units[j];
        if (other.faction !== targetFaction || other.hp <= 0) {
          continue;
        }
        if (
          euclideanTileDistance(
            u.logicalX,
            u.logicalY,
            other.logicalX,
            other.logicalY
          ) <=
          2.5 * TILE_SIZE
        ) {
          neighbors += 1;
        }
      }
      if (neighbors > bestNeighbors) {
        bestNeighbors = neighbors;
        bestUnit = u;
      }
    }

    return bestUnit ? { x: bestUnit.logicalX, y: bestUnit.logicalY } : null;
  }

  private findUnitById(instanceId: string): BattleUnitState | null {
    for (let i = 0; i < this.units.length; i++) {
      if (this.units[i].instanceId === instanceId) {
        return this.units[i];
      }
    }
    return null;
  }

  private checkObjectiveDestroyed(): boolean {
    if (this.mode === 'DEFENSE') {
      for (let i = 0; i < this.units.length; i++) {
        const u = this.units[i];
        if (u.isObjectiveStructure && u.faction === 'ALLY' && u.hp <= 0) {
          return true;
        }
      }
      return false;
    }
    if (this.mode === 'BREAKTHROUGH') {
      for (let i = 0; i < this.units.length; i++) {
        const u = this.units[i];
        if (u.isObjectiveStructure && u.faction === 'ENEMY' && u.hp <= 0) {
          return true;
        }
      }
      return false;
    }
    return false;
  }

  private spawnEffect(
    type: BattleEffectType,
    x: number,
    y: number,
    radiusPx: number,
    color: string,
    ttlSec: number,
    endX?: number,
    endY?: number
  ): void {
    this.effects.push({
      id: this.nextEffectId++,
      type,
      x,
      y,
      endX,
      endY,
      radiusPx,
      color,
      ttlSec,
      maxTtlSec: ttlSec,
    });
  }

  private updateEffects(): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].ttlSec -= FIXED_DT;
      if (this.effects[i].ttlSec <= 0) {
        this.effects.splice(i, 1);
      }
    }
  }

  public getSnapshot(): BattleSnapshot {
    return {
      tick: this.tickCount,
      elapsedSec: this.elapsedSec,
      timeLimitSec: this.timeLimitSec,
      mode: this.mode,
      outcome: this.outcome,
      commanderSkillUsed: this.commanderSkillUsed,
      units: this.units,
      projectiles: this.projectiles,
      effects: this.effects,
    };
  }
}
