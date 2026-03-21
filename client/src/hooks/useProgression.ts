/**
 * useProgression Hook
 *
 * React hook for managing character progression state.
 */

import { useState, useEffect, useCallback } from 'react';
import { progressionApi, type CharacterStats, type SessionPlayerStats } from '../services/progression-api';
import { useSocket } from './useSocket';

export interface XPGainEvent {
  roleId: number;
  amount: number;
  reason: string;
  newTotal: number;
}

export interface LevelUpEvent {
  roleId: number;
  newLevel: number;
  availablePoints: number;
}

export interface UseProgressionOptions {
  sessionCode: string;
  roleId?: number;
  enabled?: boolean;
}

export interface UseProgressionResult {
  stats: SessionPlayerStats | null;
  isLoading: boolean;
  error: string | null;
  isProgressionEnabled: boolean;
  lastXPGain: XPGainEvent | null;
  lastLevelUp: LevelUpEvent | null;
  refresh: () => Promise<void>;
}

export function useProgression({
  sessionCode,
  roleId,
  enabled = true,
}: UseProgressionOptions): UseProgressionResult {
  const [stats, setStats] = useState<SessionPlayerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProgressionEnabled, setIsProgressionEnabled] = useState(false);
  const [lastXPGain, setLastXPGain] = useState<XPGainEvent | null>(null);
  const [lastLevelUp, setLastLevelUp] = useState<LevelUpEvent | null>(null);

  const { on, off, isConnected } = useSocket({ sessionCode });

  const fetchStats = useCallback(async () => {
    if (!sessionCode || roleId === undefined) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check if progression is enabled
      const enabledRes = await progressionApi.isProgressionEnabled(sessionCode);
      setIsProgressionEnabled(enabledRes.enabled ?? false);

      // Fetch player stats
      const statsRes = await progressionApi.getSessionPlayerStats(sessionCode, roleId);
      if (statsRes.success && statsRes.stats) {
        setStats(statsRes.stats);
      } else {
        setError(statsRes.error || 'Не удалось загрузить статы');
      }
    } catch (err) {
      setError('Ошибка при загрузке данных');
    } finally {
      setIsLoading(false);
    }
  }, [sessionCode, roleId]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchStats();
    }
  }, [fetchStats, enabled]);

  // Socket event handlers
  useEffect(() => {
    if (!enabled || !isConnected) return;

    const handleXPGained = (data: XPGainEvent) => {
      if (roleId !== undefined && data.roleId === roleId) {
        setLastXPGain(data);
        // Update local stats
        setStats((prev) =>
          prev
            ? {
                ...prev,
                experienceGained: data.newTotal,
              }
            : prev
        );

        // Clear after animation
        setTimeout(() => setLastXPGain(null), 3000);
      }
    };

    const handleLevelUp = (data: LevelUpEvent) => {
      if (roleId !== undefined && data.roleId === roleId) {
        setLastLevelUp(data);
        // Update local stats
        setStats((prev) =>
          prev
            ? {
                ...prev,
                level: data.newLevel,
              }
            : prev
        );

        // Clear after showing
        setTimeout(() => setLastLevelUp(null), 5000);
      }
    };

    const handleStatsUpdated = (data: { roleId: number; stats: CharacterStats }) => {
      if (roleId !== undefined && data.roleId === roleId) {
        setStats((prev) =>
          prev
            ? {
                ...prev,
                stats: data.stats,
              }
            : prev
        );
      }
    };

    on('progression:xp-gained', handleXPGained);
    on('progression:level-up', handleLevelUp);
    on('progression:stats-updated', handleStatsUpdated);

    return () => {
      off('progression:xp-gained');
      off('progression:level-up');
      off('progression:stats-updated');
    };
  }, [on, off, isConnected, enabled, roleId]);

  return {
    stats,
    isLoading,
    error,
    isProgressionEnabled,
    lastXPGain,
    lastLevelUp,
    refresh: fetchStats,
  };
}

/**
 * Hook for getting all players' progression stats in a session.
 */
export function useAllPlayersProgression(sessionCode: string) {
  const [players, setPlayers] = useState<SessionPlayerStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlayers = useCallback(async () => {
    if (!sessionCode) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await progressionApi.getAllSessionPlayerStats(sessionCode);
      if (res.success && res.players) {
        setPlayers(res.players);
      } else {
        setError(res.error || 'Не удалось загрузить данные');
      }
    } catch (err) {
      setError('Ошибка при загрузке данных');
    } finally {
      setIsLoading(false);
    }
  }, [sessionCode]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  return {
    players,
    isLoading,
    error,
    refresh: fetchPlayers,
  };
}
