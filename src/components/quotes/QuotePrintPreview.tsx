import React, { forwardRef, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download, Loader2 } from "lucide-react";
import { PrintHeader, PrintWatermark, BRAND_BADGE, BRAND_DARK, BRAND_PINK, BRAND_RED } from "@/components/PrintHeader";
import { PrintFooter } from "@/components/PrintFooter";
import { numberToWords } from "@/lib/numberToWords";
import { parseVehicleSpec } from "@/lib/vehicleSpec";
import { toast } from "sonner";

interface QuotePrintPreviewProps {
  quote: any;
  onBack: () => void;
  onDownloadPdf?: () => void;
}

const exact = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties;

function Line({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, fontSize: 13, fontFamily: "Georgia, serif" }}>
      <span style={{ whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ flex: 1, borderBottom: "1px solid #333", minHeight: 18, paddingLeft: 4, fontFamily: "Arial, sans-serif", fontWeight: 600, fontSize: 12.5 }}>
        {value}
      </span>
    </div>
  );
}

const splitNaira = (n: number) => {
  const naira = Math.floor(n);
  const kobo = String(Math.round((n - naira) * 100)).padStart(2, "0");
  return { naira: naira.toLocaleString(), kobo };
};

/* ---------------------------------------------------------------- */
/*  The A4 Proforma Invoice sheet (Cash/Credit Invoice design)       */
/* ---------------------------------------------------------------- */

