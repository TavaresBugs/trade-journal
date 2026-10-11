import {
  FORMATS,
  parseAuto,
  parseWithMapping,
  readHeaders,
  type GenericMapping,
  type ImportedExecution,
} from "@luxalgo/journal-importers";
import { bad, handler, ok, requireValue } from "@/server/api";
import { getImportTimeZone } from "@/server/settings";
import { isTimeZone } from "@/lib/timezone";
import type { ImportReviewOptions } from "@/lib/import-review";
import { previewNinjaTraderImport } from "@/server/ninjatrader-import";
import { reconcileImport } from "@/server/import-reconciliation";
import { inferImportTimeZoneFromCandles } from "@/server/import-timezone-inference";
import { db } from "@/db";

import { accounts } from "@/db/schema";
import { and, eq, isNull, or } from "drizzle-orm";
import { getBrokerMetadata, checkPlatformCompatibility } from "@/lib/brokers/broker-catalog";
import { commitImportAtomically } from "@/server/services/import-service";
import { executionHash } from "@/server/ids";

export interface ImportFilePayload {
  name: string;
  content: string;
}

interface ImportBody {
  mode: "preview" | "commit";
  content?: string;
  files?: ImportFilePayload[];
  accountId?: string;
  /** Column mapping when auto-detection found nothing. */
  mapping?: GenericMapping;
  timeZone?: string;
  lockTimeZone?: boolean;
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
  const hasFiles = Array.isArray(body.files) && body.files.length > 0;
  if (!hasFiles && (typeof body.content !== "string" || !body.content)) {
    return bad("content or files is required");
  }
  if (!["preview", "commit"].includes(body.mode)) return bad("mode must be preview or commit");
  if (body.symbol !== undefined && (typeof body.symbol !== "string" || body.symbol.length > 100))
    return bad("Invalid symbol");
  if (body.fileName !== undefined && typeof body.fileName !== "string")
    return bad("Invalid filename");
  if (body.dateOrder !== undefined && !["DMY", "MDY"].includes(body.dateOrder))
    return bad("Invalid dateOrder (must be 'DMY' or 'MDY')");

  const filesList: ImportFilePayload[] = hasFiles
    ? body.files!
    : [{ name: body.fileName || "statement.csv", content: body.content! }];

  const account = body.accountId
    ? db.select().from(accounts).where(eq(accounts.id, body.accountId)).get()
    : undefined;
  const brokerMeta = account?.broker ? getBrokerMetadata(account.broker) : undefined;

  if (body.timeZone !== undefined)
    requireValue(isTimeZone(body.timeZone), "Enter a valid IANA statement timezone.");

  let timeZone = body.timeZone ?? getImportTimeZone();

  const dateOrder =
    body.dateOrder ??
    (brokerMeta?.dateFormat === "DMY"
      ? "DMY"
      : brokerMeta?.dateFormat === "MDY"
        ? "MDY"
        : undefined);

  const importOptions = {
    timeZone,
    fileName: body.fileName || (hasFiles ? filesList[0]?.name : undefined),
    symbol: body.symbol,
    dateOrder,
  };

  let batchSummary: import("@/types/import").BatchSummary | undefined = undefined;
  let parsed: import("@luxalgo/journal-importers").ParsedImport | null = null;

