import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs, { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { join, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import type { ImportedExecution } from "@luxalgo/journal-importers";
import { parseAuto } from "@luxalgo/journal-importers";

// ============================================================================
// SANDBOX LIFECYCLE (Single isolated temporary database)
// ============================================================================

const originalDir = process.env.JOURNAL_DATA_DIR;
const scratch = mkdtempSync(join(tmpdir(), "journal-database-battery-"));
const realDbPath = path.resolve(__dirname, "../data/journal.db");
const sandboxDbPath = path.join(scratch, "journal.db");
const hasRealDb = existsSync(realDbPath);
if (hasRealDb) {
  copyFileSync(realDbPath, sandboxDbPath);
}

process.env.JOURNAL_DATA_DIR = scratch;
vi.stubEnv("JOURNAL_PASSWORD", "");
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

const { db, accounts, executions, trades, journalDays, importSources } = await import("../src/db");
const { insertExecutions, partitionExecutions } = await import("../src/server/executions");
const { rebuildAccount } = await import("../src/server/rebuild");
const { reconcileImport } = await import("../src/server/import-reconciliation");
const { validateCreateAccount } = await import("../src/server/validation/accounts-schema");
const { decodeImportFile } = await import("../src/lib/decode-import");
const { POST: importPost } = await import("../src/app/api/import/route");
const { POST: accountsPost, GET: accountsGet } = await import("../src/app/api/accounts/route");
const { PATCH: accountsPatch } = await import("../src/app/api/accounts/[id]/route");
const { POST: executionsPost } = await import("../src/app/api/executions/route");
const { GET: getTrade } = await import("../src/app/api/trades/[key]/route");

function resetToRealDbClone() {
  try {
    db.$client.exec("DETACH DATABASE realDb;");
  } catch {}
  if (!hasRealDb) return;
  db.$client.exec(`
    DELETE FROM trades;
    DELETE FROM executions;
    DELETE FROM journal_days;
    DELETE FROM import_sources;
    DELETE FROM accounts;
    ATTACH DATABASE '${realDbPath}' AS realDb;
    INSERT INTO accounts SELECT * FROM realDb.accounts;
    INSERT INTO executions SELECT * FROM realDb.executions;
    INSERT INTO trades SELECT * FROM realDb.trades;
    INSERT INTO journal_days SELECT * FROM realDb.journal_days;
    INSERT INTO import_sources SELECT * FROM realDb.import_sources;
    DETACH DATABASE realDb;
  `);
}

function resetToEmptyDb() {
  db.$client.exec(`
    DELETE FROM trades;
    DELETE FROM executions;
    DELETE FROM journal_days;
    DELETE FROM import_sources;
    DELETE FROM accounts;
  `);
}

afterAll(() => {
  db.$client.close();
  vi.unstubAllEnvs();
  if (originalDir === undefined) delete process.env.JOURNAL_DATA_DIR;
  else process.env.JOURNAL_DATA_DIR = originalDir;
  rmSync(scratch, { recursive: true, force: true });
});

// ============================================================================
// 1. DATABASE STRESS & INGESTION BATTERY (9 SCENARIOS)
// ============================================================================

describe("Database Stress & Ingestion Battery (9 Scenarios)", () => {
  beforeAll(() => {
    resetToRealDbClone();
  });

  it("executes the full 9-stage database integrity battery including overlapping date windows", async () => {
    console.log(`\n======================================================`);
    console.log(`🚀 INICIANDO BATERIA DE ESTRESSE DO BANCO DE DADOS`);
    console.log(`   Sandbox: ${sandboxDbPath}`);
    console.log(`======================================================\n`);

    // -------------------------------------------------------------
    // CENÁRIO 1: UPLOAD LIMPO (Fresh Ingestion)
    // -------------------------------------------------------------
    console.log(`👉 [CENÁRIO 1] Testando Upload Limpo em Nova Conta...`);
    const acc1Id = "battery-acc-fresh";
    db.insert(accounts)
      .values({
        id: acc1Id,
        name: "TradeZero Fresh Account",
        broker: "tradezero",
        platform: "tradezero",
        kind: "import",
        createdAt: "2026-09-25T14:00:00.000Z",
      })
      .run();

    const tradezeroFixture = path.resolve(
      __dirname,
      "../../../packages/importers/tests/fixtures/tradezella/tradezero-tradezero.csv",
    );
    const tradezeroContent = fs.readFileSync(tradezeroFixture, "utf8");

    const res1 = await importPost(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          content: tradezeroContent,
          accountId: acc1Id,
          timeZone: "America/New_York",
          fileName: "tradezero_fresh.csv",
        }),
      }),
    );
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.inserted).toBe(6);
    expect(json1.duplicates).toBe(0);

    const execs1 = db.select().from(executions).where(eq(executions.accountId, acc1Id)).all();
    const trades1 = db.select().from(trades).where(eq(trades.accountId, acc1Id)).all();
    const source1 = db
      .select()
      .from(importSources)
      .where(eq(importSources.accountId, acc1Id))
      .get();

    expect(execs1.length).toBe(6);
    expect(trades1.length).toBe(1);
    expect(trades1[0]!.symbol).toBe("TIVC");
    expect(trades1[0]!.netPnl).toBeCloseTo(-7895.03, 2);
    expect(source1).toBeDefined();
    expect(source1!.format).toBe("tradezero");
    console.log(
      `   ✅ Sucesso: 6 execuções inseridas, 1 trade fechado (-$7.895,03), import_source registrado.`,
    );

    // -------------------------------------------------------------
    // CENÁRIO 2: RE-UPLOAD IDÊNTICO (Idempotência Absoluta)
    // -------------------------------------------------------------
    console.log(`\n👉 [CENÁRIO 2] Testando Re-upload Idêntico (Idempotência)...`);
    const res2 = await importPost(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          content: tradezeroContent,
          accountId: acc1Id,
          timeZone: "America/New_York",
          fileName: "tradezero_fresh.csv",
        }),
      }),
    );
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.inserted).toBe(0);
    expect(json2.duplicates).toBe(6);

    const execs2 = db.select().from(executions).where(eq(executions.accountId, acc1Id)).all();
    const trades2 = db.select().from(trades).where(eq(trades.accountId, acc1Id)).all();
    expect(execs2.length).toBe(6);
    expect(trades2.length).toBe(1);
    console.log(
      `   ✅ Sucesso: 0 inseridos, 6 duplicados detectados. Contagens de banco 100% idênticas.`,
    );

    // -------------------------------------------------------------
    // CENÁRIO 3: RE-UPLOAD DESORDENADO / INVERTIDO (Order Invariance)
    // -------------------------------------------------------------
    console.log(`\n👉 [CENÁRIO 3] Testando Re-upload Invertido (Ordem Cronológica Inversa)...`);
    const [tzHeader, ...tzRows] = tradezeroContent.trim().split(/\r?\n/);
    const reversedContent = [tzHeader, ...tzRows.toReversed()].join("\n");

    const res3 = await importPost(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          content: reversedContent,
          accountId: acc1Id,
          timeZone: "America/New_York",
          fileName: "tradezero_reversed.csv",
        }),
      }),
    );
    expect(res3.status).toBe(200);
    const json3 = await res3.json();
    expect(json3.inserted).toBe(0);
    expect(json3.duplicates).toBe(6);

    const execs3 = db.select().from(executions).where(eq(executions.accountId, acc1Id)).all();
    expect(execs3.length).toBe(6);
    console.log(
      `   ✅ Sucesso: Linhas invertidas identificadas por hash/id nativo; 0 duplicatas criadas.`,
    );

    // -------------------------------------------------------------
    // CENÁRIO 4: SOBREVIVÊNCIA DE ANOTAÇÕES MANUAIS (Annotation Safety)
    // -------------------------------------------------------------
    console.log(`\n👉 [CENÁRIO 4] Testando Sobrevivência de Anotações e Notas Pós-Rebuild...`);
    const tivcTrade = trades2[0]!;
    db.update(trades)
      .set({
        notes: "Trade de short agressivo no pullback. Respeitou VWAP perfeitamente.",
        rating: 5,
        playbookId: "momentum-breakdown",
      })
      .where(eq(trades.key, tivcTrade.key))
      .run();

    rebuildAccount(acc1Id);

    const tradeAfterRebuild = db.select().from(trades).where(eq(trades.key, tivcTrade.key)).get()!;
    expect(tradeAfterRebuild.notes).toBe(
      "Trade de short agressivo no pullback. Respeitou VWAP perfeitamente.",
    );
    expect(tradeAfterRebuild.rating).toBe(5);
    expect(tradeAfterRebuild.playbookId).toBe("momentum-breakdown");
    expect(tradeAfterRebuild.netPnl).toBeCloseTo(-7895.03, 2);
    console.log(
      `   ✅ Sucesso: Anotação, rating e playbook sobreviveram ao rebuild matemático intactos.`,
    );

    // -------------------------------------------------------------
    // CENÁRIO 5: JANELAS SOBREPOSTAS (Jan-Apr ➔ Mar-May)
    // -------------------------------------------------------------
    console.log(`\n👉 [CENÁRIO 5] Testando Janelas Sobrepostas (Jan-Abril ➔ Março-Maio)...`);
    const accOverlapId = "battery-acc-overlap";
    db.insert(accounts)
      .values({
        id: accOverlapId,
        name: "Overlapping Windows Test Account",
        broker: "generic",
        platform: "generic",
        kind: "import",
        createdAt: "2026-09-25T14:00:00.000Z",
      })
      .run();

    const csvHeader = "Sym,Time,Bot/Sld,Price,Quantity,Commision,P&L,Amount";
    const tJanBuy = "AAPL,2026-01-10 10:00:00,Bot,150.00,100,1.00,0,15000";
    const tJanSell = "AAPL,2026-01-10 10:30:00,Sld,155.00,100,1.00,500,15500";

    const tFebBuy = "MSFT,2026-02-14 11:00:00,Bot,400.00,50,1.00,0,20000";
    const tFebSell = "MSFT,2026-02-14 11:45:00,Sld,410.00,50,1.00,500,20500";

    const tMarBuy = "TSLA,2026-03-20 09:35:00,Bot,200.00,200,1.00,0,40000";
    const tMarSell = "TSLA,2026-03-20 10:00:00,Sld,205.00,200,1.00,1000,41000";

    const tAprBuy = "NVDA,2026-04-15 14:00:00,Bot,800.00,100,1.00,0,80000";
    const tAprSell = "NVDA,2026-04-15 14:20:00,Sld,820.00,100,1.00,2000,82000";

    const tMayBuy = "AMZN,2026-05-18 10:00:00,Bot,180.00,150,1.00,0,27000";
    const tMaySell = "AMZN,2026-05-18 11:00:00,Sld,185.00,150,1.00,750,27750";

    const file1_JanToApr = [
      csvHeader,
      tJanBuy,
      tJanSell,
      tFebBuy,
      tFebSell,
      tMarBuy,
      tMarSell,
      tAprBuy,
      tAprSell,
    ].join("\n");
    const file2_MarToMay = [
      csvHeader,
      tMarBuy,
      tMarSell,
      tAprBuy,
      tAprSell,
      tMayBuy,
      tMaySell,
    ].join("\n");

    const resOverlap1 = await importPost(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          content: file1_JanToApr,
          accountId: accOverlapId,
          timeZone: "UTC",
          fileName: "statement_jan_to_apr.csv",
        }),
      }),
    );
    expect(resOverlap1.status).toBe(200);
    const jsonOverlap1 = await resOverlap1.json();
    expect(jsonOverlap1.inserted).toBe(8);
    expect(jsonOverlap1.duplicates).toBe(0);

    const tradesStage1 = db.select().from(trades).where(eq(trades.accountId, accOverlapId)).all();
    expect(tradesStage1.length).toBe(4);
    console.log(`   [Etapa 1] Arquivo 1 (Jan-Abril): 8 execuções inseridas, 4 trades criados.`);

    const tslaTrade = tradesStage1.find((t) => t.symbol === "TSLA")!;
    expect(tslaTrade).toBeDefined();
    db.update(trades)
      .set({ notes: "TSLA quebrou a resistência de Março. Nota essencial!", rating: 4 })
      .where(eq(trades.key, tslaTrade.key))
      .run();

    const resOverlap2 = await importPost(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          content: file2_MarToMay,
          accountId: accOverlapId,
          timeZone: "UTC",
          fileName: "statement_mar_to_may.csv",
        }),
      }),
    );
    expect(resOverlap2.status).toBe(200);
    const jsonOverlap2 = await resOverlap2.json();

    expect(jsonOverlap2.inserted).toBe(2);
    expect(jsonOverlap2.duplicates).toBe(4);

    const execsOverlapFinal = db
      .select()
      .from(executions)
      .where(eq(executions.accountId, accOverlapId))
      .all();
    const tradesOverlapFinal = db
      .select()
      .from(trades)
      .where(eq(trades.accountId, accOverlapId))
      .all();

    expect(execsOverlapFinal.length).toBe(10);
    expect(tradesOverlapFinal.length).toBe(5);

    const tslaAfterOverlap = db.select().from(trades).where(eq(trades.key, tslaTrade.key)).get()!;
    expect(tslaAfterOverlap.notes).toBe("TSLA quebrou a resistência de Março. Nota essencial!");
    expect(tslaAfterOverlap.rating).toBe(4);

    console.log(
      `   ✅ Sucesso no Overlap: 4 duplicatas detectadas, 2 inseridas, 5 trades no total.`,
    );

    // -------------------------------------------------------------
    // CENÁRIO 6: ISOLAMENTO ESTREITO DA CONTA REAL FTMO (Zero Leakage)
    // -------------------------------------------------------------
    console.log(
      `\n👉 [CENÁRIO 6] Verificando se a Conta Real FTMO ("Eval") Sofreu Qualquer Impacto...`,
    );
    const ftmoAccount = db.select().from(accounts).where(eq(accounts.id, "4U2rW1FjaU17")).get()!;
    const ftmoExecs = db
      .select()
      .from(executions)
      .where(eq(executions.accountId, ftmoAccount.id))
      .all();
    const ftmoTrades = db.select().from(trades).where(eq(trades.accountId, ftmoAccount.id)).all();

    expect(ftmoExecs.length).toBe(308);
    expect(ftmoTrades.length).toBe(154);
    console.log(
      `   ✅ Sucesso: Conta FTMO permaneceu com exatamente 308 execuções e 154 trades (isolamento total).`,
    );

    // -------------------------------------------------------------
    // CENÁRIO 7: IMUTABILIDADE DOS DIÁRIOS REFLEXIVOS (journal_days)
    // -------------------------------------------------------------
    console.log(`\n👉 [CENÁRIO 7] Verificando Imutabilidade dos Diários Reflexivos...`);
    const days = db.select().from(journalDays).all();
    expect(days.length).toBe(6);
    const dayFomc = days.find((d) => d.date === "2026-09-16")!;
    expect(dayFomc).toBeDefined();
    expect(dayFomc.note).toContain("Dia de Fomc");
    console.log(
      `   ✅ Sucesso: 6 registros de journal_days intactos com todos os textos pré-market.`,
    );

    // -------------------------------------------------------------
    // CENÁRIO 8: INTERCEPÇÃO DE CONFLITO DE CONTA (Account Mismatch Guard)
    // -------------------------------------------------------------
    console.log(`\n👉 [CENÁRIO 8] Testando Bloqueio contra Conflito Acidental de Conta...`);
    const tradestationFixture = path.resolve(
      __dirname,
      "../../../packages/importers/tests/fixtures/tradezella/tradestation-tradestation.csv",
    );
    const tradestationContent = fs.readFileSync(tradestationFixture, "utf8");

    db.update(accounts).set({ accountNumber: "99999999" }).where(eq(accounts.id, acc1Id)).run();

    const resMismatch = await importPost(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          content: tradestationContent,
          accountId: acc1Id,
          timeZone: "UTC",
        }),
      }),
    );
    expect(resMismatch.status).toBe(400);
    const jsonMismatch = await resMismatch.json();
    expect(jsonMismatch.error).toContain("Account mismatch");
    console.log(
      `   ✅ Sucesso: Bloqueio ativado com sucesso! Erro retornado: "${jsonMismatch.error}"`,
    );

    // -------------------------------------------------------------
    // CENÁRIO 9: POSIÇÃO ABERTA NO ARQUIVO 1 E FECHADA NO ARQUIVO 2
    // -------------------------------------------------------------
    console.log(
      `\n👉 [CENÁRIO 9] Testando Posição Aberta em Arquivo A e Fechada em Arquivo B (Cross-File FIFO)...`,
    );
    const accCrossId = "battery-acc-cross-fifo";
    db.insert(accounts)
      .values({
        id: accCrossId,
        name: "Cross-File FIFO Account",
        broker: "generic",
        platform: "generic",
        kind: "import",
        createdAt: "2026-09-25T14:00:00.000Z",
      })
      .run();

    const fileMon = [csvHeader, "QQQ,2026-06-01 10:00:00,Bot,450.00,100,1.00,0,45000"].join("\n");
    const fileFri = [csvHeader, "QQQ,2026-06-05 15:30:00,Sld,455.00,100,1.00,500,45500"].join("\n");

    await importPost(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          content: fileMon,
          accountId: accCrossId,
          timeZone: "UTC",
        }),
      }),
    );
    const tradesMon = db.select().from(trades).where(eq(trades.accountId, accCrossId)).all();
    expect(tradesMon.length).toBe(1);
    expect(tradesMon[0]!.status).toBe("open");
    expect(tradesMon[0]!.openQuantity).toBe(100);

    await importPost(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          content: fileFri,
          accountId: accCrossId,
          timeZone: "UTC",
        }),
      }),
    );
    const tradesFri = db.select().from(trades).where(eq(trades.accountId, accCrossId)).all();
    expect(tradesFri.length).toBe(1);
    expect(tradesFri[0]!.status).toBe("win");
    expect(tradesFri[0]!.openQuantity).toBe(0);
    expect(tradesFri[0]!.grossPnl).toBe(500);
    expect(tradesFri[0]!.netPnl).toBe(498);
    console.log(
      `   ✅ Sucesso: O arquivo da Sexta casou com o da Segunda; posição fechada com Net P&L = +$498,00.`,
    );
  });
});

