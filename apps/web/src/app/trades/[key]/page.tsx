"use client";

import { Suspense, use } from "react";
import { JournalView } from "@/components/journal-view";
import { tradeKeyFromSegment } from "@/lib/trade-links";

export default function TradePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const tradeKey = tradeKeyFromSegment(key);
  return (
    <Suspense>
      <JournalView key={tradeKey} tradeKey={tradeKey} />
    </Suspense>
  );
}
