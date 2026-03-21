/**
 * Login Page
 *
 * Player login form.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../components/auth/AuthGuard';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as { from?: string })?.from || '/profile';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  // Clear errors on unmount
  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!email || !password) {
      setLocalError('Заполните все поля');
      return;
    }

    const result = await login(email, password);

    if (result.success) {
      const from = (location.state as { from?: string })?.from || '/profile';
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#D4A017] mb-2">ГОРИЗОНТ</h1>
          <p className="text-[#778DA9]">Вход в личный кабинет</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-[#1B263B] rounded-xl p-6 space-y-4">
          {/* Error message */}
          {(error || localError) && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
              {error || localError}
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-[#778DA9] text-sm mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0D1B2A] border border-[#415A77] rounded-lg px-4 py-3 text-[#E0E1DD] placeholder-[#415A77] focus:border-[#D4A017] focus:outline-none transition-colors"
              placeholder="your@email.com"
              autoComplete="email"
              disabled={isLoading}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-[#778DA9] text-sm mb-2">
              Пароль
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0D1B2A] border border-[#415A77] rounded-lg px-4 py-3 text-[#E0E1DD] placeholder-[#415A77] focus:border-[#D4A017] focus:outline-none transition-colors"
              placeholder="******"
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>

          {/* Forgot password link */}
          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-[#778DA9] text-sm hover:text-[#D4A017] transition-colors"
            >
              Забыли пароль?
            </Link>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#D4A017] hover:bg-[#B8860B] disabled:bg-[#415A77] disabled:cursor-not-allowed text-[#0D1B2A] font-semibold py-3 rounded-lg transition-colors"
          >
            {isLoading ? 'Вход...' : 'Войти'}
          </button>

          {/* Register link */}
          <div className="text-center pt-4 border-t border-[#415A77]/30">
            <span className="text-[#778DA9] text-sm">Нет аккаунта? </span>
            <Link
              to="/register"
              className="text-[#D4A017] text-sm hover:underline"
            >
              Зарегистрироваться
            </Link>
          </div>
        </form>

        {/* Back to home */}
        <div className="text-center mt-6">
          <Link to="/" className="text-[#778DA9] text-sm hover:text-[#E0E1DD] transition-colors">
            &larr; На главную
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
