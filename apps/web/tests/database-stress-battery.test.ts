import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { eq } from "drizzle-orm";

describe("Database Stress & Ingestion Battery (9 Scenarios)", () => {
  it("executes the full 9-stage database integrity battery including overlapping date windows", async () => {
    // Setup isolated sandbox with a copy of real user database to test real-world schema and accounts
    const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), "db-battery-test-"));
    const realDbPath = path.resolve(__dirname, "../data/journal.db");
    const sandboxDbPath = path.join(sandboxDir, "journal.db");
    fs.copyFileSync(realDbPath, sandboxDbPath);
    process.env.JOURNAL_DATA_DIR = sandboxDir;

    const { db, accounts, executions, trades, journalDays, importSources } = await import("../src/db");
    const { POST } = await import("../src/app/api/import/route");
    const { rebuildAccount } = await import("../src/server/rebuild");

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

    const res1 = await POST(
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
    const source1 = db.select().from(importSources).where(eq(importSources.accountId, acc1Id)).get();

    expect(execs1.length).toBe(6);
    expect(trades1.length).toBe(1);
    expect(trades1[0]!.symbol).toBe("TIVC");
    expect(trades1[0]!.netPnl).toBeCloseTo(-7895.03, 2);
    expect(source1).toBeDefined();
    expect(source1!.format).toBe("tradezero");
    console.log(`   ✅ Sucesso: 6 execuções inseridas, 1 trade fechado (-$7.895,03), import_source registrado.`);

    // -------------------------------------------------------------
    // CENÁRIO 2: RE-UPLOAD IDÊNTICO (Idempotência Absoluta)
    // -------------------------------------------------------------
    console.log(`\n👉 [CENÁRIO 2] Testando Re-upload Idêntico (Idempotência)...`);
    const res2 = await POST(
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
    console.log(`   ✅ Sucesso: 0 inseridos, 6 duplicados detectados. Contagens de banco 100% idênticas.`);

    // -------------------------------------------------------------
    // CENÁRIO 3: RE-UPLOAD DESORDENADO / INVERTIDO (Order Invariance)
    // -------------------------------------------------------------
    console.log(`\n👉 [CENÁRIO 3] Testando Re-upload Invertido (Ordem Cronológica Inversa)...`);
    const [tzHeader, ...tzRows] = tradezeroContent.trim().split(/\r?\n/);
    const reversedContent = [tzHeader, ...tzRows.toReversed()].join("\n");

    const res3 = await POST(
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
    console.log(`   ✅ Sucesso: Linhas invertidas identificadas por hash/id nativo; 0 duplicatas criadas.`);

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

    // Disparar rebuild explícito e reimport
    rebuildAccount(acc1Id);

    const tradeAfterRebuild = db.select().from(trades).where(eq(trades.key, tivcTrade.key)).get()!;
    expect(tradeAfterRebuild.notes).toBe("Trade de short agressivo no pullback. Respeitou VWAP perfeitamente.");
    expect(tradeAfterRebuild.rating).toBe(5);
    expect(tradeAfterRebuild.playbookId).toBe("momentum-breakdown");
    expect(tradeAfterRebuild.netPnl).toBeCloseTo(-7895.03, 2);
    console.log(`   ✅ Sucesso: Anotação, rating e playbook sobreviveram ao rebuild matemático intactos.`);

    // -------------------------------------------------------------
    // CENÁRIO 5: JANELAS SOBREPOSTAS (Jan-Apr ➔ Mar-May) - A SUGESTÃO DO USUÁRIO
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

    // Construção dos dois arquivos com intersecção em Março e Abril:
    // Trade 1: Jan (Buy/Sell AAPL)
    // Trade 2: Feb (Buy/Sell MSFT)
    // Trade 3: Mar (Buy/Sell TSLA) -> PRESENTE EM AMBOS OS ARQUIVOS
    // Trade 4: Apr (Buy/Sell NVDA) -> PRESENTE EM AMBOS OS ARQUIVOS
    // Trade 5: May (Buy/Sell AMZN) -> APENAS NO ARQUIVO 2
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

    // Arquivo 1: Janeiro até Abril (8 execuções = 4 trades)
    const file1_JanToApr = [csvHeader, tJanBuy, tJanSell, tFebBuy, tFebSell, tMarBuy, tMarSell, tAprBuy, tAprSell].join("\n");

    // Arquivo 2: Março até Maio (6 execuções = Março, Abril repetidos + Maio novo)
    const file2_MarToMay = [csvHeader, tMarBuy, tMarSell, tAprBuy, tAprSell, tMayBuy, tMaySell].join("\n");

    // Importar Arquivo 1 (Jan-Abril)
    const resOverlap1 = await POST(
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

    // Anotar o trade de Março (TSLA) para testar se a nota sobrevive quando o Arquivo 2 for importado!
    const tslaTrade = tradesStage1.find(t => t.symbol === "TSLA")!;
    expect(tslaTrade).toBeDefined();
    db.update(trades)
      .set({ notes: "TSLA quebrou a resistência de Março. Nota essencial!", rating: 4 })
      .where(eq(trades.key, tslaTrade.key))
      .run();

    // Importar Arquivo 2 (Março-Maio) -> Contém Março e Abril repetidos + Maio novo!
    const resOverlap2 = await POST(
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

    // EXIGÊNCIA MATEMÁTICA: Exatamente 2 novas inserções (Maio) e 4 duplicatas detectadas (Março + Abril)!
    expect(jsonOverlap2.inserted).toBe(2);
    expect(jsonOverlap2.duplicates).toBe(4);

    const execsOverlapFinal = db.select().from(executions).where(eq(executions.accountId, accOverlapId)).all();
    const tradesOverlapFinal = db.select().from(trades).where(eq(trades.accountId, accOverlapId)).all();

    // Total final de execuções deve ser 10 (8 do primeiro + 2 novas do segundo)
    expect(execsOverlapFinal.length).toBe(10);
    // Total final de trades fechados deve ser 5 (AAPL, MSFT, TSLA, NVDA, AMZN)
    expect(tradesOverlapFinal.length).toBe(5);

    // Verificar se o trade de TSLA de Março manteve a sua anotação intacta
    const tslaAfterOverlap = db.select().from(trades).where(eq(trades.key, tslaTrade.key)).get()!;
    expect(tslaAfterOverlap.notes).toBe("TSLA quebrou a resistência de Março. Nota essencial!");
    expect(tslaAfterOverlap.rating).toBe(4);

    console.log(`   ✅ Sucesso no Overlap:`);
    console.log(`      - Arquivo 2 reconheceu 4 duplicatas (Março e Abril) com perfeição.`);
    console.log(`      - Arquivo 2 inseriu apenas 2 novas execuções (Maio).`);
    console.log(`      - Total de trades: 5 trades distintos (sem duplicar TSLA ou NVDA).`);
    console.log(`      - A anotação em TSLA foi 100% preservada.`);

    // -------------------------------------------------------------
    // CENÁRIO 6: ISOLAMENTO ESTREITO DA CONTA REAL FTMO (Zero Leakage)
    // -------------------------------------------------------------
    console.log(`\n👉 [CENÁRIO 6] Verificando se a Conta Real FTMO ("Eval") Sofreu Qualquer Impacto...`);
    const ftmoAccount = db.select().from(accounts).where(eq(accounts.id, "4U2rW1FjaU17")).get()!;
    const ftmoExecs = db.select().from(executions).where(eq(executions.accountId, ftmoAccount.id)).all();
    const ftmoTrades = db.select().from(trades).where(eq(trades.accountId, ftmoAccount.id)).all();

    expect(ftmoExecs.length).toBe(308);
    expect(ftmoTrades.length).toBe(154);
    console.log(`   ✅ Sucesso: Conta FTMO permaneceu com exatamente 308 execuções e 154 trades (isolamento total).`);

    // -------------------------------------------------------------
    // CENÁRIO 7: IMUTABILIDADE DOS DIÁRIOS REFLEXIVOS (journal_days)
    // -------------------------------------------------------------
    console.log(`\n👉 [CENÁRIO 7] Verificando Imutabilidade dos Diários Reflexivos...`);
    const days = db.select().from(journalDays).all();
    expect(days.length).toBe(6);
    const dayFomc = days.find(d => d.date === "2026-09-16")!;
    expect(dayFomc).toBeDefined();
    expect(dayFomc.note).toContain("Dia de Fomc");
    console.log(`   ✅ Sucesso: 6 registros de journal_days intactos com todos os textos pré-market.`);

    // -------------------------------------------------------------
    // CENÁRIO 8: INTERCEPÇÃO DE CONFLITO DE CONTA (Account Mismatch Guard)
    // -------------------------------------------------------------
    console.log(`\n👉 [CENÁRIO 8] Testando Bloqueio contra Conflito Acidental de Conta...`);
    // Tentar importar o extrato da TradeStation (Conta #11434173) dentro da conta TradeZero ou FTMO
    const tradestationFixture = path.resolve(
      __dirname,
      "../../../packages/importers/tests/fixtures/tradezella/tradestation-tradestation.csv",
    );
    const tradestationContent = fs.readFileSync(tradestationFixture, "utf8");

    // Configurar conta com accountNumber explícito
    db.update(accounts).set({ accountNumber: "99999999" }).where(eq(accounts.id, acc1Id)).run();

    const resMismatch = await POST(
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
    // Deve barrar com status 400
    expect(resMismatch.status).toBe(400);
    const jsonMismatch = await resMismatch.json();
    expect(jsonMismatch.error).toContain("Account mismatch");
    console.log(`   ✅ Sucesso: Bloqueio ativado com sucesso! Erro retornado: "${jsonMismatch.error}"`);

    // -------------------------------------------------------------
    // CENÁRIO 9: POSIÇÃO ABERTA NO ARQUIVO 1 E FECHADA NO ARQUIVO 2
    // -------------------------------------------------------------
    console.log(`\n👉 [CENÁRIO 9] Testando Posição Aberta em Arquivo A e Fechada em Arquivo B (Cross-File FIFO)...`);
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

    // Segunda-feira: Compra de 100 QQQ @ 450.00 (Posição Aberta)
    const fileMon = [csvHeader, "QQQ,2026-06-01 10:00:00,Bot,450.00,100,1.00,0,45000"].join("\n");
    // Sexta-feira: Venda de 100 QQQ @ 455.00 (Fechamento da Posição)
    const fileFri = [csvHeader, "QQQ,2026-06-05 15:30:00,Sld,455.00,100,1.00,500,45500"].join("\n");

    // Importa Segunda-feira
    await POST(
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
    console.log(`   [Segunda-feira] 1 trade aberto com status="open" e openQuantity=100.`);

    // Importa Sexta-feira
    await POST(
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
    expect(tradesFri[0]!.grossPnl).toBe(500); // (455 - 450) * 100
    expect(tradesFri[0]!.netPnl).toBe(498);   // 500 - 2 (taxas de compra e venda)
    console.log(`   ✅ Sucesso: O arquivo da Sexta casou com o da Segunda; posição fechada com Net P&L = +$498,00.`);

    // Limpeza da Sandbox
    fs.rmSync(sandboxDir, { recursive: true, force: true });
    console.log(`\n======================================================`);
    console.log(`🎉 BATERIA DE 9 CENÁRIOS CONCLUÍDA COM 100% DE SUCESSO!`);
    console.log(`======================================================\n`);
  });
});
