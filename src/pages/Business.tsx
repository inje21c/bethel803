import { Link } from 'react-router-dom';
import { Building2, Check, ChevronRight, Mail, Users, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CONTACT_EMAIL = 'cmhyun@gmail.com';

const POINTS = [
  { icon: Users,       title: '여러 구역을 한곳에서', desc: '교회 전체 구역(소모임)을 구역장 권한과 함께 통합 관리합니다.' },
  { icon: ShieldCheck, title: '구역 간 데이터 분리',  desc: '구역장은 자기 구역만, 담당자는 전체를 — 권한에 따라 안전하게 분리됩니다.' },
  { icon: Building2,   title: '교회 맞춤 설정',       desc: '주보 자동 파싱, 성경 본문 열람 등 교회 단위 기능을 함께 구성해 드립니다.' },
];

export default function Business() {
  return (
    <div className="min-h-screen bg-background">
      {/* 네비 */}
      <header className="border-b bg-background/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-display font-bold text-[17px] text-primary">벧엘구역</Link>
          <Button size="sm" variant="outline" asChild>
            <Link to="/">모임으로 시작하기</Link>
          </Button>
        </div>
      </header>

      {/* 히어로 */}
      <section className="max-w-4xl mx-auto px-4 pt-14 pb-12">
        <div className="rounded-2xl bg-primary p-7 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-accent/15 pointer-events-none" />
          <p className="text-[13px] font-bold text-accent tracking-widest uppercase mb-3">교회 단위 도입</p>
          <h1 className="font-display text-[30px] sm:text-4xl font-bold leading-tight text-primary-foreground mb-3">
            교회 전체를<br />하나의 공간으로
          </h1>
          <p className="text-[15px] text-primary-foreground/70 leading-relaxed max-w-md mb-6">
            여러 구역과 소모임을 통합 관리하고, 교회에 맞게 설정해 드립니다.<br />
            상담을 통해 함께 준비합니다.
          </p>
          <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold" asChild>
            <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('교회 도입 상담 문의')}`}>
              도입 상담 신청 <ChevronRight className="w-4 h-4 ml-1" />
            </a>
          </Button>
        </div>
      </section>

      {/* 포인트 */}
      <section className="max-w-4xl mx-auto px-4 pb-12">
        <div className="grid sm:grid-cols-3 gap-4">
          {POINTS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border bg-card p-5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <p className="font-display font-semibold text-[15px] mb-1">{title}</p>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 진행 방식 */}
      <section className="border-y py-12 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="font-display text-[22px] font-bold mb-6">이렇게 진행됩니다</h2>
          <ol className="space-y-4">
            {[
              ['상담 신청', '아래 이메일로 교회 이름과 규모, 원하시는 기능을 알려주세요.'],
              ['함께 설계', '구역 구성과 필요한 기능을 상담을 통해 정리합니다.'],
              ['셋업 & 시작', '교회 공간을 만들어 드리고, 구역장·구성원을 초대해 바로 시작합니다.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-[13px] font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                <div>
                  <p className="font-semibold text-[15px]">{t}</p>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{d}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-[12px] text-muted-foreground mt-5 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-primary" /> 설정·셋업은 교회 상황에 맞춰 별도 협의로 진행됩니다.
          </p>
        </div>
      </section>

      {/* 문의 CTA */}
      <section className="py-14">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-4">
          <h2 className="font-display text-[22px] font-bold">도입을 검토 중이신가요?</h2>
          <p className="text-[15px] text-muted-foreground">편하게 문의 주세요. 함께 준비하겠습니다.</p>
          <div className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-3">
            <Mail className="w-4 h-4 text-primary" />
            <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('교회 도입 상담 문의')}`} className="font-medium text-primary underline underline-offset-2">
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-muted-foreground">
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
