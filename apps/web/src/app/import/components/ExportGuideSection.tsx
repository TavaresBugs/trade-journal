"use client";

import { useEffect, useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import {
  EXPORT_INSTRUCTIONS,
  PLATFORM_METADATA,
  getBrokerMetadata,
} from "@/lib/brokers/broker-catalog";
import { BrokerIcon } from "@/components/ui/broker-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ExportGuideSectionProps {
  defaultPlatform?: string;
}

export function ExportGuideSection({ defaultPlatform }: ExportGuideSectionProps) {
  const [exportGuideOpen, setExportGuideOpen] = useState(false);
  const [selectedExportGuide, setSelectedExportGuide] = useState<string>(
    defaultPlatform || "tradovate",
  );

  useEffect(() => {
    if (defaultPlatform) {
      setSelectedExportGuide(defaultPlatform);
    }
  }, [defaultPlatform]);

  return (
    <div className="border-t border-border/50 bg-muted/15 dark:bg-muted/10 transition-colors">
      <button
        type="button"
        onClick={() => setExportGuideOpen(!exportGuideOpen)}
        className="w-full flex items-center justify-between px-5 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <HelpCircle className="size-3.5 shrink-0 opacity-70" />
          <span className="font-medium text-foreground">Need help exporting?</span>
          <span className="text-[11px] text-muted-foreground/80 hidden sm:inline">
            Step-by-step export instructions for your broker
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium shrink-0 ml-3">
          <span>{exportGuideOpen ? "Hide" : "Instructions"}</span>
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform duration-200 shrink-0 opacity-70",
              exportGuideOpen && "rotate-180",
            )}
          />
        </div>
      </button>

      {exportGuideOpen && (
        <div className="px-5 py-3 border-t border-border/30 space-y-3 bg-muted/5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">Platform:</span>
              <Select value={selectedExportGuide} onValueChange={setSelectedExportGuide}>
                <SelectTrigger className="h-7 w-auto min-w-[170px] gap-2 rounded-md border-border/60 bg-background/70 px-2.5 text-xs font-medium shadow-2xs">
                  <SelectValue>
                    {(() => {
                      const currentPlatform =
                        PLATFORM_METADATA[selectedExportGuide] ||
                        getBrokerMetadata(selectedExportGuide);
                      const currentInstr = EXPORT_INSTRUCTIONS[selectedExportGuide];
                      const currentLabel =
                        currentPlatform?.name ??
                        currentInstr?.title
                          .replace(" Statement Export", "")
                          .replace(" Report Export", "")
                          .replace(" Orders Export", "")
                          .replace(" Executions Export", "")
                          .replace(" Export", "") ??
                        selectedExportGuide;
                      return (
                        <div className="flex items-center gap-1.5 min-w-0">
                          {currentPlatform?.icon && (
                            <BrokerIcon
                              icon={currentPlatform.icon}
                              name={currentLabel}
                              className="size-3.5 rounded-xs object-contain shrink-0"
                            />
                          )}
                          <span className="truncate">{currentLabel}</span>
                        </div>
                      );
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {Object.entries(EXPORT_INSTRUCTIONS).map(([key, instr]) => {
                    const platform = PLATFORM_METADATA[key] || getBrokerMetadata(key);
                    const label =
                      platform?.name ??
                      instr.title
                        .replace(" Statement Export", "")
                        .replace(" Report Export", "")
                        .replace(" Orders Export", "")
                        .replace(" Executions Export", "")
                        .replace(" Export", "");

                    return (
                      <SelectItem key={key} value={key} className="text-xs cursor-pointer">
                        <div className="flex items-center gap-2 min-w-0">
                          {platform?.icon && (
                            <BrokerIcon
                              icon={platform.icon}
                              name={label}
                              className="size-3.5 rounded-xs object-contain shrink-0"
                            />
                          )}
                          <span>{label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <span className="text-[11px] text-muted-foreground/75 font-mono">
              {EXPORT_INSTRUCTIONS[selectedExportGuide]?.title}
            </span>
          </div>

          {EXPORT_INSTRUCTIONS[selectedExportGuide] && (
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground [text-wrap:pretty] pl-0.5">
              {EXPORT_INSTRUCTIONS[selectedExportGuide].steps.map((step, idx) => (
                <li key={idx} className="leading-relaxed">
                  <span className="text-foreground/90">{step}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
