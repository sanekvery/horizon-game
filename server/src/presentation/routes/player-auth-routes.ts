/**
 * Player Auth Routes
 *
 * API endpoints for player registration, login, and profile management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { playerAuthService, PlayerJwtPayload } from '../../application/services/player-auth-service.js';
import type { CharacterStatsData } from '../../domain/entities/character-stats.js';

// Extend Express Request to include player data
declare global {
  namespace Express {
    interface Request {
      player?: PlayerJwtPayload;
    }
  }
}

/**
 * Middleware to verify player JWT token.
 */
async function requirePlayerAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Требуется авторизация' });
    return;
  }

  const token = authHeader.slice(7);
  const payload = await playerAuthService.verifyJwt(token);

  if (!payload) {
    res.status(401).json({ success: false, error: 'Неверный или истёкший токен' });
    return;
  }

  req.player = payload;
  next();
}

/**
 * Create player auth routes.
 */
export function createPlayerAuthRoutes(): Router {
  const router = Router();

  // ============================================
  // PUBLIC ROUTES
  // ============================================

  /**
   * Register new player.
   * POST /api/player/auth/register
   * Body: { email, password, displayName }
   */
  router.post('/register', async (req: Request, res: Response) => {
    const { email, password, displayName } = req.body as {
      email?: string;
      password?: string;
      displayName?: string;
    };

    if (!email || !password || !displayName) {
      res.status(400).json({
        success: false,
        error: 'email, password и displayName обязательны',
      });
      return;
    }

    const result = await playerAuthService.register({
      email,
      password,
      displayName,
    });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  });

  /**
   * Login player.
   * POST /api/player/auth/login
   * Body: { email, password }
   */
  router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'email и password обязательны',
      });
      return;
    }

    const result = await playerAuthService.login({
      email,
      password,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    if (!result.success) {
      res.status(401).json(result);
      return;
    }

    res.json(result);
  });

  /**
   * Verify email.
   * POST /api/player/auth/verify-email/:token
   */
  router.post('/verify-email/:token', async (req: Request, res: Response) => {
    const { token } = req.params;

    const result = await playerAuthService.verifyEmail(token);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  });

  /**
   * Request password reset.
   * POST /api/player/auth/forgot-password
   * Body: { email }
   */
  router.post('/forgot-password', async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'email обязателен',
      });
      return;
    }

    const result = await playerAuthService.requestPasswordReset(email);
    res.json(result);
  });

  /**
   * Reset password with token.
   * POST /api/player/auth/reset-password/:token
   * Body: { password }
   */
  router.post('/reset-password/:token', async (req: Request, res: Response) => {
    const { token } = req.params;
    const { password } = req.body as { password?: string };

    if (!password) {
      res.status(400).json({
        success: false,
        error: 'password обязателен',
      });
      return;
    }

    const result = await playerAuthService.resetPassword(token, password);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  });

  // ============================================
  // PROTECTED ROUTES (require auth)
  // ============================================

  /**
   * Get current user info.
   * GET /api/player/auth/me
   * Headers: Authorization: Bearer <token>
   */
  router.get('/me', requirePlayerAuth, async (req: Request, res: Response) => {
    const player = req.player!;

    const userData = await playerAuthService.getUserById(player.id);

    if (!userData) {
      res.status(404).json({ success: false, error: 'Пользователь не найден' });
      return;
    }

    res.json({
      success: true,
      user: userData.user,
      playerProfile: userData.playerProfile,
    });
  });

  /**
   * Logout (invalidate all sessions).
   * POST /api/player/auth/logout
   * Headers: Authorization: Bearer <token>
   */
  router.post('/logout', requirePlayerAuth, async (req: Request, res: Response) => {
    const player = req.player!;

    await playerAuthService.logout(player.id);

    res.json({ success: true });
  });

  /**
   * Update player profile.
   * PATCH /api/player/auth/profile
   * Headers: Authorization: Bearer <token>
   * Body: { displayName?, avatar? }
   */
  router.patch('/profile', requirePlayerAuth, async (req: Request, res: Response) => {
    const player = req.player!;
    const { displayName, avatar } = req.body as {
      displayName?: string;
      avatar?: string;
    };

    if (!displayName && !avatar) {
      res.status(400).json({
        success: false,
        error: 'Нечего обновлять',
      });
      return;
    }

    const profile = await playerAuthService.updateProfile(player.id, {
      displayName: displayName?.trim(),
      avatar,
    });

    if (!profile) {
      res.status(404).json({ success: false, error: 'Профиль не найден' });
      return;
    }

    res.json({ success: true, profile });
  });

  /**
   * Allocate stat points.
   * POST /api/player/auth/allocate-points
   * Headers: Authorization: Bearer <token>
   * Body: { statName, points }
   */
  router.post('/allocate-points', requirePlayerAuth, async (req: Request, res: Response) => {
    const player = req.player!;
    const { statName, points } = req.body as {
      statName?: keyof CharacterStatsData;
      points?: number;
    };

    if (!statName || typeof points !== 'number') {
      res.status(400).json({
        success: false,
        error: 'statName и points обязательны',
      });
      return;
    }

    const validStats: (keyof CharacterStatsData)[] = [
      'strength',
      'agility',
      'negotiation',
      'intellect',
      'charisma',
      'craft',
    ];

    if (!validStats.includes(statName)) {
      res.status(400).json({
        success: false,
        error: 'Неверное название характеристики',
      });
      return;
    }

    const result = await playerAuthService.allocateStatPoints(player.id, statName, points);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  });

  return router;
}

// Export middleware for use in other routes
export { requirePlayerAuth };
