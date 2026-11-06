import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { CustomPagination } from "@/components/CustomPagination";
import { Card, CardContent } from "@/components/ui/card";
import { 
  PlusCircle, Pencil, Trash2, Receipt, Download, FileText, Printer, FileOutput, 
  DollarSign, Calendar, Search, Car, Users, QrCode, CheckCircle, Image, FileDown,
  TrendingUp, TrendingDown, ShoppingBag, Target, ArrowUpRight, BarChart3, PieChart as PieChartIcon,
  ListFilter, ArrowLeft, AlertCircle, BadgeCheck, Banknote, ChevronRight, LayoutGrid, List
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { toast } from "sonner";
import { exportToExcel, exportToJSON, printTable } from "@/lib/exportHelpers";
import { saveBlob } from "@/lib/documentExport";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { canEdit, canCreate, canDelete } from "@/lib/permissions";
import { getPrintHeaderHTML, getPrintWatermarkHTML } from "@/components/PrintHeader";
import { getPrintFooterHTML } from "@/components/PrintFooter";
import { numberToWords } from "@/lib/numberToWords";
import { logAction } from "@/lib/logger";

import { Checkbox } from "@/components/ui/checkbox";
import { SignaturePad } from "@/components/SignaturePad";
import { QrSignDialog } from "@/lib/qrHelpers";
import { CurrencyInput } from "@/components/CurrencyInput";
import { CustomerSelect } from "@/components/CustomerSelect";
import { useCustomerDuplicates } from "@/hooks/useCustomerDuplicates";
import { CustomerSuggestion } from "@/components/CustomerSuggestion";
import { SalePrintPreview, exportSaleReceipt, buildReceiptNumber, receiptDateOf } from "@/components/sales/SalePrintPreview";
import { BackButton } from "@/components/BackButton";

const COLORS = ["hsl(var(--primary))", "hsl(142 76% 36%)", "hsl(38 92% 50%)", "hsl(262 83% 58%)", "hsl(0 84% 60%)", "hsl(199 89% 48%)"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-panel p-3 border border-white/20 shadow-2xl rounded-xl z-50 min-w-[150px]">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-medium flex justify-between gap-4" style={{ color: entry.color || entry.fill }}>
            <span>{entry.name}:</span> <span>₦{entry.value.toLocaleString()}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

type ManualVehicle = {
  make: string;
  model: string;
  year: string;
  trim: string;
  color: string;
  vin: string;
  inventory_type: string;
};

const emptyManualVehicle: ManualVehicle = {
  make: "", model: "", year: "", trim: "", color: "", vin: "", inventory_type: "Lamido",
};

const emptyForm = { 
  customer_id: "", 
  selected_vehicle_ids: [] as string[],
  manual_vehicles: [] as ManualVehicle[],
  sale_price: "", 
  sale_date: new Date().toISOString().split("T")[0], 
  payment_type: "cash",
  payment_status: "paid_in_full",
  rep_name: "",
  rep_signature: "",
  buyer_signature: "",
  buyer_signature_date: "",
  notes: "",
  is_new_customer: false,
  manual_customer_name: "",
  manual_customer_phone: "",
  manual_customer_email: "",
  manual_customer_address: "",
  initial_payment: "",
};

export default function Sales() {
  const { role } = useAuth();
  const { permissions } = usePermissions();
  const hasEdit = canEdit(role, "sales", permissions);
  const hasDelete = canDelete(role, "sales", permissions);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm, clearDraft] = useFormPersistence("sale-v2", emptyForm, !!editId, editId || undefined);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [qrId, setQrId] = useState<string | null>(null);
  const [receiptSale, setReceiptSale] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [sourceCompanyFilter, setSourceCompanyFilter] = useState("all");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [manualVehicleOpen, setManualVehicleOpen] = useState(false);
  const [manualVehicleDraft, setManualVehicleDraft] = useState<ManualVehicle>(emptyManualVehicle);
  const [page, setPage] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [pageSize, setPageSize] = useState(8);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [paymentSaleId, setPaymentSaleId] = useState<string | null>(null);
  const [newPaymentAmount, setNewPaymentAmount] = useState("");
  const [newPaymentMethod, setNewPaymentMethod] = useState("cash");
  const [newPaymentNote, setNewPaymentNote] = useState("");
  const [printPaymentId, setPrintPaymentId] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState(false);
  const [previewSale, setPreviewSale] = useState<any>(null);
  const [previewPayment, setPreviewPayment] = useState<any>(null);
  const [previewPaymentIndex, setPreviewPaymentIndex] = useState<number | undefined>(undefined);
  const [previewAllPayments, setPreviewAllPayments] = useState<any[]>([]);

  const [showReceipts, setShowReceipts] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState("");
  const [receiptTypeFilter, setReceiptTypeFilter] = useState<"all" | "sale" | "payment">("all");
  const [receiptPage, setReceiptPage] = useState(0);
  const [receiptPageSize, setReceiptPageSize] = useState(10);

  const { data: sales = [], isLoading, isError } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*, sale_vehicles(*), sale_payments(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('sales_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        () => queryClient.invalidateQueries({ queryKey: ["sales"] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sale_payments' },
        () => queryClient.invalidateQueries({ queryKey: ["sales"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("id, make, model, year, trim, color, vin, cost_price, status").neq("inventory_type", "service");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name, phone, email, address, signature_data");
      if (error) throw error;
      return data;
    },
  });

  const duplicateSuggestion = useCustomerDuplicates(customers, {
    name: form.manual_customer_name,
    phone: form.manual_customer_phone,
    email: form.manual_customer_email,
    address: form.manual_customer_address
  });

  const { data: salePayments = [] } = useQuery({
    queryKey: ["sale_payments", paymentSaleId],
    queryFn: async () => {
      if (!paymentSaleId) return [];
      const { data, error } = await supabase
        .from("sale_payments" as any)
        .select("*")
        .eq("sale_id", paymentSaleId)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!paymentSaleId,
  });

  const addPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!paymentSaleId || !newPaymentAmount) return;
      const { error } = await supabase.from("sale_payments" as any).insert({
        sale_id: paymentSaleId,
        amount: parseFloat(newPaymentAmount),
        payment_method: newPaymentMethod,
        notes: newPaymentNote || "Balance payment",
        payment_date: new Date().toISOString()
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sale_payments", paymentSaleId] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      setNewPaymentAmount("");
      setNewPaymentNote("");
      toast.success("Payment recorded successfully");
    },
    onError: () => toast.error("Failed to record payment")
  });

  const vehicleMap = Object.fromEntries(vehicles.map((v) => [
    v.id, 
    `${v.year} ${v.make} ${v.model} ${v.trim ? `${v.trim} ` : ""}${v.color ? `(${v.color})` : ""}`.trim()
  ]));
  const fullVehicleMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));
  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const customerObjMap = Object.fromEntries(customers.map((c) => [c.id, c]));
  
  const sourceCompanies = useMemo(() => {
    const companies = new Set<string>();
    vehicles.forEach(v => {
      if (v.source_company) companies.add(v.source_company);
    });
    return Array.from(companies).sort();
  }, [vehicles]);

  const getSalePaymentInfo = (s: any) => {
    const payments = s.sale_payments || [];
    const totalPaid = payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const salePrice = Number(s.sale_price) || 0;
    
    if (payments.length > 0) {
      const balance = Math.max(0, salePrice - totalPaid);
      const isDeposit = balance > 0 || s.payment_status === "deposit";
      return {
        isDeposit,
        isPaidInFull: balance <= 0 && totalPaid >= salePrice,
        totalPaid,
        balance,
        hasPayments: true,
      };
    }

    const isDeposit = s.payment_status === "deposit";
    return {
      isDeposit,
      isPaidInFull: !isDeposit,
      totalPaid: isDeposit ? 0 : salePrice,
      balance: isDeposit ? salePrice : 0,
      hasPayments: false,
    };
  };

  /* ---------------------------------------------------------------- */
  /*  Receipt ledger                                                   */
  /*                                                                   */
  /*  Every receipt the system can issue is derived from the sale and  */
  /*  payment records themselves, so the ledger is a complete backup   */
  /*  by construction: nothing can be printed that is missing here,    */
  /*  and every entry re-opens the real document, numbered exactly as  */
  /*  it was the first time it was printed.                           */
  /* ---------------------------------------------------------------- */
  const receiptRecords = useMemo(() => {
    const records: any[] = [];

    sales.forEach((sale: any) => {
      const vIds: string[] = sale.sale_vehicles?.length > 0
        ? sale.sale_vehicles.map((sv: any) => sv.vehicle_id)
        : (sale.vehicle_id ? [sale.vehicle_id] : []);
      const vObjs = vIds.map((id) => fullVehicleMap[id]).filter(Boolean);
      const vehicleLabel = vObjs.length > 0
        ? vObjs.map((v: any) => `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`).join(", ")
        : "—";
      const vins = vObjs.map((v: any) => v.vin).filter(Boolean);
      const customer = customerObjMap[sale.customer_id];
      const salePrice = Number(sale.sale_price) || 0;

      // Payments newest-first, matching the order the document expects.
      const payments = [...(sale.sale_payments || [])].sort(
        (a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
      );

      const totalPaid = payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

      const base = {
        sale,
        customer,
        customerName: customer?.name || "—",
        customerPhone: customer?.phone || "",
        vehicleLabel,
        vins,
        saleDate: sale.sale_date,
      };

      // The sale receipt — the full invoice for the transaction.
      records.push({
        ...base,
        key: `sale-${sale.id}`,
        type: "sale" as const,
        typeLabel: "Sale receipt",
        receiptNo: buildReceiptNumber(sale),
        date: receiptDateOf(sale),
        amount: salePrice,
        statusLabel: payments.length === 0
          ? (sale.payment_status === "deposit" ? "Balance due" : "Paid in full")
          : (totalPaid >= salePrice ? "Paid in full" : "Balance due"),
        payment: undefined,
        paymentIndex: undefined,
        allPayments: payments,
      });

      // One receipt per payment taken against the sale.
      payments.forEach((p: any, descIndex: number) => {
        const paidUpToThis = payments
          .filter((_: any, i: number) => i >= descIndex)
          .reduce((sum: number, px: any) => sum + (Number(px.amount) || 0), 0);
        const positionFromEnd = payments.length - 1 - descIndex;
        const ordinals = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
        const settled = paidUpToThis >= salePrice;
        records.push({
          ...base,
          key: `payment-${p.id}`,
          type: "payment" as const,
          typeLabel: settled
            ? "Final payment"
            : positionFromEnd === 0
              ? "Deposit"
              : `${ordinals[positionFromEnd] || `${positionFromEnd + 1}th`} payment`,
          receiptNo: buildReceiptNumber(sale, p),
          date: receiptDateOf(sale, p),
          amount: Number(p.amount) || 0,
          statusLabel: settled ? "Paid in full" : "Part payment",
          paymentMethod: p.payment_method || "",
          paymentNotes: p.notes || "",
          payment: p,
          paymentIndex: descIndex,
          allPayments: payments,
        });
      });
    });

    // Everything searchable about a receipt, including the date written the
    // several ways someone might type it (month name, day, year, slashes).
    return records
      .map((r) => {
        const d = new Date(r.date);
        const saleD = new Date(r.saleDate);
        const dateForms = [d, saleD].flatMap((dt) =>
          isNaN(dt.getTime()) ? [] : [
            format(dt, "yyyy-MM-dd"),
            format(dt, "dd/MM/yyyy"),
            format(dt, "d MMMM yyyy"),
            format(dt, "MMM"),
            format(dt, "MMMM"),
            format(dt, "EEEE"),
            format(dt, "yyyy"),
            String(dt.getDate()),
          ]
        );
        return {
          ...r,
          haystack: [
            r.receiptNo,
            r.typeLabel,
            r.customerName,
            r.customerPhone,
            r.vehicleLabel,
            ...r.vins,
            r.statusLabel,
            r.paymentMethod || "",
            r.paymentNotes || "",
            String(r.amount),
            r.amount.toLocaleString(),
            r.sale.id,
            r.payment?.id || "",
            ...dateForms,
          ].join(" ").toLowerCase(),
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, fullVehicleMap, customerObjMap]);

  const filteredReceipts = useMemo(() => {
    const terms = receiptSearch.toLowerCase().split(/\s+/).filter(Boolean);
    return receiptRecords.filter((r) => {
      if (receiptTypeFilter !== "all" && r.type !== receiptTypeFilter) return false;
      return terms.every((t) => r.haystack.includes(t));
    });
  }, [receiptRecords, receiptSearch, receiptTypeFilter]);

  const receiptTotalPages = Math.max(1, Math.ceil(filteredReceipts.length / receiptPageSize));
  const pagedReceipts = filteredReceipts.slice(
    receiptPage * receiptPageSize,
    (receiptPage + 1) * receiptPageSize
  );

  useEffect(() => { setReceiptPage(0); }, [receiptSearch, receiptTypeFilter, receiptPageSize]);

  const openReceiptRecord = (r: any) => {
    setPreviewSale(r.sale);
    setPreviewPayment(r.payment || null);
    setPreviewPaymentIndex(r.paymentIndex);
    setPreviewAllPayments(r.allPayments || []);
    setPrintMode(true);
    logAction("PRINT", r.type === "payment" ? "Sales Payment" : "Sales", r.payment?.id || r.sale.id, {
      receipt_no: r.receiptNo,
    });
  };

  const downloadReceiptRecord = (r: any, type: 'pdf' | 'png' | 'jpeg') =>
    downloadSaleReceipt(
      r.sale,
      type,
      r.payment ? { payment: r.payment, paymentIndex: r.paymentIndex, allPayments: r.allPayments } : undefined
    );

  const exportReceiptLedger = (as: "excel" | "json") => {
    const rows = filteredReceipts.map((r) => ({
      "Receipt No": r.receiptNo,
      Type: r.typeLabel,
      "Receipt Date": format(new Date(r.date), "yyyy-MM-dd"),
      "Sale Date": r.saleDate ? format(new Date(r.saleDate), "yyyy-MM-dd") : "",
      Customer: r.customerName,
      Phone: r.customerPhone,
      Vehicle: r.vehicleLabel,
      VIN: r.vins.join(", "),
      Amount: r.amount,
      Status: r.statusLabel,
      Method: r.paymentMethod || "",
      Notes: r.paymentNotes || "",
      "Sale ID": r.sale.id,
      "Payment ID": r.payment?.id || "",
    }));
    logAction("EXPORT", "Sales Receipts", "bulk", { format: as, count: rows.length });
    if (as === "excel") exportToExcel(rows, "receipts_backup");
    else exportToJSON(rows, "receipts_backup");
  };

  const filtered = sales.filter((s) => {
    const q = search.toLowerCase();
    const vName = (vehicleMap[s.vehicle_id] || "").toLowerCase();
    const cName = (customerMap[s.customer_id] || "").toLowerCase();
    
    // Monthly Filter
    if (selectedMonth !== "all") {
      const saleDate = new Date(s.sale_date);
      const saleMonth = format(saleDate, 'yyyy-MM');
      if (saleMonth !== selectedMonth) return false;

      // Weekly Filter (within the selected month)
      if (selectedWeek !== "all") {
        const dayOfMonth = saleDate.getDate();
        const weekNum = Math.ceil(dayOfMonth / 7);
        if (String(weekNum) !== selectedWeek) return false;
      }
    }

    if (sourceCompanyFilter !== "all") {
      const vIds = s.sale_vehicles?.length > 0 ? s.sale_vehicles.map((sv:any) => sv.vehicle_id) : [s.vehicle_id];
      const hasSourceMatch = vIds.some((vid:string) => fullVehicleMap[vid]?.source_company === sourceCompanyFilter);
      if (!hasSourceMatch) return false;
    }

    if (paymentStatusFilter !== "all") {
      const info = getSalePaymentInfo(s);
      if (paymentStatusFilter === "deposit" && !info.isDeposit) return false;
      if (paymentStatusFilter === "paid_in_full" && !info.isPaidInFull) return false;
    }

    return !q || vName.includes(q) || cName.includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      let finalCustomerId = form.customer_id;

      if (form.is_new_customer && form.manual_customer_name) {
        const { data: newCust, error: cErr } = await supabase.from("customers").insert({
          name: form.manual_customer_name,
          phone: form.manual_customer_phone || null,
          email: form.manual_customer_email || null,
          address: form.manual_customer_address || null,
        }).select().single();
        if (cErr) throw cErr;
        finalCustomerId = newCust.id;
      }

      if (!finalCustomerId) throw new Error("Please select or enter a customer");

      // Create records for vehicles typed in manually (not yet in inventory)
      const createdVehicleIds: string[] = [];
      for (const mv of (form.manual_vehicles || [])) {
        const { data: newVeh, error: vErr } = await supabase.from("vehicles").insert({
          make: mv.make.trim(),
          model: mv.model.trim(),
          year: parseInt(mv.year, 10) || new Date().getFullYear(),
          trim: mv.trim?.trim() || null,
          color: mv.color?.trim() || null,
          vin: mv.vin.trim().toUpperCase().slice(0, 17),
          status: "Sold",
          inventory_type: mv.inventory_type || "Lamido",
        }).select("id").single();
        if (vErr) throw vErr;
        createdVehicleIds.push(newVeh.id);
      }

      const allVehicleIds = [
        ...form.selected_vehicle_ids.filter(vid => vehicles.some(v => v.id === vid)),
        ...createdVehicleIds,
      ];

      const payload = {
        customer_id: finalCustomerId,
        sale_price: parseFloat(form.sale_price),
        sale_date: form.sale_date,
        payment_type: form.payment_type,
        payment_status: form.payment_status,
        rep_name: form.rep_name,
        rep_signature: form.rep_signature,
        buyer_signature: form.buyer_signature || null,
        buyer_signature_date: form.buyer_signature_date || null,
        notes: form.notes || null,
        // For backward compatibility, also keep first vehicle_id if any
        vehicle_id: allVehicleIds[0] || null,
      };

      let saleId = editId;
      if (editId) {
        const { error } = await supabase.from("sales").update(payload).eq("id", editId);
        if (error) throw error;
        // Clear existing links
        await supabase.from("sale_vehicles").delete().eq("sale_id", editId);
      } else {
        const { data, error } = await supabase.from("sales").insert(payload).select().single();
        if (error) throw error;
        if (!data) throw new Error("Failed to retrieve new sale ID");
        saleId = data.id;
      }

      if (allVehicleIds.length > 0) {
        const links = allVehicleIds.map(vid => ({
          sale_id: saleId,
          vehicle_id: vid,
          price: parseFloat(form.sale_price) / allVehicleIds.length // Provisional split
        }));
        const { error } = await supabase.from("sale_vehicles").insert(links);
        if (error) throw error;

        // Mark vehicles as sold
        const { error: vError } = await supabase
          .from("vehicles")
          .update({ status: "Sold" })
          .in("id", allVehicleIds);
        if (vError) throw vError;
      }

      // Record initial payment if provided
      if (!editId && form.initial_payment && parseFloat(form.initial_payment) > 0) {
        const { error: pErr } = await supabase.from("sale_payments" as any).insert({
          sale_id: saleId,
          amount: parseFloat(form.initial_payment),
          payment_date: new Date().toISOString(),
          payment_method: form.payment_type,
          notes: "Initial payment at time of sale"
        });
        if (pErr) throw pErr;
      }
    },
    onSuccess: (_, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      const action = editId ? "UPDATE" : "CREATE";
      logAction(action, "Sales", editId ?? undefined);
      toast.success(`${editId ? "Sale updated" : "Sale recorded"} successfully. Please note it might take a moment to reflect across all views.`);
      clearDraft();
      setForm(emptyForm);
      setManualVehicleDraft(emptyManualVehicle);
      setManualVehicleOpen(false);
      setEditId(null);
      setDialogOpen(false);
    },
    onError: (error: any) => {
      console.error("Sale Save Error:", error);
      toast.error(`Failed to save sale: ${error.message || "Unknown error"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_,id) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      logAction("DELETE", "Sales", id);
      toast.success("Sale deleted");
    },
    onError: () => toast.error("Failed to delete sale"),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    // An edit's draft is keyed to that sale and is never restored into the
    // edit form again, so keeping it can only leak that sale's vehicles and
    // figures into the next new sale. Drop it on the way out.
    if (editId) {
      clearDraft();
      setForm(emptyForm);
    }
    setEditId(null);
    setManualVehicleOpen(false);
    setManualVehicleDraft(emptyManualVehicle);
  };

  const openEdit = (s: any) => {
    setEditId(s.id);
    setForm({
      customer_id: s.customer_id,
      selected_vehicle_ids: s.sale_vehicles?.map((sv: any) => sv.vehicle_id) || (s.vehicle_id ? [s.vehicle_id] : []),
      manual_vehicles: [] as ManualVehicle[],
      sale_price: String(s.sale_price),
      sale_date: s.sale_date,
      payment_type: s.payment_type || "cash",
      payment_status: s.payment_status || "paid_in_full",
      rep_name: s.rep_name || "",
      rep_signature: s.rep_signature || "",
      buyer_signature: s.buyer_signature || "",
      buyer_signature_date: s.buyer_signature_date || "",
      notes: s.notes || "",
      is_new_customer: false,
      manual_customer_name: "",
      manual_customer_phone: "",
      manual_customer_email: "",
      manual_customer_address: "",
      initial_payment: "",
    });
    setDialogOpen(true);
  };

  /**
   * Opens the dialog for a brand new sale.
   *
   * The form keeps a draft so an interrupted sale is not lost, but a draft
   * left behind by an EDIT belongs to that sale alone: carried into a new
   * sale it would silently record the previous sale's vehicle. So leaving
   * an edit behind wipes the draft before the blank form opens.
   */
  const openCreate = () => {
    if (editId) {
      clearDraft();
      setForm(emptyForm);
    }
    setEditId(null);
    setManualVehicleOpen(false);
    setManualVehicleDraft(emptyManualVehicle);
    setDialogOpen(true);
  };

  /* A car that is already sold has nothing left to sell, so it is kept out of
     the picker — except on a sale that already holds it, which must still show
     (and keep) its own vehicles while being edited. */
  const selectableVehicles = useMemo(
    () => vehicles.filter(
      (v: any) => v.status?.toLowerCase() !== "sold" || form.selected_vehicle_ids.includes(v.id)
    ),
    [vehicles, form.selected_vehicle_ids]
  );

  /* A manually added vehicle is identified by its VIN, so the VIN is required
     and must not already belong to a vehicle on record or to another vehicle
     queued on this same sale — the VIN column is unique. */
  const manualVin = manualVehicleDraft.vin.trim().toUpperCase();
  const manualVehicleVinTaken =
    manualVin.length > 0 &&
    (vehicles.some((v: any) => (v.vin || "").trim().toUpperCase() === manualVin) ||
      (form.manual_vehicles || []).some((mv) => mv.vin.trim().toUpperCase() === manualVin));
  const manualVehicleReady =
    manualVin.length > 0 &&
    !manualVehicleVinTaken &&
    manualVehicleDraft.make.trim().length > 0 &&
    manualVehicleDraft.model.trim().length > 0 &&
    manualVehicleDraft.year.trim().length > 0;

  const canSubmit = (form.selected_vehicle_ids.length + (form.manual_vehicles?.length || 0) > 0) && (form.customer_id || (form.is_new_customer && form.manual_customer_name)) && form.sale_price && !upsertMutation.isPending;

  const handleExportExcel = () => {
    const rows = filtered.map((s) => ({
      Vehicle: vehicleMap[s.vehicle_id] || s.vehicle_id,
      Customer: customerMap[s.customer_id] || s.customer_id,
      "Sale Price": s.sale_price,
      "Sale Date": s.sale_date,
      Notes: s.notes || "",
    }));
    logAction("EXPORT", "Sales", "bulk", { format: "Excel", count: rows.length });
    exportToExcel(rows, "sales_export");
  };

  const handleExportJSON = () => {
    logAction("EXPORT", "Sales", "bulk", { format: "JSON", count: filtered.length });
    exportToJSON(filtered, "sales_export");
  };

  const handlePrint = () => {
    const rows = filtered.map((s) => ({
      vehicle: vehicleMap[s.vehicle_id] || s.vehicle_id,
      customer: customerMap[s.customer_id] || s.customer_id,
      sale_price: `₦${Number(s.sale_price).toLocaleString()}`,
      sale_date: new Date(s.sale_date).toLocaleDateString(),
      notes: s.notes || "",
    }));
    logAction("PRINT", "Sales List", "bulk", { count: rows.length });
    printTable("Sales Report — Abuja Best Cars", rows, [
      { key: "vehicle", label: "Vehicle" },
      { key: "customer", label: "Customer" },
      { key: "sale_price", label: "Sale Price" },
      { key: "sale_date", label: "Sale Date" },
      { key: "notes", label: "Notes" },
    ]);
  };

  const printReceipt = (sale: any, isBulk = false, logoBase64?: string) => {
    const cust = customerObjMap[sale.customer_id];
    const totalAmount = Number(sale.sale_price) || 0;
    
    // Get full vehicle objects for the items in this sale
    const saleVehicleIds = sale.sale_vehicles?.length > 0 
      ? sale.sale_vehicles.map((sv: any) => sv.vehicle_id)
      : [sale.vehicle_id];
      
    const saleVehicleObjects = vehicles.filter(v => saleVehicleIds.includes(v.id));

    return `
    <div class="receipt-page" style="${isBulk ? 'page-break-after: always;' : ''}">
      <div class="date-section">RECEIPT NO: ${sale.id.slice(0, 8).toUpperCase()}<br/>DATE: ${new Date(sale.sale_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>

      <div class="bill-to">
        <p style="font-weight: 900;">CUSTOMER:</p>
        <p><strong>${cust?.name || "—"}</strong></p>
        ${cust?.phone ? `<p>Tel: ${cust.phone}</p>` : ""}
      </div>

      <div class="main-container">
        ${getPrintWatermarkHTML(logoBase64)}
        <div class="content-wrapper">
          <h2 class="bill-title" style="margin-bottom: 15px;">VEHICLE SALES RECEIPT</h2>
          
          <div style="margin-bottom: 10px;">
            ${saleVehicleObjects.map((v: any) => `
              <div style="margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                <h3 style="font-size: 14px; font-weight: 900; margin-bottom: 6px; color: #0f172a; text-transform: uppercase;">Vehicle Specification</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div>
                    <p style="font-size: 10px; color: #64748b; font-weight: 800; margin: 0; text-transform: uppercase;">Make</p>
                    <p style="font-size: 13px; font-weight: 700; margin: 2px 0 0 0;">${v.make}</p>
                  </div>
                  <div>
                    <p style="font-size: 10px; color: #64748b; font-weight: 800; margin: 0; text-transform: uppercase;">Model</p>
                    <p style="font-size: 13px; font-weight: 700; margin: 2px 0 0 0;">${v.model}</p>
                  </div>
                  <div>
                    <p style="font-size: 10px; color: #64748b; font-weight: 800; margin: 0; text-transform: uppercase;">Year</p>
                    <p style="font-size: 13px; font-weight: 700; margin: 2px 0 0 0;">${v.year}</p>
                  </div>
                  <div>
                    <p style="font-size: 10px; color: #64748b; font-weight: 800; margin: 0; text-transform: uppercase;">Trim / Edition</p>
                    <p style="font-size: 13px; font-weight: 700; margin: 2px 0 0 0;">${v.trim || "Standard"}</p>
                  </div>
                  <div style="grid-column: span 2;">
                    <p style="font-size: 10px; color: #64748b; font-weight: 800; margin: 0; text-transform: uppercase;">Chassis No (VIN)</p>
                    <p style="font-size: 13px; font-weight: 700; margin: 2px 0 0 0; font-family: monospace;">${v.vin || "—"}</p>
                  </div>
                </div>
              </div>
            `).join("")}
          </div>

          <div style="background: transparent; padding: 8px 20px; border-radius: 15px; border: 2px solid #e2e8f0; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 15px; font-weight: 800; color: #64748b;">TOTAL AMOUNT PAID</span>
              <span style="font-size: 22px; font-weight: 900; color: #0f172a;">₦${totalAmount.toLocaleString()}</span>
            </div>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e1;">
              <p style="font-size: 11px; font-weight: 800; color: #64748b; margin: 0; text-transform: uppercase;">Amount in Words</p>
              <p style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 4px 0 0 0; line-height: 1.3;">${numberToWords(totalAmount).toUpperCase()}</p>
            </div>
          </div>

        </div>
      </div>
    </div>`;
  };

  const printPaymentReceipt = (sale: any, payment: any, paymentIndex: number, allPayments: any[]) => {
    logAction("PRINT", "Sales Payment", payment.id, {
      sale_id: sale.id,
      amount: payment.amount,
      method: payment.payment_method,
    });
    setPreviewSale(sale);
    setPreviewPayment(payment);
    setPreviewPaymentIndex(paymentIndex);
    setPreviewAllPayments(allPayments);
    setPaymentSaleId(null);
    setPrintMode(true);
    return;
    const cust = customerObjMap[sale.customer_id];
    const totalSalePrice = Number(sale.sale_price) || 0;
    const paymentAmount = Number(payment.amount) || 0;
    const totalPaidBefore = allPayments
      .filter((_: any, i: number) => i > paymentIndex) // payments are desc order, so > index = earlier
      .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const totalPaidIncludingThis = totalPaidBefore + paymentAmount;
    const balance = totalSalePrice - totalPaidIncludingThis;
    const isFullPayment = balance <= 0;
    
    // Determine payment label (1st, 2nd, 3rd, etc.)
    const ordinalLabels = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
    const positionFromEnd = allPayments.length - 1 - paymentIndex; // since desc
    const ordinal = ordinalLabels[positionFromEnd] || `${positionFromEnd + 1}th`;
    const paymentLabel = isFullPayment 
      ? "FULL PAYMENT RECEIPT" 
      : positionFromEnd === 0 
        ? "DEPOSIT RECEIPT" 
        : `${ordinal} PAYMENT RECEIPT`;
    const badgeColor = isFullPayment ? "#059669" : "#d97706";
    const badgeText = isFullPayment ? "FULLY PAID" : "PART PAYMENT";

    const saleVehicleIds = sale.sale_vehicles?.length > 0
      ? sale.sale_vehicles.map((sv: any) => sv.vehicle_id)
      : [sale.vehicle_id];
    const saleVehicleObjects = vehicles.filter(v => saleVehicleIds.includes(v.id));

    const html = `<html><head><title>${paymentLabel} - ${sale.id.slice(0, 8).toUpperCase()}</title>
    <style>
      @page { margin: 0; size: A4; }
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap');
      body { font-family: 'Roboto', 'Arial', sans-serif; padding: 20mm; width: 210mm; min-height: 297mm; margin: 0 auto; box-sizing: border-box; background: white; color: #1a1a1a; line-height: 1.1; }
      .date-section { text-align: right; font-weight: 800; font-size: 12px; margin-bottom: 4px; text-transform: uppercase; padding: 0; }
      .bill-to { margin-bottom: 8px; padding: 0; }
      .bill-to p { margin: 1px 0; font-size: 12px; }
      .main-container { background-color: transparent; border-radius: 20px; padding: 0; min-height: 550px; position: relative; border: none; }
      .content-wrapper { position: relative; z-index: 1; }
      .bill-title { text-align: center; text-decoration: underline; font-weight: 900; font-size: 16px; margin-bottom: 8px; color: #1e293b; text-transform: uppercase; }
      .deposit-badge { display: inline-block; background: ${badgeColor}; color: #fff; font-weight: 900; font-size: 10px; padding: 3px 12px; border-radius: 20px; letter-spacing: 2px; text-transform: uppercase; margin: 0 auto 8px; }
      .badge-wrap { text-align: center; margin-bottom: 8px; }
      .payment-ref { background: transparent; border: 2px dashed #cbd5e1; padding: 8px 14px; border-radius: 12px; margin-bottom: 12px; font-size: 11px; color: #64748b; }
      .amount-box { border: 2px solid #0f172a; border-radius: 12px; padding: 8px 18px; margin-bottom: 8px; background: transparent; }
      .amount-box .label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; }
      .amount-box .value { font-size: 20px; font-weight: 900; color: #0f172a; }
      .balance-box { border: 2px solid ${isFullPayment ? '#059669' : '#ef4444'}; border-radius: 12px; padding: 6px 18px; margin-bottom: 8px; background: ${isFullPayment ? 'rgba(5,150,105,0.02)' : 'rgba(239,68,68,0.02)'}; }
      .balance-box .label { font-size: 11px; font-weight: 800; color: ${isFullPayment ? '#059669' : '#ef4444'}; text-transform: uppercase; }
      .balance-box .value { font-size: 18px; font-weight: 900; color: ${isFullPayment ? '#059669' : '#ef4444'}; }
      .history-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
      .history-table th { background: transparent; text-align: left; padding: 4px 8px; font-weight: 800; text-transform: uppercase; font-size: 9px; border-bottom: 1px solid #cbd5e1; }
      .history-table td { padding: 4px 8px; border-bottom: 1px solid #e2e8f0; background: transparent; }
      .history-table .current { background: rgba(254, 249, 195, 0.3); font-weight: 900; }
      .refund-note { margin-top: 4px; padding: 4px; background: rgba(254,226,226,0.2); border: 2px solid #ef4444; border-radius: 10px; color: #b91c1c; font-weight: 900; font-size: 12px; text-align: center; margin-bottom: 8px; }
      .signature-area { display: flex; justify-content: space-between; margin-top: 8px; border-top: 2px solid #94a3b8; padding-top: 8px; }
      .sig-box { width: 45%; text-align: center; font-size: 11px; }
      .signature-img { max-height: 30px; display: block; margin: 0 auto 4px; }
    </style></head><body>
    ${getPrintHeaderHTML()}
    <div class="date-section">
      RECEIPT NO: ${sale.id.slice(0, 8).toUpperCase()} | PAYMENT REF: ${payment.id.slice(0, 8).toUpperCase()}<br/>
      DATE: ${new Date(payment.payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
    </div>
    <div class="bill-to">
      <p style="font-weight: 900;">CUSTOMER:</p>
      <p><strong>${cust?.name || "—"}</strong></p>
      ${cust?.phone ? `<p>Tel: ${cust.phone}</p>` : ""}
    </div>
    <div class="main-container">
      ${getPrintWatermarkHTML()}
      <div class="content-wrapper">
        <h2 class="bill-title">${paymentLabel}</h2>
        <div class="badge-wrap"><span class="deposit-badge">${badgeText}</span></div>

        <div class="payment-ref">
          <strong>Sale Date:</strong> ${new Date(sale.sale_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          &nbsp;&nbsp;|&nbsp;&nbsp;
          <strong>Payment Method:</strong> ${(payment.payment_method || 'Cash').toUpperCase()}
          &nbsp;&nbsp;|&nbsp;&nbsp;
          <strong>Payment No.:</strong> ${ordinal}
          ${payment.notes ? `<br/><strong>Note:</strong> ${payment.notes}` : ""}
        </div>

        ${saleVehicleObjects.map((v: any) => `
          <div style="margin-bottom: 12px; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 10px;">
            <p style="font-size: 11px; font-weight: 800; color: #64748b; margin: 0 0 6px; text-transform: uppercase;">Vehicle</p>
            <p style="font-size: 15px; font-weight: 700; margin: 0;">${v.year} ${v.make} ${v.model}${v.trim ? ' ' + v.trim : ''}${v.color ? ' (' + v.color + ')' : ''}</p>
            ${v.vin ? `<p style="font-size: 12px; font-family: monospace; color: #64748b; margin: 2px 0 0;">VIN: ${v.vin}</p>` : ''}
          </div>
        `).join("")}

        <div class="amount-box">
          <p class="label">Amount Paid (This Payment)</p>
          <p class="value">₦${paymentAmount.toLocaleString()}</p>
          <p style="font-size: 11px; color: #94a3b8; margin: 2px 0 0;">${numberToWords(paymentAmount).toUpperCase()}</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
          <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 14px;">
            <p style="font-size: 10px; font-weight: 800; color: #64748b; margin: 0; text-transform: uppercase;">Total Sale Price</p>
            <p style="font-size: 16px; font-weight: 900; color: #0f172a; margin: 2px 0 0;">₦${totalSalePrice.toLocaleString()}</p>
          </div>
          <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 14px;">
            <p style="font-size: 10px; font-weight: 800; color: #64748b; margin: 0; text-transform: uppercase;">Total Paid To Date</p>
            <p style="font-size: 16px; font-weight: 900; color: #0f172a; margin: 2px 0 0;">₦${totalPaidIncludingThis.toLocaleString()}</p>
          </div>
        </div>

        <div class="balance-box">
          <p class="label">${isFullPayment ? "✓ Balance Outstanding" : "Balance Remaining"}</p>
          <p class="value">${isFullPayment ? "NIL — FULLY PAID" : "₦" + balance.toLocaleString()}</p>
        </div>

        ${allPayments.length > 1 ? `
        <div style="margin-bottom: 10px;">
          <p style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Payment History</p>
          <table class="history-table">
            <thead><tr><th>#</th><th>Date</th><th>Method</th><th>Note</th><th style="text-align:right;">Amount</th></tr></thead>
            <tbody>
              ${[...allPayments].reverse().map((p: any, i: number) => `
                <tr class="${p.id === payment.id ? 'current' : ''}">
                  <td>${ordinalLabels[i] || (i + 1) + 'th'}</td>
                  <td>${new Date(p.payment_date).toLocaleDateString('en-GB')}</td>
                  <td>${(p.payment_method || 'cash').toUpperCase()}</td>
                  <td>${p.notes || '—'}</td>
                  <td style="text-align:right; font-weight: 700;">₦${Number(p.amount).toLocaleString()}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>` : ""}

        </div>
      </div>
    </div>
    ${getPrintFooterHTML(sale.buyer_signature, sale.rep_signature)}
    </body></html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => { win.focus(); win.print(); }, 500);
    } else {
      toast.error("Pop-up blocked! Please allow pop-ups for this site.");
    }
  };

  const handlePrintReceipt = async (sale: any) => {
    logAction("PRINT", "Sales", sale.id, {
      vehicle: sale.sale_vehicles?.[0]?.vehicle
        ? `${sale.sale_vehicles[0].vehicle.year} ${sale.sale_vehicles[0].vehicle.make} ${sale.sale_vehicles[0].vehicle.model}`
        : "Vehicle",
    });
    try {
      const { data: payments } = await supabase
        .from("sale_payments" as any)
        .select("*")
        .eq("sale_id", sale.id)
        .order("payment_date", { ascending: false });
      setPreviewAllPayments(payments || []);
    } catch {
      setPreviewAllPayments([]);
    }
    setPreviewSale(sale);
    setPreviewPayment(null);
    setPreviewPaymentIndex(undefined);
    setPrintMode(true);
    return;
    const html = `<html><head><title>Receipt - ${sale.id.slice(0, 8).toUpperCase()}</title>
    <style>
      @page { margin: 0; size: A4; }
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap');
      body { font-family: 'Roboto', 'Arial', sans-serif; padding: 20mm; width: 210mm; min-height: 297mm; margin: 0 auto; box-sizing: border-box; background: white; color: #1a1a1a; line-height: 1.1; }
      .date-section { text-align: right; font-weight: 800; font-size: 12px; margin-bottom: 4px; text-transform: uppercase; padding: 0; }
      .bill-to { margin-bottom: 8px; padding: 0; }
      .bill-to p { margin: 1px 0; font-size: 12px; }
      .main-container {
        background-color: transparent;
        border-radius: 20px;
        padding: 0px 20px;
        min-height: 550px;
        position: relative;
        border: none;
      }
      .content-wrapper { position: relative; z-index: 1; }
      .bill-title { text-align: center; text-decoration: underline; font-weight: 900; font-size: 16px; margin-bottom: 8px; color: #1e293b; text-transform: uppercase; }
      .refund-note { margin-top: 4px; padding: 4px; background: rgba(254, 226, 226, 0.2); border: 2px solid #ef4444; border-radius: 10px; color: #b91c1c; font-weight: 900; font-size: 12px; text-align: center; margin-bottom: 8px; }
      .signature-area { display: flex; justify-content: space-between; margin-top: 8px; border-top: 2px solid #94a3b8; padding-top: 8px; }
      .sig-box { width: 45%; text-align: center; font-size: 11px; }
      .signature-img { max-height: 30px; display: block; margin: 0 auto 4px; }
    </style></head><body>
    ${getPrintHeaderHTML()}
    ${printReceipt(sale)}
    ${getPrintFooterHTML(sale.buyer_signature, sale.rep_signature)}
    </body></html>`;
    const win = window.open("", "_blank");
    if (win) { 
      win.document.write(html); 
      win.document.close(); 
      // Give it a moment to render images/styles
      setTimeout(() => {
        win.focus();
        win.print(); 
      }, 500);
    } else {
      toast.error("Pop-up blocked! Please allow pop-ups for this site.");
    }
  };

  const downloadSaleReceipt = async (
    sale: any,
    type: 'pdf' | 'png' | 'jpeg',
    receiptPayment?: { payment: any; paymentIndex: number; allPayments: any[] }
  ) => {
    const filename = `receipt-${buildReceiptNumber(sale, receiptPayment?.payment)}`;

    try {
      toast.loading(`Preparing ${type.toUpperCase()} download...`, { id: "sale-dl" });

      // Render the real receipt component so the file matches the document
      // on screen, and carries none of the browser's print furniture.
      const payments = receiptPayment?.allPayments || sale.sale_payments || [];
      const blob = await exportSaleReceipt(
        {
          sale,
          customer: customerObjMap[sale.customer_id],
          vehicles,
          payment: receiptPayment?.payment,
          paymentIndex: receiptPayment?.paymentIndex,
          allPayments: payments,
          customerSignature: sale.buyer_signature || null,
          customerSignatureDate: sale.buyer_signature_date || null,
          repSignature: sale.rep_signature || null,
          repSignatureDate: sale.rep_signature_date || null,
        },
        type
      );
      saveBlob(blob, filename, type);

      logAction("EXPORT", "Sales", sale.id, {
        vehicle: sale.sale_vehicles?.[0]?.vehicle
          ? `${sale.sale_vehicles[0].vehicle.year} ${sale.sale_vehicles[0].vehicle.make} ${sale.sale_vehicles[0].vehicle.model}`
          : "Vehicle",
        format: type.toUpperCase(),
        method: "Download",
      });
      toast.success("Download complete", { id: "sale-dl" });
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to generate document", { id: "sale-dl" });
    }
  };

  const handleBulkPrintReceipts = () => {
    if (filtered.length === 0) { toast.error("No sales to print"); return; }
    toast.info("Preparing bulk receipts...");
    
    const html = `<html><head><title>Bulk Sales Receipts</title>
    <style>
      @page { margin: 0; size: A4; }
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap');
      body { font-family: 'Roboto', 'Arial', sans-serif; padding: 0; width: 210mm; margin: 0 auto; background: white; color: #1a1a1a; line-height: 1.3; }
      .date-section { text-align: right; font-weight: 800; font-size: 13px; margin-bottom: 10px; text-transform: uppercase; }
      .bill-to { margin-bottom: 15px; }
      .bill-to p { margin: 2px 0; font-size: 13px; }
      .main-container {
        background-color: transparent;
        border-radius: 20px;
        padding: 20px;
        min-height: 550px;
        position: relative;
        border: none;
      }
      .content-wrapper { position: relative; z-index: 1; }
      .bill-title { text-align: center; text-decoration: underline; font-weight: 900; font-size: 18px; margin-bottom: 15px; color: #1e293b; text-transform: uppercase; }
      .refund-note { margin-top: 10px; padding: 10px; background: #fee2e2; border: 2px solid #ef4444; border-radius: 10px; color: #b91c1c; font-weight: 900; font-size: 13px; text-align: center; margin-bottom: 15px; }
      .signature-area { display: flex; justify-content: space-between; margin-top: 20px; border-top: 2px solid #94a3b8; padding-top: 15px; }
      .sig-box { width: 45%; text-align: center; font-size: 12px; }
      .signature-img { max-height: 40px; display: block; margin: 0 auto 5px; }
      @media print {
        .receipt-page { page-break-after: always; padding: 20mm; min-height: 297mm; box-sizing: border-box; }
      }
    </style></head><body>
    ${filtered.map(sale => `
      <div class="receipt-page">
        ${getPrintHeaderHTML()}
        ${printReceipt(sale)}
        ${getPrintFooterHTML(sale.buyer_signature, sale.rep_signature)}
      </div>
    `).join("")}
    </body></html>`;
    
    const win = window.open("", "_blank");
    if (win) { 
      win.document.write(html); 
      win.document.close(); 
      setTimeout(() => {
        win.focus();
        win.print();
      }, 800);
    } else {
      toast.error("Pop-up blocked! Please allow pop-ups for this site.");
    }
  };

  if (printMode && previewSale) {
    const activePreviewSale = sales.find((s: any) => s.id === previewSale.id) || previewSale;
    return (
      <SalePrintPreview
        sale={activePreviewSale}
        customer={customerObjMap[activePreviewSale.customer_id]}
        vehicles={vehicles}
        payment={previewPayment}
        paymentIndex={previewPaymentIndex}
        allPayments={previewAllPayments}
        onBack={() => {
          setPrintMode(false);
          setPreviewSale(null);
          setPreviewPayment(null);
          setPreviewPaymentIndex(undefined);
          setPreviewAllPayments([]);
        }}
        onDownloadPdf={() => downloadSaleReceipt(activePreviewSale, "pdf")}
      />
    );
  }

  return (
    <>
      <div className="space-y-8 animate-fade-up pb-10 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500">Revenue</span>
          </div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-white/90">
            Sales
          </h1>
          <p className="text-xs text-white/40 mt-0.5">
            Track vehicle sales, generate receipts, and manage sales history.
          </p>
        </div>
        <div className="flex flex-row flex-wrap items-center gap-3 shrink-0">
          {canCreate(role, "sales", permissions) && (
            <Button
              onClick={openCreate}
              size="sm"
              className="rounded-xl transition-all font-semibold text-xs h-10 px-5 text-white
                         bg-[#181d2f] hover:bg-[#252c42] border border-black/10 shadow-md
                         dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:border-emerald-400/40
                         dark:shadow-[0_0_18px_rgba(16,185,129,0.45)] dark:hover:shadow-[0_0_26px_rgba(16,185,129,0.65)]"
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Record Sale
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`rounded-xl glass-panel border-white/10 transition-all text-xs h-9 ${showAnalytics ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'hover:bg-white/5'}`}
          >
            <TrendingUp className="mr-1.5 h-3.5 w-3.5" /> {showAnalytics ? "Hide Analytics" : "Analytics"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowReceipts(!showReceipts)}
            className={`rounded-xl glass-panel border-white/10 transition-all text-xs h-9 ${showReceipts ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'hover:bg-white/5'}`}
          >
            <Receipt className="mr-1.5 h-3.5 w-3.5" /> Receipts
            <span className="ml-1.5 text-[10px] font-bold opacity-60">{receiptRecords.length}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl glass-panel border-white/10 hover:bg-white/5 transition-all text-xs h-9">
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-xl glass-panel p-2 shadow-2xl border-white/10" align="end">
              <DropdownMenuItem onClick={handleExportExcel} className="rounded-lg cursor-pointer"><FileText className="mr-2 h-4 w-4" /> Export to Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJSON} className="rounded-lg cursor-pointer"><FileText className="mr-2 h-4 w-4" /> Export to JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint} className="rounded-lg cursor-pointer"><Printer className="mr-2 h-4 w-4" /> Print Sales List</DropdownMenuItem>
              <DropdownMenuItem onClick={handleBulkPrintReceipts} className="rounded-lg cursor-pointer border-t border-white/5 mt-1 pt-2"><Receipt className="mr-2 h-4 w-4" /> Print All Receipts (PDF)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {showAnalytics && (
        <div className="space-y-6 animate-fade-down">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <Card className="bento-card border-none shadow-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl"><DollarSign className="h-6 w-6 text-emerald-500" /></div>
                </div>
                <h3 className="text-3xl font-bold text-emerald-500">₦{filtered.reduce((sum, s) => sum + (Number(s.sale_price) || 0), 0).toLocaleString()}</h3>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Total revenue</p>
              </CardContent>
            </Card>

            <Card className="bento-card border-none shadow-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl"><TrendingUp className="h-6 w-6 text-emerald-500" /></div>
                </div>
                <h3 className="text-3xl font-bold">₦{filtered.reduce((sum, s) => {
                  const vehicleId = s.vehicle_id || s.sale_vehicles?.[0]?.vehicle_id;
                  const v = vehicleId ? fullVehicleMap[vehicleId] : null;
                  const cost = Number(v?.cost_price) || 0;
                  const sale = Number(s.sale_price) || 0;
                  return sum + (sale - cost);
                }, 0).toLocaleString()}</h3>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Total profit</p>
              </CardContent>
            </Card>

            <Card className="bento-card border-none shadow-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-primary/10 rounded-2xl"><ShoppingBag className="h-6 w-6 text-primary" /></div>
                </div>
                <h3 className="text-3xl font-bold">{filtered.length}</h3>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Units Sold</p>
              </CardContent>
            </Card>

            <Card className="bento-card border-none shadow-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-amber-500/10 rounded-2xl"><Target className="h-6 w-6 text-amber-500" /></div>
                </div>
                <h3 className="text-3xl font-bold">{((filtered.reduce((sum, s) => sum + (Number(s.sale_price) || 0), 0) / 5000000) * 100).toFixed(1)}%</h3>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mt-1">Target Achievement</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bento-card p-6 min-h-[400px]">
              <h3 className="font-bold text-lg flex items-center gap-2 mb-6"><BarChart3 className="w-5 h-5 text-emerald-500" /> Revenue & Profit Trend</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={(() => {
                    const data = [];
                    const now = new Date();
                    for (let i = 5; i >= 0; i--) {
                      const d = subMonths(now, i);
                      const m = d.getMonth();
                      const y = d.getFullYear();
                      const mSales = sales.filter(s => {
                        const sd = new Date(s.sale_date || s.created_at);
                        return sd.getMonth() === m && sd.getFullYear() === y;
                      });
                      const rev = mSales.reduce((sum, s) => sum + (Number(s.sale_price) || 0), 0);
                      const prf = mSales.reduce((sum, s) => {
                        const vehicleId = s.vehicle_id || s.sale_vehicles?.[0]?.vehicle_id;
                        const v = vehicleId ? fullVehicleMap[vehicleId] : null;
                        const cost = Number(v?.cost_price) || 0;
                        const sale = Number(s.sale_price) || 0;
                        return sum + (sale - cost);
                      }, 0);
                      data.push({ name: format(d, 'MMM'), Revenue: rev, Profit: prf });
                    }
                    return data;
                  })()} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevS" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient>
                      <linearGradient id="colorPrfS" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(142 76% 36%)" stopOpacity={0.8}/><stop offset="95%" stopColor="hsl(142 76% 36%)" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--foreground)/0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v/1000000).toFixed(1)}M`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="Revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRevS)" strokeWidth={3} />
                    <Area type="monotone" dataKey="Profit" stroke="hsl(142 76% 36%)" fillOpacity={1} fill="url(#colorPrfS)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-4 bento-card p-6 flex flex-col justify-center">
              <h3 className="font-bold text-lg flex items-center gap-2 mb-6"><PieChartIcon className="w-5 h-5 text-amber-500" /> Top Makes</h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={(() => {
                      const makes: Record<string, number> = {};
                      filtered.forEach(s => {
                        const vehicleId = s.vehicle_id || s.sale_vehicles?.[0]?.vehicle_id;
                        const v = vehicleId ? fullVehicleMap[vehicleId] : null;
                        const make = v?.make || 'Unknown';
                        makes[make] = (makes[make] || 0) + 1;
                      });
                      return Object.entries(makes).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
                    })()} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {COLORS.map((color, i) => <Cell key={i} fill={color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt records — a searchable backup of every receipt issued */}
      {showReceipts && (
        <div className="glass-panel p-5 rounded-3xl flex flex-col gap-4 animate-fade-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">Receipt Records</span>
              </div>
              <p className="text-xs text-white/40 mt-1">
                Every sale and payment receipt, kept on record. Re-open, re-print or re-download any of them.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Select value={receiptTypeFilter} onValueChange={(v) => setReceiptTypeFilter(v as any)}>
                <SelectTrigger className="h-9 w-[150px] rounded-xl bg-background/50 border-white/10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-panel border-white/10 rounded-xl">
                  <SelectItem value="all">All receipts</SelectItem>
                  <SelectItem value="sale">Sale receipts</SelectItem>
                  <SelectItem value="payment">Payment receipts</SelectItem>
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-xl glass-panel border-white/10 hover:bg-white/5 text-xs h-9">
                    <FileDown className="mr-1.5 h-3.5 w-3.5" /> Backup
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="rounded-xl glass-panel p-2 shadow-2xl border-white/10" align="end">
                  <DropdownMenuItem className="rounded-lg text-xs cursor-pointer" onClick={() => exportReceiptLedger("excel")}>
                    <FileOutput className="mr-2 h-3.5 w-3.5" /> Export to Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-lg text-xs cursor-pointer" onClick={() => exportReceiptLedger("json")}>
                    <FileText className="mr-2 h-3.5 w-3.5" /> Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="relative w-full group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-amber-500 transition-colors pointer-events-none" />
            <Input
              placeholder="Search receipt no, customer, car, VIN, date, month, day, amount..."
              className="h-10 pl-10 rounded-xl bg-background/50 border-white/10 text-sm"
              value={receiptSearch}
              onChange={(e) => setReceiptSearch(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase font-bold">Receipt No</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Type</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Date</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Customer</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Vehicle</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-right">Amount</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-right">Document</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedReceipts.map((r) => (
                  <TableRow key={r.key} className="border-white/5 hover:bg-white/5">
                    <TableCell className="py-3">
                      <span className="text-xs font-mono font-bold">{r.receiptNo}</span>
                      {r.vins.length > 0 && (
                        <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[150px]">VIN: {r.vins.join(", ")}</div>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                        r.type === "sale"
                          ? "bg-sky-500/10 text-sky-500 border border-sky-500/20"
                          : r.statusLabel === "Paid in full"
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                      }`}>
                        {r.typeLabel}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs py-3 whitespace-nowrap">
                      {format(new Date(r.date), "d MMM yyyy")}
                      {r.type === "payment" && r.saleDate && (
                        <div className="text-[10px] text-muted-foreground">Sold {format(new Date(r.saleDate), "d MMM yyyy")}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs py-3 max-w-[140px] truncate">{r.customerName}</TableCell>
                    <TableCell className="text-xs py-3 max-w-[180px] truncate">{r.vehicleLabel}</TableCell>
                    <TableCell className="text-xs py-3 text-right font-bold whitespace-nowrap">₦{r.amount.toLocaleString()}</TableCell>
                    <TableCell className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 rounded-lg text-[10px] font-bold hover:bg-amber-500/10 hover:text-amber-500 gap-1"
                          onClick={() => openReceiptRecord(r)}
                        >
                          <Printer className="h-3 w-3" /> Open
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-2 rounded-lg text-[10px] font-bold hover:bg-white/10 gap-1">
                              <Download className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="rounded-xl glass-panel p-2 shadow-2xl border-white/10" align="end">
                            <DropdownMenuItem className="rounded-lg text-xs cursor-pointer" onClick={() => downloadReceiptRecord(r, "pdf")}>
                              <FileDown className="mr-2 h-3.5 w-3.5" /> Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg text-xs cursor-pointer" onClick={() => downloadReceiptRecord(r, "png")}>
                              <Image className="mr-2 h-3.5 w-3.5" /> Download PNG
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg text-xs cursor-pointer" onClick={() => downloadReceiptRecord(r, "jpeg")}>
                              <Image className="mr-2 h-3.5 w-3.5" /> Download JPEG
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredReceipts.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8 italic">
                      {receiptRecords.length === 0 ? "No receipts yet — record a sale to issue one." : "No receipt matches that search."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <CustomPagination
            currentPage={receiptPage}
            totalPages={receiptTotalPages}
            totalItems={filteredReceipts.length}
            pageSize={receiptPageSize}
            onPageChange={setReceiptPage}
            onPageSizeChange={setReceiptPageSize}
            itemLabel="receipts"
          />
        </div>
      )}

      {/* Search and Filters Bar with View Switch */}
      <div className="glass-panel p-4 rounded-3xl flex flex-col gap-4 relative overflow-hidden">
        <div className="relative w-full group z-10 flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors pointer-events-none" />
            <Input 
              placeholder="Search by vehicle or customer name..." 
              value={search} 
              onChange={(e) => { setSearch(e.target.value); setPage(0); }} 
              className="pl-10 h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-emerald-500/50 transition-all font-medium text-sm w-full"
            />
          </div>
          
          <div className="w-full sm:w-[180px] shrink-0">
            <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setPage(0); }}>
              <SelectTrigger className="h-10 rounded-xl bg-background/50 border-white/10 focus:ring-emerald-500/50 transition-all">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Select Month" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl glass-panel">
                <SelectItem value="all">All Time</SelectItem>
                {Array.from({ length: 12 }).map((_, i) => {
                  const d = subMonths(new Date(), i);
                  const val = format(d, 'yyyy-MM');
                  return (
                    <SelectItem key={val} value={val}>
                      {format(d, 'MMMM yyyy')}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-[130px] shrink-0">
            <Select value={selectedWeek} onValueChange={(v) => { setSelectedWeek(v); setPage(0); }}>
              <SelectTrigger className="h-10 rounded-xl bg-background/50 border-white/10 focus:ring-emerald-500/50 transition-all">
                <div className="flex items-center gap-2">
                  <ListFilter className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Week" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl glass-panel">
                <SelectItem value="all">All Weeks</SelectItem>
                <SelectItem value="1">Week 1</SelectItem>
                <SelectItem value="2">Week 2</SelectItem>
                <SelectItem value="3">Week 3</SelectItem>
                <SelectItem value="4">Week 4</SelectItem>
                <SelectItem value="5">Week 5</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-full sm:w-[180px] shrink-0">
            <Select value={sourceCompanyFilter} onValueChange={(v) => { setSourceCompanyFilter(v); setPage(0); }}>
              <SelectTrigger className="h-10 rounded-xl bg-background/50 border-white/10 focus:ring-emerald-500/50 transition-all">
                <div className="flex items-center gap-2">
                  <ListFilter className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Source Company" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl glass-panel">
                <SelectItem value="all">All Sources</SelectItem>
                {sourceCompanies.map(company => (
                  <SelectItem key={company} value={company}>{company}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-[170px] shrink-0">
            <Select value={paymentStatusFilter} onValueChange={(v) => { setPaymentStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="h-10 rounded-xl bg-background/50 border-white/10 focus:ring-emerald-500/50 transition-all">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Payment Status" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl glass-panel">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid_in_full">Paid in Full</SelectItem>
                <SelectItem value="deposit">Deposit (Part Payment)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Mode Switch (Cards vs Table) */}
          <div className="flex items-center gap-1 bg-background/60 border border-white/10 p-1 rounded-2xl shrink-0 w-full sm:w-auto justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("cards")}
              className={`h-8 rounded-xl px-3 text-xs font-semibold gap-1.5 transition-all ${
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
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("table")}
              className={`h-8 rounded-xl px-3 text-xs font-semibold gap-1.5 transition-all ${
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

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 w-full rounded-2xl bg-card/40 animate-pulse border border-white/5" />)}
        </div>
      ) : isError ? (
        <div className="bento-card p-12 flex flex-col items-center justify-center text-center border-rose-500/20 bg-rose-500/5">
          <div className="bg-rose-500/10 p-5 rounded-full mb-4">
            <AlertCircle className="h-10 w-10 text-rose-500" />
          </div>
          <h3 className="text-xl font-bold mb-2">Error Loading Sales</h3>
          <p className="text-muted-foreground max-w-xs mx-auto mb-6">We couldn't retrieve the sales records. This might be a connection issue or a permissions error.</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["sales"] })} className="rounded-2xl bg-rose-500 hover:bg-rose-600 text-white">Retry Connection</Button>
        </div>
      ) : sales.length === 0 ? (
        <div className="bento-card p-12 flex flex-col items-center justify-center text-center">
          <div className="bg-emerald-500/10 p-5 rounded-full mb-4">
            <DollarSign className="h-10 w-10 text-emerald-500" />
          </div>
          <h3 className="text-xl font-bold mb-2">No Sales Recorded</h3>
          <p className="text-muted-foreground max-w-xs mx-auto mb-6">You haven't recorded any sales yet. Click "Record New Sale" to get started.</p>
          {canCreate(role, "sales", permissions) && (
            <Button
              onClick={openCreate}
              className="rounded-full px-6 py-2.5 font-bold text-xs text-white transition-all shadow-lg
                         bg-[#181d2f] hover:bg-[#252c42]
                         dark:bg-emerald-500 dark:hover:bg-emerald-400
                         dark:shadow-[0_0_18px_rgba(16,185,129,0.45)] dark:hover:shadow-[0_0_26px_rgba(16,185,129,0.65)]"
            >
              Record Your First Sale
            </Button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bento-card p-12 text-center text-muted-foreground">
          <Search className="h-8 w-8 opacity-20 mx-auto mb-2" />
          <p className="font-medium">No sales match your current filters.</p>
          <Button variant="link" onClick={() => { setSearch(""); setSelectedMonth("all"); setSelectedWeek("all"); setSourceCompanyFilter("all"); setPaymentStatusFilter("all"); }} className="text-emerald-500 mt-2 font-semibold">
            Clear all filters
          </Button>
        </div>
      ) : viewMode === "cards" ? (
        /* Split-Panel Sales Cards Modeled After Reference Design */
        <div className="space-y-4">
          {paged.map((s) => {
            const paymentInfo = getSalePaymentInfo(s);
            const salePrice = Number(s.sale_price) || 0;
            const percent = Math.min(100, Math.round((paymentInfo.totalPaid / (salePrice || 1)) * 100));
            const vehicleName = vehicleMap[s.vehicle_id] || "Vehicle Not Specified";
            const customerName = customerMap[s.customer_id] || "Customer Not Specified";
            const customerObj = customerObjMap[s.customer_id];
            const saleDateStr = new Date(s.sale_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            const formattedRef = `SALE-${s.id.slice(0, 8).toUpperCase()}`;

            return (
              <div 
                key={s.id} 
                className="rounded-[22px] overflow-hidden border border-border/50 dark:border-white/10 bg-white dark:bg-[#151a26] shadow-md hover:shadow-xl transition-all flex flex-col md:flex-row group"
              >
                {/* Left Panel: Solid Dark Contrast (Modeled after reference left section) */}
                <div className="w-full md:w-[32%] lg:w-[28%] bg-[#111728] dark:bg-[#0c101a] text-white p-5 md:p-6 flex flex-col justify-between shrink-0 relative">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        VEHICLE
                      </span>
                      <span className="text-[10px] font-mono text-slate-400/80">
                        {formattedRef}
                      </span>
                    </div>
                    
                    <h3 className="text-base md:text-lg font-bold text-white leading-snug tracking-tight group-hover:text-amber-400 transition-colors">
                      {vehicleName}
                    </h3>

                    {s.rep_name && (
                      <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                        <span className="opacity-60">Rep:</span>
                        <span className="text-slate-200 font-medium">{s.rep_name}</span>
                      </p>
                    )}
                  </div>

                  {/* Bottom link modeled after "View all chapters >" in reference image */}
                  <div className="mt-5 pt-3 border-t border-white/10">
                    <div 
                      className="flex items-center justify-between text-xs text-slate-300 font-medium group/link cursor-pointer hover:text-white transition-colors"
                      title={customerObj?.phone || customerObj?.email || customerName}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{customerName}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 transition-transform group-hover/link:translate-x-0.5" />
                    </div>
                  </div>
                </div>

                {/* Right Panel: Clean Surface (Modeled after reference right section) */}
                <div className="flex-1 p-5 md:p-6 flex flex-col justify-between gap-5 bg-card dark:bg-[#151a26]">
                  {/* Top section: Chapter/Date subheader + Big Price + Progress Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        SALE DATE • {saleDateStr}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                          ₦{salePrice.toLocaleString()}
                        </h2>
                        {paymentInfo.isDeposit ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/15 text-amber-500 border border-amber-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Deposit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                            Paid in Full
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar (Matching reference image: "6/9 Challenges" style) */}
                    <div className="flex flex-col sm:items-end gap-1.5">
                      <div className="w-36 sm:w-44 h-2 bg-muted/60 dark:bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${paymentInfo.isDeposit ? 'bg-amber-500' : 'bg-emerald-500 w-full'}`}
                          style={paymentInfo.isDeposit ? { width: `${Math.max(8, percent)}%` } : undefined}
                        />
                      </div>
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        {paymentInfo.isDeposit ? (
                          paymentInfo.hasPayments && paymentInfo.totalPaid > 0 ? (
                            <>₦{paymentInfo.totalPaid.toLocaleString()} / ₦{salePrice.toLocaleString()} <span className="font-extrabold text-amber-500">({percent}%)</span></>
                          ) : (
                            <span className="font-extrabold text-amber-500">Deposit / Part Payment</span>
                          )
                        ) : (
                          <span className="font-bold text-emerald-500 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-500" /> 100% Settled
                          </span>
                        )}
                      </p>
                      {paymentInfo.isDeposit && paymentInfo.balance > 0 && (
                        <p className="text-[10px] font-mono text-amber-500/90 sm:text-right">
                          Remaining Balance: ₦{paymentInfo.balance.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Bottom section: Action Buttons (matching reference button pill style) */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQrId(s.id)}
                        className="rounded-full px-4 h-9 border-border/60 hover:bg-muted font-semibold text-xs tracking-wide transition-all gap-1.5"
                      >
                        <QrCode className="w-3.5 h-3.5 text-muted-foreground" />
                        Sign Link
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full px-4 h-9 border-border/60 hover:bg-muted font-semibold text-xs tracking-wide transition-all gap-1.5"
                          >
                            <FileDown className="w-3.5 h-3.5 text-muted-foreground" />
                            Download
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="rounded-2xl glass-panel p-2 shadow-2xl border-white/10">
                          <DropdownMenuItem onClick={() => downloadSaleReceipt(s, "png")} className="rounded-xl cursor-pointer gap-2">
                            <Image className="h-4 w-4 text-emerald-500" /> Save as PNG
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => downloadSaleReceipt(s, "jpeg")} className="rounded-xl cursor-pointer gap-2">
                            <Image className="h-4 w-4 text-amber-500" /> Save as JPEG
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => downloadSaleReceipt(s, "pdf")} className="rounded-xl cursor-pointer gap-2">
                            <FileDown className="h-4 w-4 text-emerald-500" /> Save as PDF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {(hasEdit || hasDelete) && (
                        <div className="flex items-center gap-1">
                          {hasEdit && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => openEdit(s)} 
                              className="rounded-full h-9 w-9 hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="Edit Sale"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {hasDelete && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setDeleteId(s.id)} 
                              className="rounded-full h-9 w-9 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              title="Delete Sale"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Pill Buttons (like Continue in reference image) */}
                    <div className="flex items-center gap-2.5">
                      <Button
                        size="sm"
                        onClick={() => setPaymentSaleId(s.id)}
                        className={`rounded-full px-5 h-9 font-bold text-xs tracking-wide transition-all shadow-md active:scale-95 gap-1.5 ${
                          paymentInfo.isDeposit 
                            ? "bg-amber-500 hover:bg-amber-600 text-black shadow-amber-500/20" 
                            : "bg-muted/80 hover:bg-muted text-foreground border border-border/40"
                        }`}
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        {paymentInfo.isDeposit ? "Record Payment" : "Payments"}
                        {paymentInfo.isDeposit && (
                          <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping ml-0.5" />
                        )}
                      </Button>

                      {/* Primary Pill Button exactly like Continue in reference */}
                      <Button
                        size="sm"
                        onClick={() => handlePrintReceipt(s)}
                        className="rounded-full px-6 h-9 bg-[#181d2f] hover:bg-[#252c42] dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold text-xs tracking-wide shadow-lg shadow-black/20 hover:shadow-xl transition-all active:scale-95 gap-2"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        Receipt
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Dense Table View */
        <div className="bento-card overflow-hidden border-none shadow-2xl">
          <div className="table-container">
            <Table>
              <TableHeader className="bg-foreground/5 pointer-events-none">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-semibold px-6 py-4">Vehicle</TableHead>
                  <TableHead className="font-semibold">Customer</TableHead>
                  <TableHead className="font-semibold">Sale Price</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Sale Date</TableHead>
                  <TableHead className="text-right font-semibold px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((s) => {
                  const paymentInfo = getSalePaymentInfo(s);
                  return (
                    <TableRow key={s.id} className={`border-border/10 hover:bg-white/5 transition-colors group ${paymentInfo.isDeposit ? 'bg-amber-500/[0.02]' : ''}`}>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-sm transition-colors group-hover:text-foreground">{vehicleMap[s.vehicle_id] || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{customerMap[s.customer_id] || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">₦{Number(s.sale_price).toLocaleString()}</TableCell>
                      <TableCell>
                        {paymentInfo.isDeposit ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              Deposit
                            </span>
                            {paymentInfo.hasPayments && paymentInfo.totalPaid > 0 && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                Paid: ₦{paymentInfo.totalPaid.toLocaleString()} • Bal: ₦{paymentInfo.balance.toLocaleString()}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                            Paid in Full
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm flex items-center gap-2"><Calendar className="h-3.5 w-3.5" /> {new Date(s.sale_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-foreground/20 text-amber-500" onClick={() => setQrId(s.id)}>
                            <QrCode className="h-4 w-4 mr-1.5" /> Sign Link
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-foreground/20 text-sky-500">
                                <FileDown className="h-4 w-4 mr-1.5" /> Download
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="rounded-xl glass-panel p-2 shadow-2xl border-white/10" align="end">
                              <DropdownMenuItem onClick={() => downloadSaleReceipt(s, "png")} className="rounded-lg cursor-pointer gap-2">
                                <Image className="h-4 w-4 text-emerald-500" /> Save as PNG
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadSaleReceipt(s, "jpeg")} className="rounded-lg cursor-pointer gap-2">
                                <Image className="h-4 w-4 text-amber-500" /> Save as JPEG
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadSaleReceipt(s, "pdf")} className="rounded-lg cursor-pointer gap-2">
                                <FileDown className="h-4 w-4 text-emerald-500" /> Save as PDF
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button 
                            size="sm" 
                            className="rounded-full px-4 h-8 bg-[#181d2f] hover:bg-[#252c42] dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold text-xs shadow-sm"
                            onClick={() => handlePrintReceipt(s)}
                          >
                            <Receipt className="h-3.5 w-3.5 mr-1" /> Receipt
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={`h-8 rounded-lg ${
                              paymentInfo.isDeposit 
                                ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 font-medium" 
                                : "hover:bg-emerald-500/10 hover:text-emerald-500"
                            }`} 
                            onClick={() => setPaymentSaleId(s.id)}
                            title={paymentInfo.isDeposit ? "Manage Deposit Payments" : "Payments"}
                          >
                            <DollarSign className="h-4 w-4 mr-1.5" /> Payments
                            {paymentInfo.isDeposit && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping ml-0.5" />
                            )}
                          </Button>
                          {hasEdit && (
                            <Button variant="ghost" size="icon" onClick={() => openEdit(s)} className="h-8 w-8 rounded-lg hover:bg-foreground/20">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {hasDelete && (
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)} className="h-8 w-8 rounded-lg hover:bg-destructive/20 hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
            itemLabel="sales"
          />
        </div>
      )}
    </div>

    {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl glass-panel shadow-2xl border-white/10 p-0 bg-background/95 backdrop-blur-3xl">
          <div className="p-4 sm:p-6 border-b border-white/5 bg-foreground/5 sticky top-0 z-50 backdrop-blur-xl flex items-center gap-3">
            <BackButton onBack={closeDialog} iconOnly title="Back" />
            <DialogHeader className="text-left">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-500" />
                {editId ? "Edit Sale Details" : "Record New Sale"}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer *</Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-[10px] font-bold uppercase text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/5"
                  onClick={() => setForm({ 
                    ...form, 
                    is_new_customer: !form.is_new_customer,
                    customer_id: !form.is_new_customer ? "" : form.customer_id 
                  })}
                >
                  {form.is_new_customer ? "Select Existing" : "Add New Customer"}
                </Button>
              </div>

              {!form.is_new_customer ? (
                <CustomerSelect 
                  customers={customers}
                  value={form.customer_id}
                  onValueChange={(v) => setForm({ ...form, customer_id: v })}
                  onAddNew={() => setForm({ ...form, is_new_customer: true, customer_id: "" })}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 animate-fade-down">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Full Name *</Label>
                    <Input 
                      className="rounded-lg h-9 bg-background/50 border-white/10" 
                      value={form.manual_customer_name} 
                      onChange={(e) => setForm({ ...form, manual_customer_name: e.target.value })} 
                      placeholder="e.g. John Doe"
                    />
                    <CustomerSuggestion 
                      suggestion={duplicateSuggestion} 
                      onSelect={(id) => setForm({ ...form, customer_id: id, is_new_customer: false })} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Phone</Label>
                    <Input 
                      className="rounded-lg h-9 bg-background/50 border-white/10" 
                      value={form.manual_customer_phone} 
                      onChange={(e) => setForm({ ...form, manual_customer_phone: e.target.value })} 
                      placeholder="0812..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Email</Label>
                    <Input 
                      className="rounded-lg h-9 bg-background/50 border-white/10" 
                      value={form.manual_customer_email} 
                      onChange={(e) => setForm({ ...form, manual_customer_email: e.target.value })} 
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Address</Label>
                    <Input 
                      className="rounded-lg h-9 bg-background/50 border-white/10" 
                      value={form.manual_customer_address} 
                      onChange={(e) => setForm({ ...form, manual_customer_address: e.target.value })} 
                      placeholder="Customer's physical address"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vehicles *</Label>
              <div className="bg-foreground/5 border border-white/5 p-4 rounded-2xl flex flex-col gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input 
                    placeholder="Search by make, model, or year..." 
                    className="h-9 pl-9 rounded-xl bg-background/50 border-white/10 text-sm"
                    value={vehicleSearch}
                    onChange={(e) => setVehicleSearch(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {selectableVehicles
                    .filter((v) => `${v.year} ${v.make} ${v.model} ${v.vin || ''}`.toLowerCase().includes(vehicleSearch.toLowerCase()))
                    .map((v) => (
                    <div 
                      key={v.id} 
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        form.selected_vehicle_ids.includes(v.id) 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                          : 'bg-background/40 border-white/5 hover:bg-white/5'
                      }`}
                      onClick={() => {
                        const ids = form.selected_vehicle_ids.includes(v.id)
                          ? form.selected_vehicle_ids.filter(id => id !== v.id)
                          : [...form.selected_vehicle_ids, v.id];
                        setForm({ ...form, selected_vehicle_ids: ids });
                      }}
                    >
                      <Checkbox checked={form.selected_vehicle_ids.includes(v.id)} className="data-[state=checked]:bg-emerald-500 pointer-events-none" />
                      <div className="flex flex-col leading-tight">
                        <span className="text-[13px] font-medium">{v.year} {v.make} {v.model}</span>
                        {v.vin && <span className="text-[10px] text-muted-foreground font-mono">VIN: {v.vin}</span>}
                      </div>
                    </div>
                  ))}
                  {selectableVehicles.filter((v) => `${v.year} ${v.make} ${v.model} ${v.vin || ''}`.toLowerCase().includes(vehicleSearch.toLowerCase())).length === 0 && (
                     <div className="col-span-1 sm:col-span-2 text-center text-sm text-muted-foreground py-4 italic">
                       {vehicleSearch ? "No unsold vehicle matches that search." : "No unsold vehicles in inventory — add the vehicle manually below."}
                     </div>
                  )}
                </div>

                {form.manual_vehicles?.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Added manually (will be created on save)</Label>
                    {form.manual_vehicles.map((mv, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl border bg-amber-500/10 border-amber-500/20">
                        <Car className="h-4 w-4 text-amber-500 shrink-0" />
                        <div className="flex flex-col leading-tight flex-1 min-w-0">
                          <span className="text-[13px] font-medium truncate">{mv.year} {mv.make} {mv.model} {mv.trim}</span>
                          <span className="text-[10px] text-muted-foreground font-mono truncate">
                            VIN: {mv.vin}{mv.color ? ` · ${mv.color}` : ""}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive shrink-0"
                          onClick={() => setForm({ ...form, manual_vehicles: form.manual_vehicles.filter((_, idx) => idx !== i) })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {!manualVehicleOpen ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl h-10 border-dashed border-white/20 text-xs font-semibold hover:border-amber-500/40 hover:text-amber-500"
                    onClick={() => setManualVehicleOpen(true)}
                  >
                    <PlusCircle className="h-3.5 w-3.5 mr-2" />
                    Vehicle not in inventory? Add it manually
                  </Button>
                ) : (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-amber-500/15 bg-amber-500/[0.06]">
                      <div className="h-7 w-7 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                        <Car className="h-3.5 w-3.5 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-amber-500 leading-tight">Add a vehicle to inventory</p>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                          It is created as Sold and attached to this sale.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px] shrink-0"
                        onClick={() => { setManualVehicleOpen(false); setManualVehicleDraft(emptyManualVehicle); }}
                      >
                        Cancel
                      </Button>
                    </div>

                    <div className="p-4 flex flex-col gap-4">
                      {/* VIN leads: it is the vehicle's identity and the one field that must be right */}
                      <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2 ml-1">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                            Chassis No. (VIN) <span className="text-amber-500">*</span>
                          </Label>
                          <span className={`text-[10px] font-mono tabular-nums ${
                            manualVehicleDraft.vin.length === 17
                              ? "text-emerald-500"
                              : manualVehicleDraft.vin.length > 0
                                ? "text-amber-500"
                                : "text-muted-foreground/60"
                          }`}>
                            {manualVehicleDraft.vin.length}/17
                          </span>
                        </div>
                        <Input
                          autoFocus
                          className={`rounded-lg h-11 bg-background/60 font-mono text-sm tracking-[0.12em] uppercase ${
                            manualVehicleVinTaken ? "border-destructive/60 focus-visible:ring-destructive" : "border-white/10"
                          }`}
                          placeholder="17-CHARACTER VIN"
                          maxLength={17}
                          value={manualVehicleDraft.vin}
                          onChange={(e) => setManualVehicleDraft({
                            ...manualVehicleDraft,
                            vin: e.target.value.toUpperCase().replace(/\s/g, "").slice(0, 17),
                          })}
                        />
                        {manualVehicleVinTaken ? (
                          <p className="text-[10px] text-destructive font-semibold ml-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            That VIN already belongs to a vehicle — pick it from the list above instead.
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground/70 ml-1">
                            Required. A VIN is normally 17 characters.
                          </p>
                        )}
                      </div>

                      {/* Make · Model · Year */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1.5 col-span-1 sm:col-span-2">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                            Make <span className="text-amber-500">*</span>
                          </Label>
                          <Input
                            className="rounded-lg h-10 bg-background/60 border-white/10"
                            placeholder="Toyota"
                            value={manualVehicleDraft.make}
                            onChange={(e) => setManualVehicleDraft({ ...manualVehicleDraft, make: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5 col-span-1 sm:col-span-2">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                            Model <span className="text-amber-500">*</span>
                          </Label>
                          <Input
                            className="rounded-lg h-10 bg-background/60 border-white/10"
                            placeholder="Camry"
                            value={manualVehicleDraft.model}
                            onChange={(e) => setManualVehicleDraft({ ...manualVehicleDraft, model: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                            Year <span className="text-amber-500">*</span>
                          </Label>
                          <Input
                            className="rounded-lg h-10 bg-background/60 border-white/10 tabular-nums"
                            type="number"
                            inputMode="numeric"
                            placeholder="2015"
                            value={manualVehicleDraft.year}
                            onChange={(e) => setManualVehicleDraft({ ...manualVehicleDraft, year: e.target.value.slice(0, 4) })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Trim</Label>
                          <Input
                            className="rounded-lg h-10 bg-background/60 border-white/10"
                            placeholder="XLE"
                            value={manualVehicleDraft.trim}
                            onChange={(e) => setManualVehicleDraft({ ...manualVehicleDraft, trim: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5 col-span-2">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Colour</Label>
                          <Input
                            className="rounded-lg h-10 bg-background/60 border-white/10"
                            placeholder="Black"
                            value={manualVehicleDraft.color}
                            onChange={(e) => setManualVehicleDraft({ ...manualVehicleDraft, color: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <p className="text-[10px] text-muted-foreground/70 leading-snug">
                          The sale price is taken from the sale below.
                        </p>
                        <Button
                          type="button"
                          className="rounded-xl h-10 px-5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shrink-0 disabled:opacity-40"
                          disabled={!manualVehicleReady}
                          onClick={() => {
                            setForm({ ...form, manual_vehicles: [...(form.manual_vehicles || []), manualVehicleDraft] });
                            setManualVehicleDraft(emptyManualVehicle);
                            setManualVehicleOpen(false);
                            toast.success("Vehicle added to this sale");
                          }}
                        >
                          <PlusCircle className="h-3.5 w-3.5 mr-2" />
                          Add to this sale
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Sale Price *</Label>
                <CurrencyInput className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-emerald-500 font-bold" placeholder="0" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sale Date *</Label>
                <Input className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-emerald-500" type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Type</Label>
                 <Select value={form.payment_type} onValueChange={(v) => setForm({ ...form, payment_type: v })}>
                   <SelectTrigger className="rounded-xl h-11 bg-background/50 border-white/10"><SelectValue /></SelectTrigger>
                   <SelectContent className="glass-panel border-white/10 rounded-xl">
                     <SelectItem value="cash">Cash</SelectItem>
                     <SelectItem value="transfer">Bank Transfer</SelectItem>
                     <SelectItem value="pos">POS</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Status</Label>
                 <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v })}>
                   <SelectTrigger className="rounded-xl h-11 bg-background/50 border-white/10"><SelectValue /></SelectTrigger>
                   <SelectContent className="glass-panel border-white/10 rounded-xl">
                     <SelectItem value="paid_in_full">Paid in Full</SelectItem>
                     <SelectItem value="deposit">Deposit Only</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
            </div>

            {!editId && (
               <div className="space-y-2 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 animate-fade-in">
                 <Label className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Initial Payment Amount (Optional)</Label>
                 <CurrencyInput 
                   className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-emerald-500 font-bold text-emerald-600" 
                   placeholder="0" 
                   value={form.initial_payment} 
                   onChange={(e) => setForm({ ...form, initial_payment: e.target.value })} 
                 />
                 <p className="text-[10px] text-muted-foreground italic">Leave empty or 0 if no payment has been made yet.</p>
               </div>
             )}

            <div className="pt-4 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-4">
                  <div className="space-y-2">
                     <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seller / Rep Name</Label>
                     <Input className="rounded-xl h-11 bg-background/50 border-white/10" placeholder="Full name" value={form.rep_name} onChange={(e) => setForm({ ...form, rep_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rep Signature</Label>
                     <div className="rounded-2xl overflow-hidden border border-white/10 bg-background/50">
                        <SignaturePad value={form.rep_signature} onChange={(v) => setForm({ ...form, rep_signature: v })} />
                     </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="space-y-2">
                     <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Buyer Signature (In-Person)</Label>
                     <div className="rounded-2xl overflow-hidden border border-white/10 bg-background/50">
                        <SignaturePad value={form.buyer_signature} onChange={(v) => setForm({ ...form, buyer_signature: v })} />
                     </div>
                  </div>
                  {form.buyer_signature && (
                    <div className="space-y-2">
                       <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Buyer Signed Date</Label>
                       <Input type="date" className="rounded-xl h-11 bg-background/50 border-white/10" value={form.buyer_signature_date} onChange={(e) => setForm({ ...form, buyer_signature_date: e.target.value })} />
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground italic">Or use the "Sign Link" in the table to send this to the customer.</p>
               </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</Label>
              <Textarea className="rounded-xl min-h-[80px] bg-background/50 border-white/10 focus-visible:ring-emerald-500" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional remarks regarding the sale..." />
            </div>
          </div>
          <div className="p-6 border-t border-white/5 bg-foreground/5 flex justify-end gap-3">
            <Button variant="outline" onClick={closeDialog} className="rounded-full px-5 border-white/10 hover:bg-white/5">Cancel</Button>
            <Button onClick={() => upsertMutation.mutate(undefined)} disabled={!canSubmit} className="rounded-full px-6 py-2.5 bg-[#181d2f] hover:bg-[#252c42] dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold text-xs shadow-lg transition-all active:scale-95">
              {editId ? "Update Sale" : "Record Sale"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl glass-panel border-white/10 p-6 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-foreground">Delete Sale</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-muted-foreground">This action cannot be undone and will permanently remove the sale record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-xl border-white/10 text-foreground hover:bg-white/5 sm:mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20 border-none"
            >Delete Forever</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QrSignDialog 
        open={!!qrId} 
        onOpenChange={(open) => !open && setQrId(null)} 
        type="sale" 
        id={qrId} 
      />

      <Dialog open={!!paymentSaleId} onOpenChange={(open) => !open && setPaymentSaleId(null)}>
        <DialogContent className="max-w-2xl rounded-3xl glass-panel shadow-2xl border-white/10 p-0 overflow-hidden">
          <div className="p-6 border-b border-white/5 bg-foreground/5 flex items-center justify-between">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" /> Payment History & Balance
              </DialogTitle>
            </DialogHeader>
            {paymentSaleId && (() => {
              const sale = sales.find(s => s.id === paymentSaleId);
              const totalPaid = salePayments.reduce((sum, p: any) => sum + (Number(p.amount) || 0), 0);
              const balance = (Number(sale?.sale_price) || 0) - totalPaid;
              return (
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total Balance Due</p>
                  <p className={`text-xl font-black ${balance <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    ₦{balance.toLocaleString()}
                  </p>
                </div>
              );
            })()}
          </div>

          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Record New Payment */}
            {canEdit(role, "sales", permissions) && (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <PlusCircle className="w-3.5 h-3.5" /> Add New Payment
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Amount</Label>
                    <CurrencyInput 
                      className="rounded-lg h-9 bg-background/50 border-white/10" 
                      placeholder="0"
                      value={newPaymentAmount}
                      onChange={(e) => setNewPaymentAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Method</Label>
                    <Select value={newPaymentMethod} onValueChange={setNewPaymentMethod}>
                      <SelectTrigger className="h-9 rounded-lg bg-background/50 border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent className="glass-panel rounded-xl">
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="transfer">Bank Transfer</SelectItem>
                        <SelectItem value="pos">POS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 flex items-end">
                    <Button 
                      className="w-full h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                      onClick={() => addPaymentMutation.mutate()}
                      disabled={!newPaymentAmount || parseFloat(newPaymentAmount) <= 0 || addPaymentMutation.isPending}
                    >
                      {addPaymentMutation.isPending ? "Recording..." : "Record Payment"}
                    </Button>
                  </div>
                  <div className="sm:col-span-3 space-y-1.5">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold">New Customer Name</Label>
                          <Input 
                            placeholder="Enter full name" 
                            className="rounded-xl h-11 bg-amber-500/5 border-amber-500/20 focus:border-amber-500"
                            value={form.manual_customer_name}
                            onChange={(e) => setForm(prev => ({ ...prev, manual_customer_name: e.target.value }))}
                          />
                          <CustomerSuggestion 
                            suggestion={duplicateSuggestion} 
                            onSelect={(id) => setForm(prev => ({ ...prev, customer_id: id, is_new_customer: false }))} 
                          />
                        </div>
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Notes (Optional)</Label>
                    <Input 
                      className="rounded-lg h-9 bg-background/50 border-white/10" 
                      placeholder="e.g. Balance for vehicle..."
                      value={newPaymentNote}
                      onChange={(e) => setNewPaymentNote(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Payment List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Records</h4>
              {salePayments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground italic border border-dashed border-white/10 rounded-2xl bg-white/5">
                  No payment records found for this sale.
                </div>
              ) : (
                <div className="overflow-hidden border border-white/5 rounded-2xl">
                  <Table>
                    <TableHeader className="bg-foreground/5">
                      <TableRow className="border-white/5">
                        <TableHead className="text-[10px] font-bold uppercase w-12">#</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase">Date</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase">Method</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase">Notes</TableHead>
                        <TableHead className="text-right text-[10px] font-bold uppercase">Amount</TableHead>
                        <TableHead className="text-right text-[10px] font-bold uppercase">Receipt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const currentSale = sales.find(s => s.id === paymentSaleId);
                        const ordinalLabels = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
                        return [...salePayments].reverse().map((p: any, i: number) => {
                          const isFirst = i === 0;
                          const isLast = i === salePayments.length - 1;
                          const totalPaidUpToThis = [...salePayments].reverse().slice(0, i + 1).reduce((sum: number, px: any) => sum + Number(px.amount), 0);
                          const totalSale = Number(currentSale?.sale_price) || 0;
                          const isFull = totalPaidUpToThis >= totalSale;
                          const label = isFull ? "Full" : isFirst ? "Deposit" : ordinalLabels[i] || `${i+1}th`;
                          const badgeClass = isFull 
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                            : isFirst 
                              ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                              : "bg-sky-500/10 text-sky-500 border border-sky-500/20";
                          // find the index in the original desc array
                          const descIndex = salePayments.findIndex((sp: any) => sp.id === p.id);
                          return (
                            <TableRow key={p.id} className="border-white/5 hover:bg-white/5">
                              <TableCell className="py-3">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>{label}</span>
                              </TableCell>
                              <TableCell className="text-xs py-3">{new Date(p.payment_date).toLocaleDateString()}</TableCell>
                              <TableCell className="text-xs py-3 capitalize">{p.payment_method}</TableCell>
                              <TableCell className="text-xs py-3 max-w-[120px] truncate">{p.notes || "—"}</TableCell>
                              <TableCell className="text-xs py-3 text-right font-bold">₦{Number(p.amount).toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 rounded-lg text-[10px] font-bold hover:bg-amber-500/10 hover:text-amber-500 gap-1"
                                  onClick={() => currentSale && printPaymentReceipt(currentSale, p, descIndex, salePayments)}
                                >
                                  <Printer className="h-3 w-3" /> Print
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                      <TableRow className="bg-emerald-500/5 hover:bg-emerald-500/10 border-t border-white/10">
                        <TableCell colSpan={4} className="text-xs py-3 font-black text-emerald-500 uppercase tracking-wider">Total Paid To Date</TableCell>
                        <TableCell className="text-sm py-3 text-right font-black text-emerald-500">
                          ₦{salePayments.reduce((sum, p: any) => sum + (Number(p.amount) || 0), 0).toLocaleString()}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="p-4 bg-foreground/5 border-t border-white/5">
            <Button variant="outline" onClick={() => setPaymentSaleId(null)} className="rounded-xl border-white/10">Close Window</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
