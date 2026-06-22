import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Clock, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export default function PendingApproval() {
  const navigate = useNavigate();
  const { logout, user, refreshProfile } = useAuth();
  const refreshRef = useRef(refreshProfile);
  refreshRef.current = refreshProfile;

  // 1) user.status가 'active'로 바뀌면 즉시 이동 (ProtectedRoute 거치지 않고 직접)
  useEffect(() => {
    if (user?.status === 'active') {
      navigate('/dashboard', { replace: true });
    }
  }, [user?.status, navigate]);

  // 2) Realtime 구독: 구역장이 승인하는 순간 즉시 감지
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`pending-user-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${user.id}` },
        async (payload) => {
          if (payload.new.status === 'active') {
            await refreshRef.current(); // 컨텍스트 갱신 → user.status 업데이트 → effect 1 발동
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // 3) 10초 폴링: Realtime 실패 시 백업
  useEffect(() => {
    if (!user?.id || user?.status !== 'pending') return;

    const poll = async () => {
      await refreshRef.current(); // 결과를 직접 쓰지 않고 context 갱신만 — effect 1이 처리
    };

    poll(); // 즉시 1회
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [user?.id]); // user.id만 의존 → 인터벌 리셋 없음

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm text-center space-y-6"
      >
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Clock className="w-10 h-10 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold">승인 대기 중</h1>
          {user?.name && (
            <p className="text-muted-foreground text-sm">
              안녕하세요, <span className="font-medium text-foreground">{user.name}</span>님
            </p>
          )}
          <p className="text-muted-foreground text-sm leading-relaxed">
            구역장 승인 후 앱을 사용하실 수 있습니다.<br />
            잠시 기다려주세요.
          </p>
        </div>

        <div className="card-elevated p-4 text-sm text-muted-foreground text-left space-y-2">
          <p className="font-medium text-foreground">안내사항</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>구역장이 승인하면 이 화면에서 자동으로 입장됩니다.</li>
            <li>승인까지 시간이 걸릴 수 있습니다.</li>
            <li>문의 사항은 구역장에게 연락해주세요.</li>
          </ul>
        </div>

        {user?.districtName && (
          <div className="card-elevated p-4 text-left">
            <div className="text-sm">
              <span className="text-muted-foreground">신청 모임: </span>
              <span className="font-medium">{user.districtName}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              소속이 다르면 초대 링크를 보낸 모임 리더에게 문의해주세요.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground animate-pulse">
          승인 상태를 실시간으로 확인하고 있습니다…
        </p>

        <Button
          variant="outline"
          onClick={handleLogout}
          className="w-full gap-2"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </Button>
      </motion.div>
    </div>
  );
}
