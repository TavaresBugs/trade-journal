/**
 * Official Vela Chrome Hover Tracker & Menu Joins
 * Replicates the magnetic sliding hover pill effect across Topbar and Bottombar,
 * and the seamless organic Bézier SVG join between Bottombar UTC trigger and .vela-menu.
 */

import { syncNativeTopbarSymbolButton } from "../widget/topbar";
import { VELA_NATIVE_ICONS } from "./chrome-join";

export interface BottombarJoinGeometry {
  z: number;
  M: number;
  P: number;
  D: string;
}

/**
 * Computes exact 1:1 Bézier SVG join curve for Bottombar floating menu (e.g. UTC timezone menu).
 * Formula:
 * const z = 16;
 * const M = C.width + 2 * z;
 * const P = C.height;
 * const D = `M 0 0 Q ${z} 0 ${z} ${z} V ${P - 10} Q ${z} ${P} ${z + 10} ${P} H ${M - z - 10} Q ${M - z} ${P} ${M - z} ${P - 10} V ${z} Q ${M - z} 0 ${M} 0`;
 */
export function computeBottombarJoinGeometry(width: number, height: number): BottombarJoinGeometry {
  const z = 16;
  const M = Math.max(1, width + 2 * z);
  const P = Math.max(1, height);
  const D = `M 0 0 Q ${z} 0 ${z} ${z} V ${P - 10} Q ${z} ${P} ${z + 10} ${P} H ${M - z - 10} Q ${M - z} ${P} ${M - z} ${P - 10} V ${z} Q ${M - z} 0 ${M} 0`;
  return { z, M, P, D };
}

/**
 * Computes vertical dock shift so the menu overlaps the trigger by 1px:
 * S = A.top + 1 - (k.bottom - q)
 */
export function computeBottombarDockShift(triggerTop: number, menuBottom: number, currentShift: number = 0): number {
  return Math.round(triggerTop + 1 - (menuBottom - currentShift));
}

/**
 * Enhances Bottombar UTC Timezone trigger (.vela-bb-tz) with the official Vela Bézier join.
 * When .vela-menu opens, it receives:
 * - data-chrome-joined="above"
 * - data-chrome-join-kind="bar"
 * - --chrome-dock-shift: <S>px
 * - Injected .quant-chrome-join SVG element behind menu
 */
