import type { Server, Socket } from 'socket.io';
import type { GameService } from '../../application/services/game-service.js';
import type { ZoneName, ResourceName, Difficulty, DistributionMode, GamePhase } from '../../domain/entities/game-state.js';
import { authService } from '../../application/services/auth-service.js';
import { loggingService } from '../../application/services/logging-service.js';

interface SocketData {
  token?: string;
  isAdmin?: boolean;
  sessionCode?: string;
}

/**
 * Session-aware socket handler with isolated WebSocket rooms.
 * Each session has its own room: `session:{sessionCode}`
 */
export function setupSocketHandlers(io: Server, gameService: GameService): void {
  // Per-session timers (Map: sessionCode -> interval)
  const sessionTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Broadcast state to all clients in a specific session room.
   */
  const broadcastState = async (sessionCode: string) => {
    const state = await gameService.getState(sessionCode);
    if (state) {
      io.to(`session:${sessionCode}`).emit('game:state', state);
    }
  };

  /**
   * Start timer interval for a specific session.
   */
  const startTimerInterval = (sessionCode: string) => {
    if (sessionTimers.has(sessionCode)) return;

    const interval = setInterval(async () => {
      const state = await gameService.tickTimer(sessionCode);
      if (state) {
        io.to(`session:${sessionCode}`).emit('game:state', state);
        if (!state.timer.running) {
          stopTimerInterval(sessionCode);
          io.to(`session:${sessionCode}`).emit('game:timer-ended');
        }
      }
    }, 1000);

    sessionTimers.set(sessionCode, interval);
  };

  /**
   * Stop timer interval for a specific session.
   */
  const stopTimerInterval = (sessionCode: string) => {
    const interval = sessionTimers.get(sessionCode);
    if (interval) {
      clearInterval(interval);
      sessionTimers.delete(sessionCode);
    }
  };

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;
    console.log(`Client connected: ${socket.id}`);

    // ============ SESSION MANAGEMENT ============

    /**
     * Join a session room and receive initial state.
     * Must be called before any other session-specific actions.
     */
    socket.on('join:session', async (sessionCode: string) => {
      if (!sessionCode) {
        socket.emit('session:error', { message: 'Session code required' });
        return;
      }

      // Leave previous session room if any
      if (data.sessionCode) {
        socket.leave(`session:${data.sessionCode}`);
      }

      data.sessionCode = sessionCode;
      socket.join(`session:${sessionCode}`);
      console.log(`Socket ${socket.id} joined session: ${sessionCode}`);

      // Send current state for this session
      const state = await gameService.getState(sessionCode);
      if (state) {
        socket.emit('game:state', state);
      }
    });

    /**
     * Request current state for the joined session.
     */
    socket.on('request:state', async () => {
      if (!data.sessionCode) {
        socket.emit('session:error', { message: 'Not joined to a session' });
        return;
      }

      const currentState = await gameService.getState(data.sessionCode);
      if (currentState) {
        socket.emit('game:state', currentState);
      }
    });

    // ============ PLAYER ACTIONS ============

    /**
     * Player joins with token.
     */
    socket.on('player:join', async (token: string) => {
      if (!data.sessionCode) {
        socket.emit('player:error', { message: 'Session not joined' });
        return;
      }

      const role = await gameService.getRoleByToken(data.sessionCode, token);
      if (!role) {
        socket.emit('player:error', { message: 'Неверный токен' });
        return;
      }

      data.token = token;
      socket.join(`player:${role.id}`);
      await gameService.connectPlayer(data.sessionCode, token);

      // Log player join
      await loggingService.logPlayerAction(data.sessionCode, role.id, 'PLAYER_JOIN', {
        roleName: role.name,
        socketId: socket.id,
      });

      await broadcastState(data.sessionCode);

      socket.emit('player:joined', { role });
    });

    /**
     * Player claims a role (for online distribution).
     */
    socket.on(
      'player:claim-role',
      async ({ roleId, playerName }: { roleId: number; playerName: string }) => {
        if (!data.sessionCode) {
          socket.emit('player:error', { message: 'Session not joined' });
          return;
        }

        const result = await gameService.claimRole(data.sessionCode, roleId, playerName);
        if (result.success && result.token) {
          data.token = result.token;
          socket.join(`player:${roleId}`);

          // Log role claim
          await loggingService.logPlayerAction(data.sessionCode, roleId, 'ROLE_CLAIM', {
            playerName,
            roleId,
          });

          await broadcastState(data.sessionCode);
          socket.emit('player:claim-success', { roleId, token: result.token });
        } else {
          socket.emit('player:claim-error', { error: result.error });
        }
      }
    );

    /**
     * Player votes.
     */
    socket.on('player:vote', async ({ voteId, optionId }: { voteId: string; optionId: string }) => {
      if (!data.token || !data.sessionCode) return;

      const role = await gameService.getRoleByToken(data.sessionCode, data.token);
      await gameService.castVote(data.sessionCode, voteId, optionId);

      // Log vote cast
      if (role) {
        await loggingService.logPlayerAction(data.sessionCode, role.id, 'VOTE_CAST', {
          voteId,
          optionId,
        });
      }

      await broadcastState(data.sessionCode);
    });

    /**
     * Player sets promise.
     */
    socket.on(
      'player:set-promise',
      async ({ text, deadline }: { text: string; deadline: string }) => {
        if (!data.token || !data.sessionCode) return;
        const role = await gameService.getRoleByToken(data.sessionCode, data.token);
        if (role) {
          await gameService.setPromise(data.sessionCode, role.id, text, deadline);
          await broadcastState(data.sessionCode);
        }
      }
    );

    /**
     * Player contributes resources to zone.
     */
    socket.on(
      'player:contribute',
      async ({
        zone,
        resource,
        amount,
      }: {
        zone: ZoneName;
        resource: ResourceName;
        amount: number;
      }) => {
        if (!data.token || !data.sessionCode) return;
        const role = await gameService.getRoleByToken(data.sessionCode, data.token);
        if (!role) return;

        const result = await gameService.contributeToZone(data.sessionCode, role.id, zone, resource, amount);
        if (result.success && result.state) {
          // Log resource contribution
          await loggingService.logPlayerAction(data.sessionCode, role.id, 'RESOURCE_CONTRIBUTE', {
            zone,
            resource,
            amount,
          });

          // Emit map animation event (only for zones with resources)
          if (zone !== 'unknown') {
            const zoneData = result.state.zones[zone];
            const newTotal = zoneData.resources[resource];
            io.to(`session:${data.sessionCode}`).emit('map:resource-contributed', {
              zone,
              resource,
              amount,
              roleId: role.id,
              roleName: role.name,
              newTotal,
            });
          }

          await broadcastState(data.sessionCode);
          socket.emit('player:contribute-success', { zone, resource, amount });
        } else {
          socket.emit('player:contribute-error', { error: result.error });
        }
      }
    );

    // ============ ADMIN AUTHENTICATION ============

    /**
     * Admin authentication (JWT token or password).
     */
    socket.on('admin:auth', async (credential: string) => {
      // First try JWT token authentication
      const jwtPayload = await authService.verifyToken(credential);
      if (jwtPayload) {
        data.isAdmin = true;
        socket.join('admins');
        socket.emit('admin:authenticated');
        if (data.sessionCode) {
          await broadcastState(data.sessionCode);
        }
        return;
      }

      // Fallback to password authentication
      const adminPassword = process.env.ADMIN_PASSWORD || 'horizon2024';
      if (credential === adminPassword) {
        data.isAdmin = true;
        socket.join('admins');
        socket.emit('admin:authenticated');
        if (data.sessionCode) {
          await broadcastState(data.sessionCode);
        }
      } else {
        socket.emit('admin:error', { message: 'Неверный пароль' });
      }
    });

    // ============ ADMIN COMMANDS ============

    socket.on('admin:set-act', async (act: 1 | 2 | 3 | 4 | 5) => {
      if (!data.isAdmin || !data.sessionCode) return;

      const prevState = await gameService.getState(data.sessionCode);
      await gameService.setAct(data.sessionCode, act);

      // Log act change
      await loggingService.logAdminAction(data.sessionCode, 'ACT_CHANGE', {
        previousAct: prevState?.currentAct,
        newAct: act,
      });

      await broadcastState(data.sessionCode);
    });

    socket.on('admin:set-scene', async (scene: number) => {
      if (!data.isAdmin || !data.sessionCode) return;
      await gameService.setScene(data.sessionCode, scene);
      await broadcastState(data.sessionCode);
    });

    socket.on('admin:start-timer', async (seconds: number) => {
      if (!data.isAdmin || !data.sessionCode) return;
      await gameService.startTimer(data.sessionCode, seconds);
      startTimerInterval(data.sessionCode);

      // Log timer start
      await loggingService.logAdminAction(data.sessionCode, 'TIMER_START', {
        seconds,
      });

      await broadcastState(data.sessionCode);
    });

    socket.on('admin:stop-timer', async () => {
      if (!data.isAdmin || !data.sessionCode) return;

      const prevState = await gameService.getState(data.sessionCode);
      stopTimerInterval(data.sessionCode);
      await gameService.stopTimer(data.sessionCode);

      // Log timer stop
      await loggingService.logAdminAction(data.sessionCode, 'TIMER_STOP', {
        remainingSeconds: prevState?.timer.remainingSec,
      });

      await broadcastState(data.sessionCode);
    });

    socket.on(
      'admin:update-zone-level',
      async ({ zone, level }: { zone: ZoneName; level: number }) => {
        if (!data.isAdmin || !data.sessionCode) return;
        await gameService.updateZoneLevel(data.sessionCode, zone, level);
        await broadcastState(data.sessionCode);
      }
    );

    socket.on(
      'admin:update-zone-resource',
      async ({
        zone,
        resource,
        amount,
      }: {
        zone: ZoneName;
        resource: ResourceName;
        amount: number;
      }) => {
        if (!data.isAdmin || !data.sessionCode) return;
        await gameService.updateZoneResource(data.sessionCode, zone, resource, amount);
        await broadcastState(data.sessionCode);
      }
    );

    socket.on('admin:reveal-unknown', async () => {
      if (!data.isAdmin || !data.sessionCode) return;
      await gameService.revealUnknownZone(data.sessionCode);
      await broadcastState(data.sessionCode);
    });

    socket.on(
      'admin:create-vote',
      async ({ question, options }: { question: string; options: string[] }) => {
        if (!data.isAdmin || !data.sessionCode) return;
        await gameService.createVote(data.sessionCode, question, options);
        await broadcastState(data.sessionCode);
      }
    );

    socket.on('admin:start-vote', async (voteId: string) => {
      if (!data.isAdmin || !data.sessionCode) return;
      await gameService.startVote(data.sessionCode, voteId);
      await broadcastState(data.sessionCode);
    });

    socket.on('admin:close-vote', async (voteId: string) => {
      if (!data.isAdmin || !data.sessionCode) return;
      await gameService.closeVote(data.sessionCode, voteId);
      await broadcastState(data.sessionCode);
    });

    socket.on('admin:light-candle', async (candleId: number) => {
      if (!data.isAdmin || !data.sessionCode) return;
      await gameService.lightCandle(data.sessionCode, candleId);
      await broadcastState(data.sessionCode);
    });

    socket.on('admin:reveal-fog', async () => {
      if (!data.isAdmin || !data.sessionCode) return;
      await gameService.revealFog(data.sessionCode);
      await broadcastState(data.sessionCode);
    });

    socket.on('admin:reveal-secret', async (roleId: number) => {
      if (!data.isAdmin || !data.sessionCode) return;
      await gameService.revealSecret(data.sessionCode, roleId);
      await broadcastState(data.sessionCode);
    });

    socket.on('admin:reset-session', async () => {
      if (!data.isAdmin || !data.sessionCode) return;
      stopTimerInterval(data.sessionCode);
      // Get current session to get playerCount
      const currentState = await gameService.getState(data.sessionCode);
      const playerCount = currentState?.settings.playerCount || 4;
      await gameService.resetSession(data.sessionCode, playerCount);
      await broadcastState(data.sessionCode);
    });

    // ============ ADMIN: GAME CONFIGURATION ============

    socket.on(
      'admin:configure-game',
      async ({
        playerCount,
        difficulty,
        distributionMode,
      }: {
        playerCount: number;
        difficulty: Difficulty;
        distributionMode: DistributionMode;
      }) => {
        if (!data.isAdmin || !data.sessionCode) return;
        const result = await gameService.configureGame(data.sessionCode, { playerCount, difficulty, distributionMode });
        if (result) {
          await broadcastState(data.sessionCode);
          socket.emit('admin:configure-success', { playerCount, difficulty, distributionMode });
        } else {
          socket.emit('admin:configure-error', { error: 'Не удалось настроить игру' });
        }
      }
    );

    socket.on('admin:start-game', async () => {
      if (!data.isAdmin || !data.sessionCode) return;
      const result = await gameService.startGame(data.sessionCode);
      if (result.success) {
        // Log game start
        await loggingService.logAdminAction(data.sessionCode, 'GAME_START', {});

        await broadcastState(data.sessionCode);
        socket.emit('admin:start-game-success');
        io.to(`session:${data.sessionCode}`).emit('game:started');
      } else {
        socket.emit('admin:start-game-error', { error: result.error });
      }
    });

    socket.on('admin:finish-game', async () => {
      if (!data.isAdmin || !data.sessionCode) return;

      const prevState = await gameService.getState(data.sessionCode);
      await gameService.finishGame(data.sessionCode);

      // Log game finish
      await loggingService.logAdminAction(data.sessionCode, 'GAME_FINISH', {
        finalAct: prevState?.currentAct,
        finalScene: prevState?.currentScene,
      });

      await broadcastState(data.sessionCode);
      io.to(`session:${data.sessionCode}`).emit('game:finished');
    });

    socket.on('admin:set-game-phase', async (phase: GamePhase) => {
      if (!data.isAdmin || !data.sessionCode) return;
      await gameService.setGamePhase(data.sessionCode, phase);
      await broadcastState(data.sessionCode);
    });

    socket.on('admin:unclaim-role', async (roleId: number) => {
      if (!data.isAdmin || !data.sessionCode) return;
      await gameService.unclaimRole(data.sessionCode, roleId);
      await broadcastState(data.sessionCode);
    });

    socket.on(
      'admin:give-resource',
      async ({
        roleId,
        resource,
        amount,
      }: {
        roleId: number;
        resource: ResourceName;
        amount: number;
      }) => {
        if (!data.isAdmin || !data.sessionCode) return;
        await gameService.givePlayerResource(data.sessionCode, roleId, resource, amount);
        await broadcastState(data.sessionCode);
      }
    );

    socket.on('admin:upgrade-zone', async (zone: ZoneName) => {
      if (!data.isAdmin || !data.sessionCode) return;

      // Unknown zone cannot be upgraded
      if (zone === 'unknown') {
        socket.emit('admin:upgrade-error', { zone, error: 'Cannot upgrade unknown zone' });
        return;
      }

      // Get current level before upgrade
      const prevState = await gameService.getState(data.sessionCode);
      const fromLevel = prevState?.zones[zone]?.level ?? 0;

      const result = await gameService.upgradeZone(data.sessionCode, zone);
      if (result.success && result.newLevel !== undefined) {
        // Log zone upgrade
        await loggingService.logAdminAction(data.sessionCode, 'ZONE_UPDATE', {
          zone,
          fromLevel,
          toLevel: result.newLevel,
        });

        // Emit map animation event
        io.to(`session:${data.sessionCode}`).emit('map:zone-upgraded', {
          zone,
          fromLevel,
          toLevel: result.newLevel,
        });

        await broadcastState(data.sessionCode);
        socket.emit('admin:upgrade-success', { zone, newLevel: result.newLevel });
      } else {
        socket.emit('admin:upgrade-error', { zone, error: result.error });
      }
    });

    // ============ ADMIN: EVENT SYSTEM ============

    socket.on(
      'admin:update-event-settings',
      async (settings: {
        enabled?: boolean;
        probability?: number;
        enabledEventIds?: number[];
      }) => {
        if (!data.isAdmin || !data.sessionCode) return;
        await gameService.updateEventSettings(data.sessionCode, settings);
        await broadcastState(data.sessionCode);
      }
    );

    socket.on('admin:trigger-event', async (eventId: number) => {
      if (!data.isAdmin || !data.sessionCode) return;
      await gameService.triggerEvent(data.sessionCode, eventId);

      // Log event trigger
      await loggingService.logAdminAction(data.sessionCode, 'EVENT_TRIGGER', {
        eventId,
      });

      // Emit map animation event
      io.to(`session:${data.sessionCode}`).emit('map:event-started', {
        eventId,
      });

      await broadcastState(data.sessionCode);
    });

    socket.on('admin:trigger-dilemma-event', async (eventId: number) => {
      if (!data.isAdmin || !data.sessionCode) return;
      await gameService.triggerDilemmaEvent(data.sessionCode, eventId);

      // Emit map animation event
      io.to(`session:${data.sessionCode}`).emit('map:event-started', {
        eventId,
        isDilemma: true,
      });

      await broadcastState(data.sessionCode);
    });

    socket.on('admin:dismiss-event', async () => {
      if (!data.isAdmin || !data.sessionCode) return;

      // Get active event before dismiss
      const prevState = await gameService.getState(data.sessionCode);
      const eventId = prevState?.activeEvent?.eventId;

      await gameService.dismissEvent(data.sessionCode);

      // Log event dismiss
      if (eventId !== undefined) {
        await loggingService.logAdminAction(data.sessionCode, 'EVENT_DISMISS', {
          eventId,
        });

        // Emit map animation event
        io.to(`session:${data.sessionCode}`).emit('map:event-ended', {
          eventId,
        });
      }

      await broadcastState(data.sessionCode);
    });

    socket.on(
      'admin:apply-event-effect',
      async ({
        resource,
        amount,
        zone,
      }: {
        resource: ResourceName | 'all';
        amount: number;
        zone: ZoneName | 'all';
      }) => {
        if (!data.isAdmin || !data.sessionCode) return;
        await gameService.applyEventEffect(data.sessionCode, resource, amount, zone);
        await broadcastState(data.sessionCode);
      }
    );

    socket.on(
      'admin:record-event-choice',
      async ({ eventId, choice }: { eventId: number; choice: string }) => {
        if (!data.isAdmin || !data.sessionCode) return;
        await gameService.recordEventChoice(data.sessionCode, eventId, choice);
        await broadcastState(data.sessionCode);
      }
    );

    // ============ DISCONNECT ============

    socket.on('disconnect', async () => {
      console.log(`Client disconnected: ${socket.id}`);
      if (data.token && data.sessionCode) {
        const role = await gameService.getRoleByToken(data.sessionCode, data.token);

        // Log player disconnect
        if (role) {
          await loggingService.logPlayerAction(data.sessionCode, role.id, 'PLAYER_DISCONNECT', {
            roleName: role.name,
            socketId: socket.id,
          });
        }

        await gameService.disconnectPlayer(data.sessionCode, data.token);
        await broadcastState(data.sessionCode);
      }
    });
  });
}
