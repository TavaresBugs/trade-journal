import { describe, expect, it } from "vitest";
import {
  getBaseAssetCatalog,
  loadExtendedCatalog,
  getAssetCatalog,
  ASSET_CATALOG,
  getAssetCategory,
} from "../src/lib/assets/asset-catalog";
import { SYMBOL_SPECS } from "../src/lib/assets/symbol-specs";

describe("asset-catalog engine", () => {
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
