import { accounts, db } from "@/db";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decryptJson, encryptJson } from "./crypto";
import { RequestError } from "./api";

export interface AccountPlatformCredentials {
  username: string;
  hasPassword: boolean;
  password?: string;
  platforms: string[];
}

export interface InternalAccountPlatformCredentials {
  username: string;
  password?: string;
  platforms: string[];
}

export interface AccountCredentialsResult {
  credentials: AccountPlatformCredentials | null;
  account: {
    id: string;
    name: string;
    accountNumber?: string | null;
    platform?: string | null;
    broker?: string | null;
  };
  suggestedEnvKey: string;
}

export interface InternalAccountCredentialsResult {
  credentials: InternalAccountPlatformCredentials | null;
  account: {
    id: string;
    name: string;
    accountNumber?: string | null;
    platform?: string | null;
    broker?: string | null;
  };
  suggestedEnvKey: string;
}

/**
 * Searches process.env and SQLite for raw credentials matching an account.
 * Internal-only helper for broker sync and backend routines requiring plaintext password.
 * NEVER expose this function's result to client API callers.
 */
export function getAccountCredentialsInternal(
  accountId: string,
): InternalAccountCredentialsResult | null {
  const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
  if (!account) return null;

  const rawNumber = account.accountNumber?.trim() || "";
  const normalizedNumber = rawNumber ? rawNumber.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase() : "";
  const normalizedId = account.id.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();

  const suggestedEnvKey = normalizedNumber ? `ACCOUNT_${normalizedNumber}` : `ACCOUNT_${normalizedId}`;

  const normPlatform = (account.platform || "").toLowerCase();
  const defaultPlatforms =
    normPlatform.includes("mt5") || normPlatform.includes("metatrader5")
      ? ["metatrader5"]
      : normPlatform.includes("mt4") || normPlatform.includes("metatrader4")
        ? ["metatrader"]
        : normPlatform.includes("tradovate") || account.broker === "lucid" || account.broker === "tradeify"
          ? ["ninjatrader", "tradovate", "tradingview"]
          : account.platform
            ? [account.platform.toLowerCase()]
            : ["ninjatrader", "tradovate", "tradingview"];

  // 1. Check prefixed env variables
  const keysToTry = [
    normalizedNumber ? `ACCOUNT_${normalizedNumber}` : null,
    `ACCOUNT_${normalizedId}`,
  ].filter(Boolean) as string[];

  for (const prefix of keysToTry) {
    const user = process.env[`${prefix}_USERNAME`]?.trim();
    const pass = process.env[`${prefix}_PASSWORD`]?.trim();
    const platformsRaw = process.env[`${prefix}_PLATFORMS`]?.trim();
    if (user) {
      const platforms = platformsRaw
        ? platformsRaw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
        : defaultPlatforms;
      return {
        credentials: {
          username: user,
          password: pass || "",
          platforms,
        },
        account: {
          id: account.id,
          name: account.name,
          accountNumber: account.accountNumber,
          platform: account.platform,
          broker: account.broker,
        },
        suggestedEnvKey,
      };
    }
  }

  // 2. Check JSON map in ACCOUNT_CREDENTIALS
  if (process.env.ACCOUNT_CREDENTIALS) {
    try {
      const parsed = JSON.parse(process.env.ACCOUNT_CREDENTIALS);
      if (typeof parsed === "object" && parsed !== null) {
        const candidates = [rawNumber, normalizedNumber, account.id, normalizedId].filter(Boolean);
        const matchKey = candidates.find((k) => parsed[k] !== undefined);
        if (matchKey && parsed[matchKey]) {
          const entry = parsed[matchKey];
          return {
            credentials: {
              username: String(entry.username || entry.user || ""),
              password: String(entry.password || entry.pass || ""),
              platforms: Array.isArray(entry.platforms)
                ? entry.platforms.map(String)
                : typeof entry.platforms === "string"
                  ? entry.platforms.split(",").map((s: string) => s.trim().toLowerCase())
                  : defaultPlatforms,
            },
            account: {
              id: account.id,
              name: account.name,
              accountNumber: account.accountNumber,
              platform: account.platform,
              broker: account.broker,
            },
            suggestedEnvKey,
          };
        }
      }
    } catch {
      // Ignore JSON parse errors in ACCOUNT_CREDENTIALS
    }
  }

  // 3. Fallback: Check account.credentialsEnc in DB
  if (account.credentialsEnc) {
    // 3a. Try AES-256-GCM decryptJson
    try {
      const decrypted = decryptJson<{
        username?: string;
        user?: string;
        password?: string;
        pass?: string;
        platforms?: string[];
      }>(account.credentialsEnc);

      if (decrypted && typeof decrypted === "object" && (decrypted.username || decrypted.user)) {
        return {
          credentials: {
            username: String(decrypted.username || decrypted.user),
            password: String(decrypted.password || decrypted.pass || ""),
            platforms: Array.isArray(decrypted.platforms) ? decrypted.platforms : defaultPlatforms,
          },
          account: {
            id: account.id,
            name: account.name,
            accountNumber: account.accountNumber,
            platform: account.platform,
            broker: account.broker,
          },
          suggestedEnvKey,
        };
      }
    } catch {
      // 3b. Graceful fallback if legacy plaintext JSON exists
      try {
        const parsed = JSON.parse(account.credentialsEnc);
        if (parsed && typeof parsed === "object" && (parsed.username || parsed.user)) {
          return {
            credentials: {
              username: String(parsed.username || parsed.user),
              password: String(parsed.password || parsed.pass || ""),
              platforms: Array.isArray(parsed.platforms) ? parsed.platforms : defaultPlatforms,
            },
            account: {
              id: account.id,
              name: account.name,
              accountNumber: account.accountNumber,
              platform: account.platform,
              broker: account.broker,
            },
            suggestedEnvKey,
          };
        }
      } catch {
        // Not valid JSON either
      }
    }
  }

  return {
    credentials: null,
    account: {
      id: account.id,
      name: account.name,
      accountNumber: account.accountNumber,
      platform: account.platform,
      broker: account.broker,
    },
    suggestedEnvKey,
  };
}

