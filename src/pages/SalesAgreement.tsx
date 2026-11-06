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
import {
  Printer, Download, FileText, CheckCircle2, History, Search,
  ArrowLeft, Trash2, PlusCircle, Users, Car, Pencil,
  LayoutGrid, List, ChevronRight, CheckCircle,
} from "lucide-react";
import { CustomPagination } from "@/components/CustomPagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PrintHeader, PrintWatermark } from "@/components/PrintHeader";
import { PrintFooter } from "@/components/PrintFooter";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { canEdit, canCreate } from "@/lib/permissions";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logAction } from "@/lib/logger";
import { captureDocumentElement, saveBlob, type DocumentFormat } from "@/lib/documentExport";
import { format, subMonths } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

type SalesAgreementRecord = {
  id: string;
  created_at: string;
  agreement_date: string;
  seller_name: string;
  seller_address: string;
  seller_phone: string;
  seller_id_type: string;
  buyer_name: string;
  buyer_address: string;
  buyer_phone: string;
  buyer_id_type: string;
  vehicle_make: string;
  vehicle_year_model: string;
  vehicle_color: string;
  vehicle_engine_number: string;
  vehicle_chassis: string;
  vehicle_plate_number: string;
  sale_price: string;
  payment_method: string;
  note: string;
  seller_signature: string;
  buyer_signature: string;
  seller_witness_name?: string;
  seller_witness_signature?: string;
  buyer_witness_name?: string;
  buyer_witness_signature?: string;
  rep_name: string;
  rep_signature: string;
  rep_signature_date: string;
  created_by?: string;
};

const EMPTY_FORM = {
  agreementDate: new Date().toISOString().split("T")[0],
  sellerName: "",
  sellerAddress: "",
  sellerPhone: "",
  sellerIdType: "",
  buyerName: "",
  buyerAddress: "",
  buyerPhone: "",
  buyerIdType: "",
  vehicleMake: "",
  vehicleYearModel: "",
  vehicleColor: "",
  vehicleEngineNumber: "",
  vehicleChassis: "",
  vehiclePlateNumber: "",
  salePrice: "",
  paymentMethod: "",
  note: "",
  sellerSignature: "",
  buyerSignature: "",
  sellerWitnessName: "",
  sellerWitnessSignature: "",
  buyerWitnessName: "",
  buyerWitnessSignature: "",
  repName: "",
  repSignature: "",
  repSignatureDate: new Date().toISOString().split("T")[0],
};

// ─── Number to Words ─────────────────────────────────────────────────────────

function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
    "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function helper(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "") + " ";
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred " + helper(n % 100);
    if (n < 1_000_000) return helper(Math.floor(n / 1000)) + "Thousand " + helper(n % 1000);
    if (n < 1_000_000_000) return helper(Math.floor(n / 1_000_000)) + "Million " + helper(n % 1_000_000);
    return helper(Math.floor(n / 1_000_000_000)) + "Billion " + helper(n % 1_000_000_000);
  }
  return helper(num).trim();
}

