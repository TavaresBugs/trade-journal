"use client";

import { useId, useRef, useState, type CSSProperties } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, LayoutTemplate, Save, Search, Settings2, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  normalizeArrangement,
  visibleCardIds,
  type DashboardArrangement,
} from "@/lib/dashboard-layout";
import { type DashboardWidget, DashboardCardCustomizer } from "./dashboard-customizer";

export function DashboardSavedLayouts({
  layouts,
  current,
  ids,
  onLoad,
  onSave,
  widgets,
  onVisibilityChange,
  onShowAll,
  onRestore,
}: {
  layouts: Record<string, DashboardArrangement>;
  current: DashboardArrangement;
  ids: string[];
  onLoad(name: string): void;
  onSave(name: string): boolean;
  widgets?: DashboardWidget[];
  onVisibilityChange?(id: string, visible: boolean): void;
  onShowAll?(): void;
  onRestore?(): void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"layouts" | "customize">("layouts");
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [saved, setSaved] = useState("");
  const titleId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    setQuery("");
    setSaved("");
    if (!next) {
      setView("layouts");
    }
  };

  const handleSetView = (nextView: "layouts" | "customize") => {
    setView(nextView);
  };

  // Always include the Default layout preset
  const allLayouts: Record<string, DashboardArrangement> = {
    Default: normalizeArrangement(null, ids),
    ...layouts,
  };
  const names = Object.keys(allLayouts);
  const matches = names.filter((name) =>
    name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Saved dashboard layouts"
          className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-[background-color,transform] duration-150 hover:bg-muted/60 active:scale-[0.98] cursor-pointer select-none data-[state=open]:bg-muted/60"
        >
          <LayoutTemplate size={14} className="text-muted-foreground shrink-0" />
          <span>Layouts</span>
          <ChevronDown
            size={13}
            className="text-muted-foreground shrink-0 transition-transform duration-200 [[data-state=open]_&]:rotate-180"
          />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="dashboard-customize-panel dashboard-layout-panel"
          align="start"
          sideOffset={10}
          collisionPadding={12}
          aria-labelledby={titleId}
        >
          {view === "customize" && widgets && onVisibilityChange && onShowAll && onRestore ? (
            <DashboardCardCustomizer
              widgets={widgets}
              hidden={current.hidden}
              onVisibilityChange={onVisibilityChange}
              onShowAll={onShowAll}
              onRestore={onRestore}
              onBack={() => handleSetView("layouts")}
              titleId={titleId}
            />
          ) : (
            <>
              <div className="dashboard-customize-heading">
                <h2 id={titleId}>Saved layouts</h2>
                <span className="dashboard-customize-count">
                  {names.length} {names.length === 1 ? "layout" : "layouts"}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  {widgets && (
                    <button
                      type="button"
                      className="dashboard-customize-icon-button"
                      title="Customize visible cards"
                      aria-label="Customize visible cards"
                      onClick={() => handleSetView("customize")}
                    >
                      <Settings2 size={15} />
                    </button>
                  )}
                  <Popover.Close asChild>
                    <button
                      type="button"
                      className="dashboard-customize-icon-button"
                      aria-label="Close saved layouts"
                    >
                      <X size={14} />
                    </button>
                  </Popover.Close>
                </div>
              </div>
              {names.length > 4 && (
                <div className="dashboard-customize-search">
                  <Search size={14} aria-hidden="true" />
                  <input
                    aria-label="Find a layout"
                    placeholder="Find a layout…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
              )}
              <div
                ref={listRef}
                className="dashboard-customize-results"
                onKeyDown={(event) => {
                  const buttons = Array.from(
                    listRef.current?.querySelectorAll<HTMLButtonElement>("[data-saved-layout]") ??
                      [],
                  );
                  const index = buttons.indexOf(event.target as HTMLButtonElement);
                  if (index < 0) return;
                  const next = {
                    ArrowDown: index + 1,
                    ArrowUp: index - 1,
                    Home: 0,
                    End: buttons.length - 1,
                  }[event.key];
                  if (next !== undefined) {
                    event.preventDefault();
                    buttons[(next + buttons.length) % buttons.length]?.focus();
                  }
                }}
              >
                <div className="dashboard-customize-list">
                  {matches.map((name, index) => {
                    const layout = normalizeArrangement(allLayouts[name], ids);
                    const active = JSON.stringify(layout) === JSON.stringify(current);
                    return (
                      <button
                        key={name}
                        type="button"
                        data-saved-layout
                        className="dashboard-customize-option dashboard-layout-option"
                        style={{ "--option-index": Math.min(index, 7) } as CSSProperties}
                        aria-label={`Load ${name}`}
                        onClick={() => {
                          onLoad(name);
                          setOpen(false);
                        }}
                      >
                        <span className="dashboard-customize-card-icon">
                          <LayoutTemplate size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">{name}</span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {visibleCardIds(layout).length} cards{active ? " · Current layout" : ""}
                          </span>
                        </span>
                        {active && (
                          <Check size={15} className="shrink-0 text-brand" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                  {!matches.length && (
                    <div className="dashboard-customize-empty">
                      <LayoutTemplate size={24} aria-hidden="true" />
                      <p>{names.length ? "No matching layouts" : "Make this dashboard yours"}</p>
                      {!names.length && (
                        <span className="max-w-56 text-center text-[11px] leading-relaxed">
                          Save your favorite card arrangements and switch between them here.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <form
                className="dashboard-layout-save"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!name.trim()) return;
                  if (!onSave(name.trim())) return;
                  setSaved(`${name.trim()} saved`);
                  setName("");
                  setQuery("");
                }}
              >
                <label
                  htmlFor={`${titleId}-name`}
                  className="text-[11px] font-medium text-muted-foreground"
                >
                  Save current layout
                </label>
                <div className="flex min-w-0 items-center gap-2">
                  <Input
                    id={`${titleId}-name`}
                    aria-label="Layout name"
                    placeholder="e.g. Weekly review"
                    value={name}
                    maxLength={80}
                    onChange={(event) => {
                      setName(event.target.value);
                      setSaved("");
                    }}
                    className="h-9 rounded-xl text-xs"
                  />
                  <Button
                    size="sm"
                    type="submit"
                    className="h-9 shrink-0 rounded-xl"
                    disabled={!name.trim()}
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save
                  </Button>
                </div>
                {saved && (
                  <p role="status" className="text-[11px] text-muted-foreground">
                    {saved}
                  </p>
                )}
              </form>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
