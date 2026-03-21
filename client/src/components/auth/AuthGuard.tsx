/**
 * AuthGuard Component
 *
 * Protects routes that require authentication.
 * Redirects to login if not authenticated.
 */

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore, selectIsAuthenticated, selectIsLoading, type AuthState } from '../../stores/authStore';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const isLoading = useAuthStore(selectIsLoading);
  const isInitialized = useAuthStore((state: AuthState) => state.isInitialized);
  const initialize = useAuthStore((state: AuthState) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isInitialized && !isLoading && !isAuthenticated) {
      // Save current location to redirect back after login
      navigate('/login', { state: { from: location.pathname } });
    }
  }, [isInitialized, isLoading, isAuthenticated, navigate, location]);

  // Show loading state while initializing
  if (!isInitialized || isLoading) {
    return fallback || <AuthLoadingScreen />;
  }

  // Not authenticated - will redirect
  if (!isAuthenticated) {
    return fallback || <AuthLoadingScreen />;
  }

  return <>{children}</>;
}

/**
 * Loading screen while checking auth.
 */
function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D4A017] mx-auto mb-4"></div>
        <p className="text-[#778DA9]">Загрузка...</p>
      </div>
    </div>
  );
}

/**
 * Hook to check if user is authenticated.
 */
export function useAuth() {
  const user = useAuthStore((state: AuthState) => state.user);
  const playerProfile = useAuthStore((state: AuthState) => state.playerProfile);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const isLoading = useAuthStore(selectIsLoading);
  const error = useAuthStore((state: AuthState) => state.error);
  const login = useAuthStore((state: AuthState) => state.login);
  const register = useAuthStore((state: AuthState) => state.register);
  const logout = useAuthStore((state: AuthState) => state.logout);
  const clearError = useAuthStore((state: AuthState) => state.clearError);

  return {
    user,
    playerProfile,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
  };
}

export default AuthGuard;
