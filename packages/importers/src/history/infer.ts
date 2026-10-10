import { parseImportTimestamp } from "./timestamps";
import { parseNumericCell } from "./csv";
import type { CsvRecord } from "./csv";
import type { ColumnMapping } from "./model";

export interface InferredMetaTraderResult {
  mapping: ColumnMapping;
  directionTokens?: {
    buy: string;
    sell: string;
  };
  confidence: "exact" | "high" | "low";
}

/**
 * Inspect sample data rows (up to 100 rows) to infer MetaTrader column mappings
 * purely from cell values, WITHOUT requiring translated header strings.
 *
 * Implements:
 * 1. Dual Timestamps (lower average is Open Time, higher average is Close Time).
 * 2. Ticket ID (positive integer >= 6 digits with high uniqueness).
 * 3. Open Price & Close Price (positive floats on same scale, never 0).
 * 4. Volume / Quantity (positive float in [0.01, 100.0]).
 * 5. S/L & T/P (price-scale floats frequently containing 0.00 or empty).
 * 6. Commission & Swap (non-positive numbers <= 0.00 or zero).
 * 7. Profit (signed float matching price difference * volume correlation).
 * 8. Direction without dictionary (Physical Law of Profit):
 *    (ClosePrice - OpenPrice) * Profit > 0 => Long / Buy
 *    (ClosePrice - OpenPrice) * Profit < 0 => Short / Sell
 */
