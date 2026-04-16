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

export default function Login() {
  const navigate = useNavigate();
  const { login, register, resetPassword, user, loading } = useAuth();
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
    setRegLoading(true);
    try {
      await register(regEmail.trim(), regPassword, regName.trim(), regDistrictId || undefined);
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
              <Button type="submit" className="w-full" disabled={loading || loginLoading}>
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
              </form>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
