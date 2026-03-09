import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, Users, BookOpen, MessageSquareHeart, BookMarked, 
  CalendarDays, AlertCircle, CheckCircle2, Clock, TrendingUp,
  RefreshCw, Plus, Edit, Trash2, Eye, Download
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { store, mockStudies } from '@/lib/store';
import { format, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';

// Mock data for admin dashboard
const mockAccessLogs = {
  totalMembers: 12,
  loggedInToday: 8,
  weeklyLogins: [5, 7, 6, 8, 9, 7, 8],
  serviceErrors: 0,
  lastError: null as string | null,
};

const mockMemberStats = [
  { id: '1', name: '김성민', lastLogin: '2026-03-09 08:30', studyComplete: true, attendance: 'attending', prayerCount: 2, bibleChapters: 45 },
  { id: '2', name: '이정희', lastLogin: '2026-03-09 07:15', studyComplete: true, attendance: 'attending', prayerCount: 1, bibleChapters: 32 },
  { id: '3', name: '박준영', lastLogin: '2026-03-08 21:00', studyComplete: false, attendance: 'pending', prayerCount: 0, bibleChapters: 18 },
  { id: '4', name: '최수연', lastLogin: '2026-03-08 19:30', studyComplete: true, attendance: 'absent', prayerCount: 1, bibleChapters: 28 },
  { id: '5', name: '정민수', lastLogin: '2026-03-07 20:00', studyComplete: false, attendance: 'pending', prayerCount: 0, bibleChapters: 12 },
];

const mockScrapingStatus = {
  lastScraped: '2026-03-08 06:00',
  status: 'success' as 'success' | 'failed' | 'pending',
  nextScheduled: '2026-03-15 06:00',
  studiesFound: 3,
};

export default function AdminDashboard() {
  const user = store.getUser();
  const prayers = store.getPrayers();
  const schedules = store.getSchedules();
  const [activeTab, setActiveTab] = useState('overview');

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

  const studyCompletionRate = Math.round((mockMemberStats.filter(m => m.studyComplete).length / mockMemberStats.length) * 100);
  const attendanceRate = Math.round((mockMemberStats.filter(m => m.attendance === 'attending').length / mockMemberStats.length) * 100);
  const totalBibleChapters = mockMemberStats.reduce((sum, m) => sum + m.bibleChapters, 0);
  const activePrayerRequests = prayers.filter(p => !p.answered).length;

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
          <TabsList className="grid grid-cols-3 lg:grid-cols-6 h-auto gap-1">
            <TabsTrigger value="overview" className="text-xs px-2 py-1.5">
              <BarChart3 className="w-3 h-3 mr-1" />
              대시보드
            </TabsTrigger>
            <TabsTrigger value="access" className="text-xs px-2 py-1.5">
              <Users className="w-3 h-3 mr-1" />
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
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">성경공부 완료율</CardDescription>
                    <CardTitle className="text-2xl">{studyCompletionRate}%</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress value={studyCompletionRate} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {mockMemberStats.filter(m => m.studyComplete).length}/{mockMemberStats.length}명 완료
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">구역예배 참석률</CardDescription>
                    <CardTitle className="text-2xl">{attendanceRate}%</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress value={attendanceRate} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {mockMemberStats.filter(m => m.attendance === 'attending').length}/{mockMemberStats.length}명 참석
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">활성 기도제목</CardDescription>
                    <CardTitle className="text-2xl">{activePrayerRequests}건</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      응답된 기도: {prayers.filter(p => p.answered).length}건
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">총 성경읽기</CardDescription>
                    <CardTitle className="text-2xl">{totalBibleChapters}장</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      구역원 평균: {Math.round(totalBibleChapters / mockMemberStats.length)}장
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Member Status Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">구역원 현황</CardTitle>
                <CardDescription>각 구역원의 활동 상태를 확인하세요</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>마지막 접속</TableHead>
                      <TableHead>성경공부</TableHead>
                      <TableHead>예배참석</TableHead>
                      <TableHead>성경읽기</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockMemberStats.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{member.lastLogin}</TableCell>
                        <TableCell>
                          {member.studyComplete ? (
                            <Badge variant="default" className="bg-green-500/10 text-green-600 text-xs">완료</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">미완료</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {member.attendance === 'attending' && <Badge className="bg-green-500/10 text-green-600 text-xs">참석</Badge>}
                          {member.attendance === 'absent' && <Badge variant="destructive" className="text-xs">불참</Badge>}
                          {member.attendance === 'pending' && <Badge variant="secondary" className="text-xs">미응답</Badge>}
                        </TableCell>
                        <TableCell>{member.bibleChapters}장</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Access Logs Tab */}
          <TabsContent value="access" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">전체 구역원</CardDescription>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    {mockAccessLogs.totalMembers}명
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">오늘 접속자</CardDescription>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    {mockAccessLogs.loggedInToday}명
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">서비스 상태</CardDescription>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    {mockAccessLogs.serviceErrors === 0 ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="text-green-600">정상</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5 text-destructive" />
                        <span className="text-destructive">오류</span>
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">주간 평균 접속</CardDescription>
                  <CardTitle className="text-2xl">
                    {Math.round(mockAccessLogs.weeklyLogins.reduce((a, b) => a + b, 0) / 7)}명/일
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">최근 7일 접속 현황</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 h-32">
                  {mockAccessLogs.weeklyLogins.map((count, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div 
                        className="w-full bg-primary/20 rounded-t"
                        style={{ height: `${(count / 12) * 100}%` }}
                      >
                        <div 
                          className="w-full bg-primary rounded-t transition-all"
                          style={{ height: '100%' }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(subDays(new Date(), 6 - idx), 'E', { locale: ko })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bible Study Management Tab */}
          <TabsContent value="study" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  스크래핑 상태
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm font-medium">벧엘교회 홈페이지</p>
                    <p className="text-xs text-muted-foreground">마지막 수집: {mockScrapingStatus.lastScraped}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {mockScrapingStatus.status === 'success' && (
                      <Badge className="bg-green-500/10 text-green-600">성공</Badge>
                    )}
                    {mockScrapingStatus.status === 'failed' && (
                      <Badge variant="destructive">실패</Badge>
                    )}
                    <Button size="sm" variant="outline">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      수동 실행
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  다음 예정: {mockScrapingStatus.nextScheduled} | 수집된 공부: {mockScrapingStatus.studiesFound}개
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">성경공부 목록</CardTitle>
                  <CardDescription>등록된 구역성경공부를 관리하세요</CardDescription>
                </div>
                <Button size="sm">
                  <Plus className="w-3 h-3 mr-1" />
                  수동 등록
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>주차</TableHead>
                      <TableHead>제목</TableHead>
                      <TableHead>본문</TableHead>
                      <TableHead>질문 수</TableHead>
                      <TableHead>완료율</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockStudies.map((study) => (
                      <TableRow key={study.id}>
                        <TableCell>{study.weekNumber}주차</TableCell>
                        <TableCell className="font-medium">{study.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{study.scripture}</TableCell>
                        <TableCell>{study.questions.length}개</TableCell>
                        <TableCell>
                          <Progress value={60} className="h-2 w-16" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7">
                              <Eye className="w-3 h-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7">
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Prayer Management Tab */}
          <TabsContent value="prayer" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">전체 기도제목</CardDescription>
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
                <CardTitle className="text-lg">기도제목 관리</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>작성자</TableHead>
                      <TableHead>기도제목</TableHead>
                      <TableHead>등록일</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prayers.map((prayer) => (
                      <TableRow key={prayer.id}>
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
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" className="h-7 w-7">
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
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">구역 총 읽기</CardDescription>
                  <CardTitle className="text-2xl">{totalBibleChapters}장</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">구역원 평균</CardDescription>
                  <CardTitle className="text-2xl">{Math.round(totalBibleChapters / mockMemberStats.length)}장</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">목표 달성률</CardDescription>
                  <CardTitle className="text-2xl">{Math.round((totalBibleChapters / (mockMemberStats.length * 100)) * 100)}%</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">구역원별 성경읽기 현황</CardTitle>
                  <CardDescription>2026년 누적 기준</CardDescription>
                </div>
                <Button size="sm" variant="outline">
                  <Download className="w-3 h-3 mr-1" />
                  내보내기
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>읽은 장수</TableHead>
                      <TableHead>진행률</TableHead>
                      <TableHead>최근 기록</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockMemberStats.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.name}</TableCell>
                        <TableCell>{member.bibleChapters}장</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={(member.bibleChapters / 100) * 100} className="h-2 w-20" />
                            <span className="text-xs text-muted-foreground">{member.bibleChapters}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(subDays(new Date(), Math.floor(Math.random() * 7)), 'MM/dd')}
                        </TableCell>
                      </TableRow>
                    ))}
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
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">일정 관리</CardTitle>
                  <CardDescription>등록된 모든 일정을 관리하세요</CardDescription>
                </div>
                <Button size="sm">
                  <Plus className="w-3 h-3 mr-1" />
                  일정 추가
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>제목</TableHead>
                      <TableHead>일시</TableHead>
                      <TableHead>장소</TableHead>
                      <TableHead>출석체크</TableHead>
                      <TableHead>참석현황</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((schedule) => {
                      const attendances = store.getAttendances(schedule.id);
                      const attendingCount = attendances.filter(a => a.status === 'attending').length;
                      return (
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
                          <TableCell>
                            {schedule.attendanceCheck && (
                              <span className="text-sm">{attendingCount}명 참석</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7">
                                <Eye className="w-3 h-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7">
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
