/**
 * StatsDisplay Component
 *
 * Displays character stats as a visual card with progress bars.
 */

import { useMemo } from 'react';

export interface CharacterStats {
  strength: number;
  agility: number;
  negotiation: number;
  intellect: number;
  charisma: number;
  craft: number;
  luck: number;
  endurance: number;
  leadership: number;
  perception: number;
}

export interface StatsDisplayProps {
  stats: CharacterStats;
  level?: number;
  experience?: number;
  maxStatValue?: number;
  compact?: boolean;
  showLabels?: boolean;
  className?: string;
}

const STAT_CONFIG = {
  strength: { icon: '⚔️', name: 'Сила', color: 'bg-red-500' },
  agility: { icon: '🏃', name: 'Ловкость', color: 'bg-green-500' },
  negotiation: { icon: '🗣️', name: 'Переговоры', color: 'bg-amber-500' },
  intellect: { icon: '🧠', name: 'Интеллект', color: 'bg-purple-500' },
  charisma: { icon: '💎', name: 'Харизма', color: 'bg-pink-500' },
  craft: { icon: '🔧', name: 'Мастерство', color: 'bg-teal-500' },
  luck: { icon: '🍀', name: 'Удача', color: 'bg-emerald-500' },
  endurance: { icon: '🛡️', name: 'Выносливость', color: 'bg-indigo-500' },
  leadership: { icon: '👑', name: 'Лидерство', color: 'bg-orange-500' },
  perception: { icon: '👁️', name: 'Восприятие', color: 'bg-sky-500' },
} as const;

type StatName = keyof typeof STAT_CONFIG;

export function StatsDisplay({
  stats,
  level,
  experience,
  maxStatValue = 15,
  compact = false,
  showLabels = true,
  className = '',
}: StatsDisplayProps) {
  const statEntries = useMemo(() => {
    return (Object.keys(STAT_CONFIG) as StatName[]).map((key) => ({
      key,
      value: stats[key],
      ...STAT_CONFIG[key],
    }));
  }, [stats]);

  if (compact) {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {statEntries.map(({ key, value, icon }) => (
          <div
            key={key}
            className="flex items-center gap-1 px-2 py-1 bg-[#1B263B] rounded-lg text-sm"
            title={STAT_CONFIG[key].name}
          >
            <span>{icon}</span>
            <span className="text-[#E0E1DD] font-medium">{value}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`bg-[#1B263B] rounded-xl p-4 ${className}`}>
      {/* Header with level */}
      {level !== undefined && (
        <div className="flex items-center justify-between mb-4">
          <span className="text-[#778DA9]">Уровень</span>
          <span className="text-2xl font-bold text-[#D4A017]">{level}</span>
        </div>
      )}

      {/* Experience bar */}
      {experience !== undefined && level !== undefined && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-[#778DA9] mb-1">
            <span>Опыт</span>
            <span>{experience} XP</span>
          </div>
          <div className="h-2 bg-[#0D1B2A] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#D4A017] to-[#FFD700] transition-all duration-500"
              style={{
                width: `${Math.min(100, (experience / (100 * (level + 1))) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="space-y-3">
        {statEntries.map(({ key, value, icon, name, color }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xl w-8">{icon}</span>
            {showLabels && (
              <span className="text-[#778DA9] text-sm w-24 truncate">{name}</span>
            )}
            <div className="flex-1 h-2 bg-[#0D1B2A] rounded-full overflow-hidden">
              <div
                className={`h-full ${color} transition-all duration-300`}
                style={{ width: `${(value / maxStatValue) * 100}%` }}
              />
            </div>
            <span className="text-[#E0E1DD] font-medium w-6 text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
