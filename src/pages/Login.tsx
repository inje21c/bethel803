import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/authContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookOpen, MailCheck } from 'lucide-react';
import { toast } from 'sonner';

// 카톡 인앱 브라우저는 구글 OAuth를 차단(disallowed_useragent)하므로 외부 브라우저로 우회
function isKakaoInAppBrowser() {
  return /KAKAOTALK/i.test(navigator.userAgent);
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.65l-.95 3.5c-.08.31.27.56.54.38l4.18-2.77c.51.05 1.04.08 1.57.08 5.52 0 10-3.54 10-7.84S17.52 3 12 3z"
      />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, loginWithKakao, resetPassword, user, loading } = useAuth();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // 이미 로그인된 상태이면 즉시 리다이렉트
  useEffect(() => {
    if (!loading && user) {
      navigate(user.status === 'pending' ? '/pending' : '/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  // 로그인
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast.error('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    // 인증 처리 중 Dashboard 청크 미리 로드 (navigate 시 Suspense 스피너 제거)
    import('./Dashboard').catch(() => {});
    setLoginLoading(true);
    try {
      await login(loginEmail.trim(), loginPassword);
      // 리다이렉트는 useEffect (user 상태 변경 감지)에서 처리
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '로그인에 실패했습니다.';
      if (mounted.current) {
        toast.error(message.includes('Invalid') ? '이메일 또는 비밀번호가 올바르지 않습니다.' : message);
      }
    } finally {
      if (mounted.current) setLoginLoading(false);
    }
  };

  const [googleLoading, setGoogleLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (isKakaoInAppBrowser()) {
      // 카톡 브라우저에서는 외부 브라우저로 현재 페이지를 다시 연다
      toast.info('카카오톡 브라우저에서는 구글 로그인이 제한되어 외부 브라우저로 엽니다.');
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(window.location.href)}`;
      return;
    }
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      // 성공 시 구글 페이지로 리다이렉트되므로 이후 코드는 실행되지 않음
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '구글 로그인에 실패했습니다.';
      if (mounted.current) {
        toast.error(message);
        setGoogleLoading(false);
      }
    }
  };

  const handleKakaoLogin = async () => {
    setKakaoLoading(true);
    try {
      await loginWithKakao();
      // 성공 시 카카오 페이지로 리다이렉트되므로 이후 코드는 실행되지 않음
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '카카오 로그인에 실패했습니다.';
      if (mounted.current) {
        toast.error(message);
        setKakaoLoading(false);
      }
    }
  };

  // 비밀번호 재설정 다이얼로그
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const t = setTimeout(() => setResetCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resetCooldown]);

  const openResetDialog = () => {
    setResetEmail(loginEmail.trim());
    setResetSent(false);
    setResetOpen(true);
  };

  const handleResetSend = async () => {
    const email = resetEmail.trim();
    if (!email || !email.includes('@')) {
      toast.error('가입할 때 사용한 이메일을 입력해주세요.');
      return;
    }
    setResetLoading(true);
    try {
      await resetPassword(email);
      if (mounted.current) {
        setResetSent(true);
        setResetCooldown(60);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (mounted.current) {
        if (message.includes('once every') || message.toLowerCase().includes('rate limit')) {
          toast.error('요청이 너무 잦습니다. 1분 후 다시 시도해주세요.');
          setResetCooldown(60);
        } else {
          toast.error('재설정 메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
        }
      }
    } finally {
      if (mounted.current) setResetLoading(false);
    }
  };

  // 세션 확인 중에는 폼 렌더링 차단 (확인 완료 후 이미 로그인 상태면 바로 대시보드로)
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary/5 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-5 duration-500">
        {/* 로고 히어로 */}
        <div className="rounded-2xl bg-primary p-6 mb-5 relative overflow-hidden text-center">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-accent/15 pointer-events-none" />
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-3 shadow-lg">
            <BookOpen className="w-7 h-7" style={{ color: '#1c2a44' }} />
          </div>
          <h1 className="font-display text-[22px] font-bold text-primary-foreground">벧엘구역</h1>
          <p className="text-[13px] text-primary-foreground/60 mt-0.5">소모임 커뮤니티</p>
        </div>

        <Tabs defaultValue="login" className="card-elevated p-6">
          <TabsList className="grid w-full grid-cols-2 mb-5">
            <TabsTrigger value="login" className="text-[14px] font-semibold">로그인</TabsTrigger>
            <TabsTrigger value="register" className="text-[14px] font-semibold">회원가입</TabsTrigger>
          </TabsList>

          {/* 로그인 탭 */}
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-[14px] font-medium">이메일</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="이메일을 입력하세요"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-[14px] font-medium">비밀번호</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading ? '로그인 중...' : '로그인'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs"
                onClick={openResetDialog}
              >
                비밀번호를 잊으셨나요?
              </Button>
            </form>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">또는</span>
              </div>
            </div>
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={googleLoading}
                onClick={handleGoogleLogin}
              >
                <GoogleIcon />
                {googleLoading ? '이동 중...' : '구글로 계속하기'}
              </Button>
              <Button
                type="button"
                className="w-full gap-2 bg-[#FEE500] text-[#191919] hover:bg-[#FEE500]/90"
                disabled={kakaoLoading}
                onClick={handleKakaoLogin}
              >
                <KakaoIcon />
                {kakaoLoading ? '이동 중...' : '카카오로 계속하기'}
              </Button>
            </div>
          </TabsContent>

          {/* 회원가입(참여) 탭 — 초대 전용 안내 */}
          <TabsContent value="register">
            <div className="space-y-4 py-1">
              {/* 모임 참여: 초대 링크 */}
              <div className="rounded-xl border bg-card p-4 space-y-1.5">
                <p className="font-display font-semibold text-[15px]">모임에 참여하시나요?</p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  모임 리더(구역장)가 보낸 <span className="font-medium text-foreground">초대 링크</span>를
                  휴대폰에서 직접 누르면 자동으로 연결됩니다. 이 화면에서 따로 가입할 필요가 없습니다.
                </p>
                <p className="text-[12px] text-muted-foreground/80">
                  링크는 카카오톡·문자 등으로 받으실 수 있어요.
                </p>
              </div>

              {/* 새로 시작: 모임 만들기 */}
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <p className="font-display font-semibold text-[15px]">새로 시작하시나요?</p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  우리 모임을 직접 시작하려면 아래에서 만드세요.
                </p>
                <Button asChild className="w-full">
                  <Link to="/signup">모임 만들기</Link>
                </Button>
              </div>

              <p className="text-[12px] text-muted-foreground text-center leading-relaxed">
                이미 계정이 있다면 위 <span className="font-medium">[로그인]</span> 탭을 이용하세요.
                <br />구글·카카오 계정도 로그인 탭에서 사용할 수 있습니다.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* 교회 등록 링크 */}
        <p className="text-center text-xs text-muted-foreground pt-4 pb-2">
          교회 단위로 도입하시나요?{' '}
          <Link to="/business" className="text-primary underline underline-offset-2 font-medium">
            교회 도입 안내
          </Link>
        </p>

        {/* 비밀번호 재설정 다이얼로그 */}
        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>비밀번호를 잊으셨나요?</DialogTitle>
              <DialogDescription>
                아래 방법 중 편한 것을 선택하세요.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* 1. 비밀번호 없이 로그인 */}
              <div className="space-y-2">
                <p className="text-sm font-medium">가장 빠른 방법: 비밀번호 없이 로그인</p>
                <p className="text-xs text-muted-foreground">
                  가입 이메일과 같은 구글 계정이거나, 카카오를 연결해둔 적이 있다면
                  비밀번호 없이 바로 로그인됩니다.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={googleLoading}
                    onClick={handleGoogleLogin}
                  >
                    <GoogleIcon /> 구글
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5 bg-[#FEE500] text-[#191919] hover:bg-[#FEE500]/90"
                    disabled={kakaoLoading}
                    onClick={handleKakaoLogin}
                  >
                    <KakaoIcon /> 카카오
                  </Button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">또는 이메일로 재설정</span>
                </div>
              </div>

              {/* 2. 이메일 재설정 */}
              {resetSent ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3">
                    <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="text-sm">
                      <p className="font-medium">재설정 메일을 보냈습니다</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{resetEmail}</span>의 메일함을
                        확인하고 링크를 눌러 새 비밀번호를 설정하세요.
                        메일이 없으면 <span className="font-medium text-foreground">스팸함</span>도 확인해주세요.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={resetLoading || resetCooldown > 0}
                    onClick={handleResetSend}
                  >
                    {resetCooldown > 0 ? `재발송 (${resetCooldown}초 후 가능)` : '메일 다시 보내기'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="reset-email">가입한 이메일</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    placeholder="이메일을 입력하세요"
                    autoComplete="email"
                  />
                  <Button
                    type="button"
                    className="w-full"
                    disabled={resetLoading || resetCooldown > 0}
                    onClick={handleResetSend}
                  >
                    {resetLoading
                      ? '발송 중...'
                      : resetCooldown > 0
                        ? `잠시 후 다시 시도 (${resetCooldown}초)`
                        : '재설정 메일 보내기'}
                  </Button>
                </div>
              )}

              {/* 3. 최후 안내 */}
              <p className="text-xs text-muted-foreground">
                이메일 확인이 어려우시면 구역장(관리자)에게 요청하세요.
                관리자가 임시 비밀번호를 발급해드릴 수 있습니다.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
