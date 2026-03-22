/**
 * Progression API Client
 *
 * Client-side API for character progression system.
 */

import { authApi } from './auth-api';

const API_BASE = '/api/progression';

export interface CharacterStats {
  strength: number;
  agility: number;
  negotiation: number;
  intellect: number;
  charisma: number;
  craft: number;
  luck: number;
  endurance: number;
  leadership: number;
  perception: number;
}

export interface SessionPlayerStats {
  roleId: number;
  playerName: string | null;
  stats: CharacterStats;
  experienceGained: number;
  level: number;
}

export interface PlayerProgression {
  playerIdentifier: string;
  roleId: number;
  stats: CharacterStats;
  experience: {
    totalXP: number;
    unspentPoints: number;
    level: number;
  };
  totalGames: number;
  achievements: string[];
}

export interface ResourceBonus {
  multiplier: number;
  effectiveAmount: number;
  bonusAmount: number;
}

export interface VoteInfluence {
  weight: number;
  effectiveVotes: number;
}

// Response types
interface ApiResponse {
  success: boolean;
  error?: string;
}

interface SessionPlayerStatsResponse extends ApiResponse {
  stats?: SessionPlayerStats;
}

interface AllPlayersStatsResponse extends ApiResponse {
  players?: SessionPlayerStats[];
}

interface ProgressionEnabledResponse extends ApiResponse {
  enabled?: boolean;
}

interface PlayerProgressionResponse extends ApiResponse {
  progression?: PlayerProgression;
}

interface StatAllocationResponse extends ApiResponse {
  newStats?: CharacterStats;
  remainingPoints?: number;
}

interface ResourceBonusResponse extends ApiResponse {
  bonus?: ResourceBonus;
}

interface VoteInfluenceResponse extends ApiResponse {
  influence?: VoteInfluence;
}

export const progressionApi = {
  /**
   * Get player stats for a session.
   */
  async getSessionPlayerStats(
    sessionCode: string,
    roleId: number
  ): Promise<SessionPlayerStatsResponse> {
    try {
      const response = await fetch(`${API_BASE}/session/${sessionCode}/player/${roleId}`);
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Не удалось получить статы игрока' };
    }
  },

  /**
   * Get all players' stats for a session.
   */
  async getAllSessionPlayerStats(sessionCode: string): Promise<AllPlayersStatsResponse> {
    try {
      const response = await fetch(`${API_BASE}/session/${sessionCode}/players`);
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Не удалось получить статы игроков' };
    }
  },

  /**
   * Check if progression is enabled for a session.
   */
  async isProgressionEnabled(sessionCode: string): Promise<ProgressionEnabledResponse> {
    try {
      const response = await fetch(`${API_BASE}/session/${sessionCode}/enabled`);
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Не удалось проверить статус прогрессии' };
    }
  },

  /**
   * Enable/disable progression for a session.
   */
  async setProgressionEnabled(
    sessionCode: string,
    enabled: boolean
  ): Promise<ProgressionEnabledResponse> {
    const token = authApi.getToken();
    try {
      const response = await fetch(`${API_BASE}/session/${sessionCode}/enabled`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ enabled }),
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Не удалось изменить настройки прогрессии' };
    }
  },

  /**
   * Get persistent player progression.
   */
  async getPlayerProgression(
    facilitatorId: string,
    playerIdentifier: string,
    roleId: number
  ): Promise<PlayerProgressionResponse> {
    const token = authApi.getToken();
    try {
      const response = await fetch(
        `${API_BASE}/player/${encodeURIComponent(playerIdentifier)}/role/${roleId}`,
        {
          headers: {
            'X-Facilitator-Id': facilitatorId,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Не удалось получить прогресс игрока' };
    }
  },

  /**
   * Allocate stat points.
   */
  async allocateStatPoints(
    facilitatorId: string,
    playerIdentifier: string,
    roleId: number,
    statName: keyof CharacterStats,
    points: number
  ): Promise<StatAllocationResponse> {
    const token = authApi.getToken();
    try {
      const response = await fetch(
        `${API_BASE}/player/${encodeURIComponent(playerIdentifier)}/role/${roleId}/allocate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Facilitator-Id': facilitatorId,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ statName, points }),
        }
      );
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Не удалось распределить очки' };
    }
  },

  /**
   * Calculate resource contribution bonus.
   */
  async calculateResourceBonus(
    stats: CharacterStats,
    amount: number
  ): Promise<ResourceBonusResponse> {
    try {
      const response = await fetch(`${API_BASE}/calculate/resource-bonus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats, amount }),
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Не удалось рассчитать бонус' };
    }
  },

  /**
   * Calculate vote influence.
   */
  async calculateVoteInfluence(stats: CharacterStats): Promise<VoteInfluenceResponse> {
    try {
      const response = await fetch(`${API_BASE}/calculate/vote-influence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats }),
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Не удалось рассчитать влияние' };
    }
  },
};
