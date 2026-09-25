export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  label: string;
}

export const CURRENCY_LIST: CurrencyInfo[] = [
  {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    flag: "/assets/icons/flags/us.svg",
    label: "USD ($) · US Dollar",
  },
  {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    flag: "/assets/icons/flags/eu.svg",
    label: "EUR (€) · Euro",
  },
  {
    code: "GBP",
    name: "British Pound",
    symbol: "£",
    flag: "/assets/icons/flags/gb.svg",
    label: "GBP (£) · British Pound",
  },
  {
    code: "BRL",
    name: "Brazilian Real",
    symbol: "R$",
    flag: "/assets/icons/flags/br.svg",
    label: "BRL (R$) · Real Brasileiro",
  },
  {
    code: "CAD",
    name: "Canadian Dollar",
    symbol: "C$",
    flag: "/assets/icons/flags/ca.svg",
    label: "CAD (C$) · Canadian Dollar",
  },
  {
    code: "AUD",
    name: "Australian Dollar",
    symbol: "A$",
    flag: "/assets/icons/flags/au.svg",
    label: "AUD (A$) · Australian Dollar",
  },
  {
    code: "JPY",
    name: "Japanese Yen",
    symbol: "¥",
    flag: "/assets/icons/flags/jp.svg",
    label: "JPY (¥) · Japanese Yen",
  },
  {
    code: "CHF",
    name: "Swiss Franc",
    symbol: "Fr",
    flag: "/assets/icons/flags/ch.svg",
    label: "CHF (Fr) · Swiss Franc",
  },
  {
    code: "CZK",
    name: "Czech Koruna",
    symbol: "Kč",
    flag: "/assets/icons/flags/cz.svg",
    label: "CZK (Kč) · Czech Koruna",
  },
  {
    code: "NZD",
    name: "New Zealand Dollar",
    symbol: "NZ$",
    flag: "/assets/icons/flags/nz.svg",
    label: "NZD (NZ$) · New Zealand Dollar",
  },
  {
    code: "SGD",
    name: "Singapore Dollar",
    symbol: "S$",
    flag: "/assets/icons/flags/sg.svg",
    label: "SGD (S$) · Singapore Dollar",
  },
  {
    code: "HKD",
    name: "Hong Kong Dollar",
    symbol: "HK$",
    flag: "/assets/icons/flags/hk.svg",
    label: "HKD (HK$) · Hong Kong Dollar",
  },
  {
    code: "SEK",
    name: "Swedish Krona",
    symbol: "kr",
    flag: "/assets/icons/flags/se.svg",
    label: "SEK (kr) · Svensk Krona",
  },
  {
    code: "NOK",
    name: "Norwegian Krone",
    symbol: "kr",
    flag: "/assets/icons/flags/no.svg",
    label: "NOK (kr) · Norsk Krone",
  },
  {
    code: "PLN",
    name: "Polish Zloty",
    symbol: "zł",
    flag: "/assets/icons/flags/pl.svg",
    label: "PLN (zł) · Polski Złoty",
  },
  {
    code: "MXN",
    name: "Mexican Peso",
    symbol: "Mex$",
    flag: "/assets/icons/flags/mx.svg",
    label: "MXN (Mex$) · Peso Mexicano",
  },
  {
    code: "ZAR",
    name: "South African Rand",
    symbol: "R",
    flag: "/assets/icons/flags/za.svg",
    label: "ZAR (R) · South African Rand",
  },
  {
    code: "INR",
    name: "Indian Rupee",
    symbol: "₹",
    flag: "/assets/icons/flags/in.svg",
    label: "INR (₹) · Indian Rupee",
  },
  {
    code: "TRY",
    name: "Turkish Lira",
    symbol: "₺",
    flag: "/assets/icons/flags/tr.svg",
    label: "TRY (₺) · Türk Lirası",
  },
];

export const getCurrencyInfo = (code?: string | null): CurrencyInfo => {
  const normalized = (code || "USD").toUpperCase().trim();
  const match = CURRENCY_LIST.find((c) => c.code === normalized);
  if (match) return match;
  return {
    code: normalized,
    name: normalized,
    symbol: normalized,
    flag: `/assets/icons/flags/${normalized.toLowerCase().slice(0, 2)}.svg`,
    label: normalized,
  };
};
