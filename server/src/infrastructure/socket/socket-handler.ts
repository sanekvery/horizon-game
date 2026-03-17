import type { Server, Socket } from 'socket.io';
import type { GameService } from '../../application/services/game-service.js';
import type { ZoneName, ResourceName, Difficulty, DistributionMode, GamePhase } from '../../domain/entities/game-state.js';

interface SocketData {
  token?: string;
  isAdmin?: boolean;
}

export function setupSocketHandlers(io: Server, gameService: GameService): void {
  let timerInterval: NodeJS.Timeout | null = null;

  const broadcastState = () => {
    const state = gameService.getState();
    if (state) {
      io.emit('game:state', state);
    }
  };

  const startTimerInterval = () => {
    if (timerInterval) return;

    timerInterval = setInterval(() => {
      const state = gameService.tickTimer();
      if (state) {
        io.emit('game:state', state);
        if (!state.timer.running) {
          stopTimerInterval();
          io.emit('game:timer-ended');
        }
      }
    }, 1000);
  };

  const stopTimerInterval = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  };

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;
    console.log(`Client connected: ${socket.id}`);

    // Send current state on connection
    const state = gameService.getState();
    if (state) {
      socket.emit('game:state', state);
    }

    // Handle state request (fix race condition)
    socket.on('request:state', () => {
      const currentState = gameService.getState();
      if (currentState) {
        socket.emit('game:state', currentState);
      }
    });

    // Player joins with token
    socket.on('player:join', (token: string) => {
      const role = gameService.getRoleByToken(token);
      if (!role) {
        socket.emit('player:error', { message: 'Неверный токен' });
        return;
      }

      data.token = token;
      socket.join(`player:${role.id}`);
      gameService.connectPlayer(token);
      broadcastState();

      socket.emit('player:joined', { role });
    });

    // Admin authentication
    socket.on('admin:auth', (password: string) => {
      const adminPassword = process.env.ADMIN_PASSWORD || 'horizon2024';
      if (password === adminPassword) {
        data.isAdmin = true;
        socket.join('admins');
        socket.emit('admin:authenticated');
        broadcastState();
      } else {
        socket.emit('admin:error', { message: 'Неверный пароль' });
      }
    });

    // Admin commands
    socket.on('admin:set-act', (act: 1 | 2 | 3 | 4 | 5) => {
      if (!data.isAdmin) return;
      gameService.setAct(act);
      broadcastState();
    });

    socket.on('admin:set-scene', (scene: number) => {
      if (!data.isAdmin) return;
      gameService.setScene(scene);
      broadcastState();
    });

    socket.on('admin:start-timer', (seconds: number) => {
      if (!data.isAdmin) return;
      gameService.startTimer(seconds);
      startTimerInterval();
      broadcastState();
    });

    socket.on('admin:stop-timer', () => {
      if (!data.isAdmin) return;
      stopTimerInterval();
      gameService.stopTimer();
      broadcastState();
    });

    socket.on(
      'admin:update-zone-level',
      ({ zone, level }: { zone: ZoneName; level: number }) => {
        if (!data.isAdmin) return;
        gameService.updateZoneLevel(zone, level);
        broadcastState();
      }
    );

    socket.on(
      'admin:update-zone-resource',
      ({
        zone,
        resource,
        amount,
      }: {
        zone: ZoneName;
        resource: ResourceName;
        amount: number;
      }) => {
        if (!data.isAdmin) return;
        gameService.updateZoneResource(zone, resource, amount);
        broadcastState();
      }
    );

    socket.on('admin:reveal-unknown', () => {
      if (!data.isAdmin) return;
      gameService.revealUnknownZone();
      broadcastState();
    });

    socket.on(
      'admin:create-vote',
      ({ question, options }: { question: string; options: string[] }) => {
        if (!data.isAdmin) return;
        gameService.createVote(question, options);
        broadcastState();
      }
    );

    socket.on('admin:start-vote', (voteId: string) => {
      if (!data.isAdmin) return;
      gameService.startVote(voteId);
      broadcastState();
    });

    socket.on('admin:close-vote', (voteId: string) => {
      if (!data.isAdmin) return;
      gameService.closeVote(voteId);
      broadcastState();
    });

    socket.on('admin:light-candle', (candleId: number) => {
      if (!data.isAdmin) return;
      gameService.lightCandle(candleId);
      broadcastState();
    });

    socket.on('admin:reveal-fog', () => {
      if (!data.isAdmin) return;
      gameService.revealFog();
      broadcastState();
    });

    socket.on('admin:reveal-secret', (roleId: number) => {
      if (!data.isAdmin) return;
      gameService.revealSecret(roleId);
      broadcastState();
    });

    socket.on('admin:reset-session', () => {
      if (!data.isAdmin) return;
      stopTimerInterval();
      gameService.resetSession();
      broadcastState();
    });

    // Admin: configure game settings
    socket.on(
      'admin:configure-game',
      ({
        playerCount,
        difficulty,
        distributionMode,
      }: {
        playerCount: number;
        difficulty: Difficulty;
        distributionMode: DistributionMode;
      }) => {
        if (!data.isAdmin) return;
        const result = gameService.configureGame({ playerCount, difficulty, distributionMode });
        if (result) {
          broadcastState();
          socket.emit('admin:configure-success', { playerCount, difficulty, distributionMode });
        } else {
          socket.emit('admin:configure-error', { error: 'Не удалось настроить игру' });
        }
      }
    );

    // Admin: start game (distribute resources)
    socket.on('admin:start-game', () => {
      if (!data.isAdmin) return;
      const result = gameService.startGame();
      if (result.success) {
        broadcastState();
        socket.emit('admin:start-game-success');
        io.emit('game:started');
      } else {
        socket.emit('admin:start-game-error', { error: result.error });
      }
    });

    // Admin: finish game
    socket.on('admin:finish-game', () => {
      if (!data.isAdmin) return;
      gameService.finishGame();
      broadcastState();
      io.emit('game:finished');
    });

    // Admin: set game phase
    socket.on('admin:set-game-phase', (phase: GamePhase) => {
      if (!data.isAdmin) return;
      gameService.setGamePhase(phase);
      broadcastState();
    });

    // Admin: unclaim role (remove player from role)
    socket.on('admin:unclaim-role', (roleId: number) => {
      if (!data.isAdmin) return;
      gameService.unclaimRole(roleId);
      broadcastState();
    });

    // Admin: give resource to player
    socket.on(
      'admin:give-resource',
      ({
        roleId,
        resource,
        amount,
      }: {
        roleId: number;
        resource: ResourceName;
        amount: number;
      }) => {
        if (!data.isAdmin) return;
        gameService.givePlayerResource(roleId, resource, amount);
        broadcastState();
      }
    );

    // Admin: upgrade zone (with automatic resource validation)
    socket.on('admin:upgrade-zone', (zone: ZoneName) => {
      if (!data.isAdmin) return;
      const result = gameService.upgradeZone(zone);
      if (result.success) {
        broadcastState();
        socket.emit('admin:upgrade-success', { zone, newLevel: result.newLevel });
      } else {
        socket.emit('admin:upgrade-error', { zone, error: result.error });
      }
    });

    // Player: claim role (for online distribution)
    socket.on(
      'player:claim-role',
      ({ roleId, playerName }: { roleId: number; playerName: string }) => {
        const result = gameService.claimRole(roleId, playerName);
        if (result.success && result.token) {
          // Save token to socket data
          data.token = result.token;
          socket.join(`player:${roleId}`);
          broadcastState();
          socket.emit('player:claim-success', { roleId, token: result.token });
        } else {
          socket.emit('player:claim-error', { error: result.error });
        }
      }
    );

    // Player actions
    socket.on('player:vote', ({ voteId, optionId }: { voteId: string; optionId: string }) => {
      if (!data.token) return;
      gameService.castVote(voteId, optionId);
      broadcastState();
    });

    socket.on(
      'player:set-promise',
      ({ text, deadline }: { text: string; deadline: string }) => {
        if (!data.token) return;
        const role = gameService.getRoleByToken(data.token);
        if (role) {
          gameService.setPromise(role.id, text, deadline);
          broadcastState();
        }
      }
    );

    // Player contributes resources to zone
    socket.on(
      'player:contribute',
      ({
        zone,
        resource,
        amount,
      }: {
        zone: ZoneName;
        resource: ResourceName;
        amount: number;
      }) => {
        if (!data.token) return;
        const role = gameService.getRoleByToken(data.token);
        if (!role) return;

        const result = gameService.contributeToZone(role.id, zone, resource, amount);
        if (result.success) {
          broadcastState();
          socket.emit('player:contribute-success', { zone, resource, amount });
        } else {
          socket.emit('player:contribute-error', { error: result.error });
        }
      }
    );

    // ============ EVENT SYSTEM ============

    // Admin: update event settings
    socket.on(
      'admin:update-event-settings',
      (settings: {
        enabled?: boolean;
        probability?: number;
        enabledEventIds?: number[];
      }) => {
        if (!data.isAdmin) return;
        gameService.updateEventSettings(settings);
        broadcastState();
      }
    );

    // Admin: trigger event
    socket.on('admin:trigger-event', (eventId: number) => {
      if (!data.isAdmin) return;
      gameService.triggerEvent(eventId);
      broadcastState();
    });

    // Admin: trigger dilemma event
    socket.on('admin:trigger-dilemma-event', (eventId: number) => {
      if (!data.isAdmin) return;
      gameService.triggerDilemmaEvent(eventId);
      broadcastState();
    });

    // Admin: dismiss active event
    socket.on('admin:dismiss-event', () => {
      if (!data.isAdmin) return;
      gameService.dismissEvent();
      broadcastState();
    });

    // Admin: apply event effect
    socket.on(
      'admin:apply-event-effect',
      ({
        resource,
        amount,
        zone,
      }: {
        resource: ResourceName | 'all';
        amount: number;
        zone: ZoneName | 'all';
      }) => {
        if (!data.isAdmin) return;
        gameService.applyEventEffect(resource, amount, zone);
        broadcastState();
      }
    );

    // Admin: record dilemma choice
    socket.on(
      'admin:record-event-choice',
      ({ eventId, choice }: { eventId: number; choice: string }) => {
        if (!data.isAdmin) return;
        gameService.recordEventChoice(eventId, choice);
        broadcastState();
      }
    );

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      if (data.token) {
        gameService.disconnectPlayer(data.token);
        broadcastState();
      }
    });
  });
}
