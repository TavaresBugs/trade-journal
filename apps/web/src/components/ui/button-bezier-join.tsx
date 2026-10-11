"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

export interface ButtonBezierGeometryInput {
  width: number;
  height: number;
  triggerOffsetLeft: number;
  triggerWidth: number;
  radius?: number;
}

export interface ButtonBezierGeometryResult {
  M: number;
  P: number;
  viewBox: string;
  dEdge: string;
  dFill: string;
}

/**
 * Official Vela Select Field Join formula (from vela-bezier-select.tsx / chunk 3bk-6pmml3oum.js),
 * extended with exact horizontal mirror support for right-aligned triggers (`align="end"`).
 *
 * Strictly bounded within `0..M` and `0..P` (`inset: 0`), welding the independent button trigger
 * directly to the dropdown/popover body with zero topbar dependency.
 */
export function computeButtonBezierGeometry({
  width,
  height,
  triggerOffsetLeft,
  triggerWidth,
  radius = 10,
}: ButtonBezierGeometryInput): ButtonBezierGeometryResult {
  const M = Math.max(24, Math.round(width));
  const P = Math.max(24, Math.round(height));
  const R = Math.max(4, Math.min(radius, Math.floor(M / 2) - 2, Math.floor(P / 2) - 2));
  const r = R + 0.5;

  const tLeft = Math.max(0, Math.min(M, Math.round(triggerOffsetLeft)));
  const tW = Math.max(16, Math.min(M, Math.round(triggerWidth)));
  const tRight = Math.min(M, tLeft + tW);

  const leftGap = tLeft;
  const rightGap = M - tRight;

  const isFlushLeft = leftGap <= 3;
  const isFlushRight = rightGap <= 3;

  let dEdge: string;
  let dFill: string;

  if (isFlushLeft && isFlushRight) {
    // Symmetric: trigger width matches popup width
    dEdge = `M 0.5 0 V ${P - r} Q 0.5 ${P - 0.5} ${r} ${P - 0.5} H ${M - r} Q ${M - 0.5} ${P - 0.5} ${M - 0.5} ${P - r} V 0`;
    dFill = `${dEdge} Z`;
  } else if (isFlushLeft) {
    // Left-aligned Select Join (same as VelaBezierSelect: trigger on top-left, width tW)
    const N = Math.max(0, M - tW);
    const joinX = Math.max(r, tW - 0.5);
    dEdge = `M 0.5 0 V ${P - r} Q 0.5 ${P - 0.5} ${r} ${P - 0.5} H ${M - r} Q ${M - 0.5} ${P - 0.5} ${M - 0.5} ${P - r} ${
      N > 3
        ? `V ${r} Q ${M - 0.5} 0.5 ${M - r} 0.5 H ${joinX}`
        : "V 0"
    }`;
    dFill = `${dEdge} L ${joinX} 0 L 0.5 0 Z`;
  } else if (isFlushRight) {
    // Right-aligned Select Join (mirror of VelaBezierSelect: trigger on top-right, starting at tLeft)
    const joinX = Math.min(M - r, tLeft + 0.5);
    dEdge = `${
      leftGap > 3
        ? `M ${joinX} 0.5 H ${r} Q 0.5 0.5 0.5 ${r}`
        : `M 0.5 0`
    } V ${P - r} Q 0.5 ${P - 0.5} ${r} ${P - 0.5} H ${M - r} Q ${M - 0.5} ${P - 0.5} ${M - 0.5} ${P - r} V 0`;
    dFill = `${dEdge} L ${leftGap > 3 ? joinX : 0.5} 0 Z`;
  } else {
    // Bilateral offset (trigger inside both left and right bounds)
    const joinLeft = Math.max(r, tLeft + 0.5);
    const joinRight = Math.min(M - r, tRight - 0.5);
    dEdge = `M ${joinLeft} 0.5 H ${r} Q 0.5 0.5 0.5 ${r} V ${P - r} Q 0.5 ${P - 0.5} ${r} ${P - 0.5} H ${M - r} Q ${M - 0.5} ${P - 0.5} ${M - 0.5} ${P - r} V ${r} Q ${M - 0.5} 0.5 ${M - r} 0.5 H ${joinRight}`;
    dFill = `${dEdge} L ${joinRight} 0 L ${joinLeft} 0 Z`;
  }

  return {
    M,
    P,
    viewBox: `0 0 ${M} ${P}`,
    dEdge,
    dFill,
  };
}

