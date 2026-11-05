import React, { forwardRef, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download, Loader2 } from "lucide-react";
import {
  PrintWatermark,
  ModernLetterhead,
  PaymentDetailsPanel,
  MetaLabel,
  titleCase,
  COMPANY,
  BRAND_RED,
  INK,
  RULE,
  ROW_RULE,
  MODERN_FONT,
} from "@/components/PrintHeader";
import { numberToWords } from "@/lib/numberToWords";
import { parseVehicleSpec } from "@/lib/vehicleSpec";
import { toast } from "sonner";

interface QuotePrintPreviewProps {
  quote: any;
  onBack: () => void;
  onDownloadPdf?: () => void;
}

const exactPrint = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties;

const money = (n: number) => `₦${Math.round(Number(n) || 0).toLocaleString()}`;

/* ---------------------------------------------------------------- */
/*  The A4 Proforma Invoice sheet (matches the sales receipt)        */
/* ---------------------------------------------------------------- */

export const QuoteDocument = forwardRef<HTMLDivElement, { quote: any }>(({ quote }, ref) => {
  const items: any[] = quote.performance_quote_items || [];
  const d = new Date(quote.quote_date || quote.created_at || Date.now());
  const docNumber = `PI-${(quote.id || "").slice(0, 8).toUpperCase()}`;
  const issued = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const totalAmount = Number(quote.total_amount) || 0;
  const vatPercentage = Number(quote.vat_percentage) || 0;
  const vatAmount = Number(quote.vat_amount) || 0;
  const subtotal = totalAmount - vatAmount;

  type Row = {
    title: string;
    tag?: string;
    sub?: string;
    qty: number;
    rate: number;
    amount: number;
  };

  const rows: Row[] = [];
  const specs: { spec: ReturnType<typeof parseVehicleSpec> }[] = [];

  items.forEach((item) => {
    const spec = parseVehicleSpec(item);
    specs.push({ spec });
    const qty = Number(item.quantity) || 1;
    const rate = Number(item.base_price) || 0;
    rows.push({
      title: spec.title,
      tag: spec.condition || "",
      sub: [
        spec.year && `Year: ${spec.year}`,
        spec.transmission,
        spec.engine,
        spec.color && `Colour: ${spec.color}`,
        ...spec.extras,
      ]
        .filter(Boolean)
        .join("  ·  "),
      qty,
      rate,
      amount: rate * qty,
    });
  });

  items
    .filter((i) => i.has_duty)
    .forEach((item) => {
      const spec = parseVehicleSpec(item);
      const qty = Number(item.quantity) || 1;
      const rate = Number(item.duty_price) || 0;
      rows.push({
        title: "Custom duty",
        tag: spec.title,
        sub: spec.vin ? `VIN: ${spec.vin}` : "",
        qty,
        rate,
        amount: rate * qty,
      });
    });

  const colQty: React.CSSProperties = { width: 54, textAlign: "center" };
  const colUnit: React.CSSProperties = { width: 118, textAlign: "right" };
  const colAmt: React.CSSProperties = { width: 118, textAlign: "right" };
  const headCell: React.CSSProperties = {
    fontSize: 9.5,
    color: "#777",
    fontWeight: 500,
    paddingBottom: 9,
    borderBottom: `1px solid ${RULE}`,
  };
  const bodyCell: React.CSSProperties = {
    padding: "11px 0",
    borderBottom: `1px solid ${ROW_RULE}`,
    fontSize: 11,
    verticalAlign: "middle",
  };
  const sumRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    padding: "3px 0",
    fontSize: 11,
  };

  return (
    <div
      ref={ref}
      className="print-document-page bg-white text-black shadow-2xl border border-gray-200 shrink-0 relative"
      style={{ width: "210mm", minHeight: "297mm", padding: "12mm 14mm", boxSizing: "border-box", color: INK }}
    >
      <PrintWatermark opacity={0.05} />
      <div style={{ position: "relative", zIndex: 1, fontFamily: MODERN_FONT }}>
        <ModernLetterhead docTitle="Proforma" docNumber={docNumber} />

        <div style={{ height: 1, background: RULE, margin: "15px 0 17px", ...exactPrint }} />

        {/* Billed to · date · validity · vehicles */}
        <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
          <div style={{ width: "40%" }}>
            <MetaLabel>Billed to</MetaLabel>
            <div style={{ fontSize: 14.5, fontWeight: 800, textTransform: "uppercase", marginTop: 5, lineHeight: 1.2 }}>
              {quote.customers?.name || "—"}
            </div>
            {quote.customers?.phone && <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>{quote.customers.phone}</div>}
            {quote.customers?.address && (
              <div style={{ fontSize: 10, color: "#666", marginTop: 1 }}>
                {String(quote.customers.address).replace(/\r?\n/g, ", ")}
              </div>
            )}
            {quote.customers?.email && <div style={{ fontSize: 10, color: "#666", marginTop: 1 }}>{quote.customers.email}</div>}
          </div>

          <div style={{ flex: 1 }}>
            <MetaLabel>Date issued</MetaLabel>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 5 }}>{issued}</div>

            {specs.length > 0 && (
              <div style={{ marginTop: 15 }}>
                <MetaLabel>{specs.length > 1 ? "Vehicles" : "Vehicle"}</MetaLabel>
                {specs.map(({ spec }, i) => (
                  <div key={i} style={{ marginTop: 7 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700 }}>
                      {spec.title}
                      {spec.year ? ` (${spec.year})` : ""}
                    </div>
                    <div style={{ fontSize: 8.5, color: "#777", lineHeight: 1.65, marginTop: 1 }}>
                      {spec.vin && (
                        <>
                          VIN: <b style={{ color: "#333" }}>{spec.vin}</b>
                          <br />
                        </>
                      )}
                      {spec.color && (
                        <>
                          Color: <b style={{ color: "#333" }}>{spec.color}</b>
                          <br />
                        </>
                      )}
                      {spec.condition && (
                        <>
                          Condition: <b style={{ color: "#333" }}>{spec.condition}</b>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ width: 118, textAlign: "right" }}>
            <MetaLabel>Status</MetaLabel>
            <div style={{ fontSize: 11, fontWeight: 800, marginTop: 5, color: BRAND_RED, textTransform: "uppercase", letterSpacing: 0.3, ...exactPrint }}>
              Awaiting payment
            </div>
          </div>
        </div>

        {/* Line items */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 24 }}>
          <thead>
            <tr>
              <th style={{ ...headCell, textAlign: "left" }}>Description</th>
              <th style={{ ...headCell, ...colQty }}>Qty</th>
              <th style={{ ...headCell, ...colUnit }}>Unit Price</th>
              <th style={{ ...headCell, ...colAmt }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ ...bodyCell, paddingRight: 14 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 11.5 }}>{r.title}</span>
                    {r.tag && <span style={{ fontSize: 9.5, color: "#9a9a9a" }}>{r.tag}</span>}
                  </div>
                  {r.sub && <div style={{ fontSize: 9, color: "#777", marginTop: 2, lineHeight: 1.45 }}>{r.sub}</div>}
                </td>
                <td style={{ ...bodyCell, ...colQty }}>{r.qty}</td>
                <td style={{ ...bodyCell, ...colUnit }}>{money(r.rate)}</td>
                <td style={{ ...bodyCell, ...colAmt, fontWeight: 700 }}>{money(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Amount in words + summary */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 26, marginTop: 20 }}>
          <div style={{ flex: 1, paddingBottom: 2 }}>
            <MetaLabel>Amount in words</MetaLabel>
            <div style={{ fontSize: 11.5, fontStyle: "italic", marginTop: 5, lineHeight: 1.45 }}>
              {titleCase(numberToWords(totalAmount))}
            </div>
          </div>

          <div style={{ width: 300 }}>
            {vatPercentage > 0 && (
              <>
                <div style={sumRow}>
                  <span style={{ color: "#555" }}>Subtotal</span>
                  <span style={{ fontWeight: 700 }}>{money(subtotal)}</span>
                </div>
                <div style={sumRow}>
                  <span style={{ color: "#555" }}>VAT ({vatPercentage}%)</span>
                  <span style={{ fontWeight: 700 }}>{money(vatAmount)}</span>
                </div>
              </>
            )}
            <div style={{ ...sumRow, fontSize: 13.5, fontWeight: 800, paddingTop: 4 }}>
              <span>Total</span>
              <span>{money(totalAmount)}</span>
            </div>
            <div style={{ height: 1, background: RULE, margin: "8px 0", ...exactPrint }} />
            <div style={{ ...sumRow, alignItems: "baseline" }}>
              <span style={{ color: BRAND_RED, fontWeight: 800, fontSize: 13, ...exactPrint }}>Amount Due</span>
              <span style={{ color: BRAND_RED, fontWeight: 800, fontSize: 16.5, ...exactPrint }}>{money(totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Payment details */}
        <div style={{ marginTop: 20 }}>
          <PaymentDetailsPanel
            note="Kindly make payment to the account details below:"
            bank={quote.bank_name}
            account={quote.account_number}
            accountName={quote.account_name}
          />
        </div>

        {quote.notes && (
          <div
            className="break-inside-avoid print:break-inside-avoid"
            style={{ marginTop: 16, borderLeft: `3px solid ${BRAND_RED}`, paddingLeft: 10, ...exactPrint }}
          >
            <MetaLabel>Notes / Terms</MetaLabel>
            <div style={{ whiteSpace: "pre-line", color: "#444", fontSize: 10, lineHeight: 1.5, marginTop: 3 }}>
              {quote.notes}
            </div>
          </div>
        )}

        {/* No signature block — a proforma is a quotation, not a signed document. */}

        {/* Footer */}
        <div style={{ marginTop: 26, textAlign: "center" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700 }}>Thank you for your business!</div>
          <div style={{ fontSize: 8.5, color: "#888", marginTop: 3 }}>
            {COMPANY.headOffice} &nbsp;&middot;&nbsp; {COMPANY.tel}
          </div>
          <div style={{ fontSize: 8, color: "#a5a5a5", marginTop: 4, fontStyle: "italic" }}>
            This is a Proforma Invoice and not a receipt of payment. No refund of money after payment.
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 6,
          background: BRAND_RED,
          ...exactPrint,
        } as React.CSSProperties}
      />
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
