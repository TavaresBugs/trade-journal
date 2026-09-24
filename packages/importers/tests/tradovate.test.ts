import { describe, expect, it } from "vitest";
import { tradovate } from "../src/formats/tradovate";
import { detectFormat } from "../src/detect";

const REAL_TRADOVATE_CSV = `Position ID,Timestamp,Trade Date,Net Pos,Net Price,Bought,Avg. Buy,Sold,Avg. Sell,Account,Contract,Product,Product Description,_priceFormat,_priceFormatType,_tickSize,Pair ID,Buy Fill ID,Sell Fill ID,Paired Qty,Buy Price,Sell Price,P/L,Currency,Bought Timestamp,Sold Timestamp
419496653330,08/04/2026 10:20:44,2026-08-04,0,,1,29219.25,1,29248.50,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653348,419496653327,419496653346,1,29219.25,29248.50,58.50,USD,08/04/2026 10:05:09,08/04/2026 10:20:44
419496653354,08/05/2026 11:54:39,2026-08-05,0,,2,29856.88,2,29818.75,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653373,419496653371,419496653362,1,29899.75,29843.50,-112.50,USD,08/05/2026 11:49:40,08/05/2026 11:38:15
419496653354,08/05/2026 11:54:39,2026-08-05,0,,2,29856.88,2,29818.75,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653402,419496653400,419496653382,1,29814.00,29794.00,-40.00,USD,08/05/2026 11:54:39,08/05/2026 11:53:50
419496653419,08/10/2026 11:25:22,2026-08-10,0,,2,29911.00,2,29880.63,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653426,419496653416,419496653424,1,29958.00,29955.75,-4.50,USD,08/10/2026 07:04:14,08/10/2026 07:04:29
419496653419,08/10/2026 11:25:22,2026-08-10,0,,2,29911.00,2,29880.63,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653458,419496653437,419496653456,1,29864.00,29805.50,-117.00,USD,08/10/2026 11:18:21,08/10/2026 11:25:22
419496653476,08/12/2026 16:45:03,2026-08-12,0,,2,7773.75,2,7774.00,LFE0506847043001,MESU6,MES,Micro E-mini S&P 500,-2,0,0.25,419496653508,419496653506,419496653473,2,7773.75,7774.00,2.50,USD,08/12/2026 16:45:03,08/12/2026 16:27:26
419496653533,08/13/2026 15:37:50,2026-08-13,0,,3,30051.42,3,30051.58,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653553,419496653531,419496653551,1,29877.25,29853.75,-47.00,USD,08/13/2026 08:50:37,08/13/2026 09:01:01
419496653533,08/13/2026 15:37:50,2026-08-13,0,,3,30051.42,3,30051.58,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653593,419496653563,419496653591,1,30059.50,30081.50,44.00,USD,08/13/2026 10:45:46,08/13/2026 10:46:09
419496653533,08/13/2026 15:37:50,2026-08-13,0,,3,30051.42,3,30051.58,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653630,419496653600,419496653628,1,30217.50,30219.50,4.00,USD,08/13/2026 15:33:50,08/13/2026 15:37:50
419496653648,08/19/2026 10:29:03,2026-08-19,0,,2,29739.00,2,29712.50,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653685,419496653645,419496653683,1,29734.75,29712.75,-44.00,USD,08/19/2026 10:12:34,08/19/2026 10:17:03
419496653648,08/19/2026 10:29:03,2026-08-19,0,,2,29739.00,2,29712.50,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653721,419496653692,419496653719,1,29743.25,29712.25,-62.00,USD,08/19/2026 10:23:01,08/19/2026 10:29:03
419496653742,08/25/2026 08:32:29,2026-08-25,0,,1,29344.00,1,29344.50,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653802,419496653739,419496653800,1,29344.00,29344.50,1.00,USD,08/25/2026 08:15:31,08/25/2026 08:32:29
419496653808,08/26/2026 17:05:04,2026-08-26,0,,1,29342.75,1,29344.00,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653836,419496653817,419496653834,1,29342.75,29344.00,2.50,USD,08/26/2026 17:04:03,08/26/2026 17:05:04
419496653850,08/27/2026 10:49:14,2026-08-27,0,,1,7722.25,1,7710.75,LFE0506847043001,MESU6,MES,Micro E-mini S&P 500,-2,0,0.25,419496653882,419496653848,419496653880,1,7722.25,7710.75,-57.50,USD,08/27/2026 10:44:07,08/27/2026 10:49:14`;

