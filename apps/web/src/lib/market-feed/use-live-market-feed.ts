"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { MarketBar } from "@/lib/market-data";

export interface LiveFeedTick {
  price?: number;
  bid?: number;
  ask?: number;
  volume?: number;
  time: number;
}

export interface LiveFeedSubscriptionItem {
  symbol: string;
  resolution: string;
}

export interface UseLiveMarketFeedOptions {
  enabled?: boolean;
  symbols?: string[];
  resolution?: string;
  subscriptions?: LiveFeedSubscriptionItem[];
  wsUrl?: string;
  onCandle?: (symbol: string, candle: MarketBar, resolution?: string) => void;
  onHistory?: (symbol: string, bars: MarketBar[], resolution?: string) => void;
  onTick?: (symbol: string, tick: LiveFeedTick) => void;
  onStatusChange?: (connected: boolean, upstreamUser?: string, isRealtime?: boolean) => void;
}

export interface UseLiveMarketFeedReturn {
  isConnected: boolean;
  upstreamConnected: boolean;
  upstreamUser?: string;
  isRealtime?: boolean;
  status: "disconnected" | "connecting" | "connected" | "error";
  subscribedSymbols: string[];
  subscribe: (symbol: string, resolution?: string) => void;
}

const DEFAULT_WS_URL =
  process.env.NEXT_PUBLIC_TV_FEED_URL || "ws://localhost:3001";

