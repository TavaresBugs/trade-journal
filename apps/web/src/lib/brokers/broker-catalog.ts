import type { BrokerCatalogItem } from "@/types/import";

export type { BrokerCatalogItem };

export interface BrokerMetadata {
  id: string;
  name: string;
  defaultTimeZone: string;
  defaultFormat: string;
  dateFormat: "DMY" | "MDY" | "ISO";
  tvBrokerId?: string;
  icon?: string;
  iconDark?: string;
  category?: "prop-firm" | "platform" | "futures" | "forex-cfd" | "stocks" | "crypto";
  platform?: string;
  platformName?: string;
  platformIcon?: string;
  gateway?: string;
  docUrl?: string;
  officialNote?: string;
}

export interface PlatformOption {
  value: string;
  label: string;
}

export const PLATFORM_METADATA: Record<string, { name: string; icon?: string; gateway?: string }> =
  {
    tradovate: { name: "Tradovate", icon: "tradovate.svg", gateway: "CQG" },
    ninjatrader: { name: "NinjaTrader 8", icon: "ninjatrader.svg", gateway: "CQG / Rithmic" },
    rithmic: { name: "Rithmic (RTrader Pro)", icon: "tradesea.png", gateway: "Rithmic" },
    topstepx: { name: "TopstepX", icon: "topstep.jpg", gateway: "ProjectX" },
    metatrader5: { name: "MetaTrader 5", icon: "metatrader5.png", gateway: "MetaQuotes" },
    metatrader4: { name: "MetaTrader 4", icon: "metatrader5.png", gateway: "MetaQuotes" },
    metatrader: { name: "MetaTrader 5", icon: "metatrader5.png", gateway: "MetaQuotes" },
    tradesea: { name: "TradeSea", icon: "tradesea.png", gateway: "Rithmic" },
    ibkr: { name: "Interactive Brokers", icon: "ibkr.svg" },
    "ibkr-flex": { name: "Interactive Brokers", icon: "ibkr.svg" },
    thinkorswim: { name: "thinkorswim", icon: "schwab.png" },
    tradingview: { name: "TradingView", icon: "tradingview.svg" },
    webull: { name: "Webull", icon: "webull.svg" },
    dastrader: { name: "DAS Trader Pro", icon: "dastrader.png" },
    tradervue: { name: "Tradervue", icon: "tradervue.png" },
    tradezella: { name: "TradeZella", icon: "tradezella.png" },
  };

export const EXPORT_INSTRUCTIONS: Record<string, { title: string; steps: string[] }> = {
  tradovate: {
    title: "Tradovate Statement Export",
    steps: [
      "Log in to Tradovate (web or desktop).",
      "Navigate to the 'Account' tab on the upper menu.",
      "Select 'Positions' (or 'Orders') and choose your date range.",
      "Click the 'Download CSV' icon to export your statement.",
    ],
  },
  ninjatrader: {
    title: "NinjaTrader 8 Executions Export",
    steps: [
      "Open NinjaTrader 8 Control Panel ➔ New ➔ Trade Performance.",
      "Filter to your specific account and select the date range.",
      "Change the 'Display' dropdown from 'Summary' to 'Executions'.",
      "Click 'Generate', then right-click in the table and choose 'Export' (CSV).",
    ],
  },
  topstepx: {
    title: "TopstepX Orders Export",
    steps: [
      "Log in to your TopstepX platform.",
      "Open the 'Orders' component.",
      "Click 'Export', select your desired date range, and confirm export.",
    ],
  },
  rithmic: {
    title: "Rithmic RTrader Pro Export",
    steps: [
      "Log in to RTrader Pro.",
      "Open 'Order History', select your account and date range.",
      "Ensure 'Qty filled' and 'Commission Fill Rate' columns are visible.",
      "Sort by order time ascending and click 'Export As CSV'.",
    ],
  },
  metatrader: {
    title: "MetaTrader 5 Report Export",
    steps: [
      "Open MT5 desktop and go to the 'History' tab at the bottom.",
      "Right-click anywhere in history, select your time period.",
      "Right-click again, select 'Report' ➔ 'Open XML' or 'HTML'.",
    ],
  },
  ibkr: {
    title: "Interactive Brokers Flex Query",
    steps: [
      "Log in to IBKR Client Portal ➔ Performance & Reports ➔ Flex Queries.",
      "Create a 'Trade Confirmation Flex Query' with section 'Executions'.",
      "Set format to CSV and run for your desired date range.",
    ],
  },
};

