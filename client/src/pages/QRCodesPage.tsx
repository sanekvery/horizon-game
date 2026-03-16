import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameState } from '../hooks/useGameState';
import QRCode from 'qrcode';
import rolesData from '../data/roles.json';
import type { GameRole } from '../types/game-data';

interface QRCardProps {
  name: string;
  archetype: string;
  token: string;
  baseUrl: string;
  isLobby?: boolean;
}

function QRCard({ name, archetype, token, baseUrl, isLobby = false }: QRCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      const url = isLobby
        ? `${baseUrl}/lobby`
        : `${baseUrl}/join/${token}`;
      QRCode.toCanvas(canvasRef.current, url, {
        width: isLobby ? 240 : 160,
        margin: 1,
        color: {
          dark: isLobby ? '#D4A017' : '#1B263B',
          light: '#FFFFFF',
        },
      }).catch(() => setError(true));
    }
  }, [baseUrl, token, isLobby]);

  const url = isLobby ? `${baseUrl}/lobby` : `${baseUrl}/join/${token}`;

  if (isLobby) {
    return (
      <div className="bg-gradient-to-br from-[#1B263B] to-[#0D1B2A] p-6 border-2 border-[#D4A017] rounded-xl text-center shadow-lg print:shadow-none print:break-inside-avoid">
        <h3 className="text-[#D4A017] font-bold text-xl mb-2">{name}</h3>
        <p className="text-[#778DA9] text-sm mb-4">{archetype}</p>

        <div className="w-[260px] h-[260px] mx-auto mb-4 bg-white rounded-lg flex items-center justify-center p-2">
          {error ? (
            <div className="text-red-500 text-sm">Ошибка</div>
          ) : (
            <canvas ref={canvasRef} className="rounded" />
          )}
        </div>

        <div className="text-sm text-[#778DA9] break-all">
          {url}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 border-2 border-[#1B263B] rounded-xl text-center shadow-md print:shadow-none print:break-inside-avoid">
      <h3 className="text-[#1B263B] font-bold text-base mb-1">{name}</h3>
      <p className="text-[#778DA9] text-xs mb-4">{archetype}</p>

      <div className="w-[180px] h-[180px] mx-auto mb-4 bg-gray-50 rounded-lg flex items-center justify-center">
        {error ? (
          <div className="text-red-500 text-sm">Ошибка</div>
        ) : (
          <canvas ref={canvasRef} className="rounded" />
        )}
      </div>

      <div className="font-mono text-xs text-[#415A77] bg-[#E0E1DD] px-2 py-1 rounded inline-block mb-2">
        {token}
      </div>

      <div className="text-[10px] text-gray-400 break-all">
        {url}
      </div>
    </div>
  );
}

export function QRCodesPage() {
  const navigate = useNavigate();
  const { state, isConnected, isAdmin, startGame } = useGameState();
  const [baseUrl, setBaseUrl] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500 text-xl animate-pulse">Подключение...</div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500 text-xl animate-pulse">Загрузка...</div>
      </div>
    );
  }

  const roles = rolesData as GameRole[];
  const activeRoles = state.roles.filter((r) => r.isActive);
  const isOnlineMode = state.settings.distributionMode === 'online';
  const claimedCount = activeRoles.filter((r) => r.claimedBy !== null).length;
  const allClaimed = claimedCount === activeRoles.length;

  return (
    <div className="min-h-screen bg-gray-100 p-6 print:p-4 print:bg-white">
      {/* Header */}
      <div className="text-center mb-8 print:mb-4">
        <h1 className="text-3xl font-bold text-[#1B263B] mb-2">Проект Горизонт</h1>
        <p className="text-[#778DA9]">
          {isOnlineMode
            ? 'Онлайн-распределение ролей'
            : 'QR-коды для подключения участников'}
        </p>

        {/* Game info */}
        <div className="mt-4 inline-flex items-center gap-4 text-sm text-[#415A77] bg-white px-4 py-2 rounded-lg shadow print:hidden">
          <span>Игроков: <b>{state.settings.playerCount}</b></span>
          <span>|</span>
          <span>Режим: <b>{isOnlineMode ? 'Онлайн' : 'QR'}</b></span>
          <span>|</span>
          <span>Фаза: <b>{
            state.settings.gamePhase === 'setup' ? 'Настройка' :
            state.settings.gamePhase === 'distribution' ? 'Распределение' :
            state.settings.gamePhase === 'playing' ? 'Игра' : 'Завершена'
          }</b></span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex justify-center gap-3 print:hidden">
          <button
            onClick={() => navigate('/setup')}
            className="px-4 py-2 bg-[#778DA9] hover:bg-[#415A77] text-white rounded-lg transition-colors"
          >
            ← Настройки
          </button>
          <button
            onClick={() => window.print()}
            className="px-6 py-2 bg-[#415A77] hover:bg-[#1B263B] text-white rounded-lg transition-colors"
          >
            🖨️ Печать
          </button>
          {isAdmin && state.settings.gamePhase === 'distribution' && (
            <button
              onClick={startGame}
              disabled={isOnlineMode && !allClaimed}
              className={`px-6 py-2 rounded-lg transition-colors ${
                isOnlineMode && !allClaimed
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              🎮 Начать игру
            </button>
          )}
        </div>
      </div>

      {/* Online mode: Single QR for lobby */}
      {isOnlineMode && (
        <div className="max-w-md mx-auto mb-8">
          <QRCard
            name="Выбор роли"
            archetype="Сканируйте, чтобы выбрать роль"
            token=""
            baseUrl={baseUrl}
            isLobby={true}
          />

          {/* Progress */}
          <div className="mt-4 bg-white rounded-lg p-4 shadow">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[#415A77]">Выбрано ролей:</span>
              <span className="font-bold text-[#1B263B]">{claimedCount} / {activeRoles.length}</span>
            </div>
            <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#D4A017] to-[#B8860B] transition-all"
                style={{ width: `${(claimedCount / activeRoles.length) * 100}%` }}
              />
            </div>
            {allClaimed && (
              <p className="text-green-600 text-center mt-2 font-medium">
                Все роли заняты! Можно начинать игру.
              </p>
            )}
          </div>

          {/* Claimed roles list */}
          {claimedCount > 0 && (
            <div className="mt-4 bg-white rounded-lg p-4 shadow">
              <h3 className="font-bold text-[#1B263B] mb-3">Занятые роли:</h3>
              <div className="space-y-2">
                {activeRoles
                  .filter((r) => r.claimedBy !== null)
                  .map((role) => (
                    <div key={role.id} className="flex justify-between items-center text-sm">
                      <span className="text-[#415A77]">{role.name}</span>
                      <span className="font-medium text-[#1B263B]">{role.claimedBy}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Toggle to show individual QRs */}
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-4 w-full py-2 text-[#415A77] hover:text-[#1B263B] text-sm transition-colors"
          >
            {showAll ? '▲ Скрыть индивидуальные QR' : '▼ Показать индивидуальные QR'}
          </button>
        </div>
      )}

      {/* QR Grid (for QR mode or when expanded in online mode) */}
      {(!isOnlineMode || showAll) && (
        <>
          <h2 className="text-xl font-bold text-[#1B263B] text-center mb-4 print:text-lg">
            {isOnlineMode
              ? 'Индивидуальные QR-коды'
              : `Активные роли (${activeRoles.length})`}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 max-w-7xl mx-auto">
            {activeRoles.map((role) => {
              const roleData = roles.find((r) => r.id === role.id);
              return (
                <div key={role.id} className={role.claimedBy ? 'opacity-50' : ''}>
                  <QRCard
                    name={role.name}
                    archetype={roleData?.archetype || ''}
                    token={role.token}
                    baseUrl={baseUrl}
                  />
                  {role.claimedBy && (
                    <div className="mt-2 text-center text-sm text-[#D4A017] font-medium">
                      Занято: {role.claimedBy}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
