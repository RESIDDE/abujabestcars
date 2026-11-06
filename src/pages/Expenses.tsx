import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { 
  PlusCircle, Search, Pencil, Trash2, Download, FileText, Printer, 
  Receipt, Wallet, BarChart as BarChartIcon, User, Calendar, 
  CreditCard, ArrowLeft, X, PieChart as PieChartIcon, TrendingUp,
  Tag, Car, CheckCircle2, Plus, Layers
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid
} from "recharts";
import { format, subMonths } from "date-fns";
import { toast } from "sonner";
import { exportToExcel, exportToJSON, printTable, exportToCSV, exportToPDF } from "@/lib/exportHelpers";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { canEdit, canCreate, canDelete } from "@/lib/permissions";
import { logAction } from "@/lib/logger";
import { CurrencyInput } from "@/components/CurrencyInput";
import { BackButton } from "@/components/BackButton";

const CATEGORIES = [
  "Errands & Logistics",
  "Fuel & Transport",
  "Office & Operations",
  "Vehicle Maintenance & Parts",
  "Customs & Clearing",
  "Utilities & Bills",
  "Food & Refreshments",
  "Salaries & Allowances",
  "Marketing & Ads",
  "Other",
];

const CATEGORY_COLORS: Record<string, string> = {
  "Errands & Logistics": "bg-amber-500/10 text-amber-500 border-amber-500/20",
  "Fuel & Transport": "bg-sky-500/10 text-sky-500 border-sky-500/20",
  "Office & Operations": "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "Vehicle Maintenance & Parts": "bg-violet-500/10 text-violet-500 border-violet-500/20",
  "Customs & Clearing": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  "Utilities & Bills": "bg-rose-500/10 text-rose-500 border-rose-500/20",
  "Food & Refreshments": "bg-orange-500/10 text-orange-500 border-orange-500/20",
  "Salaries & Allowances": "bg-purple-500/10 text-purple-500 border-purple-500/20",
  "Marketing & Ads": "bg-pink-500/10 text-pink-500 border-pink-500/20",
  "Other": "bg-foreground/10 text-muted-foreground border-border/20",
};

