import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, MessageCircleQuestion, Heart, Flag, ChevronLeft, ChevronRight, Plus, CheckCircle2, X, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/authContext';
import {
  getTodayQT,
  getDeepMeditation,
  generateDeepMeditationAI,
  createDeepMeditation,
  updateDeepMeditation,
  deleteDeepMeditation,
  getKSTDateString,
} from '@/lib/api';
import type { DeepMeditation } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const STEP_INFO: Record<string, { no: number; icon: typeof Search; label: string }> = {
  OBSERVING: { no: 1, icon: Search, label: '내용관찰' },
  ADDING_QUESTIONS: { no: 2, icon: MessageCircleQuestion, label: '연구와 묵상' },
  ANSWERING: { no: 2, icon: MessageCircleQuestion, label: '연구와 묵상' },
  FEELING: { no: 3, icon: Heart, label: '느낌' },
  DECIDING: { no: 4, icon: Flag, label: '결단과 적용' },
};

export default function QTDeepMeditation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = getKSTDateString(new Date());

  const { data: qt, isLoading: qtLoading } = useQuery({
    queryKey: ['qt_content', today],
    queryFn: getTodayQT,
    staleTime: 1000 * 60 * 30,
  });

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['deep_meditation', user?.id, today],
    queryFn: () => getDeepMeditation(user!.id, today),
    enabled: !!user?.id,
  });

  const [observation, setObservation] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [feelings, setFeelings] = useState('');
  const [decision, setDecision] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);

  // 단계 이동(앞/뒤) 시 저장된 값을 입력칸에 복원
  useEffect(() => {
    if (!session) return;
    setObservation(session.observation ?? '');
    setFeelings(session.feelings ?? '');
    setDecision(session.decision ?? '');
    setAnswer(session.answers[session.currentQIndex] ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.state, session?.currentQIndex]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['deep_meditation', user?.id, today] });

  const startMutation = useMutation({
    mutationFn: async () => {
      const ai = await generateDeepMeditationAI(today, {
        summary: qt?.summary ?? null,
        scriptureText: qt?.scriptureText ?? null,
        deepSummary: qt?.deepSummary ?? null,
        deepQuestions: qt?.deepQuestions ?? null,
      });
      return createDeepMeditation({
        userId: user!.id,
        date: today,
        aiSummary: ai.summary,
        questions: ai.questions.map(text => ({ text, source: 'ai' as const })),
      });
    },
    onSuccess: invalidate,
    onError: () => toast.error('묵상 시작에 실패했습니다. 다시 시도해주세요.'),
  });

  const updateMutation = useMutation({
    mutationFn: (patch: Parameters<typeof updateDeepMeditation>[1]) =>
      updateDeepMeditation(session!.id, patch),
    onSuccess: invalidate,
    onError: () => toast.error('저장에 실패했습니다. 다시 시도해주세요.'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => deleteDeepMeditation(session!.id),
    onSuccess: () => {
      setCancelOpen(false);
      invalidate();
      toast.success('묵상을 취소했습니다.');
    },
    onError: () => toast.error('취소에 실패했습니다.'),
  });

  const busy = startMutation.isPending || updateMutation.isPending;

  // 이전 단계로 (입력값은 useEffect가 저장본으로 복원)
  const goBack = () => {
    if (!session || busy) return;
    switch (session.state) {
      case 'ADDING_QUESTIONS':
        updateMutation.mutate({ state: 'OBSERVING' });
        break;
      case 'ANSWERING':
        if (session.currentQIndex > 0) {
          updateMutation.mutate({ currentQIndex: session.currentQIndex - 1 });
        } else {
          updateMutation.mutate({ state: 'ADDING_QUESTIONS' });
        }
        break;
      case 'FEELING':
        if (session.questions.length > 0 && session.currentQIndex >= session.questions.length) {
          updateMutation.mutate({ state: 'ANSWERING', currentQIndex: session.questions.length - 1 });
        } else {
          updateMutation.mutate({ state: 'ADDING_QUESTIONS' });
        }
        break;
      case 'DECIDING':
        updateMutation.mutate({ state: 'FEELING' });
        break;
    }
  };

  const BackButton = () =>
    session && session.state !== 'OBSERVING' ? (
      <Button variant="ghost" size="icon" className="shrink-0" disabled={busy} onClick={goBack} aria-label="이전 단계">
        <ChevronLeft className="w-4 h-4" />
      </Button>
    ) : null;

  if (qtLoading || sessionLoading) {
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
          <p className="font-semibold">오늘의 QT이 아직 준비되지 않았습니다.</p>
          <Button variant="outline" onClick={() => navigate('/qt')}>QT로 돌아가기</Button>
        </div>
      </AppLayout>
    );
  }

  const step = session ? STEP_INFO[session.state] : null;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5 pb-8">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{qt.scripture}</p>
            <h1 className="font-display text-2xl font-bold mt-0.5">깊은 묵상</h1>
          </div>
          {session && session.state !== 'DONE' && (
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setCancelOpen(true)}>
              <X className="w-3.5 h-3.5 mr-1" /> 취소
            </Button>
          )}
        </div>

        {/* 단계 표시 */}
        {session && session.state !== 'DONE' && step && (
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map(n => (
              <div
                key={n}
                className={`h-1.5 flex-1 rounded-full ${n <= step.no ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
            <span className="text-xs text-muted-foreground shrink-0">{step.no}/4 {step.label}</span>
          </div>
        )}

        {/* 세션 없음: 시작 화면 */}
        {!session && (
          <div className="card-elevated p-6 space-y-4 text-center">
            <Search className="w-10 h-10 text-primary mx-auto" />
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold">4단계 깊은 묵상</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                내용관찰 → 연구와 묵상 → 느낌 → 결단과 적용<br />
                AI가 본문 요약과 묵상 질문을 준비해드립니다.
              </p>
            </div>
            <Button className="w-full" disabled={busy} onClick={() => startMutation.mutate()}>
              {startMutation.isPending ? 'AI가 요약과 질문을 준비하는 중...' : '깊은 묵상 시작'}
            </Button>
            <Button variant="ghost" className="w-full text-xs" onClick={() => navigate('/qt')}>
              QT로 돌아가기
            </Button>
          </div>
        )}

        {/* 1단계: 내용관찰 */}
        {session?.state === 'OBSERVING' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-primary/5 border border-primary/10 p-5">
              <p className="text-xs text-primary font-semibold mb-2">본문 요약</p>
              <p className="text-sm leading-relaxed whitespace-pre-line">{session.aiSummary}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">본문을 천천히 읽고, 눈에 들어온 사실·인물·사건을 적어보세요.</p>
              <Textarea
                value={observation}
                onChange={e => setObservation(e.target.value)}
                placeholder="직접 관찰한 내용 (건너뛰어도 됩니다)"
                className="min-h-[120px] resize-none"
              />
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1"
                disabled={busy}
                onClick={() => updateMutation.mutate({ observation: observation.trim() || null, state: 'ADDING_QUESTIONS' })}
              >
                다음 <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => updateMutation.mutate({ observation: null, state: 'ADDING_QUESTIONS' })}
              >
                건너뛰기
              </Button>
            </div>
          </div>
        )}

        {/* 2단계: 질문 목록 + 추가 */}
        {session?.state === 'ADDING_QUESTIONS' && (
          <div className="space-y-4">
            <p className="text-sm font-medium">오늘의 묵상 질문입니다. 나만의 질문을 추가할 수도 있습니다.</p>
            <div className="space-y-2">
              {session.questions.map((q, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border bg-background p-3">
                  <span className="text-xs font-semibold text-primary shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-sm flex-1 leading-relaxed">{q.text}</p>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {q.source === 'ai' ? 'AI' : '내 질문'}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newQuestion}
                onChange={e => setNewQuestion(e.target.value)}
                placeholder="추가할 질문을 입력하세요"
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={busy || !newQuestion.trim()}
                onClick={() => {
                  updateMutation.mutate({
                    questions: [...session.questions, { text: newQuestion.trim(), source: 'user' }],
                  });
                  setNewQuestion('');
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex gap-3">
              <BackButton />
              <Button
                className="flex-1"
                disabled={busy || session.questions.length === 0}
                onClick={() => updateMutation.mutate({ state: 'ANSWERING', currentQIndex: 0 })}
              >
                답변 시작 <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => updateMutation.mutate({ state: 'FEELING' })}
              >
                질문 건너뛰기
              </Button>
            </div>
          </div>
        )}

        {/* 2단계: 답변 */}
        {session?.state === 'ANSWERING' && session.currentQIndex < session.questions.length && (
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/50 p-5 space-y-1">
              <p className="text-xs text-muted-foreground font-semibold">
                질문 {session.currentQIndex + 1} / {session.questions.length}
              </p>
              <p className="font-medium leading-relaxed">
                {session.questions[session.currentQIndex].text}
              </p>
            </div>
            <Textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="답변을 적어보세요"
              className="min-h-[120px] resize-none"
            />
            <div className="flex gap-3">
              <BackButton />
              <Button
                className="flex-1"
                disabled={busy}
                onClick={() => {
                  const answers = [...session.answers];
                  answers[session.currentQIndex] = answer.trim();
                  const nextIndex = session.currentQIndex + 1;
                  updateMutation.mutate(
                    nextIndex >= session.questions.length
                      ? { answers, currentQIndex: nextIndex, state: 'FEELING' }
                      : { answers, currentQIndex: nextIndex }
                  );
                  setAnswer('');
                }}
              >
                다음 <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  const answers = [...session.answers];
                  answers[session.currentQIndex] = '';
                  const nextIndex = session.currentQIndex + 1;
                  updateMutation.mutate(
                    nextIndex >= session.questions.length
                      ? { answers, currentQIndex: nextIndex, state: 'FEELING' }
                      : { answers, currentQIndex: nextIndex }
                  );
                  setAnswer('');
                }}
              >
                건너뛰기
              </Button>
            </div>
          </div>
        )}

        {/* 3단계: 느낌 */}
        {session?.state === 'FEELING' && (
          <div className="space-y-4">
            <p className="text-sm font-medium">말씀을 묵상하며 받은 느낌과 은혜를 자유롭게 적어보세요.</p>
            <Textarea
              value={feelings}
              onChange={e => setFeelings(e.target.value)}
              placeholder="마음에 와닿은 것, 감사한 것, 회개할 것..."
              className="min-h-[140px] resize-none"
            />
            <div className="flex gap-3">
              <BackButton />
              <Button
                className="flex-1"
                disabled={busy}
                onClick={() => updateMutation.mutate({ feelings: feelings.trim() || null, state: 'DECIDING' })}
              >
                다음 <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => updateMutation.mutate({ feelings: null, state: 'DECIDING' })}
              >
                건너뛰기
              </Button>
            </div>
          </div>
        )}

        {/* 4단계: 결단과 적용 */}
        {session?.state === 'DECIDING' && (
          <div className="space-y-4">
            <p className="text-sm font-medium">오늘 실천할 결단을 한 줄에 하나씩 적어보세요.</p>
            <Textarea
              value={decision}
              onChange={e => setDecision(e.target.value)}
              placeholder={'예)\n출근길에 오늘 본문 한 번 더 읽기\n동료에게 따뜻한 말 한마디 하기'}
              className="min-h-[140px] resize-none"
            />
            <div className="flex gap-3">
              <BackButton />
              <Button
                className="flex-1"
                disabled={busy}
                onClick={() => updateMutation.mutate({ decision: decision.trim() || null, state: 'DONE' })}
              >
                묵상 완료 <CheckCircle2 className="w-4 h-4 ml-1" />
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => updateMutation.mutate({ decision: null, state: 'DONE' })}
              >
                건너뛰기
              </Button>
            </div>
          </div>
        )}

        {/* 완료: 기록 보기 */}
        {session?.state === 'DONE' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-success/10 border border-success/20 p-4">
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              <p className="text-sm font-semibold text-success">묵상이 완료되었습니다</p>
            </div>

            <div className="rounded-xl bg-primary/5 border border-primary/10 p-5">
              <p className="text-xs text-primary font-semibold mb-2">본문 요약</p>
              <p className="text-sm leading-relaxed whitespace-pre-line">{session.aiSummary}</p>
            </div>

            {session.observation && (
              <RecordSection icon={Search} title="내용관찰">
                <p className="text-sm leading-relaxed whitespace-pre-line">{session.observation}</p>
              </RecordSection>
            )}

            {session.questions.some((_, i) => (session.answers[i] ?? '').trim()) && (
              <RecordSection icon={MessageCircleQuestion} title="연구와 묵상">
                <div className="space-y-3">
                  {session.questions.map((q, i) => {
                    const a = (session.answers[i] ?? '').trim();
                    if (!a) return null;
                    return (
                      <div key={i} className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Q. {q.text}</p>
                        <p className="text-sm leading-relaxed whitespace-pre-line">{a}</p>
                      </div>
                    );
                  })}
                </div>
              </RecordSection>
            )}

            {session.feelings && (
              <RecordSection icon={Heart} title="느낌">
                <p className="text-sm leading-relaxed whitespace-pre-line">{session.feelings}</p>
              </RecordSection>
            )}

            {session.decision && (
              <RecordSection icon={Flag} title="결단과 적용">
                <ul className="space-y-1">
                  {session.decision.split('\n').filter(line => line.trim()).map((line, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-primary mt-0.5">•</span>
                      <span className="leading-relaxed">{line.trim()}</span>
                    </li>
                  ))}
                </ul>
              </RecordSection>
            )}

            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => navigate('/qt/pray')}>
                기도하기 <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              <Button variant="outline" onClick={() => navigate('/qt')}>
                QT로 돌아가기
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              disabled={busy}
              onClick={() => updateMutation.mutate({ state: 'OBSERVING' })}
            >
              <Pencil className="w-3 h-3 mr-1" /> 기록 수정하기 (작성한 내용은 유지됩니다)
            </Button>
          </div>
        )}

        {/* 취소 확인 */}
        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>묵상을 취소할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                지금까지 작성한 내용이 모두 삭제됩니다. 오늘 다시 시작할 수 있습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>계속 진행</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => cancelMutation.mutate()}
              >
                취소하고 삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

function RecordSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Search;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-elevated p-5">
      <p className="text-xs text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {title}
      </p>
      {children}
    </div>
  );
}
