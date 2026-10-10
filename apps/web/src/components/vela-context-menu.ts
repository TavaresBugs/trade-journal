import { registerIcon, injectStyles } from "@luxalgo/vela/ui";
import { registerWidgetAction, type WidgetContext } from "@luxalgo/vela/widget";

export const SLIDERS_ICON_SVG = `<svg viewBox="0 0 20 20" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v14m5-14v14m5-14v14M3 7h4m1 6h4m1-8h4"/></svg>`;

export const COPY_PRICE_ICON_SVG = `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/></svg>`;

export const VELA_CONTEXT_MENU_CSS = `
.quant-chart-chrome .vela-menu:not(.quant-drawing-menu) .vela-menu-item > .vela-icon,
.vela-ui .vela-menu:not(.quant-drawing-menu) .vela-menu-item > .vela-icon,
.vela-menu:not(.quant-drawing-menu) .vela-menu-item > .vela-icon {
    border: none !important;
    background: transparent !important;
    border-radius: 0 !important;
    width: 16px !important;
    height: 16px !important;
    flex: 0 0 16px !important;
    padding: 0 !important;
    box-shadow: none !important;
}
`;

export const VELA_TOAST_CSS = `
.vela-toast {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.4;
    background: var(--vela-bg-elev, #1e222d);
    color: var(--vela-fg, #d1d4dc);
    border: 1px solid var(--vela-border, #2a2e39);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    z-index: 1000;
    pointer-events: none;
    opacity: 0;
    transition: opacity 120ms ease, transform 120ms ease;
    white-space: nowrap;
}
.vela-toast[data-open='1'] {
    opacity: 1;
}
.vela-toast[data-type='error'] {
    color: var(--vela-down, #f23645);
    border-color: var(--vela-down, #f23645);
}
.vela-toast[data-type='success'] {
    color: var(--vela-up, #089981);
}
`;

/**
 * Format numeric price with appropriate decimals.
 */
export function formatCopyPrice(
  price: number | null | undefined,
  decimals: number | null | undefined = 2,
): string {
  if (price === null || price === undefined || !Number.isFinite(price)) {
    return "";
  }
  const dec =
    decimals !== null && decimals !== undefined && Number.isInteger(decimals) && decimals >= 0
      ? decimals
      : 2;
  return price.toFixed(dec);
}

/**
 * Native Vela Toast notification display with auto-hide.
 */
export function showVelaToast(
  message: string,
  type: "info" | "success" | "error" = "info",
  host?: HTMLElement | null,
  durationMs: number = 3000,
) {
  if (typeof document === "undefined") return;
  try {
    injectStyles("vela-widget-toast", VELA_TOAST_CSS);
  } catch {}

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
    if (toastEl) {
      delete toastEl.dataset.open;
    }
  }, durationMs);
}

export type PointerPriceResolver = () => {
  price: number | null;
  decimals?: number;
  time?: number | null;
} | null;

let isCopyPriceActionRegistered = false;
let activeFallbackResolver: PointerPriceResolver | undefined;
let unregisterPreviousAction: (() => void) | null = null;
let lastCopyTimestamp = 0;

export function _resetCopyPriceActionForTesting() {
  isCopyPriceActionRegistered = false;
  activeFallbackResolver = undefined;
  unregisterPreviousAction?.();
  unregisterPreviousAction = null;
  lastCopyTimestamp = 0;
}

/**
 * Registers the "copy-price" widget action in Vela.
 * Target: "context:body", order: -100 (places it at the very top of context menu).
 */
export function registerCopyPriceAction(
  fallbackResolver?: PointerPriceResolver,
): () => void {
  try {
    registerIcon("copy", COPY_PRICE_ICON_SVG);
    registerIcon("copy-price", COPY_PRICE_ICON_SVG);
    registerIcon("sliders", SLIDERS_ICON_SVG);
  } catch {}

  if (fallbackResolver) {
    activeFallbackResolver = fallbackResolver;
  }

  const unregisterCurrent = () => {
    if (unregisterPreviousAction) {
      unregisterPreviousAction();
      unregisterPreviousAction = null;
    }
    isCopyPriceActionRegistered = false;
    activeFallbackResolver = undefined;
  };

  if (isCopyPriceActionRegistered) {
    return unregisterCurrent;
  }
  isCopyPriceActionRegistered = true;

  unregisterPreviousAction = registerWidgetAction({
    id: "copy-price",
    target: "context:body",
    label: "Copy price",
    icon: "copy",
    order: -100,
    when: (_ctx: WidgetContext) => true,
    run: (ctx: WidgetContext) => {
      const now = Date.now();
      if (lastCopyTimestamp > 0 && now >= lastCopyTimestamp && now - lastCopyTimestamp < 100) return;
      lastCopyTimestamp = now;

      const fallback = activeFallbackResolver?.();
      const rawPrice = ctx.pointer?.price ?? fallback?.price;

      if (rawPrice !== undefined && rawPrice !== null && Number.isFinite(rawPrice)) {
        const decimals = (ctx.pointer as any)?.decimals ?? fallback?.decimals ?? 2;
        const formatted = formatCopyPrice(rawPrice, decimals);

        const onCopied = () => {
          const msg = `Copied ${formatted}`;
          if (typeof ctx?.toast === "function") {
            ctx.toast(msg, "success");
          } else {
            showVelaToast(msg, "success", ctx?.host);
          }
        };

        const onError = () => {
          const msg = "Couldn't copy the price";
          if (typeof ctx?.toast === "function") {
            ctx.toast(msg, "error");
          } else {
            showVelaToast(msg, "error", ctx?.host);
          }
        };

        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(formatted).then(onCopied, onError);
        } else {
          onError();
        }
      }
    },
  });

  return unregisterCurrent;
}

