# Plano de Implementação: Modo Live Padrão (Análise Limpa) e Gate Estrito do Replay

**Data**: 2026-10-13  
**Status**: Proposto  
**Objetivo**: Restringir a visualização da barra inferior de replay trading, das borboletas de ordem e da barra de controle temporal para que apareçam EXCLUSIVAMENTE quando o usuário confirmar e entrar em Replay. Antes disso, manter o mercado em modo Live (escutando dados, análise gráfica limpa, sem borboletas, sem barra de replay e sem painel de paper trading).

---

## 1. Contexto e Diagnóstico

Hoje, o módulo de gráficos inicializa com `isReplayActive = true` por padrão, renderizando logo no carregamento:
1. As borboletas de ordem e botões Buy/Sell (`VelaDesktopTradingButtons` e `VelaVisualTradingOverlay`) em todas as células do layout;
2. A barra flutuante de controle do Replay (`VelaProReplayBar`);
3. O painel inferior de paper trading (`VelaPaperTradingBottomPanel`).

O botão de Replay já existe na Topbar (`.vela-replay-topbar-btn`). O objetivo é inverter essa relação: o padrão de entrada é **Modo Live / Análise Comum** (100% limpo), e apenas após o usuário clicar no botão de Replay e confirmar a seleção do candle de corte é que os elementos de simulação e trading tornam-se visíveis.

---

## 2. Divisão de Etapas (Step Units)

### Step 1 — Inversão do Estado Inicial e Persistência do Replay Gate
- **Arquivo**: `apps/web/src/components/replay/replay-market-chart.tsx` e `apps/web/src/lib/replay/workspace-persistence.ts`
- **Ações**:
  - Alterar o estado inicial de `isReplayActive` para `false` por padrão.
  - Remover qualquer inicialização forçada de `sessionStorage.getItem("vela-pro.replay.active") === "1"` no primeiro mount.
  - Assegurar que ao carregar a página, o gráfico inicia no tempo presente (borda direita / live edge), sem ativar o engine de replay histórico.

### Step 2 — Restrição da Barra de Replay e Fluxo de Confirmação do Ponto de Corte
- **Arquivo**: `apps/web/src/components/replay/replay-market-chart.tsx`
- **Ações**:
  - Ajustar o listener do botão de Replay da Topbar: ao clicar quando `!isReplayActive`, ativar apenas o modo de seleção de corte (`isSelectingCutPoint = true`).
  - Durante `isSelectingCutPoint`, exibir apenas o banner sutil de instrução ("Bar replay: click the bar to start from (Esc cancels)"); a barra de controle (`VelaProReplayBar` com Play, Pause, Speed, Scrub) NÃO deve aparecer ainda.
  - Ao clicar no candle e confirmar (`handleStartReplay`), ativar `isReplayActive = true` e exibir a barra de controle.
  - Se o usuário pressionar `Esc` ou cancelar, desativar `isSelectingCutPoint` sem entrar em Replay.
  - Ao clicar no `✕` da barra de Replay (`handleStopReplay`), desativar `isReplayActive = false` e retornar o gráfico para o modo Live limpo.

### Step 3 — Condicionamento Estrito das Borboletas de Ordem e Painel Inferior
- **Arquivo**: `apps/web/src/components/replay/replay-market-chart.tsx`
- **Ações**:
  - Condicionar `<VelaVisualTradingOverlay />` e `<VelaDesktopTradingButtons />` no painel principal (célula 0) a `isReplayActive`: se `!isReplayActive`, não renderizar.
  - Condicionar `<VelaVisualTradingOverlay />` e `<VelaDesktopTradingButtons />` em todos os painéis secundários (células 1..N) a `isReplayActive`: se `!isReplayActive`, não renderizar.
  - Condicionar `<VelaPaperTradingBottomPanel />` a `isReplayActive`: no modo Live, o painel inferior fica totalmente oculto/desmontado, mantendo apenas a Bottombar nativa de timezones e ranges.

### Step 4 — Validação Multi-Chart, Testes Automatizados e Quality Gate
- **Arquivos**: `apps/web/tests/replay-workspace-persistence.test.ts`, suíte de testes existente
- **Ações**:
  - Atualizar/adicionar testes unitários validando que o workspace hidrata com `isReplayActive: false` por padrão e não sobrepõe configurações de layout multi-chart.
  - Executar verificação estrita de tipagem (`pnpm --filter web typecheck`).
  - Executar suíte completa de testes (`pnpm test`).
  - Validar visualmente que 1 ou mais painéis (ex: `1x1`, `1x2` com `MNQ` e `MES`) abrem em modo Live limpo sem borboletas, e que ao ativar Replay tudo aparece corretamente sincronizado.
