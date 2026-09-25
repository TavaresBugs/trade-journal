import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dayKeyOf } from "@luxalgo/journal-core";
import { THEME_INIT_SCRIPT, THEME_KEY, themePreference } from "../src/lib/theme";
import { privacyPreference } from "../src/lib/privacy-preference";
import { formatDateInput, parseDateInput } from "../src/lib/date-input";
import { timeZoneLabel, timeZoneOptions } from "../src/lib/timezone-options";
import { formatTimestamp, isTimeZone } from "../src/lib/timezone";
import { parseJournalDefaults } from "../src/lib/journal-defaults";

// ============================================================================
// 1. THEME & APPEARANCE PREFERENCES
// ============================================================================

describe("Journal Appearance & Theme", () => {
  it("defaults to dark and accepts only explicit light or dark choices", () => {
    expect(themePreference(null)).toBe("dark");
    expect(themePreference("system")).toBe("dark");
    expect(themePreference("invalid")).toBe("dark");
    expect(themePreference("dark")).toBe("dark");
    expect(themePreference("light")).toBe("light");
  });

  it.each([null, "dark", "light", "invalid"])("applies %s before hydration", (saved) => {
    const calls: unknown[] = [];
    runInNewContext(THEME_INIT_SCRIPT, {
      localStorage: {
        getItem: (key: string) => {
          expect(key).toBe(THEME_KEY);
          return saved;
        },
      },
      document: {
        documentElement: { classList: { toggle: (...args: unknown[]) => calls.push(args) } },
      },
    });
    expect(calls).toEqual([["dark", themePreference(saved) === "dark"]]);
  });

  it("still renders dark when browser storage is blocked", () => {
    let dark = false;
    runInNewContext(THEME_INIT_SCRIPT, {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
      },
      document: {
        documentElement: {
          classList: {
            toggle: (_: string, value: boolean) => {
              dark = value;
            },
          },
        },
      },
    });
    expect(dark).toBe(true);
  });
});

// ============================================================================
// 2. PRIVACY PREFERENCES
// ============================================================================

describe("Global Privacy Preference", () => {
  it("carries forward the dashboard setting before the first global toggle", () => {
    expect(privacyPreference(null, '{"privacy":true}')).toBe(true);
    expect(privacyPreference(null, '{"privacy":false}')).toBe(false);
    expect(privacyPreference(null, null)).toBe(false);
  });

  it("gives the global setting priority over old saved layouts", () => {
    expect(privacyPreference("false", '{"privacy":true}')).toBe(false);
    expect(privacyPreference("true", '{"privacy":false}')).toBe(true);
  });

  it("hides amounts when a stored preference is corrupted", () => {
    expect(privacyPreference("broken", null)).toBe(true);
    expect(privacyPreference(null, "broken")).toBe(true);
  });
});

// ============================================================================
// 3. DATE-ONLY PICKER VALUES
// ============================================================================

describe("Date-Only Picker Values", () => {
  it("round trips dates without converting through UTC", () => {
    for (const value of ["2026-09-04", "2024-02-29", "2026-12-31", "0099-01-01"]) {
      expect(formatDateInput(parseDateInput(value)!)).toBe(value);
    }
  });

  it("rejects impossible and partial dates", () => {
    for (const value of [
      "",
      "2026-02-29",
      "2026-04-31",
      "2026-13-01",
      "2026-00-01",
      "2026-09-00",
      "2026-9-1",
      "09/04/2026",
    ]) {
      expect(parseDateInput(value)).toBeUndefined();
    }
  });
});

// ============================================================================
// 4. SEARCHABLE TIMEZONE CHOICES
// ============================================================================

