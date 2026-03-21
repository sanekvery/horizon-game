/**
 * Progression Calculator
 *
 * Pure domain service that calculates bonuses and effects
 * based on character stats. No side effects, no dependencies.
 */

import { CharacterStats, DEFAULT_STAT_VALUE } from '../entities/character-stats.js';

export interface ResourceContributionBonus {
  readonly multiplier: number;
  readonly effectiveAmount: number;
  readonly bonusAmount: number;
}

export interface EventMitigationResult {
  readonly mitigateChance: number;
  readonly mitigated: boolean;
  readonly reducedDamage: number;
}

export interface TradeBonus {
  readonly bonusPercentage: number;
  readonly effectiveAmount: number;
}

export interface VoteInfluence {
  readonly weight: number;
  readonly effectiveVotes: number;
}

export interface DiscoveryBonus {
  readonly discoveryChance: number;
  readonly bonusResourceChance: number;
}

export class ProgressionCalculator {
  /**
   * Calculate bonus for contributing resources to a zone.
   * Craft stat increases effectiveness.
   *
   * Formula: effectiveAmount = amount * (1 + craft / 20)
   * - craft = 5: multiplier 1.25 (25% bonus)
   * - craft = 10: multiplier 1.5 (50% bonus)
   * - craft = 15: multiplier 1.75 (75% bonus)
   */
  static calculateResourceContributionBonus(
    stats: CharacterStats,
    amount: number
  ): ResourceContributionBonus {
    const multiplier = 1 + stats.craft / 20;
    const effectiveAmount = Math.floor(amount * multiplier);
    const bonusAmount = effectiveAmount - amount;

    return {
      multiplier,
      effectiveAmount,
      bonusAmount,
    };
  }

  /**
   * Calculate chance to mitigate damage from negative events.
   * Strength stat provides protection.
   *
   * Formula: mitigateChance = strength * 5%
   * - strength = 5: 25% chance
   * - strength = 10: 50% chance
   * - strength = 15: 75% chance
   *
   * If mitigated, damage is reduced by 50%.
   */
  static calculateEventMitigation(
    stats: CharacterStats,
    baseDamage: number,
    randomValue?: number
  ): EventMitigationResult {
    const mitigateChance = stats.strength * 0.05;
    const roll = randomValue ?? Math.random();
    const mitigated = roll < mitigateChance;
    const reducedDamage = mitigated ? Math.floor(baseDamage * 0.5) : baseDamage;

    return {
      mitigateChance,
      mitigated,
      reducedDamage,
    };
  }

  /**
   * Calculate bonus for trading resources.
   * Negotiation stat improves trade rates.
   *
   * Formula: bonusPercentage = negotiation * 2%
   * - negotiation = 5: +10%
   * - negotiation = 10: +20%
   * - negotiation = 15: +30%
   */
  static calculateTradeBonus(
    stats: CharacterStats,
    baseAmount: number
  ): TradeBonus {
    const bonusPercentage = stats.negotiation * 0.02;
    const effectiveAmount = Math.floor(baseAmount * (1 + bonusPercentage));

    return {
      bonusPercentage,
      effectiveAmount,
    };
  }

  /**
   * Calculate vote influence based on charisma.
   * Higher charisma = more influential votes.
   *
   * Formula: weight = 1 + (charisma - 5) * 0.1
   * - charisma = 5: weight 1.0 (neutral)
   * - charisma = 10: weight 1.5
   * - charisma = 15: weight 2.0
   * - charisma = 1: weight 0.6
   */
  static calculateVoteInfluence(
    stats: CharacterStats,
    baseVotes: number = 1
  ): VoteInfluence {
    const weight = 1 + (stats.charisma - DEFAULT_STAT_VALUE) * 0.1;
    const effectiveVotes = Math.max(0.1, baseVotes * weight);

    return {
      weight,
      effectiveVotes,
    };
  }

  /**
   * Calculate discovery bonus for exploring unknown zone.
   * Intellect improves discovery chances.
   *
   * Formula: discoveryChance = min(intellect * 10%, 100%)
   * - intellect = 5: 50% chance
   * - intellect = 10: 100% chance
   *
   * Bonus resources chance scales with intellect above 10.
   */
  static calculateDiscoveryBonus(stats: CharacterStats): DiscoveryBonus {
    const discoveryChance = Math.min(stats.intellect * 0.1, 1);
    // Bonus resources for high intellect
    const bonusResourceChance = stats.intellect > 10 ? (stats.intellect - 10) * 0.1 : 0;

    return {
      discoveryChance,
      bonusResourceChance,
    };
  }

  /**
   * Calculate agility-based action speed bonus.
   * Higher agility = faster action completion.
   *
   * Formula: speedMultiplier = 1 + (agility - 5) * 0.05
   * - agility = 5: 1.0x (normal)
   * - agility = 10: 1.25x (25% faster)
   * - agility = 15: 1.5x (50% faster)
   */
  static calculateActionSpeedBonus(stats: CharacterStats): number {
    return 1 + (stats.agility - DEFAULT_STAT_VALUE) * 0.05;
  }

  /**
   * Calculate reduced timer duration based on agility.
   * Used for personal cooldowns or action timers.
   */
  static calculateReducedDuration(
    stats: CharacterStats,
    baseDurationSec: number
  ): number {
    const speedMultiplier = this.calculateActionSpeedBonus(stats);
    return Math.floor(baseDurationSec / speedMultiplier);
  }

  /**
   * Check if player qualifies for stat-based special action.
   */
  static meetsStatRequirement(
    stats: CharacterStats,
    statName: keyof CharacterStats,
    requiredValue: number
  ): boolean {
    const value = stats[statName as 'strength' | 'agility' | 'negotiation' | 'intellect' | 'charisma' | 'craft'];
    return typeof value === 'number' && value >= requiredValue;
  }

  /**
   * Get dominant stat (highest value).
   */
  static getDominantStat(stats: CharacterStats): {
    name: string;
    value: number;
  } {
    const statValues = [
      { name: 'strength', value: stats.strength },
      { name: 'agility', value: stats.agility },
      { name: 'negotiation', value: stats.negotiation },
      { name: 'intellect', value: stats.intellect },
      { name: 'charisma', value: stats.charisma },
      { name: 'craft', value: stats.craft },
    ];

    return statValues.reduce((max, current) =>
      current.value > max.value ? current : max
    );
  }
}
