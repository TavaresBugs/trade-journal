import { aiFeedback } from "../../src/lib/ai-feedback";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const originalDir = process.env.JOURNAL_DATA_DIR;
const scratch = mkdtempSync(join(tmpdir(), "journal-ai-test-"));
process.env.JOURNAL_DATA_DIR = scratch;
const { db, settings } = await import("../../src/db");
const { getAiKey, getAiModel, getAiProvider, setSetting, getSetting } =
  await import("../../src/server/settings");
const { GET, PATCH } = await import("../../src/app/api/settings/route");
const { GET: exportData } = await import("../../src/app/api/export/route");
const { aiConfigured, runAi } = await import("../../src/server/ai");
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

const request = (body: unknown) =>
  new Request("http://localhost/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const save = (body: unknown) => PATCH(request(body));
const state = async () => (await GET()).json();

beforeEach(() => {
  db.delete(settings).run();
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
  vi.stubEnv("JOURNAL_PASSWORD", "");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unexpected provider request");
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
afterAll(() => {
  db.$client.close();
  if (originalDir === undefined) delete process.env.JOURNAL_DATA_DIR;
  else process.env.JOURNAL_DATA_DIR = originalDir;
  rmSync(scratch, { recursive: true, force: true });
});

describe("AI provider settings", () => {
  it("starts unconfigured and refuses requests before contacting a provider", async () => {
    expect(await state()).toMatchObject({
      aiProvider: "anthropic",
      aiConfigured: false,
      aiModel: "claude-opus-5",
    });
    await expect(runAi("Fixture prompt")).rejects.toThrow("AI is not configured");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves the legacy Anthropic key and model while keeping OpenAI separate", async () => {
    expect(
      (await save({ anthropicKey: "fixture-anthropic", aiModel: "claude-custom" })).status,
    ).toBe(200);
    expect(getAiProvider()).toBe("anthropic");
    expect(
      (await save({ aiProvider: "openai", openaiKey: "  fixture-openai  ", aiModel: "gpt-4.1" }))
        .status,
    ).toBe(200);
    expect(await state()).toMatchObject({
      aiProvider: "openai",
      aiConfigured: true,
      aiModel: "gpt-4.1",
    });
    expect(getAiKey("anthropic")).toBe("fixture-anthropic");
    expect(getAiKey("openai")).toBe("fixture-openai");
    await save({ aiProvider: "anthropic" });
    expect(getAiModel("anthropic")).toBe("claude-custom");
    await save({ aiProvider: "openai" });
    expect(getAiModel("openai")).toBe("gpt-4.1");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("encrypts keys and omits keys and ciphertext from API responses and journal exports", async () => {
    const response = await save({
      aiProvider: "openai",
      openaiKey: "fixture-private-openai",
      anthropicKey: "fixture-private-anthropic",
      googleKey: "fixture-private-google",
    });
    const rows = JSON.stringify(db.select().from(settings).all());
    expect(rows).not.toContain("fixture-private");
    const exported = await exportData(new Request("http://localhost/api/export"));
    for (const body of [await response.text(), await (await GET()).text(), await exported.text()]) {
      expect(body).not.toContain("fixture-private");
      expect(body).not.toContain(getSetting("openaiKeyEnc")!);
      expect(body).not.toContain(getSetting("anthropicKeyEnc")!);
      expect(body).not.toContain(getSetting("googleKeyEnc")!);
    }
  });

  it("removes only the selected key and never falls back from an explicit provider choice", async () => {
    await save({
      aiProvider: "openai",
      openaiKey: "fixture-openai",
      anthropicKey: "fixture-anthropic",
      googleKey: "fixture-google",
    });
    await save({ openaiKey: null });
    expect(getAiKey("anthropic")).toBe("fixture-anthropic");
    expect(getAiKey("google")).toBe("fixture-google");
    expect(getAiKey("openai")).toBeNull();
    expect(aiConfigured()).toBe(false);
    await expect(runAi("Fixture")).rejects.toThrow("OpenAI API key");
    expect(fetch).not.toHaveBeenCalled();
    await save({ aiProvider: "google" });
    expect(aiConfigured()).toBe(true);
    await save({ googleKey: null });
    expect(getAiKey("google")).toBeNull();
    expect(aiConfigured()).toBe(false);
  });

  it("selects an OpenAI-only environment and preserves Anthropic when both keys exist", async () => {
    vi.stubEnv("OPENAI_API_KEY", "fixture-env-openai");
    expect(await state()).toMatchObject({
      aiProvider: "openai",
      aiModel: "gpt-6.1-mini",
      aiConnections: { openai: { configured: true, source: "environment" } },
    });
    vi.stubEnv("ANTHROPIC_API_KEY", "fixture-env-anthropic");
    expect(getAiProvider()).toBe("anthropic");
    await save({ aiProvider: "openai", aiModel: "gpt-4.1" });
    expect(getAiProvider()).toBe("openai");
  });

  it("selects a Google-only setup when only Google key is configured", async () => {
    await save({ googleKey: "fixture-google" });
    expect(getAiProvider()).toBe("google");
    expect(await state()).toMatchObject({
      aiProvider: "google",
      aiModel: "gemini-3.8-flash",
      aiConnections: { google: { configured: true, source: "saved" } },
    });
  });

  it("selects a Google-only environment when only GEMINI_API_KEY is set", async () => {
    vi.stubEnv("GEMINI_API_KEY", "fixture-env-gemini");
    expect(getAiProvider()).toBe("google");
    expect(await state()).toMatchObject({
      aiProvider: "google",
      aiModel: "gemini-3.8-flash",
      aiConnections: { google: { configured: true, source: "environment" } },
    });
  });

  it.each(["openai", "anthropic", "google"] as const)(
    "honors %s environment precedence and blocks misleading key edits",
    async (provider) => {
      await save({ [`${provider}Key`]: "fixture-saved" });
      const envVar =
        provider === "openai"
          ? "OPENAI_API_KEY"
          : provider === "google"
            ? "GEMINI_API_KEY"
            : "ANTHROPIC_API_KEY";
      vi.stubEnv(envVar, "fixture-env");
      expect(getAiKey(provider)).toBe("fixture-env");
      for (const key of [null, "fixture-replacement"])
        expect((await save({ [`${provider}Key`]: key })).status).toBe(400);
      expect((await save({ aiProvider: provider, aiModel: "custom-text-model" })).status).toBe(200);
    },
  );

  it("validates the entire request before writing any settings", async () => {
    for (const invalid of [
      { aiProvider: "unknown" },
      { aiProvider: null },
      { aiModel: 42 },
      { aiModel: "" },
      { aiModel: "a\nb" },
      ...["", " ", 42, {}, "key\nvalue", "a".repeat(4097)].flatMap((key) => [
        { openaiKey: key },
        { anthropicKey: key },
        { googleKey: key },
      ]),
    ]) {
      expect((await save({ timeZone: "America/Jamaica", ...invalid })).status).toBe(400);
      expect(db.select().from(settings).all()).toHaveLength(0);
    }
    for (const body of [null, [], 42]) expect((await save(body)).status).toBe(400);
  });

  it("treats unreadable saved credentials as unconfigured", async () => {
    setSetting("openaiKeyEnc", "broken-envelope");
    setSetting("aiProvider", "openai");
    expect(await state()).toMatchObject({
      aiConfigured: false,
      aiConnections: { openai: { source: null } },
    });
  });

  it("requires the journal session for reads and writes when a password is configured", async () => {
    vi.stubEnv("JOURNAL_PASSWORD", "fixture-password");
    expect((await GET()).status).toBe(401);
    expect((await save({ openaiKey: "fixture-key" })).status).toBe(401);
    expect(getAiKey("openai")).toBeNull();
  });
});

describe("AI provider requests through the real SDK adapters", () => {
  it("sends OpenAI's key and model to Responses with storage disabled", async () => {
    await save({
      aiProvider: "openai",
      openaiKey: "fixture-openai",
      anthropicKey: "fixture-anthropic",
    });
    const fetcher = vi.fn(async () =>
      Response.json({
        id: "resp_fixture",
        created_at: 1,
        model: "gpt-6.1-mini",
        status: "completed",
        output: [
          {
            type: "message",
            id: "msg_fixture",
            role: "assistant",
            content: [{ type: "output_text", text: "Fixture reflection", annotations: [] }],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await runAi("Fixture journal question", 700)).toBe("Fixture reflection");
    const [url, init] = (fetcher.mock.calls as unknown as [string, RequestInit][])[0]!;
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer fixture-openai");
    expect(JSON.stringify(init)).not.toContain("fixture-anthropic");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: "gpt-6.1-mini", max_output_tokens: 700, store: false });
    expect(JSON.stringify(body.input)).toContain("Fixture journal question");
  });

  it("keeps Anthropic requests using their own key, model, and endpoint", async () => {
    await save({
      anthropicKey: "fixture-anthropic",
      openaiKey: "fixture-openai",
      aiProvider: "anthropic",
      aiModel: "claude-custom",
    });
    const fetcher = vi.fn(async () =>
      Response.json({
        id: "msg_fixture",
        type: "message",
        role: "assistant",
        model: "claude-custom",
        content: [{ type: "text", text: "Anthropic fixture" }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await runAi("Fixture prompt", 800)).toBe("Anthropic fixture");
    const [url, init] = (fetcher.mock.calls as unknown as [string, RequestInit][])[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(new Headers(init.headers).get("x-api-key")).toBe("fixture-anthropic");
    expect(JSON.stringify(init)).not.toContain("fixture-openai");
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: "claude-custom",
      max_tokens: 800,
    });
  });

  it.each([
    [401, "Incorrect API key provided: fixture-private", "authentication_error"],
    [400, "You exceeded your current quota: fixture-private", "AI billing"],
    [404, "Model does not exist: fixture-private", "AI model unavailable"],
  ])("sanitizes provider errors (%s)", async (status, message, expected) => {
    await save({ aiProvider: "openai", openaiKey: "fixture-openai" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: { message, type: "invalid_request_error", code: "fixture" } },
          { status: Number(status) },
        ),
      ),
    );
    const error = await runAi("Fixture").catch((error) => error as Error);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(expected);
    expect((error as Error).message).not.toContain("fixture-private");
  });

  it("preserves rate-limit guidance after the SDK exhausts its retries", async () => {
    await save({ aiProvider: "openai", openaiKey: "fixture-openai" });
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: {
              message: "Rate limit exceeded",
              type: "rate_limit_error",
              code: "rate_limit_exceeded",
            },
          },
          { status: 429 },
        ),
      ),
    );
    const result = runAi("Fixture").catch((error) => error as Error);
    await vi.runAllTimersAsync();
    expect(((await result) as Error).message).toContain("AI rate limit");
  });

  it("sends requests to Google Gemini using gemini-3.8-flash", async () => {
    await save({
      aiProvider: "google",
      googleKey: "fixture-google",
      aiModel: "gemini-3.8-flash",
    });
    const fetcher = vi.fn(async () =>
      Response.json({
        id: "interact_fixture",
        steps: [
          {
            type: "model_output",
            content: [{ type: "text", text: "Google Gemini reflection" }],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await runAi("Fixture journal question", 700)).toBe("Google Gemini reflection");
    expect(fetcher).toHaveBeenCalled();
  });

  it.each([
    ["403 PERMISSION_DENIED: fixture-private", "authentication_error"],
    ["401 API_KEY_INVALID: fixture-private", "authentication_error"],
    ["429 RESOURCE_EXHAUSTED: fixture-private", "AI billing"],
    ["429 rate limit exceeded: fixture-private", "AI rate limit"],
    ["404 models/gemini-not-found is not found: fixture-private", "AI model unavailable"],
    ["500 Internal error: fixture-private", "AI request failed"],
  ])("sanitizes Google API errors (%s)", async (errorMessage, expected) => {
    await save({ aiProvider: "google", googleKey: "fixture-google" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error(errorMessage);
      }),
    );
    const error = await runAi("Fixture").catch((error) => error as Error);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(expected);
    expect((error as Error).message).not.toContain("fixture-private");
  });

  it("falls back to generateContent when interactions.create fails", async () => {
    await save({
      aiProvider: "google",
      googleKey: "fixture-google",
      aiModel: "gemini-3.8-flash",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : "url" in input ? input.url : String(input);
        if (url.includes("interactions")) {
          return new Response(
            JSON.stringify({ error: { message: "interactions not supported" } }),
            {
              status: 404,
              headers: { "content-type": "application/json" },
            },
          );
        }
        return Response.json({
          candidates: [
            {
              content: {
                parts: [{ text: "Fallback generated content" }],
                role: "model",
              },
            },
          ],
        });
      }),
    );
    expect(await runAi("Fixture journal question", 700)).toBe("Fallback generated content");
  });

  it("honors GOOGLE_GENERATIVE_AI_API_KEY environment variable when GEMINI_API_KEY is unset", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "fixture-google-secondary");
    expect(getAiKey("google")).toBe("fixture-google-secondary");
  });
});

describe("AI feedback", () => {
  it("explains empty or invalid scopes without suggesting an AI connection problem", () => {
    for (const message of [
      "No trades match the selected accounts and filters",
      "No closed trades match this day and the selected filters",
    ])
      expect(aiFeedback(message)).toEqual({
        title: "No matching trades",
        description:
          "There are no trades to analyze in this selection. Adjust the accounts, dates or other journal filters.",
        tone: "info",
      });
    expect(aiFeedback("A selected account no longer exists. Update your filters.").title).toBe(
      "Check your journal filters",
    );
    expect(aiFeedback("Journal timezone changed. Refresh and try again.").title).toBe(
      "Refresh your journal",
    );
  });
  it("treats missing setup as guidance with a direct settings destination", () => {
    expect(
      aiFeedback(
        "AI is not configured — add your Anthropic API key in Settings (it stays on your machine).",
      ),
    ).toMatchObject({
      tone: "info",
      title: "Set up AI to continue",
      action: { href: "/settings#ai-settings" },
    });
  });
  it("distinguishes credentials, billing and temporary provider failures", () => {
    expect(aiFeedback("authentication_error: invalid x-api-key").action?.label).toBe(
      "Review AI settings",
    );
    expect(aiFeedback("Your credit balance is too low").title).toBe(
      "Your AI account needs attention",
    );
    expect(aiFeedback("rate_limit_error")).toMatchObject({ tone: "info", retry: true });
    expect(aiFeedback("overloaded_error").retry).toBe(true);
  });
  it("offers data-specific empty-state guidance without an unhelpful retry", () => {
    expect(aiFeedback("The journal is empty — import trades first").action?.href).toBe("/import");
    const recap = aiFeedback("No closed trades on this day to recap");
    expect(recap.title).toBe("No trades to recap yet");
    expect(recap.retry).toBeUndefined();
  });
  it("recognizes OpenAI credentials, quota and model errors without showing key fragments", () => {
    const notice = aiFeedback("Incorrect API key provided: sk-proj-PRIVATE");
    expect(notice.action?.label).toBe("Review AI settings");
    expect(JSON.stringify(notice)).not.toContain("PRIVATE");
    expect(aiFeedback("insufficient_quota").title).toBe("Your AI account needs attention");
    expect(aiFeedback("You exceeded your current quota").retry).toBeUndefined();
    expect(aiFeedback("AI model unavailable").title).toBe("Check your AI model");
  });
  it("offers recovery for network and session failures", () => {
    expect(aiFeedback("Failed to fetch")).toMatchObject({
      title: "Couldn’t connect to AI",
      retry: true,
    });
    expect(aiFeedback("Unauthorized").action?.href).toBe("/login");
  });
  it("never echoes raw provider payloads or credentials into the notice", () => {
    const raw = 'Provider error: {secret: "sk-ant-PRIVATE", prompt: "PRIVATE JOURNAL"}';
    const notice = aiFeedback(raw);
    expect(notice.title).toBe("Couldn’t complete the AI request");
    expect(JSON.stringify(notice)).not.toContain("PRIVATE");
    expect(notice.retry).toBe(true);
  });
});
