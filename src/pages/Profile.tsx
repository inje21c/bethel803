import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BellRing, BookMarked, BookOpen, ChevronLeft, ChevronRight,
  Link2, Lock, LogOut, MessageCircleQuestion, Moon, Flame, Heart,
  Save, Smartphone, Sun, Trash2, User, Copy,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { useDistrict } from '@/lib/districtContext';
import {
  deactivatePushSubscription,
  deleteMyAccount,
  getActivityCalendar,
  getMyStreak,
  getNotificationPreferences,
  getPushSubscriptions,
  getYearlyChapterCount,
  getYearlyPrayerCount,
  getYearlyQTCount,
  getYearlyStudyCompletedCount,
  saveNotificationPreferences,
  savePushSubscription,
  updateUserName,
  type ActivityDay,
} from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  getCurrentBrowserSubscription,
  getPushPermissionState,
  getPushSetupMessage,
  hasPushSetupReady,
  isPushSupported,
  subscribeBrowserPush,
  unsubscribeBrowserPush,
} from '@/lib/push';
import { toast } from 'sonner';

export default function Profile() {
  const navigate = useNavigate();
  const { user, updatePassword, refreshProfile, linkGoogleAccount, linkKakaoAccount, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const { currentDistrictId } = useDistrict();
  const queryClient = useQueryClient();

  // ── 소셜 계정 연결 ─────────────────────────────────────────
  const [googleLinking, setGoogleLinking] = useState(false);
  const [kakaoLinking, setKakaoLinking] = useState(false);
  const { data: identities = [] } = useQuery({
    queryKey: ['auth_identities', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw error;
      return data?.identities ?? [];
    },
    enabled: !!user,
  });
  const googleIdentity = identities.find(i => i.provider === 'google');
  const kakaoIdentity = identities.find(i => i.provider === 'kakao');

  const linkErrorMessage = (err: unknown, label: string) => {
    const msg = err instanceof Error ? err.message : '';
    return msg.toLowerCase().includes('manual linking')
      ? '계정 연결 기능이 아직 활성화되지 않았습니다. 관리자에게 문의해주세요.'
      : `${label} 계정 연결에 실패했습니다.`;
  };
  const handleGoogleLink = async () => {
    setGoogleLinking(true);
    try { await linkGoogleAccount(); } catch (err) { toast.error(linkErrorMessage(err, '구글')); setGoogleLinking(false); }
  };
  const handleKakaoLink = async () => {
    setKakaoLinking(true);
    try { await linkKakaoAccount(); } catch (err) { toast.error(linkErrorMessage(err, '카카오')); setKakaoLinking(false); }
  };

  // ── 이름/비밀번호 변경 ─────────────────────────────────────
  const [name, setName] = useState(user?.name ?? '');
  const [nameLoading, setNameLoading] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleNameSave = async () => {
    if (!name.trim() || name.trim() === user?.name) return;
    setNameLoading(true);
    try {
      await updateUserName(user!.id, name.trim());
      await refreshProfile();
      toast.success('이름이 변경되었습니다.');
    } catch { toast.error('이름 변경에 실패했습니다.'); }
    finally { setNameLoading(false); }
  };
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { toast.error('새 비밀번호가 일치하지 않습니다.'); return; }
    if (newPw.length < 6) { toast.error('비밀번호는 6자 이상이어야 합니다.'); return; }
    setPwLoading(true);
    try {
      await updatePassword(newPw);
      setNewPw(''); setConfirmPw('');
      toast.success('비밀번호가 변경되었습니다.');
    } catch { toast.error('비밀번호 변경에 실패했습니다. 다시 로그인 후 시도해 주세요.'); }
    finally { setPwLoading(false); }
  };
  async function handleDeleteAccount() {
    if (deleteConfirm !== '탈퇴') return;
    setDeleteLoading(true);
    try {
      const result = await deleteMyAccount();
      if (result.error === 'master_has_members' || result.error === 'leader_has_members') { toast.error(result.message ?? '다른 구성원이 있습니다. 먼저 권한을 이전해주세요.'); return; }
      if (result.error) { toast.error(result.message ?? result.error); return; }
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } finally { setDeleteLoading(false); }
  }

  // ── 알림/푸시 ──────────────────────────────────────────────
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>(getPushPermissionState());
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const pushSupported = isPushSupported();
  const pushSetupMessage = getPushSetupMessage();
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    ((navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
  const { data: subscriptions = [] } = useQuery({
    queryKey: ['push_subscriptions', user?.id],
    queryFn: () => getPushSubscriptions(user!.id),
    enabled: !!user,
  });
  const { data: preferences = {
    scheduleEnabled: true, studyEnabled: true, devotionalEnabled: true,
    prayerEnabled: true, readingWeeklyEnabled: true, serviceNoticeEnabled: true,
    quietHoursStart: null, quietHoursEnd: null, digestMode: 'instant' as const,
  } } = useQuery({
    queryKey: ['notification_preferences', user?.id],
    queryFn: () => getNotificationPreferences(user!.id),
    enabled: !!user,
  });
  const activeSubscriptions = useMemo(() => subscriptions.filter(s => s.isActive), [subscriptions]);
  const currentDeviceSubscription = useMemo(
    () => activeSubscriptions.find(s => s.endpoint === currentEndpoint) ?? null,
    [activeSubscriptions, currentEndpoint],
  );
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPermissionState(getPushPermissionState());
      if (!pushSupported) { setCurrentEndpoint(null); return; }
      try {
        const sub = await getCurrentBrowserSubscription();
        if (!cancelled) setCurrentEndpoint(sub?.endpoint ?? null);
      } catch { if (!cancelled) setCurrentEndpoint(null); }
    })();
    return () => { cancelled = true; };
  }, [pushSupported]);

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!user?.districtId) throw new Error('소속 구역 정보가 없어 구독을 진행할 수 없습니다.');
      const sub = await subscribeBrowserPush();
      await savePushSubscription({ userId: user.id, districtId: user.districtId, ...sub });
      return sub.endpoint;
    },
    onSuccess: (endpoint) => {
      setPermissionState(getPushPermissionState()); setCurrentEndpoint(endpoint);
      queryClient.invalidateQueries({ queryKey: ['push_subscriptions'] });
      toast.success('이 기기에서 알림 구독이 활성화되었습니다.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : '구독 설정에 실패했습니다.'),
  });
  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      const endpoint = await unsubscribeBrowserPush();
      if (endpoint && user) await deactivatePushSubscription(user.id, endpoint);
      return endpoint;
    },
    onSuccess: (endpoint) => {
      setPermissionState(getPushPermissionState()); setCurrentEndpoint(null);
      queryClient.invalidateQueries({ queryKey: ['push_subscriptions'] });
      toast.success(endpoint ? '현재 기기의 알림 구독을 해지했습니다.' : '이 기기에는 활성 구독이 없습니다.');
    },
    onError: () => toast.error('구독 해지에 실패했습니다.'),
  });
  const preferenceMutation = useMutation({
    mutationFn: (patch: Partial<typeof preferences>) => saveNotificationPreferences(user!.id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification_preferences'] }),
    onError: () => toast.error('알림 설정 저장에 실패했습니다.'),
  });

  // ── 스트릭 ─────────────────────────────────────────────────
  const { data: streak } = useQuery({
    queryKey: ['streak', user?.id],
    queryFn: () => getMyStreak(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  // ── 나 탭 연간 통계 쿼리 ──────────────────────────────────
  const thisYear = new Date().getFullYear();
  const { data: yearlyQT = 0 } = useQuery({
    queryKey: ['yearly_qt', user?.id, thisYear],
    queryFn: () => getYearlyQTCount(user!.id, thisYear),
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });
  const { data: yearlyChapters = 0 } = useQuery({
    queryKey: ['yearly_chapters', user?.id, thisYear],
    queryFn: () => getYearlyChapterCount(user!.id, thisYear),
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });
  const { data: yearlyStudy = 0 } = useQuery({
    queryKey: ['yearly_study', user?.id, thisYear],
    queryFn: () => getYearlyStudyCompletedCount(user!.id, thisYear),
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });
  const { data: yearlyPrayer = 0 } = useQuery({
    queryKey: ['yearly_prayer', user?.id, thisYear],
    queryFn: () => getYearlyPrayerCount(user!.id, thisYear),
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });

  // ── 활동 캘린더 ────────────────────────────────────────────
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const { data: activityDays = [] } = useQuery({
    queryKey: ['activity_calendar', user?.id, currentDistrictId, calYear, calMonth],
    queryFn: () => getActivityCalendar(user!.id, currentDistrictId, calYear, calMonth),
    enabled: !!user && !!currentDistrictId,
  });
  const activityMap = useMemo(() => {
    const m = new Map<string, ActivityDay>();
    activityDays.forEach(d => m.set(d.date, d));
    return m;
  }, [activityDays]);
  const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth() + 1;
  const prevCal = () => { if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); } else setCalMonth(m => m - 1); };
  const nextCal = () => { if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); } else setCalMonth(m => m + 1); };

  const roleLabel = user?.role === 'master' ? '마스터구역장' : user?.role === 'leader' ? '구역장' : '구역원';

  // ── 설정 섹션 토글 ─────────────────────────────────────────
  const [showEditSection, setShowEditSection] = useState(false);
  const [showNotifSection, setShowNotifSection] = useState(false);
  const [searchParams] = useSearchParams();
  const [showSupportSection, setShowSupportSection] = useState(() => searchParams.get('support') === '1');
  const [showAccountDrop, setShowAccountDrop] = useState(false);

  useEffect(() => {
    if (searchParams.get('support') === '1') {
      const t = setTimeout(() => document.getElementById('support-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  return (
    <AppLayout>
      <div className="space-y-5">

        {/* 프로필 히어로 */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="rounded-2xl bg-primary p-5 space-y-4 relative overflow-hidden">
            {/* 데코 원 */}
            <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-accent/15 pointer-events-none" />
            {/* 아바타 + 이름 + 역할 */}
            <div className="flex items-center gap-4">
              <div className="w-[50px] h-[50px] rounded-full bg-accent flex items-center justify-center shrink-0">
                <span className="font-bold text-xl" style={{ color: '#1c2a44' }}>{user?.name?.slice(0, 1)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-[17px] text-primary-foreground">{user?.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  {(user?.role === 'master') && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent" style={{ color: '#1c2a44' }}>마스터</span>
                  )}
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary-foreground/20 text-primary-foreground">{roleLabel}</span>
                  <span className="text-[13px] text-primary-foreground/60 truncate">{user?.districtName}</span>
                </div>
              </div>
            </div>
            {/* streak 3종 패널 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-primary-foreground/10 rounded-xl py-2.5 text-center">
                <p className="font-display text-[18px] font-bold text-accent">{streak?.currentStreak ?? 0}</p>
                <p className="text-[10px] text-primary-foreground/60 mt-0.5">QT일</p>
              </div>
              <div className="bg-primary-foreground/10 rounded-xl py-2.5 text-center">
                <p className="font-display text-[18px] font-bold text-accent">{yearlyChapters}</p>
                <p className="text-[10px] text-primary-foreground/60 mt-0.5">읽기장</p>
              </div>
              <div className="bg-primary-foreground/10 rounded-xl py-2.5 text-center">
                <p className="font-display text-[18px] font-bold text-accent">{yearlyPrayer}</p>
                <p className="text-[10px] text-primary-foreground/60 mt-0.5">기도건</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 활동 캘린더 */}
        <div>
          <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">활동 기록</p>
          <div className="card-elevated p-4">
            {/* 범례 상단 */}
            <div className="flex items-center justify-center gap-4 mb-3 pb-2 border-b border-border/50">
              {[['#4A7AB5','QT'],['#5FAD2A','성경읽기'],['#C8002A','일정']].map(([color, label]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-4 h-[3px] rounded-full" style={{ background: color }} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevCal} className="p-1 rounded-md hover:bg-muted transition-colors" aria-label="이전 달">
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <span className="text-[15px] font-medium">{calYear}년 {calMonth}월</span>
              <button onClick={nextCal} disabled={isCurrentMonth} className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-30" aria-label="다음 달">
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['일','월','화','수','목','금','토'].map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const act = activityMap.get(dateStr);
                const isToday = dateStr === todayStr;
                const isFuture = dateStr > todayStr;
                const numCls = isToday
                  ? 'text-accent font-bold'
                  : isFuture
                    ? 'text-muted-foreground/30'
                    : 'text-foreground';
                const off = 'rgba(140,140,140,0.2)';
                const hasSchedule = !!act?.hasSchedule;
                const cellInner = (
                  <>
                    <span className={`text-[13px] leading-tight ${numCls}`}>{day}</span>
                    <div className="w-full flex flex-col gap-[2px]">
                      <div className="h-[3px] rounded-full" style={{ background: (!isFuture && act?.qtDone) ? '#4A7AB5' : off }} />
                      <div className="h-[3px] rounded-full" style={{ background: (!isFuture && act?.readingDone) ? '#5FAD2A' : off }} />
                      <div className="h-[3px] rounded-full" style={{ background: hasSchedule ? '#C8002A' : off }} />
                    </div>
                  </>
                );
                const baseCls = `flex flex-col items-center gap-[3px] pb-1 ${isToday ? 'border-2 border-accent rounded-md' : ''}`;
                return hasSchedule ? (
                  <button
                    key={day}
                    type="button"
                    onClick={() => navigate(`/schedule?date=${dateStr}`)}
                    className={`${baseCls} cursor-pointer hover:bg-muted/60 rounded-md transition-colors`}
                    aria-label={`${calMonth}월 ${day}일 일정 보기`}
                  >
                    {cellInner}
                  </button>
                ) : (
                  <div key={day} className={baseCls}>{cellInner}</div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 설정 */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 px-1">설정</p>
          <div className="card-elevated overflow-hidden">
            {[
              {
                icon: <User className="w-4 h-4" />, label: '프로필 수정', iconBg: 'bg-primary/10 text-primary',
                onClick: () => setShowEditSection(v => !v),
                right: <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${showEditSection ? 'rotate-90' : ''}`} />,
              },
              {
                icon: resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />,
                label: resolvedTheme === 'dark' ? '라이트 모드' : '다크 모드',
                iconBg: 'bg-muted text-muted-foreground',
                onClick: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
                right: (
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${resolvedTheme === 'dark' ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${resolvedTheme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                ),
              },
              {
                icon: <BellRing className="w-4 h-4" />, label: '알림 설정', iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
                onClick: () => setShowNotifSection(v => !v),
                right: <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${showNotifSection ? 'rotate-90' : ''}`} />,
              },
              {
                icon: <BookOpen className="w-4 h-4" />, label: '사용 안내', iconBg: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600',
                onClick: () => navigate('/manual'),
                right: <ChevronRight className="w-4 h-4 text-muted-foreground" />,
              },
              {
                icon: <MessageCircleQuestion className="w-4 h-4" />, label: '문의하기', iconBg: 'bg-muted text-muted-foreground',
                onClick: () => navigate('/support'),
                right: <ChevronRight className="w-4 h-4 text-muted-foreground" />,
              },
            ].map((row, i, arr) => (
              <div key={row.label}>
                <button onClick={row.onClick} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${row.iconBg}`}>{row.icon}</div>
                  <span className="flex-1 text-sm font-medium">{row.label}</span>
                  {row.right}
                </button>
                {/* 프로필 수정 확장 섹션 */}
                {row.label === '프로필 수정' && showEditSection && (
                  <div className="px-4 pb-4 space-y-4 border-t bg-muted/30">
                    <div className="space-y-2 pt-4">
                      <Label htmlFor="name" className="text-xs">이름 변경</Label>
                      <div className="flex gap-2">
                        <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="변경할 이름" maxLength={20} className="h-9 text-sm" />
                        <Button size="sm" disabled={nameLoading || !name.trim() || name.trim() === user?.name} onClick={handleNameSave} className="shrink-0 gap-1 h-9">
                          {nameLoading ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          저장
                        </Button>
                      </div>
                    </div>
                    <Separator />
                    <form onSubmit={handlePasswordChange} className="space-y-2">
                      <Label className="text-xs">비밀번호 변경</Label>
                      <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="새 비밀번호 (6자 이상)" minLength={6} className="h-9 text-sm" />
                      <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="새 비밀번호 확인" minLength={6} className="h-9 text-sm" />
                      {confirmPw && newPw !== confirmPw && <p className="text-xs text-destructive">비밀번호가 일치하지 않습니다.</p>}
                      <Button type="submit" size="sm" className="w-full h-9" disabled={pwLoading || !newPw || newPw !== confirmPw}>
                        {pwLoading && <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-1.5" />}
                        비밀번호 변경
                      </Button>
                    </form>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-xs">소셜 계정 연결</Label>
                      {googleIdentity ? (
                        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                          <div className="min-w-0"><p className="text-xs font-medium">Google 연결됨</p><p className="truncate text-[11px] text-muted-foreground">{(googleIdentity.identity_data?.email as string) ?? ''}</p></div>
                          <Badge variant="secondary" className="text-[10px]">Google</Badge>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="w-full gap-2 h-9 text-sm" disabled={googleLinking} onClick={handleGoogleLink}>
                          <Link2 className="w-3.5 h-3.5" />{googleLinking ? '이동 중...' : '구글 계정 연결하기'}
                        </Button>
                      )}
                      {kakaoIdentity ? (
                        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                          <div className="min-w-0"><p className="text-xs font-medium">Kakao 연결됨</p><p className="truncate text-[11px] text-muted-foreground">{(kakaoIdentity.identity_data?.email as string) ?? ''}</p></div>
                          <Badge variant="secondary" className="text-[10px]">Kakao</Badge>
                        </div>
                      ) : (
                        <Button size="sm" className="w-full gap-2 bg-[#FEE500] text-[#191919] hover:bg-[#FEE500]/90 h-9 text-sm" disabled={kakaoLinking} onClick={handleKakaoLink}>
                          <Link2 className="w-3.5 h-3.5" />{kakaoLinking ? '이동 중...' : '카카오 계정 연결하기'}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {/* 알림 설정 확장 섹션 */}
                {row.label === '알림 설정' && showNotifSection && (
                  <div className="px-4 pb-4 space-y-4 border-t bg-muted/30">
                    <div className="grid gap-2 sm:grid-cols-3 pt-4">
                      {[
                        { label: '현재 기기', value: currentDeviceSubscription ? '구독됨' : '미구독' },
                        { label: '브라우저 권한', value: permissionState === 'granted' ? '허용됨' : permissionState === 'denied' ? '차단됨' : permissionState === 'default' ? '미선택' : '미지원' },
                        { label: '활성 기기', value: `${activeSubscriptions.length}대` },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-lg border bg-muted/40 px-3 py-2">
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                          <p className="mt-0.5 text-xs font-medium">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg border bg-card p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary shrink-0"><Smartphone className="w-3.5 h-3.5" /></div>
                        <p className="text-xs text-muted-foreground leading-5">
                          {pushSetupMessage ?? (permissionState === 'denied' ? '브라우저 설정에서 알림 차단을 해제한 뒤 다시 시도해 주세요.' : !isStandalone ? '홈 화면에 추가한 뒤 구독하면 더 안정적입니다.' : '현재 기기에서 바로 알림을 받을 수 있습니다.')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => subscribeMutation.mutate()} disabled={subscribeMutation.isPending || !pushSupported || !hasPushSetupReady() || permissionState === 'denied' || !!currentDeviceSubscription}>
                          {subscribeMutation.isPending ? '설정 중...' : currentDeviceSubscription ? '구독됨' : '구독하기'}
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => unsubscribeMutation.mutate()} disabled={unsubscribeMutation.isPending || !currentDeviceSubscription}>
                          {unsubscribeMutation.isPending ? '해지 중...' : '구독 해지'}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[
                        ['scheduleEnabled', '일정 알림'], ['studyEnabled', '성경공부 알림'],
                        ['devotionalEnabled', '오늘의 묵상'], ['prayerEnabled', '기도제목 알림'],
                        ['readingWeeklyEnabled', '주간 성경읽기'], ['serviceNoticeEnabled', '서비스 공지'],
                      ].map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between rounded-lg border px-3 py-2">
                          <p className="text-xs font-medium">{label}</p>
                          <Switch checked={preferences[key as keyof typeof preferences] as boolean} onCheckedChange={v => preferenceMutation.mutate({ [key]: v })} disabled={preferenceMutation.isPending} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {i < arr.length - 1 && <div className="border-t mx-4" />}
              </div>
            ))}
          </div>
        </div>

        {/* 개발자 후원 카드 */}
        <div id="support-card" className="card-elevated overflow-hidden">
          <button
            onClick={() => setShowSupportSection(v => !v)}
            className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-rose-100 dark:bg-rose-900/30 text-rose-600">
              <Heart className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">개발자 후원하기</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">이 앱을 만들고 운영하는 데 힘이 됩니다</p>
            </div>
            <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${showSupportSection ? 'rotate-90' : ''}`} />
          </button>
          {showSupportSection && (
            <div className="px-4 pb-4 space-y-3 border-t bg-muted/20">
              <p className="text-xs text-muted-foreground leading-5 pt-4">
                이 앱은 작은 모임들이 함께 신앙생활을 이어가도록 한 사람이 만들고 운영하고 있어요. 보내주시는 마음은 서버 운영과 기능 개선에 소중히 쓰입니다. 후원은 전적으로 자율이며, 하지 않으셔도 모든 기능을 그대로 사용하실 수 있습니다.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full h-9 gap-1.5"
                onClick={() => setShowAccountDrop(v => !v)}
              >
                <Heart className="w-3.5 h-3.5 text-rose-500" />
                후원하기
                <ChevronRight className={`w-3.5 h-3.5 ml-auto transition-transform ${showAccountDrop ? 'rotate-90' : ''}`} />
              </Button>
              {showAccountDrop && (
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  {[
                    ['은행', '토스뱅크'],
                    ['계좌번호', '1000-0177-6433'],
                    ['예금주', '현철민'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                      <span className="text-sm font-medium">{value}</span>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-9 gap-1.5 mt-1"
                    onClick={() => {
                      navigator.clipboard.writeText('토스뱅크 1000-0177-6433 현철민')
                        .then(() => toast.success('계좌 정보가 복사되었습니다.'))
                        .catch(() => toast.error('복사에 실패했습니다.'));
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    복사
                  </Button>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground text-center leading-5">
                보내주신 후원에 진심으로 감사드립니다.
              </p>
            </div>
          )}
        </div>

        {/* 계정 관리 */}
        <div className="card-elevated overflow-hidden">
          <button onClick={async () => { await logout(); navigate('/'); }} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-muted text-muted-foreground"><LogOut className="w-4 h-4" /></div>
            <span className="text-sm font-medium">로그아웃</span>
          </button>
          <div className="border-t mx-4" />
          <button onClick={() => setDeleteConfirm(v => v === '' ? 'show' : '')} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-destructive/5 transition-colors text-left">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-destructive/10 text-destructive"><Trash2 className="w-4 h-4" /></div>
            <span className="text-sm font-medium text-destructive">회원 탈퇴</span>
            <ChevronRight className="w-4 h-4 text-destructive ml-auto" />
          </button>
          {deleteConfirm !== '' && (
            <div className="px-4 pb-4 space-y-3 border-t bg-destructive/5">
              <p className="text-xs text-muted-foreground pt-3">탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.{user?.role === 'master' && ' 교회의 모든 데이터가 함께 삭제됩니다.'}</p>
              <div className="space-y-1.5">
                <Label htmlFor="deleteConfirm" className="text-xs">확인을 위해 <span className="font-bold text-destructive">탈퇴</span>를 입력하세요</Label>
                <Input id="deleteConfirm" value={deleteConfirm === 'show' ? '' : deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="탈퇴" className="border-destructive/30 h-9 text-sm focus-visible:ring-destructive/30" />
              </div>
              <Button variant="destructive" size="sm" className="w-full h-9" disabled={deleteConfirm !== '탈퇴' || deleteLoading} onClick={handleDeleteAccount}>
                {deleteLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />}
                계정 영구 삭제
              </Button>
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}
