import {
  FORMATS,
  parseAuto,
  parseWithMapping,
  readHeaders,
  type GenericMapping,
  type ImportedExecution,
} from "@luxalgo/journal-importers";
import { bad, handler, ok, requireValue } from "@/server/api";
import { insertExecutions } from "@/server/executions";
import { getImportTimeZone } from "@/server/settings";
import { isTimeZone } from "@/lib/timezone";
import type { ImportReviewOptions } from "@/lib/import-review";
import { previewNinjaTraderImport, commitNinjaTraderImport } from "@/server/ninjatrader-import";
import { reconcileImport } from "@/server/import-reconciliation";
import { db } from "@/db";

import { accounts, importSources } from "@/db/schema";
import { and, eq, isNull, or } from "drizzle-orm";
import {
  getBrokerMetadata,
  formatToPlatformId,
  platformToDefaultBrokerId,
  checkPlatformCompatibility,
} from "@/lib/brokers/broker-catalog";
import { newId, nowIso } from "@/server/ids";

interface ImportBody {
  mode: "preview" | "commit";
  content: string;
  accountId?: string;
  /** Column mapping when auto-detection found nothing. */
  mapping?: GenericMapping;
  timeZone?: string;
  dateOrder?: "DMY" | "MDY";
  fileName?: string;
  symbol?: string;
  review?: ImportReviewOptions;
  forceMismatch?: boolean;
}

/**
 * One endpoint, two steps. Preview parses and reports what WOULD be imported;
 * nothing is guessed silently, exactly because the file formats in the wild
 * drift. Commit inserts with dedup, so re-importing the same file is a no-op.
 */
