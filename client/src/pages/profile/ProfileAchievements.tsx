/**
 * ProfileAchievements Page
 *
 * Display all achievements, both unlocked and locked.
 */

import { useMemo, useState } from 'react';
import { useAuth } from '../../components/auth/AuthGuard';
import { AchievementBadge } from '../../components/profile';
import achievementsData from '../../data/achievements.json';

type Category = 'all' | 'games' | 'progression' | 'social' | 'zones';

const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: 'all', label: 'Все', icon: '🏅' },
  { id: 'games', label: 'Игровые', icon: '🎮' },
  { id: 'progression', label: 'Прогрессия', icon: '📊' },
  { id: 'social', label: 'Социальные', icon: '🤝' },
  { id: 'zones', label: 'Зоны', icon: '🏗️' },
];

export function ProfileAchievements() {
  const { playerProfile } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');

  const unlockedSet = useMemo(() => {
    return new Set(playerProfile?.achievements || []);
  }, [playerProfile?.achievements]);

  const filteredAchievements = useMemo(() => {
    return achievementsData.achievements.filter((achievement) => {
      if (selectedCategory === 'all') return true;
      return achievement.category === selectedCategory;
    });
  }, [selectedCategory]);

  const stats = useMemo(() => {
    const total = achievementsData.achievements.length;
    const unlocked = playerProfile?.achievements.length || 0;
    const percentage = total > 0 ? Math.round((unlocked / total) * 100) : 0;

    return { total, unlocked, percentage };
  }, [playerProfile?.achievements]);

  if (!playerProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D4A017]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with progress */}
      <div className="bg-[#1B263B] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#E0E1DD]">Достижения</h1>
            <p className="text-sm text-[#778DA9] mt-1">
              {stats.unlocked} из {stats.total} разблокировано
            </p>
          </div>
          <div className="text-3xl font-bold text-[#D4A017]">
            {stats.percentage}%
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 bg-[#0D1B2A] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#D4A017] to-[#FFD700] transition-all duration-500"
            style={{ width: `${stats.percentage}%` }}
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              selectedCategory === cat.id
                ? 'bg-[#D4A017] text-[#0D1B2A]'
                : 'bg-[#1B263B] text-[#778DA9] hover:text-[#E0E1DD]'
            }`}
          >
            <span>{cat.icon}</span>
            <span className="text-sm font-medium">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Achievements Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {filteredAchievements.map((achievement) => (
          <AchievementBadge
            key={achievement.id}
            achievementId={achievement.id}
            unlocked={unlockedSet.has(achievement.id)}
          />
        ))}
      </div>

      {/* Empty state */}
      {filteredAchievements.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🏅</div>
          <p className="text-[#778DA9]">Нет достижений в этой категории</p>
        </div>
      )}

      {/* Rarity Legend */}
      <div className="bg-[#1B263B]/50 rounded-xl p-4">
        <h3 className="text-sm font-medium text-[#778DA9] mb-3">Редкость достижений:</h3>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#9CA3AF]" />
            <span className="text-xs text-[#778DA9]">Обычное</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#3B82F6]" />
            <span className="text-xs text-[#778DA9]">Редкое</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#8B5CF6]" />
            <span className="text-xs text-[#778DA9]">Эпическое</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
            <span className="text-xs text-[#778DA9]">Легендарное</span>
          </div>
        </div>
      </div>
    </div>
  );
}
