"use client";

import { useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { MonetaryField } from "@/components/privacy";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { postJson } from "@/lib/use-api";
import { AccountPicker } from "./account-picker";
import { JournalAssetDropdown } from "./journal-asset-dropdown";
import { cn } from "@/lib/utils";

interface ManualLeg {
  datetime: string;
  side: "buy" | "sell";
  quantity: string;
  price: string;
  fee: string;
}

export function ManualTradeEntry({
  onSaved,
  initialDate,
  submitLabel = "Save trade",
  allTradedSymbols,
}: {
  onSaved: () => void;
  initialDate?: string;
  submitLabel?: string;
  allTradedSymbols?: string[];
}) {
  const searchParams = useSearchParams();
  const activeParamAccount = searchParams.get("accounts")?.split(",")[0] || "";

  const [accountId, setAccountId] = useState(activeParamAccount);
  const [symbol, setSymbol] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const defaultDt = initialDate ? `${initialDate}T09:30` : "";
  const [legs, setLegs] = useState<ManualLeg[]>([
    { datetime: defaultDt, side: "buy", quantity: "", price: "", fee: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fieldId = useId();

  const setLeg = (index: number, patch: Partial<ManualLeg>) =>
    setLegs((current) => current.map((leg, i) => (i === index ? { ...leg, ...patch } : leg)));

  const removeLeg = (index: number) => {
    if (legs.length <= 1) return;
    setLegs((current) => current.filter((_, i) => i !== index));
  };

  const valid =
    accountId &&
    symbol &&
    legs.some((leg) => leg.datetime && Number(leg.quantity) > 0 && leg.price !== "");

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      await postJson("/api/executions", {
        accountId,
        ...(notes.trim() ? { notes } : {}),
        executions: legs
          .filter((leg) => leg.datetime && Number(leg.quantity) > 0 && leg.price !== "")
          .map((leg) => ({
            symbol,
            side: leg.side,
            quantity: Number(leg.quantity),
            price: Number(leg.price),
            fee: leg.fee === "" ? 0 : Number(leg.fee),
            executedAt: new Date(leg.datetime).toISOString(),
          })),
      });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t save the trade. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset disabled={busy} className="min-w-0 space-y-4 pt-1">
      {/* Row 1: Symmetrical Account & Symbol Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AccountPicker value={accountId} onChange={setAccountId} kind="manual" />
        <div className="space-y-1.5 min-w-0">
          <Label className="text-xs font-semibold text-foreground/80">Symbol / Asset</Label>
          <JournalAssetDropdown
            currentAsset={symbol || null}
            onSelectAsset={(val) => setSymbol(val ?? "")}
            allTradedSymbols={allTradedSymbols}
            triggerVariant="form"
            hideGeneralJournal={true}
            placeholder="Search symbol (e.g. NQ, US100, EURUSD)…"
            className="h-9"
          />
        </div>
      </div>

      {/* Row 2: Executions Cards */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground/80">Executions</span>
          {legs.length > 1 && (
            <span className="text-[11px] text-muted-foreground font-mono">{legs.length} legs</span>
          )}
        </div>

        {legs.map((leg, index) => (
          <div
            key={index}
            className="rounded-xl border border-border/70 bg-card/40 p-3 space-y-2.5 shadow-xs transition-colors hover:border-border"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Execution #{index + 1}
              </span>
              {legs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLeg(index)}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer select-none"
                >
                  <Trash2 className="size-3" />
                  <span>Remove</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-12 gap-2.5 items-end">
              {/* Date & Time (4 cols) */}
              <div className="col-span-2 sm:col-span-4 space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">Date & time</span>
                <input
                  type="datetime-local"
                  value={leg.datetime}
                  onChange={(e) => setLeg(index, { datetime: e.target.value })}
                  className="h-9 w-full min-w-0 rounded-lg border border-input bg-background/80 px-2.5 text-xs font-mono text-foreground shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Side: Segmented Buy / Sell Toggle (3 cols) */}
              <div className="col-span-2 sm:col-span-3 space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">Side</span>
                <div className="flex h-9 w-full min-w-0 items-center gap-1 rounded-lg border border-input bg-background/80 p-1 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setLeg(index, { side: "buy" })}
                    className={cn(
                      "flex-1 h-full rounded-md text-xs font-medium transition-colors select-none flex items-center justify-center cursor-pointer",
                      leg.side === "buy"
                        ? "bg-profit/20 text-profit font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                    )}
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeg(index, { side: "sell" })}
                    className={cn(
                      "flex-1 h-full rounded-md text-xs font-medium transition-colors select-none flex items-center justify-center cursor-pointer",
                      leg.side === "sell"
                        ? "bg-loss/20 text-loss font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                    )}
                  >
                    Sell
                  </button>
                </div>
              </div>

              {/* Quantity (2 cols) */}
              <div className="col-span-1 sm:col-span-2 space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">Quantity</span>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  value={leg.quantity}
                  onChange={(e) => setLeg(index, { quantity: e.target.value })}
                  className="clean-number h-9 w-full min-w-0 rounded-lg border border-input bg-background/80 px-2.5 text-xs font-mono tnum text-foreground shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              {/* Price (2 cols) */}
              <div className="col-span-1 sm:col-span-2 space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">Price</span>
                <MonetaryField>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={leg.price}
                    onChange={(e) => setLeg(index, { price: e.target.value })}
                    className="clean-number h-9 w-full min-w-0 rounded-lg border border-input bg-background/80 px-2.5 text-xs font-mono tnum text-foreground shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </MonetaryField>
              </div>

              {/* Fee (1 col) */}
              <div className="col-span-1 sm:col-span-1 space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">Fee</span>
                <MonetaryField>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={leg.fee}
                    onChange={(e) => setLeg(index, { fee: e.target.value })}
                    className="clean-number h-9 w-full min-w-0 rounded-lg border border-input bg-background/80 px-2 text-xs font-mono tnum text-foreground shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </MonetaryField>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Row 3: Optional Expandable Notes */}
      {showNotes || notes.trim() ? (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <Label
              htmlFor={`${fieldId}-notes`}
              className="text-xs font-semibold text-foreground/80"
            >
              Notes
            </Label>
            {!notes.trim() && (
              <button
                type="button"
                onClick={() => setShowNotes(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer select-none"
              >
                Hide
              </button>
            )}
          </div>
          <textarea
            id={`${fieldId}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Setup details, strategy context, or trade notes…"
            className="w-full rounded-lg border border-input bg-background/80 p-2.5 text-xs text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground/60 resize-y"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNotes(true)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer py-0.5 select-none"
        >
          <Plus className="size-3.5" />
          <span>Add notes</span>
        </button>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Row 4: Action Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs cursor-pointer"
          onClick={() =>
            setLegs((current) => [
              ...current,
              {
                datetime: current.at(-1)?.datetime || defaultDt,
                side: current.at(-1)?.side === "buy" ? "sell" : "buy",
                quantity: current.at(-1)?.quantity || "",
                price: "",
                fee: "",
              },
            ])
          }
        >
          <Plus className="size-3.5" />
          Add execution
        </Button>

        <Button
          type="button"
          size="sm"
          className="h-8 px-4 text-xs font-semibold cursor-pointer"
          onClick={save}
          disabled={!valid || busy}
        >
          {busy ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </fieldset>
  );
}
