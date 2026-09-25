import { parseCsv } from "./csv";
import { ibkr } from "./formats/ibkr";
import { metatrader } from "./formats/metatrader";
import {
  dastrader,
  ibkrFlex,
  ninjatrader,
  robinhood,
  topstepx,
  tradervue,
  tradezero,
  tradingview,
  tradovate,
  webull,
} from "./formats/simple";
import { thinkorswim } from "./formats/thinkorswim";
import { tradezella } from "./formats/tradezella";
import { moomoo } from "./formats/moomoo";
import { wealthcharts } from "./formats/wealthcharts";
import { ctrader } from "./formats/ctrader";
import { quantower } from "./formats/quantower";
import { tradestation } from "./formats/tradestation";
import { ftmo } from "./formats/ftmo";
import { matchtrader } from "./formats/matchtrader";
import { tastytrade } from "./formats/tastytrade";
import { rithmic } from "./formats/rithmic";
import { sierrachart } from "./formats/sierrachart";
import { capitalcom } from "./formats/capitalcom";
import { motivewave } from "./formats/motivewave";
import { lightspeed } from "./formats/lightspeed";
import { questrade } from "./formats/questrade";
import { tc2000 } from "./formats/tc2000";
import { etrade } from "./formats/etrade";
import { silexx } from "./formats/silexx";
import { tefs } from "./formats/tefs";
import { tickblaze } from "./formats/tickblaze";
import { oanda } from "./formats/oanda";
import { tddirect } from "./formats/tddirect";
import { sterling } from "./formats/sterling";
import { historyFormat, parseHistory } from "./formats/history";
import type { ImportFormat, ImportOptions, ParsedImport } from "./types";

/**
 * Detection order matters: content-signature formats (multi-section statements,
 * HTML) go first, then header-signature CSVs from most to least specific.
 */
const LEGACY_FORMATS: ImportFormat[] = [
  metatrader,
  ibkr,
  ibkrFlex,
  thinkorswim,
  tradezella,
  tradervue,
  topstepx,
  tradingview,
  ninjatrader,
  tradovate,
  webull,
  dastrader,
  tradezero,
  robinhood,
  moomoo,
  wealthcharts,
  ctrader,
  quantower,
  tradestation,
  matchtrader,
  ftmo,
  tastytrade,
  rithmic,
  sierrachart,
  capitalcom,
  motivewave,
  lightspeed,
  questrade,
  tc2000,
  etrade,
  silexx,
  tefs,
  tickblaze,
  oanda,
  tddirect,
  sterling,
];

export const FORMATS: ImportFormat[] = [...LEGACY_FORMATS, historyFormat];

interface Route {
  format: ImportFormat;
  parsed: ParsedImport;
}

/**
 * The single routing decision shared by detectFormat and parseAuto, so the
 * format reported to the user is always the one whose parser produced the
 * result. Legacy signatures run first and win when they yield executions; the
 * history adapters cover newer variants an old broad signature recognizes but
 * cannot parse (for example MT5 Deals versus MT4 statements). Null means no
 * documented signature matched: offer the column mapper.
 */
const route = (content: string, options: ImportOptions): Route | null => {
  const headers = parseCsv(content)[0] ?? [];
  const legacyFormat = LEGACY_FORMATS.find((candidate) => candidate.detect(headers, content));
  const legacy = legacyFormat ? legacyFormat.parse(content, options) : undefined;
  if (legacyFormat && legacy?.executions.length) return { format: legacyFormat, parsed: legacy };
  const history = parseHistory(content, options);
  if (history) return { format: historyFormat, parsed: history };
  if (legacyFormat && legacy) return { format: legacyFormat, parsed: legacy };
  return null;
};

export const detectFormat = (content: string): ImportFormat | null =>
  route(content, {})?.format ?? null;

/** Detect and parse in one step; null when no known format matches (offer the column mapper). */
export const parseAuto = (content: string, options: ImportOptions = {}): ParsedImport | null =>
  route(content, options)?.parsed ?? null;
