import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, TrendingUp, Lock, Pencil, Trash2, Check, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { getBibleReadingLogs, addBibleReadingLog, updateBibleReadingLog, deleteBibleReadingLog, getCurrentLockStatus, getKSTDateString } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/components/AppLayout';
import { toast } from 'sonner';

export default function BibleReading() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [chapters, setChapters] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editChapters, setEditChapters] = useState('');
  const target = 1189; // 성경 전체 장수

  const { data: readings = [], isLoading } = useQuery({
    queryKey: ['bible_reading_logs', user?.id],
    queryFn: () => getBibleReadingLogs(user!.id),
    enabled: !!user,
  });

  const { data: isLocked = false } = useQuery({
    queryKey: ['lock_status'],
    queryFn: getCurrentLockStatus,
  });

  const totalChapters = readings.reduce((sum, r) => sum + r.chapters, 0);
  const progress = Math.min((totalChapters / target) * 100, 100);

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['bible_reading_logs', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['total_chapters', user?.id] });
  };

  const addMutation = useMutation({
    mutationFn: (num: number) => addBibleReadingLog({
      userId: user!.id,
      date: getKSTDateString(),
      chapters: num,
    }),
    onSuccess: (_, num) => {
      invalidateQueries();
      setChapters('');
      toast.success(`${num}장이 기록되었습니다!`);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '기록에 실패했습니다.';
      toast.error(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: { id: string; chapters: number }) => updateBibleReadingLog(params),
    onSuccess: () => {
      invalidateQueries();
      setEditingId(null);
      toast.success('수정되었습니다.');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '수정에 실패했습니다.';
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBibleReadingLog(id),
    onSuccess: () => {
      invalidateQueries();
      toast.success('삭제되었습니다.');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '삭제에 실패했습니다.';
      toast.error(message);
    },
  });

  const handleAdd = () => {
    const num = parseInt(chapters);
    if (!num || num <= 0) {
      toast.error('읽은 장수를 입력해주세요.');
      return;
    }
    addMutation.mutate(num);
  };

  const handleEditStart = (id: string, currentChapters: number) => {
    setEditingId(id);
    setEditChapters(String(currentChapters));
  };

  const handleEditSave = () => {
    if (!editingId) return;
    const num = parseInt(editChapters);
    if (!num || num <= 0) {
      toast.error('1장 이상 입력해주세요.');
      return;
    }
    updateMutation.mutate({ id: editingId, chapters: num });
  };

  const handleDelete = (id: string) => {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;
    deleteMutation.mutate(id);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <h1 className="font-display text-2xl font-bold">성경읽기</h1>

        {/* Progress */}
        <div className="card-elevated p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-muted-foreground">2026년 누적</p>
              <p className="text-3xl font-bold">{totalChapters}<span className="text-base font-normal text-muted-foreground ml-1">/ {target}장</span></p>
            </div>
            <div className="w-16 h-16 rounded-full border-4 border-muted flex items-center justify-center relative">
              <svg className="absolute inset-0 w-16 h-16 -rotate-90">
                <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--gold))" strokeWidth="4" strokeDasharray={`${progress * 1.76} 176`} strokeLinecap="round" />
              </svg>
              <span className="text-xs font-bold">{Math.round(progress)}%</span>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: 'hsl(var(--gold))' }}
            />
          </div>
        </div>

        {/* Input */}
        <div className="card-elevated p-4">
          <h2 className="font-display font-semibold text-sm mb-3">이번 주 읽은 장수 입력</h2>
          {isLocked ? (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg text-sm">
              <Lock className="w-4 h-4 shrink-0" />
              이번 주 마감이 완료되어 기록을 추가할 수 없습니다.
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                type="number"
                value={chapters}
                onChange={e => setChapters(e.target.value)}
                placeholder="장수 입력"
                min="1"
                className="flex-1"
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <Button onClick={handleAdd} className="gap-1" disabled={addMutation.isPending}>
                <Plus className="w-4 h-4" /> {addMutation.isPending ? '기록 중...' : '기록'}
              </Button>
            </div>
          )}
        </div>

        {/* History */}
        <div className="card-elevated p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-gold" />
            <h2 className="font-display font-semibold text-sm">읽기 기록</h2>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : readings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">아직 기록이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {[...readings].map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">{r.date}</span>
                  {editingId === r.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={editChapters}
                        onChange={e => setEditChapters(e.target.value)}
                        min="1"
                        className="w-20 h-8 text-sm"
                        onKeyDown={e => e.key === 'Enter' && handleEditSave()}
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-600"
                        onClick={handleEditSave}
                        disabled={updateMutation.isPending}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{r.chapters}장</span>
                      {!isLocked && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleEditStart(r.id, r.chapters)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDelete(r.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
