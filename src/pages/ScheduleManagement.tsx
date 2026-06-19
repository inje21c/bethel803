import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Plus, MapPin, Clock, Edit2, Trash2, Users, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { useDistrict } from '@/lib/districtContext';
import { getSchedules, addSchedule, updateSchedule, deleteSchedule, getAttendances, saveAttendance, getAllUsers } from '@/lib/api';
import type { Schedule, Attendance } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import CommunitySubNav from '@/components/CommunitySubNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

function ScheduleForm({ schedule, onSave, onClose }: { schedule?: Schedule; onSave: (s: Omit<Schedule, 'id' | 'createdAt' | 'createdBy'>) => void; onClose: () => void }) {
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
        <Label htmlFor="title">제목 *</Label>
        <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="일정 제목" maxLength={100} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="date">일자 *</Label>
          <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="time">시간</Label>
          <Input id="time" type="time" value={time} onChange={e => setTime(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">장소</Label>
        <Input id="location" value={location} onChange={e => setLocation(e.target.value)} placeholder="장소 입력" maxLength={200} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="memo">메모</Label>
        <Textarea id="memo" value={memo} onChange={e => setMemo(e.target.value)} placeholder="추가 안내사항" maxLength={500} rows={3} />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="attendance" className="cursor-pointer">참석여부 조사</Label>
        <Switch id="attendance" checked={attendanceCheck} onCheckedChange={setAttendanceCheck} />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">취소</Button>
        <Button type="submit" className="flex-1">저장</Button>
      </div>
    </form>
  );
}

function AttendanceStatus({ scheduleId, districtId }: { scheduleId: string; districtId: string }) {
  const { user, isLeader } = useAuth();
  const queryClient = useQueryClient();

  const { data: attendances = [] } = useQuery({
    queryKey: ['attendances', scheduleId],
    queryFn: () => getAttendances(scheduleId),
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ['all_users', districtId],
    queryFn: () => getAllUsers(districtId),
    enabled: isLeader && !!districtId,
  });
  const activeMembers = allMembers.filter(m => m.status === 'active');

  const myAttendance = attendances.find((a: Attendance) => a.userId === user?.id);

  const attendanceMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'attending' | 'absent' }) =>
      saveAttendance({ scheduleId, userId, status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendances', scheduleId] }),
  });

  const attendingCount = attendances.filter((a: Attendance) => a.status === 'attending').length;
  const absentCount = attendances.filter((a: Attendance) => a.status === 'absent').length;

  return (
    <div className="mt-3 pt-3 border-t">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-4 h-4 text-primary" />
        <span className="text-xs font-medium">참석 현황</span>
        <span className="text-xs text-muted-foreground ml-auto">
          참석 {attendingCount} · 불참 {absentCount}
        </span>
      </div>

      {/* 구역원: 내 응답 */}
      {!isLeader && (
        !myAttendance || myAttendance.status === 'pending' ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => attendanceMutation.mutate({ userId: user!.id, status: 'attending' })} disabled={attendanceMutation.isPending}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-success" /> 참석
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => attendanceMutation.mutate({ userId: user!.id, status: 'absent' })} disabled={attendanceMutation.isPending}>
              <XCircle className="w-3.5 h-3.5 mr-1 text-destructive" /> 불참
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${myAttendance.status === 'attending' ? 'text-success' : 'text-destructive'}`}>
              {myAttendance.status === 'attending' ? '✓ 참석으로 응답함' : '✗ 불참으로 응답함'}
            </span>
            <Button size="sm" variant="ghost" className="text-xs ml-auto h-7"
              onClick={() => attendanceMutation.mutate({ userId: user!.id, status: myAttendance.status === 'attending' ? 'absent' : 'attending' })}
              disabled={attendanceMutation.isPending}>
              변경
            </Button>
          </div>
        )
      )}

      {/* 구역장: 전체 구역원 출석 직접 편집 */}
      {isLeader && (
        <div className="mt-1 space-y-0.5">
          {activeMembers.map(member => {
            const att = attendances.find((a: Attendance) => a.userId === member.id);
            const status = att?.status;
            return (
              <button
                key={member.id}
                onClick={() => attendanceMutation.mutate({ userId: member.id, status: status === 'attending' ? 'absent' : 'attending' })}
                disabled={attendanceMutation.isPending}
                className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-muted/50 transition-colors"
              >
                {status === 'attending'
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                  : status === 'absent'
                  ? <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  : <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />}
                <span className={`text-xs ${status === 'attending' ? 'font-medium' : 'text-muted-foreground'}`}>
                  {member.name}
                </span>
                {member.id === user?.id && <span className="text-[10px] text-muted-foreground ml-0.5">(나)</span>}
              </button>
            );
          })}
          {activeMembers.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">구역원이 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ScheduleManagement() {
  const { user, isLeader } = useAuth();
  const { currentDistrictId } = useDistrict();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | undefined>();
  const { toast } = useToast();

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', currentDistrictId],
    queryFn: () => getSchedules(currentDistrictId),
    enabled: !!currentDistrictId,
  });

  const addMutation = useMutation({
    mutationFn: (data: Omit<Schedule, 'id' | 'createdAt' | 'createdBy'>) => addSchedule({
      ...data,
      createdBy: user!.id,
      districtId: currentDistrictId,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({ title: '일정이 등록되었습니다.' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (schedule: Schedule) => updateSchedule(schedule),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({ title: '일정이 수정되었습니다.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({ title: '일정이 삭제되었습니다.', variant: 'destructive' });
    },
  });

  const now = new Date();

  const upcomingSchedules = useMemo(() =>
    schedules
      .filter(s => new Date(s.date) >= new Date(now.toISOString().split('T')[0]))
      .sort((a, b) => a.date.localeCompare(b.date)),
    [schedules]
  );

  const pastSchedules = useMemo(() =>
    schedules
      .filter(s => new Date(s.date) < new Date(now.toISOString().split('T')[0]))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5),
    [schedules]
  );

  const handleSave = (data: Omit<Schedule, 'id' | 'createdAt' | 'createdBy'>) => {
    if (editingSchedule) {
      updateMutation.mutate({ ...editingSchedule, ...data });
    } else {
      addMutation.mutate(data);
    }
    setEditingSchedule(undefined);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setDialogOpen(true);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
  };

  const renderScheduleCard = (schedule: Schedule, isPast = false) => (
    <motion.div key={schedule.id} variants={item} initial="hidden" animate="show" className={`card-elevated p-4 ${isPast ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isPast ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
              {formatDate(schedule.date)}
            </span>
            {schedule.time && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{schedule.time}</span>}
          </div>
          <h3 className="font-semibold text-sm">{schedule.title}</h3>
          {schedule.location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" />{schedule.location}</p>
          )}
          {schedule.memo && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{schedule.memo}</p>
          )}
        </div>
        {isLeader && (
          <div className="flex gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(schedule)}>
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(schedule.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
      {schedule.attendanceCheck && (!isPast || isLeader) && (
        <AttendanceStatus scheduleId={schedule.id} districtId={currentDistrictId} />
      )}
    </motion.div>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <CommunitySubNav />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">주요 일정</h1>
            <p className="text-sm text-muted-foreground mt-1">구역 모임 및 교회 주요 일정을 확인하세요.</p>
          </div>
          {isLeader && (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingSchedule(undefined); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="w-4 h-4" /> 일정 등록
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingSchedule ? '일정 수정' : '새 일정 등록'}</DialogTitle>
                  <DialogDescription className="sr-only">일정 정보를 입력하거나 수정합니다.</DialogDescription>
                </DialogHeader>
                <ScheduleForm schedule={editingSchedule} onSave={handleSave} onClose={() => { setDialogOpen(false); setEditingSchedule(undefined); }} />
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Upcoming */}
        <div>
          <h2 className="font-display font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> 다가오는 일정
          </h2>
          {upcomingSchedules.length === 0 ? (
            <div className="card-elevated p-8 text-center">
              <CalendarDays className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">등록된 예정 일정이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingSchedules.map(s => renderScheduleCard(s))}
            </div>
          )}
        </div>

        {/* Past */}
        {pastSchedules.length > 0 && (
          <div>
            <h2 className="font-display font-semibold text-sm text-muted-foreground mb-3">지난 일정</h2>
            <div className="space-y-3">
              {pastSchedules.map(s => renderScheduleCard(s, true))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
