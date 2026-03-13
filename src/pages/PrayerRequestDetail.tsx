import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trash2, Pencil, Plus, Users, ShieldCheck, HeartHandshake } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import {
  getPrayerRequest,
  updatePrayerRequest,
  deletePrayerRequest,
  getPrayerResponses,
  addPrayerResponse,
  deletePrayerResponse,
  toggleIntercession,
  getIntercessionUsers,
} from '@/lib/api';
import type { PrayerResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/components/AppLayout';
import { toast } from 'sonner';

export default function PrayerRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isLeader } = useAuth();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editSharedWithLeader, setEditSharedWithLeader] = useState(false);
  const [newResponse, setNewResponse] = useState('');

  const { data: prayer, isLoading } = useQuery({
    queryKey: ['prayer_request', id],
    queryFn: () => getPrayerRequest(id!),
    enabled: !!id,
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['prayer_responses', id],
    queryFn: () => getPrayerResponses(id!),
    enabled: !!id,
  });

  const { data: intercessionUsers = [] } = useQuery({
    queryKey: ['intercession_users', id],
    queryFn: () => getIntercessionUsers(id!),
    enabled: !!id && !!prayer?.sharedWithGroup,
  });

  const isJoinedIntercession = intercessionUsers.some(u => u.userId === user?.id);

  const intercessionMutation = useMutation({
    mutationFn: () => toggleIntercession(id!, user!.id),
    onSuccess: (joined) => {
      queryClient.invalidateQueries({ queryKey: ['intercession_users', id] });
      queryClient.invalidateQueries({ queryKey: ['my_intercessions'] });
      queryClient.invalidateQueries({ queryKey: ['intercession_counts'] });
      toast.success(joined ? '함께 기도합니다!' : '참여가 해제되었습니다.');
    },
    onError: () => toast.error('요청에 실패했습니다.'),
  });

  const isOwner = prayer?.userId === user?.id;

  const updateMutation = useMutation({
    mutationFn: (params: Parameters<typeof updatePrayerRequest>[0]) => updatePrayerRequest(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer_request', id] });
      queryClient.invalidateQueries({ queryKey: ['prayer_requests'] });
      setIsEditing(false);
      toast.success('수정되었습니다.');
    },
    onError: () => toast.error('수정에 실패했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePrayerRequest(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer_requests'] });
      toast.success('삭제되었습니다.');
      navigate('/prayer-requests');
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  });

  const addResponseMutation = useMutation({
    mutationFn: () => addPrayerResponse({ prayerRequestId: id!, userId: user!.id, content: newResponse.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer_responses', id] });
      setNewResponse('');
      toast.success('응답이 기록되었습니다.');
    },
    onError: () => toast.error('응답 기록에 실패했습니다.'),
  });

  const deleteResponseMutation = useMutation({
    mutationFn: (responseId: string) => deletePrayerResponse(responseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer_responses', id] });
      toast.success('응답이 삭제되었습니다.');
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  });

  const toggleGroupShare = useMutation({
    mutationFn: () => updatePrayerRequest({ id: id!, sharedWithGroup: !prayer?.sharedWithGroup }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer_request', id] });
      queryClient.invalidateQueries({ queryKey: ['prayer_requests'] });
      toast.success(prayer?.sharedWithGroup ? '중보기도 공유가 해제되었습니다.' : '중보기도로 공유되었습니다.');
    },
    onError: () => toast.error('변경에 실패했습니다.'),
  });

  const toggleAnswered = useMutation({
    mutationFn: () => updatePrayerRequest({ id: id!, answered: !prayer?.answered }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer_request', id] });
      queryClient.invalidateQueries({ queryKey: ['prayer_requests'] });
      toast.success(prayer?.answered ? '기도중으로 변경되었습니다.' : '응답됨으로 변경되었습니다.');
    },
    onError: () => toast.error('변경에 실패했습니다.'),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!prayer) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto space-y-4">
          <button onClick={() => navigate('/prayer-requests')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> 목록으로
          </button>
          <p className="text-center text-muted-foreground py-8">기도제목을 찾을 수 없습니다.</p>
        </div>
      </AppLayout>
    );
  }

  const startEdit = () => {
    setEditContent(prayer.content);
    setEditSharedWithLeader(prayer.sharedWithLeader);
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (!editContent.trim()) return;
    updateMutation.mutate({
      id: id!,
      content: editContent.trim(),
      sharedWithLeader: editSharedWithLeader,
    });
  };

  const handleDelete = () => {
    if (confirm('정말 삭제하시겠습니까?')) {
      deleteMutation.mutate();
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <button onClick={() => navigate('/prayer-requests')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> 목록으로
        </button>

        {/* 기도제목 상단 */}
        <div className="card-elevated p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{prayer.userName}</span>
              <span className="text-xs text-muted-foreground">{prayer.createdAt}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {prayer.answered ? (
                <Badge className="bg-green-500/10 text-green-600 text-xs">응답됨</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">기도중</Badge>
              )}
              {prayer.sharedWithLeader && (
                <Badge variant="outline" className="text-xs gap-1"><ShieldCheck className="w-3 h-3" />구역장 공유</Badge>
              )}
              {prayer.sharedWithGroup && (
                <Badge variant="outline" className="text-xs gap-1"><Users className="w-3 h-3" />중보기도</Badge>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="text-sm min-h-[80px]"
              />
              <div className="flex items-center gap-2">
                <Switch
                  checked={editSharedWithLeader}
                  onCheckedChange={setEditSharedWithLeader}
                  id="edit-share-leader"
                />
                <label htmlFor="edit-share-leader" className="text-sm">구역장에게 공유</label>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? '저장 중...' : '저장'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>취소</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{prayer.content}</p>
          )}

          {/* 본인 액션 */}
          {isOwner && !isEditing && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={startEdit}>
                <Pencil className="w-3 h-3" /> 수정
              </Button>
              <Button size="sm" variant="ghost" className="gap-1 text-xs text-destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                <Trash2 className="w-3 h-3" /> 삭제
              </Button>
              <Button
                size="sm"
                variant={prayer.answered ? 'secondary' : 'default'}
                className="gap-1 text-xs ml-auto"
                onClick={() => toggleAnswered.mutate()}
                disabled={toggleAnswered.isPending}
              >
                {prayer.answered ? '기도중으로 변경' : '응답됨으로 변경'}
              </Button>
            </div>
          )}

          {/* 구역장: 중보기도 공유 버튼 */}
          {isLeader && !isOwner && prayer.sharedWithLeader && (
            <div className="pt-2 border-t">
              <Button
                size="sm"
                variant={prayer.sharedWithGroup ? 'secondary' : 'default'}
                className="gap-1 text-xs"
                onClick={() => toggleGroupShare.mutate()}
                disabled={toggleGroupShare.isPending}
              >
                <Users className="w-3 h-3" />
                {prayer.sharedWithGroup ? '중보기도 공유 해제' : '중보기도로 공유'}
              </Button>
            </div>
          )}
        </div>

        {/* 함께 기도하는 사람들 */}
        {prayer.sharedWithGroup && (
          <div className="card-elevated p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <HeartHandshake className="w-4 h-4 text-primary" /> 함께 기도하는 사람들
              </h2>
              <button
                onClick={() => intercessionMutation.mutate()}
                disabled={intercessionMutation.isPending}
                className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                  isJoinedIntercession
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10'
                }`}
              >
                <HeartHandshake className={`w-3.5 h-3.5 ${isJoinedIntercession ? 'fill-primary/20' : ''}`} />
                {isJoinedIntercession ? '함께 기도 중' : '함께 기도합니다'}
              </button>
            </div>
            {intercessionUsers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {intercessionUsers.map(u => (
                  <span key={u.userId} className="text-xs bg-muted px-2 py-1 rounded-full">{u.userName}</span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">아직 참여자가 없습니다.</p>
            )}
          </div>
        )}

        {/* 응답 목록 */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">응답 기록 ({responses.length})</h2>

          {responses.map((r: PrayerResponse, i: number) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="card-elevated p-4"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{r.userName}</span>
                  <span className="text-xs text-muted-foreground">{r.createdAt}</span>
                </div>
                {r.userId === user?.id && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => deleteResponseMutation.mutate(r.id)}
                    disabled={deleteResponseMutation.isPending}
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                )}
              </div>
              <p className="text-sm">{r.content}</p>
            </motion.div>
          ))}

          {responses.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">아직 응답 기록이 없습니다.</p>
          )}

          {/* 응답 추가 (본인만) */}
          {isOwner && (
            <div className="card-elevated p-4 space-y-3">
              <Textarea
                value={newResponse}
                onChange={e => setNewResponse(e.target.value)}
                placeholder="기도 응답 내용을 작성하세요..."
                className="text-sm min-h-[60px]"
              />
              <Button
                size="sm"
                className="gap-1"
                onClick={() => addResponseMutation.mutate()}
                disabled={!newResponse.trim() || addResponseMutation.isPending}
              >
                <Plus className="w-3.5 h-3.5" />
                {addResponseMutation.isPending ? '저장 중...' : '응답 기록'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
