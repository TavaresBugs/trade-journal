import * as fflate from "fflate";

function decodeXmlBuffer(buf?: Uint8Array): string {
  if (!buf || buf.length === 0) return "";
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf);
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder("utf-16be").decode(buf);
  return new TextDecoder("utf-8").decode(buf);
}

function colIndex(colStr: string): number {
  let idx = 0;
  for (let i = 0; i < colStr.length; i++) {
    idx = idx * 26 + (colStr.charCodeAt(i) - 64);
  }
  return idx - 1;
}

export function parseXlsxToCsv(bytes: Uint8Array): string | null {
  try {
    const unzipped = fflate.unzipSync(bytes);
    const sharedStrBuf = unzipped["xl/sharedStrings.xml"];
    const sheetKey =
      Object.keys(unzipped).find((k) => k.startsWith("xl/worksheets/sheet") && k.endsWith(".xml")) ??
      "xl/worksheets/sheet1.xml";
    const sheetBuf = unzipped[sheetKey];
    if (!sheetBuf) return null;

    const sharedStringsXml = decodeXmlBuffer(sharedStrBuf);
    const sheetXml = decodeXmlBuffer(sheetBuf);

    const strings: string[] = [];
    if (sharedStringsXml) {
      const sstMatches = sharedStringsXml.matchAll(/<si>([\s\S]*?)<\/si>/g);
      for (const m of sstMatches) {
        const textParts: string[] = [];
        const tMatches = m[1]!.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g);
        for (const tm of tMatches) {
          textParts.push(
            tm[1]!
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'"),
          );
        }
        strings.push(textParts.join(""));
      }
    }

    const csvLines: string[] = [];
    const rowMatches = sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g);
    for (const rm of rowMatches) {
      const rowContent = rm[1]!;
      const cellMatches = rowContent.matchAll(
        /<c\s+([^>]*?)>(?:<v>([\s\S]*?)<\/v>|<is><t[^>]*>([\s\S]*?)<\/t><\/is>)?<\/c>/g,
      );
      let maxCol = -1;
      const colMap: Record<number, string> = {};
      for (const cm of cellMatches) {
        const attrs = cm[1]!;
        const val = cm[2];
        const inlineText = cm[3];
        const rMatch = attrs.match(/r="([A-Z]+)\d+"/);
        if (!rMatch) continue;
        const colLetters = rMatch[1]!;
        const tMatch = attrs.match(/t="([^"]*)"/);
        const type = tMatch ? tMatch[1] : undefined;
        const cIdx = colIndex(colLetters);
        let cellVal = "";
        if (type === "s" && val !== undefined) {
          cellVal = strings[parseInt(val, 10)] ?? "";
        } else if (type === "inlineStr" && inlineText !== undefined) {
          cellVal = inlineText
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
        } else if (val !== undefined) {
          cellVal = val;
        }
        colMap[cIdx] = cellVal;
        if (cIdx > maxCol) maxCol = cIdx;
      }
      if (maxCol >= 0) {
        const rowCells: string[] = [];
        for (let c = 0; c <= maxCol; c++) {
          rowCells.push(colMap[c] ?? "");
        }
        csvLines.push(
          rowCells
            .map((v) => {
              const s = String(v);
              if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
                return '"' + s.replace(/"/g, '""') + '"';
              }
              return s;
            })
            .join(","),
        );
      }
    }
    return csvLines.length > 0 ? csvLines.join("\n") : null;
  } catch {
    return null;
  }
}

/** Decode uploads before parsing: handles XLSX (PK zip), UTF-16, and UTF-8 formats. */
export function decodeImportFile(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // PK zip signature: detect and convert XLSX spreadsheets to CSV
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    const xlsxCsv = parseXlsxToCsv(bytes);
    if (xlsxCsv) return xlsxCsv;
  }

  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  const end = Math.min(bytes.length, 1024);
  let evenNuls = 0;
  let oddNuls = 0;
  for (let i = 0; i < end; i++) {
    if (bytes[i] === 0) i % 2 ? oddNuls++ : evenNuls++;
  }
  if (end > 20 && oddNuls > end / 5 && evenNuls < end / 20)
    return new TextDecoder("utf-16le").decode(bytes);
  if (end > 20 && evenNuls > end / 5 && oddNuls < end / 20)
    return new TextDecoder("utf-16be").decode(bytes);
  return new TextDecoder("utf-8").decode(bytes);
}

