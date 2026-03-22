/**
 * ProfileHistory Page
 *
 * Display game history for the player.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../components/auth/AuthGuard';
import { GameHistoryCard } from '../../components/profile';
import { getStoredToken } from '../../services/player-auth-api';

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

export function ProfileHistory() {
  const { playerProfile } = useAuth();
  const [history, setHistory] = useState<GameHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const token = getStoredToken();
        if (!token) {
          setHistory([]);
          setIsLoading(false);
          return;
        }

        const response = await fetch('/api/player/auth/history', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch history');
        }

        const data = await response.json();
        if (data.success && data.history) {
          setHistory(data.history);
        } else {
          setHistory([]);
        }
      } catch (err) {
        console.error('Error fetching history:', err);
        setError('Не удалось загрузить историю игр');
        setHistory([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, []);

  if (!playerProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D4A017]" />
      </div>
    );
  }

  const winRate = playerProfile.totalGames > 0
    ? Math.round((playerProfile.totalWins / playerProfile.totalGames) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="bg-[#1B263B] rounded-xl p-5">
        <h1 className="text-xl font-bold text-[#E0E1DD] mb-4">История игр</h1>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-[#D4A017]">{playerProfile.totalGames}</p>
            <p className="text-sm text-[#778DA9]">Всего игр</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">{playerProfile.totalWins}</p>
            <p className="text-sm text-[#778DA9]">Побед</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[#E0E1DD]">{winRate}%</p>
            <p className="text-sm text-[#778DA9]">Винрейт</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#D4A017]" />
        </div>
      )}

      {/* History List */}
      {!isLoading && history.length > 0 && (
        <div className="space-y-3">
          {history.map((game) => (
            <GameHistoryCard key={game.id} game={game} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && history.length === 0 && !error && (
        <div className="text-center py-12 bg-[#1B263B] rounded-xl">
          <div className="text-4xl mb-4">📜</div>
          <h3 className="text-lg font-medium text-[#E0E1DD] mb-2">
            История пуста
          </h3>
          <p className="text-[#778DA9] text-sm">
            Присоединитесь к игре, чтобы начать записывать историю
          </p>
        </div>
      )}

      {/* Note about history */}
      {playerProfile.totalGames > 0 && history.length === 0 && !isLoading && !error && (
        <div className="bg-[#1B263B]/50 rounded-xl p-4 text-center">
          <p className="text-sm text-[#778DA9]">
            История игр сохраняется только для авторизованных игроков.
            <br />
            Некоторые прошлые игры могли быть сыграны в гостевом режиме.
          </p>
        </div>
      )}
    </div>
  );
}
