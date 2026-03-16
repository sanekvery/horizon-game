import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useGameState } from '../hooks/useGameState';
import rolesData from '../data/roles.json';
import crisesData from '../data/crises.json';
import type { Role, Vote, ResourceName, ZoneName } from '../types/game-state';
import { RESOURCE_ICONS } from '../types/game-state';
import type { GameRole, Crisis } from '../types/game-data';

type Screen =
  | 'welcome'
  | 'role-card'
  | 'voting'
  | 'crisis'
  | 'reveal-turn'
  | 'promise'
  | 'finale';

const DEADLINE_OPTIONS = [
  { value: '1week', label: '1 неделя' },
  { value: '2weeks', label: '2 недели' },
  { value: '1month', label: '1 месяц' },
  { value: '3months', label: '3 месяца' },
];

export function MobilePlayer() {
  const { token } = useParams<{ token: string }>();
  const {
    state,
    isConnected,
    isLoading,
    error,
    joinAsPlayer,
    castVote,
    setPromise,
    contributeToZone,
  } = useGameState();

  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [roleData, setRoleData] = useState<GameRole | null>(null);
  const [secretRevealed, setSecretRevealed] = useState(false);
  const [showSecretConfirm, setShowSecretConfirm] = useState(false);
  const [votedFor, setVotedFor] = useState<Record<string, string>>({});
  const [showVoteConfirm, setShowVoteConfirm] = useState<{ voteId: string; optionId: string; text: string } | null>(null);
  const [promiseText, setPromiseText] = useState('');
  const [promiseDeadline, setPromiseDeadline] = useState('1month');
  const [promiseSealed, setPromiseSealed] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [screenTransition, setScreenTransition] = useState(false);
  const [prevScreen, setPrevScreen] = useState<Screen>('welcome');

  // Join game with token
  useEffect(() => {
    if (token && isConnected) {
      joinAsPlayer(token);
    }
  }, [token, isConnected, joinAsPlayer]);

  // Find current role from state
  useEffect(() => {
    if (state && token) {
      const role = state.roles.find((r) => r.token === token);
      if (role) {
        setCurrentRole(role);
        const data = (rolesData as GameRole[]).find((r) => r.id === role.id);
        if (data) {
          setRoleData(data);
        }
        // Check if promise already submitted
        if (role.promise) {
          setPromiseText(role.promise);
          setPromiseSealed(true);
        }
      }
    }
  }, [state, token]);

  // Determine current screen based on game state
  const currentScreen = useMemo((): Screen => {
    if (!state || !currentRole) return 'welcome';

    // Check for active votes first
    const activeVote = state.votes.find((v) => v.status === 'active');
    if (activeVote && !votedFor[activeVote.id]) {
      return 'voting';
    }

    // Screen based on act — ВСЕГДА показываем role-card чтобы игрок видел свою роль
    switch (state.currentAct) {
      case 1:
        return 'role-card'; // Сразу показываем роль, не "ожидайте"
      case 2:
        return 'role-card';
      case 3:
        // Show crisis during scene 8
        if (state.currentScene === 8) {
          return 'crisis';
        }
        return 'role-card';
      case 4:
        // Show reveal turn during secret reveals
        if (state.currentScene === 9 || state.currentScene === 10 || state.currentScene === 11) {
          return 'reveal-turn';
        }
        return 'role-card';
      case 5:
        // Promise or finale
        if (promiseSealed || state.currentScene >= 14) {
          return 'finale';
        }
        return 'promise';
      default:
        return 'role-card';
    }
  }, [state, currentRole, votedFor, promiseSealed]);

  // Handle screen transitions
  useEffect(() => {
    if (currentScreen !== prevScreen) {
      setScreenTransition(true);
      const timer = setTimeout(() => {
        setPrevScreen(currentScreen);
        setScreenTransition(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentScreen, prevScreen]);

  // Get active vote
  const activeVote = useMemo(() => {
    if (!state) return null;
    return state.votes.find((v) => v.status === 'active');
  }, [state?.votes]);

  // Get crisis for this role's zone
  const activeCrisis = useMemo((): Crisis | null => {
    if (!roleData || state?.currentAct !== 3 || state?.currentScene !== 8) return null;
    return (crisesData as Crisis[]).find((c) => c.zone === roleData.zone) || null;
  }, [roleData, state?.currentAct, state?.currentScene]);

  // Handlers
  const handleRevealSecret = () => {
    if (showSecretConfirm) {
      setSecretRevealed(true);
      setShowSecretConfirm(false);
    } else {
      setShowSecretConfirm(true);
    }
  };

  const handleVote = (voteId: string, optionId: string, optionText: string) => {
    setShowVoteConfirm({ voteId, optionId, text: optionText });
  };

  const confirmVote = () => {
    if (showVoteConfirm) {
      castVote(showVoteConfirm.voteId, showVoteConfirm.optionId);
      setVotedFor((prev) => ({ ...prev, [showVoteConfirm.voteId]: showVoteConfirm.optionId }));
      setShowVoteConfirm(null);
    }
  };

  const handleSealPromise = () => {
    if (promiseText.trim()) {
      const deadlineDate = new Date();
      switch (promiseDeadline) {
        case '1week':
          deadlineDate.setDate(deadlineDate.getDate() + 7);
          break;
        case '2weeks':
          deadlineDate.setDate(deadlineDate.getDate() + 14);
          break;
        case '1month':
          deadlineDate.setMonth(deadlineDate.getMonth() + 1);
          break;
        case '3months':
          deadlineDate.setMonth(deadlineDate.getMonth() + 3);
          break;
      }
      setPromise(promiseText, deadlineDate.toISOString());
      setPromiseSealed(true);
    }
  };

  // DEBUG: показываем состояние на экране
  const debugInfo = {
    token: token || 'нет',
    isConnected,
    isLoading,
    hasState: !!state,
    hasCurrentRole: !!currentRole,
    hasRoleData: !!roleData,
    error: error || 'нет',
    rolesCount: state?.roles?.length || 0,
  };

  console.log('MobilePlayer debug:', debugInfo);

  // Error states
  if (!token) {
    return <ErrorScreen message="Токен не указан" />;
  }

  if (isLoading || !isConnected) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-[#415A77] border-t-[#D4A017] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#778DA9] mb-4">Подключение...</p>
        <div className="bg-[#1B263B] rounded-lg p-4 text-xs text-left w-full max-w-sm">
          <div className="text-[#778DA9] mb-2">DEBUG INFO:</div>
          <div className="text-[#E0E1DD] space-y-1">
            <div>token: {debugInfo.token}</div>
            <div>isConnected: {String(debugInfo.isConnected)}</div>
            <div>isLoading: {String(debugInfo.isLoading)}</div>
            <div>hasState: {String(debugInfo.hasState)}</div>
            <div>error: {debugInfo.error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorScreen message={error} />;
  }

  if (!currentRole || !roleData) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-[#415A77] border-t-[#D4A017] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#778DA9] mb-4">Загрузка роли...</p>
        <div className="bg-[#1B263B] rounded-lg p-4 text-xs text-left w-full max-w-sm">
          <div className="text-[#778DA9] mb-2">DEBUG INFO:</div>
          <div className="text-[#E0E1DD] space-y-1">
            <div>token: {debugInfo.token}</div>
            <div>isConnected: {String(debugInfo.isConnected)}</div>
            <div>hasState: {String(debugInfo.hasState)}</div>
            <div>rolesCount: {debugInfo.rolesCount}</div>
            <div>hasCurrentRole: {String(debugInfo.hasCurrentRole)}</div>
            <div>hasRoleData: {String(debugInfo.hasRoleData)}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] text-[#E0E1DD] overflow-hidden">
      {/* Screen content with transition */}
      <div className={`transition-opacity duration-300 ${screenTransition ? 'opacity-0' : 'opacity-100'}`}>
        {currentScreen === 'welcome' && (
          <WelcomeScreen role={currentRole} roleData={roleData} />
        )}

        {currentScreen === 'role-card' && (
          <RoleCardScreen
            role={currentRole}
            roleData={roleData}
            secretRevealed={secretRevealed}
            showSecretConfirm={showSecretConfirm}
            onRevealSecret={handleRevealSecret}
            onCancelReveal={() => setShowSecretConfirm(false)}
            onContribute={contributeToZone}
          />
        )}

        {currentScreen === 'voting' && activeVote && (
          <VotingScreen
            vote={activeVote}
            votedFor={votedFor}
            showConfirm={showVoteConfirm}
            onVote={handleVote}
            onConfirm={confirmVote}
            onCancel={() => setShowVoteConfirm(null)}
          />
        )}

        {currentScreen === 'crisis' && activeCrisis && (
          <CrisisScreen crisis={activeCrisis} />
        )}

        {currentScreen === 'reveal-turn' && (
          <RevealTurnScreen
            roleData={roleData}
            isReady={isReady}
            onReady={() => setIsReady(true)}
          />
        )}

        {currentScreen === 'promise' && (
          <PromiseScreen
            promiseText={promiseText}
            setPromiseText={setPromiseText}
            promiseDeadline={promiseDeadline}
            setPromiseDeadline={setPromiseDeadline}
            onSeal={handleSealPromise}
          />
        )}

        {currentScreen === 'finale' && (
          <FinaleScreen role={currentRole} promiseText={promiseText} />
        )}
      </div>

      {/* Connection indicator */}
      <div className="fixed bottom-4 right-4 flex items-center gap-2 text-xs text-[#415A77]">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
        {isConnected ? 'Онлайн' : 'Офлайн'}
      </div>
    </div>
  );
}

// ============ SCREENS ============

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-red-400 mb-2">Ошибка</h1>
        <p className="text-[#778DA9]">{message}</p>
      </div>
    </div>
  );
}

// SCREEN 1: Welcome
interface WelcomeScreenProps {
  role: Role;
  roleData: GameRole;
}

function WelcomeScreen({ role, roleData }: WelcomeScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      {/* Logo / Title */}
      <div className="mb-8">
        <div className="text-[#778DA9] text-sm uppercase tracking-widest mb-2">
          Добро пожаловать в
        </div>
        <h1 className="text-3xl font-bold text-[#E0E1DD]">Проект Горизонт</h1>
      </div>

      {/* Role name */}
      <div className="mb-8">
        <div className="text-[#778DA9] text-sm mb-2">Вы —</div>
        <h2 className="text-2xl font-bold text-[#D4A017] mb-2">{role.name}</h2>
        <div className="text-[#778DA9] italic">{roleData.archetype}</div>
      </div>

      {/* Waiting indicator */}
      <div className="flex items-center gap-3 text-[#778DA9]">
        <div className="w-3 h-3 bg-[#D4A017] rounded-full animate-pulse" />
        <span>Ожидайте начала...</span>
      </div>
    </div>
  );
}

// SCREEN 2: Role Card
interface RoleCardScreenProps {
  role: Role;
  roleData: GameRole;
  secretRevealed: boolean;
  showSecretConfirm: boolean;
  onRevealSecret: () => void;
  onCancelReveal: () => void;
  onContribute: (zone: ZoneName, resource: ResourceName, amount: number) => void;
}

const RESOURCE_NAMES: Record<ResourceName, string> = {
  energy: 'Энергия',
  materials: 'Материалы',
  food: 'Еда',
  knowledge: 'Знания',
};

function RoleCardScreen({
  role,
  roleData,
  secretRevealed,
  showSecretConfirm,
  onRevealSecret,
  onCancelReveal,
  onContribute,
}: RoleCardScreenProps) {
  const [showContribute, setShowContribute] = useState(false);
  const resources: ResourceName[] = ['energy', 'materials', 'food', 'knowledge'];
  const zone = roleData.zone as ZoneName;
  const canContribute = zone !== 'unknown';

  return (
    <div className="min-h-screen flex flex-col p-4">
      {/* Header */}
      <div className="text-center py-4 border-b border-[#415A77]/30 mb-4">
        <h1 className="text-xl font-bold text-[#D4A017]">{role.name}</h1>
        <p className="text-[#778DA9] text-sm">{roleData.archetype}</p>
      </div>

      {/* Personal Resources */}
      <div className="bg-gradient-to-r from-[#1B263B] to-[#0D1B2A] border border-[#D4A017]/30 rounded-xl p-4 mb-4">
        <h3 className="text-[#D4A017] text-xs uppercase tracking-wide mb-3">
          Мои ресурсы
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {resources.map((resource) => (
            <div key={resource} className="text-center">
              <div className="text-2xl">{RESOURCE_ICONS[resource]}</div>
              <div className="text-[#E0E1DD] font-mono font-bold text-lg">
                {role.resources[resource]}
              </div>
              <div className="text-[#415A77] text-xs">{RESOURCE_NAMES[resource]}</div>
            </div>
          ))}
        </div>

        {/* Contribute toggle */}
        {canContribute && (
          <button
            onClick={() => setShowContribute(!showContribute)}
            className="w-full mt-3 py-2 bg-[#415A77]/50 hover:bg-[#415A77] rounded-lg text-[#E0E1DD] text-sm transition-colors"
          >
            {showContribute ? '▲ Свернуть' : '▼ Внести в зону "' + getZoneName(zone) + '"'}
          </button>
        )}

        {/* Contribute buttons */}
        {showContribute && canContribute && (
          <div className="mt-3 pt-3 border-t border-[#415A77]/30">
            <div className="text-[#778DA9] text-xs mb-2">Внести в пул зоны:</div>
            <div className="grid grid-cols-4 gap-2">
              {resources.map((resource) => {
                const hasResource = role.resources[resource] > 0;
                return (
                  <button
                    key={resource}
                    onClick={() => onContribute(zone, resource, 1)}
                    disabled={!hasResource}
                    className={`py-2 rounded-lg text-center transition-colors ${
                      hasResource
                        ? 'bg-emerald-900/50 hover:bg-emerald-800 active:scale-95 text-emerald-300'
                        : 'bg-[#415A77]/20 text-[#415A77] cursor-not-allowed'
                    }`}
                  >
                    <div className="text-lg">{RESOURCE_ICONS[resource]}</div>
                    <div className="text-xs">+1</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Mission */}
      <div className="flex-1">
        <div className="bg-[#1B263B] rounded-xl p-4 mb-4">
          <h3 className="text-[#778DA9] text-xs uppercase tracking-wide mb-2">
            Ваша миссия
          </h3>
          <p className="text-[#E0E1DD] leading-relaxed">
            {roleData.publicMission}
          </p>
        </div>

        {/* Zone indicator */}
        <div className="bg-[#1B263B] rounded-xl p-4 mb-4">
          <h3 className="text-[#778DA9] text-xs uppercase tracking-wide mb-2">
            Ваша зона
          </h3>
          <p className="text-[#E0E1DD] font-semibold">
            {getZoneName(roleData.zone)}
          </p>
        </div>
      </div>

      {/* Secret motivation card */}
      <div className="mt-auto">
        {!secretRevealed ? (
          <button
            onClick={onRevealSecret}
            className="w-full bg-gradient-to-r from-red-900 to-red-800 border-2 border-red-700 rounded-xl p-4 min-h-[60px] active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl">🔒</span>
              <div className="text-left">
                <div className="text-red-200 font-semibold">СЕКРЕТНАЯ МОТИВАЦИЯ</div>
                <div className="text-red-300/70 text-xs">Нажмите, чтобы раскрыть</div>
              </div>
            </div>
          </button>
        ) : (
          <div className="bg-gradient-to-r from-red-900 to-red-800 border-2 border-red-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-300 text-xs mb-2">
              <span>🔓</span>
              <span>СЕКРЕТНАЯ МОТИВАЦИЯ</span>
            </div>
            <p className="text-red-100 leading-relaxed">
              {roleData.secretMotivation}
            </p>
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {showSecretConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
          <div className="bg-[#1B263B] rounded-2xl p-6 max-w-sm w-full">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🔒</div>
              <h3 className="text-[#E0E1DD] font-semibold mb-2">Вы уверены?</h3>
              <p className="text-[#778DA9] text-sm">
                Это только для ваших глаз. После раскрытия информация останется видимой.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onCancelReveal}
                className="flex-1 py-3 bg-[#415A77] hover:bg-[#778DA9] rounded-lg font-semibold transition-colors min-h-[48px]"
              >
                Отмена
              </button>
              <button
                onClick={onRevealSecret}
                className="flex-1 py-3 bg-red-700 hover:bg-red-600 rounded-lg font-semibold transition-colors min-h-[48px]"
              >
                Раскрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// SCREEN 3: Voting
interface VotingScreenProps {
  vote: Vote;
  votedFor: Record<string, string>;
  showConfirm: { voteId: string; optionId: string; text: string } | null;
  onVote: (voteId: string, optionId: string, text: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function VotingScreen({ vote, votedFor, showConfirm, onVote, onConfirm, onCancel }: VotingScreenProps) {
  const hasVoted = !!votedFor[vote.id];

  return (
    <div className="min-h-screen flex flex-col p-4">
      {/* Header */}
      <div className="text-center py-4 mb-4">
        <div className="text-[#D4A017] text-sm uppercase tracking-wide mb-2">
          🗳️ Голосование
        </div>
      </div>

      {/* Question */}
      <div className="bg-[#1B263B] rounded-xl p-4 mb-6">
        <p className="text-[#E0E1DD] text-lg font-semibold leading-relaxed">
          {vote.question}
        </p>
      </div>

      {/* Options or voted state */}
      {hasVoted ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-5xl mb-4">✓</div>
          <h3 className="text-[#E0E1DD] text-xl font-semibold mb-2">
            Ваш голос принят
          </h3>
          <p className="text-[#778DA9]">
            Ожидайте результатов...
          </p>
          <div className="mt-4 flex gap-2">
            <div className="w-2 h-2 bg-[#D4A017] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-[#D4A017] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-[#D4A017] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-3">
          {vote.options.map((option) => (
            <button
              key={option.id}
              onClick={() => onVote(vote.id, option.id, option.text)}
              className="w-full bg-[#1B263B] hover:bg-[#415A77]/50 border-2 border-[#415A77] hover:border-[#D4A017] rounded-xl p-4 text-left transition-all active:scale-[0.98] min-h-[60px]"
            >
              <span className="text-[#E0E1DD] font-medium">{option.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
          <div className="bg-[#1B263B] rounded-2xl p-6 max-w-sm w-full">
            <div className="text-center mb-6">
              <h3 className="text-[#E0E1DD] font-semibold mb-2">Проголосовать за:</h3>
              <p className="text-[#D4A017] text-lg">"{showConfirm.text}"</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-3 bg-[#415A77] hover:bg-[#778DA9] rounded-lg font-semibold transition-colors min-h-[48px]"
              >
                Отмена
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-3 bg-[#D4A017] hover:bg-[#c4940f] text-[#0D1B2A] rounded-lg font-semibold transition-colors min-h-[48px]"
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// SCREEN 4: Crisis
interface CrisisScreenProps {
  crisis: Crisis;
}

function CrisisScreen({ crisis }: CrisisScreenProps) {
  return (
    <div className="min-h-screen flex flex-col p-4">
      {/* Header */}
      <div className="text-center py-4 mb-4">
        <div className="bg-red-900/50 border border-red-500 rounded-full px-4 py-2 inline-flex items-center gap-2">
          <span className="text-xl">⚡</span>
          <span className="text-red-300 font-bold uppercase tracking-wide">Кризис</span>
        </div>
      </div>

      {/* Crisis content */}
      <div className="flex-1">
        <div className="bg-gradient-to-b from-red-900/30 to-[#1B263B] border border-red-500/30 rounded-xl p-5">
          <h2 className="text-[#E0E1DD] text-xl font-bold mb-4">{crisis.title}</h2>
          <p className="text-[#E0E1DD]/90 leading-relaxed mb-6">
            {crisis.description}
          </p>

          <div className="border-t border-red-500/30 pt-4">
            <div className="text-red-300 text-sm font-semibold mb-2">
              Вопрос для обсуждения:
            </div>
            <p className="text-[#E0E1DD] font-medium">{crisis.question}</p>
          </div>
        </div>

        <div className="mt-6 text-center text-[#778DA9] text-sm">
          <p>Обсудите решение с вашей командой.</p>
          <p className="mt-1">Голосование будет объявлено ведущим.</p>
        </div>
      </div>
    </div>
  );
}

// SCREEN 5: Reveal Turn
interface RevealTurnScreenProps {
  roleData: GameRole;
  isReady: boolean;
  onReady: () => void;
}

function RevealTurnScreen({ roleData, isReady, onReady }: RevealTurnScreenProps) {
  return (
    <div className="min-h-screen flex flex-col p-4">
      {/* Header */}
      <div className="text-center py-6 mb-4">
        <div className="text-[#D4A017] text-sm uppercase tracking-widest mb-2">
          Акт IV
        </div>
        <h1 className="text-2xl font-bold text-[#E0E1DD]">
          Настало время раскрыть правду
        </h1>
      </div>

      {/* Reveal line prompt */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="bg-gradient-to-b from-[#D4A017]/20 to-[#1B263B] border border-[#D4A017]/30 rounded-xl p-6">
          <div className="text-[#D4A017] text-xs uppercase tracking-wide mb-3">
            Ваши слова
          </div>
          <p className="text-[#E0E1DD] text-lg italic leading-relaxed">
            "{roleData.revealLine}"
          </p>
        </div>

        <div className="mt-6 text-center text-[#778DA9] text-sm">
          <p>Когда придёт ваша очередь, произнесите эти слова вслух.</p>
        </div>
      </div>

      {/* Ready button */}
      <div className="mt-auto pt-6">
        {!isReady ? (
          <button
            onClick={onReady}
            className="w-full bg-[#D4A017] hover:bg-[#c4940f] text-[#0D1B2A] font-bold py-4 rounded-xl transition-colors active:scale-[0.98] min-h-[56px]"
          >
            Я готов
          </button>
        ) : (
          <div className="text-center py-4">
            <div className="text-emerald-400 font-semibold flex items-center justify-center gap-2">
              <span>✓</span>
              <span>Вы готовы</span>
            </div>
            <p className="text-[#778DA9] text-sm mt-1">Ожидайте своей очереди</p>
          </div>
        )}
      </div>
    </div>
  );
}

// SCREEN 6: Promise
interface PromiseScreenProps {
  promiseText: string;
  setPromiseText: (text: string) => void;
  promiseDeadline: string;
  setPromiseDeadline: (deadline: string) => void;
  onSeal: () => void;
}

function PromiseScreen({
  promiseText,
  setPromiseText,
  promiseDeadline,
  setPromiseDeadline,
  onSeal,
}: PromiseScreenProps) {
  return (
    <div className="min-h-screen flex flex-col p-4 bg-gradient-to-b from-[#1B263B] to-[#0D1B2A]">
      {/* Candle illustration */}
      <div className="text-center py-6">
        <div className="text-6xl mb-2">🕯️</div>
        <h1 className="text-xl font-bold text-[#D4A017]">Ваше обещание</h1>
        <p className="text-[#778DA9] text-sm mt-1">городу Горизонт</p>
      </div>

      {/* Promise input */}
      <div className="flex-1">
        <div className="bg-[#0D1B2A] border border-[#D4A017]/30 rounded-xl p-4 mb-4">
          <label className="text-[#D4A017] text-xs uppercase tracking-wide block mb-2">
            Я обещаю...
          </label>
          <textarea
            value={promiseText}
            onChange={(e) => setPromiseText(e.target.value)}
            placeholder="Напишите ваше обещание..."
            className="w-full bg-transparent text-[#E0E1DD] placeholder-[#415A77] resize-none focus:outline-none min-h-[120px] leading-relaxed"
            rows={4}
          />
        </div>

        {/* Deadline selector */}
        <div className="bg-[#0D1B2A] border border-[#415A77]/30 rounded-xl p-4">
          <label className="text-[#778DA9] text-xs uppercase tracking-wide block mb-2">
            Срок выполнения
          </label>
          <select
            value={promiseDeadline}
            onChange={(e) => setPromiseDeadline(e.target.value)}
            className="w-full bg-[#1B263B] border border-[#415A77] rounded-lg px-4 py-3 text-[#E0E1DD] focus:outline-none focus:border-[#D4A017] min-h-[48px]"
          >
            {DEADLINE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Seal button */}
      <div className="mt-6 pt-4">
        <button
          onClick={onSeal}
          disabled={!promiseText.trim()}
          className="w-full bg-[#D4A017] hover:bg-[#c4940f] disabled:opacity-50 disabled:cursor-not-allowed text-[#0D1B2A] font-bold py-4 rounded-xl transition-all active:scale-[0.98] min-h-[56px] flex items-center justify-center gap-2"
        >
          <span>🔏</span>
          <span>Запечатать обещание</span>
        </button>
      </div>
    </div>
  );
}

// SCREEN 7: Finale
interface FinaleScreenProps {
  role: Role;
  promiseText: string;
}

function FinaleScreen({ role, promiseText }: FinaleScreenProps) {
  return (
    <div className="min-h-screen flex flex-col p-4 bg-gradient-to-b from-[#1B263B] to-[#0D1B2A]">
      {/* Cityscape */}
      <div className="text-center py-8">
        <div className="text-4xl mb-4">🌆</div>
        <h1 className="text-2xl font-bold text-[#D4A017]">Город построен</h1>
      </div>

      {/* Sealed promise */}
      {promiseText && (
        <div className="flex-1 flex flex-col justify-center">
          <div className="relative bg-[#1B263B] border-2 border-[#D4A017]/50 rounded-xl p-6">
            {/* Wax seal */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 bg-gradient-to-br from-red-700 to-red-900 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-xs">🔏</span>
            </div>

            <div className="mt-4 text-center">
              <p className="text-[#E0E1DD] italic leading-relaxed">
                "{promiseText}"
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Thank you message */}
      <div className="mt-auto text-center py-8">
        <p className="text-[#778DA9] mb-2">Спасибо,</p>
        <p className="text-[#D4A017] text-xl font-semibold">{role.name}</p>
        <p className="text-[#415A77] text-sm mt-4">
          Ваше обещание останется в истории города Горизонт
        </p>
      </div>
    </div>
  );
}

// ============ HELPERS ============

function getZoneName(zone: string): string {
  const names: Record<string, string> = {
    center: 'Центр',
    residential: 'Жилой квартал',
    industrial: 'Промзона',
    green: 'Зелёный пояс',
    unknown: 'Неизведанная территория',
  };
  return names[zone] || zone;
}
