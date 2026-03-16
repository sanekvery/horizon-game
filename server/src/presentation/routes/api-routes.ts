import { Router } from 'express';
import type { GameService } from '../../application/services/game-service.js';
import { appConfig } from '../../infrastructure/config/index.js';

export function createApiRoutes(gameService: GameService): Router {
  const router = Router();

  // Get current game state
  router.get('/state', (_req, res) => {
    const state = gameService.getState();
    if (!state) {
      res.status(404).json({ error: 'Сессия не найдена' });
      return;
    }
    res.json(state);
  });

  // Validate player token
  router.get('/validate-token/:token', (req, res) => {
    const role = gameService.getRoleByToken(req.params.token);
    if (!role) {
      res.status(404).json({ valid: false, error: 'Неверный токен' });
      return;
    }
    res.json({ valid: true, role: { id: role.id, name: role.name } });
  });

  // Admin authentication
  router.post('/admin/auth', (req, res) => {
    const { password } = req.body as { password?: string };
    if (password === appConfig.adminPassword) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: 'Неверный пароль' });
    }
  });

  // Get all roles (for admin)
  router.get('/admin/roles', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${appConfig.adminPassword}`) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    const state = gameService.getState();
    if (!state) {
      res.status(404).json({ error: 'Сессия не найдена' });
      return;
    }

    res.json(state.roles);
  });

  return router;
}
