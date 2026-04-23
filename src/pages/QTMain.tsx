import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Flame, Play, Pause, AlertCircle, ChevronRight, Clock } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { getTodayQT, getMyQTResponse, getMyStreak, upsertQTResponse, getKSTDateString } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function QTMain() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = getKSTDateString(new Date());

  const { data: qt, isLoading: qtLoading } = useQuery({
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

  const { data: streak } = useQuery({
    queryKey: ['streak', user?.id],
    queryFn: () => getMyStreak(user!.id),
    enabled: !!user?.id,
  });

  const [answer, setAnswer] = useState('');
  useEffect(() => {
    if (myResponse?.answer) setAnswer(myResponse.answer);
  }, [myResponse?.answer]);

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertQTResponse({
        contentId: qt!.id,
        userId: user!.id,
        answer: answer || null,
        isCompleted: false,
        isPastDay: false,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qt_response', qt?.id] });
      navigate('/qt/pray');
    },
  });

  const formattedDate = new Date(today + 'T00:00:00').toLocaleDateString('ko-KR', {
    month: 'long', day: 'numeric', weekday: 'short',
  });

  if (qtLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">오늘의 QT을 불러오는 중...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!qt) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-10 text-center space-y-3">
          <Clock className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-semibold">오늘의 QT이 아직 준비되지 않았습니다.</p>
          <p className="text-sm text-muted-foreground">매일 오전 6시에 업데이트됩니다.</p>
        </div>
      </AppLayout>
    );
  }

  const alreadyCompleted = myResponse?.isCompleted === true;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6 pb-8">
        {/* 헤더: 날짜 + 스트릭 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{formattedDate}</p>
            <h1 className="font-display text-2xl font-bold mt-0.5">오늘의 QT</h1>
          </div>
          {(streak?.currentStreak ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-full px-3 py-1.5">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                {streak!.currentStreak}일 연속
              </span>
            </div>
          )}
        </div>

        {/* 제목 + 구절 */}
        <div className="card-elevated p-5 space-y-1">
          <p className="text-xs text-primary font-semibold uppercase tracking-wide">본문</p>
          {qt.title && <h2 className="font-display text-xl font-bold">{qt.title}</h2>}
          <p className="text-muted-foreground font-medium">{qt.scripture}</p>
        </div>

        {/* 해설 듣기 */}
        {qt.audioUrl && <AudioPlayer url={qt.audioUrl} />}

        {/* 해설 요약 */}
        {qt.summary && (
          <div className="rounded-xl bg-primary/5 border border-primary/10 p-5">
            <p className="text-xs text-primary font-semibold mb-2">해설 요약</p>
            <p className="text-sm leading-relaxed whitespace-pre-line">{qt.summary}</p>
          </div>
        )}

        {/* 성경 본문 */}
        {qt.scriptureText && (
          <div className="card-elevated p-5">
            <p className="text-xs text-muted-foreground font-semibold mb-3">성경 본문 (개역개정)</p>
            <p className="text-sm leading-loose whitespace-pre-line text-foreground/90">{qt.scriptureText}</p>
          </div>
        )}

        {/* QT 질문 */}
        {qt.question && (
          <div className="rounded-xl bg-muted/50 p-5">
            <p className="text-xs text-muted-foreground font-semibold mb-2">QT 질문</p>
            <p className="font-medium leading-relaxed">{qt.question}</p>
          </div>
        )}

        {/* 답변 */}
        <div className="space-y-2">
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="오늘 말씀에서 받은 은혜나 도전을 나눠주세요 (선택 사항)"
            className="min-h-[120px] resize-none"
            disabled={alreadyCompleted}
          />
          <p className="text-xs text-muted-foreground">작성하지 않아도 완료할 수 있습니다</p>
        </div>

        {/* 버튼 */}
        {alreadyCompleted ? (
          <div className="flex items-center gap-2 rounded-xl bg-success/10 border border-success/20 p-4">
            <span className="text-success font-semibold text-sm">오늘 QT 완료</span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => navigate('/qt/complete')}>
              완료 화면 보기 <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              기도하기 <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
            >
              나중에
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function AudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [unavailable, setUnavailable] = useState(false);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play().then(() => setPlaying(true)).catch(() => setUnavailable(true)); }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress(audio.currentTime / audio.duration);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * audio.duration;
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  if (unavailable) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
        <p className="text-sm text-destructive">기간이 경과되어 파일이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="card-elevated p-4">
      <p className="text-xs text-muted-foreground font-semibold mb-3">해설 듣기</p>
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => setPlaying(false)}
        onError={() => setUnavailable(true)}
        preload="none"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <div className="flex-1 space-y-1">
          <div
            className="h-1.5 bg-muted rounded-full cursor-pointer overflow-hidden"
            onClick={handleSeek}
          >
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{fmt((audioRef.current?.currentTime) ?? 0)}</span>
            {duration > 0 && <span>{fmt(duration)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
