import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ChevronRight, Check, Users, User, Mail } from 'lucide-react';

// 모임 만들기(group-first) 가입.
// church_name 없이 가입 → handle_new_user (053) 분기 C:
// 커뮤니티 컨테이너 밑에 "내 모임" 생성, 개설자=leader.
export default function Signup() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/dashboard', { replace: true });
    });
  }, [navigate]);

  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailConfirmRequired, setEmailConfirmRequired] = useState(false);

  async function handleSubmit() {
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
        options: {
          data: {
            name,
            group_name: groupName.trim() || `${name}의 모임`,
          },
        },
      });
      if (error) throw error;
      if (data.session) {
        navigate('/onboarding', { replace: true });
        return;
      }
      setEmailConfirmRequired(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  if (emailConfirmRequired) {
    return (
      <div className="min-h-screen bg-primary/5 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl bg-primary p-7 text-center space-y-5 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-accent/15 pointer-events-none" />
            <div className="w-14 h-14 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center mx-auto">
              <Check className="w-7 h-7 text-accent" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display font-bold text-[18px] text-primary-foreground">이메일을 확인해주세요</h2>
              <p className="text-[13px] text-primary-foreground/70 leading-relaxed">
                <span className="font-medium text-primary-foreground">{email}</span>로 확인 링크를 보냈습니다.
                링크를 클릭하면 모임이 만들어지고 바로 시작할 수 있습니다.
              </p>
            </div>
            <p className="text-[12px] text-primary-foreground/50">이메일이 오지 않으면 스팸 폴더를 확인해주세요.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary/5 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* 히어로 헤더 */}
        <div className="rounded-2xl bg-primary p-6 relative overflow-hidden text-center">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-accent/15 pointer-events-none" />
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" style={{ color: '#1c2a44' }} />
          </div>
          <h1 className="font-display text-[22px] font-bold text-primary-foreground">모임 만들기</h1>
          <p className="text-[13px] text-primary-foreground/60 mt-1">나의 소모임 공간을 시작하세요</p>
        </div>

        {/* 초대 안내 */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-4 py-3 text-[13px] text-blue-800 dark:text-blue-300 leading-relaxed">
          이미 모임에 초대받으셨나요? <span className="font-medium">초대 링크</span>를 직접 누르면 바로 참여됩니다. 여기서 새로 만들 필요가 없습니다.
        </div>

        {/* 폼 */}
        <div className="rounded-2xl border bg-card p-6 space-y-5">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[14px] font-medium flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" /> 이름 *
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" autoFocus />
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-medium flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-muted-foreground" /> 모임 이름
              </label>
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder={name ? `${name}의 모임` : '예: 청년 1구역, 수요 나눔모임'} />
              <p className="text-[12px] text-muted-foreground">비워두면 “{name || '이름'}의 모임”으로 시작합니다. 나중에 바꿀 수 있어요.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-medium flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" /> 이메일 *
              </label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-medium">비밀번호 *</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6자 이상" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-medium">비밀번호 확인 *</label>
              <Input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="비밀번호 재입력"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name && email && password && passwordConfirm && termsAgreed) handleSubmit();
                }}
              />
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Checkbox id="terms" checked={termsAgreed} onCheckedChange={(v) => setTermsAgreed(!!v)} />
            <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
              <Link to="/terms" target="_blank" className="text-primary underline underline-offset-2">이용약관</Link>
              {' '}및{' '}
              <Link to="/privacy" target="_blank" className="text-primary underline underline-offset-2">개인정보처리방침</Link>
              에 동의합니다.
            </label>
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={!name.trim() || !email.trim() || !password || !passwordConfirm || !termsAgreed || loading}
            onClick={handleSubmit}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <>모임 시작하기 <ChevronRight className="w-4 h-4 ml-1" /></>
            )}
          </Button>
        </div>

        <p className="text-center text-[13px] text-muted-foreground">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="text-primary underline underline-offset-2 font-medium">로그인</Link>
        </p>
      </div>
    </div>
  );
}
