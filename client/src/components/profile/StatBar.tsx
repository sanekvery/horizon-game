/**
 * StatBar Component
 *
 * Visual progress bar for a single character stat with tooltip.
 */

import { useState } from 'react';
import statsConfig from '../../data/stats-config.json';

type StatId = 'strength' | 'agility' | 'negotiation' | 'intellect' | 'charisma' | 'craft' | 'luck' | 'endurance' | 'leadership' | 'perception';

interface StatBarProps {
  statId: StatId;
  value: number;
  maxValue?: number;
  showTooltip?: boolean;
  compact?: boolean;
  className?: string;
}

const STAT_COLORS: Record<StatId, string> = {
  strength: 'bg-red-500',
  agility: 'bg-green-500',
  negotiation: 'bg-amber-500',
  intellect: 'bg-purple-500',
  charisma: 'bg-pink-500',
  craft: 'bg-teal-500',
  luck: 'bg-emerald-500',
  endurance: 'bg-indigo-500',
  leadership: 'bg-orange-500',
  perception: 'bg-sky-500',
};

export function StatBar({
  statId,
  value,
  maxValue = 15,
  showTooltip = true,
  compact = false,
  className = '',
}: StatBarProps) {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  const statData = statsConfig.stats.find((s) => s.id === statId);
  const color = STAT_COLORS[statId] || 'bg-gray-500';
  const percentage = Math.min(100, (value / maxValue) * 100);

  if (!statData) {
    return null;
  }

  const currentEffect = [...statData.examples]
    .reverse()
    .find((ex) => ex.value <= value);

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 ${className}`}
        title={statData.description}
      >
        <span className="text-lg">{statData.icon}</span>
        <span className="text-[#E0E1DD] font-medium">{value}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <span className="text-xl w-8 text-center">{statData.icon}</span>

        {/* Name and bar */}
        <div className="flex-1">
          <div className="flex justify-between mb-1">
            <span className="text-sm text-[#E0E1DD]">{statData.name}</span>
            <span className="text-sm text-[#D4A017] font-medium">{value}</span>
          </div>
          <div className="h-2 bg-[#0D1B2A] rounded-full overflow-hidden">
            <div
              className={`h-full ${color} transition-all duration-300`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {showTooltip && isTooltipVisible && (
        <div className="absolute left-full top-0 ml-3 z-50 w-64">
          <div className="bg-[#0D1B2A] border border-[#415A77] rounded-lg p-4 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{statData.icon}</span>
              <span className="font-bold text-[#D4A017]">{statData.name}</span>
            </div>
            <p className="text-sm text-[#778DA9] mb-3">{statData.description}</p>

            {/* Current effect */}
            {currentEffect && (
              <div className="bg-[#1B263B] rounded p-2 mb-2">
                <p className="text-xs text-[#778DA9]">Текущий эффект:</p>
                <p className="text-sm text-[#E0E1DD]">{currentEffect.effect}</p>
              </div>
            )}

            {/* Formula */}
            <p className="text-xs text-[#415A77] font-mono">{statData.formula}</p>
          </div>
        </div>
      )}
    </div>
  );
}
