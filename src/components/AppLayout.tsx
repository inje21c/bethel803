import { lazy, ReactNode, Suspense, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Home, MessageSquareHeart, BookMarked, CalendarDays, LogOut, Menu, X, Settings, Sun, Moon, UserCircle, WifiOff, HelpCircle, Building2, Bell, Search, BookHeart, ShieldCheck, Users } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { useDistrict } from '@/lib/districtContext';
import { useChurch } from '@/lib/churchContext';
import { getUnreadReplyCount } from '@/lib/api';
import { Button } from '@/components/ui/button';
import DistrictSelector from '@/components/DistrictSelector';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const NotificationCenter = lazy(() => import('@/components/NotificationCenter'));
const GlobalSearch = lazy(() => import('@/components/GlobalSearch'));

const navItems = [
  { path: '/dashboard', label: '대시보드', icon: Home },
  { path: '/qt', label: '오늘의 QT', icon: BookHeart },
  { path: '/bible-study', label: '구역성경공부', icon: BookOpen },
  { path: '/schedule', label: '주요일정', icon: CalendarDays },
  { path: '/prayer-requests', label: '기도제목', icon: MessageSquareHeart },
  { path: '/bible-reading', label: '성경읽기', icon: BookMarked },
  { path: '/admin', label: '관리자', icon: Settings, leaderOnly: true },
  { path: '/districts', label: '구역 관리', icon: Building2, masterOnly: true },
];

type MobileTabItem = {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPaths?: string[];
};

const mobileTabItems: MobileTabItem[] = [
  { path: '/dashboard', label: '홈', icon: Home },
  { path: '/qt', label: 'QT', icon: BookHeart },
  {
    path: '/bible-study',
    label: '구역',
    icon: Users,
    matchPaths: ['/bible-study', '/prayer-requests', '/bible-reading', '/schedule'],
  },
  { path: '/profile', label: '나', icon: UserCircle },
];

function isItemVisible(
  item: { leaderOnly?: boolean; masterOnly?: boolean; simpleHide?: boolean },
  isLeader: boolean,
  isMaster: boolean,
  isSimple: boolean,
) {
  if (item.masterOnly && !isMaster) return false;
  if (item.leaderOnly && !isLeader) return false;
  if (item.simpleHide && isSimple) return false;
  return true;
}