export const POST = handler(async (request: Request) => {
  const body = (await request.json()) as ImportBody;
  if (typeof body.content !== "string" || !body.content) return bad("content is required");
  if (!["preview", "commit"].includes(body.mode)) return bad("mode must be preview or commit");
  if (body.symbol !== undefined && (typeof body.symbol !== "string" || body.symbol.length > 100))
    return bad("Invalid symbol");
  if (body.fileName !== undefined && typeof body.fileName !== "string")
    return bad("Invalid filename");
  if (body.dateOrder !== undefined && !["DMY", "MDY"].includes(body.dateOrder))
    return bad("Invalid dateOrder (must be 'DMY' or 'MDY')");

  const account = body.accountId
    ? db.select().from(accounts).where(eq(accounts.id, body.accountId)).get()
    : undefined;
  const brokerMeta = account?.broker ? getBrokerMetadata(account.broker) : undefined;

  if (body.timeZone !== undefined)
    requireValue(isTimeZone(body.timeZone), "Enter a valid IANA statement timezone.");

  const timeZone = body.timeZone ?? getImportTimeZone();

  const dateOrder =
    body.dateOrder ??
    (brokerMeta?.dateFormat === "DMY"
      ? "DMY"
      : brokerMeta?.dateFormat === "MDY"
        ? "MDY"
        : undefined);

  const importOptions = {
    timeZone,
    fileName: body.fileName,
    symbol: body.symbol,
    dateOrder,
  };

  const parsed = body.mapping
    ? parseWithMapping(body.content, body.mapping, importOptions)
    : parseAuto(body.content, importOptions);

  if (!parsed) {
    return ok({
      detected: null,
      timeZone,
      dateOrder,
      headers: readHeaders(body.content),
      needsMapping: true,
    });
  }

  if (body.mode === "preview") {
    const targetAccount = body.accountId
      ? db.select().from(accounts).where(eq(accounts.id, body.accountId)).get()
      : undefined;

    let accountConflict: { isConflict: boolean; detectedAccount?: string; targetAccountNumber?: string; targetAccountName?: string } | undefined;
    if (targetAccount && parsed.account && targetAccount.accountNumber) {
      if (targetAccount.accountNumber.trim().toLowerCase() !== parsed.account.trim().toLowerCase()) {
        accountConflict = {
          isConflict: true,
          detectedAccount: parsed.account,
          targetAccountNumber: targetAccount.accountNumber,
          targetAccountName: targetAccount.name,
        };
      }
    }

    const compatibility = targetAccount ? checkPlatformCompatibility(targetAccount, parsed.format) : undefined;

    let resolvedAccountId = body.accountId;
    if (accountConflict?.isConflict && !body.forceMismatch) {
      // Do not run reconciliation against a conflicting account
      resolvedAccountId = undefined;
    }

    if (!resolvedAccountId && parsed.account) {
      const matched = db
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            isNull(accounts.archivedAt),
            or(
              eq(accounts.accountNumber, parsed.account),
              eq(accounts.name, parsed.account),
            ),
          ),
        )
        .get();
      if (matched) {
        resolvedAccountId = matched.id;
      }
    }
    if (!resolvedAccountId) {
      const activeAccounts = db
        .select()
        .from(accounts)
        .where(isNull(accounts.archivedAt))
        .all();
      if (activeAccounts.length === 1 && activeAccounts[0]) {
        const candidate = activeAccounts[0];
        const candidateConflict =
          parsed.account &&
          candidate.accountNumber &&
          candidate.accountNumber.trim().toLowerCase() !== parsed.account.trim().toLowerCase();
        const candidateCompat = checkPlatformCompatibility(candidate, parsed.format);
        if (!candidateConflict && candidateCompat.compatible) {
          resolvedAccountId = candidate.id;
        }
      }
    }

    const symbols = [...new Set(parsed.executions.map((e) => e.symbol))];
    return ok({
      detected: parsed.format,
      detectedAccount: parsed.account,
      sourceAccounts: parsed.sourceAccounts,
      timeZone,
      dateOrder,
      needsMapping: false,
      executions: parsed.executions.slice(0, 50),
      totals: {
        executions: parsed.executions.length,
        symbols: symbols.length,
        skippedRows: parsed.skippedRows,
        from: parsed.executions.reduce<string | null>(
          (min, e) => (min === null || e.executedAt < min ? e.executedAt : min),
          null,
        ),
        to: parsed.executions.reduce<string | null>(
          (max, e) => (max === null || e.executedAt > max ? e.executedAt : max),
          null,
        ),
      },
      warnings: parsed.warnings,
      errors: parsed.errors,
      needsSymbol: parsed.needsSymbol,
      accountConflict,
      compatibility,
      reconciliation:
        parsed.format === "ninjatrader" && resolvedAccountId
          ? previewNinjaTraderImport(resolvedAccountId, parsed, body.content, timeZone, body.review)
          : undefined,
      accountReconciliation:
        resolvedAccountId
          ? reconcileImport(resolvedAccountId, parsed.executions as ImportedExecution[])
          : undefined,
    });
  }


  if (!body.accountId) return bad("accountId is required to commit");
  if (parsed.errors?.length) return bad(parsed.errors.join(" "));
  if (parsed.executions.length === 0) return bad("No executions to import");

  const targetAccount = db.select().from(accounts).where(eq(accounts.id, body.accountId)).get();
  if (!targetAccount) return bad("Account not found");

  // Validate account number identity mismatch
  if (
    parsed.account &&
    targetAccount.accountNumber &&
    parsed.account.trim().toLowerCase() !== targetAccount.accountNumber.trim().toLowerCase() &&
    !body.forceMismatch
  ) {
    return bad(
      `Account mismatch: statement belongs to account #${parsed.account}, but selected account is ${targetAccount.name} (#${targetAccount.accountNumber}). Pass forceMismatch=true to override.`,
    );
  }

  // Validate platform / broker compatibility
  const compat = checkPlatformCompatibility(targetAccount, parsed.format);
  if (!compat.compatible && !body.forceMismatch) {
    return bad(
      `Incompatible statement format: ${compat.reason ?? "Format does not match target account."} Pass forceMismatch=true to override.`,
    );
  }

  const result =
    parsed.format === "ninjatrader"
      ? commitNinjaTraderImport(body.accountId, parsed, body.content, timeZone, body.review)
      : insertExecutions(body.accountId, parsed.executions as ImportedExecution[], "import");

  // Auto-binding: bind detected platform, broker, and account number to the target account only if compatible
  const detectedPlatform = formatToPlatformId(parsed.format);
  if (targetAccount && compat.compatible) {
    const updates: { platform?: string; broker?: string; accountNumber?: string } = {};
    if (detectedPlatform && !targetAccount.platform) {
      updates.platform = detectedPlatform;
    }
    if (detectedPlatform && !targetAccount.broker) {
      updates.broker = platformToDefaultBrokerId(detectedPlatform) ?? detectedPlatform;
    }
    if (parsed.account && !targetAccount.accountNumber) {
      updates.accountNumber = parsed.account;
    }
    if (Object.keys(updates).length > 0) {
      db.update(accounts).set(updates).where(eq(accounts.id, body.accountId)).run();
    }
  }

  // Register import source for provenance tracking
  try {
    const sourceName = body.fileName || parsed.format;
    const existingSource = db
      .select()
      .from(importSources)
      .where(
        and(eq(importSources.accountId, body.accountId), eq(importSources.format, parsed.format)),
      )
      .get();
    if (!existingSource) {
      db.insert(importSources)
        .values({
          id: newId(),
          accountId: body.accountId,
          format: parsed.format,
          name: sourceName,
          createdAt: nowIso(),
        })
        .run();
    }
  } catch {
    // Non-fatal if provenance recording is duplicate or fails
  }

  // Invalid rows are skipped with a warning rather than failing the whole file.
  const warnings = [
    ...(parsed.warnings ?? []),
    ...(result.skipped > 0
      ? [
          `${result.skipped} row(s) were skipped because they could not be journaled: ${result.skippedReasons.join(" ")}`,
        ]
      : []),
  ];
  return ok({ detected: parsed.format, ...result, warnings });
});

/** The import page lists what auto-detection understands. */
export const GET = handler(() => ok({ formats: FORMATS.map(({ id, label }) => ({ id, label })) }));
