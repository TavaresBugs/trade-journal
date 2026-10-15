import { describe, expect, it } from "vitest";
import {
  getBaseAssetCatalog,
  loadExtendedCatalog,
  ASSET_CATALOG,
  getAssetCategory,
} from "../../src/lib/assets/asset-catalog";
import {
  getAssetIconConfig,
  normalizeSymbol,
  getBrokerIcon,
  getExchangeIcon,
} from "../../src/lib/assets/asset-icons";
import {
  getSymbolSpec,
  getPointValue,
  formatSpecBadge,
  isCalculableSymbol,
  getQuantInstrument,
  SYMBOL_SPECS,
} from "../../src/lib/assets/symbol-specs";
import { normalizeSymbol as normalizeSymbolUtils, getAssetFamily } from "../../src/lib/assets/symbol-utils";

describe("Asset Catalog & Dynamic Loader", () => {
  it("synchronously builds base catalog with curated symbols and major forex", () => {
    const base = getBaseAssetCatalog();
    expect(base.length).toBeGreaterThan(60);

    // Verify key futures contracts exist in base catalog with full specs
    const dol = base.find((a) => a.symbol === "DOL");
    expect(dol).toBeDefined();
    expect(dol?.category).toBe("futures");
    expect(dol?.specBadge).toContain("R$50/pt");

    const win = base.find((a) => a.symbol === "WIN");
    expect(win).toBeDefined();
    expect(win?.category).toBe("futures");
    expect(win?.specBadge).toContain("R$0.20/pt");

    const nq = base.find((a) => a.symbol === "NQ");
    expect(nq).toBeDefined();
    expect(nq?.category).toBe("futures");
    expect(nq?.specBadge).toContain("$20/pt");

    // Major forex exists in base
    const eurusd = base.find((a) => a.symbol === "EURUSD");
    expect(eurusd).toBeDefined();
    expect(eurusd?.category).toBe("forex");
  });

  it("categorizes assets accurately across futures, stocks, forex, and crypto", () => {
    expect(getAssetCategory("b3", "WIN")).toBe("futures");
    expect(getAssetCategory("b3", "WDO")).toBe("futures");
    expect(getAssetCategory("b3", "IND")).toBe("futures");
    expect(getAssetCategory("b3", "DOL")).toBe("futures");
    expect(getAssetCategory("b3", "PETR4")).toBe("stocks");
    expect(getAssetCategory("stocks", "AAPL")).toBe("stocks");
    expect(getAssetCategory("crypto", "BTC")).toBe("crypto");
    expect(getAssetCategory("forex", "EURUSD")).toBe("forex");
  });

  it("dynamically loads extended catalog asynchronously on demand", async () => {
    const extended = await loadExtendedCatalog();
    expect(extended.length).toBeGreaterThan(100);

    // Should include extended B3 stocks from manifest
    const hasVale = extended.some((a) => a.symbol === "VALE3");
    expect(hasVale).toBe(true);

    // ASSET_CATALOG proxy should reflect updated catalog
    expect(ASSET_CATALOG.length).toBe(extended.length);
  });
});

