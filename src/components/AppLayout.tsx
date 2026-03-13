import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Home, MessageSquareHeart, BookMarked, CalendarDays, LogOut, Menu, X, Settings, Sun, Moon, UserCircle, WifiOff, HelpCircle } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/authContext';
import { Button } from '@/components/ui/button';
import NotificationCenter from '@/components/NotificationCenter';
import GlobalSearch from '@/components/GlobalSearch';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const navItems = [
  { path: '/dashboard', label: '대시보드', icon: Home },
  { path: '/bible-study', label: '구역성경공부', icon: BookOpen },
  { path: '/schedule', label: '주요일정', icon: CalendarDays },
  { path: '/prayer-requests', label: '기도제목', icon: MessageSquareHeart },
  { path: '/bible-reading', label: '성경읽기', icon: BookMarked },
  { path: '/admin', label: '관리자', icon: Settings, leaderOnly: true },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const isOnline = useOnlineStatus();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 오프라인 배너 */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-destructive text-destructive-foreground text-xs text-center py-1.5 flex items-center justify-center gap-1.5"
          >
            <WifiOff className="w-3 h-3" />
            인터넷 연결이 끊겼습니다. 일부 기능이 제한될 수 있습니다.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 h-14">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-sm">벧</span>
            </div>
            <span className="font-display font-semibold text-sm hidden sm:inline">킨텍스장성남 구역</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => {
              if (item.leaderOnly && user?.role !== 'leader') return null;
              const active = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <GlobalSearch />
            <Link
              to="/profile"
              className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <UserCircle className="w-4 h-4" />
              {user?.name} {user?.role === 'leader' ? '(구역장)' : ''}
            </Link>
            <NotificationCenter />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="text-muted-foreground"
              aria-label="다크 모드 토글"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="w-4 h-4" />
            </Button>
            <button className="md:hidden text-muted-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t overflow-hidden"
            >
              <div className="p-2 space-y-1">
                {navItems.map(item => {
                  if (item.leaderOnly && user?.role !== 'leader') return null;
                  const active = location.pathname.startsWith(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  );
                })}
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                    location.pathname === '/profile' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <UserCircle className="w-4 h-4" />
                  내 프로필
                </Link>
                <Link
                  to="/manual"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                    location.pathname === '/manual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <HelpCircle className="w-4 h-4" />
                  사용 안내
                </Link>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