export const BROKER_CATALOG: BrokerCatalogItem[] = [
  // Prop Firms (Evaluations & Funded Accounts)
  {
    id: "lucid",
    name: "Lucid Trading",
    category: "prop-firm",
    icon: "lucid.png",
    status: "active",
    subtitle: "Futures Prop Firm",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "tradovate",
    dateFormat: "MDY",
    platform: "tradovate",
    platformName: "Tradovate",
    platformIcon: "tradovate.svg",
    officialNote: "Lucid accounts execute through Tradovate, NinjaTrader, or Rithmic.",
  },
  {
    id: "topstep",
    name: "Topstep",
    category: "prop-firm",
    icon: "topstep.jpg",
    status: "active",
    subtitle: "Trading Combine & Funded",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "topstepx",
    dateFormat: "ISO",
    platform: "topstepx",
    platformName: "TopstepX",
    platformIcon: "topstep.jpg",
  },
  {
    id: "apex",
    name: "Apex Trader Funding",
    category: "prop-firm",
    icon: "apex.png",
    status: "active",
    subtitle: "Rithmic & Tradovate Plans",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "tradovate",
    dateFormat: "MDY",
    platform: "tradovate",
    platformName: "Tradovate",
    platformIcon: "tradovate.svg",
  },
  {
    id: "ftmo",
    name: "FTMO",
    category: "prop-firm",
    icon: "ftmo-light.svg",
    iconDark: "ftmo-dark.svg",
    status: "active",
    subtitle: "Forex & CFD Evaluation",
    defaultTimeZone: "Europe/Helsinki",
    defaultFormat: "metatrader",
    dateFormat: "ISO",
    platform: "metatrader5",
    platformName: "MetaTrader 5",
    platformIcon: "metatrader5.png",
  },
  {
    id: "bulenox",
    name: "Bulenox",
    category: "prop-firm",
    icon: "bulenox.png",
    status: "active",
    subtitle: "Futures Prop Firm",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "tradovate",
    dateFormat: "MDY",
    platform: "tradovate",
    platformName: "Tradovate",
    platformIcon: "tradovate.svg",
  },

  // Futures Platforms & Brokers
  {
    id: "tradovate",
    name: "Tradovate",
    category: "futures",
    icon: "tradovate.svg",
    status: "active",
    subtitle: "Orders & Positions CSV",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "tradovate",
    dateFormat: "MDY",
    tvBrokerId: "TRADOVATE",
    platform: "tradovate",
    platformName: "Tradovate",
    platformIcon: "tradovate.svg",
  },
  {
    id: "ninjatrader",
    name: "NinjaTrader 8",
    category: "futures",
    icon: "ninjatrader.svg",
    status: "active",
    subtitle: "Trade Performance Executions CSV",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "ninjatrader",
    dateFormat: "MDY",
    platform: "ninjatrader",
    platformName: "NinjaTrader 8",
    platformIcon: "ninjatrader.svg",
  },
  {
    id: "rithmic",
    name: "Rithmic (RTrader Pro)",
    category: "futures",
    icon: "tradesea.png",
    status: "active",
    subtitle: "Order History CSV Export",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "generic-csv",
    dateFormat: "MDY",
    platform: "rithmic",
    platformName: "Rithmic",
    platformIcon: "tradesea.png",
  },
  {
    id: "topstepx",
    name: "TopstepX",
    category: "futures",
    icon: "topstep.jpg",
    status: "active",
    subtitle: "Orders Fills Export",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "topstepx",
    dateFormat: "ISO",
    platform: "topstepx",
    platformName: "TopstepX",
    platformIcon: "topstep.jpg",
  },
  {
    id: "tradestation",
    name: "TradeStation",
    category: "futures",
    icon: "tradestation.svg",
    status: "active",
    subtitle: "Equities & Futures Orders",
    defaultTimeZone: "America/New_York",
    defaultFormat: "generic-csv",
    dateFormat: "MDY",
    tvBrokerId: "TRADESTATION",
  },
  {
    id: "thinkorswim",
    name: "thinkorswim",
    category: "stocks",
    icon: "schwab.png",
    status: "active",
    subtitle: "Schwab / TD Statement",
    defaultTimeZone: "America/New_York",
    defaultFormat: "thinkorswim",
    dateFormat: "MDY",
  },

  // Crypto API Brokers
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    category: "crypto",
    icon: "hyperliquid.png",
    status: "active",
    subtitle: "Perpetual DEX (API Sync)",
    defaultTimeZone: "UTC",
    defaultFormat: "generic-csv",
    dateFormat: "ISO",
  },
  {
    id: "binance",
    name: "Binance",
    category: "crypto",
    icon: "binance.svg",
    status: "active",
    subtitle: "Spot & Futures API Sync",
    defaultTimeZone: "UTC",
    defaultFormat: "generic-csv",
    dateFormat: "ISO",
  },
  {
    id: "kraken",
    name: "Kraken",
    category: "crypto",
    icon: "kraken.svg",
    status: "active",
    subtitle: "Spot & Margin API",
    defaultTimeZone: "UTC",
    defaultFormat: "generic-csv",
    dateFormat: "ISO",
  },
  {
    id: "bybit",
    name: "Bybit",
    category: "crypto",
    icon: "bybit.svg",
    status: "active",
    subtitle: "Unified Account API",
    defaultTimeZone: "UTC",
    defaultFormat: "generic-csv",
    dateFormat: "ISO",
  },
  {
    id: "okx",
    name: "OKX",
    category: "crypto",
    icon: "okx.svg",
    status: "active",
    subtitle: "API v5 Sync",
    defaultTimeZone: "UTC",
    defaultFormat: "generic-csv",
    dateFormat: "ISO",
    tvBrokerId: "OKX",
  },
  {
    id: "crypto-com",
    name: "Crypto.com",
    category: "crypto",
    icon: "cryptocom.svg",
    status: "active",
    subtitle: "Exchange API",
    defaultTimeZone: "UTC",
    defaultFormat: "generic-csv",
    dateFormat: "ISO",
  },

  // Stocks & Options Brokers
  {
    id: "alpaca",
    name: "Alpaca",
    category: "stocks",
    icon: "alpaca.svg",
    status: "active",
    subtitle: "Commission-free Trading API",
    defaultTimeZone: "America/New_York",
    defaultFormat: "generic-csv",
    dateFormat: "ISO",
    tvBrokerId: "ALPACABROKER",
  },
  {
    id: "ibkr",
    name: "Interactive Brokers",
    category: "stocks",
    icon: "ibkr.svg",
    status: "active",
    subtitle: "Flex Query & Activity Statement",
    defaultTimeZone: "America/New_York",
    defaultFormat: "ibkr-flex",
    dateFormat: "ISO",
    tvBrokerId: "IBKR",
  },
  {
    id: "webull",
    name: "Webull",
    category: "stocks",
    icon: "webull.svg",
    status: "active",
    subtitle: "Orders Records CSV",
    defaultTimeZone: "America/New_York",
    defaultFormat: "webull",
    dateFormat: "MDY",
  },
  {
    id: "public",
    name: "Public",
    category: "stocks",
    icon: "public.svg",
    status: "active",
    subtitle: "Stocks & ETFs",
    defaultTimeZone: "America/New_York",
    defaultFormat: "generic-csv",
    dateFormat: "MDY",
  },
  {
    id: "tradier",
    name: "Tradier",
    category: "stocks",
    icon: "tradier.svg",
    status: "active",
    subtitle: "Equities & Options API",
    defaultTimeZone: "America/New_York",
    defaultFormat: "generic-csv",
    dateFormat: "MDY",
  },
  {
    id: "b3",
    name: "B3 / Nelogica Profit",
    category: "stocks",
    icon: "genial-investimentos.svg",
    status: "active",
    subtitle: "Brazilian Equities & Futures",
    defaultTimeZone: "America/Sao_Paulo",
    defaultFormat: "generic-csv",
    dateFormat: "DMY",
  },

  // Platforms (Trading Software)
  {
    id: "metatrader",
    name: "MetaTrader 5 / 4",
    category: "platform",
    icon: "metatrader5.png",
    status: "active",
    subtitle: "HTML & XML Reports",
    defaultTimeZone: "UTC",
    defaultFormat: "metatrader",
    dateFormat: "ISO",
    platform: "metatrader5",
    platformName: "MetaTrader 5",
    platformIcon: "metatrader5.png",
  },
  {
    id: "tradingview",
    name: "TradingView",
    category: "platform",
    icon: "tradingview.svg",
    status: "active",
    subtitle: "Paper Trading Export",
    defaultTimeZone: "UTC",
    defaultFormat: "tradingview",
    dateFormat: "ISO",
  },
  {
    id: "dastrader",
    name: "DAS Trader Pro",
    category: "platform",
    icon: "dastrader.png",
    status: "active",
    subtitle: "Executions Export",
    defaultTimeZone: "America/New_York",
    defaultFormat: "das-trader",
    dateFormat: "MDY",
  },
  {
    id: "tradezella",
    name: "TradeZella",
    category: "platform",
    icon: "tradezella.png",
    status: "active",
    subtitle: "Journal Migration Export",
    defaultTimeZone: "America/New_York",
    defaultFormat: "tradezella",
    dateFormat: "MDY",
  },
  {
    id: "tradervue",
    name: "Tradervue",
    category: "platform",
    icon: "tradervue.png",
    status: "active",
    subtitle: "Journal Migration Export",
    defaultTimeZone: "America/New_York",
    defaultFormat: "tradervue",
    dateFormat: "MDY",
  },
];

