import fs from "fs";
import path from "path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import {
  buildPalette,
  splitColor,
  combineColor,
  hslHex,
  transparencyChecker,
  VelaColorPicker,
} from "../src/components/settings/vela-color-picker";
import { VELA_TOOLTIPS_CATALOG } from "../src/components/settings/vela-info-tooltip";
import { VELA_CHART_STYLE_OPTIONS, STYLES } from "../src/components/vela-style-picker";
import {
  computeChromeJoinGeometry,
  createChromeJoinOutline,
} from "../src/components/vela-chrome-join";
import {
  VelaCheckbox,
  VelaToggle,
  VelaSwitch,
  VELA_CHECKBOX_STYLE,
  VELA_TOGGLE_STYLE,
} from "../src/components/settings/vela-toggle";
import { VelaBezierSelect } from "../src/components/settings/vela-bezier-select";
import { VELA_TIMEZONE_CATALOG } from "../src/lib/vela-timezones";
import { VelaSettingsDialog } from "../src/components/settings/vela-settings-dialog";
import { enhanceColorPickerPopovers } from "../src/components/vela-drawing-enhancer";

describe("Vela Settings Components", () => {
  describe("buildPalette (80 swatches matrix)", () => {
    it("generates exactly 8 rows of 10 swatches totaling 80 unique hex colors", () => {
      const palette = buildPalette();
      expect(palette).toHaveLength(8);

      palette.forEach((row) => {
        expect(row).toHaveLength(10);
        row.forEach((color) => {
          expect(color).toMatch(/^#[0-9a-f]{6}$/i);
        });
      });

      const allSwatches = palette.flat();
      expect(allSwatches).toHaveLength(80);

      // Verify the first row is monochromatic grayscale
      const grays = palette[0]!;
      expect(grays[0]).toBe("#ffffff"); // lightness 100
      expect(grays[9]).toBe("#000000"); // lightness 0
    });

    it("hslHex correctly converts HSL tuples to hex", () => {
      expect(hslHex(0, 0, 100)).toBe("#ffffff");
      expect(hslHex(0, 0, 0)).toBe("#000000");
      expect(hslHex(0, 100, 50)).toBe("#ff0000"); // pure red
      expect(hslHex(120, 100, 50)).toBe("#00ff00"); // pure green
      expect(hslHex(240, 100, 50)).toBe("#0000ff"); // pure blue
    });
  });

  describe("splitColor and combineColor", () => {
    describe("splitColor without alpha", () => {
      it("splits 6-digit hex color with alpha 1", () => {
        const res = splitColor("#089981");
        expect(res).toEqual({ hex6: "#089981", alpha: 1 });
      });

      it("splits 3-digit shorthand hex with alpha 1", () => {
        const res = splitColor("#fff");
        expect(res).toEqual({ hex6: "#ffffff", alpha: 1 });

        const dark = splitColor("#123");
        expect(dark).toEqual({ hex6: "#112233", alpha: 1 });
      });

      it("falls back gracefully for empty or invalid input", () => {
        const res = splitColor("");
        expect(res).toEqual({ hex6: "#089981", alpha: 1 });
      });
    });

    describe("splitColor with alpha", () => {
      it("splits 8-digit hex color with alpha channel", () => {
        const res = splitColor("#08998180");
        expect(res.hex6).toBe("#089981");
        expect(res.alpha).toBeCloseTo(128 / 255, 3);
      });

      it("splits rgba() format with floating alpha", () => {
        const res = splitColor("rgba(41, 98, 255, 0.5)");
        expect(res.hex6).toBe("#2962ff");
        expect(res.alpha).toBe(0.5);
      });

      it("splits rgb() without alpha as alpha 1", () => {
        const res = splitColor("rgb(8, 153, 129)");
        expect(res.hex6).toBe("#089981");
        expect(res.alpha).toBe(1);
      });
    });

    describe("combineColor", () => {
      it("returns 6-digit hex when alpha is 1 (or >= 0.999)", () => {
        expect(combineColor("#2962ff", 1)).toBe("#2962ff");
        expect(combineColor("#2962ff", 0.9995)).toBe("#2962ff");
      });

      it("appends 2-digit hex alpha when alpha < 1", () => {
        expect(combineColor("#2962ff", 0.5)).toBe("#2962ff80");
        expect(combineColor("#2962ff", 0)).toBe("#2962ff00");
      });

      it("clamps alpha below 0 and above 1", () => {
        expect(combineColor("#2962ff", -0.5)).toBe("#2962ff00");
        expect(combineColor("#2962ff", 1.5)).toBe("#2962ff");
      });

      it("preserves lowercase format", () => {
        expect(combineColor("#AABBCC", 0.5)).toBe("#aabbcc80");
      });
    });

    it("roundtrips between splitColor and combineColor", () => {
      const original = "#2962ff80";
      const { hex6, alpha } = splitColor(original);
      const combined = combineColor(hex6, alpha);
      expect(combined).toBe(original);
    });
  });

  describe("VelaColorPicker component", () => {
    it("renders circular trigger swatch button with custom title and value gradient", () => {
      const markup = renderToStaticMarkup(
        React.createElement(VelaColorPicker, {
          value: "#089981",
          onChange: () => {},
          title: "Scale border color",
        })
      );
      expect(markup).toContain('class="vela-color-field vela-color-field-circle "');
      expect(markup).toContain('title="Scale border color"');
      expect(markup).toContain("linear-gradient(#089981, #089981)");
      // Popover is closed initially, so no popover in static markup
      expect(markup).not.toContain('role="dialog"');
    });

    it("renders disabled state with vela-field-dim class and disabled attribute", () => {
      const markup = renderToStaticMarkup(
        React.createElement(VelaColorPicker, {
          value: "#2a2b30",
          onChange: () => {},
          disabled: true,
        })
      );
      expect(markup).toContain("vela-field-dim");
      expect(markup).toContain("disabled");
    });

    it("renders popover with unified 20x20 borderless recent swatches and TradingView borderless [+] button", () => {
      const markup = renderToStaticMarkup(
        React.createElement(VelaColorPicker, {
          value: "#089981",
          onChange: () => {},
          initialOpen: true,
        })
      );
      expect(markup).toContain('role="dialog"');
      expect(markup).toContain('aria-label="Color picker"');
      // Recents row has 4px gap matching top matrix
      expect(markup).toContain("gap-[4px]");
      // Recents swatches are 20x20 borderless
      expect(markup).toContain("w-[20px] h-[20px] rounded-[4px] cursor-pointer p-0 border-0");
      // Add [+] button is 20x20 borderless (no border-dashed)
      expect(markup).toContain('title="Add custom color"');
      expect(markup).toContain("w-[20px] h-[20px] rounded-[4px] border-0 bg-transparent");
      expect(markup).not.toContain("border-dashed");
      expect(markup).not.toContain("w-[17px]");
    });
  });

  describe("VELA_TOOLTIPS_CATALOG", () => {
    const requiredAnimationKeys = [
      "animate-zoom",
      "pan-momentum",
      "animate-price-scale",
      "animate-price-changes",
      "reveal-on-load",
    ];

    it("contains all required animation keys with valid titles and descriptions", () => {
      for (const key of requiredAnimationKeys) {
        expect(VELA_TOOLTIPS_CATALOG).toHaveProperty(key);
        const entry = VELA_TOOLTIPS_CATALOG[key]!;
        expect(entry.title).toBeTruthy();
        expect(typeof entry.title).toBe("string");
        expect(entry.description).toBeTruthy();
        expect(typeof entry.description).toBe("string");
      }
    });

    it("has the exact canonical copy for animations", () => {
      expect(VELA_TOOLTIPS_CATALOG["animate-zoom"]).toEqual({
        title: "Animate zoom",
        description: "Glide the chart to each zoom step instead of jumping.",
      });
      expect(VELA_TOOLTIPS_CATALOG["pan-momentum"]).toEqual({
        title: "Pan momentum",
        description: "Add smooth physics and inertia deceleration when panning the chart.",
      });
      expect(VELA_TOOLTIPS_CATALOG["animate-price-scale"]).toEqual({
        title: "Animate price scale",
        description:
          "Smoothly interpolate price axis scale transitions during autoscale and data updates.",
      });
      expect(VELA_TOOLTIPS_CATALOG["animate-price-changes"]).toEqual({
        title: "Animate price changes",
        description: "Animate candlestick transitions and price updates seamlessly in real time.",
      });
      expect(VELA_TOOLTIPS_CATALOG["reveal-on-load"]).toEqual({
        title: "Reveal on load",
        description: "Staggered fade and rise animation when loading chart series onto the canvas.",
      });
    });
  });

  describe("transparencyChecker", () => {
    it("returns default 8px repeating-conic-gradient string", () => {
      const bg = transparencyChecker();
      expect(bg).toContain("repeating-conic-gradient");
      expect(bg).toContain("#9aa0a6");
      expect(bg).toContain("#d3d6da");
      expect(bg).toContain("8px 8px");
    });

    it("accepts custom size parameter", () => {
      const bg = transparencyChecker(12);
      expect(bg).toContain("12px 12px");
    });
  });

  describe("Chart Style options", () => {
    it("provides the 6 canonical chart styles with SVG icons", () => {
      expect(STYLES).toHaveLength(6);
      expect(VELA_CHART_STYLE_OPTIONS).toHaveLength(6);

      const expectedIds = ["candles", "bars", "line", "area", "baseline", "heikinashi"];
      expect(STYLES.map((s) => s.id)).toEqual(expectedIds);
      expect(VELA_CHART_STYLE_OPTIONS.map((o) => o.value)).toEqual(expectedIds);

      VELA_CHART_STYLE_OPTIONS.forEach((opt) => {
        expect(opt.iconSvg).toContain("<svg");
        expect(opt.label).toBeTruthy();
      });
    });
  });

  describe("VelaCheckbox (.vela-switch 17x17px)", () => {
    it("renders unchecked state with exact attributes, dimensions, and colors", () => {
      const html = renderToStaticMarkup(
        React.createElement(VelaCheckbox, {
          checked: false,
          onChange: () => {},
          ariaLabel: "Body",
        }),
      );

      // DOM & Attributes
      expect(html).toContain('class="vela-switch');
      expect(html).not.toContain("quant-settings-toggle");
      expect(html).toContain('data-size="md"');
      expect(html).toContain('data-tone="bright"');
      expect(html).toContain('role="switch"');
      expect(html).toContain('aria-checked="false"');
      expect(html).toContain('data-checked="false"');
      expect(html).toContain('aria-label="Body"');

      // Dimensions & 4px radius
      expect(html).toContain("width:17px");
      expect(html).toContain("height:17px");
      expect(html).toContain("border-radius:4px");

      // Ground-truth unchecked colors
      expect(html).toContain("background-color:transparent");
      expect(html).toContain("border:1px solid rgb(42, 43, 48)");
      expect(html).toContain("color:transparent");

      // Constant tokens
      expect(VELA_CHECKBOX_STYLE.width).toBe("17px");
      expect(VELA_CHECKBOX_STYLE.height).toBe("17px");
      expect(VELA_CHECKBOX_STYLE.borderRadius).toBe("4px");
      expect(VELA_CHECKBOX_STYLE.unchecked.backgroundColor).toBe("transparent");
      expect(VELA_CHECKBOX_STYLE.unchecked.border).toBe("1px solid rgb(42, 43, 48)");
      expect(VELA_CHECKBOX_STYLE.unchecked.color).toBe("transparent");
    });

    it("renders checked state with exact ground-truth bright colors and attributes", () => {
      const html = renderToStaticMarkup(
        React.createElement(VelaCheckbox, {
          checked: true,
          onChange: () => {},
          ariaLabel: "Borders",
        }),
      );

      expect(html).toContain('aria-checked="true"');
      expect(html).toContain('data-checked="true"');
      expect(html).toContain("background-color:rgb(240, 243, 250)");
      expect(html).toContain("border:1px solid rgb(240, 243, 250)");
      expect(html).toContain("color:rgb(21, 22, 25)");

      expect(VELA_CHECKBOX_STYLE.checked.backgroundColor).toBe("rgb(240, 243, 250)");
      expect(VELA_CHECKBOX_STYLE.checked.border).toBe("1px solid rgb(240, 243, 250)");
      expect(VELA_CHECKBOX_STYLE.checked.color).toBe("rgb(21, 22, 25)");
    });

    it("renders the exact SVG checkbox mark structure with 12x12px dimensions and all 3 paths", () => {
      const html = renderToStaticMarkup(
        React.createElement(VelaCheckbox, {
          checked: true,
          onChange: () => {},
          ariaLabel: "Wick",
        }),
      );

      expect(html).toContain('class="vela-icon"');
      expect(html).toContain('data-slot="checkbox-mark"');
      expect(html).toContain('viewBox="0 0 16 16"');
      expect(html).toContain("width:12px");
      expect(html).toContain("height:12px");

      // Check the 3 canonical paths
      expect(html).toContain('d="M3.2 8.1 6.3 11.2"');
      expect(html).toContain('data-checkbox-part="lead"');
      expect(html).toContain('d="M6.3 11.2 12.8 4.7"');
      expect(html).toContain('data-checkbox-part="finish"');
      expect(html).toContain('d="M3.5 8h9"');
      expect(html).toContain('data-checkbox-part="mixed"');
      expect(html).toContain('pathLength="1"');
      expect(html).toContain('stroke-width="1.7"');
    });

    it("supports indeterminate state with mixed aria-checked and visible mixed bar", () => {
      const html = renderToStaticMarkup(
        React.createElement(VelaCheckbox, {
          checked: false,
          indeterminate: true,
          onChange: () => {},
        }),
      );

      expect(html).toContain('aria-checked="mixed"');
      expect(html).toContain("background-color:rgb(240, 243, 250)");
      // mixed path is not hidden
      expect(html).not.toContain('data-checkbox-part="mixed" style="display:none"');
    });

    it("renders clean label when label prop is provided", () => {
      const html = renderToStaticMarkup(
        React.createElement(VelaCheckbox, {
          checked: true,
          onChange: () => {},
          label: "Body",
        }),
      );

      expect(html).toContain("<label");
      expect(html).toContain("Body</span>");
      expect(html).toContain('class="vela-switch');
    });
  });

  describe("VELA_TIMEZONE_CATALOG (53 Canonical Financial Timezones)", () => {
    it("contains exactly 53 canonical financial timezones spanning UTC-12 to UTC+14", () => {
      expect(VELA_TIMEZONE_CATALOG).toHaveLength(53);
      expect(VELA_TIMEZONE_CATALOG[0]).toEqual({ value: "Etc/UTC", label: "UTC" });
      expect(VELA_TIMEZONE_CATALOG[1]).toEqual({ value: "exchange", label: "Exchange" });
      expect(VELA_TIMEZONE_CATALOG[2]).toEqual({
        value: "Etc/GMT+12",
        label: "(UTC-12) International Date Line West",
      });
      expect(VELA_TIMEZONE_CATALOG[52]).toEqual({
        value: "Pacific/Kiritimati",
        label: "(UTC+14) Kiritimati",
      });
    });

    it("has valid non-empty value and label for every entry without duplicates", () => {
      const values = new Set<string>();
      for (const tz of VELA_TIMEZONE_CATALOG) {
        expect(tz.value).toBeTruthy();
        expect(typeof tz.value).toBe("string");
        expect(tz.label).toBeTruthy();
        expect(typeof tz.label).toBe("string");
        expect(values.has(tz.value)).toBe(false);
        values.add(tz.value);
      }
      expect(values.size).toBe(53);
    });
  });

  describe("VelaToggle (Compact 9px Switch pattern)", () => {
    it("renders unchecked state with exact attributes, flexbox centered thumb, and compact track", () => {
      const html = renderToStaticMarkup(
        React.createElement(VelaToggle, {
          checked: false,
          onChange: () => {},
          ariaLabel: "Pan momentum",
        }),
      );

      // DOM & Attributes
      expect(html).toContain('role="switch"');
      expect(html).toContain('aria-checked="false"');
      expect(html).toContain('aria-label="Pan momentum"');

      // Compact Switch classes
      expect(html).toContain("inline-flex");
      expect(html).toContain("items-center");
      expect(html).toContain("rounded-full");
      expect(html).toContain("h-[15px]");
      expect(html).toContain("w-[26px]");

      // Unchecked track: dark charcoal #22242a
      expect(html).toContain("bg-[#22242a]");
      expect(html).toContain("border-[#34353b]/80");

      // Unchecked thumb: child <span> with 9px size, muted slate #6c707d, and translate-x-0
      expect(html).toContain("size-[9px]");
      expect(html).toContain("bg-[#6c707d]");
      expect(html).toContain("translate-x-0");

      // Constant tokens
      expect(VELA_TOGGLE_STYLE.width).toBe("26px");
      expect(VELA_TOGGLE_STYLE.height).toBe("15px");
      expect(VELA_TOGGLE_STYLE.borderRadius).toBe("9999px");
      expect(VELA_TOGGLE_STYLE.thumbWidth).toBe("9px");
      expect(VELA_TOGGLE_STYLE.thumbHeight).toBe("9px");
      expect(VELA_TOGGLE_STYLE.unchecked.trackBackground).toBe("#22242a");
      expect(VELA_TOGGLE_STYLE.unchecked.thumbColor).toBe("#6c707d");
      expect(VELA_TOGGLE_STYLE.unchecked.thumbTransform).toBe("translateX(0px)");
    });

    it("renders checked state with slate/gray track and pure white thumb translated to right", () => {
      const html = renderToStaticMarkup(
        React.createElement(VelaToggle, {
          checked: true,
          onChange: () => {},
          ariaLabel: "Animate zoom",
        }),
      );

      expect(html).toContain('aria-checked="true"');

      // Checked track: slate/gray background & border
      expect(html).toContain("bg-[#5c606d]");
      expect(html).toContain("border-[#6b7080]");

      // Checked thumb: pure white translated 11px (translate-x-[11px])
      expect(html).toContain("bg-[#ffffff]");
      expect(html).toContain("translate-x-[11px]");

      expect(VELA_TOGGLE_STYLE.checked.trackBackground).toBe("#5c606d");
      expect(VELA_TOGGLE_STYLE.checked.thumbColor).toBe("#ffffff");
      expect(VELA_TOGGLE_STYLE.checked.thumbTransform).toBe("translateX(11px)");
    });

    it("supports size='default' (h-6 w-11 with size-4.5 thumb)", () => {
      const html = renderToStaticMarkup(
        React.createElement(VelaToggle, {
          checked: true,
          onChange: () => {},
          size: "default",
        }),
      );

      expect(html).toContain("h-6");
      expect(html).toContain("w-11");
      expect(html).toContain("size-4.5");
      expect(html).toContain("translate-x-5");
    });

    it("supports size='sm' (h-5 w-9 with size-3.5 thumb)", () => {
      const html = renderToStaticMarkup(
        React.createElement(VelaToggle, {
          checked: true,
          onChange: () => {},
          size: "sm",
        }),
      );

      expect(html).toContain("h-5");
      expect(html).toContain("w-9");
      expect(html).toContain("size-3.5");
      expect(html).toContain("translate-x-4");
    });
  });

  describe("VelaSwitch smart router", () => {
    it("routes to VelaToggle by default and VelaCheckbox when variant=checkbox", () => {
      const toggleHtml = renderToStaticMarkup(
        React.createElement(VelaSwitch, {
          checked: false,
          onChange: () => {},
        }),
      );
      expect(toggleHtml).toContain("h-[15px]");
      expect(toggleHtml).toContain("w-[26px]");
      expect(toggleHtml).toContain("bg-[#22242a]");

      const checkboxHtml = renderToStaticMarkup(
        React.createElement(VelaSwitch, {
          variant: "checkbox",
          checked: true,
          onChange: () => {},
        }),
      );
      expect(checkboxHtml).toContain("class=\"vela-switch");
      expect(checkboxHtml).toContain("width:17px");
    });
  });

  describe("Adaptive Bézier Chrome Join System", () => {
    describe("computeChromeJoinGeometry", () => {
      it("preserves unconstrained topbar join geometry (Formula 2.3) when clampToBounds is false", () => {
        const geo = computeChromeJoinGeometry(180, 220, {
          shoulder: 16,
          radius: 10,
          clampToBounds: false,
        });

        expect(geo.totalW).toBe(180 + 2 * 16); // 212
        expect(geo.viewBox).toBe("0 -2 212 222");
        expect(geo.svgStyle.left).toBe("-16px");
        expect(geo.svgStyle.width).toBe("calc(100% + 32px)");
        // Unconstrained concave wings curve out to totalW
        expect(geo.dEdge).toContain("M 0 0.5 Q 16 0.5 16 16.5");
        expect(geo.dEdge).toContain("Q 196 0.5 212 0.5");
        expect(geo.dFill).toContain("L 212 -2 L 0 -2 Z");
      });

      it("computes unified enclosing envelope (Formula 2.2 Symmetric) when triggerWidth === totalW", () => {
        const geo = computeChromeJoinGeometry(170, 240, {
          shoulder: 8,
          radius: 6,
          clampToBounds: true,
          triggerOffsetLeft: 0,
          triggerWidth: 170,
          triggerHeight: 29,
        });

        expect(geo.totalW).toBe(170);
        expect(geo.totalH).toBe(240);
        expect(geo.viewBox).toBe("0 0 170 240");
        expect(geo.svgStyle.left).toBe("0px");
        expect(geo.svgStyle.top).toBe("0px");
        expect(geo.svgStyle.height).toBe("100%");
        expect(geo.svgStyle.width).toBe("100%");
        expect(geo.svgStyle.clipPath).toBe("none");

        // Continuous outline with open top at y=0, stroke on left, bottom, right
        expect(geo.dEdge).toBe(
          "M 0.5 0 V 233.5 Q 0.5 239.5 6.5 239.5 H 163.5 Q 169.5 239.5 169.5 233.5 V 0",
        );
        expect(geo.dFill).toBe(`${geo.dEdge} Z`);
      });

      it("computes unified enclosing envelope (Official Vela Field Join) when trigger is narrower than popup", () => {
        const geo = computeChromeJoinGeometry(265, 240, {
          shoulder: 8,
          radius: 6,
          clampToBounds: true,
          triggerOffsetLeft: 0,
          triggerWidth: 90,
          triggerHeight: 29,
        });

        expect(geo.totalW).toBe(265);
        expect(geo.totalH).toBe(240);
        expect(geo.viewBox).toBe("0 0 265 240");
        expect(geo.svgStyle.left).toBe("0px");
        expect(geo.svgStyle.top).toBe("0px");
        expect(geo.svgStyle.height).toBe("100%");
        expect(geo.svgStyle.width).toBe("100%");

        // Starts at (0.5, 0) collinear with trigger's left border
        expect(geo.dEdge).toContain("M 0.5 0");
        // Popup vertical left edge and bottom-left corner
        expect(geo.dEdge).toContain("V 233.5 Q 0.5 239.5 6.5 239.5");
        // Popup bottom edge, bottom-right corner, and vertical right edge
        expect(geo.dEdge).toContain("H 258.5 Q 264.5 239.5 264.5 233.5");
        // Popup vertical right edge to top-right corner
        expect(geo.dEdge).toContain("V 6.5 Q 264.5 0.5 258.5 0.5");
        // Popup top shoulder closing to trigger right border at x = 90
        expect(geo.dEdge).toContain("H 90");

        // Fill closes the envelope with Z
        expect(geo.dFill).toBe(`${geo.dEdge} Z`);
      });

      it("never generates negative X coordinates or coordinates exceeding totalW when clamped", () => {
        const widths = [100, 140, 150, 170, 180, 240, 265];
        for (const w of widths) {
          const geo = computeChromeJoinGeometry(w, 200, {
            shoulder: 8,
            radius: 6,
            clampToBounds: true,
            triggerOffsetLeft: 0,
            triggerWidth: Math.min(90, w),
            triggerHeight: 29,
          });

          // Extract all numeric coordinates following M, V, H, Q, L
          const numbers = geo.dEdge.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
          expect(geo.totalW).toBe(w);
          expect(geo.viewBox).toBe(`0 0 ${w} 200`);
          for (const num of numbers) {
            expect(num).toBeGreaterThanOrEqual(0);
          }
        }
      });
    });

    describe("createChromeJoinOutline DOM mounting", () => {
      it("attaches SVG with clamped attributes and styles when clampToBounds is true", () => {
        const createMockEl = (tag: string) => {
          const children: any[] = [];
          return {
            tagName: tag.toUpperCase(),
            style: {} as Record<string, string>,
            dataset: {} as Record<string, string>,
            classList: {
              classes: new Set<string>(),
              add(c: string) {
                this.classes.add(c);
              },
              contains(c: string) {
                return this.classes.has(c);
              },
            },
            setAttribute(k: string, v: string) {
              (this as any)[k] = v;
            },
            prepend(child: any) {
              children.unshift(child);
            },
            append(...newChildren: any[]) {
              children.push(...newChildren);
            },
            contains(child: any) {
              return children.includes(child);
            },
            remove() {
              const idx = children.indexOf(this);
              if (idx !== -1) children.splice(idx, 1);
            },
            offsetWidth: 170,
            offsetHeight: 240,
            offsetLeft: 0,
            getBoundingClientRect: () => ({
              left: 0,
              top: 0,
              width: 170,
              height: 240,
              right: 170,
              bottom: 240,
            }),
          };
        };

        const origDoc = (globalThis as any).document;
        (globalThis as any).document = {
          createElementNS: (_ns: string, tag: string) => createMockEl(tag),
          createElement: (tag: string) => createMockEl(tag),
        };

        try {
          const popup = createMockEl("div");
          const trigger = createMockEl("button");

          const instance = createChromeJoinOutline(popup as any, {
            shoulder: 8,
            radius: 6,
            fillColor: "#151619",
            strokeColor: "#34353b",
            triggerElement: trigger as any,
            clampToBounds: true,
            triggerHeight: 29,
          });

          expect(instance.svg).toBeDefined();
          expect(popup.contains(instance.svg)).toBe(true);
          expect(instance.svg.classList.contains("quant-chrome-outline")).toBe(true);
          expect(instance.svg.dataset.quantClamped).toBe("1");
          expect(instance.svg.style.left).toBe("0px");
          expect(instance.svg.style.top).toBe("0px");
          expect(instance.svg.style.width).toBe("100%");
          expect(instance.svg.style.height).toBe("100%");
          expect(instance.pathFill.style.fill).toBe("#151619");
          expect(instance.pathEdge.style.stroke).toBe("#34353b");

          // Teardown
          instance.destroy();
        } finally {
          (globalThis as any).document = origDoc;
        }
      });
    });

    describe("VelaBezierSelect component rendering", () => {
      const TIMEZONE_OPTIONS = [
        { value: "Etc/UTC", label: "UTC" },
        { value: "America/Sao_Paulo", label: "São Paulo (UTC-3)" },
        { value: "America/New_York", label: "New York (UTC-4)" },
      ];

      it("renders canonical .vela-select-trigger with 29px height, #34353b border, transparent bg, and rounded 6px for Timezone select", () => {
        const html = renderToStaticMarkup(
          React.createElement(VelaBezierSelect, {
            value: "Etc/UTC",
            options: TIMEZONE_OPTIONS,
            onChange: () => {},
            minWidth: 170,
          }),
        );

        expect(html).toContain("vela-select-trigger");
        expect(html).toContain("h-[29px]");
        expect(html).toContain("border-[#34353b]");
        expect(html).toContain("rounded-[6px]");
        expect(html).toContain("bg-transparent");
        expect(html).toContain("vela-select-label");
        expect(html).toContain("vela-select-chevron");
        expect(html).toContain("UTC");
      });

      it("renders canonical .vela-select-trigger for Chart Style select with icon", () => {
        const html = renderToStaticMarkup(
          React.createElement(VelaBezierSelect, {
            value: "candles",
            options: VELA_CHART_STYLE_OPTIONS,
            onChange: () => {},
            minWidth: 150,
          }),
        );

        expect(html).toContain("vela-select-trigger");
        expect(html).toContain("h-[29px]");
        expect(html).toContain("border-[#34353b]");
        expect(html).toContain("Candles");
        expect(html).toContain("<svg");
      });

      it("supports popupMinWidth prop for wider menus like Timezone catalog", () => {
        const html = renderToStaticMarkup(
          React.createElement(VelaBezierSelect, {
            value: "Etc/UTC",
            options: VELA_TIMEZONE_CATALOG,
            onChange: () => {},
            minWidth: 170,
            popupMinWidth: 265,
          }),
        );

        expect(html).toContain("vela-select-trigger");
        expect(html).toContain("UTC");
      });

      it("renders open state with #34353b borders, seamless #151619 bottom border, and popup at top-[28px]", () => {
        const html = renderToStaticMarkup(
          React.createElement(VelaBezierSelect, {
            value: "Etc/UTC",
            options: TIMEZONE_OPTIONS,
            onChange: () => {},
            minWidth: 170,
            popupMinWidth: 265,
            defaultOpen: true,
          }),
        );

        // Trigger retains real HTML button structure with label and chevron
        expect(html).toContain("data-quant-open=\"1\"");
        expect(html).toContain("bg-[#151619]");
        expect(html).toContain("border-[#34353b]");
        expect(html).toContain("border-b-[#151619]");
        expect(html).toContain("rounded-t-[6px]");
        expect(html).toContain("rounded-b-none");
        expect(html).toContain("vela-select-label");
        expect(html).toContain("vela-select-chevron");

        // Popup is positioned at top-[28px] (1px overlap on the 29px trigger)
        expect(html).toContain("vela-select-dropdown");
        expect(html).toContain("top-[28px]");
      });
    });
  });

  describe("CSS Shielding and Form Rows (.quant-settings-row)", () => {
    it("guarantees globals.css defines .quant-settings-row with strict flexbox layout, width 100%, and !important", () => {
      const globalsCssPath = path.resolve(__dirname, "../src/app/globals.css");
      const css = fs.readFileSync(globalsCssPath, "utf-8");

      expect(css).toContain(".quant-settings-row {");
      const match = css.match(/\.quant-settings-row\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      const body = match![1]!;

      expect(body).toContain("display: flex !important;");
      expect(body).toContain("flex-direction: row !important;");
      expect(body).toContain("align-items: center !important;");
      expect(body).toContain("justify-content: space-between !important;");
      expect(body).toContain("min-height: 31px !important;");
      expect(body).toContain("height: 31px !important;");
      expect(body).toContain("gap: 8px !important;");
      expect(body).toContain("width: 100% !important;");
      expect(body).toContain("box-sizing: border-box !important;");
    });

    it("guarantees globals.css defines scoped fallbacks for .vela-field-row inside custom settings dialogs", () => {
      const globalsCssPath = path.resolve(__dirname, "../src/app/globals.css");
      const css = fs.readFileSync(globalsCssPath, "utf-8");

      expect(css).toContain(".quant-settings-dialog .vela-field-row");
      expect(css).toContain(".quant-settings-group .vela-field-row");
      expect(css).toContain(".vela-settings-dialog .vela-field-row");

      const match = css.match(
        /\.quant-settings-dialog \.vela-field-row[\s\S]*?\.quant-settings-group \.vela-field-row[\s\S]*?\.vela-settings-dialog \.vela-field-row\s*\{([^}]+)\}/,
      );
      expect(match).toBeTruthy();
      const body = match![1]!;

      expect(body).toContain("display: flex !important;");
      expect(body).toContain("width: 100% !important;");
    });
  });

  describe("VelaSettingsDialog Layout & CSS Shielding", () => {
    const defaultProps = {
      isOpen: true,
      onClose: () => {},
      symbol: "BTCUSDT",
      resolution: "1m" as const,
    };

    it("renders root modal with vela-settings-dialog and quant-settings-dialog scoping classes", () => {
      const html = renderToStaticMarkup(
        React.createElement(VelaSettingsDialog, defaultProps),
      );

      expect(html).toContain("vela-settings-dialog");
      expect(html).toContain("quant-settings-dialog");
      expect(html).toContain("quant-settings-panel");
    });

    it("Tab 1 (symbol): renders all candle, animation, timezone, and watermark rows with .quant-settings-row", () => {
      const html = renderToStaticMarkup(
        React.createElement(VelaSettingsDialog, {
          ...defaultProps,
          initialTab: "symbol",
        }),
      );

      expect(html).toContain("quant-settings-row");

      // Candles
      expect(html).toContain("Body");
      expect(html).toContain("Borders");
      expect(html).toContain("Wick");
      expect(html).toContain("Spacing");

      // Animations
      expect(html).toContain("Animate zoom");
      expect(html).toContain("Pan momentum");
      expect(html).toContain("Animate price scale");
      expect(html).toContain("Animate price changes");
      expect(html).toContain("Reveal on load");

      // Timezone & Watermarks
      expect(html).toContain("Time zone");
      expect(html).toContain("Symbol watermark");
      expect(html).toContain("Replay watermark");

      const occurrences = (html.match(/quant-settings-row/g) || []).length;
      expect(occurrences).toBeGreaterThanOrEqual(12);
    });

    it("Tab 2 (status-line): renders all status line and indicator rows with .quant-settings-row", () => {
      const html = renderToStaticMarkup(
        React.createElement(VelaSettingsDialog, {
          ...defaultProps,
          initialTab: "status-line",
        }),
      );

      expect(html).toContain("quant-settings-row");
      expect(html).toContain("Symbol name");
      expect(html).toContain("Market status");
      expect(html).toContain("OHLC values");
      expect(html).toContain("Bar change values");
      expect(html).toContain("Titles");
      expect(html).toContain("Values");

      const occurrences = (html.match(/quant-settings-row/g) || []).length;
      expect(occurrences).toBeGreaterThanOrEqual(6);
    });

    it("Tab 3 (scales-and-lines): renders all price scale and crosshair rows with .quant-settings-row", () => {
      const html = renderToStaticMarkup(
        React.createElement(VelaSettingsDialog, {
          ...defaultProps,
          initialTab: "scales-and-lines",
        }),
      );

      expect(html).toContain("quant-settings-row");
      expect(html).toContain("Mode");
      expect(html).toContain("Invert scale");
      expect(html).toContain("Last Price Line");
      expect(html).toContain("Last price label");
      expect(html).toContain("Countdown to bar close");
      expect(html).toContain("Axis labels");
      expect(html).toContain("Scale border color");
      expect(html).toContain("Crosshair");
      expect(html).toContain("Width");
      expect(html).toContain("Style");

      const occurrences = (html.match(/quant-settings-row/g) || []).length;
      expect(occurrences).toBeGreaterThanOrEqual(10);
    });

    it("Tab 4 (canvas): renders all background, text, margin, grid, and theme rows with .quant-settings-row", () => {
      const html = renderToStaticMarkup(
        React.createElement(VelaSettingsDialog, {
          ...defaultProps,
          initialTab: "canvas",
        }),
      );

      expect(html).toContain("quant-settings-row");
      expect(html).toContain("Background");
      expect(html).toContain("Text color");
      expect(html).toContain("Text size");
      expect(html).toContain("Pane separator");
      expect(html).toContain("Top");
      expect(html).toContain("Bottom");
      expect(html).toContain("Right");
      expect(html).toContain("Vertical");
      expect(html).toContain("Horizontal");
      expect(html).toContain("Color theme");

      const occurrences = (html.match(/quant-settings-row/g) || []).length;
      expect(occurrences).toBeGreaterThanOrEqual(10);
    });

    it("Tab 5 (data): renders all active dataset and depth context rows with .quant-settings-row", () => {
      const html = renderToStaticMarkup(
        React.createElement(VelaSettingsDialog, {
          ...defaultProps,
          initialTab: "data",
        }),
      );

      expect(html).toContain("quant-settings-row");
      expect(html).toContain("Active series");
      expect(html).toContain("Database Engine");
      expect(html).toContain("Bars to fetch");
      expect(html).toContain("Trade context padding");

      const occurrences = (html.match(/quant-settings-row/g) || []).length;
      expect(occurrences).toBeGreaterThanOrEqual(4);
    });
  });

  describe("VelaSettingsDialog layout shielding", () => {
    it("renders quant-settings-row on all field rows across tabs", () => {
      // read or import vela-settings-dialog.tsx source and verify that quant-settings-row is defined on all rows
      const fs = require("fs");
      const src = fs.readFileSync("apps/web/src/components/settings/vela-settings-dialog.tsx", "utf-8");
      const matches = (src.match(/quant-settings-row/g) || []).length;
      expect(matches).toBeGreaterThanOrEqual(30);
    });

    it("defines quant-settings-row in globals.css with display flex !important and width 100%", () => {
      const fs = require("fs");
      const css = fs.readFileSync("apps/web/src/app/globals.css", "utf-8");
      expect(css).toContain(".quant-settings-row");
      expect(css).toContain("display: flex !important");
      expect(css).toContain("width: 100% !important");
    });
  });

  describe("Color Picker [+] Button TradingView Parity", () => {
    it("enhances mock .vela-color-field-pop: replaces '+' text with 10x10 SVG, strips inline borders, and preserves <input type='color'>", () => {
      const createMockEl = (tag: string, isText = false, text = "") => {
        const children: any[] = [];
        return {
          tagName: isText ? undefined : tag.toUpperCase(),
          nodeType: isText ? 3 : 1,
          textContent: text,
          innerHTML: "",
          value: "",
          type: "",
          style: {} as Record<string, string>,
          dataset: {} as Record<string, string>,
          childNodes: children,
          children,
          className: "",
          getAttribute(k: string) {
            return (this as any)[k] ?? null;
          },
          setAttribute(k: string, v: string) {
            (this as any)[k] = v;
          },
          prepend(child: any) {
            children.unshift(child);
          },
          appendChild(child: any) {
            children.push(child);
          },
          removeChild(child: any) {
            const idx = children.indexOf(child);
            if (idx !== -1) children.splice(idx, 1);
          },
          remove() {
            // overwritten per instance
          },
          querySelector(sel: string) {
            if (sel === "svg") {
              return children.find((c) => c.tagName === "SVG") ?? null;
            }
            if (sel === 'input[type="color"]') {
              return children.find((c) => c.tagName === "INPUT" && c.type === "color") ?? null;
            }
            return null;
          },
          querySelectorAll(sel: string) {
            const results: any[] = [];
            const walk = (node: any) => {
              for (const ch of node.children || []) {
                if (sel.includes("label") && ch.tagName === "LABEL") {
                  results.push(ch);
                } else if (sel.includes('input[type="color"]') && ch.tagName === "INPUT" && ch.type === "color") {
                  results.push(ch);
                }
                walk(ch);
              }
            };
            walk(this);
            return results;
          },
          closest(sel: string) {
            if (sel === ".vela-color-field-pop") {
              return (this as any)._parentClass?.includes("vela-color-field-pop") ? this : null;
            }
            return null;
          },
        };
      };

      const mockDoc = {
        createElementNS: (_ns: string, tag: string) => createMockEl(tag),
        createElement: (tag: string) => createMockEl(tag),
      };

      // Mock popover container
      const popover = createMockEl("div");
      popover.className = "vela-color-field-pop";

      // Mock label with initial inline dashed border and styles
      const label = createMockEl("label");
      label.style.border = "1px dashed var(--vela-border-strong)";
      label.style.outline = "1px solid red";
      label.style.boxShadow = "0 1px 2px rgba(0,0,0,0.5)";
      (label as any)._parentClass = "vela-color-field-pop";

      // Text node "+"
      const textPlus = createMockEl("", true, "+");
      textPlus.remove = () => {
        label.removeChild(textPlus);
      };
      label.appendChild(textPlus);

      // Child input[type="color"]
      const colorInput = createMockEl("input");
      colorInput.type = "color";
      colorInput.value = "#3870ff";
      (colorInput as any).closest = (sel: string) => (sel === "label" ? label : null);
      label.appendChild(colorInput);

      popover.appendChild(label);

      // Run enhancer
      enhanceColorPickerPopovers(popover as any, mockDoc as any);

      // 1. Label data attribute
      expect(label.dataset.tvPlus).toBe("1");

      // 2. Inline borders, outline, and boxShadow stripped
      expect(label.style.border).toBe("none");
      expect(label.style.outline).toBe("none");
      expect(label.style.boxShadow).toBe("none");

      // 3. Child nodes: text "+" removed cleanly
      const remainingTextNodes = label.childNodes.filter((c: any) => c.nodeType === 3);
      expect(remainingTextNodes).toHaveLength(0);

      // 4. Crisp 10x10 TradingView SVG prepended
      const svg = label.querySelector("svg");
      expect(svg).toBeDefined();
      expect(svg.getAttribute("width")).toBe("10");
      expect(svg.getAttribute("height")).toBe("10");
      expect(svg.getAttribute("viewBox")).toBe("0 0 10 10");
      expect(svg.innerHTML).toContain('<path d="M5 2v6M2 5h6" />');

      // 5. Child <input type="color"> remains intact!
      const input = label.querySelector('input[type="color"]');
      expect(input).toBe(colorInput);
      expect(input.value).toBe("#3870ff");
      expect(input.type).toBe("color");
    });

    it("verifies globals.css defines borderless, 20x20, font-size 0 rules for .vela-color-field-pop label", () => {
      const css = fs.readFileSync("apps/web/src/app/globals.css", "utf-8");
      expect(css).toContain(".vela-color-field-pop label");
      expect(css).toContain("border: none !important");
      expect(css).toContain("border-style: none !important");
      expect(css).toContain("border-width: 0 !important");
      expect(css).toContain("outline: none !important");
      expect(css).toContain("box-shadow: none !important");
      expect(css).toContain("width: 20px !important");
      expect(css).toContain("height: 20px !important");
      expect(css).toContain("border-radius: 4px !important");
      expect(css).toContain("background: transparent !important");
      expect(css).toContain("font-size: 0 !important");
      expect(css).toContain("line-height: 0 !important");
      expect(css).toContain(".vela-color-field-pop label:hover");
    });
  });
});
