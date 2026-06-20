import { lazy, Suspense, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { useDistrict } from '@/lib/districtContext';
import {
  getSharedPrayerRequests, updatePrayerRequest,
  getAccessInfo, getWeeklyReports, triggerWeeklyClose, unlockWeeklyReport,
  getQTDistrictSummary, getTodayQT, updateQTLeaderComment,
  getAllBibleReadingSummaries, getBibleReadingSummariesByRange,
  getKSTDateString,
} from '@/lib/api';
import type { AccessInfo } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2, Circle, AlertTriangle, Flame, TrendingUp,
  Users, Save, BookHeart, BookMarked, MessageSquareHeart, FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const AdminBibleReadingTab = lazy(() => import('@/components/admin/AdminBibleReadingTab'));
const AdminWeeklyReportTab = lazy(() => import('@/components/admin/AdminWeeklyReportTab'));

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function AdminStatsTab() {
  const { user } = useAuth();
  const { currentDistrictId } = useDistrict();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [subTab, setSubTab] = useState('qt');
  const [qtComment, setQtComment] = useState('');
  const [readingFrom, setReadingFrom] = useState('');
  const [readingTo, setReadingTo] = useState('');
  const today = getKSTDateString(new Date());

  const hasReadingRange = readingFrom !== '' && readingTo !== '';

  /* QT */
  const { data: qtContent } = useQuery({
    queryKey: ['qt_content', today],
    queryFn: getTodayQT,
    staleTime: 1000 * 60 * 30,
    enabled: subTab === 'qt',
  });

  const { data: qtMembers = [], isLoading: qtMembersLoading } = useQuery({
    queryKey: ['qt_district_summary', currentDistrictId, today],
    queryFn: () => getQTDistrictSummary(currentDistrictId, today),
    enabled: subTab === 'qt' && !!currentDistrictId,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (qtContent?.leaderComment) setQtComment(qtContent.leaderComment);
  }, [qtContent?.leaderComment]);

  const qtCommentMutation = useMutation({
    mutationFn: () => updateQTLeaderComment(today, qtComment),
    onSuccess: () => toast.success('코멘트가 저장되었습니다.'),
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  /* Access */
  const { data: accessInfo = [] } = useQuery({
    queryKey: ['access_info', currentDistrictId],
    queryFn: () => getAccessInfo(currentDistrictId),
    enabled: subTab === 'access' && !!currentDistrictId,
    placeholderData: prev => prev,
  });

  /* Bible Reading */
  const { data: readingSummaries = [] } = useQuery({
    queryKey: ['all_reading_summaries', currentDistrictId],
    queryFn: () => getAllBibleReadingSummaries(currentDistrictId),
    enabled: subTab === 'bible' && !!currentDistrictId,
    placeholderData: prev => prev,
  });

  const { data: readingSummariesByRange = [], isFetching: readingRangeFetching } = useQuery({
    queryKey: ['reading_summaries_range', currentDistrictId, readingFrom, readingTo],
    queryFn: () => getBibleReadingSummariesByRange(currentDistrictId, readingFrom, readingTo),
    enabled: subTab === 'bible' && !!currentDistrictId && hasReadingRange,
  });

  const displayedReadingSummaries = hasReadingRange ? readingSummariesByRange : readingSummaries;

  /* Prayer */
  const { data: prayers = [] } = useQuery({
    queryKey: ['shared_prayer_requests', currentDistrictId],
    queryFn: () => getSharedPrayerRequests(currentDistrictId),
    enabled: subTab === 'prayer' && !!currentDistrictId,
    placeholderData: prev => prev,
  });

  /* Weekly Report */
  const { data: weeklyReports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['weekly_reports', currentDistrictId],
    queryFn: () => getWeeklyReports(currentDistrictId),
    enabled: subTab === 'report' && !!currentDistrictId,
    placeholderData: prev => prev,
  });

  const weeklyCloseMutation = useMutation({
    mutationFn: (weekStart?: string) => triggerWeeklyClose(weekStart, currentDistrictId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['weekly_reports'] }); toast.success('이번 주 마감이 완료되었습니다.'); },
    onError: (err: unknown) => toast.error(`마감 실패: ${err instanceof Error ? err.message : String(err)}`),
  });

  const weeklyUnlockMutation = useMutation({
    mutationFn: (weekStart: string) => unlockWeeklyReport(weekStart, currentDistrictId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['weekly_reports'] }); toast.success('마감이 해제되었습니다.'); },
    onError: (err: unknown) => toast.error(`마감 해제 실패: ${err instanceof Error ? err.message : String(err)}`),
  });

  /* QT computed */
  const completedCount = qtMembers.filter(m => m.isCompleted).length;
  const absentRisk = qtMembers.filter(m => {
    if (m.isCompleted) return false;
    if (!m.lastCompleted) return true;
    return Math.floor((new Date(today).getTime() - new Date(m.lastCompleted + 'T00:00:00').getTime()) / 86400000) >= 3;
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAccessCount = accessInfo.filter((a: AccessInfo) => a.lastLoginAt?.slice(0, 10) === todayStr).length;
  const activePrayers = prayers.filter(p => !p.answered).length;

  return (
    <div className="space-y-5">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="w-full">
          <TabsTrigger value="qt" className="flex-1 gap-1 text-[12px] px-1.5">
            <BookHeart className="w-3 h-3" />QT
          </TabsTrigger>
          <TabsTrigger value="bible" className="flex-1 gap-1 text-[12px] px-1.5">
            <BookMarked className="w-3 h-3" />성경읽기
          </TabsTrigger>
          <TabsTrigger value="access" className="flex-1 gap-1 text-[12px] px-1.5">
            <TrendingUp className="w-3 h-3" />접속
          </TabsTrigger>
          <TabsTrigger value="prayer" className="flex-1 gap-1 text-[12px] px-1.5">
            <MessageSquareHeart className="w-3 h-3" />기도
          </TabsTrigger>
          <TabsTrigger value="report" className="flex-1 gap-1 text-[12px] px-1.5">
            <FileText className="w-3 h-3" />보고서
          </TabsTrigger>
        </TabsList>

        {/* QT 현황 */}
        <TabsContent value="qt" className="space-y-4 mt-4">
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
                <p className="text-2xl font-bold">{qtMembers.length - completedCount}</p>
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
              <CardTitle className="text-sm">구역원 현황 ({today} 기준)</CardTitle>
            </CardHeader>
            <CardContent>
              {qtMembersLoading ? (
                <Spinner />
              ) : qtMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">구역원 정보가 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {qtMembers.map(m => {
                    const isRisk = absentRisk.some(a => a.userId === m.userId);
                    return (
                      <li key={m.userId} className={`flex items-center justify-between rounded-lg px-4 py-3 ${isRisk ? 'bg-destructive/5 border border-destructive/20' : 'border'}`}>
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
                          {m.isCompleted ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
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
                onChange={e => setQtComment(e.target.value)}
                placeholder="내일 07:00 푸시 알림에 포함될 코멘트 (선택)"
                className="min-h-[100px] resize-none"
              />
              <Button variant="outline" className="w-full" onClick={() => qtCommentMutation.mutate()} disabled={qtCommentMutation.isPending}>
                <Save className="w-4 h-4 mr-2" />저장 → 내일 07:00 발송 포함
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 성경읽기 */}
        <TabsContent value="bible" className="mt-4">
          <Suspense fallback={<Spinner />}>
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

        {/* 접속현황 */}
        <TabsContent value="access" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border bg-card p-4 text-center">
              <p className="font-display text-2xl font-bold text-primary">{todayAccessCount}</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">오늘 접속</p>
            </div>
            <div className="rounded-2xl border bg-card p-4 text-center">
              <p className="font-display text-2xl font-bold text-primary">{accessInfo.length}</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">전체 구역원</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">구역원 최근 접속</CardTitle>
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
                      <TableCell className="font-medium text-sm">{a.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.lastLoginAt ? format(new Date(a.lastLoginAt), 'MM/dd HH:mm') : '기록 없음'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {accessInfo.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-6">접속 기록이 없습니다.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 기도제목 */}
        <TabsContent value="prayer" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border bg-card p-3 text-center">
              <p className="font-display text-2xl font-bold text-primary">{prayers.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">전체</p>
            </div>
            <div className="rounded-2xl border bg-card p-3 text-center">
              <p className="font-display text-2xl font-bold text-primary">{activePrayers}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">기도중</p>
            </div>
            <div className="rounded-2xl border bg-card p-3 text-center">
              <p className="font-display text-2xl font-bold text-green-600">{prayers.filter(p => p.answered).length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">응답됨</p>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {prayers.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">공유된 기도제목이 없습니다.</p>
              ) : (
                <div className="space-y-0 divide-y">
                  {prayers.map(prayer => (
                    <div key={prayer.id} className="px-4 py-3.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium">{prayer.userName}</span>
                          {prayer.answered
                            ? <Badge className="bg-green-500/10 text-green-600 text-[11px] h-4">응답됨</Badge>
                            : <Badge variant="secondary" className="text-[11px] h-4">기도중</Badge>
                          }
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">중보기도</span>
                          <Switch
                            checked={prayer.sharedWithGroup}
                            onCheckedChange={async checked => {
                              try {
                                await updatePrayerRequest({ id: prayer.id, sharedWithGroup: checked });
                                queryClient.invalidateQueries({ queryKey: ['shared_prayer_requests'] });
                                toast.success(checked ? '중보기도로 공유되었습니다.' : '공유가 해제되었습니다.');
                              } catch {
                                toast.error('변경에 실패했습니다.');
                              }
                            }}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => navigate(`/prayer-requests/${prayer.id}`)}
                      >
                        <p className="text-[13px] text-muted-foreground line-clamp-2">{prayer.content}</p>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 주간보고 */}
        <TabsContent value="report" className="mt-4">
          <p className="text-[13px] text-muted-foreground mb-4">
            주일이 지나면 [마감하기]를 누른 후 엑셀 파일(CSV)로 다운로드하여 교회에 제출하세요.
          </p>
          <Suspense fallback={<Spinner />}>
            <AdminWeeklyReportTab
              weeklyReports={weeklyReports}
              reportsLoading={reportsLoading}
              weeklyClosePending={weeklyCloseMutation.isPending}
              weeklyUnlockPending={weeklyUnlockMutation.isPending}
              onWeeklyClose={weekStart => weeklyCloseMutation.mutate(weekStart)}
              onWeeklyUnlock={weekStart => weeklyUnlockMutation.mutate(weekStart)}
            />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