export function enhanceVelaBottombarJoin(container: HTMLElement): () => void {
  if (typeof document === "undefined") return () => {};

  let activeCleanup: (() => void) | null = null;
  let currentJoin: HTMLElement | null = null;
  let currentMenu: HTMLElement | null = null;
  let currentLayer: HTMLElement | null = null;
  let currentAnchorParent: HTMLElement | null = null;
  let layerObserver: MutationObserver | null = null;
  let ro: ResizeObserver | null = null;
  let isTracking = false;

  function teardownJoin() {
    if (ro) {
      ro.disconnect();
      ro = null;
    }
    if (layerObserver) {
      layerObserver.disconnect();
      layerObserver = null;
    }
    if (currentLayer) {
      currentLayer.removeAttribute("data-chrome-joined-layer");
      currentLayer.style.removeProperty("--chrome-layer-top");
      currentLayer.style.removeProperty("--chrome-layer-left");
      currentLayer.style.removeProperty("top");
      currentLayer.style.removeProperty("left");
      currentLayer.style.removeProperty("transform");
      currentLayer.style.removeProperty("z-index");
      currentLayer = null;
    }
    if (currentAnchorParent) {
      currentAnchorParent.style.removeProperty("--chrome-layer-top");
      currentAnchorParent.style.removeProperty("--chrome-layer-left");
      currentAnchorParent = null;
    }
    if (currentJoin) {
      currentJoin.remove();
      currentJoin = null;
    }
    if (currentMenu) {
      currentMenu.removeAttribute("data-chrome-joined");
      currentMenu.removeAttribute("data-chrome-join-kind");
      currentMenu.style.removeProperty("--chrome-dock-shift");
      currentMenu.style.removeProperty("position");
      currentMenu.style.removeProperty("z-index");
      currentMenu.style.removeProperty("border-radius");
      currentMenu = null;
    }
  }

  function setupTzTracking(tzBtn: HTMLElement) {
    if (isTracking) return;
    isTracking = true;

    function findMenu(): HTMLElement | null {
      if (typeof document === "undefined") return null;
      const menuId = tzBtn.getAttribute("aria-controls");
      if (menuId) {
        const el = document.getElementById(menuId);
        if (el && el.classList.contains("vela-menu")) return el;
      }
      const byLabel = document.querySelector<HTMLElement>('.vela-menu[aria-labelledby="vela-bb-tz"]');
      if (byLabel) return byLabel;

      const root = tzBtn.closest(".vela-ui") || document.body;
      const menus = root?.querySelectorAll<HTMLElement>(".vela-menu") ?? [];
      for (const m of Array.from(menus)) {
        if (!m.hidden && m.getAttribute("data-state") === "open") {
          return m;
        }
      }
      return null;
    }

    function isMenuOpen(menu: HTMLElement | null): boolean {
      if (!menu) return false;
      if (menu.hidden || menu.getAttribute("aria-hidden") === "true") return false;
      const state = menu.getAttribute("data-state");
      const tzExpanded = tzBtn.getAttribute("aria-expanded");
      return state === "open" || tzExpanded === "true" || !menu.hidden;
    }

    function updateGeometry(menu: HTMLElement, join: HTMLElement) {
      const A = tzBtn.getBoundingClientRect();
      const k = menu.getBoundingClientRect();
      const bottombar = tzBtn.closest<HTMLElement>(".vela-widget-bottombar") || tzBtn.parentElement;
      const barRect = bottombar ? bottombar.getBoundingClientRect() : A;
      const layer = menu.closest<HTMLElement>(".vela-ui-layer");

      const measuredW = menu.offsetWidth || k.width || 250.55;
      const width = Math.min(270, Math.max(240, measuredW));
      const height = Math.max(120, menu.offsetHeight || k.height || 543);
      const { z, M, P, D } = computeBottombarJoinGeometry(width, height);

      if (layer) {
        const anchorParent =
          (layer.offsetParent as HTMLElement | null) ||
          tzBtn.closest<HTMLElement>(".vela-ui") ||
          layer.parentElement;
        currentAnchorParent = anchorParent;
        const parentRect = anchorParent ? anchorParent.getBoundingClientRect() : null;
        const pLeft =
          (parentRect?.left ?? 0) +
          (anchorParent?.clientLeft ?? 0) -
          (anchorParent?.scrollLeft ?? 0);
        const pTop =
          (parentRect?.top ?? 0) +
          (anchorParent?.clientTop ?? 0) -
          (anchorParent?.scrollTop ?? 0);

        const barTopRel = barRect.top - pTop;
        const barLeftRel = barRect.left - pLeft;
        const barRightRel = barRect.right - pLeft;
        const tzRightRel = A.right - pLeft;

        // Dock layer flush above bottombar (overlapping 1px top border, invariant to page scroll)
        const layerTop = Math.round(barTopRel + 1 - height);
        const menuW = menu.offsetWidth || k.width || width;
        const idealLeft = Math.round(tzRightRel - menuW);
        const minLeft = Math.round(barLeftRel + 8);
        const maxLeft = Math.max(minLeft, Math.round(barRightRel - menuW - 8));
        const layerLeft =
          barRect.width > 0
            ? Math.max(minLeft, Math.min(maxLeft, idealLeft))
            : idealLeft;

        layer.setAttribute("data-chrome-joined-layer", "above");
        anchorParent?.style.setProperty("--chrome-layer-top", `${layerTop}px`);
        anchorParent?.style.setProperty("--chrome-layer-left", `${layerLeft}px`);
        layer.style.setProperty("--chrome-layer-top", `${layerTop}px`);
        layer.style.setProperty("--chrome-layer-left", `${layerLeft}px`);
        layer.style.setProperty("position", "absolute", "important");
        layer.style.setProperty("top", `${layerTop}px`, "important");
        layer.style.setProperty("left", `${layerLeft}px`, "important");
        layer.style.setProperty("transform", "none", "important");
        layer.style.setProperty("z-index", "50", "important");

        if (menu.style.getPropertyValue("--chrome-dock-shift") !== "0px") {
          menu.style.setProperty("--chrome-dock-shift", "0px");
        }
        if (join.style.getPropertyValue("--chrome-dock-shift") !== "0px") {
          join.style.setProperty("--chrome-dock-shift", "0px");
        }

        join.style.position = "absolute";
        join.style.left = `${-z}px`;
        join.style.top = "0px";
        join.style.width = `${M}px`;
        join.style.height = `${P}px`;
        join.style.zIndex = "49";
        join.style.pointerEvents = "none";

        const clipRight =
          barRect.width > 0 ? Math.max(0, layerLeft + width + z - barRightRel) : 0;
        const clipLeft =
          barRect.width > 0 ? Math.max(0, barLeftRel - (layerLeft - z)) : 0;
        if (clipRight > 0 || clipLeft > 0) {
          join.style.clipPath = `inset(0px ${clipRight.toFixed(2)}px 0px ${clipLeft.toFixed(2)}px)`;
        } else {
          join.style.clipPath = "none";
        }
      } else {
        const q = parseFloat(menu.style.getPropertyValue("--chrome-dock-shift")) || 0;
        const barTop = barRect.top;
        const barRight = barRect.right;
        const barLeft = barRect.left;
        const S = computeBottombarDockShift(barTop, k.bottom, q);
        const safeShift = Number.isFinite(S) ? S : 4;

        if (menu.style.getPropertyValue("--chrome-dock-shift") !== `${safeShift}px`) {
          menu.style.setProperty("--chrome-dock-shift", `${safeShift}px`);
        }
        if (join.style.getPropertyValue("--chrome-dock-shift") !== `${safeShift}px`) {
          join.style.setProperty("--chrome-dock-shift", `${safeShift}px`);
        }

        const offsetParent = join.offsetParent as HTMLElement | null;
        const parentRect = offsetParent ? offsetParent.getBoundingClientRect() : null;
        const pLeft =
          (parentRect?.left ?? 0) +
          (offsetParent?.clientLeft ?? 0) -
          (offsetParent?.scrollLeft ?? 0);
        const pTop =
          (parentRect?.top ?? 0) +
          (offsetParent?.clientTop ?? 0) -
          (offsetParent?.scrollTop ?? 0);

        const leftPos = Math.round(k.left - z - pLeft);
        const topPos = Math.round(k.top - q + safeShift - pTop);

        join.style.position = "absolute";
        join.style.left = `${leftPos}px`;
        join.style.top = `${topPos}px`;
        join.style.width = `${M}px`;
        join.style.height = `${P}px`;
        join.style.zIndex = "49";
        join.style.pointerEvents = "none";

        const clipRight = barRect.width > 0 ? Math.max(0, k.right + z - barRight) : 0;
        const clipLeft = barRect.width > 0 ? Math.max(0, barLeft - (k.left - z)) : 0;
        if (clipRight > 0 || clipLeft > 0) {
          join.style.clipPath = `inset(0px ${clipRight.toFixed(2)}px 0px ${clipLeft.toFixed(2)}px)`;
        } else {
          join.style.clipPath = "none";
        }
      }

      join.innerHTML = `<svg viewBox="0 0 ${M} ${P}" style="transform: scaleY(-1); width: 100%; height: 100%; display: block; overflow: visible;"><path class="quant-chrome-join-fill" d="${D} Z"></path><path class="quant-chrome-join-edge" d="${D}"></path></svg>`;
    }

    function setupJoinForMenu(menu: HTMLElement) {
      menu.setAttribute("data-chrome-joined", "above");
      menu.setAttribute("data-chrome-join-kind", "bar");
      menu.style.position = "relative";
      menu.style.zIndex = "50";
      menu.style.borderRadius = "10px 10px 0 0";

      let join =
        menu.parentElement?.querySelector<HTMLElement>(":scope > .quant-chrome-join") ||
        null;

      if (!join) {
        join = document.createElement("div");
        join.className = "quant-chrome-join";
        join.setAttribute("aria-hidden", "true");
        join.setAttribute("data-side", "above");
        join.style.position = "absolute";
        join.style.pointerEvents = "none";

        if (menu.parentElement) {
          menu.parentElement.insertBefore(join, menu);
        } else {
          const root = tzBtn.closest(".vela-ui") || document.body;
          root.appendChild(join);
        }
      }

      currentJoin = join;
      currentMenu = menu;

      updateGeometry(menu, join);

      if (!ro && typeof ResizeObserver !== "undefined") {
        let rafId: number | null = null;
        ro = new ResizeObserver(() => {
          if (rafId) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            if (currentMenu && currentJoin) {
              updateGeometry(currentMenu, currentJoin);
            }
          });
        });
        ro.observe(tzBtn);
        ro.observe(menu);
      }

      const layer = menu.closest<HTMLElement>(".vela-ui-layer") || menu.parentElement;
      if (layer && layer !== currentLayer) {
        layerObserver?.disconnect();
        layerObserver = new MutationObserver(() => {
          // Only re-lock if @zag-js overwrote layer's inline style (e.g. resetting transform)
          if (
            currentMenu &&
            currentJoin &&
            isMenuOpen(currentMenu) &&
            layer.classList.contains("vela-ui-layer") &&
            layer.style.transform !== "none"
          ) {
            updateGeometry(currentMenu, currentJoin);
          }
        });
        layerObserver.observe(layer, {
          attributes: true,
          attributeFilter: ["style"],
        });
        currentLayer = layer;
      }
    }

    function syncState() {
      const menu = findMenu();
      if (menu && isMenuOpen(menu)) {
        setupJoinForMenu(menu);
      } else {
        teardownJoin();
      }
    }

    const onClick = () => {
      queueMicrotask(syncState);
      if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(syncState);
      }
      setTimeout(syncState, 50);
    };

    tzBtn.addEventListener("click", onClick);
    tzBtn.addEventListener("pointerdown", onClick);

    const onScrollOrResize = () => {
      if (currentMenu && currentJoin && isMenuOpen(currentMenu)) {
        requestAnimationFrame(() => {
          if (currentMenu && currentJoin) {
            updateGeometry(currentMenu, currentJoin);
          }
        });
      }
    };

    window.addEventListener("scroll", onScrollOrResize, { capture: true, passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });

    const tzObserver = new MutationObserver(() => {
      syncState();
    });
    tzObserver.observe(tzBtn, {
      attributes: true,
      attributeFilter: ["aria-expanded", "data-state", "aria-controls"],
    });

    const root = tzBtn.closest(".vela-ui") || document.body;
    const rootObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList") {
          for (const node of Array.from(m.addedNodes)) {
            if (
              node instanceof HTMLElement &&
              (node.classList.contains("vela-menu") || node.querySelector(".vela-menu"))
            ) {
              syncState();
              return;
            }
          }
        } else if (m.type === "attributes") {
          const target = m.target as HTMLElement;
          if (target.classList?.contains("vela-menu")) {
            syncState();
            return;
          }
        }
      }
    });
    rootObserver.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state", "hidden"],
    });

    // Check immediately in case menu is already mounted/open
    syncState();

    activeCleanup = () => {
      tzBtn.removeEventListener("click", onClick);
      tzBtn.removeEventListener("pointerdown", onClick);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      tzObserver.disconnect();
      rootObserver.disconnect();
      layerObserver?.disconnect();
      layerObserver = null;
      currentLayer = null;
      teardownJoin();
      isTracking = false;
    };
  }

  // Check if .vela-bb-tz already exists or wait for it
  const tzBtn =
    container.querySelector<HTMLElement>(".vela-bb-tz") ||
    (container.matches(".vela-bb-tz") ? container : null);

  if (tzBtn) {
    setupTzTracking(tzBtn);
  }

  const containerObserver = new MutationObserver(() => {
    const btn = container.querySelector<HTMLElement>(".vela-bb-tz");
    if (btn && !isTracking) {
      setupTzTracking(btn);
    }
  });
  containerObserver.observe(container, { childList: true, subtree: true });

  return () => {
    containerObserver.disconnect();
    activeCleanup?.();
  };
}

