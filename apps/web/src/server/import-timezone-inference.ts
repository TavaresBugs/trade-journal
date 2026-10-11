import { parseAuto, parseTimestamp, type ImportedExecution } from "@luxalgo/journal-importers";
import { db } from "@/db";
import { parseResolutionMs } from "@/lib/market-data";
import { normalizeSymbol } from "@/lib/assets/symbol-utils";
import { getActiveCompatibleSymbols } from "@/server/market-data/csv";
import { isTimeZone } from "@/lib/timezone";
import { getImportTimeZone, getTimeZone } from "@/server/settings";

export interface TimeZoneCandidateScore {
  timeZone: string;
  hitCount: number;
  evaluatedCount: number;
  hitRate: number;
  score: number;
}

export interface InferImportTimeZoneOptions {
  executions: ImportedExecution[];
  initialTimeZone: string;
  accountTimeZone?: string | null;
  candidateTimeZones?: string[];
  /**
   * Optional callback that re-parses the statement in a given timezone.
   * Used to detect whether the statement timestamps already contain explicit offsets
   * (such as trailing "Z", "+00:00", or "GMT-0300"), in which case timestamps are absolute
   * and must not be shifted.
   */
  reparseExecutions?: (timeZone: string) => ImportedExecution[] | null | undefined;
  /**
   * Optional raw statement content(s) used to check for explicit offsets when
   * `reparseExecutions` is not supplied.
   */
  rawContent?: string | string[];
  /**
   * Explicit flag indicating the source timestamps already carry timezone offsets.
   */
  hasExplicitOffsets?: boolean;
}

export interface InferImportTimeZoneResult {
  timeZone: string;
  originalTimeZone: string;
  autoCalibrated: boolean;
  bestHitRate: number;
  initialHitRate: number;
  evaluatedCount: number;
  hitCount: number;
  candidates: TimeZoneCandidateScore[];
}

const DEFAULT_CANDIDATE_TIMEZONES = [
  "America/Sao_Paulo",
  "America/New_York",
  "America/Chicago",
  "Europe/Helsinki",
  "Europe/London",
  "Europe/Berlin",
  "UTC",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
] as const;

const MAX_SAMPLED_EXECUTIONS = 40;
const MAX_INTRADAY_RESOLUTION_MS = 3_600_000; // 1h max so candles have narrow temporal resolution
const MAX_TIMEZONE_SHIFT_MS = 36 * 3_600_000; // +-36h window across all candidate offsets

const wallClockFormatters = new Map<string, Intl.DateTimeFormat>();

function getWallClockFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = wallClockFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    wallClockFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * Recovers the original naive wall-clock string ("YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD HH:mm:ss.SSS")
 * from an execution timestamp that was parsed under `initialTimeZone`.
 */
