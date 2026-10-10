import { describe, expect, it } from "vitest";
import {
  getSymbolSpec,
  getPointValue,
  formatSpecBadge,
  isCalculableSymbol,
  getQuantInstrument,
} from "../src/lib/assets/symbol-specs";
import { normalizeSymbol } from "../src/lib/assets/symbol-utils";

describe("symbol-specs and symbol-utils engine", () => {
  describe("symbol-utils normalization", () => {
    it("handles complex futures and CFD tickers without manifest dependency", () => {
      expect(normalizeSymbol("NQZ24")).toBe("NQ");
      expect(normalizeSymbol("ESU24")).toBe("ES");
      expect(normalizeSymbol("WINV24")).toBe("WIN");
      expect(normalizeSymbol("WDOZ24")).toBe("WDO");
      expect(normalizeSymbol("6EZ24")).toBe("6E");
      expect(normalizeSymbol("US100.cash")).toBe("US100");
      expect(normalizeSymbol("XAUUSD.raw")).toBe("XAUUSD");
      expect(normalizeSymbol("CASH")).toBe("CASH");
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

      // Test synthetic EUR contract spec badge
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
      expect(normalizeSymbol("MES1!")).toBe("MES");
      expect(normalizeSymbol("MESH6")).toBe("MES");
      expect(normalizeSymbol("MESM6")).toBe("MES");
      expect(normalizeSymbol("US500.CASH")).toBe("US500");
      expect(normalizeSymbol("US500.pro")).toBe("US500");
      expect(normalizeSymbol("ESU6")).toBe("ES");
      expect(normalizeSymbol("MNQZ5")).toBe("MNQ");
      expect(normalizeSymbol("US100.CASH")).toBe("US100");

      // Verify that MES never mutates to US500 and vice versa
      expect(normalizeSymbol("MES")).toBe("MES");
      expect(normalizeSymbol("US500")).toBe("US500");
      expect(normalizeSymbol("MES")).not.toBe(normalizeSymbol("US500"));
    });

    it("groups related instruments into underlying asset families without mutating their identity", async () => {
      const { getAssetFamily } = await import("../src/lib/assets/symbol-utils");
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
