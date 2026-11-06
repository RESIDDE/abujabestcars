import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format, subMonths } from "date-fns";
import { 
  ChevronRight, ArrowRight, ArrowLeft, Receipt, ClipboardCheck, Wrench, PlusCircle, Clock, DollarSign, PieChart as PieChartIcon, Search, Car, Pencil, QrCode, FileOutput, Trash2, History as HistoryIcon, Check, ChevronsUpDown, Download, Printer, CreditCard, CheckCircle, Bell, X as XIcon, AlertTriangle as AlertTriangleIcon, Eye, RotateCcw
} from "lucide-react";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, AreaChart, Area
} from "recharts";
import VehicleMakeModelSelector from "@/components/VehicleMakeModelSelector";
import { getPrintHeaderHTML, getPrintWatermarkHTML } from "@/components/PrintHeader";
import { getPrintFooterHTML } from "@/components/PrintFooter";
import { SignaturePad } from "@/components/SignaturePad";
import { QrSignDialog } from "@/lib/qrHelpers";
import { CurrencyInput } from "@/components/CurrencyInput";
import { numberToWords } from "@/lib/numberToWords";

const BANK_ACCOUNTS = {
  servicing: {
    name: "Abuja Best Cars",
    account: "1229785752",
    bank: "Zenith Bank",
    label: "Servicing Account"
  },
  painting: {
    name: "Abuja Best Cars",
    account: "0126589674",
    bank: "Wema Bank",
    label: "Painting Services Account"
  }
};
import { CustomerSelect } from "@/components/CustomerSelect";
import { useCustomerDuplicates } from "@/hooks/useCustomerDuplicates";
import { CustomerSuggestion } from "@/components/CustomerSuggestion";
import { logAction } from "@/lib/logger";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { canEdit, canCreate } from "@/lib/permissions";
import { BackButton } from "@/components/BackButton";

type Repair = {
  id: string;
  vehicle_id: string | null;
  customer_id: string | null;
  manual_make: string | null;
  manual_model: string | null;
  manual_year: string | null;
  job_card_no: string | null;
  expected_delivery_date: string | null;
  service_supervisor: string | null;
  technician_assigned: string | null;
  registration_no: string | null;
  vin_chassis: string | null;
  mileage: string | null;
  fuel_level: string | null;
  condition_check: string[] | null;
  inspection_notes: string | null;
  customer_complaint: string | null;
  company: string | null;
  replacement_parts: string | null;
  damaged_parts: string | null;
  to_be_resprayed: boolean;
  painting_bodywork: { items: string[]; details: string } | null;
  mechanical_service: { items: string[]; details: string } | null;
  parts_to_replace: string | null;
  parts_total: number | null;
  labour_total: number | null;
  other_charges: number | null;
  vat: number | null;
  date_out: string | null;
  checked_by: string | null;
  repair_cost: number | null;
  deposit_amount: number | null;
  payment_status: string | null;
  payment_type: string | null;
  brought_in_by: string | null;
  handed_to: string | null;
  signature_data: string | null;
  rep_name: string | null;
  rep_signature: string | null;
  rep_signature_date: string | null;
  respray_notes: string | null;
  notes: string | null;
  bank_account: string | null;
  replacement_parts_list: { name: string; price: number }[] | null;
  manual_trim?: string | null;
  created_at: string;
  updated_at: string;
  vehicles?: { make: string; model: string; year: number; trim?: string; color?: string; vin?: string } | null;
  customers?: { name: string } | null;
};

type RepairPayment = {
  id: string;
  repair_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  notes: string;
  created_at: string;
};

const emptyForm = {
  job_card_no: "",
  vehicle_id: "",
  customer_id: "",
  make: "",
  model: "",
  year: "",
  color: "",
  vin: "",
  registration_no: "",
  mileage: "",
  fuel_level: "1/4",
  expected_delivery_date: "",
  service_supervisor: "",
  technician_assigned: "",
  condition_check: [] as string[],
  inspection_notes: "",
  customer_complaint: "",
  painting_bodywork: { items: [] as string[], details: "" },
  mechanical_service: { items: [] as string[], details: "" },
  parts_to_replace: "",
  parts_total: "",
  labour_total: "",
  other_charges: "",
  vat: "",
  vat_rate: "7.5",
  repair_cost: "",
  deposit_amount: "",
  payment_status: "deposit",
  payment_type: "cash",
  brought_in_by: "",
  company: "",
  handed_to: "",
  signature_data: "",
  rep_name: "",
  rep_signature: "",
  rep_signature_date: new Date().toISOString().split("T")[0],
  respray_notes: "",
  notes: "",
  // Manual Customer
  manual_customer_name: "",
  manual_customer_phone: "",
  manual_customer_email: "",
  manual_customer_address: "",
  is_new_customer: false,
  replacement_parts_list: [] as { name: string; price: number }[],
  bank_account: "servicing",
};

const getVehicleLabel = (r: Repair) => {
  if (!r) return "Unknown vehicle";
  if (r.vehicles) return `${r.vehicles.year} ${r.vehicles.make} ${r.vehicles.model} ${r.vehicles.trim || ""}`.trim();
  if (r.manual_make) return `${r.manual_year || ""} ${r.manual_make} ${r.manual_model || ""} ${r.manual_trim || ""}`.trim();
  return "Unknown vehicle";
};

