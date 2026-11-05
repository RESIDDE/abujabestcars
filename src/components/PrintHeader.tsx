import React from "react";
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
  headOffice: "Suite G4, Cars 45, Humaza Plaza, Rainoil Filling Station, Gwarinpa",
  branchOffice: "Katampe Bridge, Beside Affin Filling Station, Abuja",
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
          <b>Head Office:</b> {COMPANY.headOffice}<br />
          <b>Branch Offices:</b> {COMPANY.branchOffice}<br />
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
          <b>Head Office:</b> ${COMPANY.headOffice}<br/>
          <b>Branch Offices:</b> ${COMPANY.branchOffice}<br/>
          <b>Tel:</b> ${COMPANY.tel} &nbsp; <b>Email:</b> ${COMPANY.email}
        </div>
      </div>
    </div>
  `;
}

// React component for watermark
export function PrintWatermark() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 select-none overflow-hidden">
      <img
        src={logo}
        alt="Watermark"
        className="w-[460px] h-[460px] max-w-[85%] max-h-[460px] object-contain opacity-[0.09]"
        style={{
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
    <div style="
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
