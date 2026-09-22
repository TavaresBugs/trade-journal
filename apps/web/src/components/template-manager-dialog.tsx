"use client";

import { useState } from "react";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Lock,
  Loader2,
  AlertCircle,
  Check,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { postJson } from "@/lib/use-api";
import { cn } from "@/lib/utils";

export interface TemplateItem {
  id: string;
  name: string;
  content: string;
}

export function TemplateManagerDialog({
  open,
  onOpenChange,
  templates,
  builtIns,
  onRefresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: TemplateItem[];
  builtIns: { id: string; name: string; content: string }[];
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<
    TemplateItem | { id?: undefined; name: string; content: string } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showBuiltIns, setShowBuiltIns] = useState(false);

  const handleStartCreate = () => {
    setError(null);
    setConfirmDeleteId(null);
    setEditing({ name: "", content: "" });
  };

  const handleStartEdit = (template: TemplateItem) => {
    setError(null);
    setConfirmDeleteId(null);
    setEditing({ ...template });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.name.trim()) {
      setError("Please provide a template name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editing.id) {
        await postJson(
          "/api/workspace/templates",
          { id: editing.id, name: editing.name.trim(), content: editing.content },
          "PATCH",
        );
      } else {
        await postJson(
          "/api/workspace/templates",
          { name: editing.name.trim(), content: editing.content },
          "POST",
        );
      }
      onRefresh();
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/workspace/templates", { id }, "DELETE");
      onRefresh();
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setEditing(null);
          setError(null);
          setConfirmDeleteId(null);
        }
      }}
    >
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <FileText className="size-4 text-muted-foreground" />
            <span>Manage note templates</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Create, rename, edit or delete your personal note templates.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive"
          >
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {editing ? (
          /* Create / Edit Form */
          <form onSubmit={handleSave} className="space-y-3.5 pt-1">
            <div className="space-y-1.5">
              <label htmlFor="template-name-input" className="text-xs font-medium text-foreground">
                Template name
              </label>
              <Input
                id="template-name-input"
                placeholder="e.g. Pre-market checklist"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="h-9 rounded-xl text-xs"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="template-content-input"
                className="text-xs font-medium text-foreground"
              >
                Markdown content
              </label>
              <Textarea
                id="template-content-input"
                placeholder="Write your template structure in Markdown (headings, lists, checkboxes)..."
                value={editing.content}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                rows={9}
                className="rounded-xl text-xs font-mono leading-relaxed resize-y bg-muted/20"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setError(null);
                }}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={busy || !editing.name.trim()}
                className="gap-1.5 rounded-xl px-4 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                <span>{editing.id ? "Save changes" : "Create template"}</span>
              </Button>
            </div>
          </form>
        ) : (
          /* Templates List */
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Custom templates ({templates.length})
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleStartCreate}
                className="gap-1.5 rounded-xl text-xs h-8 px-3 hover:bg-muted/80"
              >
                <Plus className="size-3.5" />
                <span>New template</span>
              </Button>
            </div>

            {templates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
                <p>No custom templates saved yet.</p>
                <p className="mt-1 text-[11px] text-muted-foreground/80">
                  Click &quot;New template&quot; above or save your current note from the editor.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:border-border"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {tpl.name}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                          Custom
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] font-mono text-muted-foreground line-clamp-2 bg-background/50 rounded-lg p-1.5 border border-border/30">
                        {tpl.content ? tpl.content.trim().slice(0, 140) : "(Empty template)"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                      {confirmDeleteId === tpl.id ? (
                        <div className="flex items-center gap-1 bg-destructive/10 border border-destructive/30 rounded-xl p-1 animate-in fade-in duration-150">
                          <span className="text-[11px] text-destructive px-1.5 font-medium">
                            Delete?
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={busy}
                            onClick={() => handleDelete(tpl.id)}
                            className="h-7 px-2 text-[11px] rounded-lg"
                          >
                            {busy ? <Loader2 className="size-3 animate-spin" /> : "Confirm"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDeleteId(null)}
                            className="h-7 px-2 text-[11px] rounded-lg"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEdit(tpl)}
                            className="size-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                            title={`Rename or edit "${tpl.name}"`}
                            aria-label={`Rename or edit "${tpl.name}"`}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDeleteId(tpl.id)}
                            className="size-8 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title={`Delete "${tpl.name}"`}
                            aria-label={`Delete "${tpl.name}"`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Built-in System Templates Section */}
            <div className="pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => setShowBuiltIns(!showBuiltIns)}
                className="flex items-center justify-between w-full text-left py-1 text-xs text-muted-foreground hover:text-foreground transition-colors group"
              >
                <div className="flex items-center gap-1.5">
                  <Lock className="size-3 text-muted-foreground/70" />
                  <span className="font-medium text-[11px] uppercase tracking-wider">
                    System templates ({builtIns.length})
                  </span>
                </div>
                <ChevronRight
                  className={cn(
                    "size-3.5 text-muted-foreground/60 transition-transform duration-200",
                    showBuiltIns && "rotate-90",
                  )}
                />
              </button>

              {showBuiltIns && (
                <div className="mt-2 space-y-1.5 animate-in fade-in duration-200">
                  {builtIns.map((builtin) => (
                    <div
                      key={builtin.id}
                      className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/10 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-foreground">{builtin.name}</span>
                        <p className="text-[11px] font-mono text-muted-foreground line-clamp-1">
                          {builtin.content.slice(0, 80)}…
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                        Built-in
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
