import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, List, ListOrdered, Table, Image,
  Undo2, Redo2, Type, Eraser,
  Printer, Download, FileJson, Sparkles, Check, ChevronDown,
  Plus, Trash2, Settings, Minimize2, Maximize2,
  FileText, FilePlus, X, Paintbrush, SquareDashed,
  Palette, Frame, Layers, MousePointer2, PenLine, GripVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { PrintHeader } from "@/components/PrintHeader";
import logo from "@/assets/logo.png";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { logAction } from "@/lib/logger";

/* ─────────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────────── */

export interface DocumentData {
  id: string;
  title: string;
  content: string; // JSON.stringify(PageItem[])
  letterhead: boolean;
  watermark: boolean;
  watermarkOpacity: number;
  margins: "normal" | "narrow" | "wide";
  orientation: "portrait" | "landscape";
  fontFamily: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageBorder {
  enabled: boolean;
  color: string;
  thickness: number;   // px
  offset: number;      // px inset from page edge
  style: "solid" | "double" | "dashed" | "dotted" | "groove" | "ridge";
  radius: number;      // px corner radius
}

export interface PageBackground {
  type: "white" | "color" | "gradient";
  color: string;
  gradient: string; // CSS gradient string
}

export interface PageConfig {
  letterhead: boolean;
  watermark: boolean;
  watermarkOpacity: number;
  border: PageBorder;
  background: PageBackground;
  isCover: boolean; // cover/design mode
}

export interface PageItem {
  content: string;
  config: PageConfig;
}

interface RichTextEditorProps {
  initialData: DocumentData;
  onSave: (data: DocumentData) => void;
  onBack: () => void;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Default factory helpers
───────────────────────────────────────────────────────────────────────────── */

function defaultPageConfig(overrides?: Partial<PageConfig>): PageConfig {
  return {
    letterhead: true,
    watermark: false,
    watermarkOpacity: 0.05,
    border: {
      enabled: false,
      color: "#1e3a5f",
      thickness: 4,
      offset: 12,
      style: "solid",
      radius: 0,
    },
    background: {
      type: "white",
      color: "#ffffff",
      gradient: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
    },
    isCover: false,
    ...overrides,
  };
}

function defaultPage(content = "<p>Start typing your document here...</p>"): PageItem {
  return { content, config: defaultPageConfig() };
}

function parsePages(raw: string): PageItem[] {
  if (!raw) return [defaultPage()];
  try {
    const parsed = JSON.parse(raw);
    // New format: PageItem[]
    if (Array.isArray(parsed) && parsed.length > 0 && "config" in parsed[0]) {
      return parsed as PageItem[];
    }
    // Old format: string[]
    if (Array.isArray(parsed) && parsed.length > 0) {
      return (parsed as string[]).map((c, i) =>
        defaultPage(c) // first page keeps letterhead default, rest get letterhead: false
      );
    }
    // Legacy: plain HTML string
    if (typeof parsed === "string" && parsed.trim()) {
      return [defaultPage(parsed)];
    }
  } catch {
    if (raw.trim() && !raw.startsWith("[")) {
      return [defaultPage(raw)];
    }
  }
  return [defaultPage()];
}

/* ─────────────────────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────────────────────── */

const FONTS = [
  { name: "Outfit (Modern)", value: "'Outfit', sans-serif" },
  { name: "Inter (Clean)", value: "'Inter', sans-serif" },
  { name: "Serif (Georgia)", value: "Georgia, serif" },
  { name: "Monospace (Courier)", value: "'Courier New', Courier, monospace" },
  { name: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { name: "Arial (Standard)", value: "Arial, Helvetica, sans-serif" },
];

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px", "48px"];

const BORDER_STYLES = [
  { label: "Solid", value: "solid" },
  { label: "Double", value: "double" },
  { label: "Dashed", value: "dashed" },
  { label: "Dotted", value: "dotted" },
  { label: "Groove", value: "groove" },
  { label: "Ridge", value: "ridge" },
] as const;

const GRADIENT_PRESETS = [
  { label: "Soft Gray", value: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)" },
  { label: "Blue Frost", value: "linear-gradient(135deg, #e8f4fd 0%, #d1ecf1 100%)" },
  { label: "Gold Dawn", value: "linear-gradient(135deg, #fff9e6 0%, #ffeaa7 100%)" },
  { label: "Night Sky", value: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" },
  { label: "Forest", value: "linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)" },
  { label: "Rose", value: "linear-gradient(135deg, #fde8e8 0%, #f5c6cb 100%)" },
  { label: "Purple Rain", value: "linear-gradient(135deg, #e8d5f5 0%, #d1b3e8 100%)" },
  { label: "Ocean", value: "linear-gradient(180deg, #1a6b9a 0%, #0d4a7a 100%)" },
];

const TEMPLATES = [
  {
    id: "blank", name: "Blank Document", description: "Start from scratch.",
    content: `<p>Start typing your document here...</p>`
  },
  {
    id: "sales-agreement", name: "Vehicle Sales Agreement", description: "Standard vehicle purchase contract.",
    content: `<h1 style="text-align:center;color:#1e293b;margin-bottom:24px;">VEHICLE SALES AGREEMENT</h1><p style="text-align:justify;margin-bottom:16px;">This Vehicle Sales Agreement is entered into this <strong><u>[DAY]</u></strong> day of <strong><u>[MONTH]</u></strong>, <strong><u>[YEAR]</u></strong>, by and between:</p><p style="margin-bottom:8px;"><strong>SELLER:</strong> Abuja Best Cars Ltd., Katampe Bridge, Beside Affin Filling Station, Abuja.</p><p style="margin-bottom:20px;"><strong>BUYER:</strong> ____________________________________________________________________</p><h2 style="color:#334155;margin-top:24px;margin-bottom:12px;border-bottom:1px solid #cbd5e1;padding-bottom:4px;">1. VEHICLE DESCRIPTION</h2><table style="width:100%;border-collapse:collapse;margin-bottom:24px;"><tbody><tr><td style="border:1px solid #cbd5e1;padding:8px;font-weight:bold;background:#f8fafc;">Make</td><td style="border:1px solid #cbd5e1;padding:8px;">[Make]</td><td style="border:1px solid #cbd5e1;padding:8px;font-weight:bold;background:#f8fafc;">Model</td><td style="border:1px solid #cbd5e1;padding:8px;">[Model]</td></tr><tr><td style="border:1px solid #cbd5e1;padding:8px;font-weight:bold;background:#f8fafc;">Year</td><td style="border:1px solid #cbd5e1;padding:8px;">[Year]</td><td style="border:1px solid #cbd5e1;padding:8px;font-weight:bold;background:#f8fafc;">Color</td><td style="border:1px solid #cbd5e1;padding:8px;">[Color]</td></tr><tr><td style="border:1px solid #cbd5e1;padding:8px;font-weight:bold;background:#f8fafc;">VIN / Chassis</td><td style="border:1px solid #cbd5e1;padding:8px;">[Chassis]</td><td style="border:1px solid #cbd5e1;padding:8px;font-weight:bold;background:#f8fafc;">Mileage</td><td style="border:1px solid #cbd5e1;padding:8px;">[km]</td></tr></tbody></table><h2 style="color:#334155;margin-top:24px;margin-bottom:12px;border-bottom:1px solid #cbd5e1;padding-bottom:4px;">2. PURCHASE PRICE</h2><p style="margin-bottom:16px;">Total: <strong><u>NGN [PRICE]</u></strong> Payment via Bank Transfer / Cash.</p><h2 style="color:#334155;margin-top:24px;margin-bottom:12px;border-bottom:1px solid #cbd5e1;padding-bottom:4px;">3. WARRANTY</h2><p style="margin-bottom:24px;">Vehicle is sold <strong>"AS IS"</strong> without warranty unless otherwise specified in writing.</p><h2 style="color:#334155;margin-top:24px;margin-bottom:12px;border-bottom:1px solid #cbd5e1;padding-bottom:4px;">SIGNATURES</h2><table style="width:100%;border-collapse:collapse;margin-top:32px;border:none;"><tbody><tr style="border:none;"><td style="border:none;padding:12px;width:45%;vertical-align:top;"><p style="margin-bottom:40px;">For: <strong>Abuja Best Cars Ltd.</strong></p><div style="border-top:1px solid #000;padding-top:4px;">Authorized Signature &amp; Stamp<br><span style="font-size:11px;color:#64748b;">Date: ____ / ____ / ________</span></div></td><td style="border:none;width:10%;"></td><td style="border:none;padding:12px;width:45%;vertical-align:top;"><p style="margin-bottom:40px;"><strong>BUYER</strong></p><div style="border-top:1px solid #000;padding-top:4px;">Signature &amp; Full Name<br><span style="font-size:11px;color:#64748b;">Date: ____ / ____ / ________</span></div></td></tr></tbody></table>`
  },
  {
    id: "business-letter", name: "Official Business Letter", description: "Standard business letter.",
    content: `<p style="text-align:right;margin-bottom:24px;">Date: ${new Date().toLocaleDateString()}</p><p style="margin-bottom:20px;">To:<br><strong>The Managing Director</strong><br>[Recipient Company]<br>Abuja, Nigeria.</p><p style="margin-bottom:20px;">Dear Sir/Ma,</p><p style="margin-bottom:16px;font-weight:bold;text-decoration:underline;text-transform:uppercase;">RE: INTRODUCTORY PROPOSAL FOR FLEET MAINTENANCE SERVICES</p><p style="text-align:justify;margin-bottom:16px;">We write to formally introduce <strong>Abuja Best Cars Ltd.</strong>, a premier automotive repair and maintenance workshop in Katampe, Abuja.</p><p style="text-align:justify;margin-bottom:24px;">We look forward to an opportunity to present a detailed proposal. Thank you for your time and consideration.</p><p style="margin-bottom:40px;">Yours Faithfully,<br><br><br><strong>Engr. Beatrice T.</strong><br>General Manager, Abuja Best Cars Ltd.</p>`
  },
  {
    id: "proforma-quote", name: "Proforma Invoice", description: "Billing quotation & invoice template.",
    content: `<h1 style="text-align:center;color:#1e293b;margin-bottom:4px;">PROFORMA INVOICE</h1><p style="text-align:center;color:#64748b;margin-bottom:24px;">Invoice No: BT-PI-${Math.floor(1000 + Math.random() * 9000)} | Date: ${new Date().toLocaleDateString()}</p><h2 style="color:#334155;margin-top:24px;margin-bottom:12px;border-bottom:1px solid #cbd5e1;padding-bottom:4px;">INVOICED ITEMS / SERVICES</h2><table style="width:100%;border-collapse:collapse;margin-bottom:24px;"><thead><tr style="background:#f8fafc;"><th style="border:1px solid #cbd5e1;padding:10px;">S/N</th><th style="border:1px solid #cbd5e1;padding:10px;">Description</th><th style="border:1px solid #cbd5e1;padding:10px;text-align:center;">Qty</th><th style="border:1px solid #cbd5e1;padding:10px;text-align:right;">Unit Price (NGN)</th><th style="border:1px solid #cbd5e1;padding:10px;text-align:right;">Total (NGN)</th></tr></thead><tbody><tr><td style="border:1px solid #cbd5e1;padding:10px;text-align:center;">1</td><td style="border:1px solid #cbd5e1;padding:10px;">Vehicle Inspection</td><td style="border:1px solid #cbd5e1;padding:10px;text-align:center;">1</td><td style="border:1px solid #cbd5e1;padding:10px;text-align:right;">35,000.00</td><td style="border:1px solid #cbd5e1;padding:10px;text-align:right;">35,000.00</td></tr><tr style="background:#f1f5f9;"><td colspan="3" style="border:none;padding:10px;text-align:right;font-weight:bold;font-size:16px;">TOTAL</td><td colspan="2" style="border:1px solid #cbd5e1;padding:10px;text-align:right;font-weight:bold;font-size:16px;">35,000.00</td></tr></tbody></table><h2 style="color:#334155;margin-bottom:8px;">BANKING DETAILS</h2><p><strong>Bank:</strong> Access Bank Plc | <strong>Account:</strong> Abuja Best Cars Ltd. | <strong>No:</strong> 0077777211</p>`
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   DocumentPage Component
───────────────────────────────────────────────────────────────────────────── */

interface DocumentPageProps {
  index: number;
  total: number;
  page: PageItem;
  activeFont: string;
  isActive: boolean;
  globalMargins: "normal" | "narrow" | "wide";
  globalOrientation: "portrait" | "landscape";
  onContentChange: (index: number, html: string) => void;
  onDeletePage: (index: number) => void;
  onKeyDown: (index: number, e: React.KeyboardEvent<HTMLDivElement>) => void;
  onActivate: (index: number) => void;
  editorRef: React.RefCallback<HTMLDivElement>;
}

function DocumentPage({
  index, total, page, activeFont, isActive,
  globalMargins, globalOrientation,
  onContentChange, onDeletePage, onKeyDown, onActivate, editorRef
}: DocumentPageProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const { config } = page;
  const isPortrait = globalOrientation === "portrait";

  // Set initial HTML once on mount
  useEffect(() => {
    if (innerRef.current && innerRef.current.innerHTML !== page.content) {
      innerRef.current.innerHTML = page.content || "<p><br></p>";
    }
  }, []);

  const handleInput = () => {
    if (innerRef.current) onContentChange(index, innerRef.current.innerHTML);
  };

  // Build page background style
  const bgStyle: React.CSSProperties = (() => {
    switch (config.background.type) {
      case "color": return { background: config.background.color };
      case "gradient": return { background: config.background.gradient };
      default: return { background: "#ffffff" };
    }
  })();

  // Build border overlay style
  const borderStyle: React.CSSProperties = config.border.enabled ? {
    position: "absolute",
    top: config.border.offset,
    left: config.border.offset,
    right: config.border.offset,
    bottom: config.border.offset,
    border: `${config.border.thickness}px ${config.border.style} ${config.border.color}`,
    borderRadius: config.border.radius,
    pointerEvents: "none",
    zIndex: 5,
  } : {};

  // Text color: auto dark/light based on background for covers
  const textColor = config.isCover && config.background.type !== "white"
    ? (config.background.color === "#ffffff" ? "#000000" : "inherit")
    : "inherit";

  return (
    <div
      id={`page-wrapper-${index}`}
      className="relative group/page"
      style={{ marginBottom: "32px" }}
      onClick={() => onActivate(index)}
    >
      {/* Page selector ring */}
      <div
        className={`absolute -inset-1 rounded-sm pointer-events-none transition-all duration-200 print-hidden-controls ${isActive ? "ring-2 ring-primary ring-offset-2" : "ring-0"}`}
      />

      {/* Floating controls (right side) */}
      <div
        className="absolute -right-1 top-2 flex flex-col gap-1.5 z-40 opacity-0 group-hover/page:opacity-100 transition-opacity print-hidden-controls"
        style={{ transform: "translateX(calc(100% + 4px))" }}
      >
        <div className={`px-2 py-1 rounded-lg text-[10px] font-bold text-center min-w-[52px] shadow ${isActive ? "bg-primary text-primary-foreground" : "bg-slate-700 text-white"}`}>
          {config.isCover ? "Cover" : `Page ${index + 1}`}
        </div>
        {total > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); onDeletePage(index); }}
            className="flex items-center justify-center h-7 w-7 rounded-lg bg-red-500/90 hover:bg-red-600 text-white shadow transition-colors"
            title={`Delete page ${index + 1}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* The A4 page */}
      <div
        id={`document-page-${index}`}
        style={{ fontFamily: activeFont, ...bgStyle }}
        className={`
          text-black shadow-xl rounded-sm border transition-all duration-200 relative flex flex-col select-text overflow-hidden
          ${isPortrait ? "w-[210mm] min-h-[297mm]" : "w-[297mm] min-h-[210mm]"}
          ${isActive ? "border-primary/30" : "border-neutral-200"}
          margin-${globalMargins}
        `}
      >
        {/* Border overlay */}
        {config.border.enabled && <div style={borderStyle} className="print-border-overlay" />}

        {/* Watermark */}
        {config.watermark && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 fixed-watermark"
            style={{ opacity: config.watermarkOpacity }}
          >
            <img
              src={logo} alt="Watermark"
              className="w-[550px] h-[550px] object-contain max-w-[90%] max-h-[90%]"
            />
          </div>
        )}

        {/* Letterhead */}
        {config.letterhead && (
          <div className="relative z-10 shrink-0 border-b border-slate-200 pb-4 mb-6">
            <PrintHeader />
          </div>
        )}

        {/* Cover mode: design overlay label */}
        {config.isCover && (
          <div className="absolute top-3 right-3 z-20 print-hidden-controls">
            <span className="text-[9px] font-bold uppercase tracking-widest bg-amber-400/90 text-amber-900 px-2 py-0.5 rounded-full">
              Cover Page
            </span>
          </div>
        )}

        {/* Content */}
        <div
          ref={(el) => {
            (innerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
            editorRef(el);
          }}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onMouseUp={() => onActivate(index)}
          onKeyUp={() => onActivate(index)}
          onKeyDown={(e) => onKeyDown(index, e)}
          onClick={(e) => { e.stopPropagation(); onActivate(index); }}
          data-page-index={index}
          className={`flex-1 outline-none relative z-10 editor-content focus:outline-none ${config.isCover ? "flex flex-col items-center justify-center text-center" : ""}`}
          style={{
            fontFamily: activeFont,
            color: textColor,
            minHeight: config.isCover ? "180mm" : "100px",
          }}
        />

        {/* Page footer */}
        <div
          className="relative z-10 shrink-0 mt-6 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-medium select-none"
          style={{ color: config.isCover && config.background.type !== "white" ? "rgba(255,255,255,0.5)" : undefined }}
        >
          <span>Abuja Best Cars Ltd. © {new Date().getFullYear()}</span>
          <span>{config.isCover ? "Cover" : `Page ${index + 1} of ${total}`}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Per-Page Settings Panel
───────────────────────────────────────────────────────────────────────────── */

interface PageSettingsPanelProps {
  pageIndex: number;
  config: PageConfig;
  onChange: (pageIndex: number, config: PageConfig) => void;
}

function PageSettingsPanel({ pageIndex, config, onChange }: PageSettingsPanelProps) {
  const update = (partial: Partial<PageConfig>) => {
    onChange(pageIndex, { ...config, ...partial });
  };
  const updateBorder = (partial: Partial<PageBorder>) => {
    onChange(pageIndex, { ...config, border: { ...config.border, ...partial } });
  };
  const updateBg = (partial: Partial<PageBackground>) => {
    onChange(pageIndex, { ...config, background: { ...config.background, ...partial } });
  };

  return (
    <div className="flex flex-col gap-4">

      {/* Cover Page toggle */}
      <div className="flex items-center justify-between py-1 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 rounded-xl px-3">
        <div>
          <Label className="text-xs font-bold text-amber-700 dark:text-amber-400">Cover / Design Mode</Label>
          <p className="text-[10px] text-amber-600/70 dark:text-amber-500/70">Center-align content, design front page</p>
        </div>
        <Switch
          checked={config.isCover}
          onCheckedChange={(v) => update({ isCover: v })}
        />
      </div>

      {/* Letterhead */}
      <div className="flex items-center justify-between py-1">
        <div>
          <Label className="text-xs font-semibold">Official Letterhead</Label>
          <p className="text-[10px] text-muted-foreground">Show company header on this page</p>
        </div>
        <Switch checked={config.letterhead} onCheckedChange={(v) => update({ letterhead: v })} />
      </div>

      {/* Watermark */}
      <div className="flex items-center justify-between py-1">
        <div>
          <Label className="text-xs font-semibold">Watermark</Label>
          <p className="text-[10px] text-muted-foreground">Abuja Best Cars logo background</p>
        </div>
        <Switch checked={config.watermark} onCheckedChange={(v) => update({ watermark: v })} />
      </div>
      {config.watermark && (
        <div className="space-y-1.5 bg-muted/30 p-2.5 rounded-lg border border-border/40">
          <div className="flex justify-between text-[10px] font-semibold">
            <span>Watermark Opacity</span>
            <span>{Math.round(config.watermarkOpacity * 100)}%</span>
          </div>
          <Slider
            value={[config.watermarkOpacity]} min={0.01} max={0.25} step={0.01}
            onValueChange={(v) => update({ watermarkOpacity: v[0] })}
          />
        </div>
      )}

      {/* ── Background ── */}
      <div className="space-y-2">
        <Label className="text-xs font-bold flex items-center gap-1.5">
          <Palette className="h-3.5 w-3.5 text-violet-500" />
          Page Background
        </Label>

        <div className="grid grid-cols-3 gap-1">
          {(["white", "color", "gradient"] as const).map(t => (
            <button
              key={t}
              onClick={() => updateBg({ type: t })}
              className={`py-1.5 px-2 rounded-lg border text-[10px] font-semibold capitalize transition-all ${config.background.type === t ? "border-primary bg-primary/10 text-primary" : "border-border/60 hover:bg-muted"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {config.background.type === "color" && (
          <div className="flex items-center gap-2">
            <input
              type="color" value={config.background.color}
              onChange={(e) => updateBg({ color: e.target.value })}
              className="h-8 w-10 rounded cursor-pointer border border-border/60"
            />
            <Input
              value={config.background.color}
              onChange={(e) => updateBg({ color: e.target.value })}
              className="h-8 text-xs font-mono"
              placeholder="#ffffff"
            />
          </div>
        )}

        {config.background.type === "gradient" && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-1.5">
              {GRADIENT_PRESETS.map(g => (
                <button
                  key={g.value}
                  onClick={() => updateBg({ gradient: g.value })}
                  className={`h-10 rounded-lg border-2 text-[9px] font-bold transition-all ${config.background.gradient === g.value ? "border-primary scale-95" : "border-transparent hover:border-border"}`}
                  style={{ background: g.value, color: g.label === "Night Sky" || g.label === "Ocean" ? "#fff" : "#333" }}
                  title={g.label}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <Input
              value={config.background.gradient}
              onChange={(e) => updateBg({ gradient: e.target.value })}
              className="h-8 text-xs font-mono"
              placeholder="linear-gradient(...)"
            />
          </div>
        )}
      </div>

      {/* ── Border Designer ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold flex items-center gap-1.5">
            <Frame className="h-3.5 w-3.5 text-cyan-500" />
            Page Border
          </Label>
          <Switch checked={config.border.enabled} onCheckedChange={(v) => updateBorder({ enabled: v })} />
        </div>

        {config.border.enabled && (
          <div className="space-y-3 bg-muted/30 p-3 rounded-xl border border-border/50">

            {/* Color + style row */}
            <div className="flex items-center gap-2">
              <input
                type="color" value={config.border.color}
                onChange={(e) => updateBorder({ color: e.target.value })}
                className="h-8 w-10 rounded cursor-pointer border border-border/60 shrink-0"
              />
              <select
                value={config.border.style}
                onChange={(e) => updateBorder({ style: e.target.value as PageBorder["style"] })}
                className="flex-1 h-8 rounded-lg border border-border/60 bg-background text-xs px-2 font-semibold"
              >
                {BORDER_STYLES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Thickness */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-semibold">
                <span>Thickness</span>
                <span>{config.border.thickness}px</span>
              </div>
              <Slider
                value={[config.border.thickness]} min={1} max={24} step={1}
                onValueChange={(v) => updateBorder({ thickness: v[0] })}
              />
            </div>

            {/* Offset (position from edge) */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-semibold">
                <span>Position (offset from edge)</span>
                <span>{config.border.offset}px</span>
              </div>
              <Slider
                value={[config.border.offset]} min={0} max={80} step={2}
                onValueChange={(v) => updateBorder({ offset: v[0] })}
              />
            </div>

            {/* Corner radius */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-semibold">
                <span>Corner Radius</span>
                <span>{config.border.radius}px</span>
              </div>
              <Slider
                value={[config.border.radius]} min={0} max={48} step={2}
                onValueChange={(v) => updateBorder({ radius: v[0] })}
              />
            </div>

            {/* Live preview */}
            <div className="mt-2">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Preview:</p>
              <div
                className="w-full h-16 bg-white rounded-sm relative overflow-hidden"
                style={{ background: "#f8f9fa" }}
              >
                <div style={{
                  position: "absolute",
                  top: Math.round(config.border.offset / 4),
                  left: Math.round(config.border.offset / 4),
                  right: Math.round(config.border.offset / 4),
                  bottom: Math.round(config.border.offset / 4),
                  border: `${Math.round(config.border.thickness / 2)}px ${config.border.style} ${config.border.color}`,
                  borderRadius: Math.round(config.border.radius / 2),
                }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main Editor
───────────────────────────────────────────────────────────────────────────── */

export function RichTextEditor({ initialData, onSave, onBack }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef(true);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pages state
  const [pages, setPages] = useState<PageItem[]>(() => parsePages(initialData.content));
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [doc, setDoc] = useState<DocumentData>(initialData);
  const [activeFont, setActiveFont] = useState(initialData.fontFamily);
  const [activeSize, setActiveSize] = useState("16px");
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [textColor, setTextColor] = useState("#000000");
  const [highlightColor, setHighlightColor] = useState("#ffffff");
  const [activePage, setActivePage] = useState(0);
  const [sidebarTab, setSidebarTab] = useState<"document" | "page">("page");

  // Drag and drop state for page rearrangement
  const [draggedPageIndex, setDraggedPageIndex] = useState<number | null>(null);
  const [dragOverPageIndex, setDragOverPageIndex] = useState<number | null>(null);

  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrike, setIsStrike] = useState(false);

  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Persist pages → doc whenever pages change (debounced, skip first render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      updateStats();
      return;
    }
    const serialized = JSON.stringify(pages);
    const updated = { ...doc, content: serialized, updatedAt: new Date().toISOString() };
    setDoc(updated);
    // Debounce save to localStorage — avoids hammering storage on every keystroke
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      onSave(updated);
    }, 1000);
    updateStats();
  }, [pages]);

  /* ── Stats ─────────────────────────────────────────────────────────────── */
  const updateStats = useCallback(() => {
    const all = pageRefs.current.filter(Boolean).map(el => el!.innerText || "").join(" ");
    const clean = all.trim();
    setWordCount(clean === "" ? 0 : clean.split(/\s+/).length);
    setCharCount(all.length);
  }, []);

  /* ── Page management ───────────────────────────────────────────────────── */
  const addPage = () => {
    setPages(prev => [...prev, defaultPage("<p><br></p>")]);
    const newIdx = pages.length;
    setTimeout(() => {
      setActivePage(newIdx);
      pageRefs.current[newIdx]?.focus();
    }, 100);
    toast.success("New page added.");
  };

  const addCoverPage = () => {
    const cover: PageItem = {
      content: `<h1 style="font-size:3rem;font-weight:900;margin-bottom:1rem;">Abuja Best Cars Ltd.</h1><p style="font-size:1.2rem;color:#64748b;">Document Title</p><p style="margin-top:2rem;font-size:0.9rem;">${new Date().toLocaleDateString()}</p>`,
      config: defaultPageConfig({
        letterhead: false,
        isCover: true,
        border: { enabled: true, color: "#1e3a5f", thickness: 6, offset: 16, style: "solid", radius: 0 },
        background: { type: "gradient", color: "#ffffff", gradient: "linear-gradient(180deg, #1a6b9a 0%, #0d4a7a 100%)" },
        watermark: false,
        watermarkOpacity: 0.05,
      }),
    };
    setPages(prev => [cover, ...prev]);
    setTimeout(() => { setActivePage(0); setSidebarTab("page"); }, 50);
    toast.success("Cover page added at the front.");
  };

  const deletePage = (index: number) => {
    if (pages.length <= 1) { toast.error("Cannot delete the only page."); return; }
    setPages(prev => prev.filter((_, i) => i !== index));
    const focusIdx = Math.max(0, index - 1);
    setTimeout(() => { setActivePage(focusIdx); pageRefs.current[focusIdx]?.focus(); }, 100);
    toast.success(`Page ${index + 1} deleted.`);
  };

  /* ── Per-page config update ─────────────────────────────────────────────── */
  const handlePageConfigChange = useCallback((pageIndex: number, newConfig: PageConfig) => {
    setPages(prev => {
      const next = [...prev];
      next[pageIndex] = { ...next[pageIndex], config: newConfig };
      return next;
    });
  }, []);

  /* ── Overflow / auto-pagination ─────────────────────────────────────────── */
  const overflowTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkOverflow = useCallback((pageIndex: number) => {
    if (overflowTimeout.current) clearTimeout(overflowTimeout.current);
    overflowTimeout.current = setTimeout(() => {
      const el = pageRefs.current[pageIndex];
      if (!el) return;
      const maxH = doc.orientation === "portrait" ? 700 : 480;
      if (el.scrollHeight > maxH + 40 && pages.length <= pageIndex + 1) {
        setPages(prev => [...prev, defaultPage("<p><br></p>")]);
        setTimeout(() => {
          const nIdx = pageIndex + 1;
          pageRefs.current[nIdx]?.focus();
          setActivePage(nIdx);
        }, 80);
        toast.info("New page added automatically.", { duration: 2000 });
      }
    }, 300);
  }, [doc.orientation, pages.length]);

  /* ── Content change ─────────────────────────────────────────────────────── */
  const handleContentChange = useCallback((index: number, html: string) => {
    setPages(prev => {
      const next = [...prev];
      next[index] = { ...next[index], content: html };
      return next;
    });
    updateStats();
    checkOverflow(index);
  }, [updateStats, checkOverflow]);

  const handlePageKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") checkOverflow(index);
  }, [checkOverflow]);

  /* ── Global doc settings ────────────────────────────────────────────────── */
  const updateDoc = (fields: Partial<DocumentData>) => {
    const updated = { ...doc, ...fields, updatedAt: new Date().toISOString() };
    setDoc(updated);
    onSave({ ...updated, content: JSON.stringify(pages) });
  };

  /* ── Drag and Drop Rearrangement ───────────────────────────────────────── */
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedPageIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverPageIndex(index);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedPageIndex === null || draggedPageIndex === dropIndex) return;

    setPages((prev) => {
      const newPages = [...prev];
      const draggedItem = newPages.splice(draggedPageIndex, 1)[0];
      newPages.splice(dropIndex, 0, draggedItem);
      return newPages;
    });

    if (activePage === draggedPageIndex) setActivePage(dropIndex);
    else if (draggedPageIndex < activePage && dropIndex >= activePage) setActivePage(activePage - 1);
    else if (draggedPageIndex > activePage && dropIndex <= activePage) setActivePage(activePage + 1);

    setDraggedPageIndex(null);
    setDragOverPageIndex(null);
  };
  const handleDragEnd = () => {
    setDraggedPageIndex(null);
    setDragOverPageIndex(null);
  };

  /* ── execCmd ────────────────────────────────────────────────────────────── */
  const execCmd = (cmd: string, val = "") => {
    document.execCommand(cmd, false, val);
    updateToolbarStates();
    pageRefs.current[activePage]?.focus();
  };
  const updateToolbarStates = () => {
    setIsBold(document.queryCommandState("bold"));
    setIsItalic(document.queryCommandState("italic"));
    setIsUnderline(document.queryCommandState("underline"));
    setIsStrike(document.queryCommandState("strikeThrough"));
  };

  /* ── Template loading ───────────────────────────────────────────────────── */
  const loadTemplate = (content: string) => {
    if (!confirm("This will replace all pages with this template.")) return;
    const newPages = [{ ...defaultPage(content) }];
    setPages(newPages);
    setTimeout(() => { const el = pageRefs.current[0]; if (el) { el.innerHTML = content; el.focus(); } }, 50);
    toast.success("Template loaded!");
  };

  /* ── Print / PDF ────────────────────────────────────────────────────────── */
  const handlePrint = () => {
    // Convert logo to base64 so it renders in popup window
    const toBase64 = (url: string): Promise<string> => new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL("image/png")); }
        else resolve(url);
      };
      img.onerror = () => resolve(url);
      img.src = url;
    });

