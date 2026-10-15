/**
 * Official Vela Screenshot / Print Tool with 1:1 Menu and Marquee Portion Selection
 * Matching official Vela (print_20261009_232913.png):
 * 1. Download screenshot (PNG export with ${symbol}_${resolution}_${Date.now()}.png)
 * 2. Copy to clipboard (PNG blob via navigator.clipboard.write([new ClipboardItem(...)])
 * 3. Select portion (interactive marquee selection overlay with crop)
 *
 * Utilizes chartInstance.renderer.screenshotCanvas() for complete composite WebGL candles,
 * volume, drawings, and DOM overlays.
 */

import { setChromeTriggerState, VELA_ICONS } from "../ui/chrome-join";

export interface VelaScreenshotCell {
  id?: string | number;
  host: HTMLElement | null;
  chart: any;
  symbol?: string;
  resolution?: string;
}

export interface VelaScreenshotMenuOptions {
  topbarContainer: HTMLElement;
  chartContainer: HTMLElement;
  getChartContainer?: () => HTMLElement | null;
  getChartInstance: () => any;
  getChartCells?: () => VelaScreenshotCell[];
  getSymbol: () => string;
  getResolution: () => string;
  onToast?: (message: string, type?: "info" | "success" | "error") => void;
}

export interface ScreenshotMenuController {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
  downloadScreenshot: () => Promise<boolean>;
  copyToClipboard: () => Promise<boolean>;
  selectPortion: () => void;
  destroy: () => void;
}

export function computeScreenshotJoinGeometry(width: number, height: number) {
  const z = 16;
  const M = Math.max(1, width + 2 * z);
  const P = Math.max(1, height);
  const D = `M 0 0 Q ${z} 0 ${z} ${z} V ${P - 10} Q ${z} ${P} ${z + 10} ${P} H ${M - z - 10} Q ${M - z} ${P} ${M - z} ${P - 10} V ${z} Q ${M - z} 0 ${M} 0`;
  return { z, M, P, D };
}

// ── Icons matching official Vela 1:1 ──────────────────────────────────────────

export const CAMERA_ICON_SVG = VELA_ICONS.camera;

export const DOWNLOAD_ICON_SVG = VELA_ICONS.download;

export const CLIPBOARD_ICON_SVG = VELA_ICONS.clipboard;

export const CROP_ICON_SVG = VELA_ICONS.crop;

export const CHECKMARK_ICON_SVG = VELA_ICONS.checkmark;

// ── Styles injection ─────────────────────────────────────────────────────────

export const VELA_SCREENSHOT_STYLES = `
.quant-chart-chrome .vela-screenshot-floating-menu .vela-menu-item > .vela-icon,
.vela-screenshot-floating-menu .vela-menu-item > .vela-icon {
  border: none !important;
  background: transparent !important;
  border-radius: 0 !important;
  width: 16px !important;
  height: 16px !important;
  flex: 0 0 16px !important;
  padding: 0 !important;
  box-shadow: none !important;
}

.quant-chart-chrome .vela-screenshot-floating-menu[data-chrome-joined="below"],
.vela-screenshot-floating-menu[data-chrome-joined="below"] {
  position: relative !important;
  z-index: 50 !important;
  background: transparent !important;
  background-color: transparent !important;
  border-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  border-radius: 0 0 10px 10px !important;
  padding: 7px !important;
  min-width: 210px !important;
  animation: none !important;
}

.quant-chrome-join-fill {
  fill: var(--vela-surface, #151619) !important;
}
.quant-chrome-join-edge {
  fill: none !important;
  stroke: var(--vela-border, #2a2b30) !important;
  stroke-width: 1px !important;
  vector-effect: non-scaling-stroke;
}

.vela-toast {
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  padding: 6px 14px;
  font-size: 12px;
  font-family: inherit;
  background: #1e2024;
  border: 1px solid #34353b;
  border-radius: 6px;
  color: #e5e7eb;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  pointer-events: none;
  opacity: 0;
  display: none;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: opacity 150ms cubic-bezier(0.16, 1, 0.3, 1), transform 150ms cubic-bezier(0.16, 1, 0.3, 1);
}
.vela-toast[data-open] {
  display: inline-flex;
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.vela-toast[data-type='error'] {
  color: #f23645;
  border-color: #f23645;
}
.vela-toast[data-type='success'] {
  color: #089981;
}

.vela-portion-overlay {
  position: absolute;
  inset: 0;
  z-index: 999;
  cursor: crosshair;
  user-select: none;
  touch-action: none;
  overflow: hidden;
}
.vela-portion-hint {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  background: #18191c;
  color: #e5e7eb;
  border: 1px solid #34353b;
  border-radius: 6px;
  padding: 5px 14px;
  font-size: 12px;
  font-family: inherit;
  font-weight: 500;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  z-index: 1001;
  display: flex;
  align-items: center;
  gap: 8px;
}
.vela-portion-box {
  position: absolute;
  border: 1.5px dashed #3870ff;
  background: rgba(56, 112, 255, 0.12);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
  pointer-events: none;
  z-index: 1000;
}
.vela-portion-dim {
  position: absolute;
  bottom: -22px;
  right: 0;
  background: #1e2024;
  color: #9ca3af;
  border: 1px solid #34353b;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 10px;
  font-family: monospace;
  white-space: nowrap;
}
`;

