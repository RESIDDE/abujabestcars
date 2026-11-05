import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Plus, Search, Trash2, Edit, Copy, Download,
  Sparkles, File, FolderOpen, Calendar, HelpCircle,
  FileJson, Upload, ChevronRight, BarChart3, Clock, Printer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RichTextEditor, type DocumentData } from "@/components/RichTextEditor";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logAction } from "@/lib/logger";

// ---------- Templates (unchanged) ----------
const TEMPLATES = [
  {
    id: "blank",
    name: "Blank Document",
    description: "Clean slate",
    icon: File,
    color: "text-slate-400 bg-slate-500/10",
    content: `<p>Start typing your document here...</p>`
  },
  {
    id: "sales-agreement",
    name: "Sales Agreement",
    description: "Purchase contract",
    icon: FileText,
    color: "text-violet-500 bg-violet-500/10",
    content: `
      <h1 style="text-align: center; color: #1e293b; margin-bottom: 24px;">VEHICLE SALES AGREEMENT</h1>
      <p style="text-align: justify; margin-bottom: 16px;">
        This Vehicle Sales Agreement (the "Agreement") is entered into this <strong><u>[DAY]</u></strong> day of <strong><u>[MONTH]</u></strong>, <strong><u>[YEAR]</u></strong>, by and between:
      </p>
      <p style="margin-bottom: 8px;">
        <strong>SELLER:</strong> Abuja Best Cars, located at 38 Gana St, Maitama, Abuja 904101, FCT.
      </p>
      <p style="margin-bottom: 20px;">
        <strong>BUYER:</strong> ____________________________________________________________________
      </p>
      <h2 style="color: #334155; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">1. VEHICLE DESCRIPTION</h2>
      <p style="margin-bottom: 16px;">The Seller hereby sells and the Buyer hereby buys the following vehicle:</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px; width: 25%; font-weight: bold; background-color: #f8fafc;">Make</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; width: 25%;">[Make]</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; width: 25%; font-weight: bold; background-color: #f8fafc;">Model</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; width: 25%;">[Model]</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; background-color: #f8fafc;">Year</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">[Year]</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; background-color: #f8fafc;">Color</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">[Color]</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; background-color: #f8fafc;">VIN / Chassis</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">[Chassis Number]</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; background-color: #f8fafc;">Mileage</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">[Mileage] km</td>
          </tr>
        </tbody>
      </table>
      <h2 style="color: #334155; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">2. PURCHASE PRICE AND PAYMENT TERMS</h2>
      <p style="margin-bottom: 16px; text-align: justify;">
        The agreed total purchase price for the vehicle is <strong><u>NGN [PRICE]</u></strong> (____________________________________________________________________ Naira). 
        The Buyer agrees to pay the purchase price via:
      </p>
      <ul><li>Bank Transfer / Draft</li><li>Cash</li></ul>
      <h2 style="color: #334155; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">3. WARRANTY AND CONDITION</h2>
      <p style="margin-bottom: 24px; text-align: justify;">
        Unless otherwise specified in writing, the vehicle is sold <strong>"AS IS"</strong> and without any express or implied warranty of any kind. 
        The Buyer has inspected the vehicle or had it inspected and accepts it in its current condition.
      </p>
      <h2 style="color: #334155; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">SIGNATURES</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 32px; border: none;">
        <tbody>
          <tr style="border: none;">
            <td style="border: none; padding: 12px; width: 45%; vertical-align: top;">
              <p style="margin-bottom: 40px;">For: <strong>Abuja Best Cars (Seller)</strong></p>
              <div style="border-top: 1px solid #000; padding-top: 4px;">
                Authorized Signature &amp; Stamp<br><span style="font-size: 11px; color: #64748b;">Date: ____ / ____ / ________</span>
              </div>
            </td>
            <td style="border: none; width: 10%;"></td>
            <td style="border: none; padding: 12px; width: 45%; vertical-align: top;">
              <p style="margin-bottom: 40px;"><strong>BUYER</strong></p>
              <div style="border-top: 1px solid #000; padding-top: 4px;">
                Signature &amp; Full Name<br><span style="font-size: 11px; color: #64748b;">Date: ____ / ____ / ________</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>`
  },
  {
    id: "authority-sell",
    name: "Authority To Sell",
    description: "Consignment permit",
    icon: FileText,
    color: "text-amber-500 bg-amber-500/10",
    content: `
      <h1 style="text-align: center; color: #1e293b; margin-bottom: 24px;">AUTHORITY TO SELL AGREEMENT</h1>
      <p style="text-align: justify; margin-bottom: 16px;">
        I, the undersigned owner, hereby authorize <strong>Abuja Best Cars</strong> (the "Agent") to display, advertise, and sell the vehicle described below on my behalf.
      </p>
      <h2 style="color: #334155; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">1. OWNER INFORMATION</h2>
      <p style="margin-bottom: 4px;"><strong>Full Name:</strong> ____________________________________________________________________</p>
      <p style="margin-bottom: 4px;"><strong>Address:</strong> ____________________________________________________________________</p>
      <p style="margin-bottom: 20px;"><strong>Phone / Tel:</strong> ___________________________________ <strong>Email:</strong> ___________________________</p>
      <h2 style="color: #334155; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">2. VEHICLE INFORMATION</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px; width: 25%; font-weight: bold; background-color: #f8fafc;">Make &amp; Model</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; width: 25%;">_________________</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; width: 25%; font-weight: bold; background-color: #f8fafc;">Year &amp; Color</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; width: 25%;">_________________</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; background-color: #f8fafc;">VIN / Chassis</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">_________________</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; background-color: #f8fafc;">Engine Number</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">_________________</td>
          </tr>
        </tbody>
      </table>
      <h2 style="color: #334155; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">3. SALES TERMS AND COMMISSION</h2>
      <p style="margin-bottom: 8px;"><strong>Reserve/Minimum Price:</strong> NGN ______________________________________</p>
      <p style="margin-bottom: 8px;"><strong>Consignment Period:</strong> From ____/____/________ to ____/____/________</p>
      <p style="margin-bottom: 16px; text-align: justify;">
        The Agent is authorized to deduct a commission of <strong>_______%</strong> of the final sale price upon successful sale, or a flat fee of NGN _____________________.
      </p>
      <h2 style="color: #334155; margin-top: 32px; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">OWNER'S DECLARATION &amp; SIGNATURE</h2>
      <p style="text-align: justify; margin-bottom: 24px; font-size: 13px; color: #475569;">
        I warrant that I am the legal owner of the vehicle and have the full authority and clear title to authorize its sale. All documents provided are genuine.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 24px; border: none;">
        <tbody>
          <tr style="border: none;">
            <td style="border: none; padding: 12px; width: 45%; vertical-align: top;">
              <p style="margin-bottom: 40px;">For: <strong>Abuja Best Cars (Agent)</strong></p>
              <div style="border-top: 1px solid #000; padding-top: 4px;">Representative Signature</div>
            </td>
            <td style="border: none; width: 10%;"></td>
            <td style="border: none; padding: 12px; width: 45%; vertical-align: top;">
              <p style="margin-bottom: 40px;"><strong>VEHICLE OWNER</strong></p>
              <div style="border-top: 1px solid #000; padding-top: 4px;">Signature &amp; Date</div>
            </td>
          </tr>
        </tbody>
      </table>`
  },
  {
    id: "proforma-quote",
    name: "Proforma Invoice",
    description: "Pricing quotation & billing document",
    icon: FileText,
    color: "text-emerald-500 bg-emerald-500/10",
    content: `
      <h1 style="text-align: center; color: #1e293b; margin-bottom: 4px;">PROFORMA INVOICE</h1>
      <p style="text-align: center; color: #64748b; margin-bottom: 24px;">Quote No: BT-PQ-${Math.floor(1000 + Math.random() * 9000)} | Date: ${new Date().toLocaleDateString()}</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: none;">
        <tbody>
          <tr style="border: none;">
            <td style="border: none; width: 50%; padding: 4px 0;">
              <strong>PREPARED FOR:</strong><br>Name: _______________________________<br>Phone: ______________________________<br>Email: ______________________________
            </td>
            <td style="border: none; width: 50%; padding: 4px 0; text-align: right; vertical-align: top;">
              <strong>VALID UNTIL:</strong> 30 Days from date of issue<br><strong>PREPARED BY:</strong> Abuja Best Cars Sales Dept.
            </td>
          </tr>
        </tbody>
      </table>
      <h2 style="color: #334155; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">QUOTED ITEMS / SERVICES</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background-color: #f8fafc;">
            <th style="border: 1px solid #cbd5e1; padding: 10px; width: 10%;">S/N</th>
            <th style="border: 1px solid #cbd5e1; padding: 10px; width: 50%;">Description of Service / Vehicle Parts</th>
            <th style="border: 1px solid #cbd5e1; padding: 10px; width: 10%; text-align: center;">Qty</th>
            <th style="border: 1px solid #cbd5e1; padding: 10px; width: 15%; text-align: right;">Unit Price (NGN)</th>
            <th style="border: 1px solid #cbd5e1; padding: 10px; width: 15%; text-align: right;">Total (NGN)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">1</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px;">Vehicle Inspection and Diagnostics</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">1</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">35,000.00</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">35,000.00</td>
          </tr>
          <tr>
            <td colspan="3" style="border: none; padding: 10px; text-align: right; font-weight: bold;">Total</td>
            <td colspan="2" style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-weight: bold;">35,000.00</td>
          </tr>
        </tbody>
      </table>
      <h2 style="color: #334155; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">BANKING &amp; PAYMENT DETAILS</h2>
      <p style="margin-bottom: 4px;"><strong>Bank Name:</strong> Access Bank Plc</p>
      <p style="margin-bottom: 4px;"><strong>Account Name:</strong> Abuja Best Cars</p>
      <p style="margin-bottom: 16px;"><strong>Account Number:</strong> 0077777211</p>`
  },
  {
    id: "business-letter",
    name: "Business Letter",
    description: "Standard letterhead memo",
    icon: FileText,
    color: "text-cyan-500 bg-cyan-500/10",
    content: `
      <p style="text-align: right; margin-bottom: 24px;">Date: ${new Date().toLocaleDateString()}</p>
      <p style="margin-bottom: 20px;">To:<br><strong>The Managing Director</strong><br>[Recipient Company / Name]<br>[Address Line 1]<br>Abuja, Nigeria.</p>
      <p style="margin-bottom: 20px;">Dear Sir/Ma,</p>
      <p style="margin-bottom: 16px; font-weight: bold; text-decoration: underline; text-transform: uppercase;">SUBJECT: INTRODUCTORY PROPOSAL FOR FLEET MAINTENANCE SERVICES</p>
      <p style="text-align: justify; margin-bottom: 16px;">
        We write to formally introduce <strong>Abuja Best Cars</strong>, a premier automotive dealership, sales, and maintenance hub situated in Maitama, Abuja.
      </p>
      <p style="text-align: justify; margin-bottom: 24px;">We look forward to an opportunity to present a detailed proposal and inspect your fleet. Thank you for your time and consideration.</p>
      <p style="margin-bottom: 40px;">Yours Faithfully,<br><br><br><strong>Management</strong><br>Abuja Best Cars</p>`
  }
];

