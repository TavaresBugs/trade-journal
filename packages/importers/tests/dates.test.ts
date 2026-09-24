import { describe, expect, it } from "vitest";
import { parseTimestamp } from "../src/dates";
import { parseMoney } from "../src/numbers";

it.each([
  ["2026-01-05, 09:30:00", "2026-01-05T09:30:00.000Z"],
  ["2026-01-05, 10:00:00", "2026-01-05T10:00:00.000Z"],
  ["2026-01-05T09:30:00.123", "2026-01-05T09:30:00.123Z"],
  ["1/5/2026 9:30:00.12 AM", "2026-01-05T09:30:00.120Z"],
  ["Jan 5, 2026 9:30:00.1 PM", "2026-01-05T21:30:00.100Z"],
  ["20260105;093000", "2026-01-05T09:30:00.000Z"],
  ["2026.01.05", "2026-01-05T00:00:00.000Z"],
  ["2024-02-29 23:59:59.999", "2024-02-29T23:59:59.999Z"],
])("preserves full timestamp %s", (input, expected) => {
  expect(parseTimestamp(input)).toBe(expected);
});
it("preserves fractional seconds while applying a statement timezone", () => {
  expect(parseTimestamp("2026-01-05 09:30:00.123", "America/New_York")).toBe(
    "2026-01-05T14:30:00.123Z",
  );
  expect(parseTimestamp("2026-07-05 09:30:00.123", "America/New_York")).toBe(
    "2026-07-05T13:30:00.123Z",
  );
  expect(parseTimestamp("2026-01-05T09:30:00.123+02:00", "America/New_York")).toBe(
    "2026-01-05T07:30:00.123Z",
  );
});
it.each([
  "2026-01-05 garbage",
  "2026-01-05, 29:30:00",
  "2026-02-30",
  "2026-01-05 09:60:00",
  "2026-01-05 09:30:60",
  "2026-13-05",
  "1/5/2026 13:30 PM",
  "2026-01-05 09:30:00.1234",
])("rejects invalid or unsupported precision rather than changing timestamp %s", (input) => {
  expect(parseTimestamp(input)).toBeNull();
});

it("automatically detects unambiguous DMY and MDY dates", () => {
  // Day > 12 -> must be DMY
  expect(parseTimestamp("25/01/2026 14:30:00")).toBe("2026-01-25T14:30:00.000Z");
  expect(parseTimestamp("31/12/2025 23:59:59")).toBe("2025-12-31T23:59:59.000Z");
  // Second segment > 12 -> must be MDY
  expect(parseTimestamp("01/25/2026 14:30:00")).toBe("2026-01-25T14:30:00.000Z");
  expect(parseTimestamp("12/31/2025 23:59:59")).toBe("2025-12-31T23:59:59.000Z");
});

it("honors explicit dateOrder for ambiguous dates", () => {
  // 05/01/2026 with DMY -> Jan 5, 2026
  expect(parseTimestamp("05/01/2026 10:00:00", "UTC", "DMY")).toBe("2026-01-05T10:00:00.000Z");
  // 05/01/2026 with MDY -> May 1, 2026
  expect(parseTimestamp("05/01/2026 10:00:00", "UTC", "MDY")).toBe("2026-05-01T10:00:00.000Z");
  // Default fallback without explicit dateOrder is MDY
  expect(parseTimestamp("05/01/2026 10:00:00")).toBe("2026-05-01T10:00:00.000Z");
});

describe("parseMoney handles multi-decimals and European formats", () => {
  it("parses Forex and futures prices with 3 to 6 decimals", () => {
    expect(parseMoney("1,08543")).toBe(1.08543);
    expect(parseMoney("1.08543")).toBe(1.08543);
    expect(parseMoney("0,00012345")).toBe(0.00012345);
    expect(parseMoney("5000,25")).toBe(5000.25);
  });

  it("distinguishes thousands separators from decimal commas/dots", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("1,234.56")).toBe(1234.56);
    expect(parseMoney("12.345,678")).toBe(12345.678);
    expect(parseMoney("12,345.678")).toBe(12345.678);
    expect(parseMoney("1,000")).toBe(1000);
    expect(parseMoney("25,000")).toBe(25000);
    expect(parseMoney("1,500,000")).toBe(1500000);
  });

  it("parses negative amounts and accounting parentheses", () => {
    expect(parseMoney("(1,0854)")).toBe(-1.0854);
    expect(parseMoney("-1.0854")).toBe(-1.0854);
    expect(parseMoney("-$1,234.56")).toBe(-1234.56);
  });
});
