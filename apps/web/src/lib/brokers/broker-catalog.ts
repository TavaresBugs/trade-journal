import type { BrokerCatalogItem } from "@/types/import";

export type { BrokerCatalogItem };

export type BrokerCategory =
  "prop-firm" | "platform" | "futures" | "forex-cfd" | "stocks" | "crypto";

export type DateFormat = "DMY" | "MDY" | "ISO";
export type ConnectionType = "api" | "csv";
export type BrokerStatus = "active" | "soon";

export interface BrokerMetadata {
  id: string;
  name: string;
  defaultTimeZone: string;
  defaultFormat: string;
  dateFormat: "DMY" | "MDY" | "ISO";
  tvBrokerId?: string;
  connectionType?: "api" | "csv";
  icon?: string;
  iconDark?: string;
  invertInDark?: boolean;
  category?: BrokerCategory;
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
  icon?: string;
  iconDark?: string;
}

export interface BrokerDefinition {
  name: string;
  category: BrokerCategory;
  icon: string;
  iconDark?: string;
  invertInDark?: boolean;
  status?: BrokerStatus;
  subtitle?: string;
  connectionType?: ConnectionType;
  defaultTimeZone?: string;
  defaultFormat?: string;
  dateFormat?: DateFormat;
  tvBrokerId?: string;
  platform?: string;
  platformName?: string;
  platformIcon?: string;
  gateway?: string;
  docUrl?: string;
  officialNote?: string;
  priority?: number;
  popular?: boolean;
  aliases?: readonly string[];
  supportedPlatforms?: readonly string[];
  accountPrefixes?: readonly string[];
  namePatterns?: readonly string[];
}

export const PLATFORM_METADATA: Record<string, { name: string; icon?: string; gateway?: string }> =
  {
    tradovate: { name: "Tradovate", icon: "tradovate.svg", gateway: "CQG" },
    ninjatrader: { name: "NinjaTrader 8", icon: "ninjatrader.svg", gateway: "CQG / Rithmic" },
    rithmic: { name: "Rithmic", icon: "rithmic.png", gateway: "Rithmic" },
    topstepx: { name: "TopstepX", icon: "topstep.png", gateway: "ProjectX" },
    metatrader5: { name: "MetaTrader 5", icon: "metatrader5.png", gateway: "MetaQuotes" },
    metatrader4: { name: "MetaTrader 4", icon: "metatrader5.png", gateway: "MetaQuotes" },
    metatrader: { name: "MetaTrader 5", icon: "metatrader5.png", gateway: "MetaQuotes" },
    "history-metatrader": { name: "MetaTrader 5", icon: "metatrader5.png", gateway: "MetaQuotes" },
    tradesea: { name: "TradeSea", icon: "tradesea.png", gateway: "Rithmic" },
    wealthcharts: { name: "WealthCharts", icon: "wealthcharts.png", gateway: "Apex / CQG" },
    ibkr: { name: "Interactive Brokers", icon: "ibkr.svg" },
    "ibkr-flex": { name: "Interactive Brokers", icon: "ibkr.svg" },
    thinkorswim: { name: "thinkorswim", icon: "thinkorswim.png" },
    tradingview: { name: "TradingView", icon: "tradingview.svg" },
    webull: { name: "Webull", icon: "webull.svg" },
    dastrader: { name: "DAS Trader Pro", icon: "dastrader.png" },
    tradezero: { name: "TradeZero", icon: "tradezero.svg" },
    robinhood: { name: "Robinhood", icon: "robinhood.svg" },
    moomoo: { name: "Moomoo", icon: "moomoo.svg" },
    ctrader: { name: "cTrader", icon: "ctrader.png", gateway: "Spotware" },
    quantower: { name: "Quantower", icon: "quantower.svg" },
    sierrachart: { name: "Sierra Chart", icon: "sierrachart.png" },
    tc2000: { name: "TC2000", icon: "tc2000.png" },
    motivewave: { name: "MotiveWave", icon: "motivewave.png" },
    sterling: { name: "Sterling Trader Pro", icon: "sterling.svg" },
    lightspeed: { name: "Lightspeed", icon: "lightspeed.png" },
    matchtrader: { name: "Match-Trader", icon: "matchtrader.png" },
    silexx: { name: "Cboe Silexx", icon: "silexx.svg" },
    tickblaze: { name: "Tickblaze", icon: "tickblaze.png" },
    capitalcom: { name: "Capital.com", icon: "capital-com.svg" },
    oanda: { name: "OANDA", icon: "oanda.svg" },
  };

