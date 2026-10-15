import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { eq } from "drizzle-orm";
import {
  defaultFee,
  defaultRisk,
  EMPTY_DEFAULTS,
  type JournalDefaults,
} from "../../src/lib/journal-defaults";
import { scheduledRules, progressScore, type Routine } from "../../src/lib/progress";
import { attachmentMime } from "../../src/lib/attachment-validation";
import { formatInlineSelection, remarkRepairSpacedEmphasis } from "../../src/lib/note-formatting";
import { createDictationSession, type SpeechRecognizer } from "../../src/lib/dictation";
import {
  TIMEFRAME_CONFIG,
  buildSlotKey,
  parseSlotKey,
  extractImageFromDataTransfer,
} from "../../src/components/screenshots/screenshot-types";
import { createTestDbHarness, type TestDbHarness } from "../helpers/db-harness";

let harness: TestDbHarness;

beforeEach(async () => {
  if (!harness) {
    harness = await createTestDbHarness("journal-features-harness-");
  }
});

afterAll(() => {
  if (harness) {
    harness.teardown();
  }
});

describe("Journal Features & Notes", () => {
  describe("journal defaults are opt-in and scoped", () => {
    const defaults: JournalDefaults = {
      ...EMPTY_DEFAULTS,
      feeRules: [{ id: "1", accountId: "a", symbol: "ES", amount: 2, mode: "unit" }],
      riskRules: [{ id: "r", accountId: "", symbol: "", stop: 1, target: 3, mode: "percent" }],
    };

    it("preserves source fees and applies only the first matching zero-fee rule", () => {
      expect(defaultFee(5, 2, "a", "ES", defaults)).toBe(5);
      expect(defaultFee(0, 2, "a", "es", defaults)).toBe(4);
      expect(defaultFee(0, 2, "b", "ES", defaults)).toBe(0);
      expect(defaultFee(0, 2, "a", "NQ", defaults)).toBe(0);
    });

    it("derives direction-aware percentage stop and target prices", () => {
      expect(defaultRisk(200, "long", "a", "ES", defaults)).toEqual({
        stopLoss: 198,
        profitTarget: 206,
      });
      expect(defaultRisk(200, "short", "a", "ES", defaults)).toEqual({
        stopLoss: 202,
        profitTarget: 194,
      });
      expect(defaultRisk(200, "long", "a", "ES", EMPTY_DEFAULTS)).toEqual({});
    });
  });

  describe("routine scores use the schedule in force for that date", () => {
    const rules: Routine[] = [
      {
        id: "r",
        title: "Plan",
        stage: "Before trading",
        weekdays: [1, 2, 3, 4, 5],
        createdAt: "2026-09-01",
        archivedAt: "2026-09-04",
      },
    ];

    it("does not invent missed routines before creation or after archival", () => {
      expect(scheduledRules(rules, "2026-08-31")).toHaveLength(0);
      expect(scheduledRules(rules, "2026-09-05")).toHaveLength(0);
      expect(progressScore(rules, [], "2026-09-04").score).toBeNull();
      expect(progressScore(rules, [], "2026-09-02").score).toBe(0);
    });

    it("counts each scheduled routine once and ignores other days", () => {
      expect(
        progressScore(
          rules,
          [
            { ruleId: "r", date: "2026-09-02", done: true },
            { ruleId: "r", date: "2026-09-01", done: true },
          ],
          "2026-09-02",
        ),
      ).toEqual({ completed: 1, total: 1, score: 1 });
    });
  });

  describe("attachment type checks", () => {
    it("accepts supported signatures and rejects HTML/SVG content", () => {
      expect(attachmentMime(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
      expect(attachmentMime(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("image/png");
      expect(attachmentMime(new TextEncoder().encode('<svg onload="alert(1)"></svg>'))).toBeNull();
      expect(attachmentMime(new Uint8Array())).toBeNull();
    });
  });

  describe("note formatting", () => {
    const render = (text: string) =>
      renderToStaticMarkup(
        createElement(ReactMarkdown, { remarkPlugins: [remarkRepairSpacedEmphasis], children: text }),
      );

    it("renders the existing spaced-bold note from the reported screenshot", () => {
      expect(render("**This is a new **notes test")).toBe(
        "<p><strong>This is a new</strong> notes test</p>",
      );
    });

    it("keeps selection whitespace outside bold and italic markers", () => {
      for (const marker of ["*", "**"] as const) {
        const next = formatInlineSelection("A new notes test", 2, 6, marker);
        expect(next.value).toBe(`A ${marker}new${marker} notes test`);
        expect(next.value.slice(next.selectionStart, next.selectionEnd)).toBe("new");
        expect(render(next.value)).toContain(
          marker === "**" ? "<strong>new</strong>" : "<em>new</em>",
        );
      }
    });

    it("inserts selected placeholder text when formatting without a selection", () => {
      const next = formatInlineSelection("Test ", 5, 5, "**");
      expect(next.value.slice(next.selectionStart, next.selectionEnd)).toBe("bold text");
      expect(render(next.value)).toBe("<p>Test <strong>bold text</strong></p>");
    });

    it("preserves code, escaped literal stars, and valid formatting", () => {
      expect(render("`**code **` \\*\\*literal \\*\\* and **bold**")).toBe(
        "<p><code>**code **</code> **literal ** and <strong>bold</strong></p>",
      );
      expect(render("```\n**code **\n```")).toContain("<code>**code **\n</code>");
    });

    it("does not interpret raw HTML as markup", () => {
      expect(render("**Text **<img src=x onerror=alert(1)>")).not.toContain("<img");
    });
  });

  describe("dictation sessions", () => {
    const setup = () => {
      const recognizer: SpeechRecognizer = {
        lang: "",
        continuous: false,
        interimResults: false,
        start: vi.fn(),
        stop: vi.fn(),
        abort: vi.fn(),
        onstart: null,
        onresult: null,
        onend: null,
        onerror: null,
      };
      const callbacks = { onText: vi.fn(), onState: vi.fn(), onError: vi.fn() };
      const session = createDictationSession(recognizer, callbacks, "en-US");
      return { recognizer, callbacks, session };
    };
    const result = (transcript: string, isFinal = true) =>
      Object.assign([{ transcript }], { isFinal });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("waits for actual listening, batches final phrases, and ignores interim/replayed results", () => {
      const { recognizer, callbacks, session } = setup();
      session.start();
      expect(callbacks.onState.mock.calls).toEqual([["starting"]]);
      recognizer.onstart?.();
      expect(callbacks.onState).toHaveBeenLastCalledWith("listening");
      recognizer.onresult?.({
        resultIndex: 1,
        results: [result("old"), result(" first "), result("second"), result("interim", false)],
      });
      expect(callbacks.onText.mock.calls).toEqual([["first second"]]);
      session.dispose();
    });

    it("reports blocked permission, network failure and missing audio instead of failing silently", () => {
      for (const [code, text] of [
        ["not-allowed", "blocked"],
        ["network", "service"],
        ["audio-capture", "microphone"],
      ]) {
        const { recognizer, callbacks, session } = setup();
        session.start();
        recognizer.onerror?.({ error: code! });
        expect(callbacks.onError.mock.calls[0]?.[0]).toContain(text);
        expect(callbacks.onState).toHaveBeenLastCalledWith("idle");
        expect(recognizer.onresult).toBeNull();
      }
    });

    it("handles a throwing or unresponsive speech service", () => {
      vi.useFakeTimers();
      const failed = setup();
      failed.recognizer.start = () => {
        throw new Error("Unavailable");
      };
      expect(() => failed.session.start()).not.toThrow();
      expect(failed.callbacks.onError).toHaveBeenCalledOnce();
      const stalled = setup();
      stalled.session.start();
      vi.advanceTimersByTime(10000);
      expect(stalled.callbacks.onError).toHaveBeenCalledOnce();
      expect(stalled.recognizer.abort).toHaveBeenCalledOnce();
    });

    it("allows the final phrase after Stop but blocks late writes after navigating away", () => {
      const { recognizer, callbacks, session } = setup();
      session.start();
      session.stop();
      recognizer.onresult?.({ resultIndex: 0, results: [result("Final phrase")] });
      expect(callbacks.onText).toHaveBeenCalledWith("Final phrase");
      const late = recognizer.onresult;
      session.dispose();
      late?.({ resultIndex: 0, results: [result("Wrong note")] });
      expect(callbacks.onText).toHaveBeenCalledOnce();
    });
  });

  describe("screenshot slots configurations", () => {
    it("defines the 8 standard timeframes (Monthly to M3/M1)", () => {
      const keys = TIMEFRAME_CONFIG.map((t) => t.key);
      expect(keys).toHaveLength(8);
      expect(keys).toEqual(["tfM", "tfW", "tfD", "tfH4", "tfH1", "tfM15", "tfM5", "tfM3"]);
      expect(TIMEFRAME_CONFIG.find((t) => t.key === "tfM")?.label).toBe("Monthly");
      expect(TIMEFRAME_CONFIG.find((t) => t.key === "tfW")?.label).toBe("Weekly");
      expect(TIMEFRAME_CONFIG.find((t) => t.key === "tfD")?.label).toBe("Daily");
      expect(TIMEFRAME_CONFIG.find((t) => t.key === "tfM3")?.label).toBe("M3/M1");
    });

    it("builds and parses pre and post slot keys properly", () => {
      expect(buildSlotKey("pre", "tfM")).toBe("pre_tfM");
      expect(buildSlotKey("post", "tfM3")).toBe("post_tfM3");

      expect(parseSlotKey("pre_tfW")).toEqual({ category: "pre", timeframeKey: "tfW" });
      expect(parseSlotKey("post_tfH1")).toEqual({ category: "post", timeframeKey: "tfH1" });
      expect(parseSlotKey("tfD")).toEqual({ category: "pre", timeframeKey: "tfD" });
      expect(parseSlotKey(null)).toBeNull();
    });

    it("extracts image files from clipboard DataTransfer items or files", () => {
      const pngFile = new File([new Uint8Array([1, 2, 3])], "paste.png", { type: "image/png" });

      const dtWithItems = {
        items: [
          { type: "text/plain", getAsFile: () => null, kind: "string" },
          { type: "image/png", getAsFile: () => pngFile, kind: "file" },
        ],
        files: [],
        getData: () => "",
      } as unknown as DataTransfer;
      expect(extractImageFromDataTransfer(dtWithItems)).toBe(pngFile);

      const dtWithFiles = {
        items: [],
        files: [pngFile],
        getData: () => "",
      } as unknown as DataTransfer;
      expect(extractImageFromDataTransfer(dtWithFiles)).toBe(pngFile);

      const dtTextOnly = {
        items: [{ type: "text/plain", getAsFile: () => null, kind: "string" }],
        files: [],
        getData: () => "",
      } as unknown as DataTransfer;
      expect(extractImageFromDataTransfer(dtTextOnly)).toBeNull();
      expect(extractImageFromDataTransfer(null)).toBeNull();
    });
  });

  describe("journal calendar queries & persistence", () => {
    it("returns dates with written notes or day attachments", async () => {
      const { getJournaledDatesForMonth } = await import("../../src/server/journal");
      const { db, journalDays } = await import("../../src/db");
      const testDate = "2026-05-15";

      db.insert(journalDays)
        .values({ date: testDate, note: "Test journal entry", updatedAt: new Date().toISOString() })
        .run();

      const dates = getJournaledDatesForMonth(2026, 5);
      expect(dates).toContain(testDate);

      db.delete(journalDays).where(eq(journalDays.date, testDate)).run();
    });

    it("persists rating, reviewedAt, tags, and mistakes via PATCH and retrieves via GET", async () => {
      const { GET, PATCH } = await import("../../src/app/api/journal/[date]/route");
      const { db, journalDays } = await import("../../src/db");
      const testDate = "2026-07-20";

      const patchReq = new Request(`http://localhost/api/journal/${testDate}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: 5,
          reviewed: true,
          tags: ["trend day", "discipline"],
          mistakes: ["none"],
          note: "Great trading day!",
        }),
      });
      const patchRes = await PATCH(patchReq, { params: Promise.resolve({ date: testDate }) });
      expect(patchRes.status).toBe(200);

      const getReq = new Request(`http://localhost/api/journal/${testDate}`);
      const getRes = await GET(getReq, { params: Promise.resolve({ date: testDate }) });
      expect(getRes.status).toBe(200);
      const body = await getRes.json();
      expect(body.rating).toBe(5);
      expect(body.reviewedAt).toBeTruthy();
      expect(body.tagsJson).toBe(JSON.stringify(["trend day", "discipline"]));
      expect(body.mistakesJson).toBe(JSON.stringify(["none"]));
      expect(body.note).toBe("Great trading day!");

      db.delete(journalDays).where(eq(journalDays.date, testDate)).run();
    });

    it("detects day attachments and returns hasDayJournal = true even without text notes", async () => {
      const { GET } = await import("../../src/app/api/journal/[date]/route");
      const { db, attachments } = await import("../../src/db");
      const testDate = "2026-09-17";
      const attachmentId = "test_screenshot_att_1";

      db.insert(attachments)
        .values({
          id: attachmentId,
          ownerType: "day",
          ownerId: testDate,
          name: "test.webp",
          mime: "image/webp",
          size: 1024,
          data: Buffer.from("test"),
          slot: "pre_tfM15",
          createdAt: new Date().toISOString(),
        })
        .run();

      const getReq = new Request(`http://localhost/api/journal/${testDate}`);
      const getRes = await GET(getReq, { params: Promise.resolve({ date: testDate }) });
      expect(getRes.status).toBe(200);
      const body = await getRes.json();
      expect(body.hasDayJournal).toBe(true);
      expect(body.attachmentsCount).toBeGreaterThanOrEqual(1);

      db.delete(attachments).where(eq(attachments.id, attachmentId)).run();
    });

    it("API /api/attachments handles POST and GET with slot correctly", async () => {
      const { GET, POST } = await import("../../src/app/api/attachments/route");
      const { DELETE } = await import("../../src/app/api/attachments/[id]/route");

      const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
      const file = new File([pngBytes], "test-slot.png", { type: "image/png" });
      const formData = new FormData();
      formData.append("type", "day");
      formData.append("id", "2026-08-06");
      formData.append("slot", "tfH1");
      formData.append("file", file);

      const postReq = new Request("http://localhost/api/attachments", {
        method: "POST",
        body: formData,
      });
      const postRes = await POST(postReq);
      expect(postRes.status).toBe(200);
      const postData = (await postRes.json()) as { id: string };
      expect(postData.id).toBeDefined();

      const getReq = new Request("http://localhost/api/attachments?type=day&id=2026-08-06");
      const getRes = await GET(getReq);
      expect(getRes.status).toBe(200);
      const getData = (await getRes.json()) as {
        attachments: { id: string; name: string; mime: string; size: number; slot: string | null }[];
      };
      const found = getData.attachments.find((a) => a.id === postData.id);
      expect(found).toBeDefined();
      expect(found?.slot).toBe("tfH1");

      const delRes = await DELETE(new Request(`http://localhost/api/attachments/${postData.id}`), {
        params: Promise.resolve({ id: postData.id }),
      });
      expect(delRes.status).toBe(200);
    });

    it("isolates trade attachments from day attachments strictly without cross-pollution", async () => {
      const { db, accounts, trades } = await import("../../src/db");
      const { GET, POST } = await import("../../src/app/api/attachments/route");
      const { DELETE } = await import("../../src/app/api/attachments/[id]/route");

      const testAccId = "acc_iso_test";
      const testTradeKey = "trade_iso_test_mes";
      const testDate = "2026-10-05";

      db.insert(accounts)
        .values({
          id: testAccId,
          name: "Test Iso Account",
          kind: "manual",
          currency: "USD",
          createdAt: "2026-10-05T00:00:00Z",
        })
        .onConflictDoNothing()
        .run();

      db.insert(trades)
        .values({
          key: testTradeKey,
          accountId: testAccId,
          symbol: "MES",
          direction: "short",
          status: "win",
          openedAt: "2026-10-05T09:45:00Z",
          closedAt: "2026-10-05T09:52:00Z",
          quantity: 1,
          openQuantity: 0,
          avgEntry: 7769.25,
          avgExit: 7767.25,
          netPnl: 9.0,
          grossPnl: 10.0,
          fees: 1.0,
          executionCount: 1,
          executionIdsJson: "[]",
          exitsJson: "[]",
        })
        .onConflictDoNothing()
        .run();

      const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

      const dayForm = new FormData();
      dayForm.append("type", "day");
      dayForm.append("id", testDate);
      dayForm.append("slot", "pre_tfD");
      dayForm.append("file", new File([pngBytes], "us100-daily.png", { type: "image/png" }));

      const dayPostRes = await POST(
        new Request("http://localhost/api/attachments", { method: "POST", body: dayForm }),
      );
      expect(dayPostRes.status).toBe(200);
      const dayPost = (await dayPostRes.json()) as { id: string };

      const tradeForm = new FormData();
      tradeForm.append("type", "trade");
      tradeForm.append("id", testTradeKey);
      tradeForm.append("slot", "post_tfM5");
      tradeForm.append("file", new File([pngBytes], "mes-execution-5m.png", { type: "image/png" }));

      const tradePostRes = await POST(
        new Request("http://localhost/api/attachments", { method: "POST", body: tradeForm }),
      );
      expect(tradePostRes.status).toBe(200);
      const tradePost = (await tradePostRes.json()) as { id: string };

      const tradeGetRes = await GET(
        new Request(`http://localhost/api/attachments?type=trade&id=${testTradeKey}`),
      );
      expect(tradeGetRes.status).toBe(200);
      const tradeGetData = (await tradeGetRes.json()) as {
        attachments: { id: string; slot: string | null }[];
      };
      expect(tradeGetData.attachments.some((a) => a.id === tradePost.id)).toBe(true);
      expect(tradeGetData.attachments.some((a) => a.id === dayPost.id)).toBe(false);

      const dayGetRes = await GET(
        new Request(`http://localhost/api/attachments?type=day&id=${testDate}`),
      );
      expect(dayGetRes.status).toBe(200);
      const dayGetData = (await dayGetRes.json()) as {
        attachments: { id: string; slot: string | null }[];
      };
      expect(dayGetData.attachments.some((a) => a.id === dayPost.id)).toBe(true);
      expect(dayGetData.attachments.some((a) => a.id === tradePost.id)).toBe(false);

      await DELETE(new Request(`http://localhost/api/attachments/${dayPost.id}`), {
        params: Promise.resolve({ id: dayPost.id }),
      });
      await DELETE(new Request(`http://localhost/api/attachments/${tradePost.id}`), {
        params: Promise.resolve({ id: tradePost.id }),
      });
    });
  });
});
