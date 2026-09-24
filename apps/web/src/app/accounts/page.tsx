"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  Eraser,
  FileUp,
  Landmark,
  MoreHorizontal,
  PencilLine,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { FilterBar } from "@/components/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrokerIcon } from "@/components/ui/broker-icon";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { EditAccountDialog } from "@/components/edit-account-dialog";
import { getBrokerInfo } from "@/lib/brokers/broker-catalog";
import { formatZoneOffset } from "@/lib/timezone";
import { postJson, useApi } from "@/lib/use-api";
import { fmtMoney, fmtAmount, pnlClass, cn } from "@/lib/utils";
import { MonetaryValue } from "@/components/privacy";
import type { AccountRow } from "@/types/accounts";

export default function AccountsPage() {
  return (
    <Suspense>
      <Accounts />
    </Suspense>
  );
}

function Accounts() {
  const { data, refresh } = useApi<{ accounts: AccountRow[] }>("/api/accounts");
  const [syncing, setSyncing] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null);

  const action = async <T = unknown,>(id: string, body: Record<string, unknown>) => {
    const result = await postJson<T>(`/api/accounts/${id}/actions`, body);
    refresh();
    return result;
  };

  const sync = async (id: string) => {
    setSyncing(id);
    try {
      const { sync: outcome } = await action<{
        sync: { inserted: number; skipped: number; skippedReasons: string[] };
      }>(id, { action: "sync" });
      if (outcome.skipped > 0)
        alert(
          `Sync finished with ${outcome.inserted} new fills. ${outcome.skipped} broker record(s) were skipped: ${outcome.skippedReasons.join(" ")}`,
        );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div>
      <FilterBar
        title="Accounts"
        actions={
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="gap-1.5 cursor-pointer font-medium"
          >
            <Plus className="size-4" />
            <span>New account</span>
          </Button>
        }
      />

      <AddAccountDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onAccountCreated={() => refresh()}
      />

      <EditAccountDialog
        account={editingAccount}
        open={Boolean(editingAccount)}
        onOpenChange={(open) => {
          if (!open) setEditingAccount(null);
        }}
        onAccountUpdated={() => refresh()}
      />

      <div className="grid gap-4 p-4 md:grid-cols-2">
        {data?.accounts.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-12 text-center">
            <p className="text-sm font-medium text-foreground">No accounts yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create an account or connect your broker to start importing your trades.
            </p>
            <Button
              size="sm"
              onClick={() => setCreateDialogOpen(true)}
              className="mt-4 gap-1.5 cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create account</span>
            </Button>
          </div>
        )}

        {data?.accounts.map((account) => {
          const nameLower = (account.name || "").toLowerCase();
          const detectedId =
            account.broker ||
            (nameLower.includes("ftmo")
              ? "ftmo"
              : nameLower.includes("topstep")
                ? "topstep"
                : nameLower.includes("apex")
                  ? "apex"
                  : nameLower.includes("lucid")
                    ? "lucid"
                    : nameLower.includes("tradesea")
                      ? "tradesea"
                      : nameLower.includes("ninjatrader")
                        ? "ninjatrader"
                        : nameLower.includes("tradovate")
                          ? "tradovate"
                          : nameLower.includes("binance")
                            ? "binance"
                            : null);

          const isExplicit = Boolean(account.broker);
          const brokerInfo = getBrokerInfo(account.broker || detectedId, account.platform);
          const isDetected = !isExplicit && Boolean(detectedId) && Boolean(brokerInfo);
          const currentTimeZone = account.timeZone || brokerInfo?.defaultTimeZone || "UTC";

          const categoryLabel =
            brokerInfo?.category === "prop-firm"
              ? "Prop Firm"
              : brokerInfo?.category === "platform"
                ? "Platform"
                : brokerInfo?.category === "forex-cfd"
                  ? "Forex & CFD"
                  : brokerInfo?.category === "futures"
                    ? "Futures (CME)"
                    : brokerInfo?.category === "crypto"
                      ? "Crypto"
                      : brokerInfo?.category === "stocks"
                        ? "Stocks"
                        : null;

          const tradeCount = account.tradeCount ?? 0;
          const netPnl = account.netPnl ?? 0;
          const returnPct = account.returnPct ?? 0;
          const currentBalance = account.currentBalance ?? (account.initialBalance ?? 0) + netPnl;

          return (
            <Card
              key={account.id}
              className={cn(
                "group relative border-border/70 bg-card/60 transition-colors duration-150 hover:border-border hover:bg-card p-4",
                account.archivedAt && "opacity-60",
              )}
            >
              {/* Header with Title + Metadata + Clean Actions */}
              <div className="flex items-start justify-between gap-3">
                {/* Left: Pure Broker / Prop Firm Brand Symbol + Information */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative shrink-0">
                    {brokerInfo?.icon ? (
                      <BrokerIcon
                        icon={brokerInfo.icon}
                        iconDark={brokerInfo.iconDark}
                        name={brokerInfo.name}
                        invertInDark={brokerInfo.invertInDark}
                        className="size-10 rounded-lg object-contain shrink-0"
                      />
                    ) : (
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-muted-foreground">
                        <Landmark className="size-5 opacity-70" />
                      </div>
                    )}
                    {brokerInfo?.platformIcon && (
                      <div
                        className="absolute -bottom-1 -right-1 rounded-full border border-background bg-background p-0.5 shadow-xs"
                        title={`Platform: ${brokerInfo.platformName || brokerInfo.platform}`}
                      >
                        <BrokerIcon
                          icon={brokerInfo.platformIcon}
                          name={brokerInfo.platformName}
                          className="size-3.5 rounded-full"
                        />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold leading-tight text-foreground truncate">
                        {account.name}
                      </span>
                      {account.accountNumber && (
                        <Badge
                          variant="secondary"
                          className="h-4.5 px-1.5 py-0 font-mono text-[10px] text-muted-foreground border-border/70 shrink-0"
                          title={`Statement Account ID: ${account.accountNumber}`}
                        >
                          #{account.accountNumber}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="h-4.5 px-1.5 py-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground border-border/70 shrink-0"
                        title={`Profit calculation method: ${account.profitCalcMethod?.toUpperCase() || "FIFO"}`}
                      >
                        {account.profitCalcMethod?.toUpperCase() || "FIFO"}
                      </Badge>
                      {account.archivedAt && (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-muted-foreground h-4 px-1.5 py-0 shrink-0"
                        >
                          Archived
                        </Badge>
                      )}
                    </div>

                    {/* Clean 1-line metadata hierarchy: Brand · Platform · Offset (Zero truncation) */}
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">
                        {brokerInfo?.name || "Custom Account"}
                      </span>
                      {brokerInfo?.platformName && (
                        <>
                          <span className="opacity-40">·</span>
                          <span>{brokerInfo.platformName}</span>
                        </>
                      )}
                      <span className="opacity-40">·</span>
                      <span
                        className="font-mono text-[11px]"
                        title={`${currentTimeZone} (${formatZoneOffset(currentTimeZone)})`}
                      >
                        {formatZoneOffset(currentTimeZone)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions (Import Button, Ghost Edit Icon, Ghost Menu Icon) */}
                <div className="flex shrink-0 items-center gap-1">
                  {account.kind === "sync" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                      disabled={syncing === account.id}
                      onClick={() => void sync(account.id)}
                      title="Sync now"
                    >
                      <RefreshCw
                        className={cn("size-3.5", syncing === account.id && "animate-spin")}
                      />
                    </Button>
                  )}

                  <Button
                    size="sm"
                    asChild
                    className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-xs mr-0.5"
                  >
                    <Link href={`/import?account=${account.id}`}>
                      <FileUp className="size-3.5" />
                      <span>Import Trades</span>
                    </Link>
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => setEditingAccount(account)}
                    title="Edit account"
                  >
                    <PencilLine className="size-4" />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">More options</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        className="cursor-pointer gap-2 text-xs"
                        onClick={() =>
                          void action(account.id, {
                            action: account.archivedAt ? "unarchive" : "archive",
                          })
                        }
                      >
                        {account.archivedAt ? (
                          <>
                            <ArchiveRestore className="size-3.5" />
                            <span>Unarchive</span>
                          </>
                        ) : (
                          <>
                            <Archive className="size-3.5" />
                            <span>Archive</span>
                          </>
                        )}
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        className="cursor-pointer gap-2 text-xs"
                        onClick={async () => {
                          const others = data.accounts.filter(
                            (candidate) => candidate.id !== account.id,
                          );
                          if (others.length === 0)
                            return alert("No other account to transfer into.");
                          const target = prompt(
                            `Transfer all data into which account?\n${others.map((candidate, index) => `${index + 1}. ${candidate.name}`).join("\n")}\n\nEnter a number:`,
                          );
                          const chosen = others[Number(target) - 1];
                          if (chosen)
                            await action(account.id, {
                              action: "transfer",
                              toAccountId: chosen.id,
                            });
                        }}
                      >
                        <ArrowRightLeft className="size-3.5" />
                        <span>Transfer trades</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        className="cursor-pointer gap-2 text-xs"
                        onClick={async () => {
                          if (
                            confirm(`Clear ALL trades from "${account.name}"? The account stays.`)
                          ) {
                            await action(account.id, { action: "clear" });
                          }
                        }}
                      >
                        <Eraser className="size-3.5" />
                        <span>Clear trades</span>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        className="cursor-pointer gap-2 text-xs text-destructive focus:text-destructive focus:bg-destructive/10"
                        onClick={async () => {
                          if (
                            confirm(
                              `Delete "${account.name}" and ALL its trades? This cannot be undone.`,
                            )
                          ) {
                            await postJson(`/api/accounts/${account.id}`, undefined, "DELETE");
                            refresh();
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                        <span>Delete account</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Subtle auto-detection banner if not linked yet */}
              {isDetected && brokerInfo && (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate text-muted-foreground">
                      Detected as <strong className="text-foreground">{brokerInfo.name}</strong>.
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] px-2 font-medium shrink-0 cursor-pointer"
                    onClick={async () => {
                      await postJson(
                        `/api/accounts/${account.id}`,
                        {
                          broker: detectedId,
                          timeZone: brokerInfo.defaultTimeZone || account.timeZone || "UTC",
                        },
                        "PATCH",
                      );
                      refresh();
                    }}
                  >
                    Link Settings
                  </Button>
                </div>
              )}

              {/* Structured Performance Grid (Generous spacing, zero truncation, high visual dignity) */}
              <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                {/* 1. Current Balance */}
                <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Current Balance
                  </span>
                  <span className="mt-1 block font-mono text-base font-bold tabular-nums text-foreground">
                    <MonetaryValue>{fmtAmount(currentBalance, account.currency)}</MonetaryValue>
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                    Initial:{" "}
                    <MonetaryValue>
                      {fmtAmount(account.initialBalance || 0, account.currency)}
                    </MonetaryValue>
                    {account.maxDrawdown
                      ? ` · Max DD: $${account.maxDrawdown.toLocaleString()}`
                      : ""}
                  </span>
                </div>

                {/* 2. Net P&L */}
                <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Net P&L
                    </span>
                    <span
                      className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70 bg-muted/50 px-1 py-0.5 rounded"
                      title={`Profit calculation method: ${account.profitCalcMethod?.toUpperCase() || "FIFO"}`}
                    >
                      {account.profitCalcMethod?.toUpperCase() || "FIFO"}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "mt-1 block font-mono text-base font-bold tabular-nums",
                      pnlClass(netPnl),
                    )}
                  >
                    <MonetaryValue>{fmtMoney(netPnl, account.currency)}</MonetaryValue>
                  </span>
                  <span className={cn("mt-0.5 block font-mono text-[10px]", pnlClass(netPnl))}>
                    {returnPct >= 0 ? "+" : ""}
                    {returnPct.toFixed(2)}% return
                  </span>
                </div>

                {/* 3. Win Rate */}
                <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Win Rate
                  </span>
                  <span className="mt-1 block font-mono text-base font-bold tabular-nums text-foreground">
                    {tradeCount > 0 ? `${(account.winRate ?? 0).toFixed(1)}%` : "—"}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                    {tradeCount > 0
                      ? `${account.winCount ?? 0} wins · ${account.lossCount ?? 0} losses`
                      : "No trades"}
                  </span>
                </div>

                {/* 4. Total Trades */}
                <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Total Trades
                  </span>
                  <span className="mt-1 block font-mono text-base font-bold tabular-nums text-foreground">
                    {tradeCount}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                    {tradeCount > 0 ? "Closed positions" : "Empty"}
                  </span>
                </div>
              </div>

              {/* Snapshot info if broker is connected */}
              {account.snapshot && (
                <div className="mt-2.5 flex items-center justify-between rounded-lg border border-border/50 bg-muted/10 px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span>Broker Equity:</span>
                    <span className="font-mono font-semibold tabular-nums text-foreground">
                      <MonetaryValue>
                        {fmtAmount(account.snapshot.equity, account.currency)}
                      </MonetaryValue>
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {account.snapshot.positions.length} open positions
                  </span>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
