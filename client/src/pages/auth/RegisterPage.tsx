/**
 * Register Page
 *
 * Player registration form.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../components/auth/AuthGuard';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, isAuthenticated, isLoading, error, clearError } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/profile', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Clear errors on unmount
  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    // Validation
    if (!displayName || !email || !password) {
      setLocalError('Заполните все поля');
      return;
    }

    if (displayName.length < 2) {
      setLocalError('Имя должно быть не менее 2 символов');
      return;
    }

    if (password.length < 6) {
      setLocalError('Пароль должен быть не менее 6 символов');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Пароли не совпадают');
      return;
    }

    const result = await register(email, password, displayName);

    if (result.success) {
      navigate('/profile', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#D4A017] mb-2">ГОРИЗОНТ</h1>
          <p className="text-[#778DA9]">Регистрация игрока</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-[#1B263B] rounded-xl p-6 space-y-4">
          {/* Error message */}
          {(error || localError) && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
              {error || localError}
            </div>
          )}

          {/* Display Name */}
          <div>
            <label htmlFor="displayName" className="block text-[#778DA9] text-sm mb-2">
              Имя в игре
            </label>
            <input
              type="text"
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[#0D1B2A] border border-[#415A77] rounded-lg px-4 py-3 text-[#E0E1DD] placeholder-[#415A77] focus:border-[#D4A017] focus:outline-none transition-colors"
              placeholder="Ваше имя"
              autoComplete="name"
              disabled={isLoading}
            />
          </div>

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
              placeholder="Минимум 6 символов"
              autoComplete="new-password"
              disabled={isLoading}
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-[#778DA9] text-sm mb-2">
              Подтвердите пароль
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#0D1B2A] border border-[#415A77] rounded-lg px-4 py-3 text-[#E0E1DD] placeholder-[#415A77] focus:border-[#D4A017] focus:outline-none transition-colors"
              placeholder="******"
              autoComplete="new-password"
              disabled={isLoading}
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#D4A017] hover:bg-[#B8860B] disabled:bg-[#415A77] disabled:cursor-not-allowed text-[#0D1B2A] font-semibold py-3 rounded-lg transition-colors"
          >
            {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>

          {/* Login link */}
          <div className="text-center pt-4 border-t border-[#415A77]/30">
            <span className="text-[#778DA9] text-sm">Уже есть аккаунт? </span>
            <Link
              to="/login"
              className="text-[#D4A017] text-sm hover:underline"
            >
              Войти
            </Link>
          </div>
        </form>

        {/* Info text */}
        <div className="text-center mt-6 text-[#778DA9] text-xs">
          <p>Регистрируясь, вы получаете возможность сохранять прогресс</p>
          <p>и участвовать в рейтингах игроков.</p>
        </div>

        {/* Back to home */}
        <div className="text-center mt-4">
          <Link to="/" className="text-[#778DA9] text-sm hover:text-[#E0E1DD] transition-colors">
            &larr; На главную
          </Link>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
