export interface ChaosOptions {
  /**
   * Multiplier for data rows. E.g., duplicateCount = 3 produces 3x copies of each data line.
   * Defaults to 1 (single copy). Set to 0 for header-only output.
   */
  duplicateCount?: number;
  /**
   * If true, shuffles data lines in random order (leaving the header untouched at line 0).
   */
  shuffle?: boolean;
  /**
   * If true, prepends the UTF-8 Byte Order Mark (\uFEFF) to the CSV string.
   */
  injectBOM?: boolean;
  /**
   * If true, forces CRLF (\r\n) line endings. If false, forces LF (\n).
   * If undefined, preserves the delimiter style found in rawCsv.
   */
  crlf?: boolean;
  /**
   * Corrupted, malformed, or rejected rows to append into the data set.
   */
  corruptedRows?: string[];
  /**
   * Optional pseudo-random seed for deterministic shuffling.
   */
  seed?: number;
}

/**
 * Deterministic Fisher-Yates shuffle with optional seed.
 */
function shuffleArray<T>(items: T[], seed?: number): T[] {
  const result = [...items];
  let s = seed !== undefined ? seed : 0;
  const nextRandom = (): number => {
    if (seed === undefined) {
      return Math.random();
    }
    // Mulberry32 32-bit PRNG
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

/**
 * Applies chaos transformations (duplication, shuffling, encoding changes, and corruption injection)
 * to a raw CSV export while preserving table structure.
 */
export function applyChaos(rawCsv: string, options: ChaosOptions = {}): string {
  const cleanContent = rawCsv.replace(/^\uFEFF/, "");
  const lines = cleanContent.split(/\r?\n/);
  const header = lines[0] ?? "";
  const dataLines = lines.slice(1).filter((l) => l.trim().length > 0);

  const duplicateCount = options.duplicateCount !== undefined ? options.duplicateCount : 1;
  let rows: string[] = [];
  for (let i = 0; i < duplicateCount; i++) {
    rows.push(...dataLines);
  }

  if (options.corruptedRows && options.corruptedRows.length > 0) {
    rows.push(...options.corruptedRows);
  }

  if (options.shuffle) {
    rows = shuffleArray(rows, options.seed);
  }

  const lineEnding =
    options.crlf === true
      ? "\r\n"
      : options.crlf === false
        ? "\n"
        : rawCsv.includes("\r\n")
          ? "\r\n"
          : "\n";

  let result = header ? [header, ...rows].join(lineEnding) : rows.join(lineEnding);

  if (options.injectBOM) {
    result = `\uFEFF${result}`;
  }

  return result;
}

/**
 * Splits a CSV file with a header into `batchCount` distinct CSV strings, each retaining
 * the original header followed by a partition of the data lines.
 */
export function splitIntoBatches(rawCsv: string, batchCount: number): string[] {
  if (batchCount <= 1) {
    return [rawCsv];
  }

  const cleanContent = rawCsv.replace(/^\uFEFF/, "");
  const lines = cleanContent.split(/\r?\n/);
  const header = lines[0] ?? "";
  const dataLines = lines.slice(1).filter((l) => l.trim().length > 0);

  const lineEnding = rawCsv.includes("\r\n") ? "\r\n" : "\n";

  if (dataLines.length === 0) {
    return Array.from({ length: batchCount }, () => header);
  }

  const batches: string[] = [];
  const baseSize = Math.floor(dataLines.length / batchCount);
  const remainder = dataLines.length % batchCount;

  let start = 0;
  for (let i = 0; i < batchCount; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    const slice = dataLines.slice(start, start + size);
    start += size;
    batches.push([header, ...slice].join(lineEnding));
  }

  return batches;
}