function injectScreenshotStyles(doc: Document = document) {
  if (doc.getElementById("vela-screenshot-styles")) return;
  const style = doc.createElement("style");
  style.id = "vela-screenshot-styles";
  style.textContent = VELA_SCREENSHOT_STYLES;
  doc.head.appendChild(style);
}

// ── Toast System ────────────────────────────────────────────────────────────

export function showVelaToast(
  container: HTMLElement,
  message: string,
  type?: "info" | "success" | "error",
  durationMs?: number,
): void;
export function showVelaToast(
  message: string,
  type?: "info" | "success" | "error",
  host?: HTMLElement | null,
  durationMs?: number,
): void;
export function showVelaToast(
  arg1: HTMLElement | string,
  arg2?: any,
  arg3?: any,
  arg4?: number,
): void {
  if (typeof document === "undefined") return;

  if (typeof arg1 === "string") {
    // ContextMenu signature: (message, type = "info", host, durationMs = 3000)
    const message = arg1;
    const type: "info" | "success" | "error" = arg2 ?? "info";
    const host: HTMLElement | null | undefined = arg3;
    const durationMs: number = typeof arg4 === "number" ? arg4 : 3000;

    injectScreenshotStyles(host?.ownerDocument || document);
    const parent = host ?? document.body;
    let toastEl = parent.querySelector<HTMLElement>(":scope > .vela-toast");
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "vela-toast";
      parent.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.dataset.type = type;
    toastEl.dataset.open = "1";

    const prevTimer = (toastEl as any)._velaToastTimer;
    if (prevTimer) clearTimeout(prevTimer);
    (toastEl as any)._velaToastTimer = setTimeout(() => {
      if (toastEl) delete toastEl.dataset.open;
    }, durationMs);
    return;
  }

  // ScreenshotMenu signature: (container, message, type = "success", durationMs = 3000)
  const container = arg1;
  const message: string = String(arg2 ?? "");
  const type: "info" | "success" | "error" = arg3 ?? "success";
  const durationMs: number = typeof arg4 === "number" ? arg4 : 3000;

  const doc = container?.ownerDocument || document;
  injectScreenshotStyles(doc);

  let toastEl = container.querySelector<HTMLElement>(".vela-toast");
  if (!toastEl) {
    toastEl = doc.createElement("div");
    toastEl.className = "vela-toast";
    container.appendChild(toastEl);
  }

  toastEl.innerHTML = "";
  if (type === "success") {
    const iconSpan = doc.createElement("span");
    iconSpan.className = "vela-icon vela-toast-icon";
    iconSpan.setAttribute("aria-hidden", "true");
    iconSpan.innerHTML = CHECKMARK_ICON_SVG;
    toastEl.appendChild(iconSpan);
  }
  const textSpan = doc.createElement("span");
  textSpan.className = "vela-toast-text";
  textSpan.textContent = message;
  toastEl.appendChild(textSpan);

  toastEl.dataset.type = type;
  toastEl.dataset.open = "1";

  const existingTimer = (toastEl as any)._velaTimer;
  if (existingTimer) clearTimeout(existingTimer);

  (toastEl as any)._velaTimer = setTimeout(() => {
    delete toastEl!.dataset.open;
    (toastEl as any)._velaTimer = null;
  }, durationMs);
}

// ── Canvas Composite Helper ─────────────────────────────────────────────────

