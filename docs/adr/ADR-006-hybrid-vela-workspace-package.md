# ADR-006: Migração do Vela 0.8.4 para Pacote Workspace Local (`packages/vela`) e Arquitetura Híbrida Nativa

**Data**: 2026-10-15  
**Status**: Aprovado  
**Decisores**: Senior Software Architect (ECC Ecosystem) & Owner  
**Contexto**: TradeJournal Monorepo (`packages/vela`, `apps/web/src/components/replay/replay-market-chart.tsx`, `apps/web/src/components/settings/*`)  

---

## 1. Contexto & Diagnóstico

O TradeJournal integrava a biblioteca `@luxalgo/vela` (v0.8.4) via pacote pré-compilado do npm (`node_modules/@luxalgo/vela`). Para customizar a aparência visual e estender o comportamento do gráfico, foram criados 14 arquivos no diretório `apps/web/src/components/` (como `vela-chrome-enhancer.ts`, `vela-settings-bridge.ts`, `vela-timeframe-picker.ts`, etc.).

Essa abordagem gerou uma **"guerra de dois cérebros"**:
1. **Bug da Lupa `🔍` Sumindo**: O Vela renderizava seu DOM nativo e gerenciava cliques nas células. Quando o usuário clicava em uma célula ou alternava o ativo no gráfico, o motor nativo atualizava o texto do botão via `symbolButton.textContent = "MES"`, destruindo o `<svg>` injetado externamente via `MutationObserver`.
2. **Bug de 1 Clique de Atraso no `Sample Data` do Settings (`MNQ` vs `MES`)**: O modal de configurações (`VelaSettingsDialog`) e seu mini-gráfico (*Appearance Preview*) dependiam de pontes assíncronas (`vela-settings-bridge.ts`). Ao trocar de célula (ex: MNQ na célula 1 para MES na célula 2), o modal abria lendo a referência de preço ou o estado do ciclo anterior (contaminando o MES com a cotação de 30.569 do MNQ). Além disso, o canvas anterior não era destruído sincronamente antes da resolução da Promise dinâmica do Vela.

---

## 2. Decisão Arquitetural

Adotamos a **Arquitetura Híbrida de Pacote Workspace Local**:

1. **Criação de `packages/vela` no Monorepo**:
   - O `@luxalgo/vela` passa a ser um pacote local de primeira classe (`packages/vela`), consumido pelo Next.js como `"@luxalgo/vela": "workspace:*"`.
   - O motor compilado de alta performance (WebGL2, Canvas2D, shaders, BarStore, LOD) é preservado em `packages/vela/vendor/`.
   - As camadas de extensão visual, Topbar, Badges CME, Curvas Bézier e Gerenciador de Células Ativas passam a ser código-fonte TypeScript nativo em `packages/vela/src/`.

2. **Lupa `🔍` Blindada Nativamente (`topbar.ts`)**:
   - O botão de símbolo da Topbar é estruturado com `<span data-vela-search-icon>` e `<span data-vela-symbol-label>` desacoplados.
   - Qualquer atualização de símbolo modifica estritamente o `labelSpan`, tornando estruturalmente impossível a destruição da lupa.

3. **Badges de Futuros CME Nativos (`symbol-icon.ts`)**:
   - Catálogo vetorial SVG nativo para Futuros CME (`500` vermelho para MES/ES, `100` azul para MNQ/NQ, `30` para MYM/YM, `2000` para M2K/RTY, Ouro, Petróleo e Cripto) integrado no core do Vela.

4. **Sincronizador Síncrono de Células (`NativeWorkspaceCellTracker`)**:
   - Rastreamento de célula ativa na fase de captura (`pointerdown` capture) diretamente nos containers `.vela-cell`.
   - Acesso síncrono (0ms) à última barra do BarStore daquela célula específica, antes do disparo de eventos de clique duplo ou abertura de modais.
   - Validador de escala (`resolveSampleAnchor` com faixas de preço `minPrice`/`maxPrice` por ativo) que impede contaminação cruzada de preços entre ativos diferentes.

5. **Destruição Síncrona do Preview (`vela-interactive-preview.tsx`)**:
   - Destruição imediata de instâncias anteriores e limpeza do `chartWrapperRef.current.innerHTML = ""` no início do efeito, antes do `import()` dinâmico.

---

## 3. Alternativas Consideradas

### Alternativa 1: Adoção cega do Vela 0.8.4 puro sem customizações
- **Prós**: Zero código customizado em `apps/web`.
- **Contras**: Regressão severa de UI/UX. Perda do *Appearance Preview* interativo lateral, perda dos ícones de contratos futuros CME, perda da Topbar com curvatura Bézier e incompatibilidade com o Paper Trading.
- **Por que rejeitada**: A identidade visual e experiência de trading de futuros do TradeJournal são requisitos inegociáveis.

### Alternativa 2: Manutenção do DOM Scraping / MutationObserver externo
- **Prós**: Não alterava a estrutura de pacotes.
- **Contras**: Bugs contínuos de concorrência no DOM, loops de observer e latência perceptível pelo usuário.
- **Por que rejeitada**: Causa raiz dos dois bugs reportados.

---

## 4. Consequências

### Positivas
- **Eliminação Definitiva dos Bugs**: A lupa não é mais sobrescrita e o Settings sempre abre com a cotação e escala do ativo correto.
- **Hot Reload & DX**: Qualquer ajuste em `packages/vela/src` reflete instantaneamente via Turbopack/Next.js Fast Refresh graças a `transpilePackages`.
- **Roteiro Claro de Limpeza**: Permite a aposentadoria gradual dos ~14 arquivos de pontes externas sem quebrar a suíte de testes.
- **Zero Regressão**: A suíte de 1.202 testes continua 100% verde.

### Riscos & Mitigações
- **Risco**: Futuras atualizações do `@luxalgo/vela` no npm upstream.
- **Mitigação**: O vendor compilado fica isolado em `packages/vela/vendor/`, permitindo substituição direta de artefatos preservando os patches em `src/`.
