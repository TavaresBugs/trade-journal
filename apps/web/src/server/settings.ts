import { eq } from "drizzle-orm";
import { db, settings } from "@/db";
import { decryptJson, encryptJson } from "./crypto";
import { EMPTY_DEFAULTS, type JournalDefaults } from "@/lib/journal-defaults";
import {
  AI_DEFAULT_MODELS,
  isAiProvider,
  type AiProvider,
  type AiSettingsPayload,
} from "@/lib/ai-settings";

export const getJournalDefaults = (): JournalDefaults => {
  try {
    return { ...EMPTY_DEFAULTS, ...JSON.parse(getSetting("journalDefaults") ?? "{}") };
  } catch {
    return EMPTY_DEFAULTS;
  }
};

export const getSetting = (key: string): string | null =>
  db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;

export const setSetting = (key: string, value: string): void => {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
};

export const deleteSetting = (key: string): void => {
  db.delete(settings).where(eq(settings.key, key)).run();
};

/** Journal display timezone (IANA), default UTC. */
export const getTimeZone = (): string => getSetting("timeZone") ?? "UTC";

/** Preserve the legacy parsing default until a separate import zone is saved. */
export const getImportTimeZone = (): string => getSetting("importTimeZone") ?? getTimeZone();

/** Per-symbol contract multipliers for futures/options P&L. */
export const getMultipliers = (): Record<string, number> => {
  const raw = getSetting("multipliers");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
};

export const aiKeyEnvironment = (provider: AiProvider): string | null =>
  (provider === "openai"
    ? process.env.OPENAI_API_KEY
    : provider === "google"
      ? process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
      : process.env.ANTHROPIC_API_KEY
  )?.trim() || null;

/** Provider keys are stored separately and encrypted like broker credentials. */
export const getAiKey = (provider: AiProvider): string | null => {
  const environment = aiKeyEnvironment(provider);
  if (environment) return environment;
  const envelope = getSetting(`${provider}KeyEnc`);
  if (!envelope) return null;
  try {
    const key = decryptJson<unknown>(envelope);
    return typeof key === "string" ? key.trim() || null : null;
  } catch {
    return null;
  }
};

export const setAiKey = (provider: AiProvider, key: string | null): void => {
  if (key === null) deleteSetting(`${provider}KeyEnc`);
  else setSetting(`${provider}KeyEnc`, encryptJson(key.trim()));
};

export const getAiProvider = (): AiProvider => {
  const selected = getSetting("aiProvider");
  if (isAiProvider(selected)) return selected;
  // Preserve existing Anthropic setups; an OpenAI or Google setup works without a UI visit.
  if (getAiKey("google") && !getAiKey("anthropic") && !getAiKey("openai")) return "google";
  return !getAiKey("anthropic") && getAiKey("openai") ? "openai" : "anthropic";
};

export const aiModelSetting = (provider: AiProvider): string =>
  provider === "anthropic" ? "aiModel" : provider === "google" ? "googleModel" : "openaiModel";

export const getAiModel = (provider: AiProvider): string =>
  getSetting(aiModelSetting(provider))?.trim() || AI_DEFAULT_MODELS[provider];

export const getAiSettings = (): AiSettingsPayload => {
  const aiProvider = getAiProvider();
  const connection = (provider: AiProvider) => ({
    configured: Boolean(getAiKey(provider)),
    source: aiKeyEnvironment(provider)
      ? ("environment" as const)
      : getAiKey(provider)
        ? ("saved" as const)
        : null,
    model: getAiModel(provider),
  });
  const aiConnections = {
    anthropic: connection("anthropic"),
    openai: connection("openai"),
    google: connection("google"),
  };
  return {
    aiProvider,
    aiConfigured: aiConnections[aiProvider].configured,
    aiModel: aiConnections[aiProvider].model,
    aiConnections,
  };
};

export interface VelaPreferences {
  velaDrawingFavorites: string[];
  velaDrawingPrefs: Record<string, unknown>;
  velaChartSettings?: Record<string, unknown> | null;
  replayWorkspace?: Record<string, unknown> | null;
  replayIndicatorTemplates?: unknown[] | null;
  replayFavoriteIndicators?: string[] | null;
  replayPersonalPineScripts?: unknown[] | null;
  velaReplayDrawings?: Record<string, string> | null;
}

