import { dailyStats, dayKeyOf, readFilters } from "@luxalgo/journal-core";
import { desc } from "drizzle-orm";
import { db, journalDays } from "@/db";
import { handler, ok } from "@/server/api";
import { getTimeZone } from "@/server/settings";
import { queryTrades } from "@/server/trades-query";

/**
 * The journal chronology: every day that has trades OR a note, newest first.
 * Days with notes but no trades exist (planning days, review days).
 */
export const GET = handler(async (request: Request) => {
  const url = new URL(request.url);
  const timeZone = getTimeZone();
  const { trades } = queryTrades(readFilters(url.searchParams));

  const tradeDays = new Map(dailyStats(trades, timeZone).map((day) => [day.date, day]));
  const noteRows = db.select().from(journalDays).orderBy(desc(journalDays.date)).all();
  const noteDays = new Map(noteRows.map((row) => [row.date, row]));

  // Index unique symbols traded on each calendar day
  const daySymbolsMap = new Map<string, string[]>();
  for (const trade of trades) {
    if (trade.status !== "open" && trade.closedAt) {
      const date = dayKeyOf(trade.closedAt, timeZone);
      let list = daySymbolsMap.get(date);
      if (!list) {
        list = [];
        daySymbolsMap.set(date, list);
      }
      if (trade.symbol && trade.symbol.trim() && !list.includes(trade.symbol.trim())) {
        list.push(trade.symbol.trim());
      }
    }
  }

  const filters = readFilters(url.searchParams);
  const allDates = [...new Set([...tradeDays.keys(), ...noteDays.keys()])]
    .filter(
      (date) => (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to),
    )
    .sort()
    .reverse();
  return ok({
    days: allDates.map((date) => ({
      date,
      stats: tradeDays.get(date) ?? null,
      symbols: daySymbolsMap.get(date) ?? [],
      hasNote: (noteDays.get(date)?.note ?? "") !== "",
      notePreview: (noteDays.get(date)?.note ?? "").slice(0, 200),
    })),
  });
});
