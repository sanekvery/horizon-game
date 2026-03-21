/**
 * Experience Value Object
 *
 * Handles XP calculations, level progression, and skill points.
 * Immutable - all modifications return new instances.
 */

export type XPReason =
  | 'RESOURCE_CONTRIBUTE'
  | 'VOTE_CAST'
  | 'VOTE_WIN'
  | 'ZONE_UPGRADE'
  | 'PROMISE_FULFILLED'
  | 'GAME_COMPLETE'
  | 'GAME_WIN';

export interface XPReward {
  readonly reason: XPReason;
  readonly baseAmount: number;
  readonly description: string;
}

export const XP_REWARDS: Record<XPReason, XPReward> = {
  RESOURCE_CONTRIBUTE: {
    reason: 'RESOURCE_CONTRIBUTE',
    baseAmount: 5,
    description: 'Внесение ресурсов в зону',
  },
  VOTE_CAST: {
    reason: 'VOTE_CAST',
    baseAmount: 10,
    description: 'Участие в голосовании',
  },
  VOTE_WIN: {
    reason: 'VOTE_WIN',
    baseAmount: 25,
    description: 'Победа в голосовании',
  },
  ZONE_UPGRADE: {
    reason: 'ZONE_UPGRADE',
    baseAmount: 50,
    description: 'Улучшение зоны',
  },
  PROMISE_FULFILLED: {
    reason: 'PROMISE_FULFILLED',
    baseAmount: 30,
    description: 'Выполнение обещания',
  },
  GAME_COMPLETE: {
    reason: 'GAME_COMPLETE',
    baseAmount: 100,
    description: 'Завершение игры',
  },
  GAME_WIN: {
    reason: 'GAME_WIN',
    baseAmount: 200,
    description: 'Победа команды',
  },
};

export const POINTS_PER_LEVEL = 2;

export class Experience {
  private constructor(
    private readonly totalXP: number,
    private readonly unspentPoints: number = 0
  ) {
    if (totalXP < 0) {
      throw new Error('Total XP cannot be negative');
    }
    if (unspentPoints < 0) {
      throw new Error('Unspent points cannot be negative');
    }
  }

  static create(totalXP: number = 0, unspentPoints: number = 0): Experience {
    return new Experience(totalXP, unspentPoints);
  }

  static fromLevel(level: number): Experience {
    const xp = Experience.xpRequiredForLevel(level);
    return new Experience(xp);
  }

  /**
   * Calculate XP required to reach a specific level.
   * Formula: sum(100 * i) for i from 1 to level = 100 * level * (level + 1) / 2
   *
   * Level 1: 100 XP
   * Level 2: 300 XP total
   * Level 3: 600 XP total
   * Level 5: 1500 XP total
   * Level 10: 5500 XP total
   */
  static xpRequiredForLevel(level: number): number {
    if (level <= 0) return 0;
    return (100 * level * (level + 1)) / 2;
  }

  /**
   * Calculate XP needed for just the current level (not total).
   * Example: Level 3 requires 300 XP (from level 2 to 3)
   */
  static xpForCurrentLevel(level: number): number {
    if (level <= 0) return 0;
    return 100 * level;
  }

  /**
   * Calculate level from total XP.
   */
  static calculateLevel(totalXP: number): number {
    if (totalXP <= 0) return 0;

    let level = 0;
    let xpNeeded = 0;

    while (xpNeeded <= totalXP) {
      level++;
      xpNeeded += 100 * level;
    }

    return level - 1;
  }

  /**
   * Calculate XP reward for resource contribution.
   * More resources = more XP (capped at 20 XP per action)
   */
  static calculateResourceXP(amount: number): number {
    const base = XP_REWARDS.RESOURCE_CONTRIBUTE.baseAmount;
    const bonus = Math.min(amount - 1, 3); // 0-3 bonus based on amount
    return Math.min(base + bonus * 5, 20);
  }

  get total(): number {
    return this.totalXP;
  }

  get level(): number {
    return Experience.calculateLevel(this.totalXP);
  }

  get availablePoints(): number {
    return this.unspentPoints;
  }

  /**
   * XP progress within current level (0-100%)
   */
  get progressInCurrentLevel(): number {
    const currentLevel = this.level;
    const xpForCurrentLevel = Experience.xpRequiredForLevel(currentLevel);
    const xpForNextLevel = Experience.xpRequiredForLevel(currentLevel + 1);
    const xpInLevel = this.totalXP - xpForCurrentLevel;
    const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel;

    if (xpNeededForLevel === 0) return 100;
    return Math.floor((xpInLevel / xpNeededForLevel) * 100);
  }

  /**
   * XP remaining until next level
   */
  get xpUntilNextLevel(): number {
    const nextLevelXP = Experience.xpRequiredForLevel(this.level + 1);
    return Math.max(0, nextLevelXP - this.totalXP);
  }

  /**
   * Add XP and return new Experience with updated level and points.
   * Returns tuple: [newExperience, levelsGained]
   */
  addXP(amount: number): [Experience, number] {
    if (amount <= 0) {
      return [this, 0];
    }

    const previousLevel = this.level;
    const newTotalXP = this.totalXP + amount;
    const newLevel = Experience.calculateLevel(newTotalXP);
    const levelsGained = newLevel - previousLevel;
    const newPoints = this.unspentPoints + levelsGained * POINTS_PER_LEVEL;

    return [new Experience(newTotalXP, newPoints), levelsGained];
  }

  /**
   * Spend skill points.
   */
  spendPoints(amount: number): Experience {
    if (amount <= 0) {
      return this;
    }
    if (amount > this.unspentPoints) {
      throw new Error(`Not enough points. Have ${this.unspentPoints}, trying to spend ${amount}`);
    }

    return new Experience(this.totalXP, this.unspentPoints - amount);
  }

  /**
   * Check if player can spend points.
   */
  canSpendPoints(amount: number): boolean {
    return amount > 0 && amount <= this.unspentPoints;
  }

  toJSON(): { totalXP: number; unspentPoints: number; level: number } {
    return {
      totalXP: this.totalXP,
      unspentPoints: this.unspentPoints,
      level: this.level,
    };
  }

  toString(): string {
    return `Level ${this.level} (${this.totalXP} XP, ${this.unspentPoints} points)`;
  }

  equals(other: Experience): boolean {
    return this.totalXP === other.totalXP && this.unspentPoints === other.unspentPoints;
  }
}
