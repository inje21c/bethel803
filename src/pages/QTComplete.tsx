import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Home, Flame } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { getMyStreak, getQTCalendar, getKSTDateString } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';

export default function QTComplete() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = getKSTDateString(new Date());
  const [year, month] = today.split('-').map(Number);

  const { data: streak } = useQuery({
    queryKey: ['streak', user?.id],
    queryFn: () => getMyStreak(user!.id),
    enabled: !!user?.id,
  });

  const { data: calendarDays = [] } = useQuery({
    queryKey: ['qt_calendar', user?.id, year, month],
    queryFn: () => getQTCalendar(user!.id, year, month),
    enabled: !!user?.id,
  });

  const completedSet = new Set(calendarDays.map((d) => d.date));

  const lastDay = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const completedCount = completedSet.size;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6 pb-8">
        {/* 완료 배너 */}
        <div className="rounded-2xl bg-success/10 border border-success/20 p-6 text-center space-y-2">
          <div className="text-4xl">🎉</div>
          <h1 className="font-display text-2xl font-bold text-success">오늘 QT 완료!</h1>
          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
            {(streak?.currentStreak ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-orange-500 font-semibold">
                <Flame className="w-4 h-4" />
                {streak!.currentStreak}일 연속
              </span>
            )}
            <span>이번 달 {completedCount}/{lastDay}일</span>
          </div>
        </div>

        {/* 월별 캘린더 */}
        <div className="card-elevated p-5">
          <p className="text-sm font-semibold mb-4">
            {year}년 {month}월
          </p>
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
              <div key={d} className="text-[11px] text-muted-foreground font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: lastDay }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === today;
              const isFuture = dateStr > today;
              const done = completedSet.has(dateStr);

              let cls = 'text-xs rounded-lg p-1.5 text-center ';
              if (isFuture) {
                cls += 'text-muted-foreground/40 cursor-default';
              } else if (done) {
                cls += 'bg-success/15 text-success font-semibold cursor-pointer hover:bg-success/25';
                if (isToday) cls += ' ring-2 ring-success';
              } else {
                cls += 'bg-destructive/10 text-destructive/70 cursor-pointer hover:bg-destructive/20';
                if (isToday) cls += ' ring-2 ring-destructive';
              }

              return (
                <button
                  key={dateStr}
                  disabled={isFuture}
                  className={cls}
                  onClick={() => !isFuture && navigate(isToday ? '/qt' : `/qt/${dateStr}`)}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={() => navigate('/dashboard')}>
          <Home className="w-4 h-4 mr-2" />
          홈으로
        </Button>
      </div>
    </AppLayout>
  );
}
