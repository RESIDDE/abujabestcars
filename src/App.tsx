import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { RoleGuard, AdminGuard } from "@/components/RoleGuard";
import { useAuth } from "@/hooks/useAuth";
import { PermissionsRealtimeSync } from "@/hooks/usePermissions";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DocumentScaleSync } from "@/hooks/useDocumentScale";
import { ZoomLock } from "@/hooks/useZoomLock";

/**
 * React.lazy with one retry, then a single forced reload.
 *
 * A dynamic import can fail on a network blip, or because the tab is running
 * an older deploy whose chunk filenames no longer exist on the server. Without
 * this the Suspense boundary never resolves and the page stays blank until the
 * user refreshes by hand. The sessionStorage flag stops a reload loop when the
 * chunk is genuinely missing — the ErrorBoundary then shows a message instead.
 */
const CHUNK_RELOAD_KEY = "chunk-reload";

function lazyWithRetry<T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await factory();
      // Loaded fine, so the tab is on the current deploy — allow a future reload.
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return mod;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
      try {
        const mod = await factory();
        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        return mod;
      } catch (err) {
        // Reload at most once per session, otherwise a genuinely missing chunk
        // would reload forever. After that the ErrorBoundary takes over.
        if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
          window.location.reload();
          return await new Promise<{ default: T }>(() => {});
        }
        throw err;
      }
    }
  });
}

// Lazy load pages
const Index = lazyWithRetry(() => import("./pages/Index"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const Unauthorized = lazyWithRetry(() => import("./pages/Unauthorized"));
const VehiclesList = lazyWithRetry(() => import("./pages/VehiclesList"));
const VehicleForm = lazyWithRetry(() => import("./pages/VehicleForm"));
const VehicleDetail = lazyWithRetry(() => import("./pages/VehicleDetail"));
const Customers = lazyWithRetry(() => import("./pages/Customers"));
const Sales = lazyWithRetry(() => import("./pages/Sales"));
const Inquiries = lazyWithRetry(() => import("./pages/Inquiries"));
const AuthorityToSell = lazyWithRetry(() => import("./pages/AuthorityToSell"));
const SalesAgreement = lazyWithRetry(() => import("./pages/SalesAgreement"));
const PerformanceQuotes = lazyWithRetry(() => import("./pages/PerformanceQuotes"));
const Expenses = lazyWithRetry(() => import("./pages/Expenses"));
const AdvancedReport = lazyWithRetry(() => import("./pages/AdvancedReport"));
const SignCustomer = lazyWithRetry(() => import("./pages/SignCustomer"));
const SignSale = lazyWithRetry(() => import("./pages/SignSale"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const CustomerPortal = lazyWithRetry(() => import("./pages/CustomerPortal"));
const SourceCompanyDetails = lazyWithRetry(() => import("./pages/SourceCompanyDetails"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));

const PageLoader = () => (
  <div className="h-[60vh] w-full flex items-center justify-center">
    <Loader2 className="h-10 w-10 animate-spin text-emerald-500 opacity-20" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/** Blocks protected routes — shows spinner then redirects to /auth if no session. */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

/** Shows a spinner / Auth page while session resolves; redirects to dashboard if already signed in. */
function GuestGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <>{children}</>;          // Show auth page instantly
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Resets the boundary on navigation so one broken page doesn't stick. */
function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Root → always land on sign-in */}
      <Route path="/" element={<Navigate to="/auth" replace />} />

      {/* Public pages */}
      <Route path="/auth"                element={<GuestGuard><Auth /></GuestGuard>} />
      <Route path="/portal"              element={<CustomerPortal />} />
      <Route path="/sign/customer/:id"   element={<SignCustomer />} />
      <Route path="/sign/sale/:id"       element={<SignSale />} />

      {/* Protected pages — inside AuthGuard + AppLayout */}
      <Route path="/*" element={
        <AuthGuard>
          <AppLayout>
            <RouteErrorBoundary>
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/dashboard"         element={<Index />} />
                <Route path="/profile"           element={<Profile />} />
                <Route path="/vehicles"          element={<RoleGuard page="vehicles"><VehiclesList /></RoleGuard>} />
                <Route path="/vehicles/new"      element={<RoleGuard page="vehicles"><VehicleForm /></RoleGuard>} />
                <Route path="/vehicles/:id"      element={<RoleGuard page="vehicles"><VehicleDetail /></RoleGuard>} />
                <Route path="/vehicles/:id/edit" element={<RoleGuard page="vehicles"><VehicleForm /></RoleGuard>} />
                <Route path="/source-company/:name" element={<RoleGuard page="vehicles"><SourceCompanyDetails /></RoleGuard>} />
                <Route path="/customers"         element={<RoleGuard page="customers"><Customers /></RoleGuard>} />
                <Route path="/sales"             element={<RoleGuard page="sales"><Sales /></RoleGuard>} />
                <Route path="/inquiries"         element={<RoleGuard page="inquiries"><Inquiries /></RoleGuard>} />
                <Route path="/authority-to-sell" element={<RoleGuard page="authority-to-sell"><AuthorityToSell /></RoleGuard>} />
                <Route path="/sales-agreement"    element={<RoleGuard page="authority-to-sell"><SalesAgreement /></RoleGuard>} />
                <Route path="/performance-quotes" element={<RoleGuard page="performance-quotes"><PerformanceQuotes /></RoleGuard>} />
                <Route path="/expenses"          element={<RoleGuard page="expenses"><Expenses /></RoleGuard>} />
                <Route path="/report"            element={<RoleGuard page="dashboard"><AdvancedReport /></RoleGuard>} />
                {/* Settings — only admin can see */}
                <Route path="/settings"          element={<AdminGuard><Settings /></AdminGuard>} />
                <Route path="/unauthorized"      element={<Unauthorized />} />
                <Route path="*"                  element={<NotFound />} />
              </Routes>
              </Suspense>
            </RouteErrorBoundary>
          </AppLayout>
        </AuthGuard>
      } />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {/* Single global Realtime listener — must be inside QueryClientProvider */}
          <PermissionsRealtimeSync />
          {/* Keeps A4 document sheets scaled to the screen on phones */}
          <DocumentScaleSync />
          {/* iOS ignores user-scalable=no, so pinch-zoom is blocked here too */}
          <ZoomLock />
          {/* Outer boundary also covers the public routes (/auth, /portal, /sign/*),
              which render lazy pages outside the in-layout Suspense below. */}
          <RouteErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <AppRoutes />
            </Suspense>
          </RouteErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
