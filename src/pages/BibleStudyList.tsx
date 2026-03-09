import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, CheckCircle2, Circle } from 'lucide-react';
import { store, mockStudies } from '@/lib/store';
import AppLayout from '@/components/AppLayout';

export default function BibleStudyList() {
  const answers = store.getAnswers();

  return (
    <AppLayout>
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">구역성경공부</h1>
        <p className="text-sm text-muted-foreground">주보에 수록된 구역성경공부 자료를 확인하고 스스로 공부하세요.</p>

        <div className="space-y-3">
          {mockStudies.map((study, i) => {
            const answer = answers.find(a => a.studyId === study.id);
            const completed = answer?.completed ?? false;
            return (
              <motion.div
                key={study.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
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
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
