import { executionHash, extractBrokerTicket } from "../../src/server/ids";


import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { parseAuto } from "@luxalgo/journal-importers";
import type { ImportReview, ImportReviewOptions } from "../../src/lib/import-review";
const previousDir = process.env.JOURNAL_DATA_DIR;
const scratch = mkdtempSync(join(tmpdir(), "journal-reconciliation-"));
process.env.JOURNAL_DATA_DIR = scratch;
const {
  db,
  accounts,
  executions,
  trades,
  settings,
  attachments,
  importSources,
  importSourceAliases,
  importBatches,
} = await import("../../src/db");
const { insertExecutions } = await import("../../src/server/executions");
const { rebuildAccount } = await import("../../src/server/rebuild");
const { POST } = await import("../../src/app/api/import/route");
const { PATCH: updateSettings } = await import("../../src/app/api/settings/route");
const importRoute = POST;

function makeImportRequest(body: unknown): Request {
  return new Request("http://localhost/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const header = "Instrument,Action,Quantity,Price,Time,Account,Connection,ID,Commission";
const buy = "AAPL,Buy,1,100,2026-09-15 09:30,A,broker,e1,0";
const sell = "AAPL,Sell,1,110,2026-09-15 09:31,A,broker,e2,0";
const csv = (rows = [buy, sell]) => [header, ...rows].join("\n");
async function post(body: object) {
  return POST(
    new Request("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}
async function preview(content = csv(), review: ImportReviewOptions = {}, accountId = "test") {
  const response = await post({ mode: "preview", content, review, accountId, timeZone: "UTC" });
  expect(response.status).toBe(200);
  return (await response.json()).reconciliation as ImportReview;
}
async function commit(content = csv(), review: ImportReviewOptions = {}, accountId = "test") {
  const plan = await preview(content, review, accountId);
  return post({
    mode: "commit",
    content,
    accountId,
    timeZone: "UTC",
    review: { ...review, previewToken: plan.token ?? undefined },
  });
}
const rows = () => db.select().from(trades).where(eq(trades.accountId, "test")).all();
const state = () => ({
  executions: db.select().from(executions).all(),
  trades: db.select().from(trades).all(),
  sources: db.select().from(importSources).all(),
  aliases: db.select().from(importSourceAliases).all(),
  batches: db.select().from(importBatches).all(),
  attachments: db.select().from(attachments).all(),
});
beforeEach(() => {
  vi.stubEnv("JOURNAL_PASSWORD", "");
  db.delete(attachments).run();
  db.delete(trades).run();
  db.delete(executions).run();
  db.delete(accounts).run();
  db.delete(settings).run();
  db.insert(accounts)
    .values(
      ["test", "other"].map((id) => ({
        id,
        name: id,
        kind: "import" as const,
        createdAt: "2026-01-01",
      })),
    )
    .run();
});

describe("NinjaTrader review protects identity and source corrections", () => {
  it("does not write while previewing and requires the reviewed token", async () => {
    const before = state(),
      plan = await preview();
    expect(plan).toMatchObject({
      inserted: 2,
      duplicates: 0,
      conflicts: [],
      totals: { netPnl: 10, closedTrades: 1, openTrades: 0 },
    });
    expect(plan.token).toBeTruthy();
    expect(state()).toEqual(before);
    const response = await post({
      mode: "commit",
      content: csv(),
      accountId: "test",
      timeZone: "UTC",
    });
    expect(response.status).toBe(400);
    expect(state()).toEqual(before);
  });

  it("exports the source identity, aliases and import history with journal data", async () => {
    await commit();
    const { GET } = await import("../../src/app/api/export/route");
    const response = await GET(new Request("http://localhost/api/export"));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.importSources).toEqual(state().sources);
    expect(data.importSourceAliases).toEqual(state().aliases);
    expect(data.importBatches).toEqual(state().batches);
    expect(data.executions).toHaveLength(2);
    expect(JSON.parse(data.executions[0].importMetadataJson).ninjaTrader.sourceId).toBe(
      data.importSources[0].id,
    );
  });

  it.each(["oops", "Infinity", "$", "--2"])(
    "blocks malformed commission %s without changing the journal",
    async (value) => {
      await commit();
      const before = state();
      const changed = csv([buy.replace(/,0$/, `,${value}`), sell]);
      expect((await preview(changed)).conflicts.join(" ")).toContain("invalid commission");
      expect((await commit(changed)).status).toBe(400);
      expect(state()).toEqual(before);
    },
  );

  it("invalidates a preview after effective default fees change", async () => {
    const content = csv([buy.replace(/,0$/, ","), sell.replace(/,0$/, ",")]);
    const plan = await preview(content);
    expect(plan.totals?.netPnl).toBe(10);
    db.insert(settings)
      .values({
        key: "journalDefaults",
        value: JSON.stringify({
          feeRules: [{ id: "f", accountId: "test", symbol: "", amount: 1, mode: "execution" }],
        }),
      })
      .run();
    expect(
      (
        await post({
          mode: "commit",
          content,
          accountId: "test",
          timeZone: "UTC",
          review: { previewToken: plan.token },
        })
      ).status,
    ).toBe(400);
    expect(state().executions).toHaveLength(0);
    expect((await preview(content)).totals?.netPnl).toBe(8);
    expect((await commit(content)).status).toBe(200);
    // Defaults do not retroactively change already imported executions on reimport.
    db.update(settings)
      .set({
        value: JSON.stringify({
          feeRules: [{ id: "f", accountId: "test", symbol: "", amount: 2, mode: "execution" }],
        }),
      })
      .where(eq(settings.key, "journalDefaults"))
      .run();
    expect((await preview(content)).totals?.netPnl).toBe(8);
    expect(await (await commit(content)).json()).toMatchObject({
      inserted: 0,
      corrected: 0,
      duplicates: 2,
    });
  });

  it.each(["connection", "account missing", "account renamed"])(
    "requires source reconciliation when %s changes",
    async (change) => {
      expect((await commit()).status).toBe(200);
      const original = state();
      const changed =
        change === "connection"
          ? csv().replaceAll(",broker,", ",renamed,")
          : csv().replaceAll(",A,", change === "account missing" ? ",," : ",New name,");
      const plan = await preview(changed);
      expect(plan.token).toBeNull();
      expect(plan.conflicts.join(" ")).toContain("choose its saved source");
      expect((await commit(changed)).status).toBe(400);
      expect(state()).toEqual(original);
      const source = original.sources[0]!;
      const mapping = { sourceMappings: { [plan.sources[0]!.key]: source.id } };
      const resolved = await preview(changed, mapping);
      expect(resolved).toMatchObject({
        inserted: 0,
        duplicates: 2,
        conflicts: [],
        totals: { netPnl: 10 },
      });
      expect(await (await commit(changed, mapping)).json()).toMatchObject({
        inserted: 0,
        duplicates: 2,
      });
      expect(rows().map((t) => t.key)).toEqual(original.trades.map((t) => t.key));
      expect(db.select().from(importSourceAliases).all()).toHaveLength(2);
      expect((await preview(changed)).token).toBeTruthy();
    },
  );

  it("allows explicitly separate sources with reused execution IDs without netting accounts", async () => {
    await commit();
    const other = csv().replaceAll(",A,", ",B,");
    const plan = await preview(other);
    const options = { sourceMappings: { [plan.sources[0]!.key]: "new" } };
    expect((await commit(other, options)).status).toBe(200);
    expect(rows()).toHaveLength(2);
    expect(rows().reduce((sum, t) => sum + t.netPnl, 0)).toBe(20);
  });

  it("rejects mappings to another destination or reassignment of a saved source", async () => {
    await commit(csv(), {}, "other");
    const foreign = db.select().from(importSources).all()[0]!;
    const plan = await preview();
    expect(
      (await commit(csv(), { sourceMappings: { [plan.sources[0]!.key]: foreign.id } })).status,
    ).toBe(400);
    await commit();
    expect(
      (await commit(csv(), { sourceMappings: { [plan.sources[0]!.key]: "new" } })).status,
    ).toBe(400);
  });

  it("shows fee corrections, requires approval and preserves execution IDs, reviews and attachments", async () => {
    await commit();
    const original = state();
    const key = rows()[0]!.key;
    db.update(trades)
      .set({
        notes: "Keep this review",
        rating: 5,
        tagsJson: '["setup"]',
        reviewedAt: "2026-09-15",
      })
      .where(eq(trades.key, key))
      .run();
    db.insert(attachments)
      .values({
        id: "chart",
        ownerType: "trade",
        ownerId: key,
        name: "chart.png",
        mime: "image/png",
        size: 3,
        data: Buffer.from([1, 2, 3]),
        createdAt: "2026-09-15",
      })
      .run();
    const corrected = csv([buy.replace(/,0$/, ",1"), sell.replace(/,0$/, ",1")]);
    const plan = await preview(corrected);
    expect(plan.corrections).toHaveLength(2);
    expect(plan.token).toBeNull();
    expect(plan.totals?.netPnl).toBe(8);
    const before = state();
    expect((await commit(corrected)).status).toBe(400);
    expect(state()).toEqual(before);
    expect(await (await commit(corrected, { approveFeeCorrections: true })).json()).toMatchObject({
      inserted: 0,
      corrected: 2,
    });
    expect(rows()[0]).toMatchObject({
      key,
      notes: "Keep this review",
      rating: 5,
      tagsJson: '["setup"]',
      reviewedAt: "2026-09-15",
      netPnl: 8,
      fees: 2,
    });
    expect(
      state()
        .executions.map((e) => e.id)
        .sort(),
    ).toEqual(original.executions.map((e) => e.id).sort());
    expect(state().attachments).toEqual(before.attachments);
    expect(await (await commit(corrected)).json()).toMatchObject({
      inserted: 0,
      duplicates: 2,
      corrected: 0,
    });
  });

  it.each([
    csv([buy.replace(",100,", ",101,"), sell]),
    csv([buy.replace(",1,100,", ",2,100,"), sell]),
    csv([buy.replace("09:30", "09:29"), sell]),
    csv([buy.replace("AAPL", "MSFT"), sell]),
  ])("blocks changes to existing native execution economics", async (changed) => {
    await commit();
    const before = state();
    expect((await commit(changed)).status).toBe(400);
    expect(state()).toEqual(before);
  });

  it("rejects contradictory commissions under the same ID within a file", async () => {
    const contradictory = csv([buy, buy.replace(/,0$/, ",1"), sell]);
    const plan = await preview(contradictory);
    expect(plan.conflicts.join(" ")).toContain("contradictory");
    expect((await commit(contradictory)).status).toBe(400);
    expect(state().executions).toHaveLength(0);
  });

  it("rejects changed statement timezone for a saved source", async () => {
    await commit();
    const before = state();
    const response = await post({
      mode: "preview",
      content: csv(),
      accountId: "test",
      timeZone: "America/New_York",
    });
    const plan = (await response.json()).reconciliation;
    expect(plan.conflicts.join(" ")).toContain("different statement timezone");
    expect(plan.token).toBeNull();
    expect(state()).toEqual(before);
  });

  it("invalidates a preview when the journal or account currency changes", async () => {
    const plan = await preview();
    await commit();
    const stale = await post({
      mode: "commit",
      content: csv(),
      accountId: "test",
      timeZone: "UTC",
      review: { previewToken: plan.token },
    });
    expect(stale.status).toBe(400);
    expect(state().executions).toHaveLength(2);
    const next = await preview();
    db.insert(settings).values({ key: "journalDefaults", value: '{"feeRules":[]}' }).run();
    // Equivalent settings do not needlessly invalidate the semantic plan.
    db.update(accounts).set({ currency: "EUR" }).where(eq(accounts.id, "test")).run();
    expect(
      (
        await post({
          mode: "commit",
          content: csv(),
          accountId: "test",
          timeZone: "UTC",
          review: { previewToken: next.token },
        })
      ).status,
    ).toBe(400);
  });

  it("rolls back source mappings, fills and history when rebuilding fails", async () => {
    const before = state();
    const plan = await preview();
    db.$client.exec(
      "CREATE TRIGGER fail_review BEFORE INSERT ON trades BEGIN SELECT RAISE(FAIL, 'rebuild failure'); END",
    );
    try {
      expect(
        (
          await post({
            mode: "commit",
            content: csv(),
            accountId: "test",
            timeZone: "UTC",
            review: { previewToken: plan.token },
          })
        ).status,
      ).toBe(500);
      expect(state()).toEqual(before);
    } finally {
      db.$client.exec("DROP TRIGGER fail_review");
    }
  });
});

describe("NinjaTrader overlapping exports and chronology", () => {
  const noIds = () => csv([buy.replace(",e1,", ",,"), sell.replace(",e2,", ",,")]);
  it("requires an explicit source for a first export with no account label", async () => {
    const content = csv().replaceAll(",A,", ",,");
    const plan = await preview(content);
    expect(plan.token).toBeNull();
    expect((await commit(content)).status).toBe(400);
    expect(
      (await commit(content, { sourceMappings: { [plan.sources[0]!.key]: "new" } })).status,
    ).toBe(200);
    expect(rows()[0]?.netPnl).toBe(10);
  });

  it.each(["fifo", "lifo", "wavg"] as const)(
    "extends an open position across exports with %s while preserving its review",
    async (method) => {
      db.update(accounts).set({ profitCalcMethod: method }).where(eq(accounts.id, "test")).run();
      const entry = csv([buy.replace(",1,100,", ",2,100,")]);
      expect((await commit(entry)).status).toBe(200);
      const key = rows()[0]!.key;
      db.update(trades)
        .set({ notes: "Opening review", rating: 4 })
        .where(eq(trades.key, key))
        .run();
      expect((await commit(csv([sell]))).status).toBe(200);
      expect(rows()[0]).toMatchObject({ key, openQuantity: 1, notes: "Opening review", rating: 4 });
      const exit = sell.replace("09:31", "09:32").replace("e2", "e3").replace(",110,", ",90,");
      expect((await commit(csv([exit]))).status).toBe(200);
      expect(rows()[0]).toMatchObject({
        key,
        openQuantity: 0,
        netPnl: 0,
        notes: "Opening review",
        rating: 4,
      });
    },
  );

  it("keeps different futures expiry positions separate even when symbols normalize to the same root", async () => {
    db.insert(settings).values({ key: "multipliers", value: '{"ES":50}' }).run();
    const content = csv([buy.replace("AAPL", "ES 09-26"), sell.replace("AAPL", "ES 12-26")]);
    expect((await commit(content)).status).toBe(200);
    expect(rows()).toHaveLength(2);
    expect(
      rows()
        .map((t) => t.direction)
        .sort(),
    ).toEqual(["long", "short"]);
    expect(rows().every((t) => t.openQuantity === 1)).toBe(true);
  });

  it("rejects earlier history that would replace an annotated trade identity", async () => {
    await commit();
    db.update(trades).set({ notes: "Must survive" }).run();
    const before = state();
    const earlier = csv([buy.replace("09:30", "09:29").replace("e1", "earlier")]);
    expect((await preview(earlier)).conflicts.join(" ")).toContain(
      "replace existing trade identities",
    );
    expect((await commit(earlier)).status).toBe(400);
    expect(state()).toEqual(before);
  });

  it("reconstructs an explicit reversal into a closed long and a new short", async () => {
    const content = [
      header + ",E/X",
      buy + ",Entry",
      sell.replace(",1,110,", ",2,110,") + ",Reverse",
      buy.replace("09:30", "09:32").replace(",100,", ",105,").replace("e1", "e3") + ",Exit",
    ].join("\n");
    expect((await commit(content)).status).toBe(200);
    expect(rows()).toHaveLength(2);
    expect(
      rows()
        .map((t) => [t.direction, t.netPnl])
        .sort(),
    ).toEqual([
      ["long", 10],
      ["short", 5],
    ]);
  });

  it("recognizes repeat/reordered snapshots but requires a completeness declaration for a changed overlap", async () => {
    await commit(noIds());
    const before = state();
    const [head, ...body] = noIds().split("\n");
    expect(await (await commit([head, ...body.reverse()].join("\n"))).json()).toMatchObject({
      inserted: 0,
      duplicates: 2,
    });
    const growing = csv([
      buy.replace(",e1,", ",,"),
      buy.replace(",e1,", ",,"),
      sell.replace(",e2,", ",,"),
      sell.replace(",e2,", ",,"),
    ]);
    const plan = await preview(growing);
    expect(plan.needsCompleteHistory).toBe(true);
    expect(plan.token).toBeNull();
    expect((await commit(growing)).status).toBe(400);
    expect(state().executions).toEqual(before.executions);
    expect(await (await commit(growing, { completeHistory: true })).json()).toMatchObject({
      inserted: 2,
      duplicates: 2,
    });
    expect(rows()[0]).toMatchObject({ quantity: 2, netPnl: 20, openQuantity: 0 });
    expect(await (await commit(noIds())).json()).toMatchObject({ inserted: 0, duplicates: 2 });
  });

  it("blocks a declared complete export that omits earlier fills inside its time range", async () => {
    const first = csv([
      buy.replace(",e1,", ",,"),
      sell.replace(",e2,", ",,"),
      buy.replace("09:30", "09:32").replace(",e1,", ",,"),
    ]);
    await commit(first);
    const before = state();
    const partial = csv([
      buy.replace(",e1,", ",,"),
      buy.replace("09:30", "09:32").replace(",e1,", ",,"),
    ]);
    const plan = await preview(partial, { completeHistory: true });
    expect(plan.conflicts.join(" ")).toContain("omits or changes");
    expect((await commit(partial, { completeHistory: true })).status).toBe(400);
    expect(state()).toEqual(before);
  });

  it("blocks arbitrary same-time entry/exit ordering without supporting facts", async () => {
    const tied = csv([sell.replace("09:31", "09:30"), buy]);
    const plan = await preview(tied);
    expect(plan.conflicts.join(" ")).toContain("order is ambiguous");
    expect(plan.token).toBeNull();
    expect((await commit(tied)).status).toBe(400);
    expect(state().executions).toHaveLength(0);
  });

  it("uses millisecond precision to order opposing fills without Entry/Exit labels", async () => {
    const content = csv([
      sell.replace("09:31", "09:30:00.200"),
      buy.replace("09:30", "09:30:00.100"),
    ]);
    const plan = await preview(content);
    expect(plan.conflicts).toEqual([]);
    expect(plan.totals?.netPnl).toBe(10);
    expect((await commit(content)).status).toBe(200);
    expect(rows()[0]).toMatchObject({
      direction: "long",
      openedAt: "2026-09-15T09:30:00.100Z",
      closedAt: "2026-09-15T09:30:00.200Z",
      netPnl: 10,
    });
  });

  it.each([false, true])(
    "uses Entry/Exit to resolve a uniquely ordered same-time pair (reversed=%s)",
    async (reverse) => {
      const entry = buy + ",Entry",
        exit = sell.replace("09:31", "09:30") + ",Exit";
      const content = [header + ",E/X", ...(reverse ? [exit, entry] : [entry, exit])].join("\n");
      expect((await commit(content)).status).toBe(200);
      expect(rows()[0]).toMatchObject({ direction: "long", netPnl: 10, openQuantity: 0 });
    },
  );

  it("requires a sequence for multiple possible same-time cycles", async () => {
    const rowsWithFacts = [
      buy + ",Entry",
      sell.replace("09:31", "09:30") + ",Exit",
      buy.replace(",100,", ",105,").replace("e1", "e3") + ",Entry",
    ];
    const content = [header + ",E/X", ...rowsWithFacts].join("\n");
    expect((await commit(content)).status).toBe(400);
    const sequenced = [
      header + ",E/X,Sequence",
      ...rowsWithFacts.map((row, i) => row + "," + (i + 1)).reverse(),
    ].join("\n");
    expect((await commit(sequenced)).status).toBe(200);
    expect(rows()).toHaveLength(2);
    expect(rows().filter((t) => t.status !== "open")[0]?.netPnl).toBe(10);
  });

  it("blocks an exit with missing opening history rather than creating a false short", async () => {
    const content = [header + ",E/X", sell + ",Exit"].join("\n");
    expect((await commit(content)).status).toBe(400);
    expect(state().executions).toHaveLength(0);
  });

  it("does not silently skip malformed rows in a position reconstruction", async () => {
    const broken = csv([buy.replace(",1,100,", ",oops,100,"), sell]);
    const plan = await preview(broken);
    expect(plan.conflicts.join(" ")).toContain("invalid execution rows");
    expect((await commit(broken)).status).toBe(400);
  });
});


// --- NinjaTrader Import & Copy Trades ---

describe("NinjaTrader imports through preview, storage and rebuild", () => {
  const sample = readFileSync(
    new URL(
      "../../../../packages/importers/tests/fixtures/ninjatrader-copy-trades.csv",
      import.meta.url,
    ),
    "utf8",
  );
  const request = (body: object) =>
    new Request("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const preview = async (content = sample, accountId = "test", review: ImportReviewOptions = {}) => {
    const response = await POST(
      request({ mode: "preview", content, accountId, timeZone: "UTC", review }),
    );
    expect(response.status).toBe(200);
    return response.json();
  };
  const commit = async (content = sample, accountId = "test", review: ImportReviewOptions = {}) => {
    const inspected = await preview(content, accountId, review);
    return POST(
      request({
        mode: "commit",
        content,
        accountId,
        timeZone: "UTC",
        review: { ...review, previewToken: inspected.reconciliation?.token ?? undefined },
      }),
    );
  };
  const csv = (rows: string[]) =>
    [
      "Instrument,Action,Quantity,Price,Time,Account,Connection,Execution ID,Commission",
      ...rows,
    ].join("\n");
  const accountTrades = () => db.select().from(trades).where(eq(trades.accountId, "test")).all();

  beforeEach(() => {
    vi.stubEnv("JOURNAL_PASSWORD", "");
    db.delete(trades).run();
    db.delete(executions).run();
    db.delete(accounts).run();
    db.delete(settings).run();
    db.insert(accounts)
      .values(
        ["test", "other"].map((id) => ({
          id,
          name: id,
          kind: "import" as const,
          createdAt: "2026-01-01",
        })),
      )
      .run();
    db.insert(settings)
      .values({ key: "multipliers", value: JSON.stringify({ MNQZ6: 2 }) })
      .run();
  });
  it("imports the issue #10 attachment as 26 fills, five closed trades and $5,265", async () => {
    const previewResponse = await POST(
      request({ mode: "preview", content: sample, timeZone: "UTC" }),
    );
    expect(previewResponse.status).toBe(200);
    const preview = await previewResponse.json();
    expect(preview.totals).toMatchObject({ executions: 26, skippedRows: 0 });
    expect(preview.errors).toEqual([]);
    expect(preview.warnings.join(" ")).toContain("5 source accounts");
    expect(db.select().from(executions).all()).toHaveLength(0);
    const response = await commit();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ inserted: 26, duplicates: 0, skipped: 0 });
    expect(db.select().from(executions).all()).toHaveLength(26);
    const saved = accountTrades();
    expect(saved).toHaveLength(5);
    expect(
      saved.every(
        (t) => t.status === "win" && t.openQuantity === 0 && t.quantity === 12 && t.netPnl === 1053,
      ),
    ).toBe(true);
    expect(saved.reduce((sum, t) => sum + t.netPnl, 0)).toBe(5265);
    expect(saved.map((t) => t.executionCount).sort()).toEqual([5, 5, 5, 5, 6]);
  });

  it("deduplicates original and reordered reimports without changing trade keys or annotations", async () => {
    await commit();
    const saved = accountTrades();
    const key = saved[0]!.key;
    db.update(trades).set({ notes: "Keep my review", rating: 5 }).where(eq(trades.key, key)).run();
    const [header, ...rows] = sample.trim().split(/\r?\n/);
    for (const content of [sample, [header, ...rows.toReversed()].join("\n")]) {
      const response = await commit(content);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ inserted: 0, duplicates: 26 });
    }
    rebuildAccount("test");
    expect(
      accountTrades()
        .map((t) => t.key)
        .sort(),
    ).toEqual(saved.map((t) => t.key).sort());
    expect(db.select().from(trades).where(eq(trades.key, key)).get()).toMatchObject({
      notes: "Keep my review",
      rating: 5,
      netPnl: 1053,
    });
    expect(db.select().from(executions).all()).toHaveLength(26);
  });

  it("reconciles a complete growing export and permits independent destination accounts", async () => {
    await commit();
    const extra =
      "MNQZ6,Buy,9/16/2026 9:30,29400,Entry,TRADEIFY,1,ACCOUNT-1\nMNQZ6,Sell,9/16/2026 9:31,29402,Exit,TRADEIFY,1,ACCOUNT-1";
    expect(
      await (await commit(sample.trim() + "\n" + extra, "test", { completeHistory: true })).json(),
    ).toMatchObject({
      inserted: 2,
      duplicates: 26,
    });
    expect(accountTrades()).toHaveLength(6);
    expect(accountTrades().reduce((sum, t) => sum + t.netPnl, 0)).toBe(5269);
    expect(await (await commit(sample, "other")).json()).toMatchObject({
      inserted: 26,
      duplicates: 0,
    });
  });

  it("keeps opposite source-account positions separate and deduplicates broker execution IDs", async () => {
    const content = csv([
      "AAPL,Buy,1,100,2026-09-15 09:30,A,broker,e1,0",
      "AAPL,Buy,1,100,2026-09-15 09:30,A,broker,e1,0",
      "AAPL,Buy,1,100,2026-09-15 09:30,A,broker,e2,0",
      "AAPL,Sell,2,100,2026-09-15 09:30,B,broker,e1,0",
    ]);
    expect(await (await commit(content)).json()).toMatchObject({ inserted: 3, duplicates: 1 });
    expect(accountTrades()).toHaveLength(2);
    expect(
      accountTrades()
        .map((t) => [t.direction, t.openQuantity])
        .sort(),
    ).toEqual([
      ["long", 2],
      ["short", 2],
    ]);
  });

  it("blocks reimports into an account containing legacy lossy fills, without touching reviews", async () => {
    const old = parseAuto(sample)!.executions.map(({ importMetadata, ninjaTrader, ...row }) => row);
    expect(insertExecutions("test", old, "import")).toMatchObject({ inserted: 5, duplicates: 21 });
    const key = accountTrades()[0]!.key;
    db.update(trades).set({ notes: "Existing review", rating: 4 }).where(eq(trades.key, key)).run();
    const before = db.select().from(executions).all();
    const response = await commit();
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("new journal account");
    expect(db.select().from(executions).all()).toEqual(before);
    expect(db.select().from(trades).where(eq(trades.key, key)).get()).toMatchObject({
      notes: "Existing review",
      rating: 4,
    });
    expect(await (await commit(sample, "other")).json()).toMatchObject({
      inserted: 26,
      duplicates: 0,
    });
    expect(
      db
        .select()
        .from(trades)
        .where(eq(trades.accountId, "other"))
        .all()
        .reduce((sum, t) => sum + t.netPnl, 0),
    ).toBe(5265);
  });

  it("rejects changed execution details and mixed identity layouts atomically", async () => {
    const original = csv(["AAPL,Buy,1,100,2026-09-15 09:30,A,broker,e1,0"]);
    await commit(original);
    const changed = csv([
      "AAPL,Buy,1,100,2026-09-15 09:31,A,broker,new,0",
      "AAPL,Buy,1,101,2026-09-15 09:30,A,broker,e1,0",
    ]);
    const response = await commit(changed);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("has changed quantity");
    expect(db.select().from(executions).all()).toHaveLength(1);
    const noIds = original.replace("Execution ID", "Order ID");
    const mixed = await commit(noIds);
    expect(mixed.status).toBe(400);
    expect((await mixed.json()).error).toContain("different execution-ID layouts");
    expect(db.select().from(executions).all()).toHaveLength(1);
  });

  it("blocks legacy fills whose fractional seconds were previously lost", async () => {
    const content = csv(["AAPL,Buy,1,100,2026-09-15 09:30:00.123,A,broker,e1,0"]);
    const legacy = parseAuto(content)!.executions.map(
      ({ importMetadata, ninjaTrader, ...row }) => ({
        ...row,
        executedAt: "2026-09-15T09:30:00.000Z",
      }),
    );
    insertExecutions("test", legacy, "import");
    const before = db.select().from(executions).all();
    const response = await commit(content);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("legacy fills");
    expect(db.select().from(executions).all()).toEqual(before);
  });

  it("blocks conflicting native IDs in the uploaded file before any write", async () => {
    const content = csv([
      "AAPL,Buy,1,100,2026-09-15 09:30,A,broker,e1,0",
      "AAPL,Buy,1,101,2026-09-15 09:30,A,broker,e1,0",
    ]);
    expect((await commit(content)).status).toBe(400);
    expect(db.select().from(executions).all()).toHaveLength(0);
  });

  it("preserves reported zero commissions despite account fee defaults", async () => {
    db.insert(settings)
      .values({
        key: "journalDefaults",
        value: JSON.stringify({
          feeRules: [{ id: "fee", accountId: "test", symbol: "", amount: 5, mode: "execution" }],
        }),
      })
      .run();
    const content = csv([
      "AAPL,Buy,1,100,2026-09-15 09:30,A,broker,e1,0",
      "AAPL,Sell,1,101,2026-09-15 09:31,A,broker,e2,0",
    ]);
    expect((await commit(content)).status).toBe(200);
    expect(accountTrades()[0]).toMatchObject({ netPnl: 1, fees: 0 });
  });

  it("requires the exact contract multiplier before committing the sample", async () => {
    db.delete(settings).run();
    expect((await commit()).status).toBe(400);
    expect(accountTrades()).toHaveLength(0);
    const response = await updateSettings(
      new Request("http://localhost/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ multipliers: { MNQZ6: 2 } }),
      }),
    );
    expect(response.status).toBe(200);
    expect((await commit()).status).toBe(200);
    expect(accountTrades().reduce((sum, t) => sum + t.netPnl, 0)).toBe(5265);
  });
});