  if (hasFiles && filesList.length > 1) {
    const parseBatchWithTz = (targetTz: string) => {
      const parsedFiles: {
        file: ImportFilePayload;
        parsed: import("@luxalgo/journal-importers").ParsedImport;
      }[] = [];
      const unparsedFiles: string[] = [];

      for (const f of filesList) {
        const fOptions = { ...importOptions, timeZone: targetTz, fileName: f.name };
        const p = body.mapping
          ? parseWithMapping(f.content, body.mapping, fOptions)
          : parseAuto(f.content, fOptions);

        if (p) {
          parsedFiles.push({ file: f, parsed: p });
        } else {
          unparsedFiles.push(f.name);
        }
      }

      if (parsedFiles.length === 0) {
        return { parsedFiles, unparsedFiles, parsed: null, batchSummary: undefined };
      }

      // Deduplicate executions across files
      const combinedExecutions: ImportedExecution[] = [];
      const seenSignatures = new Set<string>();
      let duplicatesSkipped = 0;
      let totalSkippedRows = 0;
      const allWarnings: string[] = [];
      const allErrors: string[] = [];
      const detectedAccounts = new Set<string>();
      const sourceAccounts = new Set<string>();
      const fileStats: import("@/types/import").BatchFileSummary[] = [];

      for (const pf of parsedFiles) {
        if (pf.parsed.account) detectedAccounts.add(pf.parsed.account);
        if (pf.parsed.sourceAccounts) {
          for (const sa of pf.parsed.sourceAccounts) sourceAccounts.add(sa);
        }
        totalSkippedRows += pf.parsed.skippedRows ?? 0;
        if (pf.parsed.warnings) allWarnings.push(...pf.parsed.warnings);
        if (pf.parsed.errors) allErrors.push(...pf.parsed.errors);

        let fileUnique = 0;
        let fileDup = 0;
        for (const exec of pf.parsed.executions) {
          const sig = executionHash(exec);
          if (seenSignatures.has(sig)) {
            duplicatesSkipped++;
            fileDup++;
          } else {
            seenSignatures.add(sig);
            combinedExecutions.push(exec);
            fileUnique++;
          }
        }
        fileStats.push({
          fileName: pf.file.name,
          format: pf.parsed.format,
          count: pf.parsed.executions.length,
          uniqueAdded: fileUnique,
          duplicateCount: fileDup,
          account: pf.parsed.account,
        });
      }

      // Sort chronologically by execution time
      combinedExecutions.sort(
        (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
      );

      if (unparsedFiles.length > 0) {
        allWarnings.push(
          `${unparsedFiles.length} file(s) could not be parsed: ${unparsedFiles.join(", ")}`,
        );
      }

      const batchParsed: import("@luxalgo/journal-importers").ParsedImport = {
        format: parsedFiles[0]?.parsed.format ?? "unknown",
        executions: combinedExecutions,
        skippedRows: totalSkippedRows,
        warnings: Array.from(new Set(allWarnings)),
        errors: allErrors.length > 0 ? Array.from(new Set(allErrors)) : undefined,
        account: detectedAccounts.size > 0 ? Array.from(detectedAccounts)[0] : undefined,
        sourceAccounts: sourceAccounts.size > 0 ? Array.from(sourceAccounts) : undefined,
      };

      const totalParsed = parsedFiles.reduce((acc, pf) => acc + pf.parsed.executions.length, 0);
      const summary: import("@/types/import").BatchSummary = {
        totalFiles: filesList.length,
        totalParsed,
        uniqueExecutions: combinedExecutions.length,
        duplicateExecutions: duplicatesSkipped,
        duplicatesSkipped,
        files: fileStats,
      };

      return { parsedFiles, unparsedFiles, parsed: batchParsed, batchSummary: summary };
    };

    const initialBatch = parseBatchWithTz(timeZone);
    if (initialBatch.parsedFiles.length === 0 || !initialBatch.parsed) {
      const firstContent = filesList[0]?.content ?? "";
      return ok({
        detected: null,
        timeZone,
        dateOrder,
        headers: readHeaders(firstContent),
        needsMapping: true,
      });
    }

    parsed = initialBatch.parsed;
    batchSummary = initialBatch.batchSummary;

    if (!body.lockTimeZone) {
      const calibration = inferImportTimeZoneFromCandles({
        executions: parsed.executions,
        initialTimeZone: timeZone,
        accountTimeZone: account?.timeZone,
        reparseExecutions: (probeTz) => parseBatchWithTz(probeTz).parsed?.executions,
        rawContent: initialBatch.parsedFiles.map((pf) => pf.file.content),
      });

      if (calibration.autoCalibrated && calibration.timeZone !== timeZone) {
        const originalTimeZone = timeZone;
        timeZone = calibration.timeZone;
        const recalibratedBatch = parseBatchWithTz(timeZone);
        if (recalibratedBatch.parsed) {
          parsed = recalibratedBatch.parsed;
          batchSummary = recalibratedBatch.batchSummary;
          const calibrationWarning = `Auto-calibrated statement timezone to ${calibration.timeZone} based on market candle price alignment (${Math.round(calibration.bestHitRate * 100)}% match vs ${Math.round(calibration.initialHitRate * 100)}% in ${originalTimeZone}).`;
          parsed.warnings = Array.from(new Set([...(parsed.warnings ?? []), calibrationWarning]));
        }
      }
    }
  } else {
    const singleContent = filesList[0]?.content ?? "";
    const parseSingleWithTz = (targetTz: string) => {
      const opts = { ...importOptions, timeZone: targetTz };
      return body.mapping
        ? parseWithMapping(singleContent, body.mapping, opts)
        : parseAuto(singleContent, opts);
    };

    parsed = parseSingleWithTz(timeZone);

    if (!parsed) {
      return ok({
        detected: null,
        timeZone,
        dateOrder,
        headers: readHeaders(singleContent),
        needsMapping: true,
      });
    }

    if (!body.lockTimeZone) {
      const calibration = inferImportTimeZoneFromCandles({
        executions: parsed.executions,
        initialTimeZone: timeZone,
        accountTimeZone: account?.timeZone,
        reparseExecutions: (probeTz) => parseSingleWithTz(probeTz)?.executions,
        rawContent: singleContent,
      });

      if (calibration.autoCalibrated && calibration.timeZone !== timeZone) {
        const originalTimeZone = timeZone;
        timeZone = calibration.timeZone;
        const reparsed = parseSingleWithTz(timeZone);
        if (reparsed) {
          parsed = reparsed;
          const calibrationWarning = `Auto-calibrated statement timezone to ${calibration.timeZone} based on market candle price alignment (${Math.round(calibration.bestHitRate * 100)}% match vs ${Math.round(calibration.initialHitRate * 100)}% in ${originalTimeZone}).`;
          parsed.warnings = Array.from(new Set([...(parsed.warnings ?? []), calibrationWarning]));
        }
      }
    }
  }

  if (body.mode === "preview") {
    const targetAccount = body.accountId
      ? db.select().from(accounts).where(eq(accounts.id, body.accountId)).get()
      : undefined;

    let accountConflict:
      | {
          isConflict: boolean;
          detectedAccount?: string;
          targetAccountNumber?: string;
          targetAccountName?: string;
        }
      | undefined;
    if (targetAccount && parsed.account && targetAccount.accountNumber) {
      if (
        targetAccount.accountNumber.trim().toLowerCase() !== parsed.account.trim().toLowerCase()
      ) {
        accountConflict = {
          isConflict: true,
          detectedAccount: parsed.account,
          targetAccountNumber: targetAccount.accountNumber,
          targetAccountName: targetAccount.name,
        };
      }
    }

    const compatibility = targetAccount
      ? checkPlatformCompatibility(targetAccount, parsed.format)
      : undefined;

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
            or(eq(accounts.accountNumber, parsed.account), eq(accounts.name, parsed.account)),
          ),
        )
        .get();
      if (matched) {
        resolvedAccountId = matched.id;
      }
    }
    if (!resolvedAccountId) {
      const activeAccounts = db.select().from(accounts).where(isNull(accounts.archivedAt)).all();
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
          ? previewNinjaTraderImport(
              resolvedAccountId,
              parsed,
              body.content || filesList.map((f) => f.content).join("\n"),
              timeZone,
              body.review,
            )
          : undefined,
      accountReconciliation: resolvedAccountId
        ? reconcileImport(resolvedAccountId, parsed.executions as ImportedExecution[])
        : undefined,
      batchSummary,
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

  const effectiveContent = body.content || filesList.map((f) => f.content).join("\n");
  const effectiveFileName =
    body.fileName ||
    (hasFiles && filesList.length > 1
      ? `${filesList.length} files (${filesList.map((f) => f.name).join(", ")})`
      : filesList[0]?.name);

  const result = commitImportAtomically({
    accountId: body.accountId,
    parsed,
    content: effectiveContent,
    timeZone,
    fileName: effectiveFileName,
    review: body.review,
    targetAccount,
    compat,
  });

  return ok({
    ...result,
    batchSummary,
  });
});

/** The import page lists what auto-detection understands. */
export const GET = handler(() => ok({ formats: FORMATS.map(({ id, label }) => ({ id, label })) }));