const parseJsonObject = (raw: string | null): Record<string, unknown> | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {}
  return null;
};

const parseJsonArray = (raw: string | null): unknown[] | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {}
  return null;
};

const parseStringArray = (raw: string | null): string[] | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed;
    }
  } catch {}
  return null;
};

const parseStringMap = (raw: string | null): Record<string, string> | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof val === "string") {
          out[key] = val;
        }
      }
      return out;
    }
  } catch {}
  return null;
};

export const getVelaPreferences = (): VelaPreferences => {
  const velaDrawingFavorites = parseStringArray(getSetting("velaDrawingFavorites")) ?? [];
  const velaDrawingPrefs = parseJsonObject(getSetting("velaDrawingPrefs")) ?? {};
  const velaChartSettings = parseJsonObject(getSetting("velaChartSettings"));
  const replayWorkspace = parseJsonObject(getSetting("replayWorkspace"));
  const replayIndicatorTemplates = parseJsonArray(getSetting("replayIndicatorTemplates"));
  const replayFavoriteIndicators = parseStringArray(getSetting("replayFavoriteIndicators"));
  const replayPersonalPineScripts = parseJsonArray(getSetting("replayPersonalPineScripts"));
  const velaReplayDrawings = parseStringMap(getSetting("velaReplayDrawings"));

  return {
    velaDrawingFavorites,
    velaDrawingPrefs,
    velaChartSettings,
    replayWorkspace,
    replayIndicatorTemplates,
    replayFavoriteIndicators,
    replayPersonalPineScripts,
    velaReplayDrawings,
  };
};

export const setVelaPreferences = (prefs: {
  velaDrawingFavorites?: string[];
  velaDrawingPrefs?: Record<string, unknown>;
  velaChartSettings?: Record<string, unknown> | null;
  replayWorkspace?: Record<string, unknown> | null;
  replayIndicatorTemplates?: unknown[] | null;
  replayFavoriteIndicators?: string[] | null;
  replayPersonalPineScripts?: unknown[] | null;
  velaReplayDrawings?: Record<string, string> | null;
}): void => {
  if (prefs.velaDrawingFavorites !== undefined) {
    setSetting("velaDrawingFavorites", JSON.stringify(prefs.velaDrawingFavorites));
  }
  if (prefs.velaDrawingPrefs !== undefined) {
    setSetting("velaDrawingPrefs", JSON.stringify(prefs.velaDrawingPrefs));
  }
  if (prefs.velaChartSettings !== undefined) {
    if (prefs.velaChartSettings === null) deleteSetting("velaChartSettings");
    else setSetting("velaChartSettings", JSON.stringify(prefs.velaChartSettings));
  }
  if (prefs.replayWorkspace !== undefined) {
    if (prefs.replayWorkspace === null) deleteSetting("replayWorkspace");
    else setSetting("replayWorkspace", JSON.stringify(prefs.replayWorkspace));
  }
  if (prefs.replayIndicatorTemplates !== undefined) {
    if (prefs.replayIndicatorTemplates === null) deleteSetting("replayIndicatorTemplates");
    else setSetting("replayIndicatorTemplates", JSON.stringify(prefs.replayIndicatorTemplates));
  }
  if (prefs.replayFavoriteIndicators !== undefined) {
    if (prefs.replayFavoriteIndicators === null) deleteSetting("replayFavoriteIndicators");
    else setSetting("replayFavoriteIndicators", JSON.stringify(prefs.replayFavoriteIndicators));
  }
  if (prefs.replayPersonalPineScripts !== undefined) {
    if (prefs.replayPersonalPineScripts === null) deleteSetting("replayPersonalPineScripts");
    else setSetting("replayPersonalPineScripts", JSON.stringify(prefs.replayPersonalPineScripts));
  }
  if (prefs.velaReplayDrawings !== undefined) {
    if (prefs.velaReplayDrawings === null) {
      deleteSetting("velaReplayDrawings");
    } else {
      const existing = parseStringMap(getSetting("velaReplayDrawings")) ?? {};
      const merged: Record<string, string> = { ...existing };
      for (const [k, v] of Object.entries(prefs.velaReplayDrawings)) {
        if (typeof v === "string") {
          merged[k] = v;
        }
      }
      setSetting("velaReplayDrawings", JSON.stringify(merged));
    }
  }
};

