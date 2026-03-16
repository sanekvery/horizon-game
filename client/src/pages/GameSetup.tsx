import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameState } from '../hooks/useGameState';
import type { Difficulty, DistributionMode } from '../types/game-state';

const MIN_PLAYERS = 4;
const MAX_PLAYERS = 20;

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; description: string }[] = [
  { value: 'easy', label: 'Лёгкий', description: 'Ресурсов хватит на весь город (+20% запас)' },
  { value: 'normal', label: 'Обычный', description: 'Ресурсов хватит на 3 зоны' },
  { value: 'hard', label: 'Сложный', description: 'Ресурсов хватит только на 2 зоны' },
  { value: 'manual', label: 'Ручной', description: 'Админ сам раздаёт ресурсы' },
];

const DISTRIBUTION_OPTIONS: { value: DistributionMode; label: string; description: string }[] = [
  { value: 'qr', label: 'QR-коды', description: 'Каждому игроку свой QR-код' },
  { value: 'online', label: 'Онлайн', description: 'Один QR, игроки выбирают роли сами' },
];

export function GameSetup() {
  const navigate = useNavigate();
  const { state, isAdmin, configureGame, authenticateAdmin, isConnected } = useGameState();

  const [playerCount, setPlayerCount] = useState(8);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [distributionMode, setDistributionMode] = useState<DistributionMode>('online');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    if (state?.settings) {
      setPlayerCount(state.settings.playerCount);
      setDifficulty(state.settings.difficulty);
      setDistributionMode(state.settings.distributionMode);
    }
  }, [state?.settings]);

  const handleAuth = () => {
    authenticateAdmin(password);
    setTimeout(() => {
      if (!isAdmin) setAuthError(true);
    }, 500);
  };

  const handleStartDistribution = () => {
    configureGame(playerCount, difficulty, distributionMode);
    setTimeout(() => {
      navigate('/qr');
    }, 300);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1B263B] to-[#0D1B2A] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-[#778DA9]">Подключение...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1B263B] to-[#0D1B2A] flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🎮</div>
            <h1 className="text-2xl font-bold text-[#D4A017] mb-2">Настройка игры</h1>
            <p className="text-[#778DA9]">Введите пароль администратора</p>
          </div>

          <div className="bg-[#1B263B]/50 rounded-xl p-6 border border-[#415A77]/30">
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setAuthError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
              placeholder="Пароль"
              className="w-full bg-[#0D1B2A] border border-[#415A77] rounded-lg px-4 py-3 text-white placeholder-[#415A77] mb-4 focus:outline-none focus:border-[#D4A017]"
            />
            {authError && (
              <p className="text-red-400 text-sm mb-4">Неверный пароль</p>
            )}
            <button
              onClick={handleAuth}
              className="w-full bg-gradient-to-r from-[#D4A017] to-[#B8860B] text-[#0D1B2A] font-bold py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              Войти
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1B263B] to-[#0D1B2A] p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎮</div>
          <h1 className="text-3xl font-bold text-[#D4A017] mb-2">Настройка игры</h1>
          <p className="text-[#778DA9]">Проект Горизонт</p>
        </div>

        {/* Player Count */}
        <div className="bg-[#1B263B]/50 rounded-xl p-6 border border-[#415A77]/30 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Количество игроков</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setPlayerCount(Math.max(MIN_PLAYERS, playerCount - 1))}
              className="w-12 h-12 rounded-lg bg-[#415A77] hover:bg-[#778DA9] text-white text-2xl font-bold transition-colors"
              disabled={playerCount <= MIN_PLAYERS}
            >
              −
            </button>
            <div className="flex-1 text-center">
              <span className="text-5xl font-bold text-[#D4A017]">{playerCount}</span>
              <p className="text-[#778DA9] text-sm mt-1">
                {playerCount === MAX_PLAYERS ? 'Максимум' : `Из ${MAX_PLAYERS} ролей`}
              </p>
            </div>
            <button
              onClick={() => setPlayerCount(Math.min(MAX_PLAYERS, playerCount + 1))}
              className="w-12 h-12 rounded-lg bg-[#415A77] hover:bg-[#778DA9] text-white text-2xl font-bold transition-colors"
              disabled={playerCount >= MAX_PLAYERS}
            >
              +
            </button>
          </div>
          <input
            type="range"
            min={MIN_PLAYERS}
            max={MAX_PLAYERS}
            value={playerCount}
            onChange={(e) => setPlayerCount(Number(e.target.value))}
            className="w-full mt-4 accent-[#D4A017]"
          />
        </div>

        {/* Difficulty */}
        <div className="bg-[#1B263B]/50 rounded-xl p-6 border border-[#415A77]/30 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Сложность</h2>
          <div className="space-y-3">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`
                  flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-all
                  ${difficulty === opt.value
                    ? 'bg-[#D4A017]/20 border-2 border-[#D4A017]'
                    : 'bg-[#0D1B2A]/50 border-2 border-transparent hover:border-[#415A77]'
                  }
                `}
              >
                <input
                  type="radio"
                  name="difficulty"
                  value={opt.value}
                  checked={difficulty === opt.value}
                  onChange={() => setDifficulty(opt.value)}
                  className="mt-1 accent-[#D4A017]"
                />
                <div>
                  <span className="font-medium text-white">{opt.label}</span>
                  <p className="text-sm text-[#778DA9]">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Distribution Mode */}
        <div className="bg-[#1B263B]/50 rounded-xl p-6 border border-[#415A77]/30 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Распределение ролей</h2>
          <div className="space-y-3">
            {DISTRIBUTION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`
                  flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-all
                  ${distributionMode === opt.value
                    ? 'bg-[#D4A017]/20 border-2 border-[#D4A017]'
                    : 'bg-[#0D1B2A]/50 border-2 border-transparent hover:border-[#415A77]'
                  }
                `}
              >
                <input
                  type="radio"
                  name="distributionMode"
                  value={opt.value}
                  checked={distributionMode === opt.value}
                  onChange={() => setDistributionMode(opt.value)}
                  className="mt-1 accent-[#D4A017]"
                />
                <div>
                  <span className="font-medium text-white">{opt.label}</span>
                  <p className="text-sm text-[#778DA9]">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-[#0D1B2A]/50 rounded-xl p-4 mb-6 border border-[#415A77]/30">
          <h3 className="text-sm font-medium text-[#778DA9] mb-2">Итого:</h3>
          <ul className="text-white space-y-1">
            <li>• Игроков: <span className="text-[#D4A017]">{playerCount}</span></li>
            <li>• Сложность: <span className="text-[#D4A017]">{DIFFICULTY_OPTIONS.find(d => d.value === difficulty)?.label}</span></li>
            <li>• Распределение: <span className="text-[#D4A017]">{DISTRIBUTION_OPTIONS.find(d => d.value === distributionMode)?.label}</span></li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/admin')}
            className="flex-1 bg-[#415A77] text-white font-bold py-4 rounded-xl hover:bg-[#778DA9] transition-colors"
          >
            Назад
          </button>
          <button
            onClick={handleStartDistribution}
            className="flex-1 bg-gradient-to-r from-[#D4A017] to-[#B8860B] text-[#0D1B2A] font-bold py-4 rounded-xl hover:opacity-90 transition-opacity"
          >
            Начать распределение
          </button>
        </div>
      </div>
    </div>
  );
}
