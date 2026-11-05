import React, { useRef, useState, useEffect, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download, FileText, ScrollText, QrCode, CheckCircle2, PenLine } from "lucide-react";
import logo from "@/assets/logo.png";
import { PrintHeader, PrintWatermark, BRAND_BADGE, BRAND_DARK, BRAND_PINK, BRAND_RED } from "@/components/PrintHeader";
import { numberToWords } from "@/lib/numberToWords";
import { supabase } from "@/integrations/supabase/client";
import { QrSignDialog } from "@/lib/qrHelpers";
import { toast } from "sonner";

export type ReceiptType = "registered" | "non_registered";

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
const BADGE = BRAND_BADGE;
const PINK = BRAND_PINK;
const DARK = BRAND_DARK;

/* ---------- Shared UI Pieces ---------- */

function Line({ label, value, minWidth }: { label: string; value?: React.ReactNode; minWidth?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, fontSize: 13, fontFamily: "Georgia, serif", minWidth }}>
      <span style={{ whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ flex: 1, borderBottom: "1px solid #333", minHeight: 18, paddingLeft: 4, fontFamily: "Arial, sans-serif", fontWeight: 600, fontSize: 12.5 }}>
        {value}
      </span>
    </div>
  );
}

function SignBox({
  label,
  signature,
  date,
  align = "left",
  onSignClick,
  isSigningMode,
}: {
  label: string;
  signature?: string | null;
  date?: string | null;
  align?: "left" | "right" | "center";
  onSignClick?: () => void;
  isSigningMode?: boolean;
}) {
  return (
    <div
      style={{
        textAlign: align,
        fontFamily: "Georgia, serif",
        fontStyle: "italic",
        fontSize: 13,
        minWidth: 190,
      }}
    >
      <div
        style={{
          height: 48,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start",
          paddingBottom: 2,
        }}
      >
        {signature ? (
          <img
            src={signature}
            alt={label}
            style={{
              maxHeight: 46,
              maxWidth: 180,
              objectFit: "contain",
              filter: "brightness(0)",
              WebkitFilter: "brightness(0)",
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            } as React.CSSProperties}
          />
        ) : isSigningMode && onSignClick ? (
          <button
            type="button"
            onClick={onSignClick}
            className="animate-pulse"
            style={{
              height: 38,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              border: "1.5px dashed #d9342b",
              borderRadius: 8,
              padding: "0 12px",
              background: "#fff5f5",
              color: "#d9342b",
              fontWeight: 700,
              fontSize: 11,
              fontFamily: "Arial, sans-serif",
              fontStyle: "normal",
              cursor: "pointer",
            }}
          >
            <PenLine style={{ width: 13, height: 13 }} /> Tap to Sign Here
          </button>
        ) : null}
      </div>
      <div
        style={{
          borderTop: "1px solid #333",
          width: 190,
          marginLeft: align === "right" ? "auto" : 0,
          paddingTop: 3,
        }}
      >
        <span>{label}</span>
        {date && (
          <div style={{ fontSize: 10, color: "#555", fontStyle: "normal", marginTop: 1 }}>
            {new Date(date).toLocaleDateString("en-GB")}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Template 1: Cash/Credit Invoice (registered vehicle) ---------- */

function CashCreditInvoice(props: any) {
  const {
    receiptNo,
    date,
    customer,
    rows,
    total,
    amountWords,
    isPaymentReceipt,
    paymentAmount,
    balance,
    customerSignature,
    customerSignatureDate,
    repSignature,
    repSignatureDate,
    onSignClick,
    isSigningMode,
  } = props;

  const d = new Date(date);
  const naira = Math.floor(total);
  const kobo = String(Math.round((total - naira) * 100)).padStart(2, "0");
  const fmt = (n: number) => Math.floor(n).toLocaleString();
  const emptyRows = Math.max(0, 9 - rows.length);

  const cell: React.CSSProperties = { border: "1px solid #222", padding: "4px 6px", fontSize: 12, verticalAlign: "middle", height: 30 };
  const th: React.CSSProperties = { background: DARK, color: "#fff", fontFamily: "Arial, sans-serif", fontWeight: 600, fontSize: 13, padding: "6px", letterSpacing: 1, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties;

  return (
    <>
      <PrintHeader />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
        <div style={{ background: BADGE, color: "#fff", fontWeight: 700, fontSize: 14, padding: "5px 14px", letterSpacing: 0.5, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
          {isPaymentReceipt ? "CASH/CREDIT PAYMENT RECEIPT" : "CASH/CREDIT INVOICE"}
        </div>
        <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700, fontSize: 16 }}>
          No.: <span style={{ fontFamily: "monospace", fontStyle: "normal", letterSpacing: 2 }}>{receiptNo}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 14, alignItems: "flex-start" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, border: "1px solid #444", borderRight: "none", borderLeft: "none", padding: "6px 0" }}>
          <Line label="Name:" value={customer?.name} />
          <Line label="Address:" value={customer?.address} />
          <Line label="Tel:" value={customer?.phone} />
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

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14, position: "relative", zIndex: 1 }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 50 }} rowSpan={2}>QTY</th>
            <th style={th} rowSpan={2}>DESCRIPTION OF GOOD</th>
            <th style={{ ...th, width: 100 }} rowSpan={2}>RATE</th>
            <th style={th} colSpan={2}>AMOUNT</th>
          </tr>
          <tr>
            <th style={{ ...th, width: 105, padding: 2, fontSize: 11 }}>₦</th>
            <th style={{ ...th, width: 36, padding: 2, fontSize: 11 }}>K</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, i: number) => (
            <tr key={i}>
              <td style={{ ...cell, textAlign: "center" }}>{r.qty}</td>
              <td style={cell}>{r.description}</td>
              <td style={{ ...cell, textAlign: "right" }}>{fmt(r.rate)}</td>
              <td style={{ ...cell, background: PINK, textAlign: "right", fontWeight: 700, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>{fmt(r.amount)}</td>
              <td style={{ ...cell, textAlign: "center" }}>00</td>
            </tr>
          ))}
          {Array.from({ length: emptyRows }).map((_, i) => (
            <tr key={`e${i}`}>
              <td style={cell}></td>
              <td style={cell}></td>
              <td style={cell}></td>
              <td style={{ ...cell, background: PINK, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}></td>
              <td style={cell}></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 6, position: "relative", zIndex: 1 }}>
        <div style={{ color: RED, fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 12, lineHeight: 1.4, paddingTop: 4 }}>
          Received the above goods in good condition.<br />
          No refund of money after payment
          {isPaymentReceipt && (
            <div style={{ color: "#222", fontStyle: "normal", marginTop: 6, fontSize: 11.5, fontFamily: "Arial, sans-serif" }}>
              <b>Paid this transaction:</b> ₦{paymentAmount.toLocaleString()} &nbsp;|&nbsp;{" "}
              <b>Balance:</b> {balance > 0 ? `₦${balance.toLocaleString()}` : "NIL — FULLY PAID"}
            </div>
          )}
        </div>
        <table style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ border: "none", fontWeight: 800, fontSize: 14, paddingRight: 10, fontFamily: "Georgia, serif" }}>TOTAL ₦</td>
              <td style={{ border: "1px solid #222", background: PINK, width: 105, height: 30, textAlign: "right", fontWeight: 800, padding: "0 6px", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>
                {naira.toLocaleString()}
              </td>
              <td style={{ border: "1px solid #222", width: 36, textAlign: "center", fontWeight: 700 }}>{kobo}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 24, position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        <Line label="Amount in words:" value={amountWords} />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, fontFamily: "Georgia, serif", fontSize: 13 }}>
          <span style={{ flex: 1, borderBottom: "1px solid #333", minHeight: 18 }}></span>
          <span>Naira</span>
          <span style={{ width: 110, borderBottom: "1px solid #333", minHeight: 18, textAlign: "center", fontFamily: "Arial", fontWeight: 600 }}>{kobo !== "00" ? kobo : ""}</span>
          <span>Kobo</span>
        </div>
      </div>

      {/* Signature Section with dynamic digital signatures */}
      <div style={{ marginTop: 26, display: "flex", justifyContent: "space-between", alignItems: "flex-end", position: "relative", zIndex: 1 }}>
        <SignBox
          label="Customer's Sign"
          signature={customerSignature}
          date={customerSignatureDate}
          onSignClick={onSignClick}
          isSigningMode={isSigningMode}
        />
        <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 12, textAlign: "center", paddingBottom: 6 }}>
          Thanks for your patronage
        </div>
        <SignBox
          label="Manager's Sign"
          signature={repSignature}
          date={repSignatureDate}
          align="right"
        />
      </div>
    </>
  );
}