export function getSingleCellScreenshotCanvas(
  cellHost: HTMLElement | null,
  cellChart?: any,
): HTMLCanvasElement | null {
  // 1. Official Vela Renderer screenshotCanvas()
  if (typeof cellChart?.renderer?.screenshotCanvas === "function") {
    try {
      const c = cellChart.renderer.screenshotCanvas();
      if (c && c.width > 0 && c.height > 0) return c;
    } catch (e) {
      console.warn("[vela-screenshot] Error in renderer.screenshotCanvas():", e);
    }
  }

  // 2. Official Vela Chart/Workspace screenshotCanvas()
  if (typeof cellChart?.screenshotCanvas === "function") {
    try {
      const c = cellChart.screenshotCanvas();
      if (c && c.width > 0 && c.height > 0) return c;
    } catch (e) {
      console.warn("[vela-screenshot] Error in chartInstance.screenshotCanvas():", e);
    }
  }

  // 3. Fallback: Composite all canvas elements found inside cellHost
  if (!cellHost) return null;
  const canvases = Array.from(cellHost.querySelectorAll("canvas")).filter(
    (c) => c.width > 0 && c.height > 0,
  );
  if (canvases.length === 0) return null;

  const maxWidth = Math.max(...canvases.map((c) => c.width));
  const maxHeight = Math.max(...canvases.map((c) => c.height));
  const out = cellHost.ownerDocument.createElement("canvas");
  out.width = maxWidth;
  out.height = maxHeight;
  const ctx = out.getContext("2d");
  if (!ctx) return null;

  // Background
  ctx.fillStyle = "#121316";
  ctx.fillRect(0, 0, maxWidth, maxHeight);

  for (const c of canvases) {
    ctx.drawImage(c, 0, 0, maxWidth, maxHeight);
  }

  return out;
}

type VelaScreenshotCellsSource = VelaScreenshotCell[] | (() => VelaScreenshotCell[]);

function resolveCellsList(cells?: VelaScreenshotCellsSource): VelaScreenshotCell[] | undefined {
  if (typeof cells === "function") {
    try {
      return cells();
    } catch {
      return undefined;
    }
  }
  return cells;
}

function filterVisibleScreenshotCells(cells?: VelaScreenshotCellsSource): VelaScreenshotCell[] {
  const list = resolveCellsList(cells);
  if (!Array.isArray(list) || list.length === 0) return [];
  return list.filter((cell) => {
    const host = cell?.host;
    if (!host) return false;
    if (host.isConnected === false) return false;
    if (host.style?.visibility === "hidden" || host.style?.display === "none") return false;
    const rect = host.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    return true;
  });
}

function resolveScreenshotSymbolLabel(
  symbol: string,
  cells?: VelaScreenshotCellsSource,
): string {
  const visibleCells = filterVisibleScreenshotCells(cells);
  if (visibleCells.length > 1) {
    const cellSymbols = visibleCells
      .map((c) => (c.symbol || "").trim())
      .filter(Boolean);
    if (cellSymbols.length > 0) {
      return Array.from(new Set(cellSymbols)).join("_");
    }
  }
  return symbol || "chart";
}

