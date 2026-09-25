"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileUp, Landmark, PencilLine } from "lucide-react";
import { FilterBar } from "@/components/filter-bar";
import { ManualTradeEntry } from "@/components/manual-trade-entry";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileImport } from "./components/FileImport";
import { BrokerSyncCatalog } from "./components/BrokerSyncCatalog";

export default function ImportPage() {
  return (
    <Suspense>
      <ImportView />
    </Suspense>
  );
}

function ImportView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"file" | "sync" | "manual">(
    tabParam === "sync" || tabParam === "manual" ? tabParam : "file",
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>();

  return (
    <div className="min-h-screen bg-background">
      <FilterBar title="Import trades" />
      <div className="mx-auto max-w-4xl p-4 sm:p-6 space-y-5">
        {/* Page Subtitle */}
        <div className="space-y-0.5">
          <h2
            className="text-lg font-bold tracking-tight text-foreground"
            style={{ textWrap: "balance" }}
          >
            Import Trades &amp; Connect Accounts
          </h2>
          <p className="text-xs text-muted-foreground" style={{ textWrap: "pretty" }}>
            Bring executions into your journal via broker statement files, automated read-only sync,
            or manual entry.
          </p>
        </div>

        {/* Standardized Segmented Control */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "file" | "sync" | "manual")}
          className="space-y-4"
        >
          <TabsList className="w-full flex h-9 p-1 gap-1 bg-muted/60 dark:bg-muted/40 rounded-xl">
            <TabsTrigger
              value="file"
              className="flex-1 h-full gap-2 text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
            >
              <FileUp className="size-3.5 shrink-0" />
              <span>File upload</span>
            </TabsTrigger>
            <TabsTrigger
              value="sync"
              className="flex-1 h-full gap-2 text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
            >
              <Landmark className="size-3.5 shrink-0" />
              <span>Broker sync</span>
            </TabsTrigger>
            <TabsTrigger
              value="manual"
              className="flex-1 h-full gap-2 text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
            >
              <PencilLine className="size-3.5 shrink-0" />
              <span>Manual entry</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: FILE IMPORT */}
          <TabsContent value="file" className="focus-visible:outline-none">
            <FileImport initialAccountId={selectedAccountId} />
          </TabsContent>

          {/* TAB 2: BROKER SYNC */}
          <TabsContent value="sync" className="focus-visible:outline-none">
            <BrokerSyncCatalog
              onGoToFile={(newId) => {
                if (newId) setSelectedAccountId(newId);
                setActiveTab("file");
              }}
            />
          </TabsContent>

          {/* TAB 3: MANUAL ENTRY */}
          <TabsContent value="manual" className="focus-visible:outline-none">
            <div className="rounded-2xl border border-border/70 bg-card/40 p-5 space-y-4 shadow-xs">
              <div className="border-b border-border/50 pb-3">
                <h3 className="text-sm font-semibold text-foreground">Add executions manually</h3>
                <p className="text-xs text-muted-foreground">
                  Record trades directly into your accounts with custom executions, fees, and notes.
                </p>
              </div>
              <ManualTradeEntry onSaved={() => router.push("/trades")} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
