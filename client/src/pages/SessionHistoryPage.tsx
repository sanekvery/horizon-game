import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  sessionApi,
  type ActionLogEntry,
  type SessionStats,
  type ActorType,
  type GameSession,
} from '../services/session-api';

const ACTION_LABELS: Record<string, { label: string; icon: string }> = {
  // Player actions
  PLAYER_JOIN: { label: 'Игрок присоединился', icon: '🟢' },
  PLAYER_DISCONNECT: { label: 'Игрок отключился', icon: '🔴' },
  ROLE_CLAIM: { label: 'Роль выбрана', icon: '👤' },
  VOTE_CAST: { label: 'Голос отдан', icon: '🗳️' },
  PROMISE_SET: { label: 'Обещание дано', icon: '🤝' },
  RESOURCE_CONTRIBUTE: { label: 'Ресурсы внесены', icon: '📦' },
  // Admin actions
  ACT_CHANGE: { label: 'Смена акта', icon: '🎭' },
  SCENE_CHANGE: { label: 'Смена сцены', icon: '🎬' },
  TIMER_START: { label: 'Таймер запущен', icon: '⏱️' },
  TIMER_STOP: { label: 'Таймер остановлен', icon: '⏹️' },
  GAME_START: { label: 'Игра начата', icon: '🚀' },
  GAME_FINISH: { label: 'Игра завершена', icon: '🏁' },
  GAME_RESET: { label: 'Игра сброшена', icon: '🔄' },
  EVENT_TRIGGER: { label: 'Событие активировано', icon: '⚡' },
  EVENT_DISMISS: { label: 'Событие закрыто', icon: '✖️' },
  RESOURCE_GIVE: { label: 'Ресурсы выданы', icon: '🎁' },
  ZONE_UPDATE: { label: 'Зона обновлена', icon: '🏙️' },
  VOTE_CREATE: { label: 'Голосование создано', icon: '📝' },
  VOTE_START: { label: 'Голосование начато', icon: '▶️' },
  VOTE_CLOSE: { label: 'Голосование закрыто', icon: '🔒' },
  // System actions
  SESSION_INIT: { label: 'Сессия инициализирована', icon: '🔧' },
  TIMER_END: { label: 'Таймер истёк', icon: '⏰' },
};

const ACTOR_TYPE_LABELS: Record<ActorType, { label: string; color: string; bg: string }> = {
  PLAYER: { label: 'Игрок', color: 'text-blue-400', bg: 'bg-blue-400/20' },
  FACILITATOR: { label: 'Фасилитатор', color: 'text-amber-400', bg: 'bg-amber-400/20' },
  SYSTEM: { label: 'Система', color: 'text-gray-400', bg: 'bg-gray-400/20' },
};

