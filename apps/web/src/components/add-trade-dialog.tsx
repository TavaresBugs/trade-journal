"use client";

import { useState } from "react";
import { FileUp, PencilLine, Plus } from "lucide-react";
import { ManualTradeEntry } from "./manual-trade-entry";
import { QuickTradeImport } from "./quick-trade-import";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export function AddTradeDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"manual" | "import">("manual");

  const handleSaved = () => {
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1.5 px-3 text-xs font-semibold cursor-pointer">
          <Plus className="size-3.5" />
          Add trade
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-base font-semibold">Add trades</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Record executions manually or import statement files directly from your broker.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "manual" | "import")}
          className="w-full"
        >
          <TabsList className="w-full grid grid-cols-2 h-9 p-1 gap-1 bg-muted/60 dark:bg-muted/40 rounded-xl">
            <TabsTrigger
              value="manual"
              className="h-full gap-2 text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <PencilLine className="size-3.5 shrink-0" />
              <span>Manual entry</span>
            </TabsTrigger>
            <TabsTrigger
              value="import"
              className="h-full gap-2 text-xs font-medium rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-black data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <FileUp className="size-3.5 shrink-0" />
              <span>Import file</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="mt-3 focus-visible:outline-none">
            <ManualTradeEntry onSaved={handleSaved} />
          </TabsContent>

          <TabsContent value="import" className="mt-3 focus-visible:outline-none">
            <QuickTradeImport onImported={handleSaved} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
