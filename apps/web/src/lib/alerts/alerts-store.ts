import { useSyncExternalStore } from "react";
import {
  ChartAlert,
  AlertLogItem,
  AlertConditionType,
  AlertFrequency,
  AlertStatus,
  AlertSoundName,
  AlertNotificationOptions,
} from "./types";

export const STORAGE_KEY_ALERTS = "tradejournal_chart_alerts_v1";
export const STORAGE_KEY_LOGS = "tradejournal_alert_logs_v1";

export interface CreateAlertInput {
  symbol: string;
  conditionType: AlertConditionType;
  targetPrice: number;
  upperPrice?: number;
  lowerPrice?: number;
  frequency: AlertFrequency;
  expiration: string;
  message?: string;
  notifications?: Partial<AlertNotificationOptions>;
}

export interface ScreenSymbolItem {
  symbol: string;
  displaySymbol: string;
  name: string;
  session?: string;
  panelIndex: number;
  resolution?: string;
}

const SYMBOL_NAMES: Record<string, string> = {
  MNQ: "Micro E-mini Nasdaq-100",
  MES: "Micro E-mini S&P 500",
  NQ: "E-mini Nasdaq-100",
  ES: "E-mini S&P 500",
  MYM: "Micro E-mini Dow Jones",
  YM: "E-mini Dow Jones",
  M2K: "Micro E-mini Russell 2000",
  RTY: "E-mini Russell 2000",
  GC: "Gold Futures",
  CL: "Crude Oil Futures",
  BTC: "Bitcoin / Tether",
  ETH: "Ethereum / Tether",
};

export function createScreenSymbolItem(
  rawSymbol: string,
  panelIndex: number = 1,
  resolution?: string,
): ScreenSymbolItem {
  const clean = rawSymbol.replace(/1!$/, "").toUpperCase();
  const displaySymbol = `${clean}1!`;
  return {
    symbol: clean,
    displaySymbol,
    name: SYMBOL_NAMES[clean] || `${clean} Futures`,
    session: "Electronic trading hours",
    panelIndex,
    resolution,
  };
}

export interface AlertsState {
  alerts: ChartAlert[];
  logs: AlertLogItem[];
  filterStatus: "all" | "active" | "paused" | "triggered";
  searchQuery: string;
  selectedAlertId: string | null;
  isDialogOpen: boolean;
  dialogMode: "create" | "edit";
  editingAlert: ChartAlert | null;
  createInitialPrice: number | null;
  createInitialSymbol: string | null;
  activePanelTab: "alerts" | "log";
  deleteConfirmAlert: ChartAlert | null;
  screenSymbols: ScreenSymbolItem[];
}

type Listener = (state: AlertsState) => void;

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined" || !window.localStorage) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota or error
  }
}

export class AlertsStore {
  private static instance: AlertsStore | null = null;
  private state: AlertsState;
  private listeners: Set<Listener> = new Set();

  private constructor() {
    const initialAlerts = loadStorage<ChartAlert[]>(STORAGE_KEY_ALERTS, []);
    const initialLogs = loadStorage<AlertLogItem[]>(STORAGE_KEY_LOGS, []);

    this.state = {
      alerts: initialAlerts,
      logs: initialLogs,
      filterStatus: "all",
      searchQuery: "",
      selectedAlertId: null,
      isDialogOpen: false,
      dialogMode: "create",
      editingAlert: null,
      createInitialPrice: null,
      createInitialSymbol: null,
      activePanelTab: "alerts",
      deleteConfirmAlert: null,
      screenSymbols: [],
    };
  }

  public static getInstance(): AlertsStore {
    if (!AlertsStore.instance) {
      AlertsStore.instance = new AlertsStore();
    }
    return AlertsStore.instance;
  }

  public getState(): AlertsState {
    return this.state;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private persistAlerts(): void {
    saveStorage(STORAGE_KEY_ALERTS, this.state.alerts);
  }

  private persistLogs(): void {
    saveStorage(STORAGE_KEY_LOGS, this.state.logs);
  }

  // ─── CRUD OPERATIONS ──────────────────────────────────────────

  public createAlert(input: CreateAlertInput): ChartAlert {
    const defaultMsg = `${input.symbol} Crossing ${input.targetPrice}`;
    const newAlert: ChartAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      symbol: input.symbol.toUpperCase(),
      conditionType: input.conditionType,
      targetPrice: input.targetPrice,
      upperPrice: input.upperPrice,
      lowerPrice: input.lowerPrice,
      frequency: input.frequency,
      expiration:
        input.expiration ||
        new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      message: input.message?.trim() || defaultMsg,
      notifications: {
        showPopup: input.notifications?.showPopup ?? true,
        sendToast: input.notifications?.sendToast ?? true,
        playSound: input.notifications?.playSound ?? true,
        soundName: input.notifications?.soundName ?? "fired",
        soundDurationSeconds: input.notifications?.soundDurationSeconds ?? 0,
        webhookUrl: input.notifications?.webhookUrl,
        email: input.notifications?.email ?? false,
      },
      status: "active",
      createdAt: Date.now(),
      fireCount: 0,
    };

    this.state = {
      ...this.state,
      alerts: [newAlert, ...this.state.alerts],
      isDialogOpen: false,
      editingAlert: null,
    };

    this.persistAlerts();
    this.notify();
    return newAlert;
  }

