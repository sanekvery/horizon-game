import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/auth-api';

type AuthMode = 'login' | 'register';

export function FacilitatorAuth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = mode === 'login'
        ? await authApi.login(email, password)
        : await authApi.register(email, password, name || undefined);

      if (result.success) {
        navigate('/facilitator');
      } else {
        setError(result.error || 'Произошла ошибка');
      }
    } catch {
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center p-4">
      <div className="bg-[#1B263B] rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#E0E1DD] mb-2">Проект Горизонт</h1>
          <p className="text-[#778DA9]">
            {mode === 'login' ? 'Вход для фасилитаторов' : 'Регистрация фасилитатора'}
          </p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-[#778DA9] text-sm mb-2">Имя</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
                className="w-full bg-[#0D1B2A] border border-[#415A77] rounded-lg px-4 py-3 text-[#E0E1DD] placeholder-[#415A77] focus:outline-none focus:border-[#778DA9]"
              />
            </div>
          )}

          <div>
            <label className="block text-[#778DA9] text-sm mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              className="w-full bg-[#0D1B2A] border border-[#415A77] rounded-lg px-4 py-3 text-[#E0E1DD] placeholder-[#415A77] focus:outline-none focus:border-[#778DA9]"
            />
          </div>

          <div>
            <label className="block text-[#778DA9] text-sm mb-2">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Минимум 6 символов' : 'Введите пароль'}
              required
              minLength={mode === 'register' ? 6 : undefined}
              className="w-full bg-[#0D1B2A] border border-[#415A77] rounded-lg px-4 py-3 text-[#E0E1DD] placeholder-[#415A77] focus:outline-none focus:border-[#778DA9]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#415A77] hover:bg-[#778DA9] disabled:opacity-50 disabled:cursor-not-allowed text-[#E0E1DD] font-semibold py-3 rounded-lg transition-colors mt-6"
          >
            {loading ? 'Загрузка...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="mt-6 text-center">
          {mode === 'login' ? (
            <p className="text-[#778DA9]">
              Нет аккаунта?{' '}
              <button
                onClick={() => { setMode('register'); setError(null); }}
                className="text-[#D4A017] hover:underline"
              >
                Зарегистрироваться
              </button>
            </p>
          ) : (
            <p className="text-[#778DA9]">
              Уже есть аккаунт?{' '}
              <button
                onClick={() => { setMode('login'); setError(null); }}
                className="text-[#D4A017] hover:underline"
              >
                Войти
              </button>
            </p>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-[#415A77]/30 text-center">
          <a href="/admin" className="text-[#778DA9] hover:text-[#E0E1DD] text-sm">
            Вход по паролю сессии (старый способ)
          </a>
        </div>
      </div>
    </div>
  );
}
