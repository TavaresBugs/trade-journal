"use client";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  AutoScrollActivator,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { DashboardSavedLayouts } from "@/components/dashboard-saved-layouts";
import { DashboardCardContext } from "@/components/dashboard-card-header";
import {
  DASHBOARD_LAYOUT_KEY,
  balancedDashboardSpans,
  moveDashboardCard,
  normalizeArrangement,
  readDashboardPreferences,
  visibleCardIds,
  type DashboardArrangement,
  type DashboardCardSize,
  type DashboardPreferences,
} from "@/lib/dashboard-layout";
import { isInsideDashboardReorderZone } from "@/lib/dashboard-drag";
import {
  DASHBOARD_MOVE_EASING,
  DashboardDragPreview,
  snapshotDashboardCard,
  useDashboardDragInput,
  useDashboardGridMotion,
  useReducedDashboardMotion,
  type DashboardCardSnapshot,
} from "./dashboard-motion";

interface Widget {
  id: string;
  label: string;
  size: DashboardCardSize;
  layoutGroup: "summary" | "visuals" | "detail" | "secondary" | "full";
  content: ReactNode;
}
const collisionDetection: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);
// Reorder the real grid while dragging, then animate its measured positions.
const liveGridStrategy = () => null;
const dropAnimation = {
  duration: 300,
  easing: DASHBOARD_MOVE_EASING,
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0" } },
    className: { dragOverlay: "dashboard-card-dropping" },
  }),
};

