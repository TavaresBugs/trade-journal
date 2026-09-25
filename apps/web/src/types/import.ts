export interface BrokerCatalogItem {
  id: string;
  name: string;
  category: "crypto" | "stocks" | "futures" | "forex-cfd" | "prop-firm" | "platform";
  icon: string;
  iconDark?: string;
  status: "active" | "soon";
  connectionType?: "api" | "csv";
  subtitle?: string;
  invertInDark?: boolean;
  defaultTimeZone?: string;
  defaultFormat?: string;
  dateFormat?: "DMY" | "MDY" | "ISO";
  tvBrokerId?: string;
  platform?: string;
  platformName?: string;
  platformIcon?: string;
  gateway?: string;
  docUrl?: string;
  officialNote?: string;
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

export interface AccountReconciliation {
  accountId: string;
  accountName: string;
  totalFills: number;
  existingFills: number;
  newFills: number;
  totalTrades: number;
  existingTrades: number;
  newTrades: number;
  isFullyImported: boolean;
}

import type { ImportReview } from "@/lib/import-review";

export interface StatementAccountConflict {
  isConflict: boolean;
  detectedAccount?: string;
  targetAccountNumber?: string;
  targetAccountName?: string;
}

export interface StatementCompatibility {
  compatible: boolean;
  reason?: string;
}

export interface PreviewResponse {
  reconciliation?: ImportReview;
  accountReconciliation?: AccountReconciliation;
  detected: string | null;
  detectedAccount?: string;
  sourceAccounts?: string[];
  timeZone: string;
  dateOrder?: "DMY" | "MDY";
  needsMapping?: boolean;
  headers?: string[];
  totals?: PreviewTotals;
  warnings?: string[];
  errors?: string[];
  needsSymbol?: boolean;
  executions?: PreviewExecution[];
  accountConflict?: StatementAccountConflict;
  compatibility?: StatementCompatibility;
}
