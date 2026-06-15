import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Building2, ChevronRight, Users } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!districtId) {
      setInfoLoading(false);
      setInfoError(true);
      return;
    }
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
        setDistrictInfo({
          id: row.id,
          name: row.name,
          churchName: row.churches?.name ?? '교회',
        });
      }
      setInfoLoading(false);
    });
  }, [districtId]);

  // 이미 로그인된 경우 대시보드로
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/dashboard', { replace: true });
    });
  }, [navigate]);

  async function handleJoin() {
    if (!districtInfo) return;
    if (password.length < 6) {
      toast.error('비밀번호는 6자 이상이어야 합니다.');
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
            district_id: districtInfo.id,
          },
        },
      });
      if (error) throw error;
      if (data.session) {
        navigate('/pending', { replace: true });
      } else {
        toast.success('가입 요청이 완료되었습니다. 이메일을 확인해주세요.');
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

        {/* 구역 정보 카드 */}
        <div className="rounded-xl border bg-muted/40 px-4 py-3 flex items-center gap-3">
          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">{districtInfo.churchName}</p>
            <p className="text-xs text-muted-foreground">{districtInfo.name}</p>
          </div>
        </div>

        {/* 가입 폼 */}
        <div className="rounded-2xl border bg-card p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">이름 *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">이메일 *</label>
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
              placeholder="6자 이상"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name && email && password) handleJoin();
              }}
            />
          </div>

          <Button
            className="w-full"
            disabled={!name.trim() || !email.trim() || !password || loading}
            onClick={handleJoin}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <>가입 신청 <ChevronRight className="w-4 h-4 ml-1" /></>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            가입 후 구역장 승인이 필요합니다.
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="text-primary underline underline-offset-2">로그인</Link>
        </p>
      </div>
    </div>
  );
}