    toBase64(logo).then((logoBase64) => {
      const HEADER_BLUE = "#1D325F";

      const getHeaderHTML = () => `
        <div style="display:flex;align-items:center;justify-content:flex-start;padding-bottom:12px;margin-bottom:8px;border-bottom:2px solid #ccc;position:relative;">
          <div style="position:absolute;top:0;right:0;font-size:12px;font-weight:600;color:#555;">RC 1907711</div>
          <img src="${logoBase64}" style="width:90px;height:90px;object-fit:contain;margin-right:20px;" />
          <div style="flex:1;display:flex;flex-direction:column;align-items:flex-start;">
            <h1 style="font-family:'Arial Black',sans-serif;font-weight:900;font-size:34px;margin:0;color:#C0392B;text-transform:uppercase;letter-spacing:-1px;line-height:1.1;">
              ABUJA BEST CARS
            </h1>
            <div style="margin-top:4px;width:100%;text-align:left;font-size:11px;color:#333;">
              <span>&#x1F4CD; 38 Gana St, Maitama, Abuja 904101, FCT.</span>
              <span style="margin-left:12px;">| Workspace Business Hub, Transcorp Hilton, Abuja FCT.</span>
            </div>
            <div style="margin-top:2px;width:100%;text-align:left;font-size:11px;color:#333;">
              <span>&#x1F4DE; 0703 933 7459</span>
              <span style="margin-left:12px;">&#x1F4F7; @abujabestcars</span>
              <span style="margin-left:12px;">&#x2709; <span style="color:#2563eb;font-style:italic;text-decoration:underline;">abujabestcars@gmail.com</span></span>
            </div>
          </div>
        </div>`;

      const getWatermarkHTML = () => `
        <div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0;user-select:none;">
          <img src="${logoBase64}" style="width:520px;height:520px;max-width:88%;max-height:88%;object-fit:contain;opacity:0.13;" />
        </div>`;

      const marginMap: Record<string, string> = {
        normal: "25.4mm 25.4mm",
        narrow: "12.7mm 12.7mm",
        wide:   "25.4mm 38.1mm",
      };
      const pagePadding = marginMap[doc.margins] || "25.4mm 25.4mm";

      // Build HTML for each page
      const pagesHTML = pages.map((page, i) => {
        const cfg = page.config;
        const isLast = i === pages.length - 1;

        // Background style
        let bgStyle = "background:#fff;";
        if (cfg.background.type === "color") bgStyle = `background:${cfg.background.color};`;
        else if (cfg.background.type === "gradient") bgStyle = `background:${cfg.background.gradient};`;

        // Border overlay
        const borderHTML = cfg.border.enabled ? `
          <div style="position:absolute;top:${cfg.border.offset}px;left:${cfg.border.offset}px;right:${cfg.border.offset}px;bottom:${cfg.border.offset}px;
            border:${cfg.border.thickness}px ${cfg.border.style} ${cfg.border.color};border-radius:${cfg.border.radius}px;pointer-events:none;z-index:5;"></div>` : "";

        // Get content from live DOM (captures user edits)
        const liveEl = document.getElementById(`document-page-${i}`);
        const contentEl = liveEl?.querySelector("[data-page-index]") as HTMLElement | null;
        const content = contentEl ? contentEl.innerHTML : page.content;

        // Page footer
        const footerHTML = `
          <div style="position:relative;z-index:10;margin-top:24px;padding-top:10px;border-top:1px solid #f1f5f9;
            display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8;font-weight:600;">
            <span>Abuja Best Cars Ltd. &copy; ${new Date().getFullYear()}</span>
            <span>${cfg.isCover ? "Cover" : `Page ${i + 1} of ${pages.length}`}</span>
          </div>`;

        return `
          <div style="position:relative;width:210mm;min-height:297mm;padding:${pagePadding};
            ${bgStyle}
            box-sizing:border-box;
            ${isLast ? "" : "page-break-after:always;break-after:page;"}
            -webkit-print-color-adjust:exact;print-color-adjust:exact;
            font-family:${activeFont};color:#000;margin:0 auto;">
            ${borderHTML}
            ${cfg.watermark ? getWatermarkHTML() : ""}
            <div style="position:relative;z-index:10;display:flex;flex-direction:column;min-height:calc(297mm - ${pagePadding.split(" ")[0]} * 2);">
              ${cfg.letterhead ? getHeaderHTML() : ""}
              <div style="flex:1;font-family:${activeFont};font-size:14px;line-height:1.6;color:inherit;">
                ${content}
              </div>
              ${footerHTML}
            </div>
          </div>`;
      }).join("\n");

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${doc.title || "Document"}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #fff; font-family: Arial, sans-serif; }
    h1, h2, h3 { margin-top: 0; }
    p { margin: 0 0 0.5rem; line-height: 1.6; }
    ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
    ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1rem; }
    li { margin-bottom: 0.25rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 14px; }
    td, th { border: 1px solid #cbd5e1; padding: 8px 12px; }
    th { background-color: #f8fafc; font-weight: 600; }
    blockquote { border-left: 4px solid #cbd5e1; padding-left: 1rem; color: #64748b; font-style: italic; margin: 1.5rem 0; }
    img { max-width: 100%; height: auto; }
    @media print {
      @page { margin: 0; size: A4; }
      body { margin: 0; padding: 0; }
    }
  </style>
</head>
<body>
  ${pagesHTML}
</body>
</html>`;

      const win = window.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
        logAction("PRINT", "Document", doc.id, { title: doc.title, ref: doc.title, pages: pages.length });
        setTimeout(() => { win.focus(); win.print(); }, 600);
      }
    });
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    toast.info("Preparing PDF...");
    logAction("EXPORT", "Document", doc.id, { title: doc.title, format: "PDF", ref: doc.title });
    try {
      const pdf = new jsPDF({ orientation: doc.orientation, unit: "mm", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      for (let i = 0; i < pages.length; i++) {
        const el = document.getElementById(`document-page-${i}`);
        if (!el) continue;
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: true, logging: false });
        const imgData = canvas.toDataURL("image/png");
        const ratio = Math.min(pw / canvas.width, ph / canvas.height);
        const w = canvas.width * ratio, h = canvas.height * ratio;
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", (pw - w) / 2, 0, w, h);
      }
      pdf.save(`${doc.title.replace(/\s+/g, "_")}.pdf`);
      toast.success("PDF exported!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = () => {
    logAction("EXPORT", "Document", doc.id, { title: doc.title, format: "JSON", ref: doc.title });
    const exportDoc = { ...doc, content: JSON.stringify(pages) };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportDoc, null, 2));
    const a = document.createElement("a");
    a.href = dataStr; a.download = `${doc.title.replace(/\s+/g, "_")}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    toast.success("Exported as JSON.");
  };

  /* ── Table / Image ──────────────────────────────────────────────────────── */
  const handleInsertTable = () => {
    setTableModalOpen(false);
    const table = document.createElement("table");
    table.style.cssText = "width:100%;border-collapse:collapse;margin:16px 0;";
    const tbody = document.createElement("tbody");
    for (let r = 0; r < tableRows; r++) {
      const tr = document.createElement("tr");
      for (let c = 0; c < tableCols; c++) {
        const td = document.createElement("td");
        td.style.cssText = "border:1px solid #cbd5e1;padding:10px;";
        td.innerHTML = "<br>"; tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents(); range.insertNode(table);
      const fc = table.querySelector("td");
      if (fc) { const nr = document.createRange(); nr.setStart(fc, 0); nr.collapse(true); sel.removeAllRanges(); sel.addRange(nr); }
    }
    updateStats();
  };

  const handleInsertImageUrl = () => {
    setImageModalOpen(false);
    if (!imageUrl) return;
    const img = document.createElement("img");
    img.src = imageUrl; img.style.cssText = "max-width:100%;height:auto;display:block;margin:16px auto;border-radius:8px;";
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) { const r = sel.getRangeAt(0); r.deleteContents(); r.insertNode(img); }
    setImageUrl(""); updateStats();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = document.createElement("img");
      img.src = ev.target?.result as string;
      img.style.cssText = "max-width:100%;height:auto;display:block;margin:16px auto;border-radius:8px;";
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) { const r = sel.getRangeAt(0); r.deleteContents(); r.insertNode(img); }
      updateStats();
    };
    reader.readAsDataURL(file);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Render
  ───────────────────────────────────────────────────────────────────────── */
  const activeConfig = pages[activePage]?.config;

  return (
    <div className={`flex flex-col bg-background border rounded-2xl overflow-hidden shadow-sm relative transition-all duration-300 ${isFullScreen ? "fixed inset-2 z-50 bg-background" : "h-[82vh]"}`}>

      {/* ── Global Styles ──────────────────────────────────────────────────── */}
      <style dangerouslySetInnerHTML={{ __html: `
        .editor-content p { margin-bottom: 0.5rem; line-height: 1.6; }
        .editor-content h1 { font-size: 2.25rem; font-weight: 800; margin-top: 1rem; margin-bottom: 0.5rem; color: inherit; line-height: 1.25; }
        .editor-content h2 { font-size: 1.5rem; font-weight: 700; margin-top: 1.25rem; margin-bottom: 0.5rem; color: inherit; line-height: 1.3; }
        .editor-content h3 { font-size: 1.25rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.25rem; }
        .editor-content ul { list-style-type: disc !important; padding-left: 1.5rem !important; margin-bottom: 1rem !important; }
        .editor-content ol { list-style-type: decimal !important; padding-left: 1.5rem !important; margin-bottom: 1rem !important; }
        .editor-content li { margin-bottom: 0.25rem; }
        .editor-content table { border-collapse: collapse; width: 100%; margin: 1.5rem 0; font-size: 14px; }
        .editor-content table td, .editor-content table th { border: 1px solid #cbd5e1; padding: 8px 12px; min-width: 40px; }
        .editor-content table th { background-color: #f8fafc; font-weight: 600; }
        .editor-content blockquote { border-left: 4px solid #cbd5e1; padding-left: 1rem; color: #64748b; font-style: italic; margin: 1.5rem 0; }
        .editor-content img { border-radius: 8px; max-width: 100%; height: auto; transition: box-shadow 0.2s; }
        .editor-content img:hover { box-shadow: 0 0 0 2px hsl(var(--primary)); }

        .margin-normal { padding: 25.4mm 25.4mm !important; }
        .margin-narrow { padding: 12.7mm 12.7mm !important; }
        .margin-wide   { padding: 25.4mm 38.1mm !important; }

        @media (max-width: 768px) {
          [id^="document-page-"] {
            zoom: 0.45; /* Fallback for older webkit */
            zoom: calc(100vw / 850); /* Scale down the 210mm A4 width to fit viewport */
            margin: 0 auto !important;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
          }
          .group\\/page > div:first-child { display: none; } /* hide page controls on mobile */
        }

        @media print {
          @page { margin: 0; size: auto; } /* Remove browser margins to prevent the content from shrinking */
          
          /* Reset container constraints to allow natural document flow for printing */
          html, body, #root, [class*="overflow-"], [class*="h-["] {
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            position: static !important;
          }
          
          /* Hide everything except the document pages */
          body * { visibility: hidden; }
          .print-pages-container, .print-pages-container * { visibility: visible; }
          
          /* Reset the canvas position so it starts at the exact top left of the paper */
          .print-pages-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important; /* Remove flex column behavior which might interfere */
          }

          [id^="document-page-"] {
            position: relative !important;
            width: 210mm !important;
            min-height: 297mm !important; /* Force true A4 height on print */
            margin: 0 auto !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          /* Prevent blank extra page at the end */
          [id^="document-page-"]:last-of-type {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .print-border-overlay { visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .fixed-watermark { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-hidden-controls { display: none !important; }
        }
      `}} />

      {/* ── Top Bar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20 gap-3 shrink-0 print-hidden-controls">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="rounded-xl">← Back</Button>
          <div className="h-4 w-px bg-border/60" />
          <div className="flex items-center gap-2">
            <Input
              value={doc.title}
              onChange={(e) => updateDoc({ title: e.target.value })}
              className="h-8 font-semibold text-sm max-w-[240px] md:max-w-[320px] bg-transparent border-none hover:bg-foreground/5 focus-visible:bg-background rounded-lg px-2"
              placeholder="Untitled Document"
            />
            <span className="text-[10px] text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold uppercase tracking-wider shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Autosaved
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Dedicated Print Button */}
          <Button
            onClick={handlePrint}
            size="sm"
            className="rounded-xl font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl font-semibold gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Actions <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl">
              <DropdownMenuLabel>Document Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportJSON} className="gap-2"><FileJson className="h-4 w-4 text-violet-500" /> Backup as JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF} disabled={isExporting} className="gap-2"><Download className="h-4 w-4 text-cyan-500" />{isExporting ? "Generating..." : "Download PDF"}</DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint} className="gap-2"><Printer className="h-4 w-4 text-emerald-500" /> Print / Save PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline" size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`rounded-xl h-8 w-8 ${isSidebarOpen ? "bg-primary/10 text-primary" : ""}`}
            title="Toggle Settings"
          ><Settings className="h-4 w-4" /></Button>

