import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookMarked, Plus, TrendingUp } from 'lucide-react';
import { store } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/components/AppLayout';
import { toast } from 'sonner';

export default function BibleReading() {
  const user = store.getUser();
  const [chapters, setChapters] = useState('');
  const readings = store.getReadings().filter(r => r.userId === user?.id);
  const totalChapters = readings.reduce((sum, r) => sum + r.chapters, 0);
  const target = 1189; // 성경 전체 장수
  const progress = Math.min((totalChapters / target) * 100, 100);

  const handleAdd = () => {
    const num = parseInt(chapters);
    if (!num || num <= 0) {
      toast.error('읽은 장수를 입력해주세요.');
      return;
    }
    store.addReading({
      id: Date.now().toString(),
      userId: user?.id || '',
      date: new Date().toISOString().slice(0, 10),
      chapters: num,
    });
    setChapters('');
    toast.success(`${num}장이 기록되었습니다!`);
    // Force re-render
    window.dispatchEvent(new Event('storage'));
  };

  // Group by week
  const weeklyData = readings.reduce((acc, r) => {
    const week = getWeekKey(r.date);
    acc[week] = (acc[week] || 0) + r.chapters;
    return acc;
  }, {} as Record<string, number>);

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
            <Button onClick={handleAdd} className="gap-1">
              <Plus className="w-4 h-4" /> 기록
            </Button>
          </div>
        </div>

        {/* History */}
        <div className="card-elevated p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-gold" />
            <h2 className="font-display font-semibold text-sm">읽기 기록</h2>
          </div>
          {readings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">아직 기록이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {[...readings].reverse().map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">{r.date}</span>
                  <span className="text-sm font-semibold">{r.chapters}장</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function getWeekKey(dateStr: string) {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}
