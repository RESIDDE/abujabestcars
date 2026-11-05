import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CustomPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

export function CustomPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
  itemLabel = "items",
}: CustomPaginationProps) {
  if (totalItems === 0) return null;

  const start = currentPage * pageSize + 1;
  const end = Math.min((currentPage + 1) * pageSize, totalItems);

  // Calculate page buttons to show (e.g. max 5 buttons with ellipsis)
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 5) {
      for (let i = 0; i < totalPages; i++) pages.push(i);
    } else {
      pages.push(0);
      if (currentPage > 2) pages.push("...");
      const startPage = Math.max(1, currentPage - 1);
      const endPage = Math.min(totalPages - 2, currentPage + 1);
      for (let i = startPage; i <= endPage; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (currentPage < totalPages - 3) pages.push("...");
      if (!pages.includes(totalPages - 1)) pages.push(totalPages - 1);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-card/60 dark:bg-[#111728]/60 border border-border/50 dark:border-white/5 backdrop-blur-md shadow-sm">
      {/* Left: Summary and Page Size */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground w-full sm:w-auto justify-between sm:justify-start">
        <p className="font-medium">
          Showing <span className="font-bold text-foreground">{start}</span>–<span className="font-bold text-foreground">{end}</span> of{" "}
          <span className="font-bold text-foreground">{totalItems}</span> {itemLabel}
        </p>

        {onPageSizeChange && (
          <div className="flex items-center gap-2 pl-2 sm:border-l border-border/40 dark:border-white/10">
            <span className="text-[11px] font-medium">Per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                onPageSizeChange(Number(val));
                onPageChange(0);
              }}
            >
              <SelectTrigger className="h-7 w-16 rounded-full text-xs font-semibold bg-background/50 border-border/50 dark:border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-panel rounded-xl">
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)} className="text-xs">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Right: Pill Pagination Buttons matching reference */}
      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-center sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
          className="rounded-full h-8 px-3 text-xs font-semibold border-border/60 dark:border-white/10 hover:bg-muted disabled:opacity-30 gap-1 transition-all"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Prev</span>
        </Button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) =>
            p === "..." ? (
              <span key={`dots-${idx}`} className="px-1 text-xs text-muted-foreground">
                •••
              </span>
            ) : (
              <Button
                key={p}
                size="sm"
                variant={currentPage === p ? "default" : "ghost"}
                onClick={() => onPageChange(p as number)}
                className={`rounded-full h-8 w-8 p-0 text-xs font-bold transition-all ${
                  currentPage === p
                    ? "bg-[#181d2f] text-white hover:bg-[#252c42] dark:bg-white dark:text-slate-900 shadow-md shadow-black/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                }`}
              >
                {(p as number) + 1}
              </Button>
            )
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          className="rounded-full h-8 px-3 text-xs font-semibold border-border/60 dark:border-white/10 hover:bg-muted disabled:opacity-30 gap-1 transition-all"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
