import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/authContext";
import { ChurchProvider } from "./lib/churchContext";
import { DistrictProvider } from "./lib/districtContext";
import { queryClient } from "./lib/queryClient";
import ErrorBoundary from "./components/ErrorBoundary";

const FIREBASE_LANDING_HOSTS = new Set(['bethel803.web.app', 'bethel803.firebaseapp.com']);
const LANDING_PREVIEW_PATH = '/firebase-landing-preview';

function shouldRenderFirebaseLanding() {
  const { hostname, pathname, search } = window.location;
  const params = new URLSearchParams(search);
  return (
    FIREBASE_LANDING_HOSTS.has(hostname) ||
    pathname === LANDING_PREVIEW_PATH ||
    params.get('landingPreview') === '1'
  );
}

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const BibleStudyList = lazy(() => import("./pages/BibleStudyList"));
const BibleStudyDetail = lazy(() => import("./pages/BibleStudyDetail"));
const PrayerRequests = lazy(() => import("./pages/PrayerRequests"));
const PrayerRequestDetail = lazy(() => import("./pages/PrayerRequestDetail"));
const BibleReading = lazy(() => import("./pages/BibleReading"));
const ScheduleManagement = lazy(() => import("./pages/ScheduleManagement"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Profile = lazy(() => import("./pages/Profile"));
const UserManual = lazy(() => import("./pages/UserManual"));
const DistrictManagement = lazy(() => import("./pages/DistrictManagement"));
const FirebaseLanding = lazy(() => import("./pages/FirebaseLanding"));
const QTMain = lazy(() => import("./pages/QTMain"));
const QTPray = lazy(() => import("./pages/QTPray"));
const QTComplete = lazy(() => import("./pages/QTComplete"));
const QTDate = lazy(() => import("./pages/QTDate"));
const QTDeepMeditation = lazy(() => import("./pages/QTDeepMeditation"));
const QTLeaderDashboard = lazy(() => import("./pages/QTLeaderDashboard"));
const ChurchSignup = lazy(() => import("./pages/ChurchSignup"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Join = lazy(() => import("./pages/Join"));
const Landing = lazy(() => import("./pages/Landing"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Support = lazy(() => import("./pages/Support"));

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

function MasterRoute({ children }: { children: React.ReactNode }) {
  const { isMaster } = useAuth();
  if (!isMaster) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// 로그인 상태에 따라 루트 경로 분기 (비로그인 → 랜딩)
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Landing />;
  if (user.status === 'pending') return <Navigate to="/pending" replace />;
  return <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup/church" element={<ChurchSignup />} />
        <Route path="/join" element={<Join />} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/pending" element={<PendingApproval />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/bible-study" element={<ProtectedRoute><BibleStudyList /></ProtectedRoute>} />
        <Route path="/bible-study/:id" element={<ProtectedRoute><BibleStudyDetail /></ProtectedRoute>} />
        <Route path="/prayer-requests" element={<ProtectedRoute><PrayerRequests /></ProtectedRoute>} />
        <Route path="/prayer-requests/:id" element={<ProtectedRoute><PrayerRequestDetail /></ProtectedRoute>} />
        <Route path="/schedule" element={<ProtectedRoute><ScheduleManagement /></ProtectedRoute>} />
        <Route path="/bible-reading" element={<ProtectedRoute><BibleReading /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><LeaderRoute><AdminDashboard /></LeaderRoute></ProtectedRoute>} />
        <Route path="/districts" element={<ProtectedRoute><MasterRoute><DistrictManagement /></MasterRoute></ProtectedRoute>} />
        <Route path="/qt" element={<ProtectedRoute><QTMain /></ProtectedRoute>} />
        <Route path="/qt/pray" element={<ProtectedRoute><QTPray /></ProtectedRoute>} />
        <Route path="/qt/complete" element={<ProtectedRoute><QTComplete /></ProtectedRoute>} />
        <Route path="/qt/deep" element={<ProtectedRoute><QTDeepMeditation /></ProtectedRoute>} />
        <Route path="/qt/:date" element={<ProtectedRoute><QTDate /></ProtectedRoute>} />
        <Route path="/leader/qt-dashboard" element={<ProtectedRoute><LeaderRoute><QTLeaderDashboard /></LeaderRoute></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/manual" element={<ProtectedRoute><UserManual /></ProtectedRoute>} />
        <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <ErrorBoundary>
    {shouldRenderFirebaseLanding() ? (
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Suspense fallback={<Spinner />}>
          <FirebaseLanding />
        </Suspense>
      </TooltipProvider>
    ) : (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <ChurchProvider>
                <DistrictProvider>
                  <AppRoutes />
                </DistrictProvider>
              </ChurchProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    )}
  </ErrorBoundary>
);

export default App;