export const QuoteDocument = forwardRef<HTMLDivElement, { quote: any }>(({ quote }, ref) => {
  const items: any[] = quote.performance_quote_items || [];
  const d = new Date(quote.quote_date || quote.created_at || Date.now());
  const invoiceNo = `PI-${(quote.id || "").slice(0, 8).toUpperCase()}`;

  const totalAmount = Number(quote.total_amount) || 0;
  const vatPercentage = Number(quote.vat_percentage) || 0;
  const vatAmount = Number(quote.vat_amount) || 0;
  const subtotal = totalAmount - vatAmount;

  type Row = {
    description: React.ReactNode;
    condition?: string;
    year?: string;
    transmission?: string;
    engine?: string;
    vin?: string;
    qty: number;
    rate: number;
    amount: number;
  };

  const rows: Row[] = [];
  items.forEach((item) => {
    const spec = parseVehicleSpec(item);
    const qty = Number(item.quantity) || 1;
    const rate = Number(item.base_price) || 0;
    rows.push({
      description: (
        <>
          <div style={{ fontWeight: 800, textTransform: "uppercase" }}>{spec.title}</div>
          {(spec.color || spec.extras.length > 0) && (
            <div style={{ fontSize: 10, color: "#444", marginTop: 1 }}>
              {[spec.color && `Colour: ${spec.color}`, ...spec.extras].filter(Boolean).join(" • ")}
            </div>
          )}
        </>
      ),
      condition: spec.condition,
      year: spec.year,
      transmission: spec.transmission,
      engine: spec.engine,
      vin: spec.vin,
      qty,
      rate,
      amount: rate * qty,
    });
  });
  items.filter((i) => i.has_duty).forEach((item) => {
    const spec = parseVehicleSpec(item);
    const qty = Number(item.quantity) || 1;
    const rate = Number(item.duty_price) || 0;
    rows.push({
      description: <div style={{ fontWeight: 800, textTransform: "uppercase" }}>Custom Duty — {spec.title}</div>,
      vin: spec.vin,
      qty,
      rate,
      amount: rate * qty,
    });
  });

  const emptyRows = Math.max(0, 6 - rows.length);
  const total = splitNaira(totalAmount);

  const cell: React.CSSProperties = { border: "1px solid #222", padding: "5px 5px", fontSize: 10.5, verticalAlign: "top", fontFamily: "Arial, sans-serif" };
  const center: React.CSSProperties = { ...cell, textAlign: "center" };
  const pink: React.CSSProperties = { ...cell, background: BRAND_PINK, textAlign: "right", fontWeight: 700, ...exact };
  const th: React.CSSProperties = { background: BRAND_DARK, color: "#fff", fontFamily: "Arial, sans-serif", fontWeight: 600, fontSize: 9.5, padding: "6px 4px", letterSpacing: 0.4, textAlign: "center", ...exact };

  return (
    <div
      ref={ref}
      className="print-document-page bg-white text-black shadow-2xl border border-gray-200 shrink-0 relative"
      style={{ width: "210mm", minHeight: "297mm", padding: "12mm 14mm", boxSizing: "border-box", color: "#111" }}
    >
      <PrintWatermark />
      <div style={{ position: "relative", zIndex: 1 }}>
        <PrintHeader />

        {/* Badge + number */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
          <div style={{ background: BRAND_BADGE, color: "#fff", fontWeight: 700, fontSize: 14, padding: "5px 14px", letterSpacing: 0.5, ...exact }}>
            PROFORMA INVOICE
          </div>
          <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700, fontSize: 16 }}>
            No.: <span style={{ fontFamily: "monospace", fontStyle: "normal", letterSpacing: 1.5 }}>{invoiceNo}</span>
          </div>
        </div>

        {/* Customer block + date box */}
        <div style={{ display: "flex", gap: 16, marginTop: 14, alignItems: "flex-start" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid #444", borderBottom: "1px solid #444", padding: "6px 0" }}>
            <Line label="Name:" value={quote.customers?.name} />
            <Line label="Address:" value={(quote.customers?.address || "").replace(/\r?\n/g, ", ")} />
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ flex: 1 }}><Line label="Tel:" value={quote.customers?.phone} /></div>
              <div style={{ flex: 1.3 }}><Line label="Email:" value={quote.customers?.email} /></div>
            </div>
          </div>
          <table style={{ borderCollapse: "collapse", fontSize: 10, width: 190 }}>
            <thead>
              <tr>
                {["DATE", "MONTH", "YEAR"].map((h) => (
                  <th key={h} style={{ border: "1px solid #333", padding: "2px 4px", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border: "1px solid #333", textAlign: "center", height: 24, fontWeight: 700 }}>{d.getDate()}</td>
                <td style={{ border: "1px solid #333", textAlign: "center", fontWeight: 700 }}>{d.toLocaleString("en-GB", { month: "short" })}</td>
                <td style={{ border: "1px solid #333", textAlign: "center", fontWeight: 700 }}>{d.getFullYear()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Items table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 26 }} />
            <col />
            <col style={{ width: 62 }} />
            <col style={{ width: 40 }} />
            <col style={{ width: 58 }} />
            <col style={{ width: 50 }} />
            <col style={{ width: 92 }} />
            <col style={{ width: 30 }} />
            <col style={{ width: 78 }} />
            <col style={{ width: 84 }} />
            <col style={{ width: 24 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={th} rowSpan={2}>S/N</th>
              <th style={th} rowSpan={2}>DESCRIPTION OF GOOD</th>
              <th style={th} rowSpan={2}>CONDITION</th>
              <th style={th} rowSpan={2}>YEAR</th>
              <th style={th} rowSpan={2}>TRANS.</th>
              <th style={th} rowSpan={2}>ENGINE</th>
              <th style={th} rowSpan={2}>VIN / CHASSIS</th>
              <th style={th} rowSpan={2}>QTY</th>
              <th style={th} rowSpan={2}>RATE (₦)</th>
              <th style={th} colSpan={2}>AMOUNT</th>
            </tr>
            <tr>
              <th style={{ ...th, padding: 2 }}>₦</th>
              <th style={{ ...th, padding: 2 }}>K</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={center}>{i + 1}</td>
                <td style={cell}>{r.description}</td>
                <td style={center}>{r.condition || ""}</td>
                <td style={center}>{r.year || ""}</td>
                <td style={center}>{r.transmission || ""}</td>
                <td style={center}>{r.engine || ""}</td>
                <td style={{ ...cell, fontFamily: "monospace", fontSize: 9.5, wordBreak: "break-all" }}>{r.vin || ""}</td>
                <td style={center}>{r.qty}</td>
                <td style={{ ...cell, textAlign: "right" }}>{Math.floor(r.rate).toLocaleString()}</td>
                <td style={pink}>{splitNaira(r.amount).naira}</td>
                <td style={center}>{splitNaira(r.amount).kobo}</td>
              </tr>
            ))}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <tr key={`e${i}`}>
                {Array.from({ length: 11 }).map((__, c) => (
                  <td key={c} style={c === 9 ? { ...pink, height: 26 } : { ...cell, height: 26 }} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 6 }}>
          <div style={{ color: BRAND_RED, fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 12, lineHeight: 1.4, paddingTop: 4, maxWidth: 300 }}>
            This is a Proforma Invoice and not a receipt of payment.<br />
            No refund of money after payment.
          </div>
          <table style={{ borderCollapse: "collapse" }}>
            <tbody>
              {vatPercentage > 0 && (
                <>
                  <tr>
                    <td style={{ fontWeight: 700, fontSize: 12, paddingRight: 10, fontFamily: "Georgia, serif", textAlign: "right" }}>SUBTOTAL ₦</td>
                    <td style={{ border: "1px solid #222", width: 105, height: 26, textAlign: "right", fontWeight: 700, padding: "0 6px", fontSize: 12 }}>{splitNaira(subtotal).naira}</td>
                    <td style={{ border: "1px solid #222", width: 30, textAlign: "center", fontSize: 12 }}>{splitNaira(subtotal).kobo}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 700, fontSize: 12, paddingRight: 10, fontFamily: "Georgia, serif", textAlign: "right" }}>VAT ({vatPercentage}%) ₦</td>
                    <td style={{ border: "1px solid #222", height: 26, textAlign: "right", fontWeight: 700, padding: "0 6px", fontSize: 12 }}>{splitNaira(vatAmount).naira}</td>
                    <td style={{ border: "1px solid #222", textAlign: "center", fontSize: 12 }}>{splitNaira(vatAmount).kobo}</td>
                  </tr>
                </>
              )}
              <tr>
                <td style={{ fontWeight: 800, fontSize: 14, paddingRight: 10, fontFamily: "Georgia, serif", textAlign: "right" }}>TOTAL ₦</td>
                <td style={{ border: "1px solid #222", background: BRAND_PINK, width: 105, height: 30, textAlign: "right", fontWeight: 800, padding: "0 6px", ...exact }}>{total.naira}</td>
                <td style={{ border: "1px solid #222", width: 30, textAlign: "center", fontWeight: 700 }}>{total.kobo}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Amount in words */}
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          <Line label="Amount in words:" value={numberToWords(totalAmount).toUpperCase()} />
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, fontFamily: "Georgia, serif", fontSize: 13 }}>
            <span style={{ flex: 1, borderBottom: "1px solid #333", minHeight: 18 }} />
            <span>Naira</span>
            <span style={{ width: 110, borderBottom: "1px solid #333", minHeight: 18, textAlign: "center", fontFamily: "Arial", fontWeight: 600 }}>
              {total.kobo !== "00" ? total.kobo : ""}
            </span>
            <span>Kobo</span>
          </div>
        </div>

        {/* Bank details + notes */}
        {(quote.bank_name || quote.account_number || quote.account_name) && (
          <div style={{ marginTop: 16, border: "1px solid #222", display: "flex", fontFamily: "Arial, sans-serif", fontSize: 11.5 }}>
            <div style={{ background: BRAND_DARK, color: "#fff", fontWeight: 700, padding: "8px 10px", display: "flex", alignItems: "center", letterSpacing: 0.5, ...exact }}>
              BANK DETAILS
            </div>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1.3fr", gap: 10, padding: "6px 10px" }}>
              <div><div style={{ fontSize: 9, color: "#666", fontWeight: 700 }}>BANK</div><b>{quote.bank_name || "—"}</b></div>
              <div><div style={{ fontSize: 9, color: "#666", fontWeight: 700 }}>ACCOUNT NO.</div><b style={{ fontFamily: "monospace", fontSize: 12.5 }}>{quote.account_number || "—"}</b></div>
              <div><div style={{ fontSize: 9, color: "#666", fontWeight: 700 }}>ACCOUNT NAME</div><b>{quote.account_name || "—"}</b></div>
            </div>
          </div>
        )}

        {quote.notes && (
          <div style={{ marginTop: 12, fontFamily: "Arial, sans-serif", fontSize: 11, lineHeight: 1.45, borderLeft: `3px solid ${BRAND_BADGE}`, paddingLeft: 8 }}>
            <b style={{ fontSize: 10.5 }}>NOTES / TERMS:</b>
            <div style={{ whiteSpace: "pre-line", color: "#333" }}>{quote.notes}</div>
          </div>
        )}

        <PrintFooter showSignatures />
      </div>
    </div>
  );
});
QuoteDocument.displayName = "QuoteDocument";

