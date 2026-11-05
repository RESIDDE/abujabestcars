import {
  LayoutDashboard, Car, Users, MessageSquare,
  FileText, FileSignature, Crown, Receipt, BarChart3, LogOut, Zap
} from "lucide-react";
import { NairaIcon } from "@/components/NairaIcon";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { getAccessiblePages, type AppRole, type PageKey } from "@/lib/permissions";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

type NavItem = {
  title: string;
  url: string;
  pageKey: PageKey | "settings";
  icon: React.ComponentType<{ className?: string }>;
};

const ALL_NAV_ITEMS: NavItem[] = [
  { title: "ERP Dashboard",    url: "/dashboard",          pageKey: "dashboard",          icon: LayoutDashboard },
  { title: "Vehicles Inventory", url: "/vehicles",           pageKey: "vehicles",           icon: Car },
  { title: "Customers",        url: "/customers",          pageKey: "customers",          icon: Users },
  { title: "Sales",            url: "/sales",              pageKey: "sales",              icon: (props) => <NairaIcon {...props} /> },
  { title: "Proforma Invoices", url: "/performance-quotes", pageKey: "performance-quotes", icon: FileSignature },
  { title: "Company Expenses", url: "/expenses",           pageKey: "expenses",           icon: Receipt },
  { title: "Inquiries",        url: "/inquiries",          pageKey: "inquiries",          icon: MessageSquare },
  { title: "Auth. Form",       url: "/authority-to-sell",  pageKey: "authority-to-sell",  icon: FileSignature },
  { title: "Sales Agreement",  url: "/sales-agreement",    pageKey: "authority-to-sell",  icon: FileText },
  { title: "Adv. Report",      url: "/report",             pageKey: "dashboard",          icon: BarChart3 },
];