// ============================================================================
// 2. REAL DATABASE CLONE & FTMO JOURNAL SAFETY AUDIT
// ============================================================================

describe("Real Database Clone & FTMO Journal Safety Audit", () => {
  beforeEach(() => {
    resetToRealDbClone();
  });

  it("proves that importing into the database preserves 100% of journal notes and existing trades", async () => {
    const account = db.select().from(accounts).where(eq(accounts.id, "4U2rW1FjaU17")).get();
    expect(account).toBeDefined();
    expect(account!.broker).toBe("ftmo");
    expect(account!.accountNumber).toBe("530319802");

    const initialDays = db.select().from(journalDays).all();
    expect(initialDays.length).toBeGreaterThan(0);

    const initialExecs = db
      .select()
      .from(executions)
      .where(eq(executions.accountId, account!.id))
      .all();
    const initialTrades = db.select().from(trades).where(eq(trades.accountId, account!.id)).all();
    expect(initialExecs.length).toBe(308);
    expect(initialTrades.length).toBe(154);

    const testTradeKey = initialTrades[0]!.key;
    db.update(trades)
      .set({ notes: "MINHA_ANOTACAO_DE_OURO_FTMO", rating: 5, playbookId: "fvg-reversal" })
      .where(eq(trades.key, testTradeKey))
      .run();

    const ftmoFile = "/home/jhontavares/Documents/ReportHistory-530319802 - MT5.html";
    if (existsSync(ftmoFile)) {
      const ftmoBuffer = fs.readFileSync(ftmoFile);
      const ftmoContent =
        ftmoBuffer[0] === 0xff && ftmoBuffer[1] === 0xfe
          ? ftmoBuffer.toString("utf16le")
          : ftmoBuffer.toString("utf8");

      const previewRes = await importPost(
        new Request("http://localhost/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "preview",
            content: ftmoContent,
            accountId: account!.id,
            timeZone: account!.timeZone || "Europe/Helsinki",
          }),
        }),
      );
      expect(previewRes.status).toBe(200);
      const previewJson = await previewRes.json();
      expect(previewJson.detected).toMatch(/metatrader/);
      expect(previewJson.detectedAccount).toBe("530319802");
      expect(previewJson.accountConflict).toBeUndefined();

      const commitRes = await importPost(
        new Request("http://localhost/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "commit",
            content: ftmoContent,
            accountId: account!.id,
            timeZone: account!.timeZone || "Europe/Helsinki",
          }),
        }),
      );
      expect(commitRes.status).toBe(200);
      const commitJson = await commitRes.json();
      expect(commitJson.inserted).toBe(0);
      expect(commitJson.duplicates).toBe(306);
    }

    const afterExecs = db
      .select()
      .from(executions)
      .where(eq(executions.accountId, account!.id))
      .all();
    const afterTrades = db.select().from(trades).where(eq(trades.accountId, account!.id)).all();
    const afterDays = db.select().from(journalDays).all();

    expect(afterExecs.length).toBe(308);
    expect(afterTrades.length).toBe(154);
    expect(afterDays.length).toBe(initialDays.length);

    for (const day of initialDays) {
      const current = afterDays.find((d) => d.date === day.date);
      expect(current).toBeDefined();
      expect(current!.note).toBe(day.note);
      expect(current!.updatedAt).toBe(day.updatedAt);
    }

    const annotatedTradeAfter = db.select().from(trades).where(eq(trades.key, testTradeKey)).get();
    expect(annotatedTradeAfter!.notes).toBe("MINHA_ANOTACAO_DE_OURO_FTMO");
    expect(annotatedTradeAfter!.rating).toBe(5);
    expect(annotatedTradeAfter!.playbookId).toBe("fvg-reversal");
  });

  it("proves that importing other brokers into separate accounts has zero impact on FTMO data", async () => {
    const ftmoAccount = db.select().from(accounts).where(eq(accounts.id, "4U2rW1FjaU17")).get()!;
    const ftmoExecsInitial = db
      .select()
      .from(executions)
      .where(eq(executions.accountId, ftmoAccount.id))
      .all();
    const ftmoTradesInitial = db
      .select()
      .from(trades)
      .where(eq(trades.accountId, ftmoAccount.id))
      .all();
    const journalDaysInitial = db.select().from(journalDays).all();

    const newAccountId = "topstep-account-test";
    db.insert(accounts)
      .values({
        id: newAccountId,
        name: "Topstep 50k",
        broker: "topstep",
        platform: "topstepx",
        kind: "import",
        createdAt: "2026-09-25T12:00:00.000Z",
      })
      .run();

    const topstepFile = path.resolve(
      __dirname,
      "../../../packages/importers/tests/fixtures/tradezella/topstepx-topstepx.csv",
    );
    const topstepContent = fs.readFileSync(topstepFile, "utf8");

    const commitRes = await importPost(
      new Request("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          content: topstepContent,
          accountId: newAccountId,
          timeZone: "UTC",
        }),
      }),
    );
    expect(commitRes.status).toBe(200);
    const commitJson = await commitRes.json();
    expect(commitJson.inserted).toBe(76);

    const topstepExecs = db
      .select()
      .from(executions)
      .where(eq(executions.accountId, newAccountId))
      .all();
    const topstepTrades = db.select().from(trades).where(eq(trades.accountId, newAccountId)).all();
    expect(topstepExecs.length).toBe(76);
    expect(topstepTrades.length).toBe(38);

    const ftmoExecsAfter = db
      .select()
      .from(executions)
      .where(eq(executions.accountId, ftmoAccount.id))
      .all();
    const ftmoTradesAfter = db
      .select()
      .from(trades)
      .where(eq(trades.accountId, ftmoAccount.id))
      .all();
    expect(ftmoExecsAfter.length).toBe(ftmoExecsInitial.length);
    expect(ftmoTradesAfter.length).toBe(ftmoTradesInitial.length);

    const journalDaysAfter = db.select().from(journalDays).all();
    expect(journalDaysAfter.length).toBe(journalDaysInitial.length);
    for (let i = 0; i < journalDaysInitial.length; i++) {
      expect(journalDaysAfter[i]!.note).toBe(journalDaysInitial[i]!.note);
    }
  });
});

