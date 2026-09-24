import { asc, eq, sql } from "drizzle-orm";
import { accounts, db, trades } from "@/db";
import { bad, handler, ok } from "@/server/api";
import { encryptJson } from "@/server/crypto";
import { newId, nowIso } from "@/server/ids";
import { syncAccount } from "@/server/sync";
import { getBrokerTimeZone } from "@/lib/brokers/broker-catalog";

export const GET = handler((request: Request) => {
  if (new URL(request.url).searchParams.get("summary") === "1") {
    return ok({
      accounts: db
        .select({
          id: accounts.id,
          name: accounts.name,
          broker: accounts.broker,
          platform: accounts.platform,
          accountNumber: accounts.accountNumber,
          maxDrawdown: accounts.maxDrawdown,
          timeZone: accounts.timeZone,
          archivedAt: accounts.archivedAt,
        })
        .from(accounts)
        .orderBy(asc(accounts.createdAt))
        .all(),
    });
  }
  const rows = db.select().from(accounts).orderBy(asc(accounts.createdAt)).all();

  const tradeAggregates = db
    .select({
      accountId: trades.accountId,
      tradeCount: sql<number>`count(*)`.as("trade_count"),
      netPnl: sql<number>`coalesce(sum(${trades.netPnl}), 0)`.as("net_pnl"),
      winCount:
        sql<number>`coalesce(sum(case when ${trades.status} = 'win' then 1 else 0 end), 0)`.as(
          "win_count",
        ),
      lossCount:
        sql<number>`coalesce(sum(case when ${trades.status} = 'loss' then 1 else 0 end), 0)`.as(
          "loss_count",
        ),
    })
    .from(trades)
    .groupBy(trades.accountId)
    .all();

  const statsMap = new Map(tradeAggregates.map((t) => [t.accountId, t]));

  return ok({
    accounts: rows.map(({ credentialsEnc, ...safe }) => {
      const stats = statsMap.get(safe.id);
      const tradeCount = Number(stats?.tradeCount ?? 0);
      const netPnl = Number(stats?.netPnl ?? 0);
      const winCount = Number(stats?.winCount ?? 0);
      const lossCount = Number(stats?.lossCount ?? 0);
      const finishedCount = winCount + lossCount;
      const winRate = finishedCount > 0 ? (winCount / finishedCount) * 100 : 0;
      const initialBalance = Number(safe.initialBalance ?? 0);
      const currentBalance = initialBalance + netPnl;
      const returnPct = initialBalance > 0 ? (netPnl / initialBalance) * 100 : 0;

      return {
        ...safe,
        connected: credentialsEnc !== null,
        snapshot: safe.snapshotJson ? JSON.parse(safe.snapshotJson) : null,
        tradeCount,
        winCount,
        lossCount,
        winRate,
        netPnl,
        currentBalance,
        returnPct,
      };
    }),
  });
});

interface CreateBody {
  name?: string;
  kind?: "sync" | "import" | "manual";
  broker?: string;
  platform?: string;
  accountNumber?: string;
  maxDrawdown?: number;
  timeZone?: string;
  currency?: string;
  initialBalance?: number;
  profitCalcMethod?: "fifo" | "lifo" | "wavg";
  credentials?: Record<string, string>;
  autoSync?: boolean;
}

export const POST = handler(async (request: Request) => {
  const body = (await request.json()) as CreateBody;
  if (!body.name || !body.kind) return bad("name and kind are required");
  if (body.kind === "sync" && (!body.broker || !body.credentials)) {
    return bad("sync accounts need a broker and credentials");
  }

  const id = newId();
  const brokerTz = body.broker ? getBrokerTimeZone(body.broker) : undefined;
  const timeZone = body.timeZone || brokerTz || "UTC";

  db.insert(accounts)
    .values({
      id,
      name: body.name,
      broker: body.broker ?? "",
      platform: body.platform ?? null,
      accountNumber: body.accountNumber?.trim() ? body.accountNumber.trim() : null,
      maxDrawdown:
        typeof body.maxDrawdown === "number" && !Number.isNaN(body.maxDrawdown)
          ? body.maxDrawdown
          : null,
      timeZone,
      kind: body.kind,
      currency: body.currency ?? "USD",
      initialBalance: body.initialBalance ?? 0,
      profitCalcMethod: body.profitCalcMethod ?? "fifo",
      credentialsEnc: body.kind === "sync" ? encryptJson(body.credentials) : null,
      autoSync: body.autoSync ?? body.kind === "sync",
      createdAt: nowIso(),
    })
    .run();

  // First sync happens right away so the account isn't born empty.
  let sync = null;
  if (body.kind === "sync") {
    try {
      sync = await syncAccount(id);
    } catch (error) {
      // Bad credentials shouldn't strand a half-created account.
      db.delete(accounts).where(eq(accounts.id, id)).run();
      return bad(error instanceof Error ? error.message : "Broker connection failed", 502);
    }
  }
  return ok({ id, sync });
});
