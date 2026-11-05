import { useState, useMemo } from "react";
import logoAsset from "@/assets/logo.png";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CustomerSelect } from "@/components/CustomerSelect";
import { CurrencyInput } from "@/components/CurrencyInput";
import { useCustomerDuplicates } from "@/hooks/useCustomerDuplicates";
import { QuotePrintPreview, exportQuotePdf } from "@/components/quotes/QuotePrintPreview";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { canEdit, canCreate } from "@/lib/permissions";
import { toast } from "sonner";
import { 
  PlusCircle, Search, Printer, Trash2, FileText, FileSignature, Car, 
  BarChart3, Package, Settings, ExternalLink, X, Building2, Pencil
} from "lucide-react";
import { getPrintHeaderHTML, getPrintWatermarkHTML } from "@/components/PrintHeader";
import { getPrintFooterHTML } from "@/components/PrintFooter";
import { numberToWords } from "@/lib/numberToWords";
import { logAction } from "@/lib/logger";
import { format, subMonths } from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, ArrowLeft, ChevronRight, LayoutGrid, List, Users, CheckCircle } from "lucide-react";
import { CustomPagination } from "@/components/CustomPagination";

// Conditions that legacy descriptions prefixed onto the vehicle title.
// They now live on their own "Condition:" line underneath the vehicle.
const KNOWN_CONDITIONS = ["Brand New", "Foreign Used", "Locally Used", "Nigerian Used", "Used", "New"];

const splitConditionFromTitle = (title: string): { title: string; condition: string } => {
  for (const c of KNOWN_CONDITIONS) {
    const re = new RegExp(`^${c}\\s+(?=\\S)`, 'i');
    if (re.test(title)) return { title: title.replace(re, '').trim(), condition: c };
  }
  return { title, condition: '' };
};

// Addresses are entered in a textarea, so keep any line breaks when printing.
const addressLines = (value?: string | null) =>
  (value || "").trim().split(/\r?\n/).filter(Boolean).join("<br/>");

const renderVehicleSpecHTML = (item: any) => {
  const rawDesc = item.vehicle_description;
  const v = item.vehicles;

  let title = '';
  let subLines: string[] = [];

  if (rawDesc) {
    if (rawDesc.includes('\n')) {
      const lines = rawDesc.split('\n').map((l: string) => l.trim()).filter(Boolean);
      title = lines[0];
      subLines = lines.slice(1);
    } else {
      const cleanDesc = rawDesc.replace(/\s*\(([^)]+)\)/g, ' - $1');
      const parts = cleanDesc.split(/\s+-\s+/).map((p: string) => p.trim()).filter(Boolean);
      title = parts[0] || '';
      parts.slice(1).forEach((part: string) => {
        if (/^(MODEL|TRANSMISSION|VIN|ENGINE|CONDITION):/i.test(part)) {
          subLines.push(part);
        } else if (part.includes(',')) {
          const commaParts = part.split(',').map(s => s.trim());
          commaParts.forEach(s => {
            const lower = s.toLowerCase();
            if (lower.includes('auto') || lower.includes('manual') || lower.includes('cvt')) {
              subLines.push(`Transmission: ${s}`);
            } else if (/^v\d+/i.test(s) || lower.includes('electric')) {
              subLines.push(`Engine: ${s}`);
            } else if (/^\d{4}$/.test(s)) {
              subLines.push(`Model: ${s}`);
            } else {
              subLines.push(`Condition: ${s}`);
            }
          });
        } else {
          subLines.push(part);
        }
      });
    }
  } else if (v) {
    title = `${v.make || ''} ${v.model || ''} ${v.trim || ''}`.trim();
    subLines.push(`Condition: ${v.condition || 'Brand New'}`);
    if (v.year) subLines.push(`Model: ${v.year}`);
    if (v.transmission) subLines.push(`Transmission: ${v.transmission}`);
    if (v.vin) subLines.push(`VIN: ${v.vin}`);
  }

  // Legacy descriptions carried the condition inside the title - move it below.
  if (!subLines.some((l: string) => /^condition:/i.test(l))) {
    const split = splitConditionFromTitle(title);
    if (split.condition) {
      title = split.title;
      subLines.unshift(`Condition: ${split.condition}`);
    }
  }

  return `
    <div style="font-weight: 700; font-size: 12px; color: #0f172a; text-transform: uppercase; margin-bottom: 2px;">${title}</div>
    ${subLines.map((line: string) => `<div style="font-size: 11px; color: #475569; margin-top: 1px;">${line}</div>`).join('')}
  `;
};

