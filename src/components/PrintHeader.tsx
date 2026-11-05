import logo from "@/assets/logo.png";

const BRAND_RED = "#C0392B";
const TEXT_DARK = "#222222";

export function PrintHeader() {
  return (
    <div className="flex items-center justify-start pb-4 mb-2 border-b-2 border-gray-300 relative">
      <div className="absolute top-0 right-0 text-[12px] font-semibold text-gray-700">RC 1907711</div>
      <img src={logo} alt="Abuja Best Cars Logo" className="w-[90px] h-[90px] object-contain mr-5 rounded-full" />
      <div className="flex-1 flex flex-col items-start">
        <h1
          className="font-black text-[34px] tracking-[-1px] leading-[1.1] uppercase m-0"
          style={{ fontFamily: 'Arial Black, sans-serif', fontWeight: 900, color: BRAND_RED }}
        >
          ABUJA BEST CARS
        </h1>
        <div className="w-full text-left mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-gray-800">
          <span>📍 38 Gana St, Maitama, Abuja 904101, FCT.</span>
          <span>| Workspace Business Hub, Transcorp Hilton, Abuja FCT.</span>
        </div>
        <div className="w-full text-left flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-gray-800 mt-0.5">
          <span>📞 0703 933 7459</span>
          <span>📷 @abujabestcars</span>
          <span>
            ✉️ <span className="text-blue-600 italic underline">abujabestcars@gmail.com</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// For use inside string-based html window popups
export function getPrintHeaderHTML(base64Logo?: string) {
  const logoUrl = base64Logo || `${window.location.origin}${logo}`;
  return `
    <div style="display: flex; align-items: center; justify-content: flex-start; padding-bottom: 12px; margin-bottom: 8px; border-bottom: 2px solid #ccc; position: relative;">
      <div style="position: absolute; top: 0; right: 0; font-size: 12px; font-weight: 600; color: #555;">RC 1907711</div>
      <img src="${logoUrl}" style="width: 90px; height: 90px; object-fit: contain; margin-right: 20px; border-radius: 50%;" />
      <div style="flex: 1; display: flex; flex-direction: column; align-items: flex-start;">
        <h1 style="font-family: Arial Black, sans-serif; font-weight: 900; font-size: 34px; margin: 0; color: ${BRAND_RED}; text-transform: uppercase; letter-spacing: -1px; line-height: 1.1;">
          ABUJA BEST CARS
        </h1>
        <div style="margin-top: 4px; width: 100%; text-align: left; font-size: 11px; color: #333;">
          <span>&#x1F4CD; 38 Gana St, Maitama, Abuja 904101, FCT.</span>
          <span style="margin-left: 12px;">| Workspace Business Hub, Transcorp Hilton, Abuja FCT.</span>
        </div>
        <div style="margin-top: 2px; width: 100%; text-align: left; font-size: 11px; color: #333;">
          <span>&#x1F4DE; 0703 933 7459</span>
          <span style="margin-left: 12px;">&#x1F4F7; @abujabestcars</span>
          <span style="margin-left: 12px;">&#x2709; <span style="color: #2563eb; font-style: italic; text-decoration: underline;">abujabestcars@gmail.com</span></span>
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
        className="w-[520px] h-[520px] max-w-[85%] max-h-[520px] object-contain opacity-[0.08]"
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
      opacity: 0.08;
      user-select: none;
      overflow: hidden;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    ">
      <img src="${logoUrl}" style="width: 520px; height: 520px; max-width: 85%; max-height: 520px; object-fit: contain; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;" />
    </div>
  `;
}

