import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ctrader } from "../src/formats/ctrader";
import { detectFormat } from "../src/detect";

const REAL_CTRADER_HTM = readFileSync(
  new URL("./fixtures/tradezella/ctrader.htm", import.meta.url),
  "utf8",
);

const CTRADER_CSV = `Deal ID,Position ID,Symbol,Opening Direction,Closing Direction,Volume,Entry Price,Closing Price,Open Time,Closing Time,Gross P&L,Net P&L,Commission,Swap
98765432,1234567,EURUSD,Buy,Sell,100000,1.08500,1.08950,2026-01-10 10:15:00,2026-01-10 14:30:00,450.00,442.00,-6.00,-2.00
98765433,1234568,XAUUSD,Sell,Buy,10,2050.50,2045.00,2026-01-11 09:00:00,2026-01-11 11:20:00,55.00,51.50,-3.50,0.00`;

describe("cTrader Parser", () => {
  it("detects real cTrader HTML statement export", () => {
    const detected = detectFormat(REAL_CTRADER_HTM);
    expect(detected?.id).toBe("ctrader");
  });

  it("parses real cTrader HTML statement with Pepperstone account and closed deals", () => {
    const parsed = ctrader.parse(REAL_CTRADER_HTM, { timeZone: "UTC" });

    expect(parsed.format).toBe("ctrader");
    expect(parsed.account).toBe("4142841");
    expect(parsed.sourceAccounts).toEqual(["4142841"]);
    expect(parsed.executions.length).toBe(10); // 5 closed trades * 2 legs

    // Trade 1: CADJPY
    const [entry1, exit1] = parsed.executions.slice(0, 2);
    expect(entry1!.symbol).toBe("CADJPY");
    expect(entry1!.side).toBe("buy"); // Opening Direction = Buy
    expect(entry1!.price).toBe(109.643);

    expect(exit1!.symbol).toBe("CADJPY");
    expect(exit1!.side).toBe("sell"); // Closing Direction = Sell
    expect(exit1!.price).toBe(112.02);
    expect(exit1!.importMetadata?.reportedGrossPnl).toBe(23.77);
  });

  it("parses cTrader CSV deals statement with accurate sides, P&L and fees", () => {
    const parsed = ctrader.parse(CTRADER_CSV, { timeZone: "UTC" });

    expect(parsed.format).toBe("ctrader");
    expect(parsed.executions).toHaveLength(4);

    // Trade 1 Entry: Buy EURUSD
    expect(parsed.executions[0]!.symbol).toBe("EURUSD");
    expect(parsed.executions[0]!.side).toBe("buy");
    expect(parsed.executions[0]!.price).toBe(1.085);

    // Trade 1 Exit: Sell EURUSD
    expect(parsed.executions[1]!.symbol).toBe("EURUSD");
    expect(parsed.executions[1]!.side).toBe("sell");
    expect(parsed.executions[1]!.price).toBe(1.0895);
    expect(parsed.executions[1]!.fee).toBe(8); // 6 + 2
    expect(parsed.executions[1]!.importMetadata?.reportedGrossPnl).toBe(450);
  });
});
