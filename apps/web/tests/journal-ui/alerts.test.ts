import { describe, it, expect, beforeEach, vi } from "vitest";
import { AlertsStore, alertsStore } from "@/lib/alerts/alerts-store";
import { AlertEvaluationEngine } from "@/lib/alerts/alert-evaluator";
import {
  AlertAudioEngine,
  ALERT_SOUNDS,
  ALERT_SOUND_MAP,
} from "@/lib/alerts/alert-audio-engine";
import { AlertSoundName } from "@/lib/alerts/types";

describe("TradingView Alerts System", () => {
  describe("AlertsStore", () => {
    beforeEach(() => {
      alertsStore.clearAllAlerts();
      alertsStore.clearLogs();
      alertsStore.closeDialog();
      alertsStore.setFilterStatus("all");
      alertsStore.setSearchQuery("");
    });

    it("should create an alert with correct default values", () => {
      const alert = alertsStore.createAlert({
        symbol: "MES",
        conditionType: "crossing",
        targetPrice: 5800.25,
        frequency: "once_only",
        expiration: new Date(Date.now() + 86400000).toISOString(),
      });

      expect(alert).toBeDefined();
      expect(alert.id).toMatch(/^alert-/);
      expect(alert.symbol).toBe("MES");
      expect(alert.targetPrice).toBe(5800.25);
      expect(alert.status).toBe("active");
      expect(alert.message).toBe("MES Crossing 5800.25");
      expect(alert.notifications.playSound).toBe(true);
      expect(alert.notifications.soundName).toBe("fired");
      expect(alert.fireCount).toBe(0);

      const state = alertsStore.getState();
      expect(state.alerts).toHaveLength(1);
      expect(state.alerts[0]?.id).toBe(alert.id);
    });

    it("should update an existing alert", () => {
      const alert = alertsStore.createAlert({
        symbol: "MNQ",
        conditionType: "greater_than",
        targetPrice: 20000,
        frequency: "every_time",
        expiration: new Date().toISOString(),
      });

      alertsStore.updateAlert(alert.id, {
        targetPrice: 20500,
        message: "Custom message",
      });

      const updated = alertsStore.getState().alerts.find((a) => a.id === alert.id);
      expect(updated?.targetPrice).toBe(20500);
      expect(updated?.message).toBe("Custom message");
    });

    it("should delete an alert", () => {
      const a1 = alertsStore.createAlert({
        symbol: "MES",
        conditionType: "crossing",
        targetPrice: 5800,
        frequency: "once_only",
        expiration: new Date().toISOString(),
      });
      const a2 = alertsStore.createAlert({
        symbol: "MNQ",
        conditionType: "crossing",
        targetPrice: 20000,
        frequency: "once_only",
        expiration: new Date().toISOString(),
      });

      expect(alertsStore.getState().alerts).toHaveLength(2);
      alertsStore.deleteAlert(a1.id);

      const alerts = alertsStore.getState().alerts;
      expect(alerts).toHaveLength(1);
      expect(alerts[0]?.id).toBe(a2.id);
    });

    it("should pause, resume, and toggle alerts", () => {
      const alert = alertsStore.createAlert({
        symbol: "ES",
        conditionType: "crossing_up",
        targetPrice: 5820,
        frequency: "once_only",
        expiration: new Date().toISOString(),
      });

      expect(alert.status).toBe("active");

      alertsStore.pauseAlert(alert.id);
      expect(alertsStore.getState().alerts.find((a) => a.id === alert.id)?.status).toBe("paused");

      alertsStore.resumeAlert(alert.id);
      expect(alertsStore.getState().alerts.find((a) => a.id === alert.id)?.status).toBe("active");

      alertsStore.toggleAlert(alert.id);
      expect(alertsStore.getState().alerts.find((a) => a.id === alert.id)?.status).toBe("paused");

      alertsStore.toggleAlert(alert.id);
      expect(alertsStore.getState().alerts.find((a) => a.id === alert.id)?.status).toBe("active");
    });

    it("should batch pause and resume all alerts", () => {
      alertsStore.createAlert({
        symbol: "ES",
        conditionType: "crossing",
        targetPrice: 5800,
        frequency: "once_only",
        expiration: new Date().toISOString(),
      });
      alertsStore.createAlert({
        symbol: "NQ",
        conditionType: "crossing",
        targetPrice: 20000,
        frequency: "once_only",
        expiration: new Date().toISOString(),
      });

      alertsStore.pauseAll();
      expect(alertsStore.getState().alerts.every((a) => a.status === "paused")).toBe(true);

      alertsStore.resumeAll();
      expect(alertsStore.getState().alerts.every((a) => a.status === "active")).toBe(true);
    });

    it("should filter alerts by status and search query", () => {
      alertsStore.createAlert({
        symbol: "MES",
        conditionType: "crossing",
        targetPrice: 5800,
        frequency: "once_only",
        expiration: new Date().toISOString(),
        message: "Breakout target",
      });
      const a2 = alertsStore.createAlert({
        symbol: "MNQ",
        conditionType: "greater_than",
        targetPrice: 20000,
        frequency: "every_time",
        expiration: new Date().toISOString(),
        message: "All time high",
      });

      alertsStore.pauseAlert(a2.id);

      alertsStore.setFilterStatus("active");
      expect(alertsStore.getFilteredAlerts()).toHaveLength(1);
      expect(alertsStore.getFilteredAlerts()[0]?.symbol).toBe("MES");

      alertsStore.setFilterStatus("paused");
      expect(alertsStore.getFilteredAlerts()).toHaveLength(1);
      expect(alertsStore.getFilteredAlerts()[0]?.symbol).toBe("MNQ");

      alertsStore.setFilterStatus("all");
      alertsStore.setSearchQuery("high");
      expect(alertsStore.getFilteredAlerts()).toHaveLength(1);
      expect(alertsStore.getFilteredAlerts()[0]?.symbol).toBe("MNQ");
    });

    it("should manage alert logs", () => {
      alertsStore.addLogItem({
        alertId: "alert-1",
        symbol: "MES",
        firedPrice: 5801.5,
        conditionType: "crossing",
        message: "MES crossed 5800",
      });

      expect(alertsStore.getState().logs).toHaveLength(1);
      expect(alertsStore.getState().logs[0]?.firedPrice).toBe(5801.5);

      alertsStore.clearLogs();
      expect(alertsStore.getState().logs).toHaveLength(0);
    });

    it("should open and close create and edit dialogs", () => {
      alertsStore.openCreateDialog("MES", 5812.5);
      let state = alertsStore.getState();
      expect(state.isDialogOpen).toBe(true);
      expect(state.dialogMode).toBe("create");
      expect(state.createInitialSymbol).toBe("MES");
      expect(state.createInitialPrice).toBe(5812.5);

      alertsStore.closeDialog();
      state = alertsStore.getState();
      expect(state.isDialogOpen).toBe(false);

      const alert = alertsStore.createAlert({
        symbol: "CL",
        conditionType: "less_than",
        targetPrice: 70,
        frequency: "once_only",
        expiration: new Date().toISOString(),
      });

      alertsStore.openEditDialog(alert);
      state = alertsStore.getState();
      expect(state.isDialogOpen).toBe(true);
      expect(state.dialogMode).toBe("edit");
      expect(state.editingAlert?.id).toBe(alert.id);
    });
  });

  describe("AlertAudioEngine", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should have all 40 official TradingView alert sounds in manifest", () => {
      expect(ALERT_SOUNDS).toHaveLength(40);
      const expectedIds: AlertSoundName[] = [
        "fired",
        "alarm_clock",
        "beep_beep",
        "3_notes_reverb",
        "chirpy",
        "fault",
        "hand_bell",
        "call",
        "cash_register",
      ];

      expectedIds.forEach((id) => {
        const sound = ALERT_SOUND_MAP.get(id);
        expect(sound).toBeDefined();
        expect(sound?.path).toContain(sound?.filename);
        expect(sound?.label.length).toBeGreaterThan(0);
      });
    });

    it("should manage volume bounds between 0 and 1", () => {
      const engine = AlertAudioEngine.getInstance();
      engine.setVolume(0.5);
      expect(engine.getVolume()).toBe(0.5);

      engine.setVolume(1.5);
      expect(engine.getVolume()).toBe(1.0);

      engine.setVolume(-0.5);
      expect(engine.getVolume()).toBe(0.0);

      engine.setVolume(0.8);
      expect(engine.getVolume()).toBe(0.8);
    });

    it("should toggle mute status", () => {
      const engine = AlertAudioEngine.getInstance();
      expect(engine.getMuted()).toBe(false);

      engine.setMuted(true);
      expect(engine.getMuted()).toBe(true);

      engine.setMuted(false);
      expect(engine.getMuted()).toBe(false);
    });

    it("should synthesize fallback tones without throwing", () => {
      const engine = AlertAudioEngine.getInstance();
      expect(() => {
        engine.synthesizeFallbackTone("fired");
        engine.synthesizeFallbackTone("alarm_clock");
        engine.synthesizeFallbackTone("beep_beep");
        engine.synthesizeFallbackTone("fault");
        engine.synthesizeFallbackTone("hand_bell");
      }).not.toThrow();
    });

    it("should return false on play when engine is muted", async () => {
      const engine = AlertAudioEngine.getInstance();
      engine.setMuted(true);
      const result = await engine.play("fired");
      expect(result).toBe(false);
      engine.setMuted(false);
    });

    it("should handle stop and stopAll cleanly", () => {
      const engine = AlertAudioEngine.getInstance();
      expect(() => {
        engine.stop("test-loop");
        engine.stopAll();
      }).not.toThrow();
    });
  });

  describe("AlertEvaluationEngine", () => {
    let mockAudioEngine: AlertAudioEngine;
    let engine: AlertEvaluationEngine;

    beforeEach(() => {
      alertsStore.clearAllAlerts();
      alertsStore.clearLogs();

      mockAudioEngine = {
        play: vi.fn().mockResolvedValue(true),
        stop: vi.fn(),
        preloadAll: vi.fn().mockResolvedValue(undefined),
        setMuted: vi.fn(),
        setVolume: vi.fn(),
        unlockAudioContext: vi.fn(),
      } as unknown as AlertAudioEngine;

      engine = new AlertEvaluationEngine(alertsStore, mockAudioEngine);
      engine.reset();
    });

    describe("Condition Checking (Tick)", () => {
      it("should evaluate crossing correctly", () => {
        // Crossing from below
        expect(engine.isConditionMetByTick("crossing", 100, 101, 99)).toBe(true);
        // Crossing from above
        expect(engine.isConditionMetByTick("crossing", 100, 99, 101)).toBe(true);
        // Equal
        expect(engine.isConditionMetByTick("crossing", 100, 100, 99)).toBe(true);
        // Not crossing
        expect(engine.isConditionMetByTick("crossing", 100, 98, 97)).toBe(false);
        expect(engine.isConditionMetByTick("crossing", 100, 105, 102)).toBe(false);
      });

      it("should evaluate crossing_up and crossing_down correctly", () => {
        expect(engine.isConditionMetByTick("crossing_up", 100, 101, 99)).toBe(true);
        expect(engine.isConditionMetByTick("crossing_up", 100, 99, 101)).toBe(false);

        expect(engine.isConditionMetByTick("crossing_down", 100, 99, 101)).toBe(true);
        expect(engine.isConditionMetByTick("crossing_down", 100, 101, 99)).toBe(false);
      });

      it("should evaluate greater_than and less_than correctly", () => {
        expect(engine.isConditionMetByTick("greater_than", 100, 100.5)).toBe(true);
        expect(engine.isConditionMetByTick("greater_than", 100, 99.5)).toBe(false);

        expect(engine.isConditionMetByTick("less_than", 100, 99.5)).toBe(true);
        expect(engine.isConditionMetByTick("less_than", 100, 100.5)).toBe(false);
      });

      it("should evaluate channel conditions correctly", () => {
        const lower = 100;
        const upper = 200;

        // entering channel: was 90, now 110
        expect(
          engine.isConditionMetByTick("entering_channel", 150, 110, 90, upper, lower),
        ).toBe(true);

        // exiting channel: was 150, now 210
        expect(
          engine.isConditionMetByTick("exiting_channel", 150, 210, 150, upper, lower),
        ).toBe(true);

        // inside channel
        expect(
          engine.isConditionMetByTick("inside_channel", 150, 150, 150, upper, lower),
        ).toBe(true);
        expect(
          engine.isConditionMetByTick("inside_channel", 150, 250, 150, upper, lower),
        ).toBe(false);

        // outside channel
        expect(
          engine.isConditionMetByTick("outside_channel", 150, 250, 150, upper, lower),
        ).toBe(true);
      });
    });

    describe("Condition Checking (Bar)", () => {
      it("should evaluate bar crossing correctly", () => {
        const bar = { open: 98, high: 102, low: 97, close: 101 };
        expect(engine.isConditionMetByBar("crossing", 100, bar)).toBe(true);

        const missBar = { open: 90, high: 95, low: 88, close: 92 };
        expect(engine.isConditionMetByBar("crossing", 100, missBar)).toBe(false);
      });

      it("should evaluate bar crossing_up and crossing_down", () => {
        const upBar = { open: 98, high: 105, low: 98, close: 104 };
        expect(engine.isConditionMetByBar("crossing_up", 100, upBar, 95)).toBe(true);

        const downBar = { open: 105, high: 105, low: 95, close: 96 };
        expect(engine.isConditionMetByBar("crossing_down", 100, downBar, 105)).toBe(true);
      });
    });

    describe("Tick & Bar Evaluation Flow", () => {
      it("should trigger alert, play sound, add log, and set triggered status for once_only", () => {
        const alert = alertsStore.createAlert({
          symbol: "MES",
          conditionType: "crossing",
          targetPrice: 5800,
          frequency: "once_only",
          expiration: new Date(Date.now() + 86400000).toISOString(),
          notifications: { playSound: true, soundName: "alarm_clock" },
        });

        const firedListener = vi.fn();
        engine.onAlertFired(firedListener);

        // Previous price 5790, current price 5805 -> crosses 5800!
        const logs = engine.evaluateTick("MES", 5805, 5790);

        expect(logs).toHaveLength(1);
        expect(logs[0]?.firedPrice).toBe(5805);
        expect(logs[0]?.symbol).toBe("MES");
        expect(firedListener).toHaveBeenCalledTimes(1);

        // Audio played
        expect(mockAudioEngine.play).toHaveBeenCalledWith(
          "alarm_clock",
          expect.objectContaining({ loopId: `alert-${alert.id}` }),
        );

        // Check store state: alert should now be 'triggered' and not active
        const updated = alertsStore.getState().alerts.find((a) => a.id === alert.id);
        expect(updated?.status).toBe("triggered");
        expect(updated?.fireCount).toBe(1);

        // Subsequent ticks should not re-trigger because it's no longer active
        const secondLogs = engine.evaluateTick("MES", 5810, 5805);
        expect(secondLogs).toHaveLength(0);
      });

      it("should re-trigger every time when frequency is every_time", () => {
        alertsStore.createAlert({
          symbol: "MES",
          conditionType: "greater_than",
          targetPrice: 5800,
          frequency: "every_time",
          expiration: new Date(Date.now() + 86400000).toISOString(),
        });

        const logs1 = engine.evaluateTick("MES", 5805);
        expect(logs1).toHaveLength(1);

        const logs2 = engine.evaluateTick("MES", 5810);
        expect(logs2).toHaveLength(1);

        const alert = alertsStore.getState().alerts[0];
        expect(alert?.status).toBe("active");
        expect(alert?.fireCount).toBe(2);
      });

      it("should respect once_per_bar in evaluateBar", () => {
        const alert = alertsStore.createAlert({
          symbol: "MNQ",
          conditionType: "crossing",
          targetPrice: 20000,
          frequency: "once_per_bar",
          expiration: new Date(Date.now() + 86400000).toISOString(),
        });

        const bar = { open: 19990, high: 20010, low: 19980, close: 20005, time: 1700000000 };

        // First evaluation of the bar
        const logs1 = engine.evaluateBar("MNQ", bar);
        expect(logs1).toHaveLength(1);

        // Second evaluation of the SAME bar
        const logs2 = engine.evaluateBar("MNQ", bar);
        expect(logs2).toHaveLength(0);

        // New bar
        const nextBar = { open: 20005, high: 20020, low: 19995, close: 20015, time: 1700000060 };
        const logs3 = engine.evaluateBar("MNQ", nextBar);
        expect(logs3).toHaveLength(1);
      });

      it("should respect once_per_bar_close in evaluateBar", () => {
        alertsStore.createAlert({
          symbol: "MNQ",
          conditionType: "crossing",
          targetPrice: 20000,
          frequency: "once_per_bar_close",
          expiration: new Date(Date.now() + 86400000).toISOString(),
        });

        const bar = { open: 19990, high: 20010, low: 19980, close: 20005, time: 1700000000 };

        // While bar is updating (isBarClose = false)
        const logsDuringBar = engine.evaluateBar("MNQ", bar, undefined, false);
        expect(logsDuringBar).toHaveLength(0);

        // When bar closes (isBarClose = true)
        const logsAtClose = engine.evaluateBar("MNQ", bar, undefined, true);
        expect(logsAtClose).toHaveLength(1);
      });

      it("should pause expired alerts and not trigger them", () => {
        const expiredAlert = alertsStore.createAlert({
          symbol: "ES",
          conditionType: "greater_than",
          targetPrice: 5000,
          frequency: "once_only",
          expiration: new Date(Date.now() - 10000).toISOString(), // expired in past
        });

        const logs = engine.evaluateTick("ES", 5500);
        expect(logs).toHaveLength(0);

        const alert = alertsStore.getState().alerts.find((a) => a.id === expiredAlert.id);
        expect(alert?.status).toBe("paused");
      });

      it("should interpolate message placeholders ({{ticker}}, {{close}}, {{plot_0}}, {{condition}})", () => {
        const testAlert = alertsStore.createAlert({
          symbol: "NQ",
          conditionType: "crossing_up",
          targetPrice: 20500,
          frequency: "once_only",
          expiration: new Date(Date.now() + 86400000).toISOString(),
          message: "Alert on {{ticker}}! {{condition}} at {{close}} (target: {{plot_0}})",
        });

        const interpolated = engine.interpolateMessage(testAlert.message, testAlert, 20505);
        expect(interpolated).toBe("Alert on NQ! crossing_up at 20505 (target: 20500)");

        const logs = engine.evaluateTick("NQ", 20505, 20495);
        expect(logs).toHaveLength(1);
        expect(logs[0]?.message).toBe("Alert on NQ! crossing_up at 20505 (target: 20500)");
      });

      it("should handle open-ended alerts without premature expiration", () => {
        const farFutureISO = "2036-12-31T23:59:00.000Z";
        const alert = alertsStore.createAlert({
          symbol: "ES",
          conditionType: "crossing",
          targetPrice: 5800,
          frequency: "every_time",
          expiration: farFutureISO,
        });

        expect(alert.expiration).toBe(farFutureISO);
        const logs = engine.evaluateTick("ES", 5800, 5790);
        expect(logs).toHaveLength(1);
        expect(alert.status).toBe("active");
      });
    });
  });
});
