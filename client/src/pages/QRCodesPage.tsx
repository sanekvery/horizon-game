import { useEffect, useState, useRef } from 'react';
import { useGameState } from '../hooks/useGameState';
import QRCode from 'qrcode';
import rolesData from '../data/roles.json';
import type { GameRole } from '../types/game-data';

interface QRCardProps {
  name: string;
  archetype: string;
  token: string;
  baseUrl: string;
}

function QRCard({ name, archetype, token, baseUrl }: QRCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      const url = `${baseUrl}/join/${token}`;
      QRCode.toCanvas(canvasRef.current, url, {
        width: 160,
        margin: 1,
        color: {
          dark: '#1B263B',
          light: '#FFFFFF',
        },
      }).catch(() => setError(true));
    }
  }, [baseUrl, token]);

  const url = `${baseUrl}/join/${token}`;

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
  const { state, isConnected } = useGameState();
  const [baseUrl, setBaseUrl] = useState('');

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

  return (
    <div className="min-h-screen bg-gray-100 p-6 print:p-4 print:bg-white">
      {/* Header */}
      <div className="text-center mb-8 print:mb-4">
        <h1 className="text-3xl font-bold text-[#1B263B] mb-2">Проект Горизонт</h1>
        <p className="text-[#778DA9]">QR-коды для подключения участников</p>

        <button
          onClick={() => window.print()}
          className="mt-4 px-6 py-2 bg-[#415A77] hover:bg-[#1B263B] text-white rounded-lg transition-colors print:hidden"
        >
          🖨️ Печать
        </button>
      </div>

      {/* QR Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 max-w-7xl mx-auto">
        {state.roles.map((role) => {
          const roleData = roles.find((r) => r.id === role.id);
          return (
            <QRCard
              key={role.id}
              name={role.name}
              archetype={roleData?.archetype || ''}
              token={role.token}
              baseUrl={baseUrl}
            />
          );
        })}
      </div>

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
