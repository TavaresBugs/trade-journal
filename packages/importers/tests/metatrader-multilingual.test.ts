import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseAuto } from "../src/detect";
import { importTradeHistory } from "../src/history/import";
import { decodeImportFile } from "../../../apps/web/src/lib/decode-import";

const REPORTS_DIR = "/home/jhontavares/Documents/Report MT5";

const TEST_FILES = [
  "ReportHistory-530319802-Arabic.html",
  "ReportHistory-530319802-Bengali.html",
  "ReportHistory-530319802-Bengali.xlsx",
  "ReportHistory-530319802-Bulgarian.html",
  "ReportHistory-530319802-Bulgarian.xlsx",
  "ReportHistory-530319802-PTBR.html",
  "ReportHistory-530319802-PTBR.xlsx",
  "ReportHistory-530319802-PTPT.html",
  "ReportHistory-530319802-PTPT.xlsx",
];

describe("Language-Agnostic Universal MetaTrader 4/5 Parser", () => {
  for (const filename of TEST_FILES) {
    const fullPath = path.join(REPORTS_DIR, filename);

    describe(`File: ${filename}`, () => {
      const fileBuffer = fs.readFileSync(fullPath);
      const text = decodeImportFile(
        fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength),
      );

      it("parses exactly 156 trades via importTradeHistory", () => {
        const history = importTradeHistory(text);

        expect(history.ok).toBe(true);
        expect(history.format.kind).toBe("metatrader");
        expect(history.trades).toHaveLength(156);

        // Verify first trade (ticket 78698762)
        const firstTrade = history.trades[0]!;
        expect(firstTrade.id).toBe("78698762");
        expect(firstTrade.symbol).toBe("US100.cash");
        expect(firstTrade.direction).toBe("long");
        expect(firstTrade.quantity).toBe(0.1);
        expect(firstTrade.entryPrice).toBe(24597.95);
        expect(firstTrade.exitPrice).toBe(24552.65);
        expect(firstTrade.stopPrice).toBe(24552.88);

        // Verify last trade (ticket 190859670)
        const lastTrade = history.trades[155]!;
        expect(lastTrade.id).toBe("190859670");
        expect(lastTrade.symbol).toBe("US100.cash");
        expect(lastTrade.direction).toBe("long");
        expect(lastTrade.quantity).toBe(0.09);
        expect(lastTrade.entryPrice).toBe(30972.18);
        expect(lastTrade.exitPrice).toBe(31047.23);
        expect(lastTrade.stopPrice).toBe(30975.9);
      });

      it("extracts account 530319802 and produces 312 executions via parseAuto", () => {
        const result = parseAuto(text);

        expect(result).not.toBeNull();
        expect(result!.account).toBe("530319802");
        expect(result!.executions).toHaveLength(312); // 156 closed positions * 2 executions (entry + exit)
        expect(result!.format).toMatch(/metatrader/);
      });
    });
  }
});
