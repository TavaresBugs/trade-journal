"use client";

import type { Dimension } from "@luxalgo/journal-core";
import { normalizeSymbol } from "@/lib/assets/symbol-utils";
import { AssetIcon } from "@/components/ui/asset-icon";
import { Badge } from "@/components/ui/badge";
import { MonetaryValue } from "@/components/privacy";

export function GroupLabel({ dimension, children }: { dimension: Dimension; children: string }) {
  if (dimension === "symbol") {
    const canonical = normalizeSymbol(children);
    return (
      <span
        className="inline-flex items-center gap-2 font-medium"
        title={children !== canonical ? `Contract: ${children}` : undefined}
      >
        <AssetIcon symbol={children} size="xs" />
        <span className="font-semibold text-foreground">{canonical || children}</span>
      </span>
    );
  }
  if (dimension === "direction") {
    return (
      <Badge variant="outline" className="text-xs font-normal">
        {children}
      </Badge>
    );
  }
  return dimension === "entryPrice" || dimension === "exitPrice" ? (
    <MonetaryValue>{children}</MonetaryValue>
  ) : (
    children
  );
}
