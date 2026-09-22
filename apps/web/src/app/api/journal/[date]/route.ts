import { readFilters } from "@luxalgo/journal-core";
import { and, eq, inArray, sql } from "drizzle-orm";
import { computeMetrics, dayKeyOf, intradayCurve } from "@luxalgo/journal-core";
import { attachments, db, executions, journalDays, trades as tradesTable } from "@/db";
import { bad, handler, ok } from "@/server/api";
import { nowIso } from "@/server/ids";
import { getTimeZone } from "@/server/settings";
import { queryTrades } from "@/server/trades-query";
import { normalizeSymbol } from "@/lib/assets/symbol-utils";

type Params = { params: Promise<{ date: string }> };

export const GET = handler(async (request: Request, { params }: Params) => {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad("date must be YYYY-MM-DD");
  const url = new URL(request.url);
  const timeZone = getTimeZone();

  const { rows, trades } = queryTrades(readFilters(url.searchParams));
  const dayTradeIndexes = trades
    .map((trade, index) => ({ trade, index }))
    .filter(({ trade }) => trade.closedAt && dayKeyOf(trade.closedAt, timeZone) === date);
  const dayTrades = dayTradeIndexes.map(({ trade }) => trade);

  // Intraday curve needs exit timestamps — only fetch executions for the day's trades.
  const times = new Map<string, string>();
  const neededExecIds = Array.from(new Set(dayTrades.flatMap((trade) => trade.executionIds ?? [])));
  if (neededExecIds.length > 0) {
    for (let i = 0; i < neededExecIds.length; i += 500) {
      const chunk = neededExecIds.slice(i, i + 500);
      const fills = db
        .select({ id: executions.id, executedAt: executions.executedAt })
        .from(executions)
        .where(inArray(executions.id, chunk))
        .all();
      for (const fill of fills) times.set(fill.id, fill.executedAt);
    }
  }

  const dayRecord = db.select().from(journalDays).where(eq(journalDays.date, date)).get();
  const dayAttachmentsCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(attachments)
      .where(and(eq(attachments.ownerType, "day"), eq(attachments.ownerId, date)))
      .get()?.count ?? 0;

  const hasDayJournal = Boolean(
    dayRecord?.note?.trim() ||
    dayRecord?.symbol ||
    dayRecord?.rating != null ||
    dayAttachmentsCount > 0,
  );

  const allTradedSymbols = Array.from(
    new Set(
      db
        .selectDistinct({ symbol: tradesTable.symbol })
        .from(tradesTable)
        .all()
        .map((r) => normalizeSymbol(r.symbol))
        .filter(Boolean),
    ),
  );

  return ok({
    date,
    metrics: computeMetrics(dayTrades, { timeZone }),
    trades: dayTradeIndexes.map(({ index }) => rows[index]),
    intraday: intradayCurve(dayTrades, times, date, timeZone),
    note: dayRecord?.note ?? "",
    symbol: dayRecord?.symbol ?? null,
    allTradedSymbols,
    rating: dayRecord?.rating ?? null,
    reviewedAt: dayRecord?.reviewedAt ?? null,
    tagsJson: dayRecord?.tagsJson ?? null,
    mistakesJson: dayRecord?.mistakesJson ?? null,
    attachmentsCount: dayAttachmentsCount,
    hasDayJournal,
  });
});

const saveJournalDay = async (request: Request, date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad("date must be YYYY-MM-DD");

  let body: {
    note?: string;
    notes?: string;
    symbol?: string | null;
    rating?: number | null;
    reviewed?: boolean;
    reviewedAt?: string | null;
    tags?: string[] | string;
    mistakes?: string[] | string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return bad("Invalid JSON request body");
  }

  if (body.rating !== undefined) {
    if (
      body.rating !== null &&
      (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5)
    ) {
      return bad("Rating must be 1–5.");
    }
  }

  const parseArrayField = (val: unknown): string | undefined => {
    if (val === undefined) return undefined;
    if (Array.isArray(val)) {
      return JSON.stringify(
        val
          .map(String)
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
    if (typeof val === "string") {
      return JSON.stringify(
        val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
    return JSON.stringify([]);
  };

  const noteContent = body.note !== undefined ? body.note : body.notes;
  const existing = db.select().from(journalDays).where(eq(journalDays.date, date)).get();

  const patch: Partial<typeof journalDays.$inferInsert> = {
    updatedAt: nowIso(),
  };

  if (noteContent !== undefined) patch.note = noteContent;
  if (body.symbol !== undefined) patch.symbol = body.symbol ? normalizeSymbol(body.symbol) : null;
  if (body.rating !== undefined) patch.rating = body.rating;
  if (body.reviewed !== undefined) patch.reviewedAt = body.reviewed ? nowIso() : null;
  else if (body.reviewedAt !== undefined) patch.reviewedAt = body.reviewedAt;
  if (body.tags !== undefined) patch.tagsJson = parseArrayField(body.tags);
  if (body.mistakes !== undefined) patch.mistakesJson = parseArrayField(body.mistakes);

  db.insert(journalDays)
    .values({
      date,
      note: noteContent ?? existing?.note ?? "",
      symbol: patch.symbol !== undefined ? patch.symbol : (existing?.symbol ?? null),
      rating: patch.rating !== undefined ? patch.rating : (existing?.rating ?? null),
      reviewedAt:
        patch.reviewedAt !== undefined ? patch.reviewedAt : (existing?.reviewedAt ?? null),
      tagsJson: patch.tagsJson !== undefined ? patch.tagsJson : (existing?.tagsJson ?? null),
      mistakesJson:
        patch.mistakesJson !== undefined ? patch.mistakesJson : (existing?.mistakesJson ?? null),
      updatedAt: nowIso(),
    })
    .onConflictDoUpdate({
      target: journalDays.date,
      set: patch,
    })
    .run();

  return ok({ saved: true });
};

export const PUT = handler(async (request: Request, { params }: Params) => {
  const { date } = await params;
  return saveJournalDay(request, date);
});

export const PATCH = handler(async (request: Request, { params }: Params) => {
  const { date } = await params;
  return saveJournalDay(request, date);
});
