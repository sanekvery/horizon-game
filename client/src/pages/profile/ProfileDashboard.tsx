/**
 * Profile Dashboard
 *
 * Player's personal dashboard with stats, level, and game history.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../components/auth/AuthGuard';
import { StatsDisplay } from '../../components/progression/StatsDisplay';
import { ExperienceBar } from '../../components/progression/ExperienceBar';

export function ProfileDashboard() {
  const navigate = useNavigate();
  const { user, playerProfile, logout, isLoading } = useAuth();
  const [sessionCode, setSessionCode] = useState('');

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleJoinGame = () => {
    const code = sessionCode.trim().toUpperCase();
    if (code.length >= 4) {
      navigate(`/lobby?session=${code}`);
    }
  };

  if (isLoading || !user || !playerProfile) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D4A017]"></div>
      </div>
    );
  }

  const stats = playerProfile.stats;
  const winRate = playerProfile.totalGames > 0
    ? Math.round((playerProfile.totalWins / playerProfile.totalGames) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#0D1B2A]">
      {/* Header */}
      <header className="bg-[#1B263B] border-b border-[#415A77]/30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-[#D4A017]">
            ГОРИЗОНТ
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-[#778DA9] text-sm hidden sm:block">{user.email}</span>
            <button
              onClick={handleLogout}
              className="text-[#778DA9] hover:text-[#E0E1DD] text-sm transition-colors"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="bg-[#1B263B] rounded-xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-[#D4A017]/20 flex items-center justify-center text-3xl">
              {playerProfile.avatar || playerProfile.displayName[0].toUpperCase()}
            </div>

            {/* Name and stats summary */}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-[#E0E1DD] mb-1">
                {playerProfile.displayName}
              </h1>
              <div className="flex flex-wrap gap-4 text-sm text-[#778DA9]">
                <span>Уровень {playerProfile.level}</span>
                <span>Игр: {playerProfile.totalGames}</span>
                <span>Побед: {playerProfile.totalWins} ({winRate}%)</span>
              </div>
            </div>
          </div>

          {/* Experience Bar */}
          <ExperienceBar
            totalXP={playerProfile.totalXP}
            level={playerProfile.level}
            showDetails={true}
          />
        </div>

        {/* Two columns layout */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Stats */}
          <div className="bg-[#1B263B] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#E0E1DD]">Характеристики</h2>
              {playerProfile.availablePoints > 0 && (
                <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-1 rounded">
                  +{playerProfile.availablePoints} очков
                </span>
              )}
            </div>
            <StatsDisplay
              stats={stats}
              maxStatValue={15}
              showLabels={true}
            />
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            {/* Join Game Card */}
            <div className="bg-gradient-to-r from-[#D4A017]/20 to-[#D4A017]/10 border border-[#D4A017]/30 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-[#D4A017] mb-2">
                Присоединиться к игре
              </h2>
              <p className="text-[#778DA9] text-sm mb-4">
                Введите код сессии или отсканируйте QR-код
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Код сессии"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinGame()}
                  className="flex-1 bg-[#0D1B2A] border border-[#415A77] rounded-lg px-3 py-2 text-[#E0E1DD] placeholder-[#415A77] focus:border-[#D4A017] focus:outline-none text-sm uppercase"
                  maxLength={8}
                />
                <button
                  onClick={handleJoinGame}
                  disabled={sessionCode.trim().length < 4}
                  className="bg-[#D4A017] hover:bg-[#B8860B] disabled:bg-[#415A77] disabled:cursor-not-allowed text-[#0D1B2A] font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  Войти
                </button>
              </div>
            </div>

            {/* Stats Summary Card */}
            <div className="bg-[#1B263B] rounded-xl p-6">
              <h2 className="text-lg font-semibold text-[#E0E1DD] mb-4">Статистика</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-[#0D1B2A] rounded-lg">
                  <div className="text-2xl font-bold text-[#D4A017]">{playerProfile.totalGames}</div>
                  <div className="text-[#778DA9] text-xs">Всего игр</div>
                </div>
                <div className="text-center p-3 bg-[#0D1B2A] rounded-lg">
                  <div className="text-2xl font-bold text-emerald-400">{playerProfile.totalWins}</div>
                  <div className="text-[#778DA9] text-xs">Побед</div>
                </div>
                <div className="text-center p-3 bg-[#0D1B2A] rounded-lg">
                  <div className="text-2xl font-bold text-purple-400">{playerProfile.totalXP}</div>
                  <div className="text-[#778DA9] text-xs">Всего XP</div>
                </div>
                <div className="text-center p-3 bg-[#0D1B2A] rounded-lg">
                  <div className="text-2xl font-bold text-blue-400">{winRate}%</div>
                  <div className="text-[#778DA9] text-xs">Winrate</div>
                </div>
              </div>
            </div>

            {/* Achievements Preview */}
            <div className="bg-[#1B263B] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[#E0E1DD]">Достижения</h2>
                <span className="text-[#778DA9] text-sm">
                  {(playerProfile.achievements as string[]).length} / 6
                </span>
              </div>
              {(playerProfile.achievements as string[]).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {(playerProfile.achievements as string[]).slice(0, 4).map((achievement) => (
                    <span
                      key={achievement}
                      className="bg-[#D4A017]/20 text-[#D4A017] text-xs px-2 py-1 rounded"
                    >
                      {achievement}
                    </span>
                  ))}
                  {(playerProfile.achievements as string[]).length > 4 && (
                    <span className="text-[#778DA9] text-xs px-2 py-1">
                      +{(playerProfile.achievements as string[]).length - 4}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-[#778DA9] text-sm">
                  Сыграйте в игры, чтобы получить достижения
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Email verification notice */}
        {!user.emailVerified && (
          <div className="mt-6 bg-amber-900/30 border border-amber-500/50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">&#9888;</span>
              <div>
                <div className="text-amber-400 font-medium">Подтвердите email</div>
                <div className="text-[#778DA9] text-sm">
                  Мы отправили письмо на {user.email}. Подтвердите email для полного доступа к функциям.
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default ProfileDashboard;
