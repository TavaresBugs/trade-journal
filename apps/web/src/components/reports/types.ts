import type { GroupSummary, Dimension } from "@luxalgo/journal-core";
import { normalizeSymbol } from "@/lib/assets/asset-icons";

export interface Group extends GroupSummary {
  row: string;
  column: string;
}

export interface Analysis {
  accounts: { id: string; name: string }[];
  summary: GroupSummary;
  groups: Group[];
  playbooks: { id: string; name: string }[];
  currencies: string[];
  timeZone: string;
}

export const number = (n: number | null): string =>
  n === null ? "-" : n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export const percent = (n: number | null): string =>
  n === null ? "-" : `${(n * 100).toFixed(1)}%`;

export const money = (n: number, currency: string): string => `${number(n)} ${currency}`;

export const labels = (data: Analysis, key: string, dimension?: Dimension): string =>
  data.playbooks.find((p) => p.id === key)?.name ??
  (dimension === "symbol" ? normalizeSymbol(key) : key);
