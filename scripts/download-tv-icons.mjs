import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ICONS_ROOT = join(ROOT, "apps/web/public/assets/icons");
const MANIFEST_PATH = join(ROOT, "apps/web/src/lib/assets/tv-icons-manifest.json");

// Import TradingView connection
const { evaluateAsync, disconnect } =
  await import("/home/jhontavares/tradingview-mcp/src/connection.js");

const TV_LOGO_CDN = "https://s3-symbol-logo.tradingview.com";

// In-memory set of downloaded logoids to avoid duplicate HTTP requests
const downloadedLogos = new Map(); // logoid -> relativePath

async function downloadSvg(logoid, targetRelPath) {
  if (downloadedLogos.has(logoid)) {
    return downloadedLogos.get(logoid);
  }

  const fullPath = join(ICONS_ROOT, targetRelPath);
  mkdirSync(dirname(fullPath), { recursive: true });

  // URLs to try (base or with --big suffix)
  const urls = [`${TV_LOGO_CDN}/${logoid}.svg`, `${TV_LOGO_CDN}/${logoid}--big.svg`];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (text.includes("<svg")) {
          writeFileSync(fullPath, text, "utf8");
          const publicPath = `/assets/icons/${targetRelPath}`;
          downloadedLogos.set(logoid, publicPath);
          return publicPath;
        }
      }
    } catch (err) {
      // Continue to next url
    }
  }

  return null;
}

// Query TV Symbol Search API inside TradingView Desktop session
async function tvSearch(query, searchType = "") {
  try {
    const typeParam = searchType ? `&search_type=${searchType}` : "";
    const url = `https://symbol-search.tradingview.com/symbol_search/v3/?text=${encodeURIComponent(query)}&hl=1&exchange=&lang=en&domain=production${typeParam}`;
    const data = await evaluateAsync(`fetch("${url}").then(r => r.json())`);
    return data.symbols || [];
  } catch (err) {
    console.error(`Error searching "${query}":`, err.message);
    return [];
  }
}

// Query TV Paginated Search API
async function tvSearchPaged(searchType, start = 0) {
  try {
    const url = `https://symbol-search.tradingview.com/symbol_search/v3/?text=&hl=1&exchange=&lang=en&search_type=${searchType}&domain=production&start=${start}`;
    const data = await evaluateAsync(`fetch("${url}").then(r => r.json())`);
    return data.symbols || [];
  } catch (err) {
    console.error(`Error paged search "${searchType}":`, err.message);
    return [];
  }
}

