import React, { useRef, useState, useEffect, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download, QrCode, CheckCircle2 } from "lucide-react";
import {
  PrintWatermark,
  ModernLetterhead,
  PaymentDetailsPanel,
  MetaLabel,
  ModernSignSlot,
  titleCase,
  COMPANY,
  BRAND_RED,
  INK,
  RULE,
  ROW_RULE,
  POSITIVE,
  MODERN_FONT,
} from "@/components/PrintHeader";
import { numberToWords } from "@/lib/numberToWords";
import { supabase } from "@/integrations/supabase/client";
import { QrSignDialog } from "@/lib/qrHelpers";
import { toast } from "sonner";

export interface SalePrintPreviewProps {
  sale: any;
  customer?: any;
  vehicles?: any[];
  payment?: any;
  paymentIndex?: number;
  allPayments?: any[];
  onBack: () => void;
  onDownloadPdf?: () => void;
}

const RED = BRAND_RED;

/* ---------- Sales Receipt ---------- */

const exactPrint = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties;

function SalesReceipt(props: any) {
  const {
    docNumber,
    date,
    customer,
    rows,
    vehicleList,
    total,
    amountWords,
    isPaymentReceipt,
    paymentAmount,
    amountPaid,
    balance,
    statusLabel,
    statusColor,
    customerSignature,
    customerSignatureDate,
    repSignature,
    repSignatureDate,
    onSignClick,
    isSigningMode,
  } = props;

  const money = (n: number) => `₦${Math.round(Number(n) || 0).toLocaleString()}`;
  const issued = new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

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
  const sumRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, padding: "3px 0", fontSize: 11 };
  // Nothing outstanding reads as settled, not as an alert.
  const balanceColor = balance > 0 ? RED : POSITIVE;

  return (
    <div style={{ fontFamily: MODERN_FONT, color: INK }}>
      <ModernLetterhead docTitle="Receipt" docNumber={docNumber} />

      <div style={{ height: 1, background: RULE, margin: "15px 0 17px", ...exactPrint }} />

      {/* Billed to · date · status · vehicles */}
      <div style={{ display: "flex", gap: 22, alignItems: "flex-start", position: "relative", zIndex: 1 }}>
        <div style={{ width: "40%" }}>
          <MetaLabel>Billed to</MetaLabel>
          <div style={{ fontSize: 14.5, fontWeight: 800, textTransform: "uppercase", marginTop: 5, lineHeight: 1.2 }}>
            {customer?.name || "—"}
          </div>
          {customer?.phone && <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>{customer.phone}</div>}
          {customer?.address && <div style={{ fontSize: 10, color: "#666", marginTop: 1 }}>{customer.address}</div>}
          {customer?.email && <div style={{ fontSize: 10, color: "#666", marginTop: 1 }}>{customer.email}</div>}
        </div>

        <div style={{ flex: 1 }}>
          <MetaLabel>Date issued</MetaLabel>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 5 }}>{issued}</div>

          {/* Only summarised for a single vehicle. On a multi-vehicle sale the
              line items already carry each VIN, colour and mileage, so
              repeating them here is duplication that costs a whole page. */}
          {vehicleList?.length === 1 && (
            <div style={{ marginTop: 15 }}>
              <MetaLabel>Vehicle</MetaLabel>
              {vehicleList.map((v: any, i: number) => (
                <div key={v?.id || i} style={{ marginTop: 7 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700 }}>
                    {`${v?.make || ""} ${v?.model || ""}`.trim() || "Vehicle"}
                    {v?.year ? ` (${v.year})` : ""}
                  </div>
                  <div style={{ fontSize: 8.5, color: "#777", lineHeight: 1.65, marginTop: 1 }}>
                    {v?.vin && (
                      <>
                        VIN: <b style={{ color: "#333" }}>{v.vin}</b>
                        <br />
                      </>
                    )}
                    {v?.color && (
                      <>
                        Color: <b style={{ color: "#333" }}>{v.color}</b>
                        <br />
                      </>
                    )}
                    {v?.trim && (
                      <>
                        Trim: <b style={{ color: "#333" }}>{v.trim}</b>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ width: 118, textAlign: "right" }}>
          <MetaLabel>Payment status</MetaLabel>
          <div style={{ fontSize: 11, fontWeight: 800, marginTop: 5, color: statusColor, textTransform: "uppercase", letterSpacing: 0.3, ...exactPrint }}>
            {statusLabel}
          </div>
        </div>
      </div>

      {/* Line items */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 24, position: "relative", zIndex: 1 }}>
        <thead>
          <tr>
            <th style={{ ...headCell, textAlign: "left" }}>Description</th>
            <th style={{ ...headCell, ...colQty }}>Qty</th>
            <th style={{ ...headCell, ...colUnit }}>Unit Price</th>
            <th style={{ ...headCell, ...colAmt }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, i: number) => (
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 26, marginTop: 20, position: "relative", zIndex: 1 }}>
        <div style={{ flex: 1, paddingBottom: 2 }}>
          <MetaLabel>{isPaymentReceipt ? "Amount received in words" : "Amount in words"}</MetaLabel>
          <div style={{ fontSize: 11.5, fontStyle: "italic", marginTop: 5, lineHeight: 1.45 }}>{amountWords}</div>
        </div>

        <div style={{ width: 300 }}>
          {isPaymentReceipt && (
            <div style={sumRow}>
              <span style={{ color: "#555" }}>This payment</span>
              <span style={{ fontWeight: 700 }}>{money(paymentAmount)}</span>
            </div>
          )}
          <div style={{ ...sumRow, fontSize: 13.5, fontWeight: 800, paddingTop: 4 }}>
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
          <div style={{ ...sumRow, color: POSITIVE, ...exactPrint }}>
            <span>Amount Paid</span>
            <span>{money(amountPaid)}</span>
          </div>
          <div style={{ height: 1, background: RULE, margin: "8px 0", ...exactPrint }} />
          <div style={{ ...sumRow, alignItems: "baseline" }}>
            <span style={{ color: balanceColor, fontWeight: 800, fontSize: 13, ...exactPrint }}>Balance Due</span>
            <span style={{ color: balanceColor, fontWeight: 800, fontSize: 16.5, ...exactPrint }}>{money(balance)}</span>
          </div>
        </div>
      </div>

      {/* Payment details */}
      <div style={{ marginTop: 20 }}>
        <PaymentDetailsPanel
          note={
            balance > 0
              ? "Kindly pay the outstanding balance to the account details below:"
              : "Payment received in full into the account details below:"
          }
        />
      </div>

      {/* Signatures */}
      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, position: "relative", zIndex: 1 }}>
        <ModernSignSlot
          label="Customer's Signature"
          signature={customerSignature}
          date={customerSignatureDate}
          onSignClick={onSignClick}
          isSigningMode={isSigningMode}
        />
        <ModernSignSlot
          label="For Abuja Best Cars Ltd"
          signature={repSignature}
          date={repSignatureDate}
          align="right"
        />
      </div>

      {/* Footer */}
      <div style={{ marginTop: 22, textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700 }}>Thank you for your business!</div>
        <div style={{ fontSize: 8.5, color: "#888", marginTop: 3 }}>
          {COMPANY.address} &nbsp;·&nbsp; {COMPANY.tel}
        </div>
        <div style={{ fontSize: 8, color: "#a5a5a5", marginTop: 4, fontStyle: "italic" }}>
          Vehicle received in good condition. No refund of money after payment.
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/*  Exported Reusable Receipt Sheet                                 */
/* ---------------------------------------------------------------- */

export interface SaleReceiptSheetProps {
  sale: any;
  customer?: any;
  vehicles?: any[];
  payment?: any;
  paymentIndex?: number;
  allPayments?: any[];
  customerSignature?: string | null;
  customerSignatureDate?: string | null;
  repSignature?: string | null;
  repSignatureDate?: string | null;
  onSignClick?: () => void;
  isSigningMode?: boolean;
}

export const SaleReceiptSheet = forwardRef<HTMLDivElement, SaleReceiptSheetProps>(
  function SaleReceiptSheet(
    {
      sale,
      customer,
      vehicles = [],
      payment,
      paymentIndex,
      allPayments = [],
      customerSignature,
      customerSignatureDate,
      repSignature,
      repSignatureDate,
      onSignClick,
      isSigningMode,
    },
    ref
  ) {
    // Vehicles in this sale
    const saleVehicleIds = sale?.sale_vehicles?.length > 0
      ? sale.sale_vehicles.map((sv: any) => sv.vehicle_id)
      : [sale?.vehicle_id];

    let saleVehicleObjects = vehicles.filter((v: any) => saleVehicleIds.includes(v.id));
    if (saleVehicleObjects.length === 0 && sale?.sale_vehicles?.length > 0) {
      saleVehicleObjects = sale.sale_vehicles.map((sv: any) => sv.vehicle || sv.vehicles).filter(Boolean);
    }
    if (saleVehicleObjects.length === 0 && sale?.vehicles) {
      saleVehicleObjects = Array.isArray(sale.vehicles) ? sale.vehicles : [sale.vehicles];
    }

    // Financials
    const totalSalePrice = Number(sale?.sale_price) || 0;
    const isPaymentReceipt = Boolean(payment);
    const paymentAmount = payment ? Number(payment.amount) || 0 : totalSalePrice;

    // Payments are returned newest-first, so entries AFTER this index were made earlier.
    const paymentsList: any[] = allPayments.length > 0 ? allPayments : (sale?.sale_payments || []);
    const sumOf = (list: any[]) => list.reduce((sum: number, p: any) => sum + (Number(p?.amount) || 0), 0);
    const paidBefore = isPaymentReceipt
      ? sumOf(paymentsList.filter((_: any, i: number) => i > (paymentIndex ?? 0)))
      : 0;
    const amountPaid = isPaymentReceipt
      ? paidBefore + paymentAmount
      : paymentsList.length > 0
        ? sumOf(paymentsList)
        : totalSalePrice;
    const balance = Math.max(0, totalSalePrice - amountPaid);

    const receiptDate = payment?.payment_date || sale?.sale_date || sale?.created_at || new Date().toISOString();
    const serial = (payment?.id || sale?.id || "").replace(/\D/g, "").slice(0, 4).padStart(4, "0");
    const issuedOn = new Date(receiptDate);
    const docNumber = `RCT-${String(issuedOn.getDate()).padStart(2, "0")}${String(
      issuedOn.getMonth() + 1
    ).padStart(2, "0")}-${serial}`;
    const grandTotal = isPaymentReceipt ? paymentAmount : totalSalePrice;
    const amountWords = titleCase(numberToWords(grandTotal));

    const statusLabel = balance <= 0 ? "Paid in full" : isPaymentReceipt ? "Part payment" : "Balance due";
    const statusColor = balance <= 0 ? POSITIVE : RED;

    // Line items
    const vehicleName = (v: any) => `${v?.make || ""} ${v?.model || ""}`.trim() || "Vehicle";
    const perVehicle = saleVehicleObjects.length > 0 ? totalSalePrice / saleVehicleObjects.length : totalSalePrice;

    const paymentTitle =
      balance <= 0 && paidBefore === 0 ? "Full payment" : paidBefore === 0 ? "Initial deposit" : "Part payment";

    let rows: any[] = isPaymentReceipt
      ? [
          {
            title: paymentTitle,
            tag: saleVehicleObjects.map(vehicleName).join(", "),
            sub: [
              payment?.payment_method ? `Method: ${String(payment.payment_method).replace(/_/g, " ")}` : null,
              payment?.notes || null,
            ]
              .filter(Boolean)
              .join("  ·  "),
            qty: 1,
            rate: paymentAmount,
            amount: paymentAmount,
          },
        ]
      : saleVehicleObjects.map((v: any) => ({
          title: `${v?.year || ""} ${vehicleName(v)}`.trim(),
          tag: v?.trim || v?.condition || "",
          sub: [
            v?.vin ? `VIN: ${v.vin}` : null,
            v?.color ? `Colour: ${v.color}` : null,
            v?.transmission || null,
            v?.mileage ? `${Number(v.mileage).toLocaleString()} km` : null,
          ]
            .filter(Boolean)
            .join("  ·  "),
          qty: 1,
          rate: perVehicle,
          amount: perVehicle,
        }));

    if (rows.length === 0) {
      rows = [{ title: "Vehicle sale", tag: "", sub: "", qty: 1, rate: totalSalePrice, amount: totalSalePrice }];
    }

    const shared = {
      docNumber,
      date: receiptDate,
      customer,
      rows,
      vehicleList: saleVehicleObjects,
      total: totalSalePrice,
      amountWords,
      isPaymentReceipt,
      paymentAmount,
      amountPaid,
      balance,
      statusLabel,
      statusColor,
      sale,
      customerSignature,
      customerSignatureDate,
      repSignature,
      repSignatureDate,
      onSignClick,
      isSigningMode,
    };

    const receiptProps = shared;

    return (
      <div
        ref={ref}
        className="print-document-page bg-white text-black shadow-2xl border border-gray-200 md:w-[210mm] md:min-h-[297mm] shrink-0 relative"
        style={{ padding: "12mm 14mm", boxSizing: "border-box" }}
      >
        <PrintWatermark opacity={0.05} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <SalesReceipt {...receiptProps} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 6,
            background: RED,
            ...exactPrint,
          } as React.CSSProperties}
        />
      </div>
    );
  }
);
SaleReceiptSheet.displayName = "SaleReceiptSheet";

