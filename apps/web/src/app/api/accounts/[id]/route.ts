import { eq } from "drizzle-orm";
import { accounts, db, executions, trades } from "@/db";
import { bad, handler, ok } from "@/server/api";
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
  db.transaction((tx) => {
    tx.delete(trades).where(eq(trades.accountId, id)).run();
    tx.delete(executions).where(eq(executions.accountId, id)).run();
    tx.delete(accounts).where(eq(accounts.id, id)).run();
  });
  return ok({ deleted: true });
});