export function extractNaiveWallClock(
  isoTimestamp: string,
  initialTimeZone: string,
): string | null {
  const date = new Date(isoTimestamp);
  const utcMs = date.getTime();
  if (Number.isNaN(utcMs)) return null;

  const parts = getWallClockFormatter(initialTimeZone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const year = get("year");
  const month = get("month");
  const day = get("day");
  const rawHour = get("hour");
  const hour = rawHour === "24" ? "00" : rawHour;
  const minute = get("minute");
  const second = get("second");

  if (!year || !month || !day || !hour || !minute || !second) return null;

  const ms = date.getUTCMilliseconds();
  const msSuffix = ms > 0 ? `.${String(ms).padStart(3, "0")}` : "";
  return `${year}-${month}-${day} ${hour}:${minute}:${second}${msSuffix}`;
}

/**
 * Re-parses or shifts imported executions from `fromTimeZone` to `toTimeZone`.
 */
export function reparseOrShiftImportedExecutions(
  executions: ImportedExecution[],
  fromTimeZone: string,
  toTimeZone: string,
  reparse?: (timeZone: string) => ImportedExecution[] | null | undefined,
): ImportedExecution[] {
  if (!fromTimeZone || !toTimeZone || fromTimeZone === toTimeZone) {
    return executions;
  }

  if (reparse) {
    const reparsed = reparse(toTimeZone);
    if (reparsed && reparsed.length > 0) {
      return reparsed;
    }
  }

  return executions.map((exec) => {
    const naive = extractNaiveWallClock(exec.executedAt, fromTimeZone);
    const shiftedExecutedAt = naive ? parseTimestamp(naive, toTimeZone) : null;

    let shiftedLegacyExecutedAt = exec.legacyExecutedAt;
    if (exec.legacyExecutedAt) {
      const legacyNaive = extractNaiveWallClock(exec.legacyExecutedAt, fromTimeZone);
      const nextLegacy = legacyNaive ? parseTimestamp(legacyNaive, toTimeZone) : null;
      if (nextLegacy) shiftedLegacyExecutedAt = nextLegacy;
    }

    return {
      ...exec,
      executedAt: shiftedExecutedAt ?? exec.executedAt,
      ...(shiftedLegacyExecutedAt !== undefined
        ? { legacyExecutedAt: shiftedLegacyExecutedAt }
        : {}),
    };
  });
}

/**
 * Normalizes a symbol from an imported execution into ordered lookup candidates
 * for `market_series_summary` and `market_candles`.
 * Examples:
 * - "MESZ6" -> ["MES", "MESZ6"]
 * - "US500.CASH" -> ["US500", "US500.CASH"]
 */
export function normalizeSymbolForCandleLookup(rawSymbol: string): string[] {
  if (!rawSymbol || !rawSymbol.trim()) return [];
  const upper = rawSymbol.trim().toUpperCase();
  const noPrefix = upper.includes(":") ? (upper.split(":").at(-1) ?? upper) : upper;
  const noCash = noPrefix.replace(/[\._]?(CASH|PRO|RAW|STD|ECN|MINI|MICRO|SB)$/i, "");
  const noSpaceContract = noCash.replace(
    /\s+([FGHJKMNQUVXZ]?\d{1,4}|\d{2}-\d{2}|[A-Z]{3}\d{2,4})$/i,
    "",
  );
  const noExpiry = noSpaceContract.replace(/^([A-Z0-9]+?)[FGHJKMNQUVXZ]\d{1,2}!*$/i, "$1");
  const canonical = normalizeSymbol(rawSymbol);

  const candidates = new Set<string>();
  for (const sym of [canonical, noExpiry, noSpaceContract, noCash, noPrefix, upper]) {
    if (sym && sym.trim()) {
      candidates.add(sym.trim().toUpperCase());
    }
  }

  const baseForBrothers = canonical || noExpiry;
  if (baseForBrothers) {
    for (const brother of getActiveCompatibleSymbols(baseForBrothers)) {
      if (brother && brother.trim()) {
        candidates.add(brother.trim().toUpperCase());
      }
    }
  }

  return Array.from(candidates);
}

const EXPLICIT_OFFSET_PATTERN =
  /\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})[T ,]+\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:\s*(?:AM|PM))?\s*(?:Z|[+-]\d{2}:?\d{2}|(?:GMT|UTC)[+-]\d{1,4})\b/i;

