import { useEffect, useState, memo } from 'react';
import type { ZoneName } from '../../types/game-state';
import eventsData from '../../data/events.json';

interface ActiveEvent {
  eventId: number;
  showingToPlayers: boolean;
  awaitingChoice: boolean;
}

interface EventOverlayProps {
  activeEvent: ActiveEvent | null;
  eventId?: number;
  isDilemma?: boolean;
}

interface EventData {
  id: number;
  title: string;
  type: string;
  effect: {
    zone: ZoneName | 'all';
  };
}

const ZONE_CENTER_POSITIONS: Record<ZoneName, { x: number; y: number }> = {
  center: { x: 600, y: 400 },
  residential: { x: 950, y: 200 },
  industrial: { x: 900, y: 600 },
  green: { x: 150, y: 450 },
  unknown: { x: 300, y: 150 },
};

const ALL_ZONES: ZoneName[] = ['center', 'residential', 'industrial', 'green'];

type EventType = 'positive' | 'negative' | 'dilemma';

function getEventType(event: EventData): EventType {
  if (event.type === 'resource_gain') return 'positive';
  if (event.type === 'resource_loss') return 'negative';
  if (event.type === 'dilemma' || event.type === 'choice') return 'dilemma';
  return 'negative';
}

const EVENT_COLORS: Record<EventType, string> = {
  positive: '#27AE60',
  negative: '#E74C3C',
  dilemma: '#F39C12',
};

function EventOverlayInner({ activeEvent, eventId, isDilemma }: EventOverlayProps) {
  const [pulsePhase, setPulsePhase] = useState(0);

  // Use eventId from props or from activeEvent
  const currentEventId = eventId ?? activeEvent?.eventId;

  useEffect(() => {
    if (!currentEventId) return;

    const interval = setInterval(() => {
      setPulsePhase(prev => (prev + 1) % 360);
    }, 50);

    return () => clearInterval(interval);
  }, [currentEventId]);

  if (!currentEventId) return null;

  // Find event data
  const event = (eventsData as EventData[]).find(e => e.id === currentEventId);
  if (!event) return null;

  const eventType: EventType = isDilemma ? 'dilemma' : getEventType(event);
  const color = EVENT_COLORS[eventType];

  // Determine affected zones
  const affectedZones: ZoneName[] = event.effect.zone === 'all'
    ? ALL_ZONES
    : [event.effect.zone as ZoneName];

  // Pulsing opacity based on phase
  const pulseOpacity = 0.2 + Math.sin(pulsePhase * Math.PI / 180) * 0.15;

  return (
    <g className="event-overlay">
      {affectedZones.map(zone => {
        const position = ZONE_CENTER_POSITIONS[zone];
        if (!position) return null;

        return (
          <g key={zone} transform={`translate(${position.x}, ${position.y})`}>
            {/* Pulsing circle */}
            <circle
              cx="0"
              cy="0"
              r="100"
              fill={color}
              fillOpacity={pulseOpacity}
              stroke={color}
              strokeWidth="3"
              strokeOpacity={0.6}
            >
              <animate
                attributeName="r"
                values="90;110;90"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Inner glow */}
            <circle
              cx="0"
              cy="0"
              r="60"
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeOpacity="0.4"
              strokeDasharray="10,5"
            >
              <animate
                attributeName="stroke-dashoffset"
                values="0;30"
                dur="1s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Warning/question icon for dilemma */}
            {eventType === 'dilemma' && (
              <g>
                <circle
                  cx="0"
                  cy="-70"
                  r="20"
                  fill={color}
                />
                <text
                  x="0"
                  y="-63"
                  textAnchor="middle"
                  fontSize="24"
                  fontWeight="bold"
                  fill="#1B263B"
                >
                  ?
                </text>
              </g>
            )}

            {/* Warning icon for negative events */}
            {eventType === 'negative' && (
              <g>
                <polygon
                  points="0,-90 20,-55 -20,-55"
                  fill={color}
                />
                <text
                  x="0"
                  y="-63"
                  textAnchor="middle"
                  fontSize="20"
                  fontWeight="bold"
                  fill="#1B263B"
                >
                  !
                </text>
              </g>
            )}

            {/* Plus icon for positive events */}
            {eventType === 'positive' && (
              <g>
                <circle
                  cx="0"
                  cy="-70"
                  r="20"
                  fill={color}
                />
                <text
                  x="0"
                  y="-63"
                  textAnchor="middle"
                  fontSize="24"
                  fontWeight="bold"
                  fill="#1B263B"
                >
                  +
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Event title banner */}
      <g transform="translate(600, 50)">
        <rect
          x="-200"
          y="-25"
          width="400"
          height="50"
          rx="8"
          fill="#1B263B"
          fillOpacity="0.95"
          stroke={color}
          strokeWidth="2"
        />
        <text
          x="0"
          y="8"
          textAnchor="middle"
          fontSize="18"
          fontWeight="bold"
          fill={color}
        >
          {event.title}
        </text>
      </g>
    </g>
  );
}

export const EventOverlay = memo(EventOverlayInner);
