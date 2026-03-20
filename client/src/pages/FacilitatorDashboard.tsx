import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, Facilitator } from '../services/auth-api';

const SUBSCRIPTION_LABELS = {
  FREE: { label: 'Бесплатный', color: 'text-[#778DA9]', badge: 'bg-[#415A77]' },
  PRO: { label: 'Pro', color: 'text-emerald-400', badge: 'bg-emerald-600' },
  ENTERPRISE: { label: 'Enterprise', color: 'text-amber-400', badge: 'bg-amber-600' },
};

export function FacilitatorDashboard() {
  const navigate = useNavigate();
  const [facilitator, setFacilitator] = useState<Facilitator | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      if (!authApi.isAuthenticated()) {
        navigate('/auth');
        return;
      }

      const result = await authApi.getMe();
      if (result.success && result.facilitator) {
        setFacilitator(result.facilitator);
      } else {
        authApi.logout();
        navigate('/auth');
      }
      setLoading(false);
    };

    loadUser();
  }, [navigate]);

  const handleLogout = () => {
    authApi.logout();
    navigate('/auth');
  };

  const handleCreateGame = () => {
    // Redirect to admin panel for now (will be replaced with proper game creation)
    navigate('/admin');
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
            onClick={handleCreateGame}
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
            <h3 className="text-[#E0E1DD] font-semibold mb-2">История игр</h3>
            <p className="text-[#778DA9] text-sm">Скоро: просмотр прошлых сессий</p>
          </div>

          <div className="bg-[#1B263B] rounded-xl p-6 border border-[#415A77]/30 opacity-50">
            <div className="text-4xl mb-4">⚙️</div>
            <h3 className="text-[#E0E1DD] font-semibold mb-2">Настройки</h3>
            <p className="text-[#778DA9] text-sm">Скоро: профиль и подписка</p>
          </div>
        </div>

        {/* Recent Games (placeholder) */}
        <div className="bg-[#1B263B] rounded-xl p-6 border border-[#415A77]/30">
          <h2 className="text-[#E0E1DD] font-semibold mb-4">Мои игры</h2>
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🎲</div>
            <p className="text-[#778DA9] mb-4">У вас пока нет сохранённых игр</p>
            <button
              onClick={handleCreateGame}
              className="px-6 py-2 bg-[#D4A017] hover:bg-[#E0B030] text-[#0D1B2A] font-semibold rounded-lg transition-colors"
            >
              Создать первую игру
            </button>
          </div>
        </div>

        {/* Stats (placeholder) */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#1B263B] rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-[#E0E1DD]">0</div>
            <div className="text-[#778DA9] text-sm">Игр проведено</div>
          </div>
          <div className="bg-[#1B263B] rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-[#E0E1DD]">0</div>
            <div className="text-[#778DA9] text-sm">Участников</div>
          </div>
          <div className="bg-[#1B263B] rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-[#E0E1DD]">0</div>
            <div className="text-[#778DA9] text-sm">Часов игры</div>
          </div>
          <div className="bg-[#1B263B] rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-emerald-400">
              {facilitator.subscriptionType === 'FREE' ? '4' : '20'}
            </div>
            <div className="text-[#778DA9] text-sm">Макс. игроков</div>
          </div>
        </div>
      </main>
    </div>
  );
}
