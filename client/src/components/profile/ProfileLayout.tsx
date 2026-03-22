/**
 * ProfileLayout Component
 *
 * Layout wrapper for all profile pages with navigation and header.
 */

import { Link, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthGuard';
import { ProfileNav } from './ProfileNav';

export function ProfileLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A]">
      {/* Header */}
      <header className="bg-[#1B263B] border-b border-[#415A77]/30 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🌆</span>
            <span className="text-xl font-bold text-[#D4A017]">ГОРИЗОНТ</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-[#778DA9] text-sm hidden sm:block">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="text-[#778DA9] hover:text-[#E0E1DD] text-sm transition-colors"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* Main content with sidebar */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <ProfileNav />

          {/* Page Content */}
          <main className="flex-1 min-w-0 pb-20 md:pb-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
