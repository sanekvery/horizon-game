/**
 * CharacterCard Component
 *
 * RPG-style character profile card with avatar, level, and XP.
 */

import { useMemo } from 'react';
import type { PlayerProfile } from '../../services/player-auth-api';

interface CharacterCardProps {
  profile: PlayerProfile;
  className?: string;
}

/**
 * Calculate XP needed for a specific level.
 * XP formula: level * 100 (linear for simplicity).
 */
function xpForLevel(level: number): number {
  return level * 100;
}

/**
 * Get level title based on level number.
 */
function getLevelTitle(level: number): string {
  if (level >= 50) return 'Легенда';
  if (level >= 40) return 'Гранд-мастер';
  if (level >= 30) return 'Мастер';
  if (level >= 20) return 'Эксперт';
  if (level >= 10) return 'Ветеран';
  if (level >= 5) return 'Опытный';
  return 'Новичок';
}

/**
 * Get avatar gradient based on level.
 */
function getAvatarGradient(level: number): string {
  if (level >= 50) return 'from-[#F59E0B] via-[#D97706] to-[#B45309]';
  if (level >= 30) return 'from-[#8B5CF6] via-[#7C3AED] to-[#6D28D9]';
  if (level >= 10) return 'from-[#3B82F6] via-[#2563EB] to-[#1D4ED8]';
  return 'from-[#6B7280] via-[#4B5563] to-[#374151]';
}

export function CharacterCard({ profile, className = '' }: CharacterCardProps) {
  const { xpProgress, xpNeeded, xpCurrent } = useMemo(() => {
    const currentLevelXP = xpForLevel(profile.level);
    const nextLevelXP = xpForLevel(profile.level + 1);
    const xpIntoLevel = profile.totalXP - currentLevelXP;
    const xpForNextLevel = nextLevelXP - currentLevelXP;
    const progress = Math.min(100, (xpIntoLevel / xpForNextLevel) * 100);

    return {
      xpProgress: progress,
      xpNeeded: xpForNextLevel,
      xpCurrent: xpIntoLevel,
    };
  }, [profile.totalXP, profile.level]);

  const winRate = profile.totalGames > 0
    ? Math.round((profile.totalWins / profile.totalGames) * 100)
    : 0;

  const levelTitle = getLevelTitle(profile.level);
  const avatarGradient = getAvatarGradient(profile.level);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Decorative frame */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#D4A017]/10 to-transparent rounded-2xl" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-[#D4A017] to-transparent" />

      {/* Card content */}
      <div className="relative bg-[#1B263B]/90 backdrop-blur-sm border border-[#D4A017]/20 rounded-2xl p-6">
        {/* Avatar and basic info */}
        <div className="flex items-start gap-5">
          {/* Avatar with frame */}
          <div className="relative">
            <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${avatarGradient} p-1`}>
              <div className="w-full h-full rounded-full bg-[#0D1B2A] flex items-center justify-center text-4xl">
                {profile.avatar || profile.displayName[0].toUpperCase()}
              </div>
            </div>
            {/* Level badge */}
            <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-[#D4A017] flex items-center justify-center">
              <span className="text-[#0D1B2A] font-bold text-sm">{profile.level}</span>
            </div>
          </div>

          {/* Name and title */}
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-[#E0E1DD] truncate">
              {profile.displayName}
            </h2>
            <p className="text-[#D4A017] font-medium">{levelTitle}</p>

            {/* Stats row */}
            <div className="flex flex-wrap gap-4 mt-3 text-sm">
              <div className="flex items-center gap-1 text-[#778DA9]">
                <span>🎮</span>
                <span>{profile.totalGames} игр</span>
              </div>
              <div className="flex items-center gap-1 text-[#778DA9]">
                <span>🏆</span>
                <span>{profile.totalWins} побед</span>
              </div>
              <div className="flex items-center gap-1 text-[#778DA9]">
                <span>📈</span>
                <span>{winRate}% побед</span>
              </div>
            </div>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[#778DA9]">Опыт</span>
            <span className="text-[#D4A017] font-medium">
              {xpCurrent} / {xpNeeded} XP
            </span>
          </div>
          <div className="h-3 bg-[#0D1B2A] rounded-full overflow-hidden border border-[#415A77]/30">
            <div
              className="h-full bg-gradient-to-r from-[#D4A017] via-[#FFD700] to-[#D4A017] transition-all duration-500 relative"
              style={{ width: `${xpProgress}%` }}
            >
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine" />
            </div>
          </div>
          <p className="text-xs text-[#778DA9] mt-1 text-center">
            {Math.round(xpProgress)}% до уровня {profile.level + 1}
          </p>
        </div>

        {/* Available points indicator */}
        {profile.availablePoints > 0 && (
          <div className="mt-4 bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-center">
            <p className="text-purple-400 font-medium">
              +{profile.availablePoints} очков для распределения
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
