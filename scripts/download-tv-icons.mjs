import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ICONS_ROOT = join(ROOT, "apps/web/public/assets/icons");
const MANIFEST_PATH = join(ROOT, "apps/web/src/lib/assets/tv-icons-manifest.json");

// Import TradingView Desktop CDP bridge (configurable via TRADINGVIEW_MCP_PATH)
const tvMcpPath =
  process.env.TRADINGVIEW_MCP_PATH ||
  "/home/jhontavares/tradingview-mcp/src/connection.js";
let evaluateAsync;
let disconnect;
try {
  const mcp = await import(tvMcpPath);
  evaluateAsync = mcp.evaluateAsync;
  disconnect = mcp.disconnect;
} catch {
  // Graceful fallback when CDP bridge is not running
}

const TV_LOGO_CDN = "https://s3-symbol-logo.tradingview.com";

// In-memory cache of SVG text content by logoid (avoids re-fetching over network)
const svgContentCache = new Map(); // logoid -> svgText

// High-speed parallel task runner
async function pMap(items, fn, concurrency = 15) {
  const results = [];
  let index = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

async function downloadSvg(logoid, targetRelPath) {
  if (!logoid) return null;

  const fullPath = join(ICONS_ROOT, targetRelPath);
  mkdirSync(dirname(fullPath), { recursive: true });

  if (existsSync(fullPath)) {
    return `/assets/icons/${targetRelPath}`;
  }

  if (svgContentCache.has(logoid)) {
    const text = svgContentCache.get(logoid);
    writeFileSync(fullPath, text, "utf8");
    return `/assets/icons/${targetRelPath}`;
  }

  const urls = logoid.startsWith("http")
    ? [logoid]
    : [`${TV_LOGO_CDN}/${logoid}.svg`, `${TV_LOGO_CDN}/${logoid}--big.svg`];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (text.includes("<svg")) {
          svgContentCache.set(logoid, text);
          writeFileSync(fullPath, text, "utf8");
          return `/assets/icons/${targetRelPath}`;
        }
      }
    } catch {
      // Continue to next URL candidate
    }
  }

  return null;
}

// Query TV Symbol Search API inside TradingView Desktop context
async function tvSearch(query, searchType = "", extraParams = "") {
  try {
    const typeParam = searchType ? `&search_type=${searchType}` : "";
    const url = `https://symbol-search.tradingview.com/symbol_search/v3/?text=${encodeURIComponent(query)}&hl=1&lang=en&domain=production${typeParam}${extraParams}`;
    const data = await evaluateAsync(`fetch("${url}").then(r => r.json())`);
    return data.symbols || [];
  } catch (err) {
    console.error(`Error searching "${query}":`, err.message);
    return [];
  }
}

// Query TV Paginated Search API
async function tvSearchPaged(searchType, start = 0, extra = "") {
  try {
    const typeParam = searchType ? `&search_type=${searchType}` : "";
    const url = `https://symbol-search.tradingview.com/symbol_search/v3/?text=&hl=1&lang=en&domain=production${typeParam}&start=${start}${extra}`;
    const data = await evaluateAsync(`fetch("${url}").then(r => r.json())`);
    return data.symbols || [];
  } catch (err) {
    console.error(`Error paged search "${searchType}" (start=${start}):`, err.message);
    return [];
  }
}