export const EXPORT_INSTRUCTIONS: Record<string, { title: string; steps: string[] }> = {
  quantower: {
    title: "Quantower Trades Export",
    steps: [
      "Open the Quantower desktop application.",
      "From the main header menu, select 'Trades' (or 'Orders').",
      "Select your desired date range on the trade tab.",
      "Right-click anywhere in the table, click 'Export data', ensure 'Comma separated' is selected, and click 'Export File'.",
    ],
  },
  sierrachart: {
    title: "Sierra Chart Fills Log Export",
    steps: [
      "Open Sierra Chart desktop and click 'Trade' from the top menu.",
      "Go to the 'Trade Activity' tab and select 'Fills' from the dropdown.",
      "Click 'Apply' for your desired period.",
      "Go to 'File' ➔ 'Save Log As' and save the CSV/text file to your computer.",
    ],
  },
  tc2000: {
    title: "TC2000 Trade History Export",
    steps: [
      "Launch TC2000 desktop and select your trading account.",
      "Click on the 'Trading' menu button in the navigation bar.",
      "Select 'Export Trade History' from the dropdown menu.",
      "Choose 'Trades In Date Range', select 'Comma delimited' format, and click 'Export'.",
    ],
  },
  motivewave: {
    title: "MotiveWave Trades CSV Export",
    steps: [
      "Launch the MotiveWave desktop application.",
      "Click on the 'Account' tab at the bottom-left of the screen.",
      "Select the 'Trades' sub-tab to display your historical executions.",
      "Click the 'Export' button on the upper-right of the table and save as CSV.",
    ],
  },
  sterling: {
    title: "Sterling Trader Pro Export",
    steps: [
      "Open Sterling Trader Pro desktop and log in to your account.",
      "Navigate to the 'Trading Monitor' window.",
      "Right-click anywhere on the executions table and choose 'Save As' / 'Export'.",
      "Save the file as a CSV.",
    ],
  },
  matchtrader: {
    title: "Match-Trader Positions Export",
    steps: [
      "Log in to your Match-Trader web or desktop platform.",
      "Navigate to the 'Closed' positions tab at the bottom of the screen.",
      "Select your desired date range.",
      "Click the Download/Export icon on the far right and select 'HTML' or 'CSV' format.",
    ],
  },
  lightspeed: {
    title: "Lightspeed Blotter Export",
    steps: [
      "Log in to the Lightspeed client portal at lightspeed.com.",
      "Navigate to Reports ➔ Account List and select your account number.",
      "Click 'Blotter' and choose your desired date range.",
      "Click the 'CSV' button to download your execution history.",
    ],
  },
  silexx: {
    title: "Cboe Silexx Blotter Export",
    steps: [
      "Open Cboe Silexx OEMS desktop platform.",
      "Go to the 'Order Blotter' or 'Trade Activity' module.",
      "Filter by your date range, right-click in the grid, and choose 'Export to CSV'.",
    ],
  },
  tickblaze: {
    title: "Tickblaze Orders Export",
    steps: [
      "Open Tickblaze desktop (Standard or Strategy workspace).",
      "Go to the 'Orders' tab and select 'Filled Orders'.",
      "Right-click anywhere in the table and select 'Export' to save as CSV.",
    ],
  },
  capitalcom: {
    title: "Capital.com Trades Report Export",
    steps: [
      "Log in to your Capital.com account.",
      "Click on the 'Reports' tab from the left sidebar and select 'Trades'.",
      "Ensure all statuses are checked and choose your desired date range.",
      "Click 'Send report' to receive your CSV file.",
    ],
  },
  oanda: {
    title: "OANDA Transaction History Export",
    steps: [
      "Log in to the OANDA web trading platform.",
      "Click on 'Transaction History' from the navigation menu.",
      "Select your trading account and date range, then click 'Show Transactions'.",
      "Click 'Export to CSV' to download your trade data.",
    ],
  },
  ctrader: {
    title: "cTrader Deals / Statement Export",
    steps: [
      "Open cTrader (web or desktop) and navigate to the 'History' tab.",
      "Filter by your desired period and statement details.",
      "Right-click or click the 'Statement' / export button to save as CSV.",
    ],
  },
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
    title: "Rithmic Export",
    steps: [
      "Log in to RTrader Pro.",
      "Open 'Order History', select your account and date range.",
      "Ensure 'Qty filled' and 'Commission Fill Rate' columns are visible.",
      "Sort by order time ascending and click 'Export As CSV'.",
    ],
  },
  tradesea: {
    title: "TradeSea Statement Export",
    steps: [
      "Log in to your TradeSea account.",
      "Navigate to your Trading / Order History.",
      "Select your desired date range and click Export CSV.",
    ],
  },
  wealthcharts: {
    title: "WealthCharts Orders Export",
    steps: [
      "Open WealthCharts and navigate to the Account / Orders panel.",
      "Filter for your account and desired date range.",
      "Click the download/export icon to generate the 'orders - Wealth Charts.csv' file.",
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
  tradezero: {
    title: "TradeZero Trade History Export",
    steps: [
      "Log in to TradeZero Web or ZeroPro desktop platform.",
      "Navigate to the 'Account' or 'Trade History' tab.",
      "Select your desired date range and click 'Export to CSV'.",
    ],
  },
  robinhood: {
    title: "Robinhood Account Activity Export",
    steps: [
      "Log in to Robinhood on the web (robinhood.com).",
      "Go to Account ➔ Reports & Statements ➔ Account Activity.",
      "Generate and download the CSV report.",
    ],
  },
  moomoo: {
    title: "Moomoo Trade History Export",
    steps: [
      "Open the Moomoo desktop or mobile app.",
      "Go to Trade ➔ Orders / Trade History.",
      "Filter by your date range and export as CSV.",
    ],
  },
  dastrader: {
    title: "DAS Trader Pro Trade Log Export",
    steps: [
      "Open DAS Trader Pro desktop application.",
      "Go to 'Trade' from the top menu and select 'Trade Log'.",
      "Right-click anywhere in the Trade Log table and select 'Export to CSV'.",
      "Save the CSV file to your computer.",
    ],
  },
  tradingview: {
    title: "TradingView Trade History Export",
    steps: [
      "Open TradingView and open the bottom 'Trading Panel'.",
      "Select your connected broker or Paper Trading tab.",
      "Switch to 'Account History' or 'Journal'.",
      "Click the 'Export' / download button and save the CSV file.",
    ],
  },
  webull: {
    title: "Webull Orders Export",
    steps: [
      "Open Webull desktop or mobile application.",
      "Navigate to Account ➔ Orders / Trade History.",
      "Filter by your desired date range and click 'Export Orders'.",
      "Save the CSV file to your computer.",
    ],
  },
};

export const SUPPORTED_PLATFORMS: PlatformOption[] = Object.entries(PLATFORM_METADATA)
  .filter(([id]) => !["metatrader", "history-metatrader", "ibkr-flex"].includes(id))
  .map(([id, meta]) => ({
    value: id,
    label: meta.name,
    icon: meta.icon,
  }));

export const BROKERS_CONFIG = {
  // === PROP FIRMS ===
  topstep: {
    name: "Topstep",
    category: "prop-firm",
    connectionType: "api",
    icon: "topstep.png",
    subtitle: "ProjectX API Sync",
    dateFormat: "ISO",
    platform: "topstepx",
    priority: 1,
    popular: true,
    supportedPlatforms: ["topstepx", "tradovate", "ninjatrader"],
    accountPrefixes: ["TOP", "TS-"],
    namePatterns: ["topstep"],
  },
  lucid: {
    name: "Lucid Trading",
    category: "prop-firm",
    icon: "lucid.png",
    subtitle: "Futures Prop (CSV Import)",
    platform: "tradovate",
    officialNote: "Lucid accounts execute through Tradovate, NinjaTrader, or Rithmic.",
    priority: 2,
    popular: true,
    supportedPlatforms: ["tradovate", "ninjatrader", "tradesea", "rithmic"],
    accountPrefixes: ["LF"],
    namePatterns: ["lucid"],
  },
  apex: {
    name: "Apex Trader Funding",
    category: "prop-firm",
    icon: "apex.png",
    subtitle: "Futures Prop (CSV Import)",
    platform: "tradovate",
    priority: 3,
    popular: true,
    supportedPlatforms: ["tradovate", "wealthcharts", "ninjatrader", "rithmic"],
    accountPrefixes: ["APEX"],
    namePatterns: ["apex"],
  },
  ftmo: {
    name: "FTMO",
    category: "prop-firm",
    icon: "ftmo-light.svg",
    iconDark: "ftmo-dark.svg",
    subtitle: "Forex & CFD (MT5 Import)",
    defaultTimeZone: "Europe/Helsinki",
    defaultFormat: "metatrader",
    dateFormat: "ISO",
    platform: "metatrader5",
    priority: 4,
    popular: true,
    supportedPlatforms: ["metatrader5", "metatrader4", "ctrader"],
    namePatterns: ["ftmo"],
  },
  bulenox: {
    name: "Bulenox",
    category: "prop-firm",
    icon: "bulenox.png",
    subtitle: "Futures Prop (CSV Import)",
    platform: "tradovate",
    priority: 5,
    supportedPlatforms: ["tradovate", "rithmic", "ninjatrader"],
    accountPrefixes: ["BX-", "BULENOX"],
    namePatterns: ["bulenox"],
  },
  tradeify: {
    name: "Tradeify",
    category: "prop-firm",
    icon: "tradeify.png",
    subtitle: "Futures Prop (CSV Import)",
    platform: "tradovate",
    officialNote: "Tradeify accounts execute through Tradovate, NinjaTrader, or ProjectX.",
    priority: 6,
    supportedPlatforms: ["tradovate", "ninjatrader"],
    accountPrefixes: ["TDFY", "TRADEIFY"],
    namePatterns: ["tradeify"],
  },

  // === EXECUTION PLATFORMS ===
  tradovate: {
    name: "Tradovate",
    category: "platform",
    icon: "tradovate.svg",
    subtitle: "Orders & Positions CSV",
    defaultTimeZone: "America/Chicago",
    tvBrokerId: "TRADOVATE",
    platform: "tradovate",
    priority: 7,
    popular: true,
    namePatterns: ["tradovate"],
  },
  ninjatrader: {
    name: "NinjaTrader 8",
    category: "platform",
    icon: "ninjatrader.svg",
    subtitle: "Trade Performance Executions CSV",
    defaultTimeZone: "America/Chicago",
    platform: "ninjatrader",
    priority: 8,
    popular: true,
    namePatterns: ["ninjatrader"],
  },
  topstepx: {
    name: "TopstepX",
    category: "platform",
    icon: "topstep.png",
    subtitle: "Orders Fills Export",
    defaultTimeZone: "America/Chicago",
    dateFormat: "ISO",
    platform: "topstepx",
    priority: 9,
    namePatterns: ["topstepx"],
  },
  rithmic: {
    name: "Rithmic",
    category: "platform",
    icon: "rithmic.png",
    subtitle: "Order History CSV Export",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "generic-csv",
    platform: "rithmic",
    priority: 10,
    aliases: ["rtrader", "r-trader"],
    namePatterns: ["rithmic"],
  },
  tradesea: {
    name: "TradeSea",
    category: "platform",
    icon: "tradesea.png",
    subtitle: "TradeSea Executions Export",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "generic-csv",
    platform: "tradesea",
    priority: 11,
    namePatterns: ["tradesea"],
  },
  wealthcharts: {
    name: "WealthCharts",
    category: "platform",
    icon: "wealthcharts.png",
    subtitle: "Orders & Fills CSV Export",
    defaultTimeZone: "America/Chicago",
    platform: "wealthcharts",
    gateway: "Apex / CQG",
    priority: 12,
    namePatterns: ["wealthcharts"],
  },
  metatrader: {
    name: "MetaTrader 5 / 4",
    category: "platform",
    icon: "metatrader5.png",
    subtitle: "HTML & XML Reports",
    defaultFormat: "metatrader",
    dateFormat: "ISO",
    platform: "metatrader5",
    priority: 13,
    popular: true,
    aliases: ["metatrader5", "metatrader4", "mt4", "mt5"],
    namePatterns: ["metatrader", "mt5", "mt4"],
  },
  tradingview: {
    name: "TradingView",
    category: "platform",
    icon: "tradingview.svg",
    subtitle: "Paper Trading Export",
    dateFormat: "ISO",
    priority: 14,
    popular: true,
    namePatterns: ["tradingview"],
  },
  dastrader: {
    name: "DAS Trader Pro",
    category: "platform",
    icon: "dastrader.png",
    subtitle: "Executions Export",
    defaultTimeZone: "America/New_York",
    defaultFormat: "das-trader",
    priority: 15,
    aliases: ["das-trader"],
    namePatterns: ["dastrader", "das-trader"],
  },
  ctrader: {
    name: "cTrader",
    category: "platform",
    icon: "ctrader.png",
    subtitle: "Deals & Statements CSV",
    dateFormat: "ISO",
    platform: "ctrader",
    gateway: "Spotware",
    priority: 16,
    popular: true,
    aliases: ["ctrade"],
    namePatterns: ["ctrader", "ctrade"],
  },
  quantower: {
    name: "Quantower",
    category: "platform",
    icon: "quantower.svg",
    iconDark: "quantower-dark.svg",
    subtitle: "Trades & Orders CSV",
    dateFormat: "ISO",
    platform: "quantower",
    priority: 17,
    namePatterns: ["quantower"],
  },
  sierrachart: {
    name: "Sierra Chart",
    category: "platform",
    icon: "sierrachart.png",
    iconDark: "sierrachart-dark.png",
    subtitle: "Trade Activity Fills Log",
    defaultTimeZone: "America/Chicago",
    dateFormat: "ISO",
    platform: "sierrachart",
    priority: 18,
    namePatterns: ["sierrachart"],
  },
  tc2000: {
    name: "TC2000",
    category: "platform",
    icon: "tc2000.png",
    iconDark: "tc2000-dark.png",
    subtitle: "Trade History CSV",
    defaultTimeZone: "America/New_York",
    platform: "tc2000",
    priority: 19,
    namePatterns: ["tc2000"],
  },
  motivewave: {
    name: "MotiveWave",
    category: "platform",
    icon: "motivewave.png",
    subtitle: "Trades CSV Export",
    defaultTimeZone: "America/New_York",
    platform: "motivewave",
    priority: 20,
    namePatterns: ["motivewave"],
  },
  sterling: {
    name: "Sterling Trader Pro",
    category: "platform",
    icon: "sterling.svg",
    subtitle: "Trading Monitor CSV",
    defaultTimeZone: "America/New_York",
    platform: "sterling",
    priority: 21,
    namePatterns: ["sterling"],
  },
  silexx: {
    name: "Cboe Silexx",
    category: "platform",
    icon: "silexx.svg",
    iconDark: "silexx-dark.svg",
    subtitle: "Order Blotter CSV",
    defaultTimeZone: "America/Chicago",
    platform: "silexx",
    priority: 22,
    namePatterns: ["silexx"],
  },
  matchtrader: {
    name: "Match-Trader",
    category: "platform",
    icon: "matchtrader.png",
    subtitle: "Positions HTML & CSV",
    dateFormat: "ISO",
    platform: "matchtrader",
    priority: 23,
    namePatterns: ["matchtrader"],
  },
  tickblaze: {
    name: "Tickblaze",
    category: "platform",
    icon: "tickblaze.png",
    subtitle: "Filled Orders CSV",
    defaultTimeZone: "America/New_York",
    platform: "tickblaze",
    priority: 24,
    namePatterns: ["tickblaze"],
  },

  // === CRYPTO ===
  hyperliquid: {
    name: "Hyperliquid",
    category: "crypto",
    connectionType: "api",
    icon: "hyperliquid.png",
    subtitle: "Perpetual DEX (API Sync)",
    priority: 25,
    popular: true,
    namePatterns: ["hyperliquid"],
  },
  binance: {
    name: "Binance",
    category: "crypto",
    connectionType: "api",
    icon: "binance.svg",
    subtitle: "Spot & Futures API Sync",
    priority: 26,
    popular: true,
    namePatterns: ["binance"],
  },
  coinbase: {
    name: "Coinbase",
    category: "crypto",
    connectionType: "api",
    icon: "coinbase.svg",
    subtitle: "Spot API & Advanced Trade",
    priority: 27,
    popular: true,
    namePatterns: ["coinbase"],
  },
  kraken: {
    name: "Kraken",
    category: "crypto",
    connectionType: "api",
    icon: "kraken.svg",
    subtitle: "Spot & Margin API",
    priority: 28,
    popular: true,
    namePatterns: ["kraken"],
  },
  bybit: {
    name: "Bybit",
    category: "crypto",
    connectionType: "api",
    icon: "bybit.svg",
    subtitle: "Unified Account API",
    invertInDark: true,
    priority: 29,
    popular: true,
    namePatterns: ["bybit"],
  },
  okx: {
    name: "OKX",
    category: "crypto",
    connectionType: "api",
    icon: "okx.svg",
    subtitle: "API v5 Sync",
    invertInDark: true,
    tvBrokerId: "OKX",
    priority: 30,
    popular: true,
    namePatterns: ["okx"],
  },
  "crypto-com": {
    name: "Crypto.com",
    category: "crypto",
    connectionType: "api",
    icon: "cryptocom.svg",
    subtitle: "Exchange API",
    priority: 31,
    namePatterns: ["crypto.com"],
  },

  // === DIRECT BROKERS (STOCKS, FOREX & CFD) ===
  ibkr: {
    name: "Interactive Brokers",
    category: "stocks",
    connectionType: "api",
    icon: "ibkr.svg",
    subtitle: "Flex Query & Web API",
    defaultFormat: "ibkr-flex",
    dateFormat: "ISO",
    tvBrokerId: "IBKR",
    priority: 32,
    popular: true,
    aliases: ["ibkr-flex", "interactive-brokers"],
    namePatterns: ["ibkr", "interactive brokers"],
  },
  alpaca: {
    name: "Alpaca",
    category: "stocks",
    connectionType: "api",
    icon: "alpaca.svg",
    subtitle: "Commission-free Trading API",
    defaultFormat: "generic-csv",
    dateFormat: "ISO",
    tvBrokerId: "ALPACABROKER",
    priority: 33,
    popular: true,
    namePatterns: ["alpaca"],
  },
  webull: {
    name: "Webull",
    category: "stocks",
    connectionType: "api",
    icon: "webull.svg",
    subtitle: "Open API Sync",
    priority: 34,
    popular: true,
    namePatterns: ["webull"],
  },
  tradier: {
    name: "Tradier",
    category: "stocks",
    connectionType: "api",
    icon: "tradier.svg",
    subtitle: "Equities & Options API",
    defaultFormat: "generic-csv",
    priority: 35,
    namePatterns: ["tradier"],
  },
  public: {
    name: "Public",
    category: "stocks",
    connectionType: "api",
    icon: "public.svg",
    subtitle: "Stocks & ETFs API",
    defaultFormat: "generic-csv",
    priority: 36,
    namePatterns: ["public"],
  },
  questrade: {
    name: "Questrade",
    category: "stocks",
    connectionType: "api",
    icon: "questrade.svg",
    subtitle: "API Sync",
    invertInDark: true,
    defaultTimeZone: "America/Toronto",
    dateFormat: "ISO",
    priority: 37,
    namePatterns: ["questrade"],
  },
  trading212: {
    name: "Trading 212",
    category: "stocks",
    connectionType: "api",
    icon: "trading212.png",
    subtitle: "Zero-Commission API",
    defaultTimeZone: "UTC",
    defaultFormat: "generic-csv",
    dateFormat: "DMY",
    priority: 38,
    namePatterns: ["trading 212", "trading212"],
  },
  etrade: {
    name: "E*TRADE",
    category: "stocks",
    connectionType: "api",
    icon: "etrade.png",
    subtitle: "OAuth API Sync",
    priority: 39,
    namePatterns: ["etrade", "e*trade"],
  },
  tradestation: {
    name: "TradeStation",
    category: "stocks",
    icon: "tradestation.svg",
    subtitle: "Orders Records CSV",
    tvBrokerId: "TRADESTATION",
    priority: 40,
    popular: true,
    namePatterns: ["tradestation"],
  },
  thinkorswim: {
    name: "thinkorswim",
    category: "stocks",
    icon: "thinkorswim.png",
    subtitle: "Schwab / TD Statement CSV",
    priority: 41,
    popular: true,
    namePatterns: ["thinkorswim"],
  },
  schwab: {
    name: "Charles Schwab",
    category: "stocks",
    icon: "schwab.png",
    subtitle: "Charles Schwab Statement CSV",
    defaultFormat: "thinkorswim",
    priority: 42,
    popular: true,
    namePatterns: ["schwab"],
  },
  fidelity: {
    name: "Fidelity",
    category: "stocks",
    icon: "fidelity.png",
    subtitle: "Fidelity Statement CSV",
    defaultFormat: "generic-csv",
    priority: 43,
    popular: true,
    namePatterns: ["fidelity"],
  },
  tastytrade: {
    name: "tastytrade",
    category: "stocks",
    icon: "tastytrade.svg",
    subtitle: "tastytrade Orders CSV",
    defaultTimeZone: "America/Chicago",
    priority: 44,
    namePatterns: ["tastytrade"],
  },
  capitalcom: {
    name: "Capital.com",
    category: "forex-cfd",
    icon: "capital-com.svg",
    subtitle: "Trades Report CSV",
    defaultTimeZone: "UTC",
    dateFormat: "ISO",
    priority: 45,
    namePatterns: ["capital.com", "capitalcom"],
  },
  oanda: {
    name: "OANDA",
    category: "forex-cfd",
    icon: "oanda.svg",
    subtitle: "Transaction History CSV",
    defaultTimeZone: "America/New_York",
    priority: 46,
    namePatterns: ["oanda"],
  },
  lightspeed: {
    name: "Lightspeed",
    category: "stocks",
    icon: "lightspeed.png",
    subtitle: "Blotter Executions CSV",
    priority: 47,
    namePatterns: ["lightspeed"],
  },
  b3: {
    name: "B3 / Nelogica Profit",
    category: "stocks",
    icon: "genial-investimentos.svg",
    subtitle: "Nelogica Profit / B3 CSV",
    defaultTimeZone: "America/Sao_Paulo",
    defaultFormat: "generic-csv",
    dateFormat: "DMY",
    priority: 48,
    namePatterns: ["nelogica", "profit", "b3"],
  },
  tradezero: {
    name: "TradeZero",
    category: "stocks",
    icon: "tradezero.svg",
    subtitle: "Trade History CSV",
    tvBrokerId: "TRADEZERO",
    priority: 49,
    popular: true,
    namePatterns: ["tradezero"],
  },
  robinhood: {
    name: "Robinhood",
    category: "stocks",
    icon: "robinhood.svg",
    subtitle: "Account Activity CSV",
    priority: 50,
    popular: true,
    namePatterns: ["robinhood"],
  },
  moomoo: {
    name: "Moomoo",
    category: "stocks",
    icon: "moomoo.svg",
    subtitle: "Order History CSV",
    priority: 51,
    popular: true,
    namePatterns: ["moomoo"],
  },
} as const satisfies Record<string, BrokerDefinition>;

function buildCatalogItem(id: string, def: BrokerDefinition): BrokerCatalogItem {
  const platformMeta = def.platform ? PLATFORM_METADATA[def.platform] : undefined;

  const defaultTz =
    def.defaultTimeZone ??
    (def.category === "crypto"
      ? "UTC"
      : def.category === "prop-firm"
        ? "America/Chicago"
        : def.category === "stocks"
          ? "America/New_York"
          : "UTC");

  const defaultFmt =
    def.defaultFormat ?? (def.category === "crypto" ? "generic-csv" : (def.platform ?? id));

  const defaultDateFmt: DateFormat = def.dateFormat ?? (def.category === "crypto" ? "ISO" : "MDY");

  return Object.freeze({
    id,
    name: def.name,
    category: def.category,
    icon: def.icon,
    iconDark: def.iconDark,
    invertInDark: def.invertInDark,
    status: def.status ?? "active",
    subtitle: def.subtitle,
    connectionType: def.connectionType ?? "csv",
    defaultTimeZone: defaultTz,
    defaultFormat: defaultFmt,
    dateFormat: defaultDateFmt,
    tvBrokerId: def.tvBrokerId,
    platform: def.platform,
    platformName: def.platformName ?? platformMeta?.name,
    platformIcon: def.platformIcon ?? platformMeta?.icon,
    gateway: def.gateway,
    docUrl: def.docUrl,
    officialNote: def.officialNote,
  });
}

// Immutable BROKER_CATALOG sorted by priority
const rawCatalog = (Object.entries(BROKERS_CONFIG) as [string, BrokerDefinition][])
  .map(([id, def]) => ({
    item: buildCatalogItem(id, def),
    priority: def.priority ?? 100,
  }))
  .sort((a, b) => a.priority - b.priority)
  .map((entry) => entry.item);

export const BROKER_CATALOG: BrokerCatalogItem[] = Object.freeze(
  rawCatalog,
) as unknown as BrokerCatalogItem[];

// Fast O(1) Catalog Map
const CATALOG_MAP = new Map<string, BrokerCatalogItem>(
  BROKER_CATALOG.map((item) => [item.id.toLowerCase(), item]),
);

// Reverse alias map
const ALIASES: Record<string, string> = {};
for (const [id, def] of Object.entries(BROKERS_CONFIG) as [string, BrokerDefinition][]) {
  if (def.aliases) {
    for (const alias of def.aliases) {
      ALIASES[alias.toLowerCase()] = id.toLowerCase();
    }
  }
}
Object.freeze(ALIASES);

// Immutable BROKER_METADATA (51 canonical + 10 aliases = 61 keys)
const metadataMap: Record<string, BrokerMetadata> = {};

for (const [id, def] of Object.entries(BROKERS_CONFIG) as [string, BrokerDefinition][]) {
  const catalogItem = CATALOG_MAP.get(id.toLowerCase())!;
  const metadata: BrokerMetadata = Object.freeze({
    id: catalogItem.id,
    name: catalogItem.name,
    defaultTimeZone: catalogItem.defaultTimeZone ?? "UTC",
    defaultFormat: catalogItem.defaultFormat ?? "generic-csv",
    dateFormat: catalogItem.dateFormat ?? "ISO",
    tvBrokerId: catalogItem.tvBrokerId,
    connectionType: catalogItem.connectionType,
    icon: catalogItem.icon,
    iconDark: catalogItem.iconDark,
    category: catalogItem.category,
    platform: catalogItem.platform,
    platformName: catalogItem.platformName,
    platformIcon: catalogItem.platformIcon,
    gateway: catalogItem.gateway,
    docUrl: catalogItem.docUrl,
    officialNote: catalogItem.officialNote,
  });
  metadataMap[id.toLowerCase()] = metadata;

  if (def.aliases) {
    for (const alias of def.aliases) {
      metadataMap[alias.toLowerCase()] = Object.freeze({
        ...metadata,
        id: alias.toLowerCase(),
      });
    }
  }
}

export const BROKER_METADATA: Record<string, BrokerMetadata> = Object.freeze(metadataMap);

const FORMAT_TO_PLATFORM_MAP: Record<string, string> = {
  metatrader: "metatrader5",
  metatrader5: "metatrader5",
  metatrader4: "metatrader5",
  "ibkr-flex": "ibkr",
  "das-trader": "dastrader",
  ctrade: "ctrader",
  "history-tradingview": "tradingview",
  tradervue: "tradervue",
  tradezella: "tradezella",
};

export const formatToPlatformId = (format?: string | null): string | undefined => {
  if (!format) return undefined;
  const f = format.toLowerCase().trim();
  if (f.startsWith("history-meta") || f.startsWith("history-mt5")) return "metatrader5";
  if (FORMAT_TO_PLATFORM_MAP[f]) return FORMAT_TO_PLATFORM_MAP[f];
  if (PLATFORM_METADATA[f]) return f;
  return undefined;
};

export const platformToDefaultBrokerId = (platformId?: string | null): string | undefined => {
  if (!platformId) return undefined;
  const p = platformId.toLowerCase().trim();
  if (p === "metatrader5" || p === "metatrader4") return "metatrader";
  if (p === "ctrader" || p === "ctrade") return "ctrader";
  return p;
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
      connectionType: undefined,
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
    connectionType: metadata?.connectionType ?? catalog?.connectionType,
    subtitle: catalog?.subtitle,
    platform,
    platformName,
    platformIcon,
    gateway: metadata?.gateway ?? catalog?.gateway ?? platformMeta?.gateway,
    docUrl: metadata?.docUrl ?? catalog?.docUrl,
    officialNote: metadata?.officialNote ?? catalog?.officialNote,
  };
};

