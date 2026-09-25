"use client";

import { useEffect, useState } from "react";
import { Landmark, PencilLine, Radio, Trophy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BROKER_CATALOG, type BrokerCatalogItem } from "@/lib/brokers/broker-catalog";
import { useApi } from "@/lib/use-api";
import type { AccountRow } from "@/types/accounts";
import { PropAccountForm } from "./account-dialog/PropAccountForm";
import { BrokerAccountForm } from "./account-dialog/BrokerAccountForm";
import { SyncAccountForm } from "./account-dialog/SyncAccountForm";
import { ManualAccountForm } from "./account-dialog/ManualAccountForm";

export { BROKER_CATALOG };
export type { BrokerCatalogItem };

export interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountCreated?: (accountId: string) => void;
  initialTab?: "prop" | "broker" | "sync" | "manual" | "import";
  initialAccountNumber?: string;
  initialPlatform?: string;
  initialBroker?: string;
  initialName?: string;
  initialBalance?: number | string;
  initialMaxDrawdown?: number | string;
}

export function AddAccountDialog({
  open,
  onOpenChange,
  onAccountCreated,
  initialTab = "prop",
  initialAccountNumber,
  initialPlatform,
  initialBroker,
  initialName,
  initialBalance,
  initialMaxDrawdown,
}: AddAccountDialogProps) {
  const mapInitialTab = (tab?: string): "prop" | "broker" | "sync" | "manual" => {
    if (tab === "import" || tab === "prop") return "prop";
    if (tab === "broker") return "broker";
    if (tab === "sync") return "sync";
    if (tab === "manual") return "manual";
    return "prop";
  };

  const [activeTab, setActiveTab] = useState<"prop" | "broker" | "sync" | "manual">(() =>
    mapInitialTab(initialTab),
  );

  const { refresh: refreshAccounts } = useApi<{ accounts: AccountRow[] }>(
    "/api/accounts?summary=1",
  );

  useEffect(() => {
    if (open) {
      setActiveTab(mapInitialTab(initialTab));
    }
  }, [open, initialTab]);

  const handleSuccess = (newAccountId: string) => {
    refreshAccounts();
    onAccountCreated?.(newAccountId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[660px] max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl border-border/70 shadow-xl">
        <DialogHeader className="gap-1 pb-1">
          <DialogTitle className="text-base font-semibold tracking-tight">
            Add Journal Account
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure an evaluation prop firm, direct broker, API sync, or manual tracking account.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "prop" | "broker" | "sync" | "manual")}
          className="pt-1"
        >
          <TabsList className="w-full grid grid-cols-4 h-9 p-1 gap-1 bg-muted/60 dark:bg-muted/40 rounded-xl">
            <TabsTrigger
              value="prop"
              className="h-full text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
            >
              <Trophy className="mr-1.5 size-3.5 shrink-0" />
              <span>Prop firm</span>
            </TabsTrigger>
            <TabsTrigger
              value="broker"
              className="h-full text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
            >
              <Landmark className="mr-1.5 size-3.5 shrink-0" />
              <span>Broker</span>
            </TabsTrigger>
            <TabsTrigger
              value="sync"
              className="h-full text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
            >
              <Radio className="mr-1.5 size-3.5 shrink-0" />
              <span>API sync</span>
            </TabsTrigger>
            <TabsTrigger
              value="manual"
              className="h-full text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
            >
              <PencilLine className="mr-1.5 size-3.5 shrink-0" />
              <span>Manual</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PROP FIRM */}
          <TabsContent value="prop" className="mt-3.5 space-y-3.5">
            <PropAccountForm
              initialBroker={initialBroker}
              initialPlatform={initialPlatform}
              initialAccountNumber={initialAccountNumber}
              initialName={initialName}
              initialBalance={initialBalance}
              initialMaxDrawdown={initialMaxDrawdown}
              onSuccess={handleSuccess}
            />
          </TabsContent>

          {/* TAB 2: DIRECT BROKER */}
          <TabsContent value="broker" className="mt-3.5 space-y-3.5">
            <BrokerAccountForm
              initialBroker={initialBroker}
              initialAccountNumber={initialAccountNumber}
              initialName={initialName}
              initialBalance={initialBalance}
              onSuccess={handleSuccess}
            />
          </TabsContent>

          {/* TAB 3: API SYNC */}
          <TabsContent value="sync" className="mt-3.5 space-y-3.5">
            <SyncAccountForm onSuccess={handleSuccess} />
          </TabsContent>

          {/* TAB 4: MANUAL */}
          <TabsContent value="manual" className="mt-3.5 space-y-3.5">
            <ManualAccountForm initialName={initialName} onSuccess={handleSuccess} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
