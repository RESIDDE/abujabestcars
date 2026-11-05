import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, differenceInDays } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, AreaChart, Area
} from "recharts";
import {
  TrendingUp, Car, Users, DollarSign, Wrench, Receipt,
  FileSignature, FileText, BarChart3, ShieldCheck,
  AlertTriangle, CheckCircle2, Clock, Download, Printer, RefreshCw,
  ArrowUpRight, ArrowDownRight, Target, Calendar,
  Layers, Activity, PieChart as PieChartIcon, CreditCard,
  Banknote, ClipboardList, Star, Trophy, AlertCircle, Info,
  MessageSquare, Building2, ChevronDown, FileSpreadsheet, Sheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportToExcel, exportToCSV, printHTMLDocument, exportHTMLToPDF } from "@/lib/exportHelpers";
import { toast } from "sonner";
import { logAction } from "@/lib/logger";

// ─── Color Palette ────────────────────────────────────────────────────────────
const CHART_COLORS = [
  "hsl(38 92% 50%)",   // amber
  "hsl(142 76% 36%)",  // emerald
  "hsl(199 89% 48%)",  // sky
  "hsl(262 83% 58%)",  // violet
  "hsl(0 84% 60%)",    // red
  "hsl(280 65% 60%)",  // purple
  "hsl(24 95% 53%)",   // orange
  "hsl(217 91% 60%)",  // blue
];

