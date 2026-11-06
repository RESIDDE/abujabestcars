import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/SignaturePad";
import { Printer, Download, FileText, CheckCircle2, History, Search, Calendar as CalendarIcon, ArrowLeft, Trash2, PlusCircle, Users, Car, Pencil, LayoutGrid, List, ChevronRight, CheckCircle } from "lucide-react";
import { CustomPagination } from "@/components/CustomPagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PrintHeader, PrintWatermark } from "@/components/PrintHeader";
import { PrintFooter } from "@/components/PrintFooter";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { canEdit, canCreate, canDelete } from "@/lib/permissions";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logAction } from "@/lib/logger";
import { captureDocumentElement, saveBlob, printDocument, type DocumentFormat } from "@/lib/documentExport";
import { format, subMonths } from "date-fns";

type ATS = {
  id: string;
  created_at: string;
  agreement_date: string;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  customer_id_type: string;
  vehicle_make: string;
  vehicle_year_model: string;
  vehicle_color: string;
  vehicle_engine_number: string;
  vehicle_chassis: string;
  valid_until: string;
  note: string;
  signature: string;
  rep_name?: string;
  rep_signature?: string;
  rep_signature_date?: string;
  owner_rep_name?: string;
  created_by?: string;
};

const EMPTY_FORM = {
  agreementDate: new Date().toISOString().split("T")[0],
  customerName: "",
  customerAddress: "",
  customerPhone: "",
  customerIdType: "",
  vehicleMake: "",
  vehicleYearModel: "",
  vehicleColor: "",
  vehicleEngineNumber: "",
  vehicleChassis: "",
  validUntil: "",
  note: "",
  repName: "",
  ownerRepName: "",
  repSignatureDate: new Date().toISOString().split("T")[0],
};

