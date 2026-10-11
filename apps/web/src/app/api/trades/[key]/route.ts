import { tradeRisk, tradeR, plannedR } from "@luxalgo/journal-core";
import { eq, inArray } from "drizzle-orm";
import { db, trades, playbooks, accounts, journalDays } from "@/db";
import { bad, handler, ok, requireValue } from "@/server/api";
import { listExecutions } from "@/server/executions";
import { deleteTradeWithCleanup } from "@/server/trades";
import { nowIso } from "@/server/ids";
import { getTradeByKey, rowToTrade } from "@/server/trades-query";
import { getTimeZone } from "@/server/settings";
import { normalizeSymbol } from "@/lib/assets/symbol-utils";

type Params = { params: Promise<{ key: string }> };

export const GET = handler(async (_request: Request, { params }: Params) => {
  const { key } = await params;
  const row = getTradeByKey(key);
  if (!row) return bad("Trade not found", 404);
  const trade = rowToTrade(row);
  const fills = listExecutions(row.accountId, trade.executionIds);
  return ok({
    timeZone: getTimeZone(),
    trade: {
      ...row,
      status: trade.status,
      riskAmount: tradeRisk(trade),
      realizedR: tradeR(trade),
      plannedR: plannedR(trade),
      contractMultiplier: trade.contractMultiplier ?? null,
      currency:
        db
          .select({ currency: accounts.currency })
          .from(accounts)
          .where(eq(accounts.id, row.accountId))
          .get()?.currency ?? "USD",
    },
    executions: fills,
  });
});

interface AnnotateBody {
  notes?: string | null;
  tags?: string[];
  mistakes?: string[];
  playbookId?: string | null;
  rating?: number | null;
  stopLoss?: number | null;
  profitTarget?: number | null;
  reviewed?: boolean;
  drawingsJson?: string | null;
  linkedJournalDate?: string | null;
  sourceTradeKey?: string | null;
  linkSiblingKeys?: string[];
}