/* ---------- Template 2: Vehicle Sales Agreement Receipt (non-registered / Nigerian used) ---------- */

function VehicleSalesAgreementReceipt(props: any) {
  const {
    receiptNo,
    date,
    customer,
    vehicleList,
    total,
    amountWords,
    isPaymentReceipt,
    paymentAmount,
    balance,
    customerSignature,
    customerSignatureDate,
    repSignature,
    repSignatureDate,
    onSignClick,
    isSigningMode,
  } = props;

  const formattedDate = new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const Witness = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Line label="Name:" />
      <Line label="Address:" />
      <div style={{ borderBottom: "1px solid #333", height: 14 }} />
      <Line label="Occupation:" />
      <Line label="Signature:" />
    </div>
  );

  return (
    <>
      <PrintHeader />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 14 }}>
        <div style={{ fontFamily: "Arial, sans-serif", fontWeight: 800, fontSize: 17, lineHeight: 1.15, color: DARK }}>
          VEHICLE SALES<br />AGREEMENT RECEIPT
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700, fontSize: 15 }}>
            No.: <span style={{ fontFamily: "monospace", fontStyle: "normal", letterSpacing: 2 }}>{receiptNo}</span>
          </div>
          <div style={{ display: "inline-flex", marginTop: 6, border: "1px solid #333" }}>
            <span style={{ background: DARK, color: "#fff", fontWeight: 700, fontSize: 12, padding: "3px 10px", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>Date:</span>
            <span style={{ minWidth: 130, padding: "3px 8px", fontSize: 12, fontWeight: 600 }}>{formattedDate}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        <Line label="This is to certify that I Mr/Mrs/Miss/Alh.Mal.:" value={customer?.name} />
        <Line label="Of" value={[customer?.address, customer?.phone].filter(Boolean).join(" • ")} />

        <div style={{ color: RED, fontSize: 13, fontFamily: "Arial, sans-serif", marginTop: 2 }}>
          Purchases a vehicle at ABUJA BEST CARS LTD. with the following Documents.
        </div>

        {vehicleList.map((v: any, idx: number) => (
          <div key={v.id || idx} style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontFamily: "Georgia, serif", paddingLeft: 10 }}>
            {vehicleList.length > 1 && <b style={{ fontFamily: "Arial", fontSize: 11 }}>Vehicle {idx + 1}</b>}
            <div style={{ width: "72%" }}><Line label="1. Types of Vehicle" value={`${v.make || ""} ${v.year || ""}`.trim()} /></div>
            <div style={{ width: "72%" }}><Line label="2. Model:" value={`${v.model || ""}${v.trim ? " " + v.trim : ""}`.trim()} /></div>
            <div style={{ width: "72%" }}><Line label="3. Chassis No:" value={v.vin} /></div>
            <div style={{ width: "72%" }}><Line label="4. Engine No:" value={v.engine_number} /></div>
            <div style={{ width: "72%" }}><Line label="5. Registration No:" value={v.registration_number || v.plate_number} /></div>
          </div>
        ))}

        <div style={{ marginTop: 6 }}>
          <Line
            label="Now the vehicle is sold at the cost of (₦"
            value={`${total.toLocaleString()}${isPaymentReceipt ? `  — paid now ₦${paymentAmount.toLocaleString()}, balance ${balance > 0 ? "₦" + balance.toLocaleString() : "NIL"}` : ""}`}
          />
        </div>
        <Line label=") Amount in words" value={`${amountWords} NAIRA ONLY`} />
      </div>

      <div style={{ marginTop: 18, position: "relative", zIndex: 1, fontFamily: "Georgia, serif", fontSize: 13.5 }}>
        In the presence of the following witnesses.
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30, marginTop: 8 }}>
          <Witness />
          <Witness />
        </div>
      </div>

      <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, fontFamily: "Georgia, serif" }}>SOLD BY:</div>
          <Line label="Name:" value="ABUJA BEST CARS LTD" />
          <Line label="Address:" value="Gwarinpa, Abuja" />
          <div style={{ borderBottom: "1px solid #333", height: 14 }} />
          <Line label="Occupation:" />
          <Line label="Signature:" />
        </div>
        <div style={{ textAlign: "center", fontSize: 14, lineHeight: 1.35 }}>
          <span style={{ background: BADGE, color: "#fff", fontWeight: 600, padding: "2px 10px", fontSize: 12, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}>NOTE:</span>
          <p style={{ marginTop: 6 }}>
            Vehicle has been tested and certified by the buyer and will be purchased "as is". Therefore, there shall be no refund of money or vehicle after payment.
          </p>
        </div>
      </div>

      {/* Signature Section with dynamic digital signatures */}
      <div style={{ marginTop: 22, position: "relative", zIndex: 1 }}>
        <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700, fontSize: 14 }}>
          Vehicle received in good condition (BUYER)
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 6, alignItems: "flex-end" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 6, fontSize: 13, fontFamily: "Georgia, serif" }}>
            <span style={{ paddingBottom: 2 }}>Sign:</span>
            <div style={{ flex: 1, borderBottom: "1px solid #333", minHeight: 46, display: "flex", alignItems: "flex-end", paddingLeft: 4, paddingBottom: 2 }}>
              {customerSignature ? (
                <img
                  src={customerSignature}
                  alt="Customer Signature"
                  style={{
                    maxHeight: 42,
                    maxWidth: 220,
                    objectFit: "contain",
                    filter: "brightness(0)",
                    WebkitFilter: "brightness(0)",
                    WebkitPrintColorAdjust: "exact",
                    printColorAdjust: "exact",
                  } as React.CSSProperties}
                />
              ) : isSigningMode && onSignClick ? (
                <button
                  type="button"
                  onClick={onSignClick}
                  className="animate-pulse"
                  style={{
                    height: 38,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    border: "1.5px dashed #d9342b",
                    borderRadius: 8,
                    padding: "0 12px",
                    background: "#fff5f5",
                    color: "#d9342b",
                    fontWeight: 700,
                    fontSize: 11,
                    fontFamily: "Arial, sans-serif",
                    fontStyle: "normal",
                    cursor: "pointer",
                  }}
                >
                  <PenLine style={{ width: 13, height: 13 }} /> Tap to Sign Here
                </button>
              ) : null}
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 6, fontSize: 13, fontFamily: "Georgia, serif" }}>
            <span style={{ paddingBottom: 2 }}>Date:</span>
            <div style={{ flex: 1, borderBottom: "1px solid #333", minHeight: 24, paddingLeft: 4, paddingBottom: 2, fontFamily: "Arial, sans-serif", fontWeight: 600, fontSize: 12 }}>
              {customerSignatureDate ? new Date(customerSignatureDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}
            </div>
          </div>
        </div>

        <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700, fontSize: 13, color: RED, marginTop: 14 }}>
          Managing Director ABUJA BEST CARS LTD.
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 6, alignItems: "flex-end" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 6, fontSize: 13, fontFamily: "Georgia, serif" }}>
            <span style={{ paddingBottom: 2 }}>Sign:</span>
            <div style={{ flex: 1, borderBottom: "1px solid #333", minHeight: 46, display: "flex", alignItems: "flex-end", paddingLeft: 4, paddingBottom: 2 }}>
              {repSignature ? (
                <img
                  src={repSignature}
                  alt="MD Signature"
                  style={{
                    maxHeight: 42,
                    maxWidth: 220,
                    objectFit: "contain",
                    filter: "brightness(0)",
                    WebkitFilter: "brightness(0)",
                    WebkitPrintColorAdjust: "exact",
                    printColorAdjust: "exact",
                  } as React.CSSProperties}
                />
              ) : null}
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 6, fontSize: 13, fontFamily: "Georgia, serif" }}>
            <span style={{ paddingBottom: 2 }}>Date:</span>
            <div style={{ flex: 1, borderBottom: "1px solid #333", minHeight: 24, paddingLeft: 4, paddingBottom: 2, fontFamily: "Arial, sans-serif", fontWeight: 600, fontSize: 12 }}>
              {repSignatureDate ? new Date(repSignatureDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- */
/*  Exported Reusable Receipt Sheet (Exact printed template)        */
/* ---------------------------------------------------------------- */

export interface SaleReceiptSheetProps {
  sale: any;
  customer?: any;
  vehicles?: any[];
  payment?: any;
  paymentIndex?: number;
  allPayments?: any[];
  receiptType: ReceiptType;
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
      receiptType,
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

    let balance = 0;
    if (isPaymentReceipt && allPayments.length > 0) {
      const paidBefore = allPayments
        .filter((_: any, i: number) => i > (paymentIndex ?? 0))
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      balance = Math.max(0, totalSalePrice - (paidBefore + paymentAmount));
    }

    const receiptDate = payment?.payment_date || sale?.sale_date || sale?.created_at || new Date().toISOString();
    const receiptNumber = (payment?.id || sale?.id || "").replace(/\D/g, "").slice(0, 4).padStart(4, "0");
    const grandTotal = isPaymentReceipt ? paymentAmount : totalSalePrice;
    const amountWords = numberToWords(grandTotal).toUpperCase();

    // Invoice rows
    const perVehicle = saleVehicleObjects.length > 0 ? totalSalePrice / saleVehicleObjects.length : totalSalePrice;
    const rows = isPaymentReceipt
      ? [{
          qty: 1,
          description: `Part/Full payment for ${saleVehicleObjects.map((v: any) => `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim()).join(", ")}${saleVehicleObjects[0]?.vin ? ` (VIN: ${saleVehicleObjects[0].vin})` : ""}`,
          rate: paymentAmount,
          amount: paymentAmount,
        }]
      : saleVehicleObjects.map((v: any) => ({
          qty: 1,
          description: `${v.year || ""} ${v.make || ""} ${v.model || ""}${v.trim ? " " + v.trim : ""}${v.color ? ", " + v.color : ""}${v.vin ? ` — VIN: ${v.vin}` : ""}`.trim(),
          rate: perVehicle,
          amount: perVehicle,
        }));

    const shared = {
      receiptNo: receiptNumber,
      date: receiptDate,
      customer,
      rows,
      vehicleList: saleVehicleObjects,
      total: totalSalePrice,
      amountWords,
      isPaymentReceipt,
      paymentAmount,
      balance,
      sale,
      customerSignature,
      customerSignatureDate,
      repSignature,
      repSignatureDate,
      onSignClick,
      isSigningMode,
    };

    const invoiceProps = { ...shared, total: grandTotal };

    return (
      <div
        ref={ref}
        className="print-document-page bg-white text-black shadow-2xl border border-gray-200 md:w-[210mm] md:min-h-[297mm] shrink-0 relative"
        style={{ padding: "12mm 14mm", boxSizing: "border-box" }}
      >
        <PrintWatermark />
        <div style={{ position: "relative", zIndex: 1 }}>
          {receiptType === "registered" ? (
            <CashCreditInvoice {...invoiceProps} />
          ) : (
            <VehicleSalesAgreementReceipt {...shared} total={totalSalePrice} />
          )}
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 10,
            background: receiptType === "registered" ? DARK : BADGE,
            WebkitPrintColorAdjust: "exact",
            printColorAdjust: "exact",
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

  // Vehicles in this sale
  const saleVehicleIds = sale?.sale_vehicles?.length > 0
    ? sale.sale_vehicles.map((sv: any) => sv.vehicle_id)
    : [sale?.vehicle_id];

  let saleVehicleObjects = vehicles.filter((v: any) => saleVehicleIds.includes(v.id));
  if (saleVehicleObjects.length === 0 && sale?.vehicles) {
    saleVehicleObjects = Array.isArray(sale.vehicles) ? sale.vehicles : [sale.vehicles];
  }

  // Default template guess from the vehicle's condition/inventory type
  const looksNigerianUsed = saleVehicleObjects.some((v: any) =>
    /nigerian|local|non[-\s]?reg/i.test(`${v?.condition || ""} ${v?.inventory_type || ""}`)
  );
  const [receiptType, setReceiptType] = useState<ReceiptType>(looksNigerianUsed ? "non_registered" : "registered");

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
            page-break-after: auto !important; break-after: auto !important;
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

        {/* Receipt type selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { id: "registered", title: "Registered Vehicle", sub: "Cash/Credit Invoice", icon: FileText },
            { id: "non_registered", title: "Non-Registered / Nigerian Used", sub: "Vehicle Sales Agreement Receipt", icon: ScrollText },
          ] as const).map((opt) => {
            const active = receiptType === opt.id;
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                id={`receipt-type-${opt.id}`}
                onClick={() => setReceiptType(opt.id)}
                className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all ${
                  active ? "border-[#d4ff32] bg-[#d4ff32]/10 shadow-md" : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? "text-foreground" : "text-muted-foreground"}`} />
                <div>
                  <div className="text-sm font-bold">{opt.title}</div>
                  <div className="text-xs text-muted-foreground">{opt.sub}</div>
                </div>
              </button>
            );
          })}
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
          receiptType={receiptType}
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
