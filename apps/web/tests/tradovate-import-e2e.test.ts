import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

const originalDir = process.env.JOURNAL_DATA_DIR;
const scratch = mkdtempSync(join(tmpdir(), "journal-tradovate-test-"));
process.env.JOURNAL_DATA_DIR = scratch;

const { db, accounts, executions, trades } = await import("@/db");
const { POST } = await import("@/app/api/import/route");

afterAll(() => {
  db.$client.close();
  if (originalDir === undefined) delete process.env.JOURNAL_DATA_DIR;
  else process.env.JOURNAL_DATA_DIR = originalDir;
  rmSync(scratch, { recursive: true, force: true });
});

describe("Tradovate End-to-End Import & Idempotency", () => {
  const csvPath = resolve(
    "/home/jhontavares/.gemini/antigravity/brain/5e6dccf2-6295-4471-ae0f-9fff493c7d25/.user_uploaded/media_1790274711905.csv",
  );
  const csvContent = readFileSync(csvPath, "utf-8");

  it("previews the real Tradovate statement and detects the statement account number", async () => {
    const previewReq = new NextRequest("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "preview",
        content: csvContent,
        fileName: "tradovate_export.csv",
        timeZone: "America/Chicago",
      }),
    });

    const previewRes = await POST(previewReq);
    expect(previewRes.status).toBe(200);
    const data = await previewRes.json();

    expect(data.detected).toBe("tradovate");
    expect(data.detectedAccount).toBe("LFE0506847043001");
    expect(data.sourceAccounts).toContain("LFE0506847043001");
    // 14 paired trades in the CSV produce 28 executions (14 entry fills + 14 exit fills)
    expect(data.totals?.executions).toBe(28);
  });

  it("commits trades into account, auto-binds accountNumber and platform, and guarantees 100% idempotency", async () => {
    const testAccountId = `acc_test_tradovate_${Date.now()}`;

    // 1. Create a Lucid Trading account without account number or platform set initially
    await db.insert(accounts).values({
      id: testAccountId,
      name: "Lucid 50k Combine",
      broker: "lucid",
      kind: "manual",
      currency: "USD",
      initialBalance: 50000,
      createdAt: new Date().toISOString(),
    });

    // 2. Commit import to this account
    const commitReq = new NextRequest("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "commit",
        content: csvContent,
        accountId: testAccountId,
        fileName: "tradovate_export.csv",
        timeZone: "America/Chicago",
      }),
    });

    const commitRes = await POST(commitReq);
    expect(commitRes.status).toBe(200);
    const commitData = await commitRes.json();

    expect(commitData.inserted).toBe(28);
    expect(commitData.duplicates).toBe(0);

    // 3. Verify account row has been updated with accountNumber and platform
    const updatedAccount = await db.query.accounts.findFirst({
      where: eq(accounts.id, testAccountId),
    });
    expect(updatedAccount?.accountNumber).toBe("LFE0506847043001");
    expect(updatedAccount?.platform).toBe("tradovate");

    // 4. Repeat commit with identical statement — must skip all 28 as duplicates (0 inserted)
    const repeatReq = new NextRequest("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "commit",
        content: csvContent,
        accountId: testAccountId,
        fileName: "tradovate_export.csv",
        timeZone: "America/Chicago",
      }),
    });

    const repeatRes = await POST(repeatReq);
    expect(repeatRes.status).toBe(200);
    const repeatData = await repeatRes.json();

    expect(repeatData.inserted).toBe(0);
    expect(repeatData.duplicates).toBe(28);

    // 5. Clean up test records
    await db.delete(trades).where(eq(trades.accountId, testAccountId));
    await db.delete(executions).where(eq(executions.accountId, testAccountId));
    await db.delete(accounts).where(eq(accounts.id, testAccountId));
  });
});
