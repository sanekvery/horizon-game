import { Router, Request, Response } from 'express';
import { sessionService } from '../../application/services/session-service.js';
import { loggingService, type HistoryOptions } from '../../application/services/logging-service.js';
import { authMiddleware } from './auth-routes.js';
import type { ActorType } from '@prisma/client';

export function createSessionRoutes(): Router {
  const router = Router();

  // All session routes require authentication
  router.use(authMiddleware);

  // Create a new session
  router.post('/', async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Не авторизован' });
      return;
    }

    const { name, playerCount } = req.body as {
      name?: string;
      playerCount?: number;
    };

    if (!playerCount || playerCount < 4 || playerCount > 20) {
      res.status(400).json({
        success: false,
        error: 'Количество игроков должно быть от 4 до 20',
      });
      return;
    }

    const result = await sessionService.createSession({
      facilitatorId: req.user.id,
      name,
      playerCount,
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  });

  // Get all sessions for current facilitator
  router.get('/', async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Не авторизован' });
      return;
    }

    const sessions = await sessionService.getSessionsByFacilitator(req.user.id);
    res.json({ success: true, sessions });
  });

  // Get session by ID
  router.get('/:id', async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Не авторизован' });
      return;
    }

    const session = await sessionService.getSessionById(req.params.id);

    if (!session) {
      res.status(404).json({ success: false, error: 'Сессия не найдена' });
      return;
    }

    // Verify ownership
    const isOwner = await sessionService.verifySessionOwnership(req.params.id, req.user.id);
    if (!isOwner) {
      res.status(403).json({ success: false, error: 'Нет доступа к этой сессии' });
      return;
    }

    res.json({ success: true, session });
  });

  // Get session by code (for joining)
  router.get('/code/:code', async (req: Request, res: Response) => {
    const session = await sessionService.getSessionByCode(req.params.code.toUpperCase());

    if (!session) {
      res.status(404).json({ success: false, error: 'Сессия не найдена' });
      return;
    }

    // Return limited info for players
    res.json({
      success: true,
      session: {
        id: session.id,
        code: session.code,
        name: session.name,
        status: session.status,
        playerCount: session.playerCount,
      },
    });
  });

  // Delete session
  router.delete('/:id', async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Не авторизован' });
      return;
    }

    const result = await sessionService.deleteSession(req.params.id, req.user.id);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  });

  // ============ HISTORY ENDPOINTS ============

  // Get session action history by code
  router.get('/code/:code/history', async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Не авторизован' });
      return;
    }

    const sessionCode = req.params.code.toUpperCase();
    const session = await sessionService.getSessionByCode(sessionCode);

    if (!session) {
      res.status(404).json({ success: false, error: 'Сессия не найдена' });
      return;
    }

    // Verify ownership
    const isOwner = await sessionService.verifySessionOwnership(session.id, req.user.id);
    if (!isOwner) {
      res.status(403).json({ success: false, error: 'Нет доступа к этой сессии' });
      return;
    }

    const { limit, offset, actorType, actionTypes } = req.query;

    const options: HistoryOptions = {
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
      actorType: actorType as ActorType | undefined,
      actionTypes: actionTypes ? (actionTypes as string).split(',') : undefined,
    };

    const history = await loggingService.getSessionHistory(sessionCode, options);
    res.json({ success: true, history });
  });

  // Get session statistics by code
  router.get('/code/:code/stats', async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Не авторизован' });
      return;
    }

    const sessionCode = req.params.code.toUpperCase();
    const session = await sessionService.getSessionByCode(sessionCode);

    if (!session) {
      res.status(404).json({ success: false, error: 'Сессия не найдена' });
      return;
    }

    // Verify ownership
    const isOwner = await sessionService.verifySessionOwnership(session.id, req.user.id);
    if (!isOwner) {
      res.status(403).json({ success: false, error: 'Нет доступа к этой сессии' });
      return;
    }

    const stats = await loggingService.getSessionStats(sessionCode);

    if (!stats) {
      res.status(404).json({ success: false, error: 'Статистика не найдена' });
      return;
    }

    res.json({ success: true, stats });
  });

  return router;
}