          <Button
            variant="outline" size="icon"
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="rounded-xl h-8 w-8"
          >{isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button>
        </div>
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center bg-card border-b px-4 py-2 gap-1.5 shrink-0 select-none overflow-x-auto custom-scrollbar print-hidden-controls">
        <Button variant="ghost" size="icon" onClick={() => execCmd("undo")} className="h-8 w-8 rounded-lg"><Undo2 className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => execCmd("redo")} className="h-8 w-8 rounded-lg"><Redo2 className="h-4 w-4" /></Button>
        <div className="h-6 w-px bg-border/60 mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs font-semibold px-2 flex gap-1.5">
              <span className="truncate max-w-[80px]">{FONTS.find(f => f.value === activeFont)?.name.split(" ")[0] || "Font"}</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="rounded-xl w-48">
            {FONTS.map(f => (
              <DropdownMenuItem key={f.value} onClick={() => { setActiveFont(f.value); execCmd("fontName", f.value); }} style={{ fontFamily: f.value }} className="text-xs justify-between">
                {f.name} {activeFont === f.value && <Check className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs font-semibold px-2 flex gap-1">
              {activeSize} <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="rounded-xl w-24">
            {FONT_SIZES.map(size => (
              <DropdownMenuItem key={size} onClick={() => {
                setActiveSize(size);
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                  const range = sel.getRangeAt(0);
                  const span = document.createElement("span");
                  span.style.fontSize = size;
                  try { span.appendChild(range.extractContents()); range.insertNode(span); } catch { execCmd("fontSize", "3"); }
                }
              }} className="text-xs justify-between">
                {size} {activeSize === size && <Check className="h-3 w-3 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-6 w-px bg-border/60 mx-1" />
        <Button variant="ghost" size="icon" onClick={() => execCmd("bold")} className={`h-8 w-8 rounded-lg ${isBold ? "bg-primary/10 text-primary" : ""}`}><Bold className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => execCmd("italic")} className={`h-8 w-8 rounded-lg ${isItalic ? "bg-primary/10 text-primary" : ""}`}><Italic className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => execCmd("underline")} className={`h-8 w-8 rounded-lg ${isUnderline ? "bg-primary/10 text-primary" : ""}`}><Underline className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => execCmd("strikeThrough")} className={`h-8 w-8 rounded-lg ${isStrike ? "bg-primary/10 text-primary" : ""}`}><Strikethrough className="h-4 w-4" /></Button>

        <div className="flex items-center gap-1">
          <Label htmlFor="text-color" className="cursor-pointer" title="Text Color">
            <span className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted relative">
              <Type className="h-4 w-4" style={{ color: textColor }} />
              <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-4 rounded-full" style={{ backgroundColor: textColor }} />
            </span>
          </Label>
          <input id="text-color" type="color" value={textColor} onChange={(e) => { setTextColor(e.target.value); execCmd("foreColor", e.target.value); }} className="sr-only" />
        </div>
        <div className="flex items-center gap-1">
          <Label htmlFor="highlight-color" className="cursor-pointer" title="Highlight">
            <span className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted relative">
              <Eraser className="h-4 w-4" />
              <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-4 rounded-full" style={{ backgroundColor: highlightColor }} />
            </span>
          </Label>
          <input id="highlight-color" type="color" value={highlightColor} onChange={(e) => { setHighlightColor(e.target.value); execCmd("hiliteColor", e.target.value); }} className="sr-only" />
        </div>

        <div className="h-6 w-px bg-border/60 mx-1" />
        <Button variant="ghost" size="icon" onClick={() => execCmd("justifyLeft")} className="h-8 w-8 rounded-lg"><AlignLeft className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => execCmd("justifyCenter")} className="h-8 w-8 rounded-lg"><AlignCenter className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => execCmd("justifyRight")} className="h-8 w-8 rounded-lg"><AlignRight className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => execCmd("justifyFull")} className="h-8 w-8 rounded-lg"><AlignJustify className="h-4 w-4" /></Button>
        <div className="h-6 w-px bg-border/60 mx-1" />
        <Button variant="ghost" size="icon" onClick={() => execCmd("insertUnorderedList")} className="h-8 w-8 rounded-lg"><List className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => execCmd("insertOrderedList")} className="h-8 w-8 rounded-lg"><ListOrdered className="h-4 w-4" /></Button>
        <div className="h-6 w-px bg-border/60 mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs font-semibold px-2 flex gap-1">
              Paragraph <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="rounded-xl w-36">
            <DropdownMenuItem onClick={() => execCmd("formatBlock", "H1")} className="font-bold text-lg">Heading 1</DropdownMenuItem>
            <DropdownMenuItem onClick={() => execCmd("formatBlock", "H2")} className="font-semibold text-base">Heading 2</DropdownMenuItem>
            <DropdownMenuItem onClick={() => execCmd("formatBlock", "H3")} className="font-semibold text-sm">Heading 3</DropdownMenuItem>
            <DropdownMenuItem onClick={() => execCmd("formatBlock", "P")} className="text-xs">Normal Text</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-6 w-px bg-border/60 mx-1" />
        <Button variant="ghost" size="icon" onClick={() => setTableModalOpen(true)} className="h-8 w-8 rounded-lg" title="Insert Table"><Table className="h-4 w-4" /></Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Insert Image"><Image className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="rounded-xl w-44">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2"><Plus className="h-3.5 w-3.5" /> Upload File</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setImageModalOpen(true)} className="gap-2"><Sparkles className="h-3.5 w-3.5" /> From URL</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
        <Button variant="ghost" size="icon" onClick={() => execCmd("insertHorizontalRule")} className="h-8 w-8 rounded-lg" title="Divider"><Plus className="h-4 w-4 rotate-45" /></Button>
        <Button variant="ghost" size="icon" onClick={() => execCmd("removeFormat")} className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" title="Clear Formatting"><Trash2 className="h-4 w-4" /></Button>
      </div>

