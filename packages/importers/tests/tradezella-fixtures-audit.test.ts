import { describe, it } from "vitest";
import fs from "fs";
import path from "path";
import { parseAuto, detectFormat } from "../src/detect";

describe("TradeZella Fixtures Audit", () => {
  const fixturesDir = path.resolve(__dirname, "fixtures/tradezella");
  const files = fs
    .readdirSync(fixturesDir)
    .filter((f) => !fs.statSync(path.join(fixturesDir, f)).isDirectory() && !f.endsWith(".xlsx"))
    .sort();

  it("evaluates all fixtures and logs support status", () => {
    const results: Array<{
      file: string;
      detectedFormat: string | null;
      executions: number;
      account?: string;
      error?: string;
    }> = [];

    for (const file of files) {
      const filePath = path.join(fixturesDir, file);
      const buf = fs.readFileSync(filePath);
      const content = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString("utf16le") : buf.toString("utf8");

      try {
        const fmt = detectFormat(content);
        const parsed = parseAuto(content);
        results.push({
          file,
          detectedFormat: fmt?.id ?? null,
          executions: parsed?.executions.length ?? 0,
          account: parsed?.account,
        });
      } catch (err: any) {
        results.push({
          file,
          detectedFormat: null,
          executions: 0,
          error: err.message,
        });
      }
    }

    console.table(results);
  });
});
