import { and, eq, inArray } from "drizzle-orm";
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

  // Safely clean credentials from .env and memory with twin account collision protection
  const credentialsCleanup = deleteAccountCredentials(id);

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
        tx.delete(tradeRuleChecks)
          .where(inArray(tradeRuleChecks.tradeKey, chunk))
          .run();
        tx.update(notes)
          .set({ tradeKey: null })
          .where(inArray(notes.tradeKey, chunk))
          .run();
      }
    }
    tx.delete(trades).where(eq(trades.accountId, id)).run();
    tx.delete(executions).where(eq(executions.accountId, id)).run();
    tx.delete(accounts).where(eq(accounts.id, id)).run();
  });
  return ok({ deleted: true, credentialsCleanup });
});
