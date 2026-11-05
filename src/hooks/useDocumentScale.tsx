import { useEffect } from "react";

/** A4 width (210mm) in CSS pixels at 96dpi. */
const A4_WIDTH_PX = 794;

/**
 * Space to leave for the page gutter either side of the sheet. The preview
 * screens pad their content with `px-4` (16px a side), so the sheet has to fit
 * inside that, not inside the raw viewport — plus a few pixels of slack.
 */
const GUTTER_PX = 36;

/**
 * Keeps `--doc-zoom` in step with the viewport so A4 document sheets
 * (receipts, invoices, proformas) shrink to fit the screen instead of being
 * cut off or needing a pinch-zoom.
 *
 * This cannot be done in CSS alone: `zoom` needs a unitless number, and
 * `calc(100vw / 794)` yields a *length*, so the browser discards it. Hence the
 * ratio is computed here and read back by the stylesheet as `zoom: var(--doc-zoom)`.
 *
 * Never scales above 1 — on a wide screen the document stays at true A4.
 */
export function DocumentScaleSync() {
  useEffect(() => {
    const apply = () => {
      const available = window.innerWidth - GUTTER_PX;
      const scale = Math.min(1, available / A4_WIDTH_PX);
      document.documentElement.style.setProperty("--doc-zoom", String(Math.max(0.1, scale)));
    };

    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  return null;
}
