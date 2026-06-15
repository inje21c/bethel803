import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, Check, Building2, User, Mail } from 'lucide-react';

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
          <p className="text-sm text-muted-foreground">30일 무료 체험 · 신용카드 불필요</p>
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
                    if (e.key === 'Enter' && name && email && password && passwordConfirm) {
                      handleSubmit();
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
                <ChevronLeft className="w-4 h-4" /> 이전
              </Button>
              <Button
                className="flex-1"
                disabled={!name.trim() || !email.trim() || !password || !passwordConfirm || loading}
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
