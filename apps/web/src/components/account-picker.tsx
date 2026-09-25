"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrokerIcon } from "@/components/ui/broker-icon";
import { getAccountBrokerInfo } from "@/lib/brokers/broker-catalog";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";
import { AddAccountDialog } from "@/components/add-account-dialog";
import type { AccountRow } from "@/types/accounts";

/** Compact Account Picker used across import and manual entry; triggers AddAccountDialog on demand */
export function AccountPicker({
  value,
  onChange,
  kind,
  className,
  label = "Target Account",
}: {
  value: string;
  onChange: (id: string, account?: AccountRow) => void;
  kind: "import" | "manual";
  className?: string;
  label?: string;
}) {
  const {
    data,
    refresh,
    error: accountError,
  } = useApi<{ accounts: AccountRow[] }>("/api/accounts");
  const [dialogOpen, setDialogOpen] = useState(false);
  const fieldId = useId();

  const accounts = (data?.accounts ?? []).filter((account) => !account.archivedAt);
  const selectedAccount = accounts.find((a) => a.id === value);
  const selectedBrokerInfo = selectedAccount ? getAccountBrokerInfo(selectedAccount) : null;

  const handleAccountCreated = (newId: string) => {
    refresh();
    onChange(newId);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-1.5 w-full min-w-0">
      <div className="flex h-5 items-center justify-between">
        <Label htmlFor={`${fieldId}-account`} className="text-xs font-semibold text-foreground">
          {label}
        </Label>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
        >
          <Plus className="size-3" />
          <span>New account</span>
        </button>
      </div>

      <Select
        value={value}
        onValueChange={(id) => {
          const selected = accounts.find((a) => a.id === id);
          onChange(id, selected);
        }}
      >
        <SelectTrigger
          id={`${fieldId}-account`}
          className={cn(
            "h-9 w-full rounded-lg border-input bg-background/80 text-xs font-medium shadow-xs",
            className,
          )}
        >
          <SelectValue placeholder="Choose an account…">
            {selectedAccount ? (
              <div className="flex items-center gap-2 min-w-0">
                {selectedBrokerInfo?.icon && (
                  <BrokerIcon
                    icon={selectedBrokerInfo.icon}
                    iconDark={selectedBrokerInfo.iconDark}
                    name={selectedAccount.name}
                    invertInDark={selectedBrokerInfo.invertInDark}
                    className="size-4 rounded-xs object-contain shrink-0"
                  />
                )}
                <span className="truncate">{selectedAccount.name}</span>
                {selectedAccount.accountNumber && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    ({selectedAccount.accountNumber})
                  </span>
                )}
              </div>
            ) : (
              <span>Choose an account…</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => {
            const brokerInfo = getAccountBrokerInfo(account);
            return (
              <SelectItem key={account.id} value={account.id} className="text-xs cursor-pointer">
                <div className="flex items-center gap-2 min-w-0">
                  {brokerInfo?.icon && (
                    <BrokerIcon
                      icon={brokerInfo.icon}
                      iconDark={brokerInfo.iconDark}
                      name={account.name}
                      invertInDark={brokerInfo.invertInDark}
                      className="size-4 rounded-xs object-contain shrink-0"
                    />
                  )}
                  <span className="truncate">{account.name}</span>
                  {account.accountNumber && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      ({account.accountNumber})
                    </span>
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {accountError && (
        <p role="alert" className="w-full text-xs text-destructive">
          {accountError}
        </p>
      )}

      <AddAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAccountCreated={handleAccountCreated}
        initialTab={kind === "import" ? "import" : "manual"}
      />
    </div>
  );
}
