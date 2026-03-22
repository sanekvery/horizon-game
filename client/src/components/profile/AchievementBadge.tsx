/**
 * AchievementBadge Component
 *
 * Displays an achievement with rarity-based styling.
 */

import achievementsData from '../../data/achievements.json';

type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

interface AchievementBadgeProps {
  achievementId: string;
  unlocked?: boolean;
  unlockedAt?: string;
  compact?: boolean;
  className?: string;
}

const RARITY_STYLES: Record<Rarity, {
  bg: string;
  border: string;
  text: string;
  glow?: string;
}> = {
  common: {
    bg: 'bg-[#374151]',
    border: 'border-[#4B5563]',
    text: 'text-[#9CA3AF]',
  },
  rare: {
    bg: 'bg-[#1E3A5F]',
    border: 'border-[#2563EB]',
    text: 'text-[#3B82F6]',
    glow: 'shadow-[0_0_10px_rgba(59,130,246,0.3)]',
  },
  epic: {
    bg: 'bg-[#3B2667]',
    border: 'border-[#7C3AED]',
    text: 'text-[#8B5CF6]',
    glow: 'shadow-[0_0_15px_rgba(139,92,246,0.4)]',
  },
  legendary: {
    bg: 'bg-[#451A03]',
    border: 'border-[#D97706]',
    text: 'text-[#F59E0B]',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.5)]',
  },
};

export function AchievementBadge({
  achievementId,
  unlocked = false,
  unlockedAt,
  compact = false,
  className = '',
}: AchievementBadgeProps) {
  const achievement = achievementsData.achievements.find(
    (a) => a.id === achievementId
  );

  if (!achievement) {
    return null;
  }

  const rarity = achievement.rarity as Rarity;
  const styles = RARITY_STYLES[rarity];
  const rarityConfig = achievementsData.rarityConfig[rarity];

  const isAnimated = rarity === 'epic' || rarity === 'legendary';
  const hasParticles = rarity === 'legendary';

  if (compact) {
    return (
      <div
        className={`
          relative flex items-center gap-2 px-3 py-2 rounded-lg
          ${unlocked ? styles.bg : 'bg-[#1B263B]/50'}
          ${unlocked ? `border ${styles.border}` : 'border border-[#415A77]/30'}
          ${unlocked && styles.glow ? styles.glow : ''}
          ${!unlocked ? 'opacity-50 grayscale' : ''}
          transition-all duration-300
          ${className}
        `}
        title={achievement.description}
      >
        <span className={`text-xl ${isAnimated && unlocked ? 'animate-pulse' : ''}`}>
          {achievement.icon}
        </span>
        <span className={`text-sm font-medium ${unlocked ? styles.text : 'text-[#778DA9]'}`}>
          {achievement.name}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl
        ${unlocked ? styles.bg : 'bg-[#1B263B]/50'}
        ${unlocked ? `border-2 ${styles.border}` : 'border border-[#415A77]/30'}
        ${unlocked && styles.glow ? styles.glow : ''}
        ${!unlocked ? 'opacity-60' : ''}
        transition-all duration-300
        ${className}
      `}
    >
      {/* Animated background for legendary */}
      {hasParticles && unlocked && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-2 h-2 bg-[#F59E0B] rounded-full animate-float-1 opacity-50" style={{ left: '20%', top: '30%' }} />
          <div className="absolute w-1.5 h-1.5 bg-[#FFD700] rounded-full animate-float-2 opacity-50" style={{ left: '70%', top: '20%' }} />
          <div className="absolute w-2 h-2 bg-[#D97706] rounded-full animate-float-3 opacity-50" style={{ left: '40%', top: '60%' }} />
        </div>
      )}

      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center text-2xl
            ${unlocked ? 'bg-[#0D1B2A]' : 'bg-[#0D1B2A]/50'}
            ${isAnimated && unlocked ? 'animate-pulse' : ''}
          `}>
            {achievement.icon}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className={`font-bold truncate ${unlocked ? styles.text : 'text-[#778DA9]'}`}>
              {achievement.name}
            </h3>
            <p className="text-sm text-[#778DA9] line-clamp-2">
              {achievement.description}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#415A77]/30">
          <span className={`text-xs font-medium ${styles.text}`}>
            {rarityConfig.name}
          </span>
          {unlocked && unlockedAt && (
            <span className="text-xs text-[#778DA9]">
              {new Date(unlockedAt).toLocaleDateString('ru-RU')}
            </span>
          )}
          {!unlocked && (
            <span className="text-xs text-[#778DA9]">Не получено</span>
          )}
        </div>
      </div>
    </div>
  );
}
