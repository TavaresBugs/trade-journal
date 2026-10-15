/**
 * Native Vela Symbol Icon Registry & CME Futures Vector Badges
 * Natively resolves CME Futures (MES/ES 500, MNQ/NQ 100, MYM/YM 30, M2K/RTY 2000),
 * Commodities (MGC/GC, CL), and Crypto badges without external DOM enhancers.
 */

export interface SymbolBadgeSpec {
  bg: string;
  fg: string;
  text: string;
  svgDataUri: string;
}

export type CustomSymbolIconResolver = (symbol: string) => string | undefined;

let externalResolver: CustomSymbolIconResolver | null = null;

/**
 * Allows the host app (TradeJournal) to plug its full manifest resolver if desired,
 * while keeping CME Futures badges 100% native by default.
 */
export function registerSymbolIconResolver(resolver: CustomSymbolIconResolver | null): void {
  externalResolver = resolver;
}

function createBadgeSvgDataUri(bg: string, fg: string, label: string, fontSize = 9): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
    <circle cx="12" cy="12" r="12" fill="${bg}"/>
    <text x="12" y="12.5" fill="${fg}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="${fontSize}" font-weight="800" text-anchor="middle" dominant-baseline="central">${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const NATIVE_CME_BADGES: Record<string, SymbolBadgeSpec> = {
  // S&P 500 (MES / ES) — Red 500 Badge
  MES: { bg: "#d92638", fg: "#ffffff", text: "500", svgDataUri: createBadgeSvgDataUri("#d92638", "#ffffff", "500", 8.5) },
  ES:  { bg: "#d92638", fg: "#ffffff", text: "500", svgDataUri: createBadgeSvgDataUri("#d92638", "#ffffff", "500", 8.5) },
  SPX: { bg: "#d92638", fg: "#ffffff", text: "500", svgDataUri: createBadgeSvgDataUri("#d92638", "#ffffff", "500", 8.5) },
  // Nasdaq 100 (MNQ / NQ) — Blue 100 Badge
  MNQ: { bg: "#1b5eb8", fg: "#ffffff", text: "100", svgDataUri: createBadgeSvgDataUri("#1b5eb8", "#ffffff", "100", 8.5) },
  NQ:  { bg: "#1b5eb8", fg: "#ffffff", text: "100", svgDataUri: createBadgeSvgDataUri("#1b5eb8", "#ffffff", "100", 8.5) },
  NDX: { bg: "#1b5eb8", fg: "#ffffff", text: "100", svgDataUri: createBadgeSvgDataUri("#1b5eb8", "#ffffff", "100", 8.5) },
  // Dow Jones 30 (MYM / YM) — Royal Blue 30 Badge
  MYM: { bg: "#0052cc", fg: "#ffffff", text: "30", svgDataUri: createBadgeSvgDataUri("#0052cc", "#ffffff", "30", 9.5) },
  YM:  { bg: "#0052cc", fg: "#ffffff", text: "30", svgDataUri: createBadgeSvgDataUri("#0052cc", "#ffffff", "30", 9.5) },
  // Russell 2000 (M2K / RTY) — Purple 2K Badge
  M2K: { bg: "#6e3aff", fg: "#ffffff", text: "2000", svgDataUri: createBadgeSvgDataUri("#6e3aff", "#ffffff", "2000", 7.2) },
  RTY: { bg: "#6e3aff", fg: "#ffffff", text: "2000", svgDataUri: createBadgeSvgDataUri("#6e3aff", "#ffffff", "2000", 7.2) },
  // Gold (MGC / GC)
  MGC: { bg: "#d4af37", fg: "#151619", text: "AU", svgDataUri: createBadgeSvgDataUri("#d4af37", "#151619", "AU", 9) },
  GC:  { bg: "#d4af37", fg: "#151619", text: "AU", svgDataUri: createBadgeSvgDataUri("#d4af37", "#151619", "AU", 9) },
  // Crude Oil (MCL / CL)
  MCL: { bg: "#2b3139", fg: "#f0f3fa", text: "CL", svgDataUri: createBadgeSvgDataUri("#2b3139", "#f0f3fa", "CL", 9) },
  CL:  { bg: "#2b3139", fg: "#f0f3fa", text: "CL", svgDataUri: createBadgeSvgDataUri("#2b3139", "#f0f3fa", "CL", 9) },
  // Crypto
  BTCUSDT: { bg: "#f7931a", fg: "#ffffff", text: "₿", svgDataUri: createBadgeSvgDataUri("#f7931a", "#ffffff", "₿", 11) },
  ETHUSDT: { bg: "#627eea", fg: "#ffffff", text: "Ξ", svgDataUri: createBadgeSvgDataUri("#627eea", "#ffffff", "Ξ", 11) },
};

export function cleanRootSymbol(rawSymbol: string): string {
  const withoutVenue = (rawSymbol || "").includes(":")
    ? rawSymbol.split(":").pop()!
    : rawSymbol || "";
  return withoutVenue
    .trim()
    .replace(/1!$/, "")
    .replace(/[FGHJKMNQUVXZ]\d{1,4}$/i, "")
    .toUpperCase();
}

export function resolveNativeSymbolIcon(symbol: string): string | undefined {
  if (!symbol) return undefined;
  const clean = cleanRootSymbol(symbol);
  if (externalResolver) {
    try {
      const custom = externalResolver(clean) ?? externalResolver(symbol);
      if (custom) return custom;
    } catch {}
  }
  return NATIVE_CME_BADGES[clean]?.svgDataUri ?? NATIVE_CME_BADGES[symbol.toUpperCase()]?.svgDataUri;
}

export function renderSymbolIconElement(symbol: string, doc: Document = document): HTMLElement {
  const clean = cleanRootSymbol(symbol);
  const iconUri = resolveNativeSymbolIcon(symbol);
  const wrap = doc.createElement("span");
  wrap.className = "vela-sl-avatar inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden";
  wrap.style.width = "18px";
  wrap.style.height = "18px";

  if (iconUri) {
    const img = doc.createElement("img");
    img.src = iconUri;
    img.alt = clean;
    img.className = "w-full h-full object-cover select-none pointer-events-none";
    wrap.appendChild(img);
    return wrap;
  }

  const badge = NATIVE_CME_BADGES[clean];
  wrap.style.backgroundColor = badge?.bg ?? "#1b5eb8";
  wrap.style.color = badge?.fg ?? "#ffffff";
  wrap.style.fontSize = "9px";
  wrap.style.fontWeight = "700";
  wrap.textContent = badge?.text ?? (clean.slice(0, 2) || "SY");
  return wrap;
}