export function inferMetaTraderColumns(
  records: readonly CsvRecord[],
): InferredMetaTraderResult | null {
  if (!records || records.length === 0) return null;

  // Filter candidate data rows (skip section titles, preamble, empty rows)
  const candidateRows: CsvRecord[] = [];
  for (const r of records) {
    if (r.cells.length < 8) continue;
    const nonEmpty = r.cells.filter((c) => c.trim() !== "");
    if (nonEmpty.length < 5) continue;
    candidateRows.push(r);
    if (candidateRows.length >= 100) break;
  }

  if (candidateRows.length === 0) return null;

  const colCount = Math.max(...candidateRows.map((r) => r.cells.length));
  if (colCount < 8) return null;

  // 1. Dual Timestamps
  const timestampCols: { col: number; avgTime: number; count: number }[] = [];
  for (let c = 0; c < colCount; c++) {
    const times: number[] = [];
    for (const r of candidateRows) {
      const val = (r.cells[c] ?? "").trim();
      if (!val) continue;
      if (/^\d{4}[./-]\d{1,2}[./-]\d{1,2}/.test(val)) {
        const t = parseImportTimestamp(val);
        if (Number.isFinite(t)) times.push(t);
      }
    }
    if (times.length >= Math.max(1, Math.min(candidateRows.length * 0.4, 3))) {
      const avgTime = times.reduce((s, x) => s + x, 0) / times.length;
      timestampCols.push({ col: c, avgTime, count: times.length });
    }
  }

  if (timestampCols.length < 2) return null;

  // Pick the two columns with highest timestamp counts
  timestampCols.sort((a, b) => b.count - a.count);
  const bestTwoTimestamps = timestampCols.slice(0, 2);
  bestTwoTimestamps.sort((a, b) => a.avgTime - b.avgTime);
  const entryTimeCol = bestTwoTimestamps[0]!.col;
  const exitTimeCol = bestTwoTimestamps[1]!.col;

  // 2. Ticket ID: Strict positive integer >= 6 digits with high uniqueness
  let tradeIdCol = -1;
  let bestTicketScore = -1;
  for (let c = 0; c < colCount; c++) {
    if (c === entryTimeCol || c === exitTimeCol) continue;
    let matchCount6 = 0;
    let matchCount4 = 0;
    const vals: string[] = [];
    for (const r of candidateRows) {
      const val = (r.cells[c] ?? "").trim();
      if (!val) continue;
      if (/^\d{6,}$/.test(val)) {
        matchCount6++;
        vals.push(val);
      } else if (/^\d{4,}$/.test(val)) {
        matchCount4++;
        vals.push(val);
      }
    }
    const totalMatches = matchCount6 + matchCount4;
    if (totalMatches >= Math.max(1, candidateRows.length * 0.4)) {
      const uniqueRatio = new Set(vals).size / vals.length;
      const score = (matchCount6 >= totalMatches * 0.7 ? 10 : 1) * uniqueRatio;
      if (uniqueRatio >= 0.5 && score > bestTicketScore) {
        bestTicketScore = score;
        tradeIdCol = c;
      }
    }
  }

  // 3. Numeric columns analysis
  interface NumericColInfo {
    col: number;
    allPositive: boolean;
    hasZerosOrEmpty: boolean;
    allNonPositive: boolean;
    hasNegatives: boolean;
    minVal: number;
    maxVal: number;
    meanVal: number;
    validCount: number;
  }

  const numericCols: NumericColInfo[] = [];
  for (let c = 0; c < colCount; c++) {
    if (c === entryTimeCol || c === exitTimeCol || c === tradeIdCol) continue;
    const nums: number[] = [];
    let zeroOrEmptyCount = 0;
    for (const r of candidateRows) {
      const val = (r.cells[c] ?? "").trim();
      if (!val) {
        zeroOrEmptyCount++;
        continue;
      }
      const n = parseNumericCell(val);
      if (Number.isFinite(n)) {
        nums.push(n);
        if (n === 0) zeroOrEmptyCount++;
      }
    }
    if (nums.length >= Math.max(1, candidateRows.length * 0.3)) {
      const allPositive = nums.length > 0 && nums.every((n) => n > 0);
      const allNonPositive = nums.length > 0 && nums.every((n) => n <= 0);
      const hasNegatives = nums.some((n) => n < 0);
      const minVal = Math.min(...nums);
      const maxVal = Math.max(...nums);
      const meanVal = nums.reduce((s, x) => s + x, 0) / nums.length;
      numericCols.push({
        col: c,
        allPositive,
        hasZerosOrEmpty: zeroOrEmptyCount > 0,
        allNonPositive,
        hasNegatives,
        minVal,
        maxVal,
        meanVal,
        validCount: nums.length,
      });
    }
  }

  // 4. Volume / Quantity: positive float in [0.01, 100.0] (or [0.001, 500])
  let quantityCol = -1;
  const volumeCandidates = numericCols.filter(
    (n) => n.allPositive && n.minVal >= 0.001 && n.maxVal <= 500 && n.meanVal <= 50,
  );
  if (volumeCandidates.length > 0) {
    // Volume typically resides between entryTimeCol and entryPriceCol
    volumeCandidates.sort((a, b) => {
      const aInStdRange = a.minVal >= 0.01 && a.maxVal <= 100 ? 1 : 0;
      const bInStdRange = b.minVal >= 0.01 && b.maxVal <= 100 ? 1 : 0;
      return bInStdRange - aInStdRange || b.validCount - a.validCount;
    });
    quantityCol = volumeCandidates[0]!.col;
  }

  // 5. Open Price & Close Price: positive floats on the same scale, never 0
  // In MetaTrader geometry:
  // Open Price is the earliest price candidate before exitTimeCol (col 5)
  // Close Price is the earliest price candidate after exitTimeCol (col 9)
  let entryPriceCol = -1;
  let exitPriceCol = -1;

  const entryPriceCandidates = numericCols.filter(
    (n) => n.col < exitTimeCol && n.col !== quantityCol && n.allPositive && n.meanVal > 0,
  );
  const exitPriceCandidates = numericCols.filter(
    (n) => n.col > exitTimeCol && n.allPositive && n.meanVal > 0,
  );

  entryPriceCandidates.sort((a, b) => a.col - b.col);
  exitPriceCandidates.sort((a, b) => a.col - b.col);

  let bestPriceScaleDiff = Number.POSITIVE_INFINITY;
  for (const ep of entryPriceCandidates) {
    for (const xp of exitPriceCandidates) {
      const scaleDiff = Math.abs(ep.meanVal - xp.meanVal) / Math.max(ep.meanVal, xp.meanVal);
      if (scaleDiff < 0.3 && scaleDiff < bestPriceScaleDiff) {
        bestPriceScaleDiff = scaleDiff;
        entryPriceCol = ep.col;
        exitPriceCol = xp.col;
        break; // Earliest price candidate on matching scale is Open Price
      }
    }
    if (entryPriceCol !== -1) break;
  }

  if (entryPriceCol === -1 || exitPriceCol === -1) return null;

  // 6. S/L & T/P: price-scale floats between entryPriceCol and exitTimeCol
  let stopPriceCol = -1;
  const slCandidates = numericCols.filter(
    (n) => n.col > entryPriceCol && n.col < exitTimeCol,
  );
  if (slCandidates.length > 0) {
    slCandidates.sort((a, b) => a.col - b.col);
    stopPriceCol = slCandidates[0]!.col;
  }

  // 7. Profit (pnl): signed float after exitPriceCol matching price difference * volume correlation
  let pnlCol = -1;
  const pnlCandidates = numericCols.filter((n) => n.col > exitPriceCol);

  // If there are columns with positive values (winning trades exist), exclude strictly non-positive columns
  const hasPositiveColumns = pnlCandidates.filter((n) => n.maxVal > 0);
  const eligiblePnlCandidates =
    hasPositiveColumns.length > 0 ? hasPositiveColumns : pnlCandidates;

  let bestPnlScore = -1;
  for (const cand of eligiblePnlCandidates) {
    let correlationSum = 0;
    let nonZeroMatches = 0;
    let signedVariety = 0;
    for (const r of candidateRows) {
      const ep = parseNumericCell(r.cells[entryPriceCol] ?? "");
      const xp = parseNumericCell(r.cells[exitPriceCol] ?? "");
      const p = parseNumericCell(r.cells[cand.col] ?? "");
      if (Number.isFinite(ep) && Number.isFinite(xp) && Number.isFinite(p) && p !== 0) {
        nonZeroMatches++;
        if (p > 0) signedVariety |= 1;
        if (p < 0) signedVariety |= 2;
        correlationSum += Math.abs(p);
      }
    }
    const varietyMultiplier = signedVariety === 3 ? 3 : signedVariety === 1 ? 2 : 1;
    const score = nonZeroMatches * varietyMultiplier * (1 + Math.log10(1 + correlationSum));
    if (score > bestPnlScore) {
      bestPnlScore = score;
      pnlCol = cand.col;
    }
  }

  if (pnlCol === -1) {
    // Default to last numeric column
    const afterExit = numericCols.filter((n) => n.col > exitPriceCol);
    if (afterExit.length > 0) {
      afterExit.sort((a, b) => b.col - a.col);
      pnlCol = afterExit[0]!.col;
    }
  }

  if (pnlCol === -1) return null;

  // 8. Commission & Swap: non-positive numbers (<= 0.00) or zero
  let feesCol = -1;
  let swapCol = -1;
  const nonPosCandidates = numericCols.filter(
    (n) => n.col > exitPriceCol && n.col !== pnlCol && (n.allNonPositive || n.meanVal <= 0),
  );
  nonPosCandidates.sort((a, b) => a.col - b.col);

  if (nonPosCandidates.length === 1) {
    feesCol = nonPosCandidates[0]!.col;
  } else if (nonPosCandidates.length >= 2) {
    feesCol = nonPosCandidates[0]!.col;
    swapCol = nonPosCandidates[nonPosCandidates.length - 1]!.col;
  }

  // 9. Direction (Buy vs Sell) without Dictionary (Physical Law of Profit):
  // For any trade where Gross Profit != 0:
  // Long / Buy: (ClosePrice - OpenPrice) * Profit > 0
  // Short / Sell: (ClosePrice - OpenPrice) * Profit < 0
  let directionCol = -1;
  let buyToken = "";
  let sellToken = "";
  let bestDirPurity = 0;

  for (let c = 0; c < colCount; c++) {
    if (
      c === entryTimeCol ||
      c === exitTimeCol ||
      c === tradeIdCol ||
      c === entryPriceCol ||
      c === exitPriceCol ||
      c === pnlCol ||
      c === quantityCol ||
      c === stopPriceCol ||
      c === feesCol ||
      c === swapCol
    ) {
      continue;
    }

    const tokenScores = new Map<string, { sum: number; count: number }>();
    let tradeCount = 0;

    for (const r of candidateRows) {
      const ep = parseNumericCell(r.cells[entryPriceCol] ?? "");
      const xp = parseNumericCell(r.cells[exitPriceCol] ?? "");
      const pnl = parseNumericCell(r.cells[pnlCol] ?? "");
      if (
        !Number.isFinite(ep) ||
        ep <= 0 ||
        !Number.isFinite(xp) ||
        xp <= 0 ||
        !Number.isFinite(pnl) ||
        pnl === 0
      ) {
        continue;
      }
      const delta = xp - ep;
      if (Math.abs(delta) < ep * 1e-6) continue;

      const rawToken = (r.cells[c] ?? "").trim();
      if (!rawToken) continue;

      tradeCount++;
      const prod = delta * pnl;
      const curr = tokenScores.get(rawToken) ?? { sum: 0, count: 0 };
      curr.sum += prod;
      curr.count += 1;
      tokenScores.set(rawToken, curr);
    }

    if (tradeCount >= 1 && tokenScores.size >= 1 && tokenScores.size <= 5) {
      let candBuy = "";
      let candSell = "";
      let maxBuySum = 0;
      let minSellSum = 0;

      for (const [token, { sum }] of tokenScores.entries()) {
        if (sum > 0 && sum > maxBuySum) {
          maxBuySum = sum;
          candBuy = token;
        } else if (sum < 0 && sum < minSellSum) {
          minSellSum = sum;
          candSell = token;
        }
      }

      // If only one token was encountered but tokenScores has 2 tokens
      if (!candBuy && candSell && tokenScores.size === 2) {
        for (const token of tokenScores.keys()) {
          if (token !== candSell) candBuy = token;
        }
      } else if (!candSell && candBuy && tokenScores.size === 2) {
        for (const token of tokenScores.keys()) {
          if (token !== candBuy) candSell = token;
        }
      } else if ((!candBuy || !candSell) && tokenScores.size === 1) {
        // Asymmetric scan: check if remaining records contain an alternating direction token
        for (const r of records) {
          const raw = (r.cells[c] ?? "").trim();
          if (raw && !tokenScores.has(raw) && !/^\d+$/.test(raw)) {
            if (!candBuy) candBuy = raw;
            else if (!candSell) candSell = raw;
            break;
          }
        }
      }

      let correctMatches = 0;
      for (const r of candidateRows) {
        const ep = parseNumericCell(r.cells[entryPriceCol] ?? "");
        const xp = parseNumericCell(r.cells[exitPriceCol] ?? "");
        const pnl = parseNumericCell(r.cells[pnlCol] ?? "");
        if (
          !Number.isFinite(ep) ||
          ep <= 0 ||
          !Number.isFinite(xp) ||
          xp <= 0 ||
          !Number.isFinite(pnl) ||
          pnl === 0
        ) {
          continue;
        }
        const delta = xp - ep;
        if (Math.abs(delta) < ep * 1e-6) continue;
        const prod = delta * pnl;
        const rawToken = (r.cells[c] ?? "").trim();
        if (rawToken === candBuy && prod > 0) correctMatches++;
        else if (rawToken === candSell && prod < 0) correctMatches++;
      }

      const purity = correctMatches / tradeCount;
      const scoreWeight = (candBuy ? 1 : 0) + (candSell ? 1 : 0);
      if (purity >= 0.7 && purity * scoreWeight > bestDirPurity) {
        bestDirPurity = purity * scoreWeight;
        directionCol = c;
        buyToken = candBuy;
        sellToken = candSell;
      }
    }
  }

  // 10. Symbol: remaining non-numeric column (usually between entryTimeCol and entryPriceCol)
  let symbolCol = -1;
  for (let c = 0; c < colCount; c++) {
    if (
      c === entryTimeCol ||
      c === exitTimeCol ||
      c === tradeIdCol ||
      c === directionCol ||
      c === entryPriceCol ||
      c === exitPriceCol ||
      c === pnlCol ||
      c === quantityCol ||
      c === stopPriceCol ||
      c === feesCol ||
      c === swapCol
    ) {
      continue;
    }
    const nonEmptyVals = candidateRows
      .map((r) => (r.cells[c] ?? "").trim())
      .filter((v) => v !== "");
    if (nonEmptyVals.length >= Math.max(1, candidateRows.length * 0.4)) {
      const nonNumericCount = nonEmptyVals.filter(
        (v) => !Number.isFinite(parseNumericCell(v)),
      ).length;
      if (nonNumericCount >= nonEmptyVals.length * 0.7) {
        symbolCol = c;
        break;
      }
    }
  }

  const mapping: ColumnMapping = {
    entryTime: entryTimeCol,
    exitTime: exitTimeCol,
    entryPrice: entryPriceCol,
    exitPrice: exitPriceCol,
    pnl: pnlCol,
  };
  if (tradeIdCol !== -1) mapping.tradeId = tradeIdCol;
  if (directionCol !== -1) mapping.direction = directionCol;
  if (quantityCol !== -1) mapping.quantity = quantityCol;
  if (symbolCol !== -1) mapping.symbol = symbolCol;
  if (stopPriceCol !== -1) mapping.stopPrice = stopPriceCol;
  if (feesCol !== -1) mapping.fees = feesCol;
  if (swapCol !== -1) mapping.swap = swapCol;

  return {
    mapping,
    directionTokens:
      buyToken || sellToken
        ? {
            buy: buyToken,
            sell: sellToken,
          }
        : undefined,
    confidence: "exact",
  };
}
