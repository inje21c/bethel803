import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { getQTByDate, getMyQTResponse, upsertQTResponse, getKSTDateString } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

// AudioPlayer는 QTMain에서 분리 가능하지만 간결함을 위해 여기서도 동일 구현
import { useRef } from 'react';
import { Play, Pause, AlertCircle } from 'lucide-react';

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
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
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
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a?.duration) setProgress(a.currentTime / a.duration);
        }}
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
          <div className="h-1.5 bg-muted rounded-full cursor-pointer overflow-hidden" onClick={handleSeek}>
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{fmt(audioRef.current?.currentTime ?? 0)}</span>
            {duration > 0 && <span>{fmt(duration)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QTDate() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = getKSTDateString(new Date());

  // 오늘이면 /qt로 리다이렉트
  useEffect(() => {
    if (date === today) navigate('/qt', { replace: true });
  }, [date, today, navigate]);

  const [answer, setAnswer] = useState('');

  const { data: qt, isLoading } = useQuery({
    queryKey: ['qt_content', date],
    queryFn: () => getQTByDate(date!),
    enabled: !!date && date !== today,
    staleTime: 1000 * 60 * 60,
  });

  const { data: myResponse } = useQuery({
    queryKey: ['qt_response', qt?.id, user?.id],
    queryFn: () => getMyQTResponse(qt!.id, user!.id),
    enabled: !!qt?.id && !!user?.id,
  });

  useEffect(() => {
    if (myResponse?.answer) setAnswer(myResponse.answer);
  }, [myResponse?.answer]);

  const completeMutation = useMutation({
    mutationFn: () =>
      upsertQTResponse({
        contentId: qt!.id,
        userId: user!.id,
        answer: answer || null,
        isCompleted: true,
        isPastDay: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qt_response', qt?.id] });
      queryClient.invalidateQueries({ queryKey: ['qt_calendar'] });
    },
  });

  const formattedDate = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
    : '';

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!qt) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-10 text-center space-y-3">
          <p className="font-semibold">해당 날짜의 묵상이 없습니다.</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />돌아가기
          </Button>
        </div>
      </AppLayout>
    );
  }

  const alreadyCompleted = myResponse?.isCompleted === true;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6 pb-8">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1"
            >
              <ArrowLeft className="w-4 h-4" />
              돌아가기
            </button>
            <p className="text-sm text-muted-foreground">{formattedDate}</p>
            <h1 className="font-display text-xl font-bold mt-0.5">과거 묵상</h1>
          </div>
          {alreadyCompleted && <Badge className="bg-success/15 text-success border-success/20 shrink-0">완료</Badge>}
        </div>

        {/* 제목 + 구절 */}
        <div className="card-elevated p-5 space-y-1">
          <p className="text-xs text-primary font-semibold uppercase tracking-wide">본문</p>
          {qt.title && <h2 className="font-display text-xl font-bold">{qt.title}</h2>}
          <p className="text-muted-foreground font-medium">{qt.scripture}</p>
        </div>

        {qt.summary && (
          <div className="rounded-xl bg-primary/5 border border-primary/10 p-5">
            <p className="text-xs text-primary font-semibold mb-2">해설 요약</p>
            <p className="text-sm leading-relaxed whitespace-pre-line">{qt.summary}</p>
          </div>
        )}

        {qt.scriptureText && (
          <div className="card-elevated p-5">
            <p className="text-xs text-muted-foreground font-semibold mb-3">성경 본문 (개역개정)</p>
            <p className="text-sm leading-loose whitespace-pre-line text-foreground/90">{qt.scriptureText}</p>
          </div>
        )}

        {qt.audioUrl && <AudioPlayer url={qt.audioUrl} />}

        {qt.question && (
          <div className="rounded-xl bg-muted/50 p-5">
            <p className="text-xs text-muted-foreground font-semibold mb-2">묵상 질문</p>
            <p className="font-medium leading-relaxed">{qt.question}</p>
          </div>
        )}

        {/* 내 답변 */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">내 답변</p>
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="이 날 말씀에서 받은 은혜나 도전을 기록해 보세요 (선택 사항)"
            className="min-h-[120px] resize-none"
            disabled={alreadyCompleted}
          />
        </div>

        {alreadyCompleted ? (
          <div className="rounded-xl bg-success/10 border border-success/20 p-4 text-center">
            <p className="text-success font-semibold text-sm">이 날 묵상을 완료했습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              이 날 묵상 완료하기
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              과거 날짜 완료는 스트릭에 반영되지 않습니다
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
