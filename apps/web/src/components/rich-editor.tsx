"use client";
import { useImperativeHandle, useRef, useState, type Ref } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
  Bold,
  ChevronDown,
  FileText,
  Heading2,
  Italic,
  Link2,
  List,
  ListTodo,
  Pencil,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TemplateManagerDialog } from "./template-manager-dialog";
import { fieldClass } from "@/components/filter-fields";
import { postJson, useApi } from "@/lib/use-api";
import { formatInlineSelection, remarkRepairSpacedEmphasis } from "@/lib/note-formatting";
import { tradeLinkLabel, tradeMarkdownLink, type LinkableTrade } from "@/lib/trade-links";
import { cn } from "@/lib/utils";
export function Markdown({ children }: { children: string }) {
  return (
    <div className="journal-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkRepairSpacedEmphasis]}
        components={{
          table: ({ children }) => (
            <div className="max-w-full overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children }) =>
            href?.startsWith("/trades/") ? (
              <Link href={href}>{children}</Link>
            ) : (
              <a href={href}>{children}</a>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
const BUILT_INS = [
  {
    id: "pre",
    name: "Pre-market plan",
    content:
      "## Market context\n\n## Setups to watch\n\n## Risk limits\n- [ ] Confirm daily risk limit\n- [ ] Check scheduled events\n\n## My intention\n",
  },
  {
    id: "review",
    name: "Trade review",
    content: "## Setup and thesis\n\n## Execution\n\n## What worked\n\n## What I will change\n",
  },
  {
    id: "weekly",
    name: "Weekly review",
    content:
      "## Wins this week\n\n## Repeated mistakes\n\n## Rules I followed\n\n## One improvement for next week\n",
  },
];
export interface RichEditorHandle {
  focus(): void;
}
export function RichEditor({
  value,
  onChange,
  placeholder = "Write your review…",
  defaultMode,
  mode,
  onModeChange,
  showModeToggle = true,
  extraActions,
  className,
  editorRef,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  defaultMode?: "preview" | "edit";
  mode?: "preview" | "edit";
  onModeChange?: (mode: "preview" | "edit") => void;
  showModeToggle?: boolean;
  extraActions?: React.ReactNode;
  className?: string;
  editorRef?: Ref<RichEditorHandle>;
}) {
  const ref = useRef<HTMLTextAreaElement>(null),
    [localPreview, setLocalPreview] = useState(() =>
      defaultMode ? defaultMode === "preview" : Boolean(value.trim()),
    ),
    [error, setError] = useState("");
  const preview = mode ? mode === "preview" : localPreview;
  const setPreview = (next: boolean) => {
    setLocalPreview(next);
    onModeChange?.(next ? "preview" : "edit");
  };
  useImperativeHandle(editorRef, () => ({
    focus() {
      setPreview(false);
      requestAnimationFrame(() => {
        ref.current?.focus();
        ref.current?.setSelectionRange(value.length, value.length);
      });
    },
  }));
  const { data, refresh } = useApi<{ templates: { id: string; name: string; content: string }[] }>(
    "/api/workspace/templates",
  );
  const [manageTemplatesOpen, setManageTemplatesOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false),
    [search, setSearch] = useState("");
  const {
    data: trades,
    error: tradeError,
    loading: tradesLoading,
  } = useApi<{
    trades: LinkableTrade[];
    hasMore: boolean;
  }>(linkOpen ? `/api/trades/lookup?q=${encodeURIComponent(search)}` : null);
  function insert(before: string, after = "") {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length,
      end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + before + value.slice(start, end) + after + value.slice(end));
    setPreview(false);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(start + before.length, end + before.length);
    });
  }
  function formatInline(marker: "*" | "**") {
    const next = formatInlineSelection(
      value,
      ref.current?.selectionStart ?? value.length,
      ref.current?.selectionEnd ?? value.length,
      marker,
    );
    onChange(next.value);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  }
  return (
    <div className={cn("space-y-2", className)}>
      {(!preview || showModeToggle) && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-0.5">
          <div className="flex flex-wrap items-center gap-1">
            {!preview && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs font-semibold rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground gap-1 transition-colors"
                  onClick={() => insert("\n## ")}
                  title="Title / Heading 2 (##)"
                  aria-label="Title / Heading"
                >
                  <Heading2 className="size-3.5" />
                  <span className="text-[11px]">Title</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-xs font-bold rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => formatInline("**")}
                  title="Bold (**)"
                  aria-label="Bold"
                >
                  <Bold className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-xs italic rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => formatInline("*")}
                  title="Italic (*)"
                  aria-label="Italic"
                >
                  <Italic className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-xs rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => insert("\n- ")}
                  title="Bullet list (-)"
                  aria-label="Bullet list"
                >
                  <List className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-xs rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => insert("\n- [ ] ")}
                  title="Checklist (- [ ])"
                  aria-label="Checklist"
                >
                  <ListTodo className="size-3.5" />
                </Button>
                <div className="h-4 w-px bg-border/60 mx-0.5" />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground gap-1.5 transition-colors"
                  onClick={() => setLinkOpen(!linkOpen)}
                  title="Link trade"
                >
                  <Link2 className="size-3.5" />
                  <span className="hidden sm:inline text-[11px]">Trade</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Note templates"
                      className="h-7 px-2 text-xs rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground gap-1 transition-colors"
                      title="Note templates"
                    >
                      <FileText className="size-3.5" />
                      <span className="hidden sm:inline text-[11px]">Template</span>
                      <ChevronDown className="size-3 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    aria-label="Note templates"
                    className="w-56 rounded-xl"
                  >
                    <DropdownMenuItem
                      disabled={!value}
                      onSelect={async () => {
                        const name = prompt("Name this note template");
                        if (!name) return;
                        try {
                          await postJson("/api/workspace/templates", { name, content: value });
                          refresh();
                        } catch (e) {
                          setError(String(e));
                        }
                      }}
                      className="gap-2 text-xs cursor-pointer"
                    >
                      <Save
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-muted-foreground"
                      />
                      <span>Save note as template…</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        setManageTemplatesOpen(true);
                      }}
                      className="gap-2 text-xs cursor-pointer"
                    >
                      <SlidersHorizontal
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-muted-foreground"
                      />
                      <span>Manage templates…</span>
                    </DropdownMenuItem>

                    {data?.templates && data.templates.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Custom templates</DropdownMenuLabel>
                        {data.templates.map((template) => (
                          <DropdownMenuItem
                            key={template.id}
                            onSelect={() =>
                              onChange(value + (value ? "\n\n" : "") + template.content)
                            }
                            className="gap-2 text-xs cursor-pointer"
                          >
                            <FileText
                              aria-hidden="true"
                              className="size-3.5 shrink-0 text-muted-foreground"
                            />
                            <span className="truncate">{template.name}</span>
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Built-in</DropdownMenuLabel>
                    {BUILT_INS.map((template) => (
                      <DropdownMenuItem
                        key={template.id}
                        onSelect={() => onChange(value + (value ? "\n\n" : "") + template.content)}
                        className="gap-2 text-xs cursor-pointer"
                      >
                        <FileText
                          aria-hidden="true"
                          className="size-3.5 shrink-0 text-muted-foreground"
                        />
                        <span className="truncate">{template.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {showModeToggle && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "size-7 p-0 rounded-lg text-muted-foreground hover:text-foreground transition-colors",
                  preview && "bg-muted text-foreground border border-border/60",
                )}
                onClick={() => setPreview(!preview)}
                title={preview ? "Switch to edit mode" : "Preview notes"}
                aria-label={preview ? "Switch to edit mode" : "Preview notes"}
              >
                <Pencil className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}
      {linkOpen && !preview && (
        <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-2.5">
          <input
            aria-label="Find trade by symbol, date or account"
            placeholder="Search symbol, date or account"
            className={fieldClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-40 overflow-y-auto">
            {tradesLoading && (
              <p role="status" className="text-xs text-muted-foreground">
                Loading trades…
              </p>
            )}
            {tradeError && (
              <p role="alert" className="text-xs text-destructive">
                {tradeError}
              </p>
            )}
            {!tradesLoading &&
              !tradeError &&
              trades?.trades.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className="block w-full rounded-lg p-1.5 text-left text-xs hover:bg-accent transition-colors"
                  onClick={() => {
                    onChange(value + `\n${tradeMarkdownLink(t)}\n`);
                    setLinkOpen(false);
                    setPreview(true);
                  }}
                >
                  {tradeLinkLabel(t)}
                </button>
              ))}
            {!tradesLoading && !tradeError && trades?.trades.length === 0 && (
              <p className="text-xs text-muted-foreground">No matching trades.</p>
            )}
            {!tradesLoading && !tradeError && trades?.hasMore && (
              <p className="text-xs text-muted-foreground">
                Showing the latest 50 matches. Search by date or account to find older trades.
              </p>
            )}
          </div>
        </div>
      )}
      {preview ? (
        <div className="relative min-h-36 rounded-xl border border-input/40 bg-muted/10 p-3.5 text-xs sm:text-sm leading-relaxed">
          <Markdown>{value || "*Nothing written yet.*"}</Markdown>
        </div>
      ) : (
        <div className="relative">
          <textarea
            ref={ref}
            aria-label="Review notes"
            className={cn(
              "w-full min-w-0 rounded-xl border border-input/60 bg-muted/20 p-3 min-h-36 resize-y text-xs sm:text-sm leading-relaxed shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              extraActions && "pb-10",
            )}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
          {extraActions && (
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 z-10">
              {extraActions}
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <TemplateManagerDialog
        open={manageTemplatesOpen}
        onOpenChange={setManageTemplatesOpen}
        templates={data?.templates ?? []}
        builtIns={BUILT_INS}
        onRefresh={refresh}
      />
    </div>
  );
}