export function SessionHistoryPage() {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<GameSession | null>(null);
  const [history, setHistory] = useState<ActionLogEntry[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actorFilter, setActorFilter] = useState<ActorType | 'ALL'>('ALL');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    const loadData = async () => {
      if (!sessionCode) return;

      setLoading(true);
      setError(null);

      // Load session info
      const sessionRes = await sessionApi.getByCode(sessionCode);
      if (!sessionRes.success || !sessionRes.session) {
        setError(sessionRes.error || 'Сессия не найдена');
        setLoading(false);
        return;
      }
      setSession(sessionRes.session);

      // Load stats
      const statsRes = await sessionApi.getStats(sessionCode);
      if (statsRes.success && statsRes.stats) {
        setStats(statsRes.stats);
      }

      // Load history
      await loadHistory(0);

      setLoading(false);
    };

    loadData();
  }, [sessionCode]);

  const loadHistory = async (pageNum: number, filter?: ActorType | 'ALL') => {
    if (!sessionCode) return;

    const currentFilter = filter ?? actorFilter;

    const historyRes = await sessionApi.getHistory(sessionCode, {
      limit: ITEMS_PER_PAGE,
      offset: pageNum * ITEMS_PER_PAGE,
      actorType: currentFilter === 'ALL' ? undefined : currentFilter,
    });

    if (historyRes.success && historyRes.history) {
      if (pageNum === 0) {
        setHistory(historyRes.history);
      } else {
        setHistory((prev) => [...prev, ...historyRes.history!]);
      }
      setHasMore(historyRes.history.length === ITEMS_PER_PAGE);
      setPage(pageNum);
    }
  };

  const handleFilterChange = (newFilter: ActorType | 'ALL') => {
    setActorFilter(newFilter);
    loadHistory(0, newFilter);
  };

  const loadMore = () => {
    loadHistory(page + 1);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}ч ${minutes}м`;
    }
    return `${minutes}м`;
  };

  const getActionLabel = (actionType: string) => {
    return ACTION_LABELS[actionType] || { label: actionType, icon: '❓' };
  };

  const renderActionData = (entry: ActionLogEntry) => {
    const data = entry.actionData;
    if (!data || Object.keys(data).length === 0) return null;

    const parts: string[] = [];

    if (data.roleName) parts.push(`Роль: ${data.roleName}`);
    if (data.playerName) parts.push(`Имя: ${data.playerName}`);
    if (data.zone) parts.push(`Зона: ${data.zone}`);
    if (data.resource) parts.push(`Ресурс: ${data.resource}`);
    if (data.amount !== undefined) parts.push(`Кол-во: ${data.amount}`);
    if (data.seconds !== undefined) parts.push(`Время: ${data.seconds}с`);
    if (data.previousAct !== undefined && data.newAct !== undefined) {
      parts.push(`${data.previousAct} → ${data.newAct}`);
    }
    if (data.eventId !== undefined) parts.push(`Событие #${data.eventId}`);
    if (data.voteId) parts.push(`Голосование: ${data.voteId}`);
    if (data.optionId) parts.push(`Вариант: ${data.optionId}`);

    return parts.length > 0 ? parts.join(' • ') : null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <div className="text-[#778DA9] text-xl animate-pulse">Загрузка истории...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <button
            onClick={() => navigate('/facilitator')}
            className="px-4 py-2 bg-[#415A77] hover:bg-[#778DA9] text-white rounded-lg"
          >
            Вернуться в кабинет
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A]">
      {/* Header */}
      <header className="bg-[#1B263B] border-b border-[#415A77]/30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/facilitator')}
              className="text-[#778DA9] hover:text-[#E0E1DD] transition-colors"
            >
              ← Назад
            </button>
            <div>
              <h1 className="text-xl font-bold text-[#E0E1DD]">
                История игры: {session?.name || sessionCode}
              </h1>
              <p className="text-[#778DA9] text-sm">Код: {sessionCode}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#1B263B] rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-[#E0E1DD]">{stats.totalActions}</div>
              <div className="text-[#778DA9] text-sm">Всего действий</div>
            </div>
            <div className="bg-[#1B263B] rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-blue-400">{stats.playerActions}</div>
              <div className="text-[#778DA9] text-sm">Действий игроков</div>
            </div>
            <div className="bg-[#1B263B] rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-amber-400">{stats.adminActions}</div>
              <div className="text-[#778DA9] text-sm">Действий фасилитатора</div>
            </div>
            <div className="bg-[#1B263B] rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-emerald-400">{formatDuration(stats.duration)}</div>
              <div className="text-[#778DA9] text-sm">Длительность</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-[#1B263B] rounded-xl p-4 mb-6 flex items-center gap-4 flex-wrap">
          <span className="text-[#778DA9]">Фильтр:</span>
          <div className="flex gap-2">
            <button
              onClick={() => handleFilterChange('ALL')}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                actorFilter === 'ALL'
                  ? 'bg-[#D4A017] text-[#0D1B2A]'
                  : 'bg-[#415A77] text-white hover:bg-[#778DA9]'
              }`}
            >
              Все
            </button>
            {(['PLAYER', 'FACILITATOR', 'SYSTEM'] as ActorType[]).map((type) => (
              <button
                key={type}
                onClick={() => handleFilterChange(type)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  actorFilter === type
                    ? `${ACTOR_TYPE_LABELS[type].bg} ${ACTOR_TYPE_LABELS[type].color}`
                    : 'bg-[#415A77] text-white hover:bg-[#778DA9]'
                }`}
              >
                {ACTOR_TYPE_LABELS[type].label}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-[#1B263B] rounded-xl border border-[#415A77]/30">
          {history.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">📋</div>
              <div className="text-[#E0E1DD] text-lg font-medium mb-2">
                История пока пуста
              </div>
              <div className="text-[#778DA9] max-w-md mx-auto">
                {session?.status === 'SETUP' || session?.status === 'ACTIVE' ? (
                  <>
                    Как только начнётся игра и участники начнут выполнять действия,
                    здесь появится полная хронология событий.
                  </>
                ) : (
                  <>
                    В этой сессии не было зафиксировано действий.
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#415A77]/20">
              {history.map((entry, index) => {
                const action = getActionLabel(entry.actionType);
                const actorStyle = ACTOR_TYPE_LABELS[entry.actorType];
                const actionData = renderActionData(entry);
                const prevEntry = history[index - 1];
                const showDate =
                  index === 0 ||
                  formatDate(entry.createdAt) !== formatDate(prevEntry.createdAt);

                return (
                  <div key={entry.id}>
                    {showDate && (
                      <div className="px-4 py-2 bg-[#0D1B2A] text-[#778DA9] text-sm font-medium">
                        {formatDate(entry.createdAt)}
                      </div>
                    )}
                    <div className="p-4 hover:bg-[#0D1B2A]/50 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="text-2xl">{action.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-[#E0E1DD]">{action.label}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${actorStyle.bg} ${actorStyle.color}`}>
                              {actorStyle.label}
                            </span>
                            {entry.playerName && (
                              <span className="text-[#778DA9] text-sm">
                                — {entry.playerName}
                              </span>
                            )}
                          </div>
                          {actionData && (
                            <div className="text-[#778DA9] text-sm mt-1">{actionData}</div>
                          )}
                          {entry.gameContext.act && (
                            <div className="text-[#778DA9]/60 text-xs mt-1">
                              Акт {entry.gameContext.act}, Сцена {entry.gameContext.scene || 1}
                            </div>
                          )}
                        </div>
                        <div className="text-[#778DA9] text-sm whitespace-nowrap">
                          {formatTime(entry.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Load More */}
          {hasMore && history.length > 0 && (
            <div className="p-4 text-center border-t border-[#415A77]/20">
              <button
                onClick={loadMore}
                className="px-6 py-2 bg-[#415A77] hover:bg-[#778DA9] text-white rounded-lg transition-colors"
              >
                Загрузить ещё
              </button>
            </div>
          )}
        </div>

        {/* Top Actions */}
        {stats && stats.topActions.length > 0 && (
          <div className="mt-8 bg-[#1B263B] rounded-xl p-6 border border-[#415A77]/30">
            <h2 className="text-[#E0E1DD] font-semibold mb-4">Топ действий</h2>
            <div className="space-y-2">
              {stats.topActions.map((action) => {
                const actionInfo = getActionLabel(action.actionType);
                const percentage = Math.round((action.count / stats.totalActions) * 100);
                return (
                  <div key={action.actionType} className="flex items-center gap-3">
                    <span className="text-xl">{actionInfo.icon}</span>
                    <span className="text-[#E0E1DD] flex-1">{actionInfo.label}</span>
                    <div className="w-32 h-2 bg-[#0D1B2A] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#D4A017] rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-[#778DA9] text-sm w-12 text-right">{action.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
