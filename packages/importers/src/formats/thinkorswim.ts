import { parseCsv, toRecords } from "../csv";
import { rowsToFills } from "./fills";
import type { ImportFormat, ParsedImport } from "../types";

/**
 * ThinkorSwim (Charles Schwab) account statement. The file is a multi-section
 * report; only the "Account Trade History" section carries fills. We scan for
 * that section's header row and parse until the next blank/section boundary.
 * Account number is extracted from the header preamble (e.g. "Account Statement for 92140825SCHW").
 */
export const thinkorswim: ImportFormat = {
  id: "thinkorswim",
  label: "ThinkorSwim / Charles Schwab (account statement)",
  detect: (_headers, content) => /Account Trade History/i.test(content),
  parse: (content, options): ParsedImport => {
    // Extract Account ID if present in header
    let account: string | undefined;
    const accMatch =
      content.match(/Account Statement for\s+([A-Za-z0-9_-]+)/i) ||
      content.match(/Account:\s*([A-Za-z0-9_-]+)/i);
    if (accMatch) {
      account = accMatch[1]?.trim();
    }

    const lines = content.split(/\r?\n/);
    const start = lines.findIndex((line) => /Account Trade History/i.test(line));
    if (start === -1) {
      return {
        format: "thinkorswim",
        executions: [],
        skippedRows: 0,
        warnings: ["No 'Account Trade History' section found."],
        account,
        sourceAccounts: account ? [account] : [],
      };
    }

    const section: string[] = [];
    let headerSeen = false;
    for (let i = start + 1; i < lines.length; i++) {
      const line = lines[i]!;
      if (!headerSeen) {
        if (/exec time/i.test(line)) {
          headerSeen = true;
          section.push(line);
        }
        continue;
      }
      // Sections are separated by blank lines or a new section title row (real
      // statements follow trade history with Options / Futures / Equities /
      // Profits and Losses — cross-checked against TradeNote's parser).
      const firstCell = (line.split(",")[0] ?? "").trim();
      if (
        line.trim() === "" ||
        /^([A-Za-z ]+History|Profits and Losses|Account Summary|Options|Futures( Statements)?|Equities|Forex)$/i.test(
          firstCell,
        )
      )
        break;
      section.push(line);
    }

    const records = toRecords(parseCsv(section.join("\n")));
    const { executions, skippedRows } = rowsToFills(
      records,
      {
        symbol: ["symbol"],
        side: ["side"],
        quantity: ["qty", "quantity"],
        price: ["price"],
        timestamp: ["exectime", "exec time"],
      },
      options,
    );

    // Attach deterministic IDs and asset class
    for (const [index, exec] of executions.entries()) {
      const row = records[index];
      const spread = (row?.spread ?? "").trim().toUpperCase();
      if (spread === "STOCK") exec.assetClass = "equity";
      else if (spread === "OPTION") exec.assetClass = "option";
      else if (spread === "FUTURES") exec.assetClass = "futures";

      const acctPrefix = account ? `${account}:` : "";
      exec.importMetadata = {
        id: `thinkorswim:${acctPrefix}${exec.executedAt}:${exec.symbol}:${index}`,
        order: index,
      };
    }

    const warnings =
      executions.length > 0
        ? [
            "ThinkorSwim statements report commissions in a separate section; fees were not attached to fills.",
          ]
        : [];

    return {
      format: "thinkorswim",
      executions,
      skippedRows,
      warnings,
      account,
      sourceAccounts: account ? [account] : [],
    };
  },
};
