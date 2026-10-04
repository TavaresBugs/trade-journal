import { describe, expect, it } from "vitest";
import { compactMoney, fmtAdaptivePercent } from "../src/lib/utils";

describe("compactMoney", () => {
  it("formats standard amounts in compact notation with sign", () => {
    expect(compactMoney(1500, "USD")).toBe("+$1.5K");
    expect(compactMoney(-2400, "USD")).toBe("-$2.4K");
    expect(compactMoney(450, "USD")).toBe("+$450");
    expect(compactMoney(-50, "USD")).toBe("-$50");
  });

  it("normalizes negative zero and tiny sub-cents to $0 without negative sign", () => {
    expect(compactMoney(0, "USD")).toBe("$0");
    expect(compactMoney(-0, "USD")).toBe("$0");
    expect(compactMoney(-0.00001, "USD")).toBe("$0");
  });

  it("safely handles null, undefined, and NaN with dash", () => {
    expect(compactMoney(null, "USD")).toBe("–");
    expect(compactMoney(undefined, "USD")).toBe("–");
    expect(compactMoney(Number.NaN, "USD")).toBe("–");
  });

  it("supports EUR and GBP currencies", () => {
    expect(compactMoney(10000, "EUR")).toContain("10K");
    expect(compactMoney(-5000, "GBP")).toContain("5K");
  });
});

describe("fmtAdaptivePercent", () => {
  it("uses 0 decimals for large spans", () => {
    expect(fmtAdaptivePercent(0.12, 0.15)).toBe("12%");
  });

  it("uses 1 decimal for sub-1% spans", () => {
    expect(fmtAdaptivePercent(-0.005, 0.008)).toBe("-0.5%");
  });

  it("uses 2 decimals for ultra-low spans (< 0.2%)", () => {
    expect(fmtAdaptivePercent(-0.0012, 0.0015)).toBe("-0.12%");
  });

  it("safely handles null and NaN", () => {
    expect(fmtAdaptivePercent(null, 0.01)).toBe("–");
    expect(fmtAdaptivePercent(Number.NaN, 0.01)).toBe("–");
  });
});
