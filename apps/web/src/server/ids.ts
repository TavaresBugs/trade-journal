import { createHash, randomBytes } from "node:crypto";

export const newId = (): string => randomBytes(9).toString("base64url");

export const nowIso = (): string => new Date().toISOString();

export interface BrokerTicketIdentity {
  ticket: string;
  leg: string;
}

/**
 * Extract broker Ticket/Deal/Position ID and leg ("entry" | "exit") from import metadata if present.
 * Supports MetaTrader history arrays, Deal tickets, and prefixed broker identifiers.
 */
export const extractBrokerTicket = (
  importMetadata?: { id?: string; group?: string },
): BrokerTicketIdentity | null => {
  if (!importMetadata) return null;

  let ticket: string | null = null;
  let leg = typeof importMetadata.id === "string" ? importMetadata.id.trim() : "";

  // 1. Check if group carries a broker ticket (e.g. JSON array like MetaTrader ["history-metatrader", "78698762", ...])
  if (importMetadata.group && typeof importMetadata.group === "string") {
    const trimmedGroup = importMetadata.group.trim();
    if (trimmedGroup.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmedGroup);
        if (Array.isArray(parsed) && parsed[1] != null && String(parsed[1]).trim() !== "") {
          ticket = String(parsed[1]).trim();
        }
      } catch {}
    } else {
      const match = trimmedGroup.match(
        /^(?:.*:)?(?:trade|pos|position|ticket):([A-Za-z0-9_-]+)$/i,
      );
      if (match && match[1]) {
        ticket = match[1].trim();
      }
    }
  }

  // 2. Check if id carries a broker ticket
  if (!ticket && leg && leg !== "entry" && leg !== "exit") {
    const parts = leg.split(":");
    if (
      parts.length >= 3 &&
      (parts[parts.length - 1] === "entry" || parts[parts.length - 1] === "exit")
    ) {
      ticket = parts[parts.length - 2]!.trim();
      leg = parts[parts.length - 1]!.trim();
    } else if (/^\d+$/.test(leg)) {
      ticket = leg;
    }
  }

  // Normalize leg if it has :entry or :exit suffix
  if (leg.endsWith(":entry")) {
    leg = "entry";
  } else if (leg.endsWith(":exit")) {
    leg = "exit";
  }

  if (ticket) {
    return { ticket, leg };
  }

  return null;
};

/** Content hash for execution dedup: identical fills insert once per account. */
export const executionHash = (execution: {
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  executedAt: string;
  importMetadata?: { id: string; group?: string };
  accountId?: string;
  account?: string;
}): string => {
  const ticketInfo = extractBrokerTicket(execution.importMetadata);
  if (ticketInfo) {
    const account = execution.accountId ?? execution.account ?? "";
    return createHash("sha256")
      .update(
        [
          "ticket",
          account,
          execution.symbol.trim().toUpperCase(),
          ticketInfo.ticket,
          ticketInfo.leg,
        ].join("|"),
      )
      .digest("hex")
      .slice(0, 32);
  }

  return createHash("sha256")
    .update(
      [
        execution.symbol,
        execution.side,
        execution.quantity.toPrecision(12),
        execution.price.toPrecision(12),
        execution.executedAt,
        ...(execution.importMetadata
          ? ["history", execution.importMetadata.group ?? "", execution.importMetadata.id]
          : []),
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 32);
};
