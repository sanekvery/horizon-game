import { Component, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { MapProjection } from './pages/MapProjection';
import { AdminDashboard } from './pages/AdminDashboard';
import { MobilePlayer } from './pages/MobilePlayer';
import { QRCodesPage } from './pages/QRCodesPage';
import { GameSetup } from './pages/GameSetup';
import { RoleLobby } from './pages/RoleLobby';
import { FacilitatorAuth } from './pages/FacilitatorAuth';
import { FacilitatorDashboard } from './pages/FacilitatorDashboard';
import { SessionHistoryPage } from './pages/SessionHistoryPage';

// Страница входа (обход ngrok interstitial)
function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const handleEnter = () => {
    navigate(`/play/${token}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1B263B] to-[#0D1B2A] flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-4">🌆</div>
      <h1 className="text-3xl font-bold text-[#D4A017] mb-2">Проект Горизонт</h1>
      <p className="text-[#778DA9] mb-8">Интерактивная ролевая игра</p>
      <button
        onClick={handleEnter}
        className="bg-gradient-to-r from-[#D4A017] to-[#B8860B] text-[#0D1B2A] text-lg font-bold px-12 py-4 rounded-xl shadow-lg active:scale-95 transition-transform"
      >
        Войти в игру
      </button>
      <p className="text-[#415A77] text-sm mt-6">Нажмите кнопку чтобы получить свою роль</p>
    </div>
  );
}

// Error Boundary to catch React errors
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-red-400 mb-4">Произошла ошибка</h1>
            <p className="text-[#778DA9] text-sm mb-4">
              {this.state.error?.message || 'Неизвестная ошибка'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#415A77] hover:bg-[#778DA9] text-white rounded-lg"
            >
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/map" element={<MapProjection />} />
          <Route path="/auth" element={<FacilitatorAuth />} />
          <Route path="/facilitator" element={<FacilitatorDashboard />} />
          <Route path="/session/:sessionCode/history" element={<SessionHistoryPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/setup" element={<GameSetup />} />
          <Route path="/qr" element={<QRCodesPage />} />
          <Route path="/lobby" element={<RoleLobby />} />
          <Route path="/join/:token" element={<JoinPage />} />
          <Route path="/play/:token" element={<MobilePlayer />} />
          <Route path="/" element={<Navigate to="/map" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen bg-horizon-dark flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-horizon-light mb-4">404</h1>
        <p className="text-horizon-steel mb-6">Страница не найдена</p>
        <a
          href="/map"
          className="text-horizon-steel hover:text-horizon-light underline"
        >
          Вернуться на главную
        </a>
      </div>
    </div>
  );
}

export default App;
