import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { topstepx } from "../src/formats/topstepx";
import { detectFormat } from "../src/detect";

const REAL_TRADES_CSV = readFileSync(
  new URL("./fixtures/tradezella/topstepx.csv", import.meta.url),
  "utf8",
);

const LEGACY_FILLS_CSV = `AccountName,ContractName,ExecutePrice,FilledAt,PositionDisposition,Side,Size,Status,Sub Type
TSX-101,/ESU6,5000.25,2026-08-20 09:31:05,Opening,Bid,2,Filled,Market
TSX-101,/ESU6,5010.50,2026-08-20 09:45:10,Closing,Ask,2,Filled,Market`;

describe("TopstepX Parser", () => {
  it("detects real TopstepX Trades tab export", () => {
    const detected = detectFormat(REAL_TRADES_CSV);
    expect(detected?.id).toBe("topstepx");
  });

  it("parses 38 real trades into 76 executions with exact IDs and reported PnL", () => {
    const parsed = topstepx.parse(REAL_TRADES_CSV, { timeZone: "UTC" });

    expect(parsed.format).toBe("topstepx");
    expect(parsed.skippedRows).toBe(0);
    expect(parsed.executions).toHaveLength(76); // 38 trades * 2 legs

    // Trade 1: Short on NQM4
    // Entry: sell 1 NQM4 @ 18228.25
    const entry1 = parsed.executions[0]!;
    expect(entry1.symbol).toBe("NQM4");
    expect(entry1.side).toBe("sell");
    expect(entry1.quantity).toBe(1);
    expect(entry1.price).toBe(18228.25);
    expect(entry1.assetClass).toBe("futures");
    expect(entry1.importMetadata?.id).toBe("topstepx:trade:37199170:entry");
    expect(entry1.importMetadata?.group).toBe("topstepx:trade:37199170");

    // Exit: buy 1 NQM4 @ 18223.75, fee 1.40, reported PnL 90.00
    const exit1 = parsed.executions[1]!;
    expect(exit1.symbol).toBe("NQM4");
    expect(exit1.side).toBe("buy");
    expect(exit1.quantity).toBe(1);
    expect(exit1.price).toBe(18223.75);
    expect(exit1.fee).toBe(1.4);
    expect(exit1.assetClass).toBe("futures");
    expect(exit1.importMetadata?.id).toBe("topstepx:trade:37199170:exit");
    expect(exit1.importMetadata?.reportedGrossPnl).toBe(90);

    // Trade 2: Long on NQM4
    // Entry: buy 1 @ 18227.50
    const entry2 = parsed.executions[2]!;
    expect(entry2.symbol).toBe("NQM4");
    expect(entry2.side).toBe("buy");
    expect(entry2.price).toBe(18227.5);

    // Exit: sell 1 @ 18231.50, fee 1.40, PnL 80.00
    const exit2 = parsed.executions[3]!;
    expect(exit2.symbol).toBe("NQM4");
    expect(exit2.side).toBe("sell");
    expect(exit2.price).toBe(18231.5);
    expect(exit2.importMetadata?.reportedGrossPnl).toBe(80);
  });

  it("still supports legacy Fills export format and extracts AccountName", () => {
    const parsed = topstepx.parse(LEGACY_FILLS_CSV, { timeZone: "America/Chicago" });

    expect(parsed.format).toBe("topstepx");
    expect(parsed.account).toBe("TSX-101");
    expect(parsed.sourceAccounts).toEqual(["TSX-101"]);
    expect(parsed.executions).toHaveLength(2);
    expect(parsed.executions[0]!.symbol).toBe("ESU6"); // leading / stripped
    expect(parsed.executions[0]!.side).toBe("buy"); // Bid
    expect(parsed.executions[1]!.side).toBe("sell"); // Ask
    expect(parsed.executions[0]!.assetClass).toBe("futures");
  });
});