      {/* ── Main Area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative bg-muted/30">

        {/* Pages Canvas */}
        <div className="flex-1 overflow-auto p-4 md:p-10 flex flex-col items-center custom-scrollbar print-pages-container">
          {pages.map((page, index) => (
            <DocumentPage
              key={index}
              index={index}
              total={pages.length}
              page={page}
              activeFont={activeFont}
              isActive={activePage === index}
              globalMargins={doc.margins}
              globalOrientation={doc.orientation}
              onContentChange={handleContentChange}
              onDeletePage={deletePage}
              onKeyDown={handlePageKeyDown}
              onActivate={(i) => { setActivePage(i); setSidebarTab("page"); updateToolbarStates(); }}
              editorRef={(el) => { pageRefs.current[index] = el; }}
            />
          ))}

          {/* Bottom add page button */}
          <div className="print-hidden-controls mt-2 mb-8 flex gap-3">
            <button
              onClick={addPage}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/60 hover:bg-primary/5 text-muted-foreground hover:text-primary text-sm font-semibold transition-all group"
            >
              <FilePlus className="h-4 w-4 group-hover:scale-110 transition-transform" />
              Add Page
            </button>
            <button
              onClick={addCoverPage}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-amber-300/60 hover:border-amber-500/60 hover:bg-amber-50 text-muted-foreground hover:text-amber-700 text-sm font-semibold transition-all group"
            >
              <PenLine className="h-4 w-4 group-hover:scale-110 transition-transform" />
              Add Cover Page
            </button>
          </div>
        </div>

