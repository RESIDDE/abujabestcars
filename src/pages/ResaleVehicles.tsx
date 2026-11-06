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
import { CheckCircle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { 
  PlusCircle, Search, Eye, Pencil, Trash2, Download, FileText, Printer, 
  Car, ListFilter, BarChart as BarChartIcon, Clock, Package, ShieldCheck, AlertTriangle, PieChart as PieChartIcon, ChevronRight, ArrowLeft
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid
} from "recharts";
import { differenceInDays, format, subMonths } from "date-fns";
import { toast } from "sonner";
import { exportToExcel, exportToJSON, printTable, exportToCSV, exportToPDF } from "@/lib/exportHelpers";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { canEdit, canCreate } from "@/lib/permissions";
import { logAction } from "@/lib/logger";

const COLORS = ["hsl(var(--primary))", "hsl(142 76% 36%)", "hsl(38 92% 50%)", "hsl(262 83% 58%)", "hsl(0 84% 60%)", "hsl(199 89% 48%)"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-panel p-3 border border-white/20 shadow-2xl rounded-xl z-50 min-w-[150px]">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-medium flex justify-between gap-4" style={{ color: entry.color || entry.fill }}>
            <span>{entry.name}:</span> <span>{entry.value.toLocaleString()}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const PAGE_SIZE = 20;

export default function ResaleVehicles() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { permissions } = usePermissions();
  const hasEdit = canEdit(role, "resale-vehicles", permissions);
  console.log("ResaleVehicles loaded with statusFilter support", { role, hasEdit });

  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [sourceCompanyFilter, setSourceCompanyFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteSoldDialog, setShowDeleteSoldDialog] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [activeTab, setActiveTab] = useState("active");
  const queryClient = useQueryClient();

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["vehicles", "resale"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").eq("inventory_type", "resale").order("created_at", { ascending: false });
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
      toast.success("Vehicle deleted successfully. Please note it might take a moment to reflect across all views.");
    },
    onError: () => toast.error("Failed to delete vehicle"),
  });

  const deleteSoldMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("vehicles")
        .delete()
        .eq("inventory_type", "resale")
        .eq("status", "Sold");
      if (error) throw error;
      await logAction("DELETE", "Bulk Resale Vehicles", "All Sold");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("All sold resale vehicles deleted successfully");
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

  const filtered = vehicles.filter((v) => {
    // Hide customer cars from the main sales fleet view
    if (v.status === "Customer Car") return false;

    // Filter by tab
    if (activeTab === "active" && v.status === "Sold") return false;
    if (activeTab === "sold" && v.status !== "Sold") return false;

    const q = search.toLowerCase();
    const matchesSearch = !q || v.make.toLowerCase().includes(q) || v.model.toLowerCase().includes(q) || (v.vin && v.vin.toLowerCase().includes(q)) || (v.source_company && v.source_company.toLowerCase().includes(q));
    const matchesCondition = conditionFilter === "all" || v.condition === conditionFilter;
    const matchesStatus = statusFilter === "all" || v.status === statusFilter;
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

  const soldCount = vehicles.filter(v => v.status === "Sold").length;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleExportExcel = () => {
    const rows = filtered.map((v) => ({
      Make: v.make, Model: v.model, Year: v.year, VIN: v.vin || "", Color: v.color || "",
      Price: v.price, "Cost Price": v.cost_price || "", Status: v.status, Condition: v.condition || "",
      "Source Company": v.source_company || "", 
      "Source Phone": (v as any).source_company_phone || "", 
      "Company Rep": (v as any).source_rep_name || "",
      "Rep Phone": (v as any).source_rep_phone || "",
      "Date Arrived": v.date_arrived || "",
    }));
    logAction("EXPORT", "Resale Vehicle", "bulk", { format: "Excel", count: rows.length });
    exportToExcel(rows, "resale_vehicles_export");
  };

  const handleExportCSV = () => {
    const rows = filtered.map((v) => ({
      Make: v.make, Model: v.model, Year: v.year, VIN: v.vin || "", Color: v.color || "",
      Price: v.price, Status: v.status, Condition: v.condition || "",
      Source: v.source_company || "", 
      "Source Phone": (v as any).source_company_phone || "", 
      "Company Rep": (v as any).source_rep_name || "",
      "Rep Phone": (v as any).source_rep_phone || "",
      Date: v.date_arrived || "",
      "Accepted By": v.accepted_by_name || "", "Accepted Date": v.accepted_date || "",
    }));
    logAction("EXPORT", "Resale Vehicle", "bulk", { format: "CSV", count: rows.length });
    exportToCSV(rows, "resale_vehicles_export");
  };

  const handleExportPDF = () => {
    const rows = filtered.map((v) => ({
      vehicle: `${v.year} ${v.make} ${v.model}`, 
      vin: v.vin || "—", 
      price: `₦${Number(v.price).toLocaleString()}`,
      status: v.status, 
      condition: v.condition || "—",
      source_phone: (v as any).source_company_phone || "—",
      source_rep: (v as any).source_rep_name || "—",
      source_rep_phone: (v as any).source_rep_phone || "—",
      accepted_by: v.accepted_by_name || "—",
    }));
    logAction("EXPORT", "Resale Vehicle", "bulk", { format: "PDF", count: rows.length });
    exportToPDF("Resale Vehicles Inventory", rows, [
      { key: "vehicle", label: "Vehicle Description" }, 
      { key: "vin", label: "VIN/Chassis" },
      { key: "price", label: "Price" }, 
      { key: "status", label: "Status" }, 
      { key: "condition", label: "Condition" },
      { key: "source_phone", label: "Source Phone" },
      { key: "source_rep", label: "Company Rep" },
      { key: "source_rep_phone", label: "Rep Phone" },
      { key: "accepted_by", label: "Accepted By" },
    ]);
  };

  const handleExportJSON = () => {
    logAction("EXPORT", "Resale Vehicle", "bulk", { format: "JSON", count: filtered.length });
    exportToJSON(filtered, "resale_vehicles_export");
  };

  const handlePrint = () => {
    const rows = filtered.map((v) => ({
      vehicle: `${v.year} ${v.make} ${v.model}`, vin: v.vin || "—", price: `₦${Number(v.price).toLocaleString()}`,
      status: v.status, accepted_by: v.accepted_by_name || "—", accepted_date: v.accepted_date || "—",
    }));
    logAction("PRINT", "Resale Vehicle List", "bulk", { count: filtered.length });
    printTable("Resale Vehicles Inventory — Abuja Best Cars", rows, [
      { key: "vehicle", label: "Vehicle" }, { key: "vin", label: "VIN" },
      { key: "price", label: "Price" }, { key: "status", label: "Status" }, 
      { key: "accepted_by", label: "Accepted By" }, { key: "accepted_date", label: "Date" },
    ]);
  };

  return (
    <div className="space-y-8 animate-fade-up pb-10 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Car className="w-3.5 h-3.5 text-emerald-400/60" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400/60">Fleet Management</span>
            </div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-white/90">
              Resale Vehicles <span className="text-[10px] opacity-30 font-mono">v2.1</span>
            </h1>
            <p className="text-xs text-white/40 mt-0.5">
              Manage your resale inventory cars.
            </p>
          </div>
        </div>
        <div className="flex flex-row flex-wrap gap-2 shrink-0">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`rounded-xl glass-panel border-white/10 transition-all text-xs ${showAnalytics ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/20' : 'hover:bg-white/5'}`}
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
          {canCreate(role, "resale-vehicles", permissions) && (
            <Button asChild size="sm" className="rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all bg-emerald-500 hover:bg-emerald-600 text-xs">
              <Link to="/resale-vehicles/new">
                <PlusCircle className="mr-1.5 h-4 w-4" /> Add Resale Vehicle
              </Link>
            </Button>
          )}
        </div>
      </div>

      {showAnalytics && (
        <div className="space-y-6 animate-fade-down">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
            <Card className="bento-card border-none shadow-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl"><Package className="h-6 w-6 text-emerald-500" /></div>
                </div>
                <h3 className="text-3xl font-bold">{filtered.filter(v => v.status !== 'Sold').length}</h3>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Units In Stock</p>
              </CardContent>
            </Card>

            <Card className="bento-card border-none shadow-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl"><ShieldCheck className="h-6 w-6 text-emerald-500" /></div>
                </div>
                <h3 className="text-3xl font-bold">₦{filtered.filter(v => v.status !== 'Sold').reduce((sum, v) => sum + (Number(v.cost_price) || 0), 0).toLocaleString()}</h3>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Stock Value</p>
              </CardContent>
            </Card>

            <Card className="bento-card border-none shadow-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-sky-500/10 rounded-2xl"><ShieldCheck className="h-6 w-6 text-sky-500" /></div>
                </div>
                <h3 className="text-3xl font-bold">₦{filtered.filter(v => v.status !== 'Sold').reduce((sum, v) => sum + (Number(v.price) || 0), 0).toLocaleString()}</h3>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Total Selling Price</p>
              </CardContent>
            </Card>

            <Card className="bento-card border-none shadow-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-amber-500/10 rounded-2xl"><Clock className="h-6 w-6 text-amber-500" /></div>
                </div>
                <h3 className="text-3xl font-bold">{filtered.filter(v => v.status === 'Reserved').length}</h3>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Reserved Units</p>
              </CardContent>
            </Card>

            <Card className="bento-card border-none shadow-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-red-500/10 rounded-2xl"><AlertTriangle className="h-6 w-6 text-red-500" /></div>
                </div>
                <h3 className="text-3xl font-bold">{filtered.filter(v => v.condition === 'Damaged').length}</h3>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Damaged Stock</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-2 glass-panel p-1 rounded-2xl h-12">
          <TabsTrigger value="active" className="rounded-xl data-[state=active]:bg-emerald-500 data-[state=active]:text-white transition-all h-full font-bold">
            <Package className="w-4 h-4 mr-2" /> Active Resale
          </TabsTrigger>
          <TabsTrigger value="sold" className="rounded-xl data-[state=sold]:bg-blue-500 data-[state=sold]:text-white transition-all h-full font-bold">
            <CheckCircle className="w-4 h-4 mr-2" /> Sold Resale
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters Control Bar */}
      <div className="glass-panel p-4 rounded-3xl flex flex-col sm:flex-row gap-4 items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
        <div className="relative w-full sm:w-80 group z-10">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors pointer-events-none" />
          <Input 
            placeholder="Search by name, model, VIN..." 
            value={search} 
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} 
            className="pl-10 h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-emerald-500/50 transition-all font-medium text-sm w-full"
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
        
        {hasEdit && soldCount > 0 && (
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
        <div className="sm:ml-auto z-10">
           <span className="text-sm font-medium text-muted-foreground bg-background/50 px-3 py-1.5 rounded-lg border border-white/5">
             {filtered.length} Results
           </span>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 w-full rounded-2xl bg-card/40 animate-pulse" />)}
        </div>
      ) : paged.length === 0 ? (
        <div className="bento-card p-12 flex flex-col items-center justify-center text-center">
          <div className="bg-emerald-500/10 p-5 rounded-full mb-4">
            <Car className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">No resale vehicles found.</h2>
          <p className="text-muted-foreground max-w-sm mb-6">We couldn't find any vehicles in the resale category.</p>
          <Button variant="outline" onClick={() => {setSearch(''); setConditionFilter('all')}} className="rounded-xl">Clear Filters</Button>
        </div>
      ) : (
        <div className="bento-card overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto w-full">
            <Table className="w-full">
              <TableHeader className="bg-foreground/5 pointer-events-none">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-semibold px-6 py-4">Vehicle</TableHead>
                  <TableHead className="font-semibold">Year</TableHead>
                  <TableHead className="font-semibold">Trim</TableHead>
                  <TableHead className="font-semibold">Chassis (VIN)</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((v) => (
                  <TableRow key={v.id} className="border-border/10 hover:bg-white/5 transition-colors group">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                         <div className="p-2 rounded-lg bg-foreground/5 group-hover:bg-emerald-500/10 transition-colors">
                           <Car className="h-4 w-4 text-emerald-500" />
                         </div>
                         <span className="font-semibold text-sm transition-colors group-hover:text-primary">{v.make} {v.model}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{v.year}</TableCell>
                    <TableCell className="text-sm">{v.trim || "—"}</TableCell>
                    <TableCell>
                      {v.vin ? <span className="font-mono text-xs bg-foreground/5 px-2 py-1 rounded-md">{v.vin}</span> : <span className="opacity-50">—</span>}
                    </TableCell>
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
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-lg hover:bg-primary/20 hover:text-primary"><Link to={`/resale-vehicles/${v.id}`}><Eye className="h-4 w-4" /></Link></Button>
                        {hasEdit && (
                          <>
                            <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-lg hover:bg-foreground/20"><Link to={`/resale-vehicles/${v.id}/edit`}><Pencil className="h-4 w-4" /></Link></Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(v.id)} className="h-8 w-8 rounded-lg hover:bg-destructive/20 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View - Redesigned for mobile compatibility */}
          <div className="md:hidden flex flex-col divide-y divide-border/10">
            {paged.map((v) => (
              <div key={v.id} className="p-4 flex flex-col gap-4 bg-card/30">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                     <div className="p-2.5 rounded-2xl bg-emerald-500/10 shrink-0">
                       <Car className="h-5 w-5 text-emerald-500" />
                     </div>
                     <div className="min-w-0">
                       <p className="font-bold text-foreground text-sm truncate">{v.year} {v.make} {v.model}</p>
                       <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">{v.trim || "Standard Trim"}</p>
                       {v.vin && (
                         <div className="mt-2 bg-foreground/5 px-2 py-1 rounded-lg border border-white/5 inline-block max-w-full">
                           <p className="text-[9px] text-muted-foreground font-mono truncate uppercase">VIN: {v.vin}</p>
                         </div>
                       )}
                     </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      v.status?.toLowerCase() === 'available' ? 'bg-emerald-500/10 text-emerald-500' : 
                      v.status?.toLowerCase() === 'sold' ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      {v.status || "Unknown"}
                    </span>
                  </div>
                </div>



                <div className="flex gap-2 pt-2 border-t border-border/10">
                  <Button variant="outline" size="sm" asChild className="flex-1 h-9 text-xs rounded-xl border-white/10 glass-panel">
                    <Link to={`/resale-vehicles/${v.id}`}>View Details</Link>
                  </Button>
                  {hasEdit && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" asChild className="h-9 w-9 rounded-xl border-white/10 glass-panel">
                        <Link to={`/resale-vehicles/${v.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(v.id)} className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive bg-destructive/5 border border-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
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
              <div className="text-center mt-4 text-xs text-muted-foreground sm:hidden">
                Page {page + 1} of {totalPages}
              </div>
            </div>
          )}
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
              <AlertTriangle className="h-6 w-6" /> Delete All Sold Resale Vehicles?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              You are about to permanently delete <strong>{soldCount}</strong> resale vehicles marked as "Sold". 
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