export const CHART_BUTTON_DESCRIPTIONS: Record<string, string> = {
  "Object tree": "Every indicator and drawing on this chart, in one list.",
  "Data window": "The values under your cursor, for the price and every indicator.",
  "Chart settings": "Colors, scales, the status line and trading on the chart.",
  "Screenshot": "Capture or share the current chart.",
  "Download screenshot": "Capture or share the current chart.",
  "Indicators": "Add indicators to the chart.",
  "Favorite indicators": "Quickly add an indicator you have starred.",
  "Replay": "Replay historical candles at your own pace.",
  "Symbol search": "Find a market to open on the chart.",
  "Change symbol": "Find a market to open on the chart.",
  "Timeframe": "Choose the interval represented by each candle.",
  "Chart style": "Choose how price is drawn on the chart.",
  "Candles": "Choose how price is drawn on the chart.",
  "Layout": "Arrange charts and choose what stays in sync.",
  "Indicator Templates": "Save and reuse a group of indicators.",
  "Time zone": "Choose the time zone shown along the chart.",
  "Undo": "Reverse the last chart edit.",
  "Redo": "Restore the last edit you undid.",
};

export interface ToolCardMeta {
  title: string;
  description: string;
  isDockPanel: boolean;
}

function stripButtonTitle(el: Element): void {
  const titleAttr = el.getAttribute("title");
  if (titleAttr) {
    if (!el.getAttribute("data-vela-title")) {
      el.setAttribute("data-vela-title", titleAttr);
    }
    el.removeAttribute("title");
  }
}

function stripAllTitlesInContainer(root: HTMLElement): void {
  stripButtonTitle(root);
  const buttons = root.querySelectorAll("button");
  for (const btn of Array.from(buttons)) {
    stripButtonTitle(btn);
  }
  const titled = root.querySelectorAll("[title]");
  for (const el of Array.from(titled)) {
    stripButtonTitle(el);
  }
}

