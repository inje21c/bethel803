import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/authContext';
import { useChurch } from '@/lib/churchContext';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ChevronRight, ChevronDown, Clock, MessageSquareHeart, Megaphone, CalendarDays, Share2 } from 'lucide-react';

const FIRST_WEEK_STEPS = [
  {
    step: 1,
    icon: Share2,
    label: '구역원 초대하기',
    desc: '초대 링크를 카카오톡으로 보내세요',
    link: '/admin?tab=members',
    tutorial: '초대 링크를 복사해서 카카오톡 단체채팅방에 붙여넣기만 하면 됩니다. 구역원이 링크를 누르면 자동으로 구역에 배정됩니다.',
  },
  {
    step: 2,
    icon: Megaphone,
    label: '이번 주 모임 공지 보내기',
    desc: '공지문을 자동으로 만들어 카카오톡에 붙여넣기',
    link: '/admin?tab=kakao',
    tutorial: '날짜·장소를 입력하면 공지문을 자동으로 만들어 줍니다. 복사해서 카카오톡에 붙여넣기만 하세요.',
  },
  {
    step: 3,
    icon: MessageSquareHeart,
    label: '기도제목 함께 나누기',
    desc: '구역원이 기도제목을 올리면 함께 기도해요',
    link: '/prayer-requests',
    tutorial: '구역원이 앱에서 기도제목을 올리면 알림이 옵니다. 확인하고 댓글로 함께 기도할 수 있습니다.',
  },
  {
    step: 4,
    icon: CalendarDays,
    label: '구역모임 일정 등록하기',
    desc: '이번 모임 날짜와 장소를 앱에 등록하세요',
    link: '/schedule',
    tutorial: '이번 모임 날짜와 장소를 등록해 두면 구역원들이 앱에서 바로 확인할 수 있습니다.',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings: church } = useChurch();
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

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

        {/* 첫 주 할 일 4단계 — 클릭 시 튜터리얼 확장 */}
        <div className="rounded-2xl border bg-card p-5 space-y-1">
          <p className="text-sm font-semibold mb-3">첫 주에 이것만 해보세요</p>
          {FIRST_WEEK_STEPS.map(({ step, icon: Icon, label, desc, link, tutorial }) => {
            const isOpen = expandedStep === step;
            return (
              <div key={step} className="border-b last:border-0">
                <button
                  type="button"
                  className="w-full flex items-start gap-3 py-2.5 text-left"
                  onClick={() => setExpandedStep(isOpen ? null : step)}
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">{step}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                    : <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                  }
                </button>

                {isOpen && (
                  <div className="ml-10 pb-3 space-y-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">{tutorial}</p>
                    <Link
                      to={link}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      바로 가기 <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
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