export const PATCH = handler(async (request: Request, { params }: Params) => {
  const { key } = await params;
  const decoded = key;
  const row = getTradeByKey(decoded);
  if (!row) return bad("Trade not found", 404);

  const body = (await request.json()) as AnnotateBody;
  for (const field of ["stopLoss", "profitTarget", "rating"] as const)
    requireValue(
      body[field] == null || (typeof body[field] === "number" && Number.isFinite(body[field])),
      `Invalid ${field}.`,
    );
  requireValue(
    body.rating == null || (Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5),
    "Rating must be 1–5.",
  );
  requireValue(
    body.notes == null || (typeof body.notes === "string" && body.notes.length <= 100000),
    "Notes must be at most 100,000 characters.",
  );
  requireValue(
    body.drawingsJson == null ||
      (typeof body.drawingsJson === "string" && body.drawingsJson.length <= 500000),
    "Drawings payload must be at most 500,000 characters.",
  );
  for (const field of ["tags", "mistakes"] as const)
    requireValue(
      body[field] === undefined ||
        (Array.isArray(body[field]) &&
          body[field]!.length <= 100 &&
          body[field]!.every((s) => typeof s === "string" && s.length <= 200)),
      `Invalid ${field}.`,
    );
  requireValue(
    !body.playbookId || db.select().from(playbooks).where(eq(playbooks.id, body.playbookId)).get(),
    "Playbook not found.",
  );
  const patch: Partial<typeof trades.$inferInsert> = {};
  const effectiveJournalDate =
    body.linkedJournalDate !== undefined ? body.linkedJournalDate : row.linkedJournalDate;

  // Bidirectional promotion & sharing when linking to a session journal or pulling from a sibling trade
  if (body.linkedJournalDate) {
    const existingDay = db
      .select()
      .from(journalDays)
      .where(eq(journalDays.date, body.linkedJournalDate))
      .get();
    const sourceTrade = body.sourceTradeKey ? getTradeByKey(body.sourceTradeKey) : null;

    const candidateNote =
      body.notes !== undefined
        ? (body.notes ?? "")
        : sourceTrade?.notes?.trim()
          ? sourceTrade.notes
          : existingDay?.note?.trim()
            ? existingDay.note
            : (row.notes ?? "");

    const candidateSymbol =
      existingDay?.symbol ??
      normalizeSymbol(sourceTrade?.symbol ?? row.symbol) ??
      null;

    db.insert(journalDays)
      .values({
        date: body.linkedJournalDate,
        note: candidateNote,
        symbol: candidateSymbol,
        updatedAt: nowIso(),
      })
      .onConflictDoUpdate({
        target: journalDays.date,
        set: {
          note: candidateNote,
          symbol: candidateSymbol,
          updatedAt: nowIso(),
        },
      })
      .run();

    patch.notes = candidateNote;

    // Link source trade and any requested sibling trades of the same seara
    const siblingKeysToLink = Array.from(
      new Set([
        ...(body.sourceTradeKey ? [body.sourceTradeKey] : []),
        ...(Array.isArray(body.linkSiblingKeys) ? body.linkSiblingKeys : []),
      ]),
    ).filter((k) => k && k !== decoded);

    if (siblingKeysToLink.length > 0) {
      db.update(trades)
        .set({ linkedJournalDate: body.linkedJournalDate, notes: candidateNote })
        .where(inArray(trades.key, siblingKeysToLink))
        .run();
    }

    // Keep all already-linked trades on this journal date in sync
    db.update(trades)
      .set({ notes: candidateNote })
      .where(eq(trades.linkedJournalDate, body.linkedJournalDate))
      .run();
  } else if (body.notes !== undefined) {
    patch.notes = body.notes;
    // When trade is already linked to a session journal, sync note with the session journal and all sibling trades
    if (effectiveJournalDate) {
      const noteStr = body.notes ?? "";
      db.insert(journalDays)
        .values({ date: effectiveJournalDate, note: noteStr, updatedAt: nowIso() })
        .onConflictDoUpdate({
          target: journalDays.date,
          set: { note: noteStr, updatedAt: nowIso() },
        })
        .run();
      db.update(trades)
        .set({ notes: body.notes })
        .where(eq(trades.linkedJournalDate, effectiveJournalDate))
        .run();
    }
  }

  if (body.tags !== undefined) patch.tagsJson = JSON.stringify(body.tags);
  if (body.mistakes !== undefined) patch.mistakesJson = JSON.stringify(body.mistakes);
  if (body.playbookId !== undefined) patch.playbookId = body.playbookId;
  if (body.rating !== undefined) patch.rating = body.rating;
  if (body.stopLoss !== undefined) patch.stopLoss = body.stopLoss;
  if (body.profitTarget !== undefined) patch.profitTarget = body.profitTarget;
  if (body.reviewed !== undefined) patch.reviewedAt = body.reviewed ? nowIso() : null;
  if (body.drawingsJson !== undefined) patch.drawingsJson = body.drawingsJson;
  if (body.linkedJournalDate !== undefined) patch.linkedJournalDate = body.linkedJournalDate;

  if (!Object.keys(patch).length) return ok({ updated: true });
  db.update(trades).set(patch).where(eq(trades.key, decoded)).run();
  return ok({ updated: true });
});

export const DELETE = handler(async (request: Request, { params }: Params) => {
  const { key } = await params;
  const url = new URL(request.url);
  let purgeAttachments = url.searchParams.get("purgeAttachments") === "true";

  if (!purgeAttachments && request.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = await request.clone().json();
      if (body && typeof body.purgeAttachments === "boolean") {
        purgeAttachments = body.purgeAttachments;
      }
    } catch {}
  }

  const result = deleteTradeWithCleanup(key, { purgeAttachments });
  return ok({ deleted: true, ...result });
});