  public updateAlert(id: string, updates: Partial<ChartAlert>): void {
    const prev = this.state.alerts.find((a) => a.id === id);
    if (!prev) return;

    this.state = {
      ...this.state,
      alerts: this.state.alerts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
      isDialogOpen: false,
      editingAlert: null,
    };

    this.persistAlerts();
    this.notify();
  }

  public deleteAlert(id: string): void {
    this.state = {
      ...this.state,
      alerts: this.state.alerts.filter((a) => a.id !== id),
      isDialogOpen: this.state.editingAlert?.id === id ? false : this.state.isDialogOpen,
      editingAlert: this.state.editingAlert?.id === id ? null : this.state.editingAlert,
      selectedAlertId: this.state.selectedAlertId === id ? null : this.state.selectedAlertId,
    };

    this.persistAlerts();
    this.notify();
  }

  public pauseAlert(id: string): void {
    this.updateAlert(id, { status: "paused" });
  }

  public resumeAlert(id: string): void {
    this.updateAlert(id, { status: "active" });
  }

  public toggleAlert(id: string): void {
    const alert = this.state.alerts.find((a) => a.id === id);
    if (!alert) return;
    const nextStatus: AlertStatus = alert.status === "active" ? "paused" : "active";
    this.updateAlert(id, { status: nextStatus });
  }

  public pauseAll(): void {
    this.state = {
      ...this.state,
      alerts: this.state.alerts.map((a) =>
        a.status === "active" ? { ...a, status: "paused" } : a,
      ),
    };
    this.persistAlerts();
    this.notify();
  }

  public resumeAll(): void {
    this.state = {
      ...this.state,
      alerts: this.state.alerts.map((a) =>
        a.status !== "active" ? { ...a, status: "active" } : a,
      ),
    };
    this.persistAlerts();
    this.notify();
  }

  public deleteAllInactive(): void {
    this.state = {
      ...this.state,
      alerts: this.state.alerts.filter((a) => a.status === "active"),
    };
    this.persistAlerts();
    this.notify();
  }

  public clearAllAlerts(): void {
    this.state = {
      ...this.state,
      alerts: [],
      selectedAlertId: null,
      editingAlert: null,
      isDialogOpen: false,
    };
    this.persistAlerts();
    this.notify();
  }

  // ─── LOG OPERATIONS ───────────────────────────────────────────

  public addLogItem(
    item: Omit<AlertLogItem, "id" | "timestamp">,
  ): AlertLogItem {
    const newLog: AlertLogItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      ...item,
    };

    // Keep max 200 logs
    const nextLogs = [newLog, ...this.state.logs].slice(0, 200);

    this.state = {
      ...this.state,
      logs: nextLogs,
    };

