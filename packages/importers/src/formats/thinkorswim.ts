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
  detect: (_headers, content) =>
    /Account Trade History/i.test(content) ||
    (/(exec time|exectime)/i.test(content) && /(pos effect|poseffect|order type)/i.test(content)),
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
    let start = lines.findIndex((line) => /Account Trade History/i.test(line));
    let loopStartIndex = 0;

    if (start !== -1) {
      loopStartIndex = start + 1;
    } else {
      const headerIdx = lines.findIndex(
        (line) => /exec time/i.test(line) && /spread|pos effect|order type|symbol/i.test(line),
      );
      if (headerIdx !== -1) {
        loopStartIndex = headerIdx;
      } else {
        return {
          format: "thinkorswim",
          executions: [],
          skippedRows: 0,
          warnings: ["No 'Account Trade History' section found."],
          account,
          sourceAccounts: account ? [account] : [],
        };
      }
    }

    const section: string[] = [];
    let headerSeen = false;
    for (let i = loopStartIndex; i < lines.length; i++) {
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
      const cells = line.split(",").map((c) => c.trim());
      const firstNonEmpty = cells.find((c) => c.length > 0) ?? "";
      if (
        line.trim() === "" ||
        /^([A-Za-z ]+History|Profits and Losses|Account Summary|Options|Futures( Statements)?|Equities|Forex)$/i.test(
          firstNonEmpty,
        )
      )
        break;
      section.push(line);
    }

    const parsedRows = parseCsv(section.join("\n"));
    if (parsedRows.length === 0) {
      return {
        format: "thinkorswim",
        executions: [],
        skippedRows: 0,
        warnings: ["No 'Account Trade History' section found."],
        account,
        sourceAccounts: account ? [account] : [],
      };
    }

    const header = parsedRows[0] ?? [];
    const headerHasEmptyFirst = (header[0] ?? "").trim() === "" && header.length > 1;
    const normalizedHeader = headerHasEmptyFirst ? header.slice(1) : header;

    const normalizedRows: string[][] = [normalizedHeader];
    for (let r = 1; r < parsedRows.length; r++) {
      const row = parsedRows[r]!;
      if (row.length === 0 || (row.length === 1 && row[0]?.trim() === "")) continue;
      if ((row[0] ?? "").trim() === "" && row.length > 1) {
        normalizedRows.push(row.slice(1));
      } else {
        normalizedRows.push(row);
      }
    }

    const records = toRecords(normalizedRows);

    // Support signed quantities (+1000, -2000) when Side is absent or empty
    for (const row of records) {
      if (!row.side || row.side.trim() === "") {
        const rawQty = (row.qty ?? row.quantity ?? "").trim();
        if (rawQty.startsWith("+")) {
          row.side = "BUY";
        } else if (rawQty.startsWith("-")) {
          row.side = "SELL";
        }
      }
    }

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