function isAnyPopupOpen(hostRoot: HTMLElement, btn: HTMLElement): boolean {
  const ariaExpanded = btn.getAttribute("aria-expanded");
  const isTooltipHover =
    ariaExpanded === "false" ||
    btn.getAttribute("data-scope") === "tooltip" ||
    Boolean(btn.getAttribute("aria-describedby")?.includes("tooltip"));

  if (
    ariaExpanded === "true" ||
    btn.getAttribute("data-quant-open") === "1" ||
    (!isTooltipHover && btn.getAttribute("data-state") === "open")
  ) {
    return true;
  }

  const menus = hostRoot.querySelectorAll<HTMLElement>(".vela-menu");
  for (const m of Array.from(menus)) {
    if (!m.hidden && m.getAttribute("aria-hidden") !== "true" && m.getAttribute("data-state") === "open") {
      return true;
    }
  }

  const screenshotMenus = hostRoot.querySelectorAll<HTMLElement>(".vela-screenshot-floating-menu");
  for (const sm of Array.from(screenshotMenus)) {
    if (!sm.hidden && sm.getAttribute("aria-hidden") !== "true" && sm.getAttribute("data-state") !== "closed") {
      return true;
    }
  }

  const customPickers = hostRoot.querySelectorAll<HTMLElement>(
    ".quant-tfp, .quant-style-picker, .quant-style-popup, .vela-lp, .vlx-il-fav-popup",
  );
  for (const cp of Array.from(customPickers)) {
    if (!cp.hidden && cp.getAttribute("aria-hidden") !== "true") {
      return true;
    }
  }

  const hasOpenDialog = (scope: HTMLElement): boolean => {
    const dialogs = scope.querySelectorAll<HTMLElement>(
      '.vela-dialog, [role="dialog"], .quant-settings-panel',
    );
    for (const d of Array.from(dialogs)) {
      if (
        !d.hidden &&
        d.getAttribute("aria-hidden") !== "true" &&
        d.getAttribute("data-state") !== "closed"
      ) {
        return true;
      }
    }
    return false;
  };

  if (hasOpenDialog(hostRoot)) {
    return true;
  }
  if (typeof document !== "undefined" && document.body && document.body !== hostRoot) {
    if (hasOpenDialog(document.body)) {
      return true;
    }
  }

  return false;
}

function suppressNativeTooltips(hostRoot: HTMLElement): void {
  const tooltips = hostRoot.querySelectorAll<HTMLElement>(".vela-tooltip");
  for (const t of Array.from(tooltips)) {
    t.hidden = true;
    t.style.setProperty("display", "none");
  }
  if (typeof document !== "undefined" && document.body && document.body !== hostRoot) {
    const bodyTooltips = document.body.querySelectorAll<HTMLElement>(".vela-tooltip");
    for (const t of Array.from(bodyTooltips)) {
      t.hidden = true;
      t.style.setProperty("display", "none");
    }
  }
}

