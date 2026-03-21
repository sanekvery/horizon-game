import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';

import { appConfig } from './infrastructure/config/index.js';
import { prismaGameStateRepository } from './infrastructure/database/prisma-game-state-repository.js';
import { GameService } from './application/services/game-service.js';
import { createApiRoutes } from './presentation/routes/api-routes.js';
import { createAuthRoutes } from './presentation/routes/auth-routes.js';
import { createSessionRoutes } from './presentation/routes/session-routes.js';
import { setupSocketHandlers } from './infrastructure/socket/socket-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize dependencies with PostgreSQL-based repository
const gameService = new GameService(prismaGameStateRepository);
console.log('🎮 GameService инициализирован с PostgreSQL хранилищем');

// Create Express app
const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: true, // Разрешить все origins (нужно для ngrok)
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());


// API routes
app.use('/api', createApiRoutes(gameService));
app.use('/api/auth', createAuthRoutes());
app.use('/api/sessions', createSessionRoutes());

// Serve static files in production
if (appConfig.isProduction) {
  const clientBuildPath = path.join(__dirname, '../../client/dist');

  // No cache for HTML
  app.use((req, res, next) => {
    if (req.path.endsWith('.html') || req.path === '/' || req.path.startsWith('/play') || req.path.startsWith('/admin')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  app.use(express.static(clientBuildPath));

  // SPA fallback for client-side routing
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Setup Socket.IO handlers
setupSocketHandlers(io, gameService);

// Get local network IP
function getLocalIP(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Start server
httpServer.listen(appConfig.port, () => {
  const localIP = getLocalIP();

  console.log(`\n🚀 Сервер запущен на порту ${appConfig.port}`);
  console.log(`   Режим: ${appConfig.nodeEnv}`);
  console.log(`\n📍 Локальный доступ:`);
  console.log(`   http://localhost:${appConfig.port}`);
  console.log(`\n🌐 Для игроков в той же сети:`);
  console.log(`   http://${localIP}:${appConfig.port}`);
  console.log(`\n📱 Маршруты:`);
  console.log(`   Карта:  /map`);
  console.log(`   Админ:  /admin`);
  console.log(`   Игрок:  /play/:token`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nЗавершение работы...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nЗавершение работы...');
  process.exit(0);
});
