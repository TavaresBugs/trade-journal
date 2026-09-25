import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { quantower } from "../src/formats/quantower";
import { detectFormat } from "../src/detect";

const REAL_QUANTOWER_CSV = readFileSync(
  new URL("./fixtures/tradezella/quantower.csv", import.meta.url),
  "utf8",
);

describe("Quantower Parser", () => {
  it("detects real Quantower CSV export", () => {
    const detected = detectFormat(REAL_QUANTOWER_CSV);
    expect(detected?.id).toBe("quantower");
  });

  it("parses executions with account auto-binding, crypto assetClass and Trade IDs", () => {
    const parsed = quantower.parse(REAL_QUANTOWER_CSV, { timeZone: "America/New_York" });

    expect(parsed.format).toBe("quantower");
    expect(parsed.account).toBe("Account (USD)");
    expect(parsed.sourceAccounts).toEqual(["Account (USD)"]);
    expect(parsed.executions.length).toBeGreaterThan(0);

    // Row 1: Buy 1 ETH/USD @ 1776.04
    const e1 = parsed.executions[0]!;
    expect(e1.symbol).toBe("ETH/USD");
    expect(e1.side).toBe("buy");
    expect(e1.quantity).toBe(1);
    expect(e1.price).toBe(1776.04);
    expect(e1.assetClass).toBe("crypto");
    expect(e1.importMetadata?.id).toBe("quantower:trade:1");

    // Row 2: Sell 1 ETH/USD @ 1776.03
    const e2 = parsed.executions[1]!;
    expect(e2.symbol).toBe("ETH/USD");
    expect(e2.side).toBe("sell");
    expect(e2.quantity).toBe(1);
    expect(e2.price).toBe(1776.03);
    expect(e2.assetClass).toBe("crypto");
    expect(e2.importMetadata?.id).toBe("quantower:trade:2");
  });
});
