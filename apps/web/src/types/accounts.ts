export interface AccountRow {
  id: string;
  name: string;
  kind?: string;
  broker?: string;
  platform?: string | null;
  accountNumber?: string | null;
  maxDrawdown?: number | null;
  timeZone?: string;
  currency?: string;
  initialBalance?: number;
  profitCalcMethod?: "fifo" | "lifo" | "wavg" | string;
  autoSync?: boolean;
  lastSyncAt?: string | null;
  archivedAt: string | null;
  connected?: boolean;
  snapshot?: { equity: number; positions: unknown[] } | null;
  tradeCount?: number;
  closedTrades?: number;
  winCount?: number;
  lossCount?: number;
  winRate?: number;
  netPnl?: number;
  currentBalance?: number;
  returnPct?: number;
}