describe("Searchable Timezone Choices", () => {
  it("includes every primary timezone supported by the runtime plus UTC", () => {
    const options = timeZoneOptions("");
    expect(options[0]).toBe("UTC");
    for (const zone of Intl.supportedValuesOf("timeZone")) expect(options).toContain(zone);
    expect(new Set(options).size).toBe(options.length);
  });

  it("finds cities regardless of capitalization, accents, underscores, or word order", () => {
    expect(timeZoneOptions("", "HELSINKI")).toEqual(["Europe/Helsinki"]);
    expect(timeZoneOptions("", "jamaica")).toContain("America/Jamaica");
    expect(timeZoneOptions("", "Asunción")).toEqual(["America/Asuncion"]);
    expect(timeZoneOptions("", "New York")).toEqual(["America/New_York"]);
    expect(timeZoneOptions("", "york america")).toEqual(["America/New_York"]);
  });

  it("keeps saved aliases and allows selecting valid full names omitted by the primary list", () => {
    expect(timeZoneOptions("US/Eastern")).toContain("US/Eastern");
    expect(timeZoneOptions("", "US/Eastern")).toEqual(["US/Eastern"]);
    expect(timeZoneOptions("", "Etc/GMT+5")).toEqual(["Etc/GMT+5"]);
    expect(timeZoneOptions("", "  Europe/Kyiv  ")).toContain("Europe/Kyiv");
  });

  it("never offers a misspelled timezone as a selectable custom value", () => {
    expect(timeZoneOptions("", "Europe/Helsinkii")).toEqual([]);
    expect(timeZoneOptions("", "Mars/Olympus")).toEqual([]);
    expect(timeZoneOptions("invalid-saved-zone")).not.toContain("invalid-saved-zone");
  });

  it("shows human-readable names while keeping region context", () => {
    expect(timeZoneLabel("America/Argentina/Buenos_Aires")).toBe(
      "America / Argentina / Buenos Aires",
    );
    expect(timeZoneLabel("UTC")).toBe("UTC");
  });
});

// ============================================================================
// 5. JOURNAL DEFAULTS VALIDATION
// ============================================================================

describe("Journal Defaults Validation", () => {
  const knows = (id: string) => id === "acct";
  const valid = {
    breakeven: 5,
    breakevenMode: "money",
    feeRules: [{ id: "f1", accountId: "acct", symbol: "ES", amount: 2, mode: "unit" }],
    riskRules: [{ id: "r1", accountId: "", symbol: "", stop: 1, target: 3, mode: "percent" }],
  };

  it("accepts a well-formed payload and returns exactly the known fields", () => {
    const parsed = parseJournalDefaults(valid, knows);
    expect(parsed.error).toBeUndefined();
    if (parsed.error === undefined) expect(parsed.defaults).toEqual(valid);
  });

  it("rejects unknown top-level fields so arbitrary data is never stored in settings", () => {
    expect(parseJournalDefaults({ ...valid, injected: "<script>" }, knows).error).toMatch(
      /unknown/,
    );
  });

  it("rejects unknown fields inside individual fee or risk defaults", () => {
    const withExtra = {
      ...valid,
      feeRules: [{ ...valid.feeRules[0], note: "extra" }],
    };
    expect(parseJournalDefaults(withExtra, knows).error).toMatch(/unknown/);
  });

  it("rejects non-finite numbers and negative or zero distances", () => {
    expect(parseJournalDefaults({ ...valid, breakeven: NaN }, knows).error).toBeDefined();
    expect(parseJournalDefaults({ ...valid, breakeven: "5" }, knows).error).toBeDefined();
    expect(
      parseJournalDefaults(
        { ...valid, feeRules: [{ ...valid.feeRules[0], amount: Infinity }] },
        knows,
      ).error,
    ).toBeDefined();
    expect(
      parseJournalDefaults({ ...valid, riskRules: [{ ...valid.riskRules[0], stop: 0 }] }, knows)
        .error,
    ).toBeDefined();
  });

  it("rejects defaults that point at an account which does not exist", () => {
    expect(
      parseJournalDefaults(
        { ...valid, feeRules: [{ ...valid.feeRules[0], accountId: "ghost" }] },
        knows,
      ).error,
    ).toMatch(/account/);
  });

  it("rejects payloads that are not objects", () => {
    expect(parseJournalDefaults(null, knows).error).toBeDefined();
    expect(parseJournalDefaults([], knows).error).toBeDefined();
    expect(parseJournalDefaults("defaults", knows).error).toBeDefined();
  });
});