/**
 * Searches process.env and SQLite for credentials matching an account.
 * NEVER returns plaintext passwords to client callers — passwords are masked
 * into `hasPassword: boolean`.
 */
export function getAccountCredentials(accountId: string): AccountCredentialsResult | null {
  const internal = getAccountCredentialsInternal(accountId);
  if (!internal) return null;

  return {
    account: internal.account,
    suggestedEnvKey: internal.suggestedEnvKey,
    credentials: internal.credentials
      ? {
          username: internal.credentials.username,
          platforms: internal.credentials.platforms,
          hasPassword: Boolean(internal.credentials.password),
        }
      : null,
  };
}

export interface AllAccountsCredentialsResult {
  accounts: AccountCredentialsResult[];
}

/**
 * Retrieves credentials for all active (non-archived) accounts.
 */
export function getAllAccountsCredentials(): AllAccountsCredentialsResult {
  const allAccounts = db
    .select({ id: accounts.id })
    .from(accounts)
    .where(isNull(accounts.archivedAt))
    .orderBy(asc(accounts.createdAt))
    .all();

  const results = allAccounts
    .map((acc) => getAccountCredentials(acc.id))
    .filter((res): res is AccountCredentialsResult => res !== null);

  return { accounts: results };
}

export interface SaveAccountCredentialsInput {
  username: string;
  password?: string;
  platforms?: string[];
}

/**
 * Updates or appends environment key/value pairs in an .env file content string.
 * Preserves all other variables and existing line structure.
 * Rejects any key or value containing CRLF (\r or \n) to prevent environment injection.
 */
export function updateEnvContent(
  existingContent: string,
  keyValues: Record<string, string>,
  sectionComment?: string,
): string {
  // Validate against CRLF injection
  for (const [key, value] of Object.entries(keyValues)) {
    if (/[\r\n]/.test(key) || /[\r\n]/.test(value)) {
      throw new RequestError("Environment key and value cannot contain newline characters", 400);
    }
  }

  let content = existingContent;
  const missingKeys: [string, string][] = [];

  for (const [key, value] of Object.entries(keyValues)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    const line = `${key}=${value}`;
    if (regex.test(content)) {
      content = content.replace(regex, line);
    } else {
      missingKeys.push([key, value]);
    }
  }

  if (missingKeys.length > 0) {
    if (content.length > 0 && !content.endsWith("\n")) {
      content += "\n";
    }
    if (sectionComment) {
      content += `\n${sectionComment}\n`;
    }
    for (const [k, v] of missingKeys) {
      content += `${k}=${v}\n`;
    }
  }

  return content;
}

/**
 * Removes specified environment keys and associated comments from an .env content string.
 */
export function removeEnvContent(
  existingContent: string,
  keysToRemove: string[],
  commentsToClean?: string[],
): string {
  if (!existingContent) return "";
  let lines = existingContent.split("\n");

  const keySet = new Set(keysToRemove);

  lines = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      if (keySet.has(key)) return false;
    }
    if (commentsToClean && commentsToClean.length > 0 && trimmed.startsWith("#")) {
      for (const pattern of commentsToClean) {
        if (pattern && trimmed.includes(pattern)) {
          return false;
        }
      }
    }
    return true;
  });

  // Collapse consecutive blank lines
  const cleaned: string[] = [];
  let prevEmpty = false;
  for (const line of lines) {
    const isEmpty = line.trim() === "";
    if (isEmpty) {
      if (!prevEmpty && cleaned.length > 0) {
        cleaned.push("");
      }
      prevEmpty = true;
    } else {
      cleaned.push(line);
      prevEmpty = false;
    }
  }

  let result = cleaned.join("\n").trim();
  if (result.length > 0) {
    result += "\n";
  }
  return result;
}

