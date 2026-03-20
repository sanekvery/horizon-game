import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGameState } from '../hooks/useGameState';
import { authApi } from '../services/auth-api';
import scenarioData from '../data/scenario.json';
import crisesData from '../data/crises.json';
import rolesData from '../data/roles.json';
import eventsData from '../data/events.json';
import { getUpgradeCost, canAffordUpgrade } from '../data/zone-upgrade-costs';
import type { GameState, ResourceName, ZoneName } from '../types/game-state';
import { RESOURCE_ICONS } from '../types/game-state';
import type { Crisis, GameRole, GameEvent } from '../types/game-data';

const GAME_PHASE_NAMES = {
  setup: 'Настройка',
  distribution: 'Распределение',
  playing: 'Игра',
  finished: 'Завершена',
} as const;

type Page = 'scenario' | 'resources' | 'zones' | 'votes' | 'participants' | 'promises' | 'events' | 'settings';

const RESOURCE_NAMES: Record<ResourceName, string> = {
  energy: 'Энергия',
  materials: 'Материалы',
  food: 'Еда',
  knowledge: 'Знания',
};

const ZONE_NAMES = {
  center: 'Центр',
  residential: 'Жилой квартал',
  industrial: 'Промзона',
  green: 'Зелёный пояс',
} as const;

type EditableZone = keyof typeof ZONE_NAMES;

export function AdminDashboard() {
  const gameState = useGameState();
  const {
    state,
    isConnected,
    error,
    isAdmin,
    authenticateAdmin,
  } = gameState;

  const [password, setPassword] = useState('');
  const [currentPage, setCurrentPage] = useState<Page>('scenario');

  // Password gate
  if (!isAdmin) {
    return (
      <PasswordGate
        password={password}
        setPassword={setPassword}
        onSubmit={() => authenticateAdmin(password)}
        error={error}
        isConnected={isConnected}
      />
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <div className="text-[#778DA9] text-xl animate-pulse">Загрузка данных...</div>
      </div>
    );
  }

  const currentAct = scenarioData.acts.find((a) => a.id === state.currentAct);

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex">
      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        currentAct={currentAct}
        state={state}
        gameState={gameState}
      />

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {currentPage === 'scenario' && <ScenarioPage state={state} gameState={gameState} />}
        {currentPage === 'zones' && <ZonesPage state={state} gameState={gameState} />}
        {currentPage === 'resources' && <ResourcesPage state={state} gameState={gameState} />}
        {currentPage === 'votes' && <VotesPage state={state} gameState={gameState} />}
        {currentPage === 'participants' && <ParticipantsPage state={state} gameState={gameState} />}
        {currentPage === 'promises' && <PromisesPage state={state} />}
        {currentPage === 'events' && <EventsPage state={state} gameState={gameState} />}
        {currentPage === 'settings' && <SettingsPage state={state} gameState={gameState} />}
      </main>
    </div>
  );
}

// ============ PASSWORD GATE ============

interface PasswordGateProps {
  password: string;
  setPassword: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
  isConnected: boolean;
}

function PasswordGate({ password, setPassword, onSubmit, error, isConnected }: PasswordGateProps) {
  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center p-4">
      <div className="bg-[#1B263B] rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#E0E1DD] mb-2">Проект Горизонт</h1>
          <p className="text-[#778DA9]">Панель фасилитатора</p>
        </div>

        {!isConnected && (
          <div className="bg-amber-900/30 border border-amber-500/50 text-amber-300 px-4 py-3 rounded-lg mb-4 text-center">
            Подключение к серверу...
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <label className="block text-[#778DA9] text-sm mb-2">
            Пароль фасилитатора
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Введите пароль"
            className="w-full bg-[#0D1B2A] border border-[#415A77] rounded-lg px-4 py-3 text-[#E0E1DD] placeholder-[#415A77] focus:outline-none focus:border-[#778DA9] mb-6"
            autoFocus
          />
          <button
            type="submit"
            disabled={!isConnected}
            className="w-full bg-[#415A77] hover:bg-[#778DA9] disabled:opacity-50 disabled:cursor-not-allowed text-[#E0E1DD] font-semibold py-3 rounded-lg transition-colors"
          >
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}

// ============ SIDEBAR ============

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (p: Page) => void;
  currentAct: typeof scenarioData.acts[0] | undefined;
  state: GameState;
  gameState: ReturnType<typeof useGameState>;
}

function Sidebar({ currentPage, setCurrentPage, currentAct, state, gameState }: SidebarProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionCode = searchParams.get('session');
  const isLoggedIn = authApi.isAuthenticated();

  const navItems: { id: Page; label: string; icon: string }[] = [
    { id: 'scenario', label: 'Сценарий', icon: '📋' },
    { id: 'zones', label: 'Зоны карты', icon: '🗺️' },
    { id: 'resources', label: 'Ресурсы', icon: '📦' },
    { id: 'votes', label: 'Голосования', icon: '🗳️' },
    { id: 'participants', label: 'Участники', icon: '👥' },
    { id: 'promises', label: 'Обещания', icon: '✨' },
    { id: 'events', label: 'События', icon: '🎲' },
    { id: 'settings', label: 'Настройки', icon: '⚙️' },
  ];

  const connectedCount = state.roles.filter((r) => r.connected).length;
  const activeRoles = state.roles.filter((r) => r.isActive);
  const claimedCount = activeRoles.filter((r) => r.claimedBy !== null).length;

  const handleEmergencyPause = () => {
    if (confirm('Остановить игру? Таймер будет приостановлен.')) {
      gameState.stopTimer();
    }
  };

  return (
    <aside className="w-64 bg-[#1B263B] border-r border-[#415A77]/30 flex flex-col">
      {/* Logo & Session Info */}
      <div className="p-6 border-b border-[#415A77]/30">
        {/* Back to dashboard link */}
        {isLoggedIn && (
          <button
            onClick={() => navigate('/facilitator')}
            className="flex items-center gap-1 text-[#778DA9] hover:text-[#E0E1DD] text-sm mb-3 transition-colors"
          >
            <span>←</span>
            <span>Мои игры</span>
          </button>
        )}

        <h1 className="text-xl font-bold text-[#E0E1DD]">Проект Горизонт</h1>
        <p className="text-[#778DA9] text-sm mt-1">Панель управления</p>

        {/* Session Code */}
        {sessionCode && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[#778DA9] text-xs">Код:</span>
            <span className="px-2 py-0.5 bg-[#D4A017]/20 text-[#D4A017] rounded font-mono text-sm">
              {sessionCode}
            </span>
          </div>
        )}

        {/* Game Phase Badge */}
        <div className="mt-3 flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            state.settings.gamePhase === 'playing' ? 'bg-green-900/50 text-green-400' :
            state.settings.gamePhase === 'distribution' ? 'bg-yellow-900/50 text-yellow-400' :
            state.settings.gamePhase === 'finished' ? 'bg-gray-700 text-gray-400' :
            'bg-blue-900/50 text-blue-400'
          }`}>
            {GAME_PHASE_NAMES[state.settings.gamePhase]}
          </span>
          <span className="text-[#778DA9] text-xs">
            {state.settings.playerCount} игроков
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-[#415A77]/30 space-y-2">
        <button
          onClick={() => navigate('/setup')}
          className="w-full flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#D4A017] to-[#B8860B] text-[#0D1B2A] rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          <span>🎮</span>
          <span>Настройка игры</span>
        </button>
        <button
          onClick={() => navigate('/qr')}
          className="w-full flex items-center gap-2 px-4 py-2 bg-[#415A77] hover:bg-[#778DA9] text-[#E0E1DD] rounded-lg transition-colors"
        >
          <span>📱</span>
          <span>QR-коды</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
              currentPage === item.id
                ? 'bg-[#415A77] text-[#E0E1DD]'
                : 'text-[#778DA9] hover:bg-[#415A77]/30 hover:text-[#E0E1DD]'
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Status */}
      <div className="p-4 border-t border-[#415A77]/30 space-y-3">
        {/* Current act */}
        <div className="bg-[#0D1B2A] rounded-lg p-3">
          <div className="text-[#778DA9] text-xs uppercase tracking-wide">Текущий акт</div>
          <div className="text-[#E0E1DD] font-semibold mt-1">
            Акт {state.currentAct}: {currentAct?.title || '—'}
          </div>
          <div className="text-[#415A77] text-xs mt-1">
            Сцена {state.currentScene}
          </div>
        </div>

        {/* Role distribution status */}
        {state.settings.gamePhase === 'distribution' && (
          <div className="bg-[#0D1B2A] rounded-lg p-3">
            <div className="text-[#778DA9] text-xs uppercase tracking-wide">Распределение</div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[#E0E1DD]">Занято ролей:</span>
              <span className={`font-semibold ${claimedCount === activeRoles.length ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {claimedCount}/{activeRoles.length}
              </span>
            </div>
            <div className="mt-2 bg-[#415A77]/30 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#D4A017] to-[#B8860B] transition-all"
                style={{ width: `${(claimedCount / activeRoles.length) * 100}%` }}
              />
            </div>
            {claimedCount === activeRoles.length && (
              <button
                onClick={() => gameState.startGame()}
                className="w-full mt-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
              >
                Начать игру
              </button>
            )}
          </div>
        )}

        {/* Connection status */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#778DA9]">Онлайн:</span>
          <span className="text-emerald-400 font-semibold">{connectedCount}/{activeRoles.length}</span>
        </div>

        {/* Timer status */}
        {state.timer.running && (
          <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg p-2 text-center">
            <div className="text-amber-400 text-2xl font-mono font-bold">
              {formatTime(state.timer.remainingSec)}
            </div>
          </div>
        )}
      </div>

      {/* Emergency button */}
      <div className="p-4 border-t border-[#415A77]/30">
        <button
          onClick={handleEmergencyPause}
          className="w-full bg-red-900/50 hover:bg-red-800 border border-red-500/50 text-red-300 font-semibold py-3 rounded-lg transition-colors"
        >
          ⚠️ Экстренная пауза
        </button>
      </div>
    </aside>
  );
}