const ORDERS_TRADOVATE_CSV = `orderId,Account,Date,Fill Time,B/S,Contract,Product,Filled Qty,Avg Fill Price,Status
101,LFE0506847043001,8/4/26,10:05:09,Buy,MNQU6,MNQ,1,29219.25,Filled
102,LFE0506847043001,8/4/26,10:20:44,Sell,MNQU6,MNQ,1,29248.50,Filled`;

describe("Tradovate Parser", () => {
  it("detects real Tradovate positions/performance CSV export", () => {
    const detected = detectFormat(REAL_TRADOVATE_CSV);
    expect(detected?.id).toBe("tradovate");
  });

  it("parses paired positions with accurate Long and Short direction and metadata", () => {
    const parsed = tradovate.parse(REAL_TRADOVATE_CSV, { timeZone: "America/Chicago" });

    expect(parsed.format).toBe("tradovate");
    expect(parsed.account).toBe("LFE0506847043001");
    expect(parsed.sourceAccounts).toEqual(["LFE0506847043001"]);
    expect(parsed.skippedRows).toBe(0);
    expect(parsed.executions).toHaveLength(28); // 14 trades * 2 executions

    // Trade 1: Long (Bought 10:05:09, Sold 10:20:44)
    const [t1Entry, t1Exit] = parsed.executions.slice(0, 2);
    expect(t1Entry).toMatchObject({
      symbol: "MNQ",
      side: "buy",
      quantity: 1,
      price: 29219.25,
      assetClass: "futures",
    });
    expect(t1Entry?.importMetadata).toMatchObject({
      id: "tradovate:fill:419496653327",
      group: "tradovate:pos:419496653330",
      order: 0,
      preserveFee: true,
    });
    expect(t1Exit).toMatchObject({
      symbol: "MNQ",
      side: "sell",
      quantity: 1,
      price: 29248.5,
      assetClass: "futures",
    });
    expect(t1Exit?.importMetadata).toMatchObject({
      id: "tradovate:fill:419496653346",
      group: "tradovate:pos:419496653330",
      order: 1,
      reportedGrossPnl: 58.5,
    });

    // Trade 2: Short (Sold 11:38:15, Bought 11:49:40)
    const [t2Entry, t2Exit] = parsed.executions.slice(2, 4);
    expect(t2Entry).toMatchObject({
      symbol: "MNQ",
      side: "sell",
      quantity: 1,
      price: 29843.5,
    });
    expect(t2Exit).toMatchObject({
      symbol: "MNQ",
      side: "buy",
      quantity: 1,
      price: 29899.75,
    });
    expect(t2Exit?.importMetadata?.reportedGrossPnl).toBe(-112.5);

    // Trade 6: Short on MES (Sold 16:27:26, Bought 16:45:03, Qty 2)
    const [t3Entry, t3Exit] = parsed.executions.slice(10, 12);
    expect(t3Entry).toMatchObject({
      symbol: "MES",
      side: "sell",
      quantity: 2,
      price: 7774,
    });
    expect(t3Exit).toMatchObject({
      symbol: "MES",
      side: "buy",
      quantity: 2,
      price: 7773.75,
    });
    expect(t3Exit?.importMetadata?.reportedGrossPnl).toBe(2.5);
  });

  it("still supports Tradovate orders export without regressions", () => {
    const detected = detectFormat(ORDERS_TRADOVATE_CSV);
    expect(detected?.id).toBe("tradovate");

    const parsed = tradovate.parse(ORDERS_TRADOVATE_CSV, { timeZone: "America/Chicago" });
    expect(parsed.executions).toHaveLength(2);
    expect(parsed.account).toBe("LFE0506847043001");
  });
});
