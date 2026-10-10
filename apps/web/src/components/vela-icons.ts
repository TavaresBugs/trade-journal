/**
 * Centralized Icon Registry for Vela Charting Engine
 * Canonical SVG markup matching TradingView / LuxAlgo Vela 1:1.
 */

const SLIDERS_ICON = `<svg viewBox="0 0 20 20" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v14m5-14v14m5-14v14M3 7h4m1 6h4m1-8h4"/></svg>`;
const COPY_PRICE_ICON = `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/></svg>`;
const CAMERA_ICON = `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 4 6.5 2.5h3L10.5 4h3A1 1 0 0 1 14.5 5v7.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"></path><circle cx="8" cy="8.5" r="2.6"></circle></svg>`;
const DOWNLOAD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download size-4 shrink-0"><path d="M12 15V3"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path></svg>`;
const CLIPBOARD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy size-4 shrink-0"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;
const CROP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-scan size-4 shrink-0"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path></svg>`;
const CHECKMARK_ICON = `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2.8 8.4 3.4 3.4 7-7.6"/></svg>`;
const GRIP_SIX_DOTS_ICON = `<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="6" cy="3.5" r="1.1"/><circle cx="10" cy="3.5" r="1.1"/><circle cx="6" cy="8" r="1.1"/><circle cx="10" cy="8" r="1.1"/><circle cx="6" cy="12.5" r="1.1"/><circle cx="10" cy="12.5" r="1.1"/></svg>`;
const PLUS_ICON = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"><path d="M5 2v6M2 5h6"/></svg>`;
const STAR_ICON = `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2l1.75 3.55 3.9.55-2.8 2.75.65 3.9L8 11.1l-3.5 1.85.65-3.9-2.8-2.75 3.9-.55z"></path></svg>`;
const STAR_OUTLINE_ICON = `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2l1.75 3.55 3.9.55-2.8 2.75.65 3.9L8 11.1l-3.5 1.85.65-3.9-2.8-2.75 3.9-.55z"></path></svg>`;
const CLOCK_ICON = `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"></circle><path d="M8 4.5v3.5l2.5 1.5"></path></svg>`;
const CANDLES_ICON = `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 2v2M4.5 12v2M11.5 2v1.5M11.5 11v3"></path><rect x="2.8" y="4" width="3.4" height="8" rx="0.6" fill="currentColor" fill-opacity="0.25"></rect><rect x="9.8" y="3.5" width="3.4" height="7.5" rx="0.6" fill="currentColor"></rect></svg>`;
const BARS_ICON = `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 2.5v11M2.5 5h2M4.5 11h2"></path><path d="M11.5 2.5v11M9.5 4.5h2M11.5 10.5h2"></path></svg>`;
const LINE_ICON = `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 11.5 5.5 7l3 2.5 5-6"></path></svg>`;
const AREA_ICON = `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 11.5 5.5 7l3 2.5 5-6"></path><path d="M1.5 11.5 5.5 7l3 2.5 5-6V13.5h-12z" fill="currentColor" fill-opacity="0.25" stroke="none"></path></svg>`;
const BASELINE_ICON = `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8h13" stroke-dasharray="2 2"></path><path d="M2.5 8 5.25 4.5 8 8h-5.5z" fill="currentColor" fill-opacity="0.25" stroke="none"></path><path d="M2.5 8 5.25 4.5 8 8"></path><path d="M8 8l2.75 3.5L13.5 8h-5.5z" fill="currentColor" fill-opacity="0.25" stroke="none"></path><path d="M8 8l2.75 3.5L13.5 8"></path></svg>`;
const HEIKIN_ASHI_ICON = `<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12v2M11.5 2v2"></path><rect x="2.8" y="5" width="3.4" height="7" rx="0.6" fill="currentColor" fill-opacity="0.25"></rect><rect x="9.8" y="4" width="3.4" height="7" rx="0.6" fill="currentColor"></rect></svg>`;

export const VELA_ICONS = {
  sliders: SLIDERS_ICON,
  Sliders: SLIDERS_ICON,
  copyPrice: COPY_PRICE_ICON,
  camera: CAMERA_ICON,
  download: DOWNLOAD_ICON,
  clipboard: CLIPBOARD_ICON,
  crop: CROP_ICON,
  checkmark: CHECKMARK_ICON,
  gripSixDots: GRIP_SIX_DOTS_ICON,
  plus: PLUS_ICON,
  star: STAR_ICON,
  starOutline: STAR_OUTLINE_ICON,
  clock: CLOCK_ICON,
  candles: CANDLES_ICON,
  bars: BARS_ICON,
  line: LINE_ICON,
  area: AREA_ICON,
  baseline: BASELINE_ICON,
  heikinAshi: HEIKIN_ASHI_ICON,
  heikinashi: HEIKIN_ASHI_ICON,
} as const;

export type VelaIconKey = keyof typeof VELA_ICONS;