describe("Asset Icons Normalization & Dynamic Resolver", () => {
  describe("normalizeSymbol", () => {
    it("strips exchange prefixes", () => {
      expect(normalizeSymbol("CME:NQ")).toBe("NQ");
      expect(normalizeSymbol("FX:EURUSD")).toBe("EURUSD");
      expect(normalizeSymbol("BINANCE:BTCUSDT")).toBe("BTCUSDT");
    });

    it("strips delimiters", () => {
      expect(normalizeSymbol("EUR/USD")).toBe("EURUSD");
      expect(normalizeSymbol("BTC-USDT")).toBe("BTCUSDT");
      expect(normalizeSymbol("GBP_JPY")).toBe("GBPJPY");
      expect(normalizeSymbol("AUD.CAD")).toBe("AUDCAD");
    });

    it("normalizes futures contract tickers and continuous roots", () => {
      expect(normalizeSymbol("NQ1!")).toBe("NQ");
      expect(normalizeSymbol("NQM24")).toBe("NQ");
      expect(normalizeSymbol("ESU24")).toBe("ES");
      expect(normalizeSymbol("MESZ24")).toBe("MES");
      expect(normalizeSymbol("CLH25")).toBe("CL");
      expect(normalizeSymbol("GCZ24")).toBe("GC");
    });

    it("normalizes CFD broker symbols by pattern recognition without destructive deletion", () => {
      expect(normalizeSymbol("us100.cash")).toBe("US100");
      expect(normalizeSymbol("US100_cash")).toBe("US100");
      expect(normalizeSymbol("US100CASH")).toBe("US100");
      expect(normalizeSymbol("us500.cash")).toBe("US500");
      expect(normalizeSymbol("SPX500.pro")).toBe("US500");
      expect(normalizeSymbol("US30.cash")).toBe("US30");
      expect(normalizeSymbol("GER40.cash")).toBe("GER40");
      expect(normalizeSymbol("EURUSD.pro")).toBe("EURUSD");
      expect(normalizeSymbol("XAUUSD.raw")).toBe("XAUUSD");
      expect(normalizeSymbol("AAPL.pro")).toBe("AAPL");
      expect(normalizeSymbol("NVDA.cash")).toBe("NVDA");
      expect(normalizeSymbol("TSLA.raw")).toBe("TSLA");
      expect(normalizeSymbol("GBPUSD.ecn")).toBe("GBPUSD");
      expect(normalizeSymbol("USDJPY_sb")).toBe("USDJPY");
      expect(normalizeSymbol("CASH")).toBe("CASH");
    });
  });

  describe("getAssetIconConfig", () => {
    it("resolves CFD broker tickers to their canonical asset icons", () => {
      expect(getAssetIconConfig("us100.cash").icons[0]).toContain("nasdaq-100.svg");
      expect(getAssetIconConfig("US500.cash").icons[0]).toContain("sp500.svg");
      expect(getAssetIconConfig("US30_cash").icons[0]).toContain("dow-jones.svg");
      expect(getAssetIconConfig("GER40.cash").icons[0]).toContain("flags/eu.svg");
      expect(getAssetIconConfig("XAUUSD.raw").icons[0]).toContain("gold.svg");

      const eurusdPro = getAssetIconConfig("EURUSD.pro");
      expect(eurusdPro.type).toBe("pair");
      expect(eurusdPro.icons[0]).toContain("flags/eu.svg");
      expect(eurusdPro.icons[1]).toContain("flags/us.svg");
    });

    it("resolves US indices to branded vector SVGs", () => {
      for (const sym of ["NQ", "MNQ", "US100", "NAS100", "USTEC"]) {
        const config = getAssetIconConfig(sym);
        expect(config.type).toBe("single");
        expect(config.icons[0]).toContain("nasdaq-100.svg");
      }

      for (const sym of ["ES", "MES", "US500", "SPX", "SPX500"]) {
        const config = getAssetIconConfig(sym);
        expect(config.type).toBe("single");
        expect(config.icons[0]).toContain("sp500.svg");
      }

      for (const sym of ["YM", "MYM", "US30", "DJ30"]) {
        const config = getAssetIconConfig(sym);
        expect(config.type).toBe("single");
        expect(config.icons[0]).toContain("dow-jones.svg");
      }

      for (const sym of ["RTY", "M2K", "US2000"]) {
        const config = getAssetIconConfig(sym);
        expect(config.type).toBe("single");
        expect(config.icons[0]).toContain("russell-2000.svg");
      }

      expect(getAssetIconConfig("DXY").icons[0]).toContain("us-dollar-index.svg");
    });

    it("resolves commodities to vector SVGs", () => {
      expect(getAssetIconConfig("XAUUSD").icons[0]).toContain("gold.svg");
      expect(getAssetIconConfig("GC").icons[0]).toContain("gold.svg");
      expect(getAssetIconConfig("GOLD").icons[0]).toContain("gold.svg");

      expect(getAssetIconConfig("SI").icons[0]).toContain("silver.svg");
      expect(getAssetIconConfig("XAGUSD").icons[0]).toContain("silver.svg");

      expect(getAssetIconConfig("CL").icons[0]).toContain("crude-oil.svg");
      expect(getAssetIconConfig("USOIL").icons[0]).toContain("crude-oil.svg");
      expect(getAssetIconConfig("WTI").icons[0]).toContain("crude-oil.svg");

      expect(getAssetIconConfig("NG").icons[0]).toContain("natural-gas.svg");
      expect(getAssetIconConfig("HG").icons[0]).toContain("copper.svg");
    });

    it("dynamically blends any combination of 10 global forex currency flags", () => {
      const eurusd = getAssetIconConfig("EURUSD");
      expect(eurusd.type).toBe("pair");
      expect(eurusd.icons[0]).toContain("flags/eu.svg");
      expect(eurusd.icons[1]).toContain("flags/us.svg");

      const gbpjpy = getAssetIconConfig("GBPJPY");
      expect(gbpjpy.type).toBe("pair");
      expect(gbpjpy.icons[0]).toContain("flags/gb.svg");
      expect(gbpjpy.icons[1]).toContain("flags/jp.svg");

      const audnzd = getAssetIconConfig("AUD/NZD");
      expect(audnzd.type).toBe("pair");
      expect(audnzd.icons[0]).toContain("flags/au.svg");
      expect(audnzd.icons[1]).toContain("flags/nz.svg");

      const cadchf = getAssetIconConfig("CAD-CHF");
      expect(cadchf.type).toBe("pair");
      expect(cadchf.icons[0]).toContain("flags/ca.svg");
      expect(cadchf.icons[1]).toContain("flags/ch.svg");

      const usdbrl = getAssetIconConfig("USDBRL");
      expect(usdbrl.type).toBe("pair");
      expect(usdbrl.icons[0]).toContain("flags/us.svg");
      expect(usdbrl.icons[1]).toContain("flags/br.svg");

      const usdcny = getAssetIconConfig("USDCNY");
      expect(usdcny.type).toBe("pair");
      expect(usdcny.icons[0]).toContain("flags/us.svg");
      expect(usdcny.icons[1]).toContain("flags/cn.svg");
    });

    it("dynamically blends crypto base assets with quote fiat or stablecoins", () => {
      const btcusdt = getAssetIconConfig("BTCUSDT");
      expect(btcusdt.type).toBe("pair");
      expect(btcusdt.icons[0]).toContain("crypto/bitcoin.svg");
      expect(btcusdt.icons[1]).toContain("crypto/tether.svg");

      const ethusd = getAssetIconConfig("ETHUSD");
      expect(ethusd.type).toBe("pair");
      expect(ethusd.icons[0]).toContain("crypto/ethereum.svg");
      expect(ethusd.icons[1]).toContain("flags/us.svg");

      const solusdt = getAssetIconConfig("SOLUSDT");
      expect(solusdt.type).toBe("pair");
      expect(solusdt.icons[0]).toContain("crypto/solana.svg");
      expect(solusdt.icons[1]).toContain("crypto/tether.svg");

      const dogeusdt = getAssetIconConfig("DOGEUSDT");
      expect(dogeusdt.type).toBe("pair");
      expect(dogeusdt.icons[0]).toContain("crypto/doge.svg");
      expect(dogeusdt.icons[1]).toContain("crypto/tether.svg");
    });

    it("resolves TradingView ingested stocks and ETFs to official vector SVGs", () => {
      expect(getAssetIconConfig("AAPL").icons[0]).toContain("stocks/aapl.svg");
      expect(getAssetIconConfig("TSLA").icons[0]).toContain("stocks/tsla.svg");
      expect(getAssetIconConfig("NVDA").icons[0]).toContain("stocks/nvda.svg");
      expect(getAssetIconConfig("MSFT").icons[0]).toContain("stocks/msft.svg");
      expect(getAssetIconConfig("SPY").icons[0]).toContain("funds/spy.svg");
      expect(getAssetIconConfig("QQQ").icons[0]).toContain("funds/qqq.svg");
    });

    it("resolves Brazilian B3 equities and ETFs", () => {
      expect(getAssetIconConfig("PETR4").icons[0]).toContain("b3/petr4.svg");
      expect(getAssetIconConfig("VALE3").icons[0]).toContain("b3/vale3.svg");
      expect(getAssetIconConfig("ITUB4").icons[0]).toContain("b3/itub4.svg");
      expect(getAssetIconConfig("BBAS3").icons[0]).toContain("b3/bbas3.svg");
      expect(getAssetIconConfig("BOVA11").icons[0]).toContain("funds/eem.svg");
    });

    it("resolves expanded crypto assets and dynamic blends", () => {
      expect(getAssetIconConfig("SUI").icons[0]).toContain("crypto/sui.svg");
      expect(getAssetIconConfig("PEPE").icons[0]).toContain("crypto/pepe.svg");
      expect(getAssetIconConfig("NEAR").icons[0]).toContain("crypto/near.svg");

      const suiusdt = getAssetIconConfig("SUIUSDT");
      expect(suiusdt.type).toBe("pair");
      expect(suiusdt.icons[0]).toContain("crypto/sui.svg");
      expect(suiusdt.icons[1]).toContain("crypto/tether.svg");
    });

    it("resolves extended commodities and forex pairs from TradingView ingestion", () => {
      expect(getAssetIconConfig("COFFEE").icons[0]).toContain("commodities/kc.svg");
      expect(getAssetIconConfig("CORN").icons[0]).toContain("commodities/zc.svg");

      const usdmxn = getAssetIconConfig("USDMXN");
      expect(usdmxn.type).toBe("pair");
      expect(usdmxn.icons[0]).toContain("flags/us.svg");
      expect(usdmxn.icons[1]).toContain("flags/mx.svg");

      const usdzar = getAssetIconConfig("USDZAR");
      expect(usdzar.type).toBe("pair");
      expect(usdzar.icons[0]).toContain("flags/us.svg");
      expect(usdzar.icons[1]).toContain("flags/za.svg");
    });

    it("returns fallback for unmapped custom symbols", () => {
      const fallback = getAssetIconConfig("RANDOM_CUSTOM_TICKER");
      expect(fallback.type).toBe("single");
      expect(fallback.icons[0]).toContain("fallback.svg");
    });
  });

  describe("getBrokerIcon", () => {
    it("resolves official TradingView brokers and prop firms", () => {
      expect(getBrokerIcon("Interactive Brokers")).toContain("brokers/");
      expect(getBrokerIcon("NinjaTrader")).toContain("brokers/");
      expect(getBrokerIcon("AMP Futures")).toContain("brokers/");
      expect(getBrokerIcon("TradeStation")).toContain("brokers/");
      expect(getBrokerIcon("Tradovate")).toContain("brokers/tradovate.svg");
      expect(getBrokerIcon("Genial Investimentos")).toContain("brokers/");
      expect(getBrokerIcon("Binance")).toContain("brokers/");
    });

    it("returns null for unknown broker", () => {
      expect(getBrokerIcon("UNKNOWN_BROKER_XYZ")).toBeNull();
    });
  });

  describe("getExchangeIcon", () => {
    it("resolves major execution venues and exchanges", () => {
      expect(getExchangeIcon("CME")).toContain("exchanges/cme.svg");
      expect(getExchangeIcon("NASDAQ")).toContain("exchanges/nasdaq.svg");
      expect(getExchangeIcon("NYSE")).toContain("exchanges/nyse.svg");
      expect(getExchangeIcon("B3")).toContain("exchanges/b3.svg");
      expect(getExchangeIcon("BMFBOVESPA")).toContain("exchanges/b3.svg");
    });

    it("returns null for unknown exchange", () => {
      expect(getExchangeIcon("XYZ_EXCHANGE")).toBeNull();
    });
  });
});