export function DashboardLayout({ widgets }: { widgets: Widget[] }) {
  const idsKey = JSON.stringify(widgets.map((widget) => widget.id));
  const ids = useMemo(() => JSON.parse(idsKey) as string[], [idsKey]);
  const initial = useMemo(() => normalizeArrangement(null, ids), [ids]);
  const [state, setState] = useState<DashboardPreferences>({ current: initial, layouts: {} });
  const stateRef = useRef(state);
  const [ready, setReady] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" ? document.getElementById("dashboard-layout-slot") : null,
  );
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragSession, setDragSession] = useState(0);
  const [draft, setDraft] = useState<DashboardArrangement | null>(null);
  const draftRef = useRef<DashboardArrangement | null>(null);
  const [snapshot, setSnapshot] = useState<DashboardCardSnapshot | null>(null);
  const snapshotRef = useRef<DashboardCardSnapshot | null>(null);
  const dragInput = useDashboardDragInput();
  const lastReorder = useRef<{ x: number; y: number } | null>(null);
  const reducedMotion = useReducedDashboardMotion();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!activeId) return;
    document.body.classList.add("dashboard-is-dragging");
    const resize = () => {
      clearDrag();
      setDragSession((session) => session + 1);
    };
    window.addEventListener("resize", resize);
    return () => {
      document.body.classList.remove("dashboard-is-dragging");
      window.removeEventListener("resize", resize);
    };
  }, [activeId]);

  useEffect(() => {
    function read() {
      captureLayout();
      // Mount the cards as a transition so React can paint between them instead of
      // blocking until every card and chart has rendered.
      startTransition(() => {
        try {
          const next = readDashboardPreferences(localStorage.getItem(DASHBOARD_LAYOUT_KEY), ids);
          stateRef.current = next;
          setState(next);
          setError("");
        } catch {
          const next = { current: normalizeArrangement(null, ids), layouts: {} };
          stateRef.current = next;
          setState(next);
          setError("Saved dashboard preferences could not be read. All cards are shown.");
        }
        setReady(true);
      });
    }
    read();
    const sync = (event: StorageEvent) => {
      if (event.key === DASHBOARD_LAYOUT_KEY || event.key === null) read();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [ids]);

  function update(
    change: (previous: DashboardPreferences) => DashboardPreferences,
    message = "Layout saved",
  ) {
    const next = change(stateRef.current);
    captureLayout();
    stateRef.current = next;
    setState(next);
    try {
      localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(next));
      setError("");
      setFeedback(message);
      return true;
    } catch {
      setFeedback("");
      setError("Your layout changed, but could not be saved in this browser.");
      return false;
    }
  }

  const current = normalizeArrangement(draft ?? state.current, ids);
  const visible = visibleCardIds(current);
  const { gridRef, stageRef, captureLayout, rendered, exiting } = useDashboardGridMotion(
    visible,
    ready,
  );
  const hiddenCount = ids.length - visible.length;
  const byId = new Map(widgets.map((widget) => [widget.id, widget]));
  const visibleWidgets = visible.map((id) => byId.get(id)!);
  const compactSpans = balancedDashboardSpans(visibleWidgets, 2, {
    small: 1,
    medium: 2,
    wide: 2,
    full: 2,
  });
  const tabletSpans = balancedDashboardSpans(visibleWidgets, 6, {
    small: 2,
    medium: 2,
    wide: 4,
    full: 6,
  });
  const desktopSpans = balancedDashboardSpans(visibleWidgets, 15, {
    small: 3,
    medium: 5,
    wide: 10,
    full: 15,
  });
  const label = (id: string | number) => byId.get(String(id))?.label ?? "Card";

  function startDrag({ active, activatorEvent }: DragStartEvent) {
    const card = Array.from(gridRef.current?.children ?? []).find(
      (element) => element.getAttribute("data-dashboard-card") === String(active.id),
    );
    const surface = card?.querySelector<HTMLElement>("[data-dashboard-surface]");
    const preview = surface ? snapshotDashboardCard(surface, activatorEvent) : null;
    dragInput.start(preview);
    snapshotRef.current = preview;
    setSnapshot(preview);
    draftRef.current = normalizeArrangement(stateRef.current.current, ids);
    setDraft(draftRef.current);
    setActiveId(String(active.id));
    lastReorder.current = null;
  }
  function previewDrag({ active, over, delta }: DragMoveEvent) {
    if (!draftRef.current) return;
    dragInput.moveKeyboard(delta);
    if (!over || active.id === over.id) return;
    const pointerOrigin = snapshotRef.current?.pointer;
    if (pointerOrigin) {
      const movement = dragInput.point.current;
      const pointer = { x: pointerOrigin.x + movement.x, y: pointerOrigin.y + movement.y };
      if (!isInsideDashboardReorderZone(pointer, over.rect)) return;
    }
    // Reflow can move another card beneath a stationary pointer. Only an actual
    // movement may trigger the next reorder, so holding still never oscillates.
    const last = lastReorder.current;
    if (last && Math.hypot(delta.x - last.x, delta.y - last.y) < 24) return;
    const next = moveDashboardCard(draftRef.current, String(active.id), String(over.id));
    if (next === draftRef.current) return;
    captureLayout();
    lastReorder.current = delta;
    draftRef.current = next;
    setDraft(next);
  }
  function clearDrag() {
    dragInput.stop();
    snapshotRef.current = null;
    draftRef.current = null;
    setDraft(null);
    setActiveId(null);
    setSnapshot(null);
  }
  function cancelDrag() {
    captureLayout();
    clearDrag();
  }
  function finishDrag({ active, over }: DragEndEvent) {
    const next = draftRef.current;
    if (over && next) {
      if (JSON.stringify(next) !== JSON.stringify(stateRef.current.current))
        update(
          (previous) => ({ ...previous, current: next }),
          `${label(active.id)} moved. Layout saved.`,
        );
      clearDrag();
    } else {
      cancelDrag();
    }
  }
  function showAll() {
    update(
      (previous) => ({
        ...previous,
        current: { ...normalizeArrangement(previous.current, ids), hidden: [] },
      }),
      "All cards are shown. Layout saved.",
    );
  }

  useEffect(() => {
    setSlot(document.getElementById("dashboard-layout-slot"));
  }, [ready]);

  const layoutsControl = (
    <DashboardSavedLayouts
      layouts={state.layouts}
      current={current}
      ids={ids}
      widgets={widgets}
      onVisibilityChange={(id, visible) => {
        update((previous) => {
          const layout = normalizeArrangement(previous.current, ids);
          return {
            ...previous,
            current: {
              ...layout,
              hidden: visible
                ? layout.hidden.filter((hiddenId) => hiddenId !== id)
                : [...layout.hidden, id],
            },
          };
        });
      }}
      onShowAll={showAll}
      onRestore={() =>
        update(
          (previous) => ({ ...previous, current: initial }),
          "Original card order restored. All cards are shown.",
        )
      }
      onLoad={(name) =>
        update(
          (previous) => ({
            ...previous,
            current: normalizeArrangement(
              name === "Default"
                ? (previous.layouts["Default"] ?? initial)
                : (previous.layouts[name] ?? initial),
              ids,
            ),
          }),
          `${name} loaded`,
        )
      }
      onSave={(name) =>
        update(
          (previous) => ({
            ...previous,
            layouts: {
              ...previous.layouts,
              [name]: normalizeArrangement(previous.current, ids),
            },
          }),
          `${name} saved`,
        )
      }
    />
  );

  if (!ready)
    return <div className="p-4 text-sm text-muted-foreground">Loading dashboard layout…</div>;

  return (
    <div className="space-y-3 p-4">
      {slot ? (
        createPortal(layoutsControl, slot)
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {layoutsControl}
        </div>
      )}
      <span role="status" className="sr-only">
        {feedback}
      </span>
      {hiddenCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
          <span>
            {hiddenCount} {hiddenCount === 1 ? "card is" : "cards are"} hidden in this layout.
          </span>
          <Button type="button" size="sm" variant="outline" onClick={showAll}>
            Show all cards
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {visible.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          All cards are hidden. Choose Show all cards to restore them.
        </p>
      )}
      <DndContext
        key={dragSession}
        sensors={sensors}
        collisionDetection={collisionDetection}
        autoScroll={{
          activator: AutoScrollActivator.Pointer,
          acceleration: 4,
          interval: 12,
          threshold: { x: 0.05, y: 0.07 },
        }}
        measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
        onDragStart={startDrag}
        onDragMove={previewDrag}
        onDragOver={previewDrag}
        onDragEnd={finishDrag}
        onDragCancel={cancelDrag}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Press Space or Enter to pick up a card. Use the arrow keys to move, then Space or Enter to drop. Press Escape to cancel.",
          },
          announcements: {
            onDragStart: ({ active }) => `Picked up ${label(active.id)}.`,
            onDragOver: ({ active, over }) =>
              over
                ? `${label(active.id)} is over ${label(over.id)}.`
                : "Outside the cards. Drop here to cancel.",
            onDragEnd: ({ active, over }) =>
              over
                ? `${label(active.id)} placed at position ${visible.indexOf(String(active.id)) + 1} of ${visible.length}.`
                : "Move cancelled.",
            onDragCancel: () => "Move cancelled. Layout unchanged.",
          },
        }}
      >
        <SortableContext items={visible} strategy={liveGridStrategy}>
          <div ref={stageRef} className="dashboard-grid-stage" data-dashboard-stage>
            <div ref={gridRef} className="dashboard-grid relative grid gap-3" data-dashboard-grid>
              {rendered.map((id) => (
                <SortableCard
                  key={id}
                  widget={byId.get(id)!}
                  responsiveSpans={{
                    compact: compactSpans[id]!,
                    tablet: tabletSpans[id]!,
                    desktop: desktopSpans[id]!,
                  }}
                  exiting={exiting.has(id)}
                />
              ))}
            </div>
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={reducedMotion ? null : dropAnimation} adjustScale={false}>
          {snapshot && (
            <DashboardDragPreview
              snapshot={snapshot}
              movement={dragInput.point}
              reducedMotion={reducedMotion}
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function SortableCard({
  widget,
  responsiveSpans,
  exiting,
}: {
  widget: Widget;
  responsiveSpans: { compact: number; tablet: number; desktop: number };
  exiting: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useSortable({
    id: widget.id,
    disabled: exiting,
    animateLayoutChanges: () => false,
  });
  return (
    <section
      ref={setNodeRef}
      data-dashboard-card={widget.id}
      data-card-size={widget.size}
      data-dragging={isDragging}
      data-exiting={exiting || undefined}
      aria-hidden={exiting || undefined}
      inert={exiting || undefined}
      aria-label={widget.label}
      className="dashboard-grid-card relative flex min-w-0 flex-col rounded-xl"
      style={
        {
          "--dashboard-span-compact": responsiveSpans.compact,
          "--dashboard-span-tablet": responsiveSpans.tablet,
          "--dashboard-span-desktop": responsiveSpans.desktop,
        } as CSSProperties
      }
    >
      <DashboardCardContext.Provider
        value={{
          id: widget.id,
          label: widget.label,
          isDragging,
          activatorProps: { ...attributes, ...listeners },
          activatorRef: setActivatorNodeRef,
        }}
      >
        <div
          data-dashboard-surface
          className="dashboard-card-surface relative flex h-full min-w-0 flex-col"
        >
          <div className="min-w-0 flex-1 flex flex-col">{widget.content}</div>
        </div>
      </DashboardCardContext.Provider>
    </section>
  );
}