export function useLiveMarketFeed({
  enabled = true,
  symbols = [],
  resolution = "1m",
  subscriptions,
  wsUrl = DEFAULT_WS_URL,
  onCandle,
  onHistory,
  onTick,
  onStatusChange,
}: UseLiveMarketFeedOptions): UseLiveMarketFeedReturn {
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const [upstreamConnected, setUpstreamConnected] = useState(false);
  const [upstreamUser, setUpstreamUser] = useState<string | undefined>(undefined);
  const [isRealtime, setIsRealtime] = useState(false);
  const [subscribedSymbols, setSubscribedSymbols] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);
  const lastDataTimeRef = useRef<number>(Date.now());

  const onCandleRef = useRef(onCandle);
  onCandleRef.current = onCandle;

  const onHistoryRef = useRef(onHistory);
  onHistoryRef.current = onHistory;

  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const currentSubscriptions = useMemo<LiveFeedSubscriptionItem[]>(() => {
    if (subscriptions && subscriptions.length > 0) {
      return subscriptions;
    }
    const syms = symbols || [];
    return syms.map((s) => ({ symbol: s, resolution: resolution || "1m" }));
  }, [subscriptions, symbols, resolution]);

  const subscriptionsKey = useMemo(() => {
    return currentSubscriptions
      .map((s) => `${s.symbol.toUpperCase()}@${s.resolution}`)
      .sort()
      .join(",");
  }, [currentSubscriptions]);

  const subscriptionsRef = useRef(currentSubscriptions);
  subscriptionsRef.current = currentSubscriptions;

  const lastSubscribedKeyRef = useRef<string>("");

  const sendSubscribePayload = useCallback((ws: WebSocket, items: LiveFeedSubscriptionItem[]) => {
    if (items.length === 0) return;
    const cleanItems = items.map((i) => ({
      symbol: i.symbol.trim().toUpperCase(),
      resolution: i.resolution || "1m",
    }));
    const uniqueSymbols = Array.from(new Set(cleanItems.map((i) => i.symbol)));
    ws.send(
      JSON.stringify({
        action: "subscribe",
        subscriptions: cleanItems,
        symbols: uniqueSymbols,
        resolution: cleanItems[0]?.resolution || "1m",
      })
    );
  }, []);

  const subscribe = useCallback((symbol: string, res = "1m") => {
    if (wsRef.current?.readyState === WebSocket.OPEN && symbol) {
      sendSubscribePayload(wsRef.current, [{ symbol, resolution: res }]);
    }
  }, [sendSubscribePayload]);

  const cleanup = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    lastSubscribedKeyRef.current = "";
    setStatus("disconnected");
    setUpstreamConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;

    // Clear existing socket if any
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    setStatus("connecting");

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        reconnectAttemptRef.current = 0;

        // Subscribe active items once on connect
        const activeItems = subscriptionsRef.current;
        if (activeItems.length > 0) {
          const fullKey = activeItems
            .map((s) => `${s.symbol.toUpperCase()}@${s.resolution}`)
            .sort()
            .join(",");
          lastSubscribedKeyRef.current = fullKey;
          sendSubscribePayload(ws, activeItems);
        }

        lastDataTimeRef.current = Date.now();

        // Heartbeat keep-alive & client-side inactivity watchdog every 10s
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "ping" }));

            // Inactivity check: if connected but no market tick/candle in 35s, re-assert subscription
            const elapsed = Date.now() - lastDataTimeRef.current;
            if (elapsed > 35000 && subscriptionsRef.current.length > 0) {
              sendSubscribePayload(ws, subscriptionsRef.current);
            }
            // If completely silent for > 60s, cycle local socket to force clean reconnect
            if (elapsed > 60000) {
              console.warn("[useLiveMarketFeed] Inactivity watchdog: No market data for >60s. Cycling local socket...");
              try {
                ws.close();
              } catch {}
            }
          }
        }, 10000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "pong") {
            lastDataTimeRef.current = Date.now();
          } else if (data.type === "status") {
            lastDataTimeRef.current = Date.now();
            const isUpstream = Boolean(data.connected);
            setUpstreamConnected(isUpstream);
            if (data.upstreamUser) setUpstreamUser(data.upstreamUser);
            if (typeof data.isRealtime === "boolean") setIsRealtime(data.isRealtime);
            if (Array.isArray(data.symbols)) setSubscribedSymbols(data.symbols);
            onStatusChangeRef.current?.(isUpstream, data.upstreamUser, data.isRealtime);
          } else if (data.type === "candle" && data.candle && data.symbol) {
            lastDataTimeRef.current = Date.now();
            onCandleRef.current?.(data.symbol, data.candle as MarketBar, data.resolution);
          } else if (data.type === "history" && Array.isArray(data.bars) && data.symbol) {
            lastDataTimeRef.current = Date.now();
            onHistoryRef.current?.(data.symbol, data.bars as MarketBar[], data.resolution);
          } else if (data.type === "tick" && data.tick && data.symbol) {
            lastDataTimeRef.current = Date.now();
            onTickRef.current?.(data.symbol, data.tick as LiveFeedTick);
          }
        } catch {}
      };

      ws.onclose = () => {
        setStatus("disconnected");
        setUpstreamConnected(false);
        lastSubscribedKeyRef.current = "";
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Schedule reconnect if enabled
        if (enabled && !reconnectTimerRef.current) {
          reconnectAttemptRef.current++;
          const delay = Math.min(15000, 1500 * Math.pow(1.3, reconnectAttemptRef.current));
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        setStatus("error");
      };
    } catch {
      setStatus("error");
    }
  }, [enabled, wsUrl, sendSubscribePayload]);

  // Main lifecycle effect
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      cleanup();
    }

    return () => {
      cleanup();
    };
  }, [enabled, connect, cleanup]);

  // Dynamic subscription update when subscriptions or resolution change
  useEffect(() => {
    if (
      enabled &&
      status === "connected" &&
      wsRef.current?.readyState === WebSocket.OPEN &&
      currentSubscriptions.length > 0
    ) {
      if (lastSubscribedKeyRef.current !== subscriptionsKey) {
        lastSubscribedKeyRef.current = subscriptionsKey;
        sendSubscribePayload(wsRef.current, currentSubscriptions);
      }
    }
  }, [enabled, status, subscriptionsKey, currentSubscriptions, sendSubscribePayload]);

  return {
    isConnected: status === "connected",
    upstreamConnected,
    upstreamUser,
    isRealtime,
    status,
    subscribedSymbols,
    subscribe,
  };
}
