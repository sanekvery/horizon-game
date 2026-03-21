import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGameState } from '../hooks/useGameState';
import { useMapAnimations, type ResourceContributedEvent, type ZoneUpgradedEvent } from '../hooks/useMapAnimations';
import {
  ZoneResourceIndicator,
  ResourceFlowAnimation,
  ZoneUpgradeAnimation,
  EventOverlay,
} from '../components/map';
import scenarioData from '../data/scenario.json';
import rolesData from '../data/roles.json';
import type { GameRole } from '../types/game-data';
import type { ZoneName } from '../types/game-state';

// ============ CONSTANTS ============

const MESSAGE_TEXT = `Мы, жители Первого Горизонта, оставляем это послание тем, кто придёт после нас.
Мы были такими же, как вы. У нас были ресурсы. У нас был план.
Но мы потеряли город. Не потому что не умели строить.
А потому что каждый строил свой город.
Город — это не здания. Город — это обещания, которые мы даём друг другу.`;

const ZONE_COLORS: Record<string, string> = {
  center: '#D4A017',
  residential: '#2E86C1',
  industrial: '#7F8C8D',
  green: '#27AE60',
  unknown: '#415A77',
};

// ============ UTILITY ============

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ============ MAIN COMPONENT ============

export function MapProjection() {
  const [searchParams] = useSearchParams();
  const sessionCode = searchParams.get('session');
  const isProjectorMode = searchParams.get('projector') === 'true';

  const { state, isConnected, isSessionJoined } = useGameState({ sessionCode });

  // Map animations hook
  const {
    animationQueue,
    removeFromQueue,
  } = useMapAnimations({ sessionCode: sessionCode || '', enabled: !!sessionCode });

  // Animation states
  const [fogLayers, setFogLayers] = useState([1, 1, 1, 1]);
  const [showCrisisFlash, setShowCrisisFlash] = useState(false);
  const [showTypewriter, setShowTypewriter] = useState(false);
  const [typewriterText, setTypewriterText] = useState('');
  const [prevZoneLevels, setPrevZoneLevels] = useState<Record<string, number>>({});
  const [animatingBuildings, setAnimatingBuildings] = useState<Record<string, boolean>>({});
  const [newCandles, setNewCandles] = useState<Set<number>>(new Set());
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [highlightedZones, setHighlightedZones] = useState<Set<ZoneName>>(new Set());

  const prevCandlesRef = useRef<number[]>([]);
  const prevCrisisStateRef = useRef(false);
  const messageShownRef = useRef(false);

  // Handle animation completion
  const handleAnimationComplete = useCallback((animationId: string) => {
    removeFromQueue(animationId);
  }, [removeFromQueue]);

  // Update highlighted zones based on active animations
  useEffect(() => {
    const resourceAnimations = animationQueue.filter(a => a.type === 'resource-flow');
    const zones = new Set<ZoneName>();
    resourceAnimations.forEach(anim => {
      const data = anim.data as ResourceContributedEvent;
      zones.add(data.zone);
    });
    setHighlightedZones(zones);
  }, [animationQueue]);

  // Handle fog reveal animation - sequential layer fade
  useEffect(() => {
    if (state?.fogRevealed) {
      // Fade layers out sequentially: back to front
      const timers = [
        setTimeout(() => setFogLayers([0.7, 1, 1, 1]), 300),
        setTimeout(() => setFogLayers([0.3, 0.5, 1, 1]), 800),
        setTimeout(() => setFogLayers([0, 0.2, 0.5, 1]), 1500),
        setTimeout(() => setFogLayers([0, 0, 0.2, 0.5]), 2200),
        setTimeout(() => setFogLayers([0, 0, 0, 0]), 3000),
      ];
      return () => timers.forEach(clearTimeout);
    } else {
      setFogLayers([1, 1, 1, 1]);
    }
  }, [state?.fogRevealed]);

  // Detect zone level changes for building animations
  useEffect(() => {
    if (!state) return;

    const zones = state.zones;
    const newAnimating: Record<string, boolean> = {};

    Object.entries(zones).forEach(([zoneName, zoneData]) => {
      const prevLevel = prevZoneLevels[zoneName] ?? 0;
      const currentLevel = 'level' in zoneData ? zoneData.level : 0;

      if (currentLevel > prevLevel) {
        newAnimating[zoneName] = true;
        setTimeout(() => {
          setAnimatingBuildings((prev) => ({ ...prev, [zoneName]: false }));
        }, 2000);
      }
    });

    if (Object.keys(newAnimating).length > 0) {
      setAnimatingBuildings((prev) => ({ ...prev, ...newAnimating }));
    }

    setPrevZoneLevels({
      center: zones.center.level,
      residential: zones.residential.level,
      industrial: zones.industrial.level,
      green: zones.green.level,
    });
  }, [state?.zones, prevZoneLevels]);

  // Detect new candles for match strike animation
  useEffect(() => {
    if (!state) return;

    const currentCandles = state.candlesLit;
    const prevCandles = prevCandlesRef.current;

    const newOnes = currentCandles.filter((c) => !prevCandles.includes(c));
    if (newOnes.length > 0) {
      setNewCandles(new Set(newOnes));
      setTimeout(() => setNewCandles(new Set()), 1500);
    }

    prevCandlesRef.current = currentCandles;
  }, [state?.candlesLit]);

  // Crisis flash effect
  useEffect(() => {
    if (!state) return;

    const hasCrisis = state.currentAct === 3 && state.currentScene === 8;
    if (hasCrisis && !prevCrisisStateRef.current) {
      setShowCrisisFlash(true);
      setTimeout(() => setShowCrisisFlash(false), 500);
    }
    prevCrisisStateRef.current = hasCrisis;
  }, [state?.currentAct, state?.currentScene]);

  // Typewriter message for Act III scene 7
  useEffect(() => {
    if (!state) return;

    const shouldShow = state.currentAct === 3 && state.currentScene === 7;

    if (shouldShow && !messageShownRef.current) {
      messageShownRef.current = true;
      setShowTypewriter(true);
      setTypewriterText('');

      let index = 0;
      const interval = setInterval(() => {
        if (index < MESSAGE_TEXT.length) {
          setTypewriterText(MESSAGE_TEXT.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
          // Hide after 3 seconds
          setTimeout(() => setShowTypewriter(false), 3000);
        }
      }, 50);

      return () => clearInterval(interval);
    }
  }, [state?.currentAct, state?.currentScene]);

  // Determine active zone based on current scene
  useEffect(() => {
    if (!state) return;

    // Map scenes to zones being discussed
    const sceneZoneMap: Record<number, string> = {
      3: 'center',
      4: 'residential',
      5: 'industrial',
      6: 'green',
      7: 'unknown',
    };
    setActiveZone(sceneZoneMap[state.currentScene] || null);
  }, [state?.currentScene]);

  // Get current act and scene info from scenario
  const currentActData = useMemo(() => {
    if (!state) return null;
    return scenarioData.acts.find((a) => a.id === state.currentAct);
  }, [state?.currentAct]);

  const currentSceneData = useMemo(() => {
    if (!currentActData || !state) return null;
    return currentActData.scenes.find((s) => s.id === state.currentScene);
  }, [currentActData, state?.currentScene]);

  // Check if we're in Act V for floating promises
  const showFloatingPromises = state?.currentAct === 5;

  if (!isConnected || !isSessionJoined) {
    return (
      <div className="fixed inset-0 bg-[#0D1B2A] flex items-center justify-center">
        <div className="text-[#778DA9] text-2xl animate-pulse">
          {!isConnected ? 'Подключение к серверу...' : 'Присоединение к сессии...'}
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="fixed inset-0 bg-[#0D1B2A] flex items-center justify-center">
        <div className="text-[#778DA9] text-2xl animate-pulse">Загрузка данных...</div>
      </div>
    );
  }

  const connectedCount = state.roles.filter((r) => r.connected).length;
  const isTimerCritical = state.timer.running && state.timer.remainingSec < 60;

  return (
    <div className="fixed inset-0 bg-[#0D1B2A] overflow-hidden select-none">
      {/* Crisis flash overlay */}
      <div
        className="fixed inset-0 bg-red-600 pointer-events-none z-40 transition-opacity duration-200"
        style={{ opacity: showCrisisFlash ? 0.3 : 0 }}
      />

      {/* Typewriter overlay */}
      {showTypewriter && (
        <div className="fixed inset-0 bg-[#0D1B2A]/85 z-50 flex items-center justify-center p-12">
          <div className="max-w-3xl text-center">
            <p
              className="text-[#E0E1DD] text-2xl leading-relaxed whitespace-pre-line"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              {typewriterText}
              <span className="animate-blink">|</span>
            </p>
          </div>
        </div>
      )}

      {/* Main map area - 85% */}
      <div className="h-[85vh] flex items-center justify-center p-4 relative">
        <svg
          viewBox="0 0 1200 800"
          className="w-full h-full max-w-[1600px]"
          style={{ filter: 'drop-shadow(0 0 40px rgba(13, 27, 42, 0.8))' }}
        >
          <defs>
            {/* Glow filters */}
            <filter id="glow-gold" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="glow-candle" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="8" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="glow-match" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="15" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="zone-pulse" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="fog-blur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" />
            </filter>

            {/* River pattern */}
            <linearGradient id="riverGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1A5276" />
              <stop offset="50%" stopColor="#2E86C1" />
              <stop offset="100%" stopColor="#1A5276" />
            </linearGradient>

            {/* Fog gradients */}
            <radialGradient id="fogGradient1" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#1B263B" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#0D1B2A" stopOpacity="0.3" />
            </radialGradient>
            <radialGradient id="fogGradient2" cx="40%" cy="60%" r="60%">
              <stop offset="0%" stopColor="#415A77" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#1B263B" stopOpacity="0.2" />
            </radialGradient>
            <radialGradient id="fogGradient3" cx="60%" cy="40%" r="50%">
              <stop offset="0%" stopColor="#778DA9" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#415A77" stopOpacity="0.1" />
            </radialGradient>

            {/* Zone gradients */}
            <radialGradient id="centerGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F4D03F" />
              <stop offset="100%" stopColor="#D4A017" />
            </radialGradient>
            <linearGradient id="residentialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3498DB" />
              <stop offset="100%" stopColor="#2E86C1" />
            </linearGradient>
            <linearGradient id="industrialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7F8C8D" />
              <stop offset="100%" stopColor="#5D6D7E" />
            </linearGradient>
            <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2ECC71" />
              <stop offset="100%" stopColor="#27AE60" />
            </linearGradient>
          </defs>

          {/* Background terrain */}
          <rect x="0" y="0" width="1200" height="800" fill="#0D1B2A" />

          {/* Terrain texture lines */}
          <g opacity="0.1" stroke="#415A77" strokeWidth="0.5">
            {Array.from({ length: 40 }, (_, i) => (
              <line key={`h${i}`} x1="0" y1={i * 20} x2="1200" y2={i * 20} />
            ))}
            {Array.from({ length: 60 }, (_, i) => (
              <line key={`v${i}`} x1={i * 20} y1="0" x2={i * 20} y2="800" />
            ))}
          </g>

          {/* GREEN BELT - Left side */}
          <GreenZone
            level={state.zones.green.level}
            isActive={activeZone === 'green'}
            isAnimating={animatingBuildings.green}
          />

          {/* River */}
          <path
            d="M 50 200 Q 150 250 120 350 Q 90 450 150 550 Q 200 650 100 750"
            fill="none"
            stroke="url(#riverGradient)"
            strokeWidth="20"
            strokeLinecap="round"
            opacity="0.8"
          >
            <animate
              attributeName="d"
              dur="8s"
              repeatCount="indefinite"
              values="
                M 50 200 Q 150 250 120 350 Q 90 450 150 550 Q 200 650 100 750;
                M 50 200 Q 130 270 120 350 Q 110 430 150 550 Q 180 670 100 750;
                M 50 200 Q 150 250 120 350 Q 90 450 150 550 Q 200 650 100 750
              "
            />
          </path>

          {/* RESIDENTIAL - Top right */}
          <ResidentialZone
            level={state.zones.residential.level}
            isActive={activeZone === 'residential'}
            isAnimating={animatingBuildings.residential}
          />

          {/* INDUSTRIAL - Bottom right */}
          <IndustrialZone
            level={state.zones.industrial.level}
            isActive={activeZone === 'industrial'}
            isAnimating={animatingBuildings.industrial}
          />

          {/* CENTER - Middle */}
          <CenterZone
            level={state.zones.center.level}
            isActive={activeZone === 'center'}
            isAnimating={animatingBuildings.center}
          />

          {/* UNKNOWN TERRITORY - Top left with enhanced fog */}
          <UnknownZone
            revealed={state.zones.unknown.revealed}
            fogLayers={fogLayers}
            isActive={activeZone === 'unknown'}
          />

          {/* Candles */}
          <CandlesOverlay
            candlesLit={state.candlesLit}
            roles={state.roles}
            newCandles={newCandles}
          />

          {/* Zone Resource Indicators */}
          {!isProjectorMode && (
            <>
              <ZoneResourceIndicator
                zone="center"
                resources={state.zones.center.resources}
                isAnimating={highlightedZones.has('center')}
              />
              <ZoneResourceIndicator
                zone="residential"
                resources={state.zones.residential.resources}
                isAnimating={highlightedZones.has('residential')}
              />
              <ZoneResourceIndicator
                zone="industrial"
                resources={state.zones.industrial.resources}
                isAnimating={highlightedZones.has('industrial')}
              />
              <ZoneResourceIndicator
                zone="green"
                resources={state.zones.green.resources}
                isAnimating={highlightedZones.has('green')}
              />
            </>
          )}

          {/* Event Overlay */}
          {state.activeEvent && (
            <EventOverlay activeEvent={state.activeEvent} />
          )}

          {/* Resource Flow Animations */}
          {animationQueue
            .filter(a => a.type === 'resource-flow')
            .map(animation => {
              const data = animation.data as ResourceContributedEvent;
              return (
                <ResourceFlowAnimation
                  key={animation.id}
                  zone={data.zone}
                  resource={data.resource}
                  amount={data.amount}
                  roleName={data.roleName}
                  onComplete={() => handleAnimationComplete(animation.id)}
                />
              );
            })}

          {/* Zone Upgrade Animations */}
          {animationQueue
            .filter(a => a.type === 'zone-upgrade')
            .map(animation => {
              const data = animation.data as ZoneUpgradedEvent;
              return (
                <ZoneUpgradeAnimation
                  key={animation.id}
                  zone={data.zone}
                  fromLevel={data.fromLevel}
                  toLevel={data.toLevel}
                  onComplete={() => handleAnimationComplete(animation.id)}
                />
              );
            })}
        </svg>

        {/* Floating promises overlay */}
        {showFloatingPromises && (
          <FloatingPromises promises={state.promises} roles={state.roles} />
        )}
      </div>

      {/* Bottom status bar - 15% */}
      <div className="h-[15vh] bg-gradient-to-t from-[#1B263B] to-transparent px-8 flex items-center justify-between">
        {/* Left: Act & Scene */}
        <div className="flex-1">
          <div className="text-[#E0E1DD] text-2xl font-semibold">
            Акт {state.currentAct}: {currentActData?.title || '—'}
          </div>
          <div className="text-[#778DA9] text-lg mt-1">
            Сцена: {currentSceneData?.title || '—'}
          </div>
        </div>

        {/* Center: Timer */}
        <div className="flex-1 flex justify-center">
          {state.timer.running ? (
            <div
              className={`text-6xl font-mono font-bold transition-all ${
                isTimerCritical ? 'text-red-500 animate-pulse' : 'text-[#E0E1DD]'
              }`}
            >
              {formatTime(state.timer.remainingSec)}
            </div>
          ) : (
            <div className="text-4xl font-mono text-[#415A77]">--:--</div>
          )}
        </div>

        {/* Right: Role silhouettes */}
        <div className="flex-1 flex justify-end items-center gap-4">
          <RoleSilhouettes roles={state.roles} />
          <div className="text-[#E0E1DD] text-xl ml-4">
            <span className="font-bold text-emerald-400">{connectedCount}</span>/20
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 0.8s infinite;
        }

        @keyframes float-up {
          0% {
            transform: translateY(100%) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 0.6;
          }
          90% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(-100vh) translateX(var(--sway, 20px));
            opacity: 0;
          }
        }

        @keyframes sway {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(15px); }
          75% { transform: translateX(-15px); }
        }

        @keyframes building-rise {
          0% {
            transform: scaleY(0);
            transform-origin: bottom;
          }
          70% {
            transform: scaleY(1.1);
            transform-origin: bottom;
          }
          85% {
            transform: scaleY(0.95);
            transform-origin: bottom;
          }
          100% {
            transform: scaleY(1);
            transform-origin: bottom;
          }
        }

        @keyframes match-strike {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          20% {
            transform: scale(3);
            opacity: 1;
            filter: brightness(2);
          }
          40% {
            transform: scale(1.5);
            opacity: 1;
            filter: brightness(1.5);
          }
          100% {
            transform: scale(1);
            opacity: 1;
            filter: brightness(1);
          }
        }

        @keyframes zone-glow {
          0%, 100% {
            filter: drop-shadow(0 0 5px currentColor);
            opacity: 0.8;
          }
          50% {
            filter: drop-shadow(0 0 20px currentColor);
            opacity: 1;
          }
        }

        @keyframes flame-flicker {
          0%, 100% {
            transform: scaleY(1) scaleX(1);
            opacity: 0.9;
          }
          25% {
            transform: scaleY(1.1) scaleX(0.95);
            opacity: 1;
          }
          50% {
            transform: scaleY(0.95) scaleX(1.05);
            opacity: 0.85;
          }
          75% {
            transform: scaleY(1.05) scaleX(0.98);
            opacity: 0.95;
          }
        }

        .building-animate {
          animation: building-rise 1.5s ease-out forwards;
        }

        .match-strike-animate {
          animation: match-strike 1.5s ease-out forwards;
        }

        .zone-active {
          animation: zone-glow 2s ease-in-out infinite;
        }

        .flame-flicker {
          animation: flame-flicker 0.4s ease-in-out infinite;
        }

        /* Resource indicator animations */
        @keyframes indicator-pulse {
          0%, 100% {
            transform: scale(1);
            filter: brightness(1);
          }
          50% {
            transform: scale(1.05);
            filter: brightness(1.2);
          }
        }

        .indicator-pulse {
          animation: indicator-pulse 0.5s ease-in-out 3;
        }

        @keyframes resource-value-pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.2);
          }
        }

        .resource-value-pulse {
          animation: resource-value-pulse 0.5s ease-in-out;
        }

        .resource-icon-pulse {
          animation: resource-value-pulse 0.5s ease-in-out;
        }

        /* Plus amount animation */
        @keyframes plus-float-up {
          0% {
            transform: translateY(0);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateY(-30px);
            opacity: 0;
          }
        }

        .plus-amount-animation {
          animation: plus-float-up 1.2s ease-out forwards;
        }

        /* Event overlay pulse */
        @keyframes event-pulse {
          0%, 100% {
            opacity: 0.2;
          }
          50% {
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
}

// ============ ZONE COMPONENTS ============

interface ZoneProps {
  level: number;
  isActive: boolean;
  isAnimating: boolean;
}

function CenterZone({ level, isActive, isAnimating }: ZoneProps) {
  return (
    <g transform="translate(550, 350)">
      {/* Base circle with pulse effect */}
      <circle
        cx="50"
        cy="50"
        r="80"
        fill="url(#centerGradient)"
        opacity={0.3 + level * 0.2}
        filter={isActive ? 'url(#zone-pulse)' : 'url(#glow-gold)'}
        className={isActive ? 'zone-active' : ''}
        style={{ color: '#D4A017' }}
      />

      {/* Active zone pulse ring */}
      {isActive && (
        <circle
          cx="50"
          cy="50"
          r="85"
          fill="none"
          stroke="#D4A017"
          strokeWidth="2"
          opacity="0.6"
        >
          <animate
            attributeName="r"
            values="85;95;85"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.6;0.2;0.6"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Zone label */}
      <text x="50" y="140" textAnchor="middle" fill="#D4A017" fontSize="18" fontWeight="bold">
        ЦЕНТР
      </text>

      {level === 0 && (
        <text x="50" y="55" textAnchor="middle" fill="#D4A017" fontSize="14" opacity="0.7">
          Пустошь
        </text>
      )}

      {level >= 1 && (
        <g className={isAnimating && level === 1 ? 'building-animate' : ''}>
          {/* Foundation markers */}
          <rect x="20" y="30" width="60" height="40" fill="none" stroke="#D4A017" strokeWidth="2" strokeDasharray="4" />
        </g>
      )}

      {level >= 2 && (
        <g className={isAnimating && level === 2 ? 'building-animate' : ''} style={{ transformOrigin: '50px 70px' }}>
          {/* Basic tower */}
          <rect x="35" y="20" width="30" height="50" fill="#B8860B" />
          <polygon points="35,20 50,0 65,20" fill="#D4A017" />
        </g>
      )}

      {level >= 3 && (
        <>
          <g className={isAnimating ? 'building-animate' : ''} style={{ transformOrigin: '25px 70px', animationDelay: '0ms' }}>
            {/* Left wing */}
            <rect x="15" y="40" width="20" height="30" fill="#B8860B" />
          </g>
          <g className={isAnimating ? 'building-animate' : ''} style={{ transformOrigin: '75px 70px', animationDelay: '200ms' }}>
            {/* Right wing */}
            <rect x="65" y="40" width="20" height="30" fill="#B8860B" />
          </g>
          <g className={isAnimating ? 'building-animate' : ''} style={{ transformOrigin: '50px 35px', animationDelay: '400ms' }}>
            {/* Dome and windows */}
            <circle cx="50" cy="35" r="8" fill="#F4D03F" />
            <rect x="40" y="30" width="6" height="8" fill="#0D1B2A" />
            <rect x="54" y="30" width="6" height="8" fill="#0D1B2A" />
            <rect x="40" y="45" width="6" height="8" fill="#0D1B2A" />
            <rect x="54" y="45" width="6" height="8" fill="#0D1B2A" />
          </g>
        </>
      )}
    </g>
  );
}

function ResidentialZone({ level, isActive, isAnimating }: ZoneProps) {
  return (
    <g transform="translate(800, 100)">
      {/* Zone area */}
      <path
        d="M 0 50 Q 100 0 250 30 Q 320 80 300 200 Q 250 280 100 250 Q 0 200 0 50"
        fill="url(#residentialGradient)"
        opacity={0.2 + level * 0.15}
        className={isActive ? 'zone-active' : ''}
        style={{ color: '#2E86C1' }}
      />

      {/* Active zone pulse */}
      {isActive && (
        <path
          d="M 0 50 Q 100 0 250 30 Q 320 80 300 200 Q 250 280 100 250 Q 0 200 0 50"
          fill="none"
          stroke="#2E86C1"
          strokeWidth="2"
        >
          <animate
            attributeName="stroke-width"
            values="2;4;2"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.8;0.3;0.8"
            dur="2s"
            repeatCount="indefinite"
          />
        </path>
      )}

      {/* Zone label */}
      <text x="150" y="290" textAnchor="middle" fill="#2E86C1" fontSize="16" fontWeight="bold">
        ЖИЛОЙ КВАРТАЛ
      </text>

      {level === 0 && (
        <text x="150" y="140" textAnchor="middle" fill="#2E86C1" fontSize="14" opacity="0.7">
          Пустая земля
        </text>
      )}

      {level >= 1 && (
        <g className={isAnimating && level === 1 ? 'building-animate' : ''}>
          {/* Foundation outlines */}
          <rect x="50" y="80" width="40" height="30" fill="none" stroke="#2E86C1" strokeWidth="2" strokeDasharray="4" />
          <rect x="120" y="100" width="40" height="30" fill="none" stroke="#2E86C1" strokeWidth="2" strokeDasharray="4" />
          <rect x="200" y="90" width="40" height="30" fill="none" stroke="#2E86C1" strokeWidth="2" strokeDasharray="4" />
        </g>
      )}

      {level >= 2 && (
        <>
          <g className={isAnimating && level === 2 ? 'building-animate' : ''} style={{ transformOrigin: '70px 110px' }}>
            <rect x="50" y="80" width="40" height="30" fill="#5DADE2" />
            <polygon points="50,80 70,60 90,80" fill="#2E86C1" />
          </g>
          <g className={isAnimating && level === 2 ? 'building-animate' : ''} style={{ transformOrigin: '140px 130px', animationDelay: '200ms' }}>
            <rect x="120" y="100" width="40" height="30" fill="#5DADE2" />
            <polygon points="120,100 140,80 160,100" fill="#2E86C1" />
          </g>
        </>
      )}

      {level >= 3 && (
        <>
          <g className={isAnimating ? 'building-animate' : ''} style={{ transformOrigin: '220px 120px', animationDelay: '0ms' }}>
            <rect x="200" y="90" width="40" height="30" fill="#5DADE2" />
            <polygon points="200,90 220,70 240,90" fill="#2E86C1" />
          </g>
          <g className={isAnimating ? 'building-animate' : ''} style={{ transformOrigin: '105px 190px', animationDelay: '200ms' }}>
            <rect x="80" y="150" width="50" height="40" fill="#5DADE2" />
            <polygon points="80,150 105,120 130,150" fill="#2E86C1" />
          </g>
          <g className={isAnimating ? 'building-animate' : ''} style={{ transformOrigin: '185px 200px', animationDelay: '400ms' }}>
            <rect x="160" y="160" width="50" height="40" fill="#5DADE2" />
            <polygon points="160,160 185,130 210,160" fill="#2E86C1" />
          </g>
          {/* Windows */}
          <rect x="58" y="90" width="8" height="10" fill="#0D1B2A" />
          <rect x="74" y="90" width="8" height="10" fill="#0D1B2A" />
          <rect x="128" y="110" width="8" height="10" fill="#0D1B2A" />
          <rect x="144" y="110" width="8" height="10" fill="#0D1B2A" />
        </>
      )}
    </g>
  );
}

function IndustrialZone({ level, isActive, isAnimating }: ZoneProps) {
  return (
    <g transform="translate(750, 500)">
      {/* Zone area */}
      <path
        d="M 50 0 Q 200 -20 350 50 Q 380 150 300 250 Q 150 280 50 200 Q 0 100 50 0"
        fill="url(#industrialGradient)"
        opacity={0.2 + level * 0.15}
        className={isActive ? 'zone-active' : ''}
        style={{ color: '#7F8C8D' }}
      />

      {/* Active zone pulse */}
      {isActive && (
        <path
          d="M 50 0 Q 200 -20 350 50 Q 380 150 300 250 Q 150 280 50 200 Q 0 100 50 0"
          fill="none"
          stroke="#7F8C8D"
          strokeWidth="2"
        >
          <animate
            attributeName="stroke-width"
            values="2;4;2"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.8;0.3;0.8"
            dur="2s"
            repeatCount="indefinite"
          />
        </path>
      )}

      {/* Zone label */}
      <text x="180" y="270" textAnchor="middle" fill="#5D6D7E" fontSize="16" fontWeight="bold">
        ПРОМЗОНА
      </text>

      {level === 0 && (
        <text x="180" y="120" textAnchor="middle" fill="#7F8C8D" fontSize="14" opacity="0.7">
          Пустырь
        </text>
      )}

      {level >= 1 && (
        <g className={isAnimating && level === 1 ? 'building-animate' : ''}>
          {/* Foundation markers */}
          <rect x="80" y="60" width="60" height="80" fill="none" stroke="#7F8C8D" strokeWidth="2" strokeDasharray="4" />
          <rect x="180" y="80" width="80" height="60" fill="none" stroke="#7F8C8D" strokeWidth="2" strokeDasharray="4" />
        </g>
      )}

      {level >= 2 && (
        <g className={isAnimating && level === 2 ? 'building-animate' : ''} style={{ transformOrigin: '110px 140px' }}>
          {/* Basic factory */}
          <rect x="80" y="60" width="60" height="80" fill="#85929E" />
          {/* Chimney */}
          <rect x="100" y="30" width="15" height="30" fill="#5D6D7E" />
          {/* Smoke animation */}
          <g>
            <circle cx="107" cy="20" r="8" fill="#ABB2B9" opacity="0.6">
              <animate attributeName="cy" values="20;-5;20" dur="3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite" />
              <animate attributeName="r" values="8;15;8" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="112" cy="15" r="5" fill="#ABB2B9" opacity="0.4">
              <animate attributeName="cy" values="15;-10;15" dur="3.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0;0.4" dur="3.5s" repeatCount="indefinite" />
            </circle>
          </g>
        </g>
      )}

      {level >= 3 && (
        <>
          <g className={isAnimating ? 'building-animate' : ''} style={{ transformOrigin: '220px 140px', animationDelay: '0ms' }}>
            {/* Second factory */}
            <rect x="180" y="80" width="80" height="60" fill="#85929E" />
            <rect x="200" y="50" width="20" height="30" fill="#5D6D7E" />
            <rect x="230" y="40" width="20" height="40" fill="#5D6D7E" />
          </g>
          <g className={isAnimating ? 'building-animate' : ''} style={{ animationDelay: '200ms' }}>
            {/* Gears */}
            <g>
              <circle cx="210" cy="110" r="15" fill="none" stroke="#2C3E50" strokeWidth="3">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 210 110"
                  to="360 210 110"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx="240" cy="110" r="12" fill="none" stroke="#2C3E50" strokeWidth="3">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="360 240 110"
                  to="0 240 110"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          </g>
          {/* More smoke */}
          <circle cx="210" cy="35" r="10" fill="#ABB2B9" opacity="0.5">
            <animate attributeName="cy" values="35;5;35" dur="4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="4s" repeatCount="indefinite" />
            <animate attributeName="r" values="10;20;10" dur="4s" repeatCount="indefinite" />
          </circle>
          <circle cx="240" cy="25" r="12" fill="#ABB2B9" opacity="0.4">
            <animate attributeName="cy" values="25;-10;25" dur="5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0;0.4" dur="5s" repeatCount="indefinite" />
            <animate attributeName="r" values="12;22;12" dur="5s" repeatCount="indefinite" />
          </circle>
        </>
      )}
    </g>
  );
}

function GreenZone({ level, isActive, isAnimating }: ZoneProps) {
  return (
    <g transform="translate(50, 250)">
      {/* Zone area */}
      <path
        d="M 50 0 Q 150 -50 250 50 Q 300 200 250 400 Q 150 500 50 450 Q -20 300 50 0"
        fill="url(#greenGradient)"
        opacity={0.2 + level * 0.15}
        className={isActive ? 'zone-active' : ''}
        style={{ color: '#27AE60' }}
      />

      {/* Active zone pulse */}
      {isActive && (
        <path
          d="M 50 0 Q 150 -50 250 50 Q 300 200 250 400 Q 150 500 50 450 Q -20 300 50 0"
          fill="none"
          stroke="#27AE60"
          strokeWidth="2"
        >
          <animate
            attributeName="stroke-width"
            values="2;4;2"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.8;0.3;0.8"
            dur="2s"
            repeatCount="indefinite"
          />
        </path>
      )}

      {/* Zone label */}
      <text x="150" y="480" textAnchor="middle" fill="#27AE60" fontSize="16" fontWeight="bold">
        ЗЕЛЁНЫЙ ПОЯС
      </text>

      {level === 0 && (
        <text x="150" y="200" textAnchor="middle" fill="#27AE60" fontSize="14" opacity="0.7">
          Дикая природа
        </text>
      )}

      {level >= 1 && (
        <g className={isAnimating && level === 1 ? 'building-animate' : ''}>
          {/* Saplings / markers */}
          <line x1="100" y1="120" x2="100" y2="100" stroke="#27AE60" strokeWidth="3" />
          <line x1="180" y1="180" x2="180" y2="160" stroke="#27AE60" strokeWidth="3" />
          <line x1="120" y1="280" x2="120" y2="260" stroke="#27AE60" strokeWidth="3" />
        </g>
      )}

      {level >= 2 && (
        <>
          <g className={isAnimating && level === 2 ? 'building-animate' : ''} style={{ transformOrigin: '100px 145px' }}>
            {/* First tree */}
            <polygon points="100,100 85,130 115,130" fill="#2ECC71" />
            <rect x="97" y="130" width="6" height="15" fill="#8B4513" />
          </g>

          <g className={isAnimating && level === 2 ? 'building-animate' : ''} style={{ transformOrigin: '180px 205px', animationDelay: '200ms' }}>
            {/* Second tree */}
            <polygon points="180,160 165,190 195,190" fill="#2ECC71" />
            <rect x="177" y="190" width="6" height="15" fill="#8B4513" />
          </g>
        </>
      )}

      {level >= 3 && (
        <>
          {/* Full forest with tree sway animation */}
          <g className={isAnimating ? 'building-animate' : ''} style={{ transformOrigin: '100px 150px', animationDelay: '0ms' }}>
            <g>
              <polygon points="100,80 70,130 130,130" fill="#27AE60">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="-1 100 130;1 100 130;-1 100 130"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </polygon>
              <polygon points="100,60 80,100 120,100" fill="#2ECC71">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="-2 100 100;2 100 100;-2 100 100"
                  dur="3.5s"
                  repeatCount="indefinite"
                />
              </polygon>
              <rect x="95" y="130" width="10" height="20" fill="#8B4513" />
            </g>
          </g>

          <g className={isAnimating ? 'building-animate' : ''} style={{ transformOrigin: '180px 210px', animationDelay: '200ms' }}>
            <g>
              <polygon points="180,140 150,190 210,190" fill="#27AE60">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="1 180 190;-1 180 190;1 180 190"
                  dur="4.5s"
                  repeatCount="indefinite"
                />
              </polygon>
              <polygon points="180,120 160,160 200,160" fill="#2ECC71">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="2 180 160;-2 180 160;2 180 160"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </polygon>
              <rect x="175" y="190" width="10" height="20" fill="#8B4513" />
            </g>
          </g>

          <g className={isAnimating ? 'building-animate' : ''} style={{ transformOrigin: '120px 320px', animationDelay: '400ms' }}>
            <polygon points="120,250 90,300 150,300" fill="#27AE60" />
            <polygon points="120,230 100,270 140,270" fill="#2ECC71" />
            <rect x="115" y="300" width="10" height="20" fill="#8B4513" />
          </g>

          <g className={isAnimating ? 'building-animate' : ''} style={{ transformOrigin: '200px 390px', animationDelay: '600ms' }}>
            <polygon points="200,320 170,370 230,370" fill="#27AE60" />
            <polygon points="200,300 180,340 220,340" fill="#2ECC71" />
            <rect x="195" y="370" width="10" height="20" fill="#8B4513" />
          </g>

          {/* Flowers with subtle animation */}
          <circle cx="80" cy="350" r="5" fill="#E74C3C">
            <animate attributeName="r" values="5;6;5" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="90" cy="360" r="4" fill="#F1C40F">
            <animate attributeName="r" values="4;5;4" dur="2.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="220" cy="280" r="5" fill="#9B59B6">
            <animate attributeName="r" values="5;6;5" dur="1.8s" repeatCount="indefinite" />
          </circle>
        </>
      )}
    </g>
  );
}

interface UnknownZoneProps {
  revealed: boolean;
  fogLayers: number[];
  isActive: boolean;
}

function UnknownZone({ revealed, fogLayers, isActive }: UnknownZoneProps) {
  return (
    <g transform="translate(200, 50)">
      {/* Zone area */}
      <path
        d="M 0 50 Q 100 0 250 20 Q 350 80 320 200 Q 250 280 100 260 Q 0 200 0 50"
        fill="#1B263B"
        opacity="0.5"
        className={isActive ? 'zone-active' : ''}
        style={{ color: '#415A77' }}
      />

      {/* Active zone pulse */}
      {isActive && (
        <path
          d="M 0 50 Q 100 0 250 20 Q 350 80 320 200 Q 250 280 100 260 Q 0 200 0 50"
          fill="none"
          stroke="#415A77"
          strokeWidth="2"
        >
          <animate
            attributeName="stroke-width"
            values="2;4;2"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.8;0.3;0.8"
            dur="2s"
            repeatCount="indefinite"
          />
        </path>
      )}

      {/* Ruins (visible when revealed) */}
      <g
        style={{
          opacity: revealed ? 1 : 0,
          transition: 'opacity 2s ease-in-out',
          transitionDelay: '1s',
        }}
      >
        {/* Broken walls */}
        <rect x="80" y="80" width="40" height="60" fill="#4A4A4A" />
        <rect x="85" y="75" width="30" height="20" fill="#3D3D3D" transform="rotate(-5 100 85)" />

        <rect x="180" y="100" width="50" height="50" fill="#4A4A4A" />
        <polygon points="180,100 205,70 230,100" fill="#3D3D3D" />

        <rect x="130" y="160" width="60" height="40" fill="#4A4A4A" opacity="0.8" />

        {/* Rubble */}
        <circle cx="100" cy="180" r="8" fill="#5A5A5A" />
        <circle cx="220" cy="170" r="10" fill="#5A5A5A" />
        <circle cx="160" cy="220" r="6" fill="#5A5A5A" />

        {/* Inscription */}
        <text x="160" y="250" textAnchor="middle" fill="#778DA9" fontSize="12" fontStyle="italic">
          "Основан с надеждой.
        </text>
        <text x="160" y="268" textAnchor="middle" fill="#778DA9" fontSize="12" fontStyle="italic">
          Разрушен амбициями."
        </text>
      </g>

      {/* Enhanced fog overlay with multiple layers */}
      {/* Layer 1 - Deepest, slowest */}
      <ellipse
        cx="160"
        cy="140"
        rx="190"
        ry="140"
        fill="url(#fogGradient1)"
        filter="url(#fog-blur)"
        style={{
          opacity: fogLayers[0],
          transition: 'opacity 0.8s ease-in-out, filter 0.8s ease-in-out',
          filter: fogLayers[0] < 0.5 ? 'blur(10px)' : 'none',
        }}
      >
        <animate
          attributeName="cx"
          values="160;180;160"
          dur="12s"
          repeatCount="indefinite"
        />
      </ellipse>

      {/* Layer 2 */}
      <ellipse
        cx="120"
        cy="120"
        rx="140"
        ry="100"
        fill="url(#fogGradient2)"
        style={{
          opacity: fogLayers[1] * 0.8,
          transition: 'opacity 0.8s ease-in-out, filter 0.8s ease-in-out',
          filter: fogLayers[1] < 0.5 ? 'blur(8px)' : 'none',
        }}
      >
        <animate
          attributeName="cx"
          values="120;150;120"
          dur="9s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="cy"
          values="120;130;120"
          dur="7s"
          repeatCount="indefinite"
        />
      </ellipse>

      {/* Layer 3 */}
      <ellipse
        cx="200"
        cy="160"
        rx="100"
        ry="80"
        fill="url(#fogGradient3)"
        style={{
          opacity: fogLayers[2] * 0.7,
          transition: 'opacity 0.8s ease-in-out, filter 0.8s ease-in-out',
          filter: fogLayers[2] < 0.5 ? 'blur(6px)' : 'none',
        }}
      >
        <animate
          attributeName="cx"
          values="200;170;200"
          dur="8s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="cy"
          values="160;145;160"
          dur="6s"
          repeatCount="indefinite"
        />
      </ellipse>

      {/* Layer 4 - Front, fastest (wisps) */}
      <g
        style={{
          opacity: fogLayers[3] * 0.6,
          transition: 'opacity 0.6s ease-in-out',
        }}
      >
        <ellipse cx="100" cy="100" rx="50" ry="35" fill="#778DA9" opacity="0.4">
          <animate attributeName="cx" values="100;130;100" dur="5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0.2;0.4" dur="4s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="220" cy="180" rx="60" ry="40" fill="#778DA9" opacity="0.35">
          <animate attributeName="cx" values="220;190;220" dur="6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.35;0.15;0.35" dur="5s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="160" cy="80" rx="70" ry="30" fill="#415A77" opacity="0.5">
          <animate attributeName="cy" values="80;95;80" dur="7s" repeatCount="indefinite" />
        </ellipse>
      </g>

      {/* Question marks in fog */}
      <text
        x="160"
        y="150"
        textAnchor="middle"
        fill="#415A77"
        fontSize="48"
        fontWeight="bold"
        style={{
          opacity: fogLayers[0] > 0.5 ? 1 : 0,
          transition: 'opacity 1s ease-in-out',
        }}
      >
        ???
      </text>

      {/* Zone label */}
      <text
        x="160"
        y="300"
        textAnchor="middle"
        fill="#415A77"
        fontSize="14"
        fontWeight="bold"
        opacity={fogLayers[0] > 0.5 ? 1 : 0.5}
      >
        НЕИЗВЕДАННАЯ ТЕРРИТОРИЯ
      </text>
    </g>
  );
}

// ============ OVERLAYS ============

interface CandlesOverlayProps {
  candlesLit: number[];
  roles: Array<{ id: number; name: string }>;
  newCandles: Set<number>;
}

function CandlesOverlay({ candlesLit, newCandles }: CandlesOverlayProps) {
  // Position candles based on role's zone
  const candlePositions: Record<number, { x: number; y: number }> = {};

  // Map role IDs to approximate positions by zone
  const roles = rolesData as GameRole[];
  roles.forEach((role, index) => {
    const zonePositions: Record<string, { baseX: number; baseY: number }> = {
      center: { baseX: 580, baseY: 400 },
      residential: { baseX: 920, baseY: 220 },
      industrial: { baseX: 920, baseY: 620 },
      green: { baseX: 180, baseY: 450 },
      unknown: { baseX: 350, baseY: 180 },
    };

    const pos = zonePositions[role.zone] || { baseX: 600, baseY: 400 };
    const offset = (index % 5) * 25;
    const row = Math.floor(index / 5);

    candlePositions[role.id] = {
      x: pos.baseX + offset - 50,
      y: pos.baseY + row * 30,
    };
  });

  return (
    <g>
      {candlesLit.map((candleId) => {
        const pos = candlePositions[candleId] || { x: 600 + candleId * 20, y: 400 };
        const isNew = newCandles.has(candleId);

        return (
          <g
            key={candleId}
            transform={`translate(${pos.x}, ${pos.y})`}
            className={isNew ? 'match-strike-animate' : ''}
          >
            {/* Candle body */}
            <rect x="-5" y="0" width="10" height="25" fill="#F5DEB3" rx="2" />
            <rect x="-4" y="2" width="8" height="21" fill="#FAEBD7" rx="1" />

            {/* Wick */}
            <line x1="0" y1="0" x2="0" y2="-3" stroke="#333" strokeWidth="1" />

            {/* Outer flame glow */}
            <ellipse
              cx="0"
              cy="-10"
              rx="12"
              ry="18"
              fill="#FFA500"
              opacity="0.3"
              filter="url(#glow-candle)"
              className="flame-flicker"
            />

            {/* Main flame */}
            <ellipse
              cx="0"
              cy="-8"
              rx="6"
              ry="12"
              fill="#FFA500"
              filter={isNew ? 'url(#glow-match)' : 'url(#glow-candle)'}
              className="flame-flicker"
            >
              <animate
                attributeName="ry"
                values="12;14;11;13;12"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </ellipse>

            {/* Inner flame */}
            <ellipse cx="0" cy="-7" rx="3" ry="8" fill="#FFFF00" className="flame-flicker">
              <animate
                attributeName="ry"
                values="8;9;7;8"
                dur="0.4s"
                repeatCount="indefinite"
              />
            </ellipse>

            {/* Flame core */}
            <ellipse cx="0" cy="-5" rx="1.5" ry="4" fill="#FFFFFF" opacity="0.8" className="flame-flicker" />
          </g>
        );
      })}
    </g>
  );
}

// ============ FLOATING PROMISES ============

interface FloatingPromisesProps {
  promises: Array<{ roleId: number; text: string }>;
  roles: Array<{ id: number; name: string }>;
}

function FloatingPromises({ promises, roles }: FloatingPromisesProps) {
  const [animatedPromises, setAnimatedPromises] = useState<
    Array<{ id: string; text: string; author: string; x: number; delay: number; duration: number; sway: number }>
  >([]);

  useEffect(() => {
    if (promises.length === 0) return;

    const mapped = promises.map((p, i) => {
      const role = roles.find((r) => r.id === p.roleId);
      return {
        id: `${p.roleId}-${i}-${Date.now()}`,
        text: p.text,
        author: role?.name || 'Неизвестный',
        x: 15 + (i % 4) * 20 + Math.random() * 10,
        delay: i * 3,
        duration: 25 + Math.random() * 10,
        sway: (Math.random() - 0.5) * 60,
      };
    });

    setAnimatedPromises(mapped);
  }, [promises, roles]);

  if (animatedPromises.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {animatedPromises.map((promise) => (
        <div
          key={promise.id}
          className="absolute"
          style={{
            left: `${promise.x}%`,
            bottom: '-10%',
            animation: `float-up ${promise.duration}s linear ${promise.delay}s infinite`,
            '--sway': `${promise.sway}px`,
          } as React.CSSProperties}
        >
          <div
            className="text-white/60 text-lg italic max-w-xs text-center"
            style={{
              fontFamily: 'Georgia, serif',
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              animation: `sway ${5 + Math.random() * 2}s ease-in-out infinite`,
            }}
          >
            "{promise.text}"
          </div>
          <div className="text-[#778DA9]/40 text-sm mt-1 text-center">— {promise.author}</div>
        </div>
      ))}
    </div>
  );
}

// ============ ROLE SILHOUETTES ============

interface RoleSilhouettesProps {
  roles: Array<{ id: number; name: string; connected: boolean }>;
}

function RoleSilhouettes({ roles }: RoleSilhouettesProps) {
  const rolesWithZones = useMemo(() => {
    const gameRoles = rolesData as GameRole[];
    return roles.map((role) => {
      const gameRole = gameRoles.find((gr) => gr.id === role.id);
      return {
        ...role,
        zone: gameRole?.zone || 'unknown',
        shortName: role.name.split(' ').slice(-1)[0],
      };
    });
  }, [roles]);

  return (
    <div className="flex flex-wrap gap-1 max-w-[400px] justify-end">
      {rolesWithZones.map((role) => (
        <div key={role.id} className="group relative">
          <svg
            width="16"
            height="24"
            viewBox="0 0 16 24"
            className="transition-all duration-300"
            style={{
              filter: role.connected ? `drop-shadow(0 0 3px ${ZONE_COLORS[role.zone]})` : 'none',
            }}
          >
            {/* Person silhouette */}
            <circle
              cx="8"
              cy="5"
              r="4"
              fill={role.connected ? ZONE_COLORS[role.zone] : '#415A77'}
              className="transition-colors duration-500"
            />
            <path
              d="M 2 24 L 4 12 L 8 14 L 12 12 L 14 24 Z"
              fill={role.connected ? ZONE_COLORS[role.zone] : '#415A77'}
              className="transition-colors duration-500"
            />
          </svg>

          {/* Tooltip on hover */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#1B263B] rounded text-xs text-[#E0E1DD] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {role.shortName}
            {role.connected && <span className="ml-1 text-emerald-400">●</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