export function resolveButtonCardMeta(btn: HTMLElement): ToolCardMeta | null {
  stripButtonTitle(btn);

  const railItem = btn.getAttribute("data-rail-item");

  if (
    btn.id === "vela-topbar-symbol" ||
    btn.classList.contains("vela-widget-symbol") ||
    btn.closest(".vela-widget-symbol") ||
    btn.classList.contains("vela-widget-tf") ||
    btn.closest(".vela-widget-tf") ||
    btn.closest("#vela-topbar-symbol") ||
    btn.classList.contains("vela-bb-range") ||
    btn.closest(".vela-bb-range") ||
    btn.hasAttribute("data-range") ||
    btn.closest("[data-range]")
  ) {
    return null;
  }

  if (
    btn.id === "vela-topbar-tf" ||
    btn.classList.contains("vela-widget-tf-caret") ||
    btn.closest(".vela-widget-tf-caret") ||
    btn.closest("#vela-topbar-tf") ||
    railItem === "timeframe" ||
    btn.getAttribute("aria-label")?.startsWith("Timeframe")
  ) {
    return {
      title: "Timeframe",
      description: CHART_BUTTON_DESCRIPTIONS["Timeframe"] ?? "Choose the interval represented by each candle.",
      isDockPanel: false,
    };
  }

  if (railItem === "dock-objects") {
    return {
      title: "Object tree",
      description: CHART_BUTTON_DESCRIPTIONS["Object tree"] ?? "",
      isDockPanel: true,
    };
  }
  if (railItem === "dock-dataWindow") {
    return {
      title: "Data window",
      description: CHART_BUTTON_DESCRIPTIONS["Data window"] ?? "",
      isDockPanel: true,
    };
  }
  if (
    railItem === "dock-vela-pro.code" ||
    railItem === "pine-editor" ||
    btn.getAttribute("aria-label") === "Pine editor"
  ) {
    return {
      title: "Pine editor",
      description: "Write Pine Script® and run it on this chart.",
      isDockPanel: true,
    };
  }
  if (
    railItem === "chart-settings" ||
    btn.id === "vela-bb-settings" ||
    btn.classList.contains("vela-bb-settings") ||
    btn.closest(".vela-bb-settings") ||
    btn.getAttribute("aria-label") === "Chart settings"
  ) {
    return {
      title: "Chart settings",
      description: CHART_BUTTON_DESCRIPTIONS["Chart settings"] ?? "",
      isDockPanel: false,
    };
  }

  if (btn.classList.contains("quant-side-rail-corner") || btn.closest(".quant-side-rail-corner")) {
    return {
      title: "Screenshot",
      description: CHART_BUTTON_DESCRIPTIONS["Screenshot"] ?? "",
      isDockPanel: false,
    };
  }

  if (
    btn.id === "vela-topbar-layout" ||
    btn.closest("#vela-topbar-layout") ||
    btn.getAttribute("aria-label")?.startsWith("Layout")
  ) {
    return {
      title: "Layout",
      description: CHART_BUTTON_DESCRIPTIONS["Layout"] ?? "Arrange charts and choose what stays in sync.",
      isDockPanel: false,
    };
  }

  if (
    btn.id === "vela-topbar-style" ||
    btn.closest("#vela-topbar-style") ||
    btn.getAttribute("aria-label")?.startsWith("Chart style") ||
    ((btn.classList.contains("vela-widget-style") || btn.closest(".vela-widget-style")) &&
      btn.id !== "vela-topbar-layout" &&
      !btn.closest("#vela-topbar-layout"))
  ) {
    return {
      title: "Chart style",
      description: CHART_BUTTON_DESCRIPTIONS["Chart style"] ?? "Choose how price is drawn on the chart.",
      isDockPanel: false,
    };
  }

  if (
    btn.classList.contains("vlx-il-fav-caret") ||
    btn.closest(".vlx-il-fav-caret") ||
    btn.getAttribute("aria-label") === "Favorite indicators"
  ) {
    return {
      title: "Favorite indicators",
      description: CHART_BUTTON_DESCRIPTIONS["Favorite indicators"] ?? "Quickly add an indicator you have starred.",
      isDockPanel: false,
    };
  }

  if (
    btn.classList.contains("vela-widget-indicators") ||
    btn.closest(".vela-widget-indicators") ||
    btn.getAttribute("data-quant-collapse") === "indicators" ||
    btn.getAttribute("aria-label") === "Indicators"
  ) {
    return {
      title: "Indicators",
      description: CHART_BUTTON_DESCRIPTIONS["Indicators"] ?? "Add indicators to the chart.",
      isDockPanel: false,
    };
  }

  if (
    btn.id === "vela-action-quant:indicator-templates.open" ||
    btn.closest('[id="vela-action-quant:indicator-templates.open"]') ||
    btn.getAttribute("aria-label") === "Indicator Templates"
  ) {
    return {
      title: "Indicator Templates",
      description: CHART_BUTTON_DESCRIPTIONS["Indicator Templates"] ?? "Save and reuse a group of indicators.",
      isDockPanel: false,
    };
  }

  if (
    btn.classList.contains("vela-replay-topbar-btn") ||
    btn.closest(".vela-replay-topbar-btn") ||
    btn.getAttribute("data-quant-collapse") === "replay" ||
    btn.getAttribute("aria-label") === "Bar Replay"
  ) {
    return {
      title: "Bar Replay",
      description: CHART_BUTTON_DESCRIPTIONS["Replay"] ?? "Replay historical candles at your own pace.",
      isDockPanel: false,
    };
  }

  if (
    btn.classList.contains("vela-widget-undo") ||
    btn.closest(".vela-widget-undo") ||
    btn.getAttribute("aria-label") === "Undo"
  ) {
    return {
      title: "Undo",
      description: CHART_BUTTON_DESCRIPTIONS["Undo"] ?? "",
      isDockPanel: false,
    };
  }

  if (
    btn.classList.contains("vela-widget-redo") ||
    btn.closest(".vela-widget-redo") ||
    btn.getAttribute("aria-label") === "Redo"
  ) {
    return {
      title: "Redo",
      description: CHART_BUTTON_DESCRIPTIONS["Redo"] ?? "",
      isDockPanel: false,
    };
  }

  if (
    btn.id === "vela-bb-tz" ||
    btn.classList.contains("vela-bb-tz") ||
    btn.closest(".vela-bb-tz") ||
    btn.getAttribute("aria-label") === "Time zone"
  ) {
    return {
      title: "Time zone",
      description: CHART_BUTTON_DESCRIPTIONS["Time zone"] ?? "",
      isDockPanel: false,
    };
  }

  const label =
    btn.getAttribute("data-tooltip") ||
    btn.getAttribute("aria-label") ||
    btn.getAttribute("data-vela-title") ||
    btn.textContent?.trim() ||
    "";

  if (
    label === "Symbol search" ||
    label === "Change symbol" ||
    label === "Timeframe" ||
    label === "Timeframes" ||
    label.startsWith("Switch timeframe")
  ) {
    return null;
  }

  const matchedDesc = label ? CHART_BUTTON_DESCRIPTIONS[label] : undefined;
  if (label && matchedDesc) {
    const isDock = label === "Object tree" || label === "Data window";
    return {
      title: label,
      description: matchedDesc,
      isDockPanel: isDock,
    };
  }

  return null;
}

function buildToolCardElement(
  doc: Document,
  btn: HTMLElement,
  meta: ToolCardMeta,
  variantClass: "quant-side-rail-card" | "quant-chart-card",
): HTMLElement {
  const card = doc.createElement("div");
  card.className = `quant-tool-card ${variantClass}`;
  card.setAttribute("role", "tooltip");

  const heading = doc.createElement("div");
  heading.className = "quant-tool-card-heading";

  const iconWrap = doc.createElement("span");
  iconWrap.className = "quant-tool-card-icon";
  iconWrap.setAttribute("aria-hidden", "true");

  const svg = btn.querySelector("svg");
  if (svg) {
    if (typeof (svg as any).cloneNode === "function") {
      iconWrap.appendChild((svg as any).cloneNode(true));
    } else {
      const clonedSvg = doc.createElement("svg");
      const viewBox = svg.getAttribute("viewBox");
      if (viewBox) clonedSvg.setAttribute("viewBox", viewBox);
      clonedSvg.innerHTML = svg.innerHTML || "";
      iconWrap.appendChild(clonedSvg);
    }
  } else {
    const badge = doc.createElement("span");
    badge.style.setProperty("font-size", "11px");
    badge.style.setProperty("font-weight", "600");
    const rawText = (btn.textContent || "").trim();
    badge.textContent = rawText ? rawText.slice(0, 6) : meta.title.slice(0, 3);
    iconWrap.appendChild(badge);
  }

  const strong = doc.createElement("strong");
  strong.textContent = meta.title;

  heading.appendChild(iconWrap);
  heading.appendChild(strong);
  card.appendChild(heading);

  const p = doc.createElement("p");
  p.textContent = meta.description;
  card.appendChild(p);

  if (meta.isDockPanel) {
    const hint = doc.createElement("div");
    hint.className = "quant-side-rail-card-hint";
    hint.style.setProperty("margin-top", "8px");
    hint.style.setProperty("padding-top", "8px");
    hint.style.setProperty("border-top", "1px solid var(--vela-border, #2a2b30)");
    hint.style.setProperty("font-size", "11px");
    hint.style.setProperty("color", "var(--vela-fg-muted, #868a96)");
    const isOpen =
      btn.getAttribute("aria-pressed") === "true" ||
      btn.getAttribute("data-open") === "1" ||
      btn.getAttribute("open") === "1";
    if (isOpen) {
      hint.textContent = "Click to close";
      hint.innerHTML = "Click to close";
    } else if (btn.getAttribute("data-rail-item") === "dock-vela-pro.code") {
      hint.textContent = "Click to open";
      hint.innerHTML = "Click to open";
    } else {
      hint.textContent = "⇧ Click to open it beside the others";
      hint.innerHTML = "<kbd>⇧</kbd> Click to open it beside the others";
    }
    card.appendChild(hint);
  }

  return card;
}

