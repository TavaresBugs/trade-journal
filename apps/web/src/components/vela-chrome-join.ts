/**
 * Official Vela Natural Bézier Chrome Join System
 * Generates the seamless organic Bézier outline and flush connection
 * bridging Topbar buttons to dropdown menus and popups in solid #151619.
 */

export interface ChromeJoinOptions {
  shoulder?: number; // width of the concave curve wing (default: 16 for unconstrained, 8 for unified)
  radius?: number; // corner radius (default: 10 for unconstrained, 6 for unified)
  fillColor?: string; // fill color (default: #151619)
  strokeColor?: string; // stroke color (default: #34353b)
  triggerElement?: HTMLElement;
  clampToBounds?: boolean;
  unifiedEnvelope?: boolean;
  triggerHeight?: number; // height of trigger button (default: 29)
}

export interface ChromeJoinInstance {
  svg: SVGSVGElement;
  pathFill: SVGPathElement;
  pathEdge: SVGPathElement;
  update: () => void;
  destroy: () => void;
}

export interface ChromeJoinGeometry {
  totalW: number;
  totalH?: number;
  viewBox: string;
  dEdge: string;
  dFill: string;
  svgStyle: {
    left: string;
    width: string;
    top?: string;
    height?: string;
    clipPath?: string;
  };
}

/**
 * Computes exact Bézier outline geometry and path definitions.
 * When clampToBounds or unifiedEnvelope is true, creates a unified enclosing envelope
 * bridging trigger button to popup with zero horizontal dividing seams.
 */