export interface MinimalAccountLike {
  broker?: string | null;
  platform?: string | null;
  name?: string | null;
}

const NAME_PATTERN_MATCHERS: { id: string; patterns: readonly string[] }[] = [];
for (const item of BROKER_CATALOG) {
  const def = (BROKERS_CONFIG as Record<string, BrokerDefinition>)[item.id];
  if (def?.namePatterns && def.namePatterns.length > 0) {
    NAME_PATTERN_MATCHERS.push({ id: item.id, patterns: def.namePatterns });
  }
}

export const getAccountBrokerInfo = (account?: MinimalAccountLike | null) => {
  if (!account) return undefined;
  const nameLower = (account.name || "").toLowerCase();
  let detectedId: string | null = null;

  if (!account.broker && nameLower) {
    for (const matcher of NAME_PATTERN_MATCHERS) {
      if (matcher.patterns.some((pattern) => nameLower.includes(pattern))) {
        detectedId = matcher.id;
        break;
      }
    }
  }

  return getBrokerInfo(account.broker || detectedId, account.platform);
};

const makePlatformOption = (value: string, label: string): PlatformOption => ({
  value,
  label,
  icon: PLATFORM_METADATA[value]?.icon,
});

export const getPlatformOptionsForBroker = (brokerId?: string | null): PlatformOption[] => {
  const autoOption: PlatformOption = { value: "auto", label: "Auto-detect from statement" };
  if (!brokerId) {
    return [
      autoOption,
      makePlatformOption("tradovate", "Tradovate"),
      makePlatformOption("ninjatrader", "NinjaTrader 8"),
      makePlatformOption("wealthcharts", "WealthCharts"),
      makePlatformOption("rithmic", "Rithmic"),
      makePlatformOption("tradesea", "TradeSea"),
      makePlatformOption("topstepx", "TopstepX"),
      makePlatformOption("metatrader5", "MetaTrader 5"),
      makePlatformOption("ibkr", "Interactive Brokers"),
    ];
  }

  const b = brokerId.toLowerCase().trim();
  const canonicalId = ALIASES[b] ?? b;
  const def = (BROKERS_CONFIG as Record<string, BrokerDefinition>)[canonicalId];

  if (def?.supportedPlatforms && def.supportedPlatforms.length > 0) {
    return [
      ...def.supportedPlatforms.map((p) => makePlatformOption(p, PLATFORM_METADATA[p]?.name ?? p)),
      autoOption,
    ];
  }

  const platformKey = PLATFORM_METADATA[canonicalId]
    ? canonicalId
    : PLATFORM_METADATA[b]
      ? b
      : undefined;
  if (platformKey) {
    return [
      makePlatformOption(platformKey, PLATFORM_METADATA[platformKey]?.name ?? platformKey),
      autoOption,
    ];
  }

  return [
    autoOption,
    makePlatformOption("tradovate", "Tradovate"),
    makePlatformOption("ninjatrader", "NinjaTrader 8"),
    makePlatformOption("ctrader", "cTrader"),
    makePlatformOption("wealthcharts", "WealthCharts"),
    makePlatformOption("rithmic", "Rithmic"),
    makePlatformOption("tradesea", "TradeSea"),
    makePlatformOption("topstepx", "TopstepX"),
    makePlatformOption("metatrader5", "MetaTrader 5"),
    makePlatformOption("ibkr", "Interactive Brokers"),
  ];
};

