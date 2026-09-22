"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import type { AnalysisFilters, FilterKey } from "@luxalgo/journal-core";
import { OptionSelect } from "@/components/ui/option-select";
import { DatePicker } from "@/components/ui/date-picker";
import { JournalAssetDropdown } from "@/components/journal-asset-dropdown";
import { MonetaryField } from "./privacy";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

export const fieldClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-background/80 px-3 py-1.5 text-xs text-foreground shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground/60";

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <span className="text-xs font-semibold text-foreground/80">{label}</span>
      {children}
    </div>
  );
}

interface PairedRangeProps {
  label: string;
  minKey: FilterKey;
  maxKey: FilterKey;
  value: AnalysisFilters;
  onChange: (key: FilterKey, val: string) => void;
  sensitive?: boolean;
}

function PairedRange({
  label,
  minKey,
  maxKey,
  value,
  onChange,
  sensitive = false,
}: PairedRangeProps) {
  return (
    <div className="space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <MonetaryField sensitive={sensitive}>
        <div className="grid grid-cols-2 gap-1.5">
          <input
            className={cn(
              fieldClass,
              "clean-number h-8 text-xs font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            )}
            type="number"
            step="any"
            placeholder="Min"
            value={value[minKey] ?? ""}
            onChange={(e) => onChange(minKey, e.target.value)}
          />
          <input
            className={cn(
              fieldClass,
              "clean-number h-8 text-xs font-mono tnum [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            )}
            type="number"
            step="any"
            placeholder="Max"
            value={value[maxKey] ?? ""}
            onChange={(e) => onChange(maxKey, e.target.value)}
          />
        </div>
      </MonetaryField>
    </div>
  );
}

export function FilterFields({
  value,
  onChange,
}: {
  value: AnalysisFilters;
  onChange: (v: AnalysisFilters) => void;
}) {
  const { data: accounts } = useApi<{
    accounts: { id: string; name: string; archivedAt: string | null }[];
  }>("/api/accounts");
  const { data: playbooks } = useApi<{ playbooks: { id: string; name: string }[] }>(
    "/api/playbooks",
  );

  const set = (key: FilterKey, v: string) => onChange({ ...value, [key]: v });

  const select = (key: FilterKey, label: string, choices: [string, string][]) => (
    <Field key={key} label={label}>
      <span className="relative block min-w-0">
        <OptionSelect
          className={fieldClass}
          value={value[key] ?? ""}
          onValueChange={(next) => set(key, next)}
        >
          <option value="">All</option>
          {choices.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </OptionSelect>
      </span>
    </Field>
  );

  const activeAccounts = (accounts?.accounts ?? []).filter((a) => !a.archivedAt);

  return (
    <div className="journal-filter-fields space-y-4">
      {/* 3x3 Symmetrical Primary Filter Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {/* Row 1: Symbol and Dates */}
        <Field label="Symbol / Asset">
          <JournalAssetDropdown
            currentAsset={value.symbol || null}
            onSelectAsset={(sym) => set("symbol", sym ?? "")}
            triggerVariant="form"
            placeholder="All symbols"
            emptyLabel="All symbols"
            className={fieldClass}
          />
        </Field>

        <Field label="From Date">
          <DatePicker
            value={value.from ?? ""}
            onValueChange={(next) => set("from", next)}
            label="From Date"
          />
        </Field>

        <Field label="To Date">
          <DatePicker
            value={value.to ?? ""}
            onValueChange={(next) => set("to", next)}
            label="To Date"
          />
        </Field>

        {/* Row 2: Side (Buy/Sell), Outcome, Strategy */}
        <Field label="Side">
          <div className="flex h-9 w-full min-w-0 items-center gap-1 rounded-lg border border-input bg-background/80 p-1 shadow-xs">
            <button
              type="button"
              onClick={() => set("direction", value.direction === "long" ? "" : "long")}
              className={cn(
                "flex-1 h-full rounded-md text-xs font-medium transition-colors select-none flex items-center justify-center cursor-pointer",
                value.direction === "long"
                  ? "bg-profit/20 text-profit font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => set("direction", value.direction === "short" ? "" : "short")}
              className={cn(
                "flex-1 h-full rounded-md text-xs font-medium transition-colors select-none flex items-center justify-center cursor-pointer",
                value.direction === "short"
                  ? "bg-loss/20 text-loss font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              Sell
            </button>
          </div>
        </Field>

        {select("status", "Outcome", [
          ["win", "Win"],
          ["loss", "Loss"],
          ["breakeven", "Breakeven"],
          ["open", "Open trades"],
          ["closed", "All closed"],
        ])}

        {select(
          "playbookId",
          "Strategy",
          (playbooks?.playbooks ?? []).map((p) => [p.id, p.name]),
        )}

        {/* Row 3: Asset Class, Review Status, Tags */}
        {select("assetClass", "Asset Class", [
          ["futures", "Futures"],
          ["crypto", "Crypto"],
          ["forex", "Forex"],
          ["equity", "Stocks"],
          ["option", "Options"],
          ["cfd", "CFD"],
          ["other", "Other"],
        ])}

        {select("reviewed", "Review Status", [
          ["yes", "Reviewed"],
          ["no", "Unreviewed"],
        ])}

        <Field label="Tags">
          <input
            className={fieldClass}
            type="text"
            placeholder="e.g. Breakout, Reversal"
            value={value.tag ?? ""}
            onChange={(e) => set("tag", e.target.value)}
          />
        </Field>
      </div>

      {/* Account Filters */}
      {activeAccounts.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground/80">Accounts</span>
            <span className="text-[11px] text-muted-foreground">
              Unselected includes all accounts
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeAccounts.map((a) => {
              const isChecked = (value.accounts ?? "").split(",").filter(Boolean).includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    const ids = new Set((value.accounts ?? "").split(",").filter(Boolean));
                    if (isChecked) ids.delete(a.id);
                    else ids.add(a.id);
                    set("accounts", [...ids].join(","));
                  }}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer select-none",
                    isChecked
                      ? "border-primary/50 bg-primary/10 text-foreground font-semibold shadow-xs"
                      : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-3.5 items-center justify-center rounded-xs border transition-colors",
                      isChecked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40 bg-transparent",
                    )}
                  >
                    {isChecked && <Check className="size-2.5 stroke-[3]" />}
                  </span>
                  <span>{a.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Advanced Filters Accordion */}
      <details className="journal-filter-advanced rounded-xl border border-border/70 overflow-hidden bg-card/40">
        <summary className="flex cursor-pointer items-center justify-between gap-3 p-3 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors select-none">
          <span>Size, price, risk and time</span>
          <ChevronDown
            aria-hidden="true"
            className="h-4 w-4 shrink-0 transition-transform duration-200"
          />
        </summary>
        <div className="p-3 pt-1 space-y-3.5 border-t border-border/50">
          {/* Paired Numeric Metric Ranges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <PairedRange
              label="Net P&L ($)"
              minKey="pnlMin"
              maxKey="pnlMax"
              value={value}
              onChange={set}
              sensitive
            />
            <PairedRange
              label="Realized R"
              minKey="rMin"
              maxKey="rMax"
              value={value}
              onChange={set}
            />
            <PairedRange
              label="Planned R"
              minKey="plannedRMin"
              maxKey="plannedRMax"
              value={value}
              onChange={set}
            />
            <PairedRange
              label="Minutes Held"
              minKey="durationMin"
              maxKey="durationMax"
              value={value}
              onChange={set}
            />
            <PairedRange
              label="Total Quantity"
              minKey="quantityMin"
              maxKey="quantityMax"
              value={value}
              onChange={set}
            />
            <PairedRange
              label="Entry Price"
              minKey="entryMin"
              maxKey="entryMax"
              value={value}
              onChange={set}
              sensitive
            />
            <PairedRange
              label="Exit Price"
              minKey="exitMin"
              maxKey="exitMax"
              value={value}
              onChange={set}
              sensitive
            />
            <PairedRange
              label="Rating (1-5)"
              minKey="ratingMin"
              maxKey="ratingMax"
              value={value}
              onChange={set}
            />
          </div>

          {/* Weekday Selector (fills full line above time filters) */}
          <div className="space-y-1.5 pt-1 border-t border-border/40">
            <span className="text-[11px] font-medium text-muted-foreground">Days of Week</span>
            <div className="grid grid-cols-7 gap-1.5 w-full">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => {
                const isSelected = (value.weekdays ?? "")
                  .split(",")
                  .filter(Boolean)
                  .includes(String(i));
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      const days = new Set((value.weekdays ?? "").split(",").filter(Boolean));
                      if (isSelected) days.delete(String(i));
                      else days.add(String(i));
                      set("weekdays", [...days].join(","));
                    }}
                    className={cn(
                      "h-8 w-full rounded-lg text-xs font-semibold transition-colors cursor-pointer select-none flex items-center justify-center border",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/40">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">Entry Time</span>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="time"
                  className={cn(fieldClass, "h-8 text-xs font-mono")}
                  value={value.entryAfter ?? ""}
                  onChange={(e) => set("entryAfter", e.target.value)}
                  title="Entry after"
                />
                <input
                  type="time"
                  className={cn(fieldClass, "h-8 text-xs font-mono")}
                  value={value.entryBefore ?? ""}
                  onChange={(e) => set("entryBefore", e.target.value)}
                  title="Entry before"
                />
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">Exit Time</span>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="time"
                  className={cn(fieldClass, "h-8 text-xs font-mono")}
                  value={value.exitAfter ?? ""}
                  onChange={(e) => set("exitAfter", e.target.value)}
                  title="Exit after"
                />
                <input
                  type="time"
                  className={cn(fieldClass, "h-8 text-xs font-mono")}
                  value={value.exitBefore ?? ""}
                  onChange={(e) => set("exitBefore", e.target.value)}
                  title="Exit before"
                />
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