export function computeChromeJoinGeometry(
  width: number,
  height: number,
  options?: {
    shoulder?: number;
    radius?: number;
    clampToBounds?: boolean;
    triggerOffsetLeft?: number;
    triggerWidth?: number;
    triggerHeight?: number;
    unifiedEnvelope?: boolean;
  }
): ChromeJoinGeometry {
  const W = Math.max(1, width || 180);
  const H = Math.max(1, height || 220);
  const clampToBounds = options?.clampToBounds ?? false;
  const unifiedEnvelope = options?.unifiedEnvelope ?? clampToBounds;

  if (clampToBounds || unifiedEnvelope) {
    const totalW = W;
    const totalH = H;
    const triggerOffsetLeft = options?.triggerOffsetLeft ?? 0;
    const triggerWidth = options?.triggerWidth ?? totalW;
    const S = options?.shoulder ?? 8;
    const R = Math.min(options?.radius ?? 6, Math.floor(totalW / 2), Math.floor(totalH / 2));

    const tLeft = Math.max(0, Math.min(totalW, triggerOffsetLeft));
    const tW = Math.max(0, Math.min(totalW, triggerWidth));
    const viewBox = `0 0 ${totalW} ${totalH}`;

    let dEdge: string;
    let dFill: string;

    if (tW === totalW || tW >= totalW) {
      // Formula 2.2 (Symmetric join: triggerWidth === totalW)
      // Left, bottom, and right edges with open top at y = 0
      dEdge = `M 0.5 0 V ${totalH - R - 0.5} Q 0.5 ${totalH - 0.5} ${R + 0.5} ${totalH - 0.5} H ${totalW - R - 0.5} Q ${totalW - 0.5} ${totalH - 0.5} ${totalW - 0.5} ${totalH - R - 0.5} V 0`;
      dFill = `${dEdge} Z`;
    } else if (tLeft === 0 && tW < totalW) {
      // Official LuxAlgo Vela Formula for Select Field Join (from chunk 3bk-6pmml3oum.js):
      // D = M 0.5 0 V ${P - 7} Q 0.5 ${P - .5} 7 ${P - .5} H ${M - 7} Q ${M - .5} ${P - .5} ${M - .5} ${P - 7} ${N > 3 ? `V 7 Q ${M - .5} 0.5 ${M - 7} 0.5 H ${Math.max(7, A.width)}` : "V 0"}
      const N = totalW - tW;
      const cornerR = R > 0 ? R : 6.5;
      const rOffset = cornerR + 0.5; // e.g. 6.5 + 0.5 = 7
      dEdge = `M 0.5 0 V ${totalH - rOffset} Q 0.5 ${totalH - 0.5} ${rOffset} ${totalH - 0.5} H ${totalW - rOffset} Q ${totalW - 0.5} ${totalH - 0.5} ${totalW - 0.5} ${totalH - rOffset} ${
        N > 3
          ? `V ${rOffset} Q ${totalW - 0.5} 0.5 ${totalW - rOffset} 0.5 H ${Math.max(rOffset, tW)}`
          : "V 0"
      }`;
      dFill = `${dEdge} Z`;
    } else if (tLeft > 0 && tLeft + tW < totalW) {
      // Formula 2.4 (Bilateral Bézier Join: popup is wider than trigger on both sides)
      const tRight = tLeft + tW;
      const S_clamped = Math.min(S, tLeft, totalW - tRight);
      dEdge = `M ${tRight} 0 Q ${tRight} ${S_clamped} ${tRight + S_clamped} ${S_clamped} H ${totalW - R - 0.5} Q ${totalW - 0.5} ${S_clamped} ${totalW - 0.5} ${S_clamped + R} V ${totalH - R - 0.5} Q ${totalW - 0.5} ${totalH - 0.5} ${totalW - R - 0.5} ${totalH - 0.5} H ${R + 0.5} Q 0.5 ${totalH - 0.5} 0.5 ${totalH - R - 0.5} V ${S_clamped + R} Q 0.5 ${S_clamped} ${R + 0.5} ${S_clamped} H ${tLeft - S_clamped} Q ${tLeft} ${S_clamped} ${tLeft} 0`;
      dFill = `${dEdge} H ${tRight} Z`;
    } else {
      // General offset clamped join
      const tRight = Math.min(totalW, tLeft + tW);
      const cornerR = R > 0 ? R : 6.5;
      const rOffset = cornerR + 0.5;
      dEdge = `M 0.5 0 V ${totalH - rOffset} Q 0.5 ${totalH - 0.5} ${rOffset} ${totalH - 0.5} H ${totalW - rOffset} Q ${totalW - 0.5} ${totalH - 0.5} ${totalW - 0.5} ${totalH - rOffset} V ${rOffset} Q ${totalW - 0.5} 0.5 ${totalW - rOffset} 0.5 H ${Math.max(rOffset, tRight)}`;
      dFill = `${dEdge} Z`;
    }

    return {
      totalW,
      totalH,
      viewBox,
      dEdge,
      dFill,
      svgStyle: {
        left: "0px",
        top: "0px",
        width: "100%",
        height: "100%",
        clipPath: "none",
      },
    };
  }

  // Formula 2.3: Classic unconstrained topbar join with fixed shoulders S = 16
  const S = options?.shoulder ?? 16;
  const R = Math.min(options?.radius ?? 10, Math.floor(W / 2), Math.floor(H / 2));
  const totalW = W + 2 * S;
  const viewBox = `0 -2 ${totalW} ${H + 2}`;
  const dEdge = `M 0 0.5 Q ${S} 0.5 ${S} ${S + 0.5} V ${H - R - 0.5} Q ${S} ${H - 0.5} ${S + R} ${H - 0.5} H ${totalW - S - R} Q ${totalW - S} ${H - 0.5} ${totalW - S} ${H - R - 0.5} V ${S + 0.5} Q ${totalW - S} 0.5 ${totalW} 0.5`;
  const dFill = `${dEdge} L ${totalW} -2 L 0 -2 Z`;

  return {
    totalW,
    viewBox,
    dEdge,
    dFill,
    svgStyle: {
      left: `-${S}px`,
      width: `calc(100% + ${2 * S}px)`,
    },
  };
}

/**
 * Creates and attaches an SVG Bézier outline behind a popup or menu element.
 */
