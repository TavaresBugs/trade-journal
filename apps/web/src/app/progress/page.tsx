"use client";

import { Suspense, useMemo, useState } from "react";
import { Plus, MoreHorizontal, Pencil, Archive, Trash2 } from "lucide-react";
import { FilterBar } from "@/components/filter-bar";
import { Field, fieldClass } from "@/components/filter-fields";
import { OptionSelect } from "@/components/ui/option-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReviewExport } from "@/components/review-export";
import { useApi, postJson } from "@/lib/use-api";
import { scheduledRules, progressScore, type Routine, type RoutineCheck } from "@/lib/progress";
import { CalendarProgress } from "@/components/calendar-progress";
import { cn } from "@/lib/utils";

const STAGES = ["Before trading", "During trading", "After trading"];
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ProgressPage() {
  return (
    <Suspense>
      <Progress />
    </Suspense>
  );
}

function Progress() {
  const { data, error, refresh } = useApi<{
    rules: Routine[];
    checks: RoutineCheck[];
    today: string;
  }>("/api/workspace/progress");

  const [date, setDate] = useState("");
  const [open, setOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState(STAGES[0]!);
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]);
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);

  // Single source of truth: selectedDate drives everything
  const selected = date || data?.today || "";
  const rules = data ? scheduledRules(data.rules, selected) : [];
  const score = data ? progressScore(data.rules, data.checks, selected) : null;

  // Month-to-date metrics bounded to elapsed days
  const monthMetrics = useMemo(() => {
    if (!data) return { rate: null, completed: 0, scheduled: 0, perfectDays: 0 };
    const todayStr = data.today;
    const currentYear = Number(todayStr.slice(0, 4));
    const currentMonth = Number(todayStr.slice(5, 7));
    const daysInMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();

    let scheduled = 0;
    let completed = 0;
    let perfectDays = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const currDate = new Date(Date.UTC(currentYear, currentMonth - 1, d));
      const dateStr = currDate.toISOString().slice(0, 10);
      if (dateStr <= todayStr) {
        const sc = progressScore(data.rules, data.checks, dateStr);
        if (sc.total > 0) {
          scheduled += sc.total;
          completed += sc.completed;
          if (sc.score === 1) perfectDays++;
        }
      }
    }

    const rate = scheduled > 0 ? Math.round((completed / scheduled) * 100) : null;
    return { rate, completed, scheduled, perfectDays };
  }, [data]);

  // Active unarchived routines count
  const activeRules = useMemo(() => {
    return data?.rules.filter((r) => !r.archivedAt) ?? [];
  }, [data]);

  async function act(body: unknown, method: "POST" | "PATCH" | "DELETE" = "POST") {
    setBusy(true);
    try {
      await postJson("/api/workspace/progress", body, method);
      setFailure("");
      refresh();
      return true;
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function openAddDialog(defaultStage?: string) {
    setEditingRoutine(null);
    setTitle("");
    setStage(defaultStage || STAGES[0]!);
    setWeekdays([1, 2, 3, 4, 5]);
    setFailure("");
    setOpen(true);
  }

  function openEditDialog(routine: Routine) {
    setEditingRoutine(routine);
    setTitle(routine.title);
    setStage(routine.stage);
    setWeekdays(routine.weekdays);
    setFailure("");
    setOpen(true);
  }

  return (
    <div>
      <FilterBar
        title="Progress"
        actions={
          <Button size="sm" onClick={() => openAddDialog()}>
            <Plus className="size-4 mr-1 sm:inline hidden" />
            Add routine
          </Button>
        }
      />

      <div className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          Build a repeatable trading day. Routines are tracked independently of trade filters and
          profit.
        </p>

        {(error || failure) && (
          <p role="alert" className="text-sm text-destructive">
            {error || failure}
          </p>
        )}

        {/* 4 Stat Cards Row - Compact, informative and space-efficient */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Daily Completion */}
          <Card className="p-3 sm:p-4">
            <div className="flex flex-col justify-between h-full">
              <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Daily Completion
              </span>
              <div className="my-1 flex items-baseline gap-2">
                <span
                  className={cn(
                    "font-mono text-xl sm:text-2xl font-bold tabular-nums",
                    score?.score === 1 ? "text-profit text-shadow-oled" : "text-foreground",
                  )}
                >
                  {score?.score == null ? "—" : `${Math.round(score.score * 100)}%`}
                </span>
                {score?.score === 1 && (
                  <span className="text-[10px] font-semibold text-profit bg-profit/10 px-1.5 py-0.5 rounded">
                    Complete
                  </span>
                )}
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground truncate">
                {score?.completed ?? 0} of {score?.total ?? 0} routines ({selected})
              </span>
            </div>
          </Card>

          {/* Card 2: Month Completion */}
          <Card className="p-3 sm:p-4">
            <div className="flex flex-col justify-between h-full">
              <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Month Completion
              </span>
              <div className="my-1">
                <span className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-foreground">
                  {monthMetrics.rate !== null ? `${monthMetrics.rate}%` : "—"}
                </span>
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground truncate">
                {monthMetrics.completed} of {monthMetrics.scheduled} routines in{" "}
                {data?.today
                  ? new Date(`${data.today}T00:00:00Z`).toLocaleString("en", { month: "short" })
                  : "month"}
              </span>
            </div>
          </Card>

          {/* Card 3: Perfect Days */}
          <Card className="p-3 sm:p-4">
            <div className="flex flex-col justify-between h-full">
              <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Perfect Days
              </span>
              <div className="my-1">
                <span className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-foreground">
                  {monthMetrics.perfectDays}
                </span>
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground truncate">
                100% adherence days this month
              </span>
            </div>
          </Card>

          {/* Card 4: Active Habits */}
          <Card className="p-3 sm:p-4">
            <div className="flex flex-col justify-between h-full">
              <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Active Habits
              </span>
              <div className="my-1">
                <span className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-foreground">
                  {activeRules.length}
                </span>
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground truncate">
                tracked across 3 trading stages
              </span>
            </div>
          </Card>
        </div>

        {/* 3 Stages Grid */}
        <div className="grid gap-4 xl:grid-cols-3">
          {STAGES.map((s) => {
            const stageRules = rules.filter((r) => r.stage === s);
            return (
              <Card key={s}>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-semibold">{s}</CardTitle>
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                      {stageRules.length}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    title={`Add routine to ${s}`}
                    onClick={() => openAddDialog(s)}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2 pt-1">
                  {stageRules.map((r) => {
                    const isChecked =
                      data?.checks.some(
                        (c) => c.ruleId === r.id && c.date === selected && c.done,
                      ) ?? false;
                    const isFutureDate = selected > (data?.today ?? "");

                    return (
                      <div
                        key={r.id}
                        className={cn(
                          "group flex items-center justify-between gap-2 p-2 rounded-lg border border-border/40 bg-card/60 transition-colors hover:bg-muted/20",
                          isChecked && "border-profit/20 bg-profit/5",
                        )}
                      >
                        <label className="flex items-center gap-2.5 text-xs font-medium min-w-0 cursor-pointer select-none flex-1">
                          <Checkbox
                            className="size-4 shrink-0"
                            checked={isChecked}
                            disabled={busy || isFutureDate}
                            onCheckedChange={(checked) =>
                              void act(
                                { ruleId: r.id, date: selected, done: checked === true },
                                "POST",
                              )
                            }
                          />
                          <span
                            className={cn(
                              "truncate transition-colors",
                              isChecked ? "line-through text-muted-foreground" : "text-foreground",
                            )}
                          >
                            {r.title}
                          </span>
                        </label>

                        {/* Actions Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-6 p-0 text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="size-3.5" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36 text-xs">
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer"
                              onSelect={() => openEditDialog(r)}
                            >
                              <Pencil className="size-3.5 text-muted-foreground" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer"
                              onSelect={() => {
                                if (
                                  confirm(
                                    `Archive "${r.title}"? Historical logs on previous days will be preserved.`,
                                  )
                                ) {
                                  void act({ id: r.id }, "DELETE");
                                }
                              }}
                            >
                              <Archive className="size-3.5 text-muted-foreground" />
                              <span>Archive</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                              onSelect={() => {
                                if (
                                  confirm(
                                    `Permanently delete "${r.title}"? All check history will be completely erased.`,
                                  )
                                ) {
                                  void act({ id: r.id, permanent: true }, "DELETE");
                                }
                              }}
                            >
                              <Trash2 className="size-3.5 text-destructive" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                  {stageRules.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-5 text-center text-muted-foreground">
                      <p className="text-xs">No routines scheduled.</p>
                      <button
                        type="button"
                        className="text-[11px] text-brand hover:underline mt-1 font-medium"
                        onClick={() => openAddDialog(s)}
                      >
                        + Add routine
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Routine Calendar - Sole date selector, adherence visualizer and review export */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <CalendarProgress
              rules={data?.rules ?? []}
              checks={data?.checks ?? []}
              today={data?.today ?? ""}
              selectedDate={selected}
              onSelectDate={setDate}
              headerRight={
                <ReviewExport
                  className="space-y-0"
                  buttonClassName="h-7 px-2.5 rounded-lg"
                  align="end"
                  document={{
                    title: `Routine review · ${selected}`,
                    lines: [
                      `Completed: ${score?.completed ?? 0}/${score?.total ?? 0}`,
                      ...rules.map(
                        (r) =>
                          `${data?.checks.some((c) => c.date === selected && c.ruleId === r.id && c.done) ? "[done]" : "[ ]"} ${r.stage}: ${r.title}`,
                      ),
                    ],
                  }}
                />
              }
            />
          </CardContent>
        </Card>

        {/* Add / Edit Routine Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRoutine ? "Edit daily routine" : "Add a daily routine"}
              </DialogTitle>
            </DialogHeader>
            <Field label="Routine">
              <input
                className={fieldClass}
                value={title}
                placeholder="Review the economic calendar"
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="When">
              <OptionSelect
                className={fieldClass}
                value={stage}
                onValueChange={(next) => setStage(next)}
              >
                {STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </OptionSelect>
            </Field>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Active Days</span>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_NAMES.map((day, i) => {
                  const isSelected = weekdays.includes(i);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() =>
                        setWeekdays(isSelected ? weekdays.filter((n) => n !== i) : [...weekdays, i])
                      }
                      className={cn(
                        "px-2.5 py-1 text-xs font-medium rounded-md border transition-all",
                        isSelected
                          ? "bg-foreground text-background border-foreground font-semibold shadow-xs"
                          : "border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
            {failure && (
              <p role="alert" className="text-xs text-destructive">
                {failure}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!title.trim() || !weekdays.length || busy}
                onClick={async () => {
                  if (editingRoutine) {
                    if (await act({ id: editingRoutine.id, title, stage, weekdays }, "PATCH")) {
                      setOpen(false);
                      setEditingRoutine(null);
                      setTitle("");
                    }
                  } else {
                    if (await act({ title, stage, weekdays }, "POST")) {
                      setOpen(false);
                      setTitle("");
                    }
                  }
                }}
              >
                {editingRoutine ? "Save changes" : "Add routine"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