// ============================================================================
// 3. IMPORT RECONCILIATION
// ============================================================================

describe("Import Reconciliation", () => {
  beforeAll(() => {
    resetToRealDbClone();
  });

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

// ============================================================================
// 4. TRADOVATE END-TO-END IMPORT & IDEMPOTENCY
// ============================================================================

describe("Tradovate End-to-End Import & Idempotency", () => {
  const FALLBACK_TRADOVATE_CSV = `Position ID,Timestamp,Trade Date,Net Pos,Net Price,Bought,Avg. Buy,Sold,Avg. Sell,Account,Contract,Product,Product Description,_priceFormat,_priceFormatType,_tickSize,Pair ID,Buy Fill ID,Sell Fill ID,Paired Qty,Buy Price,Sell Price,P/L,Currency,Bought Timestamp,Sold Timestamp
419496653330,08/04/2026 10:20:44,2026-08-04,0,,1,29219.25,1,29248.50,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653348,419496653327,419496653346,1,29219.25,29248.50,58.50,USD,08/04/2026 10:05:09,08/04/2026 10:20:44
419496653354,08/05/2026 11:54:39,2026-08-05,0,,2,29856.88,2,29818.75,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653373,419496653371,419496653362,1,29899.75,29843.50,-112.50,USD,08/05/2026 11:49:40,08/05/2026 11:38:15
419496653354,08/05/2026 11:54:39,2026-08-05,0,,2,29856.88,2,29818.75,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653402,419496653400,419496653382,1,29814.00,29794.00,-40.00,USD,08/05/2026 11:54:39,08/05/2026 11:53:50
419496653419,08/10/2026 11:25:22,2026-08-10,0,,2,29911.00,2,29880.63,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653426,419496653416,419496653424,1,29958.00,29955.75,-4.50,USD,08/10/2026 07:04:14,08/10/2026 07:04:29
419496653419,08/10/2026 11:25:22,2026-08-10,0,,2,29911.00,2,29880.63,LFE0506847043001,MNQU6,MNQ,Micro E-mini NASDAQ-100,-2,0,0.25,419496653458,419496653437,419496653456,1,29864.00,29805.50,-117.00,USD,08/10/2026 11:18:21,08/10/2026 11:25:22`;
  const csvPath = resolve(
    "/home/jhontavares/.gemini/antigravity/brain/5e6dccf2-6295-4471-ae0f-9fff493c7d25/.user_uploaded/media_1790274711905.csv",
  );
  const csvContent = existsSync(csvPath) ? readFileSync(csvPath, "utf-8") : FALLBACK_TRADOVATE_CSV;

  it("previews the real Tradovate statement and detects the statement account number", async () => {
    if (!csvContent) return;

    const previewReq = new NextRequest("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "preview",
        content: csvContent,
        fileName: "tradovate_export.csv",
        timeZone: "America/Chicago",
      }),
    });

    const previewRes = await importPost(previewReq);
    expect(previewRes.status).toBe(200);
    const data = await previewRes.json();

    expect(data.detected).toBe("tradovate");
    expect(data.detectedAccount).toBe("LFE0506847043001");
    expect(data.sourceAccounts).toContain("LFE0506847043001");
    expect(data.totals?.executions).toBe(28);
  });

  it("commits trades into account, auto-binds accountNumber and platform, and guarantees 100% idempotency", async () => {
    if (!csvContent) return;
    const testAccountId = `acc_test_tradovate_${Date.now()}`;

    await db.insert(accounts).values({
      id: testAccountId,
      name: "Lucid 50k Combine",
      broker: "lucid",
      kind: "manual",
      currency: "USD",
      initialBalance: 50000,
      createdAt: new Date().toISOString(),
    });

    const commitReq = new NextRequest("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "commit",
        content: csvContent,
        accountId: testAccountId,
        fileName: "tradovate_export.csv",
        timeZone: "America/Chicago",
      }),
    });

    const commitRes = await importPost(commitReq);
    expect(commitRes.status).toBe(200);
    const commitData = await commitRes.json();

    expect(commitData.inserted).toBe(28);
    expect(commitData.duplicates).toBe(0);

    const updatedAccount = await db.query.accounts.findFirst({
      where: eq(accounts.id, testAccountId),
    });
    expect(updatedAccount?.accountNumber).toBe("LFE0506847043001");
    expect(updatedAccount?.platform).toBe("tradovate");

    const repeatReq = new NextRequest("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "commit",
        content: csvContent,
        accountId: testAccountId,
        fileName: "tradovate_export.csv",
        timeZone: "America/Chicago",
      }),
    });

    const repeatRes = await importPost(repeatReq);
    expect(repeatRes.status).toBe(200);
    const repeatData = await repeatRes.json();

    expect(repeatData.inserted).toBe(0);
    expect(repeatData.duplicates).toBe(28);

    await db.delete(trades).where(eq(trades.accountId, testAccountId));
    await db.delete(executions).where(eq(executions.accountId, testAccountId));
    await db.delete(accounts).where(eq(accounts.id, testAccountId));
  });
});

