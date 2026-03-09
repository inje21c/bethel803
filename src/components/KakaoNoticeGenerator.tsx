import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { mockStudies } from '@/lib/store';

interface NoticeFields {
  date: string;
  time: string;
  location: string;
  studyTitle: string;
  scripture: string;
  memo: string;
}

export default function KakaoNoticeGenerator() {
  const latestStudy = mockStudies[0];
  const [fields, setFields] = useState<NoticeFields>({
    date: '',
    time: '20:00',
    location: '',
    studyTitle: latestStudy?.title ?? '',
    scripture: latestStudy?.scripture ?? '',
    memo: '',
  });
  const [copied, setCopied] = useState(false);

  const set = (key: keyof NoticeFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields(prev => ({ ...prev, [key]: e.target.value }));

  const generateMessage = () => {
    const lines: string[] = [];
    lines.push('📢 [구역예배 공지]');
    lines.push('');
    if (fields.date) lines.push(`📅 일시: ${fields.date} ${fields.time}`);
    if (fields.location) lines.push(`📍 장소: ${fields.location}`);
    if (fields.studyTitle) lines.push(`📖 공부: ${fields.studyTitle}`);
    if (fields.scripture) lines.push(`   (${fields.scripture})`);
    if (fields.memo) {
      lines.push('');
      lines.push(fields.memo);
    }
    lines.push('');
    lines.push('함께 은혜 받는 시간 되시길 바랍니다 🙏');
    return lines.join('\n');
  };

  const handleCopy = async () => {
    const message = generateMessage();
    await navigator.clipboard.writeText(message);
    setCopied(true);
    toast.success('클립보드에 복사되었습니다!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">카카오톡 공지 생성</CardTitle>
        <CardDescription>내용을 입력하면 공지 메시지가 자동으로 만들어집니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="notice-date" className="text-xs">예배 날짜</Label>
            <Input id="notice-date" type="date" value={fields.date} onChange={set('date')} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notice-time" className="text-xs">시간</Label>
            <Input id="notice-time" type="time" value={fields.time} onChange={set('time')} className="text-sm" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notice-location" className="text-xs">장소</Label>
          <Input id="notice-location" placeholder="예: 김성민 집사님 댁" value={fields.location} onChange={set('location')} className="text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="notice-study" className="text-xs">성경공부 제목</Label>
            <Input id="notice-study" value={fields.studyTitle} onChange={set('studyTitle')} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notice-scripture" className="text-xs">본문 구절</Label>
            <Input id="notice-scripture" value={fields.scripture} onChange={set('scripture')} className="text-sm" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notice-memo" className="text-xs">추가 메모 (선택)</Label>
          <Textarea id="notice-memo" placeholder="예: 간단한 교제가 있습니다" value={fields.memo} onChange={set('memo')} className="text-sm min-h-[60px] resize-none" />
        </div>

        {/* Preview */}
        <div className="space-y-1.5">
          <Label className="text-xs">미리보기</Label>
          <pre className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap font-sans leading-relaxed">
            {generateMessage()}
          </pre>
        </div>

        <Button onClick={handleCopy} className="w-full gap-2">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? '복사됨!' : '클립보드에 복사'}
        </Button>
      </CardContent>
    </Card>
  );
}
