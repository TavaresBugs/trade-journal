export interface AccountRow {
  id: string;
  name: string;
  kind?: string;
  broker?: string;
  currency?: string;
  initialBalance?: number;
  profitCalcMethod?: "fifo" | "lifo" | "wavg" | string;
  autoSync?: boolean;
  lastSyncAt?: string | null;
  archivedAt: string | null;
  connected?: boolean;
  snapshot?: { equity: number; positions: unknown[] } | null;
  tradeCount?: number;
}