// ============ SCENARIO PAGE ============

interface PageProps {
  state: GameState;
  gameState: ReturnType<typeof useGameState>;
}

function ScenarioPage({ state, gameState }: PageProps) {
  const [selectedAct, setSelectedAct] = useState<number>(state.currentAct);

  const currentActData = scenarioData.acts.find((a) => a.id === selectedAct);
  const currentSceneData = scenarioData.acts
    .flatMap((a) => a.scenes)
    .find((s) => s.id === state.currentScene);

  const handleGoToScene = (actId: number, sceneId: number) => {
    gameState.setAct(actId as 1 | 2 | 3 | 4 | 5);
    gameState.setScene(sceneId);
    gameState.stopTimer();
  };

  const handleStartScene = (sceneId: number, duration: number) => {
    const scene = scenarioData.acts.flatMap((a) => a.scenes).find((s) => s.id === sceneId);
    if (scene) {
      const act = scenarioData.acts.find((a) => a.scenes.some((s) => s.id === sceneId));
      if (act) {
        gameState.setAct(act.id as 1 | 2 | 3 | 4 | 5);
      }
      gameState.setScene(sceneId);
      gameState.startTimer(duration);
    }
  };

  const handleEndScene = () => {
    gameState.stopTimer();
  };

  const handleAddTime = (seconds: number) => {
    if (state.timer.running) {
      gameState.startTimer(state.timer.remainingSec + seconds);
    }
  };

  const handleResumeTimer = () => {
    if (!state.timer.running && state.timer.remainingSec > 0) {
      gameState.startTimer(state.timer.remainingSec);
    }
  };

  return (
    <div className="p-6">
      {/* Quick Navigation */}
      <div className="bg-gradient-to-r from-[#1B263B] to-[#0D1B2A] rounded-xl p-4 mb-6 border border-[#415A77]/30">
        <div className="text-[#778DA9] text-sm mb-3">Быстрый переход</div>
        <div className="flex flex-wrap gap-2">
          {scenarioData.acts.map((act) => (
            <div key={act.id} className="flex gap-1">
              {act.scenes.map((scene) => {
                const isActive = state.currentScene === scene.id;
                const isPast = state.currentScene > scene.id;
                return (
                  <button
                    key={scene.id}
                    onClick={() => handleGoToScene(act.id, scene.id)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                        : isPast
                        ? 'bg-[#415A77]/50 text-[#778DA9] hover:bg-[#415A77]'
                        : 'bg-[#1B263B] text-[#778DA9] hover:bg-[#415A77] hover:text-white'
                    }`}
                    title={`${act.title} — ${scene.title}`}
                  >
                    {act.id}.{scene.id - (act.id === 1 ? 0 : act.id === 2 ? 2 : act.id === 3 ? 5 : act.id === 4 ? 8 : 11)}
                  </button>
                );
              })}
              {act.id < 5 && <div className="w-px bg-[#415A77]/30 mx-1" />}
            </div>
          ))}
        </div>
      </div>

      {/* Global timer control */}
      <div className="bg-[#1B263B] rounded-xl p-4 mb-6 flex items-center justify-between">
        <div>
          <div className="text-[#778DA9] text-sm">Текущая сцена</div>
          <div className="text-[#E0E1DD] text-xl font-semibold">
            {currentSceneData?.title || 'Не выбрана'}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {state.timer.running ? (
            <>
              <div className={`text-4xl font-mono font-bold ${
                state.timer.remainingSec < 60 ? 'text-red-400 animate-pulse' : 'text-[#E0E1DD]'
              }`}>
                {formatTime(state.timer.remainingSec)}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => gameState.stopTimer()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg"
                >
                  Пауза
                </button>
                <button
                  onClick={() => handleAddTime(60)}
                  className="px-4 py-2 bg-[#415A77] hover:bg-[#778DA9] text-white rounded-lg"
                >
                  +1 мин
                </button>
                <button
                  onClick={() => handleAddTime(300)}
                  className="px-4 py-2 bg-[#415A77] hover:bg-[#778DA9] text-white rounded-lg"
                >
                  +5 мин
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <div className="text-2xl font-mono text-[#415A77]">
                {state.timer.remainingSec > 0 ? formatTime(state.timer.remainingSec) : '--:--'}
              </div>
              {state.timer.remainingSec > 0 && (
                <button
                  onClick={handleResumeTimer}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                >
                  Продолжить
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Act tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {scenarioData.acts.map((act) => (
          <button
            key={act.id}
            onClick={() => setSelectedAct(act.id)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              selectedAct === act.id
                ? 'bg-[#415A77] text-[#E0E1DD]'
                : state.currentAct === act.id
                ? 'bg-emerald-900/30 border border-emerald-500/50 text-emerald-400'
                : 'bg-[#1B263B] text-[#778DA9] hover:bg-[#415A77]/50'
            }`}
          >
            Акт {toRoman(act.id)}: {act.title}
          </button>
        ))}
      </div>

      {/* Scenes */}
      <div className="grid gap-4">
        {currentActData?.scenes.map((scene) => {
          const isActive = state.currentScene === scene.id;
          const isPast = state.currentScene > scene.id;

          return (
            <div
              key={scene.id}
              className={`bg-[#1B263B] rounded-xl p-5 border-2 transition-colors ${
                isActive
                  ? 'border-emerald-500/50'
                  : isPast
                  ? 'border-[#415A77]/30 opacity-60'
                  : 'border-transparent'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-[#E0E1DD] text-lg font-semibold">{scene.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : isPast
                        ? 'bg-[#415A77]/30 text-[#778DA9]'
                        : 'bg-[#0D1B2A] text-[#778DA9]'
                    }`}>
                      {isActive ? 'Идёт' : isPast ? 'Завершена' : 'Ожидание'}
                    </span>
                  </div>
                  <p className="text-[#778DA9] mt-1">{scene.description}</p>
                  <div className="text-[#415A77] text-sm mt-2">
                    Длительность: {Math.floor(scene.duration / 60)} мин {scene.duration % 60} сек
                  </div>
                </div>

                <div className="flex gap-2">
                  {/* Always show "Go to" button for past scenes */}
                  {isPast && (
                    <button
                      onClick={() => handleGoToScene(selectedAct, scene.id)}
                      className="px-4 py-2 bg-[#415A77] hover:bg-[#778DA9] text-white rounded-lg transition-colors"
                    >
                      Вернуться
                    </button>
                  )}
                  {!isActive && !isPast && (
                    <button
                      onClick={() => handleStartScene(scene.id, scene.duration)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                    >
                      Запустить
                    </button>
                  )}
                  {isActive && (
                    <>
                      <button
                        onClick={handleEndScene}
                        className="px-4 py-2 bg-[#415A77] hover:bg-[#778DA9] text-white rounded-lg transition-colors"
                      >
                        Завершить
                      </button>
                      {!state.timer.running && (
                        <button
                          onClick={() => handleStartScene(scene.id, scene.duration)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                        >
                          Перезапустить
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Facilitator guidance - expanded for active scene */}
              {isActive && (
                <FacilitatorGuide scene={scene} />
              )}

              {/* Special event buttons */}
              <SpecialEventButtons
                scene={scene}
                state={state}
                gameState={gameState}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Facilitator guidance component
interface SceneData {
  id: number;
  title: string;
  duration: number;
  description: string;
  facilitatorScript?: string;
  objectives?: string[];
  tips?: string[];
  sampleText?: string;
}

function FacilitatorGuide({ scene }: { scene: SceneData }) {
  const [isScriptExpanded, setIsScriptExpanded] = useState(true);

  return (
    <div className="mt-4 space-y-4">
      {/* What to say - main script */}
      {scene.facilitatorScript && (
        <div className="bg-gradient-to-r from-emerald-900/30 to-emerald-800/20 rounded-lg p-4 border border-emerald-500/30">
          <button
            onClick={() => setIsScriptExpanded(!isScriptExpanded)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎤</span>
              <span className="text-emerald-400 font-semibold">Что сказать</span>
            </div>
            <span className="text-emerald-400">{isScriptExpanded ? '▼' : '▶'}</span>
          </button>
          {isScriptExpanded && (
            <div className="mt-3 text-[#E0E1DD] text-lg leading-relaxed whitespace-pre-line border-l-4 border-emerald-500/50 pl-4">
              {scene.facilitatorScript}
            </div>
          )}
        </div>
      )}

      {/* Objectives - what to achieve */}
      {scene.objectives && scene.objectives.length > 0 && (
        <div className="bg-[#0D1B2A] rounded-lg p-4 border border-[#415A77]/30">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🎯</span>
            <span className="text-[#D4A017] font-semibold">Цели сцены</span>
          </div>
          <ul className="space-y-2">
            {scene.objectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2 text-[#E0E1DD]">
                <span className="text-[#D4A017] mt-1">•</span>
                <span>{obj}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tips - what to pay attention to */}
      {scene.tips && scene.tips.length > 0 && (
        <div className="bg-amber-900/20 rounded-lg p-4 border border-amber-500/30">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💡</span>
            <span className="text-amber-400 font-semibold">На что обратить внимание</span>
          </div>
          <ul className="space-y-2">
            {scene.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-[#E0E1DD]">
                <span className="text-amber-400 mt-1">→</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sample text - if needed */}
      {scene.sampleText && (
        <div className="bg-indigo-900/20 rounded-lg p-4 border border-indigo-500/30">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📜</span>
            <span className="text-indigo-400 font-semibold">Пример текста</span>
          </div>
          <div className="text-[#E0E1DD] italic whitespace-pre-line">
            "{scene.sampleText}"
          </div>
        </div>
      )}
    </div>
  );
}

// Special events for specific scenes
interface SpecialEventButtonsProps {
  scene: { id: number; title: string };
  state: GameState;
  gameState: ReturnType<typeof useGameState>;
}

function SpecialEventButtons({ scene, state, gameState }: SpecialEventButtonsProps) {
  const [activeCrisis, setActiveCrisis] = useState<number | null>(null);

  // Act II Scene 6: Reveal unknown zone
  if (scene.id === 6) {
    return (
      <div className="mt-4 pt-4 border-t border-[#415A77]/30">
        <button
          onClick={() => gameState.revealUnknown()}
          disabled={state.zones.unknown.revealed}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {state.zones.unknown.revealed ? '✓ Зона раскрыта' : '🔮 Раскрыть Неизведанную зону'}
        </button>
      </div>
    );
  }

  // Act III Scene 7: Show message
  if (scene.id === 7) {
    return (
      <div className="mt-4 pt-4 border-t border-[#415A77]/30">
        <button
          onClick={() => gameState.revealFog()}
          disabled={state.fogRevealed}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {state.fogRevealed ? '✓ Послание показано' : '📜 Показать послание'}
        </button>
      </div>
    );
  }

  // Act III Scene 8: Launch crises
  if (scene.id === 8) {
    return (
      <div className="mt-4 pt-4 border-t border-[#415A77]/30">
        <div className="text-[#778DA9] text-sm mb-2">Запустить кризис:</div>
        <div className="flex flex-wrap gap-2">
          {(crisesData as Crisis[]).map((crisis) => (
            <button
              key={crisis.id}
              onClick={() => {
                setActiveCrisis(crisis.id);
                gameState.createVote(crisis.question, crisis.options);
              }}
              className={`px-3 py-2 rounded-lg transition-colors ${
                activeCrisis === crisis.id
                  ? 'bg-amber-600 text-white'
                  : 'bg-[#415A77] hover:bg-[#778DA9] text-white'
              }`}
            >
              Кризис {crisis.id}: {crisis.title}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Act IV Scene 9: Light candles for secrets
  if (scene.id === 9) {
    return (
      <div className="mt-4 pt-4 border-t border-[#415A77]/30">
        <div className="text-[#778DA9] text-sm mb-2">Зажечь свечу (раскрытие секрета):</div>
        <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto">
          {(rolesData as GameRole[]).map((role) => {
            const stateRole = state.roles.find((r) => r.id === role.id);
            const isRevealed = stateRole?.secretRevealed;

            return (
              <button
                key={role.id}
                onClick={() => {
                  gameState.revealSecret(role.id);
                  gameState.lightCandle(role.id);
                }}
                disabled={isRevealed}
                className={`px-2 py-1 text-xs rounded transition-colors text-left ${
                  isRevealed
                    ? 'bg-amber-500/20 text-amber-400 cursor-not-allowed'
                    : 'bg-[#415A77] hover:bg-[#778DA9] text-white'
                }`}
                title={role.name}
              >
                {isRevealed ? '🕯️' : '○'} {role.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

// ============ ZONES PAGE ============

function ZonesPage({ state, gameState }: PageProps) {
  const zones = ['center', 'residential', 'industrial', 'green'] as const;
  const resources: ResourceName[] = ['energy', 'materials', 'food', 'knowledge'];

  const handleUpgradeZone = (zone: ZoneName) => {
    gameState.upgradeZone(zone);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-[#E0E1DD] mb-6">Управление зонами карты</h2>

      <div className="grid md:grid-cols-2 gap-6">
        {zones.map((zone) => {
          const zoneData = state.zones[zone];
          const level = zoneData.level;
          const zoneResources = zoneData.resources;
          const upgradeCost = getUpgradeCost(level);
          const canUpgrade = upgradeCost ? canAffordUpgrade(zoneResources, upgradeCost) : false;

          return (
            <div key={zone} className="bg-[#1B263B] rounded-xl p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-[#E0E1DD] text-lg font-semibold">{ZONE_NAMES[zone]}</h3>
                  <div className="text-[#778DA9] text-sm mt-1">
                    Уровень развития: {level}/5
                  </div>
                </div>
                <div className="text-3xl">
                  {zone === 'center' && '🏛️'}
                  {zone === 'residential' && '🏠'}
                  {zone === 'industrial' && '🏭'}
                  {zone === 'green' && '🌳'}
                </div>
              </div>

              {/* Level progress bar */}
              <div className="mb-4">
                <div className="flex gap-1 mb-2">
                  {[0, 1, 2, 3, 4, 5].map((l) => (
                    <div
                      key={l}
                      className={`flex-1 h-2 rounded ${
                        l <= level
                          ? zone === 'center' ? 'bg-amber-500'
                          : zone === 'residential' ? 'bg-blue-500'
                          : zone === 'industrial' ? 'bg-gray-500'
                          : 'bg-green-500'
                          : 'bg-[#415A77]/30'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-[#415A77]">
                  <span>0</span>
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                </div>
              </div>

              {/* Zone resources */}
              <div className="bg-[#0D1B2A] rounded-lg p-3 mb-4">
                <div className="text-[#778DA9] text-xs mb-2">Ресурсы в пуле зоны:</div>
                <div className="grid grid-cols-4 gap-2">
                  {resources.map((resource) => (
                    <div key={resource} className="text-center">
                      <div className="text-lg">{RESOURCE_ICONS[resource]}</div>
                      <div className="text-[#E0E1DD] font-mono font-bold">
                        {zoneResources[resource]}
                      </div>
                      <div className="text-[#415A77] text-xs">{RESOURCE_NAMES[resource]}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upgrade section */}
              {upgradeCost ? (
                <div className={`rounded-lg p-3 mb-4 ${canUpgrade ? 'bg-emerald-900/20 border border-emerald-500/30' : 'bg-[#0D1B2A]'}`}>
                  <div className="text-[#778DA9] text-xs mb-2">Для улучшения до ур. {level + 1} нужно:</div>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {resources.map((resource) => {
                      const needed = upgradeCost[resource];
                      const have = zoneResources[resource];
                      const enough = have >= needed;
                      return (
                        <div key={resource} className="text-center">
                          <div className="text-lg">{RESOURCE_ICONS[resource]}</div>
                          <div className={`font-mono text-sm ${enough ? 'text-emerald-400' : 'text-red-400'}`}>
                            {have}/{needed}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => handleUpgradeZone(zone)}
                    disabled={!canUpgrade}
                    className={`w-full py-2 rounded-lg transition-colors font-semibold ${
                      canUpgrade
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-[#415A77]/30 text-[#415A77] cursor-not-allowed'
                    }`}
                  >
                    {canUpgrade ? `Улучшить до уровня ${level + 1}` : 'Недостаточно ресурсов'}
                  </button>
                </div>
              ) : (
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3 mb-4 text-center">
                  <span className="text-amber-400 font-semibold">Максимальный уровень достигнут</span>
                </div>
              )}

              {/* Manual level controls */}
              <div className="border-t border-[#415A77]/30 pt-3">
                <div className="text-[#415A77] text-xs mb-2">Ручное управление уровнем:</div>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4, 5].map((l) => (
                    <button
                      key={l}
                      onClick={() => gameState.updateZoneLevel(zone, l)}
                      className={`flex-1 py-1 text-xs rounded transition-colors ${
                        level === l
                          ? 'bg-[#415A77] text-white'
                          : 'bg-[#0D1B2A] text-[#778DA9] hover:bg-[#415A77]/50'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Unknown zone */}
      <div className="bg-[#1B263B] rounded-xl p-5 mt-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-[#E0E1DD] text-lg font-semibold">Неизведанная территория</h3>
            <div className="text-[#778DA9] text-sm mt-1">
              {state.zones.unknown.revealed ? 'Руины Первого Горизонта раскрыты' : 'Скрыта туманом'}
            </div>
          </div>
          <button
            onClick={() => gameState.revealUnknown()}
            disabled={state.zones.unknown.revealed}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {state.zones.unknown.revealed ? '✓ Раскрыта' : '🔮 Раскрыть'}
          </button>
        </div>
      </div>

      {/* Fog control */}
      <div className="bg-[#1B263B] rounded-xl p-5 mt-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-[#E0E1DD] text-lg font-semibold">Послание из прошлого</h3>
            <div className="text-[#778DA9] text-sm mt-1">
              {state.fogRevealed ? 'Послание показано игрокам' : 'Послание скрыто'}
            </div>
          </div>
          <button
            onClick={() => gameState.revealFog()}
            disabled={state.fogRevealed}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {state.fogRevealed ? '✓ Показано' : '📜 Показать послание'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ RESOURCES PAGE ============

function ResourcesPage({ state, gameState }: PageProps) {
  const [exchangeLog, setExchangeLog] = useState<Array<{
    time: string;
    from: string;
    to: string;
    resource: string;
    amount: number;
  }>>([]);

  const [exchange, setExchange] = useState({
    from: 'center' as EditableZone,
    to: 'residential' as EditableZone,
    resource: 'energy' as ResourceName,
    amount: 5,
  });

  const zones = ['center', 'residential', 'industrial', 'green'] as const;
  const resources: ResourceName[] = ['energy', 'materials', 'food', 'knowledge'];

  const handleResourceChange = (zone: EditableZone, resource: ResourceName, delta: number) => {
    const currentValue = state.zones[zone].resources[resource];
    const newValue = Math.max(0, Math.min(100, currentValue + delta));
    gameState.updateZoneResource(zone, resource, newValue);
  };

  const handleExchange = () => {
    if (exchange.from === exchange.to) return;

    const fromValue = state.zones[exchange.from].resources[exchange.resource];
    const toValue = state.zones[exchange.to].resources[exchange.resource];

    if (fromValue >= exchange.amount) {
      gameState.updateZoneResource(exchange.from, exchange.resource, fromValue - exchange.amount);
      gameState.updateZoneResource(exchange.to, exchange.resource, toValue + exchange.amount);

      setExchangeLog((prev) => [
        {
          time: new Date().toLocaleTimeString('ru-RU'),
          from: ZONE_NAMES[exchange.from],
          to: ZONE_NAMES[exchange.to],
          resource: RESOURCE_NAMES[exchange.resource],
          amount: exchange.amount,
        },
        ...prev,
      ]);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-[#E0E1DD] mb-6">Управление ресурсами</h2>

      {/* Resource grid */}
      <div className="bg-[#1B263B] rounded-xl p-4 mb-6 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left text-[#778DA9] p-2">Зона</th>
              {resources.map((r) => (
                <th key={r} className="text-center text-[#778DA9] p-2">{RESOURCE_NAMES[r]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr key={zone} className="border-t border-[#415A77]/30">
                <td className="p-2 text-[#E0E1DD] font-medium">{ZONE_NAMES[zone]}</td>
                {resources.map((resource) => {
                  const value = state.zones[zone].resources[resource];
                  return (
                    <td key={resource} className="p-2">
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleResourceChange(zone, resource, -5)}
                            className="w-8 h-8 bg-red-900/50 hover:bg-red-800 text-red-300 rounded text-sm"
                          >
                            -5
                          </button>
                          <button
                            onClick={() => handleResourceChange(zone, resource, -1)}
                            className="w-8 h-8 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded text-sm"
                          >
                            -1
                          </button>
                        </div>
                        <div className="w-12 text-center text-[#E0E1DD] font-mono font-bold">
                          {value}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleResourceChange(zone, resource, 1)}
                            className="w-8 h-8 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-300 rounded text-sm"
                          >
                            +1
                          </button>
                          <button
                            onClick={() => handleResourceChange(zone, resource, 5)}
                            className="w-8 h-8 bg-emerald-900/50 hover:bg-emerald-800 text-emerald-300 rounded text-sm"
                          >
                            +5
                          </button>
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Exchange section */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[#1B263B] rounded-xl p-4">
          <h3 className="text-[#E0E1DD] font-semibold mb-4">Обмен ресурсами</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[#778DA9] text-sm block mb-1">Из зоны</label>
                <select
                  value={exchange.from}
                  onChange={(e) => setExchange({ ...exchange, from: e.target.value as EditableZone })}
                  className="w-full bg-[#0D1B2A] border border-[#415A77] rounded-lg px-3 py-2 text-[#E0E1DD]"
                >
                  {zones.map((z) => (
                    <option key={z} value={z}>{ZONE_NAMES[z]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[#778DA9] text-sm block mb-1">В зону</label>
                <select
                  value={exchange.to}
                  onChange={(e) => setExchange({ ...exchange, to: e.target.value as EditableZone })}
                  className="w-full bg-[#0D1B2A] border border-[#415A77] rounded-lg px-3 py-2 text-[#E0E1DD]"
                >
                  {zones.map((z) => (
                    <option key={z} value={z}>{ZONE_NAMES[z]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[#778DA9] text-sm block mb-1">Ресурс</label>
                <select
                  value={exchange.resource}
                  onChange={(e) => setExchange({ ...exchange, resource: e.target.value as ResourceName })}
                  className="w-full bg-[#0D1B2A] border border-[#415A77] rounded-lg px-3 py-2 text-[#E0E1DD]"
                >
                  {resources.map((r) => (
                    <option key={r} value={r}>{RESOURCE_NAMES[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[#778DA9] text-sm block mb-1">Количество</label>
                <input
                  type="number"
                  value={exchange.amount}
                  onChange={(e) => setExchange({ ...exchange, amount: parseInt(e.target.value) || 0 })}
                  min="1"
                  max="100"
                  className="w-full bg-[#0D1B2A] border border-[#415A77] rounded-lg px-3 py-2 text-[#E0E1DD]"
                />
              </div>
            </div>
            <button
              onClick={handleExchange}
              disabled={exchange.from === exchange.to}
              className="w-full bg-[#415A77] hover:bg-[#778DA9] disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg transition-colors"
            >
              Выполнить обмен
            </button>
          </div>
        </div>

        {/* Exchange log */}
        <div className="bg-[#1B263B] rounded-xl p-4">
          <h3 className="text-[#E0E1DD] font-semibold mb-4">Журнал обменов</h3>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {exchangeLog.length === 0 ? (
              <div className="text-[#415A77] text-center py-4">Нет записей</div>
            ) : (
              exchangeLog.map((log, i) => (
                <div key={i} className="bg-[#0D1B2A] rounded-lg p-2 text-sm">
                  <span className="text-[#415A77]">{log.time}</span>
                  <span className="text-[#E0E1DD] ml-2">
                    {log.from} → {log.to}: {log.amount} {log.resource}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ VOTES PAGE ============

function VotesPage({ state, gameState }: PageProps) {
  const [newQuestion, setNewQuestion] = useState('');
  const [newOptions, setNewOptions] = useState(['', '']);

  const handleCreateVote = () => {
    const validOptions = newOptions.filter((o) => o.trim());
    if (newQuestion.trim() && validOptions.length >= 2) {
      gameState.createVote(newQuestion, validOptions);
      setNewQuestion('');
      setNewOptions(['', '']);
    }
  };

  const activeVotes = state.votes.filter((v) => v.status === 'active');
  const pendingVotes = state.votes.filter((v) => v.status === 'pending');
  const closedVotes = state.votes.filter((v) => v.status === 'closed');

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-[#E0E1DD] mb-6">Голосования</h2>

      {/* Create new vote */}
      <div className="bg-[#1B263B] rounded-xl p-4 mb-6">
        <h3 className="text-[#E0E1DD] font-semibold mb-4">Создать голосование</h3>
        <input
          type="text"
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          placeholder="Вопрос для голосования"
          className="w-full bg-[#0D1B2A] border border-[#415A77] rounded-lg px-4 py-2 text-[#E0E1DD] placeholder-[#415A77] mb-4"
        />
        <div className="space-y-2 mb-4">
          {newOptions.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={opt}
                onChange={(e) => {
                  const updated = [...newOptions];
                  updated[i] = e.target.value;
                  setNewOptions(updated);
                }}
                placeholder={`Вариант ${i + 1}`}
                className="flex-1 bg-[#0D1B2A] border border-[#415A77] rounded-lg px-4 py-2 text-[#E0E1DD] placeholder-[#415A77]"
              />
              {i >= 2 && (
                <button
                  onClick={() => setNewOptions(newOptions.filter((_, j) => j !== i))}
                  className="px-3 bg-red-900/50 hover:bg-red-800 text-red-300 rounded-lg"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {newOptions.length < 5 && (
            <button
              onClick={() => setNewOptions([...newOptions, ''])}
              className="px-4 py-2 bg-[#0D1B2A] hover:bg-[#415A77]/50 text-[#778DA9] rounded-lg"
            >
              + Добавить вариант
            </button>
          )}
          <button
            onClick={handleCreateVote}
            disabled={!newQuestion.trim() || newOptions.filter((o) => o.trim()).length < 2}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg"
          >
            Создать
          </button>
        </div>
      </div>

      {/* Active votes */}
      {activeVotes.length > 0 && (
        <div className="mb-6">
          <h3 className="text-[#E0E1DD] font-semibold mb-3">Активные голосования</h3>
          {activeVotes.map((vote) => (
            <VoteCard key={vote.id} vote={vote} gameState={gameState} />
          ))}
        </div>
      )}

      {/* Pending votes */}
      {pendingVotes.length > 0 && (
        <div className="mb-6">
          <h3 className="text-[#778DA9] font-semibold mb-3">Ожидают запуска</h3>
          {pendingVotes.map((vote) => (
            <VoteCard key={vote.id} vote={vote} gameState={gameState} />
          ))}
        </div>
      )}

      {/* Closed votes */}
      {closedVotes.length > 0 && (
        <div>
          <h3 className="text-[#415A77] font-semibold mb-3">Завершённые</h3>
          {closedVotes.map((vote) => (
            <VoteCard key={vote.id} vote={vote} gameState={gameState} />
          ))}
        </div>
      )}
    </div>
  );
}

interface VoteCardProps {
  vote: GameState['votes'][0];
  gameState: ReturnType<typeof useGameState>;
}

function VoteCard({ vote, gameState }: VoteCardProps) {
  const total = Object.values(vote.results).reduce((a, b) => a + b, 0);

  return (
    <div className={`bg-[#1B263B] rounded-xl p-4 mb-3 border-2 ${
      vote.status === 'active' ? 'border-emerald-500/50' : 'border-transparent'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <h4 className="text-[#E0E1DD] font-semibold">{vote.question}</h4>
        <span className={`text-xs px-2 py-1 rounded ${
          vote.status === 'active'
            ? 'bg-emerald-500/20 text-emerald-400'
            : vote.status === 'pending'
            ? 'bg-amber-500/20 text-amber-400'
            : 'bg-[#415A77]/30 text-[#778DA9]'
        }`}>
          {vote.status === 'active' ? 'Активно' : vote.status === 'pending' ? 'Ожидание' : 'Завершено'}
        </span>
      </div>

      {/* Results bars */}
      <div className="space-y-2 mb-4">
        {vote.options.map((option) => {
          const count = vote.results[option.id] || 0;
          const percent = total > 0 ? (count / total) * 100 : 0;

          return (
            <div key={option.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[#E0E1DD]">{option.text}</span>
                <span className="text-[#778DA9]">{count} ({percent.toFixed(0)}%)</span>
              </div>
              <div className="h-2 bg-[#0D1B2A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#415A77] transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {vote.status === 'pending' && (
          <button
            onClick={() => gameState.startVote(vote.id)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
          >
            Запустить
          </button>
        )}
        {vote.status === 'active' && (
          <button
            onClick={() => gameState.closeVote(vote.id)}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
          >
            Закрыть
          </button>
        )}
        <div className="text-[#415A77] text-sm self-center ml-2">
          Всего голосов: {total}
        </div>
      </div>
    </div>
  );
}

// ============ PARTICIPANTS PAGE ============

const ZONE_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  center: { bg: 'bg-amber-900/20', border: 'border-amber-500/50', text: 'text-amber-400', icon: '🏛️' },
  residential: { bg: 'bg-blue-900/20', border: 'border-blue-500/50', text: 'text-blue-400', icon: '🏠' },
  industrial: { bg: 'bg-gray-700/20', border: 'border-gray-500/50', text: 'text-gray-400', icon: '🏭' },
  green: { bg: 'bg-green-900/20', border: 'border-green-500/50', text: 'text-green-400', icon: '🌳' },
  unknown: { bg: 'bg-purple-900/20', border: 'border-purple-500/50', text: 'text-purple-400', icon: '❓' },
};

// Facilitator tips based on roles and game state
function getFacilitatorTips(state: GameState): Array<{ type: 'info' | 'warning' | 'action'; text: string; roleIds?: number[] }> {
  const tips: Array<{ type: 'info' | 'warning' | 'action'; text: string; roleIds?: number[] }> = [];

  // Act-based tips
  if (state.currentAct === 1) {
    tips.push({
      type: 'info',
      text: 'Акт I — Знакомство. Дайте каждому представиться через публичную миссию.',
    });
  }

  if (state.currentAct === 2) {
    tips.push({
      type: 'action',
      text: 'Акт II — Планирование. Вовлеките экспертов каждой зоны в обсуждение.',
    });
    if (state.currentScene >= 6 && !state.zones.unknown.revealed) {
      tips.push({
        type: 'warning',
        text: 'Пора раскрыть Неизведанную зону! Разведчик и Историк знают больше других.',
        roleIds: [11, 18],
      });
    }
  }

  if (state.currentAct === 3) {
    tips.push({
      type: 'warning',
      text: 'Акт III — Кризис. Следите за реакцией Психолога и Дипломата — они чувствуют напряжение.',
      roleIds: [15, 14],
    });
    if (!state.fogRevealed) {
      tips.push({
        type: 'action',
        text: 'Не забудьте показать послание из прошлого перед кризисом!',
      });
    }
  }

  if (state.currentAct === 4) {
    tips.push({
      type: 'info',
      text: 'Акт IV — Раскрытие. Порядок раскрытия: от простых секретов к драматичным.',
    });
    tips.push({
      type: 'action',
      text: 'Незнакомец должен раскрыться последним — это кульминация!',
      roleIds: [20],
    });
    tips.push({
      type: 'info',
      text: 'Маша (ребёнок) может быть неожиданным поворотом — она знает, почему все здесь.',
      roleIds: [19],
    });
  }

  if (state.currentAct === 5) {
    tips.push({
      type: 'info',
      text: 'Акт V — Обещания. Дайте время на размышление. Не торопите.',
    });
  }

  // Connection warnings
  const disconnected = state.roles.filter((r) => !r.connected);
  if (disconnected.length > 5) {
    tips.push({
      type: 'warning',
      text: `${disconnected.length} участников не подключены. Проверьте QR-коды.`,
    });
  }

  // Zone-specific tips based on current scene
  if (state.currentScene === 3) {
    tips.push({
      type: 'action',
      text: 'Обсуждение Центра. Ключевые роли: Командор, Архитектор, Банкир, Судья.',
      roleIds: [1, 3, 7, 10],
    });
  }
  if (state.currentScene === 4) {
    tips.push({
      type: 'action',
      text: 'Обсуждение Жилого квартала. Ключевые: Доктор, Священник, Психолог.',
      roleIds: [4, 12, 15],
    });
  }
  if (state.currentScene === 5) {
    tips.push({
      type: 'action',
      text: 'Обсуждение Промзоны. Ключевые: Инженер, Технолог, Строитель.',
      roleIds: [2, 13, 16],
    });
  }

  return tips;
}

// Get role drama level for sorting
function getRoleDramaLevel(roleId: number): number {
  const highDrama = [20, 19, 18, 11, 14]; // Незнакомец, Маша, Историк, Разведчик, Дипломат
  const mediumDrama = [7, 10, 17, 6, 4]; // Банкир, Судья, Эколог, Фермер, Доктор
  if (highDrama.includes(roleId)) return 3;
  if (mediumDrama.includes(roleId)) return 2;
  return 1;
}

function ParticipantsPage({ state, gameState }: PageProps) {
  const [filter, setFilter] = useState<'all' | 'connected' | 'disconnected'>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [expandedRole, setExpandedRole] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTips, setShowTips] = useState(true);

  const tips = getFacilitatorTips(state);

  const filteredRoles = state.roles.filter((role) => {
    const roleData = (rolesData as GameRole[]).find((r) => r.id === role.id);
    if (!roleData) return false;

    // Connection filter
    if (filter === 'connected' && !role.connected) return false;
    if (filter === 'disconnected' && role.connected) return false;

    // Zone filter
    if (zoneFilter !== 'all' && roleData.zone !== zoneFilter) return false;

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        role.name.toLowerCase().includes(q) ||
        roleData.archetype.toLowerCase().includes(q) ||
        roleData.publicMission.toLowerCase().includes(q)
      );
    }

    return true;
  });

  const handleGenerateQR = () => {
    // Открываем страницу QR-кодов в новой вкладке
    window.open('/qr', '_blank');
  };

  return (
    <div className="p-6">
      {/* Header with actions */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-[#E0E1DD]">Участники и роли</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTips(!showTips)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              showTips ? 'bg-amber-600 text-white' : 'bg-[#415A77] text-[#E0E1DD]'
            }`}
          >
            💡 Советы
          </button>
          <button
            onClick={handleGenerateQR}
            className="px-4 py-2 bg-[#415A77] hover:bg-[#778DA9] text-white rounded-lg transition-colors"
          >
            📱 QR-коды
          </button>
        </div>
      </div>

      {/* Facilitator tips */}
      {showTips && tips.length > 0 && (
        <div className="bg-gradient-to-r from-amber-900/20 to-[#1B263B] border border-amber-500/30 rounded-xl p-4 mb-6">
          <h3 className="text-amber-400 font-semibold mb-3 flex items-center gap-2">
            <span>💡</span> Советы фасилитатору
          </h3>
          <div className="space-y-2">
            {tips.map((tip, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-2 rounded-lg ${
                  tip.type === 'warning' ? 'bg-red-900/20' :
                  tip.type === 'action' ? 'bg-emerald-900/20' : 'bg-[#0D1B2A]'
                }`}
              >
                <span className="text-lg">
                  {tip.type === 'warning' ? '⚠️' : tip.type === 'action' ? '👉' : 'ℹ️'}
                </span>
                <div className="flex-1">
                  <p className="text-[#E0E1DD] text-sm">{tip.text}</p>
                  {tip.roleIds && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tip.roleIds.map((id) => {
                        const r = state.roles.find((role) => role.id === id);
                        return r ? (
                          <button
                            key={id}
                            onClick={() => {
                              setExpandedRole(id);
                              setFilter('all');
                              setZoneFilter('all');
                            }}
                            className="text-xs px-2 py-0.5 bg-[#415A77] hover:bg-[#778DA9] rounded text-[#E0E1DD] transition-colors"
                          >
                            {r.name.split(' ')[0]}
                          </button>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        <div className="bg-[#1B263B] rounded-lg p-3 text-center">
          <div className="text-emerald-400 text-2xl font-bold">
            {state.roles.filter((r) => r.connected).length}
          </div>
          <div className="text-[#778DA9] text-xs">Онлайн</div>
        </div>
        <div className="bg-[#1B263B] rounded-lg p-3 text-center">
          <div className="text-[#E0E1DD] text-2xl font-bold">
            {state.roles.filter((r) => r.secretRevealed).length}
          </div>
          <div className="text-[#778DA9] text-xs">Раскрыто</div>
        </div>
        <div className="bg-[#1B263B] rounded-lg p-3 text-center">
          <div className="text-[#E0E1DD] text-2xl font-bold">
            {state.promises.length}
          </div>
          <div className="text-[#778DA9] text-xs">Обещаний</div>
        </div>
        <div className="bg-[#1B263B] rounded-lg p-3 text-center">
          <div className="text-amber-400 text-2xl font-bold">
            {state.candlesLit.length}
          </div>
          <div className="text-[#778DA9] text-xs">Свечей</div>
        </div>
        <div className="bg-[#1B263B] rounded-lg p-3 text-center">
          <div className="text-red-400 text-2xl font-bold">
            {state.roles.filter((r) => !r.connected).length}
          </div>
          <div className="text-[#778DA9] text-xs">Офлайн</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по имени, роли..."
          className="flex-1 min-w-[200px] bg-[#1B263B] border border-[#415A77] rounded-lg px-4 py-2 text-[#E0E1DD] placeholder-[#415A77] focus:outline-none focus:border-[#778DA9]"
        />

        {/* Connection filter */}
        <div className="flex rounded-lg overflow-hidden border border-[#415A77]">
          {[
            { id: 'all', label: 'Все' },
            { id: 'connected', label: '🟢 Онлайн' },
            { id: 'disconnected', label: '⚫ Офлайн' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as typeof filter)}
              className={`px-3 py-2 text-sm transition-colors ${
                filter === f.id ? 'bg-[#415A77] text-white' : 'bg-[#1B263B] text-[#778DA9] hover:bg-[#415A77]/50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Zone filter */}
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="bg-[#1B263B] border border-[#415A77] rounded-lg px-3 py-2 text-[#E0E1DD]"
        >
          <option value="all">Все зоны</option>
          <option value="center">🏛️ Центр</option>
          <option value="residential">🏠 Жилой</option>
          <option value="industrial">🏭 Промзона</option>
          <option value="green">🌳 Зелёный</option>
          <option value="unknown">❓ Неизведанная</option>
        </select>
      </div>

      {/* Role cards */}
      <div className="space-y-3">
        {filteredRoles.map((role) => {
          const roleData = (rolesData as GameRole[]).find((r) => r.id === role.id);
          if (!roleData) return null;

          const zoneColor = ZONE_COLORS[roleData.zone] || ZONE_COLORS.unknown;
          const isExpanded = expandedRole === role.id;
          const dramaLevel = getRoleDramaLevel(role.id);

          return (
            <div
              key={role.id}
              className={`rounded-xl border-2 transition-all overflow-hidden ${
                role.connected ? zoneColor.border : 'border-[#415A77]/30'
              } ${zoneColor.bg}`}
            >
              {/* Header - always visible */}
              <div
                className="p-4 cursor-pointer hover:bg-black/10 transition-colors"
                onClick={() => setExpandedRole(isExpanded ? null : role.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Connection indicator */}
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      role.connected ? 'bg-emerald-500 animate-pulse' : 'bg-[#415A77]'
                    }`} />

                    {/* Zone icon */}
                    <span className="text-xl">{zoneColor.icon}</span>

                    {/* Name and archetype */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#E0E1DD] font-semibold">{role.name}</span>
                        {dramaLevel === 3 && <span className="text-amber-400 text-xs">⭐ ключевой</span>}
                      </div>
                      <div className={`text-sm ${zoneColor.text}`}>{roleData.archetype}</div>
                    </div>
                  </div>

                  {/* Status badges */}
                  <div className="flex items-center gap-2">
                    {role.secretRevealed && (
                      <span className="text-amber-400 text-sm">🕯️</span>
                    )}
                    {role.promise && (
                      <span className="text-emerald-400 text-sm">✓</span>
                    )}
                    <span className="text-[#415A77] text-xs font-mono">{role.token}</span>
                    <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </div>
                </div>

                {/* Public mission - visible in collapsed state */}
                <div className="mt-2 text-[#778DA9] text-sm">
                  <strong>Миссия:</strong> {roleData.publicMission}
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-[#415A77]/30 pt-4">
                  {/* Secret motivation */}
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                    <div className="text-red-400 text-xs font-semibold mb-1">🔒 СЕКРЕТНАЯ МОТИВАЦИЯ</div>
                    <p className="text-[#E0E1DD] text-sm">{roleData.secretMotivation}</p>
                  </div>

                  {/* Reveal line */}
                  <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3">
                    <div className="text-amber-400 text-xs font-semibold mb-1">🎭 ФРАЗА РАСКРЫТИЯ</div>
                    <p className="text-[#E0E1DD] text-sm italic">"{roleData.revealLine}"</p>
                  </div>

                  {/* Facilitator notes */}
                  <div className="bg-[#0D1B2A] rounded-lg p-3">
                    <div className="text-[#778DA9] text-xs font-semibold mb-2">📋 ЗАМЕТКИ ДЛЯ ФАСИЛИТАТОРА</div>
                    <ul className="text-[#E0E1DD] text-sm space-y-1">
                      <li>• Зона: {ZONE_NAMES[roleData.zone as keyof typeof ZONE_NAMES] || roleData.zone}</li>
                      {roleData.zone === 'unknown' && (
                        <li className="text-purple-400">• Связан с тайной Первого Горизонта</li>
                      )}
                      {dramaLevel === 3 && (
                        <li className="text-amber-400">• Высокий драматический потенциал — раскрывать ближе к кульминации</li>
                      )}
                      {role.id === 20 && (
                        <li className="text-amber-400">• ГЛАВНЫЙ ПОВОРОТ! Раскрывать последним в Акте IV</li>
                      )}
                      {role.id === 19 && (
                        <li className="text-purple-400">• Знает почему все здесь — можно использовать для неожиданного поворота</li>
                      )}
                      {role.id === 11 && (
                        <li className="text-purple-400">• Знал о руинах с начала — активировать при раскрытии зоны</li>
                      )}
                      {role.id === 18 && (
                        <li className="text-purple-400">• Хранит послание — ключ к сцене с посланием в Акте III</li>
                      )}
                    </ul>
                  </div>

                  {/* Player resources */}
                  <div className="bg-[#0D1B2A] rounded-lg p-3">
                    <div className="text-[#778DA9] text-xs font-semibold mb-2">ЛИЧНЫЕ РЕСУРСЫ</div>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {(['energy', 'materials', 'food', 'knowledge'] as ResourceName[]).map((resource) => (
                        <div key={resource} className="text-center">
                          <div className="text-lg">{RESOURCE_ICONS[resource]}</div>
                          <div className="text-[#E0E1DD] font-mono font-bold">
                            {role.resources[resource]}
                          </div>
                          <div className="text-[#415A77] text-xs">{RESOURCE_NAMES[resource]}</div>
                        </div>
                      ))}
                    </div>
                    <div className="text-[#778DA9] text-xs mb-2">Выдать ресурсы:</div>
                    <div className="grid grid-cols-4 gap-2">
                      {(['energy', 'materials', 'food', 'knowledge'] as ResourceName[]).map((resource) => (
                        <div key={resource} className="flex flex-col gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              gameState.giveResource(role.id, resource, 5);
                            }}
                            className="py-1 text-xs bg-emerald-900/50 hover:bg-emerald-800 text-emerald-300 rounded transition-colors"
                          >
                            {RESOURCE_ICONS[resource]} +5
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              gameState.giveResource(role.id, resource, 1);
                            }}
                            className="py-1 text-xs bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-300 rounded transition-colors"
                          >
                            +1
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!role.secretRevealed) {
                          gameState.revealSecret(role.id);
                          gameState.lightCandle(role.id);
                        }
                      }}
                      disabled={role.secretRevealed}
                      className={`flex-1 py-2 rounded-lg transition-colors ${
                        role.secretRevealed
                          ? 'bg-amber-500/20 text-amber-400 cursor-not-allowed'
                          : 'bg-amber-600 hover:bg-amber-500 text-white'
                      }`}
                    >
                      {role.secretRevealed ? '🕯️ Секрет раскрыт' : '🕯️ Раскрыть секрет'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {filteredRoles.length === 0 && (
        <div className="bg-[#1B263B] rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <div className="text-[#778DA9]">Участники не найдены по заданным фильтрам</div>
        </div>
      )}
    </div>
  );
}

// ============ PROMISES PAGE ============

function PromisesPage({ state }: { state: GameState }) {
  const handleExportPDF = () => {
    const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Обещания — Проект Горизонт</title>
  <style>
    body { font-family: Georgia, serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; }
    .promise { margin: 30px 0; padding: 20px; border-left: 4px solid #D4A017; background: #f9f9f9; }
    .promise h3 { margin: 0 0 10px 0; color: #333; }
    .promise p { margin: 0; font-style: italic; color: #555; font-size: 18px; line-height: 1.6; }
    .empty { text-align: center; color: #999; padding: 60px; }
  </style>
</head>
<body>
  <h1>Проект Горизонт<br><small>Книга обещаний</small></h1>
  ${state.promises.length === 0
    ? '<div class="empty">Обещания ещё не были даны</div>'
    : state.promises.map((p) => {
        const role = state.roles.find((r) => r.id === p.roleId);
        return `
          <div class="promise">
            <h3>${role?.name || 'Неизвестный'}</h3>
            <p>"${p.text}"</p>
          </div>
        `;
      }).join('')
  }
</body>
</html>
    `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'horizon-promises.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-[#E0E1DD]">Обещания</h2>
        <button
          onClick={handleExportPDF}
          disabled={state.promises.length === 0}
          className="px-4 py-2 bg-[#415A77] hover:bg-[#778DA9] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          📄 Экспорт в PDF
        </button>
      </div>

      {state.promises.length === 0 ? (
        <div className="bg-[#1B263B] rounded-xl p-12 text-center">
          <div className="text-6xl mb-4">✨</div>
          <div className="text-[#778DA9] text-lg">Обещания появятся в Акте V</div>
          <div className="text-[#415A77] text-sm mt-2">
            Когда участники начнут давать обещания, они будут отображаться здесь
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {state.promises.map((promise, i) => {
            const role = state.roles.find((r) => r.id === promise.roleId);
            const roleData = (rolesData as GameRole[]).find((r) => r.id === promise.roleId);

            return (
              <div key={i} className="bg-[#1B263B] rounded-xl p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-[#E0E1DD] font-semibold">{role?.name}</div>
                    <div className="text-[#778DA9] text-sm">{roleData?.archetype}</div>
                  </div>
                  <div className="text-[#415A77] text-sm">
                    {new Date(promise.deadline).toLocaleString('ru-RU')}
                  </div>
                </div>
                <p className="text-[#E0E1DD] italic text-lg leading-relaxed">
                  "{promise.text}"
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ EVENTS PAGE ============

const EVENT_TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  resource_gain: { label: 'Получение ресурсов', color: 'text-emerald-400', icon: '📈' },
  resource_loss: { label: 'Потеря ресурсов', color: 'text-red-400', icon: '📉' },
  dilemma: { label: 'Дилемма', color: 'text-amber-400', icon: '⚖️' },
  narrative: { label: 'Сюжетное', color: 'text-blue-400', icon: '📖' },
};

const ZONE_LABELS: Record<string, string> = {
  all: 'Все зоны',
  center: 'Центр',
  residential: 'Жилой квартал',
  industrial: 'Промзона',
  green: 'Зелёный пояс',
};

function EventsPage({ state, gameState }: PageProps) {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);

  const events = eventsData as GameEvent[];
  const { eventSettings } = state.settings;
  const currentAct = state.currentAct;

  // Get events available for current act
  const availableEvents = events.filter(e => e.stage.includes(currentAct));
  const enabledEvents = events.filter(e => eventSettings.enabledEventIds.includes(e.id));

  const handleToggleEvents = () => {
    gameState.updateEventSettings({ enabled: !eventSettings.enabled });
  };

  const handleProbabilityChange = (probability: number) => {
    gameState.updateEventSettings({ probability });
  };

  const handleToggleEvent = (eventId: number) => {
    const newEnabledIds = eventSettings.enabledEventIds.includes(eventId)
      ? eventSettings.enabledEventIds.filter(id => id !== eventId)
      : [...eventSettings.enabledEventIds, eventId];
    gameState.updateEventSettings({ enabledEventIds: newEnabledIds });
  };

  const handleTriggerEvent = (eventId: number) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    if (event.type === 'dilemma') {
      gameState.triggerDilemmaEvent(eventId);
    } else {
      gameState.triggerEvent(eventId);
    }
  };

  const handleDismissEvent = () => {
    gameState.dismissEvent();
  };

  const handleApplyEffect = (event: GameEvent) => {
    if (event.type === 'resource_gain' || event.type === 'resource_loss') {
      const effect = event.effect as { resource: string; amount: number; zone: string };
      gameState.applyEventEffect(
        effect.resource as ResourceName | 'all',
        effect.amount,
        effect.zone as ZoneName | 'all'
      );
    }
    gameState.dismissEvent();
  };

  const selectedEvent = selectedEventId ? events.find(e => e.id === selectedEventId) : null;
  const activeEvent = state.activeEvent ? events.find(e => e.id === state.activeEvent?.eventId) : null;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-[#E0E1DD] mb-6">Система событий</h2>

      {/* Active Event Banner */}
      {activeEvent && (
        <div className="bg-amber-900/30 border border-amber-500/50 rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{EVENT_TYPE_LABELS[activeEvent.type].icon}</span>
                <h3 className="text-xl font-bold text-amber-300">{activeEvent.title}</h3>
                <span className={`text-sm px-2 py-0.5 rounded ${EVENT_TYPE_LABELS[activeEvent.type].color} bg-[#0D1B2A]`}>
                  {EVENT_TYPE_LABELS[activeEvent.type].label}
                </span>
              </div>
              <p className="text-amber-100 mb-3">{activeEvent.narrative}</p>
              <div className="bg-amber-900/40 rounded-lg p-3 mb-3">
                <div className="text-amber-200 text-sm font-semibold mb-1">Для игроков:</div>
                <div className="text-amber-100">{activeEvent.playerMessage}</div>
              </div>

              {/* Effect display */}
              {(activeEvent.type === 'resource_gain' || activeEvent.type === 'resource_loss') && (
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-[#778DA9]">Эффект:</span>
                  <span className={activeEvent.type === 'resource_gain' ? 'text-emerald-400' : 'text-red-400'}>
                    {(activeEvent.effect as { resource: string; amount: number; zone: string }).amount > 0 ? '+' : ''}
                    {(activeEvent.effect as { resource: string; amount: number; zone: string }).amount}{' '}
                    {RESOURCE_ICONS[(activeEvent.effect as { resource: string }).resource as ResourceName] || '🔄'}
                    {' '}→ {ZONE_LABELS[(activeEvent.effect as { zone: string }).zone]}
                  </span>
                </div>
              )}

              {/* Dilemma choices */}
              {activeEvent.type === 'dilemma' && (
                <div className="space-y-2 mb-3">
                  <div className="text-amber-200 text-sm font-semibold">Варианты выбора:</div>
                  {((activeEvent.effect as { choices: Array<{ text: string; result: Record<string, number> }> }).choices || []).map((choice, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        // Apply choice effect
                        Object.entries(choice.result).forEach(([resource, amount]) => {
                          gameState.applyEventEffect(resource as ResourceName, amount as number, 'all');
                        });
                        gameState.recordEventChoice(activeEvent.id, choice.text);
                        gameState.dismissEvent();
                      }}
                      className="w-full text-left px-4 py-2 bg-amber-800/50 hover:bg-amber-700/50 rounded-lg text-amber-100 transition-colors"
                    >
                      <span className="font-medium">{choice.text}</span>
                      {Object.keys(choice.result).length > 0 && (
                        <span className="ml-2 text-sm text-amber-300">
                          ({Object.entries(choice.result).map(([r, a]) =>
                            `${(a as number) > 0 ? '+' : ''}${a} ${RESOURCE_ICONS[r as ResourceName] || r}`
                          ).join(', ')})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {(activeEvent.type === 'resource_gain' || activeEvent.type === 'resource_loss') && (
                <button
                  onClick={() => handleApplyEffect(activeEvent)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                >
                  Применить эффект
                </button>
              )}
              <button
                onClick={handleDismissEvent}
                className="px-4 py-2 bg-[#415A77] hover:bg-[#778DA9] text-white rounded-lg transition-colors"
              >
                Закрыть событие
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="bg-[#1B263B] rounded-xl p-5 mb-6">
        <h3 className="text-[#E0E1DD] font-semibold mb-4">Настройки событий</h3>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between bg-[#0D1B2A] rounded-lg p-4">
            <div>
              <div className="text-[#E0E1DD] font-medium">Случайные события</div>
              <div className="text-[#778DA9] text-sm">События будут появляться при смене сцен</div>
            </div>
            <button
              onClick={handleToggleEvents}
              className={`w-14 h-8 rounded-full transition-colors relative ${
                eventSettings.enabled ? 'bg-emerald-500' : 'bg-[#415A77]'
              }`}
            >
              <div
                className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-transform ${
                  eventSettings.enabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Probability */}
          <div className="bg-[#0D1B2A] rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <div className="text-[#E0E1DD] font-medium">Вероятность события</div>
              <div className="text-emerald-400 font-bold">{eventSettings.probability}%</div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={eventSettings.probability}
              onChange={(e) => handleProbabilityChange(parseInt(e.target.value))}
              className="w-full h-2 bg-[#415A77] rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-[#778DA9] mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        <div className="mt-4 text-[#778DA9] text-sm">
          Включённых событий: <span className="text-emerald-400 font-medium">{enabledEvents.length}</span> из {events.length}
          {' | '}
          Доступно для Акта {currentAct}: <span className="text-blue-400 font-medium">{availableEvents.length}</span>
        </div>
      </div>

      {/* Available Events for Current Act */}
      <div className="bg-[#1B263B] rounded-xl p-5 mb-6">
        <h3 className="text-[#E0E1DD] font-semibold mb-4">
          События для Акта {currentAct}
          <span className="text-[#778DA9] font-normal text-sm ml-2">
            (нажмите для запуска)
          </span>
        </h3>

        {availableEvents.length === 0 ? (
          <div className="text-center text-[#778DA9] py-8">
            Для текущего акта нет доступных событий
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableEvents.map(event => {
              const isEnabled = eventSettings.enabledEventIds.includes(event.id);
              const typeInfo = EVENT_TYPE_LABELS[event.type];

              return (
                <div
                  key={event.id}
                  className={`bg-[#0D1B2A] rounded-lg p-4 border transition-all ${
                    isEnabled
                      ? 'border-[#415A77] hover:border-[#778DA9]'
                      : 'border-transparent opacity-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{typeInfo.icon}</span>
                      <span className="text-[#E0E1DD] font-medium">{event.title}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleEvent(event.id);
                      }}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isEnabled
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-[#415A77] hover:border-[#778DA9]'
                      }`}
                    >
                      {isEnabled && <span className="text-white text-xs">✓</span>}
                    </button>
                  </div>

                  <div className={`text-xs mb-2 ${typeInfo.color}`}>
                    {typeInfo.label}
                  </div>

                  <p className="text-[#778DA9] text-sm mb-3 line-clamp-2">
                    {event.description}
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedEventId(event.id);
                        setShowEventDetails(true);
                      }}
                      className="flex-1 px-3 py-1.5 bg-[#1B263B] hover:bg-[#415A77] text-[#E0E1DD] text-sm rounded transition-colors"
                    >
                      Подробнее
                    </button>
                    <button
                      onClick={() => handleTriggerEvent(event.id)}
                      disabled={!isEnabled || !!state.activeEvent}
                      className="flex-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                    >
                      Запустить
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* All Events List */}
      <div className="bg-[#1B263B] rounded-xl p-5 mb-6">
        <h3 className="text-[#E0E1DD] font-semibold mb-4">
          Все события
          <span className="text-[#778DA9] font-normal text-sm ml-2">
            ({events.length} событий)
          </span>
        </h3>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {events.map(event => {
            const isEnabled = eventSettings.enabledEventIds.includes(event.id);
            const typeInfo = EVENT_TYPE_LABELS[event.type];
            const isAvailableNow = event.stage.includes(currentAct);

            return (
              <div
                key={event.id}
                className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                  isAvailableNow ? 'bg-[#0D1B2A]' : 'bg-[#0D1B2A]/50'
                }`}
              >
                <button
                  onClick={() => handleToggleEvent(event.id)}
                  className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                    isEnabled
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-[#415A77] hover:border-[#778DA9]'
                  }`}
                >
                  {isEnabled && <span className="text-white text-xs">✓</span>}
                </button>

                <span className="text-xl">{typeInfo.icon}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${isAvailableNow ? 'text-[#E0E1DD]' : 'text-[#778DA9]'}`}>
                      {event.title}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${typeInfo.color} bg-[#1B263B]`}>
                      {typeInfo.label}
                    </span>
                  </div>
                  <div className="text-[#778DA9] text-xs truncate">{event.description}</div>
                </div>

                <div className="text-[#415A77] text-xs whitespace-nowrap">
                  Акты: {event.stage.join(', ')}
                </div>

                <button
                  onClick={() => {
                    setSelectedEventId(event.id);
                    setShowEventDetails(true);
                  }}
                  className="px-2 py-1 text-[#778DA9] hover:text-[#E0E1DD] text-sm transition-colors"
                >
                  👁️
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event History */}
      {state.triggeredEvents.length > 0 && (
        <div className="bg-[#1B263B] rounded-xl p-5">
          <h3 className="text-[#E0E1DD] font-semibold mb-4">
            История событий
            <span className="text-[#778DA9] font-normal text-sm ml-2">
              ({state.triggeredEvents.length} событий)
            </span>
          </h3>

          <div className="space-y-2">
            {state.triggeredEvents.slice().reverse().map((triggered, i) => {
              const event = events.find(e => e.id === triggered.eventId);
              if (!event) return null;
              const typeInfo = EVENT_TYPE_LABELS[event.type];

              return (
                <div key={i} className="flex items-center gap-4 p-3 bg-[#0D1B2A] rounded-lg">
                  <span className="text-xl">{typeInfo.icon}</span>
                  <div className="flex-1">
                    <div className="text-[#E0E1DD] font-medium">{event.title}</div>
                    <div className="text-[#778DA9] text-xs">
                      Акт {triggered.actWhenTriggered}, Сцена {triggered.sceneWhenTriggered}
                      {triggered.choiceMade && (
                        <span className="ml-2 text-amber-400">
                          Выбор: {triggered.choiceMade}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[#415A77] text-xs">
                    {new Date(triggered.triggeredAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {showEventDetails && selectedEvent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1B263B] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{EVENT_TYPE_LABELS[selectedEvent.type].icon}</span>
                  <div>
                    <h3 className="text-xl font-bold text-[#E0E1DD]">{selectedEvent.title}</h3>
                    <div className={`text-sm ${EVENT_TYPE_LABELS[selectedEvent.type].color}`}>
                      {EVENT_TYPE_LABELS[selectedEvent.type].label}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowEventDetails(false)}
                  className="text-[#778DA9] hover:text-[#E0E1DD] text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-[#778DA9] text-sm mb-1">Описание</div>
                  <div className="text-[#E0E1DD]">{selectedEvent.description}</div>
                </div>

                <div>
                  <div className="text-[#778DA9] text-sm mb-1">Доступно в актах</div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(act => (
                      <span
                        key={act}
                        className={`px-3 py-1 rounded ${
                          selectedEvent.stage.includes(act)
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#0D1B2A] text-[#415A77]'
                        }`}
                      >
                        Акт {act}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-[#0D1B2A] rounded-lg p-4">
                  <div className="text-amber-400 text-sm font-semibold mb-2">📜 Нарратив для игроков</div>
                  <div className="text-[#E0E1DD] italic">{selectedEvent.narrative}</div>
                </div>

                <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4">
                  <div className="text-blue-400 text-sm font-semibold mb-2">💡 Заметка для фасилитатора</div>
                  <div className="text-blue-100">{selectedEvent.facilitatorNote}</div>
                </div>

                <div className="bg-[#0D1B2A] rounded-lg p-4">
                  <div className="text-emerald-400 text-sm font-semibold mb-2">📱 Сообщение игрокам</div>
                  <div className="text-[#E0E1DD]">{selectedEvent.playerMessage}</div>
                </div>

                {/* Effect details */}
                {(selectedEvent.type === 'resource_gain' || selectedEvent.type === 'resource_loss') && (
                  <div className="bg-[#0D1B2A] rounded-lg p-4">
                    <div className={`text-sm font-semibold mb-2 ${
                      selectedEvent.type === 'resource_gain' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {selectedEvent.type === 'resource_gain' ? '📈 Эффект: Получение' : '📉 Эффект: Потеря'}
                    </div>
                    <div className="text-[#E0E1DD]">
                      {(selectedEvent.effect as { amount: number }).amount > 0 ? '+' : ''}
                      {(selectedEvent.effect as { amount: number }).amount}{' '}
                      {(selectedEvent.effect as { resource: string }).resource === 'all'
                        ? 'всех ресурсов'
                        : RESOURCE_NAMES[(selectedEvent.effect as { resource: string }).resource as ResourceName]
                      }
                      {' '}→{' '}
                      {ZONE_LABELS[(selectedEvent.effect as { zone: string }).zone]}
                    </div>
                  </div>
                )}

                {selectedEvent.type === 'dilemma' && (
                  <div className="bg-[#0D1B2A] rounded-lg p-4">
                    <div className="text-amber-400 text-sm font-semibold mb-2">⚖️ Варианты выбора</div>
                    <div className="space-y-2">
                      {((selectedEvent.effect as { choices: Array<{ text: string; result: Record<string, number> }> }).choices || []).map((choice, i) => (
                        <div key={i} className="bg-[#1B263B] rounded p-3">
                          <div className="text-[#E0E1DD] font-medium">{choice.text}</div>
                          {Object.keys(choice.result).length > 0 && (
                            <div className="text-[#778DA9] text-sm mt-1">
                              Результат: {Object.entries(choice.result).map(([r, a]) =>
                                `${(a as number) > 0 ? '+' : ''}${a} ${RESOURCE_NAMES[r as ResourceName] || r}`
                              ).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowEventDetails(false)}
                  className="px-4 py-2 bg-[#415A77] hover:bg-[#778DA9] text-white rounded-lg transition-colors"
                >
                  Закрыть
                </button>
                <button
                  onClick={() => {
                    handleTriggerEvent(selectedEvent.id);
                    setShowEventDetails(false);
                  }}
                  disabled={!!state.activeEvent}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  Запустить событие
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ SETTINGS PAGE ============

function SettingsPage({ state, gameState }: PageProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  const handleResetSession = () => {
    if (resetConfirmText === 'СБРОС') {
      gameState.resetSession();
      // Перезагрузить страницу через 500мс, чтобы сервер успел создать новую сессию
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  };

  const connectedCount = state.roles.filter((r) => r.connected).length;
  const promisesCount = state.promises.length;
  const revealedSecrets = state.roles.filter((r) => r.secretRevealed).length;
  const activeVotes = state.votes.filter((v) => v.status === 'active').length;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-[#E0E1DD] mb-6">Настройки сессии</h2>

      {/* Session info */}
      <div className="bg-[#1B263B] rounded-xl p-5 mb-6">
        <h3 className="text-[#E0E1DD] font-semibold mb-4">Информация о сессии</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0D1B2A] rounded-lg p-4">
            <div className="text-[#778DA9] text-sm">ID сессии</div>
            <div className="text-[#E0E1DD] font-mono mt-1">{state.sessionId}</div>
          </div>
          <div className="bg-[#0D1B2A] rounded-lg p-4">
            <div className="text-[#778DA9] text-sm">Подключено</div>
            <div className="text-emerald-400 font-bold text-xl mt-1">{connectedCount}/20</div>
          </div>
          <div className="bg-[#0D1B2A] rounded-lg p-4">
            <div className="text-[#778DA9] text-sm">Обещания</div>
            <div className="text-[#E0E1DD] font-bold text-xl mt-1">{promisesCount}</div>
          </div>
          <div className="bg-[#0D1B2A] rounded-lg p-4">
            <div className="text-[#778DA9] text-sm">Раскрыто секретов</div>
            <div className="text-[#E0E1DD] font-bold text-xl mt-1">{revealedSecrets}/20</div>
          </div>
        </div>
      </div>

      {/* Current state summary */}
      <div className="bg-[#1B263B] rounded-xl p-5 mb-6">
        <h3 className="text-[#E0E1DD] font-semibold mb-4">Текущее состояние</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-[#778DA9]">Акт / Сцена:</span>
            <span className="text-[#E0E1DD]">Акт {state.currentAct}, Сцена {state.currentScene}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#778DA9]">Таймер:</span>
            <span className="text-[#E0E1DD]">
              {state.timer.running ? `Активен (${formatTime(state.timer.remainingSec)})` : 'Остановлен'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#778DA9]">Неизведанная зона:</span>
            <span className={state.zones.unknown.revealed ? 'text-emerald-400' : 'text-[#778DA9]'}>
              {state.zones.unknown.revealed ? 'Раскрыта' : 'Скрыта'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#778DA9]">Послание:</span>
            <span className={state.fogRevealed ? 'text-emerald-400' : 'text-[#778DA9]'}>
              {state.fogRevealed ? 'Показано' : 'Скрыто'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#778DA9]">Активных голосований:</span>
            <span className="text-[#E0E1DD]">{activeVotes}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#778DA9]">Зажжено свечей:</span>
            <span className="text-[#E0E1DD]">{state.candlesLit.length}</span>
          </div>
        </div>
      </div>

      {/* Zone levels summary */}
      <div className="bg-[#1B263B] rounded-xl p-5 mb-6">
        <h3 className="text-[#E0E1DD] font-semibold mb-4">Уровни зон</h3>
        <div className="grid grid-cols-4 gap-4">
          {(['center', 'residential', 'industrial', 'green'] as const).map((zone) => (
            <div key={zone} className="bg-[#0D1B2A] rounded-lg p-3 text-center">
              <div className="text-[#778DA9] text-xs mb-1">{ZONE_NAMES[zone]}</div>
              <div className="text-2xl font-bold text-[#E0E1DD]">{state.zones[zone].level}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Reset session */}
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-5">
        <h3 className="text-red-400 font-semibold mb-2">Опасная зона</h3>
        <p className="text-[#778DA9] text-sm mb-4">
          Сброс сессии удалит все данные текущей игры и создаст новую сессию с новыми токенами.
          Это действие нельзя отменить.
        </p>

        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-6 py-3 bg-red-900/50 hover:bg-red-800 border border-red-500/50 text-red-300 rounded-lg transition-colors"
          >
            🔄 Сбросить сессию и начать заново
          </button>
        ) : (
          <div className="bg-red-900/30 rounded-lg p-4">
            <p className="text-red-300 mb-3">
              Введите <strong>СБРОС</strong> для подтверждения:
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="СБРОС"
                className="flex-1 bg-[#0D1B2A] border border-red-500/50 rounded-lg px-4 py-2 text-[#E0E1DD] placeholder-[#415A77]"
                autoFocus
              />
              <button
                onClick={handleResetSession}
                disabled={resetConfirmText !== 'СБРОС'}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Подтвердить
              </button>
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetConfirmText('');
                }}
                className="px-6 py-2 bg-[#415A77] hover:bg-[#778DA9] text-white rounded-lg transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ HELPERS ============

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function toRoman(num: number): string {
  const map: [number, string][] = [
    [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let result = '';
  for (const [value, symbol] of map) {
    while (num >= value) {
      result += symbol;
      num -= value;
    }
  }
  return result;
}
