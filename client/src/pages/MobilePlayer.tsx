import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useGameState } from '../hooks/useGameState';
import { useProgression, type XPGainEvent, type LevelUpEvent } from '../hooks/useProgression';
import rolesData from '../data/roles.json';
import crisesData from '../data/crises.json';
import scenarioData from '../data/scenario.json';
import type { Role, Vote, ResourceName, ZoneName, Zone, GameState } from '../types/game-state';
import { RESOURCE_ICONS, ZONE_NAMES_RU } from '../types/game-state';
import type { GameRole, Crisis } from '../types/game-data';
import { getUpgradeCost, canAffordUpgrade } from '../data/zone-upgrade-costs';
import { StatsDisplay, type CharacterStats } from '../components/progression/StatsDisplay';
import { ExperienceBar } from '../components/progression/ExperienceBar';

type Screen =
  | 'onboarding'
  | 'role-intro'
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
  const [searchParams] = useSearchParams();
  const sessionCode = searchParams.get('session');

  const {
    state,
    isConnected,
    isSessionJoined,
    isLoading,
    error,
    joinAsPlayer,
    castVote,
    setPromise,
    contributeToZone,
  } = useGameState({ sessionCode });

  const [currentRole, setCurrentRole] = useState<Role | null>(null);

  // Progression system hook
  const {
    stats: progressionStats,
    isProgressionEnabled,
    lastXPGain,
    lastLevelUp,
  } = useProgression({
    sessionCode: sessionCode || '',
    roleId: currentRole?.id,
    enabled: !!sessionCode && !!currentRole,
  });
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
  const [prevScreen, setPrevScreen] = useState<Screen>('onboarding');
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    return localStorage.getItem('horizon_seen_onboarding') === 'true';
  });
  const [hasSeenRoleIntro, setHasSeenRoleIntro] = useState(() => {
    return localStorage.getItem('horizon_seen_role_intro') === 'true';
  });
  const [showRoleModal, setShowRoleModal] = useState(false);

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
    if (!state || !currentRole) return 'onboarding';

    // Show onboarding first if not seen
    if (!hasSeenOnboarding) {
      return 'onboarding';
    }

    // Show role intro if not seen
    if (!hasSeenRoleIntro) {
      return 'role-intro';
    }

    // Check for active votes first
    const activeVote = state.votes.find((v) => v.status === 'active');
    if (activeVote && !votedFor[activeVote.id]) {
      return 'voting';
    }

    // Screen based on act
    switch (state.currentAct) {
      case 1:
        return 'role-card';
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
  }, [state, currentRole, votedFor, promiseSealed, hasSeenOnboarding, hasSeenRoleIntro]);

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
  const handleCompleteOnboarding = () => {
    localStorage.setItem('horizon_seen_onboarding', 'true');
    setHasSeenOnboarding(true);
  };

  const handleCompleteRoleIntro = () => {
    localStorage.setItem('horizon_seen_role_intro', 'true');
    setHasSeenRoleIntro(true);
  };

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

  if (isLoading || !isConnected || !isSessionJoined) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-[#415A77] border-t-[#D4A017] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#778DA9] mb-4">
          {!isConnected ? 'Подключение...' : !isSessionJoined ? 'Присоединение к сессии...' : 'Загрузка...'}
        </p>
        <div className="bg-[#1B263B] rounded-lg p-4 text-xs text-left w-full max-w-sm">
          <div className="text-[#778DA9] mb-2">DEBUG INFO:</div>
          <div className="text-[#E0E1DD] space-y-1">
            <div>token: {debugInfo.token}</div>
            <div>isConnected: {String(debugInfo.isConnected)}</div>
            <div>isSessionJoined: {String(isSessionJoined)}</div>
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
        {currentScreen === 'onboarding' && (
          <OnboardingScreen onComplete={handleCompleteOnboarding} />
        )}

        {currentScreen === 'role-intro' && currentRole && roleData && (
          <RoleIntroScreen
            role={currentRole}
            roleData={roleData}
            onComplete={handleCompleteRoleIntro}
          />
        )}

        {currentScreen === 'role-card' && state && currentRole && roleData && (
          <RoleCardScreen
            role={currentRole}
            roleData={roleData}
            gameState={state}
            secretRevealed={secretRevealed}
            showSecretConfirm={showSecretConfirm}
            onRevealSecret={handleRevealSecret}
            onCancelReveal={() => setShowSecretConfirm(false)}
            onContribute={contributeToZone}
            zoneData={roleData.zone !== 'unknown' ? state.zones[roleData.zone as Exclude<ZoneName, 'unknown'>] : undefined}
            onShowRoleInfo={() => setShowRoleModal(true)}
            isProgressionEnabled={isProgressionEnabled}
            playerStats={progressionStats?.stats}
            playerLevel={progressionStats?.level}
            playerExperience={progressionStats?.experienceGained}
            lastXPGain={lastXPGain}
            lastLevelUp={lastLevelUp}
          />
        )}

        {/* Role Info Modal */}
        {showRoleModal && currentRole && roleData && (
          <RoleInfoModal
            role={currentRole}
            roleData={roleData}
            onClose={() => setShowRoleModal(false)}
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

// SCREEN 1: Onboarding
interface OnboardingScreenProps {
  onComplete: () => void;
}

function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      icon: '🌆',
      title: 'Добро пожаловать в Проект Горизонт',
      description: 'Вы — один из последних выживших. Вместе с другими вам предстоит построить новый город с нуля.',
    },
    {
      icon: '🎭',
      title: 'У вас есть роль',
      description: 'Каждый участник получает профессию, миссию и секретную мотивацию. Играйте свою роль, но помните — у каждого есть что скрывать.',
    },
    {
      icon: '🏗️',
      title: 'Что вы будете делать',
      description: 'Обсуждать, спорить, принимать решения. Распределять ресурсы между зонами города. Решать кризисы. И в конце — раскрыть правду.',
    },
    {
      icon: '🤫',
      title: 'Главное правило',
      description: 'Никому не показывайте свой секрет до момента раскрытия. Играйте честно — это делает игру интересной для всех.',
    },
  ];

  const currentStep = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="min-h-screen flex flex-col p-6 bg-gradient-to-b from-[#1B263B] to-[#0D1B2A]">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 py-4">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === step ? 'bg-[#D4A017]' : i < step ? 'bg-[#D4A017]/50' : 'bg-[#415A77]'
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="text-6xl mb-6">{currentStep.icon}</div>
        <h1 className="text-2xl font-bold text-[#E0E1DD] mb-4">{currentStep.title}</h1>
        <p className="text-[#778DA9] text-lg leading-relaxed max-w-md">
          {currentStep.description}
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-6">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="flex-1 py-4 bg-[#415A77] hover:bg-[#778DA9] rounded-xl font-semibold transition-colors"
          >
            Назад
          </button>
        )}
        <button
          onClick={() => (isLast ? onComplete() : setStep(step + 1))}
          className={`flex-1 py-4 rounded-xl font-semibold transition-colors ${
            isLast
              ? 'bg-[#D4A017] hover:bg-[#c4940f] text-[#0D1B2A]'
              : 'bg-[#415A77] hover:bg-[#778DA9] text-[#E0E1DD]'
          }`}
        >
          {isLast ? 'Начать' : 'Далее'}
        </button>
      </div>
    </div>
  );
}