export default function PerformanceQuotes() {
  const { role } = useAuth();
  const { permissions } = usePermissions();
  const hasEdit = canEdit(role, "performance-quotes", permissions);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<any>(null);
  const [previewQuote, setPreviewQuote] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  
  const emptyForm = {
    customerMode: "existing" as "existing" | "manual",
    customerId: "",
    manualCustomer: { name: "", phone: "", email: "", address: "" },
    selectedVehicles: [] as {
      id: string;
      make: string;
      model: string;
      year: string;
      vin: string;
      base_price: string;
      has_duty: boolean;
      duty_price: string;
      quantity: number;
      isManual?: boolean;
      vehicleDescription?: string;
    }[],
    bankName: "",
    accountNumber: "",
    accountName: "",
    notes: "",
    vat_percentage: ""
  };

  const [form, setForm, clearDraft] = useFormPersistence("performance_quote", emptyForm);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehicleMode, setVehicleMode] = useState<"inventory" | "manual">("inventory");
  const [manualVehicleForm, setManualVehicleForm] = useState({ 
    make: "", model: "", year: "", vin: "", price: "", 
    condition: "Used", transmission: "Automatic", cylinders: "V6" 
  });
  
  // Queries
  const { data: quotes = [], isLoading: loadingQuotes } = useQuery({
    queryKey: ["performance_quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_quotes" as any)
        .select(`
          *,
          customers (*),
          performance_quote_items (*, vehicles (*))
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles" as any)
        .select("id, make, model, year, trim, color, vin, price")
        .eq("status", "Available")
        .neq("inventory_type", "service")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const duplicateSuggestion = useCustomerDuplicates(customers, {
    name: form.manualCustomer.name,
    phone: form.manualCustomer.phone,
    email: form.manualCustomer.email,
    address: form.manualCustomer.address
  });

  // Mutations
  const createQuoteMutation = useMutation({
    mutationFn: async () => {
      let finalCustomerId = form.customerId;

      // Handle manual customer creation
      if (form.customerMode === "manual") {
        if (!form.manualCustomer.name.trim()) throw new Error("Customer name is required");
        const { data: cust, error: custErr } = await supabase
          .from("customers")
          .insert({
            name: form.manualCustomer.name.trim(),
            phone: form.manualCustomer.phone.trim() || null,
            email: form.manualCustomer.email.trim() || null,
            address: form.manualCustomer.address.trim() || null,
          })
          .select()
          .single();
        if (custErr) throw custErr;
        finalCustomerId = cust.id;
      } else {
        if (!finalCustomerId) throw new Error("Please select a customer");
      }

      if (form.selectedVehicles.length === 0) throw new Error("Please select at least one vehicle");

      // Calculate total
      const subTotal = form.selectedVehicles.reduce((sum, v) => {
        const qty = v.quantity || 1;
        return sum + ((Number(v.base_price) || 0) * qty) + (v.has_duty ? ((Number(v.duty_price) || 0) * qty) : 0);
      }, 0);
      const vatAmount = subTotal * ((Number(form.vat_percentage) || 0) / 100);
      const totalAmount = subTotal + vatAmount;

      // Create Quote
      const response: any = await supabase
        .from("performance_quotes" as any)
        .insert({
          customer_id: finalCustomerId,
          total_amount: totalAmount,
          bank_name: form.bankName.trim() || null,
          account_number: form.accountNumber.trim() || null,
          account_name: form.accountName.trim() || null,
          notes: form.notes.trim() || null,
          vat_percentage: Number(form.vat_percentage) || 0,
          vat_amount: vatAmount,
        })
        .select()
        .single();
      const quote = response.data;
      const quoteErr = response.error;
      if (quoteErr) throw quoteErr;

      // Create Quote Items
      const items = form.selectedVehicles.map((v) => ({
        quote_id: quote.id,
        vehicle_id: v.isManual ? null : v.id,
        vehicle_description: v.isManual ? v.vehicleDescription : null,
        base_price: Number(v.base_price) || 0,
        has_duty: v.has_duty,
        duty_price: Number(v.duty_price) || 0,
        quantity: Number(v.quantity) || 1,
      }));

      const { error: itemsErr } = await supabase.from("performance_quote_items" as any).insert(items);
      if (itemsErr) throw itemsErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance_quotes"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      logAction("CREATE", "Proforma Invoice");
      toast.success("Proforma invoice created successfully. Please note it might take a moment to reflect across all views.");
      clearDraft();
      closeDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create quote");
    },
    onSettled: () => setIsSubmitting(false),
  });

  const updateQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!editingQuote) throw new Error("No quote selected for editing");

      let finalCustomerId = form.customerId;

      if (form.customerMode === "manual") {
        if (!form.manualCustomer.name.trim()) throw new Error("Customer name is required");
        const { data: cust, error: custErr } = await supabase
          .from("customers")
          .insert({
            name: form.manualCustomer.name.trim(),
            phone: form.manualCustomer.phone.trim() || null,
            email: form.manualCustomer.email.trim() || null,
            address: form.manualCustomer.address.trim() || null,
          })
          .select()
          .single();
        if (custErr) throw custErr;
        finalCustomerId = cust.id;
      } else {
        if (!finalCustomerId) throw new Error("Please select a customer");
      }

      if (form.selectedVehicles.length === 0) throw new Error("Please select at least one vehicle");

      const subTotal = form.selectedVehicles.reduce((sum, v) => {
        const qty = v.quantity || 1;
        return sum + ((Number(v.base_price) || 0) * qty) + (v.has_duty ? ((Number(v.duty_price) || 0) * qty) : 0);
      }, 0);
      const vatAmount = subTotal * ((Number(form.vat_percentage) || 0) / 100);
      const totalAmount = subTotal + vatAmount;

      // Update quote header
      const { error: updateErr } = await supabase
        .from("performance_quotes" as any)
        .update({
          customer_id: finalCustomerId,
          total_amount: totalAmount,
          bank_name: form.bankName.trim() || null,
          account_number: form.accountNumber.trim() || null,
          account_name: form.accountName.trim() || null,
          notes: form.notes.trim() || null,
          vat_percentage: Number(form.vat_percentage) || 0,
          vat_amount: vatAmount,
        })
        .eq("id", editingQuote.id);
      if (updateErr) throw updateErr;

      // Delete old items and re-insert fresh ones
      const { error: delErr } = await supabase
        .from("performance_quote_items" as any)
        .delete()
        .eq("quote_id", editingQuote.id);
      if (delErr) throw delErr;

      const items = form.selectedVehicles.map((v) => ({
        quote_id: editingQuote.id,
        vehicle_id: v.isManual ? null : v.id,
        vehicle_description: v.isManual ? v.vehicleDescription : null,
        base_price: Number(v.base_price) || 0,
        has_duty: v.has_duty,
        duty_price: Number(v.duty_price) || 0,
        quantity: Number(v.quantity) || 1,
      }));

      const { error: itemsErr } = await supabase.from("performance_quote_items" as any).insert(items);
      if (itemsErr) throw itemsErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance_quotes"] });
      logAction("UPDATE", "Proforma Invoice", editingQuote?.id);
      toast.success("Proforma invoice updated successfully!");
      closeDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update quote");
    },
    onSettled: () => setIsSubmitting(false),
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("performance_quotes" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["performance_quotes"] });
      logAction("DELETE", "Performance Quote", id);
      toast.success("Quote deleted successfully");
    },
    onError: () => toast.error("Failed to delete quote"),
  });

  const openEditDialog = (quote: any) => {
    // Map existing quote items into the form vehicle shape
    const mappedVehicles = (quote.performance_quote_items || []).map((item: any) => {
      const v = item.vehicles;
      const isManual = !item.vehicle_id;
      return {
        id: isManual ? `manual-${item.id}` : item.vehicle_id,
        make: v?.make || "",
        model: v?.model || "",
        year: v?.year || "",
        vin: v?.vin || "",
        base_price: String(item.base_price ?? "0"),
        has_duty: !!item.has_duty,
        duty_price: String(item.duty_price ?? "0"),
        quantity: Number(item.quantity) || 1,
        isManual,
        vehicleDescription: item.vehicle_description || "",
      };
    });

    setForm({
      customerMode: "existing",
      customerId: quote.customer_id || "",
      manualCustomer: { name: "", phone: "", email: "", address: "" },
      selectedVehicles: mappedVehicles,
      bankName: quote.bank_name || "",
      accountNumber: quote.account_number || "",
      accountName: quote.account_name || "",
      notes: quote.notes || "",
      vat_percentage: quote.vat_percentage || "",
    });
    setEditingQuote(quote);
    setVehicleSearch("");
    setVehicleMode("inventory");
    setManualVehicleForm({ make: "", model: "", year: "", vin: "", price: "", condition: "Used", transmission: "Automatic", cylinders: "V6" });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingQuote(null);
    setForm(emptyForm);
    setVehicleSearch("");
    setVehicleMode("inventory");
    setManualVehicleForm({ make: "", model: "", year: "", vin: "", price: "", condition: "Used", transmission: "Automatic", cylinders: "V6" });
  };

  const handleAddManualVehicle = () => {
    const { make, model, year, vin, price, condition, transmission, cylinders } = manualVehicleForm;
    if (!make.trim() || !model.trim()) return;
    
    const title = `${make.trim()} ${model.trim()}`;
    const lines: string[] = [title];
    lines.push(`Condition: ${condition ? condition.trim() : 'Brand New'}`);
    if (year.trim()) lines.push(`Model: ${year.trim()}`);
    if (transmission.trim()) lines.push(`Transmission: ${transmission.trim()}`);
    if (cylinders.trim()) lines.push(`Engine: ${cylinders.trim()}`);
    if (vin.trim()) lines.push(`VIN: ${vin.trim()}`);

    const desc = lines.join("\n");
    
    const tempId = `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setForm(prev => ({
      ...prev,
      selectedVehicles: [...prev.selectedVehicles, {
        id: tempId,
        make: make.trim(),
        model: model.trim(),
        year: year.trim(),
        vin: vin.trim(),
        base_price: price || "0",
        has_duty: false,
        duty_price: "0",
        quantity: 1,
        isManual: true,
        vehicleDescription: desc,
      }]
    }));
    setManualVehicleForm({ make: "", model: "", year: "", vin: "", price: "", condition: "Used", transmission: "Automatic", cylinders: "V6" });
    setVehicleMode("inventory");
  };

  const handleAddVehicle = (v: any) => {
    if (form.selectedVehicles.some((sv) => sv.id === v.id)) return;
    setForm(prev => ({
      ...prev,
      selectedVehicles: [...prev.selectedVehicles, {
        id: v.id,
        make: v.make,
        model: v.model,
        year: v.year,
        vin: v.vin,
        base_price: v.price?.toString() || "0",
        has_duty: false,
        duty_price: "0",
        quantity: 1,
      }]
    }));
    setVehicleSearch("");
  };

  const handleRemoveVehicle = (id: string) => {
    setForm(prev => ({
      ...prev,
      selectedVehicles: prev.selectedVehicles.filter(v => v.id !== id)
    }));
  };

  const updateVehicleData = (id: string, field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      selectedVehicles: prev.selectedVehicles.map(v => 
        v.id === id ? { ...v, [field]: value } : v
      )
    }));
  };

  const downloadQuotePDF = async (quote: any) => {
    try {
      toast.loading("Preparing invoice download...", { id: "quote-dl" });
      await exportQuotePdf(quote);
      logAction("EXPORT", "Proforma Invoice", quote.id, { customer: quote.customers?.name, format: "PDF", method: "Download" });
      toast.success("Invoice downloaded!", { id: "quote-dl" });
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate invoice", { id: "quote-dl" });
    }
  };

  const handlePrint = (quote: any) => {
    logAction("PRINT", "Proforma Invoice", quote.id, { customer: quote.customers?.name });
    setPreviewQuote(quote);
  };

  const filteredQuotes = useMemo(() => {
    return quotes.filter((q: any) => {
      // Monthly Filter
      if (selectedMonth !== "all") {
        const qDate = new Date(q.created_at);
        const qMonth = format(qDate, 'yyyy-MM');
        if (qMonth !== selectedMonth) return false;

        // Weekly Filter
        if (selectedWeek !== "all") {
          const dayOfMonth = qDate.getDate();
          const weekNum = Math.ceil(dayOfMonth / 7);
          if (String(weekNum) !== selectedWeek) return false;
        }
      }

      if (!search) return true;
      const term = search.toLowerCase();
      const custName = q.customers?.name?.toLowerCase() || "";
      const quoteId = q.id.toLowerCase();
      return custName.includes(term) || quoteId.includes(term);
    });
  }, [quotes, selectedMonth, selectedWeek, search]);

  const totalQuoteValue = useMemo(() => 
    filteredQuotes.reduce((sum: number, q: any) => sum + Number(q.total_amount), 0),
    [filteredQuotes]
  );

  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / pageSize));
  const pagedQuotes = filteredQuotes.slice(page * pageSize, (page + 1) * pageSize);

  if (previewQuote) {
    return (
      <QuotePrintPreview
        quote={previewQuote}
        onBack={() => setPreviewQuote(null)}
        onDownloadPdf={() => downloadQuotePDF(previewQuote, false)}
      />
    );
  }

  return (
    <div className="space-y-8 animate-fade-up pb-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileSignature className="w-3.5 h-3.5 text-emerald-500/60" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500/60">Sales & Proposals</span>
          </div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
            Proforma Invoices
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create and manage multi-vehicle proforma invoices with dynamic duty pricing.
          </p>
        </div>
        {canCreate(role, "performance-quotes", permissions) && (
          <div className="flex gap-2 shrink-0">
            <Button size="sm" onClick={() => setDialogOpen(true)} className="rounded-xl transition-all font-semibold text-xs h-10 px-5 bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer">
              <PlusCircle className="mr-2 h-4 w-4" /> New Quote
            </Button>
          </div>
        )}
      </div>

      {/* Dashboard Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <Card className="bento-card border-none shadow-xl">
          <CardContent className="p-6">
             <div className="flex justify-between items-start mb-4">
               <div className="p-3 bg-emerald-500/10 rounded-2xl"><FileText className="h-6 w-6 text-emerald-500" /></div>
             </div>
             <h3 className="text-3xl font-bold">{filteredQuotes.length}</h3>
             <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Total Quotes Issued</p>
          </CardContent>
        </Card>
        <Card className="bento-card border-none shadow-xl">
          <CardContent className="p-6">
             <div className="flex justify-between items-start mb-4">
               <div className="p-3 bg-blue-500/10 rounded-2xl"><BarChart3 className="h-6 w-6 text-blue-500" /></div>
             </div>
             <h3 className="text-3xl font-bold">₦{totalQuoteValue.toLocaleString()}</h3>
             <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Total Quoted Value</p>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <div className="space-y-4">
        {/* Filter Bar with View Mode Toggle */}
        <div className="bento-card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input 
              placeholder="Search quotes by customer or ID..." 
              value={search} 
              onChange={(e) => { setSearch(e.target.value); setPage(0); }} 
              className="pl-10 h-10 rounded-xl bg-background/50 border-white/10"
            />
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap sm:flex-nowrap items-center">
            <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setPage(0); }}>
              <SelectTrigger className="w-[150px] h-10 rounded-xl bg-background/50 border-white/10 text-sm">
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent className="glass-panel w-[150px] rounded-xl">
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
              <SelectTrigger className="w-[110px] h-10 rounded-xl bg-background/50 border-white/10 text-sm">
                <SelectValue placeholder="All Weeks" />
              </SelectTrigger>
              <SelectContent className="glass-panel w-[110px] rounded-xl">
                <SelectItem value="all" className="rounded-lg">All Weeks</SelectItem>
                <SelectItem value="1" className="rounded-lg">Week 1</SelectItem>
                <SelectItem value="2" className="rounded-lg">Week 2</SelectItem>
                <SelectItem value="3" className="rounded-lg">Week 3</SelectItem>
                <SelectItem value="4" className="rounded-lg">Week 4</SelectItem>
                <SelectItem value="5" className="rounded-lg">Week 5</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Toggle: Cards (Split Panel) vs Table */}
            <div className="flex items-center bg-muted/60 dark:bg-white/5 p-1 rounded-xl border border-white/10 ml-auto sm:ml-0">
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
          </div>
        </div>

        {loadingQuotes ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-28 w-full rounded-2xl bg-card/40 animate-pulse border border-white/5" />)}
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="bento-card p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
            <FileSignature className="h-12 w-12 opacity-20 mb-4 text-emerald-500" />
            <p className="font-semibold text-base mb-1">No proforma quotes found.</p>
            <p className="text-xs text-muted-foreground mb-4">No quotes match your search or filter parameters.</p>
            {(search || selectedMonth !== "all" || selectedWeek !== "all") && (
              <Button variant="link" onClick={() => { setSearch(""); setSelectedMonth("all"); setSelectedWeek("all"); setPage(0); }} className="text-emerald-500 text-xs font-semibold">
                Clear all filters
              </Button>
            )}
          </div>
        ) : viewMode === "cards" ? (
          /* Split-Panel Quotes Cards Modeled After Reference Design */
          <div className="space-y-4">
            {pagedQuotes.map((q: any) => {
              const quoteId = `PQ-${q.id.slice(0, 8).toUpperCase()}`;
              const custName = q.customers?.name || "Customer Not Specified";
              const quoteDateStr = new Date(q.quote_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              const totalAmt = Number(q.total_amount) || 0;
              const itemCount = q.performance_quote_items?.length || 0;
              const firstItem = q.performance_quote_items?.[0];
              const vehicleTitle = firstItem?.vehicles 
                ? `${firstItem.vehicles.year || ''} ${firstItem.vehicles.make} ${firstItem.vehicles.model}`.trim()
                : firstItem?.vehicle_description || "Fleet Vehicle Package";

              return (
                <div 
                  key={q.id}
                  className="rounded-[22px] overflow-hidden border border-border/50 dark:border-white/10 bg-white dark:bg-[#151a26] shadow-md hover:shadow-xl transition-all flex flex-col md:flex-row group"
                >
                  {/* Left Contrast Section: Solid dark container */}
                  <div className="w-full md:w-[32%] lg:w-[28%] bg-[#111728] dark:bg-[#0c101a] text-white p-5 md:p-6 flex flex-col justify-between shrink-0 relative">
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          PROFORMA INVOICE
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">
                          {quoteId}
                        </span>
                      </div>

                      <h3 className="text-base md:text-lg font-bold text-white leading-snug tracking-tight group-hover:text-amber-400 transition-colors">
                        {custName}
                      </h3>

                      <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5 truncate">
                        <Car className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate text-slate-200">{vehicleTitle}</span>
                        {itemCount > 1 && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-white/10 rounded-full font-mono">
                            +{itemCount - 1} more
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Bottom link modeled after "View all chapters >" */}
                    <div className="mt-5 pt-3 border-t border-white/10">
                      <div 
                        className="flex items-center justify-between text-xs text-slate-300 font-medium group/link cursor-pointer hover:text-white transition-colors"
                        title={q.customers?.phone || q.customers?.email || custName}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{q.customers?.phone || q.customers?.email || "Direct Proposal"}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 transition-transform group-hover/link:translate-x-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Right Content Section */}
                  <div className="flex-1 p-5 md:p-6 flex flex-col justify-between gap-5 bg-card dark:bg-[#151a26]">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          DATE ISSUED • {quoteDateStr}
                        </p>
                        <div className="flex items-center gap-3 flex-wrap">
                          <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                            ₦{totalAmt.toLocaleString()}
                          </h2>
                          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                            {itemCount} {itemCount === 1 ? "Vehicle" : "Vehicles"} Quoted
                          </span>
                        </div>
                      </div>

                      {/* Progress / Status indicator matching reference */}
                      <div className="flex flex-col sm:items-end gap-1.5">
                        <div className="w-36 sm:w-44 h-2 bg-muted/60 dark:bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500 w-full" />
                        </div>
                        <p className="text-[11px] font-semibold text-muted-foreground">
                          {Number(q.vat_percentage) > 0 ? `Includes ${q.vat_percentage}% VAT` : "Standard Quote"}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Action Pill Buttons matching reference */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadQuotePDF(q)}
                          className="rounded-full px-4 h-9 border-border/60 hover:bg-muted font-semibold text-xs tracking-wide transition-all gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5 text-muted-foreground" />
                          Save PDF
                        </Button>

                        {hasEdit && (
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => openEditDialog(q)} 
                              className="rounded-full h-9 w-9 hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="Edit Quote"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => deleteQuoteMutation.mutate(q.id)} 
                              className="rounded-full h-9 w-9 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              title="Delete Quote"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Primary Pill Button exactly like Continue in reference */}
                      <Button
                        size="sm"
                        onClick={() => handlePrint(q)}
                        className="rounded-full px-6 h-9 bg-[#181d2f] hover:bg-[#252c42] dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold text-xs tracking-wide shadow-lg shadow-black/20 hover:shadow-xl transition-all active:scale-95 gap-2"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print Invoice
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="bento-card overflow-hidden">
            <div className="table-container">
              <Table className="w-full">
                <TableHeader className="bg-foreground/5 pointer-events-none">
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="font-semibold px-6 py-4">Quote ID</TableHead>
                    <TableHead className="font-semibold">Customer</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Vehicles</TableHead>
                    <TableHead className="font-semibold text-right">Total Amount</TableHead>
                    <TableHead className="text-right font-semibold px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedQuotes.map((q: any) => (
                    <TableRow key={q.id} className="border-border/30 hover:bg-muted/40 transition-colors group">
                      <TableCell className="px-6 py-4 font-mono text-xs font-semibold text-emerald-500">
                        PQ-{q.id.slice(0, 8).toUpperCase()}
                      </TableCell>
                      <TableCell className="font-medium">{q.customers?.name || "Unknown"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(q.quote_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md w-fit text-xs font-semibold">
                          <Car className="h-3 w-3" /> {q.performance_quote_items?.length || 0}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">₦{Number(q.total_amount).toLocaleString()}</TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-emerald-500/20 hover:text-emerald-500">
                                <Printer className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl p-1">
                              <DropdownMenuItem onClick={() => handlePrint(q)} className="rounded-lg cursor-pointer gap-2">
                                <Printer className="h-4 w-4 text-emerald-500" /> Print Quote
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadQuotePDF(q)} className="rounded-lg cursor-pointer gap-2">
                                <Download className="h-4 w-4 text-amber-500" /> Save as PDF
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {hasEdit && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(q)} className="h-8 w-8 rounded-lg hover:bg-blue-500/20 hover:text-blue-500">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteQuoteMutation.mutate(q.id)} className="h-8 w-8 rounded-lg hover:bg-destructive/20 hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
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
        {filteredQuotes.length > 0 && (
          <div className="pt-2">
            <CustomPagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredQuotes.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[5, 8, 15, 25, 50]}
              itemLabel="quotes"
            />
          </div>
        )}
      </div>

      {/* New Quote Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border p-0 shadow-2xl">
          <div className="sticky top-0 z-10 border-b border-border p-4 sm:p-6 flex justify-between items-center bg-background/95 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={closeDialog} className="sm:hidden h-8 w-8 rounded-full shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                {editingQuote ? (
                  <><Pencil className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" /> Edit Proforma Invoice</>
                ) : (
                  <><FileSignature className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" /> Create Proforma Invoice</>
                )}
              </DialogTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={closeDialog} className="hidden sm:flex rounded-full"><X className="h-5 w-5" /></Button>
          </div>

          <div className="p-6 space-y-8">
            {/* Customer Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Customer Details</h3>
                <div className="flex items-center gap-2 text-sm bg-foreground/5 p-1 rounded-lg">
                  <button onClick={() => setForm(p => ({...p, customerMode: "existing"}))} className={`px-3 py-1.5 rounded-md transition-colors ${form.customerMode === 'existing' ? 'bg-background shadow font-semibold' : 'text-muted-foreground'}`}>Existing</button>
                  <button onClick={() => setForm(p => ({...p, customerMode: "manual"}))} className={`px-3 py-1.5 rounded-md transition-colors ${form.customerMode === 'manual' ? 'bg-background shadow font-semibold' : 'text-muted-foreground'}`}>New / Manual</button>
                </div>
              </div>

              {form.customerMode === "existing" ? (
                <div className="w-full">
                  <CustomerSelect customers={customers} value={form.customerId} onValueChange={(val) => setForm(p => ({...p, customerId: val}))} />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-border rounded-xl bg-muted/30">
                  <div className="space-y-1">
                    <Label>Customer Name *</Label>
                    <Input value={form.manualCustomer.name} onChange={e => setForm(p => ({...p, manualCustomer: {...p.manualCustomer, name: e.target.value}}))} />
                    <CustomerSuggestion 
                      suggestion={duplicateSuggestion} 
                      onSelect={(id) => setForm(p => ({...p, customerId: id, customerMode: 'existing'}))} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone Number</Label>
                    <Input value={form.manualCustomer.phone} onChange={e => setForm(p => ({...p, manualCustomer: {...p.manualCustomer, phone: e.target.value}}))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input type="email" value={form.manualCustomer.email} onChange={e => setForm(p => ({...p, manualCustomer: {...p.manualCustomer, email: e.target.value}}))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Address</Label>
                    <Input value={form.manualCustomer.address} onChange={e => setForm(p => ({...p, manualCustomer: {...p.manualCustomer, address: e.target.value}}))} />
                  </div>
                </div>
              )}
            </div>

            {/* Vehicle Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Vehicles</h3>
                <div className="flex items-center gap-2 text-sm bg-foreground/5 p-1 rounded-lg">
                  <button
                    onClick={() => { setVehicleMode("inventory"); setVehicleSearch(""); }}
                    className={`px-3 py-1.5 rounded-md transition-colors ${vehicleMode === 'inventory' ? 'bg-background shadow font-semibold' : 'text-muted-foreground'}`}
                  >
                    From Inventory
                  </button>
                  <button
                    onClick={() => { setVehicleMode("manual"); setVehicleSearch(""); }}
                    className={`px-3 py-1.5 rounded-md transition-colors ${vehicleMode === 'manual' ? 'bg-background shadow font-semibold' : 'text-muted-foreground'}`}
                  >
                    Add Manually
                  </button>
                </div>
              </div>

              {vehicleMode === "inventory" ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search inventory by make, model, VIN..."
                      value={vehicleSearch}
                      onChange={(e) => setVehicleSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {vehicleSearch && (
                    <div className="border border-border rounded-xl bg-background overflow-hidden max-h-[200px] overflow-y-auto shadow-md">
                      {vehicles.filter(v =>
                        (v.make.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
                         v.model.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
                         (v.vin && v.vin.toLowerCase().includes(vehicleSearch.toLowerCase()))) &&
                        !form.selectedVehicles.some(sv => sv.id === v.id)
                      ).map(v => (
                        <div key={v.id} className="p-3 border-b border-border/30 hover:bg-muted/50 flex justify-between items-center cursor-pointer" onClick={() => handleAddVehicle(v)}>
                          <div>
                            <p className="font-semibold text-sm">{v.year} {v.make} {v.model}</p>
                            <p className="text-xs text-muted-foreground font-mono">{v.vin}</p>
                          </div>
                          <PlusCircle className="h-5 w-5 text-emerald-500" />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 border border-dashed border-emerald-500/30 rounded-2xl bg-emerald-500/5 space-y-4">
                  <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                    <Car className="h-4 w-4 text-emerald-500" />
                    Enter vehicle details manually (not from inventory)
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Make *</Label>
                      <Input
                        placeholder="e.g. Toyota"
                        value={manualVehicleForm.make}
                        onChange={e => setManualVehicleForm(p => ({...p, make: e.target.value}))}
                        className="bg-background/50 border-white/10"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Model *</Label>
                      <Input
                        placeholder="e.g. Camry"
                        value={manualVehicleForm.model}
                        onChange={e => setManualVehicleForm(p => ({...p, model: e.target.value}))}
                        className="bg-background/50 border-white/10"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Year</Label>
                      <Input
                        placeholder="e.g. 2023"
                        value={manualVehicleForm.year}
                        onChange={e => setManualVehicleForm(p => ({...p, year: e.target.value}))}
                        className="bg-background/50 border-white/10"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">VIN / Chassis No.</Label>
                      <Input
                        placeholder="Optional"
                        value={manualVehicleForm.vin}
                        onChange={e => setManualVehicleForm(p => ({...p, vin: e.target.value}))}
                        className="bg-background/50 border-white/10"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Base Price (₦)</Label>
                      <CurrencyInput
                        value={manualVehicleForm.price}
                        onChange={e => setManualVehicleForm(p => ({...p, price: e.target.value}))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Condition</Label>
                      <Select value={manualVehicleForm.condition} onValueChange={v => setManualVehicleForm(p => ({...p, condition: v}))}>
                        <SelectTrigger className="bg-background/50 border-white/10 h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="New">New</SelectItem>
                          <SelectItem value="Used">Used</SelectItem>
                          <SelectItem value="Foreign Used">Foreign Used</SelectItem>
                          <SelectItem value="Locally Used">Locally Used</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Transmission</Label>
                      <Select value={manualVehicleForm.transmission} onValueChange={v => setManualVehicleForm(p => ({...p, transmission: v}))}>
                        <SelectTrigger className="bg-background/50 border-white/10 h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Automatic">Automatic</SelectItem>
                          <SelectItem value="Manual">Manual</SelectItem>
                          <SelectItem value="CVT">CVT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cylinders</Label>
                      <Select value={manualVehicleForm.cylinders} onValueChange={v => setManualVehicleForm(p => ({...p, cylinders: v}))}>
                        <SelectTrigger className="bg-background/50 border-white/10 h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="V4">V4</SelectItem>
                          <SelectItem value="V6">V6</SelectItem>
                          <SelectItem value="V8">V8</SelectItem>
                          <SelectItem value="V10">V10</SelectItem>
                          <SelectItem value="V12">V12</SelectItem>
                          <SelectItem value="Electric">Electric</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end col-span-2 md:col-span-3">
                      <Button
                        type="button"
                        onClick={handleAddManualVehicle}
                        disabled={!manualVehicleForm.make.trim() || !manualVehicleForm.model.trim()}
                        className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white h-10"
                      >
                        <PlusCircle className="h-4 w-4 mr-2" /> Add Vehicle
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Selected Vehicles List */}
              {form.selectedVehicles.length > 0 && (
                <div className="space-y-4 mt-6">
                  {form.selectedVehicles.map((sv, idx) => (
                    <div key={sv.id} className="p-4 border border-border rounded-2xl bg-muted/20 relative">
                      <button onClick={() => handleRemoveVehicle(sv.id)} className="absolute top-4 right-4 text-muted-foreground hover:text-destructive">
                        <X className="h-5 w-5" />
                      </button>
                      
                      <div className="flex items-center gap-2 mb-4">
                        <div className="bg-emerald-500/20 p-2 rounded-lg"><Car className="h-4 w-4 text-emerald-500" /></div>
                        <div>
                          <h4 className="font-bold">{sv.year} {sv.make} {sv.model}</h4>
                          {sv.isManual && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">Manual Entry</span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Vehicle Base Price (₦)</Label>
                            <CurrencyInput value={sv.base_price} onChange={e => updateVehicleData(sv.id, "base_price", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input 
                              type="number" 
                              min="1" 
                              value={sv.quantity === 0 ? "0" : sv.quantity || ""} 
                              onChange={e => {
                                const val = e.target.value;
                                if (val === "") {
                                  updateVehicleData(sv.id, "quantity", "");
                                } else {
                                  const parsed = parseInt(val);
                                  if (!isNaN(parsed)) updateVehicleData(sv.id, "quantity", parsed);
                                }
                              }}
                              className=""
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border flex flex-col justify-center">
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id={`duty-${sv.id}`} 
                              checked={sv.has_duty} 
                              onCheckedChange={(c) => updateVehicleData(sv.id, "has_duty", c === true)} 
                            />
                            <Label htmlFor={`duty-${sv.id}`} className="font-semibold text-amber-500 cursor-pointer">Include Custom Duty Price</Label>
                          </div>
                          {sv.has_duty && (
                            <div className="space-y-1 animate-fade-down pt-2">
                              <Label className="text-xs text-muted-foreground">Duty Price Amount (₦) per unit</Label>
                              <CurrencyInput value={sv.duty_price} onChange={e => updateVehicleData(sv.id, "duty_price", e.target.value)} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Summary */}
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-center mt-6 gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-emerald-600 uppercase">VAT (%)</Label>
                        <Input 
                          type="number" 
                          min="0"
                          step="0.1"
                          value={form.vat_percentage} 
                          onChange={e => setForm(p => ({...p, vat_percentage: e.target.value}))} 
                          className="w-24 h-9 bg-background border-emerald-500/30"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-emerald-600 uppercase">Subtotal</Label>
                        <div className="text-lg font-bold text-emerald-700">
                          ₦{form.selectedVehicles.reduce((sum, v) => sum + ((Number(v.base_price) || 0) * (v.quantity || 1)) + (v.has_duty ? ((Number(v.duty_price) || 0) * (v.quantity || 1)) : 0), 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right w-full md:w-auto border-t border-emerald-500/20 pt-4 md:pt-0 md:border-none">
                      <div className="font-bold text-lg text-emerald-500 uppercase tracking-wider mb-1">Grand Total Estimate</div>
                      <div className="text-3xl font-black text-emerald-600">
                        ₦{(() => {
                          const subTotal = form.selectedVehicles.reduce((sum, v) => sum + ((Number(v.base_price) || 0) * (v.quantity || 1)) + (v.has_duty ? ((Number(v.duty_price) || 0) * (v.quantity || 1)) : 0), 0);
                          const vatAmount = subTotal * ((Number(form.vat_percentage) || 0) / 100);
                          return (subTotal + vatAmount).toLocaleString();
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Account Details */}
            <div className="p-4 border border-border/80 rounded-2xl bg-muted/40 space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-500" />
                <h4 className="font-semibold text-sm text-foreground">Bank Account Details (Optional)</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter bank details to display on the printed proforma invoice for customer payments.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Bank Name</Label>
                  <Input
                    placeholder="e.g. Zenith Bank"
                    value={form.bankName}
                    onChange={e => setForm(p => ({ ...p, bankName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Account Number</Label>
                  <Input
                    placeholder="e.g. 1023456789"
                    value={form.accountNumber}
                    onChange={e => setForm(p => ({ ...p, accountNumber: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Account Name</Label>
                  <Input
                    placeholder="e.g. Abuja Best Cars"
                    value={form.accountName}
                    onChange={e => setForm(p => ({ ...p, accountName: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Additional Notes / Terms</Label>
              <Textarea placeholder="Enter any special conditions, validity period, etc." value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={3} className="bg-muted/30 rounded-xl" />
            </div>
          </div>

          <DialogFooter className="p-6 border-t border-border bg-muted/30">
            <Button variant="outline" onClick={closeDialog} className="rounded-xl">Cancel</Button>
            <Button 
              onClick={() => {
                setIsSubmitting(true);
                if (editingQuote) {
                  updateQuoteMutation.mutate();
                } else {
                  createQuoteMutation.mutate();
                }
              }} 
              disabled={isSubmitting || form.selectedVehicles.length === 0 || (form.customerMode === 'manual' && !form.manualCustomer.name.trim()) || (form.customerMode === 'existing' && !form.customerId)}
              className={`rounded-xl shadow-lg ${
                editingQuote
                  ? "bg-blue-500 hover:bg-blue-600 shadow-blue-500/20"
                  : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
              }`}
            >
              {isSubmitting
                ? (editingQuote ? "Saving..." : "Generating...")
                : (editingQuote ? "Save Changes" : "Generate Quote")
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
