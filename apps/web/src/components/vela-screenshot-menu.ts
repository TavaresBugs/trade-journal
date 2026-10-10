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

import { setChromeTriggerState } from "./vela-chrome-join";

export interface VelaScreenshotMenuOptions {
  topbarContainer: HTMLElement;
  chartContainer: HTMLElement;
  getChartInstance: () => any;
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

export const CAMERA_ICON_SVG = `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 4 6.5 2.5h3L10.5 4h3A1 1 0 0 1 14.5 5v7.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"></path><circle cx="8" cy="8.5" r="2.6"></circle></svg>`;

export const DOWNLOAD_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download size-4 shrink-0"><path d="M12 15V3"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path></svg>`;

export const CLIPBOARD_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy size-4 shrink-0"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;

export const CROP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-scan size-4 shrink-0"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path></svg>`;

export const CHECKMARK_ICON_SVG = `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2.8 8.4 3.4 3.4 7-7.6"/></svg>`;

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
  type: "info" | "success" | "error" = "success",
  durationMs: number = 3000
): void {
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

export function getChartScreenshotCanvas(
  chartContainer: HTMLElement,
  chartInstance?: any
): HTMLCanvasElement | null {
  // 1. Official Vela Renderer screenshotCanvas()
  if (typeof chartInstance?.renderer?.screenshotCanvas === "function") {
    try {
      const c = chartInstance.renderer.screenshotCanvas();
      if (c && c.width > 0 && c.height > 0) return c;
    } catch (e) {
      console.warn("[vela-screenshot] Error in renderer.screenshotCanvas():", e);
    }
  }

  // 2. Official Vela Chart/Workspace screenshotCanvas()
  if (typeof chartInstance?.screenshotCanvas === "function") {
    try {
      const c = chartInstance.screenshotCanvas();
      if (c && c.width > 0 && c.height > 0) return c;
    } catch (e) {
      console.warn("[vela-screenshot] Error in chartInstance.screenshotCanvas():", e);
    }
  }

  // 3. Fallback: Composite all canvas elements found inside chartContainer
  if (!chartContainer) return null;
  const canvases = Array.from(chartContainer.querySelectorAll("canvas")).filter(
    (c) => c.width > 0 && c.height > 0
  );
  if (canvases.length === 0) return null;

  const maxWidth = Math.max(...canvases.map((c) => c.width));
  const maxHeight = Math.max(...canvases.map((c) => c.height));
  const out = chartContainer.ownerDocument.createElement("canvas");
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

// ── Action Handlers ─────────────────────────────────────────────────────────

export async function downloadChartScreenshot(
  chartContainer: HTMLElement,
  chartInstance: any,
  symbol: string,
  resolution: string,
  onToast?: (message: string, type?: "info" | "success" | "error") => void
): Promise<boolean> {
  const notify = (msg: string, type?: "info" | "success" | "error") =>
    onToast ? onToast(msg, type) : showVelaToast(chartContainer, msg, type);

  const canvas = getChartScreenshotCanvas(chartContainer, chartInstance);
  if (!canvas) {
    notify("Failed to capture chart screenshot", "error");
    return false;
  }

  const filename = `${symbol || "chart"}_${resolution || "1m"}_${Date.now()}.png`;

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
  resolution: string = "1m"
): Promise<boolean> {
  const notify = (msg: string, type?: "info" | "success" | "error") =>
    onToast ? onToast(msg, type) : showVelaToast(chartContainer, msg, type);

  const canvas = getChartScreenshotCanvas(chartContainer, chartInstance);
  if (!canvas) {
    notify("Failed to capture chart screenshot", "error");
    return false;
  }

  return new Promise<boolean>((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        notify("Failed to create image blob", "error");
        resolve(false);
        return;
      }

      try {
        if (
          typeof navigator !== "undefined" &&
          navigator.clipboard?.write &&
          typeof ClipboardItem !== "undefined"
        ) {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          notify("Chart image copied to clipboard", "success");
          resolve(true);
        } else {
          throw new Error("Clipboard API not supported");
        }
      } catch (err) {
        console.warn("[vela-screenshot] Clipboard write failed, falling back to download:", err);
        try {
          const doc = chartContainer.ownerDocument || document;
          const a = doc.createElement("a");
          const filename = `${symbol || "chart"}_${resolution || "1m"}_${Date.now()}.png`;
          a.download = filename;
          let href = "";
          try {
            href = canvas.toDataURL("image/png");
          } catch {
            if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
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
          resolve(true);
        } catch (dlErr) {
          console.error("[vela-screenshot] Fallback download failed:", dlErr);
          notify("Could not copy image to clipboard", "error");
          resolve(false);
        }
      }
    }, "image/png");
  });
}

