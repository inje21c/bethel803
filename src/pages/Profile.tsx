import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BellRing, Link2, Lock, Save, Smartphone, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import {
  deactivatePushSubscription,
  getNotificationPreferences,
  getPushSubscriptions,
  saveNotificationPreferences,
  savePushSubscription,
  updateUserName,
} from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  getCurrentBrowserSubscription,
  getPushPermissionState,
  getPushSetupMessage,
  hasPushSetupReady,
  isPushSupported,
  subscribeBrowserPush,
  unsubscribeBrowserPush,
} from '@/lib/push';
import { toast } from 'sonner';

export default function Profile() {
  const { user, updatePassword, refreshProfile, linkGoogleAccount, linkKakaoAccount } = useAuth();
  const queryClient = useQueryClient();

  const [googleLinking, setGoogleLinking] = useState(false);
  const [kakaoLinking, setKakaoLinking] = useState(false);
  const { data: identities = [] } = useQuery({
    queryKey: ['auth_identities', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw error;
      return data?.identities ?? [];
    },
    enabled: !!user,
  });
  const googleIdentity = identities.find(i => i.provider === 'google');
  const kakaoIdentity = identities.find(i => i.provider === 'kakao');

  const linkErrorMessage = (err: unknown, providerLabel: string) => {
    const message = err instanceof Error ? err.message : '';
    return message.toLowerCase().includes('manual linking')
      ? '계정 연결 기능이 아직 활성화되지 않았습니다. 관리자에게 문의해주세요.'
      : `${providerLabel} 계정 연결에 실패했습니다.`;
  };

  const handleGoogleLink = async () => {
    setGoogleLinking(true);
    try {
      await linkGoogleAccount();
      // 성공 시 구글 페이지로 리다이렉트됨
    } catch (err: unknown) {
      toast.error(linkErrorMessage(err, '구글'));
      setGoogleLinking(false);
    }
  };

  const handleKakaoLink = async () => {
    setKakaoLinking(true);
    try {
      await linkKakaoAccount();
      // 성공 시 카카오 페이지로 리다이렉트됨
    } catch (err: unknown) {
      toast.error(linkErrorMessage(err, '카카오'));
      setKakaoLinking(false);
    }
  };

  const [name, setName] = useState(user?.name ?? '');
  const [nameLoading, setNameLoading] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>(getPushPermissionState());
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const pushSupported = isPushSupported();
  const pushSetupMessage = getPushSetupMessage();
  const isStandalone =
    typeof window !== 'undefined'
    && (
      window.matchMedia('(display-mode: standalone)').matches
      || ((navigator as Navigator & { standalone?: boolean }).standalone === true)
    );

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['push_subscriptions', user?.id],
    queryFn: () => getPushSubscriptions(user!.id),
    enabled: !!user,
  });

  const { data: preferences = {
    scheduleEnabled: true,
    studyEnabled: true,
    devotionalEnabled: true,
    prayerEnabled: true,
    readingWeeklyEnabled: true,
    serviceNoticeEnabled: true,
    quietHoursStart: null,
    quietHoursEnd: null,
    digestMode: 'instant' as const,
  } } = useQuery({
    queryKey: ['notification_preferences', user?.id],
    queryFn: () => getNotificationPreferences(user!.id),
    enabled: !!user,
  });

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((item) => item.isActive),
    [subscriptions],
  );

  const currentDeviceSubscription = useMemo(
    () => activeSubscriptions.find((item) => item.endpoint === currentEndpoint) ?? null,
    [activeSubscriptions, currentEndpoint],
  );

  useEffect(() => {
    let cancelled = false;

    const syncBrowserSubscription = async () => {
      setPermissionState(getPushPermissionState());
      if (!pushSupported) {
        setCurrentEndpoint(null);
        return;
      }

      try {
        const subscription = await getCurrentBrowserSubscription();
        if (!cancelled) {
          setCurrentEndpoint(subscription?.endpoint ?? null);
        }
      } catch {
        if (!cancelled) setCurrentEndpoint(null);
      }
    };

    void syncBrowserSubscription();
    return () => {
      cancelled = true;
    };
  }, [pushSupported]);

  const handleNameSave = async () => {
    if (!name.trim() || name.trim() === user?.name) return;
    setNameLoading(true);
    try {
      await updateUserName(user!.id, name.trim());
      await refreshProfile();
      toast.success('이름이 변경되었습니다.');
    } catch {
      toast.error('이름 변경에 실패했습니다.');
    } finally {
      setNameLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      toast.error('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPw.length < 6) {
      toast.error('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    setPwLoading(true);
    try {
      await updatePassword(newPw);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      toast.success('비밀번호가 변경되었습니다.');
    } catch {
      toast.error('비밀번호 변경에 실패했습니다. 다시 로그인 후 시도해 주세요.');
    } finally {
      setPwLoading(false);
    }
  };

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!user?.districtId) throw new Error('소속 구역 정보가 없어 구독을 진행할 수 없습니다.');
      const subscription = await subscribeBrowserPush();
      await savePushSubscription({
        userId: user.id,
        districtId: user.districtId,
        ...subscription,
      });
      return subscription.endpoint;
    },
    onSuccess: (endpoint) => {
      setPermissionState(getPushPermissionState());
      setCurrentEndpoint(endpoint);
      queryClient.invalidateQueries({ queryKey: ['push_subscriptions'] });
      toast.success('이 기기에서 알림 구독이 활성화되었습니다.');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '구독 설정에 실패했습니다.';
      toast.error(message);
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      const endpoint = await unsubscribeBrowserPush();
      if (endpoint && user) {
        await deactivatePushSubscription(user.id, endpoint);
      }
      return endpoint;
    },
    onSuccess: (endpoint) => {
      setPermissionState(getPushPermissionState());
      setCurrentEndpoint(null);
      queryClient.invalidateQueries({ queryKey: ['push_subscriptions'] });
      toast.success(endpoint ? '현재 기기의 알림 구독을 해지했습니다.' : '이 기기에는 활성 구독이 없습니다.');
    },
    onError: () => {
      toast.error('구독 해지에 실패했습니다.');
    },
  });

  const preferenceMutation = useMutation({
    mutationFn: (patch: Partial<typeof preferences>) => saveNotificationPreferences(user!.id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_preferences'] });
    },
    onError: () => toast.error('알림 설정 저장에 실패했습니다.'),
  });

  const handlePreferenceToggle = (
    key: keyof typeof preferences,
    value: boolean,
  ) => {
    preferenceMutation.mutate({ [key]: value });
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">내 프로필</h1>
          <p className="text-sm text-muted-foreground mt-1">계정 정보를 확인하고 변경하세요.</p>
        </div>

        {/* 계정 정보 */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-4 h-4" />
                계정 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold text-sm">{user?.name?.slice(0, 1)}</span>
                </div>
                <div>
                  <p className="font-medium">{user?.name}</p>
                  <Badge variant={user?.role !== 'member' ? 'default' : 'secondary'} className="text-xs mt-0.5">
                    {user?.role === 'master' ? '마스터구역장' : user?.role === 'leader' ? '구역장' : '구역원'}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="name">이름 변경</Label>
                <div className="flex gap-2">
                  <Input
                    id="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="변경할 이름"
                    maxLength={20}
                  />
                  <Button
                    size="sm"
                    disabled={nameLoading || !name.trim() || name.trim() === user?.name}
                    onClick={handleNameSave}
                    className="shrink-0 gap-1"
                  >
                    {nameLoading
                      ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      : <Save className="w-4 h-4" />
                    }
                    저장
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>소셜 계정 연결</Label>
                {googleIdentity ? (
                  <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">연결됨</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {(googleIdentity.identity_data?.email as string) ?? '구글 계정'}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">Google</Badge>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    disabled={googleLinking}
                    onClick={handleGoogleLink}
                  >
                    <Link2 className="w-4 h-4" />
                    {googleLinking ? '이동 중...' : '구글 계정 연결하기'}
                  </Button>
                )}
                {kakaoIdentity ? (
                  <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">연결됨</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {(kakaoIdentity.identity_data?.email as string) ?? '카카오 계정'}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">Kakao</Badge>
                  </div>
                ) : (
                  <Button
                    className="w-full gap-2 bg-[#FEE500] text-[#191919] hover:bg-[#FEE500]/90"
                    disabled={kakaoLinking}
                    onClick={handleKakaoLink}
                  >
                    <Link2 className="w-4 h-4" />
                    {kakaoLinking ? '이동 중...' : '카카오 계정 연결하기'}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  연결해두면 비밀번호 없이 소셜 계정으로 로그인할 수 있습니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BellRing className="w-4 h-4" />
                알림 설정
              </CardTitle>
              <CardDescription>
                설치 후 구독하기를 켜면 새 일정, 성경공부, 기도제목 같은 알림을 이 기기에서 받을 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">현재 기기 상태</p>
                  <p className="mt-1 text-sm font-medium">
                    {currentDeviceSubscription ? '구독됨' : '미구독'}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">브라우저 권한</p>
                  <p className="mt-1 text-sm font-medium">
                    {permissionState === 'granted'
                      ? '허용됨'
                      : permissionState === 'denied'
                        ? '차단됨'
                        : permissionState === 'default'
                          ? '아직 미선택'
                          : '미지원'}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">활성 기기 수</p>
                  <p className="mt-1 text-sm font-medium">{activeSubscriptions.length}대</p>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">이 기기에서 알림 받기</p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {pushSetupMessage
                        ? pushSetupMessage
                        : permissionState === 'denied'
                          ? '브라우저 설정에서 알림 차단을 해제한 뒤 다시 시도해 주세요.'
                          : !isStandalone
                            ? '홈 화면에 추가한 뒤 구독하면 더 설치형 앱처럼 안정적으로 사용할 수 있습니다.'
                            : '현재 기기에서 바로 알림을 받을 수 있습니다.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={() => subscribeMutation.mutate()}
                    disabled={
                      subscribeMutation.isPending
                      || !pushSupported
                      || !hasPushSetupReady()
                      || permissionState === 'denied'
                      || !!currentDeviceSubscription
                    }
                  >
                    {subscribeMutation.isPending ? '구독 설정 중...' : currentDeviceSubscription ? '현재 기기 구독됨' : '구독하기'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => unsubscribeMutation.mutate()}
                    disabled={unsubscribeMutation.isPending || !currentDeviceSubscription}
                  >
                    {unsubscribeMutation.isPending ? '해지 중...' : '현재 기기 구독 해지'}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">받고 싶은 알림</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    구독을 켠 뒤에는 아래 항목별로 수신 범위를 조절할 수 있습니다.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    ['scheduleEnabled', '일정 알림'],
                    ['studyEnabled', '성경공부 알림'],
                    ['devotionalEnabled', '오늘의 묵상'],
                    ['prayerEnabled', '기도제목 알림'],
                    ['readingWeeklyEnabled', '주간 성경읽기'],
                    ['serviceNoticeEnabled', '서비스 공지'],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                      </div>
                      <Switch
                        checked={preferences[key as keyof typeof preferences] as boolean}
                        onCheckedChange={(checked) => handlePreferenceToggle(key as keyof typeof preferences, checked)}
                        disabled={preferenceMutation.isPending}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 비밀번호 변경 */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="w-4 h-4" />
                비밀번호 변경
              </CardTitle>
              <CardDescription>6자 이상의 새 비밀번호를 입력하세요.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPw">새 비밀번호</Label>
                  <Input
                    id="newPw"
                    type="password"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder="새 비밀번호 (6자 이상)"
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPw">새 비밀번호 확인</Label>
                  <Input
                    id="confirmPw"
                    type="password"
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    placeholder="새 비밀번호 재입력"
                    minLength={6}
                    required
                  />
                  {confirmPw && newPw !== confirmPw && (
                    <p className="text-xs text-destructive">비밀번호가 일치하지 않습니다.</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={pwLoading || !newPw || newPw !== confirmPw}>
                  {pwLoading
                    ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    : null
                  }
                  비밀번호 변경
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
