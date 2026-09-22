"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, FlaskConical, Plus, RefreshCw, SlidersHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { postJson, useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

interface AccountOption {
  id: string;
  name: string;
  broker: string;
  archivedAt: string | null;
}

/**
 * Institutional account switcher dropdown matching LuxAlgo Quant standards.
 * Features inline sync button, active checkmarks, Add Account modal, and Manage Accounts navigation.
 */
export function AccountSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data, error, refresh } = useApi<{ accounts: AccountOption[] }>("/api/accounts?summary=1");

  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState("");

  const selected = params.get("accounts")?.split(",").filter(Boolean) ?? [];
  const accounts = data?.accounts.filter((a) => !a.archivedAt || selected.includes(a.id)) ?? [];
  const demo = accounts.find((a) => a.broker === "demo");
  const value = selected.length > 1 ? "multiple" : (selected[0] ?? "all");
  const label =
    selected.length > 1
      ? `${selected.length} accounts`
      : (accounts.find((a) => a.id === selected[0])?.name ??
        (selected.length ? "Selected account" : "All accounts"));

  function selectAccount(id: string) {
    const next = new URLSearchParams(params.toString());
    if (id === "all") next.delete("accounts");
    else next.set("accounts", id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const handleSync = async () => {
    setSyncing(true);
    try {
      refresh();
      await new Promise((r) => setTimeout(r, 600));
    } finally {
      setSyncing(false);
    }
  };

  const handleLoadDemo = async () => {
    setDemoError("");
    setLoadingDemo(true);
    try {
      const result = await postJson<{ accountId: string }>("/api/demo", {});
      refresh();
      selectAccount(result.accountId);
    } catch (cause) {
      setDemoError(cause instanceof Error ? cause.message : "Could not load demo data.");
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Sync / Refresh Button */}
        <button
          type="button"
          aria-label="Sync journal"
          title="Refresh accounts"
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.96] disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={cn("size-3.5", syncing && "animate-spin text-foreground")} />
        </button>

        {/* Account Selector Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Switch journal account"
              className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-left text-xs font-medium text-foreground transition-[background-color,transform] duration-150 hover:bg-muted/60 active:scale-[0.98] max-w-40 sm:max-w-48 cursor-pointer select-none"
            >
              <span className="min-w-0 truncate">{loadingDemo ? "Loading demo…" : label}</span>
              <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-52 rounded-xl p-1 shadow-xl border border-border/70"
          >
            {/* All accounts option */}
            <DropdownMenuItem
              onClick={() => selectAccount("all")}
              className="flex items-center justify-between cursor-pointer py-1.5 px-2.5 text-xs rounded-lg font-medium"
            >
              <span>All accounts</span>
              {value === "all" && <Check className="size-3.5 shrink-0 text-foreground" />}
            </DropdownMenuItem>

            {/* Multiple accounts selection indicator */}
            {selected.length > 1 && (
              <DropdownMenuItem
                disabled
                className="flex items-center justify-between text-xs rounded-lg text-muted-foreground"
              >
                <span>{label}</span>
                <Check className="size-3.5 shrink-0 text-foreground" />
              </DropdownMenuItem>
            )}

            {/* List of user accounts */}
            {accounts
              .filter((a) => a.broker !== "demo")
              .map((account) => {
                const isSelected = selected.length === 1 && selected[0] === account.id;
                return (
                  <DropdownMenuItem
                    key={account.id}
                    onClick={() => selectAccount(account.id)}
                    className="flex items-center justify-between cursor-pointer py-1.5 px-2.5 text-xs rounded-lg font-medium"
                  >
                    <span className="truncate">
                      {account.name}
                      {account.archivedAt ? " (archived)" : ""}
                    </span>
                    {isSelected && <Check className="size-3.5 shrink-0 text-foreground" />}
                  </DropdownMenuItem>
                );
              })}

            <DropdownMenuSeparator />

            {/* Add account action */}
            <DropdownMenuItem
              onClick={() => setAddAccountOpen(true)}
              className="flex items-center gap-2 cursor-pointer py-1.5 px-2.5 text-xs rounded-lg text-foreground hover:bg-muted"
            >
              <Plus className="size-3.5 text-muted-foreground" />
              <span className="font-medium">Add account</span>
            </DropdownMenuItem>

            {/* Manage accounts action */}
            <DropdownMenuItem
              onClick={() => router.push("/accounts")}
              className="flex items-center gap-2 cursor-pointer py-1.5 px-2.5 text-xs rounded-lg text-foreground hover:bg-muted"
            >
              <SlidersHorizontal className="size-3.5 text-muted-foreground" />
              <span className="font-medium">Manage accounts</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Demo data account option or Load demo data button (at the bottom) */}
            {demo ? (
              <DropdownMenuItem
                onClick={() => selectAccount(demo.id)}
                className="flex items-center justify-between cursor-pointer py-1.5 px-2.5 text-xs rounded-lg font-medium text-muted-foreground"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <FlaskConical className="size-3.5 shrink-0" />
                  {demo.name}
                </span>
                {selected.length === 1 && selected[0] === demo.id && (
                  <Check className="size-3.5 shrink-0 text-foreground" />
                )}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={handleLoadDemo}
                disabled={loadingDemo}
                className="flex items-center gap-1.5 cursor-pointer py-1.5 px-2.5 text-xs rounded-lg font-medium text-muted-foreground"
              >
                <FlaskConical className="size-3.5 shrink-0" />
                <span>{loadingDemo ? "Loading demo…" : "Load demo data"}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {(demoError || error) && (
          <p
            role="alert"
            className="max-w-48 truncate text-[11px] text-destructive"
            title={(demoError || error) ?? undefined}
          >
            {demoError || error}
          </p>
        )}
      </div>

      {/* Add Account Modal */}
      <AddAccountDialog
        open={addAccountOpen}
        onOpenChange={setAddAccountOpen}
        onAccountCreated={(id) => {
          refresh();
          selectAccount(id);
        }}
      />
    </>
  );
}