    this.persistLogs();
    this.notify();
    return newLog;
  }

  public clearLogs(): void {
    this.state = {
      ...this.state,
      logs: [],
    };
    this.persistLogs();
    this.notify();
  }

  // ─── MODAL CONTROLS ───────────────────────────────────────────

  public openCreateDialog(symbol?: string, price?: number): void {
    this.state = {
      ...this.state,
      isDialogOpen: true,
      dialogMode: "create",
      editingAlert: null,
      createInitialSymbol: symbol ? symbol.toUpperCase() : null,
      createInitialPrice: typeof price === "number" && Number.isFinite(price) ? price : null,
    };
    this.notify();
  }

  public openEditDialog(alert: ChartAlert): void {
    this.state = {
      ...this.state,
      isDialogOpen: true,
      dialogMode: "edit",
      editingAlert: alert,
      createInitialSymbol: alert.symbol,
      createInitialPrice: alert.targetPrice,
    };
    this.notify();
  }

  public closeDialog(): void {
    this.state = {
      ...this.state,
      isDialogOpen: false,
      editingAlert: null,
      createInitialPrice: null,
      createInitialSymbol: null,
    };
    this.notify();
  }

  // ─── DELETE CONFIRMATION ──────────────────────────────────────

  public requestDeleteAlert(alertOrId: ChartAlert | string): void {
    const alert =
      typeof alertOrId === "string"
        ? this.state.alerts.find((a) => a.id === alertOrId) ?? null
        : alertOrId;
    if (!alert) return;
    this.state = {
      ...this.state,
      deleteConfirmAlert: alert,
    };
    this.notify();
  }

  public cancelDeleteAlert(): void {
    if (!this.state.deleteConfirmAlert) return;
    this.state = {
      ...this.state,
      deleteConfirmAlert: null,
    };
    this.notify();
  }

  public confirmDeleteAlert(): void {
    const alert = this.state.deleteConfirmAlert;
    if (!alert) return;
    this.deleteAlert(alert.id);
    this.state = {
      ...this.state,
      deleteConfirmAlert: null,
    };
    this.notify();
  }

  // ─── UI FILTERS & TAB ─────────────────────────────────────────

  public setFilterStatus(
    filter: "all" | "active" | "paused" | "triggered",
  ): void {
    this.state = { ...this.state, filterStatus: filter };
    this.notify();
  }

  public setSearchQuery(q: string): void {
    this.state = { ...this.state, searchQuery: q };
    this.notify();
  }

  public setActivePanelTab(tab: "alerts" | "log"): void {
    this.state = { ...this.state, activePanelTab: tab };
    this.notify();
  }

  public setScreenSymbols(symbols: ScreenSymbolItem[]): void {
    this.state = { ...this.state, screenSymbols: symbols };
    this.notify();
  }

  // ─── SELECTORS ────────────────────────────────────────────────

  public getAlertsForSymbol(symbol: string): ChartAlert[] {
    const target = symbol.toUpperCase().trim();
    return this.state.alerts.filter(
      (a) => a.symbol === target || a.symbol.includes(target) || target.includes(a.symbol),
    );
  }

  public getActiveAlertsForSymbol(symbol: string): ChartAlert[] {
    const target = symbol.toUpperCase().trim();
    return this.state.alerts.filter(
      (a) =>
        a.status === "active" &&
        (a.symbol === target || a.symbol.includes(target) || target.includes(a.symbol)),
    );
  }

  public getFilteredAlerts(): ChartAlert[] {
    let result = this.state.alerts;

    if (this.state.filterStatus !== "all") {
      result = result.filter((a) => a.status === this.state.filterStatus);
    }

    if (this.state.searchQuery.trim()) {
      const q = this.state.searchQuery.toLowerCase().trim();
      result = result.filter(
        (a) =>
          a.symbol.toLowerCase().includes(q) ||
          a.message.toLowerCase().includes(q) ||
          a.targetPrice.toString().includes(q),
      );
    }

    return result;
  }
}

export const alertsStore = AlertsStore.getInstance();

/**
 * Reactive hook for React components
 */
export function useAlerts(symbol?: string) {
  const state = useSyncExternalStore(
    (cb) => alertsStore.subscribe(cb),
    () => alertsStore.getState(),
    () => alertsStore.getState(),
  );

  const activeAlertsForSymbol = symbol
    ? alertsStore.getActiveAlertsForSymbol(symbol)
    : [];

  const alertsForSymbol = symbol ? alertsStore.getAlertsForSymbol(symbol) : [];

  const filteredAlerts = alertsStore.getFilteredAlerts();

  return {
    ...state,
    filteredAlerts,
    alertsForSymbol,
    activeAlertsForSymbol,
    store: alertsStore,
    createAlert: (input: CreateAlertInput) => alertsStore.createAlert(input),
    updateAlert: (id: string, updates: Partial<ChartAlert>) =>
      alertsStore.updateAlert(id, updates),
    deleteAlert: (id: string) => alertsStore.deleteAlert(id),
    pauseAlert: (id: string) => alertsStore.pauseAlert(id),
    resumeAlert: (id: string) => alertsStore.resumeAlert(id),
    toggleAlert: (id: string) => alertsStore.toggleAlert(id),
    pauseAll: () => alertsStore.pauseAll(),
    resumeAll: () => alertsStore.resumeAll(),
    deleteAllInactive: () => alertsStore.deleteAllInactive(),
    clearAllAlerts: () => alertsStore.clearAllAlerts(),
    addLogItem: (item: Omit<AlertLogItem, "id" | "timestamp">) =>
      alertsStore.addLogItem(item),
    clearLogs: () => alertsStore.clearLogs(),
    openCreateDialog: (sym?: string, price?: number) =>
      alertsStore.openCreateDialog(sym, price),
    openEditDialog: (alert: ChartAlert) => alertsStore.openEditDialog(alert),
    closeDialog: () => alertsStore.closeDialog(),
    setFilterStatus: (filter: "all" | "active" | "paused" | "triggered") =>
      alertsStore.setFilterStatus(filter),
    setSearchQuery: (q: string) => alertsStore.setSearchQuery(q),
    setActivePanelTab: (tab: "alerts" | "log") =>
      alertsStore.setActivePanelTab(tab),
    requestDeleteAlert: (alertOrId: ChartAlert | string) =>
      alertsStore.requestDeleteAlert(alertOrId),
    cancelDeleteAlert: () => alertsStore.cancelDeleteAlert(),
    confirmDeleteAlert: () => alertsStore.confirmDeleteAlert(),
    setScreenSymbols: (symbols: ScreenSymbolItem[]) =>
      alertsStore.setScreenSymbols(symbols),
  };
}
