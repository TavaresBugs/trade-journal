# Diretrizes de Projeto & Markdown (TradeJournal)

## REGRA SUPREMA DE MARKDOWN

NUNCA aninhe blocos com `dentro de outro bloco` de markdown.
Fazer isso fecha prematuramente o bloco de código externo e quebra completamente a renderização da mensagem no chat.

- Para apresentar prompts que contêm código: apresente a estrutura com títulos e seções de Markdown normais (sem encapsular o prompt inteiro dentro de outro bloco de ```), ou use indentação de 4 espaços ou 4 crases (````) no bloco mais externo.