export function getEnvLocalFilePaths(): string[] {
  const paths: string[] = [];
  const cwd = process.cwd();

  let rootDir = cwd;
  if (existsSync(join(cwd, "apps/web"))) {
    rootDir = cwd;
  } else if (existsSync(join(cwd, "..", "..", "apps/web"))) {
    rootDir = join(cwd, "..", "..");
  } else if (existsSync(join(cwd, "..", "apps/web"))) {
    rootDir = join(cwd, "..");
  }

  paths.push(join(rootDir, ".env.local"));

  const webDir = join(rootDir, "apps/web");
  if (existsSync(webDir)) {
    paths.push(join(webDir, ".env.local"));
  }

  return Array.from(new Set(paths));
}

/**
 * Saves platform credentials for an account:
 * 1. Validates input against CRLF injection
 * 2. Updates in-memory process.env
 * 3. Encrypts payload with AES-256-GCM and persists to accounts.credentialsEnc in SQLite
 * 4. Writes / updates .env.local on disk
 * 5. Returns masked credentials ({ hasPassword: boolean }) without plaintext password
 */
export function saveAccountCredentials(
  accountId: string,
  input: SaveAccountCredentialsInput,
): AccountCredentialsResult | null {
  // Strictly validate that username, password, and platforms contain NO newline characters (\r or \n)
  if (
    /[\r\n]/.test(input.username) ||
    (input.password && /[\r\n]/.test(input.password)) ||
    input.platforms?.some((p) => typeof p === "string" && /[\r\n]/.test(p))
  ) {
    throw new RequestError("Username, password, and platforms cannot contain newline characters", 400);
  }

  const cleanUsername = input.username.trim();
  if (!cleanUsername) {
    throw new RequestError("Username is required", 400);
  }

  const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
  if (!account) return null;

  const rawNumber = account.accountNumber?.trim() || "";
  const normalizedNumber = rawNumber ? rawNumber.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase() : "";
  const normalizedId = account.id.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
  const suggestedEnvKey = normalizedNumber ? `ACCOUNT_${normalizedNumber}` : `ACCOUNT_${normalizedId}`;

  const cleanPassword = (input.password || "").trim();
  const normPlatform = (account.platform || "").toLowerCase();
  const defaultPlatforms =
    normPlatform.includes("mt5") || normPlatform.includes("metatrader5")
      ? ["metatrader5"]
      : normPlatform.includes("mt4") || normPlatform.includes("metatrader4")
        ? ["metatrader"]
        : normPlatform.includes("tradovate") || account.broker === "lucid" || account.broker === "tradeify"
          ? ["ninjatrader", "tradovate", "tradingview"]
          : account.platform
            ? [account.platform.toLowerCase()]
            : ["ninjatrader", "tradovate", "tradingview"];

  const platforms =
    input.platforms && input.platforms.length > 0
      ? input.platforms.map((p) => p.trim().toLowerCase())
      : defaultPlatforms;

  // 1. In-memory process.env
  process.env[`${suggestedEnvKey}_USERNAME`] = cleanUsername;
  process.env[`${suggestedEnvKey}_PASSWORD`] = cleanPassword;
  process.env[`${suggestedEnvKey}_PLATFORMS`] = platforms.join(",");

  // 2. Persist AES-256-GCM encrypted payload to database accounts.credentialsEnc
  const credentialsPayload = encryptJson({
    username: cleanUsername,
    password: cleanPassword,
    platforms,
  });
  db.update(accounts)
    .set({ credentialsEnc: credentialsPayload })
    .where(eq(accounts.id, accountId))
    .run();

  // 3. Write to .env.local
  try {
    const envPaths = getEnvLocalFilePaths();
    for (const envPath of envPaths) {
      const existing = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";
      const updated = updateEnvContent(
        existing,
        {
          [`${suggestedEnvKey}_USERNAME`]: cleanUsername,
          [`${suggestedEnvKey}_PASSWORD`]: cleanPassword,
          [`${suggestedEnvKey}_PLATFORMS`]: platforms.join(","),
        },
        `# Platform credentials for ${account.name} (${account.accountNumber || account.id})`,
      );
      writeFileSync(envPath, updated, "utf-8");
    }
  } catch (err) {
    if (err instanceof RequestError) throw err;
    console.error("Warning: Could not write to .env.local file:", err);
  }

  // 4. Return masked result (plaintext password is never returned to client callers)
  return {
    credentials: {
      username: cleanUsername,
      platforms,
      hasPassword: Boolean(cleanPassword),
    },
    account: {
      id: account.id,
      name: account.name,
      accountNumber: account.accountNumber,
      platform: account.platform,
      broker: account.broker,
    },
    suggestedEnvKey,
  };
}