// --- Lucid Trading Real Statement Reconciliation ---

describe("Lucid Trading — Real Statement Import & Reconciliation", () => {
  it("imports all 5 statement files and achieves exact penny parity with Lucid site", () => {
    const accountId = "acc_test_tradovate_1790278922593";

    // Ensure account exists
    let acc = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
    if (!acc) {
      db.insert(accounts)
        .values({
          id: accountId,
          name: "Lucid 50k Combine",
          broker: "lucid",
          platform: "tradovate",
          accountNumber: "LFE0506847043001",
          initialBalance: 50000,
          kind: "manual",
          createdAt: new Date().toISOString(),
        })
        .run();
    }

    // Configure multipliers in settings
    db.insert(settings)
      .values({
        key: "multipliers",
        value: JSON.stringify({ MES: 5, MNQ: 2, ES: 50, NQ: 20 }),
      })
      .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify({ MES: 5, MNQ: 2, ES: 50, NQ: 20 }) } })
      .run();

    // Clean previous test executions
    db.delete(executions).where(eq(executions.accountId, accountId)).run();
    db.delete(trades).where(eq(trades.accountId, accountId)).run();

    // Load all 5 statement files
    const files = ["Orders.csv", "Orders(1).csv", "Orders(2).csv", "Orders(3).csv", "Orders(4).csv"];
    const dir = join(process.cwd(), "packages/importers/tests/fixtures/tradovate-lucid");
    const allExecs = [];
    for (const f of files) {
      const c = readFileSync(join(dir, f), "utf8");
      const p = parseAuto(c, { timeZone: "America/Chicago" });
      if (p) allExecs.push(...p.executions);
    }

    // Deduplicate executions
    const seen = new Set();
    const uniqueExecs = [];
    for (const e of allExecs) {
      const sig = `${e.symbol}|${e.side}|${e.quantity}|${e.price}|${e.executedAt}`;
      if (!seen.has(sig)) {
        seen.add(sig);
        uniqueExecs.push(e);
      }
    }

    expect(uniqueExecs).toHaveLength(166);

    // The Tradovate parser automatically applies standard micro futures commissions ($0.50/side per contract)
    // 182 contract sides total * $0.50 = $91.00 total fees
    const result = insertExecutions(accountId, uniqueExecs, "import");
    expect(result.inserted).toBe(166);
    expect(result.duplicates).toBe(0);

    const accountTrades = db
      .select()
      .from(trades)
      .where(eq(trades.accountId, accountId))
      .all();

    expect(accountTrades).toHaveLength(83);

    const grossPnl = accountTrades.reduce((acc, t) => acc + t.grossPnl, 0);
    const totalFees = accountTrades.reduce((acc, t) => acc + t.fees, 0);
    const netPnl = accountTrades.reduce((acc, t) => acc + t.netPnl, 0);

    expect(grossPnl).toBe(-636.25);
    expect(totalFees).toBe(91.00);
    expect(netPnl).toBe(-727.25);

    // Exact parity with official Tradovate Statement ($49,272.75, rounded on Lucid UI to $49,273.00)
    const endingBalance = 50000.0 + netPnl;
    expect(endingBalance).toBe(49272.75);
    expect(Math.round(endingBalance)).toBe(49273);
  });
});