// ============================================================================
// 5. IMPORT ACCOUNT MANAGEMENT & VALIDATION
// ============================================================================

describe("Import Account Management & Validation", () => {
  beforeEach(() => {
    resetToEmptyDb();
  });

  it("creates an import destination with the chosen currency/balance and accepts fills under its returned id", async () => {
    const response = await accountsPost(
      new Request("http://localhost/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Import verification",
          kind: "import",
          currency: "USD",
          initialBalance: 50000,
        }),
      }),
    );
    expect(response.status).toBe(200);
    const { id } = await response.json();
    const listed = await (await accountsGet(new Request("http://localhost/api/accounts"))).json();
    expect(listed.accounts).toMatchObject([
      { id, name: "Import verification", kind: "import", currency: "USD", initialBalance: 50000 },
    ]);
    insertExecutions(
      id,
      [
        {
          symbol: "TEST",
          side: "buy",
          quantity: 10,
          price: 100,
          fee: 0.35,
          executedAt: "2026-01-02T14:30:00Z",
          assetClass: "equity",
        },
        {
          symbol: "TEST",
          side: "sell",
          quantity: 10,
          price: 101,
          fee: 0.35,
          executedAt: "2026-01-02T15:30:00Z",
          assetClass: "equity",
        },
      ],
      "import",
    );
    expect(db.select().from(executions).all()).toHaveLength(2);
    expect(db.select().from(trades).all()).toMatchObject([
      { accountId: id, status: "win", netPnl: 9.3 },
    ]);

    // Insert an open position (unmatched buy)
    insertExecutions(
      id,
      [
        {
          symbol: "OPEN1",
          side: "buy",
          quantity: 5,
          price: 50,
          fee: 0,
          executedAt: "2026-01-03T10:00:00Z",
          assetClass: "equity",
        },
      ],
      "import",
    );

    // GET aggregation must only count closed positions for tradeCount & netPnl
    const updatedListed = await (
      await accountsGet(new Request("http://localhost/api/accounts"))
    ).json();
    const acc = updatedListed.accounts.find((a: any) => a.id === id);
    expect(acc).toBeDefined();
    expect(acc.tradeCount).toBe(1);
    expect(acc.closedTrades).toBe(1);
    expect(acc.winCount).toBe(1);
    expect(acc.winRate).toBe(100);
    expect(acc.netPnl).toBe(9.3);
  });

  it("validates account creation and rejects malformed payloads natively", () => {
    expect(validateCreateAccount({})).toEqual({
      ok: false,
      error: "name and kind are required",
    });
    expect(validateCreateAccount({ name: "   ", kind: "manual" })).toEqual({
      ok: false,
      error: "name and kind are required",
    });
    expect(validateCreateAccount({ name: "Test", kind: "invalid-kind" })).toEqual({
      ok: false,
      error: "Invalid account kind. Must be 'sync', 'import', or 'manual'",
    });
    expect(validateCreateAccount({ name: "Test", kind: "sync" })).toEqual({
      ok: false,
      error: "sync accounts need a broker and credentials",
    });
    expect(
      validateCreateAccount({ name: "Test", kind: "manual", timeZone: "Invalid/Zone" }),
    ).toEqual({
      ok: false,
      error: "Invalid IANA timezone.",
    });
    expect(validateCreateAccount({ name: "Test", kind: "manual", currency: "USDT" })).toEqual({
      ok: false,
      error: "Invalid currency. Must be a 3-letter ISO code.",
    });
    expect(validateCreateAccount({ name: "Test", kind: "manual", initialBalance: -100 })).toEqual({
      ok: false,
      error: "initialBalance must be a finite number greater than or equal to 0",
    });
    expect(validateCreateAccount({ name: "Test", kind: "manual", maxDrawdown: 0 })).toEqual({
      ok: false,
      error: "maxDrawdown must be a positive number or null",
    });

    const valid = validateCreateAccount({
      name: "  My Account  ",
      kind: "manual",
      currency: "eur",
      initialBalance: 10000,
      maxDrawdown: 1500,
      profitCalcMethod: "fifo",
    });
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.data.name).toBe("My Account");
      expect(valid.data.currency).toBe("EUR");
      expect(valid.data.initialBalance).toBe(10000);
      expect(valid.data.maxDrawdown).toBe(1500);
      expect(valid.data.profitCalcMethod).toBe("fifo");
    }
  });

  it("validates and applies PATCH /api/accounts/[id] updates", async () => {
    const createRes = await accountsPost(
      new Request("http://localhost/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Patch target",
          kind: "manual",
          currency: "USD",
          initialBalance: 25000,
        }),
      }),
    );
    const { id } = await createRes.json();

    const badRes = await accountsPatch(
      new Request(`http://localhost/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeZone: "Invalid/Zone" }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(badRes.status).toBe(400);

    const goodRes = await accountsPatch(
      new Request(`http://localhost/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Renamed Account",
          currency: "EUR",
          maxDrawdown: 2000,
          profitCalcMethod: "lifo",
        }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(goodRes.status).toBe(200);

    const updated = db.select().from(accounts).where(eq(accounts.id, id)).get();
    expect(updated?.name).toBe("Renamed Account");
    expect(updated?.currency).toBe("EUR");
    expect(updated?.maxDrawdown).toBe(2000);
    expect(updated?.profitCalcMethod).toBe("lifo");
  });
});

