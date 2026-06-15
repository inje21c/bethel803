import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let readySet = false;

    const markReady = () => {
      if (!cancelled && !readySet) {
        readySet = true;
        window.history.replaceState({}, document.title, window.location.pathname);
        setReady(true);
      }
    };

    // PKCE flow: Supabase SDK exchanges ?code= param asynchronously
    // and fires PASSWORD_RECOVERY event when done
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' && session) {
        markReady();
      }
    });

    // Implicit flow fallback: hash contains access_token directly
    const hash = window.location.hash.startsWith('#')
      ? new URLSearchParams(window.location.hash.slice(1))
      : new URLSearchParams();
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    const type = hash.get('type');

    if (accessToken && refreshToken && type === 'recovery') {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            toast.error('비밀번호 재설정 링크가 유효하지 않습니다.');
            navigate('/', { replace: true });
          } else {
            markReady();
          }
        });
      return () => { cancelled = true; subscription.unsubscribe(); };
    }

    // Already have a session (e.g., page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        markReady();
      } else if (!readySet) {
        // Wait up to 5s for PASSWORD_RECOVERY event before giving up
        const timer = setTimeout(() => {
          if (!cancelled && !readySet) {
            toast.error('비밀번호 재설정 링크가 만료되었습니다. 다시 요청해주세요.');
            navigate('/', { replace: true });
          }
        }, 5000);
        return () => clearTimeout(timer);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (password !== password2) {
      toast.error('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('세션이 만료되었습니다. 비밀번호 재설정을 다시 요청해주세요.');
        navigate('/', { replace: true });
        return;
      }

      const { error } = await Promise.race([
        supabase.auth.updateUser({ password }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.')), 8000)
        ),
      ]);

      if (error) {
        toast.error(error.message || '비밀번호 변경에 실패했습니다.');
        return;
      }
      toast.success('비밀번호가 변경되었습니다. 다시 로그인해주세요.');
      supabase.auth.signOut(); // non-blocking
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.';
      toast.error(message || '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary mx-auto mb-4 flex items-center justify-center shadow-lg">
            <KeyRound className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">비밀번호 재설정</h1>
          <p className="text-muted-foreground text-sm mt-1">새 비밀번호를 설정하세요.</p>
        </div>

        <div className="card-elevated p-6">
          {!ready ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">새 비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="6자 이상"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password2">비밀번호 확인</Label>
                <Input
                  id="password2"
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  autoComplete="new-password"
                  placeholder="비밀번호를 다시 입력하세요"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '변경 중...' : '비밀번호 변경'}
              </Button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
