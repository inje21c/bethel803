import { lazy, Suspense, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/authContext';
import { useDistrict } from '@/lib/districtContext';
import AppLayout from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, BookOpen, TrendingUp, Users, Clock, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { getAllUsers, getDistricts } from '@/lib/api';
import type { FullUser } from '@/lib/api';

const AdminOverviewTab = lazy(() => import('@/components/admin/AdminOverviewTab'));
const AdminPrepTab     = lazy(() => import('@/components/admin/AdminPrepTab'));
const AdminStatsTab    = lazy(() => import('@/components/admin/AdminStatsTab'));
const AdminMembersTab  = lazy(() => import('@/components/admin/AdminMembersTab'));

function TabFallback() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function AdminDashboard() {
  const { user, isMaster } = useAuth();
  const {
    currentDistrictId,
    currentDistrictName,
    homeDistrictName,
    isViewingOtherDistrict,
    setCurrentDistrictId,
  } = useDistrict();

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') ?? 'overview');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  const { data: allDistricts = [] } = useQuery({
    queryKey: ['districts'],
    queryFn: getDistricts,
    enabled: isMaster,
    staleTime: 60_000,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all_users', currentDistrictId],
    queryFn: () => getAllUsers(currentDistrictId),
    enabled: !!currentDistrictId,
    staleTime: 30_000,
  });

  const pendingCount = allUsers.filter((u: FullUser) => u.status === 'pending').length;

  if (user?.role !== 'leader' && user?.role !== 'master') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">구역장만 접근할 수 있는 페이지입니다.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-[20px] font-bold">관리</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {currentDistrictName}
            </p>
          </div>
          <Badge variant="secondary" className="flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3" />
            {format(new Date(), 'MM.dd HH:mm')}
          </Badge>
        </div>

        {/* 마스터: 다른 구역 보기 */}
        {isMaster && allDistricts.filter(d => d.isActive).length > 1 && (
          <Card className={isViewingOtherDistrict ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20' : ''}>
            <CardContent className="py-3 flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-[13px] text-muted-foreground shrink-0">작업 구역:</span>
              <Select value={currentDistrictId} onValueChange={setCurrentDistrictId}>
                <SelectTrigger className="h-8 text-[13px] flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allDistricts.filter(d => d.isActive).map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}{d.id === allUsers.find((u: FullUser) => u.id === user?.id)?.districtId ? ' (내 구역)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isViewingOtherDistrict && (
                <span className="text-[11px] text-amber-700 dark:text-amber-400 shrink-0">내 구역: {homeDistrictName}</span>
              )}
            </CardContent>
          </Card>
        )}

        {/* 4탭 메인 */}
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-4 md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:items-start md:gap-6 md:space-y-0"
        >
          {/* 탭 메뉴 */}
          <TabsList className="flex w-full h-auto gap-0.5 p-0.5 md:sticky md:top-24 md:col-start-1 md:flex-col md:items-stretch md:rounded-xl md:border md:bg-card md:p-2 md:shadow-sm">
            <TabsTrigger
              value="overview"
              className="flex-1 flex-col py-2 h-auto gap-0.5 text-[11px] md:flex-row md:justify-start md:px-3 md:py-2.5 md:text-[13px] md:gap-2 md:h-auto"
            >
              <BarChart3 className="w-4 h-4" />
              <span>개요</span>
            </TabsTrigger>
            <TabsTrigger
              value="prep"
              className="flex-1 flex-col py-2 h-auto gap-0.5 text-[11px] md:flex-row md:justify-start md:px-3 md:py-2.5 md:text-[13px] md:gap-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>준비</span>
            </TabsTrigger>
            <TabsTrigger
              value="stats"
              className="flex-1 flex-col py-2 h-auto gap-0.5 text-[11px] md:flex-row md:justify-start md:px-3 md:py-2.5 md:text-[13px] md:gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              <span>현황</span>
            </TabsTrigger>
            <TabsTrigger
              value="members"
              className="flex-1 flex-col py-2 h-auto gap-0.5 text-[11px] md:flex-row md:justify-start md:px-3 md:py-2.5 md:text-[13px] md:gap-2 relative"
            >
              <Users className="w-4 h-4" />
              <span>구성원</span>
              {pendingCount > 0 && (
                <Badge variant="destructive" className="absolute -top-0.5 -right-0.5 h-4 min-w-[1rem] px-0.5 text-[10px] flex items-center justify-center md:static md:ml-auto">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* 탭 콘텐츠 */}
          <div className="md:col-start-2 md:mt-0">
            <TabsContent value="overview">
              <Suspense fallback={<TabFallback />}>
                <AdminOverviewTab setActiveTab={handleTabChange} />
              </Suspense>
            </TabsContent>

            <TabsContent value="prep">
              <Suspense fallback={<TabFallback />}>
                <AdminPrepTab />
              </Suspense>
            </TabsContent>

            <TabsContent value="stats">
              <Suspense fallback={<TabFallback />}>
                <AdminStatsTab />
              </Suspense>
            </TabsContent>

            <TabsContent value="members">
              <Suspense fallback={<TabFallback />}>
                <AdminMembersTab />
              </Suspense>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}