// ─── Tooltip ─────────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel p-3 border border-white/20 shadow-2xl rounded-xl z-50 min-w-[160px]">
      <p className="font-semibold text-foreground mb-1 text-sm">{label}</p>
      {payload.map((e: any, i: number) => {
        let val = e.value;
        if (typeof val === "number" && (e.name?.includes("₦") || e.name?.toLowerCase().includes("revenue") || e.name?.toLowerCase().includes("amount") || e.name?.toLowerCase().includes("profit") || e.name?.toLowerCase().includes("expense") || e.name?.toLowerCase().includes("cost"))) {
          val = `₦${val.toLocaleString()}`;
        }
        return (
          <p key={i} className="text-xs font-medium flex justify-between gap-4" style={{ color: e.color || e.fill }}>
            <span>{e.name}:</span> <span className="font-bold">{val}</span>
          </p>
        );
      })}
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
// ─── Sparkline ────────────────────────────────────────────────────────────────
/** Six-month shape behind a headline number. Decorative: the figure carries the value. */
function Spark({ values }: { values: number[] }) {
  if (!values.length) return <div className="h-[26px]" />;
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  const W = 120, H = 26, pad = 3;
  const pts = values.map((v, i) => [
    (i * W) / Math.max(values.length - 1, 1),
    H - pad - ((v - lo) / span) * (H - pad * 2),
  ]);
  const d = pts.map((pt, i) => `${i ? "L" : "M"}${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" className="block w-full h-[26px] mt-2.5">
      <path d={d} fill="none" stroke="var(--chart-ink)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r={2.6} fill="var(--chart-rev)" />
    </svg>
  );
}

// ─── Headline figure ──────────────────────────────────────────────────────────
function Figure({ label, value, delta, deltaSuffix = "%", deltaNote, spark }: {
  label: string; value: string; delta?: number; deltaSuffix?: string; deltaNote?: string; spark?: number[];
}) {
  const up = delta !== undefined && delta >= 0;
  return (
    <div className="bg-card p-4 min-w-0">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1.5">{label}</span>
      <span className="block font-heading font-bold tracking-tight text-xl sm:text-2xl lg:text-[27px] leading-none tabular-nums">{value}</span>
      {delta !== undefined ? (
        <span className={`flex items-center gap-1.5 mt-2 text-xs font-semibold ${up ? "text-emerald-500" : "text-red-500"}`}>
          {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          <span className="tabular-nums">{Math.abs(delta).toFixed(1)}{deltaSuffix}</span>
          {deltaNote && <span className="font-medium text-muted-foreground">{deltaNote}</span>}
        </span>
      ) : (
        <span className="block mt-2 text-xs font-medium text-muted-foreground/70">Last 6 months</span>
      )}
      {spark && <Spark values={spark} />}
    </div>
  );
}

// ─── Compact metric strip ─────────────────────────────────────────────────────
/** Replaces the old wall of large tiles: secondary numbers, read at a glance. */
function Strip({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden border border-border mb-4">
      {items.map(([k, v]) => (
        <div key={k} className="bg-card px-3.5 py-3 min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1">{k}</span>
          <span className="font-heading font-bold text-lg tracking-tight tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Ranked bar list ──────────────────────────────────────────────────────────
/** Magnitude down a list: one hue, weight carried by length and opacity. */
function BarList({ rows, format: fmt }: { rows: { name: string; value: number }[]; format?: (n: number) => string }) {
  if (!rows.length) return <p className="text-xs text-muted-foreground py-6 text-center">No data for this period</p>;
  const max = Math.max(...rows.map(r => r.value)) || 1;
  return (
    <div className="flex flex-col gap-2.5 mt-3.5">
      {rows.map(r => (
        <div key={r.name} className="grid grid-cols-[minmax(68px,110px)_1fr_auto] items-center gap-3 text-[12.5px]">
          <span className="text-muted-foreground font-medium truncate capitalize">{r.name}</span>
          <span className="h-2.5 rounded-full bg-muted/60 overflow-hidden min-w-0">
            <span className="block h-full rounded-full" style={{
              width: `${(r.value / max) * 100}%`,
              backgroundColor: "var(--chart-rev)",
              opacity: 0.45 + 0.55 * (r.value / max),
            }} />
          </span>
          <span className="font-semibold tabular-nums">{fmt ? fmt(r.value) : r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Insight row ──────────────────────────────────────────────────────────────
function Insight({ type, message }: { type: "good" | "warn" | "info"; message: string }) {
  const chip = {
    good: { cls: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400", word: "Good" },
    warn: { cls: "bg-amber-500/12 text-amber-600 dark:text-amber-400", word: "Watch" },
    info: { cls: "bg-muted text-muted-foreground", word: "Data" },
  }[type];
  return (
    <li className="flex items-start gap-2.5 text-[13px] leading-relaxed">
      <span className={`shrink-0 mt-px rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.05em] ${chip.cls}`}>{chip.word}</span>
      <span className="text-foreground/90">{message}</span>
    </li>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return { label: format(d, "MMMM yyyy"), value: format(d, "yyyy-MM") };
});

export default function AdvancedReport() {
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState('inventory');
  const [showTrendTable, setShowTrendTable] = useState(false);
  const generatedAt = format(new Date(), "dd MMM yyyy, HH:mm");

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: vehicles = [], isLoading: vLoading } = useQuery({
    queryKey: ["report_vehicles", refreshKey],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: customers = [], isLoading: cuLoading } = useQuery({
    queryKey: ["report_customers", refreshKey],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: sales = [], isLoading: saLoading } = useQuery({
    queryKey: ["report_sales", refreshKey],
    queryFn: async () => {
      const { data } = await supabase.from("sales").select("*, vehicles(*), customers(*), sale_vehicles(*, vehicles(*))").order("sale_date", { ascending: false });
      return data || [];
    },
  });

  const { data: inquiries = [], isLoading: inLoading } = useQuery({
    queryKey: ["report_inquiries", refreshKey],
    queryFn: async () => {
      const { data } = await supabase.from("inquiries").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: repairs = [], isLoading: reLoading } = useQuery({
    queryKey: ["report_repairs", refreshKey],
    queryFn: async () => {
      const { data } = await (supabase as any).from("repairs").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: expenses = [], isLoading: exLoading } = useQuery({
    queryKey: ["report_expenses", refreshKey],
    queryFn: async () => {
      const { data } = await (supabase as any).from("expenses").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: quotes = [], isLoading: quLoading } = useQuery({
    queryKey: ["report_quotes", refreshKey],
    queryFn: async () => {
      const { data } = await (supabase as any).from("performance_quotes").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: auditLogs = [], isLoading: auLoading } = useQuery({
    queryKey: ["report_audit", refreshKey],
    queryFn: async () => {
      const { data } = await (supabase as any).from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
  });

  const { data: inspections = [], isLoading: isLoadingInsp } = useQuery({
    queryKey: ["report_inspections", refreshKey],
    queryFn: async () => {
      const { data } = await (supabase as any).from("inspections").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Nine independent queries land at different times. Rendering between them
  // repainted the whole report on every arrival, shifting cards and forcing each
  // chart to re-measure and redraw. Paint once, when the data is in.
  const isLoading = vLoading || cuLoading || saLoading || inLoading || reLoading
    || exLoading || quLoading || auLoading || isLoadingInsp;

  // ── Date Filter Helper ────────────────────────────────────────────────────
  const inMonth = (dateStr: string | null | undefined) => {
    if (!dateStr) return selectedMonth === "all";
    if (selectedMonth === "all") return true;
    return format(new Date(dateStr), "yyyy-MM") === selectedMonth;
  };

  // ── Derived Data ──────────────────────────────────────────────────────────
  const fVehicles = useMemo(() => vehicles.filter((v: any) => inMonth(v.created_at)), [vehicles, selectedMonth]);
  const fSales = useMemo(() => sales.filter((s: any) => inMonth(s.sale_date || s.created_at)), [sales, selectedMonth]);
  const fExpenses = useMemo(() => expenses.filter((e: any) => inMonth(e.expense_date || e.created_at)), [expenses, selectedMonth]);
  const fInquiries = useMemo(() => inquiries.filter((i: any) => inMonth(i.created_at)), [inquiries, selectedMonth]);
  const fRepairs = useMemo(() => repairs.filter((r: any) => inMonth(r.created_at)), [repairs, selectedMonth]);
  const fQuotes = useMemo(() => quotes.filter((q: any) => inMonth(q.created_at)), [quotes, selectedMonth]);
  const fCustomers = useMemo(() => customers.filter((c: any) => inMonth(c.created_at)), [customers, selectedMonth]);

  // ── Revenue & Profit ──────────────────────────────────────────────────────
  // A sale covers either several vehicles via sale_vehicles, or one via vehicle_id
  // on older rows. cost_price belongs to the vehicle, never to the sale.
  const vehiclesOfSale = (x: any): any[] => {
    const linked = (x.sale_vehicles || []).map((sv: any) => sv.vehicles).filter(Boolean);
    if (linked.length) return linked;
    return x.vehicles ? [x.vehicles] : [];
  };
  const revenueOfSale = (x: any) => Number(x.sale_price) || 0;
  const costOfSale = (x: any) =>
    vehiclesOfSale(x).reduce((sum: number, v: any) => sum + (Number(v.cost_price) || 0), 0);

  const totalRevenue = useMemo(() => fSales.reduce((s: number, x: any) => s + revenueOfSale(x), 0), [fSales]);
  const totalCostOfGoods = useMemo(() => fSales.reduce((s: number, x: any) => s + costOfSale(x), 0), [fSales]);
  const totalProfit = totalRevenue - totalCostOfGoods;
  const totalExpenses = useMemo(() => fExpenses.reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0), [fExpenses]);
  const netProfit = totalProfit - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const repairRevenue = useMemo(() => fRepairs.filter((r: any) => r.status === "completed").reduce((s: number, x: any) => s + (Number(x.total_amount) || 0), 0), [fRepairs]);

  // Prior period for delta
  const prevMonth = format(subMonths(new Date(), 1), "yyyy-MM");
  const prevSales = useMemo(() => sales.filter((s: any) => format(new Date(s.sale_date || s.created_at), "yyyy-MM") === prevMonth), [sales]);
  const prevRevenue = prevSales.reduce((s: number, x: any) => s + revenueOfSale(x), 0);
  const revenueDelta = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  // ── Vehicles ──────────────────────────────────────────────────────────────
  const availableVehicles = useMemo(() => vehicles.filter((v: any) => !v.is_sold && v.status !== "sold"), [vehicles]);
  const soldVehicles = useMemo(() => vehicles.filter((v: any) => v.is_sold || v.status === "sold"), [vehicles]);
  const avgDaysToSell = useMemo(() => {
    const withDays = fSales.filter((s: any) => s.vehicles?.created_at && s.sale_date);
    if (!withDays.length) return 0;
    const total = withDays.reduce((acc: number, s: any) => {
      return acc + differenceInDays(new Date(s.sale_date), new Date(s.vehicles.created_at));
    }, 0);
    return Math.round(total / withDays.length);
  }, [fSales]);

  // Make/Model breakdown
  const makeBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    vehicles.forEach((v: any) => {
      const k = v.make || "Unknown";
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
  }, [vehicles]);

  // ── Monthly Revenue Trend (last 6 months) ─────────────────────────────────
  const monthlyTrend = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i);
      const key = format(d, "yyyy-MM");
      const label = format(d, "MMM yy");
      const monthSales = sales.filter((s: any) => format(new Date(s.sale_date || s.created_at), "yyyy-MM") === key);
      const monthExpenses = expenses.filter((e: any) => format(new Date(e.expense_date || e.created_at), "yyyy-MM") === key);
      const revenue = monthSales.reduce((s: number, x: any) => s + revenueOfSale(x), 0);
      const cost = monthSales.reduce((s: number, x: any) => s + costOfSale(x), 0);
      const exp = monthExpenses.reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
      const profit = revenue - cost - exp;
      return { label, "Revenue ₦": revenue, "Profit ₦": profit, "Expenses ₦": exp, count: monthSales.length };
    });
  }, [sales, expenses]);

  // ── Inquiries Breakdown ───────────────────────────────────────────────────
  const inquiryStatus = useMemo(() => {
    const map: Record<string, number> = {};
    fInquiries.forEach((i: any) => { const k = i.status || "Pending"; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [fInquiries]);

  const conversionRate = useMemo(() => {
    const converted = inquiries.filter((i: any) => i.status === "converted" || i.status === "sold").length;
    return inquiries.length > 0 ? (converted / inquiries.length) * 100 : 0;
  }, [inquiries]);

  // ── Expense Category Breakdown ────────────────────────────────────────────
  const expenseCategoryBreak = useMemo(() => {
    const map: Record<string, number> = {};
    fExpenses.forEach((e: any) => { const k = e.category || "Other"; map[k] = (map[k] || 0) + (Number(e.amount) || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [fExpenses]);

  // ── Repair Stats ──────────────────────────────────────────────────────────
  const repairStatus = useMemo(() => {
    const map: Record<string, number> = {};
    fRepairs.forEach((r: any) => { const k = r.status || "pending"; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [fRepairs]);

  const totalRepairCost = useMemo(() => fRepairs.reduce((s: number, r: any) => s + (Number(r.total_amount) || 0), 0), [fRepairs]);

  // ── Customer Acquisition ──────────────────────────────────────────────────
  const customersByMonth = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i);
      const key = format(d, "yyyy-MM");
      const label = format(d, "MMM yy");
      const count = customers.filter((c: any) => format(new Date(c.created_at), "yyyy-MM") === key).length;
      return { label, Customers: count };
    });
  }, [customers]);

  // ── Audit Activity ─────────────────────────────────────────────────────────
  const auditActivity = useMemo(() => {
    const map: Record<string, number> = {};
    auditLogs.forEach((l: any) => {
      const k = format(new Date(l.created_at), "MMM dd");
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map).slice(-10).map(([label, Actions]) => ({ label, Actions }));
  }, [auditLogs]);

  const auditByTable = useMemo(() => {
    const map: Record<string, number> = {};
    auditLogs.forEach((l: any) => { const k = l.table_name || "unknown"; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
  }, [auditLogs]);

  // ── Top Selling Vehicles ──────────────────────────────────────────────────
  const topVehicles = useMemo(() => {
    return fSales
      .map((s: any) => {
        const vs = vehiclesOfSale(s);
        const name = vs.length
          ? vs.map((v: any) => `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim()).join(" + ")
          : "Unknown vehicle";
        return { name, revenue: revenueOfSale(s), profit: revenueOfSale(s) - costOfSale(s) };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [fSales]);

  // Sales whose vehicles have no cost_price recorded: they count as zero cost, so
  // gross profit and margin read higher than they really are.
  const salesMissingCost = useMemo(
    () => fSales.filter((x: any) => {
      const vs = vehiclesOfSale(x);
      return vs.length === 0 || vs.some((v: any) => v.cost_price == null);
    }).length,
    [fSales],
  );

  // ── AI-style Insights ─────────────────────────────────────────────────────
  const insights = useMemo(() => {
    const list: { type: "good" | "warn" | "info"; message: string }[] = [];
    if (salesMissingCost > 0)
      list.push({ type: "warn", message: `${salesMissingCost} sale${salesMissingCost > 1 ? "s have vehicles" : " has a vehicle"} with no cost price recorded, so gross profit and margin below are higher than actual.` });
    if (profitMargin > 20) list.push({ type: "good", message: `Strong profit margin of ${profitMargin.toFixed(1)}% — business is performing well.` });
    else if (profitMargin < 5 && totalRevenue > 0) list.push({ type: "warn", message: `Low profit margin of ${profitMargin.toFixed(1)}%. Review cost prices and operating expenses.` });
    if (availableVehicles.length > 20) list.push({ type: "warn", message: `${availableVehicles.length} vehicles still in inventory. Consider promotions to improve turnover.` });
    if (avgDaysToSell > 60) list.push({ type: "warn", message: `Average time-to-sell is ${avgDaysToSell} days. Consider reviewing pricing strategy.` });
    else if (avgDaysToSell > 0 && avgDaysToSell < 30) list.push({ type: "good", message: `Excellent sales velocity — vehicles sell in ~${avgDaysToSell} days on average.` });
    if (conversionRate > 40) list.push({ type: "good", message: `High inquiry conversion rate of ${conversionRate.toFixed(1)}%.` });
    else if (inquiries.length > 5 && conversionRate < 15) list.push({ type: "warn", message: `Low inquiry-to-sale conversion: ${conversionRate.toFixed(1)}%. Follow up on open leads.` });
    if (totalExpenses > totalProfit * 0.5 && totalProfit > 0) list.push({ type: "warn", message: `Expenses (₦${totalExpenses.toLocaleString()}) are consuming over 50% of gross profit. Review cost categories.` });
    if (fRepairs.filter((r: any) => r.status === "pending").length > 3) list.push({ type: "warn", message: `${fRepairs.filter((r: any) => r.status === "pending").length} repair jobs still pending. Follow up with workshop.` });
    if (fSales.length === 0 && selectedMonth !== "all") list.push({ type: "info", message: "No sales recorded for this period. Check if data has been entered." });
    if (list.length === 0) list.push({ type: "info", message: "Overall business metrics look stable. Keep monitoring key indicators." });
    return list;
  }, [profitMargin, availableVehicles, avgDaysToSell, conversionRate, totalExpenses, totalProfit, fRepairs, fSales, inquiries, selectedMonth, salesMissingCost]);

  // ── Scores / Health ───────────────────────────────────────────────────────
  const healthScore = useMemo(() => {
    let score = 50;
    if (profitMargin > 15) score += 15;
    else if (profitMargin > 5) score += 8;
    if (conversionRate > 30) score += 10;
    else if (conversionRate > 15) score += 5;
    if (avgDaysToSell > 0 && avgDaysToSell < 30) score += 10;
    else if (avgDaysToSell < 60) score += 5;
    if (fSales.length > 0) score += 10;
    if (netProfit > 0) score += 5;
    return Math.min(100, score);
  }, [profitMargin, conversionRate, avgDaysToSell, fSales, netProfit]);

  const healthColor = healthScore >= 75 ? "text-emerald-500" : healthScore >= 50 ? "text-amber-500" : "text-red-500";
  const healthBg = healthScore >= 75 ? "bg-emerald-500" : healthScore >= 50 ? "bg-amber-500" : "bg-red-500";
  const healthVerdict =
    healthScore >= 75 ? "Margin and sales velocity are both healthy."
    : healthScore >= 60 ? "Solid overall; a couple of indicators need watching."
    : healthScore >= 40 ? "Mixed signals — check margin and stock turnover."
    : "Several indicators are below target.";

  // ── Headline figures ──────────────────────────────────────────────────────
  // Month-on-month movement, shown only when a single month is in view; over
  // "All time" there is no previous period to compare against.
  const prevMonthStats = useMemo(() => {
    const prev = monthlyTrend[monthlyTrend.length - 2];
    return prev
      ? { revenue: prev["Revenue ₦"], profit: prev["Profit ₦"], units: prev.count }
      : null;
  }, [monthlyTrend]);

  const pctChange = (now: number, before: number) =>
    before > 0 ? ((now - before) / before) * 100 : undefined;

  const showDeltas = selectedMonth !== "all" && !!prevMonthStats;
  const profitDelta = showDeltas ? pctChange(netProfit, prevMonthStats!.profit) : undefined;
  const unitsDelta = showDeltas ? fSales.length - prevMonthStats!.units : undefined;
  const marginDelta = showDeltas && prevMonthStats!.revenue > 0
    ? profitMargin - (prevMonthStats!.profit / prevMonthStats!.revenue) * 100
    : undefined;

  // Six-month shape behind each headline number.
  const sparks = useMemo(() => ({
    revenue: monthlyTrend.map((m: any) => m["Revenue ₦"]),
    profit: monthlyTrend.map((m: any) => m["Profit ₦"]),
    margin: monthlyTrend.map((m: any) => (m["Revenue ₦"] > 0 ? (m["Profit ₦"] / m["Revenue ₦"]) * 100 : 0)),
    units: monthlyTrend.map((m: any) => m.count),
  }), [monthlyTrend]);

  // ── Document Report Generation ──────────────────────────────────────────
  const getReportHTML = () => {
    const periodLabel = selectedMonth === "all" ? "All Time" : (MONTHS.find(m => m.value === selectedMonth)?.label || selectedMonth);
    const healthText = healthScore >= 75 ? "Excellent" : healthScore >= 50 ? "Good" : "Needs Attention";

    return `
      <div style="text-align: center; margin-top: 15px; margin-bottom: 20px;">
        <h2 style="font-size: 20px; font-weight: 800; margin: 0; text-transform: uppercase; color: #0f172a; letter-spacing: -0.5px;">EXECUTIVE BUSINESS PERFORMANCE REPORT</h2>
        <p style="font-size: 11px; color: #64748b; margin-top: 4px;">Reporting Period: <strong>${periodLabel}</strong> | Generated: <strong>${generatedAt}</strong></p>
      </div>

      <!-- Business Health & Executive Summary -->
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; background: #f8fafc;">
        <table style="width: 100%; border: none; margin: 0;">
          <tr style="background: transparent;">
            <td style="border: none; width: 35%; vertical-align: middle; padding-right: 15px;">
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b;">Business Health Score</div>
              <div style="font-size: 28px; font-weight: 900; color: ${healthScore >= 75 ? '#166534' : healthScore >= 50 ? '#b45309' : '#991b1b'};">
                ${healthScore}/100 <span style="font-size: 13px; font-weight: 700;">(${healthText})</span>
              </div>
            </td>
            <td style="border: none; vertical-align: top; border-left: 1px solid #e2e8f0; padding-left: 15px;">
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 6px;">Executive Insights</div>
              <ul style="margin: 0; padding-left: 16px; font-size: 11px; color: #334155; line-height: 1.5;">
                ${insights.map(i => `<li style="margin-bottom: 3px;">${i.message}</li>`).join("")}
              </ul>
            </td>
          </tr>
        </table>
      </div>

      <!-- Financial Performance Summary -->
      <div class="section-title">1. Financial Performance Summary</div>
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-lbl">Total Revenue</div>
          <div class="kpi-val" style="color: #166534;">₦${totalRevenue.toLocaleString()}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-lbl">Gross Profit</div>
          <div class="kpi-val" style="color: #0284c7;">₦${totalProfit.toLocaleString()}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-lbl">Operating Expenses</div>
          <div class="kpi-val" style="color: #b91c1c;">₦${totalExpenses.toLocaleString()}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-lbl">Net Profit</div>
          <div class="kpi-val" style="color: ${netProfit >= 0 ? '#7c3aed' : '#b91c1c'};">₦${netProfit.toLocaleString()}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Financial Indicator</th>
            <th>Amount / Ratio</th>
            <th>Description & Context</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Total Sales Revenue</td><td><strong>₦${totalRevenue.toLocaleString()}</strong></td><td>Total gross sales revenue realized from vehicle sales</td></tr>
          <tr><td>Cost of Goods Sold (COGS)</td><td>₦${totalCostOfGoods.toLocaleString()}</td><td>Total acquisition & purchase cost of sold inventory</td></tr>
          <tr><td>Gross Profit</td><td><strong>₦${totalProfit.toLocaleString()}</strong></td><td>Total gross profit before operational expenses</td></tr>
          <tr><td>Total Operating Expenses</td><td>₦${totalExpenses.toLocaleString()}</td><td>Total operational expenses, logistics, fuel, and overhead</td></tr>
          <tr><td>Net Profit</td><td><strong style="color: ${netProfit >= 0 ? '#166534' : '#b91c1c'};">₦${netProfit.toLocaleString()}</strong></td><td>Net business profit after operating expenses</td></tr>
          <tr><td>Net Profit Margin</td><td><strong>${profitMargin.toFixed(1)}%</strong></td><td>Percentage return on total revenue</td></tr>
          <tr><td>Workshop Repair Revenue</td><td>₦${repairRevenue.toLocaleString()}</td><td>Revenue realized from completed repairs & maintenance</td></tr>
        </tbody>
      </table>

      <!-- Inventory & Sales -->
      <div class="section-title">2. Inventory & Sales Performance</div>
      <table>
        <thead>
          <tr>
            <th>Inventory Metric</th>
            <th>Quantity / Value</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Total Inventory Count</td><td>${vehicles.length} vehicles</td></tr>
          <tr><td>Available Stock</td><td>${availableVehicles.length} vehicles</td></tr>
          <tr><td>Total Sold Vehicles</td><td>${soldVehicles.length} vehicles</td></tr>
          <tr><td>Average Turnover Velocity</td><td>${avgDaysToSell > 0 ? `${avgDaysToSell} days` : '—'}</td></tr>
        </tbody>
      </table>

      ${topVehicles.length > 0 ? `
      <p style="font-size: 11px; font-weight: 700; margin-top: 10px; margin-bottom: 6px;">Top Performing Sales (Period)</p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Vehicle Description</th>
            <th>Selling Price</th>
            <th>Gross Profit</th>
          </tr>
        </thead>
        <tbody>
          ${topVehicles.map((v, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${v.name}</strong></td>
              <td>₦${v.revenue.toLocaleString()}</td>
              <td><strong style="color: #166534;">₦${v.profit.toLocaleString()}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      ` : ''}

      <!-- Customers & Leads -->
      <div class="section-title">3. Customers & Lead Pipeline</div>
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-lbl">Total Customers</div><div class="kpi-val">${customers.length}</div></div>
        <div class="kpi-card"><div class="kpi-lbl">New Customers (Period)</div><div class="kpi-val">${fCustomers.length}</div></div>
        <div class="kpi-card"><div class="kpi-lbl">Inquiries</div><div class="kpi-val">${inquiries.length}</div></div>
        <div class="kpi-card"><div class="kpi-lbl">Conversion Rate</div><div class="kpi-val">${conversionRate.toFixed(1)}%</div></div>
      </div>

      <!-- Expenses Breakdown -->
      ${expenseCategoryBreak.length > 0 ? `
      <div class="section-title">4. Operating Expenses Breakdown</div>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Total Expense (₦)</th>
            <th>% Share</th>
          </tr>
        </thead>
        <tbody>
          ${expenseCategoryBreak.map(c => {
            const pct = totalExpenses > 0 ? ((c.value / totalExpenses) * 100).toFixed(1) : "0";
            return `
              <tr>
                <td>${c.name}</td>
                <td>₦${c.value.toLocaleString()}</td>
                <td>${pct}%</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
      ` : ''}

      <!-- Workshop Repairs -->
      ${repairStatus.length > 0 ? `
      <div class="section-title">5. Workshop & Repairs Breakdown</div>
      <table>
        <thead>
          <tr>
            <th>Repair Job Status</th>
            <th>Number of Jobs</th>
          </tr>
        </thead>
        <tbody>
          ${repairStatus.map(r => `
            <tr>
              <td style="text-transform: capitalize;">${r.name.replace(/_/g, " ")}</td>
              <td>${r.value}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      ` : ''}
    `;
  };

  const handlePrint = () => {
    printHTMLDocument(
      `Abuja Best Cars — Executive Business Report (${selectedMonth === "all" ? "All Time" : selectedMonth})`,
      getReportHTML()
    );
    logAction("PRINT", "AdvancedReport", "full_report");
  };

  const handleExportPDF = () => {
    exportHTMLToPDF(
      `Abuja Best Cars — Executive Business Report (${selectedMonth === "all" ? "All Time" : selectedMonth})`,
      `abuja_best_cars_advanced_report_${selectedMonth}`,
      getReportHTML()
    );
    logAction("EXPORT_PDF", "AdvancedReport", "full_report");
  };

  const handleExportExcel = () => {
    const summaryRows = [
      { metric: "Total Revenue", value: `₦${totalRevenue.toLocaleString()}` },
      { metric: "Gross Profit", value: `₦${totalProfit.toLocaleString()}` },
      { metric: "Total Expenses", value: `₦${totalExpenses.toLocaleString()}` },
      { metric: "Net Profit", value: `₦${netProfit.toLocaleString()}` },
      { metric: "Profit Margin", value: `${profitMargin.toFixed(1)}%` },
      { metric: "Total Sales", value: String(fSales.length) },
      { metric: "Vehicles in Stock", value: String(availableVehicles.length) },
      { metric: "Vehicles Sold", value: String(soldVehicles.length) },
      { metric: "Total Customers", value: String(customers.length) },
      { metric: "New Customers (Period)", value: String(fCustomers.length) },
      { metric: "Open Inquiries", value: String(inquiries.filter((i: any) => i.status === "open" || i.status === "pending").length) },
      { metric: "Conversion Rate", value: `${conversionRate.toFixed(1)}%` },
      { metric: "Avg Days to Sell", value: `${avgDaysToSell} days` },
      { metric: "Repair Jobs", value: String(fRepairs.length) },
      { metric: "Business Health Score", value: `${healthScore}/100` },
    ];
    exportToExcel(summaryRows, `lamido_cars_advanced_report_${selectedMonth}`);
    logAction("EXPORT_EXCEL", "AdvancedReport", "summary");
  };

  const handleExportCSV = () => {
    const summaryRows = [
      { metric: "Total Revenue", value: `₦${totalRevenue.toLocaleString()}` },
      { metric: "Gross Profit", value: `₦${totalProfit.toLocaleString()}` },
      { metric: "Total Expenses", value: `₦${totalExpenses.toLocaleString()}` },
      { metric: "Net Profit", value: `₦${netProfit.toLocaleString()}` },
      { metric: "Profit Margin", value: `${profitMargin.toFixed(1)}%` },
      { metric: "Total Sales", value: String(fSales.length) },
      { metric: "Vehicles in Stock", value: String(availableVehicles.length) },
      { metric: "Vehicles Sold", value: String(soldVehicles.length) },
      { metric: "Total Customers", value: String(customers.length) },
      { metric: "New Customers (Period)", value: String(fCustomers.length) },
      { metric: "Conversion Rate", value: `${conversionRate.toFixed(1)}%` },
      { metric: "Business Health Score", value: `${healthScore}/100` },
    ];
    exportToCSV(summaryRows, `lamido_cars_advanced_report_${selectedMonth}`);
    logAction("EXPORT_CSV", "AdvancedReport", "summary");
  };

  // Compact naira for headline figures: ₦88.3m reads faster than ₦88,300,000.
  const shortNaira = (n: number) => {
    const a = Math.abs(n);
    if (a >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}b`;
    if (a >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}m`;
    if (a >= 1_000) return `₦${(n / 1_000).toFixed(0)}k`;
    return `₦${n.toLocaleString()}`;
  };
  const periodLabel = selectedMonth === "all"
    ? "All time"
    : MONTHS.find(m => m.value === selectedMonth)?.label || selectedMonth;

  const trendData = monthlyTrend.map((m: any) => ({
    label: m.label,
    Revenue: m["Revenue ₦"],
    "Net profit": m["Profit ₦"],
    Expenses: m["Expenses ₦"],
  }));

  const tabs: { key: string; label: string }[] = [
    { key: "inventory", label: "Inventory" },
    { key: "customers", label: "Customers" },
    { key: "expenses", label: "Expenses" },
    { key: "workshop", label: "Workshop" },
    { key: "documents", label: "Documents" },
    { key: "activity", label: "Activity" },
  ];

  return (
    isLoading ? (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
        <RefreshCw className="h-8 w-8 animate-spin opacity-60" />
        <p className="text-sm font-semibold">Building report…</p>
      </div>
    ) : (
    <div className="flex flex-col gap-5 animate-fade-in pb-16 max-w-7xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3.5">
        <div className="flex-1 min-w-[240px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted-foreground mb-1">
            Abuja Best Cars · RC 1907711
          </p>
          <h1 className="font-heading text-[22px] sm:text-[26px] lg:text-[29px] font-bold tracking-tight">
            Advanced Report
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {periodLabel} · generated {generatedAt}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[168px] h-[38px] rounded-xl text-sm">
              <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Time</SelectItem>
              {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)} className="rounded-xl h-[38px]">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl h-[38px] gap-1.5">
                <Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem onClick={handleExportPDF} className="gap-2 cursor-pointer">
                <FileText className="h-4 w-4" /> PDF document
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4" /> Excel workbook
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
                <Sheet className="h-4 w-4" /> CSV summary
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl h-[38px]">
            <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
          </Button>
        </div>
      </div>

      {/* ── Headline figures ────────────────────────────────────────────────── */}
      <section aria-label="Headline figures"
        className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden border border-border">
        <Figure label="Total revenue" value={shortNaira(totalRevenue)}
          delta={revenueDelta !== undefined && showDeltas ? revenueDelta : undefined}
          deltaNote="vs prev month" spark={sparks.revenue} />
        <Figure label="Net profit" value={shortNaira(netProfit)}
          delta={profitDelta} deltaNote="vs prev month" spark={sparks.profit} />
        <Figure label="Net margin" value={`${profitMargin.toFixed(1)}%`}
          delta={marginDelta} deltaSuffix=" pts" deltaNote="vs prev month" spark={sparks.margin} />
        <Figure label="Vehicles sold" value={String(fSales.length)}
          delta={unitsDelta} deltaSuffix="" deltaNote="vs prev month" spark={sparks.units} />
      </section>

      {/* ── Business health ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 bento-card no-hover px-4 py-3.5">
        <span className="text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground">Business health</span>
        <span className="font-heading font-bold text-[17px] tabular-nums">
          {healthScore}<span className="text-muted-foreground text-[13px]">/100</span>
        </span>
        <div className="flex-1 min-w-[150px] h-[7px] rounded bg-muted overflow-hidden">
          <div className={`h-full rounded ${healthBg}`} style={{ width: `${healthScore}%` }} />
        </div>
        <span className="text-[12.5px] text-muted-foreground">{healthVerdict}</span>
      </div>

      {/* ── Revenue & profit trend ──────────────────────────────────────────── */}
      <figure className="bento-card no-hover p-4 sm:p-5 m-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <div>
            <h2 className="font-heading text-[15px] font-bold tracking-tight">Revenue and net profit</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Last six months · naira millions · expenses in the Expenses tab
            </p>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl h-[34px] text-xs"
            onClick={() => setShowTrendTable(v => !v)} aria-expanded={showTrendTable}>
            {showTrendTable ? "Hide table" : "Show table"}
          </Button>
        </div>

        {/* Legend plus end-of-line labels: identity never rests on colour alone. */}
        <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 mt-3 mb-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <i className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--chart-rev)" }} />Revenue
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <i className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--chart-prof)" }} />Net profit
          </span>
        </div>

        <div className="h-[260px] sm:h-[290px] mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-rev)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--chart-rev)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gProf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-prof)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--chart-prof)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--chart-ink)" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--chart-ink)" }} axisLine={false} tickLine={false} width={40}
                tickFormatter={(v: number) => (v >= 1_000_000 ? `${Math.round(v / 1_000_000)}m` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--chart-ink)", strokeDasharray: "3 3" }} />
              <Area type="monotone" dataKey="Revenue" stroke="var(--chart-rev)" strokeWidth={2}
                fill="url(#gRev)" dot={{ r: 3, strokeWidth: 2, stroke: "hsl(var(--card))" }} activeDot={{ r: 5 }} isAnimationActive={false} />
              <Area type="monotone" dataKey="Net profit" stroke="var(--chart-prof)" strokeWidth={2}
                fill="url(#gProf)" dot={{ r: 3, strokeWidth: 2, stroke: "hsl(var(--card))" }} activeDot={{ r: 5 }} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {showTrendTable && (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  <th className="text-left font-semibold py-2 px-2 border-b border-border">Month</th>
                  <th className="text-right font-semibold py-2 px-2 border-b border-border">Revenue</th>
                  <th className="text-right font-semibold py-2 px-2 border-b border-border">Net profit</th>
                  <th className="text-right font-semibold py-2 px-2 border-b border-border">Expenses</th>
                  <th className="text-right font-semibold py-2 px-2 border-b border-border">Margin</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {trendData.map((r: any) => (
                  <tr key={r.label}>
                    <td className="py-1.5 px-2 border-b border-border/60">{r.label}</td>
                    <td className="text-right py-1.5 px-2 border-b border-border/60">₦{r.Revenue.toLocaleString()}</td>
                    <td className="text-right py-1.5 px-2 border-b border-border/60">₦{r["Net profit"].toLocaleString()}</td>
                    <td className="text-right py-1.5 px-2 border-b border-border/60">₦{r.Expenses.toLocaleString()}</td>
                    <td className="text-right py-1.5 px-2 border-b border-border/60">
                      {r.Revenue > 0 ? `${((r["Net profit"] / r.Revenue) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </figure>

      {/* ── Detail tabs ─────────────────────────────────────────────────────── */}
      <div>
        <div role="tablist" aria-label="Report detail" className="flex gap-0.5 overflow-x-auto border-b border-border">
          {tabs.map(t => (
            <button key={t.key} role="tab" type="button"
              aria-selected={activeTab === t.key}
              onClick={() => setActiveTab(t.key)}
              className={`whitespace-nowrap text-[13px] font-semibold px-3.5 py-2.5 min-h-[38px] border-b-2 transition-colors ${
                activeTab === t.key
                  ? "text-foreground border-[color:var(--chart-rev)]"
                  : "text-muted-foreground border-transparent"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="bento-card no-hover rounded-t-none border-t-0 p-4 sm:p-5">
          {activeTab === "inventory" && (
            <>
              <Strip items={[
                ["In stock", String(availableVehicles.length)],
                ["Sold this period", String(fSales.length)],
                ["Avg days to sell", avgDaysToSell > 0 ? String(avgDaysToSell) : "—"],
                ["Total fleet", String(vehicles.length)],
              ]} />
              <h2 className="font-heading text-[15px] font-bold tracking-tight">Stock by make</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Across the whole fleet</p>
              <BarList rows={makeBreakdown} />
            </>
          )}

          {activeTab === "customers" && (
            <>
              <Strip items={[
                ["Total customers", String(customers.length)],
                ["New this period", String(fCustomers.length)],
                ["Inquiries", String(fInquiries.length)],
                ["Conversion", `${conversionRate.toFixed(1)}%`],
              ]} />
              <h2 className="font-heading text-[15px] font-bold tracking-tight">Inquiry pipeline</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Where this period's inquiries stand</p>
              <BarList rows={inquiryStatus} />
            </>
          )}

          {activeTab === "expenses" && (
            <>
              <Strip items={[
                ["Total expenses", shortNaira(totalExpenses)],
                ["Entries", String(fExpenses.length)],
                ["Share of revenue", totalRevenue > 0 ? `${((totalExpenses / totalRevenue) * 100).toFixed(1)}%` : "—"],
                ["Largest category", expenseCategoryBreak[0]?.name || "—"],
              ]} />
              <h2 className="font-heading text-[15px] font-bold tracking-tight">Expenses by category</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{periodLabel}</p>
              <BarList rows={expenseCategoryBreak} format={shortNaira} />
            </>
          )}

          {activeTab === "workshop" && (
            <>
              <Strip items={[
                ["Jobs logged", String(fRepairs.length)],
                ["Pending", String(fRepairs.filter((r: any) => r.status === "pending").length)],
                ["Completed", String(fRepairs.filter((r: any) => r.status === "completed").length)],
                ["Repair revenue", shortNaira(repairRevenue)],
              ]} />
              <h2 className="font-heading text-[15px] font-bold tracking-tight">Job status</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                All workshop jobs this period · {shortNaira(totalRepairCost)} booked
              </p>
              <BarList rows={repairStatus} />
            </>
          )}

          {activeTab === "documents" && (
            <>
              <Strip items={[
                ["Proforma invoices", String(fQuotes.length)],
                ["Quote → sale", fQuotes.length > 0 ? `${((fSales.length / fQuotes.length) * 100).toFixed(1)}%` : "—"],
                ["Inspections", String(inspections.length)],
                ["Sales recorded", String(fSales.length)],
              ]} />
              <h2 className="font-heading text-[15px] font-bold tracking-tight">Top sales this period</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Ranked by sale value</p>
              <BarList rows={topVehicles.map((v: any) => ({ name: v.name, value: v.revenue }))} format={shortNaira} />
            </>
          )}

          {activeTab === "activity" && (
            <>
              <Strip items={[
                ["Logged actions", String(auditLogs.length)],
                ["Busiest day", auditActivity.slice().sort((a: any, b: any) => b.Actions - a.Actions)[0]?.label || "—"],
                ["Tables touched", String(auditByTable.length)],
                ["Inspections", String(inspections.length)],
              ]} />
              <h2 className="font-heading text-[15px] font-bold tracking-tight">Activity by table</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Most-edited records in the audit log</p>
              <BarList rows={auditByTable} />
            </>
          )}
        </div>
      </div>

      {/* ── Insights ────────────────────────────────────────────────────────── */}
      <section className="bento-card no-hover p-4 sm:p-5">
        <h2 className="font-heading text-[15px] font-bold tracking-tight">What stands out</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Generated from this period's figures</p>
        <ul className="flex flex-col gap-2.5 mt-3.5 list-none p-0 m-0">
          {insights.map((ins, i) => <Insight key={i} {...ins} />)}
        </ul>
      </section>

      <p className="text-[11.5px] text-muted-foreground text-center pt-1">
        Abuja Best Cars Advanced Report · {periodLabel} · generated {generatedAt}
      </p>
    </div>
    )
  );
}
