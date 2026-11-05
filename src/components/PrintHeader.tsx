import React from "react";
import { PenLine } from "lucide-react";
import logo from "@/assets/logo.png";

/* Brand tokens — shared with the sales receipt templates */
export const BRAND_RED = "#d9342b";
export const BRAND_BADGE = "#e8553a";
export const BRAND_PINK = "#f6c9c9";
export const BRAND_DARK = "#2b2b2b";

export const COMPANY = {
  name: "ABUJA BEST CARS LTD",
  rc: "RC: 9158490",
  tagline: "Sales and suppliers of all kinds of cars",
  address: "Katampe Bridge, Beside Affin Filling Station, Abuja",
  tel: "+234 903 995 4141",
  email: "ifeanyiezenwa12@gmail.com",
};

/**
 * Official Abuja Best Cars LTD letterhead (matches the printed receipt booklets).
 * Used by every printable document: receipts, proforma, authority to sell, sales agreement, etc.
 */
export function PrintHeader({ children }: { children?: React.ReactNode } = {}) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, marginBottom: 6, zIndex: 1 }}>
      <div style={{ position: "absolute", top: -4, right: 0, fontWeight: 700, fontSize: 14, color: BRAND_RED, fontFamily: "Georgia, serif" }}>
        {COMPANY.rc}
      </div>
      <img src={logo} alt="Abuja Best Cars" style={{ width: 92, height: 92, objectFit: "contain", borderRadius: "50%" }} />
      <div style={{ flex: 1, textAlign: "center" }}>
        <div style={{ fontFamily: "Arial Black, Arial, sans-serif", fontWeight: 900, fontSize: 31, letterSpacing: -0.5, color: BRAND_DARK, lineHeight: 1.05, marginTop: 10 }}>
          {COMPANY.name}
        </div>
        <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700, fontSize: 14, color: BRAND_RED, marginTop: 2 }}>
          {COMPANY.tagline}
        </div>
        <div style={{ fontSize: 10.5, color: "#222", marginTop: 4, lineHeight: 1.45, fontFamily: "Georgia, serif" }}>
          <b>Office:</b> {COMPANY.address}<br />
          <b>Tel:</b> {COMPANY.tel} &nbsp; <b>Email:</b> {COMPANY.email}
        </div>
      </div>
      {children}
    </div>
  );
}

// For use inside string-based html window popups / PDF generation
export function getPrintHeaderHTML(base64Logo?: string) {
  const logoUrl = base64Logo || `${window.location.origin}${logo}`;
  return `
    <div style="position: relative; display: flex; align-items: center; gap: 14px; margin-bottom: 6px; z-index: 1;">
      <div style="position: absolute; top: -4px; right: 0; font-weight: 700; font-size: 14px; color: ${BRAND_RED}; font-family: Georgia, serif;">${COMPANY.rc}</div>
      <img src="${logoUrl}" style="width: 92px; height: 92px; object-fit: contain; border-radius: 50%;" />
      <div style="flex: 1; text-align: center;">
        <div style="font-family: 'Arial Black', Arial, sans-serif; font-weight: 900; font-size: 31px; letter-spacing: -0.5px; color: ${BRAND_DARK}; line-height: 1.05; margin-top: 10px;">${COMPANY.name}</div>
        <div style="font-family: Georgia, serif; font-style: italic; font-weight: 700; font-size: 14px; color: ${BRAND_RED}; margin-top: 2px;">${COMPANY.tagline}</div>
        <div style="font-size: 10.5px; color: #222; margin-top: 4px; line-height: 1.45; font-family: Georgia, serif;">
          <b>Office:</b> ${COMPANY.address}<br/>
          <b>Tel:</b> ${COMPANY.tel} &nbsp; <b>Email:</b> ${COMPANY.email}
        </div>
      </div>
    </div>
  `;
}

