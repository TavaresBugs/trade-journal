"use client";
import { useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { dayKeyOf, FILTER_KEYS, readFilters, type AnalysisFilters } from "@luxalgo/journal-core";
import { useApi } from "@/lib/use-api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilterFields } from "./filter-fields";
import { SlidersHorizontal } from "lucide-react";
import { AccountSelector } from "./account-selector";
import { cn } from "@/lib/utils";

export const useFilters = () => {
  const params = useSearchParams();
  const { data } = useApi<{ timeZone: string }>("/api/settings");
  const range = params.get("range") ?? "all",
    timeZone = data?.timeZone ?? "UTC";
  return useMemo(() => {
    const f = readFilters(new URLSearchParams(params.toString()));
    const today = dayKeyOf(new Date().toISOString(), timeZone);
    if (range === "ytd") {
      f.from = `${today.slice(0, 4)}-01-01`;
      f.to = today;
    } else if (["7d", "30d", "90d"].includes(range)) {
      const d = new Date(today + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - Number(range.slice(0, -1)) + 1);
      f.from = d.toISOString().slice(0, 10);
      f.to = today;
    }
    return {
      accounts: f.accounts ?? null,
      from: f.from ?? null,
      to: f.to ?? null,
      range,
      timeZone,
      values: f,
      query: new URLSearchParams(Object.entries(f).filter(([, v]) => Boolean(v))).toString(),
    };
  }, [params, range, timeZone]);
};
export type Filters = ReturnType<typeof useFilters>;

export function FilterDialogButton({
  variant = "outline",
  size = "sm",
  className,
  asSeamless = false,
}: {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  asSeamless?: boolean;
}) {
  const router = useRouter(),
    pathname = usePathname(),
    params = useSearchParams();
  const filters = useFilters();
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<AnalysisFilters>({});
  const filterTitle = useRef<HTMLHeadingElement>(null);
  const count = Object.keys(filters.values).filter((k) => !["from", "to"].includes(k)).length;
  const apply = () => {
    const next = new URLSearchParams(params.toString());
    FILTER_KEYS.forEach((k) => next.delete(k));
    next.set("range", "custom");
    for (const [k, v] of Object.entries(draft)) if (v) next.set(k, v);
    router.replace(`${pathname}?${next}`);
    setOpen(false);
  };

  return (
    <>
      {asSeamless ? (
        <button
          type="button"
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs sm:text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.98]",
            count > 0 && "text-foreground font-bold",
            className,
          )}
          title="Filter by dates, symbols, strategy, outcome, and more. All selected conditions must match."
          onClick={() => {
            setDraft(filters.values);
            setOpen(true);
          }}
        >
          <SlidersHorizontal className="size-3.5 opacity-70" />
          <span>Filters{count > 0 ? ` · ${count}` : ""}</span>
        </button>
      ) : (
        <Button
          variant={variant}
          size={size}
          className={cn(
            "h-8 gap-1.5 border-border bg-background hover:bg-muted/60 text-foreground text-xs font-medium px-3 cursor-pointer",
            className,
          )}
          title="Filter by dates, symbols, strategy, outcome, and more. All selected conditions must match."
          onClick={() => {
            setDraft(filters.values);
            setOpen(true);
          }}
        >
          <SlidersHorizontal className="size-3.5 text-muted-foreground" />
          <span>Filters{count > 0 ? ` · ${count}` : ""}</span>
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="journal-filter-dialog sm:max-w-3xl"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            filterTitle.current?.focus();
          }}
        >
          <DialogHeader className="journal-filter-heading">
            <DialogTitle ref={filterTitle} tabIndex={-1} className="outline-none">
              Filter your journal
            </DialogTitle>
            <DialogDescription className="journal-filter-description">
              Times use {filters.timeZone}. Dates use the closing day, or opening day for open
              trades. All selected conditions must match.
            </DialogDescription>
          </DialogHeader>
          <div className="journal-filter-body">
            <FilterFields value={draft} onChange={setDraft} />
          </div>
          <div className="journal-filter-footer flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setDraft({})}
            >
              Clear filters
            </Button>
            <Button className="min-w-28" onClick={apply}>
              Apply filters
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FilterBar({
  title,
  actions,
  hideFilterButton = false,
  hideRangeButtons = false,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  hideFilterButton?: boolean | "mobile";
  hideRangeButtons?: boolean | "mobile";
}) {
  const pathname = usePathname(),
    params = useSearchParams(),
    router = useRouter();
  const filters = useFilters();
  const showFilters =
    ["/", "/reports", "/trades", "/calendar", "/journal", "/playbooks"].includes(pathname) ||
    pathname.startsWith("/journal/");

  return (
    <div className="journal-filter-bar sticky z-10 flex min-h-14 min-w-0 flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur">
      <h1 className="mr-auto min-w-0 text-base font-semibold tracking-tight">{title}</h1>
      {showFilters && (
        <>
          <AccountSelector />
          {hideRangeButtons !== true && (
            <div
              className={cn(
                "h-8 max-w-full shrink-0 items-center rounded-md border border-border bg-background p-0.5",
                hideRangeButtons === "mobile" ? "hidden sm:flex" : "flex",
              )}
            >
              {["7d", "30d", "90d", "ytd", "all"].map((range) => (
                <Button
                  key={range}
                  variant={filters.range === range ? "secondary" : "ghost"}
                  size="sm"
                  className="h-full px-2 text-xs"
                  onClick={() => {
                    const next = new URLSearchParams(params.toString());
                    next.set("range", range);
                    next.delete("from");
                    next.delete("to");
                    router.replace(`${pathname}?${next}`);
                  }}
                >
                  {range === "all" ? "All" : range.toUpperCase()}
                </Button>
              ))}
            </div>
          )}
          {hideFilterButton !== true && (
            <div className={hideFilterButton === "mobile" ? "hidden sm:block" : undefined}>
              <FilterDialogButton />
            </div>
          )}
        </>
      )}
      {actions && (
        <div className="journal-header-actions flex min-w-0 max-w-full flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
