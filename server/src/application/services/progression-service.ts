/**
 * Progression Service
 *
 * Application service for managing character progression,
 * experience points, and stat allocation.
 */

import { PrismaClient } from '@prisma/client';
import {
  CharacterStats,
  CharacterStatsData,
  StatName,
  MAX_STAT_VALUE_WITH_PROGRESSION,
} from '../../domain/entities/character-stats.js';
import { Experience, XPReason, XP_REWARDS, POINTS_PER_LEVEL } from '../../domain/entities/experience.js';
import { ProgressionCalculator } from '../../domain/services/progression-calculator.js';

export interface PlayerProgression {
  readonly playerIdentifier: string;
  readonly roleId: number;
  readonly stats: CharacterStats;
  readonly experience: Experience;
  readonly totalGames: number;
  readonly achievements: string[];
}

export interface XPGainResult {
  readonly previousXP: number;
  readonly xpGained: number;
  readonly newXP: number;
  readonly previousLevel: number;
  readonly newLevel: number;
  readonly leveledUp: boolean;
  readonly newAvailablePoints: number;
}

export interface StatAllocationResult {
  readonly success: boolean;
  readonly error?: string;
  readonly newStats?: CharacterStatsData;
  readonly remainingPoints?: number;
}

export interface SessionPlayerStats {
  readonly roleId: number;
  readonly playerName: string | null;
  readonly stats: CharacterStatsData;
  readonly experienceGained: number;
  readonly level: number;
}

