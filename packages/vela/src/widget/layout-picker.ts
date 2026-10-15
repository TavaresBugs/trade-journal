/**
 * Official Vela Layout & Sync Picker with Natural Bézier Join (1:1)
 * Replicates the official Layout 4x4 Grid picker, Sync toggles (Symbol, Interval,
 * Crosshair, Style), and organic Bézier outline connecting seamlessly to #vela-topbar-layout.
 */

import {
  createChromeJoinOutline,
  type ChromeJoinInstance,
  positionChromePopup,
  setChromeTriggerState,
} from "../ui/chrome-join";

export interface LayoutShape {
  rows: number;
  cols: number;
}

export interface SyncOptions {
  symbol: boolean;
  interval: boolean;
  crosshair: boolean;
  time: boolean;
  dateRange: boolean;
  style?: boolean;
}

export interface LayoutPickerOptions {
  topbarContainer: HTMLElement;
  chartContainer: HTMLElement;
  currentLayout: LayoutShape;
  currentSync: SyncOptions;
  onSelectLayout: (layout: LayoutShape) => void;
  onToggleSync: (kind: keyof SyncOptions, enabled: boolean) => void;
}

export interface LayoutPickerController {
  update: (layout: LayoutShape, sync: SyncOptions) => void;
  destroy: () => void;
}

/**
 * Exact official 1:1 Vela layout 4-quadrant grid icon (16x16, stroke-width 1.2)
 */
export const VELA_LAYOUT_ICON_SVG = `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="1.5" y="1.5" width="13" height="13" rx="1.5"></rect>
  <path d="M8 1.5v13M1.5 8h13"></path>
</svg>`;

/**
 * Computes exact 1:1 Natural Bézier SVG join curve connecting Topbar to .vela-lp popover.
 * Parameters: Shoulder S = 16, Radius R = 10.
 */
export function computeLayoutJoinGeometry(width: number, height: number) {
  const z = 16; // Shoulder S = 16
  const R = 10; // Corner radius R = 10
  const M = Math.max(1, width + 2 * z);
  const P = Math.max(1, height);
  const D = `M 0 0 Q ${z} 0 ${z} ${z} V ${P - R} Q ${z} ${P} ${z + R} ${P} H ${M - z - R} Q ${M - z} ${P} ${M - z} ${P - R} V ${z} Q ${M - z} 0 ${M} 0`;
  return { z, M, P, D };
}

