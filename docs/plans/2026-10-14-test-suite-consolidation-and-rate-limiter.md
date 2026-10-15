# Plano de Execução: Consolidação de Suíte de Testes & Unificação de Rate Limiter

Este plano operacional implementa a **[ADR-003](file:///home/jhontavares/Documents/TradeJournal/docs/adr/ADR-003-test-suite-consolidation-and-layering.md)**, orquestrando a migração estruturada dos 11 grupos de testes duplicados/fragmentados do motor gráfico e a unificação dos limitadores de taxa.

Cada passo deve ser executado de forma modular, seguido obrigatoriamente pela validação do **`/santa-method`** (dois revisores adversariais independentes com veredito NICE/NAUGHTY).

---

## Passo 1: Piloto — Consolidação da Família Fibonacci (4 arquivos ➔ 1)

### Escopo
- **Arquivos Atuais**:
  - `drawings-fib.test.ts`
  - `drawings-fib-10a.test.ts`
  - `drawings-fib-10b.test.ts`
  - `drawings-fib-presets.test.ts`
- **Arquivo Destino Consolidado**:
  - `test/drawings/fib.test.ts`
- **Objetivos**:
  - Unificar a instanciação do `DrawingsController` e fixtures de coordenadas de Fibonacci em um único `describe("Fibonacci Drawings Suite")`.
  - Preservar 100% das asserções de regressão (incluindo as correções de níveis negativos, extensões e presets clássicos/OTE).
  - Eliminar duplicações de setup de canvas e context mock.

### Comando / Orchestrate Sugerido
```bash
/orchestrate custom "architect,tdd-guide,typescript-reviewer" "Consolidar os 4 arquivos de teste de Fibonacci (drawings-fib.test.ts, drawings-fib-10a.test.ts, drawings-fib-10b.test.ts e drawings-fib-presets.test.ts) em um unico arquivo estruturado test/drawings/fib.test.ts com blocos describe() por funcionalidade, preservando 100% das assercoes e garantindo vitest run verde."
```

### Santa Method Gate (Rubric de Aprovação)
- **Reviewer B & Reviewer C** devem auditar:
  1. *Zero Assertion Loss*: A contagem total de asserções `expect(...)` no arquivo consolidado é igual ou superior à soma dos 4 arquivos originais?
  2. *Zero Skipped Tests*: Há qualquer `test.skip`, `xit` ou asserção comentada?
  3. *Isolamento*: O novo arquivo roda de forma isolada com `pnpm test test/drawings/fib.test.ts`?
  4. *Remoção Limpa*: Os arquivos antigos foram removidos sem quebrar imports ou referências no package?

---

## Passo 2: Unificação Arquitetural dos Rate Limiters Multi-Provider

### Escopo
- **Arquivos Atuais**:
  - Binance: `src/data/providers/binance/RateGate.ts`
  - Coinbase: `src/data/providers/coinbase/RequestGate.ts`
  - TradeJournal: `apps/web/src/server/market-data/transport.ts` (`createMarketTransport`)
- **Arquivo Destino Compartilhado**:
  - `src/data/providers/shared/RateLimiter.ts` (ou `packages/core/src/rate-limiter.ts`)
  - Suíte de Testes Única: `test/data/rate-limiter.test.ts`
- **Objetivos**:
  - Implementar algoritmo canônico Token Bucket / Sliding Window com suporte a burst, filas assíncronas com prioridade e backoff exponencial.
  - Refatorar Binance e Coinbase para consumir a abstração compartilhada, eliminando mais de 250 linhas de código duplicado.

### Comando / Orchestrate Sugerido
```bash
/orchestrate custom "architect,tdd-guide,security-reviewer" "Implementar a classe canonica compartilhada RateLimiter com Token Bucket e backoff exponencial, migrar RateGate e RequestGate para utiliza-la, e criar a suite de testes de concorrencia e burst em test/data/rate-limiter.test.ts garantindo cobertura > 90%."
```

### Santa Method Gate (Rubric de Aprovação)
- **Reviewer B & Reviewer C** devem auditar:
  1. *Sem Race Conditions*: Testes sob rajada (burst de 100 requests simultâneas) respeitam os limites sem deadlock?
  2. *Compatibilidade de Provedores*: A Binance respeita os pesos de requisição (`IP limits`) e a Coinbase respeita os slots por segundo?
  3. *Memory Leaks*: Timers e filas são limpos no descarte (`destroy()`)?

---

## Passo 3: Renderers, Escala, Viewport e Animações (16 arquivos ➔ 3)

### Escopo
- **Grupo Escala e Viewport (12 arquivos)**:
  - `native-coordinate-system.test.ts`, `native-manual-scale.test.ts`, `native-pane-scale-modes.test.ts`, `scene-graph-scales.test.ts`, `autoscale-margins.test.ts`, `force-overlay-scale.test.ts`, `native-reframe-zoom.test.ts`, `native-wheel-anchor.test.ts`, `native-prepend-anchor.test.ts`, `native-hold-view.test.ts`, `anchor-offset.test.ts`, `candle-snap-y.test.ts`.
  - **Destino**: `test/renderers/coordinate-scale.test.ts` e `test/renderers/viewport-anchor.test.ts`.
- **Grupo Animator (4 arquivos)**:
  - `native-animator.test.ts`, `native-animation-config.test.ts`, `native-anim-settle.test.ts`, `native-live-bar-ease.test.ts`.
  - **Destino**: `test/renderers/animator.test.ts`.

### Comando / Orchestrate Sugerido
```bash
/orchestrate custom "architect,tdd-guide,typescript-reviewer" "Consolidar os 12 arquivos de teste de viewport/escala em 2 arquivos tematicos (coordinate-scale.test.ts e viewport-anchor.test.ts) e os 4 arquivos de Animator em animator.test.ts, unificando os mocks de requestAnimationFrame e canvas context."
```

---

## Passo 4: Z-Order, Marks, Drawing Settings e UI Pickers (51 arquivos ➔ 12)

### Escopo
- **Camadas & Z-Order (4 arquivos ➔ `test/renderers/layers-zorder.test.ts`)**: `layer-stacking`, `native-zorder`, `renderer-layers`, `floating-layer-host`.
- **Timeline Marks (6 arquivos ➔ `test/core/marks.test.ts`)**: `marks-controller`, `marks-state`, `marks-paint`, `mark-lane-layout`, `chrome-mark-lane-clip`, `mark-popover-toggle`.
- **Drawing Settings & Defaults (5 arquivos ➔ `test/drawings/settings-ui.test.ts`)**: `drawings-settings-panel`, `drawings-settings-reopen`, `drawings-popup-multi`, `drawings-tool-defaults`, `drawings-style-templates`.
- **UI Pickers & Form Primitives (8 arquivos ➔ `test/ui/form-primitives.test.ts` e `pickers-dialogs.test.ts`)**: `color-picker`, `date-picker`, `date-calendar`, `ui-field`, `ui-form-primitives`, `ui-keymap`.

### Comando / Orchestrate Sugerido
```bash
/orchestrate custom "refactor-cleaner,tdd-guide,typescript-reviewer" "Mover e unificar os micro-testes de UI, Settings Panels e Marks para suas respectivas pastas modulares em test/ui/, test/drawings/ e test/core/, padronizando nomenclatura e eliminando arquivos de bugfix de 1 caso."
```

---

## Critério Final de Conclusão (Quality Gate Global)
1. **Benchmark de CI**: Redução comprovada de tempo de execução no Vitest registrada antes e depois da consolidação.
2. **Zero Regressão**: `pnpm --filter web typecheck` com 0 erros e 100% dos testes passando.
3. **Conformidade Git**: Commits semânticos por etapa, locais na branch, sem `git push` não autorizado.
