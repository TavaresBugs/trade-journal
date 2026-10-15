/** Register (or replace) an icon's raw `<svg>` markup under an id. */
declare function registerIcon(id: string, svg: string): void;
/** The raw `<svg>` markup for an id, or null. */
declare function iconMarkup(id: string): string | null;
/** Tier A: a 16×16 chrome icon. `extra` overrides root attributes (e.g. a filled variant). */
declare function svg16(body: string, extra?: string): string;
/** Tier B: a 24×24 drawing-tool icon. `extra` overrides root attributes. */
declare function svg24(body: string, extra?: string): string;

export { svg24 as a, iconMarkup as i, registerIcon as r, svg16 as s };
