# ADR-004: Consolidação da Suíte de Testes do Monorepo TradeJournal & Database Test Harness

**Status**: Aprovado  
**Data**: 2026-10-14  
**Decisores**: Owner (TradeJournal) & Master Orchestrator (ECC Ecosystem)  
**Contexto**: Otimização do tempo de coleta do Vitest (55s+), eliminação de 46 instâncias manuais de `mkdtempSync`, padronização hermética de testes de banco de dados e unificação de 12 baterias de chaos testing duplicadas.

---

## 1. Contexto & Forças em Jogo

A auditoria cirúrgica da suíte de testes automatizados do monorepo TradeJournal identificou os seguintes gargalos estruturais em 93 arquivos de teste (1.193 testes):

1. **Overhead de Coleta e I/O no Vitest**:
   - O tempo de coleta dos workers do Vitest somou mais de **55 segundos** (`collect 55.15s`), devido à compilação e isolamento de 70 arquivos planos em `apps/web/tests/`.
   - 46 arquivos de teste criam diretórios temporários físicos via `mkdtempSync`, configuram variáveis de ambiente e executam top-level `await import("../src/db")` de forma dispersa e redundante.
2. **Quebra de Hermeticidade**:
   - `apps/web/tests/database-ingestion-battery.test.ts` tenta copiar `../data/journal.db` do disco do desenvolvedor caso exista, quebrando a garantia de reprodutibilidade em ambientes isolados.
3. **Duplicação Excessiva de Chaos Testing**:
   - 12 arquivos `*-chaos-stress.test.ts` em `packages/importers/tests/` repetem a exata mesma suíte de "6 Universal Chaos Vectors" com código duplicado.
4. **Vazamento de Fronteiras de Pacotes**:
   - Testes de parsing puro de corretoras (`history-import.test.ts`, `import-formats-regression.test.ts`) residiam em `apps/web/tests/` em vez de `packages/importers/tests/`.
5. **Testes Viciados e Modelos Fictícios de IA**:
   - `apps/web/src/lib/ai-settings.ts` e `apps/web/src/server/ai.ts` utilizavam modelos inexistentes (`claude-opus-5`, `gemini-3.8-flash`) e dependiam de fallback para HTTP 404 em `interactions.create`.
6. **Divergências Tipográficas no Core**:
   - `packages/core/src/aggregate.ts` usa hífen (`"1-5m"`), enquanto `packages/core/src/analysis.ts` usa en-dash (`"1–5m"`), sem teste unitário garantindo paridade.

---

## 2. Decisão Arquitetural

Adotamos a **Consolidação Estruturada em 4 Domínios com Harness Centralizado**:

1. **Harness Centralizado de Banco (`apps/web/tests/helpers/db-harness.ts`)**:
   - Exporta utilitários para criar banco SQLite temporário isolado por arquivo de teste de forma determinística (`setupTestDatabase`), fornecer mocks de cookies/headers do Next.js e limpar tabelas rapidamente sem reinstanciar schemas.
   - Proíbe cópias de bancos reais de produção (`data/journal.db`) em testes automatizados.
2. **Consolidação Parametrizada no Pacote Importers (18 ➔ 6 arquivos)**:
   - Os 12 arquivos `*-chaos-stress.test.ts` são unificados em `packages/importers/tests/chaos-stress.test.ts` utilizando `describe.each(BROKERS)`.
   - Testes de formato puro da Web são movidos para `packages/importers/tests/importers-formats.test.ts`.
3. **Hierarquização Funcional em `apps/web/tests/` (70 ➔ 32 arquivos)**:
   - Organização em 4 subdiretórios funcionais: `server/`, `market/`, `replay-trading/`, `journal-ui/`.
   - Fusão de micro-arquivos que testam o mesmo módulo (ex: `api-auth` + `proxy` ➔ `auth-proxy.test.ts`).
4. **Resoluções de Bugs e Paridade no Core**:
   - Atualizar defaults de IA para modelos oficiais estáveis da Anthropic, OpenAI e Google Gemini.
   - Eliminar o fallback de 404 em `server/ai.ts`.
   - Garantir paridade e testes unitários diretos para `aggregate.ts`, `analysis.ts` e `use-autosave.ts`.
5. **Quality Gate Obrigatório via `/santa-method`**:
   - Dois revisores independentes cegos (Reviewer B para asserções e regras; Reviewer C para execução e ambiente) auditam cada lote consolidado antes de ser aprovado.

---

## 3. Consequências & Trade-offs

### Positivas
- Redução de ~50% na quantidade de arquivos de teste (de 93 para ~44 arquivos).
- Drástica redução no tempo de coleta do Vitest (`collect time`).
- Hermeticidade e isolamento 100% confiáveis para testes SQLite.
- Limpeza de modelos fictícios e eliminação de chamadas desnecessárias com erro em produção.
- Zero perda de asserções de negócio ou casos de borda de corretoras.

### Negativas / Riscos
- Necessidade de atualizar referências de imports em arquivos que rodavam testes isolados específicos.
- *Mitigação*: Manter correspondência clara de nomes nas novas subpastas e rodar a suíte completa no quality gate.
