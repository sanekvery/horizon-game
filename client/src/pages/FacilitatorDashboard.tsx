import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, Facilitator } from '../services/auth-api';
import { sessionApi, GameSession } from '../services/session-api';

const SUBSCRIPTION_LABELS = {
  FREE: { label: 'Бесплатный', color: 'text-[#778DA9]', badge: 'bg-[#415A77]' },
  PRO: { label: 'Pro', color: 'text-emerald-400', badge: 'bg-emerald-600' },
  ENTERPRISE: { label: 'Enterprise', color: 'text-amber-400', badge: 'bg-amber-600' },
};

const STATUS_LABELS = {
  SETUP: { label: 'Подготовка', color: 'text-yellow-400', bg: 'bg-yellow-400/20' },
  ACTIVE: { label: 'Активна', color: 'text-emerald-400', bg: 'bg-emerald-400/20' },
  PAUSED: { label: 'Пауза', color: 'text-orange-400', bg: 'bg-orange-400/20' },
  FINISHED: { label: 'Завершена', color: 'text-[#778DA9]', bg: 'bg-[#778DA9]/20' },
};

export function FacilitatorDashboard() {
  const navigate = useNavigate();
  const [facilitator, setFacilitator] = useState<Facilitator | null>(null);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Create game modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [gameName, setGameName] = useState('');
  const [playerCount, setPlayerCount] = useState(8);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    const result = await sessionApi.getAll();
    if (result.success && result.sessions) {
      setSessions(result.sessions);
    }
    setSessionsLoading(false);
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      if (!authApi.isAuthenticated()) {
        navigate('/auth');
        return;
      }

      const result = await authApi.getMe();
      if (result.success && result.facilitator) {
        setFacilitator(result.facilitator);
        await loadSessions();
      } else {
        authApi.logout();
        navigate('/auth');
      }
      setLoading(false);
    };

    loadUser();
  }, [navigate, loadSessions]);

  const handleLogout = () => {
    authApi.logout();
    navigate('/auth');
  };

  const handleCreateGame = async () => {
    if (playerCount < 4 || playerCount > 20) {
      setCreateError('Количество игроков должно быть от 4 до 20');
      return;
    }

    setCreating(true);
    setCreateError('');

    const result = await sessionApi.create({
      name: gameName.trim() || undefined,
      playerCount,
    });

    if (result.success && result.session) {
      setShowCreateModal(false);
      setGameName('');
      setPlayerCount(8);
      await loadSessions();
      // Navigate to admin for this session
      navigate(`/admin?session=${result.session.code}`);
    } else {
      setCreateError(result.error || 'Ошибка создания игры');
    }

    setCreating(false);
  };

  const handleManageSession = (session: GameSession) => {
    navigate(`/admin?session=${session.code}`);
  };

  const handleDeleteSession = async (session: GameSession) => {
    if (!confirm(`Удалить игру "${session.name || session.code}"?`)) {
      return;
    }

    const result = await sessionApi.delete(session.id);
    if (result.success) {
      await loadSessions();
    } else {
      alert(result.error || 'Ошибка удаления');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <div className="text-[#778DA9] text-xl animate-pulse">Загрузка...</div>
      </div>
    );
  }

  if (!facilitator) {
    return null;
  }

  const subscription = SUBSCRIPTION_LABELS[facilitator.subscriptionType];
  const canCreateLargeGames = facilitator.subscriptionType !== 'FREE';
  const maxPlayers = canCreateLargeGames ? 20 : 4;

  // Separate sessions by status
  const activeSessions = sessions.filter((s) => s.status === 'ACTIVE' || s.status === 'PAUSED');
  const setupSessions = sessions.filter((s) => s.status === 'SETUP');
  const finishedSessions = sessions.filter((s) => s.status === 'FINISHED');

  return (
    <div className="min-h-screen bg-[#0D1B2A]">
      {/* Header */}
      <header className="bg-[#1B263B] border-b border-[#415A77]/30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#E0E1DD]">Проект Горизонт</h1>
            <p className="text-[#778DA9] text-sm">Личный кабинет</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[#E0E1DD]">{facilitator.name || facilitator.email}</div>
              <div className={`text-xs ${subscription.color}`}>{subscription.label}</div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-[#415A77] hover:bg-[#778DA9] text-white rounded-lg transition-colors text-sm"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Subscription Banner */}
        {facilitator.subscriptionType === 'FREE' && (
          <div className="bg-gradient-to-r from-amber-900/30 to-amber-800/20 border border-amber-500/30 rounded-xl p-5 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-amber-300 font-semibold mb-1">Бесплатный тариф</h3>
                <p className="text-amber-100/70 text-sm">
                  Доступны игры до 4 человек. Для игр на 5-20 человек нужна подписка Pro.
                </p>
              </div>
              <button className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors">
                Перейти на Pro
              </button>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#1B263B] rounded-xl p-6 border border-[#415A77]/30 hover:border-[#D4A017]/50 transition-colors text-left group"
          >
            <div className="text-4xl mb-4">🎮</div>
            <h3 className="text-[#E0E1DD] font-semibold mb-2 group-hover:text-[#D4A017] transition-colors">
              Создать игру
            </h3>
            <p className="text-[#778DA9] text-sm">
              {canCreateLargeGames
                ? 'Запустить новую игру для 4-20 игроков'
                : 'Запустить новую игру для 4 игроков'}
            </p>
          </button>

          <div className="bg-[#1B263B] rounded-xl p-6 border border-[#415A77]/30 opacity-50">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-[#E0E1DD] font-semibold mb-2">Аналитика</h3>
            <p className="text-[#778DA9] text-sm">Скоро: статистика и отчёты</p>
          </div>

          <div className="bg-[#1B263B] rounded-xl p-6 border border-[#415A77]/30 opacity-50">
            <div className="text-4xl mb-4">⚙️</div>
            <h3 className="text-[#E0E1DD] font-semibold mb-2">Настройки</h3>
            <p className="text-[#778DA9] text-sm">Скоро: профиль и подписка</p>
          </div>
        </div>

        {/* Sessions List */}
        <div className="space-y-6">
          {/* Active Sessions */}
          {activeSessions.length > 0 && (
            <div className="bg-[#1B263B] rounded-xl p-6 border border-emerald-500/30">
              <h2 className="text-emerald-400 font-semibold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                Активные игры
              </h2>
              <div className="space-y-3">
                {activeSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onManage={handleManageSession}
                    onDelete={handleDeleteSession}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Setup Sessions */}
          {setupSessions.length > 0 && (
            <div className="bg-[#1B263B] rounded-xl p-6 border border-yellow-500/30">
              <h2 className="text-yellow-400 font-semibold mb-4">Подготовка к игре</h2>
              <div className="space-y-3">
                {setupSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onManage={handleManageSession}
                    onDelete={handleDeleteSession}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Finished Sessions */}
          {finishedSessions.length > 0 && (
            <div className="bg-[#1B263B] rounded-xl p-6 border border-[#415A77]/30">
              <h2 className="text-[#778DA9] font-semibold mb-4">Завершённые игры</h2>
              <div className="space-y-3">
                {finishedSessions.slice(0, 5).map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onManage={handleManageSession}
                    onDelete={handleDeleteSession}
                  />
                ))}
                {finishedSessions.length > 5 && (
                  <p className="text-[#778DA9] text-sm text-center py-2">
                    И ещё {finishedSessions.length - 5} завершённых игр
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {sessions.length === 0 && !sessionsLoading && (
            <div className="bg-[#1B263B] rounded-xl p-6 border border-[#415A77]/30">
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🎲</div>
                <p className="text-[#778DA9] mb-4">У вас пока нет игр</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-2 bg-[#D4A017] hover:bg-[#E0B030] text-[#0D1B2A] font-semibold rounded-lg transition-colors"
                >
                  Создать первую игру
                </button>
              </div>
            </div>
          )}

          {sessionsLoading && (
            <div className="text-center py-8">
              <div className="text-[#778DA9] animate-pulse">Загрузка игр...</div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#1B263B] rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-[#E0E1DD]">{sessions.length}</div>
            <div className="text-[#778DA9] text-sm">Всего игр</div>
          </div>
          <div className="bg-[#1B263B] rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-emerald-400">{activeSessions.length}</div>
            <div className="text-[#778DA9] text-sm">Активных</div>
          </div>
          <div className="bg-[#1B263B] rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-[#E0E1DD]">{finishedSessions.length}</div>
            <div className="text-[#778DA9] text-sm">Завершено</div>
          </div>
          <div className="bg-[#1B263B] rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-emerald-400">{maxPlayers}</div>
            <div className="text-[#778DA9] text-sm">Макс. игроков</div>
          </div>
        </div>
      </main>

      {/* Create Game Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1B263B] rounded-2xl p-6 max-w-md w-full border border-[#415A77]/50">
            <h2 className="text-xl font-bold text-[#E0E1DD] mb-6">Создать игру</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-[#778DA9] text-sm mb-2">Название игры (необязательно)</label>
                <input
                  type="text"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  placeholder="Например: Игра для 10-А класса"
                  className="w-full px-4 py-3 bg-[#0D1B2A] border border-[#415A77]/50 rounded-lg text-[#E0E1DD] placeholder-[#778DA9]/50 focus:outline-none focus:border-[#D4A017]"
                />
              </div>

              <div>
                <label className="block text-[#778DA9] text-sm mb-2">Количество игроков</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="4"
                    max={maxPlayers}
                    value={playerCount}
                    onChange={(e) => setPlayerCount(Number(e.target.value))}
                    className="flex-1 accent-[#D4A017]"
                  />
                  <div className="w-16 text-center text-2xl font-bold text-[#D4A017]">{playerCount}</div>
                </div>
                <p className="text-[#778DA9] text-xs mt-1">
                  {canCreateLargeGames
                    ? 'Доступно от 4 до 20 игроков'
                    : 'На бесплатном тарифе доступно до 4 игроков'}
                </p>
              </div>

              {createError && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                  {createError}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-3 bg-[#415A77] hover:bg-[#778DA9] text-white rounded-lg transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateGame}
                disabled={creating}
                className="flex-1 px-4 py-3 bg-[#D4A017] hover:bg-[#E0B030] text-[#0D1B2A] font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {creating ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Session Card Component
function SessionCard({
  session,
  onManage,
  onDelete,
}: {
  session: GameSession;
  onManage: (session: GameSession) => void;
  onDelete: (session: GameSession) => void;
}) {
  const status = STATUS_LABELS[session.status];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex items-center justify-between bg-[#0D1B2A] rounded-lg p-4">
      <div className="flex items-center gap-4">
        <div className="text-2xl">🎮</div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[#E0E1DD] font-medium">{session.name || `Игра ${session.code}`}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${status.bg} ${status.color}`}>{status.label}</span>
          </div>
          <div className="text-[#778DA9] text-sm flex items-center gap-3">
            <span>Код: {session.code}</span>
            <span>•</span>
            <span>{session.playerCount} игроков</span>
            <span>•</span>
            <span>{formatDate(session.createdAt)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onManage(session)}
          className="px-4 py-2 bg-[#415A77] hover:bg-[#778DA9] text-white rounded-lg transition-colors text-sm"
        >
          Управление
        </button>
        {(session.status === 'SETUP' || session.status === 'FINISHED') && (
          <button
            onClick={() => onDelete(session)}
            className="p-2 text-red-400 hover:bg-red-400/20 rounded-lg transition-colors"
            title="Удалить"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}
