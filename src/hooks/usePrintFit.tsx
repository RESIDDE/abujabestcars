import { useEffect } from "react";

/** A4 height (297mm) in CSS pixels at the 96dpi the print box is laid out in. */
const A4_HEIGHT_PX = (297 / 25.4) * 96;

/** Never shrink past this — below it the document stops being readable. */
const MIN_ZOOM = 0.62;

/**
 * Keeps every printed document on a single page.
 *
 * A receipt or agreement is laid out at a true A4 sheet, but how tall it comes
 * out depends on what is on it: several vehicles, a long address, the witness
 * and seller blocks of a registered sale. Once the content passes 297mm the
 * browser spills the remainder — usually just the footer — onto a second page,
 * which is useless on a receipt booklet.
 *
 * So before the print dialog opens each sheet is measured and given the zoom
 * that brings it back inside one page. A sheet that already fits is left
 * exactly as it is.
 */
export function PrintFitSync() {
  useEffect(() => {
    const sheets = () =>
      Array.from(document.querySelectorAll<HTMLElement>(".print-document-page"));

    const fit = () => {
      sheets().forEach((el) => {
        // Measure unscaled, or each print would compound the last one's zoom.
        el.style.removeProperty("--print-zoom");
        const height = el.scrollHeight;
        if (height <= A4_HEIGHT_PX + 1) return;
        // A hair under the exact ratio: rounding in the print box can still
        // push a sheet sized to the very edge onto a second page.
        const zoom = Math.max(MIN_ZOOM, (A4_HEIGHT_PX / height) * 0.995);
        el.style.setProperty("--print-zoom", String(zoom));
      });
    };

    const reset = () => sheets().forEach((el) => el.style.removeProperty("--print-zoom"));

    window.addEventListener("beforeprint", fit);
    window.addEventListener("afterprint", reset);

    // Safari fires beforeprint unreliably; the print media query is its
    // dependable signal.
    const mql = window.matchMedia("print");
    const onChange = (e: MediaQueryListEvent) => (e.matches ? fit() : reset());
    mql.addEventListener?.("change", onChange);

    return () => {
      window.removeEventListener("beforeprint", fit);
      window.removeEventListener("afterprint", reset);
      mql.removeEventListener?.("change", onChange);
    };
  }, []);

  return null;
}
