import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import type { GameState, ZoneName, ResourceName, Difficulty, DistributionMode, GamePhase } from '../types/game-state';
import { authApi } from '../services/auth-api';

interface UseGameStateOptions {
  sessionCode?: string | null;
}

interface UseGameStateReturn {
  state: GameState | null;
  isConnected: boolean;
  isSessionJoined: boolean;
  isLoading: boolean;
  error: string | null;
  sessionCode: string | null;

  // Player actions
  joinAsPlayer: (token: string) => void;
  castVote: (voteId: string, optionId: string) => void;
  setPromise: (text: string, deadline: string) => void;
  contributeToZone: (zone: ZoneName, resource: ResourceName, amount: number) => void;
  claimRole: (roleId: number, playerName: string) => void;

  // Admin actions
  authenticateAdmin: (password: string) => void;
  isAdmin: boolean;
  setAct: (act: 1 | 2 | 3 | 4 | 5) => void;
  setScene: (scene: number) => void;
  startTimer: (seconds: number) => void;
  stopTimer: () => void;
  updateZoneLevel: (zone: ZoneName, level: number) => void;
  updateZoneResource: (zone: ZoneName, resource: ResourceName, amount: number) => void;
  revealUnknown: () => void;
  createVote: (question: string, options: string[]) => void;
  startVote: (voteId: string) => void;
  closeVote: (voteId: string) => void;
  lightCandle: (candleId: number) => void;
  revealFog: () => void;
  revealSecret: (roleId: number) => void;
  resetSession: () => void;
  giveResource: (roleId: number, resource: ResourceName, amount: number) => void;
  upgradeZone: (zone: ZoneName) => void;
  configureGame: (playerCount: number, difficulty: Difficulty, distributionMode: DistributionMode) => void;
  startGame: () => void;
  finishGame: () => void;
  setGamePhase: (phase: GamePhase) => void;
  unclaimRole: (roleId: number) => void;

  // Event system
  updateEventSettings: (settings: { enabled?: boolean; probability?: number; enabledEventIds?: number[] }) => void;
  triggerEvent: (eventId: number) => void;
  triggerDilemmaEvent: (eventId: number) => void;
  dismissEvent: () => void;
  applyEventEffect: (resource: ResourceName | 'all', amount: number, zone: ZoneName | 'all') => void;
  recordEventChoice: (eventId: number, choice: string) => void;

  // Session management
  joinSession: (code: string) => void;
}

const ADMIN_PASSWORD_KEY = 'horizon_admin_password';

