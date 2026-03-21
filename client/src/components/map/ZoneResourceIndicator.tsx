import { useEffect, useState, memo } from 'react';
import type { ZoneName, ResourceName } from '../../types/game-state';

interface Resources {
  energy: number;
  materials: number;
  food: number;
  knowledge: number;
}

interface ZoneResourceIndicatorProps {
  zone: ZoneName;
  resources: Resources;
  isAnimating?: boolean;
  highlightResource?: ResourceName;
}

const RESOURCE_ICONS: Record<ResourceName, string> = {
  energy: '\u26A1',
  materials: '\uD83D\uDD27',
  food: '\uD83C\uDF4E',
  knowledge: '\uD83D\uDCDA',
};

const RESOURCE_COLORS: Record<ResourceName, string> = {
  energy: '#FFD700',
  materials: '#A0522D',
  food: '#32CD32',
  knowledge: '#4169E1',
};

const ZONE_INDICATOR_POSITIONS: Record<ZoneName, { x: number; y: number }> = {
  center: { x: 600, y: 480 },
  residential: { x: 950, y: 320 },
  industrial: { x: 920, y: 720 },
  green: { x: 180, y: 600 },
  unknown: { x: 0, y: 0 }, // Unknown zone doesn't show resources
};

function ZoneResourceIndicatorInner({
  zone,
  resources,
  isAnimating = false,
  highlightResource,
}: ZoneResourceIndicatorProps) {
  const [pulsingResources, setPulsingResources] = useState<Set<ResourceName>>(new Set());
  const [prevResources, setPrevResources] = useState<Resources>(resources);

  // Detect resource changes and trigger pulse animation
  useEffect(() => {
    const changedResources = new Set<ResourceName>();

    (Object.keys(resources) as ResourceName[]).forEach(key => {
      if (resources[key] !== prevResources[key]) {
        changedResources.add(key);
      }
    });

    if (changedResources.size > 0) {
      setPulsingResources(changedResources);

      const timer = setTimeout(() => {
        setPulsingResources(new Set());
      }, 1000);

      return () => clearTimeout(timer);
    }

    setPrevResources(resources);
  }, [resources, prevResources]);

  // Update prevResources when resources change
  useEffect(() => {
    setPrevResources(resources);
  }, [resources]);

  if (zone === 'unknown') return null;

  const position = ZONE_INDICATOR_POSITIONS[zone];
  const resourceEntries = Object.entries(resources) as [ResourceName, number][];
  const totalResources = resourceEntries.reduce((sum, [, val]) => sum + val, 0);

  // Don't show if no resources
  if (totalResources === 0) return null;

  const boxWidth = 140;
  const boxHeight = 80;

  return (
    <g transform={`translate(${position.x - boxWidth / 2}, ${position.y})`}>
      {/* Background */}
      <rect
        x="0"
        y="0"
        width={boxWidth}
        height={boxHeight}
        rx="8"
        fill="#1B263B"
        fillOpacity="0.9"
        stroke="#415A77"
        strokeWidth="1"
        className={isAnimating ? 'indicator-pulse' : ''}
      />

      {/* Resource icons grid */}
      <g transform="translate(10, 12)">
        {resourceEntries.map(([key, value], index) => {
          const col = index % 2;
          const row = Math.floor(index / 2);
          const x = col * 60;
          const y = row * 32;
          const isPulsing = pulsingResources.has(key) || highlightResource === key;

          return (
            <g key={key} transform={`translate(${x}, ${y})`}>
              {/* Pulsing background */}
              {isPulsing && (
                <circle cx="12" cy="12" r="16" fill={RESOURCE_COLORS[key]} fillOpacity="0.3">
                  <animate
                    attributeName="r"
                    values="16;20;16"
                    dur="0.5s"
                    repeatCount="2"
                  />
                  <animate
                    attributeName="fillOpacity"
                    values="0.3;0.5;0.3"
                    dur="0.5s"
                    repeatCount="2"
                  />
                </circle>
              )}

              {/* Icon */}
              <text
                x="0"
                y="18"
                fontSize="16"
                className={isPulsing ? 'resource-icon-pulse' : ''}
              >
                {RESOURCE_ICONS[key]}
              </text>

              {/* Value */}
              <text
                x="24"
                y="17"
                fontSize="14"
                fontWeight="bold"
                fill={isPulsing ? RESOURCE_COLORS[key] : '#E0E1DD'}
                className={isPulsing ? 'resource-value-pulse' : ''}
              >
                {value}
              </text>
            </g>
          );
        })}
      </g>

      {/* Animated border when zone is receiving resources */}
      {isAnimating && (
        <rect
          x="0"
          y="0"
          width={boxWidth}
          height={boxHeight}
          rx="8"
          fill="none"
          stroke="#D4A017"
          strokeWidth="2"
        >
          <animate
            attributeName="stroke-opacity"
            values="1;0.3;1"
            dur="0.5s"
            repeatCount="4"
          />
        </rect>
      )}
    </g>
  );
}

export const ZoneResourceIndicator = memo(ZoneResourceIndicatorInner);
