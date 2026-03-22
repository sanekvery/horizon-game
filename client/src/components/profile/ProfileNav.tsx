/**
 * ProfileNav Component
 *
 * Navigation component for profile pages (sidebar on desktop, bottom bar on mobile).
 */

import { NavLink, useLocation } from 'react-router-dom';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/profile', icon: '👤', label: 'Профиль' },
  { path: '/profile/stats', icon: '📊', label: 'Статы' },
  { path: '/profile/achievements', icon: '🏆', label: 'Достижения' },
  { path: '/profile/history', icon: '📜', label: 'История' },
  { path: '/profile/rules', icon: '📖', label: 'Правила' },
];

export function ProfileNav() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/profile') {
      return location.pathname === '/profile';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="hidden md:flex flex-col gap-1 w-48 shrink-0">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              isActive(item.path)
                ? 'bg-[#D4A017]/20 text-[#D4A017] border border-[#D4A017]/30'
                : 'text-[#778DA9] hover:bg-[#415A77]/30 hover:text-[#E0E1DD]'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1B263B] border-t border-[#415A77]/30 z-50">
        <div className="flex justify-around">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 py-3 px-2 flex-1 transition-colors ${
                isActive(item.path)
                  ? 'text-[#D4A017]'
                  : 'text-[#778DA9]'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
