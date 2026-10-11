import { eq, inArray } from "drizzle-orm";
import { db, trades } from "@/db";
import { bad, handler, ok } from "@/server/api";
import { deleteTradesWithCleanup } from "@/server/trades";
import { nowIso } from "@/server/ids";

interface BulkBody {
  keys: string[];
  action: "review" | "unreview" | "tag" | "untag" | "playbook" | "delete";
  tag?: string;
  playbookId?: string | null;
  purgeAttachments?: boolean;
}

export const POST = handler(async (request: Request) => {
  const body = (await request.json()) as BulkBody;
  if (!Array.isArray(body.keys) || body.keys.length === 0) return bad("keys are required");
  if (body.action === "delete") {
    const purgeAttachments = Boolean(body.purgeAttachments);
    const result = deleteTradesWithCleanup(body.keys, { purgeAttachments });
    return ok({ deleted: result.deletedTradeCount, ...result });
  }

  const rows = db.select().from(trades).where(inArray(trades.key, body.keys)).all();

  switch (body.action) {
    case "review":
    case "unreview":
      db.update(trades)
        .set({ reviewedAt: body.action === "review" ? nowIso() : null })
        .where(inArray(trades.key, body.keys))
        .run();
      return ok({ updated: rows.length });
    case "tag":
    case "untag": {
      if (!body.tag) return bad("tag is required");
      db.transaction((tx) => {
        for (const row of rows) {
          const tags = new Set<string>(row.tagsJson ? (JSON.parse(row.tagsJson) as string[]) : []);
          if (body.action === "tag") tags.add(body.tag!);
          else tags.delete(body.tag!);
          tx.update(trades)
            .set({ tagsJson: JSON.stringify([...tags]) })
            .where(eq(trades.key, row.key))
            .run();
        }
      });
      return ok({ updated: rows.length });
    }
    case "playbook":
      db.update(trades)
        .set({ playbookId: body.playbookId ?? null })
        .where(inArray(trades.key, body.keys))
        .run();
      return ok({ updated: rows.length });
    default:
      return bad("Unknown action");
  }
});