/* ---------------------------------------------------------------- */
/*  PDF export — renders the same sheet off-screen and captures it   */
/* ---------------------------------------------------------------- */

async function captureToPdf(el: HTMLElement, filename: string) {
  const { toPng } = await import("html-to-image");
  const { jsPDF } = await import("jspdf");
  const imgData = await toPng(el, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const props = pdf.getImageProperties(imgData);
  const imgH = (props.height * pageW) / props.width;

  let y = 0;
  pdf.addImage(imgData, "PNG", 0, y, pageW, imgH);
  let remaining = imgH - pageH;
  while (remaining > 1) {
    y -= pageH;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, y, pageW, imgH);
    remaining -= pageH;
  }
  pdf.save(`${filename}.pdf`);
}

export async function exportQuotePdf(quote: any) {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;z-index:-1;background:#fff;";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await new Promise<void>((resolve) => {
      root.render(<QuoteDocument quote={quote} />);
      setTimeout(resolve, 900);
    });
    const el = host.firstElementChild as HTMLElement;
    el.style.boxShadow = "none";
    el.style.border = "none";
    await captureToPdf(el, `proforma-${(quote.id || "").slice(0, 8)}`);
  } finally {
    root.unmount();
    document.body.removeChild(host);
  }
}

/* ---------------------------------------------------------------- */
/*  Preview page                                                     */
/* ---------------------------------------------------------------- */

