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

