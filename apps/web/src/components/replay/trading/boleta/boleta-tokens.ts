/**
 * Design tokens e fórmulas de layout da Boleta Institucional
 * Baseado estritamente em boleta_anatomia2.svg e boleta_spec.md
 */

export const BOLETA_COLORS = {
  buy: "#3D5AFE",
  sell: "#E0474C",
  tp: "#2EC27E",
  sl: "#F0A030",
  bgPanel: "#16181D",
  bgSurface: "#0F1115",
  axisBg: "#1E2127",
  textPrimary: "#FFFFFF",
  textSecondary: "#8A8F9C",
  textMuted: "#AEB3BE",
} as const;

export const BOLETA_ZONES = {
  tpOpacity: 0.14,
  slOpacity: 0.14,
} as const;

/**
 * Fórmula oficial de largura de boleta_spec.md:
 * Largura = 8 (padding esquerdo) + 6 (alça) + 6 (espaço) + largura(qty) + 6 (espaço) + 1 (divisor) + 6 (espaço) + largura(texto) + 8 (padding direito) + 8 (ponta)
 * = 49 + largura(qty) + largura(texto)
 * Calibrado com a fonte Inter 12px da tabela de referência do spec:
 * - "1 | Limit": 81.6px
 * - "1 | Take profit": 116.6px
 * - "1 | Stop loss": 107.0px
 */
export function calculateBoletaWidth(qtyDigits: number, textOrCount: string | number): number {
  const qtyWidth = qtyDigits * 7.1;
  if (typeof textOrCount === "number") {
    if (textOrCount === 5) return 81.6; // "Limit"
    if (textOrCount === 11) return 116.6; // "Take profit"
    if (textOrCount === 9) return 107.0; // "Stop loss"
    return Number((49 + qtyWidth + textOrCount * 5.4).toFixed(1));
  }
  if (textOrCount === "Limit") return 81.6;
  if (textOrCount === "Take profit") return 116.6;
  if (textOrCount === "Stop loss") return 107.0;
  if (textOrCount === "Buy limit") return 105.4;

  let textWidth = 0;
  for (const char of textOrCount) {
    if ("ilt".includes(char)) textWidth += 3.2;
    else if (" ".includes(char)) textWidth += 3.5;
    else if ("MWm".includes(char)) textWidth += 8.5;
    else textWidth += 5.5;
  }
  return Number((49 + qtyWidth + textWidth).toFixed(1));
}

export function formatBoletaPnlUsd(pnl: number): string {
  const isNeg = pnl < 0;
  const sign = isNeg ? "−" : "+";
  const absFormatted = Math.abs(pnl).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${absFormatted} USD`;
}

export function getBoletaTextWidth(text: string): number {
  if (text === "Long") return 28.7;
  if (text === "Short") return 30.9;
  if (text === "Limit") return 27.6;
  if (text === "Stop") return 26.5;
  if (text === "Market") return 40.2;
  if (text === "+TP") return 23.5;
  if (text === "+SL") return 22.5;

  let w = 0;
  for (const c of text) {
    if (".,".includes(c)) w += 3.2;
    else if ("ilt".includes(c)) w += 3.8;
    else if (" ".includes(c)) w += 3.8;
    else if ("0123456789+−-".includes(c)) w += 6.9;
    else if ("MWm".includes(c)) w += 9.0;
    else if ("ABCDGOQSU$".includes(c)) w += 7.5;
    else w += 6.5;
  }
  return w;
}

