import { authApi } from './auth-api';

const API_BASE = '/api/sessions';

export interface GameSession {
  id: string;
  code: string;
  name: string | null;
  status: 'SETUP' | 'ACTIVE' | 'PAUSED' | 'FINISHED';
  playerCount: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface SessionResponse {
  success: boolean;
  error?: string;
  session?: GameSession;
}

export interface SessionsResponse {
  success: boolean;
  error?: string;
  sessions?: GameSession[];
}

export interface CreateSessionInput {
  name?: string;
  playerCount: number;
}

// History types
export type ActorType = 'PLAYER' | 'FACILITATOR' | 'SYSTEM';

export interface ActionLogEntry {
  id: string;
  sessionId: string;
  playerId: string | null;
  actorType: ActorType;
  actionType: string;
  actionData: Record<string, unknown>;
  gameContext: {
    act?: number;
    scene?: number;
    phase?: string;
  };
  createdAt: string;
  playerName?: string | null;
}

export interface SessionStats {
  totalActions: number;
  playerActions: number;
  adminActions: number;
  systemActions: number;
  duration: number;
  topActions: { actionType: string; count: number }[];
}

export interface HistoryOptions {
  limit?: number;
  offset?: number;
  actorType?: ActorType;
  actionTypes?: string[];
}

export interface HistoryResponse {
  success: boolean;
  error?: string;
  history?: ActionLogEntry[];
}

export interface StatsResponse {
  success: boolean;
  error?: string;
  stats?: SessionStats;
}

function getHeaders(): HeadersInit {
  const token = authApi.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const sessionApi = {
  /**
   * Create a new game session
   */
  async create(input: CreateSessionInput): Promise<SessionResponse> {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    return res.json();
  },

  /**
   * Get all sessions for current facilitator
   */
  async getAll(): Promise<SessionsResponse> {
    const res = await fetch(API_BASE, {
      headers: getHeaders(),
    });
    return res.json();
  },

  /**
   * Get session by ID
   */
  async getById(id: string): Promise<SessionResponse> {
    const res = await fetch(`${API_BASE}/${id}`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  /**
   * Get session by code (for players joining)
   */
  async getByCode(code: string): Promise<SessionResponse> {
    const res = await fetch(`${API_BASE}/code/${code.toUpperCase()}`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  /**
   * Delete a session
   */
  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  },

  /**
   * Get session action history
   */
  async getHistory(
    code: string,
    options: HistoryOptions = {}
  ): Promise<HistoryResponse> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', String(options.limit));
    if (options.offset) params.append('offset', String(options.offset));
    if (options.actorType) params.append('actorType', options.actorType);
    if (options.actionTypes?.length) {
      params.append('actionTypes', options.actionTypes.join(','));
    }

    const queryString = params.toString();
    const url = `${API_BASE}/code/${code.toUpperCase()}/history${queryString ? `?${queryString}` : ''}`;

    const res = await fetch(url, {
      headers: getHeaders(),
    });
    return res.json();
  },

  /**
   * Get session statistics
   */
  async getStats(code: string): Promise<StatsResponse> {
    const res = await fetch(`${API_BASE}/code/${code.toUpperCase()}/stats`, {
      headers: getHeaders(),
    });
    return res.json();
  },
};