function clearExistingToolCards(hostRoot: HTMLElement): void {
  const existing = hostRoot.querySelectorAll<HTMLElement>(".quant-tool-card");
  for (const el of Array.from(existing)) {
    el.remove();
  }
}

export function enhanceVelaSideRail(rail: HTMLElement): () => void {
  if (typeof document === "undefined") return () => {};

  const doc = rail.ownerDocument || document;
  const hostRoot = rail.closest<HTMLElement>(".vela-ui") || rail.parentElement || rail;
  let activeCard: HTMLElement | null = null;
  let activeBtn: HTMLElement | null = null;
  let suppressedBtn: HTMLElement | null = null;
  const boundButtons = new Set<HTMLElement>();
  const boundCleanups: Array<() => void> = [];

  stripAllTitlesInContainer(rail);

  function hideCard() {
    if (activeCard) {
      activeCard.remove();
      activeCard = null;
    }
    clearExistingToolCards(hostRoot);
    activeBtn = null;
  }

  function showCardForButton(btn: HTMLElement) {
    stripButtonTitle(btn);

    if (isAnyPopupOpen(hostRoot, btn)) {
      hideCard();
      return;
    }

    const meta = resolveButtonCardMeta(btn);
    if (!meta) {
      hideCard();
      return;
    }

    clearExistingToolCards(hostRoot);
    suppressNativeTooltips(hostRoot);

    const card = buildToolCardElement(doc, btn, meta, "quant-side-rail-card");
    hostRoot.appendChild(card);

    const btnRect = btn.getBoundingClientRect();
    const rootRect = hostRoot.getBoundingClientRect();
    const cardWidth = card.offsetWidth || card.getBoundingClientRect().width || 232;
    const cardHeight = card.offsetHeight || card.getBoundingClientRect().height || 96;
    const rootHeight = rootRect.height || hostRoot.offsetHeight || 700;

    const left = Math.round(btnRect.left - rootRect.left - cardWidth - 12);
    const top = Math.round(
      Math.max(
        8,
        Math.min(
          rootHeight - cardHeight - 8,
          btnRect.top - rootRect.top + btnRect.height / 2 - cardHeight / 2,
        ),
      ),
    );

    card.style.setProperty("position", "absolute");
    card.style.setProperty("left", `${left}px`);
    card.style.setProperty("top", `${top}px`);
    card.style.position = "absolute";
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;

    activeCard = card;
    activeBtn = btn;
  }

  function bindButton(btn: HTMLElement) {
    if (boundButtons.has(btn) || btn.getAttribute("data-vela-rail-card-bound") === "1") return;
    boundButtons.add(btn);
    btn.setAttribute("data-vela-rail-card-bound", "1");
    if ((btn as any).dataset) {
      (btn as any).dataset.velaRailCardBound = "1";
    }
    stripButtonTitle(btn);

    const onEnter = (e?: PointerEvent) => {
      if (e && e.pointerType === "touch") return;
      if (suppressedBtn === btn) {
        suppressedBtn = null;
      }
      showCardForButton(btn);
    };
    const onLeave = () => {
      if (suppressedBtn === btn) {
        suppressedBtn = null;
      }
      if (activeBtn === btn) {
        hideCard();
      }
    };
    const onDown = () => {
      suppressedBtn = btn;
      hideCard();
    };

    btn.addEventListener("pointerenter", onEnter as EventListener);
    btn.addEventListener("mouseenter", onEnter as EventListener);
    btn.addEventListener("pointerleave", onLeave);
    btn.addEventListener("mouseleave", onLeave);
    btn.addEventListener("pointerdown", onDown);
    btn.addEventListener("click", onDown);

    boundCleanups.push(() => {
      btn.removeEventListener("pointerenter", onEnter as EventListener);
      btn.removeEventListener("mouseenter", onEnter as EventListener);
      btn.removeEventListener("pointerleave", onLeave);
      btn.removeEventListener("mouseleave", onLeave);
      btn.removeEventListener("pointerdown", onDown);
      btn.removeEventListener("click", onDown);
      btn.removeAttribute("data-vela-rail-card-bound");
      if ((btn as any).dataset) {
        delete (btn as any).dataset.velaRailCardBound;
      }
      boundButtons.delete(btn);
    });
  }

  function bindAllButtons() {
    const buttons = rail.querySelectorAll<HTMLElement>("button");
    for (const btn of Array.from(buttons)) {
      bindButton(btn);
    }
  }

  bindAllButtons();

  function onPointerMove(e: PointerEvent) {
    if (e.pointerType === "touch") return;
    const target = e.target;
    if (!(target instanceof Element)) {
      suppressedBtn = null;
      hideCard();
      return;
    }
    const btn = target.closest<HTMLElement>("button");
    if (!btn || !rail.contains(btn)) {
      suppressedBtn = null;
      hideCard();
      return;
    }
    if (suppressedBtn && suppressedBtn !== btn) {
      suppressedBtn = null;
    }
    if (btn === suppressedBtn) {
      return;
    }
    if (btn === activeBtn && activeCard) {
      return;
    }
    showCardForButton(btn);
  }

  function onPointerLeave(e: PointerEvent) {
    if (!e.relatedTarget || !rail.contains(e.relatedTarget as Node)) {
      suppressedBtn = null;
      hideCard();
    }
  }

  function onRailPointerDown(e: Event) {
    const target = e.target;
    if (target instanceof Element) {
      const btn = target.closest<HTMLElement>("button");
      if (btn && rail.contains(btn)) {
        suppressedBtn = btn;
      }
    }
    hideCard();
  }

  function onDocPointerDown() {
    hideCard();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      hideCard();
    }
  }

  rail.addEventListener("pointermove", onPointerMove, { passive: true });
  rail.addEventListener("pointerleave", onPointerLeave, { passive: true });
  rail.addEventListener("pointerdown", onRailPointerDown, true);
  rail.addEventListener("click", onRailPointerDown, { passive: true });
  doc.addEventListener?.("pointerdown", onDocPointerDown, true);
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", onKeyDown);
  }

  const rootObserver = new MutationObserver(() => {
    stripAllTitlesInContainer(rail);
    bindAllButtons();
    if (activeBtn && isAnyPopupOpen(hostRoot, activeBtn)) {
      hideCard();
    }
  });
  rootObserver.observe(hostRoot, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-expanded", "data-state", "data-quant-open", "aria-pressed", "data-open", "hidden"],
  });

  return () => {
    hideCard();
    rootObserver.disconnect();
    while (boundCleanups.length > 0) {
      const cleanupBtn = boundCleanups.pop();
      cleanupBtn?.();
    }
    rail.removeEventListener("pointermove", onPointerMove);
    rail.removeEventListener("pointerleave", onPointerLeave);
    rail.removeEventListener("pointerdown", onRailPointerDown, true);
    rail.removeEventListener("click", onRailPointerDown);
    doc.removeEventListener?.("pointerdown", onDocPointerDown, true);
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", onKeyDown);
    }
  };
}