describe("symbol-specs and symbol-utils engine", () => {
  describe("symbol-utils normalization", () => {
    it("handles complex futures and CFD tickers without manifest dependency", () => {
      expect(normalizeSymbolUtils("NQZ24")).toBe("NQ");
      expect(normalizeSymbolUtils("ESU24")).toBe("ES");
      expect(normalizeSymbolUtils("WINV24")).toBe("WIN");
      expect(normalizeSymbolUtils("WDOZ24")).toBe("WDO");
      expect(normalizeSymbolUtils("6EZ24")).toBe("6E");
      expect(normalizeSymbolUtils("US100.cash")).toBe("US100");
      expect(normalizeSymbolUtils("XAUUSD.raw")).toBe("XAUUSD");
      expect(normalizeSymbolUtils("CASH")).toBe("CASH");
    });
  });

  describe("formatSpecBadge", () => {
    it("formats USD futures contracts with dollar symbols for both point and tick", () => {
      const nqSpec = getSymbolSpec("NQ");
      expect(nqSpec).toBeDefined();
      expect(formatSpecBadge(nqSpec!)).toBe("$20/pt • tick $5");

      const esSpec = getSymbolSpec("ES");
      expect(esSpec).toBeDefined();
      expect(formatSpecBadge(esSpec!)).toBe("$50/pt • tick $12.50");
    });

    it("formats BRL Brazilian contracts with R$ symbol", () => {
      const winSpec = getSymbolSpec("WIN");
      expect(winSpec).toBeDefined();
      expect(formatSpecBadge(winSpec!)).toBe("R$0.20/pt • tick R$1.00");

      const wdoSpec = getSymbolSpec("WDO");
      expect(wdoSpec).toBeDefined();
      expect(formatSpecBadge(wdoSpec!)).toBe("R$10/pt • tick R$5.00");
    });

    it("formats EUR European contracts with € symbol for both point and tick", () => {
      const euro6e = getSymbolSpec("6E");
      expect(euro6e).toBeDefined();
      expect(euro6e?.currency).toBe("USD"); // CME FX is priced in USD ($125,000 multiplier)

      const eurSpec = {
        symbol: "DAX",
        name: "DAX 40 Futures",
        category: "indices" as const,
        pointValue: 25,
        tickSize: 0.5,
        tickValue: 12.5,
        currency: "EUR" as const,
      };
      expect(formatSpecBadge(eurSpec)).toBe("€25/pt • tick €12.50");
    });
  });

  describe("getQuantInstrument", () => {
    it("bridges SymbolSpec into a Core QuantInstrument correctly", () => {
      const nq = getQuantInstrument("NQ");
      expect(nq).not.toBeNull();
      expect(nq?.multiplier).toBe(20);
      expect(nq?.currency).toBe("USD");
      expect(nq?.tickValue).toBe(5.0);

      const win = getQuantInstrument("WIN");
      expect(win).not.toBeNull();
      expect(win?.multiplier).toBe(0.2);
      expect(win?.currency).toBe("BRL");
      expect(win?.tickValue).toBe(1.0);
    });

    it("returns null for non-calculable instruments", () => {
      expect(getQuantInstrument("EURUSD")).toBeNull();
      expect(getQuantInstrument("AAPL")).toBeNull();
      expect(getQuantInstrument("NON_EXISTENT_XYZ")).toBeNull();
    });
  });

  describe("isCalculableSymbol", () => {
    it("identifies futures and CME crypto as calculable", () => {
      expect(isCalculableSymbol("NQ")).toBe(true);
      expect(isCalculableSymbol("MNQ")).toBe(true);
      expect(isCalculableSymbol("ES")).toBe(true);
      expect(isCalculableSymbol("WIN")).toBe(true);
      expect(isCalculableSymbol("WDO")).toBe(true);
      expect(isCalculableSymbol("GC")).toBe(true);
      expect(isCalculableSymbol("CL")).toBe(true);
      expect(isCalculableSymbol("BTC")).toBe(true);
      expect(isCalculableSymbol("ETH")).toBe(true);
    });

    it("excludes spot forex and equities from point calculator", () => {
      expect(isCalculableSymbol("EURUSD")).toBe(false);
      expect(isCalculableSymbol("GBPUSD")).toBe(false);
      expect(isCalculableSymbol("AAPL")).toBe(false);
      expect(isCalculableSymbol("TSLA")).toBe(false);
    });
  });

  describe("Asset Families & Ground Truth Preservation", () => {
    it("preserves exact empirical ground truth (MES is MES, US500 is US500)", () => {
      expect(normalizeSymbolUtils("MES1!")).toBe("MES");
      expect(normalizeSymbolUtils("MESH6")).toBe("MES");
      expect(normalizeSymbolUtils("MESM6")).toBe("MES");
      expect(normalizeSymbolUtils("US500.CASH")).toBe("US500");
      expect(normalizeSymbolUtils("US500.pro")).toBe("US500");
      expect(normalizeSymbolUtils("ESU6")).toBe("ES");
      expect(normalizeSymbolUtils("MNQZ5")).toBe("MNQ");
      expect(normalizeSymbolUtils("US100.CASH")).toBe("US100");

      expect(normalizeSymbolUtils("MES")).toBe("MES");
      expect(normalizeSymbolUtils("US500")).toBe("US500");
      expect(normalizeSymbolUtils("MES")).not.toBe(normalizeSymbolUtils("US500"));
    });

    it("groups related instruments into underlying asset families without mutating their identity", () => {
      const mesFamily = getAssetFamily("MES");
      expect(mesFamily).toBeDefined();
      expect(mesFamily?.id).toBe("sp500");
      expect(mesFamily?.currency).toBe("USD");

      const us500Family = getAssetFamily("US500.CASH");
      expect(us500Family).toBeDefined();
      expect(us500Family?.id).toBe("sp500");

      const mnqFamily = getAssetFamily("MNQZ6");
      expect(mnqFamily?.id).toBe("nasdaq100");

      const us100Family = getAssetFamily("US100.CASH");
      expect(us100Family?.id).toBe("nasdaq100");

      const goldFamily = getAssetFamily("XAUUSD");
      expect(goldFamily?.id).toBe("gold");

      expect(getAssetFamily("UNKNOWN_ASSET_XYZ")).toBeNull();
    });
  });
});
