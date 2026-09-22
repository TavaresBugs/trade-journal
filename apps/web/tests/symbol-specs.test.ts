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
});
