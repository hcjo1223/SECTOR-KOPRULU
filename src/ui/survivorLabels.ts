import { MAX_MODULE_LEVEL, MAX_SQUAD_LEVEL, squadHeadcount } from '../domain/survivor/SurvivorEngine';
import { getModuleDef, getSquadUnitDef } from '../domain/survivor/SurvivorCatalog';
import type { AttackStyle, FormationRole, LevelUpOffer, ModuleId, SquadUnitDef, TargetingMode } from '../domain/survivor/types';

export const TARGETING_LABEL: Record<TargetingMode, string> = {
  AUTO: '자동',
  FACING: '방향',
};

export const TARGETING_ICON: Record<TargetingMode, string> = {
  AUTO: '◎',
  FACING: '➤',
};

export const ROLE_LABEL: Record<FormationRole, string> = {
  FRONT: '전열',
  BACK: '후열',
};

export const STYLE_LABEL: Record<AttackStyle, string> = {
  PROJECTILE: '사격',
  PIERCE: '관통',
  MELEE: '근접',
  CONE: '원뿔',
  PULSE: '파동',
  HEAL: '치유',
  CHAIN: '연쇄',
  TURRET: '포탑',
};

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** 카드 상단 아이콘 줄: "◎ 자동 · 사격 · 후열" */
export function unitTagLine(def: SquadUnitDef): string {
  const a = def.attack;
  return `${TARGETING_ICON[a.targeting]} ${TARGETING_LABEL[a.targeting]} · ${STYLE_LABEL[a.style]} · ${ROLE_LABEL[def.role]}`;
}

/** "＋ 고속 장전 → 개틀링 분대" */
export function evolutionHint(def: SquadUnitDef): string | null {
  if (!def.evolution) {
    return null;
  }
  return `Lv${MAX_SQUAD_LEVEL} + ${getModuleDef(def.evolution.moduleId).name} → ${getSquadUnitDef(def.evolution.intoId).name}`;
}

/** 이 모듈로 진화하는 분대 이름들 (진영 풀 기준) */
export function unitsEvolvedBy(moduleId: ModuleId, pool: readonly string[]): string[] {
  return pool.map((id) => getSquadUnitDef(id)).filter((u) => u.evolution?.moduleId === moduleId).map((u) => u.name);
}

export interface OfferText {
  tag: string;
  title: string;
  tagLine?: string;
  body: string;
  hint?: string;
  unitId?: string;
  moduleId?: ModuleId;
}

export function describeOffer(offer: LevelUpOffer, pool: readonly string[] = []): OfferText {
  switch (offer.kind) {
    case 'NEW_SQUAD': {
      const u = getSquadUnitDef(offer.unitId);
      return {
        tag: '신규 분대',
        title: u.name,
        tagLine: unitTagLine(u),
        body: `${u.summary} (${squadHeadcount(1)}명 합류)`,
        hint: evolutionHint(u) ?? undefined,
        unitId: u.id,
      };
    }
    case 'SQUAD_LEVEL': {
      const u = getSquadUnitDef(offer.unitId);
      return {
        tag: `분대 Lv${offer.nextLevel}/${MAX_SQUAD_LEVEL}`,
        title: u.name,
        tagLine: unitTagLine(u),
        body: `정원 ${squadHeadcount(offer.nextLevel)}명 (+1명 합류), 피해량 +12%.`,
        hint: offer.nextLevel === MAX_SQUAD_LEVEL ? `${evolutionHint(u) ?? ''} (보급 상자로 진화 → Lv1부터 다시)` : evolutionHint(u) ?? undefined,
        unitId: u.id,
      };
    }
    case 'NEW_MODULE':
    case 'MODULE_LEVEL': {
      const m = getModuleDef(offer.moduleId);
      const evolves = unitsEvolvedBy(offer.moduleId, pool);
      return {
        tag: offer.kind === 'NEW_MODULE' ? '신규 모듈' : `모듈 Lv${offer.nextLevel}/${MAX_MODULE_LEVEL}`,
        title: m.name,
        tagLine: `⚙ 모듈 · ${m.summary}`,
        body: m.perLevel,
        hint: evolves.length > 0 ? `진화 재료: ${evolves.join(', ')}` : undefined,
        moduleId: m.id,
      };
    }
    case 'REINFORCE':
      return { tag: '증원', title: '결원 보충', body: `전사한 부대원 ${offer.missing}명을 모든 분대에 다시 채운다.` };
    case 'OVERCHARGE':
      return { tag: `과충전 ×${offer.stacks}`, title: '부대 과충전', body: '모든 슬롯이 최대치. 부대 전체 피해량 +3% (중첩).' };
    case 'RESUPPLY':
      return { tag: '긴급 보급', title: '전원 회복', body: '지휘관과 부대원 전원의 체력·보호막을 완전히 회복한다.' };
  }
}
