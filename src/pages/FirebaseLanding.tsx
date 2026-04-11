import { ArrowRight, ExternalLink, Smartphone, Download, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const APP_URL = 'https://project-9zxj4.vercel.app';

function openApp() {
  window.location.href = APP_URL;
}

export default function FirebaseLanding() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.18),_transparent_34%),linear-gradient(180deg,_#fbfaf6_0%,_#f4efe2_100%)] text-foreground">
      <main className="max-w-5xl mx-auto px-4 py-10 md:px-6 md:py-16">
        <section className="rounded-[32px] border border-amber-200/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(94,72,21,0.08)] backdrop-blur md:p-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <p className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                벧엘교회 구역관리 앱 안내
              </p>
              <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
                새 구역관리 앱으로
                <br />
                접속해 주세요.
              </h1>
              <p className="mt-4 text-sm leading-7 text-slate-700 md:text-base">
                벧엘교회 구역관리 앱은 더 안정적인 운영을 위해 새 환경으로 이전되었습니다.
                아래 버튼을 눌러 새 앱으로 이동하시고, 자주 사용하신다면 휴대폰 홈 화면에 추가해 두시면 더 편리합니다.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="gap-2" onClick={openApp}>
                  새 앱 열기
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="gap-2" asChild>
                  <a href={APP_URL} target="_blank" rel="noreferrer">
                    주소 새 창 열기
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                새 앱 주소: <span className="font-medium text-slate-900">{APP_URL}</span>
              </div>
            </div>

            <div className="grid w-full max-w-sm gap-4">
              <Card className="border-amber-200/80 bg-amber-50/70">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-4 w-4 text-amber-700" />
                    왜 바뀌었나요?
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-slate-700">
                  미리보기와 운영 배포를 더 안전하게 분리해서,
                  개발 중 기능이 운영 사용자에게 바로 반영되지 않도록 개선했습니다.
                </CardContent>
              </Card>

              <Card className="border-slate-200/80">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4 text-slate-700" />
                    구역장 신청 안내
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-slate-700">
                  새로 구역관리를 시작하고 싶은 구역은 구역장이 신청해 주세요.
                  승인 후 구역을 개설해 드립니다.
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <Card className="border-slate-200/80 bg-white/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Smartphone className="h-5 w-5 text-slate-700" />
                아이폰에서 홈 화면에 추가
              </CardTitle>
              <CardDescription>Safari 기준</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6 text-slate-700">
              <p>1. 아래 버튼으로 새 앱을 엽니다.</p>
              <p>2. Safari 하단의 공유 버튼을 누릅니다.</p>
              <p>3. `홈 화면에 추가`를 선택합니다.</p>
              <p>4. 이름을 확인하고 `추가`를 누르면 앱처럼 사용할 수 있습니다.</p>
              <Button variant="outline" className="mt-3 gap-2" onClick={openApp}>
                <Download className="h-4 w-4" />
                새 앱 열기
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Smartphone className="h-5 w-5 text-slate-700" />
                안드로이드에서 홈 화면에 추가
              </CardTitle>
              <CardDescription>Chrome 기준</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6 text-slate-700">
              <p>1. 아래 버튼으로 새 앱을 엽니다.</p>
              <p>2. Chrome 메뉴를 열고 `홈 화면에 추가` 또는 `앱 설치`를 선택합니다.</p>
              <p>3. 이름을 확인하고 추가하면 바로가기처럼 사용할 수 있습니다.</p>
              <p>4. 이후에는 홈 화면 아이콘으로 바로 접속하시면 됩니다.</p>
              <Button variant="outline" className="mt-3 gap-2" onClick={openApp}>
                <Download className="h-4 w-4" />
                새 앱 열기
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
