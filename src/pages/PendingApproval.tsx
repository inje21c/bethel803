import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Clock, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import { changeUserDistrict } from '@/lib/api';
import { Button } from '@/components/ui/button';
import DistrictPicker from '@/components/DistrictPicker';

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

  // 소셜 가입(구글/카카오)은 구역 선택 없이 기본 구역에 임시 배정되므로
  // 대기 화면에서 본인 구역을 직접 확정해야 한다
  const [provider, setProvider] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [pickedDistrictId, setPickedDistrictId] = useState('');
  const [districtSaving, setDistrictSaving] = useState(false);

  const confirmKey = user?.id ? `bethel.districtConfirmed.${user.id}` : '';

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setProvider((data.user?.app_metadata?.provider as string) ?? 'email');
    });
  }, []);

  useEffect(() => {
    if (confirmKey) setConfirmed(localStorage.getItem(confirmKey) === '1');
  }, [confirmKey]);

  // 이메일 가입은 가입 폼에서 이미 구역을 선택했으므로 확정 단계 생략
  const needsConfirm = provider !== null && provider !== 'email' && !confirmed;

  const handleDistrictConfirm = async () => {
    if (!user?.id || !pickedDistrictId) return;
    setDistrictSaving(true);
    try {
      if (pickedDistrictId !== user.districtId) {
        await changeUserDistrict(user.id, pickedDistrictId);
        await refreshRef.current();
      }
      if (confirmKey) localStorage.setItem(confirmKey, '1');
      setConfirmed(true);
      toast.success('소속 구역이 확정되었습니다.');
      setPickedDistrictId('');
    } catch {
      toast.error('구역 설정에 실패했습니다. 구역장에게 문의해주세요.');
    } finally {
      setDistrictSaving(false);
    }
  };

  const handleDistrictSave = async () => {
    if (!user?.id || !pickedDistrictId || pickedDistrictId === user.districtId) return;
    setDistrictSaving(true);
    try {
      await changeUserDistrict(user.id, pickedDistrictId);
      await refreshRef.current();
      toast.success('소속 구역이 변경되었습니다.');
      setPickedDistrictId('');
    } catch {
      toast.error('구역 변경에 실패했습니다. 구역장에게 문의해주세요.');
    } finally {
      setDistrictSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
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

        {needsConfirm ? (
          <div className="card-elevated border-primary/40 border p-4 text-left space-y-3">
            <p className="font-medium text-foreground">소속 구역을 선택해주세요</p>
            <p className="text-xs text-muted-foreground">
              현재 <span className="font-medium text-foreground">{user?.districtName}</span> 구역에
              임시 배정되어 있습니다. 본인의 구역을 선택해야 구역장이 승인할 수 있습니다.
            </p>
            <DistrictPicker value={pickedDistrictId} onChange={setPickedDistrictId} />
            <Button
              size="sm"
              className="w-full"
              disabled={districtSaving || !pickedDistrictId}
              onClick={handleDistrictConfirm}
            >
              {districtSaving
                ? '설정 중...'
                : pickedDistrictId
                  ? '이 구역으로 확정'
                  : '구역을 먼저 선택해주세요'}
            </Button>
          </div>
        ) : user?.districtName ? (
          <div className="card-elevated p-4 text-left space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">신청 구역: </span>
              <span className="font-medium">{user.districtName}</span>
            </div>
            <DistrictPicker value={pickedDistrictId} onChange={setPickedDistrictId} />
            {pickedDistrictId && pickedDistrictId !== user.districtId && (
              <Button
                size="sm"
                className="w-full"
                disabled={districtSaving}
                onClick={handleDistrictSave}
              >
                {districtSaving ? '변경 중...' : '이 구역으로 변경'}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              소속 구역이 다르면 위에서 올바른 구역으로 변경해주세요.
            </p>
          </div>
        ) : null}

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