/**
 * Enhances ChartContextMenu:
 * 1. Ensures the "Settings..." item uses the canonical Sliders icon instead of a gear.
 * 2. Ensures the "Copy price" item has the canonical copy double-rect icon.
 * 3. Patches contextMenu.itemsFor to map settings icon to "sliders".
 * 4. Mounts a MutationObserver to enforce Sliders icon when menu DOM elements are appended.
 */
export function enhanceVelaContextMenu(
  container: HTMLElement,
  contextMenu: any,
  _fallbackResolver?: PointerPriceResolver,
): () => void {
  if (typeof document === "undefined" || !container) {
    return () => {};
  }

  // Register canonical Vela icons
  try {
    registerIcon("sliders", SLIDERS_ICON_SVG);
    registerIcon("copy", COPY_PRICE_ICON_SVG);
    registerIcon("copy-price", COPY_PRICE_ICON_SVG);
    injectStyles("vela-widget-toast", VELA_TOAST_CSS);
    injectStyles("vela-widget-context-menu-icons", VELA_CONTEXT_MENU_CSS);
  } catch {}

  // 1. Intercept contextMenu.itemsFor if available
  if (contextMenu && typeof contextMenu.itemsFor === "function") {
    const origItemsFor = contextMenu.itemsFor.bind(contextMenu);
    contextMenu.itemsFor = (zone: string) => {
      const items = origItemsFor(zone);
      if (!Array.isArray(items)) return items;
      return items.map((item: any) => {
        if (typeof item.id === "string" && item.id.startsWith("settings")) {
          return {
            ...item,
            icon: "sliders",
          };
        }
        return item;
      });
    };
  }

  // 2. DOM MutationObserver to enforce Sliders icon and Copy price icon
  const applyIcons = (root: Element) => {
    // Replace settings icon with Sliders icon
    const settingsItems = root.querySelectorAll<HTMLElement>(
      '.vela-menu-item[data-vei-id^="settings"], .vela-menu-item[data-vei-id="settings"]',
    );
    settingsItems.forEach((item) => {
      let iconSpan = item.querySelector<HTMLElement>(":scope > .vela-icon");
      if (!iconSpan) {
        iconSpan = document.createElement("span");
        iconSpan.className = "vela-icon";
        iconSpan.setAttribute("aria-hidden", "true");
        item.insertBefore(iconSpan, item.querySelector(":scope > .vela-menu-label"));
      }
      if (iconSpan.innerHTML !== SLIDERS_ICON_SVG) {
        iconSpan.innerHTML = SLIDERS_ICON_SVG;
      }
    });

    // Ensure Copy price icon is copy double-rect
    const copyItems = root.querySelectorAll<HTMLElement>(
      '.vela-menu-item[data-vei-id="action:copy-price"]',
    );
    copyItems.forEach((item) => {
      let iconSpan = item.querySelector<HTMLElement>(":scope > .vela-icon");
      if (!iconSpan) {
        iconSpan = document.createElement("span");
        iconSpan.className = "vela-icon";
        iconSpan.setAttribute("aria-hidden", "true");
        item.insertBefore(iconSpan, item.querySelector(":scope > .vela-menu-label"));
      }
      if (iconSpan.innerHTML !== COPY_PRICE_ICON_SVG) {
        iconSpan.innerHTML = COPY_PRICE_ICON_SVG;
      }
    });
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof Element) {
          applyIcons(node);
        }
      }
    }
  });

  const observeTarget =
    (typeof container.closest === "function" ? container.closest(".vela-ui") : null) ??
    container.ownerDocument?.body ??
    container;

  observer.observe(observeTarget, { childList: true, subtree: true });

  // Also check initial DOM or container
  applyIcons(observeTarget);

  return () => {
    observer.disconnect();
  };
}
