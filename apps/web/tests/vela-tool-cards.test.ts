import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CHART_BUTTON_DESCRIPTIONS,
  resolveButtonCardMeta,
  enhanceVelaSideRail,
  enhanceVelaChromeHover,
} from "../src/components/vela-chrome-enhancer";

class MockStyle {
  private props = new Map<string, string>();
  position = "";
  top = "";
  left = "";
  width = "";
  height = "";
  zIndex = "";
  pointerEvents = "";

  setProperty(name: string, value: string) {
    this.props.set(name, value);
    if (name === "position") this.position = value;
    if (name === "top") this.top = value;
    if (name === "left") this.left = value;
    if (name === "width") this.width = value;
    if (name === "height") this.height = value;
    if (name === "z-index") this.zIndex = value;
  }

  getPropertyValue(name: string): string {
    return this.props.get(name) ?? "";
  }

  removeProperty(name: string) {
    this.props.delete(name);
    if (name === "position") this.position = "";
    if (name === "top") this.top = "";
    if (name === "left") this.left = "";
    if (name === "width") this.width = "";
    if (name === "height") this.height = "";
    if (name === "z-index") this.zIndex = "";
  }
}

class MockElement {
  tagName: string;
  className = "";
  id = "";
  hidden = false;
  innerHTML = "";
  textContent = "";
  style = new MockStyle();
  attributes = new Map<string, string>();
  children: MockElement[] = [];
  parentElement: MockElement | null = null;
  offsetParent: MockElement | null = null;
  offsetWidth = 0;
  offsetHeight = 0;
  clientLeft = 0;
  clientTop = 0;
  scrollLeft = 0;
  scrollTop = 0;
  listeners = new Map<string, Set<Function>>();
  private rectFn: () => { left: number; top: number; width: number; height: number } = () => ({
    left: 0,
    top: 0,
    width: this.offsetWidth || 0,
    height: this.offsetHeight || 0,
  });

  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    if (this.tagName === "DIV") {
      this.offsetWidth = 232;
      this.offsetHeight = 96;
    }
  }

  setRectFn(fn: () => { left: number; top: number; width: number; height: number }) {
    this.rectFn = fn;
  }

  getBoundingClientRect() {
    const r = this.rectFn();
    return {
      x: r.left,
      y: r.top,
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      right: r.left + r.width,
      bottom: r.top + r.height,
      toJSON: () => ({}),
    };
  }

  get classList() {
    return {
      contains: (c: string) => this.className.split(/\s+/).includes(c),
      add: (...cls: string[]) => {
        const s = new Set(this.className.split(/\s+/).filter(Boolean));
        cls.forEach((c) => s.add(c));
        this.className = Array.from(s).join(" ");
      },
      remove: (...cls: string[]) => {
        const s = new Set(this.className.split(/\s+/).filter(Boolean));
        cls.forEach((c) => s.delete(c));
        this.className = Array.from(s).join(" ");
      },
    };
  }

  setAttribute(name: string, val: string) {
    this.attributes.set(name, String(val));
    if (name === "id") this.id = String(val);
    if (name === "class") this.className = String(val);
  }

  getAttribute(name: string): string | null {
    if (name === "id" && this.id) return this.id;
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
  }

  matchesToken(token: string): boolean {
    if (!token) return false;
    if (token === "[title]") return this.hasAttribute("title");
    const attrMatch = token.match(/^\[([a-zA-Z0-9_-]+)="([^"]*)"\]$/);
    if (attrMatch) {
      return this.getAttribute(attrMatch[1]!) === attrMatch[2]!;
    }
    if (token.startsWith(".")) return this.classList.contains(token.slice(1));
    if (token.startsWith("#")) return this.id === token.slice(1);
    return this.tagName === token.toUpperCase();
  }

  matchesSingle(sel: string): boolean {
    const tokens = sel.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return false;
    if (!this.matchesToken(tokens[tokens.length - 1] ?? "")) return false;
    let cur: MockElement | null = this.parentElement;
    for (let i = tokens.length - 2; i >= 0; i--) {
      const tok = tokens[i] ?? "";
      while (cur && !cur.matchesToken(tok)) {
        cur = cur.parentElement;
      }
      if (!cur) return false;
      cur = cur.parentElement;
    }
    return true;
  }

  matches(sel: string): boolean {
    return sel
      .split(",")
      .some((part) => this.matchesSingle(part));
  }

  closest(sel: string): MockElement | null {
    let cur: MockElement | null = this;
    while (cur) {
      if (cur.matches(sel)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  contains(other: MockElement | null): boolean {
    let cur: MockElement | null = other;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  cloneNode(_deep = false): MockElement {
    const clone = new MockElement(this.tagName.toLowerCase());
    clone.className = this.className;
    clone.id = this.id;
    clone.innerHTML = this.innerHTML;
    clone.textContent = this.textContent;
    for (const [k, v] of this.attributes.entries()) {
      clone.attributes.set(k, v);
    }
    return clone;
  }

  appendChild(child: MockElement) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  insertBefore(newChild: MockElement, refChild: MockElement | null) {
    newChild.parentElement = this;
    const idx = refChild ? this.children.indexOf(refChild) : -1;
    if (idx >= 0) {
      this.children.splice(idx, 0, newChild);
    } else {
      this.children.push(newChild);
    }
    return newChild;
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
      this.parentElement = null;
    }
  }

  querySelector(sel: string): MockElement | null {
    return this.querySelectorAll(sel)[0] ?? null;
  }

  querySelectorAll(sel: string): MockElement[] {
    const out: MockElement[] = [];
    const visit = (el: MockElement) => {
      for (const child of el.children) {
        if (child.matches(sel)) {
          out.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return out;
  }

  addEventListener(type: string, fn: Function) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }

  removeEventListener(type: string, fn: Function) {
    this.listeners.get(type)?.delete(fn);
  }

  dispatchEvent(ev: { type: string; [k: string]: any }) {
    const eventWithTarget = { target: this, ...ev };
    const fns = this.listeners.get(ev.type);
    if (fns) {
      for (const fn of Array.from(fns)) fn(eventWithTarget);
    }
  }
}

function createButtonWithSvg(opts: {
  ariaLabel?: string;
  railItem?: string;
  className?: string;
  id?: string;
  title?: string;
  textContent?: string;
  rect?: { left: number; top: number; width: number; height: number };
  withSvg?: boolean;
}): MockElement {
  const btn = new MockElement("button");
  if (opts.className) btn.className = opts.className;
  if (opts.id) btn.id = opts.id;
  if (opts.ariaLabel) btn.setAttribute("aria-label", opts.ariaLabel);
  if (opts.railItem) btn.setAttribute("data-rail-item", opts.railItem);
  if (opts.title) btn.setAttribute("title", opts.title);
  if (opts.textContent) btn.textContent = opts.textContent;
  if (opts.rect) {
    btn.setRectFn(() => opts.rect!);
  }
  if (opts.withSvg !== false) {
    const svg = new MockElement("svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.innerHTML = "<path d='M0 0h16v16H0z'/>";
    btn.appendChild(svg);
  }
  return btn;
}

describe("Universal .quant-tool-card Hover Popups & Right Rail Cleanup", () => {
  let body: MockElement;
  let velaUi: MockElement;
  let sideRail: MockElement;
  let topbar: MockElement;
  let bottombar: MockElement;

  beforeEach(() => {
    body = new MockElement("body");
    velaUi = new MockElement("div");
    velaUi.className = "relative vela-ui quant-chart-chrome";
    velaUi.offsetWidth = 1000;
    velaUi.offsetHeight = 778;
    velaUi.setRectFn(() => ({ left: 40, top: 100, width: 1000, height: 778 }));

    topbar = new MockElement("div");
    topbar.className = "vela-widget-topbar";
    topbar.setRectFn(() => ({ left: 40, top: 100, width: 948, height: 39 }));

    bottombar = new MockElement("div");
    bottombar.className = "vela-widget-bottombar";
    bottombar.setRectFn(() => ({ left: 40, top: 839, width: 948, height: 39 }));

    sideRail = new MockElement("nav");
    sideRail.className = "quant-side-rail";
    sideRail.setRectFn(() => ({ left: 988, top: 100, width: 52, height: 778 }));

    velaUi.appendChild(topbar);
    velaUi.appendChild(bottombar);
    velaUi.appendChild(sideRail);
    body.appendChild(velaUi);

    (globalThis as any).document = {
      body,
      createElement: (tag: string) => new MockElement(tag),
      getElementById: () => null,
      querySelector: (sel: string) => body.querySelector(sel),
    };

    (globalThis as any).window = {
      innerWidth: 1440,
      innerHeight: 900,
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    (globalThis as any).HTMLElement = MockElement;
    (globalThis as any).Element = MockElement;
    (globalThis as any).MutationObserver = class {
      observe() {}
      disconnect() {}
    };
    (globalThis as any).ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    delete (globalThis as any).document;
    delete (globalThis as any).window;
  });

  it("enhanceVelaSideRail: hovering Object tree, Data window, Chart settings, and Screenshot renders .quant-tool-card.quant-side-rail-card with official descriptions and hints", () => {
    const screenshotBtn = createButtonWithSvg({
      ariaLabel: "Screenshot",
      className: "quant-side-rail-corner",
      rect: { left: 998, top: 104, width: 32, height: 32 },
    });
    const objectTreeBtn = createButtonWithSvg({
      ariaLabel: "Object tree",
      railItem: "dock-objects",
      className: "quant-side-rail-row",
      rect: { left: 988, top: 750, width: 52, height: 38 },
    });
    objectTreeBtn.setAttribute("aria-pressed", "false");

    const dataWindowBtn = createButtonWithSvg({
      ariaLabel: "Data window",
      railItem: "dock-dataWindow",
      className: "quant-side-rail-row",
      rect: { left: 988, top: 792, width: 52, height: 38 },
    });
    dataWindowBtn.setAttribute("aria-pressed", "false");

    const settingsBtn = createButtonWithSvg({
      ariaLabel: "Chart settings",
      railItem: "chart-settings",
      className: "quant-side-rail-row",
      rect: { left: 988, top: 839, width: 52, height: 39 },
    });

    sideRail.appendChild(screenshotBtn);
    sideRail.appendChild(objectTreeBtn);
    sideRail.appendChild(dataWindowBtn);
    sideRail.appendChild(settingsBtn);

    const cleanup = enhanceVelaSideRail(sideRail as unknown as HTMLElement);

    // 1. Hover Object tree (closed)
    objectTreeBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    let card = velaUi.querySelector(".quant-tool-card");
    expect(card).not.toBeNull();
    expect(card!.classList.contains("quant-side-rail-card")).toBe(true);
    expect(card!.querySelector(".quant-tool-card-heading")).not.toBeNull();
    expect(card!.querySelector(".quant-tool-card-icon svg")).not.toBeNull();
    expect(card!.querySelector("strong")?.textContent).toBe("Object tree");
    expect(card!.querySelector("p")?.textContent).toBe(
      CHART_BUTTON_DESCRIPTIONS["Object tree"],
    );
    const hintClosed = card!.querySelector(".quant-side-rail-card-hint");
    expect(hintClosed).not.toBeNull();
    expect(hintClosed!.innerHTML).toContain("Click to open it beside the others");

    // 2. Hover Object tree when aria-pressed="true" -> hint updates to "Click to close"
    objectTreeBtn.setAttribute("aria-pressed", "true");
    objectTreeBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    card = velaUi.querySelector(".quant-tool-card");
    const hintOpen = card!.querySelector(".quant-side-rail-card-hint");
    expect(hintOpen).not.toBeNull();
    expect(hintOpen!.textContent).toBe("Click to close");

    // 3. Hover Data window
    dataWindowBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    card = velaUi.querySelector(".quant-tool-card");
    expect(card!.querySelector("strong")?.textContent).toBe("Data window");
    expect(card!.querySelector("p")?.textContent).toBe(
      CHART_BUTTON_DESCRIPTIONS["Data window"],
    );
    expect(card!.querySelector(".quant-side-rail-card-hint")).not.toBeNull();

    // 4. Hover Chart settings (non-dock button -> no hint)
    settingsBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    card = velaUi.querySelector(".quant-tool-card");
    expect(card!.querySelector("strong")?.textContent).toBe("Chart settings");
    expect(card!.querySelector("p")?.textContent).toBe(
      CHART_BUTTON_DESCRIPTIONS["Chart settings"],
    );
    expect(card!.querySelector(".quant-side-rail-card-hint")).toBeNull();

    // 5. Hover Screenshot (non-dock button -> no hint)
    screenshotBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    card = velaUi.querySelector(".quant-tool-card");
    expect(card!.querySelector("strong")?.textContent).toBe("Screenshot");
    expect(card!.querySelector("p")?.textContent).toBe(
      CHART_BUTTON_DESCRIPTIONS["Screenshot"],
    );
    expect(card!.querySelector(".quant-side-rail-card-hint")).toBeNull();

    cleanup();
  });

  it("positions Right Rail hover card to the left of the rail (left = btnRect.left - rootRect.left - cardWidth - 12)", () => {
    const objectTreeBtn = createButtonWithSvg({
      ariaLabel: "Object tree",
      railItem: "dock-objects",
      className: "quant-side-rail-row",
      rect: { left: 988, top: 750, width: 52, height: 38 },
    });
    sideRail.appendChild(objectTreeBtn);

    const cleanup = enhanceVelaSideRail(sideRail as unknown as HTMLElement);
    objectTreeBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });

    const card = velaUi.querySelector(".quant-tool-card");
    expect(card).not.toBeNull();

    // btnRect.left = 988, rootRect.left = 40, cardWidth = 232 -> 988 - 40 - 232 - 12 = 704px
    expect(card!.style.left).toBe("704px");

    cleanup();
  });

  it("strips native title attributes from buttons so browser native tooltips never appear", () => {
    const screenshotBtn = createButtonWithSvg({
      ariaLabel: "Screenshot",
      title: "Screenshot",
      rect: { left: 998, top: 104, width: 32, height: 32 },
    });
    const tfBtn = createButtonWithSvg({
      ariaLabel: "Timeframe",
      title: "Timeframe",
      className: "vela-widget-tf",
      rect: { left: 140, top: 104, width: 36, height: 30 },
    });

    sideRail.appendChild(screenshotBtn);
    topbar.appendChild(tfBtn);

    const cleanupRail = enhanceVelaSideRail(sideRail as unknown as HTMLElement);
    const cleanupTopbar = enhanceVelaChromeHover(topbar as unknown as HTMLElement);

    expect(screenshotBtn.hasAttribute("title")).toBe(false);
    expect(screenshotBtn.getAttribute("data-vela-title")).toBe("Screenshot");
    expect(tfBtn.hasAttribute("title")).toBe(false);
    expect(tfBtn.getAttribute("data-vela-title")).toBe("Timeframe");

    cleanupRail();
    cleanupTopbar();
  });

  it("enhanceVelaChromeHover: hovering Topbar/Bottombar control buttons (Chart style, Indicators, Undo, Redo, Time zone, Chart settings) renders .quant-tool-card.quant-chart-card with official descriptions", () => {
    const styleBtn = createButtonWithSvg({
      ariaLabel: "Chart style",
      className: "vela-widget-style",
      id: "vela-topbar-style",
      rect: { left: 200, top: 104, width: 32, height: 30 },
    });
    const indicatorsBtn = createButtonWithSvg({
      ariaLabel: "Indicators",
      className: "vela-widget-indicators",
      rect: { left: 240, top: 104, width: 88, height: 30 },
    });
    const undoBtn = createButtonWithSvg({
      ariaLabel: "Undo",
      className: "vela-widget-undo",
      rect: { left: 332, top: 104, width: 28, height: 30 },
    });
    const redoBtn = createButtonWithSvg({
      ariaLabel: "Redo",
      className: "vela-widget-redo",
      rect: { left: 364, top: 104, width: 28, height: 30 },
    });
    const tzBtn = createButtonWithSvg({
      ariaLabel: "Time zone",
      className: "vela-bb-tz",
      id: "vela-bb-tz",
      textContent: "UTC",
      withSvg: false,
      rect: { left: 910, top: 844, width: 78, height: 30 },
    });
    const settingsBtn = createButtonWithSvg({
      ariaLabel: "Chart settings",
      className: "vela-bb-settings",
      id: "vela-bb-settings",
      rect: { left: 870, top: 844, width: 32, height: 30 },
    });

    topbar.appendChild(styleBtn);
    topbar.appendChild(indicatorsBtn);
    topbar.appendChild(undoBtn);
    topbar.appendChild(redoBtn);
    bottombar.appendChild(settingsBtn);
    bottombar.appendChild(tzBtn);

    const cleanupTop = enhanceVelaChromeHover(topbar as unknown as HTMLElement);
    const cleanupBottom = enhanceVelaChromeHover(bottombar as unknown as HTMLElement);

    // 1. Chart style
    styleBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    let card = velaUi.querySelector(".quant-tool-card");
    expect(card).not.toBeNull();
    expect(card!.classList.contains("quant-chart-card")).toBe(true);
    expect(card!.querySelector("strong")?.textContent).toBe("Chart style");
    expect(card!.querySelector("p")?.textContent).toBe(
      CHART_BUTTON_DESCRIPTIONS["Chart style"],
    );

    // 2. Indicators
    indicatorsBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    card = velaUi.querySelector(".quant-tool-card");
    expect(card!.querySelector("strong")?.textContent).toBe("Indicators");
    expect(card!.querySelector("p")?.textContent).toBe(
      CHART_BUTTON_DESCRIPTIONS["Indicators"],
    );

    // 3. Undo
    undoBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    card = velaUi.querySelector(".quant-tool-card");
    expect(card!.querySelector("strong")?.textContent).toBe("Undo");
    expect(card!.querySelector("p")?.textContent).toBe(
      CHART_BUTTON_DESCRIPTIONS["Undo"],
    );

    // 4. Redo
    redoBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    card = velaUi.querySelector(".quant-tool-card");
    expect(card!.querySelector("strong")?.textContent).toBe("Redo");
    expect(card!.querySelector("p")?.textContent).toBe(
      CHART_BUTTON_DESCRIPTIONS["Redo"],
    );

    // 5. Chart settings (bottombar)
    settingsBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    card = velaUi.querySelector(".quant-tool-card");
    expect(card!.querySelector("strong")?.textContent).toBe("Chart settings");
    expect(card!.querySelector("p")?.textContent).toBe(
      CHART_BUTTON_DESCRIPTIONS["Chart settings"],
    );

    // 6. Time zone (text-only button in bottombar)
    tzBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    card = velaUi.querySelector(".quant-tool-card");
    expect(card!.classList.contains("quant-chart-card")).toBe(true);
    expect(card!.querySelector("strong")?.textContent).toBe("Time zone");
    expect(card!.querySelector("p")?.textContent).toBe(
      CHART_BUTTON_DESCRIPTIONS["Time zone"],
    );
    expect(card!.querySelector(".quant-tool-card-icon span")?.textContent).toBe("UTC");

    cleanupTop();
    cleanupBottom();
  });

  it("suppresses hover cards when data-quant-open='1', aria-expanded='true', or .vela-screenshot-floating-menu is open, and dismisses immediately on pointerdown or pointerleave", () => {
    const styleBtn = createButtonWithSvg({
      ariaLabel: "Chart style",
      className: "vela-widget-style",
      rect: { left: 200, top: 104, width: 32, height: 30 },
    });
    const screenshotBtn = createButtonWithSvg({
      ariaLabel: "Screenshot",
      className: "quant-side-rail-corner",
      rect: { left: 998, top: 104, width: 32, height: 32 },
    });

    topbar.appendChild(styleBtn);
    sideRail.appendChild(screenshotBtn);

    const cleanupTop = enhanceVelaChromeHover(topbar as unknown as HTMLElement);
    const cleanupRail = enhanceVelaSideRail(sideRail as unknown as HTMLElement);

    // Normal hover shows card
    styleBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    expect(velaUi.querySelector(".quant-tool-card")).not.toBeNull();

    // Dismisses immediately on pointerdown
    styleBtn.dispatchEvent({ type: "pointerdown" });
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();

    // Hover again, then dismiss immediately on pointerleave
    styleBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    expect(velaUi.querySelector(".quant-tool-card")).not.toBeNull();
    styleBtn.dispatchEvent({ type: "pointerleave" });
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();

    // Suppressed when data-quant-open="1"
    styleBtn.setAttribute("data-quant-open", "1");
    styleBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();
    styleBtn.removeAttribute("data-quant-open");

    // Suppressed when aria-expanded="true"
    screenshotBtn.setAttribute("aria-expanded", "true");
    screenshotBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();
    screenshotBtn.setAttribute("aria-expanded", "false");

    // Suppressed when .vela-screenshot-floating-menu is open inside .vela-ui
    const floatingMenu = new MockElement("div");
    floatingMenu.className = "vela-screenshot-floating-menu";
    velaUi.appendChild(floatingMenu);

    screenshotBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();

    floatingMenu.remove();
    screenshotBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    expect(velaUi.querySelector(".quant-tool-card")).not.toBeNull();

    // Suppressed when a dialog ([role="dialog"] or .vela-dialog) is open
    const dialog = new MockElement("div");
    dialog.setAttribute("role", "dialog");
    velaUi.appendChild(dialog);
    screenshotBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();
    dialog.remove();

    cleanupTop();
    cleanupRail();
  });

  it("enhanceVelaChromeHover: hovering self-labeled buttons (.vela-widget-symbol 'MES', .vela-widget-tf '1m'/'5m'/'30m', #vela-topbar-tf, .vela-widget-tf-caret, .vela-bb-range '1D'/'ALL') updates sliding hover pill AND suppresses .quant-tool-card", () => {
    const symbolBtn = createButtonWithSvg({
      className: "vela-widget-symbol",
      textContent: "MES",
      withSvg: false,
      rect: { left: 45, top: 104, width: 60, height: 30 },
    });
    const tf1m = createButtonWithSvg({
      className: "vela-widget-tf",
      textContent: "1m",
      withSvg: false,
      rect: { left: 110, top: 104, width: 30, height: 30 },
    });
    const tf5m = createButtonWithSvg({
      className: "vela-widget-tf",
      textContent: "5m",
      withSvg: false,
      rect: { left: 145, top: 104, width: 30, height: 30 },
    });
    const tf30m = createButtonWithSvg({
      className: "vela-widget-tf",
      textContent: "30m",
      withSvg: false,
      rect: { left: 180, top: 104, width: 36, height: 30 },
    });
    const tfCaret = createButtonWithSvg({
      className: "vela-widget-tf-caret",
      rect: { left: 220, top: 104, width: 20, height: 30 },
    });
    const topbarTf = createButtonWithSvg({
      id: "vela-topbar-tf",
      rect: { left: 245, top: 104, width: 30, height: 30 },
    });
    const range1D = createButtonWithSvg({
      className: "vela-bb-range",
      textContent: "1D",
      withSvg: false,
      rect: { left: 50, top: 844, width: 32, height: 28 },
    });
    const rangeAll = createButtonWithSvg({
      className: "vela-bb-range",
      textContent: "ALL",
      withSvg: false,
      rect: { left: 90, top: 844, width: 38, height: 28 },
    });

    topbar.appendChild(symbolBtn);
    topbar.appendChild(tf1m);
    topbar.appendChild(tf5m);
    topbar.appendChild(tf30m);
    topbar.appendChild(tfCaret);
    topbar.appendChild(topbarTf);
    bottombar.appendChild(range1D);
    bottombar.appendChild(rangeAll);

    const cleanupTop = enhanceVelaChromeHover(topbar as unknown as HTMLElement);
    const cleanupBottom = enhanceVelaChromeHover(bottombar as unknown as HTMLElement);

    // 1. Symbol button (MES): updates hover pill, NO tool card
    symbolBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    expect(topbar.hasAttribute("data-chrome-visible")).toBe(true);
    expect(topbar.style.getPropertyValue("--chrome-w")).toBe("60px");
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();
    expect((globalThis as any).document.querySelector(".quant-tool-card")).toBeNull();

    // 2. Timeframe chip (1m): updates hover pill, NO tool card
    tf1m.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    expect(topbar.hasAttribute("data-chrome-visible")).toBe(true);
    expect(topbar.hasAttribute("data-chrome-moving")).toBe(true);
    expect(topbar.style.getPropertyValue("--chrome-w")).toBe("30px");
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();
    expect((globalThis as any).document.querySelector(".quant-tool-card")).toBeNull();

    // 3. Timeframe chip (5m): updates hover pill, NO tool card
    tf5m.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    expect(topbar.hasAttribute("data-chrome-visible")).toBe(true);
    expect(topbar.style.getPropertyValue("--chrome-w")).toBe("30px");
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();
    expect((globalThis as any).document.querySelector(".quant-tool-card")).toBeNull();

    // 4. Timeframe chip (30m): updates hover pill, NO tool card
    tf30m.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    expect(topbar.hasAttribute("data-chrome-visible")).toBe(true);
    expect(topbar.style.getPropertyValue("--chrome-w")).toBe("36px");
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();
    expect((globalThis as any).document.querySelector(".quant-tool-card")).toBeNull();

    // 5. Timeframe caret: updates hover pill, NO tool card
    tfCaret.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    expect(topbar.hasAttribute("data-chrome-visible")).toBe(true);
    expect(topbar.style.getPropertyValue("--chrome-w")).toBe("20px");
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();
    expect((globalThis as any).document.querySelector(".quant-tool-card")).toBeNull();

    // 6. #vela-topbar-tf: updates hover pill, NO tool card
    topbarTf.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    expect(topbar.hasAttribute("data-chrome-visible")).toBe(true);
    expect(topbar.style.getPropertyValue("--chrome-w")).toBe("30px");
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();
    expect((globalThis as any).document.querySelector(".quant-tool-card")).toBeNull();

    // 7. Range button (1D): updates hover pill, NO tool card
    range1D.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    expect(bottombar.hasAttribute("data-chrome-visible")).toBe(true);
    expect(bottombar.style.getPropertyValue("--chrome-w")).toBe("32px");
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();
    expect((globalThis as any).document.querySelector(".quant-tool-card")).toBeNull();

    // 8. Range button (ALL): updates hover pill, NO tool card
    rangeAll.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    expect(bottombar.hasAttribute("data-chrome-visible")).toBe(true);
    expect(bottombar.style.getPropertyValue("--chrome-w")).toBe("38px");
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();
    expect((globalThis as any).document.querySelector(".quant-tool-card")).toBeNull();

    cleanupTop();
    cleanupBottom();
  });

  it("does not recreate .quant-tool-card on pointermove within the same button, and does not re-open on pointermove after click until leaving and re-entering", () => {
    const objectTreeBtn = createButtonWithSvg({
      ariaLabel: "Object tree",
      railItem: "dock-objects",
      className: "quant-side-rail-row",
      rect: { left: 988, top: 750, width: 52, height: 38 },
    });
    const styleBtn = createButtonWithSvg({
      ariaLabel: "Chart style",
      className: "vela-widget-style",
      rect: { left: 200, top: 104, width: 32, height: 30 },
    });

    sideRail.appendChild(objectTreeBtn);
    topbar.appendChild(styleBtn);

    const cleanupRail = enhanceVelaSideRail(sideRail as unknown as HTMLElement);
    const cleanupTop = enhanceVelaChromeHover(topbar as unknown as HTMLElement);

    // 1. Side rail button: pointermove inside same button preserves identical DOM node reference
    objectTreeBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    const railCard1 = velaUi.querySelector(".quant-tool-card");
    expect(railCard1).not.toBeNull();

    sideRail.dispatchEvent({
      type: "pointermove",
      pointerType: "mouse",
      target: objectTreeBtn,
    });
    const railCard2 = velaUi.querySelector(".quant-tool-card");
    expect(railCard2).toBe(railCard1);

    // Clicking button dismisses card, and subsequent pointermove on same button does NOT re-open it
    objectTreeBtn.dispatchEvent({ type: "pointerdown" });
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();

    sideRail.dispatchEvent({
      type: "pointermove",
      pointerType: "mouse",
      target: objectTreeBtn,
    });
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();

    // Leaving and re-entering re-opens the card
    objectTreeBtn.dispatchEvent({ type: "pointerleave" });
    objectTreeBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    expect(velaUi.querySelector(".quant-tool-card")).not.toBeNull();
    objectTreeBtn.dispatchEvent({ type: "pointerleave" });

    // 2. Topbar button: pointermove inside same button preserves identical DOM node reference
    styleBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    const topCard1 = velaUi.querySelector(".quant-tool-card");
    expect(topCard1).not.toBeNull();

    topbar.dispatchEvent({
      type: "pointermove",
      pointerType: "mouse",
      target: styleBtn,
    });
    const topCard2 = velaUi.querySelector(".quant-tool-card");
    expect(topCard2).toBe(topCard1);

    // Clicking button dismisses card, and subsequent pointermove on same button does NOT re-open it
    styleBtn.dispatchEvent({ type: "pointerdown" });
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();

    topbar.dispatchEvent({
      type: "pointermove",
      pointerType: "mouse",
      target: styleBtn,
    });
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();

    // Leaving and re-entering re-opens the card
    styleBtn.dispatchEvent({ type: "pointerleave" });
    styleBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    expect(velaUi.querySelector(".quant-tool-card")).not.toBeNull();

    cleanupRail();
    cleanupTop();
  });

  it("removes all per-button listeners and bound attributes when cleanup functions of enhanceVelaSideRail and enhanceVelaChromeHover run", () => {
    const objectTreeBtn = createButtonWithSvg({
      ariaLabel: "Object tree",
      railItem: "dock-objects",
      className: "quant-side-rail-row",
      rect: { left: 988, top: 750, width: 52, height: 38 },
    });
    const styleBtn = createButtonWithSvg({
      ariaLabel: "Chart style",
      className: "vela-widget-style",
      rect: { left: 200, top: 104, width: 32, height: 30 },
    });

    sideRail.appendChild(objectTreeBtn);
    topbar.appendChild(styleBtn);

    const cleanupRail = enhanceVelaSideRail(sideRail as unknown as HTMLElement);
    const cleanupTop = enhanceVelaChromeHover(topbar as unknown as HTMLElement);

    expect(objectTreeBtn.listeners.get("pointerenter")?.size).toBe(1);
    expect(styleBtn.listeners.get("pointerenter")?.size).toBe(1);

    cleanupRail();
    cleanupTop();

    expect(objectTreeBtn.listeners.get("pointerenter")?.size ?? 0).toBe(0);
    expect(objectTreeBtn.listeners.get("pointerleave")?.size ?? 0).toBe(0);
    expect(objectTreeBtn.listeners.get("pointerdown")?.size ?? 0).toBe(0);
    expect(objectTreeBtn.hasAttribute("data-vela-rail-card-bound")).toBe(false);

    expect(styleBtn.listeners.get("pointerenter")?.size ?? 0).toBe(0);
    expect(styleBtn.listeners.get("pointerleave")?.size ?? 0).toBe(0);
    expect(styleBtn.listeners.get("pointerdown")?.size ?? 0).toBe(0);
    expect(styleBtn.hasAttribute("data-vela-chart-card-bound")).toBe(false);

    // Hovering after cleanup does not spawn any card
    objectTreeBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    styleBtn.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
    expect(velaUi.querySelector(".quant-tool-card")).toBeNull();
  });
});