// ---------- DB row → DocumentData adapter ----------
function rowToDoc(row: any): DocumentData {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    letterhead: row.letterhead,
    watermark: row.watermark,
    watermarkOpacity: Number(row.watermark_opacity),
    margins: row.margins,
    orientation: row.orientation,
    fontFamily: row.font_family,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default function Documents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeDoc, setActiveDoc] = useState<DocumentData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importedJson, setImportedJson] = useState("");

  // ── Fetch documents from Supabase ──────────────────────────────────────────
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("documents")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(rowToDoc);
    },
    enabled: !!user,
  });

  // ── Upsert (create or update) ──────────────────────────────────────────────
  const upsertMutation = useMutation({
    mutationFn: async (doc: DocumentData) => {
      const isExisting = documents.some(d => d.id === doc.id);
      const { error } = await (supabase as any).from("documents").upsert({
        id: doc.id,
        user_id: user!.id,
        title: doc.title,
        content: doc.content,
        letterhead: doc.letterhead ?? false,
        watermark: doc.watermark ?? false,
        watermark_opacity: doc.watermarkOpacity ?? 0.05,
        margins: doc.margins ?? "normal",
        orientation: doc.orientation ?? "portrait",
        font_family: doc.fontFamily ?? "'Outfit', sans-serif",
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      await logAction(isExisting ? "UPDATE" : "CREATE", "Document", doc.id, { title: doc.title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: () => toast.error("Failed to save document."),
  });

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const targetDoc = documents.find(d => d.id === id);
      const { error } = await (supabase as any).from("documents").delete().eq("id", id);
      if (error) throw error;
      await logAction("DELETE", "Document", id, { title: targetDoc?.title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: () => toast.error("Failed to delete document."),
  });

  // ── Create new document from template ─────────────────────────────────────
  const handleCreateDocument = async (templateId: string) => {
    const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
    const now = new Date().toISOString();
    const newDoc: DocumentData = {
      id: `doc-${Date.now()}`,
      title: templateId === "blank" ? "Untitled Document" : `New ${template.name}`,
      content: template.content,
      letterhead: templateId !== "blank",
      watermark: templateId !== "blank",
      watermarkOpacity: 0.05,
      margins: "normal",
      orientation: "portrait",
      fontFamily: "'Outfit', sans-serif",
      createdAt: now,
      updatedAt: now,
    };
    await upsertMutation.mutateAsync(newDoc);
    toast.success(`Created "${newDoc.title}"`);
    setActiveDoc(newDoc);
  };

  // ── Save (from editor) ─────────────────────────────────────────────────────
  const handleSaveDocument = async (updatedDoc: DocumentData) => {
    await upsertMutation.mutateAsync(updatedDoc);
    toast.success("Document saved");
  };

  // ── Duplicate ──────────────────────────────────────────────────────────────
  const handleDuplicateDocument = async (docToDup: DocumentData, e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date().toISOString();
    const dup: DocumentData = { ...docToDup, id: `doc-${Date.now()}`, title: `${docToDup.title} (Copy)`, createdAt: now, updatedAt: now };
    await upsertMutation.mutateAsync(dup);
    toast.success(`Duplicated "${docToDup.title}"`);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDeleteDocument = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteMutation.mutate(id);
      if (activeDoc?.id === id) setActiveDoc(null);
      toast.success(`Deleted "${title}"`);
    }
  };

  // ── Import JSON ────────────────────────────────────────────────────────────
  const handleImportJSON = async () => {
    try {
      const parsed = JSON.parse(importedJson);
      if (!parsed.title || !parsed.content) throw new Error("Missing title/content");
      const now = new Date().toISOString();
      const newDoc: DocumentData = {
        id: `doc-${Date.now()}`,
        title: parsed.title,
        content: parsed.content,
        letterhead: parsed.letterhead ?? true,
        watermark: parsed.watermark ?? true,
        watermarkOpacity: parsed.watermarkOpacity ?? 0.05,
        margins: parsed.margins ?? "normal",
        orientation: parsed.orientation ?? "portrait",
        fontFamily: parsed.fontFamily ?? "'Outfit', sans-serif",
        createdAt: now,
        updatedAt: now,
      };
      await upsertMutation.mutateAsync(newDoc);
      setImportedJson("");
      setImportDialogOpen(false);
      toast.success(`Imported "${newDoc.title}"`);
    } catch {
      toast.error("Failed to import. Ensure the JSON is a valid document backup.");
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalCount = documents.length;
  const modifiedToday = documents.filter(d => {
    return new Date(d.updatedAt).toDateString() === new Date().toDateString();
  }).length;

  const filteredDocuments = documents.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Active editor view ─────────────────────────────────────────────────────
  if (activeDoc) {
    return (
      <div className="py-2 print:p-0">
        <RichTextEditor
          initialData={activeDoc}
          onSave={handleSaveDocument}
          onBack={() => {
            queryClient.invalidateQueries({ queryKey: ["documents"] });
            setActiveDoc(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-white/90">
            Documents Hub
          </h1>
          <p className="text-xs text-white/40 mt-0.5">
            Create, format, and manage business agreements, letters, and quotes. Synced across all devices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-2xl gap-2 font-semibold border-border/80 hover:bg-muted">
                <Upload className="h-4 w-4" />
                Import JSON
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>Import Document</DialogTitle>
                <DialogDescription>
                  Paste the JSON backup string of a previously exported document.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <textarea
                  className="w-full h-40 p-3 text-xs bg-muted/50 border border-border/80 rounded-xl outline-none font-mono focus:border-primary focus:bg-background transition-all"
                  placeholder='{"title": "My Agreement", "content": "<p>...</p>", ...}'
                  value={importedJson}
                  onChange={(e) => setImportedJson(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleImportJSON} disabled={!importedJson.trim()}>Import</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            onClick={() => handleCreateDocument("blank")}
            className="rounded-2xl gap-2 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/35 transition-all"
          >
            <Plus className="h-4 w-4" />
            New Document
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-none shadow-sm stat-card">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest flex items-center gap-1.5">
                <FolderOpen className="h-3 w-3 text-violet-500" />
                Total Documents
              </span>
              <p className="text-3xl font-black text-foreground">{isLoading ? "…" : totalCount}</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-violet-500/10 flex items-center justify-center shrink-0">
              <File className="h-5 w-5 text-violet-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm stat-card">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-emerald-500" />
                Modified Today
              </span>
              <p className="text-3xl font-black text-foreground">{isLoading ? "…" : modifiedToday}</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm stat-card">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Preloaded Presets
              </span>
              <p className="text-3xl font-black text-foreground">{TEMPLATES.length}</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Start from Template */}
      <Card className="rounded-3xl border-border/60 bg-gradient-to-br from-card to-card/50 overflow-hidden shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground/80 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
            Start with a Premium Template
          </CardTitle>
          <CardDescription className="text-xs">
            Generate standard documents in seconds pre-formatted for Abuja Best Cars.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="flex overflow-x-auto gap-3 pb-2 sm:grid sm:grid-cols-3 lg:grid-cols-5 custom-scrollbar">
            {TEMPLATES.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => handleCreateDocument(t.id)}
                  className="p-4 text-left rounded-2xl border border-border/40 hover:bg-primary/5 hover:border-primary/30 transition-all duration-300 flex flex-col justify-between h-36 group relative overflow-hidden shrink-0 w-44 sm:w-auto"
                >
                  <div className="space-y-2">
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${t.color}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                        {t.name}
                      </h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                        {t.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                    Create <ChevronRight className="h-3 w-3" />
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Search and Table Card */}
      <Card className="rounded-3xl border-border/60 shadow-sm overflow-hidden bg-card">
        <CardHeader className="pb-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-black uppercase tracking-wider text-foreground">
              Saved Documents
            </CardTitle>
            <CardDescription className="text-xs">
              Cloud-synced — visible on all your devices when logged in.
            </CardDescription>
          </div>

          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search documents by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-xl text-xs bg-muted/30 border-border/60"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />)}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-4">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <FolderOpen className="h-6 w-6" />
              </div>
              <div className="space-y-1.5 max-w-sm mx-auto">
                <h3 className="text-sm font-bold text-foreground">No documents found</h3>
                <p className="text-xs text-muted-foreground">
                  {searchQuery ? "No matches found for your search query. Try another keyword." : "Create your first document using the templates above or start with a blank page."}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b">
                    <TableHead className="font-bold text-xs uppercase tracking-wider py-4 pl-6 text-muted-foreground">Title</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider py-4 text-muted-foreground hidden sm:table-cell">Configuration</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider py-4 text-muted-foreground hidden md:table-cell">Last Modified</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider py-4 pr-6 text-right text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow
                      key={doc.id}
                      onClick={() => setActiveDoc(doc)}
                      className="cursor-pointer hover:bg-muted/30 border-b border-border/40 transition-colors group"
                    >
                      <TableCell className="py-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-primary/5 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                            <File className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors block">
                              {doc.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground block mt-0.5 font-medium sm:hidden">
                              Modified {new Date(doc.updatedAt).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] text-muted-foreground hidden sm:block mt-0.5 font-medium">
                              Created on {new Date(doc.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1.5">
                          {doc.letterhead && (
                            <span className="text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Letterhead
                            </span>
                          )}
                          {doc.watermark && (
                            <span className="text-[9px] font-semibold bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Watermark
                            </span>
                          )}
                          <span className="text-[9px] font-semibold bg-slate-500/10 text-slate-600 px-2 py-0.5 rounded-full uppercase tracking-wider capitalize">
                            {doc.orientation}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(doc.updatedAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short"
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setActiveDoc(doc)}
                            className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Edit Document"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDoc(doc);
                              logAction("PRINT", "Document", doc.id, { title: doc.title, ref: doc.title });
                              setTimeout(() => window.print(), 500);
                            }}
                            className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Print Document"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDuplicateDocument(doc, e)}
                            className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Duplicate Document"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDeleteDocument(doc.id, doc.title, e)}
                            className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="Delete Document"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
