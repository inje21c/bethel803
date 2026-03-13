import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Users, BookOpen, MessageSquareHeart, BookMarked,
  CalendarDays, CheckCircle2, Clock, TrendingUp,
  RefreshCw, Edit, Trash2, MessageCircle, Lock, LockOpen,
  UserCheck, UserX, Plus, FileText, Copy, Download, Link, ShieldCheck, Shield
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import {
  getPrayerRequests,
  getSharedPrayerRequests,
  updatePrayerRequest,
  getSchedules,
  getAllUsers,
  approveUser,
  rejectUser,
  changeUserRole,
  getAllBibleStudies,
  createBibleStudy,
  updateBibleStudy,
  deleteBibleStudy,
  getAllBibleReadingSummaries,
  getAccessInfo,
  getWeeklyReports,
  triggerWeeklyClose,
  unlockWeeklyReport,
  getISOWeekNumber,
  parseBulletin,
} from '@/lib/api';
import type { FullUser, BibleReadingSummary, AccessInfo, WeeklyReport } from '@/lib/api';
import type { BibleStudy } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import KakaoNoticeGenerator from '@/components/KakaoNoticeGenerator';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';


function exportCSV(rows: (string | number)[][], filename: string) {
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getThisWeekStart(): string {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dayOfWeek = kstNow.getUTCDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(kstNow);
  monday.setUTCDate(kstNow.getUTCDate() - daysFromMonday);
  return monday.toISOString().slice(0, 10);
}

function BibleStudyForm({
  study,
  onSave,
  onClose,
}: {
  study?: BibleStudy;
  onSave: (payload: {
    weekNumber: number;
    date: string;
    title: string;
    scripture: string;
    introduction: string;
    questions: string[];
    published: boolean;
  }) => void;
  onClose: () => void;
}) {
  const [weekNumber, setWeekNumber] = useState(study?.weekNumber?.toString() || '');
  const [date, setDate] = useState(study?.date || '');
  const [title, setTitle] = useState(study?.title || '');
  const [scripture, setScripture] = useState(study?.scripture || '');
  const [introduction, setIntroduction] = useState(study?.introduction || '');
  const [questionsText, setQuestionsText] = useState((study?.questions || []).join('\n'));
  const [published, setPublished] = useState(Boolean(study));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedWeek = Number.parseInt(weekNumber, 10);
    const questions = questionsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!parsedWeek || !date || !title.trim() || !scripture.trim() || questions.length === 0) {
      toast.error('주차, 날짜, 제목, 본문, 질문 1개 이상을 입력해주세요.');
      return;
    }

    onSave({
      weekNumber: parsedWeek,
      date,
      title: title.trim(),
      scripture: scripture.trim(),
      introduction: introduction.trim(),
      questions,
      published,
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="study-week">주차</Label>
          <Input
            id="study-week"
            type="number"
            min="1"
            value={weekNumber}
            onChange={(e) => setWeekNumber(e.target.value)}
            placeholder="예: 11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="study-date">날짜</Label>
          <Input
            id="study-date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              if (e.target.value && !study) {
                setWeekNumber(String(getISOWeekNumber(e.target.value)));
              }
            }}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="study-title">제목</Label>
        <Input
          id="study-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="성경공부 제목"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="study-scripture">본문</Label>
        <Input
          id="study-scripture"
          value={scripture}
          onChange={(e) => setScripture(e.target.value)}
          placeholder="예: 요한복음 3:16-21"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="study-introduction">도입문</Label>
        <Textarea
          id="study-introduction"
          value={introduction}
          onChange={(e) => setIntroduction(e.target.value)}
          rows={4}
          placeholder="공부 도입문"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="study-questions">질문 목록</Label>
        <Textarea
          id="study-questions"
          value={questionsText}
          onChange={(e) => setQuestionsText(e.target.value)}
          rows={6}
          placeholder="질문을 한 줄에 하나씩 입력하세요"
        />
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