export interface ButtonBezierOutlineProps {
  triggerRef: RefObject<HTMLElement | null>;
  radius?: number;
  alignFallback?: "start" | "end";
  defaultWidth?: number;
  defaultHeight?: number;
}

/**
 * Renders the Vela Select-style SVG Join background layer inside a Radix Popover or DropdownMenu.
 * Discovers its host panel via `layerRef.current.parentElement` so it never suffers from
 * parent forwardRef timing races on mount.
 */
export function ButtonBezierOutline({
  triggerRef,
  radius = 12,
  alignFallback = "start",
  defaultWidth = 240,
  defaultHeight = 200,
}: ButtonBezierOutlineProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fillRef = useRef<SVGPathElement>(null);
  const edgeRef = useRef<SVGPathElement>(null);

  const [initialGeo] = useState(() =>
    computeButtonBezierGeometry({
      width: defaultWidth,
      height: defaultHeight,
      triggerOffsetLeft: alignFallback === "end" ? defaultWidth - 105 : 0,
      triggerWidth: 105,
      radius,
    }),
  );

  useLayoutEffect(() => {
    const layer = layerRef.current;
    const popup = layer?.parentElement;
    const trigger = triggerRef.current;
    const svg = svgRef.current;
    const fill = fillRef.current;
    const edge = edgeRef.current;
    if (!popup || !svg || !fill || !edge) return;

    const update = () => {
      const pRect = popup.getBoundingClientRect();
      const W = Math.round(pRect.width) || popup.offsetWidth || defaultWidth;
      const H = Math.round(pRect.height) || popup.offsetHeight || defaultHeight;

      const tRect = trigger?.getBoundingClientRect();
      const triggerWidth =
        tRect && tRect.width > 0
          ? Math.round(tRect.width)
          : trigger?.offsetWidth || 105;

      let triggerOffsetLeft = alignFallback === "end" ? Math.max(0, W - triggerWidth) : 0;

      if (tRect && pRect.width > 0) {
        const rawDelta = Math.round(tRect.left - pRect.left);
        // Use measured horizontal offset once Popper has positioned the menu near the trigger
        if (Math.abs(pRect.top - tRect.bottom) < 24 && rawDelta >= -4 && rawDelta <= W) {
          triggerOffsetLeft = Math.max(0, Math.min(W - triggerWidth, rawDelta));
        }
      }

      const geo = computeButtonBezierGeometry({
        width: W,
        height: H,
        triggerOffsetLeft,
        triggerWidth,
        radius,
      });

      svg.setAttribute("viewBox", geo.viewBox);
      fill.setAttribute("d", geo.dFill);
      edge.setAttribute("d", geo.dEdge);
    };

    update();
    const rafId = requestAnimationFrame(update);

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(popup);
    if (trigger) ro?.observe(trigger);

    const popperWrapper = popup.closest("[data-radix-popper-content-wrapper]");
    const mo =
      popperWrapper && typeof MutationObserver !== "undefined"
        ? new MutationObserver(update)
        : null;
    if (popperWrapper && mo) {
      mo.observe(popperWrapper, { attributes: true, attributeFilter: ["style"] });
    }

    window.addEventListener("resize", update, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      ro?.disconnect();
      mo?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [triggerRef, radius, alignFallback, defaultWidth, defaultHeight]);

  return (
    <div
      ref={layerRef}
      className="journal-bezier-join"
      aria-hidden="true"
      data-side="below"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <svg
        ref={svgRef}
        viewBox={initialGeo.viewBox}
        className="journal-bezier-outline"
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          overflow: "visible",
        }}
      >
        <path ref={fillRef} className="journal-bezier-outline-fill" d={initialGeo.dFill} />
        <path ref={edgeRef} className="journal-bezier-outline-edge" d={initialGeo.dEdge} />
      </svg>
    </div>
  );
}
