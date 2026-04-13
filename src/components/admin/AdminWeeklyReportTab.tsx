import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Lock, LockOpen, Download, Copy } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from 'sonner';
import type { WeeklyReport } from '@/lib/api';

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

interface AdminWeeklyReportTabProps {
  weeklyReports: WeeklyReport[];
  reportsLoading: boolean;
  weeklyClosePending: boolean;
  weeklyUnlockPending: boolean;
  onWeeklyClose: (weekStart?: string) => void;
  onWeeklyUnlock: (weekStart: string) => void;
}

export default function AdminWeeklyReportTab({
  weeklyReports,
  reportsLoading,
  weeklyClosePending,
  weeklyUnlockPending,
  onWeeklyClose,
  onWeeklyUnlock,
}: AdminWeeklyReportTabProps) {
  const thisWeekStart = getThisWeekStart();
  const thisWeekReport = weeklyReports.find(r => r.weekStart === thisWeekStart);
  const isThisWeekLocked = thisWeekReport?.isLocked === true;

  return (
    <div className="space-y-4">
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
                  onClick={() => onWeeklyUnlock(thisWeekStart)}
                  disabled={weeklyUnlockPending}
                >
                  <LockOpen className={`w-3 h-3 mr-1 ${weeklyUnlockPending ? 'animate-spin' : ''}`} />
                  마감 해제
                </Button>
              )}
              <Button
                size="sm"
                variant={isThisWeekLocked ? 'outline' : 'default'}
                onClick={() => onWeeklyClose(undefined)}
                disabled={weeklyClosePending}
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${weeklyClosePending ? 'animate-spin' : ''}`} />
                {isThisWeekLocked ? '재집계' : '즉시 마감'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