function detectExplicitOffsets(options: InferImportTimeZoneOptions): boolean {
  if (options.hasExplicitOffsets) return true;

  const { executions, initialTimeZone, reparseExecutions, rawContent } = options;
  if (executions.length === 0) return false;

  const firstExec = executions[0]!;
  // Choose a probe timezone guaranteed to have a different wall-clock offset than initialTimeZone
  // at the first execution's timestamp.
  const wallInitial = extractNaiveWallClock(firstExec.executedAt, initialTimeZone);
  const probeTz =
    extractNaiveWallClock(firstExec.executedAt, "UTC") !== wallInitial ? "UTC" : "America/Chicago";

  if (reparseExecutions) {
    try {
      const reparsed = reparseExecutions(probeTz);
      if (reparsed && reparsed.length > 0) {
        const execTimestamps = new Set(executions.map((e) => e.executedAt));
        const sampleCheckCount = Math.min(5, reparsed.length);
        let allIdentical = true;
        for (let i = 0; i < sampleCheckCount; i++) {
          const ts = reparsed[i]?.executedAt;
          if (!ts || !execTimestamps.has(ts)) {
            allIdentical = false;
            break;
          }
        }
        if (allIdentical) return true;
      }
    } catch {
      // Ignore reparse probe errors and fall through
    }
  }

  if (rawContent) {
    const rawList = Array.isArray(rawContent) ? rawContent : [rawContent];
    const firstNonEmpty = rawList.find((c) => typeof c === "string" && c.trim().length > 0);
    if (firstNonEmpty) {
      if (!reparseExecutions) {
        try {
          const parsedUtc = parseAuto(firstNonEmpty, { timeZone: "UTC" });
          const parsedChi = parseAuto(firstNonEmpty, { timeZone: "America/Chicago" });
          if (
            parsedUtc &&
            parsedChi &&
            parsedUtc.executions.length > 0 &&
            parsedUtc.executions.length === parsedChi.executions.length &&
            parsedUtc.executions[0]?.executedAt === parsedChi.executions[0]?.executedAt
          ) {
            return true;
          }
        } catch {
          // Ignore and check regex
        }
      }
      if (EXPLICIT_OFFSET_PATTERN.test(firstNonEmpty)) {
        return true;
      }
    }
  }

  return false;
}

function sampleExecutions(executions: ImportedExecution[], maxCount: number): ImportedExecution[] {
  const valid = executions.filter(
    (e) =>
      Boolean(e.symbol && e.symbol.trim()) &&
      Number.isFinite(e.price) &&
      e.price > 0 &&
      Boolean(e.executedAt) &&
      !Number.isNaN(Date.parse(e.executedAt)),
  );
  if (valid.length <= maxCount) return valid;

  const sampled: ImportedExecution[] = [];
  for (let i = 0; i < maxCount; i++) {
    const idx = Math.floor((i * valid.length) / maxCount);
    const item = valid[idx];
    if (item) sampled.push(item);
  }
  return sampled;
}

interface SeriesInfo {
  symbol: string;
  resolution: string;
  resolutionMs: number;
  firstTime: number;
  lastTime: number;
  priorityIndex: number;
}

/**
 * Infers the most likely IANA statement timezone by aligning sampled execution timestamps
 * and fill prices against local `market_candles` / `market_series_summary` OHLC ranges.
 */
