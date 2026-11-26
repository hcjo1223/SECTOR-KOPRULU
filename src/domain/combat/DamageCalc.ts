import type { ArmorType } from '../types';

export interface DamageInput {
  baseAttack: number;
  targetArmorType: ArmorType;
  targetShield: number;
  targetHp: number;
  bonusVsArmoredPct?: number;
}

export interface DamageResult {
  shieldDamage: number;
  hpDamage: number;
  remainingShield: number;
  remainingHp: number;
  killed: boolean;
}

export function calculateDamage(input: DamageInput): DamageResult {
  let effectiveAttack = input.baseAttack;
  if (input.targetArmorType === 'ARMORED' && input.bonusVsArmoredPct) {
    effectiveAttack = Math.round(effectiveAttack * (1 + input.bonusVsArmoredPct));
  }

  const shieldDamage = Math.min(input.targetShield, effectiveAttack);
  const leftover = effectiveAttack - shieldDamage;
  const hpDamage = Math.min(input.targetHp, leftover);

  const remainingShield = Math.max(0, input.targetShield - shieldDamage);
  const remainingHp = Math.max(0, input.targetHp - hpDamage);

  return {
    shieldDamage,
    hpDamage,
    remainingShield,
    remainingHp,
    killed: remainingHp <= 0,
  };
}
