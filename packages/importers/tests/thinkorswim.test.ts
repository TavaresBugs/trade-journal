import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { thinkorswim } from "../src/formats/thinkorswim";
import { detectFormat } from "../src/detect";

const REAL_TOS_CSV = readFileSync(
  new URL("./fixtures/tradezella/thinkorswim.csv", import.meta.url),
  "utf8",
);

describe("ThinkorSwim Parser", () => {
  it("detects real ThinkorSwim statement export", () => {
    const detected = detectFormat(REAL_TOS_CSV);
    expect(detected?.id).toBe("thinkorswim");
  });

  it("extracts Account ID from preamble and parses Account Trade History fills", () => {
    const parsed = thinkorswim.parse(REAL_TOS_CSV, { timeZone: "America/Chicago" });

    expect(parsed.format).toBe("thinkorswim");
    expect(parsed.account).toBe("92140825SCHW");
    expect(parsed.sourceAccounts).toEqual(["92140825SCHW"]);
    expect(parsed.executions.length).toBeGreaterThan(0);

    // Row 1: Sell 1000 TSLA @ 173.268
    const e1 = parsed.executions[0]!;
    expect(e1.symbol).toBe("TSLA");
    expect(e1.side).toBe("sell");
    expect(e1.quantity).toBe(1000);
    expect(e1.price).toBe(173.268);
    expect(e1.assetClass).toBe("equity");
    expect(e1.importMetadata?.id).toContain("thinkorswim:92140825SCHW:");
  });
});
