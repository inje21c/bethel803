import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/authContext';
import { Button } from '@/components/ui/button';
import { ChevronRight, MessageSquareHeart, Megaphone, CalendarDays, Share2, UserCheck } from 'lucide-react';

const FIRST_STEPS = [
  {
    step: 1,
    icon: Share2,
    label: '구성원 초대하기',
    link: '/admin?tab=members',
    tutorial: '초대 링크를 카카오톡 채팅방에 공유하면 됩니다. 링크를 누른 구성원은 자동으로 모임에 배정됩니다.',
  },
  {
    step: 2,
    icon: MessageSquareHeart,
    label: '기도제목 함께 나누기',
    link: '/prayer-requests',
    tutorial: '구역원이 기도제목을 올리면 알림이 옵니다. 댓글로 함께 기도할 수 있습니다.',
  },
  {
    step: 3,
    icon: Megaphone,
    label: '모임 공지 보내기',
    link: '/admin?tab=kakao',
    tutorial: '날짜·장소를 입력하면 공지문을 자동으로 만들어 줍니다. 복사해서 카카오톡에 붙여넣기만 하면 됩니다.',
  },
  {
    step: 4,
    icon: CalendarDays,
    label: '모임 일정 등록하기',
    link: '/schedule',
    tutorial: '모임 날짜와 장소를 등록해두면 구역원들이 앱에서 바로 확인할 수 있습니다.',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();

  function handleStart() {
    localStorage.setItem('bethel_onboarded', '1');
    navigate('/dashboard');
  }

  return (
    <div className="min-h-screen bg-primary/5 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-5">

        {/* 환영 헤더 */}
        <div className="rounded-2xl bg-primary p-6 relative overflow-hidden text-center">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-accent/15 pointer-events-none" />
          <p className="font-display text-[22px] font-bold text-primary-foreground">
            환영합니다, {user?.name}님
          </p>
          <p className="text-[13px] text-primary-foreground/60 mt-1">
            {user?.districtName ?? '모임'} 공간이 준비되었습니다
          </p>
        </div>

        {/* 솔로 사용 안내 */}
        <div className="rounded-xl border bg-card px-4 py-3.5 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <UserCheck className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[14px] font-semibold">혼자 먼저 써봐도 됩니다</p>
            <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">
              구성원은 나중에 언제든 초대 링크로 부를 수 있습니다.
              {user?.role === 'master' && (
                <> 실제 구역장에게 이관하고 싶을 때는 <span className="text-primary font-medium">[나] → [관리]</span>에서 마스터 권한을 넘길 수 있습니다.</>
              )}
            </p>
          </div>
        </div>

        {/* 할 일 목록 */}
        <div className="rounded-2xl border bg-card p-5 space-y-1">
          <p className="text-[14px] font-semibold mb-3">준비되셨다면 이것부터 해보세요</p>
          {FIRST_STEPS.map(({ step, icon: Icon, label, tutorial, link }) => (
            <div key={step} className="border-b last:border-0 py-3">
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[12px] font-bold text-primary">{step}</span>
                </div>
                <p className="text-[14px] font-medium flex-1">{label}</p>
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
              <div className="ml-10 space-y-1.5">
                <p className="text-[13px] text-muted-foreground leading-relaxed">{tutorial}</p>
                <Link
                  to={link}
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
                >
                  바로 가기 <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        <Button className="w-full" size="lg" onClick={handleStart}>
          시작하기 <ChevronRight className="w-4 h-4 ml-1" />
        </Button>

        <p className="text-center text-[13px] text-muted-foreground">
          사용 방법이 궁금하다면{' '}
          <Link to="/manual" className="text-primary underline underline-offset-2 font-medium">이용안내</Link>를 확인하세요
        </p>
      </div>
    </div>
  );
}
