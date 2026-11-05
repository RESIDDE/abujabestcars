import { useEffect } from "react";

/**
 * Blocks pinch-to-zoom.
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
  useEffect(() => {
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
  }, []);

  return null;
}
