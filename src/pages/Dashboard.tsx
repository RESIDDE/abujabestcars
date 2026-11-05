import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Car, Users, DollarSign, Wrench, PlusCircle, Search, ChevronRight,
  TrendingUp, Calendar, ArrowUpRight, BarChart3, Clock, PieChart as PieChartIcon,
  FileSignature, FileText, Building2, Printer, Download, ListFilter, Receipt
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { canAccess, canEdit, canCreate, getAccessiblePages, type AppRole, ALL_PAGES } from "@/lib/permissions";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, AreaChart, Area
} from "recharts";
import { differenceInDays } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportToExcel, printTable } from "@/lib/exportHelpers";
import { logAction } from "@/lib/logger";
import { toast } from "sonner";
import { ERPInventoryDashboardView } from "@/components/dashboard/MarketingDashboardView";

const COLORS = ["hsl(var(--primary))", "hsl(142 76% 36%)", "hsl(0 84% 60%)", "hsl(262 83% 58%)", "hsl(38 92% 50%)", "hsl(199 89% 48%)"];

/* ── Custom theme-aware tooltip for recharts ─────────────────────────── */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 rounded-xl min-w-[150px] z-50 bg-popover/95 text-popover-foreground border border-border shadow-xl backdrop-blur-md">
        <p className="font-semibold text-foreground mb-1 text-sm">{label}</p>
        {payload.map((entry: any, index: number) => {
          let val = entry.value;
          if (entry.name.toLowerCase().includes('revenue') || entry.name.toLowerCase().includes('price') || entry.name.toLowerCase().includes('profit')) {
            val = `₦${entry.value.toLocaleString()}`;
          }
          if (entry.name.toLowerCase().includes('time')) {
            val = `${entry.value} days`;
          }
          return (
            <p key={index} className="text-sm font-medium flex justify-between gap-4" style={{ color: entry.color || entry.fill }}>
              <span className="text-muted-foreground">{entry.name}:</span> <span>{val}</span>
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

/* ── Welcome Landing (non-admin users) ───────────────────────── */
const WelcomeLanding = ({ profile, user, role, permissions }: any) => {
  const accessibleKeys = getAccessiblePages(role as AppRole, permissions);
  const assignedPages = ALL_PAGES.filter(p => accessibleKeys.includes(p.key) && p.key !== 'dashboard');
  const displayName = profile?.display_name || user?.email?.split('@')[0] || "User";
  const initials = profile?.display_name?.substring(0, 2).toUpperCase() || user?.email?.substring(0, 2).toUpperCase() || "??";
  const isPending = !role;

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] py-12 animate-fade-up">
        <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black text-amber-500 mb-6 overflow-hidden border-4 border-amber-500/30 bg-amber-500/10 shadow-lg shadow-amber-500/10">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
          ) : initials}
        </div>

        <div className="inline-flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-6 bg-amber-500/10 border border-amber-500/20">
          <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          Pending Approval
        </div>

        <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4 text-center text-foreground">
          Welcome, <span className="text-amber-500">{displayName}</span>!
        </h1>
        <p className="text-base text-muted-foreground max-w-md leading-relaxed text-center mb-8">
          Your account has been created successfully. A <strong className="text-foreground">Super Admin</strong> needs to review and assign you a role before you can access the system.
        </p>

        <div className="p-6 max-w-sm w-full space-y-4 rounded-3xl bg-card border border-border/80 shadow-md">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 text-center">What happens next?</p>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3"><span className="text-amber-500 shrink-0 mt-0.5">1.</span><span>A Super Admin logs in and opens <strong className="text-foreground">Settings → Team</strong>.</span></div>
            <div className="flex items-start gap-3"><span className="text-amber-500 shrink-0 mt-0.5">2.</span><span>They find your name and assign you a role (Admin, Sales, or Mechanic).</span></div>
            <div className="flex items-start gap-3"><span className="text-amber-500 shrink-0 mt-0.5">3.</span><span>Log out and log back in — your modules will appear!</span></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 animate-fade-up">
      <div className="w-32 h-32 rounded-full flex items-center justify-center text-4xl font-black text-primary mb-8 overflow-hidden border-4 border-primary/20 shadow-xl shadow-primary/20">
        {profile?.avatar_url ? (
          <img src={`${profile.avatar_url}${profile.avatar_url.includes('?') ? '&' : '?'}t=${new Date(profile.updated_at || Date.now()).getTime()}`} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>

      <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 text-center text-foreground">
        Welcome, {displayName}!
      </h1>
      <p className="text-base text-muted-foreground max-w-2xl mb-12 leading-relaxed text-center">
        You are currently logged in as{" "}
        <span className="text-foreground font-bold uppercase tracking-widest text-sm px-2.5 py-1 rounded-lg bg-muted border border-border">
          {role?.replace('_', ' ')}
        </span>
        {" Below are the modules you have been assigned to manage."}
      </p>

      {assignedPages.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-4xl">
          {assignedPages.map((page) => (
            <Link
              key={page.key}
              to={page.path}
              className="group p-6 flex flex-col items-center gap-4 transition-all duration-300 rounded-3xl bg-card border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="p-4 bg-primary/10 rounded-2xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <ChevronRight className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg text-foreground">{page.label}</h3>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Access Granted</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { role, user, profile } = useAuth();
  const { permissions } = usePermissions();
  const hasVehicleEdit = canEdit(role, "vehicles", permissions);
  const canAddVehicle = canCreate(role, "vehicles", permissions);
  const [search, setSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [greeting, setGreeting] = useState("Welcome back");
  const [showDealershipView, setShowDealershipView] = useState(false);

  const isAdmin = role === "admin" || role === 'admin';

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  /* ── Data queries (fast cached) ─────────────────────────── */
  const FAST_QUERY = { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000, refetchOnWindowFocus: false };

  const { data: vehicles = [], isLoading: loadingV } = useQuery({
    queryKey: ["dash-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").eq("inventory_type", "Lamido");
      if (error) { toast.error("Vehicles query failed: " + error.message); throw error; }
      return data;
    },
    ...FAST_QUERY,
  });

  const { data: resaleVehicles = [] } = useQuery({
    queryKey: ["dash-resale-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("id, status, created_at").eq("inventory_type", "resale");
      if (error) throw error;
      return data;
    },
    ...FAST_QUERY,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["dash-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id");
      if (error) throw error;
      return data;
    },
    ...FAST_QUERY,
  });

  const { data: sales = [], isLoading: loadingS } = useQuery({
    queryKey: ["dash-sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*, vehicles(make, model, cost_price)");
      if (error) throw error;
      return data;
    },
    ...FAST_QUERY,
  });

  const { data: performanceQuotes = [] } = useQuery({
    queryKey: ["dash-perf-quotes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("performance_quotes").select("id, total_amount, created_at");
      if (error) return [];
      return (data || []) as any[];
    },
    ...FAST_QUERY,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["dash-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*");
      if (error) return [];
      return data || [];
    },
    ...FAST_QUERY,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["dash-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("id, amount, created_at");
      if (error) return [];
      return data || [];
    },
    ...FAST_QUERY,
  });

  const { data: inquiries = [] } = useQuery({
    queryKey: ["dash-inquiries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inquiries").select("*");
      if (error) return [];
      return data || [];
    },
    ...FAST_QUERY,
  });

  /* ── Computed values ──────────────────────────────────────── */
  const totalSalesRevenue = sales.reduce((sum, s) => sum + Number(s.sale_price || 0), 0);
  const totalRevenue = totalSalesRevenue;

  const totalSalesProfit = sales.reduce((sum, s) => {
    const cost = Number((s as any).vehicles?.cost_price || 0);
    const sale = Number(s.sale_price || 0);
    return sum + (sale - cost);
  }, 0);

  const openInvoicesAmount = invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + Number(i.total || 0), 0);
  const pendingInquiriesCount = inquiries.filter(i => i.status === 'pending').length;

  const monthlyTimeline = useMemo(() => {
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const label = d.toLocaleString("default", { month: "short" });
      const y = d.getFullYear(); const m = d.getMonth();
      const sRev = sales.filter(s => new Date(s.sale_date || s.created_at).getMonth() === m && new Date(s.sale_date || s.created_at).getFullYear() === y).reduce((sum, s) => sum + Number(s.sale_price || 0), 0);
      months.push({ name: label, "Sales Revenue": sRev, "Total Revenue": sRev });
    }
    return months;
  }, [sales]);

  const inventoryAging = useMemo(() => {
    const unsold = vehicles.filter(v => v.status !== 'sold');
    const aging = { "0-30 days": 0, "31-60 days": 0, "61-90 days": 0, "90+ days": 0 };
    unsold.forEach(v => {
      const days = differenceInDays(new Date(), new Date(v.created_at));
      if (days <= 30) aging["0-30 days"]++;
      else if (days <= 60) aging["31-60 days"]++;
      else if (days <= 90) aging["61-90 days"]++;
      else aging["90+ days"]++;
    });
    return Object.entries(aging).map(([name, Count]) => ({ name, Count }));
  }, [vehicles]);

  const profitMarginData = useMemo(() => {
    return (sales || []).slice(0, 6).map((s: any) => {
      const cost = Number(s.vehicles?.cost_price || 0);
      const sale = Number(s.sale_price || 0);
      const profit = Math.max(0, sale - cost);
      const name = s.vehicles ? `${s.vehicles.make} ${s.vehicles.model}` : "Sale";
      return { name, Cost: cost, Profit: profit };
    });
  }, [sales]);

  const stockSplit = useMemo(() => {
    const sold = vehicles.filter(v => v.status === 'sold' || v.status === 'Sold').length;
    const inStock = vehicles.filter(v => v.status !== 'sold' && v.status !== 'Sold').length;
    return [
      { name: "In Stock", value: inStock },
      { name: "Sold", value: sold },
    ].filter(x => x.value > 0);
  }, [vehicles]);

  const topMakes = useMemo(() => {
    const makes = (sales || []).reduce((acc, s) => {
      const make = (s as any).vehicles?.make || 'Unknown';
      acc[make] = (acc[make] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const entries = Object.entries(makes) as [string, number][];
    return entries.sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [sales]);

  const sourceCompanyStats = useMemo(() => {
    const stats: Record<string, { inventory: number, total: number }> = {};
    vehicles.forEach(v => {
      const company = v.source_company || "Unknown";
      if (!stats[company]) stats[company] = { inventory: 0, total: 0 };
      stats[company].total++;
      if (v.status !== 'Sold') stats[company].inventory++;
    });
    return Object.entries(stats).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.inventory - a.inventory);
  }, [vehicles]);

  const filteredCompanyStats = sourceCompanyStats.filter(s => s.name.toLowerCase().includes(companySearch.toLowerCase()));

  const filteredVehicles = vehicles
    .filter((v) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (v.make.toLowerCase().includes(q) || v.model.toLowerCase().includes(q) || v.year.toString().includes(q));
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const currentDateInfo = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const hasDashboardAccess = canAccess(role as AppRole, "dashboard", permissions);
  if (!hasDashboardAccess) {
    return <WelcomeLanding profile={profile} user={user} role={role} permissions={permissions} />;
  }

  /* ═══ RENDER ════════════════════════════════════════════════ */
  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10 animate-fade-up">

      {/* ── Abuja Best Cars ERP & Dealership Inventory Dashboard ── */}
      <ERPInventoryDashboardView
        vehicles={vehicles}
        sales={sales}
        customers={customers}
        expenses={expenses}
        inquiries={inquiries}
        profile={profile}
        user={user}
        showDealershipView={showDealershipView}
        onToggleDealershipView={() => setShowDealershipView(!showDealershipView)}
      />

      {/* SVG gradient defs for recharts */}
      <svg width="0" height="0" aria-hidden="true">
        <defs>
          <linearGradient id="splitSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.6} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
          </linearGradient>
        </defs>
      </svg>

      {/* ── Optional Expandable Dealership Operations View ── */}
      {showDealershipView && (
        <div className="space-y-8 pt-4 border-t border-border/80 animate-in fade-in slide-in-from-top-4 duration-300">
          {/* ── Compact Welcome Header ───────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{currentDateInfo}</span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                Dealership Operations & Telemetry
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Physical inventory status, profit margins, aging and sourced suppliers
              </p>
            </div>

        {canAddVehicle && (
          <Button
            asChild
            size="sm"
            className="rounded-xl shadow-sm hover:shadow-md transition-all group shrink-0 h-10 px-5 text-xs font-semibold"
          >
            <Link to="/vehicles/new">
              <PlusCircle className="mr-2 h-4 w-4 group-hover:rotate-90 transition-transform duration-300" />
              Add Vehicle
            </Link>
          </Button>
        )}
      </div>

      {/* ── Loading skeleton ───────────────────────────────────── */}
      {(loadingV || loadingS) ? (
        <div className="h-64 rounded-3xl animate-pulse bg-card border border-border" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-4 md:gap-5 auto-rows-max">

          {/* ══ LEFT MAIN PANEL — 8 cols ══════════════════════════ */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-5">

            {/* Total Revenue — hero card */}
            <Link to="/sales" className="md:col-span-6 group">
              <div className="bento-card p-6 sm:p-8 flex flex-col justify-between min-h-[160px] group-hover:scale-[1.01]">
                <div className="flex justify-between items-start z-10 relative">
                  <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground px-2.5 py-1 rounded-full bg-muted border border-border/60">
                    <TrendingUp className="w-3 h-3 text-emerald-500" /> Total Revenue
                  </div>
                </div>
                <div className="mt-6 z-10 relative">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Company Lifetime Revenue</p>
                  <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">₦{totalRevenue.toLocaleString()}</h2>
                </div>
              </div>
            </Link>

            {/* Sales Revenue */}
            <Link to="/sales" className="md:col-span-3 group">
              <div className="bento-card p-5 sm:p-6 flex flex-col justify-between min-h-[130px] group-hover:scale-[1.02]">
                <div className="p-2.5 w-fit rounded-xl mb-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div className="z-10 relative">
                  <h2 className="text-xl sm:text-2xl font-black text-foreground">₦{totalSalesRevenue.toLocaleString()}</h2>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1.5 font-bold">Sales Revenue</p>
                </div>
              </div>
            </Link>

            {/* Total Customers */}
            <Link to="/customers" className="md:col-span-3 group">
              <div className="bento-card p-5 sm:p-6 flex flex-col justify-between min-h-[130px] group-hover:scale-[1.02]">
                <div className="p-2.5 w-fit rounded-xl mb-4 bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Users className="h-5 w-5" />
                </div>
                <div className="z-10 relative">
                  <h2 className="text-xl sm:text-2xl font-black text-foreground">{customers.length}</h2>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1.5 font-bold">Total Customers</p>
                </div>
              </div>
            </Link>

            {/* Inquiries */}
            <Link to="/inquiries" className="md:col-span-3 group">
              <div className="bento-card p-5 flex flex-col justify-between min-h-[130px] group-hover:scale-[1.02]">
                <div className="p-2 w-fit rounded-xl mb-3 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Search className="h-5 w-5" />
                </div>
                <div className="z-10 relative">
                  <h2 className="text-xl font-black text-foreground">{pendingInquiriesCount}</h2>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 font-bold">Inquiries</p>
                </div>
              </div>
            </Link>

            {/* Perf. Quotes */}
            <Link to="/performance-quotes" className="md:col-span-3 group">
              <div className="bento-card p-5 flex flex-col justify-between min-h-[130px] group-hover:scale-[1.02]">
                <div className="p-2 w-fit rounded-xl mb-3 bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <FileSignature className="h-5 w-5" />
                </div>
                <div className="z-10 relative">
                  <h2 className="text-xl font-black text-foreground">{performanceQuotes.length}</h2>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 font-bold">Perf. Quotes</p>
                </div>
              </div>
            </Link>

            {/* Revenue Growth Chart */}
            <div className="bento-card md:col-span-4 p-6 flex flex-col min-h-[350px]">
              <div className="mb-5 flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-500" /> Revenue Growth
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Vehicle sales revenue — last 6 months</p>
                </div>
              </div>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTimeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGradSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontFamily: "Poppins" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontFamily: "Poppins" }} tickLine={false} axisLine={false} tickFormatter={(v) => `₦${(v / 1000)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="Sales Revenue" stroke="hsl(var(--primary))" fill="url(#areaGradSales)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Inventory Aging */}
            <div className="bento-card md:col-span-2 p-6 flex flex-col min-h-[280px]">
              <h3 className="font-bold text-foreground flex items-center gap-2 mb-1">
                <Car className="w-4 h-4 text-sky-500" /> Inventory Aging
              </h3>
              <p className="text-xs text-muted-foreground mb-4">Time in stock for unsold vehicles</p>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={inventoryAging} margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontFamily: "Poppins" }} tickLine={false} axisLine={false} width={80} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
                    <Bar dataKey="Count" fill="hsl(199 89% 48%)" radius={[0, 4, 4, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stock Status Pie */}
            <div className="bento-card md:col-span-2 p-5 flex flex-col items-center min-h-[280px]">
              <h3 className="font-bold text-sm self-start mb-0 w-full text-foreground flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-primary" /> Stock Split
              </h3>
              {stockSplit.length > 0 ? (
                <div className="w-full h-full min-h-[200px] flex items-center justify-center relative">
                  <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Total</span>
                    <span className="text-lg font-black text-foreground">{vehicles.length}</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stockSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={82} paddingAngle={4}>
                        {stockSplit.map((_, i) => <Cell key={i} fill={i === 0 ? "hsl(var(--primary))" : "hsl(142 76% 36%)"} stroke="none" />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-muted-foreground mt-10">No data yet</p>}
            </div>

            {/* Profit Margins */}
            <div className="bento-card md:col-span-4 p-6 flex flex-col min-h-[280px]">
              <h3 className="font-bold text-foreground flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-emerald-500" /> Profit Margins
              </h3>
              <p className="text-xs text-muted-foreground mb-4">Cost vs Profit breakdown for recent sales</p>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitMarginData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontFamily: "Poppins" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontFamily: "Poppins" }} tickLine={false} axisLine={false} tickFormatter={(v) => `₦${(v / 1000)}k`} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
                    <Bar dataKey="Cost"   stackId="a" fill="hsl(var(--muted))" barSize={32} radius={[0, 0, 4, 4]} />
                    <Bar dataKey="Profit" stackId="a" fill="hsl(142 76% 36%)"  barSize={32} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ══ RIGHT SIDEBAR PANEL — 4 cols ══════════════════════ */}
          <div className="lg:col-span-4 flex flex-col gap-4 md:gap-5">

            {/* Top Brands Sold */}
            <div className="bento-card p-6">
              <h3 className="font-bold text-foreground mb-5">Top Brands Sold</h3>
              <div className="space-y-4">
                {topMakes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sales yet.</p>
                ) : topMakes.map(([make, count], idx) => (
                  <div key={make} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs"
                        style={idx === 0
                          ? { background: "rgba(245,158,11,0.15)", color: "#f59e0b" }
                          : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                        }
                      >
                        #{idx + 1}
                      </div>
                      <span className="font-semibold text-foreground/90">{make}</span>
                    </div>
                    <span className="text-sm font-bold text-muted-foreground">{count} sold</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { to: "/vehicles",        Icon: Car,       count: vehicles.length,       label: "Vehicles Stock" },
                { to: "/resale-vehicles", Icon: Car,       count: resaleVehicles.length,  label: "Resale Stock" },
                { to: "/customers",       Icon: Users,     count: customers.length,       label: "Customers" },
                { to: "/sales",           Icon: DollarSign,count: sales.length,           label: "Sales" },
              ].map(({ to, Icon, count, label }) => (
                <Link key={to} to={to} className="group transition-all duration-300 hover:scale-[1.03]">
                  <div className="bento-card p-5 flex flex-col h-full">
                    <div className="p-2.5 w-fit rounded-xl mb-3 group-hover:scale-110 transition-transform bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-2xl font-black text-foreground">{count}</h3>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mt-0.5">{label}</p>
                  </div>
                </Link>
              ))}

              {/* Expenses — full width */}
              <Link to="/expenses" className="col-span-2 group transition-all duration-300 hover:scale-[1.01]">
                <div className="bento-card p-5 flex flex-col">
                  <div className="p-2.5 w-fit rounded-xl mb-3 group-hover:scale-110 transition-transform bg-rose-500/10 text-rose-500">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <h3 className="text-2xl font-black text-foreground">{expenses.length}</h3>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mt-0.5">Company Expenses Logged</p>
                </div>
              </Link>
            </div>

            {/* Recent Imports */}
            <div className="bento-card flex flex-col overflow-hidden">
              <div className="p-5 flex items-center justify-between border-b border-border/60 bg-muted/20">
                <h3 className="font-semibold text-foreground">Recent Imports</h3>
              </div>
              <div className="p-3">
                {filteredVehicles.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-8">Inventory is empty.</p>
                ) : (
                  <div className="space-y-1.5">
                    {filteredVehicles.map((v) => (
                      <Link
                        key={v.id}
                        to={`/vehicles/${v.id}`}
                        className="flex items-center gap-3 rounded-xl p-3 transition-all group hover:bg-muted/50 border border-transparent hover:border-border/60"
                      >
                        <div className="p-2 rounded-xl shrink-0 bg-muted text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                          <Car className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground/90 truncate">{v.year} {v.make} {v.model}</p>
                          <p className="text-[11px] text-muted-foreground uppercase">{v.status || "In Stock"}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Inquiries */}
            <div className="bento-card flex flex-col overflow-hidden">
              <div className="p-5 flex items-center justify-between border-b border-border/60 bg-muted/20">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                    <Search className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold text-foreground">Recent Inquiries</h3>
                </div>
                <Link to="/inquiries" className="text-xs text-primary hover:underline font-bold">View All</Link>
              </div>
              <div className="p-3">
                {inquiries.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-8">No inquiries found.</p>
                ) : (
                  <div className="space-y-1.5">
                    {inquiries.slice(0, 3).map((inq: any) => (
                      <div key={inq.id} className="flex flex-col gap-1 rounded-xl p-3 bg-muted/30 border border-border/60">
                        <div className="flex justify-between items-start">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${inq.status === 'pending' ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10' : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'}`}>
                            {inq.status}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{new Date(inq.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{inq.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sourced Companies Inventory */}
            <div className="bento-card flex flex-col overflow-hidden">
              <div className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border/60 bg-muted/20">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-sky-500/10 text-sky-500">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold text-foreground">Sourced Companies</h3>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-40">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search company..."
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      className="pl-8 h-8 rounded-lg text-xs bg-background border-border placeholder:text-muted-foreground"
                    />
                  </div>
                  <Button variant="outline" size="sm" className="h-8 rounded-lg border-border text-foreground hover:bg-muted" onClick={() => {
                    logAction("EXPORT", "Dashboard Sourced Companies", "bulk", { format: "Excel", count: filteredCompanyStats.length });
                    exportToExcel(filteredCompanyStats, "sourced_companies_inventory");
                  }}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 rounded-lg border-border text-foreground hover:bg-muted" onClick={() => {
                    logAction("PRINT", "Dashboard Sourced Companies", "bulk", { count: filteredCompanyStats.length });
                    printTable("Sourced Companies Inventory", filteredCompanyStats, [{ key: 'name', label: 'Company' }, { key: 'inventory', label: 'In Stock' }, { key: 'total', label: 'Total Sourced' }]);
                  }}>
                    <Printer className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-b border-border/60 hover:bg-transparent">
                      <TableHead className="text-[11px] font-black uppercase tracking-wider h-10 px-5 text-muted-foreground">Company Name</TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-wider h-10 text-center text-muted-foreground">In Stock</TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-wider h-10 text-center text-muted-foreground">Total Sourced</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanyStats.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-8 text-sm text-muted-foreground">No companies found.</TableCell></TableRow>
                    ) : (
                      filteredCompanyStats.map((s) => (
                        <TableRow key={s.name} className="border-b border-border/40 hover:bg-muted/40 transition-colors">
                          <TableCell className="px-5 py-3">
                            <Link to={`/source-company/${encodeURIComponent(s.name)}`} className="font-semibold text-sm text-primary hover:underline">
                              {s.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-emerald-600 dark:text-emerald-400 text-xs font-black bg-emerald-500/10 border border-emerald-500/20">
                              {s.inventory}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-xs font-medium text-muted-foreground">{s.total}</span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

        </div>
      )}
        </div>
      )}
    </div>
  );
}