export function attachVelaLayoutPicker(opts: LayoutPickerOptions): LayoutPickerController {
  const { topbarContainer, onSelectLayout, onToggleSync } = opts;
  let currentLayout = { ...opts.currentLayout };
  let currentSync = { ...opts.currentSync };
  let activeLayer: HTMLElement | null = null;
  let layoutBtnEl: HTMLElement | null = null;
  let onWindowResize: (() => void) | null = null;
  let ro: ResizeObserver | null = null;
  let joinOutline: ChromeJoinInstance | null = null;

  function findOrInjectLayoutBtn(): HTMLElement | null {
    const existing = topbarContainer.querySelector<HTMLButtonElement>("#vela-topbar-layout");
    const styleBtn = topbarContainer.querySelector<HTMLElement>(".vela-widget-style, #vela-topbar-style");
    const btn = existing || document.createElement("button");
    btn.type = "button";
    btn.id = "vela-topbar-layout";
    btn.className = "vela-widget-style quant-chrome-hover-row";
    btn.setAttribute("aria-label", `Layout — ${currentLayout.cols}x${currentLayout.rows}`);
    btn.title = `Layout & Sync (${currentLayout.cols} × ${currentLayout.rows})`;

    if (!existing) {
      btn.innerHTML = `<span class="vela-icon" aria-hidden="true">${VELA_LAYOUT_ICON_SVG}</span>`;
      if (styleBtn && styleBtn.parentElement) {
        const sep = document.createElement("span");
        sep.className = "vela-sep";
        styleBtn.after(sep, btn);
      } else {
        const topbar = topbarContainer.querySelector(".vela-widget-topbar") || topbarContainer;
        topbar.appendChild(btn);
      }
    }

    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePopup();
    };

    btn.onpointerdown = (e) => {
      if (e.button === 0) {
        e.stopPropagation();
      }
    };

    return btn;
  }

  layoutBtnEl = findOrInjectLayoutBtn();

  function closePopup() {
    if (onWindowResize) {
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("scroll", onWindowResize, true);
      onWindowResize = null;
    }
    if (ro) {
      ro.disconnect();
      ro = null;
    }
    if (joinOutline) {
      joinOutline.destroy();
      joinOutline = null;
    }
    if (activeLayer) {
      activeLayer.remove();
      activeLayer = null;
    }
    if (layoutBtnEl) {
      setChromeTriggerState(layoutBtnEl, false);
      layoutBtnEl.removeAttribute("data-quant-open");
      layoutBtnEl.removeAttribute("data-active");
    }
    document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    document.removeEventListener("keydown", handleKeydown, true);
  }

  function handleOutsidePointerDown(e: PointerEvent) {
    if (!activeLayer) return;
    const target = e.target as Node | null;
    if (activeLayer.contains(target) || layoutBtnEl?.contains(target)) {
      return;
    }
    closePopup();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      closePopup();
    }
  }

  function togglePopup() {
    if (activeLayer) {
      closePopup();
    } else {
      openPopup();
    }
  }

  function openPopup() {
    if (!layoutBtnEl) return;
    closePopup();

    const anchorContainer =
      topbarContainer.closest<HTMLElement>(".vela-ui") ||
      topbarContainer.closest<HTMLElement>(".quant-chart-chrome") ||
      topbarContainer.closest<HTMLElement>(".border-b")?.parentElement ||
      topbarContainer.parentElement ||
      topbarContainer;

    if (anchorContainer.style.position === "" || anchorContainer.style.position === "static") {
      anchorContainer.style.position = "relative";
    }

    const layer = document.createElement("div");
    layer.className = "vela-ui-layer vela-lp-layer";
    layer.style.cssText = "position: absolute; z-index: 100; isolation: isolate;";

    const card = document.createElement("div");
    card.className = "vela-lp";
    card.setAttribute("data-chrome-joined", "below");

    const colsWrap = document.createElement("div");
    colsWrap.className = "vela-lp-cols";

    // ── 1. Layout Section (4x4 Grid) ──
    const layoutSec = document.createElement("div");
    layoutSec.className = "vela-lp-layout";

    const layoutHeading = document.createElement("div");
    layoutHeading.className = "vela-lp-heading";
    layoutHeading.innerHTML = `
      <span>Layout</span>
      <span class="vela-lp-badge" title="Partition the chart area into multiple synced panes">?</span>
    `;

    const grid = document.createElement("div");
    grid.className = "vela-lp-grid";

    const squares: HTMLButtonElement[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const sq = document.createElement("button");
        sq.type = "button";
        sq.className = "vela-lp-sq";
        sq.dataset.r = String(r);
        sq.dataset.c = String(c);
        sq.setAttribute("aria-label", `${c + 1} × ${r + 1}`);
        sq.title = `${c + 1} × ${r + 1}`;

        // Initial on state based on current layout
        if (r < currentLayout.rows && c < currentLayout.cols) {
          sq.dataset.on = "1";
        }

        sq.addEventListener("mouseenter", () => {
          for (const other of squares) {
            const or = Number(other.dataset.r);
            const oc = Number(other.dataset.c);
            if (or <= r && oc <= c) {
              other.dataset.on = "1";
            } else {
              delete other.dataset.on;
            }
          }
        });

        sq.addEventListener("click", (e) => {
          e.stopPropagation();
          const targetShape: LayoutShape = { rows: r + 1, cols: c + 1 };
          currentLayout = targetShape;
          onSelectLayout(targetShape);
          updateTriggerIcon();
          closePopup();
        });

        squares.push(sq);
        grid.appendChild(sq);
      }
    }

    grid.addEventListener("mouseleave", () => {
      for (const sq of squares) {
        const r = Number(sq.dataset.r);
        const c = Number(sq.dataset.c);
        if (r < currentLayout.rows && c < currentLayout.cols) {
          sq.dataset.on = "1";
        } else {
          delete sq.dataset.on;
        }
      }
    });

    layoutSec.append(layoutHeading, grid);

    // ── 2. Vertical Divider ──
    const vsep = document.createElement("div");
    vsep.className = "vela-lp-vsep";

    // ── 3. Sync Section ──
    const syncSec = document.createElement("div");
    const syncHeading = document.createElement("div");
    syncHeading.className = "vela-lp-heading";
    syncHeading.textContent = "SYNC IN LAYOUT";

    const syncList = document.createElement("div");
    syncList.className = "vela-lp-sync quant-chrome-hover";

    const syncItems: Array<{ id: keyof SyncOptions; label: string; tooltip: string }> = [
      { id: "symbol", label: "Symbol", tooltip: "Symbol changes on all charts within the layout" },
      { id: "interval", label: "Interval", tooltip: "Interval changes on all charts within the layout" },
      { id: "crosshair", label: "Crosshair", tooltip: "Crosshair is synced across all charts within the layout" },
      { id: "time", label: "Time", tooltip: "When a chart is clicked, all charts within the layout display the same point of time" },
      { id: "dateRange", label: "Date range", tooltip: "Date range changes on all charts within the layout" },
    ];

    syncItems.forEach((item) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "vela-lp-sync-row quant-chrome-hover-row";
      row.dataset.syncId = item.id;
      row.setAttribute("role", "switch");
      row.setAttribute("aria-checked", String(Boolean(currentSync[item.id])));

      const labelWrap = document.createElement("span");
      labelWrap.className = "vela-lp-label-wrap";

      const label = document.createElement("span");
      label.className = "vela-lp-label";
      label.textContent = item.label;

      const infoBadge = document.createElement("span");
      infoBadge.className = "vela-lp-info-badge";
      infoBadge.title = item.tooltip;
      infoBadge.setAttribute("aria-label", item.tooltip);
      infoBadge.innerHTML = `<svg viewBox="0 0 18 18" width="13" height="13" fill="currentColor"><path fill="currentColor" d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16Zm1-12a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM8.5 9.5H7V8h3v6H8.5V9.5Z"/></svg>`;

      labelWrap.append(label, infoBadge);

      const sw = document.createElement("span");
      sw.className = `vela-lp-switch ${currentSync[item.id] ? "on" : ""}`;
      sw.setAttribute("aria-hidden", "true");

      row.append(labelWrap, sw);

      row.addEventListener("click", (e) => {
        e.stopPropagation();
        const newVal = !currentSync[item.id];
        currentSync[item.id] = newVal;
        row.setAttribute("aria-checked", String(newVal));
        sw.classList.toggle("on", newVal);
        onToggleSync(item.id, newVal);
      });

      syncList.appendChild(row);
    });

    syncSec.append(syncHeading, syncList);

    colsWrap.append(layoutSec, vsep, syncSec);
    card.appendChild(colsWrap);
    layer.appendChild(card);
    anchorContainer.appendChild(layer);
    activeLayer = layer;

    function reposition() {
      if (!layer || !layoutBtnEl || !card) return;
      positionChromePopup(layer, layoutBtnEl, anchorContainer);
      joinOutline?.update();
    }

    reposition();
    joinOutline = createChromeJoinOutline(card, {
      shoulder: 16,
      radius: 10,
      triggerElement: layoutBtnEl,
      fillColor: "var(--vela-surface, var(--vela-bg, #151619))",
      strokeColor: "var(--vela-border-strong, #34353b)",
    });

    onWindowResize = reposition;
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("scroll", onWindowResize, { passive: true, capture: true });

    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(reposition);
      ro.observe(card);
      ro.observe(layoutBtnEl);
    }

    setChromeTriggerState(layoutBtnEl, true);
    layoutBtnEl.setAttribute("data-quant-open", "1");
    layoutBtnEl.setAttribute("data-active", "1");

    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    document.addEventListener("keydown", handleKeydown, true);
  }

  function updateTriggerIcon() {
    if (!layoutBtnEl) return;
    const iconSpan = layoutBtnEl.querySelector(".vela-icon");
    if (iconSpan) {
      iconSpan.innerHTML = VELA_LAYOUT_ICON_SVG;
    }
    layoutBtnEl.setAttribute("aria-label", `Layout — ${currentLayout.cols}x${currentLayout.rows}`);
    layoutBtnEl.title = `Layout & Sync (${currentLayout.cols} × ${currentLayout.rows})`;
  }

  return {
    update: (newLayout: LayoutShape, newSync: SyncOptions) => {
      currentLayout = { ...newLayout };
      currentSync = { ...newSync };
      updateTriggerIcon();
      if (activeLayer) {
        const sqs = activeLayer.querySelectorAll<HTMLButtonElement>(".vela-lp-sq");
        sqs.forEach((sq) => {
          const r = Number(sq.dataset.r);
          const c = Number(sq.dataset.c);
          if (r < currentLayout.rows && c < currentLayout.cols) {
            sq.dataset.on = "1";
          } else {
            delete sq.dataset.on;
          }
        });
        const switches = activeLayer.querySelectorAll<HTMLButtonElement>(".vela-lp-sync-row");
        switches.forEach((row) => {
          const id = row.dataset.syncId as keyof SyncOptions | undefined;
          if (id && typeof currentSync[id] === "boolean") {
            const on = currentSync[id];
            row.setAttribute("aria-checked", String(on));
            const sw = row.querySelector(".vela-lp-switch");
            sw?.classList.toggle("on", on);
          }
        });
      }
    },
    destroy: () => {
      closePopup();
      if (layoutBtnEl) {
        layoutBtnEl.remove();
        layoutBtnEl = null;
      }
    },
  };
}
