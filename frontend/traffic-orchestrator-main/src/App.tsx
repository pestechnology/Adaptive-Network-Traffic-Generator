import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";

// Layout
import { AppLayout } from "@/components/layout/AppLayout";

// Pages
import LandingPage from "@/pages/LandingPage";
import Dashboard from "@/pages/Dashboard";
import ProfilesPage from "@/pages/ProfilesPage";
import JobsPage from "@/pages/JobsPage";
import Level2Panel from "@/pages/Level2Panel";
import RFC2544Dashboard from "@/pages/RFC2544Dashboard";
import MaliciousPanel from "@/pages/MaliciousPanel";
import HeaderInspectionPanel from "@/pages/HeaderInspectionPanel";
import SchedulerPage from "@/pages/SchedulerPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000,
    },
  },
});

function AppWrapper() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Animated background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute top-[-15%] left-[20%] w-[700px] h-[700px] rounded-full opacity-[0.08]"
          style={{
            background: "radial-gradient(circle, #e91e8c, transparent 70%)",
            animation: "blob-drift 12s ease-in-out infinite",
            filter: "blur(80px)",
          }}
        />
        <div
          className="absolute top-[30%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.06]"
          style={{
            background: "radial-gradient(circle, #7c3aed, transparent 70%)",
            animation: "blob-drift 16s ease-in-out infinite reverse",
            filter: "blur(100px)",
          }}
        />
        <div
          className="absolute bottom-[-10%] left-[10%] w-[600px] h-[600px] rounded-full opacity-[0.05]"
          style={{
            background: "radial-gradient(circle, #3b82f6, transparent 70%)",
            animation: "blob-drift 20s ease-in-out infinite 4s",
            filter: "blur(120px)",
          }}
        />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Landing page — no layout wrapper */}
          <Route path="/" element={<LandingPage />} />

          {/* App pages — wrapped in AppLayout */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profiles" element={<ProfilesPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/level2" element={<Level2Panel />} />
            <Route path="/rfc2544" element={<RFC2544Dashboard />} />
            <Route path="/malicious" element={<MaliciousPanel />} />
            <Route path="/headers" element={<HeaderInspectionPanel />} />
            <Route path="/scheduler" element={<SchedulerPage />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delayDuration={150}>
      <Toaster />
      <Sonner richColors position="top-right" />
      <AppWrapper />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