// ============================================================================
// 6. TIMEZONE SUBSYSTEM & API INTEGRATION (Isolated DB Sandbox)
// ============================================================================

describe("Statement & Display Timezones Subsystem", () => {
  const scratch = mkdtempSync(join(tmpdir(), "journal-user-prefs-timezone-"));
  vi.stubEnv("JOURNAL_DATA_DIR", scratch);
  vi.stubEnv("JOURNAL_PASSWORD", "");
  vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

  let db: any;
  let accounts: any;
  let executions: any;
  let trades: any;
  let settings: any;
  let setSetting: any;
  let getTimeZone: any;
  let getImportTimeZone: any;
  let importFile: any;
  let getSettings: any;
  let patchSettings: any;
  let stats: any;
  let journal: any;
  let calendar: any;
  let listTrades: any;
  let tradeDetail: any;
  let exportData: any;
  let html: string;

  const request = (path: string, body?: unknown) =>
    new Request(
      `http://localhost/api/${path}`,
      body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) },
    );
  const save = (body: unknown) => patchSettings(request("settings", body));
  const post = async (body: object) => {
    const response = await importFile(request("import", body));
    const result = await response.json();
    expect(response.status, JSON.stringify(result)).toBe(200);
    return result;
  };

  beforeAll(async () => {
    const dbModule = await import("../src/db");
    db = dbModule.db;
    accounts = dbModule.accounts;
    executions = dbModule.executions;
    trades = dbModule.trades;
    settings = dbModule.settings;

    const settingsModule = await import("../src/server/settings");
    setSetting = settingsModule.setSetting;
    getTimeZone = settingsModule.getTimeZone;
    getImportTimeZone = settingsModule.getImportTimeZone;

    const importRoute = await import("../src/app/api/import/route");
    importFile = importRoute.POST;

    const settingsRoute = await import("../src/app/api/settings/route");
    getSettings = settingsRoute.GET;
    patchSettings = settingsRoute.PATCH;

    const statsRoute = await import("../src/app/api/stats/route");
    stats = statsRoute.GET;

    const journalRoute = await import("../src/app/api/journal/route");
    journal = journalRoute.GET;

    const calendarRoute = await import("../src/app/api/calendar/route");
    calendar = calendarRoute.GET;

    const tradesRoute = await import("../src/app/api/trades/route");
    listTrades = tradesRoute.GET;

    const tradeDetailRoute = await import("../src/app/api/trades/[key]/route");
    tradeDetail = tradeDetailRoute.GET;

    const exportRoute = await import("../src/app/api/export/route");
    exportData = exportRoute.GET;

    html = readFileSync(
      new URL("../../../docs/samples/mt5-timezone.html", import.meta.url),
      "utf8",
    );
  });

  beforeEach(() => {
    db.delete(trades).run();
    db.delete(executions).run();
    db.delete(settings).run();
    db.delete(accounts).run();
    db.insert(accounts)
      .values({ id: "test", name: "Timezone test", kind: "import", createdAt: "2026-01-01" })
      .run();
  });

  afterEach(() => vi.useRealTimers());

  afterAll(() => {
    db.$client.close();
    vi.unstubAllEnvs();
    rmSync(scratch, { recursive: true, force: true });
  });

  it("preserves legacy import behavior when only the display timezone changes", async () => {
    expect(getImportTimeZone()).toBe("UTC");
    setSetting("timeZone", "Europe/Helsinki");
    expect(getImportTimeZone()).toBe("Europe/Helsinki");
    expect((await save({ timeZone: "America/Asuncion" })).status).toBe(200);
    expect(getImportTimeZone()).toBe("Europe/Helsinki");
    expect(getTimeZone()).toBe("America/Asuncion");
    await save({ timeZone: "America/New_York" });
    expect(getImportTimeZone()).toBe("Europe/Helsinki");
  });

  it.each([
    ["2026.01.05", "2026-01-05T02:00:00.000Z"],
    ["2026.07.05", "2026-07-05T01:00:00.000Z"],
  ])(
    "imports broker wall-clock time correctly in %s and deduplicates the same file",
    async (date, expected) => {
      await save({ timeZone: "America/Asuncion", importTimeZone: "Europe/Helsinki" });
      const content = html.replaceAll("2026.07.05", date);
      const preview = await post({ mode: "preview", content });
      expect(preview).toMatchObject({
        detected: "history-metatrader",
        timeZone: "Europe/Helsinki",
      });
      expect(preview.executions[0].executedAt).toBe(expected);
      expect(db.select().from(executions).all()).toHaveLength(0);
      await post({ mode: "commit", accountId: "test", content });
      expect(
        db
          .select()
          .from(executions)
          .all()
          .map((row: any) => row.executedAt),
      ).toContain(expected);
      expect(await post({ mode: "commit", accountId: "test", content })).toMatchObject({
        inserted: 0,
        duplicates: 2,
      });
    },
  );

  it("uses a per-file override in both preview and commit without changing defaults", async () => {
    await save({ timeZone: "America/Asuncion", importTimeZone: "UTC" });
    const preview = await post({ mode: "preview", content: html, timeZone: "Europe/Helsinki" });
    await save({ importTimeZone: "America/New_York" });
    await post({ mode: "commit", accountId: "test", content: html, timeZone: preview.timeZone });
    expect(
      db
        .select()
        .from(executions)
        .all()
        .map((row: any) => row.executedAt),
    ).toContain("2026-07-05T01:00:00.000Z");
    expect(getImportTimeZone()).toBe("America/New_York");
    expect(getTimeZone()).toBe("America/Asuncion");
  });

  it("applies the statement timezone to column-mapped CSV files too", async () => {
    await save({ timeZone: "America/Asuncion", importTimeZone: "Europe/Helsinki" });
    const body = {
      content: "Ticker,Action,Units,Cost,When\nEURUSD,buy,1,1.1,2026-07-05 04:00",
      mapping: {
        symbol: "Ticker",
        side: "Action",
        quantity: "Units",
        price: "Cost",
        timestamp: "When",
      },
    };
    const preview = await post({ ...body, mode: "preview" });
    expect(preview.executions[0].executedAt).toBe("2026-07-05T01:00:00.000Z");
    await post({ ...body, mode: "commit", accountId: "test" });
    expect(db.select().from(executions).get()?.executedAt).toBe("2026-07-05T01:00:00.000Z");
  });

  it("honors explicit UTC offsets regardless of the statement timezone", async () => {
    await save({ importTimeZone: "America/Asuncion" });
    const content = html
      .replaceAll("2026.07.05 04:00", "2026-07-05T04:00:00+03:00")
      .replaceAll("2026.07.05 04:30", "2026-07-05T04:30:00+03:00");
    const preview = await post({ mode: "preview", content });
    expect(preview.executions[0].executedAt).toBe("2026-07-05T01:00:00.000Z");
  });

  it.each(["Mars/Olympus", "", null, 42, {}])(
    "rejects invalid zone %j before any setting or execution write",
    async (invalid) => {
      setSetting("timeZone", "Europe/Helsinki");
      expect((await save({ timeZone: "America/Asuncion", importTimeZone: invalid })).status).toBe(
        400,
      );
      expect((await save({ timeZone: invalid, importTimeZone: "UTC" })).status).toBe(400);
      expect(getTimeZone()).toBe("Europe/Helsinki");
      expect(getImportTimeZone()).toBe("Europe/Helsinki");
      for (const mode of ["preview", "commit"])
        expect(
          (
            await importFile(
              request("import", { mode, accountId: "test", content: html, timeZone: invalid }),
            )
          ).status,
        ).toBe(400);
      expect(db.select().from(executions).all()).toHaveLength(0);
    },
  );

  it("aligns trade dates, execution times, analytics and journal/calendar days across midnight", async () => {
    await save({ timeZone: "America/Asuncion", importTimeZone: "Europe/Helsinki" });
    await post({ mode: "commit", accountId: "test", content: html });
    const stored = db.select().from(trades).get()!;
    const dashboard = await (await stats(request("stats?calYear=2026&calMonth=7"))).json();
    expect(dashboard.days[0].date).toBe("2026-07-04");
    expect(dashboard.buckets.hour.find((bucket: { trades: number }) => bucket.trades > 0).key).toBe(
      "22",
    );
    const days = await (await journal(request("journal"))).json();
    expect(days.days[0].date).toBe("2026-07-04");
    const month = await (await calendar(request("calendar?calYear=2026&calMonth=7"))).json();
    expect(
      month.calendar.weeks
        .flatMap((week: { days: Array<{ date: string; trades: number } | null> }) => week.days)
        .filter((day: { trades: number } | null) => day?.trades),
    ).toMatchObject([{ date: "2026-07-04" }]);
    const detail = await (
      await tradeDetail(request("trades/test"), { params: Promise.resolve({ key: stored.key }) })
    ).json();
    const listed = await (await listTrades(request("trades?view=list"))).json();
    expect(
      detail.executions
        .map((fill: { executedAt: string }) => formatTimestamp(fill.executedAt, detail.timeZone))
        .sort(),
    ).toEqual(["2026-07-04 22:00:00", "2026-07-04 22:30:00"]);
    expect(dayKeyOf(listed.trades[0].closedAt, listed.timeZone)).toBe("2026-07-04");
    expect(dayKeyOf(dashboard.recentTrades[0].closedAt, dashboard.timeZone)).toBe("2026-07-04");
    await save({ timeZone: "Europe/Helsinki", importTimeZone: "UTC" });
    expect(db.select().from(trades).get()?.closedAt).toBe(stored.closedAt);
    expect((await (await journal(request("journal"))).json()).days[0].date).toBe("2026-07-05");
  });

  it("uses the journal's current month at the UTC month boundary", async () => {
    await save({ timeZone: "America/Asuncion" });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-01T01:00:00Z"));
    const result = await (await stats(request("stats"))).json();
    expect(result.calendar).toMatchObject({ year: 2026, month: 7 });
  });

  it("returns and backs up both timezone settings", async () => {
    await save({ timeZone: "America/Asuncion", importTimeZone: "Europe/Helsinki" });
    expect(await (await getSettings()).json()).toMatchObject({
      timeZone: "America/Asuncion",
      importTimeZone: "Europe/Helsinki",
    });
    expect((await (await exportData(request("export"))).json()).settings).toMatchObject({
      timeZone: "America/Asuncion",
      importTimeZone: "Europe/Helsinki",
    });
  });

  it("handles DST offsets, midnight and fractional-hour zones without the device timezone", () => {
    expect(formatTimestamp("2026-01-05T07:00:00Z", "Europe/Helsinki")).toBe("2026-01-05 09:00:00");
    expect(formatTimestamp("2026-07-05T06:00:00Z", "Europe/Helsinki")).toBe("2026-07-05 09:00:00");
    expect(formatTimestamp("2026-07-05T03:00:00Z", "America/Asuncion")).toBe("2026-07-05 00:00:00");
    expect(formatTimestamp("2026-07-05T00:00:00Z", "Asia/Kathmandu")).toBe("2026-07-05 05:45:00");
    expect(isTimeZone("Europe/Helsinki")).toBe(true);
    expect(isTimeZone(undefined)).toBe(false);
  });
});
