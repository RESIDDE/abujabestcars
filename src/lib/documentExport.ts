/**
 * Shared file export for the printable A4 documents (sales receipt, proforma,
 * authority to sell, sales agreement).
 *
 * Everything funnels through here so a downloaded file is always a capture of
 * the very element the user is looking at — the file can never drift from the
 * on-screen or printed document the way a hand-rebuilt HTML copy does.
 *
 * A generated file also carries none of the URL, date and "Page 1 of 2"
 * furniture a browser stamps onto anything sent through the print dialog:
 * that is browser chrome drawn outside the page, and no stylesheet can
 * remove it.
 */

export type DocumentFormat = "pdf" | "png" | "jpeg";

/** A4 at 96dpi. */
const A4_WIDTH_PX = 794;

/**
 * Captures an element as a file blob.
 *
 * Screen-only styling (card shadow, border, and the small-screen `zoom` that
 * fits the sheet to a phone) is neutralised for the capture and then put back
 * exactly as it was, so capturing a live on-page element leaves no trace.
 */
export async function captureDocumentElement(
  el: HTMLElement,
  format: DocumentFormat
): Promise<Blob> {
  const previous = {
    boxShadow: el.style.boxShadow,
    border: el.style.border,
    width: el.style.width,
    minHeight: el.style.minHeight,
    zoom: el.style.zoom,
    margin: el.style.margin,
  };

  el.style.boxShadow = "none";
  el.style.border = "none";
  el.style.width = "210mm";
  el.style.minHeight = "297mm";
  el.style.margin = "0";
  // Without this, exporting from a phone would capture the shrunken sheet.
  el.style.zoom = "1";

  try {
    // Wait for the logo, watermark and any signatures to finish decoding,
    // otherwise they capture blank.
    await Promise.all(
      Array.from(el.querySelectorAll("img")).map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
              // Never hang the export on one broken image.
              setTimeout(resolve, 3000);
            })
      )
    );

    const { toPng, toJpeg } = await import("html-to-image");
    const opts = { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true };

    if (format === "png") {
      return await fetch(await toPng(el, opts)).then((r) => r.blob());
    }
    if (format === "jpeg") {
      return await fetch(await toJpeg(el, { ...opts, quality: 0.95 })).then((r) => r.blob());
    }

    // JPEG inside the PDF, not PNG: a full-page PNG of an A4 sheet runs to
    // ~10MB, which is unusable for email or WhatsApp. At this quality the
    // text stays crisp well past 150% zoom.
    const dataUrl = await toJpeg(el, { ...opts, quality: 0.92 });
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const props = pdf.getImageProperties(dataUrl);
    const imgH = (props.height * pageW) / props.width;

    let y = 0;
    pdf.addImage(dataUrl, "JPEG", 0, y, pageW, imgH);
    let remaining = imgH - pageH;
    while (remaining > 1) {
      y -= pageH;
      pdf.addPage();
      pdf.addImage(dataUrl, "JPEG", 0, y, pageW, imgH);
      remaining -= pageH;
    }
    return pdf.output("blob");
  } finally {
    el.style.boxShadow = previous.boxShadow;
    el.style.border = previous.border;
    el.style.width = previous.width;
    el.style.minHeight = previous.minHeight;
    el.style.zoom = previous.zoom;
    el.style.margin = previous.margin;
  }
}

/** Renders a React document off-screen, captures it, then tears it down. */
export async function captureOffScreen(
  render: (host: HTMLElement) => Promise<() => void>,
  format: DocumentFormat
): Promise<Blob> {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4_WIDTH_PX}px;z-index:-1;background:#fff;`;
  document.body.appendChild(host);

  let cleanup: (() => void) | undefined;
  try {
    cleanup = await render(host);
    const el = host.querySelector<HTMLElement>(".print-document-page") ?? (host.firstElementChild as HTMLElement);
    if (!el) throw new Error("Nothing was rendered to capture");
    return await captureDocumentElement(el, format);
  } finally {
    cleanup?.();
    host.remove();
  }
}

/** Saves a blob to the user's downloads. */
export function saveBlob(blob: Blob, filename: string, format: DocumentFormat) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.${format === "jpeg" ? "jpg" : format}`;
  a.click();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Captures a document already rendered on the page and downloads it.
 * Used by the pages that render their document inline rather than through a
 * reusable component.
 */
export async function downloadVisibleDocument(
  selector: string,
  format: DocumentFormat,
  filename: string
) {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`No document found to export (${selector})`);
  saveBlob(await captureDocumentElement(el, format), filename, format);
}

/* ------------------------------------------------------------------ */
/*  Printing from an iOS home-screen app                               */
/* ------------------------------------------------------------------ */

/**
 * True when the page is running as an installed app rather than in a browser
 * tab — iOS calls this "standalone", Android/Chrome reports it through the
 * display-mode media query.
 */
export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return Boolean(iosStandalone) || window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * Prints a document.
 *
 * In a normal browser tab this is just window.print(). Added to the iPhone
 * home screen it is not: an iOS standalone web app has no print UI, so
 * window.print() does nothing at all and the button appears dead. There is
 * no way to open the print dialog from that context.
 *
 * So when running standalone we build the PDF instead and hand it to the
 * system share sheet, which offers Print (as well as AirDrop, Files, Mail and
 * WhatsApp). If sharing is unavailable or the user is outside the gesture
 * window iOS allows, the file is downloaded instead — which always works.
 *
 * @param getBlob builds the PDF; only called when it is actually needed
 */
export async function printDocument(
  getBlob: () => Promise<Blob>,
  filename: string
): Promise<"printed" | "shared" | "downloaded"> {
  if (!isStandaloneApp()) {
    window.print();
    return "printed";
  }

  const blob = await getBlob();
  const file = new File([blob], `${filename}.pdf`, { type: "application/pdf" });

  const canShare =
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  if (canShare) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    } catch (err) {
      // A cancelled share is not a failure — do not then force a download.
      if (err instanceof DOMException && err.name === "AbortError") return "shared";
      // Anything else (NotAllowedError when outside the gesture window, and
      // so on) falls through to the download below.
    }
  }

  saveBlob(blob, filename, "pdf");
  return "downloaded";
}