export interface CompatibilityResult {
  compatible: boolean;
  reason?: string;
}

export const checkPlatformCompatibility = (
  account:
    { broker?: string | null; platform?: string | null; name?: string | null } | null | undefined,
  format?: string | null,
): CompatibilityResult => {
  if (!account || !format) return { compatible: true };
  const detectedPlatform = formatToPlatformId(format);
  if (!detectedPlatform) return { compatible: true };

  const brokerId = account.broker?.toLowerCase().trim();
  const accountPlatform = account.platform?.toLowerCase().trim();

  if (
    brokerId === "generic" ||
    brokerId === "custom" ||
    accountPlatform === "generic" ||
    accountPlatform === "custom"
  ) {
    return { compatible: true };
  }

  if (
    accountPlatform &&
    accountPlatform !== "auto" &&
    (accountPlatform === detectedPlatform ||
      (accountPlatform.includes("metatrader") && detectedPlatform.includes("metatrader")))
  ) {
    return { compatible: true };
  }

  if (brokerId) {
    const brokerAllowed = getPlatformOptionsForBroker(brokerId)
      .map((opt) => opt.value)
      .filter((v) => v !== "auto");

    if (brokerAllowed.length > 0) {
      const isAllowedByBroker = brokerAllowed.some(
        (allowed) =>
          allowed === detectedPlatform ||
          (allowed.includes("metatrader") && detectedPlatform.includes("metatrader")),
      );
      if (!isAllowedByBroker) {
        const brokerMeta = getBrokerMetadata(brokerId);
        const brokerName = brokerMeta?.name || brokerId.toUpperCase();
        const platformMeta = PLATFORM_METADATA[detectedPlatform];
        const platformName = platformMeta?.name || detectedPlatform;
        return {
          compatible: false,
          reason: `Broker/prop firm ${brokerName} does not support platform ${platformName}.`,
        };
      }
    }
  }

  if (
    accountPlatform &&
    accountPlatform !== "auto" &&
    accountPlatform !== detectedPlatform &&
    !(accountPlatform.includes("metatrader") && detectedPlatform.includes("metatrader"))
  ) {
    const accPlatformName = PLATFORM_METADATA[accountPlatform]?.name || accountPlatform;
    const detectedPlatformName = PLATFORM_METADATA[detectedPlatform]?.name || detectedPlatform;
    return {
      compatible: false,
      reason: `Account is configured for ${accPlatformName}, but statement is from ${detectedPlatformName}.`,
    };
  }

  return { compatible: true };
};

