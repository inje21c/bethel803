import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/authContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import DistrictPicker from '@/components/DistrictPicker';

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
  const { login, loginWithGoogle, loginWithKakao, register, resetPassword, user, loading } = useAuth();
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

  // 회원가입
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');
  const [regDistrictId, setRegDistrictId] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regDone, setRegDone] = useState(false);

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      toast.error('모든 항목을 입력해주세요.');
      return;
    }
    if (regPassword !== regPassword2) {
      toast.error('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (regPassword.length < 6) {
      toast.error('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (!regDistrictId) {
      toast.error('소속 구역을 선택해주세요.');
      return;
    }
    setRegLoading(true);
    try {
      await register(regEmail.trim(), regPassword, regName.trim(), regDistrictId);
      if (mounted.current) setRegDone(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '회원가입에 실패했습니다.';
      if (mounted.current) {
        toast.error(message.includes('already') ? '이미 등록된 이메일입니다.' : message);
      }
    } finally {
      if (mounted.current) setRegLoading(false);
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

  const handleResetPassword = async () => {
    if (!loginEmail.trim()) {
      toast.error('비밀번호 재설정을 위해 이메일을 먼저 입력해주세요.');
      return;
    }

    setResetLoading(true);
    try {
      await resetPassword(loginEmail.trim());
      if (mounted.current) {
        toast.success('비밀번호 재설정 메일을 보냈습니다. 메일함을 확인해주세요.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '재설정 메일 발송에 실패했습니다.';
      if (mounted.current) toast.error(message);
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-5 duration-500">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary mx-auto mb-4 flex items-center justify-center shadow-lg">
            <BookOpen className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">벧엘교회</h1>
          <p className="text-muted-foreground text-sm mt-1">구역 관리</p>
        </div>

        <Tabs defaultValue="login" className="card-elevated p-6">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login">로그인</TabsTrigger>
            <TabsTrigger value="register">회원가입</TabsTrigger>
          </TabsList>

          {/* 로그인 탭 */}
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">이메일</Label>
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
                <Label htmlFor="login-password">비밀번호</Label>
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
                disabled={resetLoading}
                onClick={handleResetPassword}
              >
                {resetLoading ? '메일 발송 중...' : '비밀번호를 잊으셨나요?'}
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

          {/* 회원가입 탭 */}
          <TabsContent value="register">
            {regDone ? (
              <div className="text-center py-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg">가입 요청 완료</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  구역장 승인 대기 중입니다.<br />
                  승인 후 로그인이 가능합니다.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setRegDone(false)}
                >
                  로그인으로 돌아가기
                </Button>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-name">이름</Label>
                  <Input
                    id="reg-name"
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    placeholder="실명을 입력하세요"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">이메일</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder="이메일을 입력하세요"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">비밀번호</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="6자 이상"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password2">비밀번호 확인</Label>
                  <Input
                    id="reg-password2"
                    type="password"
                    value={regPassword2}
                    onChange={e => setRegPassword2(e.target.value)}
                    placeholder="비밀번호를 다시 입력하세요"
                    autoComplete="new-password"
                  />
                </div>
                <DistrictPicker value={regDistrictId} onChange={setRegDistrictId} />
                <Button type="submit" className="w-full" disabled={regLoading}>
                  {regLoading ? '처리 중...' : '회원가입 요청'}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  가입 후 구역장 승인이 필요합니다.
                </p>
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
                    {googleLoading ? '이동 중...' : '구글 계정으로 가입하기'}
                  </Button>
                  <Button
                    type="button"
                    className="w-full gap-2 bg-[#FEE500] text-[#191919] hover:bg-[#FEE500]/90"
                    disabled={kakaoLoading}
                    onClick={handleKakaoLogin}
                  >
                    <KakaoIcon />
                    {kakaoLoading ? '이동 중...' : '카카오 계정으로 가입하기'}
                  </Button>
                </div>
              </form>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