async function main() {
  console.log("=== TradingView MCP Asset Icon Ingestion (Global Catalog Expansion) ===");
  console.log("Connecting to TradingView Desktop via CDP...");

  const manifest = {
    flags: {}, // ISO COUNTRY or CURRENCY -> { icon, country, logoid }
    indices: {}, // SYMBOL -> { icon, name, logoid }
    commodities: {}, // SYMBOL -> { icon, name, logoid }
    crypto: {}, // SYMBOL -> { icon, name, logoid }
    stocks: {}, // SYMBOL -> { icon, name, logoid }
    b3: {}, // SYMBOL -> { icon, name, logoid }
    funds: {}, // SYMBOL -> { icon, name, logoid }
    brokers: {}, // NAME/SLUG -> { icon, name, slug }
    exchanges: {}, // CODE -> { icon, name, logoid }
  };

  // ==========================================
  // 1. Ingest All 250 World Country Flags + Currencies
  // ==========================================
  console.log("\n[1/6] Ingesting All 250 ISO Country Flags & World Currencies...");
  const isoCountryCodes = [
    "AD",
    "AE",
    "AF",
    "AG",
    "AI",
    "AL",
    "AM",
    "AO",
    "AQ",
    "AR",
    "AS",
    "AT",
    "AU",
    "AW",
    "AX",
    "AZ",
    "BA",
    "BB",
    "BD",
    "BE",
    "BF",
    "BG",
    "BH",
    "BI",
    "BJ",
    "BL",
    "BM",
    "BN",
    "BO",
    "BQ",
    "BR",
    "BS",
    "BT",
    "BV",
    "BW",
    "BY",
    "BZ",
    "CA",
    "CC",
    "CD",
    "CF",
    "CG",
    "CH",
    "CI",
    "CK",
    "CL",
    "CM",
    "CN",
    "CO",
    "CR",
    "CU",
    "CV",
    "CW",
    "CX",
    "CY",
    "CZ",
    "DE",
    "DJ",
    "DK",
    "DM",
    "DO",
    "DZ",
    "EC",
    "EE",
    "EG",
    "EH",
    "ER",
    "ES",
    "ET",
    "EU",
    "FI",
    "FJ",
    "FK",
    "FM",
    "FO",
    "FR",
    "GA",
    "GB",
    "GD",
    "GE",
    "GF",
    "GG",
    "GH",
    "GI",
    "GL",
    "GM",
    "GN",
    "GP",
    "GQ",
    "GR",
    "GS",
    "GT",
    "GU",
    "GW",
    "GY",
    "HK",
    "HM",
    "HN",
    "HR",
    "HT",
    "HU",
    "ID",
    "IE",
    "IL",
    "IM",
    "IN",
    "IO",
    "IQ",
    "IR",
    "IS",
    "IT",
    "JE",
    "JM",
    "JO",
    "JP",
    "KE",
    "KG",
    "KH",
    "KI",
    "KM",
    "KN",
    "KP",
    "KR",
    "KW",
    "KY",
    "KZ",
    "LA",
    "LB",
    "LC",
    "LI",
    "LK",
    "LR",
    "LS",
    "LT",
    "LU",
    "LV",
    "LY",
    "MA",
    "MC",
    "MD",
    "ME",
    "MF",
    "MG",
    "MH",
    "MK",
    "ML",
    "MM",
    "MN",
    "MO",
    "MP",
    "MQ",
    "MR",
    "MS",
    "MT",
    "MU",
    "MV",
    "MW",
    "MX",
    "MY",
    "MZ",
    "NA",
    "NC",
    "NE",
    "NF",
    "NG",
    "NI",
    "NL",
    "NO",
    "NP",
    "NR",
    "NU",
    "NZ",
    "OM",
    "PA",
    "PE",
    "PF",
    "PG",
    "PH",
    "PK",
    "PL",
    "PM",
    "PN",
    "PR",
    "PS",
    "PT",
    "PW",
    "PY",
    "QA",
    "RE",
    "RO",
    "RS",
    "RU",
    "RW",
    "SA",
    "SB",
    "SC",
    "SD",
    "SE",
    "SG",
    "SH",
    "SI",
    "SJ",
    "SK",
    "SL",
    "SM",
    "SN",
    "SO",
    "SR",
    "SS",
    "ST",
    "SV",
    "SX",
    "SY",
    "SZ",
    "TC",
    "TD",
    "TF",
    "TG",
    "TH",
    "TJ",
    "TK",
    "TL",
    "TM",
    "TN",
    "TO",
    "TR",
    "TT",
    "TV",
    "TW",
    "TZ",
    "UA",
    "UG",
    "UM",
    "US",
    "UY",
    "UZ",
    "VA",
    "VC",
    "VE",
    "VG",
    "VI",
    "VN",
    "VU",
    "WF",
    "WS",
    "YE",
    "YT",
    "ZA",
    "ZM",
    "ZW",
  ];

  await pMap(
    isoCountryCodes,
    async (code) => {
      const logoid = `country/${code}`;
      const targetRel = `flags/${code.toLowerCase()}.svg`;
      const path = await downloadSvg(logoid, targetRel);
      if (path) {
        manifest.flags[code] = { icon: path, country: code, logoid };
      }
    },
    20,
  );

  // Map all global currencies (ISO 4217) to country flags
  const currencyToCountry = {
    USD: "US",
    EUR: "EU",
    GBP: "GB",
    JPY: "JP",
    AUD: "AU",
    CAD: "CA",
    CHF: "CH",
    NZD: "NZ",
    BRL: "BR",
    CNY: "CN",
    MXN: "MX",
    ZAR: "ZA",
    SGD: "SG",
    HKD: "HK",
    SEK: "SE",
    NOK: "NO",
    TRY: "TR",
    INR: "IN",
    KRW: "KR",
    PLN: "PL",
    CZK: "CZ",
    HUF: "HU",
    ILS: "IL",
    THB: "TH",
    IDR: "ID",
    MYR: "MY",
    PHP: "PH",
    TWD: "TW",
    AED: "AE",
    SAR: "SA",
    DKK: "DK",
    CLP: "CL",
    COP: "CO",
    PEN: "PE",
    ARS: "AR",
    UYU: "UY",
    PYG: "PY",
    BOB: "BO",
    CRC: "CR",
    DOP: "DO",
    GTQ: "GT",
    HNL: "HN",
    NIO: "NI",
    PAB: "PA",
    JMD: "JM",
    TTD: "TT",
    BBD: "BB",
    BSD: "BS",
    BZD: "BZ",
    XCD: "AG",
    QAR: "QA",
    KWD: "KW",
    BHD: "BH",
    OMR: "OM",
    JOD: "JO",
    EGP: "EG",
    MAD: "MA",
    DZD: "DZ",
    TND: "TN",
    NGN: "NG",
    KES: "KE",
    GHS: "GH",
    UGX: "UG",
    TZS: "TZ",
    ZMW: "ZM",
    BWP: "BW",
    NAD: "NA",
    MUR: "MU",
    ISK: "IS",
    RSD: "RS",
    BGN: "BG",
    RON: "RO",
    BAM: "BA",
    GEL: "GE",
    KZT: "KZ",
    UAH: "UA",
    PKR: "PK",
    BDT: "BD",
    LKR: "LK",
    VND: "VN",
    KHR: "KH",
    MNT: "MN",
    NPR: "NP",
    MVR: "MV",
  };

  // Also save flags by currency code (e.g. flags/eur.svg, flags/usd.svg, flags/brl.svg)
  for (const [cur, country] of Object.entries(currencyToCountry)) {
    const logoid = `country/${country}`;
    const targetRel = `flags/${cur.toLowerCase()}.svg`;
    const path = await downloadSvg(logoid, targetRel);
    if (path) {
      manifest.flags[cur] = { icon: path, country, logoid };
    }
  }
  console.log(`Flags & Currencies ingested: ${Object.keys(manifest.flags).length} entries`);

  // ==========================================
  // 2. Ingest Indices & Continuous Futures
  // ==========================================
  console.log("\n[2/6] Ingesting Indices & Futures...");
  const indexQueries = [
    {
      query: "NQ",
      alias: ["NQ", "MNQ", "US100", "NAS100", "USTEC", "NDX"],
      name: "Nasdaq 100",
      type: "futures",
    },
    {
      query: "ES",
      alias: ["ES", "MES", "US500", "SPX", "SPX500"],
      name: "S&P 500",
      type: "futures",
    },
    {
      query: "YM",
      alias: ["YM", "MYM", "US30", "DJ30", "DJI", "WALLSTREET"],
      name: "Dow Jones 30",
      type: "futures",
    },
    {
      query: "RTY",
      alias: ["RTY", "M2K", "US2000", "RUSSELL"],
      name: "Russell 2000",
      type: "futures",
    },
    { query: "DX", alias: ["DXY", "USDX", "DX"], name: "US Dollar Index", type: "futures" },
    { query: "VIX", alias: ["VIX", "VOLATILITY"], name: "CBOE Volatility Index", type: "index" },
    { query: "DAX", alias: ["DAX", "GER40", "DE40"], name: "DAX 40 Germany", type: "index" },
    { query: "UK100", alias: ["UK100", "FTSE"], name: "FTSE 100 UK", type: "index" },
    {
      query: "NI225",
      alias: ["NI225", "JP225", "JPN225", "NIKKEI"],
      name: "Nikkei 225 Japan",
      type: "index",
    },
    { query: "SX5E", alias: ["EU50", "STOXX50"], name: "Euro Stoxx 50", type: "index" },
    { query: "PX1", alias: ["PX1", "CAC40", "FRA40"], name: "CAC 40 France", type: "index" },
    { query: "IBEX", alias: ["IBEX", "ESP35", "IBEX35"], name: "IBEX 35 Spain", type: "index" },
    { query: "AUS200", alias: ["AUS200", "ASX200"], name: "ASX 200 Australia", type: "index" },
    { query: "HSI", alias: ["HSI", "HK50"], name: "Hang Seng Hong Kong", type: "index" },
    {
      query: "IBOV",
      alias: ["IBOV", "IBOVESPA", "WIN", "WIN1!"],
      name: "Ibovespa Brasil",
      type: "index",
    },
  ];

  for (const item of indexQueries) {
    const results = await tvSearch(item.query, item.type);
    const match = results[0];
    if (match && match.logoid) {
      const fileName = `${item.query.toLowerCase().replace(/[^a-z0-9]/g, "-")}.svg`;
      const path = await downloadSvg(match.logoid, `indices/${fileName}`);
      if (path) {
        for (const a of item.alias) {
          manifest.indices[a] = { icon: path, name: item.name, logoid: match.logoid };
        }
      }
    }
  }
  console.log(`Indices ingested: ${Object.keys(manifest.indices).length} aliases`);

  // ==========================================
  // 3. Ingest Commodities
  // ==========================================
  console.log("\n[3/6] Ingesting Commodities...");
  const commodityQueries = [
    { query: "GC", alias: ["GC", "MGC", "GOLD", "XAUUSD"], name: "Gold", type: "futures" },
    { query: "SI", alias: ["SI", "MSI", "SILVER", "XAGUSD"], name: "Silver", type: "futures" },
    { query: "HG", alias: ["HG", "COPPER"], name: "Copper", type: "futures" },
    { query: "PL", alias: ["PL", "PLATINUM", "XPTUSD"], name: "Platinum", type: "futures" },
    { query: "PA", alias: ["PA", "PALLADIUM", "XPDUSD"], name: "Palladium", type: "futures" },
    {
      query: "CL",
      alias: ["CL", "MCL", "QM", "USOIL", "WTI"],
      name: "Crude Oil WTI",
      type: "futures",
    },
    { query: "BRENT", alias: ["BRENT", "UKOIL"], name: "Brent Oil", type: "commodity" },
    { query: "NG", alias: ["NG", "NATGAS"], name: "Natural Gas", type: "futures" },
    { query: "KC", alias: ["KC", "COFFEE"], name: "Coffee", type: "futures" },
    { query: "SB", alias: ["SB", "SUGAR"], name: "Sugar", type: "futures" },
    { query: "CT", alias: ["CT", "COTTON"], name: "Cotton", type: "futures" },
    { query: "CC", alias: ["CC", "COCOA"], name: "Cocoa", type: "futures" },
    { query: "ZC", alias: ["ZC", "CORN"], name: "Corn", type: "futures" },
    { query: "ZW", alias: ["ZW", "WHEAT"], name: "Wheat", type: "futures" },
    { query: "ZS", alias: ["ZS", "SOYBEAN"], name: "Soybeans", type: "futures" },
  ];

  for (const item of commodityQueries) {
    const results = await tvSearch(item.query, item.type);
    const match = results[0];
    if (match && match.logoid) {
      const fileName = `${item.query.toLowerCase().replace(/[^a-z0-9]/g, "-")}.svg`;
      const path = await downloadSvg(match.logoid, `commodities/${fileName}`);
      if (path) {
        for (const a of item.alias) {
          manifest.commodities[a] = { icon: path, name: item.name, logoid: match.logoid };
        }
      }
    }
  }
  console.log(`Commodities ingested: ${Object.keys(manifest.commodities).length} aliases`);

  // ==========================================
  // 4. Ingest Top 300+ Cryptocurrencies
  // ==========================================
  console.log("\n[4/6] Ingesting Top 300+ Cryptocurrencies...");
  const coreCryptos = [
    "BTC",
    "ETH",
    "SOL",
    "XRP",
    "DOGE",
    "ADA",
    "AVAX",
    "LINK",
    "DOT",
    "NEAR",
    "BNB",
    "SUI",
    "PEPE",
    "SHIB",
    "LTC",
    "BCH",
    "UNI",
    "POL",
    "TRX",
    "TON",
    "XLM",
    "ICP",
    "ETC",
    "FIL",
    "HBAR",
    "APT",
    "RENDER",
    "TAO",
    "INJ",
    "ATOM",
    "FET",
    "TIA",
    "OP",
    "ARB",
    "RUNE",
    "AAVE",
    "MKR",
    "PENDLE",
    "FTM",
    "ALGO",
    "KAS",
    "USDT",
    "USDC",
    "DAI",
    "WLD",
    "ENA",
    "ONDO",
    "SEI",
    "BONK",
    "FLOKI",
    "WIF",
    "JUP",
    "PYTH",
    "BLUR",
    "STX",
    "IMX",
    "GRT",
    "RNDR",
    "SAND",
    "MANA",
  ];

  const cryptoMap = new Map();
  for (const c of coreCryptos) {
    cryptoMap.set(c, { coin: c, logoid: `crypto/XTVC${c}`, desc: c });
  }

  const excludedTickers = new Set([
    "AAPL",
    "NVDA",
    "TSLA",
    "MSFT",
    "AMZN",
    "GOOGL",
    "META",
    "AMD",
    "COIN",
    "TOTAL",
    "TOTAL3",
    "OTHERS",
    "DXY",
    "SPX",
    "US500",
    "US100",
    "US30",
    "GOLD",
    "SILVER",
  ]);

  // Page through TradingView crypto database
  for (let start = 0; start < 1000; start += 50) {
    const page = await tvSearchPaged("crypto", start);
    for (const item of page) {
      const logoid = item["base-currency-logoid"] || item.logoid;
      let coin = item.base_currency_id || item.symbol;
      if (coin) {
        coin = coin
          .replace(/USDT(\.P)?|USD|BUSD|EUR|BTC/g, "")
          .replace(/<[^>]+>/g, "")
          .trim()
          .toUpperCase();
      }
      if (
        coin &&
        logoid &&
        coin.length >= 2 &&
        coin.length <= 10 &&
        !coin.includes(":") &&
        !coin.startsWith(".") &&
        !excludedTickers.has(coin) &&
        !cryptoMap.has(coin)
      ) {
        cryptoMap.set(coin, { coin, logoid, desc: item.description || coin });
      }
    }
  }

  const cryptoList = Array.from(cryptoMap.values());
  console.log(`Found ${cryptoList.length} distinct crypto coins. Downloading logos...`);

  await pMap(
    cryptoList,
    async (item) => {
      const targetRel = `crypto/${item.coin.toLowerCase().replace(/[^a-z0-9]/g, "-")}.svg`;
      let path = await downloadSvg(item.logoid, targetRel);
      if (!path) {
        const results = await tvSearch(`${item.coin}USD`, "crypto");
        const foundLogo = results[0]?.["base-currency-logoid"] || results[0]?.logoid;
        if (foundLogo) {
          path = await downloadSvg(foundLogo, targetRel);
        }
      }
      if (path) {
        manifest.crypto[item.coin] = {
          icon: path,
          name: item.desc || item.coin,
          logoid: item.logoid,
        };
      }
    },
    20,
  );
  console.log(`Crypto total ingested: ${Object.keys(manifest.crypto).length} coins`);

  // ==========================================
  // 5. Ingest S&P 500, Nasdaq 100 & US Equities (~600 stocks)
  // ==========================================
  console.log("\n[5/6] Ingesting US Equities (S&P 500 & Nasdaq 100 constituents)...");
  const usStocksMap = new Map();

  for (let start = 0; start < 650; start += 50) {
    const page = await tvSearchPaged("stock", start, "&country=US");
    for (const item of page) {
      const symbol = item.symbol
        ?.replace(/<[^>]+>/g, "")
        .trim()
        .toUpperCase();
      if (symbol && item.logoid && !usStocksMap.has(symbol)) {
        usStocksMap.set(symbol, {
          symbol,
          logoid: item.logoid,
          desc: item.description || symbol,
          type: item.type,
        });
      }
    }
  }

  const usStocksList = Array.from(usStocksMap.values());
  console.log(`Found ${usStocksList.length} US stocks with logos. Downloading...`);

  await pMap(
    usStocksList,
    async (item) => {
      const targetRel = `stocks/${item.symbol.toLowerCase().replace(/[^a-z0-9]/g, "-")}.svg`;
      const path = await downloadSvg(item.logoid, targetRel);
      if (path) {
        manifest.stocks[item.symbol] = {
          icon: path,
          name: item.desc,
          logoid: item.logoid,
        };
      }
    },
    20,
  );
  console.log(`US Stocks total ingested: ${Object.keys(manifest.stocks).length} stocks`);

  // ==========================================
  // 6. Ingest B3 / Brazilian Equities (~100-150 stocks)
  // ==========================================
  console.log("\n[6/6] Ingesting B3 / Brazilian Equities (Ibovespa & Top Traded)...");
  const b3Map = new Map();

  for (let start = 0; start < 200; start += 50) {
    const page = await tvSearchPaged("stock", start, "&exchange=BMFBOVESPA");
    for (const item of page) {
      const symbol = item.symbol
        ?.replace(/<[^>]+>/g, "")
        .trim()
        .toUpperCase();
      if (symbol && item.logoid && !b3Map.has(symbol)) {
        b3Map.set(symbol, { symbol, logoid: item.logoid, desc: item.description || symbol });
      }
    }
  }

  const b3List = Array.from(b3Map.values());
  console.log(`Found ${b3List.length} B3 stocks with logos. Downloading...`);

  await pMap(
    b3List,
    async (item) => {
      const targetRel = `b3/${item.symbol.toLowerCase().replace(/[^a-z0-9]/g, "-")}.svg`;
      const path = await downloadSvg(item.logoid, targetRel);
      if (path) {
        manifest.b3[item.symbol] = {
          icon: path,
          name: item.desc,
          logoid: item.logoid,
        };
        // Also map to stocks for universal symbol lookup
        if (!manifest.stocks[item.symbol]) {
          manifest.stocks[item.symbol] = manifest.b3[item.symbol];
        }
      }
    },
    20,
  );
  console.log(`B3 Stocks total ingested: ${Object.keys(manifest.b3).length} stocks`);

  // ==========================================
  // 7. Ingest Major Global ETFs & Funds
  // ==========================================
  console.log("\n[7/7] Ingesting Major ETFs & Funds...");
  const coreFunds = [
    "SPY",
    "QQQ",
    "IWM",
    "DIA",
    "VOO",
    "VTI",
    "TLT",
    "GLD",
    "SLV",
    "USO",
    "UNG",
    "TQQQ",
    "SQQQ",
    "SOXX",
    "SOXL",
    "SMH",
    "XLE",
    "XLF",
    "XLK",
    "XLV",
    "XLI",
    "XLP",
    "XLU",
    "XLB",
    "XLRE",
    "XLC",
    "ARKK",
    "HYG",
    "LQD",
    "EEM",
    "EFA",
    "FXI",
    "EWZ",
    "EWJ",
    "BOVA11",
    "SMAL11",
    "IVVB11",
    "HASH11",
  ];

  for (const fund of coreFunds) {
    const results = await tvSearch(fund);
    const match = results.find((s) => s.symbol.replace(/<[^>]+>/g, "") === fund) || results[0];
    if (match && match.logoid) {
      const targetFile = `funds/${fund.toLowerCase()}.svg`;
      const path = await downloadSvg(match.logoid, targetFile);
      if (path) {
        manifest.funds[fund] = {
          icon: path,
          name: match.description || fund,
          logoid: match.logoid,
        };
      }
    }
  }
  console.log(`Funds ingested: ${Object.keys(manifest.funds).length} funds`);

  // ==========================================
  // 8. Ingest Official TradingView Brokers & Exchanges
  // ==========================================
  console.log("\n[8/8] Ingesting Official Brokers & Exchanges...");
  try {
    const tvBrokers = await evaluateAsync(
      `fetch("https://www.tradingview.com/api/v1/brokers/").then(r => r.json())`,
    );
    if (Array.isArray(tvBrokers)) {
      for (const b of tvBrokers) {
        if (b.logo_square && b.logo_square.endsWith(".svg")) {
          const fileName = `${b.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}.svg`;
          const path = await downloadSvg(b.logo_square, `brokers/${fileName}`);
          if (path) {
            manifest.brokers[b.name] = { icon: path, name: b.name, slug: b.slug_name };
            if (b.slug_name) {
              manifest.brokers[b.slug_name] = manifest.brokers[b.name];
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Error fetching TV brokers:", err.message);
  }

  // Also ingest well-known popular brokers & prop firms
  const extraBrokers = [
    { name: "Tradovate", url: "https://s3.tradingview.com/brokers/logo/tradovate.svg" },
    { name: "OANDA", logoid: "source/OANDA" },
    { name: "Charles Schwab", logoid: "schwab" },
    { name: "Robinhood", logoid: "robinhood" },
    { name: "Fidelity", logoid: "fidelity" },
    { name: "Coinbase", logoid: "source/COINBASE" },
    { name: "Bybit", logoid: "source/BYBIT" },
    { name: "OKX", logoid: "source/OKX" },
    { name: "Kraken", logoid: "source/KRAKEN" },
    { name: "Interactive Brokers", logoid: "interactive-brokers-group" },
  ];

  for (const eb of extraBrokers) {
    const targetFile = `brokers/${eb.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}.svg`;
    const source = eb.url || eb.logoid;
    const path = await downloadSvg(source, targetFile);
    if (path) {
      manifest.brokers[eb.name] = { icon: path, name: eb.name };
      manifest.brokers[eb.name.toUpperCase().replace(/[^A-Z0-9]/g, "")] = manifest.brokers[eb.name];
    }
  }
  console.log(`Brokers ingested: ${Object.keys(manifest.brokers).length} entries`);

  // Ingest Global Exchanges & Execution Venues
  const exchanges = [
    { id: "CME", name: "Chicago Mercantile Exchange", logoid: "source/CME" },
    { id: "NYMEX", name: "New York Mercantile Exchange", logoid: "source/NYMEX" },
    { id: "COMEX", name: "Commodity Exchange", logoid: "source/COMEX" },
    { id: "CBOT", name: "Chicago Board of Trade", logoid: "source/CBOT" },
    { id: "NASDAQ", name: "Nasdaq Stock Market", logoid: "source/NASDAQ" },
    { id: "NYSE", name: "New York Stock Exchange", logoid: "source/NYSE" },
    { id: "BMFBOVESPA", name: "B3 - Brasil Bolsa Balcão", logoid: "source/BMFBOVESPA" },
    { id: "B3", name: "B3 - Brasil Bolsa Balcão", logoid: "source/BMFBOVESPA" },
    { id: "CBOE", name: "Chicago Board Options Exchange", logoid: "source/CBOE" },
    { id: "EUREX", name: "Eurex Exchange", logoid: "source/EUREX" },
    { id: "LSE", name: "London Stock Exchange", logoid: "source/LSE" },
    { id: "FWB", name: "Frankfurt Stock Exchange", logoid: "source/FWB" },
  ];

  for (const ex of exchanges) {
    const targetFile = `exchanges/${ex.id.toLowerCase()}.svg`;
    const path = await downloadSvg(ex.logoid, targetFile);
    if (path) {
      manifest.exchanges[ex.id] = { icon: path, name: ex.name, logoid: ex.logoid };
    }
  }
  console.log(`Exchanges ingested: ${Object.keys(manifest.exchanges).length} entries`);

  // Write manifest
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`\n=== Ingestion Complete! Manifest saved to ${MANIFEST_PATH} ===`);

  const grandTotal =
    Object.keys(manifest.flags).length +
    Object.keys(manifest.indices).length +
    Object.keys(manifest.commodities).length +
    Object.keys(manifest.crypto).length +
    Object.keys(manifest.stocks).length +
    Object.keys(manifest.funds).length +
    Object.keys(manifest.brokers).length +
    Object.keys(manifest.exchanges).length;

  console.log(`Grand Total Catalog Entries: ${grandTotal}`);
  console.log(`Total Unique Physical SVGs Cached: ${svgContentCache.size}`);

  await disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error during icon ingestion:", err);
  process.exit(1);
});
