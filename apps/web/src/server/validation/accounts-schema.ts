import { isTimeZone } from "@/lib/timezone";

export type AccountKind = "sync" | "import" | "manual";
export type ProfitCalcMethod = "fifo" | "lifo" | "wavg";

export interface ValidatedCreateAccount {
  name: string;
  kind: AccountKind;
  broker: string;
  platform: string | null;
  accountNumber: string | null;
  maxDrawdown: number | null;
  timeZone?: string;
  currency: string;
  initialBalance: number;
  profitCalcMethod: ProfitCalcMethod;
  credentials?: Record<string, string>;
  autoSync: boolean;
}

export interface ValidatedPatchAccount {
  name?: string;
  broker?: string;
  platform?: string | null;
  accountNumber?: string | null;
  maxDrawdown?: number | null;
  timeZone?: string;
  currency?: string;
  initialBalance?: number;
  profitCalcMethod?: ProfitCalcMethod;
  autoSync?: boolean;
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

const MAX_STRING_LENGTH = 100;
const ISO_CURRENCY_REGEX = /^[A-Za-z]{3}$/;

/**
 * Validates and sanitizes payload for POST /api/accounts.
 * Zero external dependencies (native TypeScript type guards).
 */
export function validateCreateAccount(body: unknown): ValidationResult<ValidatedCreateAccount> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "name and kind are required" };
  }

  const b = body as Record<string, unknown>;

  // 1. name (required, string, 1..100)
  if (typeof b.name !== "string" || !b.name.trim()) {
    return { ok: false, error: "name and kind are required" };
  }
  const name = b.name.trim();
  if (name.length > MAX_STRING_LENGTH) {
    return { ok: false, error: `name must be at most ${MAX_STRING_LENGTH} characters` };
  }

  // 2. kind (required: sync | import | manual)
  if (typeof b.kind !== "string" || !b.kind) {
    return { ok: false, error: "name and kind are required" };
  }
  if (b.kind !== "sync" && b.kind !== "import" && b.kind !== "manual") {
    return { ok: false, error: "Invalid account kind. Must be 'sync', 'import', or 'manual'" };
  }
  const kind = b.kind as AccountKind;

  // 3. broker (optional string, sanitized, max 100)
  let broker = "";
  if (b.broker !== undefined && b.broker !== null) {
    if (typeof b.broker !== "string") {
      return { ok: false, error: "broker must be a string or null" };
    }
    broker = b.broker.trim();
    if (broker.length > MAX_STRING_LENGTH) {
      return { ok: false, error: `broker must be at most ${MAX_STRING_LENGTH} characters` };
    }
  }

  // 4. credentials (required if kind === 'sync')
  let credentials: Record<string, string> | undefined;
  if (b.credentials !== undefined && b.credentials !== null) {
    if (typeof b.credentials !== "object" || Array.isArray(b.credentials)) {
      return { ok: false, error: "credentials must be an object" };
    }
    credentials = b.credentials as Record<string, string>;
  }

  if (kind === "sync" && (!broker || !credentials || Object.keys(credentials).length === 0)) {
    return { ok: false, error: "sync accounts need a broker and credentials" };
  }

  // 5. platform (optional string or null, max 100)
  let platform: string | null = null;
  if (b.platform !== undefined && b.platform !== null) {
    if (typeof b.platform !== "string") {
      return { ok: false, error: "platform must be a string or null" };
    }
    const trimmed = b.platform.trim();
    if (trimmed.length > MAX_STRING_LENGTH) {
      return { ok: false, error: `platform must be at most ${MAX_STRING_LENGTH} characters` };
    }
    platform = trimmed || null;
  }

  // 6. accountNumber (optional string or null, max 100)
  let accountNumber: string | null = null;
  if (b.accountNumber !== undefined && b.accountNumber !== null) {
    if (typeof b.accountNumber !== "string") {
      return { ok: false, error: "accountNumber must be a string or null" };
    }
    const trimmed = b.accountNumber.trim();
    if (trimmed.length > MAX_STRING_LENGTH) {
      return { ok: false, error: `accountNumber must be at most ${MAX_STRING_LENGTH} characters` };
    }
    accountNumber = trimmed || null;
  }

  // 7. timeZone (optional string, IANA timezone)
  let timeZone: string | undefined;
  if (b.timeZone !== undefined && b.timeZone !== null && b.timeZone !== "") {
    if (typeof b.timeZone !== "string" || !isTimeZone(b.timeZone.trim())) {
      return { ok: false, error: "Invalid IANA timezone." };
    }
    timeZone = b.timeZone.trim();
  }

  // 8. profitCalcMethod (optional fifo | lifo | wavg, default fifo)
  let profitCalcMethod: ProfitCalcMethod = "fifo";
  if (b.profitCalcMethod !== undefined && b.profitCalcMethod !== null) {
    if (
      typeof b.profitCalcMethod !== "string" ||
      !["fifo", "lifo", "wavg"].includes(b.profitCalcMethod)
    ) {
      return { ok: false, error: "Invalid profit calculation method." };
    }
    profitCalcMethod = b.profitCalcMethod as ProfitCalcMethod;
  }

  // 9. currency (optional 3-letter ISO uppercase, default USD)
  let currency = "USD";
  if (b.currency !== undefined && b.currency !== null) {
    if (typeof b.currency !== "string" || !ISO_CURRENCY_REGEX.test(b.currency.trim())) {
      return { ok: false, error: "Invalid currency. Must be a 3-letter ISO code." };
    }
    currency = b.currency.trim().toUpperCase();
  }

  // 10. initialBalance (optional finite >= 0, default 0)
  let initialBalance = 0;
  if (b.initialBalance !== undefined && b.initialBalance !== null) {
    if (
      typeof b.initialBalance !== "number" ||
      !Number.isFinite(b.initialBalance) ||
      b.initialBalance < 0
    ) {
      return {
        ok: false,
        error: "initialBalance must be a finite number greater than or equal to 0",
      };
    }
    initialBalance = b.initialBalance;
  }

  // 11. maxDrawdown (optional finite > 0 or null, default null)
  let maxDrawdown: number | null = null;
  if (b.maxDrawdown !== undefined && b.maxDrawdown !== null) {
    if (
      typeof b.maxDrawdown !== "number" ||
      !Number.isFinite(b.maxDrawdown) ||
      b.maxDrawdown <= 0
    ) {
      return { ok: false, error: "maxDrawdown must be a positive number or null" };
    }
    maxDrawdown = b.maxDrawdown;
  }

  // 12. autoSync (optional boolean, default kind === 'sync')
  let autoSync = kind === "sync";
  if (b.autoSync !== undefined && b.autoSync !== null) {
    if (typeof b.autoSync !== "boolean") {
      return { ok: false, error: "autoSync must be a boolean" };
    }
    autoSync = b.autoSync;
  }

  return {
    ok: true,
    data: {
      name,
      kind,
      broker,
      platform,
      accountNumber,
      maxDrawdown,
      timeZone,
      currency,
      initialBalance,
      profitCalcMethod,
      credentials,
      autoSync,
    },
  };
}

