import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Save } from 'lucide-react';
import { store, mockStudies } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/components/AppLayout';
import { toast } from 'sonner';

export default function BibleStudyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = store.getUser();
  const study = mockStudies.find(s => s.id === id);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!study || !user) return;
    const saved = store.getAnswers(user.id).find(a => a.studyId === study.id);
    if (saved) {
      setAnswers(saved.answers);
      setCompleted(saved.completed);
    }
  }, [study]);

  if (!study) {
    return <AppLayout><p>성경공부를 찾을 수 없습니다.</p></AppLayout>;
  }

  const handleSave = () => {
    if (!user) return;
    store.saveAnswer({ studyId: study.id, userId: user.id, userName: user.name, answers, completed: true });
    setCompleted(true);
    toast.success('성경공부 답변이 저장되었습니다!');
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
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
            <p className="text-sm text-primary font-medium mt-1">📖 {study.scripture}</p>
          </div>

          {/* Introduction */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h2 className="font-display font-semibold text-sm mb-2">이끄는 말</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{study.introduction}</p>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            <h2 className="font-display font-semibold text-sm">토의사항</h2>
            {study.questions.map((q, i) => (
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

          <Button onClick={handleSave} className="w-full gap-2">
            <Save className="w-4 h-4" />
            {completed ? '수정 저장' : '저장하기'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
