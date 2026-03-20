import { Router, Request, Response, NextFunction } from 'express';
import { authService, JwtPayload } from '../../application/services/auth-service.js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function createAuthRoutes(): Router {
  const router = Router();

  // Register new facilitator
  router.post('/register', async (req: Request, res: Response) => {
    const { email, password, name } = req.body as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email и пароль обязательны' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, error: 'Пароль должен быть не менее 6 символов' });
      return;
    }

    const result = await authService.register(email, password, name);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  });

  // Login
  router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email и пароль обязательны' });
      return;
    }

    const result = await authService.login(email, password);

    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json(result);
    }
  });

  // Get current user
  router.get('/me', authMiddleware, async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Не авторизован' });
      return;
    }

    const facilitator = await authService.getFacilitatorById(req.user.id);

    if (!facilitator) {
      res.status(404).json({ success: false, error: 'Пользователь не найден' });
      return;
    }

    res.json({ success: true, facilitator });
  });

  return router;
}

// Auth middleware
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Токен не предоставлен' });
    return;
  }

  const token = authHeader.substring(7);
  const payload = await authService.verifyToken(token);

  if (!payload) {
    res.status(401).json({ success: false, error: 'Недействительный токен' });
    return;
  }

  req.user = payload;
  next();
}
