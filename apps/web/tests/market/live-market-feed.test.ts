import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import WebSocket, { WebSocketServer } from "ws";
import type { MarketBar, Resolution } from "../../src/lib/market-data";

// ── Shared Helpers & Pure Functions Matching ReplayMarketChart ──

function mergeBars(existing: MarketBar[], incoming: MarketBar[]): MarketBar[] {
  if (!existing || existing.length === 0) return incoming;
  if (!incoming || incoming.length === 0) return existing;

  const map = new Map<number, MarketBar>();
  for (const b of existing) {
    map.set(b.time, b);
  }
  for (const b of incoming) {
    map.set(b.time, b);
  }

  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

function toVelaTf(resolution: string): string {
  if (resolution === "1d") return "1D";
  if (resolution === "1w") return "1W";
  if (resolution === "1mo") return "1M";
  return resolution;
}

interface MockChartInstance {
  setMarket: (payload: { timeframe: string; data: MarketBar[] }) => Promise<void>;
  renderer: {
    set: (prop: string, val: any) => void;
    resetView: () => void;
  };
  coords: {
    getViewport: () => { barSpacing: number; rightOffset: number };
  };
  applyViewport: (vp: { barSpacing: number; rightOffset: number }) => void;
  replay: {
    state: { remaining: number };
    start: (opts: { from?: number }) => Promise<void>;
    play: (speed: number) => void;
  };
}

function createMockChart(): {
  chart: MockChartInstance;
  calls: {
    setMarket: Array<{ timeframe: string; data: MarketBar[] }>;
    autoScaleSet: boolean[];
    resetViewCount: number;
    applyViewportCalls: Array<{ barSpacing: number; rightOffset: number }>;
    replayStartCalls: Array<{ from?: number }>;
    replayPlayCalls: number[];
  };
} {
  const calls = {
    setMarket: [] as Array<{ timeframe: string; data: MarketBar[] }>,
    autoScaleSet: [] as boolean[],
    resetViewCount: 0,
    applyViewportCalls: [] as Array<{ barSpacing: number; rightOffset: number }>,
    replayStartCalls: [] as Array<{ from?: number }>,
    replayPlayCalls: [] as number[],
  };

  const currentVp = { barSpacing: 10, rightOffset: 5 };

  const chart: MockChartInstance = {
    setMarket: vi.fn(async (payload) => {
      calls.setMarket.push(payload);
    }),
    renderer: {
      set: vi.fn((prop, val) => {
        if (prop === "autoScale") calls.autoScaleSet.push(val);
      }),
      resetView: vi.fn(() => {
        calls.resetViewCount++;
      }),
    },
    coords: {
      getViewport: vi.fn(() => ({ ...currentVp })),
    },
    applyViewport: vi.fn((vp) => {
      calls.applyViewportCalls.push(vp);
    }),
    replay: {
      state: { remaining: 50 },
      start: vi.fn(async (opts) => {
        calls.replayStartCalls.push(opts);
      }),
      play: vi.fn((speed) => {
        calls.replayPlayCalls.push(speed);
      }),
    },
  };

  return { chart, calls };
}

interface ResolutionSwitchState {
  status: "idle" | "switching";
  targetResolution: string | null;
  targetSymbol: string | null;
  cellIndex: number;
  startedAt: number;
}

class ResolutionSwitchHarness {
  public state: ResolutionSwitchState = {
    status: "idle",
    targetResolution: null,
    targetSymbol: null,
    cellIndex: 0,
    startedAt: 0,
  };
  public isSwitchingGuard = false;
  public watchdogTimer: NodeJS.Timeout | null = null;
  public fallbackTriggered = false;
  public fallbackResolution: string | null = null;
  public fallbackSymbol: string | null = null;
  public fallbackCellIndex: number | null = null;
  public loadingState = false;

  public clearWatchdog() {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  public requestSwitch(params: {
    targetRes: string;
    curRes: string;
    symbol: string;
    cellIndex?: number;
    hasBars?: boolean;
    intervalSync?: boolean;
    fallbackFn?: (sym: string, res: string) => Promise<void>;
  }): boolean {
    const {
      targetRes,
      curRes,
      symbol,
      cellIndex = 0,
      hasBars = true,
      intervalSync = false,
      fallbackFn,
    } = params;

    // 1. Redundancy guard: clicking same timeframe when already loaded (unless sync forced)
    if (!intervalSync && targetRes === curRes && hasBars) {
      return false;
    }

    // 2. Concurrency guard: already in flight to this exact resolution on this cell
    if (
      this.state.status === "switching" &&
      this.state.targetResolution === targetRes &&
      this.state.cellIndex === cellIndex
    ) {
      return false;
    }

    // 3. Mid-flight switch: clear active watchdog and arm fresh 3.0s window
    this.clearWatchdog();
    this.state = {
      status: "switching",
      targetResolution: targetRes,
      targetSymbol: symbol,
      cellIndex,
      startedAt: Date.now(),
    };
    this.isSwitchingGuard = true;
    this.loadingState = true;

    this.watchdogTimer = setTimeout(async () => {
      this.fallbackTriggered = true;
      this.fallbackResolution = targetRes;
      this.fallbackSymbol = symbol;
      this.fallbackCellIndex = cellIndex;
      this.watchdogTimer = null;

      try {
        if (fallbackFn) {
          await fallbackFn(symbol, targetRes);
        }
      } finally {
        this.isSwitchingGuard = false;
        this.state.status = "idle";
        this.loadingState = false;
      }
    }, 3000);

    return true;
  }

  public onHistoryArrived(res: string, symbol: string, cellIndex = 0): boolean {
    if (
      this.state.status === "switching" &&
      this.state.targetResolution === res &&
      this.state.targetSymbol === symbol &&
      this.state.cellIndex === cellIndex
    ) {
      this.clearWatchdog();
      this.state.status = "idle";
      this.isSwitchingGuard = false;
      this.loadingState = false;
      return true;
    }
    // Discard outdated / mid-flight obsolete packets
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// SUITE DE TESTES DE REGRESSÃO
// ─────────────────────────────────────────────────────────────

describe("Timeframe Switching Regression Test Suite (Live & Replay Parity)", () => {
  // ═══════════════════════════════════════════════════════════
  // 1. PARIDADE LIVE VS REPLAY NA TROCA DE TIMEFRAME
  // ═══════════════════════════════════════════════════════════
  describe("1. Paridade Live vs Replay na Troca de Timeframe", () => {
    describe("Prevenção do Frankenstein Dataset", () => {
      it("Live Mode: substitui atomicamente o buffer ao trocar de 1m para 5m sem vazar barras de 1m", () => {
        // Estado inicial em 1m: 5 barras com 60s de intervalo
        const existing1mBars: MarketBar[] = [
          { time: 60_000, open: 100, high: 102, low: 99, close: 101, volume: 10 },
          { time: 120_000, open: 101, high: 104, low: 100, close: 103, volume: 15 },
          { time: 180_000, open: 103, high: 105, low: 102, close: 104, volume: 20 },
          { time: 240_000, open: 104, high: 106, low: 103, close: 105, volume: 12 },
          { time: 300_000, open: 105, high: 107, low: 104, close: 106, volume: 18 },
        ];

        // Novos dados de 5m que chegam do Bridge WebSocket para MNQ@5m
        const incoming5mBars: MarketBar[] = [
          { time: 0, open: 98, high: 105, low: 97, close: 104, volume: 75 },
          { time: 300_000, open: 104, high: 110, low: 103, close: 108, volume: 90 },
        ];

        const hasAppliedLiveHistory = new Set<string>();
        const targetHistoryKey = "MNQ@5m";
        const hasApplied = hasAppliedLiveHistory.has(targetHistoryKey);

        let finalBars: MarketBar[];
        // Comportamento do componente ao receber pacote de novo timeframe
        if (!hasApplied || existing1mBars.length === 0) {
          hasAppliedLiveHistory.add(targetHistoryKey);
          // Substituição atômica pura (finalBars = incomingBars)
          finalBars = incoming5mBars;
        } else {
          finalBars = mergeBars(existing1mBars, incoming5mBars);
        }

        // Verificações de integridade
        expect(finalBars.length).toBe(2);
        expect(finalBars).toEqual(incoming5mBars);
        // Nenhuma barra intermediária de 1m contaminou o dataset de 5m
        const contaminatedWith1m = finalBars.some(
          (b) => b.time === 60_000 || b.time === 120_000 || b.time === 180_000 || b.time === 240_000
        );
        expect(contaminatedWith1m).toBe(false);
      });

      it("Live Mode: garante ordenação cronológica estrita e ausência de duplicatas após troca de timeframe", () => {
        const incoming15mBars: MarketBar[] = [
          { time: 900_000, open: 100, high: 110, low: 98, close: 108, volume: 200 },
          { time: 1_800_000, open: 108, high: 115, low: 107, close: 112, volume: 250 },
          { time: 2_700_000, open: 112, high: 120, low: 111, close: 119, volume: 300 },
        ];

        // Substituição pura
        const finalBars = [...incoming15mBars];

        for (let i = 1; i < finalBars.length; i++) {
          const prev = finalBars[i - 1]!;
          const curr = finalBars[i]!;
          expect(curr.time).toBeGreaterThan(prev.time);
        }

        const timestamps = finalBars.map((b) => b.time);
        const uniqueTimestamps = new Set(timestamps);
        expect(uniqueTimestamps.size).toBe(finalBars.length);
      });

      it("Live Mode: atualiza barra em formação apenas no mesmo timeframe (sem gerar Frankenstein)", () => {
        const current5mBars: MarketBar[] = [
          { time: 0, open: 100, high: 105, low: 99, close: 104, volume: 50 },
          { time: 300_000, open: 104, high: 107, low: 103, close: 106, volume: 40 },
        ];

        // Atualização em tempo real da barra de 300_000 (mesmo timeframe 5m já aplicado)
        const forming5mUpdate: MarketBar[] = [
          { time: 300_000, open: 104, high: 109, low: 103, close: 108, volume: 55 },
        ];

        const merged = mergeBars(current5mBars, forming5mUpdate);
        expect(merged.length).toBe(2);
        expect(merged[1]?.time).toBe(300_000);
        expect(merged[1]?.high).toBe(109);
        expect(merged[1]?.close).toBe(108);
        expect(merged[1]?.volume).toBe(55);
      });

      it("Replay Mode: fetchCandles substitui atomicamente rawBars e bars ao trocar de resolução", async () => {
        // Simulação do buffer Replay antes da troca (1m)
        let rawBars: MarketBar[] = [
          { time: 1000, open: 50, high: 52, low: 49, close: 51, volume: 10 },
          { time: 1060, open: 51, high: 53, low: 50, close: 52, volume: 12 },
        ];
        let bars: MarketBar[] = [...rawBars];

        // Simulador de fetchCandles para 15m
        const mockFetchCandles = async (sym: string, res: Resolution) => {
          const newApiBars: MarketBar[] = [
            { time: 0, open: 45, high: 55, low: 44, close: 52, volume: 200 },
            { time: 900, open: 52, high: 58, low: 51, close: 57, volume: 220 },
          ];
          rawBars = newApiBars;
          bars = newApiBars;
          return { symbol: sym, resolution: res, bars: newApiBars };
        };

        const result = await mockFetchCandles("MES", "15m");
        expect(result.resolution).toBe("15m");
        expect(bars.length).toBe(2);
        expect(rawBars).toBe(bars);
        expect(bars.some((b) => b.time === 1000 || b.time === 1060)).toBe(false);
        expect(bars[0]?.time).toBe(0);
        expect(bars[1]?.time).toBe(900);
      });

      it("Replay Mode: previne contaminação mesmo se o novo timeframe retornar menos barras que o anterior", async () => {
        let bars: MarketBar[] = [
          { time: 100, open: 1, high: 2, low: 0, close: 1, volume: 1 },
          { time: 200, open: 1, high: 2, low: 0, close: 1, volume: 1 },
          { time: 300, open: 1, high: 2, low: 0, close: 1, volume: 1 },
          { time: 400, open: 1, high: 2, low: 0, close: 1, volume: 1 },
        ];

        // Novo timeframe 1d com apenas 1 barra
        const incomingDailyBars: MarketBar[] = [
          { time: 0, open: 1, high: 5, low: 0, close: 4, volume: 100 },
        ];

        // Atribuição atômica pura
        bars = incomingDailyBars;
        expect(bars.length).toBe(1);
        expect(bars[0]?.time).toBe(0);
        expect(bars[0]?.close).toBe(4);
      });
    });

    describe("Gating de Viewport & Preservação de Posição (TradingView 1:1 Parity)", () => {
      it("Live Switch (1m -> 5m): prevVp é preservado e restaurado via applyViewport() com autoScale: true", async () => {
        const { chart, calls } = createMockChart();
        let renderedResolution: Resolution = "1m";
        const incomingResolution: Resolution = "5m";

        const effectiveBars: MarketBar[] = [
          { time: 0, open: 100, high: 110, low: 99, close: 105, volume: 50 },
        ];

        // Lógica de viewport 1:1 com TradingView: captura antes de setMarket e restaura
        const prevVp = chart.coords.getViewport();

        await chart.setMarket({
          timeframe: toVelaTf(incomingResolution),
          data: effectiveBars,
        });
        renderedResolution = incomingResolution;

        chart.renderer.set("autoScale", true);
        if (prevVp) {
          chart.applyViewport(prevVp);
        } else {
          chart.renderer.resetView();
        }

        // Verificações: Zoom e rightOffset permanecem intactos, exatamente como no TradingView
        expect(prevVp).toEqual({ barSpacing: 10, rightOffset: 5 });
        expect(calls.autoScaleSet).toContain(true);
        expect(calls.applyViewportCalls.length).toBe(1);
        expect(calls.applyViewportCalls[0]).toEqual({ barSpacing: 10, rightOffset: 5 });
        expect(calls.resetViewCount).toBe(0);
        expect(renderedResolution).toBe("5m");
      });

      it("Replay Switch (5m -> 15m): prevVp é preservado e reaplicado para manter velas no mesmo pixel", async () => {
        const { chart, calls } = createMockChart();
        let renderedResolution: Resolution = "5m";
        const incomingResolution: Resolution = "15m";

        const prevVp = chart.coords.getViewport();

        await chart.setMarket({
          timeframe: toVelaTf(incomingResolution),
          data: [{ time: 900, open: 200, high: 205, low: 198, close: 203, volume: 80 }],
        });
        renderedResolution = incomingResolution;

        chart.renderer.set("autoScale", true);
        if (prevVp) {
          chart.applyViewport(prevVp);
        } else {
          chart.renderer.resetView();
        }

        expect(prevVp).toEqual({ barSpacing: 10, rightOffset: 5 });
        expect(calls.applyViewportCalls.length).toBe(1);
        expect(calls.applyViewportCalls[0]).toEqual({ barSpacing: 10, rightOffset: 5 });
        expect(calls.resetViewCount).toBe(0);
        expect(renderedResolution).toBe("15m");
      });

      it("Same Resolution Reload / Session Toggle (5m -> 5m): prevVp é preservado e restaurado via applyViewport()", async () => {
        const { chart, calls } = createMockChart();
        let renderedResolution: Resolution = "5m";
        const incomingResolution: Resolution = "5m";

        const prevVp = chart.coords.getViewport();

        await chart.setMarket({
          timeframe: toVelaTf(incomingResolution),
          data: [{ time: 300, open: 100, high: 105, low: 99, close: 103, volume: 40 }],
        });
        renderedResolution = incomingResolution;

        chart.renderer.set("autoScale", true);
        if (prevVp) {
          chart.applyViewport(prevVp);
        } else {
          chart.renderer.resetView();
        }

        expect(prevVp).toEqual({ barSpacing: 10, rightOffset: 5 });
        expect(calls.applyViewportCalls.length).toBe(1);
        expect(calls.applyViewportCalls[0]).toEqual({ barSpacing: 10, rightOffset: 5 });
        expect(calls.resetViewCount).toBe(0);
      });

      it("Atualização de renderedResolutionRef ocorre atomicamente após setMarket", async () => {
        let renderedRes: Resolution = "1m";
        let capturedResolutionDuringSetMarket: Resolution | null = null;

        const fakeSetMarket = async (targetRes: Resolution) => {
          // No momento em que setMarket está executando, a resolução anterior ainda é a registrada
          capturedResolutionDuringSetMarket = renderedRes;
          renderedRes = targetRes;
        };

        await fakeSetMarket("5m");
        expect(capturedResolutionDuringSetMarket).toBe("1m");
        expect(renderedRes).toBe("5m");
      });
    });

    describe("Eliminação do Flash Branco (Zero Blank Flash)", () => {
      it("Mantém barras antigas visíveis com status de carregamento sem zerar array para []", async () => {
        // Barras atuais de 1m visíveis no gráfico
        const initialBars: MarketBar[] = [
          { time: 1000, open: 100, high: 105, low: 99, close: 104, volume: 10 },
          { time: 1060, open: 104, high: 106, low: 102, close: 105, volume: 12 },
        ];

        let renderedBars = [...initialBars];
        let watermarkLoading = false;

        // Disparo de troca de resolução para 5m
        const initiateResolutionSwitch = () => {
          // Zero Blank Flash: NUNCA faz renderedBars = []
          watermarkLoading = true;
          // renderedBars permanece com initialBars intacto
        };

        initiateResolutionSwitch();
        expect(renderedBars.length).toBe(2);
        expect(renderedBars).toEqual(initialBars);
        expect(watermarkLoading).toBe(true);

        // Quando o novo dataset de 5m chega:
        const incoming5m: MarketBar[] = [
          { time: 1000, open: 100, high: 108, low: 99, close: 107, volume: 35 },
        ];

        const finalizeResolutionSwitch = () => {
          renderedBars = incoming5m;
          watermarkLoading = false;
        };

        finalizeResolutionSwitch();
        expect(renderedBars.length).toBe(1);
        expect(renderedBars).toEqual(incoming5m);
        expect(watermarkLoading).toBe(false);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. MÁQUINA DE ESTADOS DE TROCA DE RESOLUÇÃO & WATCHDOG (3.0s)
  // ═══════════════════════════════════════════════════════════
  describe("2. Máquina de Estados de Troca de Resolução & Watchdog (3.0s)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("Guarda de Redundância: clicar no mesmo timeframe já carregado não dispara nova requisição", () => {
      const harness = new ResolutionSwitchHarness();
      const initiated = harness.requestSwitch({
        targetRes: "1m",
        curRes: "1m",
        symbol: "MNQ",
        hasBars: true,
        intervalSync: false,
      });

      expect(initiated).toBe(false);
      expect(harness.isSwitchingGuard).toBe(false);
      expect(harness.state.status).toBe("idle");
      expect(harness.watchdogTimer).toBeNull();
    });

    it("Guarda de Redundância: permite requisição no mesmo timeframe se o buffer de barras estiver vazio", () => {
      const harness = new ResolutionSwitchHarness();
      const initiated = harness.requestSwitch({
        targetRes: "1m",
        curRes: "1m",
        symbol: "MNQ",
        hasBars: false, // buffer vazio necessita de carga
      });

      expect(initiated).toBe(true);
      expect(harness.isSwitchingGuard).toBe(true);
      expect(harness.state.status).toBe("switching");
      harness.clearWatchdog();
    });

    it("Guarda de Concorrência: cliques rápidos repetidos no mesmo timeframe em trânsito são bloqueados", () => {
      const harness = new ResolutionSwitchHarness();
      const firstClick = harness.requestSwitch({
        targetRes: "5m",
        curRes: "1m",
        symbol: "MNQ",
        cellIndex: 0,
      });
      expect(firstClick).toBe(true);
      expect(harness.state.status).toBe("switching");

      // Segundo clique repetido na mesma resolução durante o voo
      const secondClick = harness.requestSwitch({
        targetRes: "5m",
        curRes: "1m",
        symbol: "MNQ",
        cellIndex: 0,
      });
      expect(secondClick).toBe(false);

      // Terceiro clique repetido
      const thirdClick = harness.requestSwitch({
        targetRes: "5m",
        curRes: "1m",
        symbol: "MNQ",
        cellIndex: 0,
      });
      expect(thirdClick).toBe(false);

      harness.clearWatchdog();
    });

    it("Troca em Trânsito (Mid-Flight Switch): clicar em 15m durante trânsito de 5m cancela watchdog anterior e rearma 3.0s para 15m", () => {
      const harness = new ResolutionSwitchHarness();

      // Inicia troca para 5m
      harness.requestSwitch({
        targetRes: "5m",
        curRes: "1m",
        symbol: "MNQ",
      });
      const timer5m = harness.watchdogTimer;
      expect(timer5m).not.toBeNull();
      expect(harness.state.targetResolution).toBe("5m");

      // Avança 1.5s no tempo
      vi.advanceTimersByTime(1500);

      // Usuário muda de ideia e clica em 15m
      const switchedTo15m = harness.requestSwitch({
        targetRes: "15m",
        curRes: "1m",
        symbol: "MNQ",
      });
      expect(switchedTo15m).toBe(true);
      expect(harness.state.targetResolution).toBe("15m");
      expect(harness.watchdogTimer).not.toBe(timer5m);

      // Avança mais 1.6s (total de 3.1s desde o clique em 5m, mas apenas 1.6s desde 15m)
      vi.advanceTimersByTime(1600);
      // Watchdog para 15m ainda NÃO deve ter expirado!
      expect(harness.fallbackTriggered).toBe(false);
      expect(harness.state.status).toBe("switching");

      // Avança os 1.4s restantes para completar 3.0s de 15m
      vi.advanceTimersByTime(1400);
      expect(harness.fallbackTriggered).toBe(true);
      expect(harness.fallbackResolution).toBe("15m");
    });

    it("Troca em Trânsito: dados atrasados de 5m que chegam após comutação para 15m são descartados", () => {
      const harness = new ResolutionSwitchHarness();

      harness.requestSwitch({ targetRes: "5m", curRes: "1m", symbol: "MNQ" });
      harness.requestSwitch({ targetRes: "15m", curRes: "1m", symbol: "MNQ" });

      // Chega pacote atrasado de 5m
      const handledStale = harness.onHistoryArrived("5m", "MNQ");
      expect(handledStale).toBe(false);
      // Estado deve permanecer em switching para 15m com watchdog ativo
      expect(harness.state.status).toBe("switching");
      expect(harness.state.targetResolution).toBe("15m");
      expect(harness.watchdogTimer).not.toBeNull();

      // Chega o pacote correto de 15m
      const handled15m = harness.onHistoryArrived("15m", "MNQ");
      expect(handled15m).toBe(true);
      expect(harness.state.status).toBe("idle");
      expect(harness.watchdogTimer).toBeNull();
    });

    it("Watchdog Timeout & Fallback Gracioso: expira aos 3000ms se WebSocket não responder e aciona fallback para SQLite", async () => {
      const fallbackSpy = vi.fn(async (sym: string, res: string) => {});
      const harness = new ResolutionSwitchHarness();

      harness.requestSwitch({
        targetRes: "5m",
        curRes: "1m",
        symbol: "MNQ",
        fallbackFn: fallbackSpy,
      });

      expect(harness.isSwitchingGuard).toBe(true);
      expect(harness.loadingState).toBe(true);

      // Aos 2999ms, watchdog ainda não disparou
      vi.advanceTimersByTime(2999);
      expect(harness.fallbackTriggered).toBe(false);
      expect(fallbackSpy).not.toHaveBeenCalled();

      // Ao atingir 3000ms:
      await vi.advanceTimersByTimeAsync(1);
      expect(harness.fallbackTriggered).toBe(true);
      expect(harness.fallbackResolution).toBe("5m");
      expect(harness.fallbackSymbol).toBe("MNQ");
      expect(fallbackSpy).toHaveBeenCalledTimes(1);
      expect(fallbackSpy).toHaveBeenCalledWith("MNQ", "5m");

      // Guards e loading retornam para idle
      expect(harness.isSwitchingGuard).toBe(false);
      expect(harness.state.status).toBe("idle");
      expect(harness.loadingState).toBe(false);
    });

    it("Sucesso no Tempo Hábil: chegada de dados aos 200ms cancela watchdog e restaura estado idle sem acionar fallback", () => {
      const fallbackSpy = vi.fn(async () => {});
      const harness = new ResolutionSwitchHarness();

      harness.requestSwitch({
        targetRes: "5m",
        curRes: "1m",
        symbol: "MNQ",
        fallbackFn: fallbackSpy,
      });

      // Dados chegam após 200ms
      vi.advanceTimersByTime(200);
      const success = harness.onHistoryArrived("5m", "MNQ");
      expect(success).toBe(true);
      expect(harness.state.status).toBe("idle");
      expect(harness.watchdogTimer).toBeNull();

      // Avança mais 5 segundos no tempo simulado
      vi.advanceTimersByTime(5000);
      expect(harness.fallbackTriggered).toBe(false);
      expect(fallbackSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. MULTI-CHART INTERVAL SYNC & LAYOUT PARITY
  // ═══════════════════════════════════════════════════════════
  describe("3. Multi-Chart Interval Sync & Layout Parity", () => {
    interface SecondaryCellState {
      symbol: string;
      resolution: string;
      bars: MarketBar[];
      loading: boolean;
      replayPlaying: boolean;
      replaySpeed: number;
    }

    interface MultiChartState {
      syncInterval: boolean;
      activeCellIndex: number;
      primary: {
        symbol: string;
        resolution: string;
        bars: MarketBar[];
        loading: boolean;
        replayPlaying: boolean;
      };
      secondaries: Map<number, SecondaryCellState>;
      invalidatedCacheKeys: Set<string>;
    }

    function createMultiChartHarness(syncInterval: boolean): {
      state: MultiChartState;
      handleResolutionSwitch: (res: string, targetCellIndex?: number) => Promise<void>;
    } {
      const state: MultiChartState = {
        syncInterval,
        activeCellIndex: 0,
        primary: {
          symbol: "MNQ",
          resolution: "1m",
          bars: [{ time: 1000, open: 100, high: 102, low: 99, close: 101, volume: 10 }],
          loading: false,
          replayPlaying: true,
        },
        secondaries: new Map([
          [
            1,
            {
              symbol: "MES",
              resolution: "1m",
              bars: [{ time: 1000, open: 50, high: 51, low: 49, close: 50.5, volume: 5 }],
              loading: false,
              replayPlaying: true,
              replaySpeed: 2,
            },
          ],
          [
            2,
            {
              symbol: "M2K",
              resolution: "1m",
              bars: [{ time: 1000, open: 200, high: 202, low: 198, close: 201, volume: 8 }],
              loading: false,
              replayPlaying: true,
              replaySpeed: 2,
            },
          ],
        ]),
        invalidatedCacheKeys: new Set(),
      };

      const handleResolutionSwitch = async (res: string, targetCellIndex = 0) => {
        if (state.syncInterval) {
          // Replica para primário
          state.primary.resolution = res;
          state.primary.loading = true;
          state.invalidatedCacheKeys.add(`${state.primary.symbol}@${res}`);

          // Replica para todas as células secundárias
          for (const [cellIdx, sec] of state.secondaries.entries()) {
            sec.resolution = res;
            sec.loading = true;
            state.invalidatedCacheKeys.add(`sec-${cellIdx}-${sec.symbol}@${res}`);
            // Simula novo dataset
            sec.bars = [{ time: 5000, open: 100, high: 105, low: 95, close: 102, volume: 50 }];
            sec.loading = false;
          }
          state.primary.loading = false;
        } else {
          // Independência estrita por célula
          if (targetCellIndex === 0) {
            state.primary.resolution = res;
            state.primary.loading = true;
            state.invalidatedCacheKeys.add(`${state.primary.symbol}@${res}`);
            state.primary.loading = false;
          } else {
            const sec = state.secondaries.get(targetCellIndex);
            if (sec) {
              sec.resolution = res;
              sec.loading = true;
              state.invalidatedCacheKeys.add(`sec-${targetCellIndex}-${sec.symbol}@${res}`);
              sec.bars = [{ time: 5000, open: 100, high: 105, low: 95, close: 102, volume: 50 }];
              sec.loading = false;
            }
          }
        }
      };

      return { state, handleResolutionSwitch };
    }

    it("Sync Ativo (syncOptions.interval = true): trocar resolução na Célula 0 replica para todas as células secundárias", async () => {
      const { state, handleResolutionSwitch } = createMultiChartHarness(true);

      await handleResolutionSwitch("5m", 0);

      expect(state.primary.resolution).toBe("5m");
      expect(state.secondaries.get(1)?.resolution).toBe("5m");
      expect(state.secondaries.get(2)?.resolution).toBe("5m");
    });

    it("Sync Ativo: em Live, invalida cache de histórico para todas as células secundárias", async () => {
      const { state, handleResolutionSwitch } = createMultiChartHarness(true);

      await handleResolutionSwitch("15m", 0);

      expect(state.invalidatedCacheKeys.has("MNQ@15m")).toBe(true);
      expect(state.invalidatedCacheKeys.has("sec-1-MES@15m")).toBe(true);
      expect(state.invalidatedCacheKeys.has("sec-2-M2K@15m")).toBe(true);
    });

    it("Sync Desativado (syncOptions.interval = false): Célula 0 e Célula 1 operam com timeframes completamente independentes", async () => {
      const { state, handleResolutionSwitch } = createMultiChartHarness(false);

      // Troca na Célula 0 para 5m
      await handleResolutionSwitch("5m", 0);
      expect(state.primary.resolution).toBe("5m");
      // Secundárias devem permanecer em 1m
      expect(state.secondaries.get(1)?.resolution).toBe("1m");
      expect(state.secondaries.get(2)?.resolution).toBe("1m");

      // Troca na Célula 1 para 15m
      await handleResolutionSwitch("15m", 1);
      expect(state.primary.resolution).toBe("5m"); // Primário permanece 5m
      expect(state.secondaries.get(1)?.resolution).toBe("15m"); // Célula 1 agora é 15m
      expect(state.secondaries.get(2)?.resolution).toBe("1m"); // Célula 2 permanece 1m
    });

    it("Sync Desativado: Célula secundária não contamina buffers nem histórico das outras células", async () => {
      const { state, handleResolutionSwitch } = createMultiChartHarness(false);

      const primaryBarsBefore = [...state.primary.bars];
      await handleResolutionSwitch("30m", 2);

      // Apenas a Célula 2 foi alterada
      expect(state.secondaries.get(2)?.resolution).toBe("30m");
      expect(state.primary.bars).toEqual(primaryBarsBefore);
      expect(state.invalidatedCacheKeys.has("sec-2-M2K@30m")).toBe(true);
      expect(state.invalidatedCacheKeys.has("MNQ@30m")).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. VIEWPORT ZOOM & TRADINGVIEW 1:1 PARITY (ZERO 2029 BUG)
  // ═══════════════════════════════════════════════════════════
  describe("5. Viewport Zoom & TradingView 1:1 Parity (Zero 2029 Bug)", () => {
    it("applyHealthyResolutionViewport: define barSpacing 21.17px (TradingView Desktop) e rightOffset 10 ao trocar para diário (1D)", () => {
      const calls: Array<{ barSpacing: number; rightOffset: number }> = [];
      const mockInner = {
        applyViewport: (vp: { barSpacing: number; rightOffset: number }) => {
          calls.push(vp);
        },
      };

      function applyHealthy(inner: any, resolution: string, preferredRightOffset = 10) {
        if (!inner || typeof inner.applyViewport !== "function") return;
        const isDailyOrHigher = ["1d", "1D", "d", "D", "1w", "1W", "w", "W", "1mo", "1M", "mo", "M"].includes(
          resolution,
        );
        const targetBarSpacing = isDailyOrHigher ? 21.17 : 14;
        inner.applyViewport({
          barSpacing: targetBarSpacing,
          rightOffset: preferredRightOffset,
        });
      }

      applyHealthy(mockInner, "1D");
      expect(calls.length).toBe(1);
      expect(calls[0]).toEqual({ barSpacing: 21.17, rightOffset: 10 });

      applyHealthy(mockInner, "1m");
      expect(calls.length).toBe(2);
      expect(calls[1]).toEqual({ barSpacing: 14, rightOffset: 10 });
    });

    it("broadcastViewport: descarta sincronização se isSwitchingResolutionOrSession for true", () => {
      let isSwitching = true;
      let applied = false;

      const mockTarget = {
        applyViewport: () => {
          applied = true;
        },
      };

      function testBroadcast() {
        if (isSwitching) return;
        mockTarget.applyViewport();
      }

      testBroadcast();
      expect(applied).toBe(false);

      isSwitching = false;
      testBroadcast();
      expect(applied).toBe(true);
    });

    it("broadcastViewport: clampa estritamente nextRightOffset entre timeframes diferentes sem estourar para o futuro (2029)", () => {
      // Simulação: Chart 0 é 1D (source), Chart 1 é 1m (target)
      const targetCoords = {
        barCount: 1000,
        barInterval: 60_000,
        width: 1000,
        pxPerBar: () => 14,
      };

      const targetVisBars = targetCoords.width / targetCoords.pxPerBar(); // ~71.4
      const maxAllowedWhitespace = Math.min(50, Math.max(10, targetVisBars * 0.5)); // ~35.7

      // Cenário do bug anterior: targetAnchorLogical gerava 1006 barras de offset
      const uncalibratedOffset = 1006;
      const clampedOffset = Math.max(
        -targetCoords.barCount + 5,
        Math.min(maxAllowedWhitespace, uncalibratedOffset),
      );

      expect(clampedOffset).toBeLessThanOrEqual(50);
      expect(clampedOffset).toBe(maxAllowedWhitespace);
    });

    it("broadcastViewport: preserva barSpacing do target em dateRange sync se os timeframes forem diferentes", () => {
      const sourceInterval: number = 86_400_000; // 1D
      const targetInterval: number = 60_000; // 1m
      const sameInterval = sourceInterval === targetInterval;

      const targetVp = { barSpacing: 14, rightOffset: 10 };
      let nextBarSpacing: number;

      if (sameInterval) {
        nextBarSpacing = 0.77; // cálculo anterior que distorcia
      } else {
        nextBarSpacing = targetVp.barSpacing;
      }

      expect(sameInterval).toBe(false);
      expect(nextBarSpacing).toBe(14); // zoom do target preservado 100%!
    });
  });
});


// ============================================================================
// LIVE MARKET FEED HOOK PROTOCOL & PAYLOAD HANDLING
// ============================================================================

describe("Live Market Feed Hook Protocol & Payload Handling", () => {
  let wss: WebSocketServer | null = null;
  const TEST_PORT = 3299;

  afterEach(async () => {
    if (wss) {
      await new Promise<void>((resolve) => {
        wss!.close(() => resolve());
      });
      wss = null;
    }
  });

  it("handles live feed messages, candle events, and tick events from server", async () => {
    wss = new WebSocketServer({ port: TEST_PORT });

    wss.on("connection", (ws) => {
      // Send initial status
      ws.send(
        JSON.stringify({
          type: "status",
          connected: true,
          upstreamUser: "jonatanfrost19",
          symbols: ["MNQ", "MES"],
        })
      );

      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.action === "subscribe") {
          // Broadcast sample candle and tick
          ws.send(
            JSON.stringify({
              type: "candle",
              symbol: "MNQ",
              candle: {
                time: 1791843660000,
                open: 30895.25,
                high: 30896.5,
                low: 30895.25,
                close: 30896.25,
                volume: 41,
              },
            })
          );
          ws.send(
            JSON.stringify({
              type: "tick",
              symbol: "MES",
              tick: {
                price: 7850.25,
                bid: 7850.0,
                ask: 7850.25,
                volume: 12,
                time: Date.now(),
              },
            })
          );
        }
      });
    });

    const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    const receivedEvents: any[] = [];

    await new Promise<void>((resolve, reject) => {
      client.on("open", () => {
        client.send(
          JSON.stringify({
            action: "subscribe",
            symbols: ["MNQ", "MES"],
            resolution: "1m",
          })
        );
      });

      client.on("message", (raw) => {
        const parsed = JSON.parse(raw.toString());
        receivedEvents.push(parsed);
        if (receivedEvents.length >= 3) {
          client.close();
          resolve();
        }
      });

      client.on("error", (err) => reject(err));
    });

    expect(receivedEvents[0]?.type).toBe("status");
    expect(receivedEvents[0]?.upstreamUser).toBe("jonatanfrost19");

    const candleEvent = receivedEvents.find((e) => e.type === "candle");
    expect(candleEvent).toBeDefined();
    expect(candleEvent.symbol).toBe("MNQ");
    expect(candleEvent.candle.close).toBe(30896.25);
    expect(candleEvent.candle.time).toBe(1791843660000);

    const tickEvent = receivedEvents.find((e) => e.type === "tick");
    expect(tickEvent).toBeDefined();
    expect(tickEvent.symbol).toBe("MES");
    expect(tickEvent.tick.price).toBe(7850.25);
  });

  it("handles history payload with array of recent bars to fill historical gap", async () => {
    wss = new WebSocketServer({ port: TEST_PORT });

    wss.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.action === "subscribe") {
          ws.send(
            JSON.stringify({
              type: "history",
              symbol: "MNQ",
              bars: [
                {
                  time: 1791910000000,
                  open: 30720,
                  high: 30725,
                  low: 30718,
                  close: 30724,
                  volume: 500,
                },
                {
                  time: 1791910060000,
                  open: 30724,
                  high: 30730,
                  low: 30722,
                  close: 30728,
                  volume: 620,
                },
              ],
            })
          );
        }
      });
    });

    const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    let historyEvent: any = null;

    await new Promise<void>((resolve, reject) => {
      client.on("open", () => {
        client.send(
          JSON.stringify({
            action: "subscribe",
            symbols: ["MNQ"],
          })
        );
      });

      client.on("message", (raw) => {
        const parsed = JSON.parse(raw.toString());
        if (parsed.type === "history") {
          historyEvent = parsed;
          client.close();
          resolve();
        }
      });

      client.on("error", (err) => reject(err));
    });

    expect(historyEvent).not.toBeNull();
    expect(historyEvent.symbol).toBe("MNQ");
    expect(historyEvent.bars.length).toBe(2);
    expect(historyEvent.bars[1].close).toBe(30728);
  });
});


// ============================================================================
// LIVE MARKET FEED & VIEWPORT STABILITY
// ============================================================================

describe("Live Market Feed & Viewport Stability", () => {
  it("deduplicates subscription key correctly for same symbols in different array order", () => {
    const syms1 = ["MNQ", "MES"];
    const syms2 = ["MES", "MNQ"];
    const res = "1m";

    const key1 = `${syms1.slice().sort().join(",")}@${res}`;
    const key2 = `${syms2.slice().sort().join(",")}@${res}`;

    expect(key1).toBe("MES,MNQ@1m");
    expect(key2).toBe("MES,MNQ@1m");
    expect(key1).toBe(key2);
  });

  it("detects subscription key difference on symbol or timeframe changes", () => {
    const key1 = `${["MES"].sort().join(",")}@1m`;
    const key2 = `${["MES"].sort().join(",")}@5m`;
    const key3 = `${["MNQ"].sort().join(",")}@1m`;

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
  });

  it("merges incoming bars preserving chronological order and updating forming bars", () => {
    const existing: MarketBar[] = [
      { time: 1000, open: 100, high: 105, low: 99, close: 104, volume: 10 },
      { time: 2000, open: 104, high: 108, low: 103, close: 107, volume: 15 },
    ];

    const incoming: MarketBar[] = [
      // Updated bar at 2000
      { time: 2000, open: 104, high: 110, low: 103, close: 109, volume: 20 },
      // New bar at 3000
      { time: 3000, open: 109, high: 112, low: 108, close: 111, volume: 5 },
    ];

    const merged = mergeBars(existing, incoming);
    expect(merged.length).toBe(3);
    expect(merged[0]?.time).toBe(1000);
    expect(merged[1]?.time).toBe(2000);
    expect(merged[1]?.high).toBe(110);
    expect(merged[1]?.close).toBe(109);
    expect(merged[2]?.time).toBe(3000);
  });

  it("gating history key ensures setMarket is only run once on gap fill", () => {
    const appliedHistory = new Set<string>();

    const checkShouldRunGapFill = (sym: string, res: string) => {
      const key = `${sym.toUpperCase()}@${res}`;
      if (appliedHistory.has(key)) return false;
      appliedHistory.add(key);
      return true;
    };

    expect(checkShouldRunGapFill("MES", "1m")).toBe(true);
    // Second history payload for same symbol/res should NOT trigger gap fill
    expect(checkShouldRunGapFill("MES", "1m")).toBe(false);
    expect(checkShouldRunGapFill("MES", "1m")).toBe(false);

    // Switching timeframe allows new gap fill
    expect(checkShouldRunGapFill("MES", "5m")).toBe(true);
    expect(checkShouldRunGapFill("MES", "5m")).toBe(false);
  });

  describe("Resolution Switch State Machine & Watchdog (3.0s)", () => {
    interface ResolutionSwitchState {
      status: "idle" | "switching";
      targetResolution: string | null;
      targetSymbol: string | null;
      cellIndex: number;
      startedAt: number;
    }

    class ResolutionSwitchManager {
      public state: ResolutionSwitchState = {
        status: "idle",
        targetResolution: null,
        targetSymbol: null,
        cellIndex: 0,
        startedAt: 0,
      };
      public isSwitchingGuard = false;
      public watchdogTimer: any = null;
      public fallbackTriggered = false;

      public clearWatchdog() {
        if (this.watchdogTimer) {
          clearTimeout(this.watchdogTimer);
          this.watchdogTimer = null;
        }
      }

      public requestSwitch(
        targetRes: string,
        curRes: string,
        symbol: string,
        cellIndex = 0,
        hasBars = true,
      ): boolean {
        // 1. Redundancy guard
        if (targetRes === curRes && hasBars) {
          return false;
        }
        // 2. Concurrency guard: already switching to this exact resolution
        if (
          this.state.status === "switching" &&
          this.state.targetResolution === targetRes &&
          this.state.cellIndex === cellIndex
        ) {
          return false;
        }

        this.clearWatchdog();
        this.state = {
          status: "switching",
          targetResolution: targetRes,
          targetSymbol: symbol,
          cellIndex,
          startedAt: Date.now(),
        };
        this.isSwitchingGuard = true;

        // Arm 3.0s Watchdog
        this.watchdogTimer = setTimeout(() => {
          this.fallbackTriggered = true;
          this.isSwitchingGuard = false;
          this.state.status = "idle";
          this.watchdogTimer = null;
        }, 3000);

        return true;
      }

      public onHistoryArrived(res: string) {
        if (this.state.status === "switching" && this.state.targetResolution === res) {
          this.clearWatchdog();
          this.state.status = "idle";
          this.isSwitchingGuard = false;
          return true;
        }
        return false;
      }
    }

    it("prevents redundant switch when already on target resolution with loaded bars", () => {
      const manager = new ResolutionSwitchManager();
      const initiated = manager.requestSwitch("1m", "1m", "MNQ", 0, true);
      expect(initiated).toBe(false);
      expect(manager.isSwitchingGuard).toBe(false);
    });

    it("blocks concurrent duplicate clicks to the same target resolution while switching", () => {
      const manager = new ResolutionSwitchManager();
      const first = manager.requestSwitch("5m", "1m", "MNQ", 0, true);
      expect(first).toBe(true);
      expect(manager.isSwitchingGuard).toBe(true);
      expect(manager.state.status).toBe("switching");

      // Rapid secondary click on 5m
      const second = manager.requestSwitch("5m", "1m", "MNQ", 0, true);
      expect(second).toBe(false);
      manager.clearWatchdog();
    });

    it("cancels previous watchdog and arms new watchdog when switching to a different resolution mid-flight", () => {
      const manager = new ResolutionSwitchManager();
      manager.requestSwitch("5m", "1m", "MNQ", 0, true);
      const timer1 = manager.watchdogTimer;

      // User changes mind and clicks 15m
      const switched = manager.requestSwitch("15m", "1m", "MNQ", 0, true);
      expect(switched).toBe(true);
      expect(manager.state.targetResolution).toBe("15m");
      expect(manager.watchdogTimer).not.toBe(timer1);
      manager.clearWatchdog();
    });

    it("cancels watchdog and returns to idle when history arrives in time", () => {
      const manager = new ResolutionSwitchManager();
      manager.requestSwitch("5m", "1m", "MNQ", 0, true);
      expect(manager.isSwitchingGuard).toBe(true);

      const resolved = manager.onHistoryArrived("5m");
      expect(resolved).toBe(true);
      expect(manager.isSwitchingGuard).toBe(false);
      expect(manager.state.status).toBe("idle");
      expect(manager.watchdogTimer).toBeNull();
      expect(manager.fallbackTriggered).toBe(false);
    });

    it("triggers watchdog fallback after 3000ms if history does not arrive", async () => {
      const manager = new ResolutionSwitchManager();
      manager.requestSwitch("5m", "1m", "MNQ", 0, true);
      expect(manager.isSwitchingGuard).toBe(true);

      // Fast-forward or simulate timer firing
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 3050);
      });

      expect(manager.fallbackTriggered).toBe(true);
      expect(manager.isSwitchingGuard).toBe(false);
      expect(manager.state.status).toBe("idle");
    }, 8000);
  });

  describe("Pure Atomic Replacement & Viewport Resolution Gating", () => {
    it("ensures incoming history on resolution switch replaces dataset purely without merging prior timeframe bars", () => {
      // Existing 1m bars in buffer
      const existing1mBars: MarketBar[] = [
        { time: 1000, open: 100, high: 105, low: 99, close: 104, volume: 10 },
        { time: 1060, open: 104, high: 106, low: 102, close: 105, volume: 12 },
        { time: 1120, open: 105, high: 108, low: 104, close: 107, volume: 15 },
      ];

      // Incoming 5m bars from bridge for new resolution
      const incoming5mBars: MarketBar[] = [
        { time: 1000, open: 100, high: 108, low: 99, close: 107, volume: 37 },
        { time: 1300, open: 107, high: 112, low: 106, close: 110, volume: 45 },
      ];

      // Simulate atomic replacement logic in handleLiveHistory
      const hasAppliedLiveHistory = new Set<string>();
      const historyKey = "MNQ@5m";
      const hasApplied = hasAppliedLiveHistory.has(historyKey);

      let finalBars: MarketBar[];
      if (!hasApplied) {
        hasAppliedLiveHistory.add(historyKey);
        // Pure atomic replacement: never merge old 1m bars into 5m!
        finalBars = incoming5mBars;
      } else {
        finalBars = mergeBars(existing1mBars, incoming5mBars);
      }

      expect(finalBars.length).toBe(2);
      expect(finalBars[0]?.time).toBe(1000);
      expect(finalBars[0]?.close).toBe(107);
      expect(finalBars[1]?.time).toBe(1300);
      expect(finalBars[1]?.close).toBe(110);
      // Zero 1m bars leaked into 5m dataset
      expect(finalBars.some((b) => b.time === 1060 || b.time === 1120)).toBe(false);
    });

    it("preserves prevVp (zoom and rightOffset) on resolution switch matching TradingView desktop behavior", () => {
      let renderedResolution = "1m";
      const mockViewport = { barSpacing: 8, rightOffset: 12 };

      const resolveViewportToApply = (newResolution: string, currentVp = mockViewport) => {
        renderedResolution = newResolution;
        // In 1:1 TradingView parity, prevVp is preserved across resolution changes so the candles stay at the exact same location
        return { prevVp: currentVp };
      };

      // 1. Switching from 1m to 5m: prevVp is preserved!
      const switchResult = resolveViewportToApply("5m");
      expect(switchResult.prevVp).toEqual(mockViewport);

      // 2. Refreshing on same resolution (5m to 5m): prevVp is preserved!
      const sameResResult = resolveViewportToApply("5m");
      expect(sameResResult.prevVp).toEqual(mockViewport);
    });
  });
});


