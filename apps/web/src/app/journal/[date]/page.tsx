"use client";

import { Suspense, use } from "react";
import { JournalView } from "@/components/journal-view";
import { tradeKeyFromSegment } from "@/lib/trade-links";

export default function JournalDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams?: Promise<{ trade?: string; t?: string }>;
}) {
  const { date } = use(params);
  const sp = searchParams ? use(searchParams) : undefined;
  const rawParam = sp?.t ?? sp?.trade ?? null;
  const tradeKey = rawParam ? tradeKeyFromSegment(rawParam) : null;

  return (
    <Suspense>
      <JournalView key={`${date}-${tradeKey ?? "day"}`} date={date} tradeKey={tradeKey} />
    </Suspense>
  );
}
