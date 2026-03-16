import type { GameRole } from '../types/game-data';
import { ZONE_NAMES_RU } from '../types/game-state';

interface RoleCardProps {
  role: GameRole;
  isActive?: boolean;
  claimedBy?: string | null;
  onClaim?: () => void;
  showToken?: string;
  compact?: boolean;
}

const ZONE_COLORS: Record<string, string> = {
  center: 'bg-blue-900/50 border-blue-500',
  residential: 'bg-purple-900/50 border-purple-500',
  industrial: 'bg-orange-900/50 border-orange-500',
  green: 'bg-green-900/50 border-green-500',
  unknown: 'bg-gray-900/50 border-gray-500',
};

const ZONE_ICONS: Record<string, string> = {
  center: '🏛️',
  residential: '🏠',
  industrial: '🏭',
  green: '🌿',
  unknown: '❓',
};

export function RoleCard({
  role,
  isActive = true,
  claimedBy,
  onClaim,
  showToken,
  compact = false,
}: RoleCardProps) {
  const zoneColor = ZONE_COLORS[role.zone] || ZONE_COLORS.unknown;
  const zoneIcon = ZONE_ICONS[role.zone] || '❓';
  const zoneName = ZONE_NAMES_RU[role.zone as keyof typeof ZONE_NAMES_RU] || role.zone;

  if (compact) {
    return (
      <div
        className={`
          rounded-lg border p-3
          ${isActive ? zoneColor : 'bg-gray-800/30 border-gray-700 opacity-50'}
          ${claimedBy ? 'ring-2 ring-[#D4A017]' : ''}
        `}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">{zoneIcon}</span>
            <span className="font-medium text-white truncate">{role.name}</span>
          </div>
          {claimedBy && (
            <span className="text-xs bg-[#D4A017]/20 text-[#D4A017] px-2 py-1 rounded">
              {claimedBy}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        rounded-xl border-2 p-4 transition-all
        ${isActive ? zoneColor : 'bg-gray-800/30 border-gray-700 opacity-50'}
        ${claimedBy ? 'ring-2 ring-[#D4A017]' : ''}
        ${onClaim && !claimedBy ? 'hover:scale-[1.02] cursor-pointer' : ''}
      `}
      onClick={onClaim && !claimedBy ? onClaim : undefined}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{zoneIcon}</span>
          <div>
            <h3 className="font-bold text-white text-lg leading-tight">{role.name}</h3>
            <p className="text-sm text-[#778DA9]">{role.archetype}</p>
          </div>
        </div>
        <span className="text-xs bg-black/30 px-2 py-1 rounded text-[#778DA9]">
          {zoneName}
        </span>
      </div>

      <p className="text-sm text-[#778DA9] mb-3 line-clamp-2">
        {role.publicMission}
      </p>

      {claimedBy ? (
        <div className="bg-[#D4A017]/20 text-[#D4A017] text-sm py-2 px-3 rounded-lg text-center">
          Занято: {claimedBy}
        </div>
      ) : onClaim ? (
        <button
          className="w-full bg-gradient-to-r from-[#D4A017] to-[#B8860B] text-[#0D1B2A] font-bold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity"
        >
          Выбрать роль
        </button>
      ) : null}

      {showToken && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-xs text-[#778DA9] mb-1">Токен:</div>
          <code className="text-sm font-mono text-[#D4A017] bg-black/30 px-2 py-1 rounded">
            {showToken}
          </code>
        </div>
      )}
    </div>
  );
}