export function QuotePrintPreview({ quote, onBack, onDownloadPdf }: QuotePrintPreviewProps) {
  const documentRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (onDownloadPdf) return onDownloadPdf();
    setDownloading(true);
    try {
      await exportQuotePdf(quote);
      toast.success("Proforma invoice downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="animate-fade-up max-w-4xl mx-auto pb-12 print:p-0 print:m-0">
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .print-document-page { zoom: calc(100vw / 850); margin: 0 auto !important; }
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
            position: relative !important; width: 210mm !important; min-height: 297mm !important;
            margin: 0 auto !important; padding: 12mm 14mm !important;
            border: none !important; box-shadow: none !important; background: white !important;
          }
        }
      `}} />

      <div className="flex items-center justify-between mb-6 print:hidden">
        <Button variant="outline" onClick={onBack} className="rounded-full gap-2 font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Quotes
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={downloading} className="rounded-full gap-2 font-medium">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download PDF
          </Button>
          <Button
            onClick={() => window.print()}
            className="rounded-full gap-2 bg-[#d4ff32] hover:brightness-105 text-black font-extrabold shadow-lg shadow-[#d4ff32]/25 px-6"
          >
            <Printer className="w-4 h-4" /> Print Invoice
          </Button>
        </div>
      </div>

      <div className="print-pages-container w-full flex justify-center overflow-x-auto custom-scrollbar">
        <QuoteDocument ref={documentRef} quote={quote} />
      </div>
    </div>
  );
}
