import { and, eq, like, sql } from "drizzle-orm";
import { attachments, db, journalDays } from "@/db";

/**
 * Returns an array of YYYY-MM-DD dates in the given month that have a written note or day attachments.
 */
export const getJournaledDatesForMonth = (year: number, month: number): string[] => {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const noteRows = db
    .select({ date: journalDays.date })
    .from(journalDays)
    .where(
      and(like(journalDays.date, `${monthPrefix}-%`), sql`length(trim(${journalDays.note})) > 0`),
    )
    .all();

  const attachmentRows = db
    .select({ ownerId: attachments.ownerId })
    .from(attachments)
    .where(and(eq(attachments.ownerType, "day"), like(attachments.ownerId, `${monthPrefix}-%`)))
    .all();

  return [
    ...new Set([...noteRows.map((r) => r.date), ...attachmentRows.map((r) => r.ownerId)]),
  ].sort();
};
