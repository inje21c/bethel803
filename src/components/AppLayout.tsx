import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Home, MessageSquareHeart, BookMarked, CalendarDays, LogOut, Menu, X, Settings, Sun, Moon, UserCircle, WifiOff, HelpCircle, Building2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/authContext';
import { useDistrict } from '@/lib/districtContext';
import { Button } from '@/components/ui/button';
import NotificationCenter from '@/components/NotificationCenter';
import GlobalSearch from '@/components/GlobalSearch';
import DistrictSelector from '@/components/DistrictSelector';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const navItems = [
  { path: '/dashboard', label: '대시보드', icon: Home },
  { path: '/bible-study', label: '구역성경공부', icon: BookOpen },
  { path: '/schedule', label: '주요일정', icon: CalendarDays },
  { path: '/prayer-requests', label: '기도제목', icon: MessageSquareHeart },
  { path: '/bible-reading', label: '성경읽기', icon: BookMarked },
  { path: '/admin', label: '관리자', icon: Settings, leaderOnly: true },
  { path: '/districts', label: '구역 관리', icon: Building2, masterOnly: true },
];

const mobileTabItems = [
  { path: '/dashboard', label: '홈', icon: Home },
  { path: '/bible-study', label: '공부', icon: BookOpen },
  { path: '/schedule', label: '일정', icon: CalendarDays },
  { path: '/prayer-requests', label: '기도', icon: MessageSquareHeart },
];

function isItemVisible(
  item: { leaderOnly?: boolean; masterOnly?: boolean },
  isLeader: boolean,
  isMaster: boolean,
) {
  if (item.masterOnly && !isMaster) return false;
  if (item.leaderOnly && !isLeader) return false;
  return true;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isMaster, isLeader } = useAuth();
  const {
    currentDistrictName,
    homeDistrictName,
    isViewingOtherDistrict,
    resetDistrict,
  } = useDistrict();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isOnline = useOnlineStatus();
  const activeTheme = resolvedTheme ?? theme ?? 'light';
  const canResetDistrict = isViewingOtherDistrict && isMaster;

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const toggleTheme = () => {
    setTheme(activeTheme === 'dark' ? 'light' : 'dark');
  };

  const isMoreActive =
    location.pathname === '/profile' ||
    location.pathname === '/manual' ||
    location.pathname === '/bible-reading' ||
    location.pathname === '/admin' ||
    location.pathname === '/districts';

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
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-6 h-14 md:h-16">
          <Link to="/dashboard" className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-sm md:text-base">벧</span>
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-display font-semibold text-sm md:text-base">{currentDistrictName} 구역</span>
              {isViewingOtherDistrict && (
                <span className="text-[11px] text-muted-foreground">
                  내 기본 구역: {homeDistrictName}
                </span>
              )}
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-1.5">
            {navItems.map(item => {
              if (item.masterOnly && !isMaster) return null;
              if (item.leaderOnly && !isLeader) return null;
              const active = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 rounded-lg text-sm lg:text-[15px] font-medium transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <item.icon className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            <DistrictSelector />
            {isViewingOtherDistrict && (
              <Button
                variant="outline"
                size="sm"
                className="hidden md:inline-flex text-xs"
                onClick={resetDistrict}
              >
                내 구역으로
              </Button>
            )}
            <GlobalSearch />
            <Link
              to="/profile"
              className="hidden sm:flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <UserCircle className="w-4 h-4 md:w-5 md:h-5" />
              {user?.name} {user?.role === 'master' ? '(마스터)' : user?.role === 'leader' ? '(구역장)' : ''}
            </Link>
            <NotificationCenter />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="hidden md:inline-flex text-muted-foreground md:w-10 md:h-10"
              aria-label="다크 모드 토글"
            >
              {activeTheme === 'dark' ? <Sun className="w-4 h-4 md:w-5 md:h-5" /> : <Moon className="w-4 h-4 md:w-5 md:h-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="hidden md:inline-flex text-muted-foreground md:w-10 md:h-10">
              <LogOut className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
            <button className="md:hidden text-muted-foreground" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? '메뉴 닫기' : '메뉴 열기'}>
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
              <div className="p-3 space-y-3">
                <div className="rounded-xl border bg-muted/40 px-3 py-2">
                  <p className="font-medium text-sm">{currentDistrictName} 구역</p>
                  <p className="text-xs text-muted-foreground">
                    {user?.name} {user?.role === 'master' ? '마스터' : user?.role === 'leader' ? '구역장' : '구역원'}
                  </p>
                  {canResetDistrict && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 h-8 text-xs"
                      onClick={resetDistrict}
                    >
                      내 구역으로 돌아가기
                    </Button>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="px-2 text-[11px] font-medium tracking-wide text-muted-foreground">메뉴</p>
                  {navItems.map(item => {
                    if (!isItemVisible(item, isLeader, isMaster)) return null;
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
                </div>

                <div className="space-y-1">
                  <p className="px-2 text-[11px] font-medium tracking-wide text-muted-foreground">도움 및 설정</p>
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
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground"
                    onClick={toggleTheme}
                  >
                    {activeTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    {activeTheme === 'dark' ? '라이트 모드' : '야간 모드'}
                  </button>
                </div>

                <div className="border-t pt-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4" />
                    로그아웃
                  </Button>
                </div>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 pb-24 pt-6 md:px-6 md:py-6">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 px-2 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1">
          {mobileTabItems.map(item => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <item.icon className={`h-5 w-5 ${active ? 'text-primary' : ''}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            className={`flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium ${
              mobileOpen ? 'text-primary' : isMoreActive ? 'text-primary' : 'text-muted-foreground'
            }`}
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            <Menu className="h-5 w-5" />
            <span>더보기</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
