import {
  ChartAlert,
  AlertLogItem,
  AlertConditionType,
} from "./types";
import { alertsStore, AlertsStore } from "./alerts-store";
import { alertAudioEngine, AlertAudioEngine } from "./alert-audio-engine";

export interface MarketBar {
  open: number;
  high: number;
  low: number;
  close: number;
  time?: number;
}

export type AlertFireListener = (alert: ChartAlert, log: AlertLogItem) => void;

export class AlertEvaluationEngine {
  private static instance: AlertEvaluationEngine | null = null;
  private store: AlertsStore;
  private audioEngine: AlertAudioEngine;
  private lastPrices: Map<string, number> = new Map();
  private lastBarCloses: Map<string, number> = new Map();
  private listeners: Set<AlertFireListener> = new Set();
  private firedThisBar: Map<string, Set<string>> = new Map(); // barKey -> Set<alertId>

  public constructor(store = alertsStore, audioEngine = alertAudioEngine) {
    this.store = store;
    this.audioEngine = audioEngine;
  }

  public static getInstance(): AlertEvaluationEngine {
    if (!AlertEvaluationEngine.instance) {
      AlertEvaluationEngine.instance = new AlertEvaluationEngine();
    }
    return AlertEvaluationEngine.instance;
  }

  public onAlertFired(listener: AlertFireListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyFired(alert: ChartAlert, log: AlertLogItem): void {
    for (const listener of this.listeners) {
      try {
        listener(alert, log);
      } catch (err) {
        console.error("[AlertEvaluationEngine] Error in listener:", err);
      }
    }
  }

  /**
   * Reset internal price memory (e.g. when changing symbols or restarting replay).
   */
  public reset(symbol?: string): void {
    if (symbol) {
      const sym = symbol.toUpperCase();
      this.lastPrices.delete(sym);
      this.lastBarCloses.delete(sym);
      this.firedThisBar.delete(sym);
    } else {
      this.lastPrices.clear();
      this.lastBarCloses.clear();
      this.firedThisBar.clear();
    }
  }

  /**
   * Check if alert is expired. If expired, automatically pauses it.
   */
  private isExpired(alert: ChartAlert, now = Date.now()): boolean {
    if (!alert.expiration) return false;
    const expTime = new Date(alert.expiration).getTime();
    if (Number.isFinite(expTime) && expTime < now) {
      this.store.updateAlert(alert.id, { status: "paused" });
      return true;
    }
    return false;
  }

  /**
   * Evaluates if a tick price change meets the alert condition.
   */
  public isConditionMetByTick(
    condition: AlertConditionType,
    targetPrice: number,
    currentPrice: number,
    previousPrice?: number,
    upperPrice?: number,
    lowerPrice?: number,
  ): boolean {
    const prev = previousPrice ?? currentPrice;

    switch (condition) {
      case "crossing":
        return (
          (prev < targetPrice && currentPrice >= targetPrice) ||
          (prev > targetPrice && currentPrice <= targetPrice) ||
          currentPrice === targetPrice
        );

      case "crossing_up":
        return prev <= targetPrice && currentPrice > targetPrice;

      case "crossing_down":
        return prev >= targetPrice && currentPrice < targetPrice;

      case "greater_than":
        return currentPrice > targetPrice;

      case "less_than":
        return currentPrice < targetPrice;

      case "entering_channel": {
        const lower = lowerPrice ?? targetPrice;
        const upper = upperPrice ?? targetPrice;
        const wasOutside = prev < lower || prev > upper;
        const isInside = currentPrice >= lower && currentPrice <= upper;
        return wasOutside && isInside;
      }

      case "exiting_channel": {
        const lower = lowerPrice ?? targetPrice;
        const upper = upperPrice ?? targetPrice;
        const wasInside = prev >= lower && prev <= upper;
        const isOutside = currentPrice < lower || currentPrice > upper;
        return wasInside && isOutside;
      }

      case "inside_channel": {
        const lower = lowerPrice ?? targetPrice;
        const upper = upperPrice ?? targetPrice;
        return currentPrice >= lower && currentPrice <= upper;
      }

      case "outside_channel": {
        const lower = lowerPrice ?? targetPrice;
        const upper = upperPrice ?? targetPrice;
        return currentPrice < lower || currentPrice > upper;
      }

      case "moving_up":
        return currentPrice > prev;

      case "moving_down":
        return currentPrice < prev;

      default:
        return false;
    }
  }

  /**
   * Evaluates if a bar/candle (using high and low extremes) meets the alert condition.
   */
  public isConditionMetByBar(
    condition: AlertConditionType,
    targetPrice: number,
    bar: MarketBar,
    previousClose?: number,
    upperPrice?: number,
    lowerPrice?: number,
  ): boolean {
    const prevClose = previousClose ?? bar.open;

    switch (condition) {
      case "crossing":
        return bar.low <= targetPrice && targetPrice <= bar.high;

      case "crossing_up":
        return prevClose <= targetPrice && bar.high >= targetPrice;

      case "crossing_down":
        return prevClose >= targetPrice && bar.low <= targetPrice;

      case "greater_than":
        return bar.high > targetPrice;

      case "less_than":
        return bar.low < targetPrice;

      case "entering_channel": {
        const lower = lowerPrice ?? targetPrice;
        const upper = upperPrice ?? targetPrice;
        const wasOutside = prevClose < lower || prevClose > upper;
        const isInside =
          (bar.low >= lower && bar.low <= upper) ||
          (bar.high >= lower && bar.high <= upper) ||
          (bar.close >= lower && bar.close <= upper);
        return wasOutside && isInside;
      }

      case "exiting_channel": {
        const lower = lowerPrice ?? targetPrice;
        const upper = upperPrice ?? targetPrice;
        const wasInside = prevClose >= lower && prevClose <= upper;
        const isOutside = bar.low < lower || bar.high > upper;
        return wasInside && isOutside;
      }

      case "inside_channel": {
        const lower = lowerPrice ?? targetPrice;
        const upper = upperPrice ?? targetPrice;
        return bar.close >= lower && bar.close <= upper;
      }

      case "outside_channel": {
        const lower = lowerPrice ?? targetPrice;
        const upper = upperPrice ?? targetPrice;
        return bar.close < lower || bar.close > upper;
      }

      case "moving_up":
        return bar.close > prevClose;

      case "moving_down":
        return bar.close < prevClose;

      default:
        return false;
    }
  }

  /**
   * Interpolate TradingView alert message placeholders (e.g. {{ticker}}, {{close}}, {{time}}, {{plot_0}}).
   */
  public interpolateMessage(
    template: string,
    alert: ChartAlert,
    firedPrice: number,
  ): string {
    if (!template) return `${alert.symbol} Crossing ${firedPrice}`;

    const now = new Date();
    const timeIso = now.toISOString();
    const timeFormatted = now.toLocaleTimeString("en-US", { hour12: false });
    const dateFormatted = now.toISOString().slice(0, 10);

    return template
      .replace(/\{\{ticker\}\}/gi, alert.symbol)
      .replace(/\{\{close\}\}/gi, firedPrice.toString())
      .replace(/\{\{price\}\}/gi, firedPrice.toString())
      .replace(/\{\{time\}\}/gi, timeFormatted)
      .replace(/\{\{timenow\}\}/gi, timeIso)
      .replace(/\{\{date\}\}/gi, dateFormatted)
      .replace(/\{\{interval\}\}/gi, "1m")
      .replace(/\{\{plot_0\}\}/gi, alert.targetPrice.toString())
      .replace(/\{\{exchange\}\}/gi, "CME")
      .replace(/\{\{condition\}\}/gi, alert.conditionType);
  }

  /**
   * Execute alert triggering actions (audio, logs, store updates, listeners).
   */
  private triggerAlert(alert: ChartAlert, firedPrice: number): AlertLogItem {
    const now = Date.now();
    const finalMessage = this.interpolateMessage(alert.message, alert, firedPrice);

    // 1. Create log item
    const logItem = this.store.addLogItem({
      alertId: alert.id,
      symbol: alert.symbol,
      firedPrice,
      conditionType: alert.conditionType,
      message: finalMessage,
    });

    // 2. Update alert in store
    const updates: Partial<ChartAlert> = {
      lastFiredAt: now,
      fireCount: (alert.fireCount || 0) + 1,
    };

    if (alert.frequency === "once_only") {
      updates.status = "triggered";
    }

    this.store.updateAlert(alert.id, updates);

    // 3. Play sound if configured
    if (alert.notifications?.playSound) {
      void this.audioEngine.play(alert.notifications.soundName || "fired", {
        durationSeconds: alert.notifications.soundDurationSeconds || 0,
        loopId: `alert-${alert.id}`,
      });
    }

    // 4. Dispatch webhook if configured
    if (alert.notifications?.webhookUrl) {
      this.dispatchWebhook({ ...alert, message: finalMessage }, logItem);
    }

    // 5. Notify subscribers (for toasts or UI popups)
    this.notifyFired({ ...alert, message: finalMessage }, logItem);

    return logItem;
  }

  private dispatchWebhook(alert: ChartAlert, log: AlertLogItem): void {
    if (!alert.notifications?.webhookUrl || typeof fetch === "undefined") return;
    try {
      void fetch(alert.notifications.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_id: alert.id,
          symbol: alert.symbol,
          price: log.firedPrice,
          message: alert.message,
          condition: alert.conditionType,
          timestamp: new Date(log.timestamp).toISOString(),
        }),
      }).catch((e) => {
        console.warn("[AlertEvaluationEngine] Webhook failed:", e);
      });
    } catch {
      // Ignored
    }
  }

  /**
   * Evaluate tick update (live feed or tick-by-tick replay).
   */
  public evaluateTick(
    symbol: string,
    currentPrice: number,
    previousPrice?: number,
  ): AlertLogItem[] {
    const sym = symbol.toUpperCase().trim();
    const prev = previousPrice ?? this.lastPrices.get(sym) ?? currentPrice;
    this.lastPrices.set(sym, currentPrice);

    const activeAlerts = this.store.getActiveAlertsForSymbol(sym);
    if (!activeAlerts.length) return [];

    const firedLogs: AlertLogItem[] = [];

    for (const alert of activeAlerts) {
      if (this.isExpired(alert)) continue;

      const met = this.isConditionMetByTick(
        alert.conditionType,
        alert.targetPrice,
        currentPrice,
        prev,
        alert.upperPrice,
        alert.lowerPrice,
      );

      if (met) {
        const log = this.triggerAlert(alert, currentPrice);
        firedLogs.push(log);
      }
    }

    return firedLogs;
  }

  /**
   * Evaluate bar update (historical replay step or candle close).
   */
  public evaluateBar(
    symbol: string,
    bar: MarketBar,
    previousClose?: number,
    isBarClose: boolean = false,
  ): AlertLogItem[] {
    const sym = symbol.toUpperCase().trim();
    const prevClose = previousClose ?? this.lastBarCloses.get(sym) ?? bar.open;
    this.lastBarCloses.set(sym, bar.close);

    const activeAlerts = this.store.getActiveAlertsForSymbol(sym);
    if (!activeAlerts.length) return [];

    const barKey = `${sym}-${bar.time ?? bar.close}`;
    let firedInThisBar = this.firedThisBar.get(barKey);
    if (!firedInThisBar) {
      firedInThisBar = new Set();
      this.firedThisBar.set(barKey, firedInThisBar);
    }

    const firedLogs: AlertLogItem[] = [];

    for (const alert of activeAlerts) {
      if (this.isExpired(alert)) continue;

      // Filter frequency constraints
      if (alert.frequency === "once_per_bar" && firedInThisBar.has(alert.id)) {
        continue;
      }
      if (alert.frequency === "once_per_bar_close" && !isBarClose) {
        continue;
      }

      const met = this.isConditionMetByBar(
        alert.conditionType,
        alert.targetPrice,
        bar,
        prevClose,
        alert.upperPrice,
        alert.lowerPrice,
      );

      if (met) {
        firedInThisBar.add(alert.id);
        const log = this.triggerAlert(alert, bar.close);
        firedLogs.push(log);
      }
    }

    return firedLogs;
  }
}

export const alertEvaluationEngine = AlertEvaluationEngine.getInstance();
