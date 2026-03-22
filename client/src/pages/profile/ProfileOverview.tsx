/**
 * ProfileOverview Page
 *
 * Main profile page with character card and quick stats.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../components/auth/AuthGuard';
import { CharacterCard, StatBar, AchievementBadge } from '../../components/profile';
import type { CharacterStats } from '../../services/player-auth-api';

type StatId = keyof CharacterStats;

const STAT_IDS: StatId[] = [
  'strength', 'agility', 'negotiation', 'intellect', 'charisma',
  'craft', 'luck', 'endurance', 'leadership', 'perception'
];

export function ProfileOverview() {
  const navigate = useNavigate();
  const { playerProfile } = useAuth();
  const [sessionCode, setSessionCode] = useState('');

  const handleJoinGame = () => {
    const code = sessionCode.trim().toUpperCase();
    if (code.length >= 4) {
      navigate(`/lobby?session=${code}`);
    }
  };

  if (!playerProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D4A017]" />
      </div>
    );
  }

  // Get top 3 achievements
  const recentAchievements = playerProfile.achievements.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Character Card */}
      <CharacterCard profile={playerProfile} />

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-[#D4A017]/20 to-[#D4A017]/10 border border-[#D4A017]/30 rounded-xl p-5">
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
            className="px-6 py-2 bg-[#D4A017] text-[#0D1B2A] font-medium rounded-lg hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Войти
          </button>
        </div>
      </div>

      {/* Stats Preview */}
      <div className="bg-[#1B263B] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#E0E1DD]">Характеристики</h2>
          {playerProfile.availablePoints > 0 && (
            <button
              onClick={() => navigate('/profile/stats')}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              +{playerProfile.availablePoints} очков
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STAT_IDS.slice(0, 6).map((statId) => (
            <StatBar
              key={statId}
              statId={statId}
              value={playerProfile.stats[statId]}
              showTooltip={false}
            />
          ))}
        </div>
        <button
          onClick={() => navigate('/profile/stats')}
          className="w-full mt-4 py-2 text-sm text-[#778DA9] hover:text-[#E0E1DD] transition-colors"
        >
          Смотреть все характеристики
        </button>
      </div>

      {/* Recent Achievements */}
      {recentAchievements.length > 0 && (
        <div className="bg-[#1B263B] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#E0E1DD]">Достижения</h2>
            <span className="text-sm text-[#778DA9]">
              {playerProfile.achievements.length} получено
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentAchievements.map((achievementId) => (
              <AchievementBadge
                key={achievementId}
                achievementId={achievementId}
                unlocked={true}
                compact={true}
              />
            ))}
          </div>
          <button
            onClick={() => navigate('/profile/achievements')}
            className="w-full mt-4 py-2 text-sm text-[#778DA9] hover:text-[#E0E1DD] transition-colors"
          >
            Смотреть все достижения
          </button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1B263B] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[#D4A017]">{playerProfile.totalGames}</p>
          <p className="text-sm text-[#778DA9]">Игр</p>
        </div>
        <div className="bg-[#1B263B] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[#D4A017]">{playerProfile.totalWins}</p>
          <p className="text-sm text-[#778DA9]">Побед</p>
        </div>
        <div className="bg-[#1B263B] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[#D4A017]">{playerProfile.totalXP}</p>
          <p className="text-sm text-[#778DA9]">XP</p>
        </div>
      </div>
    </div>
  );
}
