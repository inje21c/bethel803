import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Music, ChevronDown, ChevronUp, CheckCircle2, CalendarDays, Home } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { useDistrict } from '@/lib/districtContext';
import {
  getTodayQT,
  getMyQTResponse,
  upsertQTResponse,
  updateQTStreak,
  getGroupPrayerRequests,
  getKSTDateString,
} from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';

const BGM_HIDDEN_KEY = 'qt_bgm_hidden';

export default function QTPray() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentDistrictId } = useDistrict();
  const queryClient = useQueryClient();
  const today = getKSTDateString(new Date());

  const [bgmHidden, setBgmHidden] = useState(() => localStorage.getItem(BGM_HIDDEN_KEY) === '1');

  const { data: qt } = useQuery({
    queryKey: ['qt_content', today],
    queryFn: getTodayQT,
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data ? false : 60_000),
  });

  const { data: myResponse } = useQuery({
    queryKey: ['qt_response', qt?.id, user?.id],
    queryFn: () => getMyQTResponse(qt!.id, user!.id),
    enabled: !!qt?.id && !!user?.id,
  });

  const { data: groupPrayers = [] } = useQuery({
    queryKey: ['group_prayer_requests', 'qt', currentDistrictId],
    queryFn: () => getGroupPrayerRequests(currentDistrictId, { limit: 10 }),
    enabled: !!currentDistrictId,
    staleTime: 1000 * 60 * 5,
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await upsertQTResponse({
        contentId: qt!.id,
        userId: user!.id,
        answer: myResponse?.answer ?? null,
        isCompleted: true,
        isPastDay: false,
      });
      await updateQTStreak(user!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qt_response', qt?.id] });
      queryClient.invalidateQueries({ queryKey: ['streak', user?.id] });
      navigate('/qt/complete');
    },
  });

  const toggleBgm = () => {
    const next = !bgmHidden;
    setBgmHidden(next);
    localStorage.setItem(BGM_HIDDEN_KEY, next ? '1' : '0');
  };

  const hymns = qt?.hymnSuggestions ?? [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">기도하기</h1>
          {qt?.question && (
            <p className="mt-2 text-muted-foreground italic leading-relaxed">"{qt.question}"</p>
          )}
        </div>

        {/* BGM 섹션 */}
        {hymns.length > 0 && (
          <div className="card-elevated p-5">
            <button
              className="w-full flex items-center justify-between"
              onClick={toggleBgm}
            >
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">찬송가 듣기</span>
              </div>
              {bgmHidden
                ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                : <ChevronUp className="w-4 h-4 text-muted-foreground" />
              }
            </button>
            {!bgmHidden && (
              <ul className="mt-4 space-y-2">
                {hymns.map((hymn, i) => (
                  <li key={i}>
                    <a
                      href={hymn.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{hymn.title}</p>
                        <p className="text-xs text-muted-foreground">{hymn.type}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 구역 기도 제목 */}
        {groupPrayers.length > 0 && (
          <div className="card-elevated p-5">
            <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-3">이번 주 구역 기도 제목</p>
            <ul className="space-y-2.5">
              {groupPrayers.map((p) => (
                <li key={p.id} className="flex gap-3 border-l-2 border-accent pl-3 py-0.5">
                  <div className="flex-1">
                    <p className="text-[13px] font-medium text-muted-foreground">{p.userName}</p>
                    <p className="text-[15px] leading-relaxed">{p.content}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 완료 버튼 / 완료 후 이동 */}
        {myResponse?.isCompleted ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-success/10 border border-success/20 p-4">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <p className="text-sm font-semibold text-success">오늘 QT를 이미 완료했습니다</p>
            </div>
            <div className="flex gap-3">
              <Button size="lg" className="flex-1" onClick={() => navigate('/qt/complete')}>
                <CalendarDays className="w-4 h-4 mr-2" />
                완료 기록 보기
              </Button>
              <Button size="lg" variant="outline" className="flex-1" onClick={() => navigate('/dashboard')}>
                <Home className="w-4 h-4 mr-2" />
                홈으로
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="lg"
            className="w-full"
            onClick={() => completeMutation.mutate()}
            disabled={completeMutation.isPending}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />오늘 QT 완료하기
          </Button>
        )}
      </div>
    </AppLayout>
  );
}
