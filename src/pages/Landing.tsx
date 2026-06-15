import { Link } from 'react-router-dom';
import { BookOpen, MessageSquareHeart, Users, BookMarked, ChevronRight, CheckCircle2, Flame, Link2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FEATURES = [
  {
    icon: Flame,
    title: '오늘의 QT',
    desc: '매일 말씀 묵상을 함께. AI 깊은 묵상으로 더 깊이 파고드세요.',
  },
  {
    icon: MessageSquareHeart,
    title: '기도제목 나눔',
    desc: '구역 기도제목을 실시간으로 나누고 중보기도로 서로를 세워가세요.',
  },
  {
    icon: BookMarked,
    title: '성경읽기 계획',
    desc: '개인 읽기 계획부터 구역 현황까지 한눈에 확인하세요.',
  },
  {
    icon: BookOpen,
    title: '성경공부 자료',
    desc: '주간 성경공부 자료를 손쉽게 공유하고 출석을 관리하세요.',
  },
];

const PLAN_FEATURES = [
  '구역 기도제목 나눔',
  '오늘의 QT (말씀 묵상)',
  '성경읽기 계획 & 기록',
  '성경공부 자료 공유',
  '구성원 초대 & 관리',
  '일정 관리',
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* 네비게이션 */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-display font-bold text-lg text-primary">벧엘구역</span>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              로그인
            </Link>
            <Button size="sm" asChild>
              <Link to="/signup/church">무료 등록</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* 히어로 */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          30일 무료 체험
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold leading-tight">
          구역 모임을<br />더 풍성하게
        </h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          기도제목, QT, 성경읽기, 성경공부까지.
          교회 구역 모임에 필요한 모든 것을 하나의 앱으로.
        </p>

        {/* 두 가지 진입 경로 */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
          <div className="flex-1 rounded-2xl border-2 border-primary bg-primary/5 p-5 text-left space-y-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">교회 처음 도입하는 경우</p>
              <p className="text-xs text-muted-foreground mt-0.5">구역장·담당자가 교회를 등록하고 구성원을 초대하세요.</p>
            </div>
            <Button size="sm" className="w-full" asChild>
              <Link to="/signup/church">우리 교회 등록하기 <ChevronRight className="w-3.5 h-3.5 ml-1" /></Link>
            </Button>
          </div>

          <div className="flex-1 rounded-2xl border-2 border-border bg-card p-5 text-left space-y-3">
            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
              <Link2 className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">초대 링크를 받은 경우</p>
              <p className="text-xs text-muted-foreground mt-0.5">구역장에게 받은 초대 링크로 바로 가입하세요. 교회 등록은 필요 없습니다.</p>
            </div>
            <Button size="sm" variant="outline" className="w-full" asChild>
              <Link to="/login">로그인 / 가입</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 기능 소개 */}
      <section className="bg-muted/30 border-y py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="font-display text-2xl font-bold text-center mb-10">구역 모임에 필요한 모든 것</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border bg-card p-5 flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold mb-1">{title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 가격 */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="font-display text-2xl font-bold text-center mb-3">간단한 가격 정책</h2>
        <p className="text-muted-foreground text-center mb-10">지금은 모든 교회에 무료로 제공됩니다.</p>
        <div className="max-w-sm mx-auto rounded-2xl border-2 border-primary bg-card p-6 space-y-5">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-3">
              30일 무료 체험
            </div>
            <div className="flex items-end gap-1">
              <span className="font-display text-4xl font-bold">무료</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">체험 후 플랜 출시 예정</p>
          </div>
          <div className="space-y-2.5">
            {PLAN_FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm">{f}</span>
              </div>
            ))}
          </div>
          <Button className="w-full" size="lg" asChild>
            <Link to="/signup/church">지금 무료로 시작하기</Link>
          </Button>
        </div>
      </section>

      {/* 대상 */}
      <section className="bg-muted/30 border-t py-16">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-4">
          <Users className="w-10 h-10 text-primary mx-auto" />
          <h2 className="font-display text-2xl font-bold">교회 구역장이라면</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            5분 안에 교회를 등록하고, 구성원을 초대 링크 하나로 불러오세요.
            별도 설치나 서버 없이 바로 시작할 수 있습니다.
          </p>
          <Button size="lg" asChild>
            <Link to="/signup/church">
              5분 만에 시작하기 <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t py-8">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© 2026 벧엘구역 서비스</span>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-foreground transition-colors">이용약관</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">개인정보처리방침</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
