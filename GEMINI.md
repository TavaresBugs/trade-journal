# Diretrizes de Projeto & Markdown (TradeJournal)

## REGRA SUPREMA DE MARKDOWN

NUNCA aninhe blocos com `dentro de outro bloco` de markdown.
Fazer isso fecha prematuramente o bloco de código externo e quebra completamente a renderização da mensagem no chat.

- Para apresentar prompts que contêm código: apresente a estrutura com títulos e seções de Markdown normais (sem encapsular o prompt inteiro dentro de outro bloco de ```), ou use indentação de 4 espaços ou 4 crases (````) no bloco mais externo.

---

## Diretrizes de Escopo, UI (`bezier-style`) e Testes Automatizados

1. **Foco de Testes Unitários (Engine & Banco de Dados vs UI Cosmética)**:
   - **NÃO** crie testes unitários para elementos puramente visuais/estéticos de UI (como curvas SVG de Bézier, sombras ou estilização de botões).
   - Concentre testes automatizados estritamente em **engines, regras de negócio, parsers, cálculos financeiros e operações de banco de dados**.
   - Alterações visuais de UI devem ser validadas diretamente no navegador/DOM.

2. **Isolamento Estrito entre Shell do TradeJournal e Componentes `vela-*`**:
   - Quando uma tarefa for solicitada para o shell do aplicativo (`FilterBar`, `DashboardSavedLayouts`, `AccountSelector`, etc.), **NÃO modifique arquivos `vela-*`** (`apps/web/src/components/vela/*` ou `apps/web/src/lib/vela-*`), a menos que explicitamente solicitado pelo Owner.
   - Para conexões **Natural Bézier Style**, consulte a skill `~/.gemini/ecc/skills/bezier-style/SKILL.md` e diferencie sempre entre **Modo 1 (Select/Controle dentro de estrutura)** e **Modo 2 (Botão conectado na Barra)**.

---

## 3. Market Terminal (`apps/web/src/components/market/`) — Agentic Architecture Rules

1. **Domain Boundary & Naming**:
   - O subsistema gráfico é o **Terminal de Mercado** (`market`), suportando tanto o modo `live` (WebSocket em tempo real) quanto o modo `replay` (simulação histórica barra a barra).
   - Todo código novo de gráfico, indicador, persistência de desenho e boleta/trading DEVE residir em `apps/web/src/components/market/` ou `packages/vela/src/workspace/`.
   - Caminhos legados (`apps/web/src/components/replay/**`, `apps/web/src/lib/replay/**` e `apps/web/src/components/vela-drawings-bridge.ts`) são **Zero-Regression Shims** (apenas re-exportações). Nunca delete esses shims nem coloque lógica de negócio neles.

2. **Divisão Engine (`packages/vela/src/workspace/`) vs React App (`components/market/`)**:
   - **`packages/vela/src/workspace/`**: Engine pura em TypeScript (sem React). Contém manipulação imperativa de instâncias Vela (`timeframe-utils.ts`, `drawing-persistence.ts`, `pine-runtime.ts`, `settings-engine.ts`, `renderer-patches.ts`, `VelaWorkspace.ts`). Tanto `market-terminal-chart.tsx` quanto `trade-market-data.tsx` devem consumir daqui.
   - **`apps/web/src/components/market/`**: Camada React do aplicativo. Componentes visuais folha, orquestração de modais e estado de aplicação.

3. **Orçamento de Tamanho de Arquivo (Context Efficiency Budget)**:
   - Componentes visuais folha (`market/replay/*`, `market/indicators/*`, `market/chrome/*`, `market/grid/*`): máximo **350 linhas**.
   - Hooks de domínio (`market/hooks/*`): máximo **450 linhas**.
   - Orquestrador (`market-terminal-chart.tsx`): máximo **300 linhas** (apenas composição de hooks e JSX; sem mutações inline de DOM ou useEffects monolíticos).

4. **Grafo Acíclico Estrito de Hooks (Hook DAG)**:
   - Respeite sempre a ordem de camadas na execução:
     - **Camada 0 (`useMarketTerminalRefs`)**: Instancia todas as refs compartilhadas, átomos primitivos e o `NativeWorkspaceCellTracker` (0ms síncrono).
     - **Camada 1 (`useMarketMultiChartSync`, `useMarketTradingEngine`)**: Fornece broadcast de viewport/crosshair e sincronização de ticks/rewind do Paper Trading.
     - **Camada 2 (`useMarketReplayPlayback`, `useMarketDataAndFeed`, `useMarketIndicatorsEngine`)**: Consome Camadas 0 e 1 sem ciclos cruzados.
     - **Camada 3 (`useMarketWorkspacePersistence`, `useMarketChartLifecycle`)**: Hidratação L1/L2 e montagem de instâncias Vela.
     - **Camada 4 (`useMarketKeyboardAndModals`)**: Atalhos globais e hierarquia de Escape (*Modals > Popovers > Cut Mode*).

5. **Invariantes de Persistência Proprietária**:
   - `market/drawings/market-drawings-persistence.ts` possui persistência em 2 níveis (L1 `localStorage` síncrono + L2 PATCH debounced em `/api/trades/[key]` e `/api/settings`) conectado a `bindNativeDrawingControllerPersistence`. Nunca substitua por stub vazio.
   - Resolução de foco multi-gráfico utiliza o `NativeWorkspaceCellTracker` (`@luxalgo/vela`) na fase de captura do `pointerdown` (0ms) para evitar vazamento de preço ou símbolo entre células ativas.


