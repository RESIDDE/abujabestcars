import React, { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BackButton } from "@/components/BackButton";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { canAccess, type AppRole } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Search, MessageSquare, Bell } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, role } = useAuth();
  const { permissions } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully.");
    navigate("/auth");
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/vehicles?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Admin";

  const canViewVehicles = canAccess(role as AppRole | null, "vehicles", permissions);
  const canViewInquiries = canAccess(role as AppRole | null, "inquiries", permissions);
  const canViewSales = canAccess(role as AppRole | null, "sales", permissions);

  return (
    <SidebarProvider>
      <div className="h-dvh flex w-full bg-slate-100 dark:bg-[#141518] text-foreground">
        <AppSidebar />

        {/* The inset main stage matching the dashboard rounded frame */}
        <div className="flex-1 flex flex-col min-w-0 lg:rounded-l-[2rem] lg:border-l lg:border-y lg:my-2 lg:mr-2 shadow-xl dark:shadow-2xl relative overflow-hidden transition-all duration-300 bg-white dark:bg-[#16171a] border-slate-200 dark:border-[#282a32]">
          
          {/* ── Unified Dashboard Header (Brand Zap, Search Pill, Actions & Gold Avatar) ── */}
          <header className="sticky top-0 z-30 h-16 flex items-center px-4 sm:px-6 gap-3 print:hidden bg-white/90 dark:bg-[#18191c]/90 backdrop-blur-xl border-b border-slate-200 dark:border-[#282a32]">
            {/* Sidebar toggle */}
            <SidebarTrigger className="mr-1 -ml-1 rounded-full p-2 hover:bg-slate-100 dark:hover:bg-[#24262c] text-slate-500 dark:text-[#8e919f] hover:text-slate-900 dark:hover:text-white transition-colors" />

            {/* Back — on every page but the dashboard, which is where back leads */}
            {location.pathname !== "/dashboard" && <BackButton />}

            {/* Neon Brand Lightning Bolt */}
            <div
              onClick={() => navigate("/dashboard")}
              className="w-9 h-9 rounded-2xl bg-slate-100 dark:bg-[#24262c] border border-slate-200 dark:border-[#d4ff32]/30 flex items-center justify-center shrink-0 cursor-pointer shadow-sm hover:border-[#a3e600] dark:hover:border-[#d4ff32] transition-colors"
              title="Abuja Best Cars Dashboard"
            >
              <Zap className="w-5 h-5 text-[#65a30d] dark:text-[#d4ff32] fill-current" />
            </div>

            {/* Pill Search Input */}
            {canViewVehicles && (
              <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md mx-2 hidden sm:block">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-400 dark:text-[#8a8d98]" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Start Search Here..."
                  className="w-full h-10 bg-slate-100 dark:bg-[#24262c] text-xs text-slate-900 dark:text-[#f0f1f5] placeholder:text-slate-400 dark:placeholder-[#7d808c] pl-11 pr-4 rounded-full border border-slate-200 dark:border-transparent focus:border-slate-300 dark:focus:border-[#424652] focus:bg-white dark:focus:bg-[#282a32] focus:outline-none transition-all shadow-inner"
                />
              </form>
            )}

            {/* Right: Currency, Inquiries, Notifications, ThemeToggle, Gold Ring Profile Avatar */}
            <div className="flex items-center gap-2.5 sm:gap-3 ml-auto shrink-0">
              {/* Currency Badge: Naira */}
              <div
                title="Active Dealership Currency (NGN ₦)"
                className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-[#24262c] border border-slate-200 dark:border-[#33363f] text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 shadow-sm select-none"
              >
                <span className="text-[#65a30d] dark:text-[#d4ff32] text-sm font-black">₦</span>
                <span>NGN</span>
              </div>

              {/* Inquiries Chat */}
              {canViewInquiries && (
                <button
                  onClick={() => navigate("/inquiries")}
                  title="Customer Inquiries"
                  className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#24262c] border border-slate-200 dark:border-[#31343c] hover:border-slate-300 dark:hover:border-[#434652] flex items-center justify-center text-slate-600 dark:text-[#c2c5d1] hover:text-slate-900 dark:hover:text-white transition-colors relative shadow-sm"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              )}

              {/* Notifications */}
              {canViewSales && (
                <button
                  onClick={() => navigate("/sales")}
                  title="Sales Transactions"
                  className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#24262c] border border-slate-200 dark:border-[#31343c] hover:border-slate-300 dark:hover:border-[#434652] flex items-center justify-center text-slate-600 dark:text-[#c2c5d1] hover:text-slate-900 dark:hover:text-white transition-colors relative shadow-sm"
                >
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#ef4444] ring-2 ring-slate-100 dark:ring-[#24262c]" />
                </button>
              )}

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* User Profile Avatar with Gold Ring */}
              <div
                onClick={() => navigate("/profile")}
                title="User Profile"
                className="relative group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-[#d4a017] via-[#f7d070] to-[#f59e0b] shadow-md shadow-[#f59e0b]/10 transition-transform group-hover:scale-105">
                  <div className="w-full h-full rounded-full overflow-hidden bg-slate-100 dark:bg-[#1c1d22] flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white">
                    {profile?.avatar_url ? (
                      <img
                        src={`${profile.avatar_url}${profile.avatar_url.includes('?') ? '&' : '?'}t=${new Date(profile.updated_at || Date.now()).getTime()}`}
                        className="w-full h-full object-cover"
                        alt={displayName}
                      />
                    ) : (
                      <span>{displayName.substring(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main content pane */}
          <main className="flex-1 p-3 sm:p-5 md:p-6 lg:p-8 overflow-auto [scrollbar-gutter:stable] custom-scrollbar">
            <div className="mx-auto max-w-7xl h-full w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
