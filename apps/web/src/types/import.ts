export interface BrokerCatalogItem {
  id: string;
  name: string;
  category: "crypto" | "stocks" | "futures";
  icon: string;
  status: "active" | "soon";
  subtitle?: string;
  invertInDark?: boolean;
}

export interface BrokerSdkInfo {
  id: string;
  displayName: string;
  credentials: { key: string; label: string; secret?: boolean }[];
  readOnlySetup: string;
}

export interface PreviewTotals {
  executions: number;
  symbols: number;
  skippedRows: number;
  from: string | null;
  to: string | null;
}

export interface PreviewExecution {
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  executedAt: string;
}

import type { ImportReview } from "@/lib/import-review";

export interface PreviewResponse {
  reconciliation?: ImportReview;
  detected: string | null;
  timeZone: string;
  needsMapping?: boolean;
  headers?: string[];
  totals?: PreviewTotals;
  warnings?: string[];
  errors?: string[];
  needsSymbol?: boolean;
  executions?: PreviewExecution[];
}