const ALIASES: Record<string, string> = {
  "ibkr-flex": "ibkr",
  "interactive-brokers": "ibkr",
  metatrader5: "metatrader",
  metatrader4: "metatrader",
  mt4: "metatrader",
  mt5: "metatrader",
  tradesea: "rithmic",
  rtrader: "rithmic",
  "r-trader": "rithmic",
  "das-trader": "dastrader",
};

const CATALOG_MAP = new Map<string, BrokerCatalogItem>(
  BROKER_CATALOG.map((item) => [item.id.toLowerCase(), item]),
);

export const BROKER_METADATA: Record<string, BrokerMetadata> = Object.fromEntries(
  BROKER_CATALOG.map((item) => [
    item.id.toLowerCase(),
    {
      id: item.id,
      name: item.name,
      defaultTimeZone: item.defaultTimeZone ?? "UTC",
      defaultFormat: item.defaultFormat ?? "generic-csv",
      dateFormat: item.dateFormat ?? "ISO",
      tvBrokerId: item.tvBrokerId,
      icon: item.icon,
      iconDark: item.iconDark,
      category: item.category,
      platform: item.platform,
      platformName: item.platformName,
      platformIcon: item.platformIcon,
      gateway: item.gateway,
      docUrl: item.docUrl,
      officialNote: item.officialNote,
    },
  ]),
);

