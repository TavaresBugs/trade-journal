/**
 * Official Vela Chart Style Picker with Natural Bézier Join
 * Supports: Candles, Bars, Line, Area, Baseline, Heikin Ashi, Footprint, TPO.
 * Replicates the organic Bézier outline, active checked state, badges,
 * and solid #151619 background styling.
 */

import {
  createChromeJoinOutline,
  positionChromePopup,
  setChromeTriggerState,
  ChromeJoinInstance,
} from "./vela-chrome-join";

export interface StylePickerOptions {
  container: HTMLElement;
  currentStyle: string;
  onSelectStyle: (style: string) => void;
}

export interface StyleDef {
  id: string;
  label: string;
  iconSvg: string;
}

export const STYLES: StyleDef[] = [
  {
    id: "candles",
    label: "Candles",
    iconSvg: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 2v2M4.5 12v2M11.5 2v1.5M11.5 11v3"></path><rect x="2.8" y="4" width="3.4" height="8" rx="0.6" fill="currentColor" fill-opacity="0.25"></rect><rect x="9.8" y="3.5" width="3.4" height="7.5" rx="0.6" fill="currentColor"></rect></svg>`,
  },
  {
    id: "bars",
    label: "Bars",
    iconSvg: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 2.5v11M2.5 5h2M4.5 11h2"></path><path d="M11.5 2.5v11M9.5 4.5h2M11.5 10.5h2"></path></svg>`,
  },
  {
    id: "line",
    label: "Line",
    iconSvg: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 11.5 5.5 7l3 2.5 5-6"></path></svg>`,
  },
  {
    id: "area",
    label: "Area",
    iconSvg: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 11.5 5.5 7l3 2.5 5-6"></path><path d="M1.5 11.5 5.5 7l3 2.5 5-6V13.5h-12z" fill="currentColor" fill-opacity="0.25" stroke="none"></path></svg>`,
  },
  {
    id: "baseline",
    label: "Baseline",
    iconSvg: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8h13" stroke-dasharray="2 2"></path><path d="M2.5 8 5.25 4.5 8 8h-5.5z" fill="currentColor" fill-opacity="0.25" stroke="none"></path><path d="M2.5 8 5.25 4.5 8 8"></path><path d="M8 8l2.75 3.5L13.5 8h-5.5z" fill="currentColor" fill-opacity="0.25" stroke="none"></path><path d="M8 8l2.75 3.5L13.5 8"></path></svg>`,
  },
  {
    id: "heikinashi",
    label: "Heikin Ashi",
    iconSvg: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12v2M11.5 2v2"></path><rect x="2.8" y="5" width="3.4" height="7" rx="0.6" fill="currentColor" fill-opacity="0.25"></rect><rect x="9.8" y="4" width="3.4" height="7" rx="0.6" fill="currentColor"></rect></svg>`,
  },
];

export const VELA_CHART_STYLE_OPTIONS = STYLES.map((s) => ({
  value: s.id,
  label: s.label,
  iconSvg: s.iconSvg,
}));

export function attachVelaStylePicker(opts: StylePickerOptions): () => void {
  const { container } = opts;
  let currentStyle = opts.currentStyle;
  let activePopup: HTMLElement | null = null;
  let styleBtnEl: HTMLElement | null = null;
  let joinOutline: ChromeJoinInstance | null = null;
  let onWindowResize: (() => void) | null = null;

  function findStyleBtn(): HTMLElement | null {
    return container.querySelector<HTMLElement>(".vela-widget-style, #vela-topbar-style");
  }

  function closePopup() {
    if (onWindowResize) {
      window.removeEventListener("resize", onWindowResize);
      onWindowResize = null;
    }
    if (joinOutline) {
      joinOutline.destroy();
      joinOutline = null;
    }
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
    if (styleBtnEl) {
      setChromeTriggerState(styleBtnEl, false);
    }
    document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    document.removeEventListener("keydown", handleKeydown, true);
  }

  function handleOutsidePointerDown(e: PointerEvent) {
    if (!activePopup) return;
    const target = e.target as Node;
    if (activePopup.contains(target) || styleBtnEl?.contains(target)) return;
    closePopup();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      closePopup();
    }
  }

  function openPopup() {
    styleBtnEl = findStyleBtn();
    if (!styleBtnEl) return;
    if (activePopup) {
      closePopup();
      return;
    }

    setChromeTriggerState(styleBtnEl, true);

    const chartCard = container.closest<HTMLElement>(".vela-ui") || container.parentElement || document.body;

    const popup = document.createElement("div");
    popup.className = "quant-style-popup quant-chrome-menu";
    popup.setAttribute("role", "menu");
    popup.setAttribute("aria-label", "Chart Style");

    const ul = document.createElement("ul");
    ul.className = "quant-style-list";

    for (const style of STYLES) {
      const li = document.createElement("li");
      li.className = "quant-style-row quant-chrome-hover-row";
      li.dataset.veiId = style.id;
      if (style.id === currentStyle) {
        li.dataset.checked = "1";
      }

      const iconSpan = document.createElement("span");
      iconSpan.className = "quant-style-badge";
      iconSpan.innerHTML = style.iconSvg;

      const labelSpan = document.createElement("span");
      labelSpan.className = "quant-style-label";
      labelSpan.textContent = style.label;

      li.append(iconSpan, labelSpan);

      li.addEventListener("click", (e) => {
        e.stopPropagation();
        currentStyle = style.id;
        opts.onSelectStyle(style.id);
        closePopup();
      });

      ul.appendChild(li);
    }

    popup.appendChild(ul);
    chartCard.appendChild(popup);
    activePopup = popup;

    positionChromePopup(popup, styleBtnEl, chartCard);
    joinOutline = createChromeJoinOutline(popup, { shoulder: 16, radius: 10 });

    onWindowResize = () => {
      if (!activePopup || !styleBtnEl) return;
      positionChromePopup(activePopup, styleBtnEl, chartCard);
      joinOutline?.update();
    };
    window.addEventListener("resize", onWindowResize, { passive: true });

    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    document.addEventListener("keydown", handleKeydown, true);
  }

  function onPointerDown(e: PointerEvent) {
    const target = e.target as Element | null;
    const btn = target?.closest<HTMLElement>(".vela-widget-style, #vela-topbar-style");
    if (!btn || !container.contains(btn)) return;

    if (e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (activePopup) {
        closePopup();
      } else {
        openPopup();
      }
    }
  }

  function onClick(e: MouseEvent) {
    const target = e.target as Element | null;
    const btn = target?.closest<HTMLElement>(".vela-widget-style, #vela-topbar-style");
    if (!btn || !container.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  container.addEventListener("pointerdown", onPointerDown, true);
  container.addEventListener("click", onClick, true);

  return () => {
    closePopup();
    container.removeEventListener("pointerdown", onPointerDown, true);
    container.removeEventListener("click", onClick, true);
  };
}
