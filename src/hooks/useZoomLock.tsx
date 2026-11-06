import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const LOCKED_VIEWPORT =
  "width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";

const ZOOMABLE_VIEWPORT = "width=device-width, initial-scale=1.0, viewport-fit=cover";

/**
 * Routes where pinch-to-zoom stays available.
 *
 * The customer signing link is the one place a visitor needs to zoom: they
 * are reading a contract on a phone before putting their signature to it,
 * and the A4 sheet is scaled down to fit the screen. Staff screens stay
 * locked so the app behaves like an app.
 */
const ZOOMABLE_ROUTES = [/^\/sign\//i];

/**
 * Blocks pinch-to-zoom everywhere except the routes listed above.
 *
 * The viewport meta (`user-scalable=no, maximum-scale=1`) is enough for
 * Chrome and Android, but **iOS Safari deliberately ignores it** — Apple
 * removed that behaviour in iOS 10 for accessibility reasons. `touch-action`
 * on html/body also does not reliably stop Safari's page-level pinch, because
 * the gesture is handled above the document.
 *
 * Safari does fire its own non-standard `gesture*` events for a pinch, and
 * those are cancellable, so they are the reliable hook. The two-finger
 * `touchmove` guard covers engines that route a pinch through touch events
 * instead. Single-finger scrolling is untouched, so normal scrolling and the
 * signature pad keep working.
 *
 * Double-tap zoom needs no handler here: `touch-action: pan-x pan-y` in
 * index.css already disables it on both engines, and cancelling `touchend`
 * would swallow the click of a genuine quick second tap.
 */
export function ZoomLock() {
  const { pathname } = useLocation();
  const allowZoom = ZOOMABLE_ROUTES.some((re) => re.test(pathname));

  useEffect(() => {
    const html = document.documentElement;

    // Safari only re-reads the viewport reliably when the element itself is
    // replaced, not when its content attribute is edited in place.
    const setViewport = (content: string) => {
      document.querySelector('meta[name="viewport"]')?.remove();
      const meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content = content;
      document.head.appendChild(meta);
    };

    if (allowZoom) {
      setViewport(ZOOMABLE_VIEWPORT);
      // Inline beats the pan-x pan-y rule in index.css.
      html.style.touchAction = "auto";
      document.body.style.touchAction = "auto";
      return () => {
        html.style.touchAction = "";
        document.body.style.touchAction = "";
      };
    }

    setViewport(LOCKED_VIEWPORT);
    html.style.touchAction = "";
    document.body.style.touchAction = "";

    const preventGesture = (e: Event) => e.preventDefault();

    // Safari (iOS and macOS) pinch.
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });

    // Any two-finger drag is a pinch. One finger still scrolls normally.
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, [allowZoom]);

  return null;
}