export function createChromeJoinOutline(
  popup: HTMLElement,
  options?: ChromeJoinOptions
): ChromeJoinInstance {
  if (typeof document === "undefined") {
    return {
      svg: undefined as unknown as SVGSVGElement,
      pathFill: undefined as unknown as SVGPathElement,
      pathEdge: undefined as unknown as SVGPathElement,
      update: () => {},
      destroy: () => {},
    };
  }

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.classList.add("quant-chrome-outline");
  svg.setAttribute("aria-hidden", "true");

  const pathFill = document.createElementNS(NS, "path");
  pathFill.classList.add("quant-chrome-outline-fill");

  const pathEdge = document.createElementNS(NS, "path");
  pathEdge.classList.add("quant-chrome-outline-edge");

  svg.append(pathFill, pathEdge);
  popup.prepend(svg);

  const clampToBounds = options?.clampToBounds ?? false;
  const unifiedEnvelope = options?.unifiedEnvelope ?? clampToBounds;
  const shoulder = options?.shoulder ?? (unifiedEnvelope ? 8 : 16);
  const radius = options?.radius ?? (unifiedEnvelope ? 6 : 10);
  const fillColor = options?.fillColor ?? "#151619";
  const strokeColor = options?.strokeColor ?? "#34353b";
  const triggerHeight = options?.triggerHeight ?? 29;
  const trigger = options?.triggerElement;

  pathFill.style.fill = fillColor;
  pathEdge.style.stroke = strokeColor;
  pathEdge.style.strokeWidth = "1px";
  pathEdge.style.fill = "none";

  if (clampToBounds || unifiedEnvelope) {
    svg.dataset.quantClamped = "1";
    svg.style.left = "0px";
    svg.style.top = "0px";
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.clipPath = "none";
    svg.style.filter = "none";
    svg.style.boxShadow = "none";
  }

  const update = () => {
    const W = popup.offsetWidth || 180;
    const H = popup.offsetHeight || 220;

    let triggerOffsetLeft = 0;
    let triggerWidth = W;

    if (trigger) {
      if (typeof trigger.getBoundingClientRect === "function" && typeof popup.getBoundingClientRect === "function") {
        const tRect = trigger.getBoundingClientRect();
        const pRect = popup.getBoundingClientRect();
        if (tRect.width > 0) {
          triggerOffsetLeft = Math.round(tRect.left - pRect.left);
          triggerWidth = Math.round(tRect.width);
        } else if (trigger.offsetWidth > 0) {
          triggerOffsetLeft = trigger.offsetLeft - popup.offsetLeft;
          triggerWidth = trigger.offsetWidth;
        }
      } else if (trigger.offsetWidth > 0) {
        triggerOffsetLeft = trigger.offsetLeft - popup.offsetLeft;
        triggerWidth = trigger.offsetWidth;
      }
    }

    const geo = computeChromeJoinGeometry(W, H, {
      shoulder,
      radius,
      clampToBounds,
      unifiedEnvelope,
      triggerOffsetLeft,
      triggerWidth,
      triggerHeight,
    });

    svg.setAttribute("viewBox", geo.viewBox);
    pathFill.setAttribute("d", geo.dFill);
    pathEdge.setAttribute("d", geo.dEdge);

    if (geo.svgStyle) {
      if (geo.svgStyle.left) svg.style.left = geo.svgStyle.left;
      if (geo.svgStyle.width) svg.style.width = geo.svgStyle.width;
      if (geo.svgStyle.top) svg.style.top = geo.svgStyle.top;
      if (geo.svgStyle.height) svg.style.height = geo.svgStyle.height;
      if (geo.svgStyle.clipPath) svg.style.clipPath = geo.svgStyle.clipPath;
    }
  };

  update();
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
  if (ro) {
    ro.observe(popup);
    if (trigger) {
      ro.observe(trigger);
    }
  }

  return {
    svg,
    pathFill,
    pathEdge,
    update,
    destroy: () => {
      ro?.disconnect();
      svg.remove();
    },
  };
}

/**
 * Positions a popup flush against the bottom border of the topbar row
 * aligned with its trigger button.
 */
export function positionChromePopup(
  popup: HTMLElement,
  trigger: HTMLElement,
  container: HTMLElement,
  options?: { minMargin?: number }
): void {
  const topbarRow = trigger.closest<HTMLElement>(".border-b") || trigger.closest<HTMLElement>(".vela-widget-topbar") || container;
  const triggerRect = trigger.getBoundingClientRect();
  const cardRect = container.getBoundingClientRect();

  popup.style.position = "absolute";
  const topbarHeight = topbarRow.offsetHeight || 39;
  popup.style.top = `${topbarHeight - 1}px`;

  const idealLeft = Math.round(triggerRect.left - cardRect.left - 1);
  const minMargin = options?.minMargin ?? 8;
  const maxLeft = Math.max(minMargin, (container.offsetWidth || cardRect.width) - popup.offsetWidth - minMargin);
  popup.style.left = `${Math.max(minMargin, Math.min(maxLeft, idealLeft))}px`;
  popup.style.zIndex = "50";
}

/**
 * Sets trigger open state attributes for seamless physical bridge into popup.
 */
export function setChromeTriggerState(trigger: HTMLElement, isOpen: boolean): void {
  if (isOpen) {
    trigger.dataset.quantOpen = "1";
    trigger.setAttribute("aria-expanded", "true");
  } else {
    delete trigger.dataset.quantOpen;
    trigger.setAttribute("aria-expanded", "false");
  }
}
