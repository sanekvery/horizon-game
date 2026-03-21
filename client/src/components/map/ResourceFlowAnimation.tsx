import { useEffect, useState, memo } from 'react';
import type { ZoneName, ResourceName } from '../../types/game-state';

interface ResourceFlowAnimationProps {
  zone: ZoneName;
  resource: ResourceName;
  amount: number;
  roleName?: string;
  onComplete: () => void;
}

const RESOURCE_ICONS: Record<ResourceName, string> = {
  energy: '\u26A1',
  materials: '\uD83D\uDD27',
  food: '\uD83C\uDF4E',
  knowledge: '\uD83D\uDCDA',
};

const RESOURCE_COLORS: Record<ResourceName, string> = {
  energy: '#FFD700',
  materials: '#CD853F',
  food: '#32CD32',
  knowledge: '#4169E1',
};

const ZONE_CENTER_POSITIONS: Record<ZoneName, { x: number; y: number }> = {
  center: { x: 600, y: 400 },
  residential: { x: 950, y: 200 },
  industrial: { x: 900, y: 600 },
  green: { x: 150, y: 450 },
  unknown: { x: 300, y: 150 },
};

// Starting positions for particles (from edges of screen)
const getStartPosition = (zone: ZoneName): { x: number; y: number } => {
  const positions: Record<ZoneName, { x: number; y: number }> = {
    center: { x: 1150, y: 400 },
    residential: { x: 1150, y: 50 },
    industrial: { x: 1150, y: 750 },
    green: { x: 50, y: 750 },
    unknown: { x: 50, y: 50 },
  };
  return positions[zone];
};

const ANIMATION_DURATION = 1500; // ms
const PARTICLE_COUNT = 5;

function ResourceFlowAnimationInner({
  zone,
  resource,
  amount,
  roleName,
  onComplete,
}: ResourceFlowAnimationProps) {
  const [progress, setProgress] = useState(0);
  const [showPlusAmount, setShowPlusAmount] = useState(false);

  useEffect(() => {
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min(elapsed / ANIMATION_DURATION, 1);
      setProgress(newProgress);

      if (newProgress >= 0.7 && !showPlusAmount) {
        setShowPlusAmount(true);
      }

      if (newProgress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Keep +amount visible for a moment before calling onComplete
        setTimeout(onComplete, 800);
      }
    };

    requestAnimationFrame(animate);
  }, [onComplete, showPlusAmount]);

  if (zone === 'unknown') return null;

  const startPos = getStartPosition(zone);
  const endPos = ZONE_CENTER_POSITIONS[zone];
  const color = RESOURCE_COLORS[resource];
  const icon = RESOURCE_ICONS[resource];

  // Easing function for smooth animation
  const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
  const easedProgress = easeOutQuad(progress);

  // Generate particles with different offsets
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const offset = i * 0.15; // Stagger particles
    const particleProgress = Math.max(0, Math.min(1, (progress - offset) / (1 - offset * 0.5)));
    const easedParticleProgress = easeOutQuad(particleProgress);

    const x = startPos.x + (endPos.x - startPos.x) * easedParticleProgress;
    const y = startPos.y + (endPos.y - startPos.y) * easedParticleProgress;

    // Add some waviness
    const waveOffset = Math.sin(particleProgress * Math.PI * 2 + i) * 20;

    return {
      x,
      y: y + waveOffset,
      opacity: particleProgress > 0 && particleProgress < 1 ? 1 - particleProgress * 0.3 : 0,
      scale: 1 - particleProgress * 0.3,
    };
  });

  return (
    <g className="resource-flow-animation">
      {/* Particles */}
      {particles.map((particle, i) => (
        <g key={i} transform={`translate(${particle.x}, ${particle.y})`} opacity={particle.opacity}>
          {/* Glow */}
          <circle
            cx="0"
            cy="0"
            r={20 * particle.scale}
            fill={color}
            fillOpacity="0.3"
            filter="url(#glow-gold)"
          />
          {/* Icon */}
          <text
            x="0"
            y="6"
            textAnchor="middle"
            fontSize={24 * particle.scale}
          >
            {icon}
          </text>
        </g>
      ))}

      {/* Trail effect */}
      <line
        x1={startPos.x}
        y1={startPos.y}
        x2={startPos.x + (endPos.x - startPos.x) * easedProgress}
        y2={startPos.y + (endPos.y - startPos.y) * easedProgress}
        stroke={color}
        strokeWidth="3"
        strokeOpacity={0.4 * (1 - progress)}
        strokeLinecap="round"
        strokeDasharray="8,8"
      />

      {/* Plus amount text at destination */}
      {showPlusAmount && (
        <g transform={`translate(${endPos.x}, ${endPos.y - 40})`}>
          <text
            x="0"
            y="0"
            textAnchor="middle"
            fontSize="28"
            fontWeight="bold"
            fill={color}
            className="plus-amount-animation"
          >
            +{amount}
          </text>
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            keyTimes="0;0.1;0.7;1"
            dur="1.2s"
            fill="freeze"
          />
          {roleName && (
            <text
              x="0"
              y="24"
              textAnchor="middle"
              fontSize="14"
              fill="#E0E1DD"
              opacity="0.8"
            >
              {roleName}
            </text>
          )}
        </g>
      )}
    </g>
  );
}

export const ResourceFlowAnimation = memo(ResourceFlowAnimationInner);
