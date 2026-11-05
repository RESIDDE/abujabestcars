import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { 
  PlusCircle, Search, Eye, Pencil, Trash2, Download, FileText, Printer, 
  Car, ListFilter, BarChart as BarChartIcon, Clock, Package, ShieldCheck, AlertTriangle, PieChart as PieChartIcon, ChevronRight, ArrowLeft,
  CheckCircle, DollarSign, TrendingUp, LayoutGrid, List
} from "lucide-react";
import { CustomPagination } from "@/components/CustomPagination";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid
} from "recharts";
import { differenceInDays, format, subMonths } from "date-fns";
import { toast } from "sonner";
import { exportToExcel, exportToJSON, printTable, exportToCSV, exportToPDF } from "@/lib/exportHelpers";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { canEdit, canCreate, canDelete } from "@/lib/permissions";
import { logAction } from "@/lib/logger";

const COLORS = ["hsl(var(--primary))", "hsl(142 76% 36%)", "hsl(38 92% 50%)", "hsl(217 91% 60%)", "hsl(0 84% 60%)", "hsl(199 89% 48%)"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-panel p-3 border border-white/20 shadow-2xl rounded-xl z-50 min-w-[150px]">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((entry: any, index: number) => {
          let val = entry.value;
          if (typeof val === 'number') {
            val = val.toLocaleString();
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

export default function VehiclesList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const { permissions } = usePermissions();
  const hasEdit = canEdit(role, "vehicles", permissions);
  const hasDelete = canDelete(role, "vehicles", permissions);

  const activeTab = searchParams.get("tab") === "sold" ? "sold" : "active";

  const handleTabChange = (val: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val === "sold") {
        next.set("tab", "sold");
      } else {
        next.delete("tab");
      }
      return next;
    });
    setPage(0);
    setStatusFilter("all");
  };

  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [sourceCompanyFilter, setSourceCompanyFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteSoldDialog, setShowDeleteSoldDialog] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const queryClient = useQueryClient();

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["vehicles", "Lamido"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").eq("inventory_type", "Lamido").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
      await logAction("DELETE", "Vehicle", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Vehicle deleted successfully");
    },
    onError: () => toast.error("Failed to delete vehicle"),
  });

  const deleteSoldMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("vehicles")
        .delete()
        .eq("inventory_type", "Lamido")
        .eq("status", "Sold");
      if (error) throw error;
      await logAction("DELETE", "Bulk Vehicles", "All Sold");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("All sold vehicles deleted successfully");
      setShowDeleteSoldDialog(false);
    },
    onError: () => toast.error("Failed to delete sold vehicles"),
  });

  const sourceCompanies = useMemo(() => {
    const companies = new Set<string>();
    vehicles.forEach(v => {
      if (v.source_company) companies.add(v.source_company);
    });
    return Array.from(companies).sort();
  }, [vehicles]);

  const activeVehicles = useMemo(() => vehicles.filter(v => v.status !== "Customer Car" && v.status !== "Sold"), [vehicles]);
  const soldVehicles = useMemo(() => vehicles.filter(v => v.status === "Sold"), [vehicles]);
  const activeCount = activeVehicles.length;
  const soldCount = soldVehicles.length;

  const soldRevenue = useMemo(() => soldVehicles.reduce((sum, v) => sum + (Number(v.price) || 0), 0), [soldVehicles]);
  const soldCost = useMemo(() => soldVehicles.reduce((sum, v) => sum + (Number(v.cost_price) || 0), 0), [soldVehicles]);
  const soldProfit = soldRevenue - soldCost;

  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      // Hide customer cars from the main fleet view
      if (v.status === "Customer Car") return false;

      // Filter by tab
      if (activeTab === "active" && v.status === "Sold") return false;
      if (activeTab === "sold" && v.status !== "Sold") return false;

      const q = search.toLowerCase();
      const matchesSearch = !q || v.make.toLowerCase().includes(q) || v.model.toLowerCase().includes(q) || (v.vin && v.vin.toLowerCase().includes(q)) || (v.source_company && v.source_company.toLowerCase().includes(q));
      const matchesCondition = conditionFilter === "all" || v.condition === conditionFilter;
      const matchesStatus = activeTab === "sold" ? true : (statusFilter === "all" || v.status === statusFilter);
      const matchesSource = sourceCompanyFilter === "all" || v.source_company === sourceCompanyFilter;
      
      // Monthly/Weekly Filter
      let matchesMonth = true;
      if (selectedMonth !== "all") {
        const vDate = new Date(v.created_at);
        const vMonth = format(vDate, 'yyyy-MM');
        if (vMonth !== selectedMonth) matchesMonth = false;

        if (matchesMonth && selectedWeek !== "all") {
          const dayOfMonth = vDate.getDate();
          const weekNum = Math.ceil(dayOfMonth / 7);
          if (String(weekNum) !== selectedWeek) matchesMonth = false;
        }
      }

      return matchesSearch && matchesCondition && matchesStatus && matchesSource && matchesMonth;
    });
  }, [vehicles, activeTab, search, conditionFilter, statusFilter, sourceCompanyFilter, selectedMonth, selectedWeek]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleExportExcel = () => {
    const rows = filtered.map((v) => ({
      Make: v.make, Model: v.model, Year: v.year, VIN: v.vin || "", Color: v.color || "",
      Price: v.price, "Cost Price": v.cost_price || "", Status: v.status, Condition: v.condition || "",
      "Source Company": v.source_company || "", "Date Arrived": v.date_arrived || "",
    }));
    logAction("EXPORT", "Vehicle", "bulk", { format: "Excel", count: rows.length, tab: activeTab });
    exportToExcel(rows, `Lamido_${activeTab}_vehicles_export`);
  };

  const handleExportCSV = () => {
    const rows = filtered.map((v) => ({
      Make: v.make, Model: v.model, Year: v.year, VIN: v.vin || "", Color: v.color || "",
      Price: v.price, Status: v.status, Condition: v.condition || "",
      Source: v.source_company || "", Date: v.date_arrived || "",
    }));
    logAction("EXPORT", "Vehicle", "bulk", { format: "CSV", count: rows.length, tab: activeTab });
    exportToCSV(rows, `Lamido_${activeTab}_vehicles_export`);
  };

  const handleExportPDF = () => {
    const rows = filtered.map((v) => ({
      vehicle: `${v.year} ${v.make} ${v.model}`, 
      vin: v.vin || "—", 
      price: `₦${Number(v.price).toLocaleString()}`,
      status: v.status, 
      condition: v.condition || "—",
    }));
    logAction("EXPORT", "Vehicle", "bulk", { format: "PDF", count: rows.length, tab: activeTab });
    exportToPDF(`Lamido ${activeTab === 'sold' ? 'Sold' : 'Active'} Vehicles Inventory`, rows, [
      { key: "vehicle", label: "Vehicle Description" }, 
      { key: "vin", label: "VIN/Chassis" },
      { key: "price", label: "Price" }, 
      { key: "status", label: "Status" }, 
      { key: "condition", label: "Condition" },
    ]);
  };

  const handleExportJSON = () => {
    logAction("EXPORT", "Vehicle", "bulk", { format: "JSON", count: filtered.length, tab: activeTab });
    exportToJSON(filtered, `vehicles_${activeTab}_export`);
  };

  const handlePrint = () => {
    const rows = filtered.map((v) => ({
      vehicle: `${v.year} ${v.make} ${v.model}`, vin: v.vin || "—", price: `₦${Number(v.price).toLocaleString()}`,
      status: v.status, condition: v.condition || "—",
    }));
    logAction("PRINT", "Vehicle List", "bulk", { count: filtered.length, tab: activeTab });
    printTable(`Lamido ${activeTab === 'sold' ? 'Sold' : 'Active'} Vehicles Inventory — Lamido Cars`, rows, [
      { key: "vehicle", label: "Vehicle" }, { key: "vin", label: "VIN" },
      { key: "price", label: "Price" }, { key: "status", label: "Status" }, { key: "condition", label: "Condition" },
    ]);
  };

  return (
    <div className="space-y-8 animate-fade-up pb-10 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)} className="sm:hidden mt-1 h-8 w-8 rounded-full shrink-0 bg-white/5 hover:bg-white/10">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Car className="w-3.5 h-3.5 text-sky-400/60" />
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-400/60">Fleet Management</span>
            </div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-white/90">
              Vehicles Inventory <span className="text-[10px] opacity-30 font-mono">v2.1</span>
            </h1>
            <p className="text-xs text-white/40 mt-0.5">
              View, add, and manage your active fleet and track historical sold inventory.
            </p>
          </div>
        </div>
        <div className="flex flex-row flex-wrap gap-2 shrink-0">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`rounded-xl glass-panel border-white/10 transition-all text-xs ${showAnalytics ? 'bg-primary/20 text-primary border-primary/20' : 'hover:bg-white/5'}`}
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
              <DropdownMenuItem onClick={handleExportJSON} className="rounded-lg cursor-pointer"><FileText className="mr-2 h-4 w-4" /> Export as JSON</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem onClick={handlePrint} className="rounded-lg cursor-pointer text-primary font-bold"><Printer className="mr-2 h-4 w-4" /> Print View</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canCreate(role, "vehicles", permissions) && (
            <Button asChild size="sm" className="rounded-xl shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 transition-all bg-sky-500 hover:bg-sky-600 text-xs">
              <Link to="/vehicles/new">
                <PlusCircle className="mr-1.5 h-4 w-4" /> Add Vehicle
              </Link>
            </Button>
          )}
        </div>
      </div>

      {showAnalytics && (
        <div className="space-y-6 animate-fade-down">
          {activeTab === "active" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
              <Card className="bento-card border-none shadow-xl">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-primary/10 rounded-2xl"><Package className="h-6 w-6 text-primary" /></div>
                  </div>
                  <h3 className="text-3xl font-bold">{activeCount}</h3>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Units In Stock</p>
                </CardContent>
              </Card>

              <Card className="bento-card border-none shadow-xl">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-emerald-500/10 rounded-2xl"><ShieldCheck className="h-6 w-6 text-emerald-500" /></div>
                  </div>
                  <h3 className="text-3xl font-bold">₦{activeVehicles.reduce((sum, v) => sum + (Number(v.cost_price) || 0), 0).toLocaleString()}</h3>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Stock Cost Value</p>
                </CardContent>
              </Card>

              <Card className="bento-card border-none shadow-xl">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-sky-500/10 rounded-2xl"><ShieldCheck className="h-6 w-6 text-sky-500" /></div>
                  </div>
                  <h3 className="text-3xl font-bold">₦{activeVehicles.reduce((sum, v) => sum + (Number(v.price) || 0), 0).toLocaleString()}</h3>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Total Selling Price</p>
                </CardContent>
              </Card>

              <Card className="bento-card border-none shadow-xl">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-amber-500/10 rounded-2xl"><Clock className="h-6 w-6 text-amber-500" /></div>
                  </div>
                  <h3 className="text-3xl font-bold">{activeVehicles.filter(v => v.status === 'Reserved').length}</h3>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Reserved Units</p>
                </CardContent>
              </Card>

              <Card className="bento-card border-none shadow-xl">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-red-500/10 rounded-2xl"><AlertTriangle className="h-6 w-6 text-red-500" /></div>
                  </div>
                  <h3 className="text-3xl font-bold">{activeVehicles.filter(v => v.condition === 'Damaged').length}</h3>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Damaged Stock</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <Card className="bento-card border-none shadow-xl">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-500/10 rounded-2xl"><CheckCircle className="h-6 w-6 text-blue-500" /></div>
                  </div>
                  <h3 className="text-3xl font-bold">{soldCount}</h3>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Total Sold Units</p>
                </CardContent>
              </Card>

              <Card className="bento-card border-none shadow-xl">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-emerald-500/10 rounded-2xl"><DollarSign className="h-6 w-6 text-emerald-500" /></div>
                  </div>
                  <h3 className="text-3xl font-bold">₦{soldRevenue.toLocaleString()}</h3>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Total Sold Sales Value</p>
                </CardContent>
              </Card>

              <Card className="bento-card border-none shadow-xl">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-sky-500/10 rounded-2xl"><Package className="h-6 w-6 text-sky-500" /></div>
                  </div>
                  <h3 className="text-3xl font-bold">₦{soldCost.toLocaleString()}</h3>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Total Sold Cost Price</p>
                </CardContent>
              </Card>

              <Card className="bento-card border-none shadow-xl">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-amber-500/10 rounded-2xl"><TrendingUp className="h-6 w-6 text-amber-500" /></div>
                  </div>
                  <h3 className="text-3xl font-bold">₦{soldProfit.toLocaleString()}</h3>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Realized Gross Margin</p>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "active" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bento-card p-6 min-h-[350px]">
                <h3 className="font-bold text-lg flex items-center gap-2 mb-6"><Clock className="w-5 h-5 text-sky-500" /> Aging Analysis</h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(() => {
                      const counts: any = { "0-30 Days": 0, "31-60 Days": 0, "61-90 Days": 0, "90+ Days": 0 };
                      activeVehicles.forEach(v => {
                        const days = differenceInDays(new Date(), new Date(v.date_arrived || v.created_at));
                        if (days <= 30) counts["0-30 Days"]++;
                        else if (days <= 60) counts["31-60 Days"]++;
                        else if (days <= 90) counts["61-90 Days"]++;
                        else counts["90+ Days"]++;
                      });
                      return Object.entries(counts).map(([name, value]) => ({ name, value }));
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--foreground)/0.05)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Vehicles" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bento-card p-6 flex flex-col justify-center">
                <h3 className="font-bold text-lg flex items-center gap-2 mb-6"><PieChartIcon className="w-5 h-5 text-amber-500" /> Status Mix</h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={[
                          { name: 'Available', value: activeVehicles.filter(v => v.status === 'Available').length },
                          { name: 'Reserved', value: activeVehicles.filter(v => v.status === 'Reserved').length },
                        ].filter(x => x.value > 0)} 
                        innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                      >
                        {COLORS.map((color, i) => <Cell key={i} fill={color} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bento-card p-6 min-h-[350px]">
                <h3 className="font-bold text-lg flex items-center gap-2 mb-6"><Car className="w-5 h-5 text-blue-500" /> Top Sold Brands</h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(() => {
                      const brandMap: Record<string, number> = {};
                      soldVehicles.forEach(v => {
                        brandMap[v.make] = (brandMap[v.make] || 0) + 1;
                      });
                      return Object.entries(brandMap)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 6)
                        .map(([name, value]) => ({ name, value }));
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--foreground)/0.05)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Units Sold" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bento-card p-6 flex flex-col justify-center">
                <h3 className="font-bold text-lg flex items-center gap-2 mb-6"><PieChartIcon className="w-5 h-5 text-emerald-500" /> Sold Condition Breakdown</h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={[
                          { name: 'Used', value: soldVehicles.filter(v => v.condition === 'Used').length },
                          { name: 'New', value: soldVehicles.filter(v => v.condition === 'New').length },
                          { name: 'Damaged', value: soldVehicles.filter(v => v.condition === 'Damaged').length },
                        ].filter(x => x.value > 0)} 
                        innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                      >
                        {COLORS.map((color, i) => <Cell key={i} fill={color} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs Control */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[440px] mb-2 glass-panel p-1.5 rounded-2xl h-14 border border-white/10 shadow-lg">
          <TabsTrigger 
            value="active" 
            className="rounded-xl data-[state=active]:bg-sky-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all h-full font-bold text-xs sm:text-sm flex items-center justify-center gap-2"
          >
            <Package className="w-4 h-4" /> 
            <span>Active Fleet</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs bg-white/15 font-mono">
              {activeCount}
            </span>
          </TabsTrigger>
          <TabsTrigger 
            value="sold" 
            className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all h-full font-bold text-xs sm:text-sm flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" /> 
            <span>Sold Vehicles</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs bg-white/15 font-mono">
              {soldCount}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters Control Bar */}
      <div className="glass-panel p-4 rounded-3xl flex flex-col sm:flex-row gap-4 items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 to-transparent pointer-events-none" />
        <div className="relative w-full sm:w-80 group z-10">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-sky-500 transition-colors pointer-events-none" />
          <Input 
            placeholder="Search by name, model, VIN..." 
            value={search} 
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} 
            className="pl-10 h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-sky-500/50 transition-all font-medium text-sm w-full"
          />
        </div>
        <div className="relative z-10 w-full sm:w-auto flex flex-wrap items-center gap-2">
          <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setPage(0); }}>
            <SelectTrigger className="w-[160px] h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-sky-500 text-sm">
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
            <SelectTrigger className="w-[120px] h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-sky-500 text-sm">
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

          <ListFilter className="h-4 w-4 text-muted-foreground hidden lg:block" />
          <Select value={conditionFilter} onValueChange={(v) => { setConditionFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[150px] h-10 rounded-xl bg-background/50 border-white/10">
              <SelectValue placeholder="Condition" />
            </SelectTrigger>
            <SelectContent className="glass-panel rounded-xl">
              <SelectItem value="all">All Conditions</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Used">Used</SelectItem>
              <SelectItem value="Damaged">Damaged</SelectItem>
            </SelectContent>
          </Select>

          {activeTab === "active" && (
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-[150px] h-10 rounded-xl bg-background/50 border-white/10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="glass-panel rounded-xl">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Available">Available</SelectItem>
                <SelectItem value="Reserved">Reserved</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Select value={sourceCompanyFilter} onValueChange={(v) => { setSourceCompanyFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[180px] h-10 rounded-xl bg-background/50 border-white/10">
              <SelectValue placeholder="Source Company" />
            </SelectTrigger>
            <SelectContent className="glass-panel rounded-xl">
              <SelectItem value="all">All Sources</SelectItem>
              {sourceCompanies.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {hasDelete && soldCount > 0 && (
          <div className="z-10">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowDeleteSoldDialog(true)}
              className="h-10 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive border border-destructive/20 bg-destructive/5 px-4"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete All Sold ({soldCount})
            </Button>
          </div>
        )}
        <div className="sm:ml-auto z-10 flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-muted/60 dark:bg-white/5 p-1 rounded-xl border border-white/10">
            <Button
              type="button"
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("cards")}
              className={`h-8 px-3 rounded-lg text-xs font-semibold gap-1.5 transition-all ${
                viewMode === "cards" 
                  ? "bg-[#181d2f] text-white dark:bg-white dark:text-slate-900 shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </Button>
            <Button
              type="button"
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className={`h-8 px-3 rounded-lg text-xs font-semibold gap-1.5 transition-all ${
                viewMode === "table" 
                  ? "bg-[#181d2f] text-white dark:bg-white dark:text-slate-900 shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </Button>
          </div>

          <span className="text-sm font-medium text-muted-foreground bg-background/50 px-3 py-1.5 rounded-lg border border-white/5 hidden sm:inline-block">
            {filtered.length} Results
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 w-full rounded-2xl bg-card/40 animate-pulse border border-white/5" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bento-card p-12 flex flex-col items-center justify-center text-center">
          <div className={`${activeTab === 'sold' ? 'bg-blue-500/10' : 'bg-sky-500/10'} p-5 rounded-full mb-4`}>
            {activeTab === 'sold' ? <CheckCircle className="h-10 w-10 text-blue-500" /> : <Car className="h-10 w-10 text-sky-500" />}
          </div>
          <h2 className="text-xl font-bold mb-2">
            {activeTab === 'sold' ? "No sold vehicles found." : "No active vehicles found."}
          </h2>
          <p className="text-muted-foreground max-w-sm mb-6">
            {activeTab === 'sold' 
              ? (search || conditionFilter !== 'all' || sourceCompanyFilter !== 'all' || selectedMonth !== 'all' 
                  ? "No sold vehicles match your current filter criteria." 
                  : "Vehicles marked with status 'Sold' in the fleet will be cataloged here.")
              : "We couldn't find any vehicles matching your current search criteria."}
          </p>
          {(search || conditionFilter !== 'all' || sourceCompanyFilter !== 'all' || selectedMonth !== 'all') && (
            <Button variant="outline" onClick={() => { setSearch(''); setConditionFilter('all'); setSourceCompanyFilter('all'); setSelectedMonth('all'); setSelectedWeek('all'); setPage(0); }} className="rounded-xl">
              Clear Filters
            </Button>
          )}
        </div>
      ) : viewMode === "cards" ? (
        /* Split-Panel Vehicles Cards Modeled After Reference Design */
        <div className="space-y-4">
          {paged.map((v) => {
            const vehicleRef = v.vin ? `VIN: ${v.vin.slice(0, 11)}...` : `REF-${v.id.slice(0, 8).toUpperCase()}`;
            const dateStr = v.date_arrived ? new Date(v.date_arrived).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "In Stock";
            const isSold = v.status?.toLowerCase() === 'sold';
            const isAvailable = v.status?.toLowerCase() === 'available';

            return (
              <div 
                key={v.id} 
                className="rounded-[22px] overflow-hidden border border-border/50 dark:border-white/10 bg-white dark:bg-[#151a26] shadow-md hover:shadow-xl transition-all flex flex-col md:flex-row group"
              >
                {/* Left Panel: Solid Dark Contrast (Modeled after reference left section) */}
                <div className="w-full md:w-[32%] lg:w-[28%] bg-[#111728] dark:bg-[#0c101a] text-white p-5 md:p-6 flex flex-col justify-between shrink-0 relative">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        FLEET VEHICLE
                      </span>
                      <span className="text-[10px] font-mono text-slate-400/80">
                        {vehicleRef}
                      </span>
                    </div>

                    <h3 className="text-base md:text-lg font-bold text-white leading-snug tracking-tight group-hover:text-amber-400 transition-colors">
                      {v.year} {v.make} {v.model}
                    </h3>

                    <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5 truncate">
                      <span className="text-slate-200 font-medium">{v.trim || "Standard"}</span>
                      {v.color && <span className="opacity-70">• {v.color}</span>}
                    </p>
                  </div>

                  {/* Bottom link modeled after "View all chapters >" in reference image */}
                  <div className="mt-5 pt-3 border-t border-white/10">
                    <Link 
                      to={`/vehicles/${v.id}`}
                      className="flex items-center justify-between text-xs text-slate-300 font-medium group/link cursor-pointer hover:text-white transition-colors"
                      title={v.source_company || "Direct Fleet"}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{v.source_company ? `Source: ${v.source_company}` : "Direct Fleet"}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 transition-transform group-hover/link:translate-x-0.5" />
                    </Link>
                  </div>
                </div>

                {/* Right Panel: Clean Surface (Modeled after reference right section) */}
                <div className="flex-1 p-5 md:p-6 flex flex-col justify-between gap-5 bg-card dark:bg-[#151a26]">
                  {/* Top section: Condition/Date + Price + Status Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        CONDITION: {v.condition?.toUpperCase() || "USED"} • ARRIVED {dateStr}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight font-mono">
                          ₦{Number(v.price).toLocaleString()}
                        </h2>
                        {isAvailable ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Available
                          </span>
                        ) : isSold ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-500/15 text-blue-500 border border-blue-500/30">
                            <CheckCircle className="w-3 h-3 text-blue-500" />
                            Sold Out
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/15 text-amber-500 border border-amber-500/30">
                            <Clock className="w-3 h-3 text-amber-500" />
                            {v.status || "Reserved"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar (Matching reference image: "6/9 Challenges" style) */}
                    <div className="flex flex-col sm:items-end gap-1.5">
                      <div className="w-36 sm:w-44 h-2 bg-muted/60 dark:bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${isSold ? 'bg-blue-500 w-full' : isAvailable ? 'bg-emerald-500 w-full' : 'bg-amber-500 w-3/4'}`}
                        />
                      </div>
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        {isSold ? "Fleet Asset Settled" : isAvailable ? "Ready for Sale" : "Processing / Reserved"}
                      </p>
                    </div>
                  </div>

                  {/* Bottom section: Action Pill Buttons (like Continue in reference image) */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      {v.vin && (
                        <span className="font-mono text-xs bg-muted/60 dark:bg-white/5 px-3 py-1 rounded-full text-muted-foreground border border-border/30">
                          {v.vin}
                        </span>
                      )}

                      {(hasEdit || hasDelete) && (
                        <div className="flex items-center gap-1">
                          {hasEdit && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              asChild
                              className="rounded-full h-9 w-9 hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="Edit Vehicle"
                            >
                              <Link to={`/vehicles/${v.id}/edit`}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Link>
                            </Button>
                          )}
                          {hasDelete && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setDeleteId(v.id)} 
                              className="rounded-full h-9 w-9 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              title="Delete Vehicle"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Primary Pill Button exactly like Continue in reference */}
                    <Button
                      size="sm"
                      asChild
                      className="rounded-full px-6 h-9 bg-[#181d2f] hover:bg-[#252c42] dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold text-xs tracking-wide shadow-lg shadow-black/20 hover:shadow-xl transition-all active:scale-95 gap-2"
                    >
                      <Link to={`/vehicles/${v.id}`}>
                        <Eye className="w-3.5 h-3.5" />
                        View Details
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Desktop Table View */
        <div className="bento-card overflow-hidden">
          <div className="table-container">
            <Table className="w-full">
              <TableHeader className="bg-foreground/5 pointer-events-none">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-semibold px-6 py-4">Vehicle</TableHead>
                  <TableHead className="font-semibold">Year</TableHead>
                  <TableHead className="font-semibold">Trim</TableHead>
                  <TableHead className="font-semibold">Chassis (VIN)</TableHead>
                  <TableHead className="font-semibold">Condition</TableHead>
                  <TableHead className="font-semibold">Source</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold text-right">{activeTab === 'sold' ? 'Sold Price' : 'Price'}</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((v) => (
                  <TableRow key={v.id} className="border-border/10 hover:bg-white/5 transition-colors group">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                         <div className="p-2 rounded-lg bg-foreground/5 group-hover:bg-sky-500/10 transition-colors">
                           <Car className="h-4 w-4 text-sky-500" />
                         </div>
                         <span className="font-semibold text-sm transition-colors group-hover:text-primary">{v.make} {v.model}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{v.year}</TableCell>
                    <TableCell className="text-sm">{v.trim || "—"}</TableCell>
                    <TableCell>
                      {v.vin ? <span className="font-mono text-xs bg-foreground/5 px-2 py-1 rounded-md">{v.vin}</span> : <span className="opacity-50">—</span>}
                    </TableCell>
                    <TableCell>{v.condition || "—"}</TableCell>
                    <TableCell className="max-w-[120px] truncate" title={v.source_company}>{v.source_company || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{v.date_arrived ? new Date(v.date_arrived).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-right font-bold text-sm font-mono">₦{Number(v.price).toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        v.status?.toLowerCase() === 'available' ? 'bg-emerald-500/10 text-emerald-500' : 
                        v.status?.toLowerCase() === 'sold' ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {v.status || "Unknown"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-lg hover:bg-primary/20 hover:text-primary"><Link to={`/vehicles/${v.id}`}><Eye className="h-4 w-4" /></Link></Button>
                        {hasEdit && (
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-lg hover:bg-foreground/20"><Link to={`/vehicles/${v.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button>
                        )}
                        {hasDelete && (
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(v.id)} className="h-8 w-8 rounded-lg hover:bg-destructive/20 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Reference-Styled Pagination Component */}
      {filtered.length > 0 && (
        <div className="pt-2">
          <CustomPagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 8, 15, 25, 50]}
            itemLabel="vehicles"
          />
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl glass-panel border-white/10 p-6 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-foreground">Delete Vehicle</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-muted-foreground">
              Are you absolutely sure you want to delete this vehicle? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-xl border-white/10 text-foreground hover:bg-white/5 sm:mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20 border-none">
              Delete Vehicle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Sold Confirmation */}
      <AlertDialog open={showDeleteSoldDialog} onOpenChange={setShowDeleteSoldDialog}>
        <AlertDialogContent className="glass-panel border-white/10 rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-6 w-6" /> Delete All Sold Vehicles?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              You are about to permanently delete <strong>{soldCount}</strong> vehicles marked as "Sold". 
              <br/><br/>
              This action <strong>cannot be undone</strong>. Are you absolutely sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl border-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteSoldMutation.mutate()} 
              className="bg-destructive hover:bg-destructive/90 rounded-xl px-6"
              disabled={deleteSoldMutation.isPending}
            >
              {deleteSoldMutation.isPending ? "Deleting..." : "Yes, Delete All Sold"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