/**
 * Validates and sanitizes payload for PATCH /api/accounts/[id].
 * Zero external dependencies (native TypeScript type guards).
 */
export function validatePatchAccount(body: unknown): ValidationResult<ValidatedPatchAccount> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body" };
  }

  const b = body as Record<string, unknown>;
  const patch: ValidatedPatchAccount = {};

  // 1. name
  if (b.name !== undefined) {
    if (typeof b.name !== "string" || !b.name.trim()) {
      return { ok: false, error: "name must be between 1 and 100 characters" };
    }
    const trimmed = b.name.trim();
    if (trimmed.length > MAX_STRING_LENGTH) {
      return { ok: false, error: `name must be at most ${MAX_STRING_LENGTH} characters` };
    }
    patch.name = trimmed;
  }

  // 2. broker
  if (b.broker !== undefined) {
    if (b.broker === null) {
      patch.broker = "";
    } else if (typeof b.broker === "string") {
      const trimmed = b.broker.trim();
      if (trimmed.length > MAX_STRING_LENGTH) {
        return { ok: false, error: `broker must be at most ${MAX_STRING_LENGTH} characters` };
      }
      patch.broker = trimmed;
    } else {
      return { ok: false, error: "broker must be a string or null" };
    }
  }

  // 3. platform
  if (b.platform !== undefined) {
    if (b.platform === null) {
      patch.platform = null;
    } else if (typeof b.platform === "string") {
      const trimmed = b.platform.trim();
      if (trimmed.length > MAX_STRING_LENGTH) {
        return { ok: false, error: `platform must be at most ${MAX_STRING_LENGTH} characters` };
      }
      patch.platform = trimmed || null;
    } else {
      return { ok: false, error: "platform must be a string or null" };
    }
  }

  // 4. accountNumber
  if (b.accountNumber !== undefined) {
    if (b.accountNumber === null) {
      patch.accountNumber = null;
    } else if (typeof b.accountNumber === "string") {
      const trimmed = b.accountNumber.trim();
      if (trimmed.length > MAX_STRING_LENGTH) {
        return {
          ok: false,
          error: `accountNumber must be at most ${MAX_STRING_LENGTH} characters`,
        };
      }
      patch.accountNumber = trimmed || null;
    } else {
      return { ok: false, error: "accountNumber must be a string or null" };
    }
  }

  // 5. maxDrawdown
  if (b.maxDrawdown !== undefined) {
    if (b.maxDrawdown === null) {
      patch.maxDrawdown = null;
    } else if (
      typeof b.maxDrawdown === "number" &&
      Number.isFinite(b.maxDrawdown) &&
      b.maxDrawdown > 0
    ) {
      patch.maxDrawdown = b.maxDrawdown;
    } else {
      return { ok: false, error: "maxDrawdown must be a positive number or null" };
    }
  }

  // 6. timeZone
  if (b.timeZone !== undefined) {
    if (typeof b.timeZone !== "string" || !isTimeZone(b.timeZone.trim())) {
      return { ok: false, error: "Invalid IANA timezone." };
    }
    patch.timeZone = b.timeZone.trim();
  }

  // 7. currency
  if (b.currency !== undefined) {
    if (typeof b.currency !== "string" || !ISO_CURRENCY_REGEX.test(b.currency.trim())) {
      return { ok: false, error: "Invalid currency. Must be a 3-letter ISO code." };
    }
    patch.currency = b.currency.trim().toUpperCase();
  }

  // 8. initialBalance
  if (b.initialBalance !== undefined) {
    if (
      typeof b.initialBalance !== "number" ||
      !Number.isFinite(b.initialBalance) ||
      b.initialBalance < 0
    ) {
      return {
        ok: false,
        error: "initialBalance must be a finite number greater than or equal to 0",
      };
    }
    patch.initialBalance = b.initialBalance;
  }

  // 9. profitCalcMethod
  if (b.profitCalcMethod !== undefined) {
    if (
      typeof b.profitCalcMethod !== "string" ||
      !["fifo", "lifo", "wavg"].includes(b.profitCalcMethod)
    ) {
      return { ok: false, error: "Invalid profit calculation method." };
    }
    patch.profitCalcMethod = b.profitCalcMethod as ProfitCalcMethod;
  }

  // 10. autoSync
  if (b.autoSync !== undefined) {
    if (typeof b.autoSync !== "boolean") {
      return { ok: false, error: "autoSync must be a boolean" };
    }
    patch.autoSync = b.autoSync;
  }

  return { ok: true, data: patch };
}
