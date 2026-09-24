/** "$1,234.56", "(45.20)", "1 234,56", "-12.5" → number. NaN when unparseable. */
export const parseMoney = (value: string | undefined): number => {
  if (value === undefined) return NaN;
  let text = value.trim();
  if (text === "") return NaN;
  // Combined value columns (Webull's "Price/Avg Price" → "185.50/186.00"):
  // the average fill price is the second segment.
  const combined = text.match(/^(-?[\d.,]+)\/(-?[\d.,]+)$/);
  if (combined) text = combined[2]!;
  const negative = /^\(.*\)$/.test(text) || text.startsWith("-");
  text = text.replace(/[()$€£\s]/g, "").replace(/^-/, "");
  // European/Brazilian decimal comma vs US point:
  // Detect by last separator position (e.g. 1.000,50 vs 1,000.50)
  if (text.includes(",") && text.includes(".")) {
    const lastComma = text.lastIndexOf(",");
    const lastDot = text.lastIndexOf(".");
    if (lastComma > lastDot) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (text.includes(",")) {
    if ((text.match(/,/g) || []).length > 1 || /^\d{1,3}(,\d{3})+$/.test(text)) {
      text = text.replace(/,/g, "");
    } else {
      text = text.replace(",", ".");
    }
  }
  const parsed = Number(text);
  if (Number.isNaN(parsed)) return NaN;
  return negative ? -parsed : parsed;
};

export const parseQuantity = (value: string | undefined): number => {
  if (value === undefined) return NaN;
  let text = value.trim();
  // Combined quantity columns (Webull's "Filled/Total Qty" → "5/10"):
  // the FILLED amount is the first segment.
  const combined = text.match(/^(-?[\d.,]+)\/(-?[\d.,]+)$/);
  if (combined) text = combined[1]!;
  const parsed = parseMoney(text);
  return Number.isNaN(parsed) ? NaN : Math.abs(parsed);
};
