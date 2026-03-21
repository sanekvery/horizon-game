/**
 * Auth Store
 *
 * Zustand store for managing player authentication state.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  playerAuthApi,
  type User,
  type PlayerProfile,
  type CharacterStats,
} from '../services/player-auth-api';

// ============================================
// Types
// ============================================

export interface AuthState {
  // State
  user: User | null;
  playerProfile: PlayerProfile | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: { displayName?: string; avatar?: string }) => Promise<boolean>;
  allocatePoints: (statName: keyof CharacterStats, points: number) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

// ============================================
// Store
// ============================================

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      playerProfile: null,
      isLoading: false,
      isInitialized: false,
      error: null,

      /**
       * Initialize auth state from stored token.
       * Called on app startup.
       */
      initialize: async () => {
        if (get().isInitialized) return;

        const token = playerAuthApi.getStoredToken();

        if (!token) {
          set({ isInitialized: true });
          return;
        }

        set({ isLoading: true });

        const result = await playerAuthApi.getCurrentUser();

        if (result.success && result.user) {
          set({
            user: result.user,
            playerProfile: result.playerProfile || null,
            isLoading: false,
            isInitialized: true,
          });
        } else {
          // Token invalid, clear it
          playerAuthApi.clearStoredToken();
          set({
            user: null,
            playerProfile: null,
            isLoading: false,
            isInitialized: true,
          });
        }
      },

      /**
       * Login player.
       */
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        const result = await playerAuthApi.login(email, password);

        if (result.success && result.user) {
          set({
            user: result.user,
            playerProfile: result.playerProfile || null,
            isLoading: false,
          });
          return { success: true };
        }

        set({
          isLoading: false,
          error: result.error || 'Ошибка входа',
        });

        return { success: false, error: result.error };
      },

      /**
       * Register new player.
       */
      register: async (email: string, password: string, displayName: string) => {
        set({ isLoading: true, error: null });

        const result = await playerAuthApi.register(email, password, displayName);

        if (result.success && result.user) {
          set({
            user: result.user,
            playerProfile: result.playerProfile || null,
            isLoading: false,
          });
          return { success: true };
        }

        set({
          isLoading: false,
          error: result.error || 'Ошибка регистрации',
        });

        return { success: false, error: result.error };
      },

      /**
       * Logout player.
       */
      logout: async () => {
        await playerAuthApi.logout();
        set({
          user: null,
          playerProfile: null,
          error: null,
        });
      },

      /**
       * Update player profile.
       */
      updateProfile: async (data: { displayName?: string; avatar?: string }) => {
        const result = await playerAuthApi.updateProfile(data);

        if (result.success && result.profile) {
          set({ playerProfile: result.profile });
          return true;
        }

        set({ error: result.error || 'Ошибка обновления профиля' });
        return false;
      },

      /**
       * Allocate stat points.
       */
      allocatePoints: async (statName: keyof CharacterStats, points: number) => {
        const result = await playerAuthApi.allocatePoints(statName, points);

        if (result.success && result.profile) {
          set({ playerProfile: result.profile });
          return true;
        }

        set({ error: result.error || 'Ошибка распределения очков' });
        return false;
      },

      /**
       * Refresh profile from server.
       */
      refreshProfile: async () => {
        const result = await playerAuthApi.getCurrentUser();

        if (result.success && result.user) {
          set({
            user: result.user,
            playerProfile: result.playerProfile || null,
          });
        }
      },

      /**
       * Clear error message.
       */
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'horizon-auth',
      partialize: (state: AuthState) => ({
        // Only persist user and profile, not loading/error states
        user: state.user,
        playerProfile: state.playerProfile,
      }),
    }
  )
);

// ============================================
// Selectors
// ============================================

export const selectIsAuthenticated = (state: AuthState) => !!state.user;
export const selectUser = (state: AuthState) => state.user;
export const selectPlayerProfile = (state: AuthState) => state.playerProfile;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectError = (state: AuthState) => state.error;
