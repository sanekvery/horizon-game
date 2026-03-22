/**
 * GameHistoryCard Component
 *
 * Displays a single game history entry.
 */

interface GameHistoryEntry {
  id: string;
  sessionId: string;
  roleId: number;
  roleName: string;
  xpEarned: number;
  teamWon: boolean;
  playedAt: string;
  duration?: number;
  achievementsUnlocked?: string[];
}

interface GameHistoryCardProps {
  game: GameHistoryEntry;
  className?: string;
}

export function GameHistoryCard({ game, className = '' }: GameHistoryCardProps) {
  const playedDate = new Date(game.playedAt);
  const formattedDate = playedDate.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = playedDate.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`
        bg-[#1B263B] border border-[#415A77]/30 rounded-xl p-4
        hover:border-[#D4A017]/30 transition-all
        ${className}
      `}
    >
      {/* Header with result */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Result indicator */}
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center text-xl
            ${game.teamWon ? 'bg-green-500/20' : 'bg-red-500/20'}
          `}>
            {game.teamWon ? '🏆' : '💔'}
          </div>

          {/* Role info */}
          <div>
            <h3 className="font-medium text-[#E0E1DD]">{game.roleName}</h3>
            <p className="text-sm text-[#778DA9]">
              {game.teamWon ? 'Победа' : 'Поражение'}
            </p>
          </div>
        </div>

        {/* XP earned */}
        <div className="text-right">
          <p className="text-[#D4A017] font-bold">+{game.xpEarned} XP</p>
          {game.duration && (
            <p className="text-xs text-[#778DA9]">{game.duration} мин</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-[#415A77]/30">
        <span className="text-sm text-[#778DA9]">
          {formattedDate}, {formattedTime}
        </span>

        {game.achievementsUnlocked && game.achievementsUnlocked.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-[#778DA9]">
              +{game.achievementsUnlocked.length}
            </span>
            <span>🏅</span>
          </div>
        )}
      </div>
    </div>
  );
}
