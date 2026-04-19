import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, CheckCircle2, Circle, Pencil, Trash2, Lock, Users, ShieldCheck, HeartHandshake } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { useDistrict } from '@/lib/districtContext';
import {
  getPrayerRequests,
  savePrayerRequest,
  updatePrayerRequest,
  deletePrayerRequest,
  getGroupPrayerRequests,
  getCurrentLockStatus,
  getMyIntercessions,
  getIntercessionCounts,
  toggleIntercession,
} from '@/lib/api';
import type { PrayerRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/components/AppLayout';
import { toast } from 'sonner';

export default function PrayerRequests() {
  const { user } = useAuth();
  const { currentDistrictId } = useDistrict();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'intercession' ? 'intercession' : 'prayers';
  const queryClient = useQueryClient();
  const [newContent, setNewContent] = useState('');
  const [sharedWithLeader, setSharedWithLeader] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editSharedWithLeader, setEditSharedWithLeader] = useState(false);

  const { data: prayers = [], isLoading } = useQuery({
    queryKey: ['prayer_requests', currentDistrictId],
    queryFn: () => getPrayerRequests(currentDistrictId),
    enabled: !!currentDistrictId,
  });

  const { data: groupPrayers = [] } = useQuery({
    queryKey: ['group_prayer_requests', currentDistrictId],
    queryFn: () => getGroupPrayerRequests(currentDistrictId),
    enabled: !!currentDistrictId,
  });

  const { data: isLocked = false } = useQuery({
    queryKey: ['lock_status', currentDistrictId],
    queryFn: () => getCurrentLockStatus(currentDistrictId),
    enabled: !!currentDistrictId,
  });

  const groupPrayerIds = groupPrayers.map(p => p.id);

  const { data: myIntercessions = new Set<string>() } = useQuery({
    queryKey: ['my_intercessions', user?.id],
    queryFn: () => getMyIntercessions(user!.id),
    enabled: !!user,
  });

  const { data: intercessionCounts = {} } = useQuery({
    queryKey: ['intercession_counts', groupPrayerIds],
    queryFn: () => getIntercessionCounts(groupPrayerIds),
    enabled: groupPrayerIds.length > 0,
  });

  const intercessionMutation = useMutation({
    mutationFn: (prayerRequestId: string) => toggleIntercession(prayerRequestId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_intercessions'] });
      queryClient.invalidateQueries({ queryKey: ['intercession_counts'] });
    },
    onError: () => toast.error('요청에 실패했습니다.'),
  });

  const myPrayers = prayers.filter((p: PrayerRequest) => p.userId === user?.id);
  // 중보기도 중 본인 것 제외
  const otherGroupPrayers = groupPrayers.filter((p: PrayerRequest) => p.userId !== user?.id);

  const addMutation = useMutation({
    mutationFn: () => savePrayerRequest({ userId: user!.id, content: newContent.trim(), sharedWithLeader }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer_requests'] });
      setNewContent('');
      setSharedWithLeader(false);
      toast.success('기도제목이 등록되었습니다.');
    },
    onError: () => toast.error('등록에 실패했습니다.'),
  });

  const updateMutation = useMutation({
    mutationFn: (params: { id: string; content: string; sharedWithLeader: boolean }) =>
      updatePrayerRequest({ id: params.id, content: params.content, sharedWithLeader: params.sharedWithLeader }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer_requests'] });
      setEditingId(null);
      toast.success('수정되었습니다.');
    },
    onError: () => toast.error('수정에 실패했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePrayerRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer_requests'] });
      toast.success('삭제되었습니다.');
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  });

  const handleAdd = () => {
    if (!newContent.trim() || !user) return;
    addMutation.mutate();
  };

  const startEdit = (prayer: PrayerRequest) => {
    setEditingId(prayer.id);
    setEditContent(prayer.content);
    setEditSharedWithLeader(prayer.sharedWithLeader);
  };

  const saveEdit = (id: string) => {
    if (!editContent.trim()) return;
    updateMutation.mutate({ id, content: editContent.trim(), sharedWithLeader: editSharedWithLeader });
  };

  const handleDelete = (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      deleteMutation.mutate(id);
    }
  };

  const renderPrayerItem = (prayer: PrayerRequest, i: number, isOwn: boolean, isGroupPrayer = false) => {
    const isJoined = myIntercessions.has(prayer.id);
    const count = intercessionCounts[prayer.id] ?? 0;

    return (
      <motion.div
        key={prayer.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.03 }}
        className={`card-elevated p-4 cursor-pointer hover:bg-muted/30 transition-colors ${isGroupPrayer && isJoined ? 'ring-1 ring-primary/30 bg-primary/5' : ''}`}
        onClick={() => navigate(`/prayer-requests/${prayer.id}`)}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {prayer.answered ? (
              <CheckCircle2 className="w-5 h-5 text-success" />
            ) : (
              <Circle className="w-5 h-5 text-muted-foreground/40" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium">{prayer.userName}</span>
              <span className="text-xs text-muted-foreground">{prayer.createdAt}</span>
              {prayer.sharedWithLeader && (
                <Badge variant="outline" className="text-[10px] py-0 px-1 gap-0.5"><ShieldCheck className="w-2.5 h-2.5" />공유</Badge>
              )}
              {prayer.sharedWithGroup && (
                <Badge variant="outline" className="text-[10px] py-0 px-1 gap-0.5"><Users className="w-2.5 h-2.5" />중보</Badge>
              )}
            </div>

            {editingId === prayer.id ? (
              <div className="space-y-2" onClick={e => e.stopPropagation()}>
                <Textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="text-sm min-h-[60px]"
                />
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editSharedWithLeader}
                    onCheckedChange={setEditSharedWithLeader}
                    id={`edit-share-${prayer.id}`}
                  />
                  <label htmlFor={`edit-share-${prayer.id}`} className="text-xs">구역장에게 공유</label>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(prayer.id)} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? '저장 중...' : '저장'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>취소</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm">{prayer.content}</p>
            )}

            {/* 중보기도 참여 버튼 */}
            {isGroupPrayer && editingId !== prayer.id && (
              <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => intercessionMutation.mutate(prayer.id)}
                  disabled={intercessionMutation.isPending}
                  className={`flex items-center gap-1 text-xs font-medium transition-colors ${isJoined ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                >
                  <HeartHandshake className={`w-4 h-4 ${isJoined ? 'fill-primary/20' : ''}`} />
                  {isJoined ? '함께 기도 중' : '함께 기도합니다'}
                </button>
                {count > 0 && (
                  <span className="text-xs text-muted-foreground">{count}명이 함께 기도 중</span>
                )}
              </div>
            )}

            {/* 본인 항목 수정/삭제 버튼 */}
            {isOwn && editingId !== prayer.id && (
              <div className="flex items-center gap-1 mt-2" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => startEdit(prayer)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Pencil className="w-3 h-3" /> 수정
                </button>
                <span className="text-muted-foreground/30 mx-1">|</span>
                <button
                  onClick={() => handleDelete(prayer.id)}
                  className="text-xs text-destructive hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> 삭제
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const joinedPrayers = otherGroupPrayers.filter(p => myIntercessions.has(p.id));
  const notJoinedPrayers = otherGroupPrayers.filter(p => !myIntercessions.has(p.id));

  return (
    <AppLayout>
      <div className="space-y-5 max-w-2xl mx-auto">
        <h1 className="font-display text-2xl font-bold">기도제목</h1>

        <Tabs defaultValue={initialTab} className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="prayers" className="flex-1 gap-1.5">
              <MessageSquareHeart className="w-3.5 h-3.5" /> 기도제목
            </TabsTrigger>
            <TabsTrigger value="intercession" className="flex-1 gap-1.5">
              <HeartHandshake className="w-3.5 h-3.5" /> 함께기도
              {myIntercessions.size > 0 && (
                <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 leading-none">
                  {myIntercessions.size}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* 기도제목 탭 */}
          <TabsContent value="prayers" className="space-y-5 mt-0">
            <div className="card-elevated p-4 space-y-3">
              {isLocked ? (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg text-sm">
                  <Lock className="w-4 h-4 shrink-0" />
                  이번 주 마감이 완료되어 기도제목을 추가할 수 없습니다.
                </div>
              ) : (
                <>
                  <Input
                    value={newContent}
                    onChange={e => setNewContent(e.target.value)}
                    placeholder="새 기도제목을 입력하세요..."
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={sharedWithLeader}
                        onCheckedChange={setSharedWithLeader}
                        id="share-with-leader"
                      />
                      <label htmlFor="share-with-leader" className="text-xs text-muted-foreground">구역장에게 공유</label>
                    </div>
                    <Button onClick={handleAdd} size="sm" className="gap-1" disabled={addMutation.isPending}>
                      <Plus className="w-3.5 h-3.5" /> {addMutation.isPending ? '등록 중...' : '등록'}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-muted-foreground">내 기도제목</h2>
                  {myPrayers.map((prayer: PrayerRequest, i: number) => renderPrayerItem(prayer, i, true))}
                  {myPrayers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">등록된 기도제목이 없습니다.</p>
                  )}
                </div>
                {otherGroupPrayers.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Users className="w-4 h-4" /> 구역 기도제목
                    </h2>
                    {otherGroupPrayers.map((prayer: PrayerRequest, i: number) => renderPrayerItem(prayer, i, false, true))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* 함께기도 탭 */}
          <TabsContent value="intercession" className="space-y-5 mt-0">
            {joinedPrayers.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <HeartHandshake className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="font-semibold">아직 함께기도에 참여하지 않았어요</p>
                <p className="text-sm text-muted-foreground">기도제목 탭에서 구역 식구의 기도에 동참해보세요</p>
              </div>
            ) : (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">내가 함께기도 중인 기도제목</h2>
                {joinedPrayers.map((prayer: PrayerRequest, i: number) => renderPrayerItem(prayer, i, false, true))}
              </div>
            )}
            {notJoinedPrayers.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">아직 참여하지 않은 기도제목</h2>
                {notJoinedPrayers.map((prayer: PrayerRequest, i: number) => renderPrayerItem(prayer, i, false, true))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