// React component for watermark
export function PrintWatermark({ opacity }: { opacity?: number } = {}) {
  return (
    <div className="print-watermark absolute inset-0 flex items-center justify-center pointer-events-none z-0 select-none overflow-hidden">
      <img
        src={logo}
        alt="Watermark"
        className={`w-[460px] h-[460px] max-w-[85%] max-h-[460px] object-contain${opacity === undefined ? " opacity-[0.09]" : ""}`}
        style={{
          opacity,
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      />
    </div>
  );
}

// For use inside string-based html window popups
export function getPrintWatermarkHTML(base64Logo?: string) {
  const logoUrl = base64Logo || `${window.location.origin}${logo}`;
  return `
    <div class="print-watermark" style="
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 0;
      opacity: 0.09;
      user-select: none;
      overflow: hidden;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    ">
      <img src="${logoUrl}" style="width: 460px; height: 460px; max-width: 85%; max-height: 460px; object-fit: contain; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;" />
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/*  Modern document system (used by the sales receipt / invoice sheet) */
/* ------------------------------------------------------------------ */

/** Soft red tint used for the payment-details panel. */
export const BRAND_RED_SOFT = "#fdf3f2";
/** Hairline border that pairs with BRAND_RED_SOFT. */
export const BRAND_RED_LINE = "#f3d9d6";
/** Primary text colour for modern documents. */
export const INK = "#111111";
/** Small-caps meta labels. */
export const MUTED = "#8a8a8a";
/** Section rule. */
export const RULE = "#e3e3e3";
/** Table row rule. */
export const ROW_RULE = "#f1f1f1";
/** Positive / settled amounts. */
export const POSITIVE = "#0f9d58";

export const MODERN_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * Company account printed on receipts and invoices.
 * Update here to change it everywhere the payment panel appears.
 */
export const COMPANY_BANK = {
  bank: "GT Bank",
  account: "3003192962",
  accountName: "ABUJA BEST CARS",
};

const exactPrint = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties;

/** Small uppercase meta label, e.g. "BILLED TO". */
export function MetaLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.1, color: MUTED, textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

/**
 * Modern letterhead: logo + company block on the left, document word
 * (INVOICE / RECEIPT) and its number on the right, in brand red.
 */
export function ModernLetterhead({ docTitle, docNumber }: { docTitle: string; docNumber: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, position: "relative", zIndex: 1 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <img src={logo} alt={COMPANY.name} style={{ width: 62, height: 62, objectFit: "contain", borderRadius: "50%" }} />
        <div style={{ paddingTop: 2 }}>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.2, color: INK, textTransform: "uppercase" }}>
            {COMPANY.name}
          </div>
          <div style={{ fontSize: 9, color: "#6b6b6b", lineHeight: 1.55, marginTop: 3, maxWidth: 290 }}>
            {COMPANY.address}<br />
            {COMPANY.tel}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.6, color: BRAND_RED, lineHeight: 1, textTransform: "uppercase", ...exactPrint }}>
          {docTitle}
        </div>
        <div style={{ fontSize: 10.5, color: "#8a8a8a", marginTop: 5, fontFamily: "monospace", letterSpacing: 0.5 }}>
          #{docNumber}
        </div>
        <div style={{ fontSize: 8, color: "#aaa", marginTop: 3, letterSpacing: 0.5 }}>{COMPANY.rc}</div>
      </div>
    </div>
  );
}

/**
 * Rounded, red-tinted panel listing the account to pay into.
 * Falls back to COMPANY_BANK when the document carries no account of its own.
 */
export function PaymentDetailsPanel({
  note,
  bank,
  account,
  accountName,
}: {
  note?: string;
  bank?: string | null;
  account?: string | null;
  accountName?: string | null;
}) {
  const details = {
    bank: bank || COMPANY_BANK.bank,
    account: account || COMPANY_BANK.account,
    accountName: accountName || COMPANY_BANK.accountName,
  };
  const col = (label: string, value: React.ReactNode, accent?: boolean) => (
    <div>
      <MetaLabel>{label}</MetaLabel>
      <div
        style={{
          fontSize: accent ? 12.5 : 11.5,
          fontWeight: accent ? 800 : 700,
          marginTop: 3,
          color: accent ? BRAND_RED : INK,
          fontFamily: accent ? "monospace" : undefined,
          letterSpacing: accent ? 1 : undefined,
          ...exactPrint,
        }}
      >
        {value}
      </div>
    </div>
  );

  return (
    <div
      className="break-inside-avoid print:break-inside-avoid"
      style={{
        background: BRAND_RED_SOFT,
        border: `1px solid ${BRAND_RED_LINE}`,
        borderRadius: 10,
        padding: "13px 18px",
        textAlign: "center",
        position: "relative",
        zIndex: 1,
        ...exactPrint,
      }}
    >
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1.6, color: BRAND_RED, textTransform: "uppercase", ...exactPrint }}>
        Payment Details
      </div>
      <div style={{ fontSize: 9, color: "#777", marginTop: 3 }}>
        {note || "Kindly make payment to the account details below:"}
      </div>
      <div style={{ display: "flex", justifyContent: "space-around", gap: 12, marginTop: 10 }}>
        {col("Bank", details.bank)}
        {col("Account Number", details.account, true)}
        {col("Account Name", details.accountName)}
      </div>
    </div>
  );
}

/** "FIFTY MILLION NAIRA ONLY." -> "Fifty Million Naira Only" */
export function titleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\.$/, "");
}

/**
 * Signature slot in the modern document style. With `isSigningMode` and an
 * `onSignClick` it renders a tap target instead of an empty rule.
 */
export function ModernSignSlot({
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
  align?: "left" | "right";
  onSignClick?: () => void;
  isSigningMode?: boolean;
}) {
  return (
    <div style={{ width: 215, textAlign: align }}>
      <div
        style={{
          height: 42,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: align === "right" ? "flex-end" : "flex-start",
          paddingBottom: 3,
        }}
      >
        {signature ? (
          <img
            src={signature}
            alt={label}
            style={{
              maxHeight: 40,
              maxWidth: 175,
              objectFit: "contain",
              filter: "brightness(0)",
              WebkitFilter: "brightness(0)",
              ...exactPrint,
            } as React.CSSProperties}
          />
        ) : isSigningMode && onSignClick ? (
          <button
            type="button"
            onClick={onSignClick}
            className="animate-pulse"
            style={{
              height: 34,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              border: `1.5px dashed ${BRAND_RED}`,
              borderRadius: 999,
              padding: "0 14px",
              background: BRAND_RED_SOFT,
              color: BRAND_RED,
              fontWeight: 700,
              fontSize: 10.5,
              cursor: "pointer",
              ...exactPrint,
            } as React.CSSProperties}
          >
            <PenLine style={{ width: 12, height: 12 }} /> Tap to Sign Here
          </button>
        ) : null}
      </div>
      <div style={{ borderTop: `1px solid ${INK}`, paddingTop: 4 }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: "#444" }}>
          {label}
        </div>
        {date && (
          <div style={{ fontSize: 8.5, color: "#888", marginTop: 1 }}>
            {new Date(date).toLocaleDateString("en-GB")}
          </div>
        )}
      </div>
    </div>
  );
}
