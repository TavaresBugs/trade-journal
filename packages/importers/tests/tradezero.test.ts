import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { tradezero } from "../src/formats/tradezero";
import { detectFormat } from "../src/detect";

const REAL_TRADEZERO_CSV = readFileSync(
  new URL("./fixtures/tradezella/tradezero.csv", import.meta.url),
  "utf8",
);

describe("TradeZero Parser", () => {
  it("detects real TradeZero CSV export", () => {
    const detected = detectFormat(REAL_TRADEZERO_CSV);
    expect(detected?.id).toBe("tradezero");
  });

  it("parses executions with account auto-binding, SS/BC sides and fee summing", () => {
    const parsed = tradezero.parse(REAL_TRADEZERO_CSV, { timeZone: "America/New_York" });

    expect(parsed.format).toBe("tradezero");
    expect(parsed.account).toBe("2TZ23795");
    expect(parsed.sourceAccounts).toEqual(["2TZ23795"]);
    expect(parsed.skippedRows).toBe(0);
    expect(parsed.executions).toHaveLength(6);

    // Row 1: Short sale 806 TIVC @ 2.48
    const e1 = parsed.executions[0]!;
    expect(e1.symbol).toBe("TIVC");
    expect(e1.side).toBe("sell"); // SS -> sell
    expect(e1.quantity).toBe(806);
    expect(e1.price).toBe(2.48);
    expect(e1.fee).toBeCloseTo(0.14, 2); // 0.02 SEC + 0.12 TAF
    expect(e1.assetClass).toBe("equity");
    expect(e1.importMetadata?.id).toContain("tradezero:2TZ23795:2023-11-13T13:18:08.000Z:TIVC:sell:806:0");

    // Row 6: Buy to Cover 3300 TIVC @ 2.39225758
    const e6 = parsed.executions[5]!;
    expect(e6.symbol).toBe("TIVC");
    expect(e6.side).toBe("buy"); // BC -> buy
    expect(e6.quantity).toBe(3300);
    expect(e6.price).toBeCloseTo(2.39225758, 6);
    expect(e6.fee).toBe(0);
  });
});
