import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { assignMyDistrict } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Building2, ChevronRight, Users } from 'lucide-react';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path fillRule="evenodd" clipRule="evenodd" d="M9 0C4.029 0 0 3.134 0 7c0 2.493 1.611 4.681 4.047 5.917L3.1 16.44a.3.3 0 0 0 .461.328L8.1 13.95c.297.023.597.05.9.05 4.971 0 9-3.134 9-7S13.971 0 9 0z" fill="#191919"/>
    </svg>
  );
}

interface DistrictInfo {
  id: string;
  name: string;
  churchName: string;
}

export default function Join() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const districtId = searchParams.get('d');

  const [districtInfo, setDistrictInfo] = useState<DistrictInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);

  // 구역 정보 조회
  useEffect(() => {
    if (!districtId) { setInfoLoading(false); setInfoError(true); return; }
    supabase
      .from('districts')
      .select('id, name, churches(name)')
      .eq('id', districtId)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setInfoError(true);
        } else {
          const row = data as { id: string; name: string; churches: { name: string } | null };
          setDistrictInfo({ id: row.id, name: row.name, churchName: row.churches?.name ?? '교회' });
        }
        setInfoLoading(false);
      });
  }, [districtId]);

  // OAuth 복귀 후 처리: 로그인된 상태 + districtId가 있으면 district 재배정
  useEffect(() => {
    if (!districtId) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      // 이미 로그인된 기존 사용자 → district 재배정 후 이동
      try {
        await assignMyDistrict(districtId);
      } catch {
        // 무시 (이미 같은 구역이거나 유효하지 않은 경우)
      }
      navigate('/pending', { replace: true });
    });
  }, [districtId, navigate]);

  async function handleOAuth(provider: 'google' | 'kakao') {
    if (!districtId) return;
    if (provider === 'google') setGoogleLoading(true);
    else setKakaoLoading(true);
    const redirectTo = `${window.location.origin}/join?d=${districtId}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) {
      toast.error('소셜 로그인 실패: ' + error.message);
      setGoogleLoading(false);
      setKakaoLoading(false);
    }
  }

  async function handleJoin() {
    if (!districtInfo) return;
    if (password !== passwordConfirm) {
      toast.error('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 6) {
      toast.error('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, district_id: districtInfo.id } },
      });
      if (error) throw error;
      if (data.session) {
        navigate('/pending', { replace: true });
      } else {
        toast.success('가입 요청 완료! 이메일을 확인해주세요.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '가입 중 오류가 발생했습니다.';
      toast.error(msg.includes('already') ? '이미 등록된 이메일입니다.' : msg);
    } finally {
      setLoading(false);
    }
  }

  if (infoLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (infoError || !districtInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-sm">
          <p className="font-semibold">유효하지 않은 초대 링크입니다.</p>
          <p className="text-sm text-muted-foreground">링크가 만료되었거나 잘못된 주소입니다. 담당자에게 새 링크를 요청하세요.</p>
          <Link to="/login" className="text-sm text-primary underline underline-offset-2">로그인 페이지로</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* 헤더 */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold">구역 가입</h1>
        </div>

        {/* 구역 정보 */}
        <div className="rounded-xl border bg-muted/40 px-4 py-3 flex items-center gap-3">
          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">{districtInfo.churchName}</p>
            <p className="text-xs text-muted-foreground">{districtInfo.name}</p>
          </div>
        </div>

        {/* 소셜 로그인 */}
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            disabled={googleLoading}
            onClick={() => handleOAuth('google')}
          >
            <GoogleIcon />
            {googleLoading ? '이동 중...' : '구글 계정으로 가입'}
          </Button>
          <Button
            type="button"
            className="w-full gap-2 bg-[#FEE500] text-[#191919] hover:bg-[#FEE500]/90"
            disabled={kakaoLoading}
            onClick={() => handleOAuth('kakao')}
          >
            <KakaoIcon />
            {kakaoLoading ? '이동 중...' : '카카오 계정으로 가입'}
          </Button>
        </div>

        {/* 구분선 */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2 text-muted-foreground">또는 이메일로 가입</span>
          </div>
        </div>

        {/* 이메일 가입 폼 */}
        <div className="rounded-2xl border bg-card p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">이름 *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" autoFocus />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">이메일 *</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">비밀번호 *</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6자 이상" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">비밀번호 확인 *</label>
            <Input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="비밀번호 재입력"
              onKeyDown={(e) => { if (e.key === 'Enter' && name && email && password && passwordConfirm) handleJoin(); }}
            />
            {passwordConfirm && password !== passwordConfirm && (
              <p className="text-xs text-destructive">비밀번호가 일치하지 않습니다.</p>
            )}
          </div>

          <Button
            className="w-full"
            disabled={!name.trim() || !email.trim() || !password || password !== passwordConfirm || loading}
            onClick={handleJoin}
          >
            {loading
              ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              : <>가입 신청 <ChevronRight className="w-4 h-4 ml-1" /></>}
          </Button>
          <p className="text-xs text-muted-foreground text-center">가입 후 구역장 승인이 필요합니다.</p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="text-primary underline underline-offset-2">로그인</Link>
        </p>
      </div>
    </div>
  );
}
