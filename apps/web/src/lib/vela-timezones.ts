import { TIMEZONES, tzMenuLabel } from "@luxalgo/vela/widget";

export interface VelaTimezoneOption {
  value: string;
  label: string;
}

export const EXCHANGE_TIMEZONE = "exchange";

/**
 * Derives the canonical financial timezone options directly from @luxalgo/vela/widget.
 * Matches Vela's internal timezoneMenuRows() without hardcoding the list.
 */
export function buildVelaTimezones(): VelaTimezoneOption[] {
  const mapped = TIMEZONES.map((t) => ({
    value: t.value,
    label: tzMenuLabel(t.value, t.label),
  }));

  const utc: VelaTimezoneOption = mapped[0] ?? { value: "Etc/UTC", label: "UTC" };
  const rest = mapped.slice(1);

  return [
    utc,
    { value: EXCHANGE_TIMEZONE, label: "Exchange" },
    ...rest,
  ];
}

export const VELA_TIMEZONE_CATALOG: VelaTimezoneOption[] = buildVelaTimezones();

