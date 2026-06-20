import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { useDistrict } from '@/lib/districtContext';
import {
  getAllUsers, getSchedules, getAllBibleStudies, getQTDistrictSummary,
  getISOWeekNumber, getKSTDateString,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Users, CalendarDays, BookOpen, CheckCircle2, Circle,
  ChevronRight, Share2, AlertTriangle, Flame, X,
} from 'lucide-react';
import { useState } from 'react';
import type { FullUser } from '@/lib/api';

const ONBOARDING_KEY = 'admin_guide_dismissed';

const GUIDE_STEPS = [
  { icon: Share2,     label: '구역원 초대하기',   tab: 'members', desc: '초대 링크를 카카오톡에 공유하면 구역원이 자동 배정됩니다.' },
  { icon: BookOpen,   label: '성경공부 자료 등록', tab: 'prep',    desc: '이번 주 성경공부 자료를 등록하고 발행하세요.' },
  { icon: CalendarDays, label: '모임 일정 등록',  tab: 'prep',    desc: '구역 모임 일정을 등록하면 구역원 홈에 바로 표시됩니다.' },
];

interface Props {
  setActiveTab: (tab: string) => void;
}

export default function AdminOverviewTab({ setActiveTab }: Props) {
  const { user } = useAuth();
  const { currentDistrictId } = useDistrict();
  const today = getKSTDateString(new Date());
  const [guideDismissed, setGuideDismissed] = useState(
    () => localStorage.getItem(ONBOARDING_KEY) === '1'
  );

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all_users', currentDistrictId],
    queryFn: () => getAllUsers(currentDistrictId),
    enabled: !!currentDistrictId,
    staleTime: 30_000,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', currentDistrictId],
    queryFn: () => getSchedules(currentDistrictId),
    enabled: !!currentDistrictId,
    staleTime: 30_000,
  });

  const { data: bibleStudies = [] } = useQuery({
    queryKey: ['all_bible_studies', currentDistrictId],
    queryFn: () => getAllBibleStudies(currentDistrictId),
    enabled: !!currentDistrictId,
    staleTime: 30_000,
  });

  const { data: qtMembers = [] } = useQuery({
    queryKey: ['qt_district_summary', currentDistrictId, today],
    queryFn: () => getQTDistrictSummary(currentDistrictId, today),
    enabled: !!currentDistrictId,
    refetchInterval: 60_000,
  });

  const pendingUsers = allUsers.filter((u: FullUser) => u.status === 'pending');
  const activeUsers = allUsers.filter((u: FullUser) => u.status === 'active');

  const upcomingSchedules = schedules.filter(s => new Date(s.date) >= new Date());
  const thisWeek = getISOWeekNumber(today);
  const hasPublishedStudyThisWeek = bibleStudies.some(
    s => s.published && getISOWeekNumber(s.date) === thisWeek
  );

  const qtCompleted = qtMembers.filter(m => m.isCompleted).length;
  const qtTotal = qtMembers.length;

  const actionItems = [
    pendingUsers.length > 0 && {
      key: 'pending',
      icon: Users,
      label: `승인 대기 ${pendingUsers.length}명`,
      desc: '초대 링크 없이 직접 가입한 구성원입니다.',
      tab: 'members',
      urgent: true,
    },
    !hasPublishedStudyThisWeek && {
      key: 'study',
      icon: BookOpen,
      label: '이번 주 성경공부 미발행',
      desc: '구역원들이 아직 이번 주 자료를 볼 수 없습니다.',
      tab: 'prep',
      urgent: false,
    },
    upcomingSchedules.length === 0 && {
      key: 'schedule',
      icon: CalendarDays,
      label: '예정 일정 없음',
      desc: '다가오는 구역 모임 일정을 등록해두세요.',
      tab: 'prep',
      urgent: false,
    },
  ].filter(Boolean) as { key: string; icon: typeof Users; label: string; desc: string; tab: string; urgent: boolean }[];

  const dismissGuide = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setGuideDismissed(true);
  };

  const isFirstTime = !guideDismissed && activeUsers.length <= 1;

  return (
    <div className="space-y-5">
      {/* 요약 숫자 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border bg-card p-4 text-center">
          <p className="font-display text-2xl font-bold text-primary">{activeUsers.length}</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">구역원</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 text-center">
          <p className="font-display text-2xl font-bold text-primary">{qtCompleted}<span className="text-[14px] text-muted-foreground font-normal">/{qtTotal}</span></p>
          <p className="text-[12px] text-muted-foreground mt-0.5">오늘 QT</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 text-center">
          <p className="font-display text-2xl font-bold text-primary">{upcomingSchedules.length}</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">예정 일정</p>
        </div>
      </div>

      {/* 첫 사용자 온보딩 가이드 */}
      {isFirstTime && (
        <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display font-semibold text-[15px]">구역 시작 3단계</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">먼저 이것부터 해보세요</p>
            </div>
            <button onClick={dismissGuide} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {GUIDE_STEPS.map(({ icon: Icon, label, tab, desc }) => (
              <button
                key={label}
                onClick={() => setActiveTab(tab)}
                className="w-full flex items-center gap-3 rounded-xl border bg-card p-3.5 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold">{label}</p>
                  <p className="text-[12px] text-muted-foreground">{desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
          <button onClick={dismissGuide} className="text-[12px] text-muted-foreground underline underline-offset-2 w-full text-center">
            다시 보지 않기
          </button>
        </div>
      )}

      {/* 처리 필요 항목 */}
      <div className="space-y-2">
        <p className="text-[13px] font-bold text-muted-foreground tracking-widest uppercase">처리 필요</p>
        {actionItems.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-3.5 text-[14px] text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            모든 항목이 처리되었습니다
          </div>
        ) : (
          actionItems.map(({ key, icon: Icon, label, desc, tab, urgent }) => (
            <button
              key={key}
              onClick={() => setActiveTab(tab)}
              className={`w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors hover:bg-muted/50
                ${urgent ? 'border-destructive/30 bg-destructive/5' : 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20'}`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${urgent ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-[14px] font-semibold ${urgent ? 'text-destructive' : 'text-amber-800 dark:text-amber-300'}`}>{label}</p>
                <p className="text-[12px] text-muted-foreground">{desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))
        )}
      </div>

      {/* 오늘 QT 현황 */}
      {qtMembers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-muted-foreground tracking-widest uppercase">오늘 QT 현황</p>
            <button onClick={() => setActiveTab('stats')} className="text-[12px] text-primary font-semibold hover:underline underline-offset-2">
              자세히 →
            </button>
          </div>
          <div className="rounded-2xl border bg-card divide-y">
            {qtMembers.map(m => {
              const daysSinceLast = m.lastCompleted
                ? Math.floor((new Date(today).getTime() - new Date(m.lastCompleted + 'T00:00:00').getTime()) / 86400000)
                : 999;
              const isRisk = !m.isCompleted && daysSinceLast >= 3;
              return (
                <div key={m.userId} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {isRisk && <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                    <span className={`text-[14px] font-medium ${isRisk ? 'text-destructive' : ''}`}>{m.userName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.currentStreak > 0 && (
                      <span className="text-[12px] text-orange-500 font-semibold flex items-center gap-0.5">
                        <Flame className="w-3 h-3" />{m.currentStreak}
                      </span>
                    )}
                    {m.isCompleted
                      ? <CheckCircle2 className="w-4 h-4 text-success" />
                      : <Circle className="w-4 h-4 text-muted-foreground" />
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 예정 일정 미리보기 */}
      {upcomingSchedules.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-muted-foreground tracking-widest uppercase">예정 일정</p>
            <button onClick={() => setActiveTab('prep')} className="text-[12px] text-primary font-semibold hover:underline underline-offset-2">
              관리 →
            </button>
          </div>
          <div className="rounded-2xl border bg-card divide-y">
            {upcomingSchedules.slice(0, 3).map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate">{s.title}</p>
                  <p className="text-[12px] text-muted-foreground">{s.date} {s.time} {s.location && `· ${s.location}`}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 구성원 없을 때 초대 유도 */}
      {activeUsers.length <= 1 && !isFirstTime && (
        <Button variant="outline" className="w-full" onClick={() => setActiveTab('members')}>
          <Share2 className="w-4 h-4 mr-2" />
          구역원 초대 링크 복사하기
        </Button>
      )}

      {/* 로그인 사용자 표시 */}
      {user && (
        <p className="text-[12px] text-muted-foreground text-center">
          {user.name}님으로 로그인 중
        </p>
      )}
    </div>
  );
}
