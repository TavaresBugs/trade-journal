import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import {
  formatToPlatformId,
  getAccountBrokerInfo,
  getBrokerInfo,
  getPlatformOptionsForBroker,
  platformToDefaultBrokerId,
  checkPlatformCompatibility,
  getPresetForDetectedStatement,
} from "../src/lib/brokers/broker-catalog";

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
    expect(formatToPlatformId("wealthcharts")).toBe("wealthcharts");
    expect(formatToPlatformId("rithmic")).toBe("rithmic");
    expect(formatToPlatformId("ibkr")).toBe("ibkr");
    expect(formatToPlatformId("ibkr-flex")).toBe("ibkr");
    expect(formatToPlatformId("thinkorswim")).toBe("thinkorswim");
    expect(formatToPlatformId("tradingview")).toBe("tradingview");
    expect(formatToPlatformId("unknown-format")).toBeUndefined();
    expect(platformToDefaultBrokerId("metatrader5")).toBe("metatrader");
    expect(platformToDefaultBrokerId("metatrader4")).toBe("metatrader");
    expect(platformToDefaultBrokerId("tradovate")).toBe("tradovate");
    expect(platformToDefaultBrokerId("wealthcharts")).toBe("wealthcharts");
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

    // FTMO + cTrader
    const ftmoCtrader = getBrokerInfo("ftmo", "ctrader");
    expect(ftmoCtrader).toBeDefined();
    expect(ftmoCtrader?.name).toBe("FTMO");
    expect(ftmoCtrader?.platform).toBe("ctrader");
    expect(ftmoCtrader?.platformName).toBe("cTrader");
    expect(ftmoCtrader?.platformIcon).toBe("ctrader.png");

    // Tradeify prop firm
    const tradeify = getBrokerInfo("tradeify");
    expect(tradeify).toBeDefined();
    expect(tradeify?.name).toBe("Tradeify");
    expect(tradeify?.icon).toBe("tradeify.png");
    expect(tradeify?.category).toBe("prop-firm");

    // cTrader standalone platform
    const ctrader = getBrokerInfo("ctrader");
    expect(ctrader).toBeDefined();
    expect(ctrader?.name).toBe("cTrader");
    expect(ctrader?.icon).toBe("ctrader.png");
    expect(ctrader?.category).toBe("platform");

    // Apex + NinjaTrader
    const apexNinja = getBrokerInfo("apex", "ninjatrader");
    expect(apexNinja).toBeDefined();
    expect(apexNinja?.name).toBe("Apex Trader Funding");
    expect(apexNinja?.platform).toBe("ninjatrader");
    expect(apexNinja?.platformName).toBe("NinjaTrader 8");
    expect(apexNinja?.platformIcon).toBe("ninjatrader.svg");

    // Apex + WealthCharts
    const apexWealth = getBrokerInfo("apex", "wealthcharts");
    expect(apexWealth).toBeDefined();
    expect(apexWealth?.name).toBe("Apex Trader Funding");
    expect(apexWealth?.platform).toBe("wealthcharts");
    expect(apexWealth?.platformName).toBe("WealthCharts");
    expect(apexWealth?.platformIcon).toBe("wealthcharts.png");

    // Topstep + TopstepX
    const topstep = getBrokerInfo("topstep", "topstepx");
    expect(topstep).toBeDefined();
    expect(topstep?.name).toBe("Topstep");
    expect(topstep?.platform).toBe("topstepx");
    expect(topstep?.platformName).toBe("TopstepX");

    // Rithmic standalone (with official rithmic.png)
    const rithmic = getBrokerInfo("rithmic");
    expect(rithmic).toBeDefined();
    expect(rithmic?.name).toBe("Rithmic");
    expect(rithmic?.icon).toBe("rithmic.png");
    expect(rithmic?.platformIcon).toBe("rithmic.png");

    // TradeSea standalone (with official tradesea.png)
    const tradesea = getBrokerInfo("tradesea");
    expect(tradesea).toBeDefined();
    expect(tradesea?.name).toBe("TradeSea");
    expect(tradesea?.icon).toBe("tradesea.png");
    expect(tradesea?.platformIcon).toBe("tradesea.png");

    // FTMO platform options contain cTrader
    const ftmoPlatforms = getPlatformOptionsForBroker("ftmo");
    expect(ftmoPlatforms.some((p) => p.value === "ctrader")).toBe(true);

    // Tradeify platform options contain Tradovate and NinjaTrader
    const tradeifyPlatforms = getPlatformOptionsForBroker("tradeify");
    expect(tradeifyPlatforms.some((p) => p.value === "tradovate")).toBe(true);
    expect(tradeifyPlatforms.some((p) => p.value === "ninjatrader")).toBe(true);

    // Fuzzy account matching for Tradeify and cTrader
    const matchedTradeify = getAccountBrokerInfo({ name: "Tradeify 50k Funded" });
    expect(matchedTradeify?.name).toBe("Tradeify");
    expect(matchedTradeify?.icon).toBe("tradeify.png");

    const matchedCtrader = getAccountBrokerInfo({ name: "FTMO cTrader Main" });
    expect(matchedCtrader?.name).toBe("FTMO");

    const matchedPureCtrader = getAccountBrokerInfo({ name: "Spotware cTrader Raw" });
    expect(matchedPureCtrader?.name).toBe("cTrader");
    expect(matchedPureCtrader?.icon).toBe("ctrader.png");
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

  describe("Platform Compatibility & Preset Detection", () => {
    it("detects compatible broker and platform combinations", () => {
      // FTMO supports MT5, MT4, cTrader
      expect(
        checkPlatformCompatibility({ broker: "ftmo", platform: "metatrader5" }, "metatrader")
          .compatible,
      ).toBe(true);
      expect(
        checkPlatformCompatibility({ broker: "ftmo", platform: "ctrader" }, "ctrader").compatible,
      ).toBe(true);

      // FTMO does NOT support Tradovate or NinjaTrader
      const ftmoTradovate = checkPlatformCompatibility(
        { broker: "ftmo", platform: "metatrader5" },
        "tradovate",
      );
      expect(ftmoTradovate.compatible).toBe(false);
      expect(ftmoTradovate.reason).toContain("FTMO");

      // Lucid supports Tradovate and NinjaTrader
      expect(
        checkPlatformCompatibility({ broker: "lucid", platform: "tradovate" }, "tradovate")
          .compatible,
      ).toBe(true);
      expect(
        checkPlatformCompatibility({ broker: "lucid", platform: "ninjatrader" }, "ninjatrader")
          .compatible,
      ).toBe(true);
      // Lucid does NOT support MT5
      expect(
        checkPlatformCompatibility({ broker: "lucid", platform: "tradovate" }, "metatrader")
          .compatible,
      ).toBe(false);
    });

    it("detects statement presets accurately", () => {
      const lucidPreset = getPresetForDetectedStatement("LFE0506847043001", "tradovate");
      expect(lucidPreset.broker).toBe("lucid");
      expect(lucidPreset.platform).toBe("tradovate");
      expect(lucidPreset.tab).toBe("prop");
      expect(lucidPreset.suggestedName).toBe("Lucid LFE0506847043001");
      expect(lucidPreset.timeZone).toBe("America/Chicago");

      const apexPreset = getPresetForDetectedStatement("PA-APEX-12345", "tradovate");
      expect(apexPreset.broker).toBe("apex");
      expect(apexPreset.suggestedName).toBe("Apex PA-APEX-12345");

      const ftmoPreset = getPresetForDetectedStatement("530319802", "metatrader");
      expect(ftmoPreset.broker).toBe("ftmo");
      expect(ftmoPreset.platform).toBe("metatrader5");
      expect(ftmoPreset.suggestedName).toBe("FTMO 530319802");
    });
  });

  describe("Account & Platform Conflict Prevention on Import", () => {
    it("rejects commit when statement account conflicts with target account", async () => {
      db.insert(accounts)
        .values({
          id: "eval-ftmo",
          name: "Eval",
          broker: "ftmo",
          platform: "metatrader5",
          accountNumber: "530319802",
          kind: "import",
          createdAt: "2026-01-01",
        })
        .run();

      const tradovateContent = `orderId,Account,Date,Fill Time,B/S,Contract,Product,Filled Qty,Avg Fill Price,Status
3001,LFE0506847043001,08/20/2026,08/20/2026 09:31:05,Buy,MNQU6,MNQ,1,20000,Filled
3002,LFE0506847043001,08/20/2026,08/20/2026 09:45:10,Sell,MNQU6,MNQ,1,20010,Filled`;

      // 1. Attempt commit without forceMismatch -> MUST FAIL WITH 400
      const res = await post({
        mode: "commit",
        content: tradovateContent,
        accountId: "eval-ftmo",
        timeZone: "UTC",
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Account mismatch");

      // 2. Verify preview flags the conflict
      const previewRes = await post({
        mode: "preview",
        content: tradovateContent,
        accountId: "eval-ftmo",
        timeZone: "UTC",
      });
      expect(previewRes.status).toBe(200);
      const previewJson = await previewRes.json();
      expect(previewJson.accountConflict?.isConflict).toBe(true);
      expect(previewJson.accountConflict?.detectedAccount).toBe("LFE0506847043001");
      expect(previewJson.accountConflict?.targetAccountNumber).toBe("530319802");
      expect(previewJson.compatibility?.compatible).toBe(false);

      // 3. Commit with forceMismatch: true passes when explicitly forced
      const forcedRes = await post({
        mode: "commit",
        content: tradovateContent,
        accountId: "eval-ftmo",
        timeZone: "UTC",
        forceMismatch: true,
      });
      expect(forcedRes.status).toBe(200);
    });
  });
});

