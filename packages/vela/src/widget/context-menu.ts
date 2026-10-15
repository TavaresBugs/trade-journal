// @ts-ignore - vendor bundle exports
import { registerIcon, injectStyles } from "../../vendor/ui.js";
// @ts-ignore - vendor bundle exports
import { registerWidgetAction, type WidgetContext } from "../../vendor/widget.js";
import { VELA_ICONS } from "../ui/chrome-join";
import { SAMPLE_BASE_PRICES } from "../workspace/sample-anchors";
import { cleanRootSymbol } from "./symbol-icon";
import { showVelaToast } from "./screenshot-menu";


export const SLIDERS_ICON_SVG = VELA_ICONS.sliders;
export const COPY_PRICE_ICON_SVG = VELA_ICONS.copyPrice;
export const TRADING_DOWN_ICON_SVG = VELA_ICONS.tradingDown;
export const TRADING_UP_ICON_SVG = VELA_ICONS.tradingUp;
export const TRADING_ADD_ORDER_ICON_SVG = VELA_ICONS.tradingAddOrder;
export const ALARM_CLOCK_ICON_SVG = VELA_ICONS.alarmClock;

export const VELA_CONTEXT_MENU_CSS = `
.vela-menu-item .vela-menu-badge {
    box-sizing: border-box !important;
    border: none !important;
    background: transparent !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    flex: 0 0 18px !important;
    width: 18px !important;
    height: 18px !important;
    min-width: 18px !important;
    padding: 0 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    color: var(--vela-fg-muted, #787b86) !important;
}
.vela-menu-item .vela-menu-badge:empty {
    background: transparent !important;
    border: none !important;
    width: 18px !important;
    height: 18px !important;
    flex: 0 0 18px !important;
}
.vela-menu-item .vela-menu-badge > .vela-icon,
.vela-menu-item > .vela-icon:not(.vela-menu-star) {
    width: 18px !important;
    height: 18px !important;
    font-size: 18px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    border: none !important;
    background: transparent !important;
    padding: 0 !important;
    color: inherit !important;
}
.vela-menu-item .vela-menu-badge > .vela-icon > svg,
.vela-menu-item .vela-icon > svg {
    width: 18px !important;
    height: 18px !important;
    display: block !important;
}
.vela-menu-item:hover .vela-menu-badge,
.vela-menu-item[data-highlighted] .vela-menu-badge {
    color: var(--vela-fg-bright, #f0f3fa) !important;
    background: transparent !important;
    border: none !important;
}
.vela-menu-item[data-checked] .vela-menu-badge,
.vela-menu-item[data-checkmark] .vela-menu-badge {
    background: transparent !important;
    border: none !important;
    color: var(--vela-fg-bright, #f0f3fa) !important;
}
.vela-menu-item .vela-menu-hint {
    margin-left: auto;
    padding-left: 20px;
    display: inline-flex !important;
    align-items: center !important;
    gap: 3px !important;
    font-size: 11px;
    color: var(--vela-fg-muted, #787b86);
    user-select: none;
}
.vela-menu-item .vela-menu-hint kbd {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-width: 14px !important;
    height: 18px !important;
    padding: 0 5px !important;
    border-radius: 4px !important;
    border: 1px solid var(--vela-border-strong, #34353b) !important;
    border-bottom: 2px solid var(--vela-border-strong, #34353b) !important;
    background: var(--vela-surface-elev, rgb(28, 29, 32)) !important;
    color: var(--vela-fg, #d1d4dc) !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
    font-size: 10px !important;
    font-weight: 600 !important;
    line-height: 1 !important;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25) !important;
    transition: transform 60ms ease, border-bottom-width 60ms ease, background 60ms ease, border-color 60ms ease;
}
.vela-menu-item:hover .vela-menu-hint kbd,
.vela-menu-item[data-highlighted] .vela-menu-hint kbd {
    background: #252830 !important;
    color: #f0f3fa !important;
    border-color: #434756 !important;
    border-bottom-color: #434756 !important;
}
.vela-menu-item .vela-menu-hint .vela-kbd-sep {
    font-size: 10px !important;
    color: var(--vela-fg-muted, #787b86) !important;
    opacity: 0.5 !important;
    margin: 0 1px !important;
    font-family: inherit !important;
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
export interface TradingContextMenuOptions {
  getSymbol?: () => string;
  getCurrentPrice?: () => number;
  getTickSize?: (symbol: string) => number;
  formatPrice?: (symbol: string, price: number) => string;
  onPlaceOrder?: (
    side: "buy" | "sell",
    type: "limit" | "stop" | "stop_limit" | "market",
    price: number,
    symbol?: string,
  ) => void;
  onCreateAlert?: (symbol: string, price?: number) => void;
}

let globalContextMenuDefaults: TradingContextMenuOptions = {};

export function configureVelaContextMenuDefaults(
  defaults: TradingContextMenuOptions,
): void {
  globalContextMenuDefaults = { ...globalContextMenuDefaults, ...defaults };
}

function defaultGetTickSize(symbol: string): number {
  const clean = cleanRootSymbol(symbol);
  return SAMPLE_BASE_PRICES[clean]?.tickSize ?? 0.25;
}

function defaultFormatPrice(symbol: string, price: number): string {
  const tick = defaultGetTickSize(symbol);
  const decimals = tick < 1 ? Math.min(8, Math.round(-Math.log10(tick) + 0.4)) : 2;
  return price.toFixed(Math.max(2, decimals));
}

/**
 * Enhances ChartContextMenu:
 * 1. Ensures the "Settings..." item uses the canonical Sliders icon instead of a gear.
 * 2. Ensures the "Copy price" item has the canonical copy double-rect icon.
 * 3. Prepends TradingView 1:1 order actions (Sell Limit, Buy Stop, Buy Stop Limit, Add Order / Buy Limit, Sell Stop, etc.) when right-clicking the chart plot.
 * 4. Mounts keyboard shortcuts (Alt+Shift+S, Alt+Shift+B, Shift+T) for rapid order entry.
 * 5. Mounts a MutationObserver to enforce Sliders, Copy price, and Trading icons.
 */
export function enhanceVelaContextMenu(
  container: HTMLElement,
  contextMenu: any,
  fallbackResolver?: PointerPriceResolver,
  tradingOptions?: TradingContextMenuOptions,
): () => void {
  if (typeof document === "undefined" || !container) {
    return () => {};
  }

  const resolveTickSize = (sym: string) =>
    tradingOptions?.getTickSize?.(sym) ??
    globalContextMenuDefaults.getTickSize?.(sym) ??
    defaultGetTickSize(sym);

  const resolveFormatPrice = (sym: string, p: number) =>
    tradingOptions?.formatPrice?.(sym, p) ??
    globalContextMenuDefaults.formatPrice?.(sym, p) ??
    defaultFormatPrice(sym, p);

  const triggerOrder = (
    sym: string,
    side: "buy" | "sell",
    type: "limit" | "stop" | "stop_limit" | "market",
    price: number,
  ) => {
    if (tradingOptions?.onPlaceOrder) {
      tradingOptions.onPlaceOrder(side, type, price, sym);
    } else {
      globalContextMenuDefaults.onPlaceOrder?.(side, type, price, sym);
    }
  };

  const triggerAlert = (sym: string, price?: number) => {
    if (tradingOptions?.onCreateAlert) {
      tradingOptions.onCreateAlert(sym, price);
    } else {
      globalContextMenuDefaults.onCreateAlert?.(sym, price);
    }
  };

  // Register canonical Vela & Trading icons
  try {
    registerIcon("sliders", SLIDERS_ICON_SVG);
    registerIcon("copy", COPY_PRICE_ICON_SVG);
    registerIcon("copy-price", COPY_PRICE_ICON_SVG);
    registerIcon("trading-down", TRADING_DOWN_ICON_SVG);
    registerIcon("trading-up", TRADING_UP_ICON_SVG);
    registerIcon("trading-add-order", TRADING_ADD_ORDER_ICON_SVG);
    registerIcon("alarm-clock", ALARM_CLOCK_ICON_SVG);
    registerIcon("alert", ALARM_CLOCK_ICON_SVG);
    injectStyles("vela-widget-toast", VELA_TOAST_CSS);
    injectStyles("vela-widget-context-menu-icons", VELA_CONTEXT_MENU_CSS);
  } catch {}

  // Suppress general chart menu when right-clicking boleta order/bracket elements WITHOUT blocking React's root onContextMenu
  let suppressNextChartMenu = false;
  if (contextMenu?.menu && typeof contextMenu.menu.openAt === "function") {
    const origOpenAt = contextMenu.menu.openAt.bind(contextMenu.menu);
    contextMenu.menu.openAt = (clientX: number, clientY: number) => {
      if (suppressNextChartMenu) {
        suppressNextChartMenu = false;
        try {
          contextMenu.menu.close?.();
        } catch {}
        return;
      }
      return origOpenAt(clientX, clientY);
    };
  }

  const onContainerContextMenuCapture = (e: MouseEvent) => {
    const target = e.target as Element | null;
    if (!target) return;
    const isBoletaInteractive = Boolean(
      target.closest(
        "[data-component*='order'], [data-component*='pill'], [data-component*='chip'], [data-component*='tp'], [data-component*='sl'], [data-component*='pending'], [data-component*='filled-line'], [data-component*='bracket'], [data-component*='handle'], [data-interactive-bracket], #bracket-context-menu"
      ) ||
        (target.closest(".vela-visual-trading-overlay") &&
          !target.classList.contains("vela-visual-trading-overlay"))
    );
    if (isBoletaInteractive) {
      suppressNextChartMenu = true;
      try {
        (contextMenu as any).menu?.close?.();
      } catch {}
      setTimeout(() => {
        suppressNextChartMenu = false;
        try {
          (contextMenu as any).menu?.close?.();
        } catch {}
      }, 0);
    } else {
      suppressNextChartMenu = false;
    }
  };
  container.addEventListener("contextmenu", onContainerContextMenuCapture, true);

  // 1. Intercept contextMenu.itemsFor to prepend TradingView 1:1 trading options
  if (contextMenu && typeof contextMenu.itemsFor === "function") {
    const origItemsFor = contextMenu.itemsFor.bind(contextMenu);
    contextMenu.itemsFor = (zone: string) => {
      const origItems = origItemsFor(zone);
      const itemsList = Array.isArray(origItems) ? origItems : [];

      // Only inject trading actions when right-clicking the main chart plot ("body")
      if (zone === "body") {
        const resolvedFallbackPrice = fallbackResolver?.()?.price;
        const currentPriceFallback =
          tradingOptions?.getCurrentPrice?.() ??
          globalContextMenuDefaults.getCurrentPrice?.() ??
          0;
        const rawPointerPrice =
          (typeof contextMenu.pointer?.price === "number" && contextMenu.pointer.price > 0
            ? contextMenu.pointer.price
            : typeof resolvedFallbackPrice === "number" && resolvedFallbackPrice > 0
              ? resolvedFallbackPrice
              : typeof currentPriceFallback === "number" && currentPriceFallback > 0
                ? currentPriceFallback
                : 0);
        if (rawPointerPrice > 0) {
          const symbol = tradingOptions?.getSymbol?.() ?? "MNQ";
          const currentPrice = tradingOptions?.getCurrentPrice?.() ?? 0;
          const tickSize = resolveTickSize(symbol);

          const formattedPrice = resolveFormatPrice(symbol, rawPointerPrice);
          const formattedTickUp = resolveFormatPrice(symbol, rawPointerPrice + tickSize);
          const formattedTickDown = resolveFormatPrice(symbol, rawPointerPrice - tickSize);

          const alertRow = {
            id: `alert:create:${rawPointerPrice}`,
            label: `Add alert on ${symbol} at ${formattedPrice}...`,
            hint: "Alt + A",
            icon: "alarm-clock",
            separatorAfter: true,
          };

          let tradingRows: any[] = [];

          if (rawPointerPrice >= currentPrice) {
            // Price above market: 2 Sell, 1 Buy + Add order
            tradingRows = [
              {
                id: `trading:sell-limit:${rawPointerPrice}`,
                label: `Sell 1 ${symbol} @ ${formattedPrice} limit`,
                hint: "Alt + Shift + S",
                icon: "trading-down",
              },
              {
                id: `trading:buy-stop:${rawPointerPrice}`,
                label: `Buy 1 ${symbol} @ ${formattedPrice} stop`,
                hint: "",
                icon: "trading-up",
              },
              {
                id: `trading:buy-stop-limit:${rawPointerPrice}`,
                label: `Buy 1 ${symbol} @ ${formattedPrice} stop ${formattedTickUp} limit`,
                hint: "",
                icon: "trading-up",
              },
              {
                id: `trading:add-order:${rawPointerPrice}`,
                label: `Add order on ${symbol} at ${formattedPrice}...`,
                hint: "Shift + T",
                icon: "trading-add-order",
              },
            ];
          } else {
            // Price below market: 2 Buy, 1 Sell + Add order
            tradingRows = [
              {
                id: `trading:buy-limit:${rawPointerPrice}`,
                label: `Buy 1 ${symbol} @ ${formattedPrice} limit`,
                hint: "Alt + Shift + B",
                icon: "trading-up",
              },
              {
                id: `trading:sell-stop:${rawPointerPrice}`,
                label: `Sell 1 ${symbol} @ ${formattedPrice} stop`,
                hint: "",
                icon: "trading-down",
              },
              {
                id: `trading:sell-stop-limit:${rawPointerPrice}`,
                label: `Sell 1 ${symbol} @ ${formattedPrice} stop ${formattedTickDown} limit`,
                hint: "",
                icon: "trading-down",
              },
              {
                id: `trading:add-order:${rawPointerPrice}`,
                label: `Add order on ${symbol} at ${formattedPrice}...`,
                hint: "Shift + T",
                icon: "trading-add-order",
              },
            ];
          }

          // Map original items to ensure separatorBefore on the first item following trading actions
          const mappedOrig = itemsList.map((item: any, idx: number) => {
            let res = item;
            if (idx === 0) {
              res = { ...res, separatorBefore: true };
            }
            if (typeof res.id === "string" && res.id.startsWith("settings")) {
              res = { ...res, icon: "sliders" };
            }
            return res;
          });

          return [alertRow, ...tradingRows, ...mappedOrig];
        }
      }

      // Default fallback: map settings icon to sliders
      return itemsList.map((item: any) => {
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

  // 2. Intercept contextMenu.run to execute alert and trading orders when clicked
  if (contextMenu && typeof contextMenu.run === "function") {
    const origRun = contextMenu.run.bind(contextMenu);
    contextMenu.run = (id: string) => {
      if (typeof id === "string" && id.startsWith("alert:create:")) {
        const parts = id.split(":");
        const price = parseFloat(parts[2] ?? "0");
        const sym = tradingOptions?.getSymbol?.() ?? "MNQ";
        triggerAlert(sym, Number.isFinite(price) && price > 0 ? price : undefined);
        return;
      }
      if (typeof id === "string" && id.startsWith("trading:")) {
        const parts = id.split(":");
        const action = parts[1];
        const price = parseFloat(parts[2] ?? "0");
        if (!Number.isFinite(price) || price <= 0) return;

        const sym = tradingOptions?.getSymbol?.() ?? "MNQ";

        if (action === "sell-limit") {
          triggerOrder(sym, "sell", "limit", price);
        } else if (action === "buy-stop") {
          triggerOrder(sym, "buy", "stop", price);
        } else if (action === "buy-stop-limit") {
          triggerOrder(sym, "buy", "stop_limit", price);
        } else if (action === "buy-limit") {
          triggerOrder(sym, "buy", "limit", price);
        } else if (action === "sell-stop") {
          triggerOrder(sym, "sell", "stop", price);
        } else if (action === "sell-stop-limit") {
          triggerOrder(sym, "sell", "stop_limit", price);
        } else if (action === "add-order") {
          const curPrice = tradingOptions?.getCurrentPrice?.() ?? 0;
          triggerOrder(sym, price >= curPrice ? "sell" : "buy", "limit", price);
        }
        return;
      }
      return origRun(id);
    };
  }

  // 3. DOM MutationObserver to enforce Sliders, Copy price, and Trading icons inside .vela-menu-badge or .vela-icon
  const setItemIcon = (item: HTMLElement, svg: string) => {
    const badge = item.querySelector<HTMLElement>(":scope > .vela-menu-badge");
    if (badge) {
      // Remove any duplicate direct .vela-icon outside .vela-menu-badge
      item
        .querySelectorAll<HTMLElement>(":scope > .vela-icon:not(.vela-menu-star)")
        .forEach((el) => el.remove());
      let iconSpan = badge.querySelector<HTMLElement>(":scope > .vela-icon");
      if (!iconSpan) {
        iconSpan = document.createElement("span");
        iconSpan.className = "vela-icon";
        iconSpan.setAttribute("aria-hidden", "true");
        badge.appendChild(iconSpan);
      }
      if (iconSpan.innerHTML !== svg) {
        iconSpan.innerHTML = svg;
      }
      return;
    }

    let iconSpan = item.querySelector<HTMLElement>(":scope > .vela-icon:not(.vela-menu-star)");
    if (!iconSpan) {
      iconSpan = document.createElement("span");
      iconSpan.className = "vela-icon";
      iconSpan.setAttribute("aria-hidden", "true");
      item.insertBefore(iconSpan, item.querySelector(":scope > .vela-menu-label"));
    }
    if (iconSpan.innerHTML !== svg) {
      iconSpan.innerHTML = svg;
    }
  };

  const applyIcons = (root: Element) => {
    // Replace settings icon with Sliders icon
    const settingsItems = root.querySelectorAll<HTMLElement>(
      '.vela-menu-item[data-vei-id^="settings"], .vela-menu-item[data-vei-id="settings"]',
    );
    settingsItems.forEach((item) => {
      setItemIcon(item, SLIDERS_ICON_SVG);
    });

    // Ensure Copy price icon is copy double-rect
    const copyItems = root.querySelectorAll<HTMLElement>(
      '.vela-menu-item[data-vei-id="action:copy-price"]',
    );
    copyItems.forEach((item) => {
      setItemIcon(item, COPY_PRICE_ICON_SVG);
    });

    // Trading Icons reinforcement
    const tradingItems = root.querySelectorAll<HTMLElement>(
      '.vela-menu-item[data-vei-id^="trading:"]',
    );
    tradingItems.forEach((item) => {
      const id = item.getAttribute("data-vei-id") || "";
      if (id.includes("sell-limit") || id.includes("sell-stop")) {
        setItemIcon(item, TRADING_DOWN_ICON_SVG);
      } else if (id.includes("buy-stop") || id.includes("buy-limit")) {
        setItemIcon(item, TRADING_UP_ICON_SVG);
      } else if (id.includes("add-order")) {
        setItemIcon(item, TRADING_ADD_ORDER_ICON_SVG);
      }
    });

    // Alert Icons reinforcement
    const alertItems = root.querySelectorAll<HTMLElement>(
      '.vela-menu-item[data-vei-id^="alert:create"]',
    );
    alertItems.forEach((item) => {
      setItemIcon(item, ALARM_CLOCK_ICON_SVG);
    });

    // 3D Keyboard Shortcut Chips for Hints
    const hintItems: HTMLElement[] = [];
    if (root.classList?.contains("vela-menu-hint")) {
      hintItems.push(root as HTMLElement);
    } else if (root.classList?.contains("vela-menu-item")) {
      const hint = root.querySelector<HTMLElement>(".vela-menu-hint");
      if (hint) hintItems.push(hint);
    }
    root.querySelectorAll<HTMLElement>(".vela-menu-item .vela-menu-hint").forEach((el) => {
      if (!hintItems.includes(el)) hintItems.push(el);
    });

    hintItems.forEach((hintEl) => {
      if (hintEl.querySelector("kbd")) return;
      const rawText = hintEl.textContent?.trim();
      if (rawText) {
        const parts = rawText.split("+").map((s) => s.trim()).filter(Boolean);
        if (parts.length > 0) {
          hintEl.innerHTML = parts
            .map((part) => `<kbd>${part}</kbd>`)
            .join('<span class="vela-kbd-sep">+</span>');
        }
      }
    });
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (typeof Element !== "undefined" && node instanceof Element) {
          applyIcons(node);
        } else if (node && typeof (node as any).querySelectorAll === "function") {
          applyIcons(node as any);
        }
      }
    }
  });

  const observeTarget =
    (typeof container.closest === "function" ? container.closest(".vela-ui") : null) ??
    container.ownerDocument?.body ??
    container;

  observer.observe(observeTarget, { childList: true, subtree: true });
  applyIcons(observeTarget);

  // 4. Global Keyboard Shortcuts (Alt+A, Alt+Shift+S, Alt+Shift+B, Shift+T)
  const handleKeyDown = (e: KeyboardEvent) => {
    const matchesHover = (() => {
      try {
        return typeof container.matches === "function" ? container.matches(":hover") : false;
      } catch {
        return false;
      }
    })();
    const isCellActive =
      container.dataset?.active === "1" ||
      matchesHover ||
      (typeof container.contains === "function" && document.activeElement ? container.contains(document.activeElement) : false);
    if (!isCellActive) return;

    const resolvedFallbackPrice = fallbackResolver?.()?.price;
    const currentPriceFallback =
      tradingOptions?.getCurrentPrice?.() ??
      globalContextMenuDefaults.getCurrentPrice?.() ??
      0;
    const rawPrice =
      (typeof resolvedFallbackPrice === "number" && resolvedFallbackPrice > 0
        ? resolvedFallbackPrice
        : typeof contextMenu.pointer?.price === "number" && contextMenu.pointer.price > 0
          ? contextMenu.pointer.price
          : typeof currentPriceFallback === "number" && currentPriceFallback > 0
            ? currentPriceFallback
            : 0);
    if (!rawPrice || rawPrice <= 0 || !Number.isFinite(rawPrice)) return;
    const sym = tradingOptions?.getSymbol?.() ?? "MNQ";
    const curPrice = tradingOptions?.getCurrentPrice?.() ?? 0;

    if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey && (e.key === "A" || e.key === "a")) {
      e.preventDefault();
      triggerAlert(sym, rawPrice);
    } else if (e.altKey && e.shiftKey && (e.key === "S" || e.key === "s")) {
      e.preventDefault();
      triggerOrder(sym, "sell", "limit", rawPrice);
    } else if (e.altKey && e.shiftKey && (e.key === "B" || e.key === "b")) {
      e.preventDefault();
      triggerOrder(sym, "buy", "limit", rawPrice);
    } else if (!e.altKey && !e.ctrlKey && !e.metaKey && e.shiftKey && (e.key === "T" || e.key === "t")) {
      e.preventDefault();
      triggerOrder(sym, rawPrice >= curPrice ? "sell" : "buy", "limit", rawPrice);
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    container.removeEventListener("contextmenu", onContainerContextMenuCapture, true);
    observer.disconnect();
    window.removeEventListener("keydown", handleKeyDown);
  };
}