// ============================================================================
// 6. EXECUTION STORAGE & COHERENT JOURNAL
// ============================================================================

describe("Execution Storage & Coherent Journal", () => {
  const rows: ImportedExecution[] = [
    {
      symbol: "TEST",
      side: "buy",
      quantity: 10,
      price: 100,
      fee: 0,
      executedAt: "2026-09-01T10:00:00Z",
    },
    {
      symbol: "TEST",
      side: "sell",
      quantity: 10,
      price: 102,
      fee: 0,
      executedAt: "2026-09-01T11:00:00Z",
    },
  ];

  beforeEach(() => {
    resetToEmptyDb();
    db.insert(accounts)
      .values({ id: "test", name: "Test", kind: "manual", createdAt: "2026-01-01" })
      .run();
  });

  it("rejects missing accounts and invalid fills before inserting data", () => {
    expect(() => insertExecutions("missing", rows, "manual")).toThrow("Account not found");
    for (const invalid of [
      { quantity: Infinity },
      { quantity: 0 },
      { fee: NaN },
      { executedAt: "invalid" },
      { side: "hold" },
      { symbol: " " },
    ]) {
      expect(() =>
        insertExecutions(
          "test",
          [rows[0]!, { ...rows[1]!, ...invalid } as ImportedExecution],
          "manual",
        ),
      ).toThrow();
    }
    expect(db.select().from(executions).all()).toHaveLength(0);
  });

  it("rolls back the fills if calculating their trades fails", () => {
    db.$client.exec(
      "CREATE TRIGGER fail_trade BEFORE INSERT ON trades BEGIN SELECT RAISE(FAIL, 'test storage failure'); END",
    );
    try {
      expect(() => insertExecutions("test", rows, "manual")).toThrow();
      expect(db.select().from(executions).all()).toHaveLength(0);
      expect(db.select().from(trades).all()).toHaveLength(0);
    } finally {
      db.$client.exec("DROP TRIGGER fail_trade");
    }
  });

  it("deduplicates repeated imports while keeping the calculated total", () => {
    expect(insertExecutions("test", rows, "manual")).toMatchObject({ inserted: 2, duplicates: 0 });
    expect(insertExecutions("test", rows, "manual")).toMatchObject({ inserted: 0, duplicates: 2 });
    expect(db.select().from(executions).all()).toHaveLength(2);
    expect(db.select().from(trades).all()[0]?.netPnl).toBe(20);
  });

  it("saves Markdown notes with manual trades and preserves them through a rebuild and retry", async () => {
    const notes = "## Setup\n\nWaited for **confirmation**.\n- Followed the plan.";
    const response = await executionsPost(
      new Request("http://localhost/api/executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: "test", executions: rows, notes }),
      }),
    );
    expect(response.status).toBe(200);
    const trade = db.select().from(trades).get()!;
    const detail = await getTrade(new Request("http://localhost/api/trades/fixture"), {
      params: Promise.resolve({ key: trade.key }),
    });
    expect((await detail.json()).trade.notes).toBe(notes);
    rebuildAccount("test");
    expect(insertExecutions("test", rows, "manual", notes)).toMatchObject({
      inserted: 0,
      duplicates: 2,
    });
    expect(db.select().from(trades).get()?.notes).toBe(notes);
  });

  it("appends exit notes to the correct position without changing unrelated trade notes", () => {
    insertExecutions("test", [rows[0]!], "manual", "Entry plan");
    insertExecutions(
      "test",
      rows.map((row) => ({ ...row, symbol: "OTHER" })),
      "manual",
      "Unrelated note",
    );
    insertExecutions("test", [rows[1]!], "manual", "Exit review");
    const saved = db.select().from(trades).all();
    expect(saved.find((row) => row.symbol === "TEST")).toMatchObject({
      notes: "Entry plan\n\nExit review",
      netPnl: 20,
    });
    expect(saved.find((row) => row.symbol === "OTHER")?.notes).toBe("Unrelated note");
  });

  it("keeps existing notes when a manual exit has no notes", () => {
    insertExecutions("test", [rows[0]!], "manual", "Keep this plan");
    insertExecutions("test", [rows[1]!], "manual", "   ");
    expect(db.select().from(trades).get()?.notes).toBe("Keep this plan");
  });

  it("saves notes for an already-recorded trade without duplicating fills or repeated notes", () => {
    insertExecutions("test", rows, "manual", "Entry plan");
    expect(insertExecutions("test", rows, "manual", "Later review")).toMatchObject({
      inserted: 0,
      duplicates: 2,
    });
    insertExecutions("test", rows, "manual", "Later review");
    expect(db.select().from(executions).all()).toHaveLength(2);
    expect(db.select().from(trades).get()?.notes).toBe("Entry plan\n\nLater review");
  });

  it("attaches a batch note to each trade formed by its new executions", () => {
    insertExecutions(
      "test",
      [
        ...rows,
        ...rows.map((row) => ({ ...row, executedAt: row.executedAt.replace("09-01", "09-02") })),
      ],
      "manual",
      "Session review",
    );
    const saved = db.select().from(trades).all();
    expect(saved).toHaveLength(2);
    expect(saved.every((row) => row.notes === "Session review")).toBe(true);
  });

  it("rejects invalid notes before inserting executions", async () => {
    for (const notes of [null, 42, {}, ["note"], "a".repeat(100001)]) {
      const response = await executionsPost(
        new Request("http://localhost/api/executions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: "test", executions: rows, notes }),
        }),
      );
      expect(response.status).toBe(400);
    }
    expect(db.select().from(executions).all()).toHaveLength(0);
    expect(db.select().from(trades).all()).toHaveLength(0);
  });

  it("rolls back new executions if appending notes exceeds the existing notes limit", () => {
    const existing = "a".repeat(100000);
    insertExecutions("test", [rows[0]!], "manual", existing);
    expect(() => insertExecutions("test", [rows[1]!], "manual", "Exit review")).toThrow(
      "Combined trade notes",
    );
    expect(db.select().from(executions).all()).toHaveLength(1);
    expect(db.select().from(trades).get()).toMatchObject({ notes: existing, status: "open" });
  });
});