/* ---------------------------------------------------------------- */
/*  Main Preview Component (Desk / Management View)                 */
/* ---------------------------------------------------------------- */

export function SalePrintPreview({
  sale: initialSale,
  customer: initialCustomer,
  vehicles = [],
  payment,
  paymentIndex,
  allPayments = [],
  onBack,
  onDownloadPdf,
}: SalePrintPreviewProps) {
  const [sale, setSale] = useState<any>(initialSale);
  const [customer, setCustomer] = useState<any>(initialCustomer);
  const [showQrSign, setShowQrSign] = useState(false);
  const documentRef = useRef<HTMLDivElement>(null);

  // Sync state if incoming props change
  useEffect(() => {
    setSale(initialSale);
  }, [initialSale]);

  useEffect(() => {
    setCustomer(initialCustomer);
  }, [initialCustomer]);

  // Real-time synchronization: when customer signs via sign link, update immediately!
  useEffect(() => {
    if (!sale?.id) return;

    // Fetch freshest state on mount
    const fetchLatest = async () => {
      const { data } = await supabase
        .from("sales")
        .select("*, customer:customers(*)")
        .eq("id", sale.id)
        .single();
      if (data) {
        setSale((prev: any) => ({ ...prev, ...data }));
        if (data.customer) {
          setCustomer((prev: any) => ({ ...prev, ...data.customer }));
        }
      }
    };
    fetchLatest();

    // Subscribe to real-time Postgres changes for this sale
    const channel = supabase
      .channel(`sale-realtime-sign-${sale.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sales",
          filter: `id=eq.${sale.id}`,
        },
        (payload) => {
          if (payload.new) {
            setSale((prev: any) => ({ ...prev, ...payload.new }));
            if (payload.new.buyer_signature) {
              toast.success("Customer signature received and automatically applied to document!");
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sale?.id]);

  // Resolve customer and representative signatures
  const customerSignature = sale?.buyer_signature || customer?.signature_data || null;
  const customerSignatureDate =
    sale?.buyer_signature_date ||
    (customerSignature ? (sale?.sale_date || sale?.created_at) : null);

  const repSignature = sale?.rep_signature || null;
  const repSignatureDate =
    sale?.rep_signature_date ||
    (repSignature ? (sale?.sale_date || sale?.created_at) : null);

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
      <div className="flex flex-col gap-4 mb-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" onClick={onBack} className="rounded-full gap-2 font-medium">
            <ArrowLeft className="w-4 h-4" /> Back to Sales
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {/* Live Signature Status & Sign Link Button */}
            <Button
              variant="outline"
              onClick={() => setShowQrSign(true)}
              className={`rounded-full gap-2 font-medium text-xs px-4 h-9 shadow-sm transition-all ${
                customerSignature
                  ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                  : "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
              }`}
              title={customerSignature ? "Click to view signing link or re-sign" : "Generate sign link or QR code for customer"}
            >
              {customerSignature ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Customer Signed
                </>
              ) : (
                <>
                  <QrCode className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Get Sign Link (QR)
                </>
              )}
            </Button>

            {onDownloadPdf && (
              <Button variant="outline" onClick={onDownloadPdf} className="rounded-full gap-2 font-medium text-xs h-9">
                <Download className="w-3.5 h-3.5" /> Download PDF
              </Button>
            )}

            <Button
              onClick={() => window.print()}
              className="rounded-full gap-2 bg-[#d4ff32] hover:brightness-105 text-black font-extrabold shadow-lg shadow-[#d4ff32]/25 px-5 h-9 text-xs"
            >
              <Printer className="w-3.5 h-3.5" /> Print Receipt
            </Button>
          </div>
        </div>
      </div>

      {/* Printable A4 sheet */}
      <div className="print-pages-container w-full flex justify-center overflow-x-auto custom-scrollbar">
        <SaleReceiptSheet
          ref={documentRef}
          sale={sale}
          customer={customer}
          vehicles={vehicles}
          payment={payment}
          paymentIndex={paymentIndex}
          allPayments={allPayments}
          customerSignature={customerSignature}
          customerSignatureDate={customerSignatureDate}
          repSignature={repSignature}
          repSignatureDate={repSignatureDate}
        />
      </div>

      {/* QR Sign Dialog directly accessible from preview */}
      <QrSignDialog
        open={showQrSign}
        onOpenChange={setShowQrSign}
        type="sale"
        id={sale?.id}
      />
    </div>
  );
}