export const VELA_SEARCH_ICON_SVG = VELA_NATIVE_ICONS.search;

export function ensureSymbolSearchIcon(
  symbolBtn: HTMLElement,
  _searchSvgHtml: string = VELA_SEARCH_ICON_SVG,
  symbolOverride?: string,
) {
  syncNativeTopbarSymbolButton(symbolBtn, symbolOverride);
}

export function updateSymbolButtonLabel(
  symbolBtn: HTMLElement,
  symbol: string,
  _searchSvgHtml: string = VELA_SEARCH_ICON_SVG,
) {
  syncNativeTopbarSymbolButton(symbolBtn, symbol);
}

export function enhanceVelaChromeHover(container: HTMLElement): () => void {
  const itemSelector =
    "button, .vela-widget-tf, .vela-widget-tf-caret, .vela-widget-symbol, .vela-widget-style, .vela-widget-indicators, .vela-widget-action, .vela-bb-range";

  const doc = container.ownerDocument || document;
  const hostRoot =
    container.closest<HTMLElement>(".vela-ui, .vela-chart-chrome-replay") ||
    container.parentElement ||
    container;

  let activeTarget: Element | null = null;
  let activeCard: HTMLElement | null = null;
  let suppressedItem: HTMLElement | null = null;
  const boundItems = new Set<HTMLElement>();
  const boundCleanups: Array<() => void> = [];

  container.classList.add("quant-chrome-hover");
  stripAllTitlesInContainer(container);

  function hideCard() {
    if (activeCard) {
      activeCard.remove();
      activeCard = null;
    }
    const existing = hostRoot.querySelectorAll<HTMLElement>(".quant-chart-card");
    for (const el of Array.from(existing)) {
      el.remove();
    }
  }

  function hideHover() {
    container.removeAttribute("data-chrome-visible");
    container.removeAttribute("data-chrome-moving");
    activeTarget = null;
    hideCard();
  }

  function showCardForItem(item: HTMLElement) {
    stripButtonTitle(item);

    if (isAnyPopupOpen(hostRoot, item)) {
      hideCard();
      return;
    }

    const meta = resolveButtonCardMeta(item);
    if (!meta) {
      hideCard();
      return;
    }

    clearExistingToolCards(hostRoot);
    suppressNativeTooltips(hostRoot);

    const card = buildToolCardElement(doc, item, meta, "quant-chart-card");
    hostRoot.appendChild(card);

    const isBottombar = Boolean(
      item.closest(".vela-widget-bottombar") ||
        container.classList.contains("vela-widget-bottombar") ||
        container.querySelector(".vela-widget-bottombar") ||
        item.classList.contains("vela-bb-tz") ||
        item.classList.contains("vela-bb-range") ||
        item.classList.contains("vela-bb-settings") ||
        item.id === "vela-bb-settings" ||
        item.id === "vela-bb-tz",
    );

    const barEl =
      item.closest<HTMLElement>(".vela-widget-topbar, .vela-widget-bottombar") || container;
    const barRect = barEl.getBoundingClientRect();
    const btnRect = item.getBoundingClientRect();
    const rootRect = hostRoot.getBoundingClientRect();
    const cardWidth = card.offsetWidth || card.getBoundingClientRect().width || 232;
    const cardHeight = card.offsetHeight || card.getBoundingClientRect().height || 84;
    const rootWidth = rootRect.width || hostRoot.offsetWidth || 1000;

    const left = Math.round(
      Math.max(
        8,
        Math.min(
          rootWidth - cardWidth - 8,
          btnRect.left - rootRect.left + btnRect.width / 2 - cardWidth / 2,
        ),
      ),
    );
    const top = isBottombar
      ? Math.round(barRect.top - rootRect.top - cardHeight - 8)
      : Math.round(barRect.bottom - rootRect.top + 8);

    card.style.setProperty("position", "absolute");
    card.style.setProperty("left", `${left}px`);
    card.style.setProperty("top", `${top}px`);
    card.style.position = "absolute";
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;

    activeCard = card;
  }

  function updateHover(target: EventTarget | null) {
    if (!(target instanceof Element)) {
      suppressedItem = null;
      hideHover();
      return;
    }

    const item = target.closest(itemSelector) as HTMLElement | null;
    if (!item || !container.contains(item) || isAnyPopupOpen(hostRoot, item)) {
      if (!item || !container.contains(item)) {
        suppressedItem = null;
      }
      hideHover();
      return;
    }

    if (suppressedItem && suppressedItem !== item) {
      suppressedItem = null;
    }

    if (item === activeTarget && container.hasAttribute("data-chrome-visible")) {
      if (!activeCard && item !== suppressedItem) {
        showCardForItem(item);
      }
      return;
    }

    const isMoving = container.hasAttribute("data-chrome-visible");
    const iRect = item.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();

    if (isMoving) {
      container.setAttribute("data-chrome-moving", "");
    } else {
      container.removeAttribute("data-chrome-moving");
    }

    const x = iRect.left - cRect.left - container.clientLeft + container.scrollLeft;
    const y = iRect.top - cRect.top - container.clientTop + container.scrollTop;

    container.style.setProperty("--chrome-x", `${x}px`);
    container.style.setProperty("--chrome-y", `${y}px`);
    container.style.setProperty("--chrome-w", `${iRect.width}px`);
    container.style.setProperty("--chrome-h", `${iRect.height}px`);
    container.setAttribute("data-chrome-visible", "");

    activeTarget = item;
    if (item !== suppressedItem) {
      showCardForItem(item);
    } else {
      hideCard();
    }
  }

  function bindItem(item: HTMLElement) {
    if (boundItems.has(item) || item.getAttribute("data-vela-chart-card-bound") === "1") return;
    boundItems.add(item);
    item.setAttribute("data-vela-chart-card-bound", "1");
    if ((item as any).dataset) {
      (item as any).dataset.velaChartCardBound = "1";
    }
    stripButtonTitle(item);

    const onEnter = (e?: PointerEvent) => {
      if (e && e.pointerType === "touch") return;
      if (suppressedItem === item) {
        suppressedItem = null;
      }
      updateHover(item);
    };
    const onLeave = () => {
      if (suppressedItem === item) {
        suppressedItem = null;
      }
      if (activeTarget === item) {
        hideHover();
      }
    };
    const onDown = () => {
      suppressedItem = item;
      hideCard();
    };

    item.addEventListener("pointerenter", onEnter as EventListener);
    item.addEventListener("mouseenter", onEnter as EventListener);
    item.addEventListener("pointerleave", onLeave);
    item.addEventListener("mouseleave", onLeave);
    item.addEventListener("pointerdown", onDown);
    item.addEventListener("click", onDown);

    boundCleanups.push(() => {
      item.removeEventListener("pointerenter", onEnter as EventListener);
      item.removeEventListener("mouseenter", onEnter as EventListener);
      item.removeEventListener("pointerleave", onLeave);
      item.removeEventListener("mouseleave", onLeave);
      item.removeEventListener("pointerdown", onDown);
      item.removeEventListener("click", onDown);
      item.removeAttribute("data-vela-chart-card-bound");
      if ((item as any).dataset) {
        delete (item as any).dataset.velaChartCardBound;
      }
      boundItems.delete(item);
    });
  }

  function bindAllItems() {
    const buttons = container.querySelectorAll<HTMLElement>("button");
    for (const btn of Array.from(buttons)) {
      bindItem(btn);
    }
    const widgets = container.querySelectorAll<HTMLElement>(
      ".vela-widget-tf, .vela-widget-tf-caret, .vela-widget-symbol, .vela-widget-style, .vela-widget-indicators, .vela-widget-action, .vela-bb-range",
    );
    for (const w of Array.from(widgets)) {
      bindItem(w);
    }
    const symBtn = container.querySelector<HTMLElement>(".vela-widget-symbol");
    if (symBtn) {
      ensureSymbolSearchIcon(symBtn);
    }
  }

  bindAllItems();

  function onPointerMove(e: PointerEvent) {
    if (e.pointerType !== "touch") {
      updateHover(e.target);
    }
  }

  function onPointerLeave(e: PointerEvent) {
    if (!e.relatedTarget || !container.contains(e.relatedTarget as Node)) {
      suppressedItem = null;
      hideHover();
    }
  }

  function onContainerPointerDown(e: Event) {
    const target = e.target;
    if (target instanceof Element) {
      const item = target.closest(itemSelector) as HTMLElement | null;
      if (item && container.contains(item)) {
        suppressedItem = item;
      }
    }
    hideCard();
  }

  function onDocPointerDown() {
    hideCard();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      hideCard();
    }
  }

  container.addEventListener("pointermove", onPointerMove, { passive: true });
  container.addEventListener("pointerleave", onPointerLeave, { passive: true });
  container.addEventListener("pointerdown", onContainerPointerDown, true);
  container.addEventListener("click", onContainerPointerDown, { passive: true });
  doc.addEventListener?.("pointerdown", onDocPointerDown, true);
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", onKeyDown);
  }

  const rootObserver = new MutationObserver(() => {
    stripAllTitlesInContainer(container);
    bindAllItems();
    const symBtn = container.querySelector<HTMLElement>(".vela-widget-symbol");
    if (symBtn) {
      ensureSymbolSearchIcon(symBtn);
    }
    if (activeTarget instanceof HTMLElement && isAnyPopupOpen(hostRoot, activeTarget)) {
      hideHover();
    }
  });
  rootObserver.observe(hostRoot, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-expanded", "data-state", "data-quant-open", "hidden"],
  });

  const cleanupBottombarJoin = enhanceVelaBottombarJoin(container);

  return () => {
    hideHover();
    rootObserver.disconnect();
    while (boundCleanups.length > 0) {
      const cleanupItem = boundCleanups.pop();
      cleanupItem?.();
    }
    cleanupBottombarJoin();
    container.classList.remove("quant-chrome-hover");
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerleave", onPointerLeave);
    container.removeEventListener("pointerdown", onContainerPointerDown, true);
    container.removeEventListener("click", onContainerPointerDown);
    doc.removeEventListener?.("pointerdown", onDocPointerDown, true);
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", onKeyDown);
    }
  };
}

