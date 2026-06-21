import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { useDistrict } from '@/lib/districtContext';
import {
  getAllUsers, approveUser, rejectUser, changeUserRole, changeUserDistrict,
  adminResetUserPassword, transferMasterRole, getDistricts,
} from '@/lib/api';
import type { FullUser } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users, Clock, Link, Copy, UserCheck, UserX, ShieldCheck, Shield,
  ArrowRightLeft, KeyRound, Crown,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminMembersTab() {
  const { user, isMaster } = useAuth();
  const { currentDistrictId } = useDistrict();
  const queryClient = useQueryClient();

  const [districtChangeTarget, setDistrictChangeTarget] = useState<FullUser | null>(null);
  const [passwordResetTarget, setPasswordResetTarget] = useState<FullUser | null>(null);
  const [transferMasterTarget, setTransferMasterTarget] = useState<FullUser | null>(null);
  const [transferMasterConfirm, setTransferMasterConfirm] = useState('');
  const [resetCustomPassword, setResetCustomPassword] = useState('');
  const [resetResultPassword, setResetResultPassword] = useState('');

  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['all_users', currentDistrictId],
    queryFn: () => getAllUsers(currentDistrictId),
    enabled: !!currentDistrictId,
    placeholderData: prev => prev,
  });

  const { data: allDistricts = [] } = useQuery({
    queryKey: ['districts'],
    queryFn: getDistricts,
    enabled: isMaster,
    staleTime: 60_000,
  });

  const pendingUsers = allUsers.filter((u: FullUser) => u.status === 'pending');
  const activeUsers = allUsers.filter((u: FullUser) => u.status === 'active');

  const approveMutation = useMutation({
    mutationFn: (userId: string) => approveUser(userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all_users'] }); toast.success('구역원을 승인했습니다.'); },
    onError: () => toast.error('승인에 실패했습니다.'),
  });

  const rejectMutation = useMutation({
    mutationFn: (userId: string) => rejectUser(userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all_users'] }); toast.success('구역원 요청을 거절했습니다.'); },
    onError: () => toast.error('거절에 실패했습니다.'),
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'master' | 'leader' | 'member' }) => changeUserRole(userId, role),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all_users'] }); toast.success('역할이 변경되었습니다.'); },
    onError: () => toast.error('역할 변경에 실패했습니다.'),
  });

  const changeDistrictMutation = useMutation({
    mutationFn: ({ userId, districtId }: { userId: string; districtId: string }) => changeUserDistrict(userId, districtId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all_users'] }); setDistrictChangeTarget(null); toast.success('소속 구역이 변경되었습니다.'); },
    onError: () => toast.error('소속 구역 변경에 실패했습니다.'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword?: string }) => adminResetUserPassword(userId, newPassword),
    onSuccess: result => { setResetResultPassword(result.tempPassword); toast.success('임시 비밀번호가 발급되었습니다.'); },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : '비밀번호 초기화에 실패했습니다.'),
  });

  const transferMasterMutation = useMutation({
    mutationFn: (userId: string) => transferMasterRole(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_users'] });
      setTransferMasterTarget(null);
      setTransferMasterConfirm('');
      toast.success('마스터 권한이 이관되었습니다. 본인은 구역장으로 변경되었습니다.');
    },
    onError: (e: unknown) => toast.error((e as Error).message ?? '마스터 이관에 실패했습니다.'),
  });

  return (
    <div className="space-y-5">
      {/* 초대 링크 */}
      {isMaster && allDistricts.filter(d => d.isActive).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Link className="w-4 h-4 text-primary" />구성원 초대 링크</CardTitle>
            <CardDescription className="text-xs">링크를 카카오톡에 공유하면 자동으로 해당 구역으로 가입됩니다. 초대 링크로 가입한 사람은 승인 없이 즉시 등록됩니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {allDistricts.filter(d => d.isActive).map(district => {
              const inviteUrl = `${window.location.origin}/join?d=${district.id}`;
              return (
                <div key={district.id} className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                  <span className="text-sm font-medium min-w-[60px] shrink-0">{district.name}</span>
                  <span className="flex-1 text-xs text-muted-foreground truncate font-mono">{inviteUrl}</span>
                  <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={() => { navigator.clipboard.writeText(inviteUrl); toast.success(`${district.name} 초대 링크 복사됨`); }}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 리더 전용: 현재 구역 초대 링크 */}
      {!isMaster && currentDistrictId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Link className="w-4 h-4 text-primary" />구역원 초대</CardTitle>
            <CardDescription className="text-xs">아래 링크를 카카오톡으로 공유하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <span className="flex-1 text-xs text-muted-foreground truncate font-mono">{`${window.location.origin}/join?d=${currentDistrictId}`}</span>
              <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join?d=${currentDistrictId}`); toast.success('초대 링크가 복사되었습니다.'); }}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 승인 대기 */}
      {pendingUsers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              승인 대기
              <Badge variant="destructive" className="ml-1">{pendingUsers.length}명</Badge>
            </CardTitle>
            <CardDescription className="text-xs">초대 링크 없이 직접 가입한 사람들입니다. 구역원이 맞으면 승인하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingUsers.map((u: FullUser) => (
                <div key={u.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium">{u.name}</p>
                    <p className="text-[12px] text-muted-foreground">신청일 {u.createdAt}</p>
                  </div>
                  <Button size="sm" className="h-8 gap-1 bg-green-600 text-white hover:bg-green-700" onClick={() => approveMutation.mutate(u.id)} disabled={approveMutation.isPending}>
                    <UserCheck className="w-3.5 h-3.5" />승인
                  </Button>
                  <Button size="sm" variant="destructive" className="h-8 gap-1" onClick={() => rejectMutation.mutate(u.id)} disabled={rejectMutation.isPending}>
                    <UserX className="w-3.5 h-3.5" />거절
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 활성 구역원 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            활성 구역원
            <span className="text-muted-foreground font-normal">{activeUsers.length}명</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : activeUsers.length === 0 ? (
            <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">활성 구역원이 없습니다.</p>
          ) : (
            <>
              {/* 모바일: 카드형 */}
              <div className="space-y-2 md:hidden">
                {activeUsers.map((u: FullUser) => (
                  <div key={u.id} className="rounded-xl border px-3 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[14px] font-medium">{u.name}</p>
                        <p className="text-[12px] text-muted-foreground">{u.districtName} · 가입일 {u.createdAt}</p>
                      </div>
                      {u.role === 'master' ? <Badge className="text-xs">마스터</Badge>
                        : u.role === 'leader' ? <Badge variant="default" className="text-xs">구역장</Badge>
                        : <Badge variant="secondary" className="text-xs">구역원</Badge>}
                    </div>
                    {isMaster && u.id !== user?.id && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {u.role !== 'master' && (
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" disabled={changeRoleMutation.isPending} onClick={() => changeRoleMutation.mutate({ userId: u.id, role: u.role === 'leader' ? 'member' : 'leader' })}>
                            {u.role === 'leader' ? <><Shield className="w-3 h-3" />구역원으로</> : <><ShieldCheck className="w-3 h-3" />구역장으로</>}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setDistrictChangeTarget(u)}>
                          <ArrowRightLeft className="w-3 h-3" />구역이동
                        </Button>
                        {u.role !== 'master' && (
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => { setResetCustomPassword(''); setResetResultPassword(''); setPasswordResetTarget(u); }}>
                            <KeyRound className="w-3 h-3" />비밀번호 초기화
                          </Button>
                        )}
                        {u.role !== 'master' && (
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-amber-600 border-amber-200 hover:bg-amber-50 col-span-2" onClick={() => { setTransferMasterConfirm(''); setTransferMasterTarget(u); }}>
                            <Crown className="w-3 h-3" />마스터 이관
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 데스크톱: 테이블 */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>역할</TableHead>
                      <TableHead>소속 구역</TableHead>
                      <TableHead>가입일</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeUsers.map((u: FullUser) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell>
                          {u.role === 'master' ? <Badge className="text-xs">마스터</Badge>
                            : u.role === 'leader' ? <Badge variant="default" className="text-xs">구역장</Badge>
                            : <Badge variant="secondary" className="text-xs">구역원</Badge>}
                        </TableCell>
                        <TableCell className="text-sm">{u.districtName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.createdAt}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {isMaster && u.id !== user?.id && u.role !== 'master' && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" disabled={changeRoleMutation.isPending} onClick={() => changeRoleMutation.mutate({ userId: u.id, role: u.role === 'leader' ? 'member' : 'leader' })}>
                                {u.role === 'leader' ? <><Shield className="w-3 h-3" />구역원으로</> : <><ShieldCheck className="w-3 h-3" />구역장으로</>}
                              </Button>
                            )}
                            {isMaster && u.id !== user?.id && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setDistrictChangeTarget(u)}>
                                <ArrowRightLeft className="w-3 h-3" />구역이동
                              </Button>
                            )}
                            {isMaster && u.id !== user?.id && u.role !== 'master' && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setResetCustomPassword(''); setResetResultPassword(''); setPasswordResetTarget(u); }}>
                                <KeyRound className="w-3 h-3" />비밀번호
                              </Button>
                            )}
                            {isMaster && u.role !== 'master' && u.id !== user?.id && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={() => { setTransferMasterConfirm(''); setTransferMasterTarget(u); }}>
                                <Crown className="w-3 h-3" />이관
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 마스터 이관 확인 */}
      <AlertDialog open={!!transferMasterTarget} onOpenChange={open => { if (!open) { setTransferMasterTarget(null); setTransferMasterConfirm(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />마스터 권한 이관
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p><span className="font-semibold text-foreground">{transferMasterTarget?.name}</span>님에게 마스터 권한을 이관합니다.</p>
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300 space-y-1">
                  <p className="font-semibold text-xs">이관 후 변경 사항</p>
                  <p className="text-xs">본인은 구역장으로 변경됩니다.</p>
                  <p className="text-xs">이관 후 되돌리려면 새 마스터의 동의가 필요합니다.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">확인을 위해 <span className="font-semibold">{transferMasterTarget?.name}</span>의 이름을 입력하세요</Label>
                  <Input value={transferMasterConfirm} onChange={e => setTransferMasterConfirm(e.target.value)} placeholder={transferMasterTarget?.name ?? ''} />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-600 text-white"
              disabled={transferMasterConfirm.trim() !== (transferMasterTarget?.name ?? '') || transferMasterMutation.isPending}
              onClick={() => { if (transferMasterTarget) transferMasterMutation.mutate(transferMasterTarget.id); }}
            >
              {transferMasterMutation.isPending ? '이관 중...' : '이관 확인'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 구역 이동 */}
      <Dialog open={!!districtChangeTarget} onOpenChange={() => setDistrictChangeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>소속 구역 변경</DialogTitle>
            <DialogDescription>
              <span className="font-semibold">{districtChangeTarget?.name}</span>님의 소속 구역을 변경합니다.
              현재 소속: <span className="font-semibold">{districtChangeTarget?.districtName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Label>변경할 구역</Label>
            <Select onValueChange={districtId => { if (districtChangeTarget) changeDistrictMutation.mutate({ userId: districtChangeTarget.id, districtId }); }}>
              <SelectTrigger><SelectValue placeholder="구역을 선택하세요" /></SelectTrigger>
              <SelectContent>
                {allDistricts.filter(d => d.isActive && d.id !== districtChangeTarget?.districtId).map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>

      {/* 비밀번호 초기화 */}
      <Dialog open={!!passwordResetTarget} onOpenChange={open => { if (!open) { setPasswordResetTarget(null); setResetCustomPassword(''); setResetResultPassword(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>비밀번호 초기화</DialogTitle>
            <DialogDescription>
              <span className="font-semibold">{passwordResetTarget?.name}</span>님의 비밀번호를 임시 비밀번호로 초기화합니다.
            </DialogDescription>
          </DialogHeader>
          {resetResultPassword ? (
            <div className="space-y-3 pt-2">
              <p className="text-sm">임시 비밀번호가 발급되었습니다. 본인에게 안전하게 전달해주세요.</p>
              <div className="flex items-center gap-2">
                <Input readOnly value={resetResultPassword} className="font-mono text-base" />
                <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1" onClick={() => navigator.clipboard.writeText(resetResultPassword).then(() => toast.success('복사됨')).catch(() => toast.error('복사 실패'))}>
                  <Copy className="w-3.5 h-3.5" />복사
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">로그인 후 프로필에서 비밀번호를 변경하도록 안내해주세요.</p>
              <Button type="button" className="w-full" onClick={() => { setPasswordResetTarget(null); setResetCustomPassword(''); setResetResultPassword(''); }}>닫기</Button>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label htmlFor="reset-pw">임시 비밀번호 (선택)</Label>
                <Input id="reset-pw" value={resetCustomPassword} onChange={e => setResetCustomPassword(e.target.value)} placeholder="비워두면 자동 생성됩니다" autoComplete="off" />
                {resetCustomPassword && resetCustomPassword.trim().length < 6 && (
                  <p className="text-xs text-destructive">6자 이상 입력해주세요.</p>
                )}
              </div>
              <Button
                type="button"
                className="w-full"
                disabled={resetPasswordMutation.isPending || (!!resetCustomPassword && resetCustomPassword.trim().length < 6)}
                onClick={() => { if (!passwordResetTarget) return; resetPasswordMutation.mutate({ userId: passwordResetTarget.id, newPassword: resetCustomPassword.trim() || undefined }); }}
              >
                {resetPasswordMutation.isPending ? '발급 중...' : '임시 비밀번호 발급'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
