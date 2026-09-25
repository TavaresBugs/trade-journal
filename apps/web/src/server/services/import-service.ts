import { and, eq } from "drizzle-orm";
import type { ImportedExecution, ParsedImport } from "@luxalgo/journal-importers";
import { db, accounts, importSources } from "@/db";
import { insertExecutions } from "@/server/executions";
import { commitNinjaTraderImport } from "@/server/ninjatrader-import";
import type { ImportReviewOptions } from "@/lib/import-review";
import { formatToPlatformId, platformToDefaultBrokerId } from "@/lib/brokers/broker-catalog";
import { newId, nowIso } from "@/server/ids";

export interface CommitImportOptions {
  accountId: string;
  parsed: ParsedImport;
  content: string;
  timeZone: string;
  fileName?: string;
  review?: ImportReviewOptions;
  targetAccount: typeof accounts.$inferSelect;
  compat: { compatible: boolean; reason?: string };
}

export interface CommitImportResult {
  detected: string;
  inserted: number;
  duplicates: number;
  skipped: number;
  skippedReasons: string[];
  warnings: string[];
  corrected?: number;
}

/**
 * Encapsulates the import commit into a single atomic transaction with { behavior: "immediate" }.
 * 1. Executes commitNinjaTraderImport or insertExecutions
 * 2. Executes auto-binding for platform, broker, and accountNumber if compatible
 * 3. Registers provenance in the import_sources table
 * 4. Returns the consolidated result with warnings, inserted, duplicates, skipped, etc.
 */
export function commitImportAtomically(options: CommitImportOptions): CommitImportResult {
  const { accountId, parsed, content, timeZone, fileName, review, targetAccount, compat } = options;

  return db.transaction(
    (tx) => {
      // 1. Run format-specific import commit
      const result =
        parsed.format === "ninjatrader"
          ? commitNinjaTraderImport(accountId, parsed, content, timeZone, review)
          : insertExecutions(accountId, parsed.executions as ImportedExecution[], "import");

      // 2. Auto-binding: bind detected platform, broker, and account number to the target account only if compatible
      const detectedPlatform = formatToPlatformId(parsed.format);
      if (compat.compatible) {
        const updates: { platform?: string; broker?: string; accountNumber?: string } = {};
        if (detectedPlatform && !targetAccount.platform) {
          updates.platform = detectedPlatform;
        }
        if (detectedPlatform && !targetAccount.broker) {
          updates.broker = platformToDefaultBrokerId(detectedPlatform) ?? detectedPlatform;
        }
        if (parsed.account && !targetAccount.accountNumber) {
          updates.accountNumber = parsed.account.trim();
        }
        if (Object.keys(updates).length > 0) {
          tx.update(accounts).set(updates).where(eq(accounts.id, accountId)).run();
        }
      }

      // 3. Register import source for provenance tracking
      try {
        const sourceName = fileName || parsed.format;
        const existingSource = tx
          .select()
          .from(importSources)
          .where(
            and(eq(importSources.accountId, accountId), eq(importSources.format, parsed.format)),
          )
          .get();
        if (!existingSource) {
          tx.insert(importSources)
            .values({
              id: newId(),
              accountId,
              format: parsed.format,
              name: sourceName,
              createdAt: nowIso(),
            })
            .run();
        }
      } catch {
        // Non-fatal if provenance recording is duplicate or fails
      }

      // 4. Invalid rows are skipped with a warning rather than failing the whole file.
      const warnings = [
        ...(parsed.warnings ?? []),
        ...("warnings" in result && Array.isArray(result.warnings) ? result.warnings : []),
      ];
      const uniqueWarnings = Array.from(new Set(warnings));
      const finalWarnings = [
        ...uniqueWarnings,
        ...(result.skipped > 0
          ? [
              `${result.skipped} row(s) were skipped because they could not be journaled: ${result.skippedReasons.join(" ")}`,
            ]
          : []),
      ];

      return {
        detected: parsed.format,
        ...result,
        warnings: finalWarnings,
      };
    },
    { behavior: "immediate" },
  );
}
