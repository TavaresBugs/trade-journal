import { and, eq, inArray, sql } from "drizzle-orm";
import { accounts, attachments, db, executions, notes, tradeRuleChecks, trades } from "@/db";
import { bad, handler, ok } from "@/server/api";
import { deleteAccountCredentials } from "@/server/account-credentials";
import { rebuildAccount } from "@/server/rebuild";
import { validatePatchAccount } from "@/server/validation/accounts-schema";

type Params = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const account = db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!account) return bad("Account not found", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Invalid request body");
  }

  const validation = validatePatchAccount(body);
  if (!validation.ok) return bad(validation.error);
  const patch = validation.data;

  if (Object.keys(patch).length > 0) {
    db.update(accounts).set(patch).where(eq(accounts.id, id)).run();
  }
  // A new profit-calc method changes per-exit attribution — recompute.
  if (patch.profitCalcMethod && patch.profitCalcMethod !== account.profitCalcMethod) {
    rebuildAccount(id);
  }
  return ok({ updated: true });
});

export const DELETE = handler(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const account = db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!account) return bad("Account not found", 404);

  const tradeRows = db
    .select({ key: trades.key })
    .from(trades)
    .where(eq(trades.accountId, id))
    .all();
  const tradeKeys = tradeRows.map((r) => r.key);

  db.transaction((tx) => {
    if (tradeKeys.length > 0) {
      for (let i = 0; i < tradeKeys.length; i += 500) {
        const chunk = tradeKeys.slice(i, i + 500);
        tx.delete(attachments)
          .where(and(eq(attachments.ownerType, "trade"), inArray(attachments.ownerId, chunk)))
          .run();
        tx.delete(tradeRuleChecks).where(inArray(tradeRuleChecks.tradeKey, chunk)).run();
        tx.update(notes).set({ tradeKey: null }).where(inArray(notes.tradeKey, chunk)).run();
      }
    }
    // Also clean up any preserved trade attachments or rule checks matching account prefix.
    // Use exact substr prefix matching to prevent SQL LIKE '_' single-character wildcard injection on base64url IDs containing '_'.
    const prefix = `${id}|`;
    const prefixLen = prefix.length;
    tx.delete(attachments)
      .where(
        and(
          eq(attachments.ownerType, "trade"),
          sql`substr(${attachments.ownerId}, 1, ${prefixLen}) = ${prefix}`,
        ),
      )
      .run();
    tx.delete(tradeRuleChecks)
      .where(sql`substr(${tradeRuleChecks.tradeKey}, 1, ${prefixLen}) = ${prefix}`)
      .run();
    tx.update(notes)
      .set({ tradeKey: null })
      .where(sql`substr(${notes.tradeKey}, 1, ${prefixLen}) = ${prefix}`)
      .run();
    tx.delete(trades).where(eq(trades.accountId, id)).run();
    tx.delete(executions).where(eq(executions.accountId, id)).run();
    tx.delete(accounts).where(eq(accounts.id, id)).run();
  });

  // Safely clean credentials from .env and memory only after db transaction commits
  const credentialsCleanup = deleteAccountCredentials(id);

  return ok({ deleted: true, credentialsCleanup });
});