        {/* ── Settings Sidebar ─────────────────────────────────────────────── */}
        {isSidebarOpen && (
          <div className="absolute right-0 top-0 bottom-0 lg:static w-[300px] border-l bg-card overflow-auto custom-scrollbar flex flex-col shrink-0 print-hidden-controls z-30 shadow-2xl lg:shadow-none">

            {/* Tab bar */}
            <div className="flex border-b border-border/60 shrink-0">
              <button
                onClick={() => setSidebarTab("document")}
                className={`flex-1 py-3 px-2 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors border-b-2 ${sidebarTab === "document" ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                <Layers className="h-3.5 w-3.5" /> Document
              </button>
              <button
                onClick={() => setSidebarTab("page")}
                className={`flex-1 py-3 px-2 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors border-b-2 ${sidebarTab === "page" ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                <Frame className="h-3.5 w-3.5" /> Page {activePage + 1}
              </button>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="px-3 text-muted-foreground hover:text-foreground lg:hidden"
              ><X className="h-4 w-4" /></button>
            </div>

            <div className="flex-1 overflow-auto p-4">

              {/* ── Document Tab ─────────────────────────────────────────── */}
              {sidebarTab === "document" && (
                <div className="flex flex-col gap-5">

                  {/* Page Management */}
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex flex-col gap-3">
                    <h3 className="font-bold text-xs text-primary uppercase tracking-widest flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> Page Management
                    </h3>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Total pages</span>
                      <span className="font-bold text-lg">{pages.length}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addPage} size="sm" className="flex-1 rounded-lg gap-1.5 text-xs">
                        <FilePlus className="h-3.5 w-3.5" /> Add Page
                      </Button>
                      <Button onClick={addCoverPage} size="sm" variant="outline" className="flex-1 rounded-lg gap-1.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-50">
                        <PenLine className="h-3.5 w-3.5" /> Cover
                      </Button>
                    </div>
                    {pages.length > 1 && (
                      <div className="flex flex-col gap-1">
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Pages:</p>
                        {pages.map((pg, i) => (
                          <div
                            key={i}
                            draggable
                            onDragStart={(e) => handleDragStart(e, i)}
                            onDragEnter={(e) => handleDragEnter(e, i)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, i)}
                            onDragEnd={handleDragEnd}
                            onClick={() => { setActivePage(i); setSidebarTab("page"); pageRefs.current[i]?.focus(); }}
                            className={`flex items-center justify-between px-2.5 py-2 rounded-lg border cursor-pointer transition-all ${activePage === i ? "border-primary/40 bg-primary/5 text-primary" : "border-border/60 hover:border-border hover:bg-muted/50"} ${dragOverPageIndex === i ? "border-primary/80 shadow-[0_0_0_2px_hsl(var(--primary))_inset]" : ""} ${draggedPageIndex === i ? "opacity-50" : ""}`}
                          >
                            <span className="text-xs font-semibold flex items-center gap-1.5">
                              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 cursor-grab active:cursor-grabbing hover:text-foreground transition-colors" />
                              {pg.config.isCover && <span className="text-[8px] bg-amber-400 text-amber-900 px-1 rounded font-bold">COVER</span>}
                              Page {i + 1}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); deletePage(i); }}
                              className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                            ><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-border/60" />

                  {/* Global Page Settings */}
                  <div className="flex flex-col gap-4">
                    <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-widest">Global Settings</h3>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Orientation</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant={doc.orientation === "portrait" ? "default" : "outline"} size="sm" onClick={() => updateDoc({ orientation: "portrait" })} className="rounded-lg text-xs">Portrait</Button>
                        <Button variant={doc.orientation === "landscape" ? "default" : "outline"} size="sm" onClick={() => updateDoc({ orientation: "landscape" })} className="rounded-lg text-xs">Landscape</Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Page Margins</Label>
                      <div className="grid grid-cols-3 gap-1">
                        {(["normal", "narrow", "wide"] as const).map(m => (
                          <Button key={m} variant={doc.margins === m ? "default" : "outline"} size="xs" onClick={() => updateDoc({ margins: m })} className="rounded-lg text-[10px] capitalize h-7">{m}</Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-border/60" />

                  {/* Templates */}
                  <div>
                    <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" /> Templates
                    </h3>
                    <div className="flex flex-col gap-2">
                      {TEMPLATES.map(t => (
                        <button key={t.id} onClick={() => loadTemplate(t.content)} className="w-full text-left p-2.5 rounded-xl border border-border/60 hover:bg-primary/5 hover:border-primary/40 transition-all flex flex-col text-xs group">
                          <span className="font-bold group-hover:text-primary transition-colors">{t.name}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">{t.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* ── Page Tab ─────────────────────────────────────────────── */}
              {sidebarTab === "page" && activeConfig && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-sm">
                      {activeConfig.isCover ? "Cover Page" : `Page ${activePage + 1}`} Settings
                    </h3>
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      Click any page to select
                    </span>
                  </div>

                  <PageSettingsPanel
                    pageIndex={activePage}
                    config={activeConfig}
                    onChange={handlePageConfigChange}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Status Bar ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-2 bg-muted/40 border-t border-border/60 flex justify-between text-[11px] text-muted-foreground font-semibold shrink-0 print-hidden-controls">
        <div className="flex gap-4">
          <span>Pages: <strong>{pages.length}</strong></span>
          <span>Words: <strong>{wordCount}</strong></span>
          <span>Chars: <strong>{charCount}</strong></span>
        </div>
        <span>Modified: {new Date(doc.updatedAt).toLocaleTimeString()}</span>
      </div>

      {/* ── Table Modal ─────────────────────────────────────────────────────── */}
      <Dialog open={tableModalOpen} onOpenChange={setTableModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>Insert Table</DialogTitle><DialogDescription>Choose table dimensions.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2"><Label>Rows</Label><Input type="number" min={1} max={20} value={tableRows} onChange={(e) => setTableRows(parseInt(e.target.value) || 1)} /></div>
            <div className="space-y-2"><Label>Columns</Label><Input type="number" min={1} max={20} value={tableCols} onChange={(e) => setTableCols(parseInt(e.target.value) || 1)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setTableModalOpen(false)}>Cancel</Button><Button onClick={handleInsertTable}>Insert</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Image Modal ─────────────────────────────────────────────────────── */}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>Insert Image from URL</DialogTitle><DialogDescription>Paste the image link.</DialogDescription></DialogHeader>
          <div className="py-4 space-y-2">
            <Label>Image URL</Label>
            <Input type="text" placeholder="https://example.com/image.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setImageModalOpen(false)}>Cancel</Button><Button onClick={handleInsertImageUrl}>Insert</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
