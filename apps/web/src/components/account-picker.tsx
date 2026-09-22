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
}: {
  value: string;
  onChange: (id: string) => void;
  kind: "import" | "manual";
  className?: string;
}) {
  const {
    data,
    refresh,
    error: accountError,
  } = useApi<{ accounts: AccountRow[] }>("/api/accounts");
  const [dialogOpen, setDialogOpen] = useState(false);
  const fieldId = useId();

  const accounts = (data?.accounts ?? []).filter((account) => !account.archivedAt);

  const handleAccountCreated = (newId: string) => {
    refresh();
    onChange(newId);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-1.5 w-full min-w-0">
      <div className="flex items-center justify-between">
        <Label htmlFor={`${fieldId}-account`} className="text-xs font-semibold text-foreground/80">
          Target Account
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

      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={`${fieldId}-account`}
          className={cn(
            "h-9 w-full rounded-lg border-input bg-background/80 text-xs font-medium shadow-xs",
            className,
          )}
        >
          <SelectValue placeholder="Choose an account…" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id} className="text-xs">
              {account.name}
            </SelectItem>
          ))}
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