export function getChartScreenshotCanvas(
  chartContainer: HTMLElement,
  chartInstance?: any,
  cells?: VelaScreenshotCellsSource,
): HTMLCanvasElement | null {
  // 1. Resolve Grid Container Element (.vela-ws-grid)
  const gridEl =
    (chartContainer?.classList?.contains("vela-ws-grid")
      ? chartContainer
      : chartContainer?.closest<HTMLElement>(".vela-ws-grid")) ??
    chartContainer?.querySelector<HTMLElement>(".vela-ws-grid") ??
    chartContainer?.parentElement?.querySelector<HTMLElement>(".vela-ws-grid") ??
    chartContainer;

  // 2. Discover visible cells from passed source or directly from DOM .vela-cell elements
  let visibleCells = filterVisibleScreenshotCells(cells);
  if (visibleCells.length <= 1 && gridEl) {
    const domCells = Array.from(gridEl.querySelectorAll<HTMLElement>(".vela-cell")).filter(
      (el) => {
        if (!el || el.isConnected === false) return false;
        if (el.style?.visibility === "hidden" || el.style?.display === "none") return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      },
    );

    if (domCells.length > 1) {
      visibleCells = domCells.map((el, idx) => {
        const matchingCell = visibleCells.find((c) => c.host === el);
        if (matchingCell) return matchingCell;
        return {
          id: String(idx),
          host: el,
          chart: idx === 0 ? chartInstance : undefined,
        };
      });
    }
  }

  if (!visibleCells || visibleCells.length === 0) {
    return getSingleCellScreenshotCanvas(gridEl ?? chartContainer, chartInstance);
  }

  if (visibleCells.length === 1) {
    const single = visibleCells[0]!;
    return getSingleCellScreenshotCanvas(
      single.host ?? gridEl ?? chartContainer,
      single.chart ?? chartInstance,
    );
  }

  // 3. Multi-Chart Layout composition (encompass ALL cells and the grid bounding box)
  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;

  for (const cell of visibleCells) {
    if (!cell.host) continue;
    const r = cell.host.getBoundingClientRect();
    if (r.left < minLeft) minLeft = r.left;
    if (r.top < minTop) minTop = r.top;
    const right = r.right !== undefined ? r.right : r.left + r.width;
    const bottom = r.bottom !== undefined ? r.bottom : r.top + r.height;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  const gridRect = gridEl?.getBoundingClientRect?.();
  if (gridRect && gridRect.width > 0 && gridRect.height > 0) {
    if (Number.isFinite(minLeft)) {
      minLeft = Math.min(minLeft, gridRect.left);
      minTop = Math.min(minTop, gridRect.top);
      maxRight = Math.max(maxRight, gridRect.right);
      maxBottom = Math.max(maxBottom, gridRect.bottom);
    } else {
      minLeft = gridRect.left;
      minTop = gridRect.top;
      maxRight = gridRect.right;
      maxBottom = gridRect.bottom;
    }
  }

  const baseLeft = Number.isFinite(minLeft) ? minLeft : 0;
  const baseTop = Number.isFinite(minTop) ? minTop : 0;
  const gridWidth = Math.max(1, (Number.isFinite(maxRight) ? maxRight : baseLeft + 1) - baseLeft);
  const gridHeight = Math.max(1, (Number.isFinite(maxBottom) ? maxBottom : baseTop + 1) - baseTop);

  const dpr =
    typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
  const doc =
    (gridEl ?? chartContainer)?.ownerDocument ||
    visibleCells[0]?.host?.ownerDocument ||
    document;
  const out = doc.createElement("canvas");
  out.width = Math.max(1, Math.round(gridWidth * dpr));
  out.height = Math.max(1, Math.round(gridHeight * dpr));
  const ctx = out.getContext("2d");
  if (!ctx) return null;

  let bgFill = "#121316";
  try {
    const targetBgEl = gridEl ?? chartContainer;
    if (
      targetBgEl &&
      typeof window !== "undefined" &&
      typeof window.getComputedStyle === "function"
    ) {
      const computedBg = window.getComputedStyle(targetBgEl)?.backgroundColor;
      if (
        computedBg &&
        computedBg !== "transparent" &&
        computedBg !== "rgba(0, 0, 0, 0)"
      ) {
        bgFill = computedBg;
      }
    }
  } catch {
    bgFill = "#121316";
  }

  ctx.fillStyle = bgFill || "#121316";
  ctx.fillRect(0, 0, out.width, out.height);

  let drawnCount = 0;
  for (const cell of visibleCells) {
    if (!cell.host) continue;
    const tileCanvas = getSingleCellScreenshotCanvas(cell.host, cell.chart);
    if (!tileCanvas) continue;

    const r = cell.host.getBoundingClientRect();
    const dx = Math.round((r.left - baseLeft) * dpr);
    const dy = Math.round((r.top - baseTop) * dpr);
    const dw = Math.max(1, Math.round((r.left - baseLeft + r.width) * dpr) - dx);
    const dh = Math.max(1, Math.round((r.top - baseTop + r.height) * dpr) - dy);

    ctx.drawImage(tileCanvas, dx, dy, dw, dh);

    if (typeof (ctx as any).strokeRect === "function") {
      ctx.strokeStyle = "#2a2b30";
      ctx.lineWidth = 1;
      ctx.strokeRect(dx + 0.5, dy + 0.5, Math.max(0, dw - 1), Math.max(0, dh - 1));
    }
    drawnCount++;
  }

  if (drawnCount === 0) {
    return getSingleCellScreenshotCanvas(gridEl ?? chartContainer, chartInstance);
  }

  return out;
}

// ── Action Handlers ─────────────────────────────────────────────────────────

export async function downloadChartScreenshot(
  chartContainer: HTMLElement,
  chartInstance: any,
  symbol: string,
  resolution: string,
  onToast?: (message: string, type?: "info" | "success" | "error") => void,
  cells?: VelaScreenshotCellsSource,
): Promise<boolean> {
  const notify = (msg: string, type?: "info" | "success" | "error") =>
    onToast ? onToast(msg, type) : showVelaToast(chartContainer, msg, type);

  const canvas = getChartScreenshotCanvas(chartContainer, chartInstance, cells);
  if (!canvas) {
    notify("Failed to capture chart screenshot", "error");
    return false;
  }

  const symbolLabel = resolveScreenshotSymbolLabel(symbol, cells);
  const filename = `${symbolLabel}_${resolution || "1m"}_${Date.now()}.png`;

  try {
    const dataUrl = canvas.toDataURL("image/png");
    const doc = chartContainer.ownerDocument || document;
    const a = doc.createElement("a");
    a.download = filename;
    a.href = dataUrl;
    doc.body.appendChild(a);
    a.click();
    a.remove();

    notify("Screenshot downloaded", "success");
    return true;
  } catch (err) {
    console.error("[vela-screenshot] Download failed:", err);
    notify("Screenshot download failed", "error");
    return false;
  }
}

export async function copyChartScreenshotToClipboard(
  chartContainer: HTMLElement,
  chartInstance: any,
  onToast?: (message: string, type?: "info" | "success" | "error") => void,
  symbol: string = "chart",
  resolution: string = "1m",
  cells?: VelaScreenshotCellsSource,
): Promise<boolean> {
  const notify = (msg: string, type?: "info" | "success" | "error") =>
    onToast ? onToast(msg, type) : showVelaToast(chartContainer, msg, type);

  const canvas = getChartScreenshotCanvas(chartContainer, chartInstance, cells);
  if (!canvas) {
    notify("Failed to capture chart screenshot", "error");
    return false;
  }

  const symbolLabel = resolveScreenshotSymbolLabel(symbol, cells);

  const blobPromise = new Promise<Blob>((resolveBlob, rejectBlob) => {
    canvas.toBlob((b) => {
      if (b) resolveBlob(b);
      else rejectBlob(new Error("Failed to create PNG blob from canvas"));
    }, "image/png");
  });

  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard?.write &&
      typeof ClipboardItem !== "undefined"
    ) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blobPromise }),
        ]);
        notify("Chart image copied to clipboard", "success");
        return true;
      } catch {
        const blob = await blobPromise;
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        notify("Chart image copied to clipboard", "success");
        return true;
      }
    } else {
      throw new Error("Clipboard API not supported");
    }
  } catch (err) {
    console.warn("[vela-screenshot] Clipboard write failed, falling back to download:", err);
    try {
      const doc = chartContainer.ownerDocument || document;
      const a = doc.createElement("a");
      const filename = `${symbolLabel}_${resolution || "1m"}_${Date.now()}.png`;
      a.download = filename;
      let href = "";
      try {
        href = canvas.toDataURL("image/png");
      } catch {
        const blob = await blobPromise.catch(() => null);
        if (blob && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
          href = URL.createObjectURL(blob);
        }
      }
      a.href = href;
      doc.body.appendChild(a);
      a.click();
      a.remove();
      if (href.startsWith("blob:") && typeof URL.revokeObjectURL === "function") {
        setTimeout(() => URL.revokeObjectURL(href), 1000);
      }
      notify("Screenshot downloaded", "success");
      return true;
    } catch (dlErr) {
      console.error("[vela-screenshot] Fallback download failed:", dlErr);
      notify("Could not copy image to clipboard", "error");
      return false;
    }
  }
}

