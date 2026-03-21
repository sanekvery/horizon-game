import { Router } from 'express';
import type { GameService } from '../../application/services/game-service.js';
import { appConfig } from '../../infrastructure/config/index.js';

export function createApiRoutes(gameService: GameService): Router {
  const router = Router();

  /**
   * Get current game state for a session.
   * Query param: ?session=CODE
   */
  router.get('/state', async (req, res) => {
    const sessionCode = req.query.session as string;
    if (!sessionCode) {
      res.status(400).json({ error: 'Session code required (?session=CODE)' });
      return;
    }

    const state = await gameService.getState(sessionCode);
    if (!state) {
      res.status(404).json({ error: 'Сессия не найдена' });
      return;
    }
    res.json(state);
  });

  /**
   * Validate player token within a session.
   * Query param: ?session=CODE
   */
  router.get('/validate-token/:token', async (req, res) => {
    const sessionCode = req.query.session as string;
    if (!sessionCode) {
      res.status(400).json({ valid: false, error: 'Session code required' });
      return;
    }

    const role = await gameService.getRoleByToken(sessionCode, req.params.token);
    if (!role) {
      res.status(404).json({ valid: false, error: 'Неверный токен' });
      return;
    }
    res.json({ valid: true, role: { id: role.id, name: role.name } });
  });

  /**
   * Admin authentication (legacy password-based).
   */
  router.post('/admin/auth', (req, res) => {
    const { password } = req.body as { password?: string };
    if (password === appConfig.adminPassword) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: 'Неверный пароль' });
    }
  });

  /**
   * Get all roles for admin.
   * Query param: ?session=CODE
   */
  router.get('/admin/roles', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${appConfig.adminPassword}`) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    const sessionCode = req.query.session as string;
    if (!sessionCode) {
      res.status(400).json({ error: 'Session code required' });
      return;
    }

    const state = await gameService.getState(sessionCode);
    if (!state) {
      res.status(404).json({ error: 'Сессия не найдена' });
      return;
    }

    res.json(state.roles);
  });

  /**
   * Get lobby info (available roles for online distribution).
   * Query param: ?session=CODE
   */
  router.get('/lobby', async (req, res) => {
    const sessionCode = req.query.session as string;
    if (!sessionCode) {
      res.status(400).json({ error: 'Session code required (?session=CODE)' });
      return;
    }

    const state = await gameService.getState(sessionCode);
    if (!state) {
      res.status(404).json({ error: 'Сессия не найдена' });
      return;
    }

    if (state.settings.gamePhase !== 'distribution') {
      res.status(400).json({ error: 'Распределение ролей не активно' });
      return;
    }

    const availableRoles = await gameService.getAvailableRoles(sessionCode);
    const allActiveRoles = state.roles
      .filter((r) => r.isActive)
      .map((r) => ({
        id: r.id,
        name: r.name,
        claimedBy: r.claimedBy,
      }));

    res.json({
      sessionId: state.sessionId,
      sessionCode,
      phase: state.settings.gamePhase,
      playerCount: state.settings.playerCount,
      difficulty: state.settings.difficulty,
      availableRoles,
      allActiveRoles,
      claimedCount: allActiveRoles.filter((r) => r.claimedBy !== null).length,
      totalCount: allActiveRoles.length,
    });
  });

  /**
   * Claim role (for online distribution).
   * Query param: ?session=CODE
   */
  router.post('/claim-role', async (req, res) => {
    const sessionCode = req.query.session as string;
    if (!sessionCode) {
      res.status(400).json({ error: 'Session code required' });
      return;
    }

    const { roleId, playerName } = req.body as { roleId?: number; playerName?: string };

    if (!roleId || !playerName) {
      res.status(400).json({ error: 'Требуется roleId и playerName' });
      return;
    }

    const result = await gameService.claimRole(sessionCode, roleId, playerName.trim());
    if (result.success) {
      res.json({ success: true, token: result.token });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  });

  /**
   * Get game settings for a session.
   * Query param: ?session=CODE
   */
  router.get('/settings', async (req, res) => {
    const sessionCode = req.query.session as string;
    if (!sessionCode) {
      res.status(400).json({ error: 'Session code required' });
      return;
    }

    const state = await gameService.getState(sessionCode);
    if (!state) {
      res.status(404).json({ error: 'Сессия не найдена' });
      return;
    }

    res.json(state.settings);
  });

  /**
   * Initialize game state for a session (creates initial state if not exists).
   * Called when admin opens a session for the first time.
   */
  router.post('/init-session', async (req, res) => {
    const { sessionCode, playerCount } = req.body as { sessionCode?: string; playerCount?: number };

    if (!sessionCode || !playerCount) {
      res.status(400).json({ error: 'Требуется sessionCode и playerCount' });
      return;
    }

    const state = await gameService.getOrCreateSession(sessionCode, playerCount);
    if (!state) {
      res.status(404).json({ error: 'Сессия не найдена в базе данных' });
      return;
    }

    res.json({ success: true, sessionId: state.sessionId });
  });

  return router;
}