// Register aliases in BROKER_METADATA
for (const [alias, canonicalId] of Object.entries(ALIASES)) {
  const canonical = BROKER_METADATA[canonicalId];
  if (canonical) {
    BROKER_METADATA[alias] = { ...canonical, id: alias };
  }
}

export const formatToPlatformId = (format?: string | null): string | undefined => {
  if (!format) return undefined;
  const f = format.toLowerCase().trim();
  if (
    f === "metatrader" ||
    f.startsWith("history-meta") ||
    f.startsWith("history-mt5") ||
    f === "metatrader5" ||
    f === "metatrader4"
  ) {
    return "metatrader5";
  }
  if (f === "tradovate") return "tradovate";
  if (f === "ninjatrader") return "ninjatrader";
  if (f === "topstepx") return "topstepx";
  if (f === "tradesea") return "tradesea";
  if (f === "rithmic") return "rithmic";
  if (f === "ibkr" || f === "ibkr-flex") return "ibkr";
  if (f === "tradingview" || f === "history-tradingview") return "tradingview";
  if (f === "thinkorswim") return "thinkorswim";
  if (f === "dastrader" || f === "das-trader") return "dastrader";
  if (f === "webull") return "webull";
  if (f === "tradervue") return "tradervue";
  if (f === "tradezella") return "tradezella";
  return undefined;
};

export const getBrokerMetadata = (brokerId: string): BrokerMetadata | undefined => {
  if (!brokerId) return undefined;
  const normalized = brokerId.toLowerCase().trim();
  const canonical = ALIASES[normalized] ?? normalized;
  return BROKER_METADATA[canonical] ?? BROKER_METADATA[normalized];
};

export const getBrokerTimeZone = (brokerId: string): string | undefined => {
  return getBrokerMetadata(brokerId)?.defaultTimeZone;
};

export const getBrokerFormat = (brokerId: string): string | undefined => {
  return getBrokerMetadata(brokerId)?.defaultFormat;
};