export class ProgressionService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get player stats for a session.
   */
  async getSessionPlayerStats(
    sessionCode: string,
    roleId: number
  ): Promise<SessionPlayerStats | null> {
    const session = await this.prisma.gameSession.findUnique({
      where: { code: sessionCode },
      include: {
        players: {
          where: { roleId },
        },
      },
    });

    if (!session || session.players.length === 0) {
      return null;
    }

    const player = session.players[0];
    const stats = player.stats as unknown as CharacterStatsData;
    const experience = Experience.create(player.experienceGained);

    return {
      roleId: player.roleId,
      playerName: player.playerName,
      stats,
      experienceGained: player.experienceGained,
      level: experience.level,
    };
  }

  /**
   * Get all players' stats for a session.
   */
  async getAllSessionPlayerStats(sessionCode: string): Promise<SessionPlayerStats[]> {
    const session = await this.prisma.gameSession.findUnique({
      where: { code: sessionCode },
      include: {
        players: true,
      },
    });

    if (!session) {
      return [];
    }

    return session.players.map((player) => {
      const stats = player.stats as unknown as CharacterStatsData;
      const experience = Experience.create(player.experienceGained);

      return {
        roleId: player.roleId,
        playerName: player.playerName,
        stats,
        experienceGained: player.experienceGained,
        level: experience.level,
      };
    });
  }

  /**
   * Award XP to a player in a session.
   */
  async awardXP(
    sessionCode: string,
    roleId: number,
    reason: XPReason,
    additionalAmount: number = 0
  ): Promise<XPGainResult | null> {
    const session = await this.prisma.gameSession.findUnique({
      where: { code: sessionCode },
      include: {
        players: {
          where: { roleId },
        },
      },
    });

    if (!session || session.players.length === 0) {
      return null;
    }

    // Check if progression is enabled for this session
    if (!session.progressionEnabled) {
      return null;
    }

    const player = session.players[0];
    const currentXP = player.experienceGained;
    const baseXP = XP_REWARDS[reason]?.baseAmount ?? 0;
    const xpGained = baseXP + additionalAmount;

    const currentExperience = Experience.create(currentXP);
    const previousLevel = currentExperience.level;

    const [newExperience, levelsGained] = currentExperience.addXP(xpGained);
    const newXP = newExperience.total;
    const newLevel = newExperience.level;

    // Update player's experience in database
    await this.prisma.sessionPlayer.update({
      where: { id: player.id },
      data: { experienceGained: newXP },
    });

    return {
      previousXP: currentXP,
      xpGained,
      newXP,
      previousLevel,
      newLevel,
      leveledUp: levelsGained > 0,
      newAvailablePoints: levelsGained * POINTS_PER_LEVEL,
    };
  }

  /**
   * Award XP for resource contribution.
   * Amount affects the XP gained.
   */
  async awardResourceContributionXP(
    sessionCode: string,
    roleId: number,
    amount: number
  ): Promise<XPGainResult | null> {
    const additionalXP = Experience.calculateResourceXP(amount) - XP_REWARDS.RESOURCE_CONTRIBUTE.baseAmount;
    return this.awardXP(sessionCode, roleId, 'RESOURCE_CONTRIBUTE', additionalXP);
  }

  /**
   * Get or create persistent player progression.
   * Used for tracking progress across multiple games.
   */
  async getPlayerProgression(
    facilitatorId: string,
    playerIdentifier: string,
    roleId: number
  ): Promise<PlayerProgression | null> {
    const progress = await this.prisma.characterProgress.findUnique({
      where: {
        facilitatorId_playerIdentifier_roleId: {
          facilitatorId,
          playerIdentifier,
          roleId,
        },
      },
    });

    if (!progress) {
      return null;
    }

    const stats = CharacterStats.fromJSON(progress.stats as unknown as CharacterStatsData);
    const experience = Experience.create(progress.totalExperience);

    return {
      playerIdentifier,
      roleId,
      stats,
      experience,
      totalGames: progress.totalGames,
      achievements: progress.achievements as string[],
    };
  }

  /**
   * Create or update persistent player progression.
   */
  async savePlayerProgression(
    facilitatorId: string,
    playerIdentifier: string,
    roleId: number,
    sessionXPGained: number
  ): Promise<PlayerProgression> {
    const existing = await this.prisma.characterProgress.findUnique({
      where: {
        facilitatorId_playerIdentifier_roleId: {
          facilitatorId,
          playerIdentifier,
          roleId,
        },
      },
    });

    if (existing) {
      const updated = await this.prisma.characterProgress.update({
        where: { id: existing.id },
        data: {
          totalGames: { increment: 1 },
          totalExperience: { increment: sessionXPGained },
        },
      });

      const stats = CharacterStats.fromJSON(updated.stats as unknown as CharacterStatsData);
      const experience = Experience.create(updated.totalExperience);

      return {
        playerIdentifier,
        roleId,
        stats,
        experience,
        totalGames: updated.totalGames,
        achievements: updated.achievements as string[],
      };
    }

    const created = await this.prisma.characterProgress.create({
      data: {
        facilitatorId,
        playerIdentifier,
        roleId,
        totalGames: 1,
        totalExperience: sessionXPGained,
        stats: CharacterStats.createDefault().toJSON() as unknown as Record<string, number>,
        achievements: [],
      },
    });

    const stats = CharacterStats.fromJSON(created.stats as unknown as CharacterStatsData);
    const experience = Experience.create(created.totalExperience);

    return {
      playerIdentifier,
      roleId,
      stats,
      experience,
      totalGames: created.totalGames,
      achievements: created.achievements as string[],
    };
  }

  /**
   * Allocate stat points for persistent progression.
   */
  async allocateStatPoints(
    facilitatorId: string,
    playerIdentifier: string,
    roleId: number,
    statName: StatName,
    points: number
  ): Promise<StatAllocationResult> {
    if (points <= 0) {
      return { success: false, error: 'Points must be positive' };
    }

    const progress = await this.prisma.characterProgress.findUnique({
      where: {
        facilitatorId_playerIdentifier_roleId: {
          facilitatorId,
          playerIdentifier,
          roleId,
        },
      },
    });

    if (!progress) {
      return { success: false, error: 'Player progression not found' };
    }

    const experience = Experience.create(progress.totalExperience);
    const currentStats = CharacterStats.fromJSON(progress.stats as unknown as CharacterStatsData);

    // Calculate available points based on level
    const totalPointsFromLevels = experience.level * POINTS_PER_LEVEL;
    const spentPoints = currentStats.getTotalPoints() - 30; // 30 = 6 stats * 5 default
    const availablePoints = totalPointsFromLevels - spentPoints;

    if (points > availablePoints) {
      return {
        success: false,
        error: `Not enough points. Available: ${availablePoints}, requested: ${points}`,
      };
    }

    if (!currentStats.canIncrease(statName, MAX_STAT_VALUE_WITH_PROGRESSION)) {
      return {
        success: false,
        error: `${statName} is already at maximum`,
      };
    }

    // Check if we can increase by the requested amount
    const currentValue = currentStats.getStat(statName);
    const maxIncrease = MAX_STAT_VALUE_WITH_PROGRESSION - currentValue;
    const actualIncrease = Math.min(points, maxIncrease);

    if (actualIncrease <= 0) {
      return {
        success: false,
        error: `Cannot increase ${statName} any further`,
      };
    }

    const newStats = currentStats.withIncreasedStat(statName, actualIncrease);

    await this.prisma.characterProgress.update({
      where: { id: progress.id },
      data: {
        stats: newStats.toJSON() as unknown as Record<string, number>,
      },
    });

    const newAvailablePoints = availablePoints - actualIncrease;

    return {
      success: true,
      newStats: newStats.toJSON(),
      remainingPoints: newAvailablePoints,
    };
  }

  /**
   * Get resource contribution bonus for a player.
   */
  getResourceContributionBonus(stats: CharacterStatsData, amount: number) {
    const characterStats = CharacterStats.fromJSON(stats);
    return ProgressionCalculator.calculateResourceContributionBonus(characterStats, amount);
  }

  /**
   * Get vote influence for a player.
   */
  getVoteInfluence(stats: CharacterStatsData) {
    const characterStats = CharacterStats.fromJSON(stats);
    return ProgressionCalculator.calculateVoteInfluence(characterStats);
  }

  /**
   * Check if session has progression enabled.
   */
  async isProgressionEnabled(sessionCode: string): Promise<boolean> {
    const session = await this.prisma.gameSession.findUnique({
      where: { code: sessionCode },
      select: { progressionEnabled: true },
    });

    return session?.progressionEnabled ?? false;
  }

  /**
   * Enable/disable progression for a session.
   */
  async setProgressionEnabled(sessionCode: string, enabled: boolean): Promise<void> {
    await this.prisma.gameSession.update({
      where: { code: sessionCode },
      data: { progressionEnabled: enabled },
    });
  }
}
