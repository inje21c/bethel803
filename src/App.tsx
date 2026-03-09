import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import BibleStudyList from "./pages/BibleStudyList";
import BibleStudyDetail from "./pages/BibleStudyDetail";
import PrayerRequests from "./pages/PrayerRequests";
import BibleReading from "./pages/BibleReading";
import NotFound from "./pages/NotFound";
import { store } from "./lib/store";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = store.getUser();
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/bible-study" element={<ProtectedRoute><BibleStudyList /></ProtectedRoute>} />
          <Route path="/bible-study/:id" element={<ProtectedRoute><BibleStudyDetail /></ProtectedRoute>} />
          <Route path="/prayer-requests" element={<ProtectedRoute><PrayerRequests /></ProtectedRoute>} />
          <Route path="/bible-reading" element={<ProtectedRoute><BibleReading /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