export const getBrokerInfo = (brokerId?: string | null, platformId?: string | null) => {
  if (!brokerId && !platformId) return undefined;
  const normalizedBroker = brokerId ? brokerId.toLowerCase().trim() : "";
  const canonicalId = ALIASES[normalizedBroker] ?? normalizedBroker;
  const catalog = CATALOG_MAP.get(canonicalId) ?? CATALOG_MAP.get(normalizedBroker);
  const metadata = BROKER_METADATA[canonicalId] ?? BROKER_METADATA[normalizedBroker];

  const effectivePlatformId =
    platformId?.toLowerCase().trim() || metadata?.platform || catalog?.platform;
  const platformMeta = effectivePlatformId ? PLATFORM_METADATA[effectivePlatformId] : undefined;

  const platform = effectivePlatformId;
  const platformName = platformMeta?.name ?? metadata?.platformName ?? catalog?.platformName;
  const platformIcon = platformMeta?.icon ?? metadata?.platformIcon ?? catalog?.platformIcon;

  if (!catalog && !metadata) {
    if (!normalizedBroker && !platformId) return undefined;
    return {
      id: normalizedBroker || platformId || "",
      name: platformMeta?.name ?? normalizedBroker ?? platformId ?? "Custom Account",
      icon: platformIcon,
      iconDark: undefined,
      invertInDark: undefined,
      defaultTimeZone: "UTC",
      defaultFormat: "generic-csv",
      dateFormat: "ISO" as const,
      category: undefined,
      subtitle: undefined,
      platform,
      platformName,
      platformIcon,
      gateway: platformMeta?.gateway,
      docUrl: undefined,
      officialNote: undefined,
    };
  }

  return {
    id: normalizedBroker || (effectivePlatformId ?? ""),
    name: catalog?.name ?? metadata?.name ?? brokerId ?? "",
    icon: catalog?.icon ?? metadata?.icon,
    iconDark: catalog?.iconDark ?? metadata?.iconDark,
    invertInDark: catalog?.invertInDark,
    defaultTimeZone: metadata?.defaultTimeZone ?? catalog?.defaultTimeZone ?? "UTC",
    defaultFormat: metadata?.defaultFormat ?? catalog?.defaultFormat ?? "generic-csv",
    dateFormat: metadata?.dateFormat ?? catalog?.dateFormat ?? ("ISO" as const),
    category: catalog?.category ?? metadata?.category,
    subtitle: catalog?.subtitle,
    platform,
    platformName,
    platformIcon,
    gateway: metadata?.gateway ?? catalog?.gateway ?? platformMeta?.gateway,
    docUrl: metadata?.docUrl ?? catalog?.docUrl,
    officialNote: metadata?.officialNote ?? catalog?.officialNote,
  };
};

export const getPlatformOptionsForBroker = (brokerId?: string | null): PlatformOption[] => {
  if (!brokerId) {
    return [
      { value: "auto", label: "Auto-detect from statement" },
      { value: "tradovate", label: "Tradovate" },
      { value: "ninjatrader", label: "NinjaTrader 8" },
      { value: "rithmic", label: "Rithmic (RTrader Pro)" },
      { value: "topstepx", label: "TopstepX" },
      { value: "metatrader5", label: "MetaTrader 5" },
      { value: "ibkr", label: "Interactive Brokers" },
    ];
  }
  const b = brokerId.toLowerCase().trim();
  switch (b) {
    case "lucid":
      return [
        { value: "tradovate", label: "Tradovate" },
        { value: "ninjatrader", label: "NinjaTrader 8" },
        { value: "rithmic", label: "Rithmic (RTrader Pro)" },
        { value: "auto", label: "Auto-detect from statement" },
      ];
    case "topstep":
      return [
        { value: "topstepx", label: "TopstepX" },
        { value: "tradovate", label: "Tradovate" },
        { value: "ninjatrader", label: "NinjaTrader 8" },
        { value: "auto", label: "Auto-detect from statement" },
      ];
    case "apex":
      return [
        { value: "tradovate", label: "Tradovate" },
        { value: "ninjatrader", label: "NinjaTrader 8" },
        { value: "rithmic", label: "Rithmic" },
        { value: "auto", label: "Auto-detect from statement" },
      ];
    case "ftmo":
      return [
        { value: "metatrader5", label: "MetaTrader 5" },
        { value: "metatrader4", label: "MetaTrader 4" },
        { value: "auto", label: "Auto-detect from statement" },
      ];
    case "bulenox":
      return [
        { value: "tradovate", label: "Tradovate" },
        { value: "rithmic", label: "Rithmic (RTrader Pro)" },
        { value: "ninjatrader", label: "NinjaTrader 8" },
        { value: "auto", label: "Auto-detect from statement" },
      ];
    default:
      return [
        { value: "auto", label: "Auto-detect from statement" },
        { value: "tradovate", label: "Tradovate" },
        { value: "ninjatrader", label: "NinjaTrader 8" },
        { value: "rithmic", label: "Rithmic" },
        { value: "topstepx", label: "TopstepX" },
        { value: "metatrader5", label: "MetaTrader 5" },
        { value: "ibkr", label: "Interactive Brokers" },
      ];
  }
};
