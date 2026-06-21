import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { getISOWeekNumber } from '@/lib/api';
import type { BibleStudy } from '@/lib/api';

interface SavePayload {
  weekNumber: number;
  date: string;
  title: string;
  scripture: string;
  introduction: string;
  questions: string[];
  published: boolean;
}

interface Props {
  study?: BibleStudy;
  onSave: (payload: SavePayload) => void;
  onClose: () => void;
}

export default function BibleStudyForm({ study, onSave, onClose }: Props) {
  const [weekNumber, setWeekNumber] = useState(study?.weekNumber?.toString() || '');
  const [date, setDate] = useState(study?.date || '');
  const [title, setTitle] = useState(study?.title || '');
  const [scripture, setScripture] = useState(study?.scripture || '');
  const [introduction, setIntroduction] = useState(study?.introduction || '');
  const [questionsText, setQuestionsText] = useState((study?.questions || []).join('\n'));
  const [published, setPublished] = useState(study?.published ?? false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedWeek = Number.parseInt(weekNumber, 10);
    const questions = questionsText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!parsedWeek || !date || !title.trim() || !scripture.trim() || questions.length === 0) {
      toast.error('주차, 날짜, 제목, 본문, 질문 1개 이상을 입력해주세요.');
      return;
    }
    onSave({ weekNumber: parsedWeek, date, title: title.trim(), scripture: scripture.trim(), introduction: introduction.trim(), questions, published });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="study-week">주차</Label>
          <Input id="study-week" type="number" min="1" value={weekNumber} onChange={e => setWeekNumber(e.target.value)} placeholder="예: 11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="study-date">날짜</Label>
          <Input
            id="study-date"
            type="date"
            value={date}
            onChange={e => {
              setDate(e.target.value);
              if (e.target.value && !study) setWeekNumber(String(getISOWeekNumber(e.target.value)));
            }}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="study-title">제목</Label>
        <Input id="study-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="성경공부 제목" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="study-scripture">본문</Label>
        <Input id="study-scripture" value={scripture} onChange={e => setScripture(e.target.value)} placeholder="예: 요한복음 3:16-21" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="study-intro">도입문</Label>
        <Textarea id="study-intro" value={introduction} onChange={e => setIntroduction(e.target.value)} rows={4} placeholder="공부 도입문" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="study-questions">질문 목록</Label>
        <Textarea id="study-questions" value={questionsText} onChange={e => setQuestionsText(e.target.value)} rows={6} placeholder="질문을 한 줄에 하나씩 입력하세요" />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">즉시 발행</p>
          <p className="text-xs text-muted-foreground">활성화하면 구역원 목록에 바로 노출됩니다.</p>
        </div>
        <Switch checked={published} onCheckedChange={setPublished} />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>취소</Button>
        <Button type="submit" className="flex-1">저장</Button>
      </div>
    </form>
  );
}
