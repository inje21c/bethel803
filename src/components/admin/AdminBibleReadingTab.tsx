import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { BibleReadingSummary } from '@/lib/api';

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

interface AdminBibleReadingTabProps {
  readingFrom: string;
  readingTo: string;
  setReadingFrom: (value: string) => void;
  setReadingTo: (value: string) => void;
  hasReadingRange: boolean;
  readingRangeFetching: boolean;
  displayedReadingSummaries: BibleReadingSummary[];
}

export default function AdminBibleReadingTab({
  readingFrom,
  readingTo,
  setReadingFrom,
  setReadingTo,
  hasReadingRange,
  readingRangeFetching,
  displayedReadingSummaries,
}: AdminBibleReadingTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">조회 기간</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              type="date"
              value={readingFrom}
              onChange={e => setReadingFrom(e.target.value)}
              className="w-auto"
            />
            <span className="text-muted-foreground">~</span>
            <Input
              type="date"
              value={readingTo}
              onChange={e => setReadingTo(e.target.value)}
              className="w-auto"
            />
            {hasReadingRange && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setReadingFrom(''); setReadingTo(''); }}
              >
                초기화
              </Button>
            )}
            {readingRangeFetching && (
              <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {hasReadingRange ? `${readingFrom} ~ ${readingTo} 기간 합산` : '전체 누적 (기간 미선택)'}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">기록한 구역원</CardDescription>
            <CardTitle className="text-2xl">{displayedReadingSummaries.length}명</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">{hasReadingRange ? '기간 합계' : '구역 총 누적'}</CardDescription>
            <CardTitle className="text-2xl">
              {displayedReadingSummaries.reduce((sum: number, r: BibleReadingSummary) => sum + r.totalChapters, 0)}장
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {displayedReadingSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">구역원별 읽기 현황 차트</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={displayedReadingSummaries.map(r => ({ name: r.userName, 장수: r.totalChapters }))}>
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
            <CardDescription>
              {hasReadingRange ? `${readingFrom} ~ ${readingTo}` : '2026년 누적 기준 (전체 1189장)'}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 shrink-0"
            onClick={() => exportCSV(
              hasReadingRange
                ? [
                    ['이름', '장수'],
                    ...displayedReadingSummaries.map(r => [r.userName, r.totalChapters]),
                  ]
                : [
                    ['이름', '누적 장수', '진행률(%)'],
                    ...displayedReadingSummaries.map(r => [r.userName, r.totalChapters, Math.round((r.totalChapters / 1189) * 100)]),
                  ],
              `성경읽기_${hasReadingRange ? `${readingFrom}_${readingTo}` : new Date().toISOString().slice(0, 10)}.csv`
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
                <TableHead className="text-right">{hasReadingRange ? '장수' : '누적 장수'}</TableHead>
                {!hasReadingRange && <TableHead>진행률</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedReadingSummaries.map((r: BibleReadingSummary) => (
                <TableRow key={r.userId}>
                  <TableCell className="font-medium">{r.userName}</TableCell>
                  <TableCell className="text-right font-semibold">{r.totalChapters}장</TableCell>
                  {!hasReadingRange && (
                    <TableCell className="w-32">
                      <div className="flex items-center gap-2">
                        <Progress value={Math.min((r.totalChapters / 1189) * 100, 100)} className="flex-1 h-1.5" />
                        <span className="text-xs text-muted-foreground w-8">
                          {Math.round((r.totalChapters / 1189) * 100)}%
                        </span>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {displayedReadingSummaries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={hasReadingRange ? 2 : 3} className="text-center text-muted-foreground py-4">
                    {hasReadingRange ? '선택한 기간에 성경읽기 기록이 없습니다.' : '아직 성경읽기 기록이 없습니다.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