export function inferImportTimeZoneFromCandles(
  options: InferImportTimeZoneOptions,
): InferImportTimeZoneResult {
  const { executions, initialTimeZone, accountTimeZone, candidateTimeZones } = options;

  const noOpResult = (): InferImportTimeZoneResult => ({
    timeZone: initialTimeZone,
    originalTimeZone: initialTimeZone,
    autoCalibrated: false,
    bestHitRate: 0,
    initialHitRate: 0,
    evaluatedCount: 0,
    hitCount: 0,
    candidates: [],
  });

  if (!isTimeZone(initialTimeZone) || executions.length < 2) {
    return noOpResult();
  }

  // If the statement already carries explicit timezone offsets (e.g. Z or GMT-0300),
  // timestamps are absolute and must never be shifted.
  if (detectExplicitOffsets(options)) {
    return noOpResult();
  }

  const sampled = sampleExecutions(executions, MAX_SAMPLED_EXECUTIONS);
  if (sampled.length < 2) {
    return noOpResult();
  }

  const rawPool = [
    initialTimeZone,
    getImportTimeZone(),
    getTimeZone(),
    accountTimeZone ?? undefined,
    ...(candidateTimeZones ?? []),
    ...DEFAULT_CANDIDATE_TIMEZONES,
  ];
  const candidatePool = Array.from(
    new Set(rawPool.filter((tz): tz is string => Boolean(tz) && isTimeZone(tz))),
  );

  if (candidatePool.length <= 1) {
    return noOpResult();
  }

  const sqlite = db.$client;
  const summaryQuery = sqlite.prepare(`
    SELECT symbol, resolution, first_time as firstTime, last_time as lastTime, bar_count as barCount
    FROM market_series_summary
    WHERE symbol = ? AND bar_count > 0
  `);
  const fallbackCandlesSummaryQuery = sqlite.prepare(`
    SELECT symbol, resolution, MIN(time) as firstTime, MAX(time) as lastTime, COUNT(*) as barCount
    FROM market_candles
    WHERE symbol = ?
    GROUP BY symbol, resolution
  `);

  // Group sampled executions by raw symbol to determine the relevant time range per symbol
  const symbolTimeBounds = new Map<string, { minMs: number; maxMs: number }>();
  for (const exec of sampled) {
    const ms = Date.parse(exec.executedAt);
    const key = exec.symbol.trim().toUpperCase();
    const current = symbolTimeBounds.get(key);
    if (!current) {
      symbolTimeBounds.set(key, { minMs: ms, maxMs: ms });
    } else {
      if (ms < current.minMs) current.minMs = ms;
      if (ms > current.maxMs) current.maxMs = ms;
    }
  }

  const seriesByRawSymbol = new Map<string, SeriesInfo[]>();
  let anySeriesAvailable = false;

  for (const [rawSym, bounds] of symbolTimeBounds.entries()) {
    const lookupSymbols = normalizeSymbolForCandleLookup(rawSym);
    const matchingSeries: SeriesInfo[] = [];
    const minWindow = bounds.minMs - MAX_TIMEZONE_SHIFT_MS;
    const maxWindow = bounds.maxMs + MAX_TIMEZONE_SHIFT_MS;

    for (let priorityIndex = 0; priorityIndex < lookupSymbols.length; priorityIndex++) {
      const sym = lookupSymbols[priorityIndex]!;
      let rows = summaryQuery.all(sym) as Array<{
        symbol: string;
        resolution: string;
        firstTime: number;
        lastTime: number;
        barCount: number;
      }>;
      if (rows.length === 0) {
        rows = fallbackCandlesSummaryQuery.all(sym) as typeof rows;
      }

      for (const row of rows) {
        const resolutionMs = parseResolutionMs(row.resolution);
        if (resolutionMs <= 0 || resolutionMs > MAX_INTRADAY_RESOLUTION_MS) continue;
        if (row.firstTime - resolutionMs <= maxWindow && row.lastTime + resolutionMs >= minWindow) {
          matchingSeries.push({
            symbol: row.symbol,
            resolution: row.resolution,
            resolutionMs,
            firstTime: row.firstTime,
            lastTime: row.lastTime,
            priorityIndex,
          });
        }
      }
    }

    // Prioritize exact/canonical symbol match first, then finest resolution (1m < 3m < 5m < 15m < 30m < 1h)
    matchingSeries.sort((a, b) => {
      if (a.priorityIndex !== b.priorityIndex) return a.priorityIndex - b.priorityIndex;
      return a.resolutionMs - b.resolutionMs;
    });

    if (matchingSeries.length > 0) {
      seriesByRawSymbol.set(rawSym, matchingSeries);
      anySeriesAvailable = true;
    }
  }

  if (!anySeriesAvailable) {
    return noOpResult();
  }

  // Pre-extract naive wall-clock strings from initialTimeZone for each sampled execution
  const preparedSample = sampled
    .map((exec) => {
      const rawKey = exec.symbol.trim().toUpperCase();
      const seriesList = seriesByRawSymbol.get(rawKey);
      if (!seriesList || seriesList.length === 0) return null;
      const naiveWallClock = extractNaiveWallClock(exec.executedAt, initialTimeZone);
      if (!naiveWallClock) return null;
      return {
        exec,
        naiveWallClock,
        initialMs: Date.parse(exec.executedAt),
        seriesList,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (preparedSample.length < 2) {
    return noOpResult();
  }

  const queryBarsStmt = sqlite.prepare(`
    SELECT low, high
    FROM market_candles
    WHERE symbol = ? AND resolution = ? AND time >= ? AND time <= ?
  `);

  const candidateScores: TimeZoneCandidateScore[] = [];

  for (const candidateTz of candidatePool) {
    let hitCount = 0;
    let evaluatedCount = 0;

    for (const item of preparedSample) {
      let targetMs: number;
      if (candidateTz === initialTimeZone) {
        targetMs = item.initialMs;
      } else {
        const candidateIso = parseTimestamp(item.naiveWallClock, candidateTz);
        if (!candidateIso) continue;
        targetMs = Date.parse(candidateIso);
      }
      if (Number.isNaN(targetMs)) continue;

      // Pick the finest resolution series whose [firstTime, lastTime] covers targetMs
      const coveringSeries =
        item.seriesList.find(
          (s) =>
            targetMs >= s.firstTime - s.resolutionMs && targetMs <= s.lastTime + s.resolutionMs,
        ) ?? item.seriesList[0]!;

      const { symbol: dbSymbol, resolution, resolutionMs } = coveringSeries;
      const barStartMs = Math.floor(targetMs / resolutionMs) * resolutionMs;
      const bars = queryBarsStmt.all(
        dbSymbol,
        resolution,
        barStartMs - resolutionMs,
        barStartMs + resolutionMs,
      ) as Array<{ low: number; high: number }>;

      if (bars.length === 0) continue;

      evaluatedCount++;
      const tolerance = Math.max(0.5, item.exec.price * 0.0004);
      const isHit = bars.some(
        (bar) => item.exec.price >= bar.low - tolerance && item.exec.price <= bar.high + tolerance,
      );
      if (isHit) {
        hitCount++;
      }
    }

    const hitRate = evaluatedCount > 0 ? hitCount / evaluatedCount : 0;
    const score = hitRate + (candidateTz === initialTimeZone ? 0.01 : 0);

    candidateScores.push({
      timeZone: candidateTz,
      hitCount,
      evaluatedCount,
      hitRate,
      score,
    });
  }

  const initialScore = candidateScores.find((c) => c.timeZone === initialTimeZone) ?? {
    timeZone: initialTimeZone,
    hitCount: 0,
    evaluatedCount: 0,
    hitRate: 0,
    score: 0.01,
  };

  const maxEvaluatedCount = candidateScores.reduce(
    (max, c) => (c.evaluatedCount > max ? c.evaluatedCount : max),
    0,
  );
  const minRequiredEvaluated = Math.max(2, Math.ceil(maxEvaluatedCount * 0.5));

  const eligibleCandidates = candidateScores.filter(
    (c) => c.evaluatedCount >= minRequiredEvaluated,
  );

  if (eligibleCandidates.length === 0) {
    return {
      timeZone: initialTimeZone,
      originalTimeZone: initialTimeZone,
      autoCalibrated: false,
      bestHitRate: initialScore.hitRate,
      initialHitRate: initialScore.hitRate,
      evaluatedCount: initialScore.evaluatedCount,
      hitCount: initialScore.hitCount,
      candidates: candidateScores,
    };
  }

  eligibleCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.hitCount - a.hitCount;
  });

  const best = eligibleCandidates[0]!;
  const isClearImprovement =
    best.timeZone !== initialTimeZone &&
    best.evaluatedCount >= 2 &&
    best.hitRate >= 0.75 &&
    (best.hitRate >= initialScore.hitRate + 0.25 || initialScore.hitRate < 0.5);

  if (isClearImprovement) {
    return {
      timeZone: best.timeZone,
      originalTimeZone: initialTimeZone,
      autoCalibrated: true,
      bestHitRate: best.hitRate,
      initialHitRate: initialScore.hitRate,
      evaluatedCount: best.evaluatedCount,
      hitCount: best.hitCount,
      candidates: candidateScores,
    };
  }

  return {
    timeZone: initialTimeZone,
    originalTimeZone: initialTimeZone,
    autoCalibrated: false,
    bestHitRate: best.hitRate,
    initialHitRate: initialScore.hitRate,
    evaluatedCount: initialScore.evaluatedCount,
    hitCount: initialScore.hitCount,
    candidates: candidateScores,
  };
}
