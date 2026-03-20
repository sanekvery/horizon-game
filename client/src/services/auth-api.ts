const API_BASE = '/api/auth';

export interface Facilitator {
  id: string;
  email: string;
  name: string | null;
  role: 'FACILITATOR' | 'ADMIN';
  subscriptionType: 'FREE' | 'PRO' | 'ENTERPRISE';
  subscriptionExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  error?: string;
  token?: string;
  facilitator?: Facilitator;
}

const TOKEN_KEY = 'horizon_auth_token';

export const authApi = {
  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    if (data.success && data.token) {
      localStorage.setItem(TOKEN_KEY, data.token);
    }
    return data;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.success && data.token) {
      localStorage.setItem(TOKEN_KEY, data.token);
    }
    return data;
  },

  async getMe(): Promise<AuthResponse> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return { success: false, error: 'Не авторизован' };
    }

    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  },

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  },
};