export function armVelaPortionSelection(
  chartContainer: HTMLElement,
  chartInstance: any,
  symbol: string,
  resolution: string,
  onToast?: (message: string, type?: "info" | "success" | "error") => void
): () => void {
  const doc = chartContainer.ownerDocument || document;
  injectScreenshotStyles(doc);

  const prevPosition = chartContainer.style.position;
  if (!prevPosition || prevPosition === "static") {
    chartContainer.style.position = "relative";
  }

  const oldOverlay = chartContainer.querySelector(".vela-portion-overlay");
  oldOverlay?.remove();

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
      const fullCanvas = getChartScreenshotCanvas(chartContainer, chartInstance);
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

          croppedCanvas.toBlob(async (blob) => {
            if (!blob) return;
            try {
              if (
                typeof navigator !== "undefined" &&
                navigator.clipboard?.write &&
                typeof ClipboardItem !== "undefined"
              ) {
                await navigator.clipboard.write([
                  new ClipboardItem({ "image/png": blob }),
                ]);
                notify("Chart image copied to clipboard", "success");
              } else {
                throw new Error("Clipboard API not available");
              }
            } catch {
              const a = doc.createElement("a");
              a.download = `${symbol || "chart"}_${resolution || "1m"}_portion_${Date.now()}.png`;
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
  opts: VelaScreenshotMenuOptions
): ScreenshotMenuController {
  const { topbarContainer, chartContainer, getChartInstance, getSymbol, getResolution, onToast } =
    opts;
  const doc = topbarContainer.ownerDocument || document;
  injectScreenshotStyles(doc);

  let activePopup: HTMLElement | null = null;
  let onWindowResize: (() => void) | null = null;
  let onWindowScroll: (() => void) | null = null;

  function findCameraBtn(): HTMLElement | null {
    return (
      topbarContainer.parentElement?.querySelector<HTMLElement>(
        ".quant-side-rail-corner[aria-label='Screenshot']"
      ) ||
      topbarContainer.ownerDocument?.querySelector<HTMLElement>(
        ".quant-side-rail-corner[aria-label='Screenshot']"
      ) ||
      topbarContainer.querySelector<HTMLElement>(
        ".vela-widget-screenshot, #vela-action-screenshot, [aria-label='Screenshot'], [aria-label='Download screenshot']"
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
            chartContainer,
            getChartInstance(),
            getSymbol(),
            getResolution(),
            onToast
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
            chartContainer,
            getChartInstance(),
            onToast,
            getSymbol(),
            getResolution()
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
            chartContainer,
            getChartInstance(),
            getSymbol(),
            getResolution(),
            onToast
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

        const capBottomRel = (capRect.height > 0 ? capRect.bottom : btnRect.bottom) - containerRect.top;
        const layerTop = Math.round(capBottomRel > 0 ? capBottomRel - 1 : 38);
        const btnRightRel = btnRect.right - containerRect.left;
        const containerWidth = anchorContainer.clientWidth || containerRect.width || 400;
        const layerLeft = Math.round(Math.max(8, (btnRightRel > 0 ? btnRightRel : containerWidth) - width));

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
        join.style.clipPath = clipRight > 0 ? `inset(0px ${clipRight.toFixed(2)}px 0px 0px)` : "none";

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

  const controller: ScreenshotMenuController = {
    open: openPopup,
    close: closePopup,
    toggle,
    isOpen: () => activePopup !== null,
    downloadScreenshot: () =>
      downloadChartScreenshot(
        chartContainer,
        getChartInstance(),
        getSymbol(),
        getResolution(),
        onToast
      ),
    copyToClipboard: () =>
      copyChartScreenshotToClipboard(
        chartContainer,
        getChartInstance(),
        onToast,
        getSymbol(),
        getResolution()
      ),
    selectPortion: () => {
      armVelaPortionSelection(
        chartContainer,
        getChartInstance(),
        getSymbol(),
        getResolution(),
        onToast
      );
    },
    destroy: () => {
      closePopup();
      if (cameraBtn) {
        cameraBtn.removeEventListener("click", handleTriggerClick);
      }
    },
  };

  return controller;
}
