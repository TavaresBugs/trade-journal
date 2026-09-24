import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { formatToPlatformId, getBrokerInfo } from "../src/lib/brokers/broker-catalog";

const previousDir = process.env.JOURNAL_DATA_DIR;
const scratch = mkdtempSync(join(tmpdir(), "journal-auto-binding-"));
process.env.JOURNAL_DATA_DIR = scratch;

const { db, accounts, executions, trades, importSources } = await import("../src/db");
const { POST } = await import("../src/app/api/import/route");

const post = (body: object) =>
  POST(new Request("http://localhost/api/import", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.stubEnv("JOURNAL_PASSWORD", "");
  db.delete(trades).run();
  db.delete(executions).run();
  db.delete(importSources).run();
  db.delete(accounts).run();
});

afterAll(() => {
  vi.unstubAllEnvs();
  db.$client.close();
  if (previousDir === undefined) delete process.env.JOURNAL_DATA_DIR;
  else process.env.JOURNAL_DATA_DIR = previousDir;
  rmSync(scratch, { recursive: true, force: true });
});

describe("Auto-Binding formatToPlatformId & getBrokerInfo", () => {
  it("maps import formats to canonical platform IDs correctly", () => {
    expect(formatToPlatformId("metatrader")).toBe("metatrader5");
    expect(formatToPlatformId("history-metatrader")).toBe("metatrader5");
    expect(formatToPlatformId("tradovate")).toBe("tradovate");
    expect(formatToPlatformId("ninjatrader")).toBe("ninjatrader");
    expect(formatToPlatformId("topstepx")).toBe("topstepx");
    expect(formatToPlatformId("tradesea")).toBe("tradesea");
    expect(formatToPlatformId("ibkr")).toBe("ibkr");
    expect(formatToPlatformId("ibkr-flex")).toBe("ibkr");
    expect(formatToPlatformId("thinkorswim")).toBe("thinkorswim");
    expect(formatToPlatformId("tradingview")).toBe("tradingview");
    expect(formatToPlatformId("unknown-format")).toBeUndefined();
  });

  it("resolves merged identities for prop firms + execution platforms", () => {
    // Lucid Trading + Tradovate
    const lucidTradovate = getBrokerInfo("lucid", "tradovate");
    expect(lucidTradovate).toBeDefined();
    expect(lucidTradovate?.name).toBe("Lucid Trading");
    expect(lucidTradovate?.icon).toBe("lucid.png");
    expect(lucidTradovate?.platform).toBe("tradovate");
    expect(lucidTradovate?.platformName).toBe("Tradovate");
    expect(lucidTradovate?.platformIcon).toBe("tradovate.svg");

    // Lucid Trading + NinjaTrader
    const lucidNinja = getBrokerInfo("lucid", "ninjatrader");
    expect(lucidNinja).toBeDefined();
    expect(lucidNinja?.name).toBe("Lucid Trading");
    expect(lucidNinja?.platform).toBe("ninjatrader");
    expect(lucidNinja?.platformName).toBe("NinjaTrader 8");
    expect(lucidNinja?.platformIcon).toBe("ninjatrader.svg");

    // FTMO + MetaTrader 5
    const ftmoMt5 = getBrokerInfo("ftmo", "metatrader5");
    expect(ftmoMt5).toBeDefined();
    expect(ftmoMt5?.name).toBe("FTMO");
    expect(ftmoMt5?.platform).toBe("metatrader5");
    expect(ftmoMt5?.platformName).toBe("MetaTrader 5");
    expect(ftmoMt5?.platformIcon).toBe("metatrader5.png");

    // Apex + NinjaTrader
    const apexNinja = getBrokerInfo("apex", "ninjatrader");
    expect(apexNinja).toBeDefined();
    expect(apexNinja?.name).toBe("Apex Trader Funding");
    expect(apexNinja?.platform).toBe("ninjatrader");
    expect(apexNinja?.platformName).toBe("NinjaTrader 8");
    expect(apexNinja?.platformIcon).toBe("ninjatrader.svg");

    // Topstep + TopstepX
    const topstep = getBrokerInfo("topstep", "topstepx");
    expect(topstep).toBeDefined();
    expect(topstep?.name).toBe("Topstep");
    expect(topstep?.platform).toBe("topstepx");
    expect(topstep?.platformName).toBe("TopstepX");
  });
});

describe("Auto-Binding on import commit", () => {
  it("binds Tradovate platform to a Lucid Trading account upon file commit", async () => {
    db.insert(accounts)
      .values({
        id: "lucid-acc",
        name: "Lucid 50k",
        broker: "lucid",
        kind: "import",
        createdAt: "2026-01-01",
      })
      .run();

    const tradovateContent = `orderId,Account,Date,Fill Time,B/S,Contract,Product,Filled Qty,Avg Fill Price,Status
1001,LUCID123,08/20/2026,08/20/2026 09:31:05,Buy,ESU6,ES,1,5000,Filled
1002,LUCID123,08/20/2026,08/20/2026 09:45:10,Sell,ESU6,ES,1,5010,Filled`;

    const res = await post({
      mode: "commit",
      content: tradovateContent,
      accountId: "lucid-acc",
      timeZone: "UTC",
    });
    expect(res.status).toBe(200);

    const updated = db.select().from(accounts).where(eq(accounts.id, "lucid-acc")).get();
    expect(updated?.broker).toBe("lucid");
    expect(updated?.platform).toBe("tradovate");

    const resolved = getBrokerInfo(updated?.broker, updated?.platform);
    expect(resolved?.name).toBe("Lucid Trading");
    expect(resolved?.platformName).toBe("Tradovate");
    expect(resolved?.platformIcon).toBe("tradovate.svg");
  });

  it("binds both broker and platform if target account has no broker set", async () => {
    db.insert(accounts)
      .values({
        id: "empty-acc",
        name: "My Unassigned Account",
        broker: "",
        kind: "import",
        createdAt: "2026-01-01",
      })
      .run();

    const tradovateContent = `orderId,Account,Date,Fill Time,B/S,Contract,Product,Filled Qty,Avg Fill Price,Status
2001,ACC1,08/20/2026,08/20/2026 09:31:05,Buy,ESU6,ES,1,5000,Filled
2002,ACC1,08/20/2026,08/20/2026 09:45:10,Sell,ESU6,ES,1,5010,Filled`;

    const res = await post({
      mode: "commit",
      content: tradovateContent,
      accountId: "empty-acc",
      timeZone: "UTC",
    });
    expect(res.status).toBe(200);

    const updated = db.select().from(accounts).where(eq(accounts.id, "empty-acc")).get();
    expect(updated?.broker).toBe("tradovate");
    expect(updated?.platform).toBe("tradovate");
  });
});