// SCREEN 2: Role Introduction
interface RoleIntroScreenProps {
  role: Role;
  roleData: GameRole;
  onComplete: () => void;
}

function RoleIntroScreen({ role, roleData, onComplete }: RoleIntroScreenProps) {
  const [activeTab, setActiveTab] = useState<'how' | 'moments' | 'relations'>('how');

  return (
    <div className="min-h-screen flex flex-col p-4 bg-gradient-to-b from-[#1B263B] to-[#0D1B2A]">
      {/* Header */}
      <div className="text-center py-6 border-b border-[#415A77]/30 mb-4">
        <div className="text-[#778DA9] text-sm mb-2">Ваша роль</div>
        <h1 className="text-2xl font-bold text-[#D4A017] mb-1">{role.name}</h1>
        <p className="text-[#778DA9] italic">{roleData.archetype}</p>
        <div className="mt-3 inline-flex items-center gap-2 text-xs bg-[#0D1B2A] px-3 py-1 rounded-full border border-[#415A77]/30">
          <span className="text-[#778DA9]">Зона:</span>
          <span className="text-[#E0E1DD] font-medium">{ZONE_NAMES_RU[roleData.zone as keyof typeof ZONE_NAMES_RU] || roleData.zone}</span>
        </div>
      </div>

      {/* Public Mission */}
      <div className="bg-gradient-to-r from-emerald-900/30 to-emerald-800/20 rounded-xl p-4 mb-4 border border-emerald-500/30">
        <div className="flex items-center gap-2 text-emerald-400 text-xs uppercase tracking-wide mb-2">
          <span>🎯</span>
          <span>Ваша миссия</span>
        </div>
        <p className="text-[#E0E1DD] leading-relaxed">{roleData.publicMission}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('how')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'how' ? 'bg-[#D4A017] text-[#0D1B2A]' : 'bg-[#1B263B] text-[#778DA9]'
          }`}
        >
          Как играть
        </button>
        <button
          onClick={() => setActiveTab('moments')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'moments' ? 'bg-[#D4A017] text-[#0D1B2A]' : 'bg-[#1B263B] text-[#778DA9]'
          }`}
        >
          Ключевые моменты
        </button>
        <button
          onClick={() => setActiveTab('relations')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'relations' ? 'bg-[#D4A017] text-[#0D1B2A]' : 'bg-[#1B263B] text-[#778DA9]'
          }`}
        >
          Отношения
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'how' && roleData.howToPlay && (
          <div className="bg-[#1B263B] rounded-xl p-4">
            <p className="text-[#E0E1DD] leading-relaxed">{roleData.howToPlay}</p>
          </div>
        )}

        {activeTab === 'moments' && roleData.keyMoments && (
          <div className="space-y-3">
            {roleData.keyMoments.map((moment, i) => (
              <div key={i} className="bg-[#1B263B] rounded-xl p-4 flex items-start gap-3">
                <span className="text-[#D4A017] font-bold">{i + 1}</span>
                <p className="text-[#E0E1DD]">{moment}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'relations' && roleData.relationships && (
          <div className="bg-[#1B263B] rounded-xl p-4">
            <p className="text-[#E0E1DD] leading-relaxed">{roleData.relationships}</p>
          </div>
        )}
      </div>

      {/* Secret teaser */}
      <div className="mt-4 bg-red-900/20 rounded-xl p-4 border border-red-500/30">
        <div className="flex items-center gap-2 text-red-400 text-xs uppercase tracking-wide mb-2">
          <span>🔒</span>
          <span>Секретная мотивация</span>
        </div>
        <p className="text-[#778DA9] text-sm">
          После начала игры вы сможете раскрыть свой секрет. Это информация только для вас.
        </p>
      </div>

      {/* Continue button */}
      <div className="pt-6">
        <button
          onClick={onComplete}
          className="w-full py-4 bg-[#D4A017] hover:bg-[#c4940f] text-[#0D1B2A] font-bold rounded-xl transition-colors"
        >
          Я готов играть
        </button>
      </div>
    </div>
  );
}

// SCREEN 3: Role Card (Main game screen)
interface RoleCardScreenProps {
  role: Role;
  roleData: GameRole;
  gameState: GameState;
  secretRevealed: boolean;
  showSecretConfirm: boolean;
  onRevealSecret: () => void;
  onCancelReveal: () => void;
  onContribute: (zone: ZoneName, resource: ResourceName, amount: number) => void;
  zoneData?: Zone;
  onShowRoleInfo: () => void;
  // Progression
  isProgressionEnabled: boolean;
  playerStats?: CharacterStats;
  playerLevel?: number;
  playerExperience?: number;
  lastXPGain?: XPGainEvent | null;
  lastLevelUp?: LevelUpEvent | null;
}

const RESOURCE_NAMES: Record<ResourceName, string> = {
  energy: 'Энергия',
  materials: 'Материалы',
  food: 'Еда',
  knowledge: 'Знания',
};

// Get current task based on act/scene
function getCurrentTask(act: number, scene: number, roleData: GameRole): { icon: string; title: string; description: string } {
  // Act-based tasks
  if (act === 1) {
    if (scene <= 2) {
      return {
        icon: '📖',
        title: 'Изучите свою роль',
        description: 'Прочитайте миссию, раскройте секрет (только для себя!), запомните как вам играть.',
      };
    }
    return {
      icon: '👥',
      title: 'Найдите свою команду',
      description: `Ваша зона — ${ZONE_NAMES_RU[roleData.zone as keyof typeof ZONE_NAMES_RU] || roleData.zone}. Познакомьтесь с другими участниками вашей зоны.`,
    };
  }

  if (act === 2) {
    if (scene === 4) {
      return {
        icon: '🏗️',
        title: 'Планируйте зону',
        description: 'Обсудите с командой: какие здания строить? Какие ресурсы нужны? Что готовы отдать другим зонам?',
      };
    }
    if (scene === 5) {
      return {
        icon: '🎤',
        title: 'Презентация',
        description: 'Слушайте презентации других зон. Задавайте вопросы. Ищите возможности для сотрудничества.',
      };
    }
    return {
      icon: '👁️',
      title: 'Внимание!',
      description: 'Разведчик делится важной информацией. Слушайте внимательно.',
    };
  }

  if (act === 3) {
    if (scene === 7) {
      return {
        icon: '📜',
        title: 'Послание из прошлого',
        description: 'Историк читает послание от предыдущего города. Это изменит ваше понимание ситуации.',
      };
    }
    return {
      icon: '⚡',
      title: 'Кризис!',
      description: 'Город столкнулся с проблемой. Обсуждайте, спорьте, ищите решение. Ресурсы ограничены.',
    };
  }

  if (act === 4) {
    return {
      icon: '💫',
      title: 'Время правды',
      description: 'Приготовьтесь произнести свои слова раскрытия. Смотрите людям в глаза.',
    };
  }

  if (act === 5) {
    return {
      icon: '🕯️',
      title: 'Обещание',
      description: 'Подумайте: что вы хотите изменить в своей реальной жизни после этой игры?',
    };
  }

  return {
    icon: '🎮',
    title: 'Играйте свою роль',
    description: roleData.howToPlay || roleData.publicMission,
  };
}

function RoleCardScreen({
  role,
  roleData,
  gameState,
  secretRevealed,
  showSecretConfirm,
  onRevealSecret,
  onCancelReveal,
  onContribute,
  zoneData,
  onShowRoleInfo,
  isProgressionEnabled,
  playerStats,
  playerLevel,
  playerExperience,
  lastXPGain,
  lastLevelUp,
}: RoleCardScreenProps) {
  const [showContribute, setShowContribute] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [contributeAmount, setContributeAmount] = useState<Record<ResourceName, number>>({
    energy: 1,
    materials: 1,
    food: 1,
    knowledge: 1,
  });
  const resources: ResourceName[] = ['energy', 'materials', 'food', 'knowledge'];
  const zone = roleData.zone as ZoneName;
  const canContribute = zone !== 'unknown' && zoneData;

  const upgradeCost = zoneData ? getUpgradeCost(zoneData.level) : null;
  const canUpgrade = upgradeCost && zoneData && canAffordUpgrade(zoneData.resources, upgradeCost);

  // Get current scene info
  const currentActData = scenarioData.acts.find((a) => a.id === gameState.currentAct);
  const currentSceneData = scenarioData.acts
    .flatMap((a) => a.scenes)
    .find((s) => s.id === gameState.currentScene);
  const currentTask = getCurrentTask(gameState.currentAct, gameState.currentScene, roleData);

  return (
    <div className="min-h-screen flex flex-col p-4 pb-20">
      {/* Game Phase Indicator */}
      <div className="bg-gradient-to-r from-[#D4A017]/20 to-[#D4A017]/10 rounded-xl p-3 mb-4 border border-[#D4A017]/30">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[#D4A017] text-xs font-semibold uppercase tracking-wide">
            Акт {gameState.currentAct}: {currentActData?.title || ''}
          </div>
          {gameState.timer.running && (
            <div className="text-[#E0E1DD] font-mono text-sm bg-[#0D1B2A] px-2 py-1 rounded">
              {Math.floor(gameState.timer.remainingSec / 60)}:{String(gameState.timer.remainingSec % 60).padStart(2, '0')}
            </div>
          )}
        </div>
        <div className="text-[#E0E1DD] text-sm">
          {currentSceneData?.title || 'Сцена ' + gameState.currentScene}
        </div>
      </div>

      {/* Current Task */}
      <div className="bg-emerald-900/30 rounded-xl p-4 mb-4 border border-emerald-500/30">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{currentTask.icon}</span>
          <div>
            <div className="text-emerald-400 font-semibold mb-1">{currentTask.title}</div>
            <div className="text-[#E0E1DD] text-sm leading-relaxed">{currentTask.description}</div>
          </div>
        </div>
      </div>

      {/* Compact Header */}
      <div className="flex items-center justify-between bg-[#1B263B] rounded-xl p-3 mb-4">
        <div>
          <h1 className="text-lg font-bold text-[#D4A017]">{role.name}</h1>
          <p className="text-[#778DA9] text-xs">{roleData.archetype} • {ZONE_NAMES_RU[zone as keyof typeof ZONE_NAMES_RU] || zone}</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setShowHowToPlay(!showHowToPlay)}
            className="text-[#778DA9] hover:text-[#E0E1DD] p-2"
            title="Быстрая подсказка"
          >
            <span className="text-lg">💡</span>
          </button>
          <button
            onClick={onShowRoleInfo}
            className="text-[#778DA9] hover:text-[#E0E1DD] p-2"
            title="Полная инструкция"
          >
            <span className="text-lg">📋</span>
          </button>
        </div>
      </div>

      {/* How to Play (expandable) */}
      {showHowToPlay && (
        <div className="bg-[#1B263B] rounded-xl p-4 mb-4 border border-[#415A77]/30">
          <div className="text-[#D4A017] text-xs uppercase tracking-wide mb-2">Как играть вашу роль</div>
          <p className="text-[#E0E1DD] text-sm leading-relaxed mb-3">{roleData.howToPlay}</p>
          {roleData.relationships && (
            <>
              <div className="text-[#778DA9] text-xs uppercase tracking-wide mb-1 mt-3">Отношения</div>
              <p className="text-[#778DA9] text-sm">{roleData.relationships}</p>
            </>
          )}
        </div>
      )}

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
            {showContribute ? '▲ Свернуть' : '▼ Внести в зону'}
          </button>
        )}

        {/* Contribute buttons */}
        {showContribute && canContribute && (
          <div className="mt-3 pt-3 border-t border-[#415A77]/30">
            <div className="text-[#778DA9] text-xs mb-2">Внести в пул зоны:</div>
            <div className="grid grid-cols-4 gap-2">
              {resources.map((resource) => {
                const hasResource = role.resources[resource] > 0;
                const amount = Math.min(contributeAmount[resource], role.resources[resource]);
                return (
                  <div key={resource} className="space-y-1">
                    <button
                      onClick={() => onContribute(zone, resource, amount)}
                      disabled={!hasResource}
                      className={`w-full py-2 rounded-lg text-center transition-colors ${
                        hasResource
                          ? 'bg-emerald-900/50 hover:bg-emerald-800 active:scale-95 text-emerald-300'
                          : 'bg-[#415A77]/20 text-[#415A77] cursor-not-allowed'
                      }`}
                    >
                      <div className="text-lg">{RESOURCE_ICONS[resource]}</div>
                      <div className="text-xs">+{amount}</div>
                    </button>
                    {hasResource && (
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => setContributeAmount(prev => ({
                            ...prev,
                            [resource]: Math.max(1, prev[resource] - 1)
                          }))}
                          className="w-6 h-6 bg-[#415A77]/50 rounded text-xs"
                        >-</button>
                        <button
                          onClick={() => setContributeAmount(prev => ({
                            ...prev,
                            [resource]: Math.min(role.resources[resource], prev[resource] + 1)
                          }))}
                          className="w-6 h-6 bg-[#415A77]/50 rounded text-xs"
                        >+</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Progression System */}
      {isProgressionEnabled && playerStats && playerLevel !== undefined && playerExperience !== undefined && (
        <div className="bg-gradient-to-r from-[#1B263B] to-[#0D1B2A] border border-purple-500/30 rounded-xl p-4 mb-4">
          <h3 className="text-purple-400 text-xs uppercase tracking-wide mb-3">
            Прогрессия
          </h3>

          {/* Experience Bar */}
          <ExperienceBar
            totalXP={playerExperience}
            level={playerLevel}
            showDetails={true}
            className="mb-3"
          />

          {/* Compact Stats Display */}
          <StatsDisplay
            stats={playerStats}
            compact={true}
            className="mt-3"
          />

          {/* XP Gain Notification */}
          {lastXPGain && !lastLevelUp && (
            <div className="mt-3 p-2 bg-emerald-900/30 border border-emerald-500/30 rounded-lg text-center">
              <div className="text-emerald-400 text-sm font-medium">
                +{lastXPGain.amount} XP
              </div>
            </div>
          )}

          {/* Level Up Notification */}
          {lastLevelUp && (
            <div className="mt-3 p-3 bg-[#D4A017]/20 border border-[#D4A017]/50 rounded-lg text-center animate-pulse">
              <div className="text-[#D4A017] font-bold">Новый уровень!</div>
              <div className="text-[#E0E1DD] text-sm">Уровень {lastLevelUp.newLevel}</div>
              {lastLevelUp.availablePoints > 0 && (
                <div className="text-purple-400 text-xs mt-1">
                  +{lastLevelUp.availablePoints} очков развития
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Zone Info with Upgrade Progress */}
      {zoneData && (
        <div className="bg-[#1B263B] rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[#778DA9] text-xs uppercase tracking-wide">
              Зона: {ZONE_NAMES_RU[zone as keyof typeof ZONE_NAMES_RU]}
            </h3>
            <span className="bg-[#D4A017]/20 text-[#D4A017] text-xs px-2 py-1 rounded">
              Уровень {zoneData.level}
            </span>
          </div>

          {/* Zone Resources */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {resources.map((resource) => (
              <div key={resource} className="text-center">
                <div className="text-lg">{RESOURCE_ICONS[resource]}</div>
                <div className="text-[#E0E1DD] font-mono text-sm">
                  {zoneData.resources[resource]}
                </div>
              </div>
            ))}
          </div>

          {/* Upgrade Cost */}
          {upgradeCost ? (
            <div className="pt-3 border-t border-[#415A77]/30">
              <div className="text-[#778DA9] text-xs mb-2">
                Для улучшения до уровня {zoneData.level + 1}:
              </div>
              <div className="grid grid-cols-4 gap-2">
                {resources.map((resource) => {
                  const current = zoneData.resources[resource];
                  const needed = upgradeCost[resource];
                  const hasEnough = current >= needed;
                  return (
                    <div key={resource} className="text-center">
                      <div className="text-sm">{RESOURCE_ICONS[resource]}</div>
                      <div className={`font-mono text-xs ${hasEnough ? 'text-emerald-400' : 'text-red-400'}`}>
                        {current}/{needed}
                      </div>
                    </div>
                  );
                })}
              </div>
              {canUpgrade && (
                <div className="mt-2 text-center text-emerald-400 text-xs">
                  Достаточно ресурсов для улучшения!
                </div>
              )}
            </div>
          ) : (
            <div className="pt-3 border-t border-[#415A77]/30 text-center text-emerald-400 text-xs">
              Максимальный уровень достигнут
            </div>
          )}
        </div>
      )}

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

// Role Info Modal - Full role instructions
interface RoleInfoModalProps {
  role: Role;
  roleData: GameRole;
  onClose: () => void;
}

// Special content for specific roles
const SPECIAL_ROLE_CONTENT: Record<number, { title: string; icon: string; content: string; note?: string }> = {
  // Historian (id 18) - has the message from the past
  18: {
    title: 'Послание из прошлого',
    icon: '📜',
    content: `"Если вы читаете это — значит, мы не справились. Город Рассвет просуществовал три года. Мы думали, что главное — ресурсы. Мы ошибались. Город умер не от голода. Он умер от недоверия. Когда каждый решил, что его правда — единственная. Не повторяйте нашу ошибку."`,
    note: 'Вы прочитаете это послание вслух в Акте 3, Сцена 7. До этого момента — только загадочные намёки.',
  },
  // Scout (id 11) - knows about the unknown zone
  11: {
    title: 'Ваше открытие',
    icon: '🔭',
    content: 'За пределами города вы нашли руины предыдущего поселения. Странные знаки на стенах. Следы поспешного бегства. И самое главное — вы видели КОГО-ТО в тумане. Кто-то ещё здесь.',
    note: 'В Акте 2, Сцена 6 вы расскажете группе о своей находке. До этого — только намёки: "Я видел кое-что странное..."',
  },
  // Stranger (id 20) - the founder
  20: {
    title: 'Ваша тайна',
    icon: '👁️',
    content: 'Вы создали этот проект. Вы собрали этих людей. Вы наблюдаете за ними. Они думают что вы один из них — но вы тот, кто всё это организовал.',
    note: 'В Акте 4, Сцена 11 вы раскроете себя. До этого — молчите и наблюдайте. Делайте заметки о людях.',
  },
  // Masha (id 19) - knows the truth about selection
  19: {
    title: 'Что вы знаете',
    icon: '💔',
    content: 'Эти люди думают, что они лучшие из лучших, отобранные для великой миссии. Но правда в том, что они здесь не потому что лучшие — а потому что единственные, кто согласился.',
    note: 'В Акте 4, Сцена 10 вы скажете эту правду. Это должно быть неожиданно.',
  },
};

// Resource explanation by zone
const ZONE_RESOURCE_GUIDE: Record<string, { priority: string[]; description: string }> = {
  center: {
    priority: ['knowledge', 'energy'],
    description: 'Центр управляет городом. Нужны знания для планирования и энергия для координации.',
  },
  residential: {
    priority: ['food', 'materials'],
    description: 'Жилая зона заботится о людях. Еда для питания, материалы для домов.',
  },
  industrial: {
    priority: ['energy', 'materials'],
    description: 'Промышленная зона производит. Энергия для станков, материалы для строительства.',
  },
  green: {
    priority: ['food', 'knowledge'],
    description: 'Зелёная зона выращивает. Еда — урожай, знания — агротехнологии.',
  },
};

function RoleInfoModal({ role, roleData, onClose }: RoleInfoModalProps) {
  const [activeTab, setActiveTab] = useState<'how' | 'moments' | 'relations' | 'special' | 'resources'>('how');
  const specialContent = SPECIAL_ROLE_CONTENT[roleData.id];
  const zoneGuide = ZONE_RESOURCE_GUIDE[roleData.zone];

  return (
    <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto">
      <div className="min-h-screen p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-[#D4A017]">{role.name}</h1>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-[#415A77] rounded-full flex items-center justify-center text-[#E0E1DD]"
          >
            ✕
          </button>
        </div>

        {/* Mission */}
        <div className="bg-emerald-900/30 rounded-xl p-4 mb-4 border border-emerald-500/30">
          <div className="flex items-center gap-2 text-emerald-400 text-xs uppercase tracking-wide mb-2">
            <span>🎯</span>
            <span>Ваша миссия</span>
          </div>
          <p className="text-[#E0E1DD]">{roleData.publicMission}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('how')}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
              activeTab === 'how' ? 'bg-[#D4A017] text-[#0D1B2A]' : 'bg-[#1B263B] text-[#778DA9]'
            }`}
          >
            Как играть
          </button>
          <button
            onClick={() => setActiveTab('moments')}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
              activeTab === 'moments' ? 'bg-[#D4A017] text-[#0D1B2A]' : 'bg-[#1B263B] text-[#778DA9]'
            }`}
          >
            Ключевые моменты
          </button>
          <button
            onClick={() => setActiveTab('relations')}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
              activeTab === 'relations' ? 'bg-[#D4A017] text-[#0D1B2A]' : 'bg-[#1B263B] text-[#778DA9]'
            }`}
          >
            Отношения
          </button>
          {specialContent && (
            <button
              onClick={() => setActiveTab('special')}
              className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
                activeTab === 'special' ? 'bg-purple-600 text-white' : 'bg-purple-900/30 text-purple-300'
              }`}
            >
              {specialContent.icon} Особое
            </button>
          )}
          <button
            onClick={() => setActiveTab('resources')}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
              activeTab === 'resources' ? 'bg-[#D4A017] text-[#0D1B2A]' : 'bg-[#1B263B] text-[#778DA9]'
            }`}
          >
            Ресурсы
          </button>
        </div>

        {/* Tab content */}
        <div className="space-y-4">
          {activeTab === 'how' && (
            <div className="bg-[#1B263B] rounded-xl p-4">
              <p className="text-[#E0E1DD] leading-relaxed">{roleData.howToPlay || 'Играйте свою роль согласно миссии.'}</p>
            </div>
          )}

          {activeTab === 'moments' && (
            <div className="space-y-3">
              {roleData.keyMoments?.map((moment, i) => (
                <div key={i} className="bg-[#1B263B] rounded-xl p-4 flex items-start gap-3">
                  <span className="text-[#D4A017] font-bold text-lg">{i + 1}</span>
                  <p className="text-[#E0E1DD]">{moment}</p>
                </div>
              )) || (
                <div className="bg-[#1B263B] rounded-xl p-4 text-[#778DA9]">
                  Следуйте за ходом игры и реагируйте на события.
                </div>
              )}
            </div>
          )}

          {activeTab === 'relations' && (
            <div className="bg-[#1B263B] rounded-xl p-4">
              <p className="text-[#E0E1DD] leading-relaxed">{roleData.relationships || 'Взаимодействуйте со всеми участниками.'}</p>
            </div>
          )}

          {activeTab === 'special' && specialContent && (
            <div className="bg-purple-900/30 rounded-xl p-4 border border-purple-500/30">
              <div className="flex items-center gap-2 text-purple-300 text-sm uppercase tracking-wide mb-3">
                <span>{specialContent.icon}</span>
                <span>{specialContent.title}</span>
              </div>
              <p className="text-[#E0E1DD] leading-relaxed mb-4 whitespace-pre-line">
                {specialContent.content}
              </p>
              {specialContent.note && (
                <div className="bg-[#0D1B2A] rounded-lg p-3 border border-purple-500/20">
                  <div className="text-amber-400 text-xs uppercase mb-1">Важно</div>
                  <p className="text-[#778DA9] text-sm">{specialContent.note}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'resources' && (
            <div className="space-y-4">
              {/* Zone-specific guide */}
              {zoneGuide && (
                <div className="bg-[#1B263B] rounded-xl p-4">
                  <div className="text-[#D4A017] text-sm font-semibold mb-2">
                    Ваша зона: {ZONE_NAMES_RU[roleData.zone as keyof typeof ZONE_NAMES_RU]}
                  </div>
                  <p className="text-[#E0E1DD] mb-3">{zoneGuide.description}</p>
                  <div className="text-[#778DA9] text-sm">
                    Приоритетные ресурсы: {zoneGuide.priority.map(r => RESOURCE_ICONS[r as ResourceName]).join(' ')}
                  </div>
                </div>
              )}

              {/* General resource guide */}
              <div className="bg-[#1B263B] rounded-xl p-4">
                <div className="text-[#778DA9] text-sm uppercase tracking-wide mb-3">Как работают ресурсы</div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{RESOURCE_ICONS.energy}</span>
                    <div>
                      <div className="text-[#E0E1DD] font-medium">Энергия</div>
                      <div className="text-[#778DA9]">Питание, освещение, производство. Нужна всем зонам.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{RESOURCE_ICONS.materials}</span>
                    <div>
                      <div className="text-[#E0E1DD] font-medium">Материалы</div>
                      <div className="text-[#778DA9]">Строительство, ремонт, инфраструктура.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{RESOURCE_ICONS.food}</span>
                    <div>
                      <div className="text-[#E0E1DD] font-medium">Еда</div>
                      <div className="text-[#778DA9]">Питание жителей, запасы, медицина.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{RESOURCE_ICONS.knowledge}</span>
                    <div>
                      <div className="text-[#E0E1DD] font-medium">Знания</div>
                      <div className="text-[#778DA9]">Образование, технологии, планирование.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* How to contribute */}
              <div className="bg-emerald-900/20 rounded-xl p-4 border border-emerald-500/30">
                <div className="text-emerald-400 text-sm font-semibold mb-2">Как вносить ресурсы</div>
                <ol className="text-[#E0E1DD] text-sm space-y-2">
                  <li>1. На главном экране найдите "Мои ресурсы"</li>
                  <li>2. Нажмите "Внести в зону"</li>
                  <li>3. Выберите количество (+ и -)</li>
                  <li>4. Нажмите на иконку ресурса</li>
                </ol>
                <p className="text-[#778DA9] text-xs mt-3">
                  Ресурсы идут в пул вашей зоны. Когда накопится достаточно — зона улучшится.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Close button at bottom */}
        <div className="mt-6 pb-4">
          <button
            onClick={onClose}
            className="w-full py-4 bg-[#415A77] hover:bg-[#778DA9] rounded-xl font-semibold transition-colors"
          >
            Вернуться в игру
          </button>
        </div>
      </div>
    </div>
  );
}