export function useGameState(options: UseGameStateOptions = {}): UseGameStateReturn {
  const { sessionCode: initialSessionCode } = options;

  const { isConnected, isSessionJoined, sessionCode, emit, on, off, joinSession } = useSocket({
    sessionCode: initialSessionCode,
  });

  const [state, setState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    on<GameState>('game:state', (newState) => {
      setState(newState);
      setIsLoading(false);
    });

    on<{ message: string }>('player:error', ({ message }) => {
      setError(message);
    });

    on<{ message: string }>('admin:error', ({ message }) => {
      setError(message);
      // Clear saved password on auth error
      sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
    });

    on('admin:authenticated', () => {
      setIsAdmin(true);
      setError(null);
    });

    return () => {
      off('game:state');
      off('player:error');
      off('admin:error');
      off('admin:authenticated');
    };
  }, [on, off]);

  // Request state when session is joined and auto-authenticate admin
  useEffect(() => {
    if (isConnected && isSessionJoined) {
      emit('request:state');

      // Auto-authenticate: try JWT token first, then saved password
      if (!isAdmin) {
        const jwtToken = authApi.getToken();
        if (jwtToken) {
          // Facilitator is logged in - use JWT for admin auth
          emit('admin:auth', jwtToken);
        } else {
          // Fallback to saved password (legacy mode)
          const savedPassword = sessionStorage.getItem(ADMIN_PASSWORD_KEY);
          if (savedPassword) {
            emit('admin:auth', savedPassword);
          }
        }
      }
    }
  }, [isConnected, isSessionJoined, emit, isAdmin]);

  // Player actions
  const joinAsPlayer = useCallback((token: string) => {
    emit('player:join', token);
  }, [emit]);

  const castVote = useCallback((voteId: string, optionId: string) => {
    emit('player:vote', { voteId, optionId });
  }, [emit]);

  const setPromise = useCallback((text: string, deadline: string) => {
    emit('player:set-promise', { text, deadline });
  }, [emit]);

  const contributeToZone = useCallback(
    (zone: ZoneName, resource: ResourceName, amount: number) => {
      emit('player:contribute', { zone, resource, amount });
    },
    [emit]
  );

  const claimRole = useCallback(
    (roleId: number, playerName: string) => {
      emit('player:claim-role', { roleId, playerName });
    },
    [emit]
  );

  // Admin actions
  const authenticateAdmin = useCallback((password: string) => {
    // Save password for auto-reconnect
    sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
    emit('admin:auth', password);
  }, [emit]);

  const setAct = useCallback((act: 1 | 2 | 3 | 4 | 5) => {
    emit('admin:set-act', act);
  }, [emit]);

  const setScene = useCallback((scene: number) => {
    emit('admin:set-scene', scene);
  }, [emit]);

  const startTimer = useCallback((seconds: number) => {
    emit('admin:start-timer', seconds);
  }, [emit]);

  const stopTimer = useCallback(() => {
    emit('admin:stop-timer');
  }, [emit]);

  const updateZoneLevel = useCallback((zone: ZoneName, level: number) => {
    emit('admin:update-zone-level', { zone, level });
  }, [emit]);

  const updateZoneResource = useCallback(
    (zone: ZoneName, resource: ResourceName, amount: number) => {
      emit('admin:update-zone-resource', { zone, resource, amount });
    },
    [emit]
  );

  const revealUnknown = useCallback(() => {
    emit('admin:reveal-unknown');
  }, [emit]);

  const createVote = useCallback((question: string, options: string[]) => {
    emit('admin:create-vote', { question, options });
  }, [emit]);

  const startVote = useCallback((voteId: string) => {
    emit('admin:start-vote', voteId);
  }, [emit]);

  const closeVote = useCallback((voteId: string) => {
    emit('admin:close-vote', voteId);
  }, [emit]);

  const lightCandle = useCallback((candleId: number) => {
    emit('admin:light-candle', candleId);
  }, [emit]);

  const revealFog = useCallback(() => {
    emit('admin:reveal-fog');
  }, [emit]);

  const revealSecret = useCallback((roleId: number) => {
    emit('admin:reveal-secret', roleId);
  }, [emit]);

  const resetSession = useCallback(() => {
    emit('admin:reset-session');
  }, [emit]);

  const giveResource = useCallback(
    (roleId: number, resource: ResourceName, amount: number) => {
      emit('admin:give-resource', { roleId, resource, amount });
    },
    [emit]
  );

  const upgradeZone = useCallback((zone: ZoneName) => {
    emit('admin:upgrade-zone', zone);
  }, [emit]);

  const configureGame = useCallback(
    (playerCount: number, difficulty: Difficulty, distributionMode: DistributionMode) => {
      emit('admin:configure-game', { playerCount, difficulty, distributionMode });
    },
    [emit]
  );

  const startGame = useCallback(() => {
    emit('admin:start-game');
  }, [emit]);

  const finishGame = useCallback(() => {
    emit('admin:finish-game');
  }, [emit]);

  const setGamePhase = useCallback((phase: GamePhase) => {
    emit('admin:set-game-phase', phase);
  }, [emit]);

  const unclaimRole = useCallback((roleId: number) => {
    emit('admin:unclaim-role', roleId);
  }, [emit]);

  // Event system
  const updateEventSettings = useCallback(
    (settings: { enabled?: boolean; probability?: number; enabledEventIds?: number[] }) => {
      emit('admin:update-event-settings', settings);
    },
    [emit]
  );

  const triggerEvent = useCallback((eventId: number) => {
    emit('admin:trigger-event', eventId);
  }, [emit]);

  const triggerDilemmaEvent = useCallback((eventId: number) => {
    emit('admin:trigger-dilemma-event', eventId);
  }, [emit]);

  const dismissEvent = useCallback(() => {
    emit('admin:dismiss-event');
  }, [emit]);

  const applyEventEffect = useCallback(
    (resource: ResourceName | 'all', amount: number, zone: ZoneName | 'all') => {
      emit('admin:apply-event-effect', { resource, amount, zone });
    },
    [emit]
  );

  const recordEventChoice = useCallback(
    (eventId: number, choice: string) => {
      emit('admin:record-event-choice', { eventId, choice });
    },
    [emit]
  );

  return {
    state,
    isConnected,
    isSessionJoined,
    isLoading,
    error,
    sessionCode,
    joinAsPlayer,
    castVote,
    setPromise,
    contributeToZone,
    claimRole,
    authenticateAdmin,
    isAdmin,
    setAct,
    setScene,
    startTimer,
    stopTimer,
    updateZoneLevel,
    updateZoneResource,
    revealUnknown,
    createVote,
    startVote,
    closeVote,
    lightCandle,
    revealFog,
    revealSecret,
    resetSession,
    giveResource,
    upgradeZone,
    configureGame,
    startGame,
    finishGame,
    setGamePhase,
    unclaimRole,
    updateEventSettings,
    triggerEvent,
    triggerDilemmaEvent,
    dismissEvent,
    applyEventEffect,
    recordEventChoice,
    joinSession,
  };
}