export default function AdminDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [studyDialogOpen, setStudyDialogOpen] = useState(false);
  const [editingStudy, setEditingStudy] = useState<BibleStudy | undefined>();
  const [bulletinUrl, setBulletinUrl] = useState('');
  const [parsingBulletin, setParsingBulletin] = useState(false);

  const { data: prayers = [] } = useQuery({
    queryKey: ['shared_prayer_requests'],
    queryFn: getSharedPrayerRequests,
    enabled: activeTab === 'overview' || activeTab === 'prayer',
  });

  const navigate = useNavigate();

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules'],
    queryFn: getSchedules,
    enabled: activeTab === 'overview' || activeTab === 'schedule',
  });

  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['all_users'],
    queryFn: getAllUsers,
    enabled: activeTab === 'overview' || activeTab === 'members',
  });

  const { data: bibleStudies = [], isLoading: studiesLoading } = useQuery({
    queryKey: ['all_bible_studies'],
    queryFn: getAllBibleStudies,
    enabled: activeTab === 'overview' || activeTab === 'study',
  });

  const { data: readingSummaries = [] } = useQuery({
    queryKey: ['all_reading_summaries'],
    queryFn: getAllBibleReadingSummaries,
    enabled: activeTab === 'overview' || activeTab === 'bible',
  });

  const { data: accessInfo = [] } = useQuery({
    queryKey: ['access_info'],
    queryFn: getAccessInfo,
    enabled: activeTab === 'access',
  });

  const { data: weeklyReports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['weekly_reports'],
    queryFn: getWeeklyReports,
    enabled: activeTab === 'report',
  });

  const weeklyCloseMutation = useMutation({
    mutationFn: (weekStart?: string) => triggerWeeklyClose(weekStart),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly_reports'] });
      toast.success('이번 주 마감이 완료되었습니다.');
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as Record<string, unknown>).message)
          : JSON.stringify(err);
      toast.error(`마감 실패: ${msg}`);
    },
  });

  const weeklyUnlockMutation = useMutation({
    mutationFn: (weekStart: string) => unlockWeeklyReport(weekStart),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly_reports'] });
      toast.success('마감이 해제되었습니다. 구역원 데이터 입력이 가능합니다.');
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as Record<string, unknown>).message)
          : JSON.stringify(err);
      toast.error(`마감 해제 실패: ${msg}`);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (userId: string) => approveUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_users'] });
      toast.success('구역원을 승인했습니다.');
    },
    onError: () => toast.error('승인에 실패했습니다.'),
  });

  const rejectMutation = useMutation({
    mutationFn: (userId: string) => rejectUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_users'] });
      toast.success('구역원 요청을 거절했습니다.');
    },
    onError: () => toast.error('거절에 실패했습니다.'),
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'leader' | 'member' }) =>
      changeUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_users'] });
      toast.success('역할이 변경되었습니다.');
    },
    onError: () => toast.error('역할 변경에 실패했습니다.'),
  });

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
    onError: () => toast.error('성경공부 자료 삭제에 실패했습니다.'),
  });

  // Redirect if not leader
  if (user?.role !== 'leader') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">구역장만 접근할 수 있는 페이지입니다.</p>
        </div>
      </AppLayout>
    );
  }

  const activePrayerRequests = prayers.filter(p => !p.answered).length;
  const pendingUsers = allUsers.filter((u: FullUser) => u.status === 'pending');
  const activeUsers = allUsers.filter((u: FullUser) => u.status === 'active');
  const publishedStudies = bibleStudies.filter((study) => study.published);

  const handleSaveStudy = (payload: {
    weekNumber: number;
    date: string;
    title: string;
    scripture: string;
    introduction: string;
    questions: string[];
    published: boolean;
  }) => {
    if (editingStudy) {
      updateStudyMutation.mutate({ id: editingStudy.id, ...payload });
    } else {
      createStudyMutation.mutate(payload);
    }
    setEditingStudy(undefined);
  };

  const handleEditStudy = (study: BibleStudy) => {
    setEditingStudy(study);
    setStudyDialogOpen(true);
  };

  const handleTogglePublish = (study: BibleStudy, published: boolean) => {
    updateStudyMutation.mutate({
      id: study.id,
      weekNumber: study.weekNumber,
      date: study.date,
      title: study.title,
      scripture: study.scripture,
      introduction: study.introduction,
      questions: study.questions,
      published,
    });
  };

  const handleParseBulletin = async (manualUrl?: string) => {
    setParsingBulletin(true);
    try {
      const result = await parseBulletin(manualUrl || undefined);
      toast.success(`주보 파싱 완료: "${result.title}" — 검토 후 발행하세요.`);
      queryClient.invalidateQueries({ queryKey: ['all_bible_studies'] });
      setBulletinUrl('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '파싱 실패';
      toast.error(`파싱 오류: ${msg}`);
    } finally {
      setParsingBulletin(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">관리자 대시보드</h1>
            <p className="text-muted-foreground text-sm">구역 운영 현황을 한눈에 확인하세요</p>
          </div>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(), 'yyyy.MM.dd HH:mm', { locale: ko })}
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex flex-wrap gap-1 h-auto">
            <TabsTrigger value="overview" className="text-xs px-2 py-1.5">
              <BarChart3 className="w-3 h-3 mr-1" />
              대시보드
            </TabsTrigger>
            <TabsTrigger value="members" className="text-xs px-2 py-1.5">
              <Users className="w-3 h-3 mr-1" />
              구역원 관리
              {pendingUsers.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
                  {pendingUsers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="access" className="text-xs px-2 py-1.5">
              <TrendingUp className="w-3 h-3 mr-1" />
              접속현황
            </TabsTrigger>
            <TabsTrigger value="study" className="text-xs px-2 py-1.5">
              <BookOpen className="w-3 h-3 mr-1" />
              성경공부
            </TabsTrigger>
            <TabsTrigger value="prayer" className="text-xs px-2 py-1.5">
              <MessageSquareHeart className="w-3 h-3 mr-1" />
              기도제목
            </TabsTrigger>
            <TabsTrigger value="bible" className="text-xs px-2 py-1.5">
              <BookMarked className="w-3 h-3 mr-1" />
              성경읽기
            </TabsTrigger>
            <TabsTrigger value="schedule" className="text-xs px-2 py-1.5">
              <CalendarDays className="w-3 h-3 mr-1" />
              일정관리
            </TabsTrigger>
            <TabsTrigger value="report" className="text-xs px-2 py-1.5">
              <FileText className="w-3 h-3 mr-1" />
              주간보고
            </TabsTrigger>
            <TabsTrigger value="kakao" className="text-xs px-2 py-1.5">
              <MessageCircle className="w-3 h-3 mr-1" />
              공지생성
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">전체 구역원</CardDescription>
                    <CardTitle className="text-2xl">{activeUsers.length}명</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      승인 대기: {pendingUsers.length}명
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">활성 기도제목</CardDescription>
                    <CardTitle className="text-2xl text-primary">{activePrayerRequests}건</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      응답된 기도: {prayers.filter(p => p.answered).length}건
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">예정 일정</CardDescription>
                    <CardTitle className="text-2xl">
                      {schedules.filter(s => new Date(s.date) >= new Date()).length}건
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      전체 일정: {schedules.length}건
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">서비스 상태</CardDescription>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span className="text-green-600">정상</span>
                    </CardTitle>
                  </CardHeader>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* Members Management Tab */}
          <TabsContent value="members" className="space-y-4">
            {/* Pending Approval */}
            {pendingUsers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    승인 대기 중
                    <Badge variant="destructive" className="ml-1">{pendingUsers.length}명</Badge>
                  </CardTitle>
                  <CardDescription>가입 요청한 구역원을 승인하거나 거절하세요</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>이름</TableHead>
                        <TableHead>가입 신청일</TableHead>
                        <TableHead className="text-right">처리</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingUsers.map((u: FullUser) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{u.createdAt}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                className="gap-1 bg-green-600 hover:bg-green-700 text-white h-7"
                                onClick={() => approveMutation.mutate(u.id)}
                                disabled={approveMutation.isPending}
                              >
                                <UserCheck className="w-3 h-3" />
                                승인
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="gap-1 h-7"
                                onClick={() => rejectMutation.mutate(u.id)}
                                disabled={rejectMutation.isPending}
                              >
                                <UserX className="w-3 h-3" />
                                거절
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

            {/* Active Members */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">활성 구역원</CardTitle>
                <CardDescription>현재 활성화된 구역원 목록</CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>이름</TableHead>
                        <TableHead>역할</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>가입일</TableHead>
                        <TableHead className="text-right">역할변경</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeUsers.map((u: FullUser) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.name}</TableCell>
                          <TableCell>
                            {u.role === 'leader' ? (
                              <Badge variant="default" className="text-xs">구역장</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">구역원</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-500/10 text-green-600 text-xs">활성</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{u.createdAt}</TableCell>
                          <TableCell className="text-right">
                            {u.id !== user?.id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1"
                                disabled={changeRoleMutation.isPending}
                                onClick={() => changeRoleMutation.mutate({
                                  userId: u.id,
                                  role: u.role === 'leader' ? 'member' : 'leader',
                                })}
                              >
                                {u.role === 'leader'
                                  ? <><Shield className="w-3 h-3" /> 구역원으로</>
                                  : <><ShieldCheck className="w-3 h-3" /> 구역장으로</>
                                }
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {activeUsers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                            활성 구역원이 없습니다.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Access Logs Tab */}
          <TabsContent value="access" className="space-y-4">
            {(() => {
              const today = new Date().toISOString().slice(0, 10);
              const loggedInToday = accessInfo.filter((a: AccessInfo) =>
                a.lastLoginAt && a.lastLoginAt.slice(0, 10) === today
              ).length;
              return (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">전체 구역원</CardDescription>
                      <CardTitle className="text-2xl flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        {activeUsers.length}명
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">오늘 접속자</CardDescription>
                      <CardTitle className="text-2xl flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        {loggedInToday}명
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">서비스 상태</CardDescription>
                      <CardTitle className="text-2xl flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="text-green-600">정상</span>
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>
              );
            })()}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">구역원 최근 접속</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>마지막 접속</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessInfo.map((a: AccessInfo) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.lastLoginAt
                            ? format(new Date(a.lastLoginAt), 'MM/dd HH:mm', { locale: ko })
                            : '접속 기록 없음'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {accessInfo.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                          접속 기록이 없습니다.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bible Study Management Tab */}
          <TabsContent value="study" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    스크래핑 상태
                  </CardTitle>
                  <CardDescription>자동 수집 전에도 관리자 수동 등록으로 테스트할 수 있습니다.</CardDescription>
                </div>
                <Dialog
                  open={studyDialogOpen}
                  onOpenChange={(open) => {
                    setStudyDialogOpen(open);
                    if (!open) setEditingStudy(undefined);
                  }}
                >
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5">
                      <Plus className="w-4 h-4" />
                      공부 등록
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{editingStudy ? '성경공부 수정' : '성경공부 등록'}</DialogTitle>
                    </DialogHeader>
                    <BibleStudyForm
                      study={editingStudy}
                      onSave={handleSaveStudy}
                      onClose={() => {
                        setStudyDialogOpen(false);
                        setEditingStudy(undefined);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 자동 파싱 (이번 주 일요일 URL 자동 계산) */}
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm font-medium">이번 주 주보 자동 파싱</p>
                    <p className="text-xs text-muted-foreground">bethel.or.kr 주보 PDF 자동 다운로드 → GPT-4o 파싱</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleParseBulletin()}
                    disabled={parsingBulletin}
                  >
                    {parsingBulletin ? (
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3 mr-1" />
                    )}
                    자동 파싱
                  </Button>
                </div>

                {/* 수동 URL 입력 */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">PDF URL 직접 입력</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="http://bethel.or.kr/wp-content/uploads/2026/03/weekly260308.pdf"
                      value={bulletinUrl}
                      onChange={(e) => setBulletinUrl(e.target.value)}
                      className="text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleParseBulletin(bulletinUrl)}
                      disabled={parsingBulletin || !bulletinUrl.trim()}
                    >
                      <Link className="w-3 h-3 mr-1" />
                      파싱
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  CRON: 매주 일요일 20:00 KST 자동 실행 | 등록된 공부: {bibleStudies.length}개 (발행: {bibleStudies.filter(s => s.published).length}개)
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">전체 공부 자료</CardDescription>
                  <CardTitle className="text-2xl">{bibleStudies.length}개</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">발행된 자료</CardDescription>
                  <CardTitle className="text-2xl">{publishedStudies.length}개</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">성경공부 자료 관리</CardTitle>
                <CardDescription>리더가 직접 공부 자료를 만들고 발행 상태를 조정합니다.</CardDescription>
              </CardHeader>
              <CardContent>
                {studiesLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>주차</TableHead>
                        <TableHead>제목</TableHead>
                        <TableHead>날짜</TableHead>
                        <TableHead>질문 수</TableHead>
                        <TableHead>발행</TableHead>
                        <TableHead className="text-right">관리</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bibleStudies.map((study) => (
                        <TableRow key={study.id}>
                          <TableCell className="font-medium">{study.weekNumber}주차</TableCell>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{study.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{study.scripture}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{study.date}</TableCell>
                          <TableCell>{study.questions.length}개</TableCell>
                          <TableCell>
                            <Switch
                              checked={Boolean(study.published)}
                              onCheckedChange={(checked) => handleTogglePublish(study, checked)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditStudy(study)}>
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => deleteStudyMutation.mutate(study.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {bibleStudies.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                            등록된 성경공부가 없습니다. 우측 상단의 `공부 등록`으로 첫 자료를 만들어 테스트하세요.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Prayer Management Tab */}
          <TabsContent value="prayer" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">공유된 기도제목</CardDescription>
                  <CardTitle className="text-2xl">{prayers.length}건</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">활성 기도제목</CardDescription>
                  <CardTitle className="text-2xl text-primary">{activePrayerRequests}건</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">응답된 기도</CardDescription>
                  <CardTitle className="text-2xl text-green-600">{prayers.filter(p => p.answered).length}건</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">공유된 기도제목 관리</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>작성자</TableHead>
                      <TableHead>기도제목</TableHead>
                      <TableHead>등록일</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>중보기도</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prayers.map((prayer) => (
                      <TableRow
                        key={prayer.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/prayer-requests/${prayer.id}`)}
                      >
                        <TableCell className="font-medium">{prayer.userName}</TableCell>
                        <TableCell className="max-w-xs truncate">{prayer.content}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{prayer.createdAt}</TableCell>
                        <TableCell>
                          {prayer.answered ? (
                            <Badge className="bg-green-500/10 text-green-600 text-xs">응답됨</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">기도중</Badge>
                          )}
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Switch
                            checked={prayer.sharedWithGroup}
                            onCheckedChange={async (checked) => {
                              try {
                                await updatePrayerRequest({ id: prayer.id, sharedWithGroup: checked });
                                queryClient.invalidateQueries({ queryKey: ['shared_prayer_requests'] });
                                toast.success(checked ? '중보기도로 공유되었습니다.' : '중보기도 공유가 해제되었습니다.');
                              } catch {
                                toast.error('변경에 실패했습니다.');
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); navigate(`/prayer-requests/${prayer.id}`); }}>
                            <Edit className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bible Reading Tab */}
          <TabsContent value="bible" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">기록한 구역원</CardDescription>
                  <CardTitle className="text-2xl">{readingSummaries.length}명</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">구역 총 누적</CardDescription>
                  <CardTitle className="text-2xl">
                    {readingSummaries.reduce((sum: number, r: BibleReadingSummary) => sum + r.totalChapters, 0)}장
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* 성경읽기 BarChart */}
            {readingSummaries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">구역원별 읽기 현황 차트</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={readingSummaries.map(r => ({ name: r.userName, 장수: r.totalChapters }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="장수" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg">구역원별 성경읽기 현황</CardTitle>
                  <CardDescription>2026년 누적 기준 (전체 1189장)</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 shrink-0"
                  onClick={() => exportCSV(
                    [
                      ['이름', '누적 장수', '진행률(%)'],
                      ...readingSummaries.map(r => [r.userName, r.totalChapters, Math.round((r.totalChapters / 1189) * 100)]),
                    ],
                    `성경읽기_${new Date().toISOString().slice(0, 10)}.csv`
                  )}
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead className="text-right">누적 장수</TableHead>
                      <TableHead>진행률</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readingSummaries.map((r: BibleReadingSummary) => (
                      <TableRow key={r.userId}>
                        <TableCell className="font-medium">{r.userName}</TableCell>
                        <TableCell className="text-right font-semibold">{r.totalChapters}장</TableCell>
                        <TableCell className="w-32">
                          <div className="flex items-center gap-2">
                            <Progress value={Math.min((r.totalChapters / 1189) * 100, 100)} className="flex-1 h-1.5" />
                            <span className="text-xs text-muted-foreground w-8">
                              {Math.round((r.totalChapters / 1189) * 100)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {readingSummaries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                          아직 성경읽기 기록이 없습니다.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schedule Management Tab */}
          <TabsContent value="schedule" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">전체 일정</CardDescription>
                  <CardTitle className="text-2xl">{schedules.length}건</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">예정 일정</CardDescription>
                  <CardTitle className="text-2xl text-primary">
                    {schedules.filter(s => new Date(s.date) >= new Date()).length}건
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">출석체크 일정</CardDescription>
                  <CardTitle className="text-2xl">
                    {schedules.filter(s => s.attendanceCheck).length}건
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">완료된 일정</CardDescription>
                  <CardTitle className="text-2xl text-muted-foreground">
                    {schedules.filter(s => new Date(s.date) < new Date()).length}건
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="text-lg">일정 목록</CardTitle>
                  <CardDescription>등록된 모든 일정</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>제목</TableHead>
                      <TableHead>일시</TableHead>
                      <TableHead>장소</TableHead>
                      <TableHead>출석체크</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((schedule) => (
                      <TableRow key={schedule.id}>
                        <TableCell className="font-medium">{schedule.title}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(schedule.date), 'MM/dd')} {schedule.time}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{schedule.location}</TableCell>
                        <TableCell>
                          {schedule.attendanceCheck ? (
                            <Badge className="bg-green-500/10 text-green-600 text-xs">활성</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">비활성</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Weekly Report Tab */}
          <TabsContent value="report" className="space-y-4">
            {/* 이번 주 마감 상태 */}
            {(() => {
              const thisWeekStart = getThisWeekStart();
              const thisWeekReport = weeklyReports.find(r => r.weekStart === thisWeekStart);
              const isThisWeekLocked = thisWeekReport?.isLocked === true;
              return (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      이번 주 마감 상태
                    </CardTitle>
                    <CardDescription>
                      매주 일요일 11:20 KST 자동 마감 · 수동으로도 즉시 실행 가능
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="text-sm font-medium">
                          {thisWeekStart} ~ {thisWeekStart.slice(0, 8)}{String(Number(thisWeekStart.slice(8)) + 6).padStart(2, '0')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isThisWeekLocked ? '마감 완료 — 데이터 입력이 잠겼습니다.' : '진행 중 — 구역원 데이터 입력 가능'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isThisWeekLocked ? (
                          <Badge className="bg-red-500/10 text-red-600">마감됨</Badge>
                        ) : (
                          <Badge className="bg-green-500/10 text-green-600">진행중</Badge>
                        )}
                        {isThisWeekLocked && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => weeklyUnlockMutation.mutate(thisWeekStart)}
                            disabled={weeklyUnlockMutation.isPending}
                          >
                            <LockOpen className={`w-3 h-3 mr-1 ${weeklyUnlockMutation.isPending ? 'animate-spin' : ''}`} />
                            마감 해제
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={isThisWeekLocked ? 'outline' : 'default'}
                          onClick={() => weeklyCloseMutation.mutate(undefined)}
                          disabled={weeklyCloseMutation.isPending}
                        >
                          <RefreshCw className={`w-3 h-3 mr-1 ${weeklyCloseMutation.isPending ? 'animate-spin' : ''}`} />
                          {isThisWeekLocked ? '재집계' : '즉시 마감'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* 출석 트렌드 차트 */}
            {weeklyReports.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">주간 출석 / 성경읽기 트렌드</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={[...weeklyReports].reverse().slice(-8).map(r => ({
                        week: `${r.weekNumber}주`,
                        출석: r.attendanceCount,
                        성경읽기: r.bibleChaptersTotal,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="출석" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="성경읽기" stroke="#22c55e" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* 보고서 목록 */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg">주간 보고서 목록</CardTitle>
                  <CardDescription>마감 완료된 주차별 집계 결과</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 shrink-0"
                  onClick={() => exportCSV(
                    [
                      ['주차', '시작일', '종료일', '출석인원', '성경읽기(장)', '공부완료', '출석자'],
                      ...weeklyReports.map(r => [r.weekNumber, r.weekStart, r.weekEnd, r.attendanceCount, r.bibleChaptersTotal, r.studyCompletionCount, r.attendanceNames.join('/')]),
                    ],
                    `주간보고_${new Date().toISOString().slice(0, 10)}.csv`
                  )}
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                {reportsLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : weeklyReports.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6 text-sm">
                    아직 마감된 주가 없습니다. '즉시 마감' 버튼으로 테스트해 보세요.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {weeklyReports.map((report: WeeklyReport) => (
                      <div key={report.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold">{report.weekNumber}주차</p>
                            <p className="text-xs text-muted-foreground">{report.weekStart} ~ {report.weekEnd}</p>
                          </div>
                          <Badge variant={report.isLocked ? 'destructive' : 'secondary'} className="text-xs">
                            {report.isLocked ? '마감' : '진행중'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="bg-muted rounded-md p-2">
                            <p className="text-xs text-muted-foreground">출석</p>
                            <p className="font-bold text-lg">{report.attendanceCount}명</p>
                          </div>
                          <div className="bg-muted rounded-md p-2">
                            <p className="text-xs text-muted-foreground">성경읽기</p>
                            <p className="font-bold text-lg">{report.bibleChaptersTotal}장</p>
                          </div>
                          <div className="bg-muted rounded-md p-2">
                            <p className="text-xs text-muted-foreground">공부 완료</p>
                            <p className="font-bold text-lg">{report.studyCompletionCount}명</p>
                          </div>
                        </div>
                        {report.attendanceNames.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            출석: {report.attendanceNames.join(', ')}
                          </p>
                        )}
                        {report.reportText && (
                          <div className="bg-muted/50 rounded-md p-3 relative">
                            <pre className="text-xs whitespace-pre-wrap font-sans">{report.reportText}</pre>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute top-2 right-2 h-6 w-6 p-0"
                              onClick={() => {
                                navigator.clipboard.writeText(report.reportText);
                                toast.success('보고문자가 복사되었습니다.');
                              }}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Kakao Notice Tab */}
          <TabsContent value="kakao" className="space-y-4">
            <KakaoNoticeGenerator />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
