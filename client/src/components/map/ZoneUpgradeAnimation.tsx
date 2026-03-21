import { useEffect, useState, memo } from 'react';
import type { ZoneName } from '../../types/game-state';

interface ZoneUpgradeAnimationProps {
  zone: ZoneName;
  fromLevel: number;
  toLevel: number;
  onComplete: () => void;
}

const ZONE_CENTER_POSITIONS: Record<ZoneName, { x: number; y: number }> = {
  center: { x: 600, y: 400 },
  residential: { x: 950, y: 200 },
  industrial: { x: 900, y: 600 },
  green: { x: 150, y: 450 },
  unknown: { x: 300, y: 150 },
};

const ZONE_COLORS: Record<ZoneName, string> = {
  center: '#D4A017',
  residential: '#2E86C1',
  industrial: '#7F8C8D',
  green: '#27AE60',
  unknown: '#415A77',
};

const ANIMATION_DURATION = 2500; // ms

type Phase = 'flash' | 'shake' | 'sparkles' | 'levelup' | 'settle';

function ZoneUpgradeAnimationInner({
  zone,
  fromLevel: _fromLevel,
  toLevel,
  onComplete,
}: ZoneUpgradeAnimationProps) {
  // fromLevel can be used for showing "from -> to" transition in future enhancements
  void _fromLevel;
  const [phase, setPhase] = useState<Phase>('flash');
  const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });
  const [sparkles, setSparkles] = useState<Array<{ x: number; y: number; delay: number }>>([]);

  const position = ZONE_CENTER_POSITIONS[zone];
  const color = ZONE_COLORS[zone];

  useEffect(() => {
    // Generate random sparkles
    const newSparkles = Array.from({ length: 12 }, () => ({
      x: (Math.random() - 0.5) * 150,
      y: (Math.random() - 0.5) * 150,
      delay: Math.random() * 0.5,
    }));
    setSparkles(newSparkles);

    // Phase timeline
    const timers = [
      // Flash phase
      setTimeout(() => setPhase('shake'), 200),
      // Shake phase
      setTimeout(() => setPhase('sparkles'), 500),
      // Sparkles phase
      setTimeout(() => setPhase('levelup'), 1200),
      // Level up display
      setTimeout(() => setPhase('settle'), 2000),
      // Complete
      setTimeout(onComplete, ANIMATION_DURATION),
    ];

    // Shake animation
    const shakeInterval = setInterval(() => {
      if (phase === 'shake') {
        setShakeOffset({
          x: (Math.random() - 0.5) * 8,
          y: (Math.random() - 0.5) * 8,
        });
      } else {
        setShakeOffset({ x: 0, y: 0 });
      }
    }, 50);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(shakeInterval);
    };
  }, [onComplete, phase]);

  if (zone === 'unknown') return null;

  return (
    <g
      transform={`translate(${position.x + shakeOffset.x}, ${position.y + shakeOffset.y})`}
      className="zone-upgrade-animation"
    >
      {/* Flash overlay */}
      {phase === 'flash' && (
        <circle cx="0" cy="0" r="120" fill="white" opacity="0.8">
          <animate
            attributeName="opacity"
            values="0.8;0"
            dur="0.2s"
            fill="freeze"
          />
          <animate
            attributeName="r"
            values="80;150"
            dur="0.2s"
            fill="freeze"
          />
        </circle>
      )}

      {/* Expansion ring */}
      {(phase === 'shake' || phase === 'sparkles') && (
        <circle
          cx="0"
          cy="0"
          r="60"
          fill="none"
          stroke={color}
          strokeWidth="4"
          opacity="0.8"
        >
          <animate
            attributeName="r"
            values="60;150"
            dur="0.8s"
            fill="freeze"
          />
          <animate
            attributeName="opacity"
            values="0.8;0"
            dur="0.8s"
            fill="freeze"
          />
          <animate
            attributeName="stroke-width"
            values="4;1"
            dur="0.8s"
            fill="freeze"
          />
        </circle>
      )}

      {/* Sparkles */}
      {(phase === 'sparkles' || phase === 'levelup') && (
        <g>
          {sparkles.map((sparkle, i) => (
            <g key={i} transform={`translate(${sparkle.x}, ${sparkle.y})`}>
              <circle cx="0" cy="0" r="4" fill={color}>
                <animate
                  attributeName="r"
                  values="0;6;3;0"
                  dur="0.8s"
                  begin={`${sparkle.delay}s`}
                  fill="freeze"
                />
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  dur="0.8s"
                  begin={`${sparkle.delay}s`}
                  fill="freeze"
                />
              </circle>
              {/* Star shape for some sparkles */}
              {i % 3 === 0 && (
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fontSize="16"
                  fill={color}
                >
                  <animate
                    attributeName="opacity"
                    values="0;1;0"
                    dur="0.6s"
                    begin={`${sparkle.delay}s`}
                    fill="freeze"
                  />
                </text>
              )}
            </g>
          ))}
        </g>
      )}

      {/* Level up badge */}
      {(phase === 'levelup' || phase === 'settle') && (
        <g>
          {/* Background glow */}
          <circle cx="0" cy="0" r="50" fill={color} opacity="0.3" filter="url(#glow-gold)">
            <animate
              attributeName="r"
              values="30;50"
              dur="0.3s"
              fill="freeze"
            />
          </circle>

          {/* Badge circle */}
          <circle cx="0" cy="0" r="40" fill="#1B263B" stroke={color} strokeWidth="3">
            <animate
              attributeName="r"
              values="0;45;40"
              dur="0.4s"
              fill="freeze"
            />
          </circle>

          {/* Level number */}
          <text
            x="0"
            y="8"
            textAnchor="middle"
            fontSize="32"
            fontWeight="bold"
            fill={color}
          >
            <animate
              attributeName="opacity"
              values="0;1"
              dur="0.2s"
              begin="0.2s"
              fill="freeze"
            />
            {toLevel}
          </text>

          {/* Arrow up */}
          <g transform="translate(0, -55)">
            <animate
              attributeName="opacity"
              values="0;1"
              dur="0.3s"
              begin="0.3s"
              fill="freeze"
            />
            <polygon
              points="0,-15 12,5 -12,5"
              fill={color}
            />
            <animate
              attributeName="transform"
              values="translate(0,-55);translate(0,-65);translate(0,-60)"
              dur="0.5s"
              begin="0.3s"
              fill="freeze"
            />
          </g>

          {/* "Level Up" text */}
          <text
            x="0"
            y="75"
            textAnchor="middle"
            fontSize="16"
            fontWeight="bold"
            fill="#E0E1DD"
          >
            <animate
              attributeName="opacity"
              values="0;1"
              dur="0.3s"
              begin="0.4s"
              fill="freeze"
            />
            LEVEL UP!
          </text>
        </g>
      )}
    </g>
  );
}

export const ZoneUpgradeAnimation = memo(ZoneUpgradeAnimationInner);
