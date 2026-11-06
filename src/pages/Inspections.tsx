import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { supabase } from "@/integrations/supabase/client";
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
import { SignaturePad } from "@/components/SignaturePad";
import { QrSignDialog } from "@/lib/qrHelpers";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Pencil, Trash2, PlusCircle, CheckCircle, XCircle, ClipboardCheck, Car, QrCode, Search, ArrowLeft, Check, ChevronsUpDown, UserPlus, Phone, User, Calendar, FileSignature, Eye, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { format, subMonths } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { canEdit, canCreate } from "@/lib/permissions";
import { logAction } from "@/lib/logger";
import { BackButton } from "@/components/BackButton";

type Inspection = {
  id: string;
  vehicle_id: string;
  inspector_name: string;
  condition_at_pickup: string;
  pickup_date: string;
  signature_data: string | null;
  returned_in_good_condition: boolean;
  return_condition_notes: string | null;
  return_date: string | null;
  created_at: string;
  updated_at: string;
  sent_by: string | null;
  picker_name: string | null;
  picker_phone: string | null;
  picker_date: string | null;
  picker_signature: string | null;
  vehicles?: { 
    make: string; 
    model: string; 
    year: number;
    vin?: string;
    color?: string;
    mileage?: number;
    source_company?: string;
    source_company_phone?: string;
    source_rep_name?: string;
    source_rep_phone?: string;
    accepted_by_name?: string;
    accepted_by_phone?: string;
    trim?: string;
  } | null;
};

const emptyForm = {
  vehicle_id: "",
  inspector_name: "",
  condition_at_pickup: "",
  pickup_date: new Date().toISOString().slice(0, 16),
  signature_data: "",
  returned_in_good_condition: false,
  return_condition_notes: "",
  return_date: "",
  sent_by: "",
  picker_name: "",
  picker_phone: "",
  picker_date: new Date().toISOString().slice(0, 16),
  picker_signature: "",
};

