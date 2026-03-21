/**
 * ExperienceBar Component
 *
 * Displays experience progress with level and XP info.
 * Supports animation for XP gains.
 */

import { useState, useEffect, useRef } from 'react';

export interface ExperienceBarProps {
  totalXP: number;
  level: number;
  className?: string;
  showDetails?: boolean;
  onLevelUp?: (newLevel: number) => void;
}

/**
 * Calculate XP required for a level.
 * Formula: 100 * level * (level + 1) / 2
 */
function xpRequiredForLevel(level: number): number {
  if (level <= 0) return 0;
  return (100 * level * (level + 1)) / 2;
}

export function ExperienceBar({
  totalXP,
  level,
  className = '',
  showDetails = true,
  onLevelUp,
}: ExperienceBarProps) {
  const [displayXP, setDisplayXP] = useState(totalXP);
  const [isAnimating, setIsAnimating] = useState(false);
  const [xpGainText, setXpGainText] = useState<string | null>(null);
  const prevXPRef = useRef(totalXP);
  const prevLevelRef = useRef(level);

  useEffect(() => {
    if (totalXP > prevXPRef.current) {
      const diff = totalXP - prevXPRef.current;
      setXpGainText(`+${diff} XP`);
      setIsAnimating(true);

      // Animate XP count up
      const startXP = prevXPRef.current;
      const duration = 1000;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

        setDisplayXP(Math.floor(startXP + diff * eased));

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
          setTimeout(() => setXpGainText(null), 500);
        }
      };

      requestAnimationFrame(animate);
    }

    if (level > prevLevelRef.current && onLevelUp) {
      onLevelUp(level);
    }

    prevXPRef.current = totalXP;
    prevLevelRef.current = level;
  }, [totalXP, level, onLevelUp]);

  const currentLevelXP = xpRequiredForLevel(level);
  const nextLevelXP = xpRequiredForLevel(level + 1);
  const xpInCurrentLevel = displayXP - currentLevelXP;
  const xpNeededForNextLevel = nextLevelXP - currentLevelXP;
  const progressPercent = (xpInCurrentLevel / xpNeededForNextLevel) * 100;

  return (
    <div className={`${className}`}>
      {/* Level badge and XP text */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#D4A017] text-[#0D1B2A] font-bold text-sm">
            {level}
          </div>
          <span className="text-[#778DA9] text-sm">Уровень</span>
        </div>

        {showDetails && (
          <div className="text-right">
            <span className="text-[#E0E1DD] font-medium">{displayXP}</span>
            <span className="text-[#778DA9]"> / {nextLevelXP} XP</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-3 bg-[#0D1B2A] rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r from-[#D4A017] to-[#FFD700] transition-all ${
            isAnimating ? 'duration-1000' : 'duration-300'
          }`}
          style={{ width: `${Math.min(100, progressPercent)}%` }}
        />

        {/* Glow effect when animating */}
        {isAnimating && (
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        )}
      </div>

      {/* XP gain popup */}
      {xpGainText && (
        <div className="flex justify-center mt-2">
          <span className="text-[#D4A017] font-bold animate-bounce">{xpGainText}</span>
        </div>
      )}

      {/* XP until next level */}
      {showDetails && (
        <div className="text-center mt-1">
          <span className="text-[#778DA9] text-xs">
            {nextLevelXP - displayXP} XP до уровня {level + 1}
          </span>
        </div>
      )}
    </div>
  );
}