// ============================================================================
// 7. SYNC RESILIENCE & ERROR PARTITIONING
// ============================================================================

describe("Sync Resilience & Error Partitioning", () => {
  const good: ImportedExecution = {
    symbol: "ES",
    side: "buy",
    quantity: 1,
    price: 5000,
    fee: 1.2,
    executedAt: "2026-09-01T10:00:00Z",
  };
  const mixed = [
    good,
    { ...good, side: "sell", price: NaN, executedAt: "2026-09-01T11:00:00Z" },
    { ...good, quantity: 0, executedAt: "2026-09-01T12:00:00Z" },
    { ...good, fee: Infinity, executedAt: "2026-09-01T13:00:00Z" },
    { ...good, side: "sell", price: 5010, executedAt: "2026-09-01T14:00:00Z" },
  ] as ImportedExecution[];

  beforeEach(() => {
    resetToEmptyDb();
    db.insert(accounts)
      .values({ id: "broker", name: "Broker", kind: "sync", createdAt: "2026-01-01" })
      .run();
  });

  it("keeps the valid fills from a mixed broker batch and reports how many were skipped", () => {
    const result = insertExecutions("broker", mixed, "sync");
    expect(result.inserted).toBe(2);
    expect(result.duplicates).toBe(0);
    expect(result.skipped).toBe(3);
    expect(result.skippedReasons).toHaveLength(3);
    expect(result.skippedReasons.join(" ")).toMatch(/price/);
    expect(result.skippedReasons.join(" ")).toMatch(/quantity/);
    expect(result.skippedReasons.join(" ")).toMatch(/fee/);
    expect(db.select().from(executions).all()).toHaveLength(2);
  });

  it("skips invalid rows from an imported file instead of rejecting the file", () => {
    const result = insertExecutions("broker", mixed, "import");
    expect(result.inserted).toBe(2);
    expect(result.skipped).toBe(3);
  });

  it("still rejects a manually entered batch when any fill is invalid", () => {
    expect(() => insertExecutions("broker", mixed, "manual")).toThrow();
    expect(db.select().from(executions).all()).toHaveLength(0);
  });

  it("caps the list of skip reasons so a large broken batch stays reportable", () => {
    const broken = Array.from({ length: 20 }, (_, i) => ({
      ...good,
      quantity: -1,
      executedAt: `2026-09-01T10:${String(i).padStart(2, "0")}:00Z`,
    }));
    const { skipped, skippedReasons, usable } = partitionExecutions(broken, "sync");
    expect(skipped).toBe(20);
    expect(usable).toHaveLength(0);
    expect(skippedReasons.length).toBeLessThanOrEqual(5);
  });
});
