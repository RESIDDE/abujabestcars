import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BackButtonProps {
  /** Where to go when there is no history to step back through. */
  fallback?: string;
  /** Called instead of navigating — for closing a dialog or a preview. */
  onBack?: () => void;
  /** Hide the word "Back" and show the arrow alone. */
  iconOnly?: boolean;
  label?: string;
  className?: string;
  title?: string;
}

/**
 * The one back control used across the app.
 *
 * Steps back through history when there is somewhere to step back to.
 * On a page opened directly — a refresh, a bookmark, a shared link — the
 * browser has no previous entry, so it goes to the fallback instead of
 * leaving the user on a button that does nothing.
 */
export function BackButton({
  fallback = "/dashboard",
  onBack,
  iconOnly = false,
  label = "Back",
  className = "",
  title,
}: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onBack) {
      onBack();
      return;
    }
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === "number" && idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title || label}
      aria-label={label}
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full text-xs font-semibold
                  text-slate-600 dark:text-[#c2c5d1] hover:text-slate-900 dark:hover:text-white
                  bg-slate-100 dark:bg-[#24262c] border border-slate-200 dark:border-[#31343c]
                  hover:border-slate-300 dark:hover:border-[#434652] transition-colors shadow-sm
                  ${iconOnly ? "w-9 h-9 justify-center" : "h-9 pl-2.5 pr-3.5"} ${className}`}
    >
      <ArrowLeft className="w-4 h-4 shrink-0" />
      {!iconOnly && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}