async function main() {
  console.log("=== TradingView MCP Asset Icon Ingestion ===");
  console.log("Connecting to TradingView Desktop via CDP...");

  const manifest = {
    flags: {}, // CURRENCY -> { icon, country }
    indices: {}, // SYMBOL -> { icon, name, logoid }
    commodities: {}, // SYMBOL -> { icon, name, logoid }
    crypto: {}, // SYMBOL -> { icon, name, logoid }
    stocks: {}, // SYMBOL -> { icon, name, logoid }
    funds: {}, // SYMBOL -> { icon, name, logoid }
  };

  // 1. Download Country / Currency Flags
  console.log("\n[1/6] Ingesting Country & Currency Flags...");
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
  };

  for (const [currency, country] of Object.entries(currencyToCountry)) {
    const logoid = `country/${country}`;
    const targetFile = `flags/${currency.toLowerCase()}.svg`;
    const path = await downloadSvg(logoid, targetFile);
    if (path) {
      manifest.flags[currency] = { icon: path, country, logoid };
      process.stdout.write(`✓ ${currency} `);
    }
  }
  console.log(`\nFlags total: ${Object.keys(manifest.flags).length}`);

  // 2. Download Global & US Indices
  console.log("\n[2/6] Ingesting Indices & Futures...");
  const indexQueries = [
    // US Indices & Continuous Futures
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
    // Global Indices
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
        process.stdout.write(`✓ ${item.query} `);
      }
    }
  }
  console.log(`\nIndices total: ${Object.keys(manifest.indices).length}`);

  // 3. Download Commodities (Metals, Energy, Softs, Agriculture)
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
        process.stdout.write(`✓ ${item.query} `);
      }
    }
  }
  console.log(`\nCommodities total: ${Object.keys(manifest.commodities).length}`);

  // 4. Download Top Cryptocurrencies
  console.log("\n[4/6] Ingesting Top Cryptocurrencies...");
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
  ];

  // Also fetch paginated top 100 crypto from TV
  const tvCryptoList = [
    ...(await tvSearchPaged("crypto", 0)),
    ...(await tvSearchPaged("crypto", 50)),
  ];

  const cryptosToProcess = new Set(coreCryptos);
  for (const item of tvCryptoList) {
    if (item.symbol) {
      const clean = item.symbol.replace(/USDT(\.P)?|USD|BUSD/g, "");
      if (clean && clean.length <= 8 && !clean.includes(":")) {
        cryptosToProcess.add(clean);
      }
    }
  }

  for (const coin of cryptosToProcess) {
    // Check direct logoid
    const logoid = `crypto/XTVC${coin}`;
    const targetFile = `crypto/${coin.toLowerCase()}.svg`;
    let path = await downloadSvg(logoid, targetFile);

    // If direct logoid didn't hit, search TV
    if (!path) {
      const results = await tvSearch(`${coin}USD`, "crypto");
      const match = results[0];
      const foundLogo = match?.["base-currency-logoid"] || match?.logoid;
      if (foundLogo) {
        path = await downloadSvg(foundLogo, targetFile);
      }
    }

    if (path) {
      manifest.crypto[coin] = { icon: path, name: coin, logoid };
      process.stdout.write(`✓ ${coin} `);
    }
  }
  console.log(`\nCrypto total: ${Object.keys(manifest.crypto).length}`);

  // 5. Download Top US Equities / Stocks
  console.log("\n[5/6] Ingesting Top Equities & Mega-Caps...");
  const coreStocks = [
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "GOOGL",
    "GOOG",
    "META",
    "TSLA",
    "BRK.B",
    "LLY",
    "AVGO",
    "JPM",
    "UNH",
    "V",
    "XOM",
    "MA",
    "JNJ",
    "HD",
    "PG",
    "COST",
    "ABBV",
    "MRK",
    "CRM",
    "WMT",
    "BAC",
    "AMD",
    "NFLX",
    "PEP",
    "KO",
    "TMO",
    "LIN",
    "WFC",
    "ORCL",
    "ADBE",
    "MCD",
    "CSCO",
    "INTC",
    "QCOM",
    "TXN",
    "AMAT",
    "IBM",
    "NOW",
    "GE",
    "CAT",
    "UBER",
    "DIS",
    "PLTR",
    "COIN",
    "SMCI",
    "ARM",
    "BABA",
    "PYPL",
    "SQ",
    "SHOP",
    "SNOW",
    "PANW",
    "CRWD",
    "MSTR",
    "RIVN",
    "LCID",
    "NIO",
    "HOOD",
    "MARA",
    "RIOT",
    "CLSK",
    "SOFI",
    "PFE",
    "NKE",
    "SBUX",
    "BA",
  ];

  for (const ticker of coreStocks) {
    const results = await tvSearch(ticker, "stock");
    const match = results.find((s) => s.symbol.replace(/<[^>]+>/g, "") === ticker) || results[0];
    if (match && match.logoid) {
      const targetFile = `stocks/${ticker.toLowerCase().replace(/[^a-z0-9]/g, "-")}.svg`;
      const path = await downloadSvg(match.logoid, targetFile);
      if (path) {
        manifest.stocks[ticker] = {
          icon: path,
          name: match.description || ticker,
          logoid: match.logoid,
        };
        process.stdout.write(`✓ ${ticker} `);
      }
    }
  }
  console.log(`\nStocks total: ${Object.keys(manifest.stocks).length}`);

  // 6. Download Major ETFs & Funds
  console.log("\n[6/6] Ingesting Major ETFs & Funds...");
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
        process.stdout.write(`✓ ${fund} `);
      }
    }
  }
  console.log(`\nFunds total: ${Object.keys(manifest.funds).length}`);

  // Write manifest
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`\n=== Ingestion Complete! Manifest saved to ${MANIFEST_PATH} ===`);

  const grandTotal =
    Object.keys(manifest.flags).length +
    Object.keys(manifest.indices).length +
    Object.keys(manifest.commodities).length +
    Object.keys(manifest.crypto).length +
    Object.keys(manifest.stocks).length +
    Object.keys(manifest.funds).length;

  console.log(`Grand Total Icons Downloaded & Cataloged: ${grandTotal}`);

  await disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error during icon ingestion:", err);
  process.exit(1);
});
