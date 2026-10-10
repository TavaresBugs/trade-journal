import { describe, it, expect } from "vitest";
import { executionHash, extractBrokerTicket } from "../src/server/ids";

describe("executionHash & extractBrokerTicket deduplication", () => {
  it("extracts broker ticket and leg correctly from MetaTrader history group", () => {
    const entryMeta = {
      id: "entry",
      group: '["history-metatrader","78698762","US100.CASH","long","2025-09-23T17:58:41.000Z",24597.95]',
    };
    const exitMeta = {
      id: "exit",
      group: '["history-metatrader","78698762","US100.CASH","long","2025-09-23T17:58:41.000Z",24597.95]',
    };

    expect(extractBrokerTicket(entryMeta)).toEqual({
      ticket: "78698762",
      leg: "entry",
    });
    expect(extractBrokerTicket(exitMeta)).toEqual({
      ticket: "78698762",
      leg: "exit",
    });
  });

  it("extracts ticket from MetaTrader deals table (id is ticket)", () => {
    const meta = { id: "78698762" };
    expect(extractBrokerTicket(meta)).toEqual({
      ticket: "78698762",
      leg: "78698762",
    });
  });

  it("extracts ticket and leg from prefixed broker identifiers", () => {
    expect(extractBrokerTicket({ id: "ftmo:trade:78698762:entry" })).toEqual({
      ticket: "78698762",
      leg: "entry",
    });
    expect(extractBrokerTicket({ id: "ftmo:trade:78698762:exit" })).toEqual({
      ticket: "78698762",
      leg: "exit",
    });
    expect(
      extractBrokerTicket({
        id: "topstepx:trade:37199170:entry",
        group: "topstepx:trade:37199170",
      }),
    ).toEqual({
      ticket: "37199170",
      leg: "entry",
    });
  });

  it("returns null when no ticket exists in importMetadata", () => {
    expect(extractBrokerTicket(undefined)).toBeNull();
    expect(extractBrokerTicket({ id: "entry" })).toBeNull();
    expect(extractBrokerTicket({ id: "exit" })).toBeNull();
    expect(extractBrokerTicket({ id: "entry", group: '["generic","","AAPL"]' })).toBeNull();
  });

  it("generates identical hashes for imported executions across timezones (Helsinki vs UTC)", () => {
    // Helsinki timestamp: 17:58:41 UTC
    const helsinkiExec = {
      symbol: "US100.CASH",
      side: "buy",
      quantity: 0.1,
      price: 24597.95,
      executedAt: "2025-09-23T17:58:41.000Z",
      importMetadata: {
        id: "entry",
        group: '["history-metatrader","78698762","US100.CASH","long","2025-09-23T17:58:41.000Z",24597.95]',
      },
    };

    // UTC timestamp: 23:58:41 UTC (6 hours shifted)
    const utcExec = {
      symbol: "US100.CASH",
      side: "buy",
      quantity: 0.1,
      price: 24597.95,
      executedAt: "2025-09-23T23:58:41.000Z",
      importMetadata: {
        id: "entry",
        group: '["history-metatrader","78698762","US100.CASH","long","2025-09-23T23:58:41.000Z",24597.95]',
      },
    };

    const hashHelsinki = executionHash(helsinkiExec);
    const hashUtc = executionHash(utcExec);

    expect(hashHelsinki).toBe(hashUtc);
  });

  it("generates distinct hashes for entry vs exit legs of the same ticket", () => {
    const entryExec = {
      symbol: "US100.CASH",
      side: "buy",
      quantity: 0.1,
      price: 24597.95,
      executedAt: "2025-09-23T17:58:41.000Z",
      importMetadata: {
        id: "entry",
        group: '["history-metatrader","78698762","US100.CASH","long","2025-09-23T17:58:41.000Z",24597.95]',
      },
    };

    const exitExec = {
      symbol: "US100.CASH",
      side: "sell",
      quantity: 0.1,
      price: 24552.65,
      executedAt: "2025-09-23T18:19:42.000Z",
      importMetadata: {
        id: "exit",
        group: '["history-metatrader","78698762","US100.CASH","long","2025-09-23T17:58:41.000Z",24597.95]',
      },
    };

    expect(executionHash(entryExec)).not.toBe(executionHash(exitExec));
  });

  it("falls back to legacy content hash when no broker ticket is present", () => {
    const manualExec1 = {
      symbol: "NQ",
      side: "buy",
      quantity: 1,
      price: 20000,
      executedAt: "2026-01-01T10:00:00.000Z",
    };
    const manualExec2 = {
      symbol: "NQ",
      side: "buy",
      quantity: 1,
      price: 20000,
      executedAt: "2026-01-01T11:00:00.000Z",
    };

    expect(executionHash(manualExec1)).not.toBe(executionHash(manualExec2));
  });
});