export default function Inspections() {
  const { role } = useAuth();
  const { permissions } = usePermissions();
  const hasEdit = canEdit(role, "inspections", permissions);

  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm, clearDraft] = useFormPersistence("inspection", emptyForm, !!editId, editId || undefined);
  const [qrId, setQrId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehiclePopoverOpen, setVehiclePopoverOpen] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 9;

  const { data: inspections = [], isLoading, error: queryError } = useQuery({
    queryKey: ["inspections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select("*, vehicles(make, model, year, vin, color, mileage, source_company, source_company_phone, source_rep_name, source_rep_phone, accepted_by_name, accepted_by_phone, trim)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Inspection[];
    },
  });

  const filtered = inspections.filter((i) => {
    // Monthly Filter
    if (selectedMonth !== "all") {
      const insDate = new Date(i.created_at);
      const insMonth = format(insDate, 'yyyy-MM');
      if (insMonth !== selectedMonth) return false;

      // Weekly Filter
      if (selectedWeek !== "all") {
        const dayOfMonth = insDate.getDate();
        const weekNum = Math.ceil(dayOfMonth / 7);
        if (String(weekNum) !== selectedWeek) return false;
      }
    }

    const q = search.toLowerCase();
    const vName = i.vehicles ? `${i.vehicles.make} ${i.vehicles.model}`.toLowerCase() : "";
    const inspector = i.inspector_name.toLowerCase();
    return !q || vName.includes(q) || inspector.includes(q);
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("id, make, model, year, vin").neq("inventory_type", "service").order("make");
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      const payload: any = {
        vehicle_id: form.vehicle_id,
        inspector_name: form.inspector_name,
        condition_at_pickup: form.condition_at_pickup,
        pickup_date: form.pickup_date || new Date().toISOString(),
        signature_data: form.signature_data || null,
        sent_by: form.sent_by || null,
        picker_name: form.picker_name || null,
        picker_phone: form.picker_phone || null,
        picker_date: form.picker_date || null,
        picker_signature: form.picker_signature || null,
      };
      if (editId) {
        const { error } = await supabase.from("inspections").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inspections").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
      const veh = (vehicles as any[]).find((v) => v.id === form.vehicle_id);
      const vehicleLabel = veh ? `${veh.year} ${veh.make} ${veh.model}` : form.vehicle_id;
      logAction(editId ? "UPDATE" : "CREATE", "Inspection", editId ?? undefined, {
        vehicle: vehicleLabel,
        inspector: form.inspector_name,
        pickup_date: form.pickup_date,
        returned_ok: form.returned_in_good_condition,
      });
      toast.success(`${editId ? "Inspection updated" : "Inspection added"} successfully. Please note it might take a moment to reflect across all views.`);
      setPage(0);
      clearDraft();
      setForm(emptyForm);
      setEditId(null);
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inspections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      const deleted = (inspections as any[]).find((i) => i.id === id);
      const vehicleLabel = deleted?.vehicles
        ? `${deleted.vehicles.year} ${deleted.vehicles.make} ${deleted.vehicles.model}`
        : id;
      logAction("DELETE", "Inspection", id, { vehicle: vehicleLabel, inspector: deleted?.inspector_name });
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
      toast.success("Inspection deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeDialog = () => { setOpen(false); setEditId(null); };

  const openEdit = (i: Inspection) => {
    setForm({
      vehicle_id: i.vehicle_id,
      inspector_name: i.inspector_name,
      condition_at_pickup: i.condition_at_pickup,
      pickup_date: i.pickup_date ? i.pickup_date.slice(0, 16) : "",
      signature_data: i.signature_data || "",
      returned_in_good_condition: i.returned_in_good_condition,
      return_condition_notes: i.return_condition_notes || "",
      return_date: i.return_date ? i.return_date.slice(0, 16) : "",
      sent_by: i.sent_by || "",
      picker_name: i.picker_name || "",
      picker_phone: i.picker_phone || "",
      picker_date: i.picker_date ? i.picker_date.slice(0, 16) : new Date().toISOString().slice(0, 16),
      picker_signature: i.picker_signature || "",
    });
    setEditId(i.id);
    setOpen(true);
  };

  return (
    <div className="space-y-8 animate-fade-up pb-10 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="w-3.5 h-3.5 text-rose-400/60" />
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-400/60">Quality Control</span>
          </div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-white/90">
            Inspections
          </h1>
          <p className="text-xs text-white/40 mt-0.5">
            Maintain compliance by logging vehicle handovers and returns.
          </p>
        </div>
        <div className="shrink-0">
          {canCreate(role, "inspections", permissions) && (
            <Button onClick={() => setOpen(true)} size="sm" className="rounded-xl transition-all font-semibold text-xs h-10 px-5 text-white" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Log
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-panel p-4 rounded-3xl flex flex-col sm:flex-row gap-4 items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 to-transparent pointer-events-none" />
        <div className="relative w-full group z-10">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-rose-500 transition-colors pointer-events-none" />
          <Input 
            placeholder="Search by vehicle or inspector name..." 
            value={search} 
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} 
            className="pl-10 h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-rose-500/50 transition-all font-medium text-sm w-full"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setPage(0); }}>
            <SelectTrigger className="w-[160px] h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-rose-500 text-sm">
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
            <SelectTrigger className="w-[120px] h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-rose-500 text-sm">
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
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => <div key={n} className="h-32 rounded-3xl bg-card/40 animate-pulse border border-white/5" />)}
        </div>
      ) : queryError ? (
        <div className="bento-card p-12 text-center text-destructive">
          <AlertTriangle className="h-10 w-10 mx-auto mb-4" />
          <p>Failed to load inspections. Please try again later.</p>
        </div>
      ) : inspections.length === 0 ? (
        <div className="bento-card p-12 flex flex-col items-center justify-center text-center">
             <div className="bg-rose-500/10 p-5 rounded-full mb-4">
               <ClipboardCheck className="h-10 w-10 text-rose-500" />
             </div>
             <h2 className="text-xl font-bold mb-2">No inspections recorded yet.</h2>
             <p className="text-muted-foreground max-w-sm mb-6">You will see pickup and return reports here once created.</p>
             {hasEdit && (
               <Button onClick={() => setOpen(true)} className="rounded-xl shadow-lg shadow-rose-500/20 bg-rose-500 hover:bg-rose-600 text-white">Record Inspection</Button>
             )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paged.map((i) => (
              <div key={i.id} className="bento-card p-6 flex flex-col justify-between group">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-foreground/5 p-3 rounded-2xl group-hover:bg-rose-500/10 transition-colors shrink-0">
                      <Car className="h-5 w-5 text-foreground/70 group-hover:text-rose-500 transition-colors" />
                    </div>
                    {i.signature_data && (
                      <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        Signed
                      </span>
                    )}
                  </div>
                  
                  <h3 className="font-bold text-lg text-foreground group-hover:text-rose-500 transition-colors truncate">
                    {i.vehicles ? `${i.vehicles.year} ${i.vehicles.make} ${i.vehicles.model}` : "Unknown vehicle"}
                  </h3>
                  
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <User className="w-3.5 h-3.5" /> {i.inspector_name}
                    </p>
                    {i.picker_name && (
                      <p className="text-sm text-indigo-400 font-semibold flex items-center gap-2">
                        <UserPlus className="w-3.5 h-3.5" /> Picker: {i.picker_name}
                      </p>
                    )}
                    <p className="text-sm text-foreground/60 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 opacity-60" /> {i.pickup_date ? format(new Date(i.pickup_date), "dd MMM yyyy") : "-"}
                    </p>
                  </div>
                  

                </div>

                <div className="flex gap-2 mt-6 pt-4 border-t border-white/5 justify-end">
                  <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-sky-500/10 hover:text-sky-500 text-muted-foreground transition-all" onClick={() => setViewId(i.id)}>
                    <Eye className="h-3.5 w-3.5 mr-1.5" /> View
                  </Button>
                  {hasEdit && (
                    <>
                      <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-foreground/10 hover:text-foreground text-muted-foreground transition-all" onClick={() => openEdit(i)}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground transition-all" onClick={() => setQrId(i.id)}>
                        <QrCode className="h-3.5 w-3.5 mr-1.5" /> QR Sign
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all" onClick={() => { if(window.confirm('Delete?')) deleteMut.mutate(i.id) }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
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

      {/* View Dialog */}
      <Dialog open={!!viewId} onOpenChange={() => setViewId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl glass-panel shadow-2xl border-white/10 p-0 bg-background/95 backdrop-blur-3xl">
          {(() => {
            const i = inspections.find(x => x.id === viewId);
            if (!i) return null;
            return (
              <>
                <div className="p-6 border-b border-white/5 bg-foreground/5 sticky top-0 z-50 backdrop-blur-md flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-500/10 rounded-xl">
                      <ClipboardCheck className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold">Inspection Record</DialogTitle>
                      <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">QC REPORT</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setViewId(null)} className="rounded-full">
                    <XCircle className="w-5 h-5 opacity-50 hover:opacity-100" />
                  </Button>
                </div>

                <div className="p-8 space-y-8">
                  {/* Vehicle & Inspector */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Vehicle Details</p>
                        <p className="text-xl font-black">{i.vehicles ? `${i.vehicles.year} ${i.vehicles.make} ${i.vehicles.model}` : "Unknown Vehicle"}</p>
                        {i.vehicles?.vin && <p className="text-[10px] font-mono text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded-md w-fit border border-white/5">VIN: {i.vehicles.vin}</p>}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                        <div className="space-y-0.5">
                          <p className="text-[9px] uppercase font-bold text-muted-foreground">Color</p>
                          <p className="text-sm font-semibold">{i.vehicles?.color || "—"}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[9px] uppercase font-bold text-muted-foreground">Mileage</p>
                          <p className="text-sm font-semibold">{i.vehicles?.mileage ? `${i.vehicles.mileage.toLocaleString()} KM` : "—"}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[9px] uppercase font-bold text-muted-foreground">Trim</p>
                          <p className="text-sm font-semibold">{i.vehicles?.trim || "—"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Staff / Inspector</p>
                        <p className="text-lg font-bold">{i.inspector_name}</p>
                      </div>
                      
                      <div className="p-4 rounded-2xl bg-foreground/5 border border-white/5 space-y-3">
                         <div>
                           <p className="text-[9px] uppercase font-bold text-muted-foreground">Company/Owner Source</p>
                           <p className="text-sm font-semibold">{i.vehicles?.source_company || "N/A"}</p>
                           {i.vehicles?.source_company_phone && <p className="text-[10px] text-muted-foreground">{i.vehicles.source_company_phone}</p>}
                         </div>
                         {(i.vehicles?.source_rep_name || i.vehicles?.source_rep_phone) && (
                           <div className="pt-2 border-t border-white/5">
                             <p className="text-[9px] uppercase font-bold text-muted-foreground">Official Representative</p>
                             <p className="text-xs font-medium">{i.vehicles.source_rep_name || "—"}</p>
                             {i.vehicles.source_rep_phone && <p className="text-[10px] text-muted-foreground">{i.vehicles.source_rep_phone}</p>}
                           </div>
                         )}
                         {(i.vehicles?.accepted_by_name || i.vehicles?.accepted_by_phone) && (
                           <div className="pt-2 border-t border-white/5">
                             <p className="text-[9px] uppercase font-bold text-muted-foreground">Person Who Brought It</p>
                             <p className="text-xs font-medium">{i.vehicles.accepted_by_name || "—"}</p>
                             {i.vehicles.accepted_by_phone && <p className="text-[10px] text-muted-foreground">{i.vehicles.accepted_by_phone}</p>}
                           </div>
                         )}
                      </div>
                    </div>
                  </div>

                  {/* Pickup Info */}
                  <div className="bg-foreground/5 border border-white/5 rounded-3xl p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-rose-400" />
                      <h4 className="font-bold text-sm uppercase tracking-wider">Pickup Status</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                       <div>
                         <p className="text-[10px] uppercase font-bold text-muted-foreground">Date & Time</p>
                         <p className="text-sm font-medium">{i.pickup_date ? format(new Date(i.pickup_date), "dd MMM yyyy HH:mm") : "N/A"}</p>
                       </div>
                    </div>
                    <div>
                       <p className="text-[10px] uppercase font-bold text-muted-foreground">Initial Condition Notes</p>
                       <p className="text-sm bg-background/50 p-4 rounded-xl mt-1 leading-relaxed border border-white/5">{i.condition_at_pickup}</p>
                    </div>
                    {i.signature_data && (
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Staff Signature</p>
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 w-fit">
                          <img src={i.signature_data} alt="Staff Signature" className="max-h-24 dark:invert" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Picker Info */}
                  {i.picker_name && (
                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-3xl p-6 space-y-4">
                      <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-indigo-400" />
                        <h4 className="font-bold text-sm uppercase tracking-wider text-indigo-400">Picker Information</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                         <div>
                           <p className="text-[10px] uppercase font-bold text-muted-foreground">Sent By</p>
                           <p className="text-sm font-medium">{i.sent_by || "—"}</p>
                         </div>
                         <div>
                           <p className="text-[10px] uppercase font-bold text-muted-foreground">Name of Person picking up</p>
                           <p className="text-sm font-medium">{i.picker_name}</p>
                         </div>
                         <div>
                           <p className="text-[10px] uppercase font-bold text-muted-foreground">Phone</p>
                           <p className="text-sm font-medium">{i.picker_phone || "—"}</p>
                         </div>
                         <div>
                           <p className="text-[10px] uppercase font-bold text-muted-foreground">Pickup Date</p>
                           <p className="text-sm font-medium">{i.picker_date ? format(new Date(i.picker_date), "dd MMM yyyy HH:mm") : "—"}</p>
                         </div>
                      </div>
                      {i.picker_signature && (
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Picker Signature</p>
                          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 w-fit">
                            <img src={i.picker_signature} alt="Picker Signature" className="max-h-24 dark:invert" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-white/5 bg-foreground/5 flex justify-end">
                  <Button onClick={() => setViewId(null)} className="rounded-xl px-8 bg-rose-500 hover:bg-rose-600 text-white">Close</Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* QR Dialog */}
      <QrSignDialog open={!!qrId} onOpenChange={() => setQrId(null)} type="inspection" id={qrId} />

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl glass-panel shadow-2xl border-white/10 p-0 bg-background/95 backdrop-blur-3xl">
          <div className="p-4 sm:p-6 border-b border-white/5 bg-foreground/5 sticky top-0 z-50 backdrop-blur-md flex items-center gap-3">
             <BackButton onBack={closeDialog} iconOnly title="Back" />
            <DialogHeader className="text-left">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-indigo-500" />
                {editId ? "Edit Inspection Details" : "Record New Inspection"}
              </DialogTitle>
            </DialogHeader>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(); }} className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vehicle *</Label>
              <Popover open={vehiclePopoverOpen} onOpenChange={setVehiclePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={vehiclePopoverOpen}
                    className="w-full justify-between rounded-xl h-11 bg-background/50 border-white/10 hover:bg-white/5 font-normal"
                  >
                    {form.vehicle_id
                      ? (() => {
                          const v = vehicles.find((v) => v.id === form.vehicle_id);
                          return v ? (
                            <div className="flex flex-col items-start text-left leading-tight">
                              <span className="font-semibold">{v.year} {v.make} {v.model}</span>
                              {v.vin && <span className="text-[10px] text-muted-foreground font-mono">VIN: {v.vin}</span>}
                            </div>
                          ) : "Select vehicle...";
                        })()
                      : "Select vehicle..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl glass-panel border-white/10 overflow-hidden">
                  <Command className="bg-transparent">
                    <CommandInput placeholder="Search vehicle..." className="h-11 border-none focus:ring-0" />
                    <CommandList className="max-h-[250px]">
                      <CommandEmpty>No vehicle found.</CommandEmpty>
                      <CommandGroup>
                        {vehicles.map((v) => (
                          <CommandItem
                            key={v.id}
                            value={`${v.year} ${v.make} ${v.model}`}
                            onSelect={() => {
                              setForm({ ...form, vehicle_id: v.id });
                              setVehiclePopoverOpen(false);
                            }}
                            className="flex items-center gap-2 p-3 aria-selected:bg-rose-500/10 cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "h-4 w-4 text-rose-500",
                                form.vehicle_id === v.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col leading-tight">
                                <span className="font-semibold">{v.year} {v.make} {v.model}</span>
                                {v.vin && <span className="text-[10px] text-muted-foreground font-mono">VIN: {v.vin}</span>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-1 gap-4">
               <div className="space-y-2">
                 <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pickup Date *</Label>
                 <Input type="datetime-local" className="rounded-xl h-11 bg-background/50 border-white/10 focus-visible:ring-rose-500" value={form.pickup_date} onChange={(e) => setForm({ ...form, pickup_date: e.target.value })} />
               </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Condition at Pickup *</Label>
              <Textarea className="rounded-xl min-h-[80px] bg-background/50 border-white/10 focus-visible:ring-rose-500" value={form.condition_at_pickup} onChange={(e) => setForm({ ...form, condition_at_pickup: e.target.value })} required placeholder="Enter visual or mechanical condition..." />
            </div>

            {/* Picker Information Section */}
            <div className="space-y-4 p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
               <div className="flex items-center gap-2 mb-2">
                 <UserPlus className="w-4 h-4 text-indigo-400" />
                 <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Picker Information</h4>
               </div>
               
               <div className="space-y-2">
                 <Label className="text-xs font-semibold text-muted-foreground">Who sent the person to pick up? *</Label>
                 <div className="relative">
                   <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                   <Input 
                     className="pl-9 rounded-xl h-10 bg-background/50 border-white/5" 
                     value={form.sent_by} 
                     onChange={(e) => setForm({ ...form, sent_by: e.target.value })} 
                     placeholder="e.g. Company Name or Owner"
                     required
                   />
                 </div>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <div className="space-y-2">
                   <Label className="text-xs font-semibold text-muted-foreground">Name of Person picking up the vehicle *</Label>
                   <Input 
                     className="rounded-xl h-10 bg-background/50 border-white/5" 
                     value={form.picker_name} 
                     onChange={(e) => setForm({ ...form, picker_name: e.target.value })} 
                     required
                   />
                 </div>
                 <div className="space-y-2">
                   <Label className="text-xs font-semibold text-muted-foreground">Phone Number *</Label>
                   <div className="relative">
                     <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                     <Input 
                       className="pl-9 rounded-xl h-10 bg-background/50 border-white/5" 
                       value={form.picker_phone} 
                       onChange={(e) => setForm({ ...form, picker_phone: e.target.value })} 
                       required
                     />
                   </div>
                 </div>
               </div>

               <div className="space-y-2">
                 <Label className="text-xs font-semibold text-muted-foreground">Pickup Date & Time *</Label>
                 <div className="relative">
                   <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                   <Input 
                     type="datetime-local"
                     className="pl-9 rounded-xl h-10 bg-background/50 border-white/5" 
                     value={form.picker_date} 
                     onChange={(e) => setForm({ ...form, picker_date: e.target.value })} 
                     required
                   />
                 </div>
               </div>

               <div className="space-y-2">
                 <Label className="text-xs font-semibold text-muted-foreground">Picker's Signature *</Label>
                 <div className="rounded-xl border border-white/10 bg-background/50 p-2">
                    <SignaturePad value={form.picker_signature} onChange={(v) => setForm({ ...form, picker_signature: v })} />
                 </div>
               </div>
            </div>

            <div className="space-y-4 p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10">
              <div className="flex items-center gap-2 mb-2">
                <FileSignature className="w-4 h-4 text-rose-400" />
                <h4 className="text-sm font-bold text-rose-400 uppercase tracking-wider text-xs">Staff Signature</h4>
              </div>

              <div className="rounded-xl border border-white/10 bg-background/50 p-2">
                 <SignaturePad value={form.signature_data} onChange={(v) => setForm({ ...form, signature_data: v })} />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Staff / Inspector Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    className="pl-9 rounded-xl h-10 bg-background/50 border-white/5" 
                    value={form.inspector_name} 
                    onChange={(e) => setForm({ ...form, inspector_name: e.target.value })} 
                    placeholder="Enter staff name..."
                    required
                  />
                </div>
              </div>
            </div>



            <div className="pt-4 flex justify-end gap-3 border-t border-white/5">
              <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl border-white/10 hover:bg-white/5">Cancel</Button>
              <Button type="submit" disabled={upsert.isPending} className="rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20">{editId ? "Update Log" : "Save Log"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