export function armVelaPortionSelection(
  chartContainer: HTMLElement,
  chartInstance: any,
  symbol: string,
  resolution: string,
  onToast?: (message: string, type?: "info" | "success" | "error") => void,
  cells?: VelaScreenshotCellsSource,
): () => void {
  const doc = chartContainer.ownerDocument || document;
  injectScreenshotStyles(doc);

  const prevPosition = chartContainer.style.position;
  if (!prevPosition || prevPosition === "static") {
    chartContainer.style.position = "relative";
  }

  const oldOverlay = chartContainer.querySelector(".vela-portion-overlay") as
    (HTMLElement & { _removeCleanup?: () => void }) | null;
  if (oldOverlay?._removeCleanup) {
    oldOverlay._removeCleanup();
  } else {
    oldOverlay?.remove();
  }

  const overlay = doc.createElement("div");
  overlay.className = "vela-portion-overlay";

  const hint = doc.createElement("div");
  hint.className = "vela-portion-hint";
  hint.innerHTML = `<span class="vela-icon" aria-hidden="true">${CROP_ICON_SVG}</span><span>Click and drag to select portion · Esc to cancel</span>`;
  overlay.appendChild(hint);

  let startX = 0;
  let startY = 0;
  let isDragging = false;
  let selectionBox: HTMLElement | null = null;
  let dimBadge: HTMLElement | null = null;

  function removeOverlay() {
    window.removeEventListener("keydown", onKeyDown, true);
    overlay.remove();
  }

  (overlay as HTMLElement & { _removeCleanup?: () => void })._removeCleanup = removeOverlay;

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = overlay.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    isDragging = true;

    try {
      overlay.setPointerCapture?.(e.pointerId);
    } catch {}

    selectionBox = doc.createElement("div");
    selectionBox.className = "vela-portion-box";
    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    selectionBox.style.width = "0px";
    selectionBox.style.height = "0px";

    dimBadge = doc.createElement("span");
    dimBadge.className = "vela-portion-dim";
    dimBadge.textContent = "0 × 0 px";
    selectionBox.appendChild(dimBadge);

    overlay.appendChild(selectionBox);
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging || !selectionBox) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = overlay.getBoundingClientRect();
    const curX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const curY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const left = Math.min(startX, curX);
    const top = Math.min(startY, curY);
    const width = Math.abs(curX - startX);
    const height = Math.abs(curY - startY);

    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;

    if (dimBadge) {
      dimBadge.textContent = `${Math.round(width)} × ${Math.round(height)} px`;
    }
  }

  async function onPointerUp(e: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    e.preventDefault();
    e.stopPropagation();

    try {
      overlay.releasePointerCapture?.(e.pointerId);
    } catch {}

    const rect = overlay.getBoundingClientRect();
    const curX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const curY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const left = Math.min(startX, curX);
    const top = Math.min(startY, curY);
    const width = Math.abs(curX - startX);
    const height = Math.abs(curY - startY);

    const notify = (msg: string, type?: "info" | "success" | "error") =>
      onToast ? onToast(msg, type) : showVelaToast(chartContainer, msg, type);

    removeOverlay();

    if (width >= 10 && height >= 10) {
      const fullCanvas = getChartScreenshotCanvas(chartContainer, chartInstance, cells);
      if (!fullCanvas) {
        notify("Failed to capture chart for portion crop", "error");
        return;
      }

      const scaleX = fullCanvas.width / (rect.width || 1);
      const scaleY = fullCanvas.height / (rect.height || 1);

      const sx = Math.max(0, Math.round(left * scaleX));
      const sy = Math.max(0, Math.round(top * scaleY));
      const sw = Math.min(fullCanvas.width - sx, Math.round(width * scaleX));
      const sh = Math.min(fullCanvas.height - sy, Math.round(height * scaleY));

      if (sw > 0 && sh > 0) {
        const croppedCanvas = doc.createElement("canvas");
        croppedCanvas.width = sw;
        croppedCanvas.height = sh;
        const ctx = croppedCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(fullCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

          const symbolLabel = resolveScreenshotSymbolLabel(symbol, cells);

          croppedCanvas.toBlob(async (blob) => {
            if (!blob) return;
            try {
              if (
                typeof navigator !== "undefined" &&
                navigator.clipboard?.write &&
                typeof ClipboardItem !== "undefined"
              ) {
                await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
                notify("Chart image copied to clipboard", "success");
              } else {
                throw new Error("Clipboard API not available");
              }
            } catch {
              const a = doc.createElement("a");
              a.download = `${symbolLabel}_${resolution || "1m"}_portion_${Date.now()}.png`;
              a.href = croppedCanvas.toDataURL("image/png");
              doc.body.appendChild(a);
              a.click();
              a.remove();
              notify("Screenshot downloaded", "success");
            }
          }, "image/png");
        }
      }
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      removeOverlay();
    }
  }

  overlay.addEventListener("pointerdown", onPointerDown);
  overlay.addEventListener("pointermove", onPointerMove);
  overlay.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKeyDown, true);

  chartContainer.appendChild(overlay);

  return removeOverlay;
}

