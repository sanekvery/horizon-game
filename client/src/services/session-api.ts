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
};
