/**
 * Native Vela Natural Bézier Chrome Join System & Canonical Icons
 * Generates the seamless organic Bézier outline and flush connection
 * bridging Topbar buttons to dropdown menus and popups in solid #151619.
 */

export const VELA_NATIVE_ICONS = {
  search: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" class="opacity-70 shrink-0"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3.5 3.5" /></svg>`,
  sliders: `<svg viewBox="0 0 20 20" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v14m5-14v14m5-14v14M3 7h4m1 6h4m1-8h4"/></svg>`,
  copyPrice: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/></svg>`,
  camera: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 4 6.5 2.5h3L10.5 4h3A1 1 0 0 1 14.5 5v7.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"></path><circle cx="8" cy="8.5" r="2.6"></circle></svg>`,
  layoutGrid: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="1.5" width="13" height="13" rx="1.5"></rect><path d="M8 1.5v13M1.5 8h13"></path></svg>`,
  gripSixDots: `<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="6" cy="3.5" r="1.1"/><circle cx="10" cy="3.5" r="1.1"/><circle cx="6" cy="8" r="1.1"/><circle cx="10" cy="8" r="1.1"/><circle cx="6" cy="12.5" r="1.1"/><circle cx="10" cy="12.5" r="1.1"/></svg>`,
  candles: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 2v2M4.5 12v2M11.5 2v1.5M11.5 11v3"></path><rect x="2.8" y="4" width="3.4" height="8" rx="0.6" fill="currentColor" fill-opacity="0.25"></rect><rect x="9.8" y="3.5" width="3.4" height="7.5" rx="0.6" fill="currentColor"></rect></svg>`,
  bars: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 2.5v11M2.5 5h2M4.5 11h2"></path><path d="M11.5 2.5v11M9.5 4.5h2M11.5 10.5h2"></path></svg>`,
  line: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 11.5 5.5 7l3 2.5 5-6"></path></svg>`,
  area: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 11.5 5.5 7l3 2.5 5-6"></path><path d="M1.5 11.5 5.5 7l3 2.5 5-6V13.5h-12z" fill="currentColor" fill-opacity="0.25" stroke="none"></path></svg>`,
  baseline: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8h13" stroke-dasharray="2 2"></path><path d="M2.5 8 5.25 4.5 8 8h-5.5z" fill="currentColor" fill-opacity="0.25" stroke="none"></path><path d="M2.5 8 5.25 4.5 8 8"></path><path d="M8 8l2.75 3.5L13.5 8h-5.5z" fill="currentColor" fill-opacity="0.25" stroke="none"></path><path d="M8 8l2.75 3.5L13.5 8"></path></svg>`,
  heikinAshi: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12v2M11.5 2v2"></path><rect x="2.8" y="5" width="3.4" height="7" rx="0.6" fill="currentColor" fill-opacity="0.25"></rect><rect x="9.8" y="4" width="3.4" height="7" rx="0.6" fill="currentColor"></rect></svg>`,
  heikinashi: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12v2M11.5 2v2"></path><rect x="2.8" y="5" width="3.4" height="7" rx="0.6" fill="currentColor" fill-opacity="0.25"></rect><rect x="9.8" y="4" width="3.4" height="7" rx="0.6" fill="currentColor"></rect></svg>`,
  star: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2l1.75 3.55 3.9.55-2.8 2.75.65 3.9L8 11.1l-3.5 1.85.65-3.9-2.8-2.75 3.9-.55z"></path></svg>`,
  starOutline: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2l1.75 3.55 3.9.55-2.8 2.75.65 3.9L8 11.1l-3.5 1.85.65-3.9-2.8-2.75 3.9-.55z"></path></svg>`,
  clock: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"></circle><path d="M8 4.5v3.5l2.5 1.5"></path></svg>`,
  plus: `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"><path d="M5 2v6M2 5h6"/></svg>`,
  checkmark: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2.8 8.4 3.4 3.4 7-7.6"/></svg>`,
  download: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download size-4 shrink-0"><path d="M12 15V3"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path></svg>`,
  clipboard: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy size-4 shrink-0"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`,
  crop: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-scan size-4 shrink-0"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path></svg>`,
  Sliders: `<svg viewBox="0 0 20 20" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v14m5-14v14m5-14v14M3 7h4m1 6h4m1-8h4"/></svg>`,
  tradingDown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="5.07 6.35 18 18" width="1em" height="1em" fill="none"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M19.9792 12.2892C19.7396 12.0142 19.3241 11.9812 19.044 12.2149L14.3924 16.098L14.072 16.3655L13.7516 16.098L9.10009 12.2149C8.82008 11.9812 8.40456 12.0142 8.16495 12.2892C7.92467 12.565 7.94981 12.9825 8.22144 13.2275L14.0721 18.504L19.9227 13.2275C20.1943 12.9825 20.2195 12.565 19.9792 12.2892ZM18.4032 11.4472C19.1009 10.8648 20.1362 10.9471 20.7332 11.6323C21.3318 12.3195 21.2692 13.3597 20.5924 13.9701L14.407 19.5486L14.0721 19.8506L13.7373 19.5486L7.55171 13.9701C6.87492 13.3597 6.81229 12.3195 7.41096 11.6323C8.00796 10.9471 9.04326 10.8648 9.74094 11.4473L14.072 15.0628L18.4032 11.4472Z"></path></svg>`,
  "trading-down": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="5.07 6.35 18 18" width="1em" height="1em" fill="none"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M19.9792 12.2892C19.7396 12.0142 19.3241 11.9812 19.044 12.2149L14.3924 16.098L14.072 16.3655L13.7516 16.098L9.10009 12.2149C8.82008 11.9812 8.40456 12.0142 8.16495 12.2892C7.92467 12.565 7.94981 12.9825 8.22144 13.2275L14.0721 18.504L19.9227 13.2275C20.1943 12.9825 20.2195 12.565 19.9792 12.2892ZM18.4032 11.4472C19.1009 10.8648 20.1362 10.9471 20.7332 11.6323C21.3318 12.3195 21.2692 13.3597 20.5924 13.9701L14.407 19.5486L14.0721 19.8506L13.7373 19.5486L7.55171 13.9701C6.87492 13.3597 6.81229 12.3195 7.41096 11.6323C8.00796 10.9471 9.04326 10.8648 9.74094 11.4473L14.072 15.0628L18.4032 11.4472Z"></path></svg>`,
  tradingUp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="5.07 4.55 18 18" width="1em" height="1em" fill="none"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M19.9792 16.6205C19.7396 16.8955 19.3241 16.9285 19.044 16.6948L14.3924 12.8117L14.072 12.5442L13.7516 12.8117L9.10009 16.6947C8.82008 16.9285 8.40456 16.8955 8.16495 16.6205C7.92467 16.3447 7.94981 15.9272 8.22144 15.6822L14.0721 10.4057L19.9227 15.6822C20.1943 15.9272 20.2195 16.3447 19.9792 16.6205ZM18.4032 17.4624C19.1009 18.0448 20.1362 17.9626 20.7332 17.2774C21.3318 16.5902 21.2692 15.55 20.5924 14.9396L14.407 9.36109L14.0721 9.05908L13.7373 9.36109L7.55171 14.9396C6.87492 15.55 6.81229 16.5902 7.41096 17.2774C8.00796 17.9626 9.04326 18.0448 9.74094 17.4624L14.072 13.8468L18.4032 17.4624Z"></path></svg>`,
  "trading-up": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="5.07 4.55 18 18" width="1em" height="1em" fill="none"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M19.9792 16.6205C19.7396 16.8955 19.3241 16.9285 19.044 16.6948L14.3924 12.8117L14.072 12.5442L13.7516 12.8117L9.10009 16.6947C8.82008 16.9285 8.40456 16.8955 8.16495 16.6205C7.92467 16.3447 7.94981 15.9272 8.22144 15.6822L14.0721 10.4057L19.9227 15.6822C20.1943 15.9272 20.2195 16.3447 19.9792 16.6205ZM18.4032 17.4624C19.1009 18.0448 20.1362 17.9626 20.7332 17.2774C21.3318 16.5902 21.2692 15.55 20.5924 14.9396L14.407 9.36109L14.0721 9.05908L13.7373 9.36109L7.55171 14.9396C6.87492 15.55 6.81229 16.5902 7.41096 17.2774C8.00796 17.9626 9.04326 18.0448 9.74094 17.4624L14.072 13.8468L18.4032 17.4624Z"></path></svg>`,
  tradingAddOrder: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="3.5 3.5 22 22" width="1em" height="1em"><path fill="currentColor" d="M22 6H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10v1H6a2 2 0 0 1-2-2V7c0-1.1.9-2 2-2h16a2 2 0 0 1 2 2v8h-1V7a1 1 0 0 0-1-1m-6 6.77-3.41-2.48-.6.81 4 2.9 4-2.9-.58-.8zm-4 2.47L8.59 17.7l-.6-.8L12 14 16 16.9l-.59.81zM21 17v3h-3v1h3v3h1v-3h3v-1h-3v-3z"></path></svg>`,
  "trading-add-order": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="3.5 3.5 22 22" width="1em" height="1em"><path fill="currentColor" d="M22 6H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10v1H6a2 2 0 0 1-2-2V7c0-1.1.9-2 2-2h16a2 2 0 0 1 2 2v8h-1V7a1 1 0 0 0-1-1m-6 6.77-3.41-2.48-.6.81 4 2.9 4-2.9-.58-.8zm-4 2.47L8.59 17.7l-.6-.8L12 14 16 16.9l-.59.81zM21 17v3h-3v1h3v3h1v-3h3v-1h-3v-3z"></path></svg>`,
  alarmClock: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="2.75 3.75 22 22" width="1em" height="1em"><path fill="currentColor" d="m19.54 4.5 3.96 4.32-.74.68-3.96-4.32.74-.68ZM7.46 4.5 3.5 8.82l.74.68L8.2 5.18l-.74-.68ZM19.74 10.33A7.5 7.5 0 0 1 21 14.5v.5h1v-.5a8.5 8.5 0 1 0-8.5 8.5h.5v-1h-.5a7.5 7.5 0 1 1 6.24-11.67Z"></path><path fill="currentColor" d="M13 9v5h-3v1h4V9h-1ZM19 20v-4h1v4h4v1h-4v4h-1v-4h-4v-1h4Z"></path></svg>`,
  "alarm-clock": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="2.75 3.75 22 22" width="1em" height="1em"><path fill="currentColor" d="m19.54 4.5 3.96 4.32-.74.68-3.96-4.32.74-.68ZM7.46 4.5 3.5 8.82l.74.68L8.2 5.18l-.74-.68ZM19.74 10.33A7.5 7.5 0 0 1 21 14.5v.5h1v-.5a8.5 8.5 0 1 0-8.5 8.5h.5v-1h-.5a7.5 7.5 0 1 1 6.24-11.67Z"></path><path fill="currentColor" d="M13 9v5h-3v1h4V9h-1ZM19 20v-4h1v4h4v1h-4v4h-1v-4h-4v-1h4Z"></path></svg>`,
  alert: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="2.75 3.75 22 22" width="1em" height="1em"><path fill="currentColor" d="m19.54 4.5 3.96 4.32-.74.68-3.96-4.32.74-.68ZM7.46 4.5 3.5 8.82l.74.68L8.2 5.18l-.74-.68ZM19.74 10.33A7.5 7.5 0 0 1 21 14.5v.5h1v-.5a8.5 8.5 0 1 0-8.5 8.5h.5v-1h-.5a7.5 7.5 0 1 1 6.24-11.67Z"></path><path fill="currentColor" d="M13 9v5h-3v1h4V9h-1ZM19 20v-4h1v4h4v1h-4v4h-1v-4h-4v-1h4Z"></path></svg>`,
  footprint: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="4.5" height="11" rx="0.8" fill="currentColor" fill-opacity="0.2"></rect><path d="M2.5 6h4.5M2.5 9.5h4.5"></path><rect x="9" y="4" width="4.5" height="8.5" rx="0.8"></rect><path d="M9 7.5h4.5M9 10h4.5"></path></svg>`,
  tpo: `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2.5v11M3 4h4M3 6.5h7M3 9h9M3 11.5h5"></path></svg>`,
} as const;