// ── Topbar Screenshot Menu Attachment ───────────────────────────────────────

export function attachVelaScreenshotMenu(
  opts: VelaScreenshotMenuOptions,
): ScreenshotMenuController {
  const {
    topbarContainer,
    chartContainer,
    getChartInstance,
    getChartCells,
    getSymbol,
    getResolution,
    onToast,
  } = opts;
  const getActiveChartContainer = () => opts.getChartContainer?.() ?? chartContainer;
  const doc = topbarContainer.ownerDocument || document;
  injectScreenshotStyles(doc);

  let activePopup: HTMLElement | null = null;
  let onWindowResize: (() => void) | null = null;
  let onWindowScroll: (() => void) | null = null;

  function findCameraBtn(): HTMLElement | null {
    return (
      topbarContainer.parentElement?.querySelector<HTMLElement>(
        ".quant-side-rail-corner[aria-label='Screenshot']",
      ) ||
      topbarContainer.ownerDocument?.querySelector<HTMLElement>(
        ".quant-side-rail-corner[aria-label='Screenshot']",
      ) ||
      topbarContainer.querySelector<HTMLElement>(
        ".vela-widget-screenshot, #vela-action-screenshot, [aria-label='Screenshot'], [aria-label='Download screenshot']",
      )
    );
  }

  const cameraBtn = findCameraBtn();
  if (cameraBtn) {
    cameraBtn.removeAttribute("title");
    cameraBtn.setAttribute("aria-label", "Screenshot");
    cameraBtn.id = "vela-action-screenshot";
    cameraBtn.classList.add("quant-chrome-hover-row");

    // Ensure camera SVG icon matches official Vela 1:1
    const iconSpan = cameraBtn.querySelector(".vela-icon") || cameraBtn;
    if (!iconSpan.querySelector("svg")) {
      iconSpan.innerHTML = CAMERA_ICON_SVG;
    }
  }

  function closePopup() {
    if (onWindowResize) {
      window.removeEventListener("resize", onWindowResize);
      onWindowResize = null;
    }
    if (onWindowScroll) {
      window.removeEventListener("scroll", onWindowScroll, { capture: true } as any);
      onWindowScroll = null;
    }
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
    const btn = findCameraBtn();
    if (btn) {
      setChromeTriggerState(btn, false);
      btn.dataset.state = "closed";
    }
    doc.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    doc.removeEventListener("keydown", handleKeydown, true);
  }

  function handleOutsidePointerDown(e: PointerEvent) {
    if (!activePopup) return;
    const target = e.target as Node;
    const btn = findCameraBtn();
    if (activePopup.contains(target) || btn?.contains(target)) return;
    closePopup();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && activePopup) {
      e.stopPropagation();
      closePopup();
    }
  }

  function openPopup() {
    closePopup();
    const btn = findCameraBtn();
    if (!btn) return;

    btn.removeAttribute("title");
    setChromeTriggerState(btn, true);
    btn.dataset.state = "open";

    const popup = doc.createElement("div");
    popup.className = "vela-ui-layer";
    popup.dataset.scope = "menu";
    popup.dataset.part = "positioner";
    popup.setAttribute("data-chrome-joined-layer", "below");
    popup.style.position = "absolute";
    popup.style.isolation = "isolate";
    popup.style.minWidth = "max-content";
    popup.style.zIndex = "50";

    const join = doc.createElement("div");
    join.className = "quant-chrome-join";
    join.setAttribute("aria-hidden", "true");
    join.setAttribute("data-side", "below");

    const menu = doc.createElement("ul");
    menu.className = "vela-menu quant-chrome-hover quant-chrome-menu vela-screenshot-floating-menu";
    menu.dataset.scope = "menu";
    menu.dataset.part = "content";
    menu.setAttribute("data-chrome-joined", "below");
    menu.setAttribute("data-chrome-join-kind", "bar");
    menu.setAttribute("role", "menu");
    menu.setAttribute("tabindex", "0");
    menu.style.minWidth = "220px";

    const items = [
      {
        id: "download",
        label: "Download screenshot",
        iconSvg: DOWNLOAD_ICON_SVG,
        onClick: () => {
          closePopup();
          void downloadChartScreenshot(
            getActiveChartContainer(),
            getChartInstance(),
            getSymbol(),
            getResolution(),
            onToast,
            getChartCells,
          );
        },
      },
      {
        id: "copy",
        label: "Copy to clipboard",
        iconSvg: CLIPBOARD_ICON_SVG,
        onClick: () => {
          closePopup();
          void copyChartScreenshotToClipboard(
            getActiveChartContainer(),
            getChartInstance(),
            onToast,
            getSymbol(),
            getResolution(),
            getChartCells,
          );
        },
      },
      {
        id: "portion",
        label: "Select portion",
        iconSvg: CROP_ICON_SVG,
        onClick: () => {
          closePopup();
          armVelaPortionSelection(
            getActiveChartContainer(),
            getChartInstance(),
            getSymbol(),
            getResolution(),
            onToast,
            getChartCells,
          );
        },
      },
    ];

    for (const item of items) {
      const li = doc.createElement("li");
      li.className = "vela-menu-item quant-chrome-hover-row";
      li.dataset.veiId = item.id;
      li.dataset.scope = "menu";
      li.dataset.part = "item";
      li.setAttribute("role", "menuitem");
      li.setAttribute("data-value", item.id);
      li.style.borderRadius = "8px";

      const icon = doc.createElement("span");
      icon.className = "vela-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = item.iconSvg;

      const label = doc.createElement("span");
      label.className = "vela-menu-label";
      label.textContent = item.label;

      li.append(icon, label);
      li.addEventListener("click", (e) => {
        e.stopPropagation();
        item.onClick();
      });

      menu.appendChild(li);
    }

    popup.appendChild(join);
    popup.appendChild(menu);

    const anchorContainer =
      topbarContainer.closest<HTMLElement>(".vela-ui") ||
      topbarContainer.closest<HTMLElement>(".quant-chart-chrome") ||
      topbarContainer.closest<HTMLElement>(".border-b")?.parentElement ||
      topbarContainer.parentElement ||
      topbarContainer;

    if (anchorContainer.style.position === "" || anchorContainer.style.position === "static") {
      anchorContainer.style.position = "relative";
    }

    anchorContainer.appendChild(popup);
    activePopup = popup;

    const updatePos = () => {
      if (activePopup && btn) {
        const capEl = btn.closest<HTMLElement>(".quant-side-rail-cap") || btn;
        const btnRect = btn.getBoundingClientRect();
        const capRect = capEl.getBoundingClientRect();
        const containerRect = anchorContainer.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();

        const width = Math.max(210, menu.offsetWidth || menuRect.width || 220);
        const height = Math.max(116, menu.offsetHeight || menuRect.height || 124);
        const { z, M, P, D } = computeScreenshotJoinGeometry(width, height);

        const capBottomRel =
          (capRect.height > 0 ? capRect.bottom : btnRect.bottom) - containerRect.top;
        const layerTop = Math.round(capBottomRel > 0 ? capBottomRel - 1 : 38);
        const btnRightRel = btnRect.right - containerRect.left;
        const containerWidth = anchorContainer.clientWidth || containerRect.width || 400;
        const layerLeft = Math.round(
          Math.max(8, (btnRightRel > 0 ? btnRightRel : containerWidth) - width),
        );

        popup.style.setProperty?.("--chrome-layer-top", `${layerTop}px`);
        popup.style.setProperty?.("--chrome-layer-left", `${layerLeft}px`);
        (popup.style as any)["--chrome-layer-top"] = `${layerTop}px`;
        (popup.style as any)["--chrome-layer-left"] = `${layerLeft}px`;
        popup.style.top = `${layerTop}px`;
        popup.style.left = `${layerLeft}px`;

        join.style.position = "absolute";
        join.style.left = `${-z}px`;
        join.style.top = "0px";
        join.style.width = `${M}px`;
        join.style.height = `${P}px`;
        join.style.zIndex = "49";
        join.style.pointerEvents = "none";

        const maxRightRel = Math.max(btnRightRel, containerRect.width || containerWidth);
        const clipRight = maxRightRel > 0 ? Math.max(0, layerLeft + width + z - maxRightRel) : z;
        join.style.clipPath =
          clipRight > 0 ? `inset(0px ${clipRight.toFixed(2)}px 0px 0px)` : "none";

        join.innerHTML = `<svg viewBox="0 0 ${M} ${P}" style="width: 100%; height: 100%; display: block; overflow: visible;"><path class="quant-chrome-join-fill" d="${D} Z"></path><path class="quant-chrome-join-edge" d="${D}"></path></svg>`;
      }
    };

    updatePos();

    onWindowResize = updatePos;
    onWindowScroll = updatePos;
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("scroll", onWindowScroll, { passive: true, capture: true } as any);

    doc.addEventListener("pointerdown", handleOutsidePointerDown, true);
    doc.addEventListener("keydown", handleKeydown, true);
  }

  function toggle() {
    if (activePopup) {
      closePopup();
    } else {
      openPopup();
    }
  }

  function handleTriggerClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  }

  if (cameraBtn) {
    cameraBtn.addEventListener("click", handleTriggerClick);
  }

  let activePortionCleanup: (() => void) | null = null;

  const controller: ScreenshotMenuController = {
    open: openPopup,
    close: closePopup,
    toggle,
    isOpen: () => activePopup !== null,
    downloadScreenshot: () =>
      downloadChartScreenshot(
        getActiveChartContainer(),
        getChartInstance(),
        getSymbol(),
        getResolution(),
        onToast,
        getChartCells,
      ),
    copyToClipboard: () =>
      copyChartScreenshotToClipboard(
        getActiveChartContainer(),
        getChartInstance(),
        onToast,
        getSymbol(),
        getResolution(),
        getChartCells,
      ),
    selectPortion: () => {
      activePortionCleanup?.();
      activePortionCleanup = armVelaPortionSelection(
        getActiveChartContainer(),
        getChartInstance(),
        getSymbol(),
        getResolution(),
        onToast,
        getChartCells,
      );
    },
    destroy: () => {
      activePortionCleanup?.();
      activePortionCleanup = null;
      closePopup();
      if (cameraBtn) {
        cameraBtn.removeEventListener("click", handleTriggerClick);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", onShortcutKeyDown, true);
      }
    },
  };

  function onShortcutKeyDown(e: KeyboardEvent) {
    const isMod = e.ctrlKey || e.metaKey;
    const isS = e.key === "S" || e.key === "s" || e.code === "KeyS";
    if (!isMod || !e.shiftKey || e.altKey || !isS) return;

    const activeEl = doc.activeElement as HTMLElement | null;
    if (activeEl) {
      const tag = activeEl.tagName?.toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || activeEl.isContentEditable) {
        return;
      }
    }

    e.preventDefault();
    e.stopPropagation();
    closePopup();

    void controller.downloadScreenshot();

    try {
      const activeChartContainer = getActiveChartContainer();
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.clipboard?.write === "function" &&
        typeof ClipboardItem !== "undefined"
      ) {
        const canvas = getChartScreenshotCanvas(
          activeChartContainer,
          getChartInstance(),
          getChartCells,
        );
        if (canvas) {
          const blobPromise = new Promise<Blob>((resolveBlob, rejectBlob) => {
            canvas.toBlob((blob) => {
              if (blob) resolveBlob(blob);
              else rejectBlob(new Error("Failed to create blob"));
            }, "image/png");
          });
          void navigator.clipboard
            .write([new ClipboardItem({ "image/png": blobPromise })])
            .catch(() => {});
        }
      }
    } catch {}
  }

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", onShortcutKeyDown, true);
  }

  return controller;
}
