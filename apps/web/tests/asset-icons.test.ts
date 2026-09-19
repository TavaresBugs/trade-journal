import { describe, expect, it } from "vitest";
import { getAssetIconConfig, normalizeSymbol } from "../src/lib/assets/asset-icons";

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
  });

  describe("getAssetIconConfig", () => {
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
      expect(eurusd.icons[0]).toContain("flags/eur.svg");
      expect(eurusd.icons[1]).toContain("flags/usd.svg");

      const gbpjpy = getAssetIconConfig("GBPJPY");
      expect(gbpjpy.type).toBe("pair");
      expect(gbpjpy.icons[0]).toContain("flags/gbp.svg");
      expect(gbpjpy.icons[1]).toContain("flags/jpy.svg");

      const audnzd = getAssetIconConfig("AUD/NZD");
      expect(audnzd.type).toBe("pair");
      expect(audnzd.icons[0]).toContain("flags/aud.svg");
      expect(audnzd.icons[1]).toContain("flags/nzd.svg");

      const cadchf = getAssetIconConfig("CAD-CHF");
      expect(cadchf.type).toBe("pair");
      expect(cadchf.icons[0]).toContain("flags/cad.svg");
      expect(cadchf.icons[1]).toContain("flags/chf.svg");

      const usdbrl = getAssetIconConfig("USDBRL");
      expect(usdbrl.type).toBe("pair");
      expect(usdbrl.icons[0]).toContain("flags/usd.svg");
      expect(usdbrl.icons[1]).toContain("flags/brl.svg");

      const usdcny = getAssetIconConfig("USDCNY");
      expect(usdcny.type).toBe("pair");
      expect(usdcny.icons[0]).toContain("flags/usd.svg");
      expect(usdcny.icons[1]).toContain("flags/cny.svg");
    });

    it("dynamically blends crypto base assets with quote fiat or stablecoins", () => {
      const btcusdt = getAssetIconConfig("BTCUSDT");
      expect(btcusdt.type).toBe("pair");
      expect(btcusdt.icons[0]).toContain("crypto/bitcoin.svg");
      expect(btcusdt.icons[1]).toContain("crypto/tether.svg");

      const ethusd = getAssetIconConfig("ETHUSD");
      expect(ethusd.type).toBe("pair");
      expect(ethusd.icons[0]).toContain("crypto/ethereum.svg");
      expect(ethusd.icons[1]).toContain("flags/usd.svg");

      const solusdt = getAssetIconConfig("SOLUSDT");
      expect(solusdt.type).toBe("pair");
      expect(solusdt.icons[0]).toContain("crypto/solana.svg");
      expect(solusdt.icons[1]).toContain("crypto/tether.svg");
    });

    it("returns fallback for unmapped custom symbols", () => {
      const fallback = getAssetIconConfig("RANDOM_CUSTOM_TICKER");
      expect(fallback.type).toBe("single");
      expect(fallback.icons[0]).toContain("fallback.svg");
    });
  });
});
