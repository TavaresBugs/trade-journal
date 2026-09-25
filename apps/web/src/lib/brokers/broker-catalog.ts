import type { BrokerCatalogItem } from "@/types/import";

export type { BrokerCatalogItem };

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
  icon?: string;
  iconDark?: string;
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

export const BROKER_CATALOG: BrokerCatalogItem[] = [
  // Prop Firms (Evaluations & Funded Accounts)
  {
    id: "topstep",
    name: "Topstep",
    category: "prop-firm",
    connectionType: "api",
    icon: "topstep.png",
    status: "active",
    subtitle: "ProjectX API Sync",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "topstepx",
    dateFormat: "ISO",
    platform: "topstepx",
    platformName: "TopstepX",
    platformIcon: "topstep.png",
  },
  {
    id: "lucid",
    name: "Lucid Trading",
    category: "prop-firm",
    connectionType: "csv",
    icon: "lucid.png",
    status: "active",
    subtitle: "Futures Prop (CSV Import)",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "tradovate",
    dateFormat: "MDY",
    platform: "tradovate",
    platformName: "Tradovate",
    platformIcon: "tradovate.svg",
    officialNote: "Lucid accounts execute through Tradovate, NinjaTrader, or Rithmic.",
  },
  {
    id: "apex",
    name: "Apex Trader Funding",
    category: "prop-firm",
    connectionType: "csv",
    icon: "apex.png",
    status: "active",
    subtitle: "Futures Prop (CSV Import)",
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
    connectionType: "csv",
    icon: "ftmo-light.svg",
    iconDark: "ftmo-dark.svg",
    status: "active",
    subtitle: "Forex & CFD (MT5 Import)",
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
    connectionType: "csv",
    icon: "bulenox.png",
    status: "active",
    subtitle: "Futures Prop (CSV Import)",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "tradovate",
    dateFormat: "MDY",
    platform: "tradovate",
    platformName: "Tradovate",
    platformIcon: "tradovate.svg",
  },
  {
    id: "tradeify",
    name: "Tradeify",
    category: "prop-firm",
    connectionType: "csv",
    icon: "tradeify.png",
    status: "active",
    subtitle: "Futures Prop (CSV Import)",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "tradovate",
    dateFormat: "MDY",
    platform: "tradovate",
    platformName: "Tradovate",
    platformIcon: "tradovate.svg",
    officialNote: "Tradeify accounts execute through Tradovate, NinjaTrader, or ProjectX.",
  },

  // Execution Platforms & Gateways
  {
    id: "tradovate",
    name: "Tradovate",
    category: "platform",
    connectionType: "csv",
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
    category: "platform",
    connectionType: "csv",
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
    id: "topstepx",
    name: "TopstepX",
    category: "platform",
    connectionType: "csv",
    icon: "topstep.png",
    status: "active",
    subtitle: "Orders Fills Export",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "topstepx",
    dateFormat: "ISO",
    platform: "topstepx",
    platformName: "TopstepX",
    platformIcon: "topstep.png",
  },
  {
    id: "rithmic",
    name: "Rithmic",
    category: "platform",
    connectionType: "csv",
    icon: "rithmic.png",
    status: "active",
    subtitle: "Order History CSV Export",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "generic-csv",
    dateFormat: "MDY",
    platform: "rithmic",
    platformName: "Rithmic",
    platformIcon: "rithmic.png",
  },
  {
    id: "tradesea",
    name: "TradeSea",
    category: "platform",
    connectionType: "csv",
    icon: "tradesea.png",
    status: "active",
    subtitle: "TradeSea Executions Export",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "generic-csv",
    dateFormat: "MDY",
    platform: "tradesea",
    platformName: "TradeSea",
    platformIcon: "tradesea.png",
  },
  {
    id: "wealthcharts",
    name: "WealthCharts",
    category: "platform",
    connectionType: "csv",
    icon: "wealthcharts.png",
    status: "active",
    subtitle: "Orders & Fills CSV Export",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "wealthcharts",
    dateFormat: "MDY",
    platform: "wealthcharts",
    platformName: "WealthCharts",
    platformIcon: "wealthcharts.png",
    gateway: "Apex / CQG",
  },
  {
    id: "metatrader",
    name: "MetaTrader 5 / 4",
    category: "platform",
    connectionType: "csv",
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
    connectionType: "csv",
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
    connectionType: "csv",
    icon: "dastrader.png",
    status: "active",
    subtitle: "Executions Export",
    defaultTimeZone: "America/New_York",
    defaultFormat: "das-trader",
    dateFormat: "MDY",
  },
  {
    id: "ctrader",
    name: "cTrader",
    category: "platform",
    connectionType: "csv",
    icon: "ctrader.png",
    status: "active",
    subtitle: "Deals & Statements CSV",
    defaultTimeZone: "UTC",
    defaultFormat: "ctrader",
    dateFormat: "ISO",
    platform: "ctrader",
    platformName: "cTrader",
    platformIcon: "ctrader.png",
    gateway: "Spotware",
  },
  {
    id: "quantower",
    name: "Quantower",
    category: "platform",
    connectionType: "csv",
    icon: "quantower.svg",
    iconDark: "quantower-dark.svg",
    status: "active",
    subtitle: "Trades & Orders CSV",
    defaultTimeZone: "UTC",
    defaultFormat: "quantower",
    dateFormat: "ISO",
    platform: "quantower",
    platformName: "Quantower",
    platformIcon: "quantower.svg",
  },
  {
    id: "sierrachart",
    name: "Sierra Chart",
    category: "platform",
    connectionType: "csv",
    icon: "sierrachart.png",
    iconDark: "sierrachart-dark.png",
    status: "active",
    subtitle: "Trade Activity Fills Log",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "sierrachart",
    dateFormat: "ISO",
    platform: "sierrachart",
    platformName: "Sierra Chart",
    platformIcon: "sierrachart.png",
  },
  {
    id: "tc2000",
    name: "TC2000",
    category: "platform",
    connectionType: "csv",
    icon: "tc2000.png",
    iconDark: "tc2000-dark.png",
    status: "active",
    subtitle: "Trade History CSV",
    defaultTimeZone: "America/New_York",
    defaultFormat: "tc2000",
    dateFormat: "MDY",
    platform: "tc2000",
    platformName: "TC2000",
    platformIcon: "tc2000.png",
  },
  {
    id: "motivewave",
    name: "MotiveWave",
    category: "platform",
    connectionType: "csv",
    icon: "motivewave.png",
    status: "active",
    subtitle: "Trades CSV Export",
    defaultTimeZone: "America/New_York",
    defaultFormat: "motivewave",
    dateFormat: "MDY",
    platform: "motivewave",
    platformName: "MotiveWave",
    platformIcon: "motivewave.png",
  },
  {
    id: "sterling",
    name: "Sterling Trader Pro",
    category: "platform",
    connectionType: "csv",
    icon: "sterling.svg",
    status: "active",
    subtitle: "Trading Monitor CSV",
    defaultTimeZone: "America/New_York",
    defaultFormat: "sterling",
    dateFormat: "MDY",
    platform: "sterling",
    platformName: "Sterling Trader Pro",
    platformIcon: "sterling.svg",
  },
  {
    id: "silexx",
    name: "Cboe Silexx",
    category: "platform",
    connectionType: "csv",
    icon: "silexx.svg",
    iconDark: "silexx-dark.svg",
    status: "active",
    subtitle: "Order Blotter CSV",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "silexx",
    dateFormat: "MDY",
    platform: "silexx",
    platformName: "Cboe Silexx",
    platformIcon: "silexx.svg",
  },
  {
    id: "matchtrader",
    name: "Match-Trader",
    category: "platform",
    connectionType: "csv",
    icon: "matchtrader.png",
    status: "active",
    subtitle: "Positions HTML & CSV",
    defaultTimeZone: "UTC",
    defaultFormat: "matchtrader",
    dateFormat: "ISO",
    platform: "matchtrader",
    platformName: "Match-Trader",
    platformIcon: "matchtrader.png",
  },
  {
    id: "tickblaze",
    name: "Tickblaze",
    category: "platform",
    connectionType: "csv",
    icon: "tickblaze.png",
    status: "active",
    subtitle: "Filled Orders CSV",
    defaultTimeZone: "America/New_York",
    defaultFormat: "tickblaze",
    dateFormat: "MDY",
    platform: "tickblaze",
    platformName: "Tickblaze",
    platformIcon: "tickblaze.png",
  },

  // Crypto Exchanges (Direct API Sync)
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    category: "crypto",
    connectionType: "api",
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
    connectionType: "api",
    icon: "binance.svg",
    status: "active",
    subtitle: "Spot & Futures API Sync",
    defaultTimeZone: "UTC",
    defaultFormat: "generic-csv",
    dateFormat: "ISO",
  },
  {
    id: "coinbase",
    name: "Coinbase",
    category: "crypto",
    connectionType: "api",
    icon: "coinbase.svg",
    status: "active",
    subtitle: "Spot API & Advanced Trade",
    defaultTimeZone: "UTC",
    defaultFormat: "generic-csv",
    dateFormat: "ISO",
  },
  {
    id: "kraken",
    name: "Kraken",
    category: "crypto",
    connectionType: "api",
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
    connectionType: "api",
    icon: "bybit.svg",
    status: "active",
    subtitle: "Unified Account API",
    invertInDark: true,
    defaultTimeZone: "UTC",
    defaultFormat: "generic-csv",
    dateFormat: "ISO",
  },
  {
    id: "okx",
    name: "OKX",
    category: "crypto",
    connectionType: "api",
    icon: "okx.svg",
    status: "active",
    subtitle: "API v5 Sync",
    invertInDark: true,
    defaultTimeZone: "UTC",
    defaultFormat: "generic-csv",
    dateFormat: "ISO",
    tvBrokerId: "OKX",
  },
  {
    id: "crypto-com",
    name: "Crypto.com",
    category: "crypto",
    connectionType: "api",
    icon: "cryptocom.svg",
    status: "active",
    subtitle: "Exchange API",
    defaultTimeZone: "UTC",
    defaultFormat: "generic-csv",
    dateFormat: "ISO",
  },

  // Direct Brokers (Forex, CFDs & Stocks)
  // 1. API Sync Supported
  {
    id: "ibkr",
    name: "Interactive Brokers",
    category: "stocks",
    connectionType: "api",
    icon: "ibkr.svg",
    status: "active",
    subtitle: "Flex Query & Web API",
    defaultTimeZone: "America/New_York",
    defaultFormat: "ibkr-flex",
    dateFormat: "ISO",
    tvBrokerId: "IBKR",
  },
  {
    id: "alpaca",
    name: "Alpaca",
    category: "stocks",
    connectionType: "api",
    icon: "alpaca.svg",
    status: "active",
    subtitle: "Commission-free Trading API",
    defaultTimeZone: "America/New_York",
    defaultFormat: "generic-csv",
    dateFormat: "ISO",
    tvBrokerId: "ALPACABROKER",
  },
  {
    id: "webull",
    name: "Webull",
    category: "stocks",
    connectionType: "api",
    icon: "webull.svg",
    status: "active",
    subtitle: "Open API Sync",
    defaultTimeZone: "America/New_York",
    defaultFormat: "webull",
    dateFormat: "MDY",
  },
  {
    id: "tradier",
    name: "Tradier",
    category: "stocks",
    connectionType: "api",
    icon: "tradier.svg",
    status: "active",
    subtitle: "Equities & Options API",
    defaultTimeZone: "America/New_York",
    defaultFormat: "generic-csv",
    dateFormat: "MDY",
  },
  {
    id: "public",
    name: "Public",
    category: "stocks",
    connectionType: "api",
    icon: "public.svg",
    status: "active",
    subtitle: "Stocks & ETFs API",
    defaultTimeZone: "America/New_York",
    defaultFormat: "generic-csv",
    dateFormat: "MDY",
  },
  {
    id: "questrade",
    name: "Questrade",
    category: "stocks",
    connectionType: "api",
    icon: "questrade.svg",
    status: "active",
    subtitle: "API Sync",
    invertInDark: true,
    defaultTimeZone: "America/Toronto",
    defaultFormat: "questrade",
    dateFormat: "ISO",
  },
  {
    id: "trading212",
    name: "Trading 212",
    category: "stocks",
    connectionType: "api",
    icon: "trading212.png",
    status: "active",
    subtitle: "Zero-Commission API",
    defaultTimeZone: "UTC",
    defaultFormat: "generic-csv",
    dateFormat: "DMY",
  },
  {
    id: "etrade",
    name: "E*TRADE",
    category: "stocks",
    connectionType: "api",
    icon: "etrade.png",
    status: "active",
    subtitle: "OAuth API Sync",
    defaultTimeZone: "America/New_York",
    defaultFormat: "etrade",
    dateFormat: "MDY",
  },

  // 2. Statement / CSV Import Supported
  {
    id: "tradestation",
    name: "TradeStation",
    category: "stocks",
    connectionType: "csv",
    icon: "tradestation.svg",
    status: "active",
    subtitle: "Orders Records CSV",
    defaultTimeZone: "America/New_York",
    defaultFormat: "tradestation",
    dateFormat: "MDY",
    tvBrokerId: "TRADESTATION",
  },
  {
    id: "thinkorswim",
    name: "thinkorswim",
    category: "stocks",
    connectionType: "csv",
    icon: "thinkorswim.png",
    status: "active",
    subtitle: "Schwab / TD Statement CSV",
    defaultTimeZone: "America/New_York",
    defaultFormat: "thinkorswim",
    dateFormat: "MDY",
  },
  {
    id: "schwab",
    name: "Charles Schwab",
    category: "stocks",
    connectionType: "csv",
    icon: "schwab.png",
    status: "active",
    subtitle: "Charles Schwab Statement CSV",
    defaultTimeZone: "America/New_York",
    defaultFormat: "thinkorswim",
    dateFormat: "MDY",
  },
  {
    id: "fidelity",
    name: "Fidelity",
    category: "stocks",
    connectionType: "csv",
    icon: "fidelity.png",
    status: "active",
    subtitle: "Fidelity Statement CSV",
    defaultTimeZone: "America/New_York",
    defaultFormat: "generic-csv",
    dateFormat: "MDY",
  },
  {
    id: "tastytrade",
    name: "tastytrade",
    category: "stocks",
    connectionType: "csv",
    icon: "tastytrade.svg",
    status: "active",
    subtitle: "tastytrade Orders CSV",
    defaultTimeZone: "America/Chicago",
    defaultFormat: "tastytrade",
    dateFormat: "MDY",
  },
  {
    id: "capitalcom",
    name: "Capital.com",
    category: "forex-cfd",
    connectionType: "csv",
    icon: "capital-com.svg",
    status: "active",
    subtitle: "Trades Report CSV",
    defaultTimeZone: "UTC",
    defaultFormat: "capitalcom",
    dateFormat: "ISO",
  },
  {
    id: "oanda",
    name: "OANDA",
    category: "forex-cfd",
    connectionType: "csv",
    icon: "oanda.svg",
    status: "active",
    subtitle: "Transaction History CSV",
    defaultTimeZone: "America/New_York",
    defaultFormat: "oanda",
    dateFormat: "MDY",
  },
  {
    id: "lightspeed",
    name: "Lightspeed",
    category: "stocks",
    connectionType: "csv",
    icon: "lightspeed.png",
    status: "active",
    subtitle: "Blotter Executions CSV",
    defaultTimeZone: "America/New_York",
    defaultFormat: "lightspeed",
    dateFormat: "MDY",
  },
  {
    id: "b3",
    name: "B3 / Nelogica Profit",
    category: "stocks",
    connectionType: "csv",
    icon: "genial-investimentos.svg",
    status: "active",
    subtitle: "Nelogica Profit / B3 CSV",
    defaultTimeZone: "America/Sao_Paulo",
    defaultFormat: "generic-csv",
    dateFormat: "DMY",
  },
  {
    id: "tradezero",
    name: "TradeZero",
    category: "stocks",
    connectionType: "csv",
    icon: "tradezero.svg",
    status: "active",
    subtitle: "Trade History CSV",
    defaultTimeZone: "America/New_York",
    defaultFormat: "tradezero",
    dateFormat: "MDY",
    tvBrokerId: "TRADEZERO",
  },
  {
    id: "robinhood",
    name: "Robinhood",
    category: "stocks",
    connectionType: "csv",
    icon: "robinhood.svg",
    status: "active",
    subtitle: "Account Activity CSV",
    defaultTimeZone: "America/New_York",
    defaultFormat: "robinhood",
    dateFormat: "MDY",
  },
  {
    id: "moomoo",
    name: "Moomoo",
    category: "stocks",
    connectionType: "csv",
    icon: "moomoo.svg",
    status: "active",
    subtitle: "Order History CSV",
    defaultTimeZone: "America/New_York",
    defaultFormat: "moomoo",
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
  rtrader: "rithmic",
  "r-trader": "rithmic",
  "das-trader": "dastrader",
  ctrade: "ctrader",
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
      connectionType: item.connectionType,
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
  if (f === "wealthcharts") return "wealthcharts";
  if (f === "rithmic") return "rithmic";
  if (f === "ibkr" || f === "ibkr-flex") return "ibkr";
  if (f === "tradingview" || f === "history-tradingview") return "tradingview";
  if (f === "thinkorswim") return "thinkorswim";
  if (f === "dastrader" || f === "das-trader") return "dastrader";
  if (f === "webull") return "webull";
  if (f === "tradervue") return "tradervue";
  if (f === "tradezella") return "tradezella";
  if (f === "tradezero") return "tradezero";
  if (f === "robinhood") return "robinhood";
  if (f === "moomoo") return "moomoo";
  if (f === "ctrader" || f === "ctrade") return "ctrader";
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

export const getAccountBrokerInfo = (account?: MinimalAccountLike | null) => {
  if (!account) return undefined;
  const nameLower = (account.name || "").toLowerCase();
  const detectedId =
    account.broker ||
    (nameLower.includes("ftmo")
      ? "ftmo"
      : nameLower.includes("topstep")
        ? "topstep"
        : nameLower.includes("apex")
          ? "apex"
          : nameLower.includes("lucid")
            ? "lucid"
            : nameLower.includes("tradesea")
              ? "tradesea"
              : nameLower.includes("bulenox")
                ? "bulenox"
                : nameLower.includes("tradeify")
                  ? "tradeify"
                : nameLower.includes("ninjatrader")
                  ? "ninjatrader"
                  : nameLower.includes("tradovate")
                    ? "tradovate"
                    : nameLower.includes("wealthcharts")
                      ? "wealthcharts"
                      : nameLower.includes("rithmic")
                        ? "rithmic"
                        : nameLower.includes("binance")
                          ? "binance"
                          : nameLower.includes("bybit")
                            ? "bybit"
                            : nameLower.includes("coinbase")
                              ? "coinbase"
                              : nameLower.includes("kraken")
                                ? "kraken"
                                : nameLower.includes("hyperliquid")
                                  ? "hyperliquid"
                                  : nameLower.includes("ibkr") || nameLower.includes("interactive brokers")
                                    ? "ibkr"
                                    : nameLower.includes("alpaca")
                                      ? "alpaca"
                                      : nameLower.includes("webull")
                                        ? "webull"
                                        : nameLower.includes("tradier")
                                          ? "tradier"
                                          : nameLower.includes("robinhood")
                                            ? "robinhood"
                                            : nameLower.includes("moomoo")
                                              ? "moomoo"
                                              : nameLower.includes("ctrader") || nameLower.includes("ctrade")
                                                ? "ctrader"
                                              : nameLower.includes("fidelity")
                                                ? "fidelity"
                                                : nameLower.includes("schwab")
                                                  ? "schwab"
                                                  : nameLower.includes("thinkorswim")
                                                    ? "thinkorswim"
                                                    : nameLower.includes("tradezero")
                                                      ? "tradezero"
                                                      : nameLower.includes("tradingview")
                                                        ? "tradingview"
                                                        : nameLower.includes("metatrader") ||
                                                            nameLower.includes("mt5") ||
                                                            nameLower.includes("mt4")
                                                          ? "metatrader"
                                                          : null);

  return getBrokerInfo(account.broker || detectedId, account.platform);
};

const makePlatformOption = (value: string, label: string): PlatformOption => ({
  value,
  label,
  icon: PLATFORM_METADATA[value]?.icon,
});

export const getPlatformOptionsForBroker = (brokerId?: string | null): PlatformOption[] => {
  if (!brokerId) {
    return [
      { value: "auto", label: "Auto-detect from statement" },
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
  switch (b) {
    case "lucid":
      return [
        makePlatformOption("tradovate", "Tradovate"),
        makePlatformOption("ninjatrader", "NinjaTrader 8"),
        makePlatformOption("tradesea", "TradeSea"),
        makePlatformOption("rithmic", "Rithmic"),
        { value: "auto", label: "Auto-detect from statement" },
      ];
    case "topstep":
      return [
        makePlatformOption("topstepx", "TopstepX"),
        makePlatformOption("tradovate", "Tradovate"),
        makePlatformOption("ninjatrader", "NinjaTrader 8"),
        { value: "auto", label: "Auto-detect from statement" },
      ];
    case "apex":
      return [
        makePlatformOption("tradovate", "Tradovate"),
        makePlatformOption("wealthcharts", "WealthCharts"),
        makePlatformOption("ninjatrader", "NinjaTrader 8"),
        makePlatformOption("rithmic", "Rithmic"),
        { value: "auto", label: "Auto-detect from statement" },
      ];
    case "tradeify":
      return [
        makePlatformOption("tradovate", "Tradovate"),
        makePlatformOption("ninjatrader", "NinjaTrader 8"),
        { value: "auto", label: "Auto-detect from statement" },
      ];
    case "ftmo":
      return [
        makePlatformOption("metatrader5", "MetaTrader 5"),
        makePlatformOption("metatrader4", "MetaTrader 4"),
        makePlatformOption("ctrader", "cTrader"),
        { value: "auto", label: "Auto-detect from statement" },
      ];
    case "bulenox":
      return [
        makePlatformOption("tradovate", "Tradovate"),
        makePlatformOption("rithmic", "Rithmic"),
        makePlatformOption("ninjatrader", "NinjaTrader 8"),
        { value: "auto", label: "Auto-detect from statement" },
      ];
    default:
      if (PLATFORM_METADATA[b]) {
        return [
          makePlatformOption(b, PLATFORM_METADATA[b].name),
          { value: "auto", label: "Auto-detect from statement" },
        ];
      }
      return [
        { value: "auto", label: "Auto-detect from statement" },
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
  }
};

export interface CompatibilityResult {
  compatible: boolean;
  reason?: string;
}

export const checkPlatformCompatibility = (
  account: { broker?: string | null; platform?: string | null; name?: string | null } | null | undefined,
  format?: string | null,
): CompatibilityResult => {
  if (!account || !format) return { compatible: true };
  const detectedPlatform = formatToPlatformId(format);
  if (!detectedPlatform) return { compatible: true }; // Generic or unmapped CSV can be mapped to any account

  const brokerId = account.broker?.toLowerCase().trim();
  const accountPlatform = account.platform?.toLowerCase().trim();

  // Generic or custom accounts accept any platform format
  if (
    brokerId === "generic" ||
    brokerId === "custom" ||
    accountPlatform === "generic" ||
    accountPlatform === "custom"
  ) {
    return { compatible: true };
  }

  // Exact platform match
  if (
    accountPlatform &&
    accountPlatform !== "auto" &&
    (accountPlatform === detectedPlatform ||
      (accountPlatform.includes("metatrader") && detectedPlatform.includes("metatrader")))
  ) {
    return { compatible: true };
  }

  // Check if target broker supports the detected platform
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
          reason: `O corretor/mesa ${brokerName} não opera com a plataforma ${platformName}.`,
        };
      }
    }
  }

  // Explicit platform conflict on the account
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
      reason: `A conta está configurada para ${accPlatformName}, mas o extrato é do ${detectedPlatformName}.`,
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
  const platform = formatToPlatformId(format) || (format && format !== "generic-csv" ? format : "tradovate");

  // Lucid Trading (evaluation account prefix LFE, funded LFF, etc.)
  if (acc.toUpperCase().startsWith("LF")) {
    return {
      broker: "lucid",
      platform: "tradovate",
      tab: "prop",
      suggestedName: `Lucid ${acc}`,
      timeZone: "America/Chicago",
      accountNumber: acc,
    };
  }

  // Apex Trader Funding (PA-APEX-..., APEX-...)
  if (acc.toUpperCase().includes("APEX")) {
    return {
      broker: "apex",
      platform: platform === "wealthcharts" ? "wealthcharts" : "tradovate",
      tab: "prop",
      suggestedName: `Apex ${acc}`,
      timeZone: "America/Chicago",
      accountNumber: acc,
    };
  }

  // Topstep (TOP..., TS-...)
  if (acc.toUpperCase().startsWith("TOP") || acc.toUpperCase().startsWith("TS-")) {
    return {
      broker: "topstep",
      platform: platform === "topstepx" ? "topstepx" : "tradovate",
      tab: "prop",
      suggestedName: `Topstep ${acc}`,
      timeZone: "America/Chicago",
      accountNumber: acc,
    };
  }

  // Tradeify
  if (acc.toUpperCase().startsWith("TDFY") || acc.toUpperCase().includes("TRADEIFY")) {
    return {
      broker: "tradeify",
      platform: "tradovate",
      tab: "prop",
      suggestedName: `Tradeify ${acc}`,
      timeZone: "America/Chicago",
      accountNumber: acc,
    };
  }

  // Bulenox
  if (acc.toUpperCase().startsWith("BX-") || acc.toUpperCase().includes("BULENOX")) {
    return {
      broker: "bulenox",
      platform: "tradovate",
      tab: "prop",
      suggestedName: `Bulenox ${acc}`,
      timeZone: "America/Chicago",
      accountNumber: acc,
    };
  }

  // FTMO MetaTrader / cTrader
  if (platform === "metatrader5" || platform === "metatrader4" || platform === "ctrader") {
    return {
      broker: "ftmo",
      platform,
      tab: "prop",
      suggestedName: acc ? `FTMO ${acc}` : "FTMO Account",
      timeZone: "Europe/Helsinki",
      accountNumber: acc,
    };
  }

  // Direct Tradovate broker
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

  // Direct NinjaTrader broker
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

