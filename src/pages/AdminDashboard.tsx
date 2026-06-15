import { lazy, Suspense, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Users, BookOpen, MessageSquareHeart, BookMarked,
  CalendarDays, CheckCircle2, Clock, TrendingUp,
  RefreshCw, Edit, Trash2, MessageCircle, Lock, LockOpen,
  UserCheck, UserX, Plus, FileText, Copy, Download, Link, ShieldCheck, Shield, ArrowRightLeft,
  BookHeart, Circle, AlertTriangle, Save, Flame, KeyRound
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { useChurch } from '@/lib/churchContext';
import { useDistrict } from '@/lib/districtContext';
import {
  getSharedPrayerRequests,
  updatePrayerRequest,
  getSchedules,
  getAllUsers,
  approveUser,
  rejectUser,
  changeUserRole,
  getAllBibleStudies,
  getStudySources,
  createBibleStudy,
  createDistrictStudyFromSource,
  updateBibleStudy,
  deleteBibleStudy,
  getStudyAnswersForStudy,
  getAllBibleReadingSummaries,
  getBibleReadingSummariesByRange,
  getAccessInfo,
  getWeeklyReports,
  triggerWeeklyClose,
  unlockWeeklyReport,
  getISOWeekNumber,
  parseBulletin,
  changeUserDistrict,
  adminResetUserPassword,
  getDistricts,
  getQTDistrictSummary,
  getTodayQT,
  updateQTLeaderComment,
  getKSTDateString,
  getBibleBooks,
  updateChurchQTSimpleBook,
} from '@/lib/api';
import type { FullUser, BibleReadingSummary, AccessInfo, WeeklyReport, StudySource } from '@/lib/api';
import type { BibleStudy } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const AdminBibleReadingTab = lazy(() => import('@/components/admin/AdminBibleReadingTab'));
const AdminWeeklyReportTab = lazy(() => import('@/components/admin/AdminWeeklyReportTab'));
const KakaoNoticeGenerator = lazy(() => import('@/components/KakaoNoticeGenerator'));

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

function TabFallback() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
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
  const [published, setPublished] = useState(study?.published ?? false);

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
  const { user, isMaster } = useAuth();
  const {
    currentDistrictId,
    currentDistrictName,
    homeDistrictName,
    isViewingOtherDistrict,
  } = useDistrict();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [studyDialogOpen, setStudyDialogOpen] = useState(false);
  const [editingStudy, setEditingStudy] = useState<BibleStudy | undefined>();
  const [deletingStudyId, setDeletingStudyId] = useState<string | null>(null);
  const [viewAnswersStudy, setViewAnswersStudy] = useState<BibleStudy | undefined>();
  const [bulletinUrl, setBulletinUrl] = useState('');
  const [parsingBulletin, setParsingBulletin] = useState(false);
  const [districtChangeTarget, setDistrictChangeTarget] = useState<FullUser | null>(null);
  const [passwordResetTarget, setPasswordResetTarget] = useState<FullUser | null>(null);
  const [resetCustomPassword, setResetCustomPassword] = useState('');
  const [resetResultPassword, setResetResultPassword] = useState('');
  const [readingFrom, setReadingFrom] = useState('');
  const [readingTo, setReadingTo] = useState('');
  const today = getKSTDateString(new Date());
  const [qtComment, setQtComment] = useState('');

  const { data: allDistricts = [] } = useQuery({
    queryKey: ['districts'],
    queryFn: getDistricts,
    enabled: isMaster,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  const { data: prayers = [] } = useQuery({
    queryKey: ['shared_prayer_requests', currentDistrictId],
    queryFn: () => getSharedPrayerRequests(currentDistrictId),
    enabled: (activeTab === 'overview' || activeTab === 'prayer') && !!currentDistrictId,
    placeholderData: (previous) => previous,
  });

  const navigate = useNavigate();

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', currentDistrictId],
    queryFn: () => getSchedules(currentDistrictId),
    enabled: (activeTab === 'overview' || activeTab === 'schedule') && !!currentDistrictId,
    placeholderData: (previous) => previous,
  });

  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['all_users', currentDistrictId],
    queryFn: () => getAllUsers(currentDistrictId),
    enabled: (activeTab === 'overview' || activeTab === 'members') && !!currentDistrictId,
    placeholderData: (previous) => previous,
  });

  const { data: bibleStudies = [], isLoading: studiesLoading } = useQuery({
    queryKey: ['all_bible_studies', currentDistrictId],
    queryFn: () => getAllBibleStudies(currentDistrictId),
    enabled: (activeTab === 'overview' || activeTab === 'study') && !!currentDistrictId,
    placeholderData: (previous) => previous,
  });

  const { data: studySources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ['study_sources'],
    queryFn: getStudySources,
    enabled: activeTab === 'study',
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  const { data: readingSummaries = [] } = useQuery({
    queryKey: ['all_reading_summaries', currentDistrictId],
    queryFn: () => getAllBibleReadingSummaries(currentDistrictId),
    enabled: (activeTab === 'overview' || activeTab === 'bible') && !!currentDistrictId,
    placeholderData: (previous) => previous,
  });

  const hasReadingRange = readingFrom !== '' && readingTo !== '';
  const { data: readingSummariesByRange = [], isFetching: readingRangeFetching } = useQuery({
    queryKey: ['reading_summaries_range', currentDistrictId, readingFrom, readingTo],
    queryFn: () => getBibleReadingSummariesByRange(currentDistrictId, readingFrom, readingTo),
    enabled: (activeTab === 'bible') && !!currentDistrictId && hasReadingRange,
  });

  const displayedReadingSummaries = hasReadingRange ? readingSummariesByRange : readingSummaries;

  const { data: accessInfo = [] } = useQuery({
    queryKey: ['access_info', currentDistrictId],
    queryFn: () => getAccessInfo(currentDistrictId),
    enabled: activeTab === 'access' && !!currentDistrictId,
    placeholderData: (previous) => previous,
  });

  const { data: studyAnswers = [], isLoading: answersLoading } = useQuery({
    queryKey: ['study_answers_for_study', viewAnswersStudy?.id, currentDistrictId],
    queryFn: () => getStudyAnswersForStudy(viewAnswersStudy!.id, currentDistrictId),
    enabled: !!viewAnswersStudy && !!currentDistrictId,
  });

  const { data: weeklyReports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['weekly_reports', currentDistrictId],
    queryFn: () => getWeeklyReports(currentDistrictId),
    enabled: activeTab === 'report' && !!currentDistrictId,
    placeholderData: (previous) => previous,
  });

  const { data: qtContent } = useQuery({
    queryKey: ['qt_content', today],
    queryFn: getTodayQT,
    staleTime: 1000 * 60 * 30,
    enabled: activeTab === 'qt',
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data ? false : 60_000),
  });

  const { settings: churchSettings, hasModule, refresh: refetchChurchSettings } = useChurch();

  const { data: bibleBooks = [] } = useQuery({
    queryKey: ['bible_books'],
    queryFn: getBibleBooks,
    staleTime: Infinity,
    enabled: activeTab === 'qt' && isMaster,
  });

  const updateQTBookMutation = useMutation({
    mutationFn: updateChurchQTSimpleBook,
    onSuccess: () => {
      refetchChurchSettings();
      toast.success('QT 말씀 책이 변경됐습니다.');
    },
    onError: () => toast.error('변경에 실패했습니다.'),
  });

  const { data: qtMembers = [], isLoading: qtMembersLoading } = useQuery({
    queryKey: ['qt_district_summary', currentDistrictId, today],
    queryFn: () => getQTDistrictSummary(currentDistrictId, today),
    enabled: activeTab === 'qt' && !!currentDistrictId,
    refetchInterval: 60_000,
  });

  const qtCommentMutation = useMutation({
    mutationFn: () => updateQTLeaderComment(today, qtComment),
    onSuccess: () => toast.success('코멘트가 저장되었습니다.'),
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  useEffect(() => {
    if (qtContent?.leaderComment) setQtComment(qtContent.leaderComment);
  }, [qtContent?.leaderComment]);

  const weeklyCloseMutation = useMutation({
    mutationFn: (weekStart?: string) => triggerWeeklyClose(weekStart, currentDistrictId),
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
    mutationFn: (weekStart: string) => unlockWeeklyReport(weekStart, currentDistrictId),
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
    mutationFn: ({ userId, role }: { userId: string; role: 'master' | 'leader' | 'member' }) =>
      changeUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_users'] });
      toast.success('역할이 변경되었습니다.');
    },
    onError: () => toast.error('역할 변경에 실패했습니다.'),
  });

  const changeDistrictMutation = useMutation({
    mutationFn: ({ userId, districtId }: { userId: string; districtId: string }) =>
      changeUserDistrict(userId, districtId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_users'] });
      setDistrictChangeTarget(null);
      toast.success('소속 구역이 변경되었습니다.');
    },
    onError: () => toast.error('소속 구역 변경에 실패했습니다.'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword?: string }) =>
      adminResetUserPassword(userId, newPassword),
    onSuccess: (result) => {
      setResetResultPassword(result.tempPassword);
      toast.success('임시 비밀번호가 발급되었습니다.');
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : '비밀번호 초기화에 실패했습니다.';
      toast.error(message);
    },
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

  const createFromSourceMutation = useMutation({
    mutationFn: (sourceId: string) => createDistrictStudyFromSource(sourceId, currentDistrictId),
    onSuccess: async (studyId: string) => {
      await queryClient.invalidateQueries({ queryKey: ['all_bible_studies'] });
      await queryClient.invalidateQueries({ queryKey: ['bible_studies'] });
      const refreshed = await queryClient.fetchQuery({
        queryKey: ['all_bible_studies', currentDistrictId],
        queryFn: () => getAllBibleStudies(currentDistrictId),
      });
      toast.success('내 구역 수정본을 만들었습니다. 이제 내용을 검토하고 발행할 수 있습니다.');
      const createdStudy = refreshed.find((study) => study.id === studyId);
      if (createdStudy) {
        handleEditStudy(createdStudy);
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : '수정본 생성에 실패했습니다.';
      toast.error(msg);
    },
  });

  // Redirect if not leader/master
  if (user?.role !== 'leader' && user?.role !== 'master') {
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
  const studyBySourceId = new Map(
    bibleStudies
      .filter((study) => Boolean(study.sourceId))
      .map((study) => [study.sourceId as string, study])
  );

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
      createStudyMutation.mutate({ ...payload, districtId: currentDistrictId });
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
      await queryClient.invalidateQueries({ queryKey: ['study_sources'] });
      await queryClient.invalidateQueries({ queryKey: ['all_bible_studies'] });
      await queryClient.invalidateQueries({ queryKey: ['bible_studies'] });
      toast.success(`주보 원본 등록 완료: "${result.title}" (${result.studyDate})`);
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
            {format(new Date(), 'yyyy.MM.dd HH:mm')}
          </Badge>
        </div>

        {isViewingOtherDistrict && (
          <Card className="border-amber-200 bg-amber-50/70">
            <CardContent className="py-4 flex flex-col gap-1 text-sm">
              <p className="font-medium text-amber-900">
                현재 작업 구역: {currentDistrictName}
              </p>
              <p className="text-amber-800">
                마스터 권한으로 다른 구역을 보고 있습니다. 내 기본 구역은 {homeDistrictName}입니다.
              </p>
            </CardContent>
          </Card>
        )}

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4 md:grid md:grid-cols-[14rem_minmax(0,1fr)] md:items-start md:gap-6 md:space-y-0"
        >
          <TabsList className="flex flex-wrap gap-1 h-auto md:sticky md:top-24 md:col-start-1 md:flex-col md:items-stretch md:justify-start md:rounded-lg md:border md:bg-card md:p-2 md:shadow-sm">
            <TabsTrigger value="overview" className="text-xs px-2 py-1.5 md:w-full md:justify-start md:px-3 md:py-2 md:text-sm">
              <BarChart3 className="w-3 h-3 mr-1" />
              대시보드
            </TabsTrigger>
            <TabsTrigger value="members" className="text-xs px-2 py-1.5 md:w-full md:justify-start md:px-3 md:py-2 md:text-sm">
              <Users className="w-3 h-3 mr-1" />
              구역원 관리
              {pendingUsers.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
                  {pendingUsers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="access" className="text-xs px-2 py-1.5 md:w-full md:justify-start md:px-3 md:py-2 md:text-sm">
              <TrendingUp className="w-3 h-3 mr-1" />
              접속현황
            </TabsTrigger>
            <TabsTrigger value="study" className="text-xs px-2 py-1.5 md:w-full md:justify-start md:px-3 md:py-2 md:text-sm">
              <BookOpen className="w-3 h-3 mr-1" />
              성경공부
            </TabsTrigger>
            <TabsTrigger value="prayer" className="text-xs px-2 py-1.5 md:w-full md:justify-start md:px-3 md:py-2 md:text-sm">
              <MessageSquareHeart className="w-3 h-3 mr-1" />
              기도제목
            </TabsTrigger>
            <TabsTrigger value="bible" className="text-xs px-2 py-1.5 md:w-full md:justify-start md:px-3 md:py-2 md:text-sm">
              <BookMarked className="w-3 h-3 mr-1" />
              성경읽기
            </TabsTrigger>
            <TabsTrigger value="schedule" className="text-xs px-2 py-1.5 md:w-full md:justify-start md:px-3 md:py-2 md:text-sm">
              <CalendarDays className="w-3 h-3 mr-1" />
              일정관리
            </TabsTrigger>
            <TabsTrigger value="report" className="text-xs px-2 py-1.5 md:w-full md:justify-start md:px-3 md:py-2 md:text-sm">
              <FileText className="w-3 h-3 mr-1" />
              주간보고
            </TabsTrigger>
            <TabsTrigger value="kakao" className="text-xs px-2 py-1.5 md:w-full md:justify-start md:px-3 md:py-2 md:text-sm">
              <MessageCircle className="w-3 h-3 mr-1" />
              공지생성
            </TabsTrigger>
            <TabsTrigger value="qt" className="text-xs px-2 py-1.5 md:w-full md:justify-start md:px-3 md:py-2 md:text-sm">
              <BookHeart className="w-3 h-3 mr-1" />
              QT 현황
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 md:col-start-2 md:mt-0">
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
          <TabsContent value="members" className="space-y-4 md:col-start-2 md:mt-0">
            {/* 초대 링크 */}
            {isMaster && allDistricts.filter(d => d.isActive).length > 0 && (
              <Card>
                <CardHeader className="px-4 py-4 md:px-6 md:py-6">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Link className="w-4 h-4 text-primary" />
                    구성원 초대 링크
                  </CardTitle>
                  <CardDescription className="text-xs">링크를 공유하면 해당 구역으로 바로 가입할 수 있습니다.</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 md:px-6 md:pb-6 space-y-2">
                  {allDistricts.filter(d => d.isActive).map(district => {
                    const inviteUrl = `${window.location.origin}/join?d=${district.id}`;
                    return (
                      <div key={district.id} className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                        <span className="text-sm font-medium min-w-[60px] shrink-0">{district.name}</span>
                        <span className="flex-1 text-xs text-muted-foreground truncate font-mono">{inviteUrl}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(inviteUrl);
                            toast.success(`${district.name} 초대 링크 복사됨`);
                          }}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Pending Approval */}
            {pendingUsers.length > 0 && (
              <Card>
                <CardHeader className="px-4 py-4 md:px-6 md:py-6">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Clock className="w-4 h-4 text-amber-500" />
                    승인 대기 중
                    <Badge variant="destructive" className="ml-1">{pendingUsers.length}명</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">가입 요청한 구역원을 승인하거나 거절하세요</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
                  <div className="space-y-3 md:hidden">
                    {pendingUsers.map((u: FullUser) => (
                      <div key={u.id} className="rounded-lg border bg-background p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">{u.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">신청일 {u.createdAt}</p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-xs">대기</Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            className="h-9 gap-1 bg-green-600 text-white hover:bg-green-700"
                            onClick={() => approveMutation.mutate(u.id)}
                            disabled={approveMutation.isPending}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            승인
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-9 gap-1"
                            onClick={() => rejectMutation.mutate(u.id)}
                            disabled={rejectMutation.isPending}
                          >
                            <UserX className="w-3.5 h-3.5" />
                            거절
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden md:block">
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
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Active Members */}
            <Card>
              <CardHeader className="px-4 py-4 md:px-6 md:py-6">
                <CardTitle className="text-base md:text-lg">활성 구역원</CardTitle>
                <CardDescription className="text-xs md:text-sm">현재 활성화된 구역원 목록</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
                {usersLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 md:hidden">
                      {activeUsers.map((u: FullUser) => (
                        <div key={u.id} className="rounded-lg border bg-background p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium">{u.name}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{u.districtName}</p>
                            </div>
                            {u.role === 'master' ? (
                              <Badge variant="default" className="shrink-0 text-xs">마스터</Badge>
                            ) : u.role === 'leader' ? (
                              <Badge variant="default" className="shrink-0 text-xs">구역장</Badge>
                            ) : (
                              <Badge variant="secondary" className="shrink-0 text-xs">구역원</Badge>
                            )}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">가입일 {u.createdAt}</p>
                          {isMaster && u.id !== user?.id && (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              {u.role !== 'master' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 gap-1 text-xs"
                                  disabled={changeRoleMutation.isPending}
                                  onClick={() => changeRoleMutation.mutate({
                                    userId: u.id,
                                    role: u.role === 'leader' ? 'member' : 'leader',
                                  })}
                                >
                                  {u.role === 'leader'
                                    ? <><Shield className="w-3.5 h-3.5" /> 구역원으로</>
                                    : <><ShieldCheck className="w-3.5 h-3.5" /> 구역장으로</>
                                  }
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 gap-1 text-xs"
                                onClick={() => setDistrictChangeTarget(u)}
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                구역이동
                              </Button>
                              {u.role !== 'master' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 gap-1 text-xs"
                                  onClick={() => {
                                    setResetCustomPassword('');
                                    setResetResultPassword('');
                                    setPasswordResetTarget(u);
                                  }}
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                  비밀번호 초기화
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {activeUsers.length === 0 && (
                        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                          활성 구역원이 없습니다.
                        </p>
                      )}
                    </div>

                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>이름</TableHead>
                            <TableHead>역할</TableHead>
                            <TableHead>소속 구역</TableHead>
                            <TableHead>가입일</TableHead>
                            <TableHead className="text-right">관리</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeUsers.map((u: FullUser) => (
                            <TableRow key={u.id}>
                              <TableCell className="font-medium">{u.name}</TableCell>
                              <TableCell>
                                {u.role === 'master' ? (
                                  <Badge variant="default" className="text-xs">마스터</Badge>
                                ) : u.role === 'leader' ? (
                                  <Badge variant="default" className="text-xs">구역장</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">구역원</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{u.districtName}</span>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{u.createdAt}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  {isMaster && u.id !== user?.id && u.role !== 'master' && (
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
                                  {isMaster && u.id !== user?.id && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => setDistrictChangeTarget(u)}
                                    >
                                      <ArrowRightLeft className="w-3 h-3" /> 구역이동
                                    </Button>
                                  )}
                                  {isMaster && u.id !== user?.id && u.role !== 'master' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => {
                                        setResetCustomPassword('');
                                        setResetResultPassword('');
                                        setPasswordResetTarget(u);
                                      }}
                                    >
                                      <KeyRound className="w-3 h-3" /> 비밀번호
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {activeUsers.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                                활성 구역원이 없습니다.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* District Change Dialog */}
            <Dialog open={!!districtChangeTarget} onOpenChange={() => setDistrictChangeTarget(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>소속 구역 변경</DialogTitle>
                  <DialogDescription>
                    <span className="font-semibold">{districtChangeTarget?.name}</span>님의 소속 구역을 변경합니다.
                    <br />현재 소속: <span className="font-semibold">{districtChangeTarget?.districtName}</span>
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <Label>변경할 구역</Label>
                  <Select
                    onValueChange={(districtId) => {
                      if (districtChangeTarget) {
                        changeDistrictMutation.mutate({ userId: districtChangeTarget.id, districtId });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="구역을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {allDistricts
                        .filter(d => d.isActive && d.id !== districtChangeTarget?.districtId)
                        .map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>
              </DialogContent>
            </Dialog>

            {/* Password Reset Dialog */}
            <Dialog
              open={!!passwordResetTarget}
              onOpenChange={(open) => {
                if (!open) {
                  setPasswordResetTarget(null);
                  setResetCustomPassword('');
                  setResetResultPassword('');
                }
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>비밀번호 초기화</DialogTitle>
                  <DialogDescription>
                    <span className="font-semibold">{passwordResetTarget?.name}</span>님의 비밀번호를
                    임시 비밀번호로 초기화합니다.
                  </DialogDescription>
                </DialogHeader>
                {resetResultPassword ? (
                  <div className="space-y-3 pt-2">
                    <p className="text-sm">임시 비밀번호가 발급되었습니다. 본인에게 안전하게 전달해주세요.</p>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={resetResultPassword} className="font-mono text-base" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-1"
                        onClick={() => {
                          navigator.clipboard.writeText(resetResultPassword)
                            .then(() => toast.success('복사되었습니다.'))
                            .catch(() => toast.error('복사에 실패했습니다.'));
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" /> 복사
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      로그인 후 프로필에서 비밀번호를 변경하도록 안내해주세요.
                    </p>
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => {
                        setPasswordResetTarget(null);
                        setResetCustomPassword('');
                        setResetResultPassword('');
                      }}
                    >
                      닫기
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="reset-password-input">임시 비밀번호 (선택)</Label>
                      <Input
                        id="reset-password-input"
                        value={resetCustomPassword}
                        onChange={e => setResetCustomPassword(e.target.value)}
                        placeholder="비워두면 자동 생성됩니다"
                        autoComplete="off"
                      />
                      {resetCustomPassword && resetCustomPassword.trim().length < 6 && (
                        <p className="text-xs text-destructive">6자 이상 입력해주세요.</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      className="w-full"
                      disabled={
                        resetPasswordMutation.isPending ||
                        (!!resetCustomPassword && resetCustomPassword.trim().length < 6)
                      }
                      onClick={() => {
                        if (!passwordResetTarget) return;
                        resetPasswordMutation.mutate({
                          userId: passwordResetTarget.id,
                          newPassword: resetCustomPassword.trim() || undefined,
                        });
                      }}
                    >
                      {resetPasswordMutation.isPending ? '발급 중...' : '임시 비밀번호 발급'}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Access Logs Tab */}
          <TabsContent value="access" className="space-y-4 md:col-start-2 md:mt-0">
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
                            ? format(new Date(a.lastLoginAt), 'MM/dd HH:mm')
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
          <TabsContent value="study" className="space-y-4 md:col-start-2 md:mt-0">
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
                      <DialogDescription className="sr-only">성경공부 자료를 등록하거나 수정합니다.</DialogDescription>
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
                {hasModule('bulletin_parsing') ? (
                  <>
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
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">
                    주보 자동 파싱은 이 교회에 활성화되지 않았습니다.
                  </p>
                )}
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
                <CardTitle className="text-lg">주보 파싱 원본</CardTitle>
                <CardDescription>원본은 전체 공유되고, 각 구역은 원본을 바탕으로 자기 구역 수정본을 만듭니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  원본 목록은 전역 데이터입니다. 현재 작업 구역을 바꿔도 원본 자체는 동일하고, `내 구역 상태`만 현재 작업 구역 기준으로 달라집니다.
                </div>
                {sourcesLoading ? (
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
                        <TableHead>파싱</TableHead>
                        <TableHead>내 구역 상태</TableHead>
                        <TableHead className="text-right">관리</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studySources.map((source: StudySource) => {
                        const districtStudy = studyBySourceId.get(source.id);
                        return (
                          <TableRow key={source.id}>
                            <TableCell className="font-medium">{source.weekNumber}주차</TableCell>
                            <TableCell>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{source.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{source.scripture}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{source.date}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {source.parseMode === 'manual' ? '수동' : '자동'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {districtStudy ? (
                                <Badge variant={districtStudy.published ? 'default' : 'secondary'} className="text-xs">
                                  {districtStudy.published ? '발행됨' : '수정본 있음'}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">없음</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {source.sourcePdfUrl && (
                                  <Button size="sm" variant="ghost" asChild>
                                    <a href={source.sourcePdfUrl} target="_blank" rel="noreferrer">
                                      <Link className="w-3 h-3 mr-1" />
                                      원본 PDF
                                    </a>
                                  </Button>
                                )}
                                {districtStudy ? (
                                  <Button size="sm" variant="outline" onClick={() => handleEditStudy(districtStudy)}>
                                    <Edit className="w-3 h-3 mr-1" />
                                    수정하기
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => createFromSourceMutation.mutate(source.id)}
                                    disabled={createFromSourceMutation.isPending}
                                  >
                                    <Copy className="w-3 h-3 mr-1" />
                                    내 구역 수정본 만들기
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {studySources.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                            아직 등록된 원본이 없습니다. 자동 파싱 또는 수동 파싱으로 첫 원본을 가져오세요.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

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
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="답변 현황" onClick={() => setViewAnswersStudy(study)}>
                                <Users className="w-3 h-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditStudy(study)}>
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => setDeletingStudyId(study.id)}
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
          <TabsContent value="prayer" className="space-y-4 md:col-start-2 md:mt-0">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
              <Card>
                <CardHeader className="px-4 py-3 md:px-6 md:pb-2 md:pt-6">
                  <CardDescription className="text-xs">공유된 기도제목</CardDescription>
                  <CardTitle className="text-xl md:text-2xl">{prayers.length}건</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="px-4 py-3 md:px-6 md:pb-2 md:pt-6">
                  <CardDescription className="text-xs">활성 기도제목</CardDescription>
                  <CardTitle className="text-xl text-primary md:text-2xl">{activePrayerRequests}건</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="px-4 py-3 md:px-6 md:pb-2 md:pt-6">
                  <CardDescription className="text-xs">응답된 기도</CardDescription>
                  <CardTitle className="text-xl text-green-600 md:text-2xl">{prayers.filter(p => p.answered).length}건</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader className="px-4 py-4 md:px-6 md:py-6">
                <CardTitle className="text-base md:text-lg">공유된 기도제목 관리</CardTitle>
                <CardDescription className="text-xs md:text-sm">제목을 누르면 상세 화면으로 이동합니다.</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
                <div className="space-y-3 md:hidden">
                  {prayers.map((prayer) => (
                    <div key={prayer.id} className="rounded-lg border bg-background p-3">
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={() => navigate(`/prayer-requests/${prayer.id}`)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">{prayer.userName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{prayer.createdAt}</p>
                          </div>
                          {prayer.answered ? (
                            <Badge className="shrink-0 bg-green-500/10 text-xs text-green-600">응답됨</Badge>
                          ) : (
                            <Badge variant="secondary" className="shrink-0 text-xs">기도중</Badge>
                          )}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-foreground">{prayer.content}</p>
                      </button>

                      <div className="mt-3 flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">중보기도 공유</p>
                          <p className="text-xs text-muted-foreground">
                            {prayer.sharedWithGroup ? '구역원에게 공유 중' : '공유하지 않음'}
                          </p>
                        </div>
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
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 h-9 w-full gap-1"
                        onClick={() => navigate(`/prayer-requests/${prayer.id}`)}
                      >
                        <Edit className="w-3.5 h-3.5" />
                        상세 보기
                      </Button>
                    </div>
                  ))}
                  {prayers.length === 0 && (
                    <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                      공유된 기도제목이 없습니다.
                    </p>
                  )}
                </div>

                <div className="hidden md:block">
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bible Reading Tab */}
          <TabsContent value="bible" className="space-y-4 md:col-start-2 md:mt-0">
            <Suspense fallback={<TabFallback />}>
              <AdminBibleReadingTab
                readingFrom={readingFrom}
                readingTo={readingTo}
                setReadingFrom={setReadingFrom}
                setReadingTo={setReadingTo}
                hasReadingRange={hasReadingRange}
                readingRangeFetching={readingRangeFetching}
                displayedReadingSummaries={displayedReadingSummaries}
              />
            </Suspense>
          </TabsContent>

          {/* Schedule Management Tab */}
          <TabsContent value="schedule" className="space-y-4 md:col-start-2 md:mt-0">
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
          <TabsContent value="report" className="space-y-4 md:col-start-2 md:mt-0">
            <Suspense fallback={<TabFallback />}>
              <AdminWeeklyReportTab
                weeklyReports={weeklyReports}
                reportsLoading={reportsLoading}
                weeklyClosePending={weeklyCloseMutation.isPending}
                weeklyUnlockPending={weeklyUnlockMutation.isPending}
                onWeeklyClose={(weekStart) => weeklyCloseMutation.mutate(weekStart)}
                onWeeklyUnlock={(weekStart) => weeklyUnlockMutation.mutate(weekStart)}
              />
            </Suspense>
          </TabsContent>

          {/* Kakao Notice Tab */}
          <TabsContent value="kakao" className="space-y-4 md:col-start-2 md:mt-0">
            <Suspense fallback={<TabFallback />}>
              <KakaoNoticeGenerator />
            </Suspense>
          </TabsContent>

          {/* QT 현황 Tab */}
          <TabsContent value="qt" className="space-y-4 md:col-start-2 md:mt-0">
            {(() => {
              const completedCount = qtMembers.filter((m) => m.isCompleted).length;
              const totalCount = qtMembers.length;
              const absentRisk = qtMembers.filter((m) => {
                if (m.isCompleted) return false;
                if (!m.lastCompleted) return true;
                const last = new Date(m.lastCompleted + 'T00:00:00');
                const t = new Date(today + 'T00:00:00');
                return Math.floor((t.getTime() - last.getTime()) / 86400000) >= 3;
              });
              return (
                <>
                  {/* church master: simple 모드 말씀 책 설정 */}
                  {isMaster && churchSettings?.qtMode === 'simple' && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">QT 말씀 설정</CardTitle>
                        <CardDescription className="text-xs">
                          매일 묵상할 성경 책을 선택합니다. day-of-year 순서로 1장씩 순환합니다.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-2 items-center">
                          <Select
                            value={churchSettings.qtSimpleBook}
                            onValueChange={(val) => updateQTBookMutation.mutate(val)}
                            disabled={updateQTBookMutation.isPending}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {bibleBooks.map((b) => (
                                <SelectItem key={b.id} value={b.koreanName}>
                                  {b.koreanName} ({b.chapterCount}장)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground">
                            현재: {churchSettings.qtSimpleBook}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <CheckCircle2 className="w-5 h-5 text-success mx-auto mb-1" />
                        <p className="text-2xl font-bold text-success">{completedCount}</p>
                        <p className="text-xs text-muted-foreground">완료</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <Circle className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                        <p className="text-2xl font-bold">{totalCount - completedCount}</p>
                        <p className="text-xs text-muted-foreground">미완료</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-1" />
                        <p className="text-2xl font-bold text-destructive">{absentRisk.length}</p>
                        <p className="text-xs text-muted-foreground">3일↑ 결석</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        구역원 현황 ({today} 기준)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {qtMembersLoading ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">불러오는 중...</p>
                      ) : qtMembers.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">구역원 정보가 없습니다.</p>
                      ) : (
                        <ul className="space-y-2">
                          {qtMembers.map((m) => {
                            const isRisk = absentRisk.some((a) => a.userId === m.userId);
                            return (
                              <li
                                key={m.userId}
                                className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                                  isRisk ? 'bg-destructive/5 border border-destructive/20' : 'border'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {isRisk && <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                                  <span className="text-sm font-medium">{m.userName}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  {m.currentStreak > 0 && (
                                    <span className="text-xs text-orange-500 font-semibold flex items-center gap-0.5">
                                      <Flame className="w-3 h-3" />{m.currentStreak}일
                                    </span>
                                  )}
                                  {m.isCompleted ? (
                                    <CheckCircle2 className="w-4 h-4 text-success" />
                                  ) : (
                                    <Circle className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">구역장 코멘트</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea
                        value={qtComment}
                        onChange={(e) => setQtComment(e.target.value)}
                        placeholder="내일 07:00 푸시 알림에 포함될 코멘트를 작성하세요 (선택 사항)"
                        className="min-h-[100px] resize-none"
                      />
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => qtCommentMutation.mutate()}
                        disabled={qtCommentMutation.isPending}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        저장 → 내일 07:00 발송 포함
                      </Button>
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </TabsContent>
        </Tabs>

        {/* 성경공부 삭제 확인 */}
        <AlertDialog open={!!deletingStudyId} onOpenChange={(open) => { if (!open) setDeletingStudyId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>성경공부 자료를 삭제할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                삭제하면 구역원 답변도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { if (deletingStudyId) { deleteStudyMutation.mutate(deletingStudyId); setDeletingStudyId(null); } }}
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 구역원 답변 현황 */}
        <Dialog open={!!viewAnswersStudy} onOpenChange={(open) => { if (!open) setViewAnswersStudy(undefined); }}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                답변 현황 — {viewAnswersStudy?.weekNumber}주차 {viewAnswersStudy?.title}
              </DialogTitle>
              <DialogDescription className="sr-only">구역원별 성경공부 답변 현황을 확인합니다.</DialogDescription>
            </DialogHeader>
            {answersLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : studyAnswers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">아직 제출된 답변이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">완료 {studyAnswers.filter(a => a.completed).length}명 / 전체 {studyAnswers.length}명 제출</p>
                {studyAnswers.map((answer) => {
                  const isMe = answer.userId === user?.id;
                  return (
                    <div key={answer.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{answer.userName}</span>
                        {answer.completed
                          ? <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">완료</span>
                          : <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">임시저장</span>
                        }
                        <span className="text-xs text-muted-foreground ml-auto">{answer.updatedAt.slice(0, 10)}</span>
                      </div>
                      {isMe && viewAnswersStudy && (viewAnswersStudy.questions as string[]).map((q, i) => (
                        <div key={i} className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">{i + 1}. {q}</p>
                          <p className="text-sm bg-muted/50 rounded p-2 whitespace-pre-wrap">
                            {answer.answers[i] || <span className="text-muted-foreground italic">미작성</span>}
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
