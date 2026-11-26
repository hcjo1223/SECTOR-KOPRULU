import { MAX_UNIT_LEVEL } from '../domain/survivor/SurvivorEngine';
import { getSquadUnitDef } from '../domain/survivor/SurvivorCatalog';
import type { AttackStyle, LevelUpOffer, TargetingMode } from '../domain/survivor/types';

export const TARGETING_LABEL: Record<TargetingMode, string> = {
  AUTO: '자동 조준',
  FACING: '지휘관 방향',
};

export const STYLE_LABEL: Record<AttackStyle, string> = {
  PROJECTILE: '사격',
  PIERCE: '관통',
  MELEE: '근접',
  CONE: '원뿔 광역',
  PULSE: '주변 파동',
  HEAL: '치유',
};

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export interface OfferText {
  tag: string;
  title: string;
  body: string;
  unitId?: string;
}

export function describeOffer(offer: LevelUpOffer): OfferText {
  switch (offer.kind) {
    case 'RECRUIT': {
      const u = getSquadUnitDef(offer.unitId);
      return {
        tag: '신규 합류',
        title: u.name,
        body: `[${TARGETING_LABEL[u.attack.targeting]} · ${STYLE_LABEL[u.attack.style]}] ${u.description}`,
        unitId: u.id,
      };
    }
    case 'UPGRADE': {
      const u = getSquadUnitDef(offer.unitId);
      return {
        tag: `부대 강화 Lv${offer.nextLevel}/${MAX_UNIT_LEVEL}`,
        title: `${u.name} 강화`,
        body: '같은 종류 부대원 전원의 피해량 +25%, 공격 주기 -8%.',
        unitId: u.id,
      };
    }
    case 'EXPAND':
      return {
        tag: '진형 확장',
        title: `${offer.nextRing}링 개방`,
        body: `부대 정원이 늘어난다. (링 ${offer.nextRing}: +${offer.nextRing * 6}칸)`,
      };
    case 'COMMANDER': {
      const map = {
        HP: ['강화 장갑', '지휘관 최대 체력 +25.'],
        SPEED: ['기동 훈련', '부대 전체 이동속도 +8%.'],
        MAGNET: ['수집 비콘', '경험치 결정 흡수 반경 +16.'],
        REGEN: ['자가 수복', '지휘관 체력 초당 +0.8 재생.'],
      } as const;
      const [title, body] = map[offer.stat];
      return { tag: '지휘관 강화', title, body };
    }
    case 'RESUPPLY':
      return { tag: '긴급 보급', title: '전원 회복', body: '지휘관과 부대원 전원의 체력·보호막을 완전히 회복한다.' };
  }
}
