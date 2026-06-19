import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Save, Lock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { useDistrict } from '@/lib/districtContext';
import { getBibleStudies, getStudyAnswer, saveStudyAnswer, getCurrentLockStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/components/AppLayout';
import { toast } from 'sonner';

export default function BibleStudyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentDistrictId } = useDistrict();
  const queryClient = useQueryClient();

  const { data: studies = [], isLoading: studiesLoading } = useQuery({
    queryKey: ['bible_studies', currentDistrictId],
    queryFn: () => getBibleStudies(currentDistrictId),
    enabled: !!currentDistrictId,
  });

  const study = studies.find(s => s.id === id);

  const { data: savedAnswer } = useQuery({
    queryKey: ['study_answer', id, user?.id],
    queryFn: () => getStudyAnswer(id!, user!.id),
    enabled: !!id && !!user,
  });

  const { data: isLocked = false } = useQuery({
    queryKey: ['lock_status', currentDistrictId],
    queryFn: () => getCurrentLockStatus(currentDistrictId),
    enabled: !!currentDistrictId,
  });

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [completed, setCompleted] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const prevAnswersRef = useRef<Record<number, string>>({});
  const initialLoadRef = useRef(true);

  useEffect(() => {
    if (savedAnswer) {
      setAnswers(savedAnswer.answers);
      setCompleted(savedAnswer.completed);
      prevAnswersRef.current = { ...savedAnswer.answers };
      initialLoadRef.current = true;
    }
  }, [savedAnswer]);

  // Auto-save debounce (3s)
  useEffect(() => {
    if (!user || !id) return;
    if (Object.keys(answers).length === 0) return;
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    if (JSON.stringify(answers) === JSON.stringify(prevAnswersRef.current)) return;

    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      prevAnswersRef.current = { ...answers };
      saveStudyAnswer({
        studyId: id,
        userId: user.id,
        userName: user.name,
        answers,
        completed,
      }).then(() => {
        setAutoSaved(true);
        setTimeout(() => setAutoSaved(false), 2000);
        queryClient.invalidateQueries({ queryKey: ['study_answer', id, user.id] });
        queryClient.invalidateQueries({ queryKey: ['my_study_completions', user.id] });
      }).catch(() => {});
    }, 3000);

    return () => clearTimeout(autoSaveTimerRef.current);
  }, [answers]);

  const saveMutation = useMutation({
    mutationFn: (markCompleted: boolean) => saveStudyAnswer({
      studyId: id!,
      userId: user!.id,
      userName: user!.name,
      answers,
      completed: markCompleted,
    }),
    onSuccess: (_, markCompleted) => {
      if (markCompleted) setCompleted(true);
      queryClient.invalidateQueries({ queryKey: ['study_answer', id, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['my_study_completions', user?.id] });
      if (isLocked) {
        toast.success('마감 후 수정이 저장되었습니다.');
      } else {
        toast.success(markCompleted ? '성경공부를 완료했습니다!' : '임시 저장되었습니다.');
      }
    },
    onError: () => {
      toast.error('저장에 실패했습니다. 다시 시도해주세요.');
    },
  });

  if (studiesLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!study) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <button onClick={() => navigate('/bible-study')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> 목록으로
          </button>
          <p className="text-sm text-muted-foreground text-center py-8">성경공부를 찾을 수 없습니다.</p>
        </div>
      </AppLayout>
    );
  }

  const handleSave = (markCompleted: boolean) => {
    if (!user) return;
    saveMutation.mutate(markCompleted);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <button onClick={() => navigate('/bible-study')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> 목록으로
        </button>

        <div className="card-elevated p-6 space-y-5">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="gold-badge">{study.weekNumber}주차</span>
              <span className="text-xs text-muted-foreground">{study.date}</span>
              {completed && <CheckCircle2 className="w-4 h-4 text-success ml-auto" />}
            </div>
            <h1 className="font-display text-xl font-bold mt-2">{study.title}</h1>
            <p className="text-sm text-primary font-medium mt-1">{study.scripture}</p>
          </div>

          {/* Introduction */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h2 className="font-display font-semibold text-sm mb-2">이끄는 말</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{study.introduction}</p>
          </div>

          {isLocked && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg text-sm">
              <Lock className="w-4 h-4 shrink-0" />
              이번 주 마감이 완료되었습니다. 답변은 계속 수정할 수 있습니다.
            </div>
          )}

          {/* Questions */}
          <div className="space-y-4">
            <h2 className="font-display font-semibold text-sm">토의사항</h2>
            {(study.questions as string[]).map((q, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="space-y-2"
              >
                <p className="text-sm font-medium">
                  <span className="text-primary font-bold mr-1">{i + 1}.</span>
                  {q}
                </p>
                <Textarea
                  value={answers[i] || ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                  placeholder="나의 답변을 작성하세요..."
                  className="text-sm min-h-[80px] resize-none"
                />
              </motion.div>
            ))}
          </div>

          <div className="space-y-2">
            {autoSaved && (
              <p className="text-xs text-muted-foreground text-center animate-in fade-in duration-300">자동 저장됨</p>
            )}
            {completed ? (
              <Button onClick={() => handleSave(true)} className="w-full gap-2" disabled={saveMutation.isPending}>
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? '저장 중...' : '수정 저장'}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleSave(false)} className="flex-1 gap-2" disabled={saveMutation.isPending}>
                  <Save className="w-4 h-4" />
                  임시 저장
                </Button>
                <Button onClick={() => handleSave(true)} className="flex-1 gap-2" disabled={saveMutation.isPending}>
                  <CheckCircle2 className="w-4 h-4" />
                  {saveMutation.isPending ? '저장 중...' : '완료로 저장'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
