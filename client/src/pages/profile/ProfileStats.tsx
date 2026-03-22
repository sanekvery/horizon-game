/**
 * ProfileStats Page
 *
 * Character stats view with point allocation.
 */

import { useState, useMemo } from 'react';
import { useAuth } from '../../components/auth/AuthGuard';
import { StatBar } from '../../components/profile';
import type { CharacterStats } from '../../services/player-auth-api';

type StatId = keyof CharacterStats;

const STAT_IDS: StatId[] = [
  'strength', 'agility', 'negotiation', 'intellect', 'charisma',
  'craft', 'luck', 'endurance', 'leadership', 'perception'
];

export function ProfileStats() {
  const { playerProfile, allocatePoints } = useAuth();
  const [allocations, setAllocations] = useState<Partial<Record<StatId, number>>>({});
  const [isAllocating, setIsAllocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spentPoints = useMemo(() => {
    return Object.values(allocations).reduce((sum, val) => sum + (val || 0), 0);
  }, [allocations]);

  const availablePoints = (playerProfile?.availablePoints || 0) - spentPoints;

  const getNewStatValue = (statId: StatId): number => {
    const current = playerProfile?.stats[statId] || 5;
    return current + (allocations[statId] || 0);
  };

  const canIncrease = (statId: StatId): boolean => {
    return availablePoints > 0 && getNewStatValue(statId) < 15;
  };

  const canDecrease = (statId: StatId): boolean => {
    return (allocations[statId] || 0) > 0;
  };

  const handleIncrease = (statId: StatId) => {
    if (!canIncrease(statId)) return;
    setAllocations((prev) => ({
      ...prev,
      [statId]: (prev[statId] || 0) + 1,
    }));
  };

  const handleDecrease = (statId: StatId) => {
    if (!canDecrease(statId)) return;
    setAllocations((prev) => ({
      ...prev,
      [statId]: (prev[statId] || 0) - 1,
    }));
  };

  const handleConfirm = async () => {
    setIsAllocating(true);
    setError(null);

    try {
      for (const [statId, points] of Object.entries(allocations)) {
        if (points && points > 0) {
          const success = await allocatePoints(statId as StatId, points);
          if (!success) {
            throw new Error(`Failed to allocate points to ${statId}`);
          }
        }
      }
      setAllocations({});
    } catch (err) {
      setError('Ошибка распределения очков');
    } finally {
      setIsAllocating(false);
    }
  };

  const handleReset = () => {
    setAllocations({});
  };

  if (!playerProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D4A017]" />
      </div>
    );
  }

  const hasPoints = playerProfile.availablePoints > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#1B263B] rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#E0E1DD]">Характеристики</h1>
            <p className="text-sm text-[#778DA9] mt-1">
              Уровень {playerProfile.level} • {playerProfile.totalXP} XP
            </p>
          </div>
          {hasPoints && (
            <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg px-4 py-2 text-center">
              <p className="text-2xl font-bold text-purple-400">{availablePoints}</p>
              <p className="text-xs text-purple-300">очков доступно</p>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-3">
        {STAT_IDS.map((statId) => {
          const newValue = getNewStatValue(statId);
          const allocated = allocations[statId] || 0;

          return (
            <div
              key={statId}
              className="bg-[#1B263B] rounded-xl p-4 flex items-center gap-4"
            >
              {/* Stat Info */}
              <div className="flex-1 min-w-0">
                <StatBar
                  statId={statId}
                  value={newValue}
                  showTooltip={true}
                />
              </div>

              {/* Controls (only if has points) */}
              {hasPoints && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDecrease(statId)}
                    disabled={!canDecrease(statId)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold transition-colors ${
                      canDecrease(statId)
                        ? 'bg-[#415A77] text-[#E0E1DD] hover:bg-[#778DA9]'
                        : 'bg-[#415A77]/30 text-[#778DA9]/50 cursor-not-allowed'
                    }`}
                  >
                    -
                  </button>

                  <div className="w-16 text-center">
                    <span
                      className={`text-xl font-bold ${
                        allocated > 0 ? 'text-[#D4A017]' : 'text-[#E0E1DD]'
                      }`}
                    >
                      {newValue}
                    </span>
                    {allocated > 0 && (
                      <span className="text-xs text-[#778DA9] block">
                        +{allocated}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleIncrease(statId)}
                    disabled={!canIncrease(statId)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold transition-colors ${
                      canIncrease(statId)
                        ? 'bg-[#D4A017] text-[#0D1B2A] hover:bg-[#FFD700]'
                        : 'bg-[#D4A017]/30 text-[#778DA9]/50 cursor-not-allowed'
                    }`}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      {hasPoints && spentPoints > 0 && (
        <div className="sticky bottom-20 md:bottom-4 flex gap-3">
          <button
            onClick={handleReset}
            disabled={isAllocating}
            className="flex-1 py-3 px-4 bg-[#415A77] hover:bg-[#778DA9] text-[#E0E1DD] rounded-lg transition-colors"
          >
            Сбросить
          </button>
          <button
            onClick={handleConfirm}
            disabled={isAllocating}
            className="flex-1 py-3 px-4 bg-[#D4A017] hover:bg-[#FFD700] text-[#0D1B2A] font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {isAllocating ? 'Сохранение...' : 'Подтвердить'}
          </button>
        </div>
      )}

      {/* Points Summary */}
      <div className="bg-[#1B263B]/50 rounded-xl p-4">
        <div className="flex justify-between text-sm text-[#778DA9]">
          <span>Очков к распределению:</span>
          <span className={`font-medium ${playerProfile.availablePoints > 0 ? 'text-purple-400' : 'text-[#778DA9]'}`}>
            {playerProfile.availablePoints}
          </span>
        </div>
      </div>
    </div>
  );
}
