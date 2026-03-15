import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, CheckCircle2, Circle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { getBibleStudies, getMyStudyCompletions } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

function StudyItem({
  study,
  completed,
}: {
  study: { id: string; weekNumber: number; date: string; title: string; scripture: string };
  completed: boolean;
}) {
  return (
    <Link
      to={`/bible-study/${study.id}`}
      className="card-elevated p-4 flex items-center gap-4 group block"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <BookOpen className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{study.weekNumber}주차 · {study.date}</span>
        </div>
        <h3 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
          {study.title}
        </h3>
        <p className="text-xs text-muted-foreground truncate">{study.scripture}</p>
      </div>
      <div className="shrink-0">
        {completed ? (
          <CheckCircle2 className="w-5 h-5 text-success" />
        ) : (
          <Circle className="w-5 h-5 text-muted-foreground/40" />
        )}
      </div>
    </Link>
  );
}

export default function BibleStudyList() {
  const { user } = useAuth();
  const { data: studies = [], isLoading } = useQuery({
    queryKey: ['bible_studies'],
    queryFn: getBibleStudies,
  });

  const { data: completions = {} } = useQuery({
    queryKey: ['my_study_completions', user?.id],
    queryFn: () => getMyStudyCompletions(user!.id),
    enabled: !!user,
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">구역성경공부</h1>
        <p className="text-sm text-muted-foreground">주보에 수록된 구역성경공부 자료를 확인하고 스스로 공부하세요.</p>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {studies.map((study, i) => (
              <motion.div
                key={study.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <StudyItem study={study} completed={completions[study.id] ?? false} />
              </motion.div>
            ))}
            {studies.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">등록된 성경공부가 없습니다.</p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