function HeaderActionFallback({ type }: { type: 'search' | 'notification' }) {
  if (type === 'search') {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          className="hidden md:flex items-center gap-2 text-muted-foreground text-xs h-8 px-3 w-40"
          disabled
        >
          <Search className="w-3.5 h-3.5" />
          <span>검색</span>
          <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
        </Button>
        <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground" disabled>
          <Search className="w-4 h-4" />
        </Button>
      </>
    );
  }

  return (
    <Button variant="ghost" size="icon" className="relative text-muted-foreground" disabled>
      <Bell className="w-4 h-4" />
    </Button>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isMaster, isLeader, isSuperAdmin } = useAuth();
  const { uiMode, isPendingDeletion, deletionDate } = useChurch();
  const isSimple = uiMode === 'simple';
  const deletionDaysLeft = deletionDate
    ? Math.max(0, Math.ceil((new Date(deletionDate).getTime() - Date.now()) / 86400000))
    : null;
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

  // 인증 후 모든 페이지 청크를 백그라운드에서 미리 로드 (첫 방문 Suspense 스피너 제거)
  useEffect(() => {
    const prefetch = () => {
      import('@/pages/BibleStudyList').catch(() => {});
      import('@/pages/BibleStudyDetail').catch(() => {});
      import('@/pages/PrayerRequests').catch(() => {});
      import('@/pages/PrayerRequestDetail').catch(() => {});
      import('@/pages/ScheduleManagement').catch(() => {});
      import('@/pages/BibleReading').catch(() => {});
      import('@/pages/AdminDashboard').catch(() => {});
      import('@/pages/Profile').catch(() => {});
      import('@/pages/UserManual').catch(() => {});
      import('@/pages/DistrictManagement').catch(() => {});
      import('@/pages/QTMain').catch(() => {});
      import('@/pages/QTPray').catch(() => {});
      import('@/pages/QTComplete').catch(() => {});
    };
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(prefetch);
      return () => cancelIdleCallback(id);
    } else {
      const id = setTimeout(prefetch, 1000);
      return () => clearTimeout(id);
    }
  }, []);

  const { data: unreadReplyCount = 0 } = useQuery({
    queryKey: ['unread_reply_count'],
    queryFn: getUnreadReplyCount,
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const toggleTheme = () => {
    setTheme(activeTheme === 'dark' ? 'light' : 'dark');
  };

  const isMoreActive =
    location.pathname === '/manual' ||
    location.pathname === '/bible-reading' ||
    location.pathname === '/admin' ||
    location.pathname === '/districts' ||
    location.pathname.startsWith('/leader/');

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

      {/* 교회 삭제 예정 배너 */}
      {isPendingDeletion && deletionDaysLeft !== null && (
        <div className="bg-destructive text-destructive-foreground text-xs text-center py-2 px-4 flex items-center justify-center gap-2">
          <span className="font-semibold">서비스 종료 예정</span>
          <span>{deletionDaysLeft > 0 ? `D-${deletionDaysLeft} 후 데이터가 영구 삭제됩니다` : '오늘 데이터가 영구 삭제됩니다'}</span>
          <Link to="/support" className="underline underline-offset-2 font-semibold">복구 문의</Link>
        </div>
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-6 h-14 md:h-16">
          <Link to="/dashboard" className="flex items-center gap-2 md:gap-3">
            <img src="/icon-192.svg" alt="벧엘" className="w-8 h-8 md:w-10 md:h-10 rounded-lg" />
            <div className="hidden sm:flex flex-col">
              <span className="font-display font-semibold text-sm md:text-base">{currentDistrictName} 구역</span>
              {isViewingOtherDistrict && (
                <span className="text-[11px] text-muted-foreground">
                  내 기본 구역: {homeDistrictName}
                </span>
              )}
            </div>
          </Link>

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
            {!isSimple && (
              <Suspense fallback={<HeaderActionFallback type="search" />}>
                <GlobalSearch />
              </Suspense>
            )}
            <Link
              to="/profile"
              className="hidden sm:flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors relative"
            >
              <span className="relative">
                <UserCircle className="w-4 h-4 md:w-5 md:h-5" />
                {unreadReplyCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500" />
                )}
              </span>
              {user?.name} {user?.role === 'master' ? '(마스터)' : user?.role === 'leader' ? '(구역장)' : ''}
            </Link>
            <Suspense fallback={<HeaderActionFallback type="notification" />}>
              <NotificationCenter />
            </Suspense>
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
                    if (!isItemVisible(item, isLeader, isMaster, isSimple)) return null;
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
                  <Link
                    to="/support"
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                      location.pathname === '/support' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    <span className="relative">
                      <HelpCircle className="w-4 h-4" />
                      {unreadReplyCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </span>
                    문의하기
                    {unreadReplyCount > 0 && (
                      <span className="ml-auto text-xs bg-blue-500 text-white rounded-full px-1.5 py-0.5">
                        {unreadReplyCount}
                      </span>
                    )}
                  </Link>
                  {isSuperAdmin && (
                    <Link
                      to="/superadmin"
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                        location.pathname === '/superadmin' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      슈퍼어드민
                    </Link>
                  )}
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

      <div className="mx-auto flex max-w-7xl md:px-6">
        {/* Tablet / desktop nav */}
        <aside className="hidden w-52 shrink-0 md:block lg:w-56">
          <nav
            className="sticky top-20 flex flex-col gap-1 py-6 pr-4"
            aria-label="주 메뉴"
          >
            {navItems.map(item => {
              if (!isItemVisible(item, isLeader, isMaster, isSimple)) return null;
              const active = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="mt-3 border-t pt-3 flex flex-col gap-1">
              {[
                { path: '/profile', label: '내 프로필', icon: UserCircle },
                { path: '/manual',  label: '사용 안내',  icon: HelpCircle },
                { path: '/support', label: '문의하기',   icon: HelpCircle },
              ].map(({ path, label, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  className={`flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    location.pathname === path
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="relative">
                    {label}
                    {path === '/support' && unreadReplyCount > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold w-4 h-4">
                        {unreadReplyCount}
                      </span>
                    )}
                  </span>
                </Link>
              ))}
              {isSuperAdmin && (
                <Link
                  to="/superadmin"
                  className={`flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    location.pathname === '/superadmin'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>슈퍼어드민</span>
                </Link>
              )}
            </div>
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-6 md:px-0 md:py-6">
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

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-4 px-2 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1">
          {mobileTabItems.map(item => {
            const active = item.matchPaths
              ? item.matchPaths.some(p => location.pathname.startsWith(p))
              : location.pathname.startsWith(item.path);
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
        </div>
      </nav>
    </div>
  );
}
