import { asc, eq, sql } from "drizzle-orm";
import { accounts, db, trades } from "@/db";
import { bad, handler, ok } from "@/server/api";
import { encryptJson } from "@/server/crypto";
import { newId, nowIso } from "@/server/ids";
import { syncAccount } from "@/server/sync";
import { getBrokerTimeZone } from "@/lib/brokers/broker-catalog";
import { validateCreateAccount } from "@/server/validation/accounts-schema";

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
      tradeCount:
        sql<number>`coalesce(sum(case when ${trades.status} != 'open' then 1 else 0 end), 0)`.as(
          "trade_count",
        ),
      netPnl:
        sql<number>`coalesce(sum(case when ${trades.status} != 'open' then ${trades.netPnl} else 0 end), 0)`.as(
          "net_pnl",
        ),
      winCount:
        sql<number>`coalesce(sum(case when ${trades.status} = 'win' then 1 else 0 end), 0)`.as(
          "win_count",
        ),
      lossCount:
        sql<number>`coalesce(sum(case when ${trades.status} = 'loss' then 1 else 0 end), 0)`.as(
          "loss_count",
        ),
      breakevenCount:
        sql<number>`coalesce(sum(case when ${trades.status} = 'breakeven' then 1 else 0 end), 0)`.as(
          "breakeven_count",
        ),
    })
    .from(trades)
    .groupBy(trades.accountId)
    .all();

  const statsMap = new Map(tradeAggregates.map((t) => [t.accountId, t]));

  return ok({
    accounts: rows.map(({ credentialsEnc, ...safe }) => {
      const stats = statsMap.get(safe.id);
      const winCount = Number(stats?.winCount ?? 0);
      const lossCount = Number(stats?.lossCount ?? 0);
      const breakevenCount = Number(stats?.breakevenCount ?? 0);
      const closedTrades = winCount + lossCount + breakevenCount;
      const tradeCount = closedTrades;
      const winRate = closedTrades > 0 ? (winCount / closedTrades) * 100 : 0;
      const netPnl = Number(stats?.netPnl ?? 0);
      const initialBalance = Number(safe.initialBalance ?? 0);
      const currentBalance = initialBalance + netPnl;
      const returnPct = initialBalance > 0 ? (netPnl / initialBalance) * 100 : 0;

      return {
        ...safe,
        connected: credentialsEnc !== null,
        snapshot: safe.snapshotJson ? JSON.parse(safe.snapshotJson) : null,
        tradeCount,
        closedTrades,
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

export const POST = handler(async (request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("name and kind are required");
  }

  const validation = validateCreateAccount(body);
  if (!validation.ok) return bad(validation.error);
  const data = validation.data;

  const id = newId();
  const brokerTz = data.broker ? getBrokerTimeZone(data.broker) : undefined;
  const timeZone = data.timeZone || brokerTz || "UTC";

  db.insert(accounts)
    .values({
      id,
      name: data.name,
      broker: data.broker,
      platform: data.platform,
      accountNumber: data.accountNumber,
      maxDrawdown: data.maxDrawdown,
      timeZone,
      kind: data.kind,
      currency: data.currency,
      initialBalance: data.initialBalance,
      profitCalcMethod: data.profitCalcMethod,
      credentialsEnc:
        data.kind === "sync" && data.credentials ? encryptJson(data.credentials) : null,
      autoSync: data.autoSync,
      createdAt: nowIso(),
    })
    .run();

  // First sync happens right away so the account isn't born empty.
  let sync = null;
  if (data.kind === "sync") {
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
