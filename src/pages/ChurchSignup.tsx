import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, Check, Building2, User, Mail, AlertCircle } from 'lucide-react';

type Step = 1 | 2 | 3;

export default function ChurchSignup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);

  // 이미 로그인된 경우 대시보드로
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/dashboard', { replace: true });
    });
  }, [navigate]);
  const [loading, setLoading] = useState(false);

  // Step 1: 교회 정보
  const [churchName, setChurchName] = useState('');
  const [districtName, setDistrictName] = useState('1구역');

  // Step 2: 대표자 정보
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const [termsAgreed, setTermsAgreed] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  // Step 3: 완료 (이메일 확인 필요 여부)
  const [emailConfirmRequired, setEmailConfirmRequired] = useState(false);

  async function handleSubmit() {
    if (password !== passwordConfirm) {
      toast.error('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 8) {
      toast.error('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            church_name: churchName,
            district_name: districtName,
          },
        },
      });
      if (error) throw error;
      // 세션이 바로 생성되면 onboarding으로 직행
      if (data.session) {
        navigate('/onboarding', { replace: true });
        return;
      }
      // 이메일 확인 필요 시에만 step 3 표시
      setEmailConfirmRequired(true);
      setStep(3);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  const stepLabels = ['교회 정보', '대표자 정보', '완료'];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* 헤더 */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold">교회 등록하기</h1>
          <p className="text-sm text-muted-foreground">30일 무료 체험</p>
        </div>

        {/* 오진입 방지 안내 */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 flex gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-semibold">이미 다른 구역장이 교회를 등록했나요?</p>
            <p className="text-xs leading-relaxed">
              같은 교회의 다른 구역·소모임이라면 <span className="font-medium">교회를 새로 등록하지 마세요</span>.
              구역장에게 <span className="font-medium">초대 링크</span>를 요청하면 기존 교회에 합류할 수 있습니다.
            </p>
          </div>
        </div>

        {/* 스텝 인디케이터 */}
        {step < 3 && (
          <div className="flex items-center justify-center gap-2">
            {([1, 2] as Step[]).map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors
                  ${step === s ? 'bg-primary text-primary-foreground' : step > s ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {step > s ? <Check className="w-3.5 h-3.5" /> : s}
                </div>
                <span className={`text-xs ${step === s ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {stepLabels[s - 1]}
                </span>
                {s < 2 && <div className="w-8 h-px bg-border" />}
              </div>
            ))}
          </div>
        )}

        {/* Step 1: 교회 정보 */}
        {step === 1 && (
          <div className="rounded-2xl border bg-card p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="font-semibold">교회 정보</h2>
              <p className="text-xs text-muted-foreground">나중에 설정에서 변경할 수 있습니다.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">교회 이름 *</label>
                <Input
                  value={churchName}
                  onChange={(e) => setChurchName(e.target.value)}
                  placeholder="예: 한빛교회"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">첫 구역 이름</label>
                <Input
                  value={districtName}
                  onChange={(e) => setDistrictName(e.target.value)}
                  placeholder="예: 1구역"
                />
                <p className="text-xs text-muted-foreground">구역은 나중에 추가/수정할 수 있습니다.</p>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!churchName.trim()}
              onClick={() => setStep(2)}
            >
              다음 <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 2: 대표자 정보 */}
        {step === 2 && (
          <div className="rounded-2xl border bg-card p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="font-semibold">대표자 계정</h2>
              <p className="text-xs text-muted-foreground">이 계정은 교회 전체를 관리하는 master 계정입니다.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" /> 이름 *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" /> 이메일 *
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">비밀번호 *</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8자 이상"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">비밀번호 확인 *</label>
                <Input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="비밀번호 재입력"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && name && email && password && passwordConfirm && termsAgreed) {
                      handleSubmit();
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Checkbox
                id="terms"
                checked={termsAgreed}
                onCheckedChange={(v) => setTermsAgreed(!!v)}
              />
              <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                <button type="button" onClick={() => setTermsOpen(true)} className="text-primary underline underline-offset-2">이용약관</button>
                {' '}및{' '}
                <button type="button" onClick={() => setPrivacyOpen(true)} className="text-primary underline underline-offset-2">개인정보처리방침</button>
                에 동의합니다.
              </label>
            </div>

            {/* 이용약관 Dialog */}
            <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>이용약관</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 text-sm text-foreground">
                  <section><h3 className="font-semibold mb-1">제1조 (목적)</h3><p className="text-muted-foreground leading-relaxed">이 약관은 벧엘구역 서비스(이하 "서비스")의 이용과 관련하여 서비스 제공자와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p></section>
                  <section><h3 className="font-semibold mb-1">제2조 (서비스 내용)</h3><p className="text-muted-foreground leading-relaxed">서비스는 교회 구역 모임의 기도제목 나눔, QT(말씀 묵상), 성경읽기 계획, 성경공부 자료 공유, 구성원 관리 등의 기능을 제공합니다.</p></section>
                  <section><h3 className="font-semibold mb-1">제3조 (회원 가입 및 계정)</h3><ul className="list-disc list-inside space-y-1 text-muted-foreground leading-relaxed"><li>서비스 이용을 위해 이메일 주소와 비밀번호로 계정을 생성해야 합니다.</li><li>계정 정보(이메일, 비밀번호)는 타인과 공유하지 않을 책임이 있습니다.</li><li>허위 정보로 가입한 경우 서비스 이용이 제한될 수 있습니다.</li></ul></section>
                  <section><h3 className="font-semibold mb-1">제4조 (교회 등록 및 무료 체험)</h3><ul className="list-disc list-inside space-y-1 text-muted-foreground leading-relaxed"><li>교회 등록 후 30일간 무료 체험 기간이 제공됩니다.</li><li>무료 체험 기간 중 신용카드 등 결제 정보는 요구하지 않습니다.</li><li>무료 체험 종료 후 서비스 유지 여부는 추후 공지되는 플랜 정책에 따릅니다.</li></ul></section>
                  <section><h3 className="font-semibold mb-1">제5조 (이용자 의무)</h3><ul className="list-disc list-inside space-y-1 text-muted-foreground leading-relaxed"><li>타인의 개인정보를 무단으로 수집하거나 이용하지 않습니다.</li><li>서비스를 통해 불법·음란·허위 정보를 게시하지 않습니다.</li><li>서비스의 정상적인 운영을 방해하는 행위를 하지 않습니다.</li></ul></section>
                  <section><h3 className="font-semibold mb-1">제6조 (서비스 제공 중단)</h3><p className="text-muted-foreground leading-relaxed">시스템 점검, 장비 교체, 천재지변 등 불가항력적인 사유가 있는 경우 서비스 제공이 일시 중단될 수 있습니다.</p></section>
                  <section><h3 className="font-semibold mb-1">제7조 (면책 조항)</h3><p className="text-muted-foreground leading-relaxed">서비스는 이용자가 서비스 내에서 게시한 내용에 대한 법적 책임을 지지 않습니다. 이용자 간 발생하는 분쟁에 대해 서비스 제공자는 개입하지 않습니다.</p></section>
                  <section><h3 className="font-semibold mb-1">제8조 (약관 변경)</h3><p className="text-muted-foreground leading-relaxed">약관이 변경되는 경우 서비스 내 공지 또는 이메일을 통해 7일 전 고지합니다.</p></section>
                  <section><h3 className="font-semibold mb-1">제9조 (준거법 및 분쟁 해결)</h3><p className="text-muted-foreground leading-relaxed">이 약관은 대한민국 법률에 따라 해석되며, 서비스 이용과 관련한 분쟁은 관할 법원에서 해결합니다.</p></section>
                </div>
                <Button className="w-full mt-2" onClick={() => { setTermsAgreed(true); setTermsOpen(false); }}>동의하고 닫기</Button>
              </DialogContent>
            </Dialog>

            {/* 개인정보처리방침 Dialog */}
            <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>개인정보처리방침</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 text-sm text-foreground">
                  <section><h3 className="font-semibold mb-1">1. 수집하는 개인정보 항목</h3><div className="space-y-1 text-muted-foreground leading-relaxed"><p><span className="font-medium text-foreground">필수:</span> 이메일 주소, 이름(닉네임), 교회명</p><p><span className="font-medium text-foreground">선택:</span> 소셜 로그인(구글·카카오) 사용 시 해당 계정의 이름·이메일</p><p><span className="font-medium text-foreground">자동 수집:</span> 서비스 이용 기록, 기기 정보(웹푸시 구독 토큰)</p></div></section>
                  <section><h3 className="font-semibold mb-1">2. 개인정보 수집 및 이용 목적</h3><ul className="list-disc list-inside space-y-1 text-muted-foreground leading-relaxed"><li>회원 가입 및 본인 확인</li><li>서비스 제공 (구역 모임 관리, 기도제목 나눔, QT, 성경읽기 등)</li><li>구성원 초대 및 구역 배정</li><li>서비스 공지 및 알림 발송</li></ul></section>
                  <section><h3 className="font-semibold mb-1">3. 개인정보 보유 및 이용 기간</h3><p className="text-muted-foreground leading-relaxed">회원 탈퇴 시 지체 없이 파기합니다. 단, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.</p></section>
                  <section><h3 className="font-semibold mb-1">4. 개인정보 제3자 제공</h3><p className="text-muted-foreground leading-relaxed">수집한 개인정보는 원칙적으로 제3자에게 제공하지 않습니다.</p></section>
                  <section><h3 className="font-semibold mb-1">5. 개인정보 처리 위탁</h3><p className="text-muted-foreground leading-relaxed">Supabase Inc. (인증·DB), Vercel Inc. (호스팅), OpenAI Inc. (AI 기능)</p></section>
                  <section><h3 className="font-semibold mb-1">6. 이용자의 권리</h3><ul className="list-disc list-inside space-y-1 text-muted-foreground leading-relaxed"><li>본인의 개인정보 열람·수정·삭제를 요청할 권리</li><li>서비스 내 '프로필' 메뉴 또는 '회원탈퇴'를 통해 직접 행사 가능</li></ul></section>
                  <section><h3 className="font-semibold mb-1">7. 쿠키 및 웹 저장소</h3><p className="text-muted-foreground leading-relaxed">서비스는 로그인 상태 유지를 위해 브라우저 localStorage를 사용합니다.</p></section>
                  <section><h3 className="font-semibold mb-1">8. 개인정보 보호 책임자</h3><p className="text-muted-foreground leading-relaxed">이메일: cmhyun@gmail.com</p></section>
                </div>
                <Button className="w-full mt-2" onClick={() => { setTermsAgreed(true); setPrivacyOpen(false); }}>동의하고 닫기</Button>
              </DialogContent>
            </Dialog>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
                <ChevronLeft className="w-4 h-4" /> 이전
              </Button>
              <Button
                className="flex-1"
                disabled={!name.trim() || !email.trim() || !password || !passwordConfirm || !termsAgreed || loading}
                onClick={handleSubmit}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>교회 등록하기 <ChevronRight className="w-4 h-4 ml-1" /></>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: 완료 */}
        {step === 3 && (
          <div className="rounded-2xl border bg-card p-6 text-center space-y-5">
            <div className="w-14 h-14 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto">
              <Check className="w-7 h-7 text-success" />
            </div>

            {emailConfirmRequired ? (
              <>
                <div className="space-y-2">
                  <h2 className="font-semibold text-lg">이메일을 확인해주세요</h2>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{email}</span>로 확인 링크를 보냈습니다.
                    이메일에서 링크를 클릭하면 교회 대시보드로 이동합니다.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  이메일이 오지 않으면 스팸 폴더를 확인해주세요.
                </p>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <h2 className="font-semibold text-lg">
                    {churchName} 등록 완료!
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    30일 무료 체험이 시작되었습니다. 지금 바로 구역 앱을 사용해보세요.
                  </p>
                </div>
                <Button className="w-full" onClick={() => navigate('/onboarding')}>
                  시작하기 <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            )}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          이미 초대를 받으셨나요?{' '}
          <Link to="/login" className="text-primary underline underline-offset-2">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