export default function AuthorityToSell() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { permissions } = usePermissions();
  const hasEdit = canEdit(role, "authority-to-sell", permissions);
  const hasDelete = canDelete(role, "authority-to-sell", permissions);
  const canAdd = canCreate(role, "authority-to-sell", permissions);

  const [activeTab, setActiveTab] = useState(canAdd ? "create" : "history");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [previewData, setPreviewData] = useState<any>(null);
  const documentRef = useRef<HTMLDivElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm, clearDraft] = useFormPersistence("ats", { ...EMPTY_FORM, signature: "", repSignature: "" }, !!editingId, editingId || undefined);
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const queryClient = useQueryClient();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePrint = () => {
    logAction("PRINT", "Authority to Sell", editingId ?? undefined, {
      customer: previewData?.customerName,
      vehicle: `${previewData?.vehicleMake} ${previewData?.vehicleYearModel}`.trim(),
    });
    // Added to the iPhone home screen there is no print dialog, so the
    // document is shared or downloaded as a PDF instead. See printDocument().
    const el = documentRef.current;
    printDocument(
      async () => {
        if (!el) throw new Error("No document to print");
        return captureDocumentElement(el, "pdf");
      },
      "authority-to-sell-" + new Date().toISOString().slice(0, 10)
    ).catch((err) => {
      console.error(err);
      toast.error("Could not open the print dialog");
    });
  };

  const handleDownload = async (format: DocumentFormat) => {
    const el = documentRef.current;
    if (!el) return;
    try {
      toast.loading(`Preparing ${format.toUpperCase()} download...`, { id: "doc-dl" });
      const blob = await captureDocumentElement(el, format);
      saveBlob(blob, "authority-to-sell-" + new Date().toISOString().slice(0, 10), format);
      logAction("EXPORT", "authority-to-sell", "document", { format: format.toUpperCase(), method: "Download" });
      toast.success("Download complete", { id: "doc-dl" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate document", { id: "doc-dl" });
    }
  };

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["ats-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("authority_to_sell")
        .select("*")
        .order("agreement_date", { ascending: false });
      if (error) throw error;
      return data as ATS[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await supabase
        .from("authority_to_sell")
        .upsert([payload])
        .select();
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (savedItem) => {
      queryClient.invalidateQueries({ queryKey: ["ats-history"] });
      if (savedItem?.id) setEditingId(savedItem.id);
      
      logAction(editingId ? "UPDATE" : "CREATE", "Authority to Sell", editingId ?? undefined, {
        customer: form.customerName,
        vehicle: `${form.vehicleMake} ${form.vehicleYearModel}`.trim(),
        chassis: form.vehicleChassis,
      });
      toast.success("Document saved to history");
    },
    onError: (e: any) => {
      console.error("ATS Save Error:", e);
      toast.error(`Failed to save: ${e.message || e.details || JSON.stringify(e)}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("authority_to_sell")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      const deleted = history.find((h) => h.id === id);
      logAction("DELETE", "Authority to Sell", id, {
        customer: deleted?.customer_name,
        vehicle: `${deleted?.vehicle_make ?? ""} ${deleted?.vehicle_year_model ?? ""}`.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ["ats-history"] });
      toast.success("Record deleted");
    },
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      // Monthly Filter
      if (selectedMonth !== "all") {
        const itemDate = new Date(item.created_at);
        const itemMonth = format(itemDate, 'yyyy-MM');
        if (itemMonth !== selectedMonth) return false;

        // Weekly Filter
        if (selectedWeek !== "all") {
          const dayOfMonth = itemDate.getDate();
          const weekNum = Math.ceil(dayOfMonth / 7);
          if (String(weekNum) !== selectedWeek) return false;
        }
      }

      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        item.customer_name?.toLowerCase().includes(q) ||
        item.vehicle_make?.toLowerCase().includes(q) ||
        item.vehicle_chassis?.toLowerCase().includes(q);
      return matchesSearch;
    });
  }, [history, search, selectedMonth, selectedWeek]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const pagedHistory = filteredHistory.slice(page * pageSize, (page + 1) * pageSize);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePreview = async () => {
    const payload = {
      ...(editingId ? { id: editingId } : {}),
      agreement_date: form.agreementDate || new Date().toISOString().split("T")[0],
      customer_name: form.customerName,
      customer_address: form.customerAddress,
      customer_phone: form.customerPhone,
      customer_id_type: form.customerIdType,
      vehicle_make: form.vehicleMake,
      vehicle_year_model: form.vehicleYearModel,
      vehicle_color: form.vehicleColor,
      vehicle_engine_number: form.vehicleEngineNumber,
      vehicle_chassis: form.vehicleChassis,
      valid_until: form.validUntil || null,
      note: form.note,
      signature: form.signature,
      rep_name: form.repName,
      owner_rep_name: form.ownerRepName,
      rep_signature: form.repSignature,
      rep_signature_date: form.repSignatureDate,
      created_by: user?.id,
    };
    
    try {
      await saveMutation.mutateAsync(payload);
      setPreviewData({ ...form });
      clearForm();
      setMode("preview");
    } catch (e) {
      // Error handled by mutation's onError
    }
  };

  const viewHistoryItem = (item: ATS) => {
    const itemData = {
      agreementDate: item.agreement_date || new Date().toISOString().split("T")[0],
      customerName: item.customer_name || "",
      customerAddress: item.customer_address || "",
      customerPhone: item.customer_phone || "",
      customerIdType: item.customer_id_type || "",
      vehicleMake: item.vehicle_make || "",
      vehicleYearModel: item.vehicle_year_model || "",
      vehicleColor: item.vehicle_color || "",
      vehicleEngineNumber: item.vehicle_engine_number || "",
      vehicleChassis: item.vehicle_chassis || "",
      validUntil: item.valid_until || "",
      note: item.note || "",
      repName: item.rep_name || "",
      ownerRepName: item.owner_rep_name || "",
      repSignatureDate: item.rep_signature_date || new Date().toISOString().split("T")[0],
      signature: item.signature || "",
      repSignature: item.rep_signature || "",
    };
    setPreviewData(itemData);
    setMode("preview");
  };

  const handleEdit = (item: ATS) => {
    setForm({
      agreementDate: item.agreement_date || new Date().toISOString().split("T")[0],
      customerName: item.customer_name || "",
      customerAddress: item.customer_address || "",
      customerPhone: item.customer_phone || "",
      customerIdType: item.customer_id_type || "",
      vehicleMake: item.vehicle_make || "",
      vehicleYearModel: item.vehicle_year_model || "",
      vehicleColor: item.vehicle_color || "",
      vehicleEngineNumber: item.vehicle_engine_number || "",
      vehicleChassis: item.vehicle_chassis || "",
      validUntil: item.valid_until || "",
      note: item.note || "",
      repName: item.rep_name || "",
      ownerRepName: item.owner_rep_name || "",
      repSignatureDate: item.rep_signature_date || new Date().toISOString().split("T")[0],
      signature: item.signature || "",
      repSignature: item.rep_signature || "",
    });
    setEditingId(item.id);
    setMode("edit");
    setActiveTab("create");
  };

  const clearForm = () => {
    setForm({ ...EMPTY_FORM, signature: "", repSignature: "" });
    setEditingId(null);
  };

  // ── Helper ────────────────────────────────────────────────────────────────
  const Field = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-baseline gap-2 py-0.5 border-b border-gray-200 text-xs">
      <span className="font-bold text-gray-700 whitespace-nowrap min-w-[150px]">{label}:</span>
      <span className="text-gray-900 font-medium flex-1 break-words">
        {value || <span className="text-transparent select-none">{"_".repeat(20)}</span>}
      </span>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  //  PREVIEW / PRINT MODE
  // ══════════════════════════════════════════════════════════════
  if (mode === "preview") {
    return (
      <div className="animate-fade-up max-w-4xl mx-auto pb-12 print:p-0 print:m-0">
        <style dangerouslySetInnerHTML={{ __html: `
          @media (max-width: 768px) {
            .print-document-page {
              zoom: calc(100vw / 850);
              margin: 0 auto !important;
            }
          }
          @media print {
            @page { margin: 0; size: auto; }
            html, body, #root, [class*="overflow-"], [class*="h-["] {
              height: auto !important; min-height: auto !important; max-height: none !important;
              overflow: visible !important; position: static !important;
            }
            body * { visibility: hidden; }
            .print-pages-container, .print-pages-container * { visibility: visible; }
            .print-pages-container {
              position: absolute !important; left: 0 !important; top: 0 !important;
              width: 100% !important; margin: 0 !important; padding: 0 !important; display: block !important;
            }
            .print-document-page {
            /* Content-driven height, not a hard 297mm. With "Default" margins a
               browser uses the printer's hardware margins, so the printable area
               is shorter than a full A4 page and a sheet pinned to 297mm spills a
               nearly empty second page. break-inside keeps the document whole
               when it does fit. */
              position: relative !important; width: 210mm !important;
              min-height: 0 !important; height: auto !important;
              page-break-inside: avoid !important; break-inside: avoid !important;
              margin: 0 auto !important; padding: 20mm !important;
              border: none !important; box-shadow: none !important; background: white !important;
              page-break-after: auto !important; break-after: auto !important;
            }

            /* The blanket reset above also matches the watermark, whose classes
               include "overflow-hidden" and the h-[460px] size. Stripping its
               positioning dropped the logo into the flow at the top of the sheet
               and pushed the document onto a second page, so restore it here —
               this rule comes later, so it wins on equal specificity. */
            .print-watermark {
              position: absolute !important;
              inset: 0 !important;
              height: 100% !important;
              min-height: 0 !important;
              overflow: hidden !important;
            }
            .print-watermark img {
              width: 460px !important;
              height: 460px !important;
              max-height: 460px !important;
            }
        }
        `}} />
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Button variant="outline" onClick={() => setMode("edit")} className="rounded-xl gap-2 font-medium">
            <ArrowLeft className="w-4 h-4" /> Back to Editor
          </Button>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-xl gap-2 font-medium">
                  <Download className="w-4 h-4" /> Download
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl p-1">
                <DropdownMenuItem onClick={() => handleDownload("pdf")} className="rounded-lg cursor-pointer gap-2">
                  <Download className="h-4 w-4 text-amber-500" /> Save as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("png")} className="rounded-lg cursor-pointer gap-2">
                  <Download className="h-4 w-4 text-sky-500" /> Save as PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("jpeg")} className="rounded-lg cursor-pointer gap-2">
                  <Download className="h-4 w-4 text-indigo-500" /> Save as JPEG
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handlePrint} className="rounded-xl gap-2 bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/20 font-semibold px-6">
              <Printer className="w-4 h-4" /> Print Document
            </Button>
          </div>
        </div>

        {/* Printable Document */}
        <div className="print-pages-container w-full flex justify-center overflow-x-auto custom-scrollbar">
          <div
            ref={documentRef}
            className="print-document-page bg-white text-black shadow-2xl border border-gray-200 p-8 md:p-[20mm] md:w-[210mm] md:min-h-[297mm] shrink-0"
          >
            <PrintWatermark />
          <PrintHeader />

          {/* Title */}
          <div className="text-center my-3 print:my-2">
            <h1 className="text-lg print:text-base font-black text-black uppercase tracking-widest underline underline-offset-4">
              Authority to Sell Vehicle
            </h1>
          </div>

          {/* Date */}
          <div className="flex items-baseline gap-2 mb-3 print:mb-2 border-b border-gray-300 pb-1">
            <span className="font-bold text-[13px] text-gray-800">Date:</span>
            <span className="text-[13px] font-medium flex-1 text-gray-900">
              {previewData.agreementDate
                ? new Date(previewData.agreementDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                : ""}
            </span>
          </div>

          {/* Owner's Information */}
          <section className="mb-3 print:mb-2">
            <h2 className="font-black text-[11px] uppercase tracking-wide mb-1 bg-gray-100 px-2 py-0.5 rounded text-gray-900">Owner's Information</h2>
            <div className="space-y-0.5">
              <Field label="Full Name" value={previewData.customerName} />
              <Field label="Address" value={previewData.customerAddress} />
              <Field label="Contact Number" value={previewData.customerPhone} />
              <Field label="Valid ID Type & Number" value={previewData.customerIdType} />
            </div>
          </section>

          {/* Vehicle Information */}
          <section className="mb-3 print:mb-2">
            <h2 className="font-black text-[11px] uppercase tracking-wide mb-1 bg-gray-100 px-2 py-0.5 rounded text-gray-900">Vehicle Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-x-6 print:gap-x-4">
              <Field label="Make / Brand" value={previewData.vehicleMake} />
              <Field label="Year Model" value={previewData.vehicleYearModel} />
              <Field label="Color" value={previewData.vehicleColor} />
              <Field label="Engine Number" value={previewData.vehicleEngineNumber} />
              <Field label="Chassis Number" value={previewData.vehicleChassis} />
            </div>
          </section>

          {/* Authority Given */}
          <section className="mb-3 print:mb-2">
            <h2 className="font-black text-[11px] uppercase tracking-wide mb-1 bg-gray-100 px-2 py-0.5 rounded text-gray-900">Authority Given</h2>
            <p className="text-[12px] leading-[1.75] print:leading-[1.4] text-gray-800 text-justify">
              I,{" "}
              <span className="inline-block min-w-[180px] border-b border-gray-800 text-center font-bold px-2">
                {previewData.customerName || ""}
              </span>
              {previewData.ownerRepName && (
                <>
                  {" "}
                  (Represented by{" "}
                  <span className="inline-block min-w-[140px] border-b border-gray-800 text-center font-bold px-2">
                    {previewData.ownerRepName}
                  </span>
                  )
                </>
              )}, hereby authorize <strong>Abuja Best Cars</strong> to sell the vehicle described above on my behalf. This authority includes:
              negotiating with potential buyers, accepting payment, signing necessary sale documents, and releasing the vehicle and its title documents.
            </p>
            <div className="flex items-baseline gap-2 mt-2 print:mt-1 border-b border-gray-300 pb-0.5">
              <span className="font-bold text-xs text-gray-800 whitespace-nowrap">This authority is valid until:</span>
              <span className="text-xs font-medium flex-1 text-gray-900">
                {previewData.validUntil
                  ? new Date(previewData.validUntil).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                  : ""}
              </span>
            </div>
          </section>

          {/* Note */}
          {previewData.note && (
            <section className="mb-3 print:mb-2">
              <h2 className="font-black text-[11px] uppercase tracking-wide mb-0.5 text-gray-900">Note:</h2>
              <p className="text-[12px] text-gray-800 leading-tight min-h-[20px] border-b border-gray-300 pb-1">
                {previewData.note}
              </p>
            </section>
          )}

          {/* Signatures */}
          <section className="mt-3 print:mt-2">
            <h2 className="font-black text-[11px] uppercase tracking-wide mb-2 text-gray-900">Signatures</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-12 print:gap-8">
              {/* Owner / Representative */}
              <div>
                <p className="text-[10px] font-bold text-gray-600 mb-0.5">Owner / Representative Signature:</p>
                <div className="h-12 border-b border-gray-800 mb-1.5 flex items-end">
                  {previewData.signature && (
                    <img src={previewData.signature} alt="Owner Signature" className="max-h-10 object-contain" style={{ filter: "brightness(0)" }} />
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-2 border-b border-gray-400 pb-0.5">
                    <span className="text-[9px] font-bold uppercase opacity-60">Owner Name:</span>
                    <span className="text-[11px] font-medium flex-1">{previewData.customerName}</span>
                  </div>
                  {previewData.ownerRepName && (
                    <div className="flex items-baseline gap-2 border-b border-gray-400 pb-0.5">
                      <span className="text-[9px] font-bold uppercase opacity-60">Rep. Full Name:</span>
                      <span className="text-[11px] font-medium flex-1">{previewData.ownerRepName}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-baseline gap-2 border-b border-gray-400 pb-0.5 mt-1.5 print:mt-1">
                  <span className="text-[9px] font-bold uppercase opacity-60">Date:</span>
                  <span className="text-[11px] font-medium flex-1">
                    {previewData.agreementDate
                      ? new Date(previewData.agreementDate).toLocaleDateString("en-GB")
                      : ""}
                  </span>
                </div>
              </div>

              {/* BEE TEE Rep */}
              <div>
                <p className="text-[10px] font-bold text-gray-600 mb-0.5">Company Representatives Signature:</p>
                <div className="h-12 border-b border-gray-800 mb-1.5 flex items-end">
                  {previewData.repSignature && (
                    <img src={previewData.repSignature} alt="Rep Signature" className="max-h-10 object-contain" style={{ filter: "brightness(0)" }} />
                  )}
                </div>
                <div className="flex items-baseline gap-2 border-b border-gray-400 pb-0.5 mb-1">
                  <span className="text-[9px] font-bold uppercase opacity-60">Company Rep:</span>
                  <span className="text-[11px] font-medium flex-1">{previewData.repName}</span>
                </div>
                <div className="flex items-baseline gap-2 border-b border-gray-400 pb-0.5">
                  <span className="text-[9px] font-bold">Date:</span>
                  <span className="text-[11px] font-medium flex-1">
                    {previewData.repSignatureDate
                      ? new Date(previewData.repSignatureDate).toLocaleDateString("en-GB")
                      : ""}
                  </span>
                </div>
              </div>
            </div>
          </section>
          <PrintFooter showSignatures={false} />
        </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  //  FORM / MANAGEMENT MODE
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="max-w-6xl mx-auto animate-fade-up pb-10 px-4 sm:px-0">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start justify-between gap-6 mb-8">
        <div className="flex items-start gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)} className="sm:hidden mt-1 h-8 w-8 rounded-full shrink-0 bg-white/5 hover:bg-white/10">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-3.5 h-3.5 text-sky-400/60" />
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-400/60">Legal Documents</span>
            </div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-white/90">Authority to Sell</h1>
            <p className="text-xs text-white/40 mt-0.5 max-w-lg">
              Create, manage, and search Abuja Best Car authorization agreements.
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card/40 border border-white/5 p-1 rounded-2xl flex flex-col md:flex-row h-auto w-full md:w-auto">
          {canAdd && (
            <TabsTrigger value="create" className="rounded-xl px-6 py-2.5 font-semibold data-[state=active]:bg-sky-500 data-[state=active]:text-white transition-all w-full md:w-auto">
              <PlusCircle className="w-4 h-4 mr-2" /> Create Document
            </TabsTrigger>
          )}
          <TabsTrigger value="history" className="rounded-xl px-6 py-2.5 font-semibold data-[state=active]:bg-sky-500 data-[state=active]:text-white transition-all w-full md:w-auto">
            <History className="w-4 h-4 mr-2" /> Agreement History
          </TabsTrigger>
        </TabsList>

        {/* ── CREATE TAB ────────────────────────────────────────────── */}
        <TabsContent value="create">
          <div className="space-y-6">
            <Card className="bento-card overflow-hidden">
              <CardHeader className="bg-sky-500/5 border-b border-white/5 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-sky-500" /> Document Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-10">

                {/* Agreement Date */}
                <div className="space-y-2 max-w-xs">
                  <Label className="text-muted-foreground text-xs font-semibold px-1">AGREEMENT DATE</Label>
                  <Input name="agreementDate" type="date" value={form.agreementDate} onChange={handleChange} className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                </div>

                <div className="h-px bg-white/5" />

                {/* Owner's Information */}
                <div className="space-y-5">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-sky-500 flex items-center gap-3">
                    <Users className="w-4 h-4" /> Owner / Representative Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">OWNER FULL NAME</Label>
                      <Input name="customerName" value={form.customerName} onChange={handleChange} placeholder="e.g. John Adeyemi" className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">REPRESENTATIVE NAME (FROM OWNER)</Label>
                      <Input name="ownerRepName" value={form.ownerRepName} onChange={handleChange} placeholder="Name of person representing the owner" className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl italic" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">ADDRESS</Label>
                      <Input name="customerAddress" value={form.customerAddress} onChange={handleChange} placeholder="Full residential address..." className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">CONTACT NUMBER</Label>
                      <Input name="customerPhone" value={form.customerPhone} onChange={handleChange} placeholder="0807..." className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">VALID ID TYPE & NUMBER</Label>
                      <Input name="customerIdType" value={form.customerIdType} onChange={handleChange} placeholder="NIN / Intl. Passport / Driver's License..." className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Vehicle Information */}
                <div className="space-y-5">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-sky-500 flex items-center gap-3">
                    <Car className="w-4 h-4" /> Vehicle Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">MAKE / BRAND</Label>
                      <Input name="vehicleMake" value={form.vehicleMake} onChange={handleChange} placeholder="e.g. Toyota" className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">YEAR MODEL</Label>
                      <Input name="vehicleYearModel" value={form.vehicleYearModel} onChange={handleChange} placeholder="e.g. Camry 2021" className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">COLOR</Label>
                      <Input name="vehicleColor" value={form.vehicleColor} onChange={handleChange} placeholder="e.g. Pearl White" className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">ENGINE NUMBER</Label>
                      <Input name="vehicleEngineNumber" value={form.vehicleEngineNumber} onChange={handleChange} placeholder="Engine No." className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">CHASSIS NUMBER</Label>
                      <Input name="vehicleChassis" value={form.vehicleChassis} onChange={handleChange} placeholder="Chassis / VIN No." className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">AUTHORITY VALID UNTIL</Label>
                      <Input name="validUntil" type="date" value={form.validUntil} onChange={handleChange} className="h-12 bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl" />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Note */}
                <div className="space-y-3">
                  <Label className="text-muted-foreground text-xs font-semibold px-1">NOTE (OPTIONAL)</Label>
                  <Textarea
                    name="note"
                    value={form.note}
                    onChange={handleChange}
                    placeholder="Any additional terms or conditions..."
                    className="bg-background/50 border-white/10 focus-visible:ring-sky-500 rounded-xl min-h-[80px]"
                  />
                </div>

                <div className="h-px bg-white/5" />
                
                {/* Signatures */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {/* Representative Signature (Left) */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-sky-500 flex items-center justify-between">
                      <span className="flex items-center gap-3">
                        <Pencil className="w-4 h-4" /> Owner / Representative Signature
                      </span>
                      {form.signature && (
                        <span className="text-[10px] text-emerald-500 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> CAPTURED
                        </span>
                      )}
                    </h3>
                    <div className="bg-card/40 p-4 rounded-2xl border border-white/5 shadow-inner">
                      <SignaturePad value={form.signature} onChange={(val) => setForm(p => ({...p, signature: val}))} />
                      <p className="text-[10px] text-muted-foreground text-center mt-3 uppercase font-bold tracking-tighter opacity-50">
                        Have the owner draw their signature above.
                      </p>
                    </div>
                  </div>

                  {/* BEE TEE Representative (Right) */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-sky-500 flex items-center justify-between">
                      <span className="flex items-center gap-3">
                        <Pencil className="w-4 h-4" /> Rep. Signature
                      </span>
                      {form.repSignature && (
                        <span className="text-[10px] text-emerald-500 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> CAPTURED
                        </span>
                      )}
                    </h3>
                    <div className="bg-card/40 p-4 rounded-2xl border border-white/5 shadow-inner">
                      <SignaturePad value={form.repSignature} onChange={(val) => setForm(p => ({...p, repSignature: val}))} />
                      <div className="grid grid-cols-1 gap-3 mt-4">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground font-bold uppercase px-1">Company Rep Name</Label>
                          <Input name="repName" value={form.repName} onChange={handleChange} placeholder="Full Name" className="h-9 text-sm bg-background/50 border-white/10 rounded-lg" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground font-bold uppercase px-1">Sign Date</Label>
                          <Input name="repSignatureDate" type="date" value={form.repSignatureDate} onChange={handleChange} className="h-9 text-sm bg-background/50 border-white/10 rounded-lg" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row justify-end gap-4 mt-6">
              <Button variant="outline" size="lg" className="rounded-2xl w-full sm:w-auto px-10 h-14 border-white/10 hover:bg-white/5 transition-all" onClick={clearForm}>
                Clear Form
              </Button>
              <Button
                size="lg"
                className="rounded-2xl w-full sm:w-auto px-12 h-14 bg-sky-500 hover:bg-sky-600 text-white shadow-xl shadow-sky-500/25 font-bold transition-all disabled:opacity-50"
                disabled={!form.customerName || !form.vehicleMake || saveMutation.isPending}
                onClick={handlePreview}
              >
                {saveMutation.isPending ? "Saving..." : "Save & Preview Document"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── HISTORY TAB ──────────────────────────────────────────── */}
        <TabsContent value="history">
          <div className="space-y-6">
            {/* Filters & View Mode Toggle */}
            <div className="glass-panel p-4 rounded-3xl flex flex-col md:flex-row gap-4 items-center justify-between relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 to-transparent pointer-events-none" />
              <div className="relative w-full md:max-w-md group z-10">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-sky-500 transition-colors pointer-events-none" />
                <Input
                  placeholder="Search by owner, vehicle, chassis..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-10 h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-sky-500/50 font-medium text-sm w-full"
                />
              </div>

              <div className="flex gap-2 shrink-0 flex-wrap sm:flex-nowrap items-center z-10 w-full md:w-auto justify-between md:justify-end">
                <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setPage(0); }}>
                  <SelectTrigger className="w-[140px] h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-sky-500 text-xs">
                    <SelectValue placeholder="Select Month" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel w-[140px] rounded-xl">
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
                  <SelectTrigger className="w-[110px] h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-sky-500 text-xs">
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

                {/* View Mode Toggle: Cards vs Table */}
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
              </div>
            </div>

            {/* Main Content Area */}
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-28 w-full rounded-2xl bg-card/40 animate-pulse border border-white/5" />)}
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="bento-card p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                <FileText className="h-12 w-12 opacity-20 mb-4 text-emerald-500" />
                <p className="font-semibold text-base mb-1">No agreements found.</p>
                <p className="text-xs text-muted-foreground mb-4">No records match your filter criteria or no agreements have been saved yet.</p>
                {(search || selectedMonth !== "all" || selectedWeek !== "all") && (
                  <Button variant="link" onClick={() => { setSearch(""); setSelectedMonth("all"); setSelectedWeek("all"); setPage(0); }} className="text-emerald-500 text-xs font-semibold">
                    Clear all filters
                  </Button>
                )}
              </div>
            ) : viewMode === "cards" ? (
              /* Split-Panel ATS Cards Modeled After Reference Design */
              <div className="space-y-4">
                {pagedHistory.map((item) => {
                  const docRef = `ATS-${item.id.slice(0, 8).toUpperCase()}`;
                  const dateStr = new Date(item.agreement_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

                  return (
                    <div 
                      key={item.id}
                      className="rounded-[22px] overflow-hidden border border-border/50 dark:border-white/10 bg-white dark:bg-[#151a26] shadow-md hover:shadow-xl transition-all flex flex-col md:flex-row group"
                    >
                      {/* Left Contrast Section: Solid dark container */}
                      <div className="w-full md:w-[32%] lg:w-[28%] bg-[#111728] dark:bg-[#0c101a] text-white p-5 md:p-6 flex flex-col justify-between shrink-0 relative">
                        <div>
                          <div className="flex items-center justify-between mb-2.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              AUTHORITY TO SELL
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 font-bold">
                              {docRef}
                            </span>
                          </div>

                          <h3 className="text-base md:text-lg font-bold text-white leading-snug tracking-tight group-hover:text-amber-400 transition-colors">
                            {item.customer_name}
                          </h3>

                          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5 truncate">
                            <Car className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate text-slate-200">{item.vehicle_make} {item.vehicle_year_model}</span>
                          </p>
                        </div>

                        {/* Bottom link modeled after "View all chapters >" */}
                        <div className="mt-5 pt-3 border-t border-white/10">
                          <div 
                            className="flex items-center justify-between text-xs text-slate-300 font-medium group/link cursor-pointer hover:text-white transition-colors"
                            onClick={() => viewHistoryItem(item)}
                            title={item.vehicle_chassis || item.customer_phone || item.customer_name}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-mono text-[11px] truncate">
                                {item.vehicle_chassis ? `Chassis: ${item.vehicle_chassis}` : "Document Record"}
                              </span>
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
                              AGREEMENT DATE • {dateStr}
                            </p>
                            <div className="flex items-center gap-3 flex-wrap">
                              <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                                {item.vehicle_make} — {item.vehicle_year_model}
                              </h2>
                              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                <CheckCircle className="w-3 h-3 text-emerald-500" />
                                Authorized for Sale
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.vehicle_color && <span>Color: {item.vehicle_color} • </span>}
                              {item.vehicle_engine_number && <span className="font-mono">Engine: {item.vehicle_engine_number}</span>}
                            </p>
                          </div>

                          {/* Progress / Status indicator matching reference */}
                          <div className="flex flex-col sm:items-end gap-1.5">
                            <div className="w-36 sm:w-44 h-2 bg-muted/60 dark:bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-500 w-full" />
                            </div>
                            <p className="text-[11px] font-semibold text-muted-foreground">
                              {item.valid_until ? `Valid Until: ${new Date(item.valid_until).toLocaleDateString()}` : "Legal Binding ATS"}
                            </p>
                          </div>
                        </div>

                        {/* Bottom Action Pill Buttons matching reference */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40 dark:border-white/5">
                          <div className="flex items-center gap-2">
                            {(hasEdit || hasDelete) && (
                              <div className="flex items-center gap-1">
                                {hasEdit && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleEdit(item)} 
                                    className="rounded-full h-9 w-9 hover:bg-muted text-muted-foreground hover:text-foreground"
                                    title="Edit Agreement"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                {hasDelete && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => deleteMutation.mutate(item.id)} 
                                    className="rounded-full h-9 w-9 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                    title="Delete Agreement"
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
                            onClick={() => viewHistoryItem(item)}
                            className="rounded-full px-6 h-9 bg-[#181d2f] hover:bg-[#252c42] dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold text-xs tracking-wide shadow-lg shadow-black/20 hover:shadow-xl transition-all active:scale-95 gap-2"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            View &amp; Print
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
                  <Table>
                    <TableHeader className="bg-foreground/5 pointer-events-none">
                      <TableRow className="border-border/50 hover:bg-transparent">
                        <TableHead className="font-semibold px-6 py-4">Date</TableHead>
                        <TableHead className="font-semibold">Owner</TableHead>
                        <TableHead className="font-semibold">Vehicle</TableHead>
                        <TableHead className="font-semibold">Chassis No.</TableHead>
                        <TableHead className="text-right font-semibold px-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedHistory.map((item) => (
                        <TableRow key={item.id} className="border-border/10 hover:bg-white/5 transition-colors group">
                          <TableCell className="px-6 py-4 font-medium text-sm">
                            {new Date(item.agreement_date).toLocaleDateString("en-GB")}
                          </TableCell>
                          <TableCell className="font-bold text-foreground">{item.customer_name}</TableCell>
                          <TableCell>
                            <span className="font-semibold text-sm">
                              {item.vehicle_make} — {item.vehicle_year_model}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">
                            {item.vehicle_chassis || "—"}
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <div className="flex justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => viewHistoryItem(item)}
                                className="h-8 rounded-lg font-bold px-3 text-xs"
                              >
                                <Printer className="w-3.5 h-3.5 mr-1.5" /> View
                              </Button>
                              {hasEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(item)}
                                  className="h-8 w-8 rounded-lg hover:bg-foreground/20"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {hasDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteMutation.mutate(item.id)}
                                  className="h-8 w-8 rounded-lg hover:bg-destructive/20 hover:text-destructive"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
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
            {filteredHistory.length > 0 && (
              <div className="pt-2">
                <CustomPagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={filteredHistory.length}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  pageSizeOptions={[5, 8, 15, 25, 50]}
                  itemLabel="agreements"
                />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
