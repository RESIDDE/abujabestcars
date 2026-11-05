import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { canAccess, type PageKey, type AppRole } from "@/lib/permissions";
import { Loader2 } from "lucide-react";

interface RoleGuardProps {
  page: PageKey;
  children: React.ReactNode;
}

/**
 * Wraps a protected route. Reads live permissions from Supabase.
 * If the user's role doesn't have view access for this page,
 * redirects to /unauthorized.
 */
export function RoleGuard({ page, children }: RoleGuardProps) {
  const { role, isLoading: authLoading } = useAuth();
  const { permissions, isLoading: permsLoading } = usePermissions();

  // Still resolving auth or permissions — show loader so restricted pages aren't flashed
  if (authLoading || permsLoading) {
    return (
      <div className="h-[60vh] w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500 opacity-20" />
      </div>
    );
  }

  if (!canAccess(role as AppRole | null, page, permissions)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

/**
 * Wraps admin-only routes (e.g. Settings).
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-[60vh] w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500 opacity-20" />
      </div>
    );
  }

  if (role !== "admin") {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
