import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useGameState } from '../hooks/useGameState';
import { RoleCard } from '../components/RoleCard';
import { getStoredToken as getPlayerAuthToken } from '../services/player-auth-api';
import { useAuthStore } from '../stores/authStore';
import rolesData from '../data/roles.json';
import type { GameRole } from '../types/game-data';

const roles = rolesData as GameRole[];

export function RoleLobby() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionCode = searchParams.get('session');

  const { state, isConnected, isSessionJoined, claimRole } = useGameState({ sessionCode });
  const { user, playerProfile } = useAuthStore();
  const [playerName, setPlayerName] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimedToken, setClaimedToken] = useState<string | null>(() => {
    // Restore from localStorage if page was refreshed
    return localStorage.getItem('horizon_claimed_token');
  });
  const [isClaiming, setIsClaiming] = useState(false);

  const activeRoles = useMemo(() => {
    if (!state) return [];
    return state.roles
      .filter((r) => r.isActive)
      .map((r) => ({
        ...r,
        roleData: roles.find((rd) => rd.id === r.id),
      }));
  }, [state]);

  const availableRoles = useMemo(() => {
    return activeRoles.filter((r) => r.claimedBy === null);
  }, [activeRoles]);

  const claimedCount = activeRoles.length - availableRoles.length;
  const totalCount = activeRoles.length;

  // Check if user has already claimed a role
  const myRole = useMemo(() => {
    if (!claimedToken || !state) return null;
    return state.roles.find((r) => r.token === claimedToken);
  }, [state, claimedToken]);

  const handleClaim = () => {
    if (isClaiming) return; // Block double-clicks

    if (!selectedRoleId || !playerName.trim()) {
      setClaimError('Введите имя и выберите роль');
      return;
    }

    // Find the token before claiming
    const role = state?.roles.find((r) => r.id === selectedRoleId);
    if (!role) {
      setClaimError('Роль не найдена');
      return;
    }

    // Check if role is still available
    if (role.claimedBy !== null) {
      setClaimError('Эта роль уже занята. Выберите другую.');
      setSelectedRoleId(null);
      return;
    }

    setIsClaiming(true);
    setClaimError(null);
    const playerAuthToken = getPlayerAuthToken();
    claimRole(selectedRoleId, playerName.trim(), playerAuthToken || undefined);

    // Save token and redirect immediately
    const token = role.token;
    localStorage.setItem('horizon_claimed_token', token);
    setClaimedToken(token);

    // Redirect to game after a short delay to let the claim propagate
    setTimeout(() => {
      const sessionParam = sessionCode ? `?session=${sessionCode}` : '';
      navigate(`/play/${token}${sessionParam}`);
    }, 500);
  };

  const handleEnterGame = () => {
    if (claimedToken) {
      const sessionParam = sessionCode ? `?session=${sessionCode}` : '';
      navigate(`/play/${claimedToken}${sessionParam}`);
    }
  };

  if (!isConnected || !isSessionJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1B263B] to-[#0D1B2A] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-[#778DA9]">
            {!isConnected ? 'Подключение...' : 'Присоединение к сессии...'}
          </p>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1B263B] to-[#0D1B2A] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-[#D4A017] mb-2">Сессия не найдена</h1>
          <p className="text-[#778DA9]">Попросите организатора начать игру</p>
        </div>
      </div>
    );
  }

  if (state.settings.gamePhase !== 'distribution') {
    if (state.settings.gamePhase === 'playing' && myRole) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-[#1B263B] to-[#0D1B2A] flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="text-5xl mb-4">🎮</div>
            <h1 className="text-2xl font-bold text-[#D4A017] mb-4">Игра началась!</h1>
            <button
              onClick={handleEnterGame}
              className="w-full bg-gradient-to-r from-[#D4A017] to-[#B8860B] text-[#0D1B2A] font-bold py-4 rounded-xl hover:opacity-90 transition-opacity"
            >
              Войти в игру
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1B263B] to-[#0D1B2A] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-xl font-bold text-[#D4A017] mb-2">Ожидание</h1>
          <p className="text-[#778DA9]">
            {state.settings.gamePhase === 'setup'
              ? 'Организатор настраивает игру...'
              : state.settings.gamePhase === 'playing'
              ? 'Игра уже идёт'
              : 'Игра завершена'}
          </p>
        </div>
      </div>
    );
  }

  // If user already claimed a role
  if (myRole) {
    const roleData = roles.find((r) => r.id === myRole.id);
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1B263B] to-[#0D1B2A] p-6">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-[#D4A017] mb-2">Роль выбрана!</h1>
            <p className="text-[#778DA9]">Ожидайте начала игры</p>
          </div>

          {roleData && (
            <RoleCard
              role={roleData}
              isActive={true}
              claimedBy={myRole.claimedBy}
            />
          )}

          <div className="mt-6 bg-[#1B263B]/50 rounded-xl p-4 border border-[#415A77]/30">
            <div className="flex justify-between items-center">
              <span className="text-[#778DA9]">Игроков готово:</span>
              <span className="text-[#D4A017] font-bold">
                {claimedCount} / {totalCount}
              </span>
            </div>
            <div className="mt-2 bg-[#0D1B2A] rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#D4A017] to-[#B8860B] transition-all"
                style={{ width: `${(claimedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>

          {claimedCount === totalCount && (
            <div className="mt-6 text-center">
              <p className="text-green-400 mb-4">Все роли заняты!</p>
              <p className="text-[#778DA9] text-sm">Ожидайте начала игры от организатора</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1B263B] to-[#0D1B2A] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🌆</div>
          <h1 className="text-2xl font-bold text-[#D4A017] mb-1">Проект Горизонт</h1>
          <p className="text-[#778DA9]">Выберите свою роль</p>

          {/* Auth status badge */}
          <div className="mt-3">
            {user ? (
              <div className="inline-flex items-center gap-2 bg-[#D4A017]/20 text-[#D4A017] px-3 py-1.5 rounded-lg text-sm">
                <span>{playerProfile?.displayName}</span>
                <span className="text-[#D4A017]/60">•</span>
                <span>Ур. {playerProfile?.level || 1}</span>
              </div>
            ) : (
              <Link
                to={`/login?from=${encodeURIComponent(`/lobby?session=${sessionCode}`)}`}
                className="inline-block text-[#778DA9] hover:text-[#D4A017] text-sm transition-colors"
              >
                Войти для сохранения прогресса →
              </Link>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="bg-[#1B263B]/50 rounded-xl p-4 border border-[#415A77]/30 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[#778DA9]">Выбрано ролей:</span>
            <span className="text-[#D4A017] font-bold">
              {claimedCount} / {totalCount}
            </span>
          </div>
          <div className="bg-[#0D1B2A] rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#D4A017] to-[#B8860B] transition-all"
              style={{ width: `${(claimedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>

        {/* Name Input */}
        <div className="bg-[#1B263B]/50 rounded-xl p-4 border border-[#415A77]/30 mb-6">
          <label className="block text-sm font-medium text-[#778DA9] mb-2">
            Ваше имя
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Как вас зовут?"
            className="w-full bg-[#0D1B2A] border border-[#415A77] rounded-lg px-4 py-3 text-white placeholder-[#415A77] focus:outline-none focus:border-[#D4A017]"
          />
        </div>

        {claimError && (
          <div className="bg-red-900/30 border border-red-500/50 text-red-400 rounded-lg p-3 mb-4 text-center">
            {claimError}
          </div>
        )}

        {/* Available Roles */}
        <h2 className="text-lg font-bold text-white mb-4">
          Доступные роли ({availableRoles.length})
        </h2>

        {availableRoles.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🎭</div>
            <p className="text-[#778DA9]">Все роли заняты</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            {availableRoles.map((role) => (
              role.roleData && (
                <div
                  key={role.id}
                  className={`cursor-pointer transition-all ${
                    selectedRoleId === role.id ? 'ring-2 ring-[#D4A017] rounded-xl' : ''
                  }`}
                  onClick={() => setSelectedRoleId(role.id)}
                >
                  <RoleCard
                    role={role.roleData}
                    isActive={true}
                    claimedBy={null}
                  />
                </div>
              )
            ))}
          </div>
        )}

        {/* Claim Button */}
        {selectedRoleId && playerName.trim() && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0D1B2A] to-transparent">
            <div className="max-w-4xl mx-auto">
              <button
                onClick={handleClaim}
                disabled={isClaiming}
                className={`w-full font-bold py-4 rounded-xl transition-opacity text-lg ${
                  isClaiming
                    ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#D4A017] to-[#B8860B] text-[#0D1B2A] hover:opacity-90'
                }`}
              >
                {isClaiming ? 'Подождите...' : 'Выбрать роль'}
              </button>
            </div>
          </div>
        )}

        {/* Already Claimed Roles */}
        {claimedCount > 0 && (
          <>
            <h2 className="text-lg font-bold text-white mb-4 mt-8">
              Занятые роли ({claimedCount})
            </h2>
            <div className="grid gap-2 md:grid-cols-3">
              {activeRoles
                .filter((r) => r.claimedBy !== null)
                .map((role) => (
                  role.roleData && (
                    <RoleCard
                      key={role.id}
                      role={role.roleData}
                      isActive={true}
                      claimedBy={role.claimedBy}
                      compact={true}
                    />
                  )
                ))}
            </div>
          </>
        )}

        {/* Bottom padding for fixed button */}
        {selectedRoleId && playerName.trim() && <div className="h-24" />}
      </div>
    </div>
  );
}
