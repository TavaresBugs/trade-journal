import { GoogleGenAI } from "@google/genai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, RetryError, generateText } from "ai";
import { getAiKey, getAiModel, getAiProvider } from "./settings";
import { AI_PROVIDER_NAMES } from "@/lib/ai-settings";

/**
 * BYO-key AI. Self-hosted means YOUR key on YOUR box: the key is read from the
 * encrypted settings store (or the selected provider's environment variable).
 * Requests go straight from this server to the selected provider.
 */
export const aiConfigured = (): boolean => getAiKey(getAiProvider()) !== null;

const SYSTEM = `You are the reflection layer of a trader's journal.
You see only the trader's own recorded data — trades, stats, and notes. Ground every
statement in those numbers; never invent trades, prices, or market context you weren't given.
Be direct and specific like a good trading coach: name the behavior, cite the numbers,
say what to keep and what to fix. No platitudes, no disclaimers about trading being risky —
the trader knows. Keep it tight.`;

export const runAi = async (prompt: string, maxOutputTokens = 1200): Promise<string> => {
  const provider = getAiProvider();
  const apiKey = getAiKey(provider);
  if (!apiKey) {
    throw new Error(
      `AI is not configured — add your ${AI_PROVIDER_NAMES[provider]} API key in Settings.`,
    );
  }
  const model = getAiModel(provider);

  if (provider === "google") {
    try {
      const ai = new GoogleGenAI({ apiKey });
      try {
        const interaction = await ai.interactions.create({
          model,
          input: `${SYSTEM}\n\n${prompt}`,
        });
        const text = (interaction as { output_text?: string }).output_text;
        if (text && text.trim()) return text.trim();
      } catch {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: SYSTEM,
            maxOutputTokens,
          },
        });
        if (response.text && response.text.trim()) return response.text.trim();
      }
      throw new Error("AI returned no text. Check the model or try again.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/401|403|API_KEY_INVALID|PERMISSION_DENIED|authentication/i.test(msg)) {
        throw new Error(
          "AI authentication_error: check your provider key and permissions in Settings.",
        );
      }
      if (
        /credit balance|billing|insufficient_quota|exceeded your current quota|RESOURCE_EXHAUSTED/i.test(
          msg,
        )
      ) {
        throw new Error("AI billing: check your provider account's credits and quota.");
      }
      if (/429|529|rate limit|exhausted/i.test(msg)) {
        throw new Error("AI rate limit: please try again shortly.");
      }
      if (/404|model.*(?:not found|does not exist|access)/i.test(msg)) {
        throw new Error(
          "AI model unavailable: check the model ID and your provider access in Settings.",
        );
      }
      throw new Error("AI request failed. Check your provider settings or try again shortly.");
    }
  }

  try {
    const result = await generateText({
      model:
        provider === "openai"
          ? createOpenAI({ apiKey }).responses(model)
          : createAnthropic({ apiKey })(model),
      ...(provider === "openai" ? { providerOptions: { openai: { store: false } } } : {}),
      system: SYSTEM,
      prompt,
      maxOutputTokens,
    });
    if (!result.text.trim()) throw new Error("AI returned no text. Check the model or try again.");
    return result.text;
  } catch (error) {
    if (RetryError.isInstance(error)) error = error.lastError;
    // Provider error messages can contain key fragments or request data. Never relay them.
    if (APICallError.isInstance(error)) {
      if (error.statusCode === 401 || error.statusCode === 403)
        throw new Error(
          "AI authentication_error: check your provider key and permissions in Settings.",
        );
      if (
        /credit balance|billing|insufficient_quota|exceeded your current quota/i.test(error.message)
      )
        throw new Error("AI billing: check your provider account's credits and quota.");
      if (error.statusCode === 429 || error.statusCode === 529)
        throw new Error("AI rate limit: please try again shortly.");
      if (
        error.statusCode === 404 ||
        /model.*(?:not found|does not exist|access)/i.test(error.message)
      )
        throw new Error(
          "AI model unavailable: check the model ID and your provider access in Settings.",
        );
    }
    throw new Error("AI request failed. Check your provider settings or try again shortly.");
  }
};
