import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { tradestation } from "../src/formats/tradestation";
import { detectFormat } from "../src/detect";

const REAL_TRADESTATION_CSV = readFileSync(
  new URL("./fixtures/tradezella/tradestation.csv", import.meta.url),
  "utf8",
);

describe("TradeStation Parser", () => {
  it("detects real TradeStation CSV export", () => {
    const detected = detectFormat(REAL_TRADESTATION_CSV);
    expect(detected?.id).toBe("tradestation");
  });

  it("parses executions with account auto-binding, options/equities and Order IDs", () => {
    const parsed = tradestation.parse(REAL_TRADESTATION_CSV, { timeZone: "America/New_York" });

    expect(parsed.format).toBe("tradestation");
    expect(parsed.account).toBe("11434173");
    expect(parsed.sourceAccounts).toEqual(["11434173"]);
    expect(parsed.executions.length).toBeGreaterThan(0);

    // Row 1: Option Call Buy NIO221104C12 @ 0.01
    const e1 = parsed.executions[0]!;
    expect(e1.symbol).toBe("NIO221104C12");
    expect(e1.side).toBe("buy");
    expect(e1.quantity).toBe(100);
    expect(e1.price).toBe(0.01);
    expect(e1.assetClass).toBe("option");
    expect(e1.importMetadata?.id).toBe("tradestation:order:912837182LEG1");

    // Row 4: Equity Sell NIO @ 9.8401
    const e4 = parsed.executions[3]!;
    expect(e4.symbol).toBe("NIO");
    expect(e4.side).toBe("sell");
    expect(e4.quantity).toBe(1);
    expect(e4.price).toBe(9.8401);
    expect(e4.assetClass).toBe("equity");
    expect(e4.importMetadata?.id).toBe("tradestation:order:912591960");
  });
});
