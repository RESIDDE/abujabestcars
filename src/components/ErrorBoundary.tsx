import React from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  /** Changing this value resets the boundary — pass the route path so navigating away clears a crash. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors and failed lazy-chunk loads so a broken page shows a
 * recoverable message instead of a blank screen.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // A failed dynamic import usually means the page was served by an older
    // deploy and its chunk no longer exists — a reload fetches the new one.
    const isChunkError = /dynamically imported module|Importing a module script failed|Loading chunk/i.test(
      error.message || ""
    );

    return (
      <div className="h-[60vh] w-full flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center rounded-3xl border border-white/10 bg-card/60 p-8 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black mt-4">
            {isChunkError ? "This page needs a refresh" : "Something went wrong"}
          </h2>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            {isChunkError
              ? "A newer version of the app is available, so this page could not be loaded. Reload to continue."
              : "The page could not be displayed. Reload to try again — your data has not been affected."}
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="mt-5 rounded-full gap-2 bg-[#d4ff32] hover:brightness-105 text-black font-extrabold px-6"
          >
            <RotateCw className="w-4 h-4" /> Reload page
          </Button>
          <p className="text-[10px] text-muted-foreground/60 mt-4 break-words">{error.message}</p>
        </div>
      </div>
    );
  }
}