export const VELA_ICONS = VELA_NATIVE_ICONS;
export type VelaIconKey = keyof typeof VELA_ICONS;

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
  },
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
      const N = totalW - tW;
      const cornerR = R > 0 ? R : 6.5;
      const rOffset = cornerR + 0.5;
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
  options?: ChromeJoinOptions,
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
  const fillColor = options?.fillColor ?? "var(--vela-surface, var(--vela-bg, #151619))";
  const strokeColor = options?.strokeColor ?? "var(--vela-border, #34353b)";
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
      if (
        typeof trigger.getBoundingClientRect === "function" &&
        typeof popup.getBoundingClientRect === "function"
      ) {
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
  options?: { minMargin?: number },
): void {
  const topbarRow =
    trigger.closest<HTMLElement>(".border-b") ||
    trigger.closest<HTMLElement>(".vela-widget-topbar") ||
    container;
  const triggerRect = trigger.getBoundingClientRect();
  const cardRect = container.getBoundingClientRect();

  popup.style.position = "absolute";
  const topbarHeight = topbarRow.offsetHeight || 39;
  popup.style.top = `${topbarHeight - 1}px`;

  const idealLeft = Math.round(triggerRect.left - cardRect.left - 1);
  const minMargin = options?.minMargin ?? 8;
  const maxLeft = Math.max(
    minMargin,
    (container.offsetWidth || cardRect.width) - popup.offsetWidth - minMargin,
  );
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