export interface DetectedAccountPreset {
  broker?: string;
  platform?: string;
  tab: "prop" | "broker" | "manual";
  suggestedName: string;
  timeZone: string;
  accountNumber?: string;
}

export const getPresetForDetectedStatement = (
  detectedAccount?: string | null,
  detectedFormat?: string | null,
): DetectedAccountPreset => {
  const acc = (detectedAccount || "").trim();
  const format = (detectedFormat || "").toLowerCase().trim();
  const platform =
    formatToPlatformId(format) || (format && format !== "generic-csv" ? format : "tradovate");
  const accUpper = acc.toUpperCase();

  if (accUpper.startsWith("LF")) {
    return {
      broker: "lucid",
      platform: "tradovate",
      tab: "prop",
      suggestedName: `Lucid ${acc}`,
      timeZone: "America/Chicago",
      accountNumber: acc,
    };
  }

  if (accUpper.includes("APEX")) {
    const apexPlatforms = (BROKERS_CONFIG.apex as { supportedPlatforms?: readonly string[] })
      .supportedPlatforms;
    const resolvedPlatform = apexPlatforms?.includes(platform)
      ? platform
      : platform === "wealthcharts"
        ? "wealthcharts"
        : "tradovate";
    return {
      broker: "apex",
      platform: resolvedPlatform,
      tab: "prop",
      suggestedName: `Apex ${acc}`,
      timeZone: "America/Chicago",
      accountNumber: acc,
    };
  }

  if (accUpper.startsWith("TOP") || accUpper.startsWith("TS-")) {
    return {
      broker: "topstep",
      platform: platform === "topstepx" ? "topstepx" : "tradovate",
      tab: "prop",
      suggestedName: `Topstep ${acc}`,
      timeZone: "America/Chicago",
      accountNumber: acc,
    };
  }

  if (accUpper.startsWith("TDFY") || accUpper.includes("TRADEIFY")) {
    return {
      broker: "tradeify",
      platform: "tradovate",
      tab: "prop",
      suggestedName: `Tradeify ${acc}`,
      timeZone: "America/Chicago",
      accountNumber: acc,
    };
  }

  if (accUpper.startsWith("BX-") || accUpper.includes("BULENOX")) {
    return {
      broker: "bulenox",
      platform: "tradovate",
      tab: "prop",
      suggestedName: `Bulenox ${acc}`,
      timeZone: "America/Chicago",
      accountNumber: acc,
    };
  }

  if (platform === "metatrader5" || platform === "metatrader4") {
    return {
      broker: "ftmo",
      platform,
      tab: "prop",
      suggestedName: acc ? `FTMO ${acc}` : "FTMO Account",
      timeZone: "Europe/Helsinki",
      accountNumber: acc,
    };
  }

  if (platform === "ctrader") {
    const isFtmo = accUpper.includes("FTMO");
    return {
      broker: isFtmo ? "ftmo" : "ctrader",
      platform: "ctrader",
      tab: isFtmo ? "prop" : "broker",
      suggestedName: isFtmo
        ? acc
          ? `FTMO ${acc}`
          : "FTMO Account"
        : acc
          ? `cTrader ${acc}`
          : "cTrader Account",
      timeZone: isFtmo ? "Europe/Helsinki" : "UTC",
      accountNumber: acc,
    };
  }

  if (platform === "tradovate") {
    return {
      broker: "tradovate",
      platform: "tradovate",
      tab: "broker",
      suggestedName: acc ? `Tradovate ${acc}` : "Tradovate Account",
      timeZone: "America/Chicago",
      accountNumber: acc,
    };
  }

  if (platform === "ninjatrader") {
    return {
      broker: "ninjatrader",
      platform: "ninjatrader",
      tab: "broker",
      suggestedName: acc ? `NinjaTrader ${acc}` : "NinjaTrader Account",
      timeZone: "America/Chicago",
      accountNumber: acc,
    };
  }

  const defaultMeta = PLATFORM_METADATA[platform];
  return {
    broker: platformToDefaultBrokerId(platform),
    platform,
    tab: "broker",
    suggestedName: acc
      ? `${defaultMeta?.name ?? platform.toUpperCase()} ${acc}`
      : `${defaultMeta?.name ?? platform.toUpperCase()} Account`,
    timeZone: "UTC",
    accountNumber: acc || undefined,
  };
};

export const searchBrokers = (
  query: string,
  options?: { category?: BrokerCategory },
): BrokerCatalogItem[] => {
  const q = query.toLowerCase().trim();
  return BROKER_CATALOG.filter((b) => {
    if (options?.category && b.category !== options.category) return false;
    if (!q) return true;
    return b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q);
  });
};

export const getBrokersByAssetClass = (assetClass: BrokerCategory): BrokerCatalogItem[] => {
  return BROKER_CATALOG.filter((b) => b.category === assetClass);
};
