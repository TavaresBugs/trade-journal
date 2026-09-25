import { eq } from "drizzle-orm";
import { accounts, db, executions, trades } from "@/db";
import { bad, handler, ok } from "@/server/api";
import { rebuildAccount } from "@/server/rebuild";
import { isTimeZone } from "@/lib/timezone";

type Params = { params: Promise<{ id: string }> };

interface PatchBody {
  name?: string;
  broker?: string;
  platform?: string | null;
  accountNumber?: string | null;
  maxDrawdown?: number | null;
  timeZone?: string;
  currency?: string;
  initialBalance?: number;
  profitCalcMethod?: "fifo" | "lifo" | "wavg";
  autoSync?: boolean;
}

export const PATCH = handler(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const account = db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!account) return bad("Account not found", 404);

  const body = (await request.json()) as PatchBody;
  if (body.timeZone !== undefined && !isTimeZone(body.timeZone)) {
    return bad("Invalid IANA timezone.");
  }
  if (
    body.profitCalcMethod !== undefined &&
    !["fifo", "lifo", "wavg"].includes(body.profitCalcMethod)
  ) {
    return bad("Invalid profit calculation method.");
  }

  const patch: Partial<typeof accounts.$inferInsert> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.broker !== undefined) patch.broker = body.broker;
  if (body.platform !== undefined) patch.platform = body.platform;
  if (body.accountNumber !== undefined)
    patch.accountNumber = body.accountNumber?.trim() ? body.accountNumber.trim() : null;
  if (body.maxDrawdown !== undefined)
    patch.maxDrawdown =
      typeof body.maxDrawdown === "number" && !Number.isNaN(body.maxDrawdown)
        ? body.maxDrawdown
        : null;
  if (body.timeZone !== undefined) patch.timeZone = body.timeZone;
  if (body.currency !== undefined) patch.currency = body.currency;
  if (body.initialBalance !== undefined) patch.initialBalance = body.initialBalance;
  if (body.autoSync !== undefined) patch.autoSync = body.autoSync;
  if (body.profitCalcMethod !== undefined) patch.profitCalcMethod = body.profitCalcMethod;

  if (Object.keys(patch).length > 0) {
    db.update(accounts).set(patch).where(eq(accounts.id, id)).run();
  }
  // A new profit-calc method changes per-exit attribution — recompute.
  if (body.profitCalcMethod && body.profitCalcMethod !== account.profitCalcMethod) {
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
