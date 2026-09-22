import { describe, expect, it } from "vitest";
import {
  getAssetIconConfig,
  normalizeSymbol,
  getBrokerIcon,
  getExchangeIcon,
} from "../src/lib/assets/asset-icons";

describe("asset-icons normalization and dynamic resolver", () => {
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
