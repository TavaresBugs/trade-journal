import { calendarMonthFromDays, dailyStats, dayKeyOf, readFilters } from "@luxalgo/journal-core";
import { accounts, db } from "@/db";
import { handler, ok, requireValue } from "@/server/api";
import { getTimeZone } from "@/server/settings";
import { queryTrades } from "@/server/trades-query";
import { getJournaledDatesForMonth } from "@/server/journal";
import { calendarInsights, calendarScope } from "@/lib/calendar-insights";

/** Only compute the visible month, not every dashboard/report breakdown. */
export const GET = handler(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const timeZone = getTimeZone();
  const today = dayKeyOf(new Date().toISOString(), timeZone);
  const year = Number(params.get("calYear") ?? today.slice(0, 4));
  const month = Number(params.get("calMonth") ?? today.slice(5, 7));
  requireValue(
    Number.isInteger(year) &&
      year >= 1900 &&
      year <= 9999 &&
      Number.isInteger(month) &&
      month >= 1 &&
      month <= 12,
    "Choose a valid calendar month.",
  );
  const rawFilters = readFilters(params);
  // Calendar month views are scoped to the exact month requested [start, end].
  // Date range presets (e.g. 90d, 30d, 7d) apply to dashboard metrics, but must
  // never clip or prevent navigating across calendar months.
  // Non-date filters (accounts, symbols, playbooks, etc.) are strictly preserved.
  const { from: _from, to: _to, ...monthFilters } = rawFilters;
  const scope = calendarScope(monthFilters, year, month);
  const { trades } = queryTrades(scope);
  const calendar = calendarMonthFromDays(dailyStats(trades, timeZone), year, month);
  const accountRows = db
    .select({ id: accounts.id, currency: accounts.currency })
    .from(accounts)
    .all();
  const currencyByAccount = new Map(accountRows.map((account) => [account.id, account.currency]));
  const currencies = [
    ...new Set(
      trades
        .filter((trade) => trade.status !== "open" && trade.closedAt)
        .map((trade) => currencyByAccount.get(trade.accountId) ?? "USD"),
    ),
  ].sort();
  if (!currencies.length) {
    const selectedIds = scope.accounts?.split(",").map((id) => id.trim());
    currencies.push(
      ...new Set(
        accountRows
          .filter((account) => !selectedIds || selectedIds.includes(account.id))
          .map((account) => account.currency),
      ),
    );
    currencies.sort();
  }
  const journalDays = getJournaledDatesForMonth(year, month);
  return ok({
    calendar,
    insights: calendarInsights(calendar),
    timeZone,
    currencies,
    scope,
    journalDays,
  });
});
