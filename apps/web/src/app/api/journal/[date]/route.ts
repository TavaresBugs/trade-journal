import { readFilters } from "@luxalgo/journal-core";
import { eq, inArray } from "drizzle-orm";
import { computeMetrics, dayKeyOf, intradayCurve } from "@luxalgo/journal-core";
import { db, executions, journalDays } from "@/db";
import { bad, handler, ok } from "@/server/api";
import { nowIso } from "@/server/ids";
import { getTimeZone } from "@/server/settings";
import { queryTrades } from "@/server/trades-query";

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
    const fills = db
      .select({ id: executions.id, executedAt: executions.executedAt })
      .from(executions)
      .where(inArray(executions.id, neededExecIds))
      .all();
    for (const fill of fills) times.set(fill.id, fill.executedAt);
  }

  const dayRecord = db.select().from(journalDays).where(eq(journalDays.date, date)).get();
  return ok({
    date,
    metrics: computeMetrics(dayTrades, { timeZone }),
    trades: dayTradeIndexes.map(({ index }) => rows[index]),
    intraday: intradayCurve(dayTrades, times, date, timeZone),
    note: dayRecord?.note ?? "",
    rating: dayRecord?.rating ?? null,
    reviewedAt: dayRecord?.reviewedAt ?? null,
    tagsJson: dayRecord?.tagsJson ?? null,
    mistakesJson: dayRecord?.mistakesJson ?? null,
  });
});

const saveJournalDay = async (request: Request, date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad("date must be YYYY-MM-DD");
  const body = (await request.json()) as {
    note?: string;
    notes?: string;
    rating?: number | null;
    reviewed?: boolean;
    reviewedAt?: string | null;
    tags?: string[] | string;
    mistakes?: string[] | string;
  };

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
  if (body.rating !== undefined) patch.rating = body.rating;
  if (body.reviewed !== undefined) patch.reviewedAt = body.reviewed ? nowIso() : null;
  else if (body.reviewedAt !== undefined) patch.reviewedAt = body.reviewedAt;
  if (body.tags !== undefined) patch.tagsJson = parseArrayField(body.tags);
  if (body.mistakes !== undefined) patch.mistakesJson = parseArrayField(body.mistakes);

  db.insert(journalDays)
    .values({
      date,
      note: noteContent ?? existing?.note ?? "",
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