function formatPriceWords(priceStr: string): string {
  const cleaned = priceStr.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0) return "";
  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);
  let result = numberToWords(intPart) + " Naira";
  if (decPart > 0) result += " and " + numberToWords(decPart) + " Kobo";
  return result + " Only";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SalesAgreement() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { permissions } = usePermissions();
  const hasEdit = canEdit(role, "authority-to-sell", permissions);
  const canAdd = canCreate(role, "authority-to-sell", permissions);

  const [activeTab, setActiveTab] = useState(canAdd ? "create" : "history");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [previewData, setPreviewData] = useState<any>(null);
  const documentRef = useRef<HTMLDivElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm, clearDraft] = useFormPersistence(
    "sales-agreement",
    { ...EMPTY_FORM },
    !!editingId,
    editingId || undefined
  );
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
    logAction("PRINT", "Sales Agreement", editingId ?? undefined, {
      seller: previewData?.sellerName,
      buyer: previewData?.buyerName,
      vehicle: `${previewData?.vehicleMake} ${previewData?.vehicleYearModel}`.trim(),
    });
    window.print();
  };

  const handleDownload = async (format: DocumentFormat) => {
    const el = documentRef.current;
    if (!el) return;
    try {
      toast.loading(`Preparing ${format.toUpperCase()} download...`, { id: "doc-dl" });
      const blob = await captureDocumentElement(el, format);
      saveBlob(blob, "sales-agreement-" + new Date().toISOString().slice(0, 10), format);
      logAction("EXPORT", "sales-agreement", "document", { format: format.toUpperCase(), method: "Download" });
      toast.success("Download complete", { id: "doc-dl" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate document", { id: "doc-dl" });
    }
  };

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["sales-agreement-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_agreements" as any)
        .select("*")
        .order("agreement_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SalesAgreementRecord[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await supabase
        .from("sales_agreements" as any)
        .upsert([payload])
        .select();
      if (error) throw error;
      return (data as any)?.[0] as SalesAgreementRecord | undefined;
    },
    onSuccess: (savedItem) => {
      queryClient.invalidateQueries({ queryKey: ["sales-agreement-history"] });
      if (savedItem?.id) setEditingId(savedItem.id);
      logAction(editingId ? "UPDATE" : "CREATE", "Sales Agreement", editingId ?? undefined, {
        seller: form.sellerName,
        buyer: form.buyerName,
        vehicle: `${form.vehicleMake} ${form.vehicleYearModel}`.trim(),
        chassis: form.vehicleChassis,
      });
      toast.success("Agreement saved to history");
    },
    onError: (e: any) => {
      console.error("Sales Agreement Save Error:", e);
      toast.error(`Failed to save: ${e.message || e.details || JSON.stringify(e)}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sales_agreements" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      const deleted = history.find((h) => h.id === id);
      logAction("DELETE", "Sales Agreement", id, {
        seller: deleted?.seller_name,
        buyer: deleted?.buyer_name,
      });
      queryClient.invalidateQueries({ queryKey: ["sales-agreement-history"] });
      toast.success("Record deleted");
    },
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (selectedMonth !== "all") {
        const itemDate = new Date(item.created_at);
        const itemMonth = format(itemDate, "yyyy-MM");
        if (itemMonth !== selectedMonth) return false;
        if (selectedWeek !== "all") {
          const dayOfMonth = itemDate.getDate();
          const weekNum = Math.ceil(dayOfMonth / 7);
          if (String(weekNum) !== selectedWeek) return false;
        }
      }
      const q = search.toLowerCase();
      return (
        !q ||
        item.seller_name?.toLowerCase().includes(q) ||
        item.buyer_name?.toLowerCase().includes(q) ||
        item.vehicle_make?.toLowerCase().includes(q) ||
        item.vehicle_chassis?.toLowerCase().includes(q)
      );
    });
  }, [history, search, selectedMonth, selectedWeek]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const pagedHistory = filteredHistory.slice(page * pageSize, (page + 1) * pageSize);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePreview = async () => {
    const payload = {
      ...(editingId ? { id: editingId } : {}),
      agreement_date: form.agreementDate || new Date().toISOString().split("T")[0],
      seller_name: form.sellerName,
      seller_address: form.sellerAddress,
      seller_phone: form.sellerPhone,
      seller_id_type: form.sellerIdType,
      buyer_name: form.buyerName,
      buyer_address: form.buyerAddress,
      buyer_phone: form.buyerPhone,
      buyer_id_type: form.buyerIdType,
      vehicle_make: form.vehicleMake,
      vehicle_year_model: form.vehicleYearModel,
      vehicle_color: form.vehicleColor,
      vehicle_engine_number: form.vehicleEngineNumber,
      vehicle_chassis: form.vehicleChassis,
      vehicle_plate_number: form.vehiclePlateNumber,
      sale_price: form.salePrice,
      payment_method: form.paymentMethod,
      note: form.note,
      seller_signature: form.sellerSignature,
      buyer_signature: form.buyerSignature,
      seller_witness_name: form.sellerWitnessName,
      seller_witness_signature: form.sellerWitnessSignature,
      buyer_witness_name: form.buyerWitnessName,
      buyer_witness_signature: form.buyerWitnessSignature,
      rep_name: form.repName,
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

  const viewHistoryItem = (item: SalesAgreementRecord) => {
    setPreviewData({
      agreementDate: item.agreement_date || new Date().toISOString().split("T")[0],
      sellerName: item.seller_name || "",
      sellerAddress: item.seller_address || "",
      sellerPhone: item.seller_phone || "",
      sellerIdType: item.seller_id_type || "",
      buyerName: item.buyer_name || "",
      buyerAddress: item.buyer_address || "",
      buyerPhone: item.buyer_phone || "",
      buyerIdType: item.buyer_id_type || "",
      vehicleMake: item.vehicle_make || "",
      vehicleYearModel: item.vehicle_year_model || "",
      vehicleColor: item.vehicle_color || "",
      vehicleEngineNumber: item.vehicle_engine_number || "",
      vehicleChassis: item.vehicle_chassis || "",
      vehiclePlateNumber: item.vehicle_plate_number || "",
      salePrice: item.sale_price || "",
      paymentMethod: item.payment_method || "",
      note: item.note || "",
      sellerSignature: item.seller_signature || "",
      buyerSignature: item.buyer_signature || "",
      sellerWitnessName: item.seller_witness_name || "",
      sellerWitnessSignature: item.seller_witness_signature || "",
      buyerWitnessName: item.buyer_witness_name || "",
      buyerWitnessSignature: item.buyer_witness_signature || "",
      repName: item.rep_name || "",
      repSignature: item.rep_signature || "",
      repSignatureDate: item.rep_signature_date || new Date().toISOString().split("T")[0],
    });
    setMode("preview");
  };

  const handleEdit = (item: SalesAgreementRecord) => {
    setForm({
      agreementDate: item.agreement_date || new Date().toISOString().split("T")[0],
      sellerName: item.seller_name || "",
      sellerAddress: item.seller_address || "",
      sellerPhone: item.seller_phone || "",
      sellerIdType: item.seller_id_type || "",
      buyerName: item.buyer_name || "",
      buyerAddress: item.buyer_address || "",
      buyerPhone: item.buyer_phone || "",
      buyerIdType: item.buyer_id_type || "",
      vehicleMake: item.vehicle_make || "",
      vehicleYearModel: item.vehicle_year_model || "",
      vehicleColor: item.vehicle_color || "",
      vehicleEngineNumber: item.vehicle_engine_number || "",
      vehicleChassis: item.vehicle_chassis || "",
      vehiclePlateNumber: item.vehicle_plate_number || "",
      salePrice: item.sale_price || "",
      paymentMethod: item.payment_method || "",
      note: item.note || "",
      sellerSignature: item.seller_signature || "",
      buyerSignature: item.buyer_signature || "",
      sellerWitnessName: item.seller_witness_name || "",
      sellerWitnessSignature: item.seller_witness_signature || "",
      buyerWitnessName: item.buyer_witness_name || "",
      buyerWitnessSignature: item.buyer_witness_signature || "",
      repName: item.rep_name || "",
      repSignature: item.rep_signature || "",
      repSignatureDate: item.rep_signature_date || new Date().toISOString().split("T")[0],
    });
    setEditingId(item.id);
    setMode("edit");
    setActiveTab("create");
  };

  const clearForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
  };

  // ── Helper ────────────────────────────────────────────────────────────────
  const Field = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-baseline gap-2 print:gap-1.5 py-1 print:py-[2px] border-b border-gray-200">
      <span className="font-bold text-sm text-gray-800 whitespace-nowrap">{label}:</span>
      <span className="flex-1 text-sm text-gray-900 font-medium">
        {value || <span className="text-transparent select-none">{"_".repeat(30)}</span>}
      </span>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  //  PREVIEW / PRINT MODE
  // ══════════════════════════════════════════════════════════════
  if (mode === "preview" && previewData) {
    const priceWords = formatPriceWords(previewData.salePrice || "");
    const formattedPrice = previewData.salePrice
      ? `\u20a6${Number(previewData.salePrice.replace(/[^0-9.]/g, "")).toLocaleString("en-NG")}`
      : "";

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
            @page { margin: 0; size: A4; }
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
              position: relative !important; width: 210mm !important; max-height: 297mm !important;
              margin: 0 auto !important; padding: 12mm 15mm !important; box-sizing: border-box !important;
              border: none !important; box-shadow: none !important; background: white !important;
              page-break-inside: avoid !important; break-inside: avoid !important;
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
            <Button onClick={handlePrint} className="rounded-xl gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 font-semibold px-6">
              <Printer className="w-4 h-4" /> Print Document
            </Button>
          </div>
        </div>

        {/* Printable Document */}
        <div className="print-pages-container w-full flex justify-center overflow-x-auto custom-scrollbar">
          <div
            ref={documentRef}
            className="print-document-page bg-white text-black shadow-2xl border border-gray-200 p-6 md:p-[12mm_15mm] md:w-[210mm] shrink-0 box-border"
          >
            <PrintWatermark />
            <PrintHeader />

            {/* Title */}
            <div className="text-center my-2 print:my-1">
              <h1 className="text-base print:text-sm font-black text-black uppercase tracking-widest underline underline-offset-4">
                Sales Agreement &amp; Change of Ownership
              </h1>
            </div>

            {/* Date */}
            <div className="flex items-baseline gap-2 mb-2 print:mb-1 border-b border-gray-300 pb-0.5">
              <span className="font-bold text-[12px]">Date:</span>
              <span className="text-[12px] font-medium flex-1">
                {previewData.agreementDate
                  ? new Date(previewData.agreementDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                  : ""}
              </span>
            </div>

            {/* Two-column: Seller & Buyer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 print:gap-3 mb-2 print:mb-1">
              <section>
                <h2 className="font-black text-[10px] uppercase tracking-wide mb-0.5 bg-gray-100 px-2 py-0.5 rounded">Seller's Information</h2>
                <div className="space-y-0">
                  <Field label="Full Name" value={previewData.sellerName} />
                  <Field label="Address" value={previewData.sellerAddress} />
                  <Field label="Phone Number" value={previewData.sellerPhone} />
                  <Field label="ID Type & Number" value={previewData.sellerIdType} />
                </div>
              </section>
              <section>
                <h2 className="font-black text-[10px] uppercase tracking-wide mb-0.5 bg-gray-100 px-2 py-0.5 rounded">Buyer's Information</h2>
                <div className="space-y-0">
                  <Field label="Full Name" value={previewData.buyerName} />
                  <Field label="Address" value={previewData.buyerAddress} />
                  <Field label="Phone Number" value={previewData.buyerPhone} />
                  <Field label="ID Type & Number" value={previewData.buyerIdType} />
                </div>
              </section>
            </div>

            {/* Vehicle Details */}
            <section className="mb-2 print:mb-1">
              <h2 className="font-black text-[10px] uppercase tracking-wide mb-0.5 bg-gray-100 px-2 py-0.5 rounded">Vehicle Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-x-4 print:gap-x-3">
                <Field label="Make / Brand" value={previewData.vehicleMake} />
                <Field label="Year Model" value={previewData.vehicleYearModel} />
                <Field label="Color" value={previewData.vehicleColor} />
                <Field label="Plate Number" value={previewData.vehiclePlateNumber} />
                <Field label="Engine Number" value={previewData.vehicleEngineNumber} />
                <Field label="Chassis / VIN No." value={previewData.vehicleChassis} />
              </div>
            </section>

            {/* Sale Details */}
            <section className="mb-2 print:mb-1">
              <h2 className="font-black text-[10px] uppercase tracking-wide mb-0.5 bg-gray-100 px-2 py-0.5 rounded">Sale Details</h2>
              <div className="space-y-0">
                <div className="flex items-baseline gap-2 py-0.5 border-b border-gray-200">
                  <span className="font-bold text-xs text-gray-800 whitespace-nowrap min-w-[150px]">Agreed Sale Price:</span>
                  <span className="flex-1 text-xs text-gray-900 font-black">
                    {formattedPrice || <span className="text-transparent select-none">{"_".repeat(20)}</span>}
                  </span>
                </div>
                {priceWords && (
                  <div className="flex items-baseline gap-2 py-0.5 border-b border-gray-200">
                    <span className="font-bold text-xs text-gray-800 whitespace-nowrap min-w-[150px]">Amount in Words:</span>
                    <span className="flex-1 text-[11px] text-gray-900 font-medium italic">{priceWords}</span>
                  </div>
                )}
                <Field label="Payment Method" value={previewData.paymentMethod} />
              </div>
            </section>

            {/* Agreement Body */}
            <section className="mb-2 print:mb-1">
              <h2 className="font-black text-[10px] uppercase tracking-wide mb-0.5 bg-gray-100 px-2 py-0.5 rounded">Terms of Agreement</h2>
              <p className="text-[11px] print:text-[10px] leading-relaxed print:leading-snug text-gray-800 text-justify">
                I, <span className="inline-block min-w-[140px] border-b border-gray-800 text-center font-bold px-1">{previewData.sellerName || ""}</span> (Seller), confirm the sale and transfer of full vehicle ownership to <span className="inline-block min-w-[140px] border-b border-gray-800 text-center font-bold px-1">{previewData.buyerName || ""}</span> (Buyer) for <strong>{formattedPrice || "___________"}</strong>{priceWords ? ` (${priceWords})` : ""}, facilitated by <strong>Abuja Best Cars</strong>.
              </p>
              <p className="text-[11px] print:text-[10px] leading-relaxed print:leading-snug text-gray-800 text-justify mt-1">
                The Seller warrants the vehicle is free from all encumbrances and title shall be transferred upon receipt of full payment. Both parties confirm reading and understanding these terms.
              </p>
            </section>

            {/* Note */}
            {previewData.note && (
              <section className="mb-2 print:mb-1">
                <h2 className="font-black text-[10px] uppercase tracking-wide mb-0.5">Note:</h2>
                <p className="text-[11px] text-gray-800 leading-tight border-b border-gray-300 pb-0.5">
                  {previewData.note}
                </p>
              </section>
            )}

            {/* Signatures & Witnesses — Matching Template Grid */}
            <section className="mt-2 print:mt-1">
              <h2 className="font-black text-[10px] uppercase tracking-wide mb-1 bg-gray-100 px-2 py-0.5 rounded">Signatures &amp; Witnesses</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-x-6 gap-y-2 print:gap-x-4 print:gap-y-1.5">
                {/* Buyer */}
                <div>
                  <p className="text-[9px] font-bold text-gray-700 mb-0.5">Buyer's Name &amp; Signature:</p>
                  <div className="h-8 border-b border-gray-800 mb-1 flex items-end">
                    {previewData.buyerSignature ? (
                      <img src={previewData.buyerSignature} alt="Buyer Signature" className="max-h-7 object-contain" style={{ filter: "brightness(0)" }} />
                    ) : <span className="text-transparent select-none">__________________</span>}
                  </div>
                  <div className="flex items-baseline gap-1 border-b border-gray-400 pb-0.5">
                    <span className="text-[8px] font-bold uppercase opacity-60">Buyer Name:</span>
                    <span className="text-[10px] font-bold flex-1 truncate">{previewData.buyerName}</span>
                  </div>
                </div>

                {/* Seller */}
                <div>
                  <p className="text-[9px] font-bold text-gray-700 mb-0.5">Seller's Name &amp; Signature:</p>
                  <div className="h-8 border-b border-gray-800 mb-1 flex items-end">
                    {previewData.sellerSignature ? (
                      <img src={previewData.sellerSignature} alt="Seller Signature" className="max-h-7 object-contain" style={{ filter: "brightness(0)" }} />
                    ) : <span className="text-transparent select-none">__________________</span>}
                  </div>
                  <div className="flex items-baseline gap-1 border-b border-gray-400 pb-0.5">
                    <span className="text-[8px] font-bold uppercase opacity-60">Seller Name:</span>
                    <span className="text-[10px] font-bold flex-1 truncate">{previewData.sellerName}</span>
                  </div>
                </div>

                {/* Buyer Witness */}
                <div>
                  <p className="text-[9px] font-bold text-gray-700 mb-0.5">Buyer's Witness Name &amp; Signature:</p>
                  <div className="h-8 border-b border-gray-800 mb-1 flex items-end">
                    {previewData.buyerWitnessSignature ? (
                      <img src={previewData.buyerWitnessSignature} alt="Buyer Witness Signature" className="max-h-7 object-contain" style={{ filter: "brightness(0)" }} />
                    ) : <span className="text-transparent select-none">__________________</span>}
                  </div>
                  <div className="flex items-baseline gap-1 border-b border-gray-400 pb-0.5">
                    <span className="text-[8px] font-bold uppercase opacity-60">Witness Name:</span>
                    <span className="text-[10px] font-medium flex-1 truncate">{previewData.buyerWitnessName || "—"}</span>
                  </div>
                </div>

                {/* Seller Witness */}
                <div>
                  <p className="text-[9px] font-bold text-gray-700 mb-0.5">Seller's Witness Name &amp; Signature:</p>
                  <div className="h-8 border-b border-gray-800 mb-1 flex items-end">
                    {previewData.sellerWitnessSignature ? (
                      <img src={previewData.sellerWitnessSignature} alt="Seller Witness Signature" className="max-h-7 object-contain" style={{ filter: "brightness(0)" }} />
                    ) : <span className="text-transparent select-none">__________________</span>}
                  </div>
                  <div className="flex items-baseline gap-1 border-b border-gray-400 pb-0.5">
                    <span className="text-[8px] font-bold uppercase opacity-60">Witness Name:</span>
                    <span className="text-[10px] font-medium flex-1 truncate">{previewData.sellerWitnessName || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Company Representative */}
              <div className="mt-2 border-t border-gray-300 pt-1.5 flex items-center justify-between">
                <div className="flex-1 max-w-xs">
                  <p className="text-[9px] font-bold text-gray-700 mb-0.5">Abuja Best Cars Rep Signature:</p>
                  <div className="h-7 border-b border-gray-800 mb-0.5 flex items-end">
                    {previewData.repSignature && (
                      <img src={previewData.repSignature} alt="Rep Signature" className="max-h-6 object-contain" style={{ filter: "brightness(0)" }} />
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[8px] font-bold uppercase opacity-60">Rep Name:</span>
                    <span className="text-[10px] font-medium flex-1 truncate">{previewData.repName}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold uppercase opacity-60">Date: </span>
                  <span className="text-[10px] font-medium">
                    {previewData.repSignatureDate ? new Date(previewData.repSignatureDate).toLocaleDateString("en-GB") : ""}
                  </span>
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
              <FileText className="w-3.5 h-3.5 text-emerald-400/60" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400/60">Legal Documents</span>
            </div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-white/90">Sales Agreement &amp; Change of Ownership</h1>
            <p className="text-xs text-white/40 mt-0.5 max-w-lg">
              Create, manage, and print vehicle sales agreement documents for Abuja Best Car.
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card/40 border border-white/5 p-1 rounded-2xl flex flex-col md:flex-row h-auto w-full md:w-auto">
          {canAdd && (
            <TabsTrigger value="create" className="rounded-xl px-6 py-2.5 font-semibold data-[state=active]:bg-emerald-500 data-[state=active]:text-white transition-all w-full md:w-auto">
              <PlusCircle className="w-4 h-4 mr-2" /> Create Agreement
            </TabsTrigger>
          )}
          <TabsTrigger value="history" className="rounded-xl px-6 py-2.5 font-semibold data-[state=active]:bg-emerald-500 data-[state=active]:text-white transition-all w-full md:w-auto">
            <History className="w-4 h-4 mr-2" /> Agreement History
          </TabsTrigger>
        </TabsList>

        {/* ── CREATE TAB ─────────────────────────────────────────── */}
        <TabsContent value="create">
          <div className="space-y-6">
            <Card className="bento-card overflow-hidden">
              <CardHeader className="bg-emerald-500/5 border-b border-white/5 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-500" /> Agreement Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-10">

                {/* Agreement Date */}
                <div className="space-y-2 max-w-xs">
                  <Label className="text-muted-foreground text-xs font-semibold px-1">AGREEMENT DATE</Label>
                  <Input name="agreementDate" type="date" value={form.agreementDate} onChange={handleChange} className="h-12 bg-background/50 border-white/10 focus-visible:ring-emerald-500 rounded-xl" />
                </div>

                <div className="h-px bg-white/5" />

                {/* Seller's Information */}
                <div className="space-y-5">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500 flex items-center gap-3">
                    <Users className="w-4 h-4" /> Seller's Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">SELLER FULL NAME</Label>
                      <Input name="sellerName" value={form.sellerName} onChange={handleChange} placeholder="e.g. John Adeyemi" className="h-12 bg-background/50 border-white/10 focus-visible:ring-emerald-500 rounded-xl" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">SELLER ADDRESS</Label>
                      <Input name="sellerAddress" value={form.sellerAddress} onChange={handleChange} placeholder="Full residential address..." className="h-12 bg-background/50 border-white/10 focus-visible:ring-emerald-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">SELLER PHONE NUMBER</Label>
                      <Input name="sellerPhone" value={form.sellerPhone} onChange={handleChange} placeholder="0807..." className="h-12 bg-background/50 border-white/10 focus-visible:ring-emerald-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">SELLER ID TYPE &amp; NUMBER</Label>
                      <Input name="sellerIdType" value={form.sellerIdType} onChange={handleChange} placeholder="NIN / Passport / Driver's License..." className="h-12 bg-background/50 border-white/10 focus-visible:ring-emerald-500 rounded-xl" />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Buyer's Information */}
                <div className="space-y-5">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500 flex items-center gap-3">
                    <Users className="w-4 h-4" /> Buyer's Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">BUYER FULL NAME</Label>
                      <Input name="buyerName" value={form.buyerName} onChange={handleChange} placeholder="e.g. Amina Bello" className="h-12 bg-background/50 border-white/10 focus-visible:ring-emerald-500 rounded-xl" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">BUYER ADDRESS</Label>
                      <Input name="buyerAddress" value={form.buyerAddress} onChange={handleChange} placeholder="Full residential address..." className="h-12 bg-background/50 border-white/10 focus-visible:ring-emerald-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">BUYER PHONE NUMBER</Label>
                      <Input name="buyerPhone" value={form.buyerPhone} onChange={handleChange} placeholder="0807..." className="h-12 bg-background/50 border-white/10 focus-visible:ring-emerald-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">BUYER ID TYPE &amp; NUMBER</Label>
                      <Input name="buyerIdType" value={form.buyerIdType} onChange={handleChange} placeholder="NIN / Passport / Driver's License..." className="h-12 bg-background/50 border-white/10 focus-visible:ring-emerald-500 rounded-xl" />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Vehicle Details */}
                <div className="space-y-5">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500 flex items-center gap-3">
                    <Car className="w-4 h-4" /> Vehicle Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">MAKE / BRAND</Label>
                      <Input name="vehicleMake" value={form.vehicleMake} onChange={handleChange} placeholder="e.g. Toyota" className="h-12 bg-background/50 border-white/10 focus-visible:ring-emerald-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">YEAR MODEL</Label>
                      <Input name="vehicleYearModel" value={form.vehicleYearModel} onChange={handleChange} placeholder="e.g. Camry 2021" className="h-12 bg-background/50 border-white/10 focus-visible:ring-emerald-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">COLOR</Label>
                      <Input name="vehicleColor" value={form.vehicleColor} onChange={handleChange} placeholder="e.g. Pearl White" className="h-12 bg-background/50 border-white/10 focus-visible:ring-emerald-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">PLATE NUMBER</Label>
                      <Input name="vehiclePlateNumber" value={form.vehiclePlateNumber} onChange={handleChange} placeholder="e.g. ABJ 123 XY" className="h-12 bg-background/50 border-white/10 focus-visible:ring-emerald-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">ENGINE NUMBER</Label>
                      <Input name="vehicleEngineNumber" value={form.vehicleEngineNumber} onChange={handleChange} placeholder="Engine No." className="h-12 bg-background/50 border-white/10 focus-visible:ring-emerald-500 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">CHASSIS / VIN NUMBER</Label>
                      <Input name="vehicleChassis" value={form.vehicleChassis} onChange={handleChange} placeholder="Chassis / VIN No." className="h-12 bg-background/50 border-white/10 focus-visible:ring-emerald-500 rounded-xl" />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Sale Details */}
                <div className="space-y-5">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500 flex items-center gap-3">
                    <FileText className="w-4 h-4" /> Sale Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">AGREED SALE PRICE (&#x20a6;)</Label>
                      <Input
                        name="salePrice"
                        value={form.salePrice}
                        onChange={handleChange}
                        placeholder="e.g. 5000000"
                        className="h-12 bg-background/50 border-white/10 focus-visible:ring-emerald-500 rounded-xl"
                      />
                      {form.salePrice && (
                        <p className="text-[11px] text-emerald-400/70 px-1 italic">
                          {formatPriceWords(form.salePrice)}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs font-semibold px-1">PAYMENT METHOD</Label>
                      <Input name="paymentMethod" value={form.paymentMethod} onChange={handleChange} placeholder="e.g. Bank Transfer / Cash / Cheque" className="h-12 bg-background/50 border-white/10 focus-visible:ring-emerald-500 rounded-xl" />
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
                    className="bg-background/50 border-white/10 focus-visible:ring-emerald-500 rounded-xl min-h-[80px]"
                  />
                </div>

                <div className="h-px bg-white/5" />

                {/* Signatures & Witnesses */}
                <div className="space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500 flex items-center gap-3">
                    <Pencil className="w-4 h-4" /> Signatures &amp; Witnesses
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Seller & Seller Witness */}
                    <div className="space-y-5 bg-card/30 p-5 rounded-2xl border border-white/5 shadow-inner">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold uppercase text-emerald-400">Seller's Signature</Label>
                          {form.sellerSignature && (
                            <span className="text-[10px] text-emerald-500 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> CAPTURED
                            </span>
                          )}
                        </div>
                        <SignaturePad value={form.sellerSignature} onChange={(val) => setForm(p => ({ ...p, sellerSignature: val }))} />
                      </div>

                      <div className="h-px bg-white/5" />

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold uppercase text-emerald-400">Seller's Witness</Label>
                          {form.sellerWitnessSignature && (
                            <span className="text-[10px] text-emerald-500 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> CAPTURED
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Input
                            name="sellerWitnessName"
                            value={form.sellerWitnessName}
                            onChange={handleChange}
                            placeholder="Seller Witness Full Name"
                            className="h-10 text-sm bg-background/50 border-white/10 rounded-xl"
                          />
                          <SignaturePad value={form.sellerWitnessSignature} onChange={(val) => setForm(p => ({ ...p, sellerWitnessSignature: val }))} />
                        </div>
                      </div>
                    </div>

                    {/* Buyer & Buyer Witness */}
                    <div className="space-y-5 bg-card/30 p-5 rounded-2xl border border-white/5 shadow-inner">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold uppercase text-emerald-400">Buyer's Signature</Label>
                          {form.buyerSignature && (
                            <span className="text-[10px] text-emerald-500 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> CAPTURED
                            </span>
                          )}
                        </div>
                        <SignaturePad value={form.buyerSignature} onChange={(val) => setForm(p => ({ ...p, buyerSignature: val }))} />
                      </div>

                      <div className="h-px bg-white/5" />

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold uppercase text-emerald-400">Buyer's Witness</Label>
                          {form.buyerWitnessSignature && (
                            <span className="text-[10px] text-emerald-500 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> CAPTURED
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Input
                            name="buyerWitnessName"
                            value={form.buyerWitnessName}
                            onChange={handleChange}
                            placeholder="Buyer Witness Full Name"
                            className="h-10 text-sm bg-background/50 border-white/10 rounded-xl"
                          />
                          <SignaturePad value={form.buyerWitnessSignature} onChange={(val) => setForm(p => ({ ...p, buyerWitnessSignature: val }))} />
                        </div>
                      </div>
                    </div>

                    {/* Company Representative */}
                    <div className="space-y-5 bg-card/30 p-5 rounded-2xl border border-white/5 shadow-inner">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold uppercase text-emerald-400">Company Rep Signature</Label>
                          {form.repSignature && (
                            <span className="text-[10px] text-emerald-500 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> CAPTURED
                            </span>
                          )}
                        </div>
                        <SignaturePad value={form.repSignature} onChange={(val) => setForm(p => ({ ...p, repSignature: val }))} />
                      </div>

                      <div className="space-y-3 pt-1">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground font-bold uppercase px-1">Company Rep Name</Label>
                          <Input name="repName" value={form.repName} onChange={handleChange} placeholder="Full Name" className="h-10 text-sm bg-background/50 border-white/10 rounded-xl" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground font-bold uppercase px-1">Sign Date</Label>
                          <Input name="repSignatureDate" type="date" value={form.repSignatureDate} onChange={handleChange} className="h-10 text-sm bg-background/50 border-white/10 rounded-xl" />
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
                className="rounded-2xl w-full sm:w-auto px-12 h-14 bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/25 font-bold transition-all disabled:opacity-50"
                disabled={!form.sellerName || !form.buyerName || !form.vehicleMake || saveMutation.isPending}
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
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
              <div className="relative w-full md:max-w-md group z-10">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors pointer-events-none" />
                <Input
                  placeholder="Search by seller, buyer, vehicle, chassis..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-10 h-10 rounded-xl bg-background/50 border-white/10 focus-visible:ring-emerald-500/50 font-medium text-sm w-full"
                />
              </div>

              <div className="flex gap-2 shrink-0 flex-wrap sm:flex-nowrap items-center z-10 w-full md:w-auto justify-between md:justify-end">
                <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setPage(0); }}>
                  <SelectTrigger className="w-[140px] h-10 rounded-xl bg-background/50 border-white/10 text-xs">
                    <SelectValue placeholder="Select Month" />
                  </SelectTrigger>
                  <SelectContent className="glass-panel w-[140px] rounded-xl">
                    <SelectItem value="all" className="rounded-lg">All Time</SelectItem>
                    {Array.from({ length: 12 }).map((_, i) => {
                      const d = subMonths(new Date(), i);
                      const val = format(d, "yyyy-MM");
                      const label = format(d, "MMMM yyyy");
                      return (
                        <SelectItem key={val} value={val} className="rounded-lg">{label}</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Select value={selectedWeek} onValueChange={(v) => { setSelectedWeek(v); setPage(0); }}>
                  <SelectTrigger className="w-[110px] h-10 rounded-xl bg-background/50 border-white/10 text-xs">
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
                <p className="font-semibold text-base mb-1">No sales agreements found.</p>
                <p className="text-xs text-muted-foreground mb-4">No records match your filter criteria or no agreements have been saved yet.</p>
                {(search || selectedMonth !== "all" || selectedWeek !== "all") && (
                  <Button variant="link" onClick={() => { setSearch(""); setSelectedMonth("all"); setSelectedWeek("all"); setPage(0); }} className="text-emerald-500 text-xs font-semibold">
                    Clear all filters
                  </Button>
                )}
              </div>
            ) : viewMode === "cards" ? (
              /* Split-Panel Sales Agreement Cards Modeled After Reference Design */
              <div className="space-y-4">
                {pagedHistory.map((item) => {
                  const docRef = `SA-${item.id.slice(0, 8).toUpperCase()}`;
                  const dateStr = new Date(item.agreement_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  const priceNumeric = Number(item.sale_price?.replace(/[^0-9.]/g, "") || 0);

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
                              SALES AGREEMENT
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 font-bold">
                              {docRef}
                            </span>
                          </div>

                          <h3 className="text-base md:text-lg font-bold text-white leading-snug tracking-tight group-hover:text-amber-400 transition-colors">
                            {item.seller_name}
                          </h3>

                          <p className="text-[11px] text-slate-300 mt-1 flex items-center gap-1">
                            <span className="text-slate-400">Buyer:</span>
                            <span className="font-semibold text-white">{item.buyer_name}</span>
                          </p>

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
                            title={item.vehicle_chassis ? `Chassis: ${item.vehicle_chassis}` : "Agreement Record"}
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
                              <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight font-mono">
                                {priceNumeric > 0 ? `₦${priceNumeric.toLocaleString()}` : "Price Unspecified"}
                              </h2>
                              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                <CheckCircle className="w-3 h-3 text-emerald-500" />
                                Legally Executed
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
                              100% Agreement Ratified
                            </p>
                          </div>
                        </div>

                        {/* Bottom Action Pill Buttons matching reference */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40 dark:border-white/5">
                          <div className="flex items-center gap-2">
                            {hasEdit && (
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleEdit(item)} 
                                  className="rounded-full h-9 w-9 hover:bg-muted text-muted-foreground hover:text-foreground"
                                  title="Edit Agreement"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => deleteMutation.mutate(item.id)} 
                                  className="rounded-full h-9 w-9 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  title="Delete Agreement"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
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
                        <TableHead className="font-semibold">Seller</TableHead>
                        <TableHead className="font-semibold">Buyer</TableHead>
                        <TableHead className="font-semibold">Vehicle</TableHead>
                        <TableHead className="font-semibold">Price</TableHead>
                        <TableHead className="text-right font-semibold px-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedHistory.map((item) => (
                        <TableRow key={item.id} className="border-border/10 hover:bg-white/5 transition-colors group">
                          <TableCell className="px-6 py-4 font-medium text-sm">
                            {new Date(item.agreement_date).toLocaleDateString("en-GB")}
                          </TableCell>
                          <TableCell className="font-bold text-foreground">{item.seller_name}</TableCell>
                          <TableCell className="font-semibold text-foreground/80">{item.buyer_name}</TableCell>
                          <TableCell>
                            <span className="font-semibold text-sm">{item.vehicle_make} — {item.vehicle_year_model}</span>
                          </TableCell>
                          <TableCell className="font-mono text-sm font-bold text-emerald-500">
                            {item.sale_price
                              ? `₦${Number(item.sale_price.replace(/[^0-9.]/g, "")).toLocaleString("en-NG")}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <div className="flex justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="sm" onClick={() => viewHistoryItem(item)} className="h-8 rounded-lg font-bold px-3 text-xs">
                                <Printer className="w-3.5 h-3.5 mr-1.5" /> View
                              </Button>
                              {hasEdit && (
                                <>
                                  <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} className="h-8 w-8 rounded-lg hover:bg-foreground/20">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)} className="h-8 w-8 rounded-lg hover:bg-destructive/20 hover:text-destructive">
                                    <Trash2 className="w-3.5 h-3.5" />
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