// --- Market Candle Timezone Inference & Auto-Calibration ---


const { marketCandles, marketCandleBatches, marketSeriesSummary } = await import("../../src/db");
const { ingestCandles } = await import("../../src/server/market-data/csv");
const {
  inferImportTimeZoneFromCandles,
  reparseOrShiftImportedExecutions,
  extractNaiveWallClock,
  normalizeSymbolForCandleLookup,
} = await import("../../src/server/import-timezone-inference");

describe("Market Candle Timezone Inference & Auto-Calibration", () => {
  // 2026-10-05 12:45:00 UTC (09:45:00 America/Sao_Paulo) = 1791204300 seconds
  // 2026-10-05 12:51:00 UTC (09:51:00 America/Sao_Paulo) = 1791204660 seconds
  // 2026-10-05 14:45:00 UTC (09:45:00 America/Chicago)   = 1791211500 seconds
  // 2026-10-05 14:51:00 UTC (09:51:00 America/Chicago)   = 1791211860 seconds
  const mesCandlesCsv = [
    "timestamp,open,high,low,close,volume",
    "1791204240,7768.50,7769.50,7768.00,7769.00,450", // 12:44:00Z
    "1791204300,7769.00,7770.00,7768.50,7769.25,520", // 12:45:00Z (09:45 BRT @ 7769.25)
    "1791204360,7769.25,7769.75,7768.25,7768.75,410", // 12:46:00Z
    "1791204600,7767.75,7768.25,7767.00,7767.50,390", // 12:50:00Z
    "1791204660,7767.50,7768.00,7766.75,7767.25,610", // 12:51:00Z (09:51:58 BRT @ 7767.25)
    "1791204720,7767.25,7767.75,7766.50,7767.00,480", // 12:52:00Z
    // Later at 14:45:00Z..14:52:00Z (09:45..09:52 America/Chicago), price is much higher (~7795)
    "1791211440,7794.00,7795.50,7793.50,7795.00,800", // 14:44:00Z
    "1791211500,7795.00,7796.50,7794.25,7796.00,950", // 14:45:00Z
    "1791211560,7796.00,7797.00,7795.00,7796.25,870", // 14:46:00Z
    "1791211800,7797.50,7798.50,7796.50,7798.00,720", // 14:50:00Z
    "1791211860,7798.00,7799.25,7797.25,7798.75,830", // 14:51:00Z
    "1791211920,7798.75,7800.00,7798.00,7799.50,790", // 14:52:00Z
  ].join("\n");

  beforeEach(() => {
    db.delete(executions).run();
    db.delete(accounts).run();
    db.delete(marketCandles).run();
    db.delete(marketCandleBatches).run();
    db.delete(marketSeriesSummary).run();
  });

  it("recovers exact naive wall-clock and normalizes futures/CFD symbols", () => {
    // 2026-10-05 09:51:58 in America/Chicago (UTC-5) is 2026-10-05T14:51:58.000Z
    const wall = extractNaiveWallClock("2026-10-05T14:51:58.000Z", "America/Chicago");
    expect(wall).toBe("2026-10-05 09:51:58");

    expect(normalizeSymbolForCandleLookup("MESZ6")).toContain("MES");
    expect(normalizeSymbolForCandleLookup("US500.CASH")).toContain("US500");
  });

  it("detects and auto-calibrates MES executions on 2026-10-05 from America/Chicago to America/Sao_Paulo", () => {
    ingestCandles({
      name: "MES_1m_2026-10-05.csv",
      symbol: "MES",
      resolution: "1m",
      currency: "USD",
      priceBasis: "raw",
      content: mesCandlesCsv,
    });

    const naiveStatement = [
      "Contract,B/S,Filled Qty,Avg Fill Price,Fill Time",
      "MESZ6,Buy,1,7769.25,2026-10-05 09:45:00",
      "MESZ6,Sell,1,7767.25,2026-10-05 09:51:58",
    ].join("\n");

    const parsedChicago = parseAuto(naiveStatement, { timeZone: "America/Chicago" });
    expect(parsedChicago).not.toBeNull();
    expect(parsedChicago!.executions[0]!.executedAt).toBe("2026-10-05T14:45:00.000Z");
    expect(parsedChicago!.executions[1]!.executedAt).toBe("2026-10-05T14:51:58.000Z");

    const inference = inferImportTimeZoneFromCandles({
      executions: parsedChicago!.executions,
      initialTimeZone: "America/Chicago",
      reparseExecutions: (tz) => parseAuto(naiveStatement, { timeZone: tz })?.executions,
      rawContent: naiveStatement,
    });

    expect(inference.autoCalibrated).toBe(true);
    expect(inference.timeZone).toBe("America/Sao_Paulo");
    expect(inference.originalTimeZone).toBe("America/Chicago");
    expect(inference.bestHitRate).toBe(1);
    expect(inference.initialHitRate).toBe(0);
    expect(inference.evaluatedCount).toBe(2);
    expect(inference.hitCount).toBe(2);

    const shifted = reparseOrShiftImportedExecutions(
      parsedChicago!.executions,
      "America/Chicago",
      inference.timeZone,
    );
    expect(shifted[0]!.executedAt).toBe("2026-10-05T12:45:00.000Z");
    expect(shifted[1]!.executedAt).toBe("2026-10-05T12:51:58.000Z");
  });

  it("does not alter timestamps that already carry an explicit Z or timezone offset", () => {
    ingestCandles({
      name: "MES_1m_2026-10-05.csv",
      symbol: "MES",
      resolution: "1m",
      currency: "USD",
      priceBasis: "raw",
      content: mesCandlesCsv,
    });

    // Explicit Z timestamps at 14:45:00Z and 14:51:58Z with prices from 12:45:00Z
    // Because they have explicit 'Z', they are absolute UTC instants and must NOT be shifted.
    const explicitZStatement = [
      "Contract,B/S,Filled Qty,Avg Fill Price,Fill Time",
      "MESZ6,Buy,1,7769.25,2026-10-05T14:45:00Z",
      "MESZ6,Sell,1,7767.25,2026-10-05T14:51:58Z",
    ].join("\n");

    const parsed = parseAuto(explicitZStatement, { timeZone: "America/Chicago" });
    expect(parsed).not.toBeNull();
    expect(parsed!.executions[0]!.executedAt).toBe("2026-10-05T14:45:00.000Z");

    const inference = inferImportTimeZoneFromCandles({
      executions: parsed!.executions,
      initialTimeZone: "America/Chicago",
      reparseExecutions: (tz) => parseAuto(explicitZStatement, { timeZone: tz })?.executions,
      rawContent: explicitZStatement,
    });

    expect(inference.autoCalibrated).toBe(false);
    expect(inference.timeZone).toBe("America/Chicago");
  });

  it("auto-calibrates via /api/import in preview and commit modes and honors lockTimeZone", async () => {
    ingestCandles({
      name: "MES_1m_2026-10-05.csv",
      symbol: "MES",
      resolution: "1m",
      currency: "USD",
      priceBasis: "raw",
      content: mesCandlesCsv,
    });

    db.insert(accounts)
      .values({
        id: "acc_mes_test",
        name: "MES Test Account",
        broker: "tradovate",
        timeZone: "America/Chicago",
        kind: "import",
        currency: "USD",
        initialBalance: 50000,
        profitCalcMethod: "fifo",
        createdAt: new Date().toISOString(),
      })
      .run();

    const naiveStatement = [
      "Contract,B/S,Filled Qty,Avg Fill Price,Fill Time",
      "MESZ6,Buy,1,7769.25,2026-10-05 09:45:00",
      "MESZ6,Sell,1,7767.25,2026-10-05 09:51:58",
    ].join("\n");

    // 1. Preview with initialTimeZone = America/Chicago -> auto-calibrates to America/Sao_Paulo
    const previewRes = await (
      await importRoute(
        makeImportRequest({
          mode: "preview",
          content: naiveStatement,
          accountId: "acc_mes_test",
          fileName: "MES_trades.csv",
          timeZone: "America/Chicago",
        }),
      )
    ).json();

    expect(previewRes.timeZone).toBe("America/Sao_Paulo");
    expect(previewRes.executions[0].executedAt).toBe("2026-10-05T12:45:00.000Z");
    expect(previewRes.executions[1].executedAt).toBe("2026-10-05T12:51:58.000Z");
    expect(previewRes.warnings).toContain(
      "Auto-calibrated statement timezone to America/Sao_Paulo based on market candle price alignment (100% match vs 0% in America/Chicago).",
    );

    // 2. Preview with lockTimeZone = true -> keeps America/Chicago
    const lockedPreviewRes = await (
      await importRoute(
        makeImportRequest({
          mode: "preview",
          content: naiveStatement,
          accountId: "acc_mes_test",
          fileName: "MES_trades.csv",
          timeZone: "America/Chicago",
          lockTimeZone: true,
        }),
      )
    ).json();

    expect(lockedPreviewRes.timeZone).toBe("America/Chicago");
    expect(lockedPreviewRes.executions[0].executedAt).toBe("2026-10-05T14:45:00.000Z");

    // 3. Commit with uncalibrated timeZone -> auto-calibrates and persists 12:45:00Z & 12:51:58Z
    const commitRes = await (
      await importRoute(
        makeImportRequest({
          mode: "commit",
          content: naiveStatement,
          accountId: "acc_mes_test",
          fileName: "MES_trades.csv",
          timeZone: "America/Chicago",
          forceMismatch: true,
        }),
      )
    ).json();

    expect(commitRes.inserted).toBe(2);
    expect(commitRes.warnings).toContain(
      "Auto-calibrated statement timezone to America/Sao_Paulo based on market candle price alignment (100% match vs 0% in America/Chicago).",
    );

    const savedExecs = db
      .select()
      .from(executions)
      .where(eq(executions.accountId, "acc_mes_test"))
      .all()
      .sort((a, b) => a.executedAt.localeCompare(b.executedAt));

    expect(savedExecs).toHaveLength(2);
    expect(savedExecs[0]!.executedAt).toBe("2026-10-05T12:45:00.000Z");
    expect(savedExecs[1]!.executedAt).toBe("2026-10-05T12:51:58.000Z");
  });

  it("auto-calibrates multi-file batch imports and normalizes .CASH CFD symbols", async () => {
    ingestCandles({
      name: "US500_1m_2026-10-05.csv",
      symbol: "US500",
      resolution: "1m",
      currency: "USD",
      priceBasis: "raw",
      content: mesCandlesCsv,
    });

    const file1 = [
      "Contract,B/S,Filled Qty,Avg Fill Price,Fill Time",
      "US500.CASH,Buy,1,7769.25,2026-10-05 09:45:00",
    ].join("\n");
    const file2 = [
      "Contract,B/S,Filled Qty,Avg Fill Price,Fill Time",
      "US500.CASH,Sell,1,7767.25,2026-10-05 09:51:58",
    ].join("\n");

    const previewRes = await (
      await importRoute(
        makeImportRequest({
          mode: "preview",
          files: [
            { name: "part1.csv", content: file1 },
            { name: "part2.csv", content: file2 },
          ],
          timeZone: "America/Chicago",
        }),
      )
    ).json();

    expect(previewRes.timeZone).toBe("America/Sao_Paulo");
    expect(previewRes.executions).toHaveLength(2);
    expect(previewRes.executions[0].executedAt).toBe("2026-10-05T12:45:00.000Z");
    expect(previewRes.executions[1].executedAt).toBe("2026-10-05T12:51:58.000Z");
    expect(previewRes.warnings).toContain(
      "Auto-calibrated statement timezone to America/Sao_Paulo based on market candle price alignment (100% match vs 0% in America/Chicago).",
    );
  });

  it("preserves initialTimeZone when it already aligns with market candles", () => {
    ingestCandles({
      name: "MES_1m_2026-10-05.csv",
      symbol: "MES",
      resolution: "1m",
      currency: "USD",
      priceBasis: "raw",
      content: mesCandlesCsv,
    });

    const naiveStatement = [
      "Contract,B/S,Filled Qty,Avg Fill Price,Fill Time",
      "MESZ6,Buy,1,7769.25,2026-10-05 09:45:00",
      "MESZ6,Sell,1,7767.25,2026-10-05 09:51:58",
    ].join("\n");

    const parsedBrt = parseAuto(naiveStatement, { timeZone: "America/Sao_Paulo" });
    const inference = inferImportTimeZoneFromCandles({
      executions: parsedBrt!.executions,
      initialTimeZone: "America/Sao_Paulo",
      reparseExecutions: (tz) => parseAuto(naiveStatement, { timeZone: tz })?.executions,
      rawContent: naiveStatement,
    });

    expect(inference.autoCalibrated).toBe(false);
    expect(inference.timeZone).toBe("America/Sao_Paulo");
    expect(inference.initialHitRate).toBe(1);
  });

  it("preserves explicit offsets across multi-file out-of-order batches and MM/DD/YYYY formats", async () => {
    ingestCandles({
      name: "MES_1m_2026-10-05.csv",
      symbol: "MES",
      resolution: "1m",
      currency: "USD",
      priceBasis: "raw",
      content: mesCandlesCsv,
    });

    // File 1 has a LATER timestamp than File 2, both carrying explicit Z offsets
    const fileLater = [
      "Contract,B/S,Filled Qty,Avg Fill Price,Fill Time",
      "MESZ6,Sell,1,7767.25,2026-10-05T14:51:58Z",
    ].join("\n");
    const fileEarlier = [
      "Contract,B/S,Filled Qty,Avg Fill Price,Fill Time",
      "MESZ6,Buy,1,7769.25,2026-10-05T14:45:00Z",
    ].join("\n");

    const previewRes = await (
      await importRoute(
        makeImportRequest({
          mode: "preview",
          files: [
            { name: "later.csv", content: fileLater },
            { name: "earlier.csv", content: fileEarlier },
          ],
          timeZone: "America/Chicago",
        }),
      )
    ).json();

    expect(previewRes.timeZone).toBe("America/Chicago");
    expect(previewRes.executions[0].executedAt).toBe("2026-10-05T14:45:00.000Z");
    expect(previewRes.executions[1].executedAt).toBe("2026-10-05T14:51:58.000Z");

    // Also verify MM/DD/YYYY with GMT-0300 explicit offset in rawContent fallback
    const slashExplicit = inferImportTimeZoneFromCandles({
      executions: previewRes.executions,
      initialTimeZone: "America/Chicago",
      rawContent: "MESZ6,Buy,1,7769.25,10/05/2026 09:45:00 GMT-0300",
    });
    expect(slashExplicit.autoCalibrated).toBe(false);
  });
});


// --- Pure Dedup Unit Tests ---

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


afterAll(() => {
  try {
    (db as any)?.$client?.close?.();
  } catch {}
  if (previousDir === undefined) delete process.env.JOURNAL_DATA_DIR;
  else process.env.JOURNAL_DATA_DIR = previousDir;
  try {
    rmSync(scratch, { recursive: true, force: true });
  } catch {}
});
