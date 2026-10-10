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
import { VELA_ICONS } from "./vela-icons";

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
    iconSvg: VELA_ICONS.candles,
  },
  {
    id: "bars",
    label: "Bars",
    iconSvg: VELA_ICONS.bars,
  },
  {
    id: "line",
    label: "Line",
    iconSvg: VELA_ICONS.line,
  },
  {
    id: "area",
    label: "Area",
    iconSvg: VELA_ICONS.area,
  },
  {
    id: "baseline",
    label: "Baseline",
    iconSvg: VELA_ICONS.baseline,
  },
  {
    id: "heikinashi",
    label: "Heikin Ashi",
    iconSvg: VELA_ICONS.heikinAshi,
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
