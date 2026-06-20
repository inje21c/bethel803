import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { Schedule } from '@/lib/api';

interface Props {
  schedule?: Schedule;
  onSave: (s: Omit<Schedule, 'id' | 'createdAt' | 'createdBy'>) => void;
  onClose: () => void;
}

export default function ScheduleForm({ schedule, onSave, onClose }: Props) {
  const [title, setTitle] = useState(schedule?.title || '');
  const [date, setDate] = useState(schedule?.date || '');
  const [time, setTime] = useState(schedule?.time || '');
  const [location, setLocation] = useState(schedule?.location || '');
  const [memo, setMemo] = useState(schedule?.memo || '');
  const [attendanceCheck, setAttendanceCheck] = useState(schedule?.attendanceCheck ?? false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    onSave({ title: title.trim(), date, time, location: location.trim(), memo: memo.trim(), attendanceCheck, attachment: '' });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="s-title">제목 *</Label>
        <Input id="s-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="일정 제목" maxLength={100} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="s-date">일자 *</Label>
          <Input id="s-date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-time">시간</Label>
          <Input id="s-time" type="time" value={time} onChange={e => setTime(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="s-location">장소</Label>
        <Input id="s-location" value={location} onChange={e => setLocation(e.target.value)} placeholder="장소 입력" maxLength={200} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="s-memo">메모</Label>
        <Textarea id="s-memo" value={memo} onChange={e => setMemo(e.target.value)} placeholder="추가 안내사항" maxLength={500} rows={3} />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="s-attendance" className="cursor-pointer">참석여부 조사</Label>
        <Switch id="s-attendance" checked={attendanceCheck} onCheckedChange={setAttendanceCheck} />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">취소</Button>
        <Button type="submit" className="flex-1">저장</Button>
      </div>
    </form>
  );
}
