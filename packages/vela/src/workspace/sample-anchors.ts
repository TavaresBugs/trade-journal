export interface SampleAnchorConfig {
  price: number;
  tickSize: number;
  minPrice: number;
  maxPrice: number;
}

export const SAMPLE_BASE_PRICES: Record<string, SampleAnchorConfig> = {
  MNQ: { price: 30_575.75, tickSize: 0.25, minPrice: 10_000, maxPrice: 50_000 },
  NQ:  { price: 30_575.75, tickSize: 0.25, minPrice: 10_000, maxPrice: 50_000 },
  MES: { price: 7_825.25,  tickSize: 0.25, minPrice: 3_000,  maxPrice: 15_000 },
  ES:  { price: 7_825.25,  tickSize: 0.25, minPrice: 3_000,  maxPrice: 15_000 },
  MYM: { price: 44_250.0,  tickSize: 1.0,  minPrice: 20_000, maxPrice: 70_000 },
  YM:  { price: 44_250.0,  tickSize: 1.0,  minPrice: 20_000, maxPrice: 70_000 },
  M2K: { price: 2_450.0,   tickSize: 0.1,  minPrice: 1_000,  maxPrice: 5_000 },
  RTY: { price: 2_450.0,   tickSize: 0.1,  minPrice: 1_000,  maxPrice: 5_000 },
  MGC: { price: 2_950.0,   tickSize: 0.1,  minPrice: 1_500,  maxPrice: 5_000 },
  GC:  { price: 2_950.0,   tickSize: 0.1,  minPrice: 1_500,  maxPrice: 5_000 },
  CL:  { price: 72.5,      tickSize: 0.01, minPrice: 20,     maxPrice: 200 },
  BTCUSDT: { price: 85_300.0, tickSize: 0.5, minPrice: 20_000, maxPrice: 250_000 },
  ETHUSDT: { price: 3_450.0,  tickSize: 0.1, minPrice: 1_000,  maxPrice: 10_000 },
};

export function resolveSampleAnchor(
  symbol: string,
  referencePrice?: number,
  tickSize?: number,
): { price: number; tickSize: number } {
  const clean = (symbol || "")
    .replace(/^.*:/, "")
    .replace(/[A-Z]\d{1,2}$|1!$/, "")
    .toUpperCase();
  const preset = SAMPLE_BASE_PRICES[clean];

  if (typeof referencePrice === "number" && Number.isFinite(referencePrice) && referencePrice > 0) {
    if (preset) {
      // SÓ aceita o referencePrice se estiver dentro da banda válida daquele ativo!
      // Impede que os 30,569.00 do MNQ contaminem o preview do MES (que fica entre 3.000 e 15.000).
      if (referencePrice >= preset.minPrice && referencePrice <= preset.maxPrice) {
        return {
          price: referencePrice,
          tickSize: typeof tickSize === "number" && tickSize > 0 ? tickSize : preset.tickSize,
        };
      }
      return {
        price: preset.price,
        tickSize: typeof tickSize === "number" && tickSize > 0 ? tickSize : preset.tickSize,
      };
    }
    return {
      price: referencePrice,
      tickSize: typeof tickSize === "number" && tickSize > 0 ? tickSize : 0.25,
    };
  }

  if (preset) {
    return {
      price: preset.price,
      tickSize: typeof tickSize === "number" && tickSize > 0 ? tickSize : preset.tickSize,
    };
  }

  return { price: 100.0, tickSize: 0.25 };
}