export interface DeleteAccountCredentialsResult {
  removed: boolean;
  reason?: string;
  keysRemoved?: string[];
}

/**
 * Safely removes environment credentials when an account is deleted.
 * Security & Collision Check:
 * If another active (non-archived) account shares the same accountNumber,
 * credentials, or env prefix, the shared variables are PRESERVED in .env and process.env.
 * Only when no other active account shares them are they deleted from disk and memory.
 */
export function deleteAccountCredentials(accountId: string): DeleteAccountCredentialsResult {
  const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
  if (!account) {
    return { removed: false, reason: "Account not found" };
  }

  const rawNumber = account.accountNumber?.trim() || "";
  const normalizedNumber = rawNumber ? rawNumber.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase() : "";
  const normalizedId = account.id.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
  const suggestedEnvKey = normalizedNumber ? `ACCOUNT_${normalizedNumber}` : `ACCOUNT_${normalizedId}`;

  // Find all OTHER active accounts in the database
  const otherAccounts = db
    .select()
    .from(accounts)
    .where(and(ne(accounts.id, accountId), isNull(accounts.archivedAt)))
    .all();

  // Check if any other active account shares the same accountNumber or normalized env key
  const hasSharedAccount = otherAccounts.some((other) => {
    const otherRawNumber = other.accountNumber?.trim() || "";
    if (rawNumber && otherRawNumber && rawNumber.toLowerCase() === otherRawNumber.toLowerCase()) {
      return true;
    }
    const otherNormNumber = otherRawNumber
      ? otherRawNumber.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()
      : "";
    if (normalizedNumber && otherNormNumber && normalizedNumber === otherNormNumber) {
      return true;
    }
    return false;
  });

  const keysToRemove: string[] = [];

  // Keys specifically tied to this account's unique ID
  const idPrefix = `ACCOUNT_${normalizedId}`;
  keysToRemove.push(`${idPrefix}_USERNAME`, `${idPrefix}_PASSWORD`, `${idPrefix}_PLATFORMS`);

  // Keys tied to account number (only remove if no other active account shares this number)
  if (!hasSharedAccount && normalizedNumber) {
    const numPrefix = `ACCOUNT_${normalizedNumber}`;
    keysToRemove.push(`${numPrefix}_USERNAME`, `${numPrefix}_PASSWORD`, `${numPrefix}_PLATFORMS`);
  }

  // 1. Clean in-memory process.env
  for (const key of keysToRemove) {
    delete process.env[key];
  }

  // 2. Clean ACCOUNT_CREDENTIALS JSON map if present
  if (process.env.ACCOUNT_CREDENTIALS) {
    try {
      const parsed = JSON.parse(process.env.ACCOUNT_CREDENTIALS);
      if (typeof parsed === "object" && parsed !== null) {
        delete parsed[account.id];
        delete parsed[normalizedId];
        if (!hasSharedAccount) {
          if (rawNumber) delete parsed[rawNumber];
          if (normalizedNumber) delete parsed[normalizedNumber];
        }
        process.env.ACCOUNT_CREDENTIALS = JSON.stringify(parsed);
      }
    } catch {
      // Ignore JSON parse error
    }
  }

  // 3. Clean .env.local on disk
  const commentsToClean: string[] = [];
  if (account.id) {
    commentsToClean.push(`(${account.id})`);
  }
  if (!hasSharedAccount && rawNumber) {
    commentsToClean.push(`(${rawNumber})`);
  }

  try {
    const envPaths = getEnvLocalFilePaths();
    for (const envPath of envPaths) {
      if (existsSync(envPath)) {
        const existing = readFileSync(envPath, "utf-8");
        const updated = removeEnvContent(existing, keysToRemove, commentsToClean);
        writeFileSync(envPath, updated, "utf-8");
      }
    }
  } catch (err) {
    console.error("Warning: Could not update .env.local files upon account deletion:", err);
  }

  if (hasSharedAccount) {
    return {
      removed: false,
      reason: `Shared credentials for ${rawNumber || suggestedEnvKey} preserved because another active account shares them.`,
      keysRemoved: keysToRemove.filter((k) => k.startsWith(idPrefix)),
    };
  }

  return {
    removed: true,
    keysRemoved: keysToRemove,
  };
}
