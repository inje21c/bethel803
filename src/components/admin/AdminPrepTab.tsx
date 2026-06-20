import { lazy, Suspense, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { useChurch } from '@/lib/churchContext';
import { useDistrict } from '@/lib/districtContext';
import {
  getAllBibleStudies, getStudySources, createBibleStudy, createDistrictStudyFromSource,
  updateBibleStudy, deleteBibleStudy, getStudyAnswersForStudy,
  getSchedules, addSchedule, updateSchedule, deleteSchedule,
  parseBulletin,
} from '@/lib/api';
import type { BibleStudy, Schedule, StudySource } from '@/lib/api';
import BibleStudyForm from './BibleStudyForm';
import ScheduleForm from './ScheduleForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, Edit, Trash2, Copy, Download, RefreshCw, Link, Clock,
  MapPin, Users, BookOpen, CalendarDays, MessageCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const KakaoNoticeGenerator = lazy(() => import('@/components/KakaoNoticeGenerator'));

function TabFallback() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function AdminPrepTab() {
  const { user } = useAuth();
  const { hasModule } = useChurch();
  const { currentDistrictId } = useDistrict();
  const queryClient = useQueryClient();

  const [subTab, setSubTab] = useState('study');
  const [studyDialogOpen, setStudyDialogOpen] = useState(false);
  const [editingStudy, setEditingStudy] = useState<BibleStudy | undefined>();
  const [deletingStudyId, setDeletingStudyId] = useState<string | null>(null);
  const [viewAnswersStudy, setViewAnswersStudy] = useState<BibleStudy | undefined>();
  const [bulletinUrl, setBulletinUrl] = useState('');
  const [parsingBulletin, setParsingBulletin] = useState(false);

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | undefined>();
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);

  const { data: bibleStudies = [], isLoading: studiesLoading } = useQuery({
    queryKey: ['all_bible_studies', currentDistrictId],
    queryFn: () => getAllBibleStudies(currentDistrictId),
    enabled: (subTab === 'study') && !!currentDistrictId,
    placeholderData: prev => prev,
  });

  const { data: studySources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ['study_sources'],
    queryFn: getStudySources,
    enabled: subTab === 'study',
    staleTime: 60_000,
    placeholderData: prev => prev,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', currentDistrictId],
    queryFn: () => getSchedules(currentDistrictId),
    enabled: (subTab === 'schedule') && !!currentDistrictId,
    placeholderData: prev => prev,
  });

  const { data: studyAnswers = [], isLoading: answersLoading } = useQuery({
    queryKey: ['study_answers_for_study', viewAnswersStudy?.id, currentDistrictId],
    queryFn: () => getStudyAnswersForStudy(viewAnswersStudy!.id, currentDistrictId),
    enabled: !!viewAnswersStudy && !!currentDistrictId,
  });

  const studyBySourceId = new Map(
    bibleStudies.filter(s => Boolean(s.sourceId)).map(s => [s.sourceId as string, s])
  );

  const createStudyMutation = useMutation({
    mutationFn: createBibleStudy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_bible_studies'] });
      queryClient.invalidateQueries({ queryKey: ['bible_studies'] });
      toast.success('성경공부 자료를 등록했습니다.');
    },
    onError: () => toast.error('성경공부 자료 등록에 실패했습니다.'),
  });

  const updateStudyMutation = useMutation({
    mutationFn: updateBibleStudy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_bible_studies'] });
      queryClient.invalidateQueries({ queryKey: ['bible_studies'] });
      toast.success('성경공부 자료를 수정했습니다.');
    },
    onError: () => toast.error('성경공부 자료 수정에 실패했습니다.'),
  });

  const deleteStudyMutation = useMutation({
    mutationFn: deleteBibleStudy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_bible_studies'] });
      queryClient.invalidateQueries({ queryKey: ['bible_studies'] });
      toast.success('성경공부 자료를 삭제했습니다.');
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  });

  const createFromSourceMutation = useMutation({
    mutationFn: (sourceId: string) => createDistrictStudyFromSource(sourceId, currentDistrictId),
    onSuccess: async (studyId: string) => {
      await queryClient.invalidateQueries({ queryKey: ['all_bible_studies'] });
      const refreshed = await queryClient.fetchQuery({
        queryKey: ['all_bible_studies', currentDistrictId],
        queryFn: () => getAllBibleStudies(currentDistrictId),
      });
      toast.success('내 구역 수정본을 만들었습니다.');
      const created = refreshed.find(s => s.id === studyId);
      if (created) { setEditingStudy(created); setStudyDialogOpen(true); }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : '수정본 생성에 실패했습니다.'),
  });

  const addScheduleMutation = useMutation({
    mutationFn: (data: Omit<Schedule, 'id' | 'createdAt' | 'createdBy'>) =>
      addSchedule({ ...data, createdBy: user!.id, districtId: currentDistrictId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schedules'] }); toast.success('일정이 등록되었습니다.'); },
    onError: () => toast.error('일정 등록에 실패했습니다.'),
  });

  const updateScheduleMutation = useMutation({
    mutationFn: (s: Schedule) => updateSchedule(s),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schedules'] }); toast.success('일정이 수정되었습니다.'); },
    onError: () => toast.error('일정 수정에 실패했습니다.'),
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['schedules'] }); toast.success('일정이 삭제되었습니다.'); },
    onError: () => toast.error('일정 삭제에 실패했습니다.'),
  });

  const handleSaveStudy = (payload: Parameters<typeof createBibleStudy>[0]) => {
    if (editingStudy) {
      updateStudyMutation.mutate({ id: editingStudy.id, ...payload });
    } else {
      createStudyMutation.mutate({ ...payload, districtId: currentDistrictId });
    }
    setEditingStudy(undefined);
  };

  const handleTogglePublish = (study: BibleStudy, published: boolean) => {
    updateStudyMutation.mutate({ id: study.id, weekNumber: study.weekNumber, date: study.date, title: study.title, scripture: study.scripture, introduction: study.introduction, questions: study.questions, published });
  };

  const handleSaveSchedule = (data: Omit<Schedule, 'id' | 'createdAt' | 'createdBy'>) => {
    if (editingSchedule) updateScheduleMutation.mutate({ ...editingSchedule, ...data });
    else addScheduleMutation.mutate(data);
    setEditingSchedule(undefined);
  };

  const handleParseBulletin = async (manualUrl?: string) => {
    setParsingBulletin(true);
    try {
      const result = await parseBulletin(manualUrl || undefined);
      await queryClient.invalidateQueries({ queryKey: ['study_sources'] });
      await queryClient.invalidateQueries({ queryKey: ['all_bible_studies'] });
      toast.success(`주보 원본 등록 완료: "${result.title}" (${result.studyDate})`);
      setBulletinUrl('');
    } catch (err) {
      toast.error(`파싱 오류: ${err instanceof Error ? err.message : '파싱 실패'}`);
    } finally {
      setParsingBulletin(false);
    }
  };

  return (
    <div className="space-y-5">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="w-full">
          <TabsTrigger value="study" className="flex-1 gap-1.5 text-[13px]">
            <BookOpen className="w-3.5 h-3.5" />성경공부
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex-1 gap-1.5 text-[13px]">
            <CalendarDays className="w-3.5 h-3.5" />일정
          </TabsTrigger>
          <TabsTrigger value="kakao" className="flex-1 gap-1.5 text-[13px]">
            <MessageCircle className="w-3.5 h-3.5" />공지 생성
          </TabsTrigger>
        </TabsList>

        {/* 성경공부 */}
        <TabsContent value="study" className="space-y-4 mt-4">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            이번 주 성경공부 자료를 등록하고 발행하세요.
            발행 스위치를 켜야 구역원에게 노출됩니다.
          </p>

          <div className="flex justify-end">
            <Dialog open={studyDialogOpen} onOpenChange={open => { setStudyDialogOpen(open); if (!open) setEditingStudy(undefined); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="w-4 h-4" />공부 등록</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingStudy ? '성경공부 수정' : '성경공부 등록'}</DialogTitle>
                  <DialogDescription className="sr-only">성경공부 자료를 등록하거나 수정합니다.</DialogDescription>
                </DialogHeader>
                <BibleStudyForm
                  study={editingStudy}
                  onSave={handleSaveStudy}
                  onClose={() => { setStudyDialogOpen(false); setEditingStudy(undefined); }}
                />
              </DialogContent>
            </Dialog>
          </div>

          {/* 주보 파싱 (legacy/trial 플랜) */}
          {hasModule('bulletin_parsing') && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" />주보 자동 파싱</CardTitle>
                <CardDescription className="text-xs">주보 PDF 링크를 입력하면 AI가 본문과 질문을 자동 추출합니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm font-medium">이번 주 주보 자동 파싱</p>
                    <p className="text-xs text-muted-foreground">bethel.or.kr 주보 PDF 자동 다운로드</p>
                  </div>
                  <Button size="sm" onClick={() => handleParseBulletin()} disabled={parsingBulletin}>
                    {parsingBulletin ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                    자동 파싱
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="PDF URL 직접 입력"
                    value={bulletinUrl}
                    onChange={e => setBulletinUrl(e.target.value)}
                    className="text-xs"
                  />
                  <Button size="sm" variant="outline" onClick={() => handleParseBulletin(bulletinUrl)} disabled={parsingBulletin || !bulletinUrl.trim()}>
                    <Link className="w-3 h-3 mr-1" />파싱
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 주보 원본 목록 */}
          {hasModule('bulletin_parsing') && studySources.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">주보 파싱 원본</CardTitle>
                <CardDescription className="text-xs">원본을 바탕으로 내 구역 수정본을 만들고 발행하세요.</CardDescription>
              </CardHeader>
              <CardContent>
                {sourcesLoading ? <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>주차</TableHead>
                        <TableHead>제목</TableHead>
                        <TableHead>내 구역 상태</TableHead>
                        <TableHead className="text-right">관리</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studySources.map((source: StudySource) => {
                        const districtStudy = studyBySourceId.get(source.id);
                        return (
                          <TableRow key={source.id}>
                            <TableCell className="font-medium text-sm">{source.weekNumber}주차</TableCell>
                            <TableCell>
                              <p className="font-medium text-sm truncate max-w-[160px]">{source.title}</p>
                              <p className="text-xs text-muted-foreground">{source.date}</p>
                            </TableCell>
                            <TableCell>
                              {districtStudy
                                ? <Badge variant={districtStudy.published ? 'default' : 'secondary'} className="text-xs">{districtStudy.published ? '발행됨' : '수정본 있음'}</Badge>
                                : <Badge variant="outline" className="text-xs">없음</Badge>
                              }
                            </TableCell>
                            <TableCell className="text-right">
                              {districtStudy ? (
                                <Button size="sm" variant="outline" onClick={() => { setEditingStudy(districtStudy); setStudyDialogOpen(true); }}>
                                  <Edit className="w-3 h-3 mr-1" />수정
                                </Button>
                              ) : (
                                <Button size="sm" onClick={() => createFromSourceMutation.mutate(source.id)} disabled={createFromSourceMutation.isPending}>
                                  <Copy className="w-3 h-3 mr-1" />수정본 만들기
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* 등록된 자료 목록 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">등록된 성경공부 자료</CardTitle>
            </CardHeader>
            <CardContent>
              {studiesLoading ? (
                <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : bibleStudies.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-6">등록된 성경공부가 없습니다.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>주차</TableHead>
                      <TableHead>제목</TableHead>
                      <TableHead>발행</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bibleStudies.map(study => (
                      <TableRow key={study.id}>
                        <TableCell className="font-medium text-sm">{study.weekNumber}주차</TableCell>
                        <TableCell>
                          <p className="font-medium text-sm truncate max-w-[140px]">{study.title}</p>
                          <p className="text-xs text-muted-foreground">{study.date}</p>
                        </TableCell>
                        <TableCell>
                          <Switch checked={Boolean(study.published)} onCheckedChange={checked => handleTogglePublish(study, checked)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="답변 현황" onClick={() => setViewAnswersStudy(study)}>
                              <Users className="w-3 h-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingStudy(study); setStudyDialogOpen(true); }}>
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeletingStudyId(study.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* 삭제 확인 */}
          <AlertDialog open={!!deletingStudyId} onOpenChange={open => { if (!open) setDeletingStudyId(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>성경공부 자료를 삭제할까요?</AlertDialogTitle>
                <AlertDialogDescription>삭제하면 구역원 답변도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => { if (deletingStudyId) { deleteStudyMutation.mutate(deletingStudyId); setDeletingStudyId(null); } }}>삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* 답변 현황 다이얼로그 */}
          <Dialog open={!!viewAnswersStudy} onOpenChange={open => { if (!open) setViewAnswersStudy(undefined); }}>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>답변 현황 — {viewAnswersStudy?.weekNumber}주차 {viewAnswersStudy?.title}</DialogTitle>
                <DialogDescription className="sr-only">구역원별 답변 현황</DialogDescription>
              </DialogHeader>
              {answersLoading ? (
                <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : studyAnswers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">아직 제출된 답변이 없습니다.</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">완료 {studyAnswers.filter(a => a.completed).length}명 / 전체 {studyAnswers.length}명</p>
                  {studyAnswers.map(answer => (
                    <div key={answer.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{answer.userName}</span>
                        {answer.completed
                          ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">완료</span>
                          : <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">임시저장</span>
                        }
                        <span className="text-xs text-muted-foreground ml-auto">{answer.updatedAt.slice(0, 10)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* 일정 */}
        <TabsContent value="schedule" className="space-y-4 mt-4">
          <p className="text-[13px] text-muted-foreground">
            구역 모임, 예배, 행사 등의 일정을 등록하세요. 구역원 홈 화면에 바로 표시됩니다.
          </p>
          <div className="flex justify-end">
            <Dialog open={scheduleDialogOpen} onOpenChange={open => { setScheduleDialogOpen(open); if (!open) setEditingSchedule(undefined); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="w-4 h-4" />일정 등록</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingSchedule ? '일정 수정' : '새 일정 등록'}</DialogTitle>
                  <DialogDescription className="sr-only">일정 정보를 입력합니다.</DialogDescription>
                </DialogHeader>
                <ScheduleForm
                  schedule={editingSchedule}
                  onSave={handleSaveSchedule}
                  onClose={() => { setScheduleDialogOpen(false); setEditingSchedule(undefined); }}
                />
              </DialogContent>
            </Dialog>
          </div>

          {schedules.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              등록된 일정이 없습니다.
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>일정</TableHead>
                      <TableHead>일시</TableHead>
                      <TableHead>출석</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map(s => (
                      <TableRow key={s.id} className={new Date(s.date) < new Date() ? 'opacity-50' : ''}>
                        <TableCell>
                          <p className="font-medium text-sm">{s.title}</p>
                          {s.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</p>}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            {format(new Date(s.date), 'MM/dd')} {s.time}
                          </div>
                        </TableCell>
                        <TableCell>
                          {s.attendanceCheck
                            ? <Badge className="bg-green-500/10 text-green-600 text-xs">활성</Badge>
                            : <Badge variant="secondary" className="text-xs">-</Badge>
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingSchedule(s); setScheduleDialogOpen(true); }}>
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeletingScheduleId(s.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <AlertDialog open={!!deletingScheduleId} onOpenChange={open => { if (!open) setDeletingScheduleId(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>일정 삭제</AlertDialogTitle>
                <AlertDialogDescription>이 일정을 삭제하시겠습니까?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => { if (deletingScheduleId) { deleteScheduleMutation.mutate(deletingScheduleId); setDeletingScheduleId(null); } }}>삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        {/* 공지 생성 */}
        <TabsContent value="kakao" className="space-y-4 mt-4">
          <p className="text-[13px] text-muted-foreground">
            모임 일정과 성경공부 진도를 요약한 공지 문자를 자동으로 만들어 줍니다. 복사해서 카카오톡에 붙여넣기 하세요.
          </p>
          <Suspense fallback={<TabFallback />}>
            <KakaoNoticeGenerator />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
