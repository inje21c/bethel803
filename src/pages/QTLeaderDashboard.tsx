import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Users, CheckCircle2, Circle, AlertTriangle, Save } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { useDistrict } from '@/lib/districtContext';
import {
  getQTDistrictSummary,
  getTodayQT,
  updateQTLeaderComment,
  getKSTDateString,
} from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function QTLeaderDashboard() {
  const { isLeader } = useAuth();
  const { currentDistrictId } = useDistrict();
  const today = getKSTDateString(new Date());

  const { data: qt } = useQuery({
    queryKey: ['qt_content', today],
    queryFn: getTodayQT,
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data ? false : 60_000),
  });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['qt_district_summary', currentDistrictId, today],
    queryFn: () => getQTDistrictSummary(currentDistrictId, today),
    enabled: !!currentDistrictId && isLeader,
    refetchInterval: 60_000,
  });

  const [comment, setComment] = useState(qt?.leaderComment ?? '');
  const commentMutation = useMutation({
    mutationFn: () => updateQTLeaderComment(today, comment),
    onSuccess: () => toast.success('코멘트가 저장되었습니다.'),
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  const completedCount = members.filter((m) => m.isCompleted).length;
  const totalCount = members.length;
  const absentRisk = members.filter((m) => {
    if (m.isCompleted) return false;
    if (!m.lastCompleted) return true;
    const last = new Date(m.lastCompleted + 'T00:00:00');
    const t = new Date(today + 'T00:00:00');
    const diffDays = Math.floor((t.getTime() - last.getTime()) / 86400000);
    return diffDays >= 3;
  });

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6 pb-8">
        <div>
          <h1 className="font-display text-2xl font-bold">QT 구역 현황</h1>
          <p className="text-sm text-muted-foreground mt-1">{today} 기준</p>
        </div>

        {/* 집계 카드 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card-elevated p-4 text-center">
            <CheckCircle2 className="w-5 h-5 text-success mx-auto mb-1" />
            <p className="text-2xl font-bold text-success">{completedCount}</p>
            <p className="text-xs text-muted-foreground">완료</p>
          </div>
          <div className="card-elevated p-4 text-center">
            <Circle className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-2xl font-bold">{totalCount - completedCount}</p>
            <p className="text-xs text-muted-foreground">미완료</p>
          </div>
          <div className="card-elevated p-4 text-center">
            <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-1" />
            <p className="text-2xl font-bold text-destructive">{absentRisk.length}</p>
            <p className="text-xs text-muted-foreground">3일↑ 결석</p>
          </div>
        </div>

        {/* 구역원 목록 */}
        <div className="card-elevated p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-muted-foreground" />
            <p className="font-semibold text-sm">구역원 현황</p>
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">불러오는 중...</p>
          ) : (
            <ul className="space-y-2">
              {members.map((m) => {
                const isRisk = absentRisk.some((a) => a.userId === m.userId);
                return (
                  <li
                    key={m.userId}
                    className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                      isRisk ? 'bg-destructive/5 border border-destructive/20' : 'border'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isRisk && <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                      <span className="text-sm font-medium">{m.userName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {m.currentStreak > 0 && (
                        <span className="text-xs text-orange-500 font-semibold">🔥 {m.currentStreak}일</span>
                      )}
                      {m.isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 구역장 코멘트 */}
        <div className="card-elevated p-5 space-y-3">
          <p className="font-semibold text-sm">구역장 코멘트</p>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="내일 07:00 푸시 알림에 포함될 코멘트를 작성하세요 (선택 사항)"
            className="min-h-[100px] resize-none"
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => commentMutation.mutate()}
            disabled={commentMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            저장 → 내일 07:00 발송 포함
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
