# Arquitetura de Paridade Live vs Replay & Troca Atômica de Timeframe

**Data:** 13 de Outubro de 2026  
**Status:** Proposto / Em Deliberação  
**Autores:** Master Systems & Persistence Architect (TradeJournal)  
**Alvo:** Paridade 1:1 com o TradingView Desktop na transição de resoluções temporais, eliminação de concorrência entre SQLite e WebSocket, e prevenção contra deformação de escala na engine Vela.

---

## 1. Diagnóstico Forense da Causa Raiz

### 1.1 Concorrência Desordenada (Race Condition) entre WebSocket e SQLite
- **Cenário:** Ao clicar em um novo timeframe (ex: `5m`), duas vias paralelas eram disparadas simultaneamente:
  1. `useLiveMarketFeed`: Enviou `subscribe` ao WebSocket local (`ws://localhost:3001`), que respondeu em ~2ms com 2.300 barras de tempo real de hoje.
  2. `fetchCandles`: Disparou um `fetch` HTTP para `/api/market-data/replay`, que demorou ~60ms e retornou dados estáticos do banco que pararam ontem (`2026-10-12`).
- **Impacto:** A resposta do HTTP aterrissava 50ms após as barras ao vivo já estarem pintadas, sobrescrevia a memória com dados de ontem e rebaixava o watermark indevidamente para `"Replay"`.

### 1.2 A "Mescla de Dados" (Frankenstein Dataset)
- **Cenário:** O método `mergeBars(barsRef.current, incomingBars)` recebia `incomingBars` de 5 minutos, mas `barsRef.current` ainda continha velas de 1 minuto da sessão anterior.
- **Impacto:** Como o Map indexava por timestamp, velas de 1m (`10:01`, `10:02`, `10:03`, `10:04`) permaneciam intercaladas entre as velas de 5m (`10:00`, `10:05`). O gráfico recebia uma linha do tempo aberrante, quebrando a projeção de tempo por pixel da engine.

### 1.3 O "Pop-Up" / Salto da Engine Vela
- **Cenário:** A engine do Vela (`CoordinateService`) assume espaçamento temporal uniforme. Ao receber velas intercaladas, a escala entrava em colapso. Além disso, o código capturava `prevVp` (o `barSpacing` e `rightOffset` em barras de 1 minuto) e re-aplicava cegamente sobre o gráfico de 5 minutos via `inner.applyViewport(prevVp)`.
- **Impacto:** O gráfico sofria um salto brusco ("pop up" visual), reposicionando o viewport em coordenadas inválidas ou jogando as velas para fora da área visível.

---

## 2. A Solução Canônica (Benchmark TradingView Desktop)

No TradingView Desktop, a troca de resolução segue uma máquina de estados atômica e estrita:
```
STREAMING (1m) 
   ↓ (Usuário clica em 5m)
SWITCHING (Ticks em tempo real pausados; sem concorrência)
   ↓ (Envio de modify_series)
CLEAR_DATA (Descarte total das barras de 1m da memória)
   ↓ (Recebimento de timescale_update)
ATOMIC PAINT (Pintura limpa e exclusiva das barras de 5m com autoScale)
   ↓
STREAMING (5m) (Ticks retomam apenas na barra aberta de 5m)
```

---

## 3. Decomposição do Plano em 4 Etapas

### Etapa 1: Cache & Entrega Imediata de Histórico no Bridge Daemon
- **Arquivo:** `apps/web/src/server/tv-feed-bridge.ts`
- **Ação:** 
  1. Manter cache em memória das séries por par `(symbol, resolution)`.
  2. Ao receber `subscribe`, enviar imediatamente o cache daquela resolução ao cliente (0ms).
  3. Despachar `modify_series` ao upstream TradingView apenas se a assinatura upstream mudou.
- **Quality Gate:** Testes de protocolo `tv-protocol.test.ts` e `pnpm bridge:check` 100% operacionais.

### Etapa 2: Máquina de Estados Atômica de Troca de Resolução (Live vs Replay)
- **Arquivo:** `apps/web/src/components/replay/replay-market-chart.tsx`
- **Ação:**
  1. No modo **Live**: Quando o bridge está conectado, a troca de TF **não consulta mais o SQLite de replay**. O gráfico exibe loading no watermark, limpa as barras do TF anterior e aguarda as barras do novo TF vindas do bridge.
  2. No modo **Replay**: A troca de TF busca exclusivamente o SQLite e retoma o replay a partir do cursor no mesmo timestamp.
  3. Guardar ticks: `isSwitchingResolutionOrSessionRef.current = true` durante a transição para impedir que ticks em tempo real mutem velas intermediárias.
- **Quality Gate:** Transição fluida sem piscadas, com watermark e statusline preservados como `"CME Live"`.

### Etapa 3: Proteção Anti-Frankenstein no `mergeBars` e Viewport Inteligente
- **Arquivo:** `apps/web/src/components/replay/replay-market-chart.tsx`
- **Ação:**
  1. No `mergeBars`, validar a compatibilidade de intervalo temporal: se os intervalos entre velas divergirem em mais de 30% (ex: 60s vs 300s), rejeitar a mescla e adotar 100% das novas barras.
  2. Não aplicar `applyViewport(prevVp)` entre resoluções diferentes. Aplicar `autoScale: true` para manter a ponta do tempo real enquadrada naturalmente.
- **Quality Gate:** Gráficos de 1m, 3m, 5m, 15m e 30m renderizam com barras estritamente uniformes.

### Etapa 4: Suporte Completo a 30m na Topbar e Sincronização Multi-Chart
- **Arquivo:** `apps/web/src/components/replay/replay-market-chart.tsx`
- **Ação:**
  1. Incluir `"30"` no array `timeframes` e no conjunto `availableTimeframes` da Topbar.
  2. Garantir que, com `syncOptions.interval = true`, os painéis secundários (ex: `MES`) também realizem a transição atômica em sincronia com o painel primário.
- **Quality Gate:** Troca de tempo gráfico sincronizada entre múltiplos painéis sem descompasso.
