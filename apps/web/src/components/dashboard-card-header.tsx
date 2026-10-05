"use client";

import { createContext, useContext, type ComponentType, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger, HelpHint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface DashboardCardContextValue {
  id: string;
  label: string;
  isDragging: boolean;
  activatorProps: Record<string, unknown>;
  activatorRef: (node: HTMLElement | null) => void;
}

export const DashboardCardContext = createContext<DashboardCardContextValue | null>(null);

export function useDashboardCard() {
  return useContext(DashboardCardContext);
}

/**
 * Standardized in-flow drag handle button.
 * Renders the 6-dots GripVertical icon bound to the card's dnd-kit sortable activator.
 */
export function DashboardCardDragHandle({ className }: { className?: string }) {
  const card = useDashboardCard();
  if (!card) return null;

  return (
    <Button
      ref={card.activatorRef}
      type="button"
      size="icon"
      variant="ghost"
      {...card.activatorProps}
      aria-label={`Rearrange ${card.label}`}
      title={`Drag to rearrange ${card.label}`}
      className={cn(
        "h-6 w-5 shrink-0 touch-none cursor-grab rounded text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing",
        className,
      )}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </Button>
  );
}

export interface DashboardCardHeaderProps {
  title?: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  headerRight?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Standardized Dashboard Card Header.
 * Uses a clean 3-zone flexbox:
 * [Grip (6 dots) + Title + HelpHint] ─── gap ─── [HeaderRight + Icon/Tooltip]
 */
export function DashboardCardHeader({
  title,
  hint,
  icon: Icon,
  headerRight,
  children,
  className,
}: DashboardCardHeaderProps) {
  return (
    <CardHeader
      className={cn(
        "flex min-w-0 flex-row items-center justify-between gap-2 p-4 pb-2 space-y-0",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <DashboardCardDragHandle />
        {title &&
          (typeof title === "string" ? <CardTitle>{title}</CardTitle> : title)}
        {hint && !Icon && (
          <HelpHint heading={typeof title === "string" ? title : ""}>
            {hint}
          </HelpHint>
        )}
      </div>

      {(headerRight || Icon) && (
        <div className="flex items-center gap-2 shrink-0">
          {headerRight}
          {Icon && hint && (
            <Tooltip>
              <TooltipTrigger
                className="cursor-help inline-flex items-center justify-center rounded p-0.5 text-muted-foreground/70 transition-colors hover:bg-accent/60 hover:text-foreground"
                aria-label={`About ${typeof title === "string" ? title : "card"}`}
              >
                <Icon className="size-[18px]" />
              </TooltipTrigger>
              <TooltipContent>
                {typeof title === "string" && (
                  <div className="mb-1 font-semibold">{title}</div>
                )}
                <div className="text-muted-foreground">{hint}</div>
              </TooltipContent>
            </Tooltip>
          )}
          {Icon && !hint && (
            <Icon className="size-[18px] text-muted-foreground/70" />
          )}
        </div>
      )}

      {children}
    </CardHeader>
  );
}
