/**
 * Progression API Routes
 *
 * Endpoints for character progression, XP, and stats management.
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { ProgressionService } from '../../application/services/progression-service.js';
import type { StatName, CharacterStatsData } from '../../domain/entities/character-stats.js';

export function createProgressionRoutes(prisma: PrismaClient): Router {
  const router = Router();
  const progressionService = new ProgressionService(prisma);

  /**
   * Get player stats for a session.
   * GET /api/progression/session/:code/player/:roleId
   */
  router.get('/session/:code/player/:roleId', async (req, res) => {
    const { code, roleId } = req.params;
    const roleIdNum = parseInt(roleId, 10);

    if (isNaN(roleIdNum)) {
      res.status(400).json({ success: false, error: 'Invalid roleId' });
      return;
    }

    const stats = await progressionService.getSessionPlayerStats(code, roleIdNum);

    if (!stats) {
      res.status(404).json({ success: false, error: 'Player not found in session' });
      return;
    }

    res.json({ success: true, stats });
  });

  /**
   * Get all players' stats for a session.
   * GET /api/progression/session/:code/players
   */
  router.get('/session/:code/players', async (req, res) => {
    const { code } = req.params;
    const stats = await progressionService.getAllSessionPlayerStats(code);

    res.json({ success: true, players: stats });
  });

  /**
   * Check if progression is enabled for a session.
   * GET /api/progression/session/:code/enabled
   */
  router.get('/session/:code/enabled', async (req, res) => {
    const { code } = req.params;
    const enabled = await progressionService.isProgressionEnabled(code);

    res.json({ success: true, enabled });
  });

  /**
   * Enable/disable progression for a session.
   * POST /api/progression/session/:code/enabled
   * Body: { enabled: boolean }
   * Requires facilitator auth (JWT)
   */
  router.post('/session/:code/enabled', async (req, res) => {
    const { code } = req.params;
    const { enabled } = req.body as { enabled?: boolean };

    if (typeof enabled !== 'boolean') {
      res.status(400).json({ success: false, error: 'enabled must be a boolean' });
      return;
    }

    try {
      await progressionService.setProgressionEnabled(code, enabled);
      res.json({ success: true, enabled });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update progression setting',
      });
    }
  });

  /**
   * Get persistent player progression.
   * GET /api/progression/player/:identifier/role/:roleId
   * Requires facilitator auth
   */
  router.get('/player/:identifier/role/:roleId', async (req, res) => {
    const facilitatorId = req.headers['x-facilitator-id'] as string;

    if (!facilitatorId) {
      res.status(401).json({ success: false, error: 'Facilitator ID required' });
      return;
    }

    const { identifier, roleId } = req.params;
    const roleIdNum = parseInt(roleId, 10);

    if (isNaN(roleIdNum)) {
      res.status(400).json({ success: false, error: 'Invalid roleId' });
      return;
    }

    const progression = await progressionService.getPlayerProgression(
      facilitatorId,
      decodeURIComponent(identifier),
      roleIdNum
    );

    if (!progression) {
      res.status(404).json({ success: false, error: 'Player progression not found' });
      return;
    }

    res.json({
      success: true,
      progression: {
        playerIdentifier: progression.playerIdentifier,
        roleId: progression.roleId,
        stats: progression.stats.toJSON(),
        experience: progression.experience.toJSON(),
        totalGames: progression.totalGames,
        achievements: progression.achievements,
      },
    });
  });

  /**
   * Allocate stat points for persistent progression.
   * POST /api/progression/player/:identifier/role/:roleId/allocate
   * Body: { statName: StatName, points: number }
   * Requires facilitator auth
   */
  router.post('/player/:identifier/role/:roleId/allocate', async (req, res) => {
    const facilitatorId = req.headers['x-facilitator-id'] as string;

    if (!facilitatorId) {
      res.status(401).json({ success: false, error: 'Facilitator ID required' });
      return;
    }

    const { identifier, roleId } = req.params;
    const { statName, points } = req.body as { statName?: StatName; points?: number };
    const roleIdNum = parseInt(roleId, 10);

    if (isNaN(roleIdNum)) {
      res.status(400).json({ success: false, error: 'Invalid roleId' });
      return;
    }

    if (!statName || !['strength', 'agility', 'negotiation', 'intellect', 'charisma', 'craft'].includes(statName)) {
      res.status(400).json({ success: false, error: 'Invalid statName' });
      return;
    }

    if (typeof points !== 'number' || points <= 0) {
      res.status(400).json({ success: false, error: 'Points must be a positive number' });
      return;
    }

    const result = await progressionService.allocateStatPoints(
      facilitatorId,
      decodeURIComponent(identifier),
      roleIdNum,
      statName,
      points
    );

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({
      success: true,
      newStats: result.newStats,
      remainingPoints: result.remainingPoints,
    });
  });

  /**
   * Calculate resource contribution bonus.
   * POST /api/progression/calculate/resource-bonus
   * Body: { stats: CharacterStatsData, amount: number }
   */
  router.post('/calculate/resource-bonus', (req, res) => {
    const { stats, amount } = req.body as {
      stats?: Record<string, number>;
      amount?: number;
    };

    if (!stats || typeof amount !== 'number') {
      res.status(400).json({ success: false, error: 'stats and amount required' });
      return;
    }

    const bonus = progressionService.getResourceContributionBonus(
      stats as unknown as CharacterStatsData,
      amount
    );

    res.json({ success: true, bonus });
  });

  /**
   * Calculate vote influence.
   * POST /api/progression/calculate/vote-influence
   * Body: { stats: CharacterStatsData }
   */
  router.post('/calculate/vote-influence', (req, res) => {
    const { stats } = req.body as { stats?: Record<string, number> };

    if (!stats) {
      res.status(400).json({ success: false, error: 'stats required' });
      return;
    }

    const influence = progressionService.getVoteInfluence(
      stats as unknown as CharacterStatsData
    );

    res.json({ success: true, influence });
  });

  return router;
}
