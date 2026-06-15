import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { getMyChurchInfo } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Users, BookOpen, MessageSquare, BookMarked, ChevronRight, Clock,
} from 'lucide-react';

const FEATURES = [
  { icon: MessageSquare, label: '기도제목 나눔', desc: '구역 기도제목을 함께 나누고 중보기도' },
  { icon: BookOpen, label: '오늘의 QT', desc: '매일 말씀 묵상 + AI 깊은 묵상' },
  { icon: BookMarked, label: '성경읽기 계획', desc: '구역별 읽기 현황 한눈에 확인' },
  { icon: Users, label: '성경공부 자료', desc: '주간 성경공부 자료 공유 및 관리' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: church } = useQuery({
    queryKey: ['my_church_info'],
    queryFn: getMyChurchInfo,
    staleTime: 1000 * 60 * 5,
  });

  function handleStart() {
    localStorage.setItem('bethel_onboarded', '1');
    navigate('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* 환영 헤더 */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🏛️</span>
          </div>
          <h1 className="font-display text-2xl font-bold">
            {church?.name ?? '교회'}에 오신 것을 환영합니다!
          </h1>
          <p className="text-sm text-muted-foreground">
            안녕하세요, {user?.name}님. 구역 앱이 준비되었습니다.
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

        {/* 주요 기능 안내 */}
        <div className="rounded-2xl border bg-card p-5 space-y-4">
          <p className="text-sm font-semibold">이런 기능을 사용할 수 있어요</p>
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 다음 단계 안내 */}
        <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
          <p className="text-sm font-semibold">다음 단계</p>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>관리자 페이지에서 구성원을 <strong className="text-foreground">초대</strong>하세요</li>
            <li>구성원은 앱에 가입하고 구역을 선택합니다</li>
            <li>함께 말씀과 기도를 나눠보세요</li>
          </ol>
        </div>

        <Button className="w-full" size="lg" onClick={handleStart}>
          대시보드로 이동 <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