export default function RepairsMaintenance() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { permissions } = usePermissions();
  const hasEdit = canEdit(role, "repairs", permissions);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm, clearDraft] = useFormPersistence("repair", emptyForm, !!editId, editId || undefined);
  const [qrId, setQrId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCustomerId, setHistoryCustomerId] = useState<string | null>(null);
  const [historyVehicleId, setHistoryVehicleId] = useState<string | null>(null);
  const [historyMode, setHistoryMode] = useState<"customer" | "vehicle">("customer");
  const [historyCustomerName, setHistoryCustomerName] = useState("");
  const [historyVehicleLabel, setHistoryVehicleLabel] = useState("");
  const [page, setPage] = useState(0);
  const [previewRepair, setPreviewRepair] = useState<Repair | null>(null);
  const [openCustomerSelect, setOpenCustomerSelect] = useState(false);
  const [reminderDismissed, setReminderDismissed] = useState(() =>
    sessionStorage.getItem("service_reminder_dismissed") === "true"
  );
  const [paymentRepairId, setPaymentRepairId] = useState<string | null>(null);
  const [newPaymentAmount, setNewPaymentAmount] = useState("");
  const [newPaymentMethod, setNewPaymentMethod] = useState("cash");
  const [newPaymentNote, setNewPaymentNote] = useState("");
  const [printPaymentId, setPrintPaymentId] = useState<string | null>(null);
  const [activeServiceView, setActiveServiceView] = useState<"all" | "service_due">("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const PAGE_SIZE = 10;

  // Auto-calculate parts_total from replacement_parts_list
  useEffect(() => {
    if (form.replacement_parts_list && form.replacement_parts_list.length > 0) {
      const total = form.replacement_parts_list.reduce((acc, item) => acc + (Number(item.price) || 0), 0);
      const totalStr = total.toString();
      if (form.parts_total !== totalStr) {
        setForm(prev => ({ ...prev, parts_total: totalStr }));
      }
    }
  }, [form.replacement_parts_list]);

  // Auto-calculate repair cost (Grand Total)
  useEffect(() => {
    const parts = parseFloat(form.parts_total.toString().replace(/,/g, "")) || 0;
    const labour = parseFloat(form.labour_total.toString().replace(/,/g, "")) || 0;
    const other = parseFloat(form.other_charges.toString().replace(/,/g, "")) || 0;
    const rate = parseFloat(form.vat_rate.toString().replace(/,/g, "")) || 0;
    
    // Auto-calculate VAT
    const calculatedVat = (parts + labour + other) * (rate / 100);
    const vatStr = calculatedVat.toFixed(2);
    
    const total = parts + labour + other + calculatedVat;
    const totalStr = total.toFixed(2);
    
    if (form.vat !== vatStr || form.repair_cost !== totalStr) {
      setForm(prev => ({ 
        ...prev, 
        vat: vatStr,
        repair_cost: totalStr 
      }));
    }
  }, [form.parts_total, form.labour_total, form.other_charges, form.vat_rate]);

  // 1. All Queries at the top
  const { data: repairs = [], isLoading } = useQuery({
    queryKey: ["repairs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repairs")
        .select("*, vehicles(make, model, year, trim, color, vin), customers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[] as Repair[];
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("id, make, model, year, trim").order("make");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name, phone, email, address").order("name");
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

  const { data: serviceInterval = { months: 3, days: 0 } } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("app_settings").select("*");
      if (error) return { months: 3, days: 0 };
      const mRow = (data as any[]).find((r: any) => r.key === "service_interval_months");
      const dRow = (data as any[]).find((r: any) => r.key === "service_interval_days");
      return { 
        months: mRow ? parseInt(mRow.value) || 0 : 3, 
        days: dRow ? parseInt(dRow.value) || 0 : 0 
      };
    },
  });

  const { data: repairPayments = [] } = useQuery({
    queryKey: ["repair_payments", paymentRepairId],
    enabled: !!paymentRepairId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repair_payments" as any)
        .select("*")
        .eq("repair_id", paymentRepairId)
        .order("payment_date", { ascending: true });
      if (error) throw error;
      return data as unknown as RepairPayment[];
    },
  });

  // 2. Data Calculations
  const serviceReminders = useMemo(() => {
    const now = new Date();
    const soonThreshold = new Date(now);
    soonThreshold.setDate(soonThreshold.getDate() + 14);

    // Group repairs by a unique vehicle key — prefer vehicle_id, fall back to manual make/model
    const latestByVehicle = new Map<string, { label: string; customer: string; lastDate: Date; repairId: string }>();
    for (const r of repairs) {
      const key = r.vehicle_id || `manual:${r.manual_make}:${r.manual_model}:${r.manual_year}`;
      const label = getVehicleLabel(r);
      const cust = customers.find((c: any) => c.id === r.customer_id);
      const custName = cust ? cust.name : (r.brought_in_by || "Unknown Customer");
      const repairDate = new Date(r.created_at);
      const existing = latestByVehicle.get(key);
      if (!existing || repairDate > existing.lastDate) {
        latestByVehicle.set(key, { label, customer: custName, lastDate: repairDate, repairId: r.id });
      }
    }

    const reminders: { key: string; label: string; customer: string; lastDate: Date; dueDate: Date; status: "overdue" | "soon" }[] = [];
    for (const [key, entry] of latestByVehicle.entries()) {
      const dueDate = new Date(entry.lastDate);
      dueDate.setMonth(dueDate.getMonth() + (serviceInterval.months));
      dueDate.setDate(dueDate.getDate() + (serviceInterval.days));
      
      if (dueDate <= soonThreshold) {
        reminders.push({
          key,
          label: entry.label,
          customer: entry.customer,
          lastDate: entry.lastDate,
          dueDate,
          status: dueDate < now ? "overdue" : "soon",
        });
      }
    }
    return reminders.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [repairs, customers, serviceInterval]);

  const filteredRepairs = useMemo(() => {
    return repairs.filter(r => {
      // Payment Status Filter
      if (statusFilter !== "all" && r.payment_status !== statusFilter) {
        return false;
      }
      
      // Date/Time Filter (Default Monthly)
      if (selectedMonth !== "all") {
        const repairDate = new Date(r.created_at);
        const repairMonth = format(repairDate, 'yyyy-MM');
        if (repairMonth !== selectedMonth) return false;

        // Weekly Filter (within the selected month)
        if (selectedWeek !== "all") {
          const dayOfMonth = repairDate.getDate();
          const weekNum = Math.ceil(dayOfMonth / 7);
          if (String(weekNum) !== selectedWeek) return false;
        }
      }

      if (dateFilter !== "all") {
        const repairDate = new Date(r.created_at);
        const now = new Date();
        if (dateFilter === "this_month") {
          if (repairDate.getMonth() !== now.getMonth() || repairDate.getFullYear() !== now.getFullYear()) return false;
        } else if (dateFilter === "last_month") {
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          if (repairDate.getMonth() !== lastMonth.getMonth() || repairDate.getFullYear() !== lastMonth.getFullYear()) return false;
        } else if (dateFilter === "last_3_months") {
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(now.getMonth() - 3);
          if (repairDate < threeMonthsAgo) return false;
        } else if (dateFilter === "this_year") {
          if (repairDate.getFullYear() !== now.getFullYear()) return false;
        }
      }

      // Text Search
      if (!search) return true;
      const q = search.toLowerCase();
      const vLabel = getVehicleLabel(r).toLowerCase();
      const custName = customers.find(c => c.id === r.customer_id)?.name.toLowerCase() || "";
      const company = r.company?.toLowerCase() || "";
      return vLabel.includes(q) || custName.includes(q) || company.includes(q);
    });
  }, [repairs, search, statusFilter, dateFilter, customers, selectedMonth, selectedWeek]);

  const stats = useMemo(() => {
    const total = filteredRepairs.length;
    const active = filteredRepairs.filter(r => r.payment_status !== 'paid_in_full').length;
    const revenue = filteredRepairs.reduce((acc, r) => acc + (Number(r.repair_cost) || 0), 0);
    const collected = filteredRepairs.reduce((acc, r) => {
      if (r.payment_status === 'paid_in_full') return acc + (Number(r.repair_cost) || 0);
      return acc + (Number(r.deposit_amount) || 0);
    }, 0);
    return {
      total,
      active,
      revenue,
      pending: revenue - collected
    };
  }, [filteredRepairs]);

  const monthlyHistory = useMemo(() => {
    const months: any[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('default', { month: 'short' });
      const m = d.getMonth();
      const y = d.getFullYear();
      const monthRepairs = repairs.filter(r => {
        const rd = new Date(r.created_at);
        return rd.getMonth() === m && rd.getFullYear() === y;
      });
      const rev = monthRepairs.reduce((acc, r) => acc + (Number(r.repair_cost) || 0), 0);
      months.push({ name: label, Revenue: rev, Count: monthRepairs.length });
    }
    return months;
  }, [repairs]);

  const statusSplit = useMemo(() => {
    const paid = filteredRepairs.filter(r => r.payment_status === 'paid_in_full').length;
    const deposit = filteredRepairs.filter(r => r.payment_status === 'deposit').length;
    return [
      { name: 'Paid in Full', value: paid },
      { name: 'Deposit Only', value: deposit }
    ].filter(x => x.value > 0);
  }, [filteredRepairs]);

  const totalPages = useMemo(() => Math.ceil(filteredRepairs.length / PAGE_SIZE), [filteredRepairs]);
  const pagedRepairs = useMemo(() => filteredRepairs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filteredRepairs, page]);
  console.log("RepairsMaintenance loaded with pagination support", { page, totalResults: filteredRepairs.length, totalPages });


  const historyItems = useMemo(() => {
    if (historyMode === "customer") {
      if (!historyCustomerId) return [];
      return repairs.filter(r => r.customer_id === historyCustomerId).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      if (!historyVehicleId) return [];
      return repairs.filter(r => r.vehicle_id === historyVehicleId).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }, [repairs, historyCustomerId, historyVehicleId, historyMode]);

  const openHistory = (r: Repair, mode: "customer" | "vehicle" = "customer") => {
    setHistoryMode(mode);
    if (mode === "customer") {
      if (!r.customer_id) {
        toast.error("No customer information for this repair");
        return;
      }
      const cust = customers.find(c => c.id === r.customer_id);
      setHistoryCustomerId(r.customer_id);
      setHistoryVehicleId(null);
      setHistoryCustomerName(cust?.name || r.customers?.name || "Customer");
      setHistoryVehicleLabel(getVehicleLabel(r));
    } else {
      if (!r.vehicle_id) {
        toast.error("This repair is not linked to a system vehicle");
        return;
      }
      setHistoryVehicleId(r.vehicle_id);
      setHistoryCustomerId(null);
      setHistoryVehicleLabel(getVehicleLabel(r));
      const cust = customers.find(c => c.id === r.customer_id);
      setHistoryCustomerName(cust?.name || r.customers?.name || "Customer");
    }
    setHistoryOpen(true);
  };

  const upsert = useMutation({
    mutationFn: async () => {
      let finalVehicleId = form.vehicle_id;
      let finalCustomerId = form.customer_id;

      // Validate IDs against current lists to prevent foreign key violations
      // This handles cases where a vehicle or customer was deleted but remains in form state
      if (finalVehicleId && vehicles.length > 0 && !vehicles.some(v => v.id === finalVehicleId)) {
        console.warn("Selected vehicle_id not found in system, clearing for re-creation:", finalVehicleId);
        finalVehicleId = "";
      }
      if (finalCustomerId && customers.length > 0 && !customers.some(c => c.id === finalCustomerId)) {
        console.warn("Selected customer_id not found in system, clearing:", finalCustomerId);
        finalCustomerId = "";
      }

      if (!finalCustomerId && !(form.is_new_customer && form.manual_customer_name)) {
        throw new Error("Please select a customer or provide new customer details before saving.");
      }

      if (!finalVehicleId && !form.make) {
        throw new Error("Please select a vehicle or provide vehicle details before saving.");
      }

      // Handle New Customer Creation
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

      // Handle New Vehicle Creation
      if (!finalVehicleId && form.make) {
        if (form.vin) {
          const { data: existingV } = await supabase.from("vehicles").select("id").eq("vin", form.vin).maybeSingle();
          if (existingV) {
            finalVehicleId = existingV.id;
          }
        }
        
        if (!finalVehicleId) {
          const { data: newV, error: vErr } = await supabase.from("vehicles" as any).insert({
            make: form.make,
            model: form.model,
            year: Number(form.year) || new Date().getFullYear(),
            color: form.color || null,
            vin: form.vin || null,
            status: "Customer Car",
            price: 0,
            condition: "Customer Vehicle",
            num_keys: 1,
            inventory_type: 'service',
          }).select().single();
          
          if (vErr) {
            if (vErr.message?.includes('duplicate key value')) {
              throw new Error("A vehicle with this VIN or Registration already exists. Please select it from the list instead of manually entering.");
            }
            throw vErr;
          }
          finalVehicleId = (newV as any).id;
        }
      }

      const payload: any = {
        job_card_no: form.job_card_no || null,
        respray_notes: form.respray_notes || null,
        vehicle_id: finalVehicleId || null,
        manual_make: form.make,
        manual_model: form.model,
        manual_year: form.year,
        registration_no: form.registration_no,
        vin_chassis: form.vin,
        mileage: form.mileage,
        fuel_level: form.fuel_level,
        expected_delivery_date: form.expected_delivery_date || null,
        service_supervisor: form.service_supervisor,
        technician_assigned: form.technician_assigned,
        condition_check: form.condition_check,
        inspection_notes: form.inspection_notes,
        customer_complaint: form.customer_complaint,
        painting_bodywork: form.painting_bodywork,
        mechanical_service: form.mechanical_service,
        parts_to_replace: form.parts_to_replace,
        parts_total: Number(form.parts_total) || 0,
        labour_total: Number(form.labour_total) || 0,
        other_charges: Number(form.other_charges) || 0,
        vat: Number(form.vat) || 0,
        repair_cost: Number(form.repair_cost) || 0,
        deposit_amount: Number(form.deposit_amount) || 0,
        payment_status: form.payment_status,
        payment_type: form.payment_type,
        rep_name: form.rep_name,
        rep_signature: form.rep_signature,
        rep_signature_date: form.rep_signature_date,
        notes: form.notes,
        customer_id: finalCustomerId || null,
        signature_data: form.signature_data,
        handed_to: form.handed_to,
        replacement_parts_list: form.replacement_parts_list,
        bank_account: form.bank_account,
        company: form.company,
        brought_in_by: form.brought_in_by,
      };
      if (editId) {
        const { error } = await supabase.from("repairs").update(payload).eq("id", editId);
        if (error) throw error;

        // Sync deposit amount with repair_payments
        const deposit = Number(form.deposit_amount) || 0;
        if (deposit > 0) {
          const { data: existing } = await supabase
            .from("repair_payments" as any)
            .select("id")
            .eq("repair_id", editId)
            .ilike("notes", "%initial deposit%")
            .limit(1);

          if (existing && existing.length > 0) {
            const existingId = (existing[0] as any).id;
            await supabase.from("repair_payments" as any)
              .update({ amount: deposit, payment_method: form.payment_type })
              .eq("id", existingId);
          } else {
            await supabase.from("repair_payments" as any).insert({
              repair_id: editId,
              amount: deposit,
              payment_method: form.payment_type,
              notes: "Initial deposit recorded at time of repair update",
              payment_date: new Date().toISOString()
            });
          }
        }
      } else {
        const { data: newRepair, error } = await supabase.from("repairs").insert(payload).select().single();
        if (error) throw error;

        // Auto-insert initial payment if deposit > 0
        const deposit = Number(form.deposit_amount) || 0;
        if (deposit > 0 && newRepair) {
          await supabase.from("repair_payments" as any).insert({
            repair_id: newRepair.id,
            amount: deposit,
            payment_method: form.payment_type,
            notes: "Initial deposit recorded at time of repair creation",
            payment_date: new Date().toISOString()
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repairs"] });
      queryClient.invalidateQueries({ queryKey: ["customers-list"] });
      queryClient.invalidateQueries({ queryKey: ["repair_payments"] });
      logAction(editId ? "UPDATE" : "CREATE", "Repair", editId ?? undefined);
      toast.success(`${editId ? "Repair updated" : "Repair added"} successfully. Please note it might take a moment to reflect across all views.`);
      clearDraft();
      setForm(emptyForm);
      setEditId(null);
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("repairs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["repairs"] });
      logAction("DELETE", "Repair", id);
      toast.success("Repair deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addRepairPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!paymentRepairId) return;
      const amt = Number(newPaymentAmount) || 0;
      if (amt <= 0) throw new Error("Please enter a valid amount");

      const { error: pErr } = await supabase.from("repair_payments" as any).insert({
        repair_id: paymentRepairId,
        amount: amt,
        payment_method: newPaymentMethod,
        notes: newPaymentNote,
        payment_date: new Date().toISOString()
      });
      if (pErr) throw pErr;

      // Update repair's deposit_amount and status if needed
      const currentRepair = repairs.find(r => r.id === paymentRepairId);
      if (currentRepair) {
        const { data: currentPayments } = await supabase.from("repair_payments" as any).select("amount").eq("repair_id", paymentRepairId);
        const totalPaid = (currentPayments || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        const totalCost = Number(currentRepair.repair_cost) || 0;
        
        const updateData: any = {
          deposit_amount: totalPaid,
          payment_status: totalPaid >= totalCost ? "paid_in_full" : "deposit"
        };
        await supabase.from("repairs").update(updateData).eq("id", paymentRepairId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repairs"] });
      queryClient.invalidateQueries({ queryKey: ["repair_payments", paymentRepairId] });
      toast.success("Payment recorded successfully");
      setNewPaymentAmount("");
      setNewPaymentNote("");
      logAction("CREATE", "Repair Payment", paymentRepairId || undefined);
    },
    onError: (e: any) => toast.error(e.message)
  });


  const closeDialog = () => { setOpen(false); setEditId(null); };

  const openEdit = (r: Repair) => {
    setEditId(r.id);
    const subtotal = (Number(r.parts_total) || 0) + (Number(r.labour_total) || 0) + (Number(r.other_charges) || 0);
    const vatAmt = Number(r.vat) || 0;
    const derivedRate = subtotal > 0 ? (vatAmt / subtotal) * 100 : 7.5;

    setForm({
      job_card_no: r.job_card_no || "",
      vehicle_id: r.vehicle_id || "",
      customer_id: r.customer_id || "",
      make: r.manual_make || (r.vehicles?.make || ""),
      model: r.manual_model || (r.vehicles?.model || ""),
      year: r.manual_year || (r.vehicles?.year?.toString() || ""),
      color: r.vehicles?.color || "",
      vin: r.vin_chassis || (r.vehicles?.vin || ""),
      registration_no: r.registration_no || "",
      mileage: r.mileage || "",
      fuel_level: r.fuel_level || "1/4",
      expected_delivery_date: r.expected_delivery_date || "",
      service_supervisor: r.service_supervisor || "",
      technician_assigned: r.technician_assigned || "",
      condition_check: r.condition_check || [],
      inspection_notes: r.inspection_notes || "",
      customer_complaint: r.customer_complaint || "",
      painting_bodywork: r.painting_bodywork || { items: [], details: "" },
      mechanical_service: r.mechanical_service || { items: [], details: "" },
      parts_to_replace: r.parts_to_replace || "",
      parts_total: r.parts_total?.toString() || "0",
      labour_total: r.labour_total?.toString() || "0",
      other_charges: r.other_charges?.toString() || "0",
      vat: r.vat?.toString() || "0",
      vat_rate: derivedRate.toFixed(1),
      repair_cost: r.repair_cost?.toString() || "0",
      deposit_amount: r.deposit_amount?.toString() || "0",
      payment_status: r.payment_status || "deposit",
      payment_type: r.payment_type || "cash",
      brought_in_by: r.brought_in_by || "",
      company: r.company || "",
      handed_to: r.handed_to || "",
      signature_data: r.signature_data || "",
      rep_name: r.rep_name || "",
      rep_signature: r.rep_signature || "",
      rep_signature_date: r.rep_signature_date || new Date().toISOString().split("T")[0],
      respray_notes: r.respray_notes || "",
      notes: r.notes || "",
      bank_account: r.bank_account || "servicing",
      replacement_parts_list: (r.replacement_parts_list as any) || [],
      manual_customer_name: "",
      manual_customer_phone: "",
      manual_customer_email: "",
      manual_customer_address: "",
      is_new_customer: false,
    });
    setOpen(true);
  };

  const handleVehicleSelect = (vehicleId: string) => {
    const v = vehicles.find((x) => x.id === vehicleId);
    if (v) {
      setForm({ ...form, vehicle_id: vehicleId, make: v.make, model: v.model, year: v.year.toString() });
    }
  };

  const paymentStatusLabel = (s: string | null) => s === "paid_in_full" ? "Paid in Full" : "Deposit";
  const paymentTypeLabel = (t: string | null) => t === "transfer" ? "Transfer" : t === "pos" ? "POS" : "Cash";


  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-panel p-3 border border-white/20 shadow-2xl rounded-xl z-50">
          <p className="font-semibold text-foreground mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm font-medium flex justify-between gap-4" style={{ color: entry.color || entry.fill }}>
              <span>{entry.name}:</span> <span>{entry.name.includes('Revenue') ? `₦${entry.value.toLocaleString()}` : entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderCheckboxesHTML = (items: any, allOptions: string[]) => {
    let parsedItems: string[] = [];
    if (Array.isArray(items)) {
      parsedItems = items;
    } else if (typeof items === 'string') {
      try {
        parsedItems = JSON.parse(items);
      } catch(e) {
        parsedItems = [items];
      }
    }
    
    return allOptions.map(opt => `
      <span style="display:inline-flex; align-items:center; margin-right: 15px; font-size: 11px;">
        <span style="width:12px; height:12px; border:1.5px solid #333; display:inline-block; margin-right:5px; text-align:center; line-height:10px; font-weight:bold;">
          ${(parsedItems as any)?.includes(opt) ? '✓' : ''}
        </span>
        ${opt}
      </span>
    `).join('');
  };

  const getBillHTML = (r: Repair, logoBase64?: string) => {
    const cust = customers.find(c => c.id === r.customer_id);
    const totalAmount = Number(r.repair_cost) || 0;
    const vehicleLabel = getVehicleLabel(r).toUpperCase();

    return `<html><head><title>Service Bill - ${vehicleLabel}</title>
    <style>
      @page { margin: 0; size: auto; }
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap');
      body { font-family: 'Roboto', 'Arial', sans-serif; padding: 15px; max-width: 800px; margin: 0 auto; color: #1a1a1a; line-height: 1.3; }
      .date-section { text-align: right; font-weight: 800; font-size: 13px; margin-bottom: 15px; text-transform: uppercase; }
      .bill-to { margin-bottom: 20px; }
      .bill-to p { margin: 2px 0; font-size: 13px; }
      .main-container {
        background-color: transparent;
        border-radius: 40px;
        padding: 20px;
        position: relative;
        border: none;
      }
      .content-wrapper { position: relative; z-index: 1; }
      .bill-title { text-align: center; text-decoration: underline; font-weight: 900; font-size: 20px; margin-bottom: 20px; color: #1e293b; text-transform: uppercase; }
      
      table { width: 100%; border-collapse: collapse; background: transparent; margin-bottom: 20px; }
      th, td { border: 1px solid #475569; padding: 8px 10px; text-align: left; font-size: 13px; font-weight: 600; }
      th { background: transparent; text-transform: uppercase; }
      td:first-child { width: 40px; text-align: center; }
      
      .total-row td { border-top: 3px solid #1e293b; font-weight: 900; font-size: 16px; }
      .amount-words { font-weight: 900; margin-bottom: 20px; font-size: 14px; text-transform: uppercase; }
      .bank-details { margin-top: 15px; font-size: 12px; }
      .bank-details h4 { margin: 0 0 5px 0; font-weight: 900; text-transform: uppercase; }
      .bank-details p { margin: 2px 0; font-weight: 500; }
    </style></head><body>
    ${getPrintHeaderHTML(logoBase64)}
    
    <div class="date-section">DATE: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>

    <div class="bill-to">
      <p style="font-weight: 900;">BILL TO:</p>
      <p><strong>${cust?.name || 'Cash Customer'}</strong></p>
      <p>Tel: ${cust?.phone || r.registration_no || ''}</p>
      ${r.company ? `<p>Company: <strong>${r.company.toUpperCase()}</strong></p>` : ''}
      ${r.brought_in_by ? `<p>Brought In By: <strong>${r.brought_in_by.toUpperCase()}</strong></p>` : ''}
    </div>

    <div class="main-container">
      ${getPrintWatermarkHTML(logoBase64)}
      <div class="content-wrapper">
        <h2 class="bill-title">${vehicleLabel} SERVICE BILL</h2>
        
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>SERVICE DESCRIPTION</th>
              <th style="width: 60px; text-align: center;">QTY</th>
              <th style="width: 120px;">UNIT PRICE</th>
              <th style="width: 120px; text-align: right;">AMOUNT (₦)</th>
            </tr>
          </thead>
          <tbody>
            ${r.replacement_parts_list && (r.replacement_parts_list as any).length > 0 ? (r.replacement_parts_list as any).map((p: any, idx: number) => `
              <tr>
                <td>${idx + 1}.</td>
                <td>${p.name.toUpperCase()}</td>
                <td style="text-align: center;">1</td>
                <td>₦${(Number(p.price) || 0).toLocaleString()}</td>
                <td style="text-align: right;">₦${(Number(p.price) || 0).toLocaleString()}</td>
              </tr>
            `).join('') : `
              <tr>
                <td>1.</td>
                <td>PARTS & MATERIALS</td>
                <td style="text-align: center;">1</td>
                <td>₦${(Number(r.parts_total) || 0).toLocaleString()}</td>
                <td style="text-align: right;">₦${(Number(r.parts_total) || 0).toLocaleString()}</td>
              </tr>
            `}
            <tr>
              <td>${r.replacement_parts_list && (r.replacement_parts_list as any).length > 0 ? (r.replacement_parts_list as any).length + 1 : 2}.</td>
              <td>LABOUR CHARGES</td>
              <td style="text-align: center;">1</td>
              <td>₦${(Number(r.labour_total) || 0).toLocaleString()}</td>
              <td style="text-align: right;">₦${(Number(r.labour_total) || 0).toLocaleString()}</td>
            </tr>
            ${Number(r.other_charges) > 0 ? `
            <tr>
              <td>${r.replacement_parts_list && (r.replacement_parts_list as any).length > 0 ? (r.replacement_parts_list as any).length + 2 : 3}.</td>
              <td>OTHER SERVICES / CHARGES</td>
              <td style="text-align: center;">1</td>
              <td>₦${(Number(r.other_charges) || 0).toLocaleString()}</td>
              <td style="text-align: right;">₦${(Number(r.other_charges) || 0).toLocaleString()}</td>
            </tr>` : ''}
            ${Number(r.vat) > 0 ? `
            <tr>
              <td>${(r.replacement_parts_list && (r.replacement_parts_list as any).length > 0 ? (r.replacement_parts_list as any).length : 2) + (Number(r.other_charges) > 0 ? 2 : 1)}</td>
              <td>VAT / TAX</td>
              <td style="text-align: center;"></td>
              <td>₦${(Number(r.vat) || 0).toLocaleString()}</td>
              <td style="text-align: right;">₦${(Number(r.vat) || 0).toLocaleString()}</td>
            </tr>` : ''}
            <tr class="total-row">
              <td colspan="3" style="border: none;"></td>
              <td style="text-align: right;">GRAND TOTAL</td>
              <td style="text-align: right;">₦${totalAmount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        

        <div class="amount-words">
          AMOUNT IN WORDS: ${numberToWords(totalAmount)}
        </div>

        <div class="bank-details">
          <h4>BANK DETAILS:</h4>
          <p>Account name: <strong>${BANK_ACCOUNTS[r.bank_account as keyof typeof BANK_ACCOUNTS]?.name || BANK_ACCOUNTS.servicing.name}</strong></p>
          <p>Account Number: <strong>${BANK_ACCOUNTS[r.bank_account as keyof typeof BANK_ACCOUNTS]?.account || BANK_ACCOUNTS.servicing.account}</strong></p>
          <p>Bank: <strong>${BANK_ACCOUNTS[r.bank_account as keyof typeof BANK_ACCOUNTS]?.bank || BANK_ACCOUNTS.servicing.bank}</strong></p>
        </div>
      </div>
    </div>
    </body></html>`;
  };

  const getJobCardHTML = (r: Repair, logoBase64?: string) => {
    const cust = customers.find(c => c.id === r.customer_id);
    return `<html><head><title>Job Card - ${r.job_card_no || r.id}</title>
    <style>
      @page { margin: 0; size: auto; }
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
      body { font-family: 'Inter', sans-serif; padding: 10px; max-width: 850px; margin: 0 auto; color: #1a1a1a; line-height: 1.3; position: relative; }
      .job-header { text-align: center; font-weight: 800; font-size: 20px; text-transform: uppercase; margin: 10px 0; letter-spacing: 2px; }
      .section { border: 1.5px solid #000; margin-bottom: 10px; border-radius: 4px; overflow: hidden; }
      .section-title { background: transparent; padding: 4px 10px; font-size: 11px; font-weight: 800; border-bottom: 1.5px solid #000; text-transform: uppercase; display: flex; justify-content: space-between; }
      .section-content { padding: 8px 10px; font-size: 10px; }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .grid-3 { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 8px; }
      .field { margin: 3px 0; border-bottom: 1px dashed #ccc; padding-bottom: 2px; min-height: 16px; }
      .field-label { font-weight: 600; color: #555; margin-right: 5px; min-width: 120px; display: inline-block; }
      .checkbox-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-top: 6px; }
      .footer-note { font-size: 9px; text-align: center; margin-top: 15px; font-weight: 600; font-style: italic; }
      .sig-line { border-bottom: 1.5px solid #000; min-width: 130px; display: inline-block; margin: 0 5px; height: 25px; }
      @media print { body { padding: 0; } .section { page-break-inside: avoid; } }
    </style></head><body>
    ${getPrintWatermarkHTML(logoBase64)}
    ${getPrintHeaderHTML(logoBase64)}
    
    <div class="job-header">JOB CARD</div>

    <div class="grid-2" style="margin-bottom: 15px;">
      <div style="font-size: 11px;">
        <div class="field"><span class="field-label">Job Card No:</span> <span style="font-weight:800; font-size: 13px;">${r.job_card_no || '—'}</span></div>
        <div class="field"><span class="field-label">Date In:</span> ${new Date(r.created_at).toLocaleDateString()}</div>
        <div class="field"><span class="field-label">Expected Delivery:</span> ${r.expected_delivery_date ? new Date(r.expected_delivery_date).toLocaleDateString() : '—'}</div>
      </div>
      <div style="font-size: 11px;">
        <div class="field"><span class="field-label">Service Supervisor:</span> ${r.service_supervisor || '—'}</div>
        <div class="field"><span class="field-label">Technician Assigned:</span> ${r.technician_assigned || '—'}</div>
      </div>
    </div>

    <!-- 1. CUSTOMER INFORMATION -->
    <div class="section">
      <div class="section-title">1. CUSTOMER INFORMATION</div>
      <div class="section-content grid-2">
        <div>
          <div class="field"><span class="field-label">Customer Name:</span> ${cust?.name || '—'}</div>
          <div class="field"><span class="field-label">Phone Number:</span> ${cust?.phone || '—'}</div>
          <div class="field"><span class="field-label">Company:</span> ${r.company || '—'}</div>
          <div class="field"><span class="field-label">Brought In By:</span> ${r.brought_in_by || '—'}</div>
        </div>
        <div>
          <div class="field"><span class="field-label">Email:</span> ${cust?.email || '—'}</div>
          <div class="field"><span class="field-label">Address:</span> ${cust?.address || '—'}</div>
        </div>
      </div>
    </div>

    <!-- 2. VEHICLE DETAILS -->
    <div class="section">
      <div class="section-title">2. VEHICLE DETAILS</div>
      <div class="section-content">
        <div class="grid-3">
          <div class="field"><span class="field-label">Make & Model:</span> ${getVehicleLabel(r)}</div>
          <div class="field"><span class="field-label">Year:</span> ${r.manual_year || r.vehicles?.year || '—'}</div>
          <div class="field"><span class="field-label">Colour:</span> ${r.vehicles?.color || '—'}</div>
        </div>
        <div class="grid-3">
          <div class="field"><span class="field-label">Registration No.:</span> ${r.registration_no || '—'}</div>
          <div class="field"><span class="field-label">VIN/Chassis No.:</span> ${r.vin_chassis || '—'}</div>
          <div class="field"><span class="field-label">Mileage (KM):</span> ${r.mileage || '—'}</div>
        </div>
        <div class="field" style="margin-top: 5px;">
          <span class="field-label">Fuel Level:</span>
          ${renderCheckboxesHTML([r.fuel_level || ''], ['Empty', '1/4', '1/2', '3/4', 'Full'])}
        </div>
      </div>
    </div>

    <!-- 3. CUSTOMER COMPLAINT -->
    <div class="section">
      <div class="section-title">3. CUSTOMER COMPLAINT / REQUEST</div>
      <div class="section-content" style="min-height: 40px;">
        ${r.customer_complaint || '—'}
      </div>
    </div>

    <!-- 4. VEHICLE CONDITION -->
    <div class="section">
      <div class="section-title">4. VEHICLE CONDITION CHECK (ON ARRIVAL)</div>
      <div class="section-content">
        <div class="checkbox-grid">
          ${renderCheckboxesHTML(r.condition_check || [], ['Scratches', 'Broken Lights', 'Interior Damage', 'Engine Noise', 'Warning Lights', 'Electrical Fault', 'AC Fault'])}
        </div>
        <div style="margin-top: 10px; padding-top: 5px; border-top: 1px dashed #ccc;">
          <strong>Inspection Notes:</strong> ${r.inspection_notes || 'No damaged parts noted.'}
        </div>
      </div>
    </div>

    <!-- 5. SERVICE DETAILS -->
    <div class="section">
      <div class="section-title">5. SERVICE / REPAIR DETAILS</div>
      <div class="section-content">
        <div style="margin-bottom: 10px;">
          <strong style="font-size: 10px;">A. PAINTING & BODY WORK</strong><br/>
          <div class="checkbox-grid">
            ${renderCheckboxesHTML(r.painting_bodywork?.items || [], ['Buffing / Polishing', 'Full Respray', 'Panel Beating', 'Accident Repair', 'Chassis Alignment', 'Plastic Repair', 'Wheel Refurbishment'])}
          </div>
          <div style="font-size: 10px; margin-top: 4px; font-style: italic;">Details: ${r.painting_bodywork?.details || '—'}</div>
        </div>
        <div>
          <strong style="font-size: 10px;">B. MECHANICAL & GENERAL SERVICE</strong><br/>
          <div class="checkbox-grid">
            ${renderCheckboxesHTML(r.mechanical_service?.items || [], ['Engine Service', 'Oil Change', 'Brake Service', 'Suspension', 'Electricals', 'AC Service', 'Diagnostics', 'Wheel Balancing'])}
          </div>
          <div style="font-size: 10px; margin-top: 4px; font-style: italic;">Details: ${r.mechanical_service?.details || '—'}</div>
        </div>
      </div>
    </div>

    <!-- 6 & 7. PARTS & COST -->
    <div class="grid-2">
      <div class="section">
        <div class="section-title">6. PARTS TO BE REPLACE</div>
        <div class="section-content text-xs" style="min-height: 80px;">
          ${r.replacement_parts_list && (r.replacement_parts_list as any).length > 0 
            ? (r.replacement_parts_list as any).map((p: any) => `<div style="display:flex; justify-content:space-between; margin-bottom: 2px;"><span>• ${p.name}</span> <span>₦${(Number(p.price) || 0).toLocaleString()}</span></div>`).join('')
            : (r.parts_to_replace || '—')
          }
          ${r.replacement_parts_list && (r.replacement_parts_list as any).length > 0 && r.parts_to_replace ? `<div style="margin-top: 5px; border-top: 1px dashed #ccc; padding-top: 5px; font-style: italic;">Note: ${r.parts_to_replace}</div>` : ''}
        </div>
      </div>
      <div class="section">
        <div class="section-title">7. COST SUMMARY</div>
        <div class="section-content">
          <div class="row" style="display:flex; justify-content:space-between; margin:2px 0;"><span>Parts Total:</span> <strong>₦${Number(r.parts_total || 0).toLocaleString()}</strong></div>
          <div class="row" style="display:flex; justify-content:space-between; margin:2px 0;"><span>Labour Total:</span> <strong>₦${Number(r.labour_total || 0).toLocaleString()}</strong></div>
          <div class="row" style="display:flex; justify-content:space-between; margin:2px 0;"><span>Other Charges:</span> <strong>₦${Number(r.other_charges || 0).toLocaleString()}</strong></div>
          <div class="row" style="display:flex; justify-content:space-between; margin:2px 0;"><span>VAT:</span> <strong>₦${Number(r.vat || 0).toLocaleString()}</strong></div>
          <div style="border-top:1.5px solid #000; margin-top:5px; padding-top:5px; display:flex; justify-content:space-between; font-size: 14px;">
            <strong>GRAND TOTAL:</strong> <strong style="color:#d32f2f;">₦${Number(r.repair_cost || 0).toLocaleString()}</strong>
          </div>
        </div>
      </div>
    </div>

    <!-- 9. T&C -->
    <div style="font-size: 9px; margin-bottom: 20px;">
      <strong>9. TERMS & CONDITIONS:</strong> Estimates may change after full inspection. Additional repairs require customer approval. Vehicles left beyond 3 days after completion may incur storage fees.
    </div>

    <!-- 10. AUTHORIZATION -->
    <div class="section">
      <div class="section-title">10. AUTHORIZATION</div>
      <div class="section-content" style="padding-bottom: 30px;">
        <p>I authorize the above work to be carried out.</p>
        <div class="grid-2" style="margin-top: 20px;">
          <div>Customer Signature: ${r.signature_data ? `<img src="${r.signature_data}" style="max-height: 40px; vertical-align: middle;"/>` : `<div class="sig-line"></div>`} Date: <span class="sig-line"></span></div>
          <div>Supervisor Signature: ${r.rep_signature ? `<img src="${r.rep_signature}" style="max-height: 40px; vertical-align: middle;"/>` : `<div class="sig-line"></div>`} Date: <span class="sig-line"></span></div>
        </div>
      </div>
    </div>

    <!-- 11 & 12. DELIVERY / CONFIRMATION -->
    <div class="grid-2">
      <div class="section">
        <div class="section-title">11. FINAL DELIVERY</div>
        <div class="section-content">
          <div class="field">Date Out: <span class="sig-line" style="min-width: 100px;"></span></div>
          <div class="field">Vehicle Checked By: <span class="sig-line" style="min-width: 100px;"></span></div>
          <div class="field">Customer Signature: <span class="sig-line" style="min-width: 100px;"></span></div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">12. CUSTOMER CONFIRMATION</div>
        <div class="section-content">
          <p style="font-size: 9px; font-weight: bold;">I confirm vehicle received in good condition.</p>
          <div class="field" style="margin-top: 20px;">Signature/Date: <span class="sig-line" style="width: 100%;"></span></div>
        </div>
      </div>
    </div>

    <div class="footer-note">Thank you for choosing Abuja Best Cars. We appreciate your business!</div>
    </body></html>`;
  };

  const printBill = (r: Repair) => {
    const veh = vehicles.find(v => v.id === r.vehicle_id);
    logAction("PRINT", "Repair Bill", r.id, { vehicle: veh ? `${veh.year} ${veh.make} ${veh.model}` : r.vehicle_id });
    const html = getBillHTML(r);
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  };

  const printJobCard = (r: Repair) => {
    const veh = vehicles.find(v => v.id === r.vehicle_id);
    logAction("PRINT", "Job Card", r.id, { vehicle: veh ? `${veh.year} ${veh.make} ${veh.model}` : r.vehicle_id });
    const html = getJobCardHTML(r);
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  };

  const printRepairPaymentReceipt = (payment: RepairPayment, repair: Repair) => {
    const cust = customers.find(c => c.id === repair.customer_id);
    const paymentsSoFar = repairPayments.filter(p => new Date(p.payment_date).getTime() <= new Date(payment.payment_date).getTime());
    const totalPaidToDate = paymentsSoFar.reduce((sum, p) => sum + Number(p.amount), 0);
    const vehicleLabel = getVehicleLabel(repair).toUpperCase();
    const totalCost = Number(repair.repair_cost) || 0;
    const balanceRemaining = totalCost - totalPaidToDate;
    
    // Ordinal label logic
    const paymentIndex = repairPayments.findIndex(p => p.id === payment.id);
    let ordinalLabel = "Payment Receipt";
    if (paymentIndex === 0) ordinalLabel = "Deposit Receipt";
    else if (totalPaidToDate >= totalCost) ordinalLabel = "Full Payment Receipt";
    else {
      const ordinals = ["1st", "2nd", "3rd", "4th", "5th"];
      ordinalLabel = `${ordinals[paymentIndex] || (paymentIndex + 1) + 'th'} Payment Receipt`;
    }

    const html = `<html><head><title>${ordinalLabel} - ${repair.job_card_no}</title>
    <style>
      @page { margin: 0; size: auto; }
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap');
      body { font-family: 'Roboto', 'Arial', sans-serif; padding: 15px; max-width: 800px; margin: 0 auto; color: #1a1a1a; line-height: 1.3; }
      .date-section { text-align: right; font-weight: 800; font-size: 13px; margin-bottom: 15px; text-transform: uppercase; }
      .bill-to { margin-bottom: 20px; }
      .bill-to p { margin: 2px 0; font-size: 13px; }
      .main-container {
        background-color: transparent;
        border-radius: 40px;
        padding: 20px;
        position: relative;
        border: none;
      }
      .content-wrapper { position: relative; z-index: 1; }
      .bill-title { text-align: center; text-decoration: underline; font-weight: 900; font-size: 20px; margin-bottom: 20px; color: #1e293b; text-transform: uppercase; }
      
      table { width: 100%; border-collapse: collapse; background: transparent; margin-bottom: 20px; }
      th, td { border: 1px solid #475569; padding: 8px 10px; text-align: left; font-size: 13px; font-weight: 600; }
      th { background: transparent; text-transform: uppercase; }
      
      .summary-box { border: 2.5px solid #1e293b; padding: 20px; border-radius: 15px; margin-top: 30px; background: rgba(0,0,0,0.02); }
      .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: 700; font-size: 14px; }
      .balance-row { font-size: 20px; color: #d32f2f; border-top: 2px solid #1e293b; padding-top: 12px; margin-top: 12px; }
      
      .amount-words { font-weight: 900; margin-bottom: 20px; font-size: 14px; text-transform: uppercase; }
      .footer-sign { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; }
      .sign-box { text-align: center; border-top: 2px solid #000; padding-top: 10px; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    </style></head><body>
    ${getPrintHeaderHTML('')}
    
    <div class="date-section">DATE: ${new Date(payment.payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>

    <div class="bill-to">
      <p style="font-weight: 900;">BILL TO:</p>
      <p><strong>${cust?.name || 'Cash Customer'}</strong></p>
      <p>Tel: ${cust?.phone || repair.registration_no || ''}</p>
      <p>Vehicle: <strong>${vehicleLabel}</strong></p>
      <p>Job Card No: <strong>${repair.job_card_no || '—'}</strong></p>
    </div>

    <div class="main-container">
      ${getPrintWatermarkHTML('')}
      <div class="content-wrapper">
        <h2 class="bill-title">${ordinalLabel}</h2>
        
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>SERVICE DESCRIPTION</th>
              <th style="width: 60px; text-align: center;">QTY</th>
              <th style="width: 120px;">UNIT PRICE</th>
              <th style="width: 120px; text-align: right;">AMOUNT (₦)</th>
            </tr>
          </thead>
          <tbody>
            ${repair.replacement_parts_list && (repair.replacement_parts_list as any).length > 0 ? (repair.replacement_parts_list as any).map((p: any, idx: number) => `
              <tr>
                <td>${idx + 1}.</td>
                <td>${p.name.toUpperCase()}</td>
                <td style="text-align: center;">1</td>
                <td>₦${(Number(p.price) || 0).toLocaleString()}</td>
                <td style="text-align: right;">₦${(Number(p.price) || 0).toLocaleString()}</td>
              </tr>
            `).join('') : `
              <tr>
                <td>1.</td>
                <td>PARTS & MATERIALS</td>
                <td style="text-align: center;">1</td>
                <td>₦${(Number(repair.parts_total) || 0).toLocaleString()}</td>
                <td style="text-align: right;">₦${(Number(repair.parts_total) || 0).toLocaleString()}</td>
              </tr>
            `}
            <tr>
              <td>${repair.replacement_parts_list && (repair.replacement_parts_list as any).length > 0 ? (repair.replacement_parts_list as any).length + 1 : 2}.</td>
              <td>LABOUR CHARGES</td>
              <td style="text-align: center;">1</td>
              <td>₦${(Number(repair.labour_total) || 0).toLocaleString()}</td>
              <td style="text-align: right;">₦${(Number(repair.labour_total) || 0).toLocaleString()}</td>
            </tr>
            ${Number(repair.other_charges) > 0 ? `
            <tr>
              <td>${repair.replacement_parts_list && (repair.replacement_parts_list as any).length > 0 ? (repair.replacement_parts_list as any).length + 2 : 3}.</td>
              <td>OTHER SERVICES / CHARGES</td>
              <td style="text-align: center;">1</td>
              <td>₦${(Number(repair.other_charges) || 0).toLocaleString()}</td>
              <td style="text-align: right;">₦${(Number(repair.other_charges) || 0).toLocaleString()}</td>
            </tr>` : ''}
            ${Number(repair.vat) > 0 ? `
            <tr>
              <td>${(repair.replacement_parts_list && (repair.replacement_parts_list as any).length > 0 ? (repair.replacement_parts_list as any).length : 2) + (Number(repair.other_charges) > 0 ? 2 : 1)}</td>
              <td>VAT / TAX</td>
              <td style="text-align: center;"></td>
              <td>₦${(Number(repair.vat) || 0).toLocaleString()}</td>
              <td style="text-align: right;">₦${(Number(repair.vat) || 0).toLocaleString()}</td>
            </tr>` : ''}
            <tr class="total-row">
              <td colspan="3" style="border: none;"></td>
              <td style="text-align: right;">GRAND TOTAL</td>
              <td style="text-align: right;">₦${totalCost.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div class="summary-box">
          <div class="summary-row">
            <span>TOTAL REPAIR COST:</span>
            <span>₦${totalCost.toLocaleString()}</span>
          </div>
          <div class="summary-row" style="opacity: 0.7;">
            <span>PREVIOUS PAYMENTS:</span>
            <span>₦${(totalPaidToDate - Number(payment.amount)).toLocaleString()}</span>
          </div>
          <div class="summary-row" style="color: #16a34a;">
            <span>CURRENT PAYMENT:</span>
            <span>₦${Number(payment.amount).toLocaleString()}</span>
          </div>
          <div class="summary-row balance-row">
            <span>BALANCE REMAINING:</span>
            <span>${balanceRemaining <= 0 ? 'FULLY PAID' : `₦${balanceRemaining.toLocaleString()}`}</span>
          </div>
        </div>
        
        <div class="amount-words" style="margin-top: 25px;">
          AMOUNT IN WORDS (CURRENT): ${numberToWords(Number(payment.amount))}
        </div>

        <div class="footer-sign">
          <div class="sign-box">OFFICIAL SIGNATURE</div>
          <div class="sign-box">CUSTOMER SIGNATURE</div>
        </div>
        
        <div style="margin-top: 40px; text-align: center; font-size: 11px; font-style: italic; opacity: 0.6;">
          Thank you for your patronage. Please keep this receipt for your records.
        </div>
      </div>
    </div>
    </body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  };


  const downloadRepairPDF = async (r: Repair, type: 'bill' | 'jobcard') => {
    const cust = customers.find(c => c.id === r.customer_id);
    const filename = `${type}-${r.job_card_no || r.id}-${Date.now()}`;

    try {
      console.log(`Starting ${type} generation for Repair:`, r.id);
      toast.loading(`Preparing ${type} download...`, { id: "repair-dl" });

      let logoBase64 = '';
      try {
        const response = await fetch(logoAsset);
        const blob = await response.blob();
        logoBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (e) { console.error("Logo load error:", e); }

      const html = type === 'bill' ? getBillHTML(r, logoBase64) : getJobCardHTML(r, logoBase64);
      
      const iframe = document.createElement('iframe');
      iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:800px;height:2000px;border:none;visibility:hidden;";
      document.body.appendChild(iframe);
      const iDoc = iframe.contentDocument!;
      iDoc.open(); iDoc.write(html); iDoc.close();

      // Wait for images to load
      await new Promise<void>(res => {
        const imgs = Array.from(iDoc.images);
        if (imgs.length === 0) { setTimeout(res, 600); return; }
        let loaded = 0;
        const done = () => { if (++loaded >= imgs.length) setTimeout(res, 300); };
        imgs.forEach(img => {
          if (img.complete) done();
          else { img.onload = done; img.onerror = done; }
        });
        setTimeout(res, 2000); // Max wait
      });

      const contentEl = iDoc.documentElement;
      const fullHeight = contentEl.scrollHeight;
      iframe.style.height = `${fullHeight}px`;

      const { toPng } = await import("html-to-image");
      const imgData = await toPng(contentEl, { 
        pixelRatio: 2, 
        backgroundColor: "#ffffff",
        width: 800,
        height: fullHeight
      });
      
      if (!imgData || imgData.length < 100) {
        throw new Error("Failed to capture a valid image of the document.");
      }

      const { jsPDF } = await import("jspdf");
      const a4Width = 595;
      const scale = a4Width / 800;
      const pdfPageH = fullHeight * scale;
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: [a4Width, pdfPageH] });
      pdf.addImage(imgData, "PNG", 0, 0, a4Width, pdfPageH);
      
      document.body.removeChild(iframe);

      pdf.save(`${filename}.pdf`);
      const veh = vehicles.find(v => v.id === r.vehicle_id);
      const vehicleLabel = veh ? `${veh.year} ${veh.make} ${veh.model}` : r.vehicle_id;
      logAction("EXPORT", type === 'bill' ? "Repair Bill" : "Job Card", r.id, { vehicle: vehicleLabel, format: "PDF", method: "Download" });
      toast.success(`${type === 'bill' ? 'Bill' : 'Job Card'} downloaded!`, { id: "repair-dl" });
    } catch (error) {
      console.error("Download error:", error);
      toast.error(`Failed to generate ${type}`, { id: "repair-dl" });
    }
  };

  const isDuplicate = (r: Repair) => {
    const rDate = new Date(r.created_at).toDateString();
    return repairs.some(other => 
      other.id !== r.id &&
      new Date(other.created_at).getTime() < new Date(r.created_at).getTime() &&
      new Date(other.created_at).toDateString() === rDate &&
      (
        (r.customer_id && other.customer_id === r.customer_id) || 
        (r.brought_in_by && r.brought_in_by.length > 0 && other.brought_in_by === r.brought_in_by)
      ) &&
      (
        (r.vehicle_id && other.vehicle_id === r.vehicle_id) || 
        (r.manual_make && r.manual_make.length > 0 && other.manual_make === r.manual_make && other.manual_model === r.manual_model)
      )
    );
  };

  return (
    <div className="space-y-8 animate-fade-up pb-10 max-w-7xl mx-auto px-4 md:px-0">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wrench className="w-3.5 h-3.5 text-amber-400/60" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/60">Service Department</span>
          </div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-white/90">
            Repairs & Maintenance <span className="text-[10px] opacity-30 font-mono">v2.2</span>
          </h1>
          <p className="text-xs text-white/40 mt-0.5">
            Manage service logs, parts replacements, and track vehicle repair history across your fleet.
          </p>
        </div>
        {canCreate(role, "repairs", permissions) && (
          <div className="shrink-0">
            <Button onClick={() => { setEditId(null); setOpen(true); }} size="sm" className="rounded-xl transition-all font-semibold text-xs h-10 px-5 text-white" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <PlusCircle className="mr-2 h-4 w-4" /> Record Repair
            </Button>
          </div>
        )}
      </div>

      {/* ── SERVICE REMINDER BANNER ── */}
      {!reminderDismissed && serviceReminders.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-amber-500/20 bg-amber-500/10">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="font-bold text-sm text-amber-400 uppercase tracking-wider">
                Service Reminders
              </span>
              <span className="ml-1 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {serviceReminders.length}
              </span>
            </div>
            <button
              onClick={() => {
                setReminderDismissed(true);
                sessionStorage.setItem("service_reminder_dismissed", "true");
              }}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-white/5"
              title="Dismiss for this session"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-white/5">
            {serviceReminders.map((r) => (
              <div key={r.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    r.status === "overdue" ? "bg-red-500" : "bg-amber-400"
                  }`} />
                  <div>
                    <p className="font-semibold text-sm text-foreground">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.customer}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 pl-5 sm:pl-0">
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">Last serviced</p>
                    <p className="text-xs font-semibold">{r.lastDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                  </div>
                  <div className={`text-right px-3 py-1.5 rounded-xl border ${
                    r.status === "overdue"
                      ? "bg-red-500/10 border-red-500/30 text-red-400"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  }`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider">
                      {r.status === "overdue" ? "Overdue" : "Due Soon"}
                    </p>
                    <p className="text-xs font-bold">
                      {r.dueDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Dashboard */}
      {!isLoading && repairs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-4 md:gap-6 animate-fade-up">
           {/* KPI Columns */}
           <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bento-card p-5 flex flex-col justify-between">
                 <div className="p-2.5 bg-foreground/5 w-fit rounded-xl"><Wrench className="h-5 w-5 text-amber-500" /></div>
                 <div className="mt-4">
                    <h3 className="text-2xl font-bold">{stats.total}</h3>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Total Jobs</p>
                 </div>
              </div>
              <div className="bento-card p-5 flex flex-col justify-between">
                 <div className="p-2.5 bg-foreground/5 w-fit rounded-xl"><Clock className="h-5 w-5 text-sky-500" /></div>
                 <div className="mt-4">
                    <h3 className="text-2xl font-bold">{stats.active}</h3>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Active Work</p>
                 </div>
              </div>
              <div className="bento-card p-5 flex flex-col justify-between col-span-2">
                 <div className="flex justify-between items-start">
                    <div className="p-2.5 bg-foreground/5 w-fit rounded-xl"><DollarSign className="h-5 w-5 text-emerald-500" /></div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold">Revenue</span>
                 </div>
                 <div className="mt-4">
                    <h3 className="text-2xl font-bold">₦{stats.revenue.toLocaleString()}</h3>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Lifetime Service Rev.</p>
                 </div>
              </div>

              {/* Revenue Chart */}
              <div className="col-span-2 md:col-span-4 bento-card p-6 min-h-[280px]">
                 <div className="flex justify-between items-center mb-6">
                    <div>
                       <h3 className="font-bold">Service Growth</h3>
                       <p className="text-xs text-muted-foreground">Monthly revenue from repairs</p>
                    </div>
                 </div>
                 <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={monthlyHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <defs>
                             <linearGradient id="colRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.3}/><stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0}/></linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--foreground)/0.05)" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} tickFormatter={(v) => `₦${v/1000}k`} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="Revenue" stroke="hsl(38 92% 50%)" fill="url(#colRev)" strokeWidth={3} />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           {/* Side Charts */}
           <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bento-card p-5 h-full flex flex-col items-center">
                 <h3 className="font-bold self-start text-sm flex items-center gap-2 mb-4"><PieChartIcon className="h-4 w-4" /> Payment Split</h3>
                 <div className="w-full h-[200px] relative">
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                       <span className="text-xs font-bold text-muted-foreground">Pending</span>
                       <span className="text-lg font-bold">₦{stats.pending.toLocaleString()}</span>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie data={statusSplit} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                             {statusSplit.map((_, i) => <Cell key={i} fill={i === 0 ? "hsl(142 76% 36%)" : "hsl(38 92% 50%)"} stroke="none" />)}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                       </PieChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mt-4">
                    {statusSplit.map((s, i) => (
                       <div key={i} className="flex flex-col items-center p-2 rounded-xl bg-foreground/5">
                          <span className="text-[10px] text-muted-foreground font-bold">{s.name}</span>
                          <span className="font-bold">{s.value}</span>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* View Tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-foreground/5 rounded-2xl w-fit">
        <button
          onClick={() => setActiveServiceView("all")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeServiceView === "all" ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Wrench className="w-4 h-4" /> All Repairs
        </button>
        <button
          onClick={() => setActiveServiceView("service_due")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all relative ${
            activeServiceView === "service_due" ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bell className="w-4 h-4" />
          Service Due
          {serviceReminders.length > 0 && (
            <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              activeServiceView === "service_due" ? "bg-white/20 text-white" : "bg-red-500 text-white"
            }`}>
              {serviceReminders.length}
            </span>
          )}
        </button>
      </div>

      {/* ── SERVICE DUE TAB ── */}
      {activeServiceView === "service_due" && (
        <div className="space-y-4 animate-fade-up">
          {serviceReminders.length === 0 ? (
            <div className="bento-card p-12 flex flex-col items-center justify-center text-center">
              <div className="bg-emerald-500/10 p-5 rounded-full mb-4">
                <CheckCircle className="h-10 w-10 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">All clear! No services due.</h2>
              <p className="text-muted-foreground max-w-sm">
                No vehicles are overdue or coming up for service in the next 14 days.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  Showing <strong className="text-foreground">{serviceReminders.length}</strong> vehicle{serviceReminders.length !== 1 ? "s" : ""} requiring attention
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {serviceReminders.map((rem) => (
                  <div
                    key={rem.key}
                    className={`bento-card p-6 flex flex-col gap-4 border-l-4 ${
                      rem.status === "overdue" ? "border-l-red-500" : "border-l-amber-400"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl shrink-0 ${
                          rem.status === "overdue" ? "bg-red-500/10" : "bg-amber-500/10"
                        }`}>
                          <Car className={`h-5 w-5 ${
                            rem.status === "overdue" ? "text-red-400" : "text-amber-400"
                          }`} />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground">{rem.label}</h3>
                          <p className="text-sm text-muted-foreground">{rem.customer}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border shrink-0 ${
                        rem.status === "overdue"
                          ? "bg-red-500/10 border-red-500/30 text-red-400"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      }`}>
                        {rem.status === "overdue" ? "⚠ Overdue" : "⏰ Due Soon"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
                      <div className="bg-background/50 rounded-xl p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Last Serviced</p>
                        <p className="text-sm font-semibold">
                          {rem.lastDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div className={`rounded-xl p-3 ${
                        rem.status === "overdue" ? "bg-red-500/5" : "bg-amber-500/5"
                      }`}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Service Due</p>
                        <p className={`text-sm font-bold ${
                          rem.status === "overdue" ? "text-red-400" : "text-amber-400"
                        }`}>
                          {rem.dueDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ALL REPAIRS TAB ── */}
      {activeServiceView === "all" && (
        <>
          {/* Search and List Section */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative group flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-amber-500 transition-colors pointer-events-none" />
              <Input 
                 placeholder="Search vehicles, customers, or companies under repair..." 
                 className="pl-12 h-14 rounded-2xl bg-card border-white/10 focus-visible:ring-amber-500 text-lg shadow-xl"
                 value={search}
                 onChange={(e) => { setSearch(e.target.value); setPage(0); }} 
              />
            </div>
        <div className="flex gap-2 sm:gap-4 shrink-0 overflow-x-auto pb-2 md:pb-0">
          <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setPage(0); }}>
            <SelectTrigger className="w-[180px] h-14 rounded-2xl bg-card border-white/10 focus-visible:ring-amber-500 text-base shadow-xl">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent className="glass-panel w-[180px] rounded-xl">
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
            <SelectTrigger className="w-[140px] h-14 rounded-2xl bg-card border-white/10 focus-visible:ring-amber-500 text-base shadow-xl">
              <SelectValue placeholder="All Weeks" />
            </SelectTrigger>
            <SelectContent className="glass-panel w-[140px] rounded-xl">
              <SelectItem value="all" className="rounded-lg">All Weeks</SelectItem>
              <SelectItem value="1" className="rounded-lg">Week 1</SelectItem>
              <SelectItem value="2" className="rounded-lg">Week 2</SelectItem>
              <SelectItem value="3" className="rounded-lg">Week 3</SelectItem>
              <SelectItem value="4" className="rounded-lg">Week 4</SelectItem>
              <SelectItem value="5" className="rounded-lg">Week 5</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[180px] h-14 rounded-2xl bg-card border-white/10 focus-visible:ring-amber-500 text-base shadow-xl whitespace-nowrap">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="glass-panel w-[180px] rounded-xl">
              <SelectItem value="all" className="rounded-lg">All Statuses</SelectItem>
              <SelectItem value="paid_in_full" className="rounded-lg">Paid in Full</SelectItem>
              <SelectItem value="deposit" className="rounded-lg">Pending / Deposit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:ml-auto z-10 flex items-center gap-2">
           <span className="text-sm font-medium text-muted-foreground bg-background/50 px-3 py-1.5 rounded-lg border border-white/5">
             {filteredRepairs.length} Results
           </span>
        </div>
      </div>


      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => <div key={n} className="h-40 rounded-3xl bg-card/40 animate-pulse border border-white/5" />)}
        </div>
      ) : filteredRepairs.length === 0 ? (
        <div className="bento-card p-12 flex flex-col items-center justify-center text-center">
          <div className="bg-amber-500/10 p-5 rounded-full mb-4">
            <Search className="h-10 w-10 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">No results found.</h2>
          <p className="text-muted-foreground max-w-sm mb-6">We couldn't find any repairs matching your current search or filter criteria. Try adjusting them.</p>
          <Button variant="outline" onClick={() => { setSearch(""); setStatusFilter("all"); setDateFilter("all"); }} className="rounded-xl border-white/10">Clear Search & Filters</Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pagedRepairs.map((r) => (
              <div key={r.id} className="bento-card p-6 flex flex-col justify-between group">
                <div>
                  <div className="flex items-start gap-4 mb-4">
                    <div className="bg-foreground/5 p-3 rounded-2xl group-hover:bg-amber-500/10 transition-colors shrink-0">
                      <Car className="h-5 w-5 text-foreground/70 group-hover:text-amber-500 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-foreground truncate group-hover:text-primary transition-colors" title={getVehicleLabel(r)}>{getVehicleLabel(r)}</h3>
                        {r.job_card_no && (
                          <span className="text-[10px] font-mono bg-foreground/10 text-foreground px-2 py-0.5 rounded-md shrink-0">
                            #{r.job_card_no}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                        {r.company && <span className="text-xs text-muted-foreground font-medium">Company: {r.company}</span>}
                        {r.brought_in_by && <span className="text-xs text-muted-foreground font-medium">Brought In By: {r.brought_in_by}</span>}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                           {r.repair_cost != null && <span className="text-sm font-semibold text-foreground bg-foreground/5 px-2 py-1 rounded-md">₦{Number(r.repair_cost).toLocaleString()}</span>}
                           <span className={`inline-flex text-[11px] font-bold uppercase px-2 py-1.5 rounded-lg border ${r.payment_status === "paid_in_full" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"}`}>
                             {paymentStatusLabel(r.payment_status)}
                           </span>
                           <span className="text-[11px] font-medium text-muted-foreground bg-foreground/5 px-2 py-1.5 rounded-lg uppercase tracking-wider">{paymentTypeLabel(r.payment_type)}</span>
                           {r.to_be_resprayed && <span className="text-[11px] font-bold uppercase px-2 py-1.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">Re-spray</span>}
                           {isDuplicate(r) && <span className="text-[11px] font-bold uppercase px-2 py-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">Duplicate</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-white/5 justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-amber-500/10 hover:text-amber-500 text-muted-foreground transition-all">
                        <Receipt className="h-3.5 w-3.5 mr-1.5" /> Bill <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass-panel border-white/10 rounded-xl p-1">
                      <DropdownMenuItem onClick={() => printBill(r)} className="rounded-lg cursor-pointer gap-2">
                        <Printer className="h-4 w-4 text-amber-500" /> Print Bill
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => downloadRepairPDF(r, 'bill')} className="rounded-lg cursor-pointer gap-2">
                        <Download className="h-4 w-4 text-amber-500" /> Save as PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500 text-muted-foreground transition-all">
                        <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" /> Job Card <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass-panel border-white/10 rounded-xl p-1">
                      <DropdownMenuItem onClick={() => printJobCard(r)} className="rounded-lg cursor-pointer gap-2">
                        <Printer className="h-4 w-4 text-emerald-500" /> Print Job Card
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => downloadRepairPDF(r, 'jobcard')} className="rounded-lg cursor-pointer gap-2">
                        <Download className="h-4 w-4 text-emerald-500" /> Save as PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {hasEdit && (
                    <>
                      <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-foreground/10 hover:text-foreground text-muted-foreground transition-all" onClick={() => openEdit(r)}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all" onClick={() => { if(window.confirm("Are you sure?")) deleteMut.mutate(r.id) }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-sky-500/10 text-muted-foreground hover:text-sky-500 transition-all" title="View Preview" onClick={() => setPreviewRepair(r)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-amber-500/10 hover:text-amber-500 text-muted-foreground transition-all" onClick={() => setQrId(r.id)}>
                    <QrCode className="h-3.5 w-3.5 mr-1.5" /> QR Sign
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-indigo-500/10 hover:text-indigo-500 text-muted-foreground transition-all" onClick={() => openHistory(r, 'customer')}>
                    <HistoryIcon className="h-3.5 w-3.5 mr-1.5" /> Cust. History
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground transition-all" onClick={() => openHistory(r, 'vehicle')}>
                    <HistoryIcon className="h-3.5 w-3.5 mr-1.5" /> Car History
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 transition-all" 
                    title="Payments & Deposits"
                    onClick={() => setPaymentRepairId(r.id)}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="glass-panel p-6 rounded-3xl border border-white/5">
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
      </>
      )}

      {/* Payment History Dialog */}
      <Dialog open={!!paymentRepairId} onOpenChange={(v) => !v && setPaymentRepairId(null)}>
        <DialogContent className="max-w-2xl w-[95vw] sm:w-full rounded-3xl glass-panel border-white/10 p-0 overflow-hidden bg-background/95 backdrop-blur-3xl" hideClose>
          <div className="p-6 border-b border-white/5 bg-foreground/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <DialogHeader className="flex-row items-center gap-3 space-y-0">
              <BackButton onBack={() => setPaymentRepairId(null)} className="relative z-10" />
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-500" /> Payment History & Balance
              </DialogTitle>
            </DialogHeader>
            {paymentRepairId && (() => {
              const repair = repairs.find(r => r.id === paymentRepairId);
              const totalPaid = repairPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
              const balance = (Number(repair?.repair_cost) || 0) - totalPaid;
              return (
                <div className="text-left sm:text-right shrink-0">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total Balance Due</p>
                  <p className={`text-xl font-black ${balance <= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                    ₦{balance.toLocaleString()}
                  </p>
                </div>
              );
            })()}
          </div>
          
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {paymentRepairId && (
              <>
                {/* Stats Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-background/50 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Repair Cost</p>
                    <p className="text-xl font-black">₦{(Number(repairs.find(r => r.id === paymentRepairId)?.repair_cost) || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-1">Total Amount Paid</p>
                    <p className="text-xl font-black text-emerald-500">₦{repairPayments.reduce((sum, p) => sum + Number(p.amount), 0).toLocaleString()}</p>
                  </div>
                </div>

                {/* Record New Payment */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <PlusCircle className="w-3.5 h-3.5" /> Record New Payment
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Amount</Label>
                      <CurrencyInput 
                        className="rounded-xl h-11 bg-background/50 border-white/10 font-bold text-emerald-600" 
                        placeholder="0.00"
                        value={newPaymentAmount}
                        onChange={(e) => setNewPaymentAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Payment Method</Label>
                      <Select value={newPaymentMethod} onValueChange={setNewPaymentMethod}>
                        <SelectTrigger className="h-11 rounded-xl bg-background/50 border-white/10 font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent className="glass-panel border-white/10 rounded-xl">
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="transfer">Bank Transfer</SelectItem>
                          <SelectItem value="pos">POS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Notes (Optional)</Label>
                      <Input 
                        className="rounded-xl h-11 bg-background/50 border-white/10" 
                        placeholder="e.g. 2nd installment, final balance..."
                        value={newPaymentNote}
                        onChange={(e) => setNewPaymentNote(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button 
                    className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black h-12 shadow-lg shadow-emerald-500/20 uppercase tracking-widest text-xs"
                    onClick={() => addRepairPaymentMutation.mutate()}
                    disabled={addRepairPaymentMutation.isPending || !newPaymentAmount || parseFloat(newPaymentAmount) <= 0}
                  >
                    {addRepairPaymentMutation.isPending ? "Recording Payment..." : "Record Payment"}
                  </Button>
                </div>

                {/* Payments History List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <HistoryIcon className="w-3.5 h-3.5" /> Payment History
                  </h4>
                  
                  {/* Desktop Table View */}
                  <div className="hidden md:block rounded-2xl border border-white/5 overflow-hidden bg-background/40">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-foreground/5 text-muted-foreground font-bold uppercase text-[9px] tracking-[0.1em] border-b border-white/5">
                          <th className="px-4 py-3 text-left w-16">#</th>
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-left">Method</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {repairPayments.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground italic">No payments recorded yet.</td>
                          </tr>
                        ) : (
                          [...repairPayments].reverse().map((p, idx) => {
                            const currentRepair = repairs.find(r => r.id === paymentRepairId);
                            const totalPaidUpToThis = repairPayments
                              .filter(px => new Date(px.payment_date).getTime() <= new Date(p.payment_date).getTime())
                              .reduce((sum, px) => sum + Number(px.amount), 0);
                            const totalCost = Number(currentRepair?.repair_cost) || 0;
                            
                            const isFirst = repairPayments.indexOf(p) === 0;
                            const isFull = totalPaidUpToThis >= totalCost;
                            const ordinalLabels = ["1st", "2nd", "3rd", "4th", "5th"];
                            const paymentIdx = repairPayments.indexOf(p);
                            const label = isFull ? "Full" : isFirst ? "Deposit" : ordinalLabels[paymentIdx] || `${paymentIdx + 1}th`;

                            return (
                              <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="px-4 py-4">
                                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md border ${
                                    isFull ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                                    isFirst ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                                    'bg-sky-500/10 text-sky-500 border-sky-500/20'
                                  }`}>
                                    {label}
                                  </span>
                                </td>
                                <td className="px-4 py-4 font-medium text-foreground/80">
                                  {new Date(p.payment_date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="px-4 py-4">
                                  <span className="uppercase text-[10px] font-bold opacity-60">{p.payment_method}</span>
                                  {p.notes && <p className="text-[10px] text-muted-foreground italic truncate max-w-[120px]">{p.notes}</p>}
                                </td>
                                <td className="px-4 py-4 text-right font-black text-foreground">
                                  ₦{Number(p.amount).toLocaleString()}
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 w-8 rounded-lg hover:bg-amber-500/10 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => printRepairPaymentReceipt(p, currentRepair!)}
                                    title="Print Receipt"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Mobile Card List View */}
                  <div className="md:hidden space-y-3">
                    {repairPayments.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground italic rounded-2xl border border-white/5 bg-background/40">
                        No payments recorded yet.
                      </div>
                    ) : (
                      [...repairPayments].reverse().map((p, idx) => {
                        const currentRepair = repairs.find(r => r.id === paymentRepairId);
                        const totalPaidUpToThis = repairPayments
                          .filter(px => new Date(px.payment_date).getTime() <= new Date(p.payment_date).getTime())
                          .reduce((sum, px) => sum + Number(px.amount), 0);
                        const totalCost = Number(currentRepair?.repair_cost) || 0;
                        
                        const isFirst = repairPayments.indexOf(p) === 0;
                        const isFull = totalPaidUpToThis >= totalCost;
                        const ordinalLabels = ["1st", "2nd", "3rd", "4th", "5th"];
                        const paymentIdx = repairPayments.indexOf(p);
                        const label = isFull ? "Full" : isFirst ? "Deposit" : ordinalLabels[paymentIdx] || `${paymentIdx + 1}th`;

                        return (
                          <div key={p.id} className="p-4 rounded-2xl border border-white/5 bg-background/30 flex flex-col gap-3 shadow-inner">
                            <div className="flex items-center justify-between">
                              <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md border ${
                                isFull ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                                isFirst ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                                'bg-sky-500/10 text-sky-500 border-sky-500/20'
                              }`}>
                                {label}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-semibold">
                                {new Date(p.payment_date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <span className="uppercase text-[10px] font-bold opacity-60 bg-white/5 px-2 py-0.5 rounded">{p.payment_method}</span>
                                {p.notes && <p className="text-[11px] text-muted-foreground italic mt-1 truncate">{p.notes}</p>}
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="font-black text-foreground text-sm">
                                  ₦{Number(p.amount).toLocaleString()}
                                </span>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg hover:bg-amber-500/10 text-amber-500"
                                  onClick={() => printRepairPaymentReceipt(p, currentRepair!)}
                                  title="Print Receipt"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Dialog */}
      <QrSignDialog open={!!qrId} onOpenChange={() => setQrId(null)} type="repair" id={qrId} />

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl glass-panel shadow-2xl border-white/10 p-0 bg-background/95 backdrop-blur-3xl" hideClose>
          <div className="p-4 sm:p-6 border-b border-white/5 bg-foreground/5 sticky top-0 z-50 backdrop-blur-md flex items-center gap-3">
             <BackButton onBack={closeDialog} className="relative z-10" />
             <DialogHeader className="text-left">
               <DialogTitle className="text-xl font-bold flex items-center gap-2">
                 <Wrench className="w-5 h-5 text-amber-500" />
                 {editId ? "Edit Job Card" : "New Job Card Intake"}
               </DialogTitle>
             </DialogHeader>
             {!editId && (
               <Button 
                 type="button" 
                 variant="ghost" 
                 size="sm" 
                 onClick={() => {
                   setForm(emptyForm);
                   toast.info("Form cleared");
                 }}
                 className="ml-auto flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl px-4"
               >
                 <RotateCcw className="w-3 h-3" />
                 Clear Form
               </Button>
             )}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(); }} className="p-0">
            <div className="p-6 space-y-10">
              
              {/* SECTION 1: GENERAL INFO */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] font-bold">1</span>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/70">General Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-tight opacity-60">Job Card No.</Label>
                    <Input className="rounded-xl h-11 bg-background/50 border-white/10" value={form.job_card_no} onChange={(e) => setForm(prev => ({ ...prev, job_card_no: e.target.value }))} placeholder="e.g. JC-2024-001" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-tight opacity-60">Expected Delivery</Label>
                    <Input type="date" className="rounded-xl h-11 bg-background/50 border-white/10" value={form.expected_delivery_date} onChange={(e) => setForm(prev => ({ ...prev, expected_delivery_date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-tight opacity-60">Service Supervisor</Label>
                    <Input className="rounded-xl h-11 bg-background/50 border-white/10" value={form.service_supervisor} onChange={(e) => setForm(prev => ({ ...prev, service_supervisor: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-tight opacity-60">Technician Assigned</Label>
                    <Input className="rounded-xl h-11 bg-background/50 border-white/10" value={form.technician_assigned} onChange={(e) => setForm(prev => ({ ...prev, technician_assigned: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* SECTION 2: CUSTOMER / VEHICLE */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] font-bold">2</span>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/70">Customer & Vehicle Details</h3>
                  </div>
                  {form.vehicle_id && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-[10px] font-bold uppercase text-indigo-500 hover:text-indigo-600 hover:bg-indigo-500/5"
                      onClick={() => {
                        const veh = repairs.find(r => r.vehicle_id === form.vehicle_id);
                        if (veh) openHistory(veh, 'vehicle');
                        else toast.error("No history found for this vehicle");
                      }}
                    >
                      <HistoryIcon className="w-3.5 h-3.5 mr-1.5" /> View Vehicle History
                    </Button>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase tracking-tight opacity-60">Customer Selection</Label>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-[10px] font-bold uppercase text-amber-500 hover:text-amber-600 hover:bg-amber-500/5"
                        onClick={() => setForm(prev => ({ 
                          ...prev, 
                          is_new_customer: !prev.is_new_customer,
                          customer_id: !prev.is_new_customer ? "" : prev.customer_id 
                        }))}
                      >
                        {form.is_new_customer ? "Select Existing" : "+ New Customer"}
                      </Button>
                    </div>
 
                    {!form.is_new_customer ? (
                      <CustomerSelect 
                        customers={customers}
                        value={form.customer_id}
                        onValueChange={(v) => {
                          setForm(prev => ({ ...prev, customer_id: v, is_new_customer: false }));
                          setOpenCustomerSelect(false);
                        }}
                        onAddNew={() => setForm(prev => ({ ...prev, is_new_customer: true, customer_id: "" }))}
                        placeholder="Search customers..."
                      />
                    ) : (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold">Phone Number</Label>
                            <Input 
                              placeholder="080..." 
                              className="rounded-xl h-11 bg-background/50 border-white/10"
                              value={form.manual_customer_phone}
                              onChange={(e) => setForm(prev => ({ ...prev, manual_customer_phone: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold">Email (Optional)</Label>
                            <Input 
                              placeholder="email@example.com" 
                              className="rounded-xl h-11 bg-background/50 border-white/10"
                              value={form.manual_customer_email}
                              onChange={(e) => setForm(prev => ({ ...prev, manual_customer_email: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold">Address (Optional)</Label>
                          <Input 
                            placeholder="Home or Office address" 
                            className="rounded-xl h-11 bg-background/50 border-white/10"
                            value={form.manual_customer_address}
                            onChange={(e) => setForm(prev => ({ ...prev, manual_customer_address: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-tight opacity-60">Company Name (If applicable)</Label>
                      <Input className="rounded-xl h-11 bg-background/50 border-white/10" value={form.company} onChange={(e) => setForm(prev => ({ ...prev, company: e.target.value }))} placeholder="e.g. Kconect" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-tight opacity-60">Brought In By</Label>
                      <Input className="rounded-xl h-11 bg-background/50 border-white/10" value={form.brought_in_by} onChange={(e) => setForm(prev => ({ ...prev, brought_in_by: e.target.value }))} placeholder="e.g. Sammy" />
                    </div>
                  </div>

                  <div className="bg-foreground/5 p-5 rounded-2xl space-y-4">
                    <Label className="text-[10px] font-bold uppercase tracking-tight opacity-60">Vehicle Selection</Label>
                    <VehicleMakeModelSelector
                      make={form.make}
                      model={form.model}
                      year={form.year}
                      onMakeChange={(v) => setForm(prev => ({ ...prev, make: v, vehicle_id: "" }))}
                      onModelChange={(v) => setForm(prev => ({ ...prev, model: v, vehicle_id: "" }))}
                      onYearChange={(v) => setForm(prev => ({ ...prev, year: v, vehicle_id: "" }))}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold">Color</Label>
                        <Input value={form.color} onChange={(e) => setForm(prev => ({ ...prev, color: e.target.value }))} placeholder="Color" className="h-9 text-xs rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold">Reg No.</Label>
                        <Input value={form.registration_no} onChange={(e) => setForm(prev => ({ ...prev, registration_no: e.target.value }))} placeholder="ABC-123" className="h-9 text-xs rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold">VIN/Chassis</Label>
                        <Input value={form.vin} onChange={(e) => setForm(prev => ({ ...prev, vin: e.target.value.toUpperCase() }))} placeholder="VIN" className="h-9 text-xs rounded-lg uppercase" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold">Mileage (KM)</Label>
                        <Input value={form.mileage} onChange={(e) => setForm(prev => ({ ...prev, mileage: e.target.value }))} placeholder="0.00" className="h-9 text-xs rounded-lg" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold uppercase opacity-60">Fuel Level</Label>
                    <div className="flex flex-wrap gap-2">
                      {['Empty', '1/4', '1/2', '3/4', 'Full'].map((lvl) => (
                        <Button 
                          key={lvl} 
                          type="button"
                          variant="ghost" 
                          size="sm"
                          className={`rounded-full px-4 border text-[10px] uppercase font-bold transition-all ${form.fuel_level === lvl ? 'bg-amber-500 border-amber-500 text-white shadow-lg' : 'border-white/10 opacity-70 hover:opacity-100'}`}
                          onClick={() => setForm(prev => ({ ...prev, fuel_level: lvl }))}
                        >
                          {lvl}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

                {/* SECTION 3 & 4: COMPLAINT & SERVICE REQUIREMENTS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-white/5">
                {/* Column 1: Entry Inspection */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] font-bold">3</span>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/70">Entry Inspection</h3>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-[10px] font-extrabold uppercase opacity-60">Customer Complaint</Label>
                    <Textarea value={form.customer_complaint} onChange={(e) => setForm(prev => ({ ...prev, customer_complaint: e.target.value }))} className="rounded-xl min-h-[100px] text-xs bg-background/30" placeholder="Explain nature of fault..." />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-extrabold uppercase opacity-60">Condition Check (Arrival)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {['Scratches', 'Broken Lights', 'Interior Damage', 'Engine Noise', 'Warning Lights', 'Electrical Fault', 'AC Fault'].map((c) => (
                        <div key={c} className="flex items-center space-x-2 bg-foreground/5 p-2 rounded-lg border border-white/5">
                          <Checkbox 
                            id={`cond-${c}`} 
                            checked={form.condition_check?.includes(c)} 
                            onCheckedChange={(checked) => {
                              setForm(prev => {
                                const newCheck = checked 
                                  ? [...(prev.condition_check || []), c] 
                                  : (prev.condition_check || []).filter(x => x !== c);
                                return { ...prev, condition_check: newCheck };
                              });
                            }}
                          />
                          <Label htmlFor={`cond-${c}`} className="text-[9px] font-bold opacity-70 leading-none cursor-pointer">{c}</Label>
                        </div>
                      ))}
                    </div>
                    <Textarea value={form.inspection_notes} onChange={(e) => setForm(prev => ({ ...prev, inspection_notes: e.target.value }))} className="rounded-xl min-h-[60px] text-xs mt-2 bg-background/30" placeholder="Additional inspection notes..." />
                  </div>
                </div>

                {/* Column 2: Service Requirements */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] font-bold">4</span>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/70">Service Requirements</h3>
                  </div>

                  {/* Painting & Bodywork */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-amber-500/70">
                      <Label className="text-[10px] font-extrabold uppercase">Painting & Bodywork</Label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {['Buffing / Polishing', 'Full Respray', 'Panel Beating', 'Accident Repair', 'Chassis Alignment', 'Plastic Repair', 'Wheel Refurbishment'].map((p) => (
                        <div key={p} className="flex items-center space-x-2 bg-foreground/5 p-2 rounded-lg border border-white/5">
                          <Checkbox 
                            id={`paint-${p}`} 
                            checked={form.painting_bodywork?.items.includes(p)} 
                            onCheckedChange={(checked) => {
                              setForm(prev => {
                                const items = checked 
                                  ? [...(prev.painting_bodywork?.items || []), p] 
                                  : (prev.painting_bodywork?.items || []).filter(x => x !== p);
                                return { ...prev, painting_bodywork: { ...prev.painting_bodywork, items } };
                              });
                            }}
                          />
                          <Label htmlFor={`paint-${p}`} className="text-[9px] font-bold opacity-70 leading-none cursor-pointer">{p}</Label>
                        </div>
                      ))}
                    </div>
                    <Textarea value={form.painting_bodywork?.details} onChange={(e) => setForm(prev => ({ ...prev, painting_bodywork: { ...prev.painting_bodywork, details: e.target.value } }))} className="rounded-xl min-h-[60px] text-xs bg-background/30" placeholder="Painting details..." />
                  </div>

                  {/* Mechanical Service */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 text-blue-500/70">
                      <Label className="text-[10px] font-extrabold uppercase">Mechanical Service</Label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {['Engine Service', 'Oil Change', 'Brake Service', 'Suspension', 'Electricals', 'AC Service', 'Diagnostics', 'Wheel Balancing'].map((m) => (
                        <div key={m} className="flex items-center space-x-2 bg-foreground/5 p-2 rounded-lg border border-white/5">
                          <Checkbox 
                            id={`mech-${m}`} 
                            checked={form.mechanical_service?.items.includes(m)} 
                            onCheckedChange={(checked) => {
                              setForm(prev => {
                                const items = checked 
                                  ? [...(prev.mechanical_service?.items || []), m] 
                                  : (prev.mechanical_service?.items || []).filter(x => x !== m);
                                return { ...prev, mechanical_service: { ...prev.mechanical_service, items } };
                              });
                            }}
                          />
                          <Label htmlFor={`mech-${m}`} className="text-[9px] font-bold opacity-70 leading-none cursor-pointer">{m}</Label>
                        </div>
                      ))}
                    </div>
                    <Textarea value={form.mechanical_service?.details} onChange={(e) => setForm(prev => ({ ...prev, mechanical_service: { ...prev.mechanical_service, details: e.target.value } }))} className="rounded-xl min-h-[60px] text-xs bg-background/30" placeholder="Mechanical details..." />
                  </div>
                </div>
              </div>

              {/* SECTION 6: COSTS */}
              <div className="space-y-6 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] font-bold">5</span>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/70">Cost Summary</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-extrabold uppercase">Replacement Parts List</Label>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-[10px] font-bold uppercase text-amber-500 hover:text-amber-600 hover:bg-amber-500/5"
                      onClick={() => setForm(prev => ({ 
                        ...prev, 
                        replacement_parts_list: [...(prev.replacement_parts_list || []), { name: "", price: 0 }] 
                      }))}
                    >
                      <PlusCircle className="mr-1 h-3 w-3" /> Add Part
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {form.replacement_parts_list && form.replacement_parts_list.length > 0 ? (
                      form.replacement_parts_list.map((part, idx) => (
                        <div key={idx} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1 duration-200">
                          <Input 
                            placeholder="Part Name / Description" 
                            className="flex-1 h-10 text-xs rounded-xl bg-background/50 border-white/10 focus:border-amber-500/50" 
                            value={part.name} 
                            onChange={(e) => {
                              setForm(prev => {
                                const newList = [...(prev.replacement_parts_list || [])];
                                newList[idx] = { ...newList[idx], name: e.target.value };
                                return { ...prev, replacement_parts_list: newList };
                              });
                            }}
                          />
                          <div className="w-36 relative">
                            <CurrencyInput 
                              placeholder="0.00" 
                              className="h-10 text-xs rounded-xl bg-background/50 border-white/10 pl-7 focus:border-amber-500/50" 
                              value={part.price} 
                              onChange={(e) => {
                                setForm(prev => {
                                  const newList = [...(prev.replacement_parts_list || [])];
                                  newList[idx] = { ...newList[idx], price: parseFloat(e.target.value.replace(/,/g, "")) || 0 };
                                  return { ...prev, replacement_parts_list: newList };
                                });
                              }}
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-30">₦</span>
                          </div>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl" 
                            onClick={() => {
                              setForm(prev => {
                                const newList = (prev.replacement_parts_list || []).filter((_, i) => i !== idx);
                                return { ...prev, replacement_parts_list: newList };
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 border border-dashed border-white/10 rounded-2xl bg-foreground/[0.02]">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No parts added yet</p>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="mt-2 h-7 text-[9px] font-bold uppercase text-amber-500 hover:bg-amber-500/5"
                          onClick={() => setForm(prev => ({ 
                            ...prev, 
                            replacement_parts_list: [...(prev.replacement_parts_list || []), { name: "", price: 0 }] 
                          }))}
                        >
                          + Click to add first part
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {/* Still keep the summary textarea but smaller, as notes */}
                  <div className="pt-2">
                    <Label className="text-[10px] font-bold uppercase opacity-60 mb-2 block">Additional Parts Notes</Label>
                    <Textarea 
                      value={form.parts_to_replace} 
                      onChange={(e) => setForm(prev => ({ ...prev, parts_to_replace: e.target.value }))} 
                      className="rounded-xl min-h-[60px] text-xs" 
                      placeholder="Any extra notes about parts..." 
                    />
                  </div>
                </div>

                {/* SECTION 5: FINANCIAL SUMMARY */}
                <div className="space-y-6 pt-6 border-t border-white/10 bg-amber-500/5 -mx-6 px-6 py-6 rounded-b-none">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] font-bold">5</span>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/70">Financial Summary</h3>
                  </div>

                  {/* Row 1: Sub-totals */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase opacity-60">Parts</Label>
                      <CurrencyInput value={form.parts_total} onChange={(e) => setForm(prev => ({ ...prev, parts_total: e.target.value }))} placeholder="0" className="h-9 text-xs rounded-lg" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase opacity-60">Labour</Label>
                      <CurrencyInput value={form.labour_total} onChange={(e) => setForm(prev => ({ ...prev, labour_total: e.target.value }))} placeholder="0" className="h-9 text-xs rounded-lg" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase opacity-60">Other</Label>
                      <CurrencyInput value={form.other_charges} onChange={(e) => setForm(prev => ({ ...prev, other_charges: e.target.value }))} placeholder="0" className="h-9 text-xs rounded-lg" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase opacity-60 text-amber-500">VAT (%)</Label>
                      <Input value={form.vat_rate} onChange={(e) => setForm(prev => ({ ...prev, vat_rate: e.target.value }))} placeholder="7.5" className="h-9 text-xs rounded-lg bg-amber-500/5 border-amber-500/20" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase opacity-40">VAT Amt</Label>
                      <CurrencyInput value={form.vat} readOnly onChange={() => {}} className="h-9 text-xs opacity-60 bg-transparent border-dashed cursor-not-allowed" />
                    </div>
                  </div>

                  {/* Row 2: Grand Total & Deposit */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                      <Label className="text-[10px] font-extrabold uppercase flex items-center justify-between text-amber-600">
                        <span>Final Quote (Grand Total)</span>
                        <span className="text-[9px] font-medium lowercase italic tracking-normal opacity-60">(Auto-calculated)</span>
                      </Label>
                      <CurrencyInput className="rounded-xl h-12 bg-white/5 border-none text-amber-600 font-black text-2xl shadow-inner opacity-80 cursor-not-allowed" placeholder="0" value={form.repair_cost} readOnly onChange={() => {}} />
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                      <Label className="text-[10px] font-extrabold uppercase text-emerald-600">Deposit Paid</Label>
                      <CurrencyInput className="rounded-xl h-12 bg-white/5 border-none text-emerald-600 font-black text-2xl shadow-inner" placeholder="0" value={form.deposit_amount} onChange={(e) => setForm(prev => ({ ...prev, deposit_amount: e.target.value }))} />
                    </div>
                  </div>

                  {/* Row 3: Bank & Payment Method */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-extrabold uppercase opacity-70 flex items-center gap-2">
                        <DollarSign className="w-3 h-3" /> Select Bank Account for Bill
                      </Label>
                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(BANK_ACCOUNTS).map(([key, acc]) => (
                          <button
                            key={key}
                            type="button"
                            className={`group relative rounded-xl border p-3 text-left transition-all duration-300 ${form.bank_account === key ? 'bg-amber-500 border-amber-500 text-white shadow-lg scale-[1.02]' : 'bg-background/50 border-white/10 hover:border-amber-500/50 hover:bg-amber-500/5'}`}
                            onClick={() => setForm(prev => ({ ...prev, bank_account: key }))}
                          >
                            <div className="flex justify-between items-center">
                              <span className={`text-[10px] font-black uppercase tracking-wider ${form.bank_account === key ? 'text-white' : 'text-foreground/80'}`}>{acc.label}</span>
                              {form.bank_account === key && <CheckCircle className="h-3 w-3 text-white" />}
                            </div>
                            <div className={`text-[9px] mt-1 ${form.bank_account === key ? 'text-white/80' : 'text-muted-foreground'}`}>
                              {acc.bank} • {acc.account}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] font-extrabold uppercase opacity-70 flex items-center gap-2">
                        <CreditCard className="w-3 h-3" /> Payment Method
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {['cash', 'transfer', 'pos'].map((type) => (
                          <button
                            key={type}
                            type="button"
                            className={`px-6 py-2 rounded-full border text-[10px] uppercase font-black transition-all duration-300 ${form.payment_type === type ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg scale-105' : 'bg-background/50 border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 text-muted-foreground'}`}
                            onClick={() => setForm(prev => ({ ...prev, payment_type: type }))}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SIG AREA */}
              <div className="space-y-6 pt-4 border-t border-white/5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-tight opacity-60">Customer Signature</Label>
                    <div className="rounded-xl border border-white/10 p-2">
                      <SignaturePad value={form.signature_data} onChange={(v) => setForm(prev => ({ ...prev, signature_data: v }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-tight opacity-60">Supervisor Signature</Label>
                    <div className="rounded-xl border border-white/10 p-2">
                      <SignaturePad value={form.rep_signature} onChange={(v) => setForm(prev => ({ ...prev, rep_signature: v }))} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 pt-4 flex justify-end gap-3 border-t border-white/5 sticky bottom-0 bg-background/95 backdrop-blur-3xl z-50">
              <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl border-white/10 hover:bg-white/5 h-11 px-8">Cancel</Button>
              <Button type="submit" disabled={upsert.isPending} className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/20 h-11 px-8 min-w-[160px]">
                {editId ? "Update Job Card" : "Finalize Intake"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto rounded-3xl glass-panel shadow-2xl border-white/10 p-0 bg-background/95 backdrop-blur-3xl" hideClose>
          <div className="p-6 border-b border-white/5 bg-foreground/5 flex items-center justify-between gap-3">
             <DialogHeader className="flex-row items-center gap-3 space-y-0">
                <BackButton onBack={() => setHistoryOpen(false)} className="relative z-10" />
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                   <HistoryIcon className="h-5 w-5 text-amber-500" />
                   {historyMode === "customer" ? `Customer History: ${historyCustomerName}` : `Vehicle History: ${historyVehicleLabel}`}
                </DialogTitle>
             </DialogHeader>
          </div>
          <div className="p-6 space-y-6">
             {historyItems.length === 0 ? (
                <div className="text-center py-10 opacity-50">No history found.</div>
             ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:left-[19px] before:w-0.5 before:bg-gradient-to-b before:from-amber-500/50 before:to-transparent before:pointer-events-none">
                   {historyItems.map((h, i) => (
                      <div key={h.id} className="relative pl-12">
                         {/* Timeline Marker */}
                         <div className={`absolute left-0 top-1 w-10 h-10 rounded-full border-4 border-background flex items-center justify-center z-10 ${i === 0 ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                            {i === 0 ? <Wrench className="h-4 w-4" /> : <div className="h-2 w-2 rounded-full bg-current" />}
                         </div>

                         <div className="bento-card p-5 group hover:border-amber-500/30 transition-all">
                            <div className="flex justify-between items-start mb-3">
                               <div>
                                  <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">{new Date(h.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                                  <h4 className="font-bold text-lg">{h.manual_make || h.vehicles?.make} {h.manual_model || h.vehicles?.model}</h4>
                               </div>
                               <div className="text-right">
                                  <p className="text-lg font-bold">₦{Number(h.repair_cost).toLocaleString()}</p>
                                  <span className={`text-[10px] items-center px-2 py-0.5 rounded-full font-bold uppercase ${h.payment_status === 'paid_in_full' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                     {h.payment_status === 'paid_in_full' ? 'Paid' : 'Pending'}
                                  </span>
                               </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mt-4 border-t border-white/5 pt-4">
                               {h.replacement_parts && (
                                  <div>
                                     <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Parts Replaced</p>
                                     <p className="line-clamp-2 text-foreground/80">{h.replacement_parts}</p>
                                  </div>
                               )}
                               {h.damaged_parts && (
                                  <div>
                                     <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Damaged Issues</p>
                                     <p className="line-clamp-2 text-foreground/80">{h.damaged_parts}</p>
                                  </div>
                               )}
                            </div>
                            
                            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-white/5">
                               <Button variant="ghost" size="sm" className="h-8 text-xs rounded-lg hover:bg-sky-500/10 hover:text-sky-500 transition-colors text-muted-foreground" onClick={() => printJobCard(h)}>
                                  <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" /> Print Job Card
                               </Button>
                               <Button variant="ghost" size="sm" className="h-8 text-xs rounded-lg group" onClick={() => { setHistoryOpen(false); openEdit(h); }}>
                                  View Details <ArrowRight className="h-3.5 w-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
                               </Button>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             )}
          </div>
          <DialogFooter className="p-6 border-t border-white/5 bg-foreground/5">
             <Button variant="outline" onClick={() => setHistoryOpen(false)} className="rounded-xl border-white/10">Close History</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Preview Dialog */}
      <Dialog open={!!previewRepair} onOpenChange={(v) => !v && setPreviewRepair(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl glass-panel shadow-2xl border-white/10 p-0 bg-white" hideClose>
          <div className="p-4 border-b flex items-center justify-between gap-3 bg-gray-50 sticky top-0 z-10">
            <BackButton onBack={() => setPreviewRepair(null)} className="relative z-10" />
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 flex-1 min-w-0">
              <Eye className="h-5 w-5 text-sky-500" />
              Job Card Preview: {previewRepair?.job_card_no}
            </h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => previewRepair && printJobCard(previewRepair)}>
                <Printer className="h-4 w-4 mr-2" /> Print
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPreviewRepair(null)}>
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="p-8 bg-white min-h-screen text-black overflow-x-hidden">
            <style dangerouslySetInnerHTML={{ __html: `
              .preview-container {
                font-family: 'Inter', sans-serif;
              }
              .preview-container .section { margin-bottom: 20px; }
              .preview-container .section-title { font-weight: bold; font-size: 12px; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
              .preview-container .sig-line { border-bottom: 1px solid #000; width: 100px; display: inline-block; margin-right: 10px; }
            `}} />
            {previewRepair && (
              <div dangerouslySetInnerHTML={{ __html: getJobCardHTML(previewRepair) }} className="preview-container" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