const PREFETCH_MAP: Record<string, () => Promise<any>> = {
  "/dashboard":          () => import("@/pages/Index"),
  "/vehicles":           () => import("@/pages/VehiclesList"),
  "/customers":          () => import("@/pages/Customers"),
  "/sales":              () => import("@/pages/Sales"),
  "/performance-quotes": () => import("@/pages/PerformanceQuotes"),
  "/expenses":           () => import("@/pages/Expenses"),
  "/inquiries":          () => import("@/pages/Inquiries"),
  "/authority-to-sell":  () => import("@/pages/AuthorityToSell"),
  "/sales-agreement":    () => import("@/pages/SalesAgreement"),
  "/report":             () => import("@/pages/AdvancedReport"),
  "/settings":           () => import("@/pages/Settings"),
};

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { role } = useAuth();
  const { permissions } = usePermissions();
  const navigate = useNavigate();

  const isSuperAdmin = role === "admin";

  const accessiblePages = getAccessiblePages(role as AppRole | null, permissions);
  const visibleItems = ALL_NAV_ITEMS.filter((item) =>
    accessiblePages.includes(item.pageKey as PageKey)
  );

  const handleNavClick = () => setOpenMobile(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully.");
    navigate("/auth");
  };

  const handlePrefetch = (url: string) => {
    try {
      PREFETCH_MAP[url]?.();
    } catch (e) {}
  };

  return (
    <Sidebar
      collapsible="icon"
      className="bg-white dark:bg-[#18191c] border-r border-slate-200 dark:border-[#282a32] text-slate-800 dark:text-[#f3f4f6]"
    >
      {/* ── Brand Header ─────────────────────────────────── */}
      <div className={cn(
        "border-b border-slate-200 dark:border-[#282a32] bg-slate-50/80 dark:bg-[#141518]/60 transition-all",
        collapsed ? "py-3 px-1 flex justify-center items-center" : "p-3.5"
      )}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#18191c] border border-slate-200 dark:border-[#d4ff32]/40 flex items-center justify-center shrink-0 shadow-sm dark:shadow-lg dark:shadow-[#d4ff32]/10 overflow-hidden">
              <img src={logo} alt="Abuja Best Cars Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-sm tracking-wide text-slate-900 dark:text-white truncate">
                ABUJA BEST CARS
              </span>
              <span className="text-[10px] text-slate-500 dark:text-[#8e919f] uppercase tracking-wider font-semibold truncate">
                Dealership & Inventory
              </span>
            </div>
          </div>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#18191c] border border-slate-200 dark:border-[#d4ff32]/40 flex items-center justify-center shrink-0 shadow-sm dark:shadow-lg dark:shadow-[#d4ff32]/10 overflow-hidden cursor-pointer">
                <img src={logo} alt="Abuja Best Cars Logo" className="w-full h-full object-cover" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="font-bold text-xs bg-slate-900 text-white dark:bg-white dark:text-black">
              Abuja Best Cars
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* ── Nav ──────────────────────────────────────────── */}
      <SidebarContent className="flex flex-col justify-between h-full py-2">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-slate-400 dark:text-[#6d717f] text-[10px] uppercase tracking-widest font-black px-4 pt-3 pb-2">
              Navigation Menu
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className={cn(collapsed && "items-center gap-1.5")}>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title} className={cn(collapsed && "flex justify-center w-full")}>
                    <div className={cn("py-1", collapsed ? "w-full flex justify-center px-1" : "px-2.5")}>
                      {collapsed ? (
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <NavLink
                              to={item.url}
                              end={item.url === "/dashboard"}
                              onClick={handleNavClick}
                              className="flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-200 text-slate-600 dark:text-[#8e919f] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#23252c] group"
                              activeClassName="bg-[#d4ff32] text-black font-extrabold shadow-lg shadow-[#d4ff32]/25 [&_svg]:text-black [&_svg]:opacity-100"
                              onMouseEnter={() => handlePrefetch(item.url)}
                            >
                              <Icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
                            </NavLink>
                          </TooltipTrigger>
                          <TooltipContent side="right" sideOffset={12} className="font-semibold text-xs bg-slate-900 text-white dark:bg-white dark:text-black shadow-xl">
                            {item.title}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <NavLink
                          to={item.url}
                          end={item.url === "/dashboard"}
                          onClick={handleNavClick}
                          className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 text-slate-600 dark:text-[#8e919f] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#23252c] w-full group"
                          activeClassName="bg-[#d4ff32] text-black font-extrabold shadow-lg shadow-[#d4ff32]/25 [&_svg]:text-black [&_svg]:opacity-100"
                          onMouseEnter={() => handlePrefetch(item.url)}
                        >
                          <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                          <span className="truncate">{item.title}</span>
                        </NavLink>
                      )}
                    </div>
                  </SidebarMenuItem>
                );
              })}

              {/* Settings — only for admin */}
              {isSuperAdmin && (
                <SidebarMenuItem className={cn(collapsed && "flex justify-center w-full")}>
                  <div className={cn("py-1", collapsed ? "w-full flex justify-center px-1" : "px-2.5")}>
                    {collapsed ? (
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <NavLink
                            to="/settings"
                            onClick={handleNavClick}
                            className="flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-200 text-slate-600 dark:text-[#8e919f] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#23252c] group"
                            activeClassName="bg-[#d4ff32] text-black font-extrabold shadow-lg shadow-[#d4ff32]/25 [&_svg]:text-black [&_svg]:opacity-100"
                            onMouseEnter={() => handlePrefetch("/settings")}
                          >
                            <Crown className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
                          </NavLink>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={12} className="font-semibold text-xs bg-slate-900 text-white dark:bg-white dark:text-black shadow-xl">
                          Settings
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <NavLink
                        to="/settings"
                        onClick={handleNavClick}
                        className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 text-slate-600 dark:text-[#8e919f] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#23252c] w-full group"
                        activeClassName="bg-[#d4ff32] text-black font-extrabold shadow-lg shadow-[#d4ff32]/25 [&_svg]:text-black [&_svg]:opacity-100"
                        onMouseEnter={() => handlePrefetch("/settings")}
                      >
                        <Crown className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                        <span className="truncate">Settings</span>
                      </NavLink>
                    )}
                  </div>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Sign Out Button at Bottom ──────────────────── */}
        <div className={cn(
          "border-t border-slate-200 dark:border-[#282a32] mt-auto transition-all",
          collapsed ? "py-3 px-1 flex justify-center" : "p-3"
        )}>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="w-11 h-11 flex items-center justify-center rounded-2xl text-slate-600 dark:text-[#8e919f] hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
                  aria-label="Sign Out"
                >
                  <LogOut className="h-5 w-5 shrink-0 text-destructive/80" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="font-semibold text-xs text-destructive bg-slate-900 dark:bg-white shadow-xl">
                Sign Out
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 dark:text-[#8e919f] hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4 shrink-0 text-destructive/80" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