const PIE_COLORS = [
  "hsl(38 92% 50%)",
  "hsl(199 89% 48%)",
  "hsl(217 91% 60%)",
  "hsl(262 83% 58%)",
  "hsl(142 76% 36%)",
  "hsl(0 84% 60%)",
  "hsl(24 95% 53%)",
  "hsl(280 65% 60%)",
  "hsl(330 80% 60%)",
  "hsl(var(--muted-foreground))"
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-panel p-3 border border-white/20 shadow-2xl rounded-xl z-50 min-w-[150px]">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((entry: any, index: number) => {
          let val = entry.value;
          if (typeof val === 'number') {
            val = `₦${val.toLocaleString()}`;
          }
          return (
            <p key={index} className="text-sm font-medium flex justify-between gap-4" style={{ color: entry.color || entry.fill }}>
              <span>{entry.name}:</span> <span>{val}</span>
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

const PAGE_SIZE = 20;

export default function Expenses() {
  const { role, user } = useAuth();
  const { permissions } = usePermissions();
  const hasEdit = canEdit(role, "expenses", permissions);
  const hasDelete = canDelete(role, "expenses", permissions);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);

  interface ExpenseItemRow {
    id: string;
    title: string;
    amount: string;
    category: string;
    vehicle_id?: string;
  }

  const createEmptyItem = (): ExpenseItemRow => ({
    id: Math.random().toString(36).substring(2, 9),
    title: "",
    amount: "",
    category: "Errands & Logistics",
    vehicle_id: "",
  });

  // Form State
  const emptyForm = {
    title: "",
    amount: "",
    category: "Errands & Logistics",
    errand_by: "",
    expense_date: format(new Date(), "yyyy-MM-dd"),
    payment_method: "Cash",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState<ExpenseItemRow[]>([createEmptyItem()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addItem = () => {
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof ExpenseItemRow, value: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const totalItemsAmount = useMemo(() => {
    if (editingExpense) {
      return parseFloat(String(form.amount).replace(/,/g, "")) || 0;
    }
    return items.reduce((sum, item) => {
      const val = parseFloat(String(item.amount).replace(/,/g, "")) || 0;
      return sum + val;
    }, 0);
  }, [editingExpense, form.amount, items]);

  // Query Expenses
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Query Vehicles for optional vehicle link
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", "all_list"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("id, make, model, year, vin").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Unique Errand Runners for quick auto-suggest
  const knownRunners = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e: any) => {
      if (e.errand_by && e.errand_by.trim()) set.add(e.errand_by.trim());
    });
    return Array.from(set);
  }, [expenses]);

  // Mutations
  const createOrUpdateMutation = useMutation({
    mutationFn: async () => {
      if (editingExpense) {
        const numAmount = parseFloat(String(form.amount).replace(/,/g, "")) || 0;
        if (!form.title.trim()) throw new Error("Title/Description is required");
        if (numAmount <= 0) throw new Error("Please enter a valid expense amount");

        const payload: any = {
          title: form.title.trim(),
          amount: numAmount,
          category: form.category,
          errand_by: form.errand_by.trim() || null,
          expense_date: form.expense_date,
          payment_method: form.payment_method,
          notes: form.notes.trim() || null,
          created_by: user?.id || null,
        };

        const { error } = await supabase.from("expenses").update(payload).eq("id", editingExpense.id);
        if (error) throw error;
        await logAction("UPDATE", "Expense", editingExpense.id, { title: form.title, amount: numAmount });
      } else {
        // Validate all expense items
        if (items.length === 0) throw new Error("Please add at least one expense item");
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (!item.title.trim()) {
            throw new Error(`Expense Item #${i + 1}: Title / Description is required`);
          }
          const num = parseFloat(String(item.amount).replace(/,/g, "")) || 0;
          if (num <= 0) {
            throw new Error(`Expense Item #${i + 1} ("${item.title.trim()}"): Please enter a valid amount`);
          }
        }

        const batchId = items.length > 1 ? crypto.randomUUID() : null;
        const payloads = items.map((item) => ({
          title: item.title.trim(),
          amount: parseFloat(String(item.amount).replace(/,/g, "")) || 0,
          category: item.category,
          errand_by: form.errand_by.trim() || null,
          expense_date: form.expense_date,
          payment_method: form.payment_method,
          notes: form.notes.trim() || null,
          vehicle_id: item.vehicle_id || null,
          batch_id: batchId,
          created_by: user?.id || null,
        }));

        const { error } = await supabase.from("expenses").insert(payloads);
        if (error) throw error;
        await logAction("CREATE", "Expense", batchId || "new", { 
          count: items.length, 
          titles: items.map((i) => i.title),
          total: payloads.reduce((s, p) => s + p.amount, 0)
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      if (editingExpense) {
        toast.success("Expense updated successfully");
      } else if (items.length > 1) {
        const totalSum = items.reduce((s, i) => s + (parseFloat(String(i.amount).replace(/,/g, "")) || 0), 0);
        toast.success(`Successfully recorded ${items.length} expenses totaling ₦${totalSum.toLocaleString()}!`);
      } else {
        toast.success("Expense recorded successfully");
      }
      closeDialog();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save expense");
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      await logAction("DELETE", "Expense", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense deleted successfully");
    },
    onError: () => toast.error("Failed to delete expense"),
  });

  const openNewDialog = () => {
    setEditingExpense(null);
    setForm(emptyForm);
    setItems([createEmptyItem()]);
    setDialogOpen(true);
  };

  const openEditDialog = (exp: any) => {
    setEditingExpense(exp);
    setForm({
      title: exp.title || "",
      amount: String(exp.amount || ""),
      category: exp.category || "Errands & Logistics",
      errand_by: exp.errand_by || "",
      expense_date: exp.expense_date ? format(new Date(exp.expense_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      payment_method: exp.payment_method || "Cash",
      notes: exp.notes || "",
    });
    setItems([{
      id: exp.id,
      title: exp.title || "",
      amount: String(exp.amount || ""),
      category: exp.category || "Errands & Logistics",
      vehicle_id: exp.vehicle_id || "",
    }]);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingExpense(null);
    setForm(emptyForm);
    setItems([createEmptyItem()]);
  };

  // Filtered expenses
  const filtered = useMemo(() => {
    return expenses.filter((e: any) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || 
        (e.title && e.title.toLowerCase().includes(q)) || 
        (e.errand_by && e.errand_by.toLowerCase().includes(q)) ||
        (e.notes && e.notes.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q));

      const matchesCategory = categoryFilter === "all" || e.category === categoryFilter;

      let matchesMonth = true;
      if (selectedMonth !== "all") {
        const eDate = new Date(e.expense_date || e.created_at);
        const eMonth = format(eDate, "yyyy-MM");
        if (eMonth !== selectedMonth) matchesMonth = false;

        if (matchesMonth && selectedWeek !== "all") {
          const dayOfMonth = eDate.getDate();
          const weekNum = Math.ceil(dayOfMonth / 7);
          if (String(weekNum) !== selectedWeek) matchesMonth = false;
        }
      }

      return matchesSearch && matchesCategory && matchesMonth;
    });
  }, [expenses, search, categoryFilter, selectedMonth, selectedWeek]);

  // Analytics Metrics
  const currentMonthKey = format(new Date(), "yyyy-MM");
  const thisMonthExpenses = useMemo(() => {
    return expenses.filter((e: any) => {
      const d = new Date(e.expense_date || e.created_at);
      return format(d, "yyyy-MM") === currentMonthKey;
    });
  }, [expenses, currentMonthKey]);

  const totalExpenseAmount = useMemo(() => {
    return filtered.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
  }, [filtered]);

  const thisMonthTotal = useMemo(() => {
    return thisMonthExpenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
  }, [thisMonthExpenses]);

  const errandsCount = useMemo(() => {
    return filtered.filter((e: any) => e.category === "Errands & Logistics" || !!e.errand_by).length;
  }, [filtered]);

  const topSpendersData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e: any) => {
      if (e.errand_by && e.errand_by.trim()) {
        const name = e.errand_by.trim();
        map[name] = (map[name] || 0) + (Number(e.amount) || 0);
      }
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e: any) => {
      const cat = e.category || "Other";
      map[cat] = (map[cat] || 0) + (Number(e.amount) || 0);
    });
    return Object.entries(map)
      .filter(([_, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const monthlyTrendData = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const k = format(d, "MMM yyyy");
      map[k] = 0;
    }
    expenses.forEach((e: any) => {
      const d = new Date(e.expense_date || e.created_at);
      const k = format(d, "MMM yyyy");
      if (map[k] !== undefined) {
        map[k] += Number(e.amount) || 0;
      }
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Exports
  const handleExportExcel = () => {
    const rows = filtered.map((e: any) => ({
      Title: e.title,
      Category: e.category,
      "Amount (NGN)": Number(e.amount) || 0,
      "Errand By / Responsible": e.errand_by || "—",
      Date: e.expense_date ? format(new Date(e.expense_date), "yyyy-MM-dd") : "—",
      "Payment Method": e.payment_method || "Cash",
      Notes: e.notes || "",
    }));
    logAction("EXPORT", "Expenses", "bulk", { format: "Excel", count: rows.length });
    exportToExcel(rows, "Abuja_Best_Cars_Company_Expenses");
  };

  const handleExportCSV = () => {
    const rows = filtered.map((e: any) => ({
      Title: e.title,
      Category: e.category,
      Amount: Number(e.amount) || 0,
      "Errand By": e.errand_by || "—",
      Date: e.expense_date,
      "Payment Method": e.payment_method,
      Notes: e.notes || "",
    }));
    logAction("EXPORT", "Expenses", "bulk", { format: "CSV", count: rows.length });
    exportToCSV(rows, "Abuja_Best_Cars_Company_Expenses");
  };

  const handleExportPDF = () => {
    const rows = filtered.map((e: any) => ({
      title: e.title,
      category: e.category,
      amount: `₦${(Number(e.amount) || 0).toLocaleString()}`,
      errand_by: e.errand_by || "—",
      date: e.expense_date ? format(new Date(e.expense_date), "dd/MM/yyyy") : "—",
      payment_method: e.payment_method || "Cash",
    }));
    logAction("EXPORT", "Expenses", "bulk", { format: "PDF", count: rows.length });
    exportToPDF("Abuja Best Cars — Company Expenses Report", rows, [
      { key: "title", label: "Description / Errand" },
      { key: "category", label: "Category" },
      { key: "errand_by", label: "Errand By" },
      { key: "date", label: "Date" },
      { key: "payment_method", label: "Payment Method" },
      { key: "amount", label: "Amount" },
    ]);
  };

  const handlePrint = () => {
    const rows = filtered.map((e: any) => ({
      title: e.title,
      category: e.category,
      errand_by: e.errand_by || "—",
      date: e.expense_date ? format(new Date(e.expense_date), "dd/MM/yyyy") : "—",
      payment_method: e.payment_method || "Cash",
      amount: `₦${(Number(e.amount) || 0).toLocaleString()}`,
    }));
    logAction("PRINT", "Expenses", "bulk", { count: filtered.length });
    printTable("Abuja Best Cars — Company Expenses", rows, [
      { key: "title", label: "Description / Errand" },
      { key: "category", label: "Category" },
      { key: "errand_by", label: "Errand By" },
      { key: "date", label: "Date" },
      { key: "payment_method", label: "Payment" },
      { key: "amount", label: "Amount" },
    ]);
  };

  return (
    <div className="space-y-8 animate-fade-up pb-10 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Receipt className="w-3.5 h-3.5 text-amber-400/60" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/60">Finance & Operations</span>
          </div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-white/90">
            Company Expenses
          </h1>
          <p className="text-xs text-white/40 mt-0.5">
            Track day-to-day expenditures, staff errands, transport logistics, and operational costs.
          </p>
        </div>
        <div className="flex flex-row flex-wrap gap-2 shrink-0">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`rounded-xl glass-panel border-white/10 transition-all text-xs ${showAnalytics ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' : 'hover:bg-white/5'}`}
          >
            <BarChartIcon className="mr-1.5 h-3.5 w-3.5" /> {showAnalytics ? "Hide Analytics" : "Analytics"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl glass-panel border-white/10 hover:bg-white/5 transition-all text-xs">
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-xl glass-panel p-2 shadow-2xl border-white/10" align="end">
              <DropdownMenuItem onClick={handleExportCSV} className="rounded-lg cursor-pointer"><FileText className="mr-2 h-4 w-4" /> Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel} className="rounded-lg cursor-pointer"><FileText className="mr-2 h-4 w-4" /> Export as Excel / Document</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF} className="rounded-lg cursor-pointer"><FileText className="mr-2 h-4 w-4" /> Export as PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToJSON(filtered, "company_expenses_export")} className="rounded-lg cursor-pointer"><FileText className="mr-2 h-4 w-4" /> Export as JSON</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem onClick={handlePrint} className="rounded-lg cursor-pointer text-amber-500 font-bold"><Printer className="mr-2 h-4 w-4" /> Print View</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canCreate(role, "expenses", permissions) && (
            <Button size="sm" onClick={openNewDialog} className="rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs cursor-pointer">
              <PlusCircle className="mr-1.5 h-4 w-4" /> Record Expense
            </Button>
          )}
        </div>
      </div>

      {/* Analytics Bento Grid */}
      {showAnalytics && (
        <div className="space-y-6 animate-fade-down">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <Card className="bento-card border-none shadow-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-amber-500/10 rounded-2xl"><Wallet className="h-6 w-6 text-amber-500" /></div>
                </div>
                <h3 className="text-3xl font-bold">₦{thisMonthTotal.toLocaleString()}</h3>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">This Month's Spending</p>
              </CardContent>
            </Card>

            <Card className="bento-card border-none shadow-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl"><Receipt className="h-6 w-6 text-emerald-500" /></div>
                </div>
                <h3 className="text-3xl font-bold">₦{totalExpenseAmount.toLocaleString()}</h3>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Total Filtered Expenses</p>
              </CardContent>
            </Card>

            <Card className="bento-card border-none shadow-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-sky-500/10 rounded-2xl"><User className="h-6 w-6 text-sky-500" /></div>
                </div>
                <h3 className="text-3xl font-bold">{errandsCount}</h3>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Errands & Outings Logged</p>
              </CardContent>
            </Card>

            <Card className="bento-card border-none shadow-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-violet-500/10 rounded-2xl"><TrendingUp className="h-6 w-6 text-violet-500" /></div>
                </div>
                <h3 className="text-3xl font-bold">{filtered.length}</h3>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Total Expense Entries</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Trend Chart */}
            <div className="bento-card p-6 min-h-[340px]">
              <h3 className="font-bold text-lg flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-amber-500" /> Monthly Expense Trend
              </h3>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--foreground)/0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v / 1000)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Expenses" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Breakdown Chart */}
            <div className="bento-card p-6 flex flex-col justify-center">
              <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
                <PieChartIcon className="w-5 h-5 text-emerald-500" /> Category Breakdown
              </h3>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={categoryBreakdown} 
                      innerRadius={60} 
                      outerRadius={85} 
                      paddingAngle={4} 
                      dataKey="value"
                    >
                      {categoryBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="overflow-x-auto pb-2">
        <Tabs value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val); setPage(0); }} className="w-full">
          <TabsList className="glass-panel p-1.5 rounded-2xl h-12 flex flex-nowrap w-fit min-w-full justify-start gap-1">
            <TabsTrigger value="all" className="rounded-xl data-[state=active]:bg-amber-500 data-[state=active]:text-black font-bold text-xs shrink-0 px-4">
              All Expenses ({expenses.length})
            </TabsTrigger>
            {CATEGORIES.map((cat) => {
              const count = expenses.filter((e: any) => e.category === cat).length;
              return (
                <TabsTrigger key={cat} value={cat} className="rounded-xl data-[state=active]:bg-amber-500 data-[state=active]:text-black font-bold text-xs shrink-0 px-3">
                  {cat} {count > 0 && `(${count})`}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Filter & Control Bar */}
      <div className="glass-panel p-4 rounded-3xl flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between relative overflow-hidden">
        <div className="relative w-full sm:w-80 group z-10">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-amber-500 transition-colors pointer-events-none" />
          <Input 
            placeholder="Search by description or errand person..." 
            value={search} 
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} 
            className="pl-10 h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-amber-500/50 transition-all font-medium text-sm w-full"
          />
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setPage(0); }}>
            <SelectTrigger className="w-[160px] h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-amber-500 text-sm">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent className="glass-panel w-[160px] rounded-xl">
              <SelectItem value="all" className="rounded-lg">All Time</SelectItem>
              {Array.from({ length: 12 }).map((_, i) => {
                const d = subMonths(new Date(), i);
                const val = format(d, 'yyyy-MM');
                const label = format(d, 'MMMM yyyy');
                return (
                  <SelectItem key={val} value={val} className="rounded-lg">{label}</SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Select value={selectedWeek} onValueChange={(v) => { setSelectedWeek(v); setPage(0); }}>
            <SelectTrigger className="w-[120px] h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-amber-500 text-sm">
              <SelectValue placeholder="All Weeks" />
            </SelectTrigger>
            <SelectContent className="glass-panel w-[120px] rounded-xl">
              <SelectItem value="all" className="rounded-lg">All Weeks</SelectItem>
              <SelectItem value="1" className="rounded-lg">Week 1</SelectItem>
              <SelectItem value="2" className="rounded-lg">Week 2</SelectItem>
              <SelectItem value="3" className="rounded-lg">Week 3</SelectItem>
              <SelectItem value="4" className="rounded-lg">Week 4</SelectItem>
              <SelectItem value="5" className="rounded-lg">Week 5</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-sm font-medium text-muted-foreground bg-background/50 px-3 py-2 rounded-lg border border-white/5 ml-auto">
            {filtered.length} Entries
          </span>
        </div>
      </div>

      {/* Main Table Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 w-full rounded-2xl bg-card/40 animate-pulse" />)}
        </div>
      ) : paged.length === 0 ? (
        <div className="bento-card p-12 flex flex-col items-center justify-center text-center">
          <div className="bg-amber-500/10 p-5 rounded-full mb-4">
            <Receipt className="h-10 w-10 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">No expenses found.</h2>
          <p className="text-muted-foreground max-w-sm mb-6">
            {search || categoryFilter !== 'all' || selectedMonth !== 'all' 
              ? "No expenses matched your current search or category filter." 
              : "Start recording company expenses and errands using the button above."}
          </p>
          {(search || categoryFilter !== 'all' || selectedMonth !== 'all') && (
            <Button variant="outline" onClick={() => { setSearch(''); setCategoryFilter('all'); setSelectedMonth('all'); setSelectedWeek('all'); }} className="rounded-xl">
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="bento-card overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto w-full">
            <Table className="w-full">
              <TableHeader className="bg-foreground/5 pointer-events-none">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-semibold px-6 py-4">Expense / Description</TableHead>
                  <TableHead className="font-semibold">Category</TableHead>
                  <TableHead className="font-semibold">Errand Person</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Payment</TableHead>
                  <TableHead className="font-semibold text-right">Amount</TableHead>
                  <TableHead className="text-right font-semibold px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((e: any) => (
                  <TableRow key={e.id} className="border-border/10 hover:bg-white/5 transition-colors group">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-foreground/5 group-hover:bg-amber-500/10 transition-colors">
                          <Receipt className="h-4 w-4 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm transition-colors group-hover:text-primary">{e.title}</p>
                          {e.notes && <p className="text-xs text-muted-foreground line-clamp-1">{e.notes}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${CATEGORY_COLORS[e.category] || CATEGORY_COLORS["Other"]}`}>
                        {e.category || "General"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {e.errand_by ? (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium text-xs text-foreground">{e.errand_by}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {e.expense_date ? format(new Date(e.expense_date), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-xs font-mono bg-foreground/5 px-2 py-0.5 rounded-md text-muted-foreground">
                        <CreditCard className="h-3 w-3" /> {e.payment_method || "Cash"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold text-sm font-mono text-amber-400">
                      ₦{Number(e.amount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                        {hasEdit && (
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(e)} className="h-8 w-8 rounded-lg hover:bg-foreground/20">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {hasDelete && (
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(e.id)} className="h-8 w-8 rounded-lg hover:bg-destructive/20 hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden flex flex-col divide-y divide-border/10">
            {paged.map((e: any) => (
              <div key={e.id} className="p-4 flex flex-col gap-3 bg-card/30">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="font-bold text-foreground text-sm">{e.title}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border mt-1.5 ${CATEGORY_COLORS[e.category] || CATEGORY_COLORS["Other"]}`}>
                      {e.category}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-amber-400 font-mono">₦{Number(e.amount).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{e.expense_date ? format(new Date(e.expense_date), "dd/MM/yyyy") : "—"}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{e.errand_by || "Company Direct"}</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono">
                    <CreditCard className="h-3 w-3" />
                    <span>{e.payment_method || "Cash"}</span>
                  </div>
                </div>

                {(hasEdit || hasDelete) && (
                  <div className="flex justify-end gap-2 pt-2 border-t border-border/10">
                    {hasEdit && (
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(e)} className="h-8 text-xs rounded-xl glass-panel">
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                    )}
                    {hasDelete && (
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(e.id)} className="h-8 text-xs rounded-xl text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-6 border-t border-border/10">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => page > 0 && setPage(page - 1)}
                      className={page === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {[...Array(totalPages)].map((_, i) => (
                    <PaginationItem key={i} className="hidden sm:block">
                      <PaginationLink 
                        isActive={page === i}
                        onClick={() => setPage(i)}
                        className="cursor-pointer"
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => page < totalPages - 1 && setPage(page + 1)}
                      className={page >= totalPages - 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      )}

      {/* Record / Edit Expense Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col rounded-3xl glass-panel border-white/10 p-0 shadow-2xl" hideClose>
          <div className="sticky top-0 z-10 glass-panel border-b border-white/10 p-4 sm:p-6 flex justify-between items-center gap-3 bg-background/80 backdrop-blur-xl shrink-0">
            <BackButton onBack={closeDialog} className="relative z-10" />
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Receipt className="h-5 w-5 text-amber-500" /> 
                {editingExpense 
                  ? "Edit Expense Entry" 
                  : items.length > 1 
                    ? `Record Multiple Expenses (${items.length} Items)` 
                    : "Record Company Expense"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {editingExpense 
                  ? "Update this single expense record." 
                  : "Add one or multiple expense items in this single record."}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(92vh-160px)]">
            {editingExpense ? (
              /* Single Expense Edit Form */
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Expense Title / Description *</Label>
                  <Input 
                    placeholder="e.g. Bought fuel for test drive, Registry plate renewal, Office internet"
                    value={form.title}
                    onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                    className="bg-background/50 border-white/10 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Amount (₦) *</Label>
                    <CurrencyInput 
                      value={form.amount}
                      onChange={(e) => setForm(p => ({ ...p, amount: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Category *</Label>
                    <Select value={form.category} onValueChange={(val) => setForm(p => ({ ...p, category: val }))}>
                      <SelectTrigger className="bg-background/50 border-white/10 rounded-xl h-11">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent className="glass-panel rounded-xl">
                        {CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Who went for the Errand / Spent by</Label>
                    <Input 
                      placeholder="e.g. Musa, Ibrahim, Driver, Manager"
                      value={form.errand_by}
                      onChange={(e) => setForm(p => ({ ...p, errand_by: e.target.value }))}
                      className="bg-background/50 border-white/10 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Expense Date *</Label>
                    <Input 
                      type="date"
                      value={form.expense_date}
                      onChange={(e) => setForm(p => ({ ...p, expense_date: e.target.value }))}
                      className="bg-background/50 border-white/10 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Payment Method</Label>
                  <Select value={form.payment_method} onValueChange={(val) => setForm(p => ({ ...p, payment_method: val }))}>
                    <SelectTrigger className="bg-background/50 border-white/10 rounded-xl h-11">
                      <SelectValue placeholder="Select Payment Method" />
                    </SelectTrigger>
                    <SelectContent className="glass-panel rounded-xl">
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Card / POS">Card / POS</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Additional Notes / Remarks</Label>
                  <Textarea 
                    placeholder="Any special remarks, item receipts, or errand outcome..."
                    value={form.notes}
                    onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    className="bg-background/50 border-white/10 rounded-xl"
                  />
                </div>
              </div>
            ) : (
              /* Multi-Item Expense Creation */
              <div className="space-y-5">
                {/* 1. Shared Errand & Voucher Information */}
                <div className="p-4 rounded-2xl bg-card/30 border border-white/10 space-y-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-amber-500" />
                    Voucher &amp; Errand Details
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Expense Date *</Label>
                      <Input 
                        type="date"
                        value={form.expense_date}
                        onChange={(e) => setForm(p => ({ ...p, expense_date: e.target.value }))}
                        className="bg-background/50 border-white/10 rounded-xl h-10 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Spent By / Errand Runner</Label>
                      <Input 
                        placeholder="e.g. Musa, Driver"
                        value={form.errand_by}
                        onChange={(e) => setForm(p => ({ ...p, errand_by: e.target.value }))}
                        className="bg-background/50 border-white/10 rounded-xl h-10 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Payment Method</Label>
                      <Select value={form.payment_method} onValueChange={(val) => setForm(p => ({ ...p, payment_method: val }))}>
                        <SelectTrigger className="bg-background/50 border-white/10 rounded-xl h-10 text-xs">
                          <SelectValue placeholder="Payment Method" />
                        </SelectTrigger>
                        <SelectContent className="glass-panel rounded-xl">
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                          <SelectItem value="Card / POS">Card / POS</SelectItem>
                          <SelectItem value="Cheque">Cheque</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {knownRunners.length > 0 && !form.errand_by && (
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      <span className="text-[10px] text-muted-foreground mr-1">Recent:</span>
                      {knownRunners.slice(0, 4).map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setForm(p => ({ ...p, errand_by: r }))}
                          className="text-[10px] bg-foreground/5 hover:bg-amber-500/20 hover:text-amber-500 px-2 py-0.5 rounded-md border border-white/5 transition-colors"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Expense Items List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-amber-500" />
                      <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Expense Items ({items.length})
                      </Label>
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={addItem}
                      className="h-8 text-xs rounded-xl border-dashed border-amber-500/40 hover:border-amber-500 hover:bg-amber-500/10 text-amber-400 gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Another Expense
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div 
                        key={item.id} 
                        className="relative p-4 rounded-2xl bg-card/40 border border-white/10 space-y-3 transition-all hover:border-white/20"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              Item #{index + 1}
                            </span>
                            {item.title.trim() && (
                              <span className="text-xs text-white/70 font-medium truncate max-w-[220px]">
                                {item.title}
                              </span>
                            )}
                          </div>
                          {items.length > 1 && (
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => removeItem(item.id)}
                              className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-white/70">
                            Description / Purpose *
                          </Label>
                          <Input 
                            placeholder="e.g. Fuel for test drive, Brake pads purchase, Office refreshments"
                            value={item.title}
                            onChange={(e) => updateItem(item.id, "title", e.target.value)}
                            className="bg-background/50 border-white/10 rounded-xl h-10 text-xs"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-white/70">Category *</Label>
                            <Select value={item.category} onValueChange={(val) => updateItem(item.id, "category", val)}>
                              <SelectTrigger className="bg-background/50 border-white/10 rounded-xl h-10 text-xs">
                                <SelectValue placeholder="Select Category" />
                              </SelectTrigger>
                              <SelectContent className="glass-panel rounded-xl">
                                {CATEGORIES.map(cat => (
                                  <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-white/70">Amount (₦) *</Label>
                            <CurrencyInput 
                              value={item.amount}
                              onChange={(e) => updateItem(item.id, "amount", e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Optional Vehicle link */}
                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                            <Car className="h-3 w-3 text-white/50" />
                            Related Vehicle (Optional)
                          </Label>
                          <Select 
                            value={item.vehicle_id || "none"} 
                            onValueChange={(val) => updateItem(item.id, "vehicle_id", val === "none" ? "" : val)}
                          >
                            <SelectTrigger className="bg-background/50 border-white/10 rounded-xl h-9 text-xs">
                              <SelectValue placeholder="None / General Company Expense" />
                            </SelectTrigger>
                            <SelectContent className="glass-panel rounded-xl max-h-52">
                              <SelectItem value="none" className="text-xs text-muted-foreground">
                                None (General Company Expense)
                              </SelectItem>
                              {vehicles.map((v: any) => (
                                <SelectItem key={v.id} value={v.id} className="text-xs">
                                  {v.year} {v.make} {v.model} {v.vin ? `(VIN: ${v.vin.slice(-6)})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Another Item Button */}
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={addItem}
                    className="w-full py-4 h-auto rounded-2xl border-dashed border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/10 text-amber-400 font-semibold text-xs flex items-center justify-center gap-2 transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    + Add Another Expense Item
                  </Button>
                </div>

                {/* 3. Live Total Calculation Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Total Voucher Amount</p>
                    <p className="text-[11px] text-muted-foreground">
                      {items.length} {items.length === 1 ? "expense item" : "expense items"} to be saved
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black font-mono text-amber-400">
                      ₦{totalItemsAmount.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* 4. Shared Remarks / Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Additional Notes / Remarks</Label>
                  <Textarea 
                    placeholder="General remarks, errand outcomes, receipt references..."
                    value={form.notes}
                    onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
                    rows={2}
                    className="bg-background/50 border-white/10 rounded-xl"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 sm:p-6 border-t border-white/10 bg-black/40 shrink-0 flex flex-col sm:flex-row gap-2 justify-between items-center">
            <Button variant="outline" onClick={closeDialog} className="rounded-xl w-full sm:w-auto">
              Cancel
            </Button>
            <Button 
              onClick={() => { setIsSubmitting(true); createOrUpdateMutation.mutate(); }}
              disabled={
                isSubmitting || 
                (editingExpense 
                  ? (!form.title.trim() || !(parseFloat(String(form.amount).replace(/,/g, '')) > 0))
                  : (items.length === 0 || totalItemsAmount <= 0 || items.some(i => !i.title.trim() || !(parseFloat(String(i.amount).replace(/,/g, '')) > 0)))
                )
              }
              className="rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-lg shadow-amber-500/20 w-full sm:w-auto"
            >
              {isSubmitting 
                ? "Saving..." 
                : editingExpense 
                  ? "Update Expense" 
                  : items.length > 1 
                    ? `Save All ${items.length} Expenses (₦${totalItemsAmount.toLocaleString()})` 
                    : "Save Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl glass-panel border-white/10 p-6 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-foreground">Delete Expense Entry</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-muted-foreground">
              Are you sure you want to delete this expense record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-xl border-white/10 text-foreground hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20 border-none"
            >
              Delete Expense
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
