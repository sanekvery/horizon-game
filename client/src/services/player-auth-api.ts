/**
 * Player Auth API Client
 *
 * Handles player authentication requests.
 */

const API_BASE = '/api/player/auth';

// ============================================
// Types
// ============================================

export interface PlayerProfile {
  id: string;
  userId: string;
  displayName: string;
  avatar: string | null;
  totalXP: number;
  level: number;
  stats: CharacterStats;
  availablePoints: number;
  achievements: string[];
  totalGames: number;
  totalWins: number;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterStats {
  strength: number;
  agility: number;
  negotiation: number;
  intellect: number;
  charisma: number;
  craft: number;
}

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuthResponse {
  success: boolean;
  error?: string;
  token?: string;
  user?: User;
  playerProfile?: PlayerProfile;
}

export interface ProfileResponse {
  success: boolean;
  error?: string;
  profile?: PlayerProfile;
}

// ============================================
// Token Management
// ============================================

const TOKEN_KEY = 'horizon_player_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ============================================
// API Functions
// ============================================

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Register new player.
 */
export async function register(
  email: string,
  password: string,
  displayName: string
): Promise<AuthResponse> {
  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });

    const data = await res.json();

    if (data.success && data.token) {
      setStoredToken(data.token);
    }

    return data;
  } catch (error) {
    return { success: false, error: 'Ошибка сети' };
  }
}

/**
 * Login player.
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.success && data.token) {
      setStoredToken(data.token);
    }

    return data;
  } catch (error) {
    return { success: false, error: 'Ошибка сети' };
  }
}

/**
 * Logout player.
 */
export async function logout(): Promise<{ success: boolean }> {
  try {
    await fetchWithAuth(`${API_BASE}/logout`, { method: 'POST' });
    clearStoredToken();
    return { success: true };
  } catch {
    clearStoredToken();
    return { success: true };
  }
}

/**
 * Get current user info.
 */
export async function getCurrentUser(): Promise<AuthResponse> {
  try {
    const res = await fetchWithAuth(`${API_BASE}/me`);

    if (!res.ok) {
      clearStoredToken();
      return { success: false, error: 'Не авторизован' };
    }

    return await res.json();
  } catch {
    return { success: false, error: 'Ошибка сети' };
  }
}

/**
 * Verify email with token.
 */
export async function verifyEmail(token: string): Promise<AuthResponse> {
  try {
    const res = await fetch(`${API_BASE}/verify-email/${token}`, {
      method: 'POST',
    });

    return await res.json();
  } catch {
    return { success: false, error: 'Ошибка сети' };
  }
}

/**
 * Request password reset.
 */
export async function forgotPassword(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    return await res.json();
  } catch {
    return { success: false, error: 'Ошибка сети' };
  }
}

/**
 * Reset password with token.
 */
export async function resetPassword(
  token: string,
  password: string
): Promise<AuthResponse> {
  try {
    const res = await fetch(`${API_BASE}/reset-password/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    return await res.json();
  } catch {
    return { success: false, error: 'Ошибка сети' };
  }
}

/**
 * Update player profile.
 */
export async function updateProfile(data: {
  displayName?: string;
  avatar?: string;
}): Promise<ProfileResponse> {
  try {
    const res = await fetchWithAuth(`${API_BASE}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

    return await res.json();
  } catch {
    return { success: false, error: 'Ошибка сети' };
  }
}

/**
 * Allocate stat points.
 */
export async function allocatePoints(
  statName: keyof CharacterStats,
  points: number
): Promise<ProfileResponse> {
  try {
    const res = await fetchWithAuth(`${API_BASE}/allocate-points`, {
      method: 'POST',
      body: JSON.stringify({ statName, points }),
    });

    return await res.json();
  } catch {
    return { success: false, error: 'Ошибка сети' };
  }
}

/**
 * Check if user is authenticated.
 */
export function isAuthenticated(): boolean {
  return !!getStoredToken();
}

export const playerAuthApi = {
  register,
  login,
  logout,
  getCurrentUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
  updateProfile,
  allocatePoints,
  isAuthenticated,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
};
