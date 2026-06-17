import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/authContext';
import { useChurch } from '@/lib/churchContext';
import { Button } from '@/components/ui/button';
import { CalendarDays, CheckCircle2, ChevronRight, Clock, MessageSquareHeart, Megaphone, FileText } from 'lucide-react';

const FIRST_WEEK_STEPS = [
  {
    step: 1,
    icon: CalendarDays,
    label: '구역원 초대하기',
    desc: '초대 링크를 카카오톡으로 보내세요',
    link: '/admin?tab=members',
  },
  {
    step: 2,
    icon: Megaphone,
    label: '이번 주 모임 공지 보내기',
    desc: '공지문을 자동으로 만들어 카카오톡에 붙여넣기',
    link: '/admin?tab=kakao',
  },
  {
    step: 3,
    icon: MessageSquareHeart,
    label: '기도제목 함께 나누기',
    desc: '구역원이 기도제목을 올리면 함께 기도해요',
    link: '/prayer-requests',
  },
  {
    step: 4,
    icon: FileText,
    label: '모임 후 보고서 보내기',
    desc: '출석·성경읽기·성경공부를 한 번에 정리',
    link: '/admin?tab=report',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings: church } = useChurch();

  function handleStart() {
    localStorage.setItem('bethel_onboarded', '1');
    navigate('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">

        {/* 환영 헤더 */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🏛️</span>
          </div>
          <h1 className="font-display text-2xl font-bold">
            {church?.name ?? '교회'}에 오신 것을 환영합니다!
          </h1>
          <p className="text-sm text-muted-foreground">
            안녕하세요, {user?.name}님.<br />
            이것만 하시면 첫 주가 완성됩니다.
          </p>
        </div>

        {/* Trial 안내 */}
        {church?.isTrialing && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
            <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-primary">30일 무료 체험 중</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {church.trialDaysLeft}일 남음 · 모든 기능을 제한 없이 사용하세요
              </p>
            </div>
          </div>
        )}

        {/* 첫 주 할 일 4단계 */}
        <div className="rounded-2xl border bg-card p-5 space-y-1">
          <p className="text-sm font-semibold mb-3">첫 주에 이것만 해보세요</p>
          {FIRST_WEEK_STEPS.map(({ step, icon: Icon, label, desc }) => (
            <div key={step} className="flex items-start gap-3 py-2.5 border-b last:border-0">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">{step}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
              <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
            </div>
          ))}
        </div>

        {/* 안내 */}
        <div className="rounded-xl border bg-muted/40 px-4 py-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            카카오톡 대신 앱으로 공지·출석·기도제목을 관리하면 흩어진 내용을 한 곳에서 볼 수 있습니다.
          </p>
        </div>

        <Button className="w-full" size="lg" onClick={handleStart}>
          시작하기 <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
