import { describe, expect, it } from "vitest";
import { parseAuto } from "@luxalgo/journal-importers";
import { reconcileImport } from "../src/server/import-reconciliation";
import { decodeImportFile } from "../src/lib/decode-import";
import { readFileSync, existsSync } from "node:fs";


describe("import reconciliation", () => {
  it("reconciles ReportHistory-530319802 - MT5.html against existing Eval account", () => {
    const filePath = "/home/jhontavares/Documents/ReportHistory-530319802 - MT5.html";
    if (!existsSync(filePath)) return;

    const content = readFileSync(filePath, "utf-16le");
    const parsed = parseAuto(content);
    expect(parsed).not.toBeNull();
    expect(parsed!.executions.length).toBe(306);

    const rec = reconcileImport("4U2rW1FjaU17", parsed!.executions);
    expect(rec.accountName).toBe("Eval");
    expect(rec.totalFills).toBe(306);
    expect(rec.existingFills).toBe(306);
    expect(rec.newFills).toBe(0);
    expect(rec.totalTrades).toBe(153);
    expect(rec.existingTrades).toBe(153);
    expect(rec.newTrades).toBe(0);
    expect(rec.isFullyImported).toBe(true);
  });

  it("reconciles ReportHistory-530319802 - MT5.xlsx against existing Eval account", () => {
    const xlsxPath = "/home/jhontavares/Documents/ReportHistory-530319802 - MT5.xlsx";
    if (!existsSync(xlsxPath)) return;

    const buf = readFileSync(xlsxPath);
    const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const csv = decodeImportFile(arrayBuf);
    const parsed = parseAuto(csv);

    expect(parsed).not.toBeNull();

    const rec = reconcileImport("4U2rW1FjaU17", parsed!.executions);
    expect(rec.accountName).toBe("Eval");
    expect(rec.totalFills).toBe(308);
    expect(rec.existingFills).toBe(308);
    expect(rec.newFills).toBe(0);
    expect(rec.totalTrades).toBe(154);
    expect(rec.existingTrades).toBe(154);
    expect(rec.newTrades).toBe(0);
    expect(rec.isFullyImported).toBe(true);
  });
});

