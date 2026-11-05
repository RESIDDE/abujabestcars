import { useEffect, useRef } from "react";

/**
 * Blanks the document title while a print is in progress.
 *
 * Browsers draw the page title in the printed header and the URL in the
 * footer. `@page { margin: 0 }` already leaves no room for either in Chrome,
 * but the user can re-enable them by choosing a non-zero margin or ticking
 * "Headers and footers". Printing whatever `document.title` holds at print
 * time means blanking it here keeps the site name off the paper in that case
 * too.
 *
 * The URL in the footer cannot be suppressed by a page — that is a browser
 * setting only the person printing can turn off.
 */
export function PrintTitleGuard() {
  const saved = useRef<string | null>(null);

  useEffect(() => {
    const hide = () => {
      if (saved.current === null) {
        saved.current = document.title;
        // A non-breaking space, not "": some browsers fall back to the URL
        // when the title is empty.
        document.title = " ";
      }
    };

    const restore = () => {
      if (saved.current !== null) {
        document.title = saved.current;
        saved.current = null;
      }
    };

    window.addEventListener("beforeprint", hide);
    window.addEventListener("afterprint", restore);

    // Safari fires beforeprint unreliably; the print media query is its
    // dependable signal. The ref guard keeps the two paths from fighting.
    const mql = window.matchMedia("print");
    const onMediaChange = (e: MediaQueryListEvent) => (e.matches ? hide() : restore());
    mql.addEventListener?.("change", onMediaChange);

    return () => {
      window.removeEventListener("beforeprint", hide);
      window.removeEventListener("afterprint", restore);
      mql.removeEventListener?.("change", onMediaChange);
      restore();
    };
  }, []);

  return null;
}
