import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  enhanceVelaBottombarJoin,
  computeBottombarJoinGeometry,
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
  clipPath = "";
  borderRadius = "";
  transform = "";

  setProperty(name: string, value: string) {
    this.props.set(name, value);
    if (name === "position") this.position = value;
    if (name === "top") this.top = value;
    if (name === "left") this.left = value;
    if (name === "width") this.width = value;
    if (name === "height") this.height = value;
    if (name === "z-index") this.zIndex = value;
    if (name === "transform") this.transform = value;
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
    if (name === "transform") this.transform = "";
  }
}

class MockElement {
  tagName: string;
  className = "";
  id = "";
  hidden = false;
  innerHTML = "";
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
    width: 0,
    height: 0,
  });

  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
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

  matches(sel: string): boolean {
    if (sel.startsWith(".")) return this.classList.contains(sel.slice(1));
    if (sel.startsWith("#")) return this.id === sel.slice(1);
    return false;
  }

  closest(sel: string): MockElement | null {
    let cur: MockElement | null = this;
    while (cur) {
      if (cur.matches(sel)) return cur;
      cur = cur.parentElement;
    }
    return null;
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
    if (sel === ":scope > .quant-chrome-join") {
      return this.children.find((c) => c.classList.contains("quant-chrome-join")) ?? null;
    }
    return this.querySelectorAll(sel)[0] ?? null;
  }

  querySelectorAll(sel: string): MockElement[] {
    const out: MockElement[] = [];
    const visit = (el: MockElement) => {
      for (const child of el.children) {
        if (sel.startsWith(".") && child.classList.contains(sel.slice(1))) {
          out.push(child);
        } else if (
          sel === '.vela-menu[aria-labelledby="vela-bb-tz"]' &&
          child.classList.contains("vela-menu") &&
          child.getAttribute("aria-labelledby") === "vela-bb-tz"
        ) {
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

  dispatchEvent(ev: { type: string }) {
    const fns = this.listeners.get(ev.type);
    if (fns) {
      for (const fn of Array.from(fns)) fn(ev);
    }
  }

  click() {
    this.dispatchEvent({ type: "click" });
  }
}

describe("Vela Bottombar UTC Popup Scroll Lock & Bézier Join", () => {
  let velaUi: MockElement;
  let bottombarHost: MockElement;
  let bottombar: MockElement;
  let tzBtn: MockElement;
  let layer: MockElement;
  let menu: MockElement;
  let scrollY = 0;
  let winListeners: Map<string, Set<Function>>;

  beforeEach(() => {
    scrollY = 0;
    winListeners = new Map();

    const body = new MockElement("body");
    velaUi = new MockElement("div");
    velaUi.className = "relative vela-ui quant-chart-chrome";

    bottombarHost = new MockElement("div");
    bottombar = new MockElement("div");
    bottombar.className = "vela-widget-bottombar";

    tzBtn = new MockElement("button");
    tzBtn.className = "vela-bb-tz";
    tzBtn.id = "vela-bb-tz";
    tzBtn.setAttribute("aria-label", "Time zone");
    tzBtn.setAttribute("aria-controls", "menu:vela-tz:content");
    tzBtn.setAttribute("aria-expanded", "false");
    tzBtn.setAttribute("data-state", "closed");

    bottombar.appendChild(tzBtn);
    bottombarHost.appendChild(bottombar);
    velaUi.appendChild(bottombarHost);

    layer = new MockElement("div");
    layer.className = "vela-ui-layer";
    layer.setAttribute("data-scope", "menu");
    layer.setAttribute("data-part", "positioner");
    layer.offsetParent = velaUi;

    menu = new MockElement("ul");
    menu.className = "vela-menu";
    menu.id = "menu:vela-tz:content";
    menu.setAttribute("aria-labelledby", "vela-bb-tz");
    menu.setAttribute("data-state", "closed");
    menu.hidden = true;
    menu.offsetWidth = 250;
    menu.offsetHeight = 543;
    menu.offsetParent = layer;

    layer.appendChild(menu);
    velaUi.appendChild(layer);
    body.appendChild(velaUi);

    // Base layout coordinates (at scrollY = 0):
    // velaUi: top 100, left 40, width 1000, height 778
    // bottombar: top 839 (739 inside velaUi), left 40, width 956, height 39
    // tzBtn: top 844, left 910, width 78 (right = 988 -> 948 inside velaUi), height 30
    velaUi.setRectFn(() => ({ left: 40, top: 100 - scrollY, width: 1000, height: 778 }));
    bottombar.setRectFn(() => ({ left: 40, top: 839 - scrollY, width: 956, height: 39 }));
    tzBtn.setRectFn(() => ({ left: 910, top: 844 - scrollY, width: 78, height: 30 }));
    menu.setRectFn(() => {
      // Simulate @zag-js/popper bug when layer is not locked: if transform is not "none",
      // @zag-js/popper keeps menu at pinnedAnchor (viewport top = 289) instead of scrolling with velaUi!
      const isLocked = layer.style.transform === "none";
      const layerTop = parseFloat(layer.style.top) || 189;
      const layerLeft = parseFloat(layer.style.left) || 698;
      return {
        left: 40 + layerLeft,
        top: isLocked ? 100 - scrollY + layerTop : 289,
        width: 250,
        height: 543,
      };
    });

    (globalThis as any).document = {
      body,
      createElement: (tag: string) => new MockElement(tag),
      getElementById: (id: string) => (id === menu.id ? menu : id === tzBtn.id ? tzBtn : null),
      querySelector: (sel: string) => body.querySelector(sel),
    };

    (globalThis as any).window = {
      innerWidth: 1440,
      innerHeight: 900,
      addEventListener: (type: string, fn: Function) => {
        if (!winListeners.has(type)) winListeners.set(type, new Set());
        winListeners.get(type)!.add(fn);
      },
      removeEventListener: (type: string, fn: Function) => {
        winListeners.get(type)?.delete(fn);
      },
      dispatchEvent: (ev: { type: string }) => {
        const fns = winListeners.get(ev.type);
        if (fns) {
          for (const fn of Array.from(fns)) fn(ev);
        }
      },
    };

    (globalThis as any).HTMLElement = MockElement;
    (globalThis as any).Element = MockElement;
    (globalThis as any).requestAnimationFrame = (cb: Function) => {
      cb();
      return 1;
    };
    (globalThis as any).cancelAnimationFrame = () => {};
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

  it("docks the UTC menu and Bézier join flush (1px overlap) to the bottombar inside .vela-ui", () => {
    const cleanup = enhanceVelaBottombarJoin(bottombarHost as unknown as HTMLElement);

    menu.hidden = false;
    menu.setAttribute("data-state", "open");
    tzBtn.setAttribute("aria-expanded", "true");
    tzBtn.setAttribute("data-state", "open");
    tzBtn.click();

    const join = layer.querySelector(".quant-chrome-join");
    expect(join).not.toBeNull();
    expect(menu.getAttribute("data-chrome-joined")).toBe("above");
    expect(layer.getAttribute("data-chrome-joined-layer")).toBe("above");

    // barTopRel = 839 - 100 = 739. With 1px overlap and height = 543:
    // layerTop = 739 + 1 - 543 = 197px.
    expect(layer.style.top).toBe("197px");
    // tzRightRel = 988 - 40 = 948. menuW = 250 -> layerLeft = 948 - 250 = 698px.
    expect(layer.style.left).toBe("698px");
    expect(layer.style.transform).toBe("none");

    const { z, M, P } = computeBottombarJoinGeometry(250, 543);
    expect(join!.style.left).toBe(`${-z}px`);
    expect(join!.style.top).toBe("0px");
    expect(join!.style.width).toBe(`${M}px`);
    expect(join!.style.height).toBe(`${P}px`);

    cleanup();
  });

  it("keeps the UTC popup and Bézier join 100% glued (colado) to bottombar during page scroll, even past 48px or offscreen", () => {
    const cleanup = enhanceVelaBottombarJoin(bottombarHost as unknown as HTMLElement);

    menu.hidden = false;
    menu.setAttribute("data-state", "open");
    tzBtn.setAttribute("aria-expanded", "true");
    tzBtn.setAttribute("data-state", "open");
    tzBtn.click();

    expect(layer.querySelector(".quant-chrome-join")).not.toBeNull();
    expect(layer.style.top).toBe("197px");
    expect(layer.style.left).toBe("698px");

    // Simulate scrolling page down by 300px (> 48px threshold that previously tore down join)
    scrollY = 300;
    layer.style.setProperty("--y", "497px");
    (globalThis as any).window.dispatchEvent({ type: "scroll" });

    const joinAfter300 = layer.querySelector(".quant-chrome-join");
    expect(joinAfter300).not.toBeNull();
    expect(menu.getAttribute("data-chrome-joined")).toBe("above");
    expect(layer.style.top).toBe("197px");
    expect(layer.style.left).toBe("698px");
    expect(layer.style.transform).toBe("none");

    // Simulate scrolling page down by 950px so bottombar goes above viewport (barRect.bottom < 0)
    scrollY = 950;
    layer.style.setProperty("--y", "1147px");
    (globalThis as any).window.dispatchEvent({ type: "scroll" });

    const joinOffscreen = layer.querySelector(".quant-chrome-join");
    expect(joinOffscreen).not.toBeNull();
    expect(menu.getAttribute("data-chrome-joined")).toBe("above");
    expect(layer.style.top).toBe("197px");
    expect(layer.style.left).toBe("698px");
    expect(layer.style.transform).toBe("none");

    cleanup();
  });

  it("cleans up join and layer attributes when the UTC menu closes", () => {
    const cleanup = enhanceVelaBottombarJoin(bottombarHost as unknown as HTMLElement);

    menu.hidden = false;
    menu.setAttribute("data-state", "open");
    tzBtn.setAttribute("aria-expanded", "true");
    tzBtn.setAttribute("data-state", "open");
    tzBtn.click();

    expect(layer.querySelector(".quant-chrome-join")).not.toBeNull();
    expect(layer.getAttribute("data-chrome-joined-layer")).toBe("above");

    // Close menu
    menu.hidden = true;
    menu.setAttribute("data-state", "closed");
    tzBtn.setAttribute("aria-expanded", "false");
    tzBtn.setAttribute("data-state", "closed");
    tzBtn.click();

    expect(layer.querySelector(".quant-chrome-join")).toBeNull();
    expect(menu.getAttribute("data-chrome-joined")).toBeNull();
    expect(layer.getAttribute("data-chrome-joined-layer")).toBeNull();

    cleanup();
  });
});
