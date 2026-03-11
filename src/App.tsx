import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/authContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import BibleStudyList from "./pages/BibleStudyList";
import BibleStudyDetail from "./pages/BibleStudyDetail";
import PrayerRequests from "./pages/PrayerRequests";
import BibleReading from "./pages/BibleReading";
import ScheduleManagement from "./pages/ScheduleManagement";
import AdminDashboard from "./pages/AdminDashboard";
import PendingApproval from "./pages/PendingApproval";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import ErrorBoundary from "./components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5분간 fresh → 탭 전환 시 재요청 없음
      refetchOnWindowFocus: false,    // 포커스 복귀 시 자동 refetch 비활성화
      retry: 1,                       // 실패 시 1회만 재시도
    },
  },
});

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.status === 'pending') return <Navigate to="/pending" replace />;
  return <>{children}</>;
}

function LeaderRoute({ children }: { children: React.ReactNode }) {
  const { isLeader } = useAuth();
  if (!isLeader) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// 로그인 상태에 따라 루트 경로 분기
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.status === 'pending') return <Navigate to="/pending" replace />;
  return <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/pending" element={<PendingApproval />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/bible-study" element={<ProtectedRoute><BibleStudyList /></ProtectedRoute>} />
      <Route path="/bible-study/:id" element={<ProtectedRoute><BibleStudyDetail /></ProtectedRoute>} />
      <Route path="/prayer-requests" element={<ProtectedRoute><PrayerRequests /></ProtectedRoute>} />
      <Route path="/schedule" element={<ProtectedRoute><ScheduleManagement /></ProtectedRoute>} />
      <Route path="/bible-reading" element={<ProtectedRoute><BibleReading /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><LeaderRoute><AdminDashboard /></LeaderRoute></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
