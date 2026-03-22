/**
 * StatsEditor Component
 *
 * Allows players to allocate stat points when leveling up.
 */

import { useState, useMemo } from 'react';
import type { CharacterStats } from './StatsDisplay';

export type StatName = keyof CharacterStats;

export interface StatsEditorProps {
  currentStats: CharacterStats;
  availablePoints: number;
  maxStatValue?: number;
  onConfirm: (allocations: Partial<CharacterStats>) => void;
  onCancel?: () => void;
  className?: string;
}

const STAT_CONFIG = {
  strength: { icon: '⚔️', name: 'Сила', description: 'Защита от урона событий (5%/ур.)' },
  agility: { icon: '🏃', name: 'Ловкость', description: 'Скорость действий (+5%/ур. выше 5)' },
  negotiation: { icon: '🗣️', name: 'Переговоры', description: 'Бонус торговли (+2%/ур.)' },
  intellect: { icon: '🧠', name: 'Интеллект', description: 'Шанс открытий (10%/ур.)' },
  charisma: { icon: '💎', name: 'Харизма', description: 'Вес голоса (+0.1/ур. выше 5)' },
  craft: { icon: '🔧', name: 'Мастерство', description: 'Эффективность ресурсов (+5%/ур.)' },
  luck: { icon: '🍀', name: 'Удача', description: 'Шанс крит. успеха (3%/ур.)' },
  endurance: { icon: '🛡️', name: 'Выносливость', description: 'Сопротивление, +1 действие за 5 ур.' },
  leadership: { icon: '👑', name: 'Лидерство', description: 'Бонус команде (+1% за 3 ур.)' },
  perception: { icon: '👁️', name: 'Восприятие', description: 'Обнаружение скрытого (8%/ур.)' },
} as const;

export function StatsEditor({
  currentStats,
  availablePoints,
  maxStatValue = 15,
  onConfirm,
  onCancel,
  className = '',
}: StatsEditorProps) {
  const [allocations, setAllocations] = useState<Partial<CharacterStats>>({});

  const spentPoints = useMemo(() => {
    return Object.values(allocations).reduce((sum, val) => sum + (val || 0), 0);
  }, [allocations]);

  const remainingPoints = availablePoints - spentPoints;

  const getNewStatValue = (stat: StatName): number => {
    return currentStats[stat] + (allocations[stat] || 0);
  };

  const canIncrease = (stat: StatName): boolean => {
    return remainingPoints > 0 && getNewStatValue(stat) < maxStatValue;
  };

  const canDecrease = (stat: StatName): boolean => {
    return (allocations[stat] || 0) > 0;
  };

  const handleIncrease = (stat: StatName) => {
    if (!canIncrease(stat)) return;
    setAllocations((prev) => ({
      ...prev,
      [stat]: (prev[stat] || 0) + 1,
    }));
  };

  const handleDecrease = (stat: StatName) => {
    if (!canDecrease(stat)) return;
    setAllocations((prev) => ({
      ...prev,
      [stat]: (prev[stat] || 0) - 1,
    }));
  };

  const handleConfirm = () => {
    // Filter out zero allocations
    const nonZeroAllocations = Object.fromEntries(
      Object.entries(allocations).filter(([, value]) => value && value > 0)
    ) as Partial<CharacterStats>;

    if (Object.keys(nonZeroAllocations).length > 0) {
      onConfirm(nonZeroAllocations);
    }
  };

  const handleReset = () => {
    setAllocations({});
  };

  return (
    <div className={`bg-[#1B263B] rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-3xl mb-2">🎉</div>
        <h2 className="text-xl font-bold text-[#E0E1DD]">Распределите очки</h2>
        <p className="text-[#778DA9] mt-1">
          Осталось: <span className="text-[#D4A017] font-bold">{remainingPoints}</span> очков
        </p>
      </div>

      {/* Stats list */}
      <div className="space-y-4">
        {(Object.keys(STAT_CONFIG) as StatName[]).map((stat) => {
          const config = STAT_CONFIG[stat];
          const currentValue = currentStats[stat];
          const newValue = getNewStatValue(stat);
          const allocated = allocations[stat] || 0;

          return (
            <div
              key={stat}
              className="flex items-center gap-3 p-3 bg-[#0D1B2A] rounded-lg"
            >
              {/* Icon */}
              <span className="text-2xl w-10">{config.icon}</span>

              {/* Stat info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[#E0E1DD] font-medium">{config.name}</span>
                  {allocated > 0 && (
                    <span className="text-[#D4A017] text-sm">+{allocated}</span>
                  )}
                </div>
                <p className="text-[#778DA9] text-xs truncate">{config.description}</p>
              </div>

              {/* Value and controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDecrease(stat)}
                  disabled={!canDecrease(stat)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold transition-colors ${
                    canDecrease(stat)
                      ? 'bg-[#415A77] text-[#E0E1DD] hover:bg-[#778DA9]'
                      : 'bg-[#415A77]/30 text-[#778DA9]/50 cursor-not-allowed'
                  }`}
                >
                  -
                </button>

                <div className="w-12 text-center">
                  <span
                    className={`text-xl font-bold ${
                      allocated > 0 ? 'text-[#D4A017]' : 'text-[#E0E1DD]'
                    }`}
                  >
                    {newValue}
                  </span>
                  {allocated > 0 && (
                    <span className="text-[#778DA9] text-xs block">
                      было {currentValue}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleIncrease(stat)}
                  disabled={!canIncrease(stat)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold transition-colors ${
                    canIncrease(stat)
                      ? 'bg-[#D4A017] text-[#0D1B2A] hover:bg-[#FFD700]'
                      : 'bg-[#D4A017]/30 text-[#778DA9]/50 cursor-not-allowed'
                  }`}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-[#415A77] hover:bg-[#778DA9] text-[#E0E1DD] rounded-lg transition-colors"
          >
            Отмена
          </button>
        )}

        <button
          onClick={handleReset}
          disabled={spentPoints === 0}
          className={`flex-1 py-3 px-4 rounded-lg transition-colors ${
            spentPoints > 0
              ? 'bg-[#415A77] hover:bg-[#778DA9] text-[#E0E1DD]'
              : 'bg-[#415A77]/30 text-[#778DA9]/50 cursor-not-allowed'
          }`}
        >
          Сбросить
        </button>

        <button
          onClick={handleConfirm}
          disabled={spentPoints === 0}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
            spentPoints > 0
              ? 'bg-[#D4A017] hover:bg-[#FFD700] text-[#0D1B2A]'
              : 'bg-[#D4A017]/30 text-[#778DA9]/50 cursor-not-allowed'
          }`}
        >
          Подтвердить
        </button>
      </div>
    </div>
  );
}
