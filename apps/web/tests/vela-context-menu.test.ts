import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SLIDERS_ICON_SVG,
  COPY_PRICE_ICON_SVG,
  VELA_CONTEXT_MENU_CSS,
  formatCopyPrice,
  showVelaToast,
  registerCopyPriceAction,
  enhanceVelaContextMenu,
  _resetCopyPriceActionForTesting,
} from "../src/components/vela-context-menu";
import { widgetActions } from "@luxalgo/vela/widget";
import { iconMarkup } from "@luxalgo/vela/ui";

// Lightweight DOM mock for Vitest Node environment
class MockElement {
  tagName: string;
  className = "";
  dataset: Record<string, string> = {};
  children: MockElement[] = [];
  parentElement: MockElement | null = null;
  textContent = "";
  innerHTML = "";
  attributes = new Map<string, string>();
  listeners = new Map<string, Array<Function>>();

  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
  }

  setAttribute(name: string, val: string) {
    this.attributes.set(name, String(val));
    if (name.startsWith("data-")) {
      const camel = name
        .slice(5)
        .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[camel] = String(val);
    }
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string) {
    return this.attributes.has(name);
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
    if (name.startsWith("data-")) {
      const camel = name
        .slice(5)
        .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      delete this.dataset[camel];
    }
  }

  appendChild(child: MockElement) {
    child.parentElement = this;
    this.children.push(child);
    MockMutationObserver.notifyAll([child]);
    return child;
  }

  append(...children: MockElement[]) {
    for (const c of children) {
      this.appendChild(c);
    }
  }

  insertBefore(newChild: MockElement, refChild: MockElement | null) {
    newChild.parentElement = this;
    const idx = refChild ? this.children.indexOf(refChild) : -1;
    if (idx >= 0) {
      this.children.splice(idx, 0, newChild);
    } else {
      this.children.push(newChild);
    }
    MockMutationObserver.notifyAll([newChild]);
    return newChild;
  }

  replaceChildren(...newChildren: MockElement[]) {
    this.children = [];
    this.textContent = "";
    this.innerHTML = "";
    for (const c of newChildren) {
      this.appendChild(c);
    }
  }

  querySelector<T = MockElement>(sel: string): T | null {
    return (this.querySelectorAll<T>(sel)[0] ?? null) as T | null;
  }

  querySelectorAll<T = MockElement>(sel: string): T[] {
    const results: MockElement[] = [];
    const testMatch = (el: MockElement) => {
      const classes = el.className.split(" ").filter(Boolean);
      const veiId = el.dataset.veiId ?? el.attributes.get("data-vei-id");

      if (sel.includes(".vela-toast") && classes.includes("vela-toast")) return true;
      if (sel.includes(".vela-icon") && classes.includes("vela-icon")) return true;
      if (sel.includes(".vela-menu-label") && classes.includes("vela-menu-label")) return true;
      if (sel.includes(".vela-menu-item") && classes.includes("vela-menu-item")) {
        if (sel.includes('data-vei-id^="settings"') || sel.includes('data-vei-id="settings"')) {
          return Boolean(veiId && (veiId.startsWith("settings") || veiId === "settings"));
        }
        if (sel.includes('data-vei-id="action:copy-price"')) {
          return veiId === "action:copy-price";
        }
        return true;
      }
      return false;
    };

    const walk = (el: MockElement) => {
      for (const child of el.children) {
        if (testMatch(child)) results.push(child);
        walk(child);
      }
    };
    walk(this);
    return results as unknown as T[];
  }

  addEventListener(type: string, cb: Function) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(cb);
  }

  removeEventListener(type: string, cb: Function) {
    const arr = this.listeners.get(type);
    if (!arr) return;
    const idx = arr.indexOf(cb);
    if (idx >= 0) arr.splice(idx, 1);
  }

  dispatchEvent(e: any) {
    const arr = this.listeners.get(e?.type ?? "");
    arr?.forEach((cb) => cb(e));
  }

  click() {
    this.dispatchEvent({ type: "click" });
  }
}

class MockMutationObserver {
  cb: (mutations: Array<{ addedNodes: any[] }>) => void;
  static activeObservers: MockMutationObserver[] = [];

  constructor(cb: any) {
    this.cb = cb;
    MockMutationObserver.activeObservers.push(this);
  }

  observe(_target: any, _opts: any) {}

  disconnect() {
    const idx = MockMutationObserver.activeObservers.indexOf(this);
    if (idx >= 0) MockMutationObserver.activeObservers.splice(idx, 1);
  }

  static notifyAll(nodes: any[]) {
    for (const obs of this.activeObservers) {
      obs.cb([{ addedNodes: nodes }]);
    }
  }
}

// Attach mocks to globalThis before tests
const origDocument = globalThis.document;
const origMutationObserver = globalThis.MutationObserver;
const origElement = globalThis.Element;
const origHTMLElement = globalThis.HTMLElement;

globalThis.document = {
  createElement: (tag: string) => new MockElement(tag),
  body: new MockElement("body"),
} as any;
globalThis.Element = MockElement as any;
globalThis.HTMLElement = MockElement as any;
globalThis.MutationObserver = MockMutationObserver as any;

describe("Vela Context Menu & Copy Price (ADR-004)", () => {
  beforeEach(() => {
    _resetCopyPriceActionForTesting();
    vi.useFakeTimers();
    (globalThis.document.body as any).replaceChildren();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    (globalThis.document.body as any).replaceChildren();
  });

  describe("Canonical SVG Icons", () => {
    it("provides the canonical Sliders icon SVG matching the right rail settings button and print_20261010_100809.png", () => {
      expect(SLIDERS_ICON_SVG).toContain('viewBox="0 0 20 20"');
      expect(SLIDERS_ICON_SVG).toContain('d="M5 3v14m5-14v14m5-14v14M3 7h4m1 6h4m1-8h4"');
      expect(SLIDERS_ICON_SVG).toContain('stroke-width="1.25"');
      expect(SLIDERS_ICON_SVG).not.toContain("circle");
      expect(SLIDERS_ICON_SVG).not.toContain("gear");
    });

    it("provides the canonical Copy price double-rect icon SVG", () => {
      expect(COPY_PRICE_ICON_SVG).toContain('viewBox="0 0 16 16"');
      expect(COPY_PRICE_ICON_SVG).toContain('<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"');
      expect(COPY_PRICE_ICON_SVG).toContain('d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"');
    });

    it("registers icons in Vela's icon registry", () => {
      registerCopyPriceAction();
      expect(iconMarkup("copy")).toBe(COPY_PRICE_ICON_SVG);
      expect(iconMarkup("copy-price")).toBe(COPY_PRICE_ICON_SVG);
      expect(iconMarkup("sliders")).toBe(SLIDERS_ICON_SVG);
    });
  });

  describe("formatCopyPrice", () => {
    it("formats standard prices with default 2 decimals", () => {
      expect(formatCopyPrice(1234.5)).toBe("1234.50");
      expect(formatCopyPrice(82896.02)).toBe("82896.02");
      expect(formatCopyPrice(100)).toBe("100.00");
    });

    it("formats crypto / forex prices with custom decimals", () => {
      expect(formatCopyPrice(1.08456, 4)).toBe("1.0846");
      expect(formatCopyPrice(0.00001234, 8)).toBe("0.00001234");
      expect(formatCopyPrice(500, 0)).toBe("500");
    });

    it("returns an empty string for invalid or nullish inputs", () => {
      expect(formatCopyPrice(null)).toBe("");
      expect(formatCopyPrice(undefined)).toBe("");
      expect(formatCopyPrice(Number.NaN)).toBe("");
      expect(formatCopyPrice(Infinity)).toBe("");
      expect(formatCopyPrice(-Infinity)).toBe("");
    });
  });

  describe("showVelaToast", () => {
    it("creates and renders .vela-toast element inside host container", () => {
      const host = new MockElement("div");
      document.body.appendChild(host as any);

      showVelaToast("Copied 82896.02", "success", host as any, 2000);

      const toast = host.querySelector<any>(".vela-toast");
      expect(toast).not.toBeNull();
      expect(toast?.textContent).toBe("Copied 82896.02");
      expect(toast?.dataset.type).toBe("success");
      expect(toast?.dataset.open).toBe("1");

      // Fast-forward timer past duration
      vi.advanceTimersByTime(2100);
      expect(toast?.dataset.open).toBeUndefined();
    });

    it("defaults to document.body when host is null", () => {
      showVelaToast("Test toast message", "error");

      const toast = document.body.querySelector<any>(".vela-toast");
      expect(toast).not.toBeNull();
      expect(toast?.textContent).toBe("Test toast message");
      expect(toast?.dataset.type).toBe("error");
    });

    it("resets timer if called multiple times rapidly", () => {
      const host = new MockElement("div");
      document.body.appendChild(host as any);

      showVelaToast("First message", "info", host as any, 3000);
      vi.advanceTimersByTime(1500);

      showVelaToast("Second message", "success", host as any, 3000);
      const toast = host.querySelector<any>(".vela-toast");
      expect(toast?.textContent).toBe("Second message");
      expect(toast?.dataset.open).toBe("1");

      // Advance by another 2000ms (3500ms since first call, 2000ms since second call)
      vi.advanceTimersByTime(2000);
      expect(toast?.dataset.open).toBe("1");

      // Advance past second timer
      vi.advanceTimersByTime(1500);
      expect(toast?.dataset.open).toBeUndefined();
    });
  });

  describe("registerCopyPriceAction", () => {
    it("registers 'copy-price' action for 'context:body' with order: -100", () => {
      registerCopyPriceAction();

      const actions = widgetActions("context:body");
      const copyAction = actions.find((a) => a.id === "copy-price");

      expect(copyAction).toBeDefined();
      expect(copyAction?.label).toBe("Copy price");
      expect(copyAction?.target).toBe("context:body");
      expect(copyAction?.icon).toBe("copy");
      expect(copyAction?.order).toBe(-100);
      expect(copyAction?.when?.({} as any)).toBe(true);
    });

    it("copies formatted price to navigator.clipboard and calls ctx.toast on success", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const toastMock = vi.fn();
      const host = new MockElement("div");
      document.body.appendChild(host as any);

      const fakeCtx = {
        pointer: { price: 82500.25, time: 123456, paneKind: "price" },
        host,
        toast: toastMock,
      } as any;

      registerCopyPriceAction();
      const copyAction = widgetActions("context:body").find((a) => a.id === "copy-price");
      expect(copyAction).toBeDefined();

      vi.advanceTimersByTime(500);
      copyAction?.run(fakeCtx);
      expect(writeTextMock).toHaveBeenCalledWith("82500.25");

      await vi.runAllTimersAsync();
      expect(toastMock).toHaveBeenCalledWith("Copied 82500.25", "success");
    });

    it("falls back to fallbackResolver when ctx.pointer.price is null", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const toastMock = vi.fn();
      const fakeCtx = {
        pointer: { price: null },
        toast: toastMock,
      } as any;

      registerCopyPriceAction(() => ({ price: 105.5, decimals: 2 }));
      const copyAction = widgetActions("context:body").find((a) => a.id === "copy-price");

      vi.advanceTimersByTime(500);
      copyAction?.run(fakeCtx);

      expect(writeTextMock).toHaveBeenCalledWith("105.50");
      await vi.runAllTimersAsync();
      expect(toastMock).toHaveBeenCalledWith("Copied 105.50", "success");
    });

    it("shows error toast when navigator.clipboard.writeText rejects", async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error("Permission denied"));
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const toastMock = vi.fn();
      const fakeCtx = {
        pointer: { price: 50.0 },
        toast: toastMock,
      } as any;

      registerCopyPriceAction();
      const copyAction = widgetActions("context:body").find((a) => a.id === "copy-price");

      vi.advanceTimersByTime(500);
      copyAction?.run(fakeCtx);

      await vi.runAllTimersAsync();
      expect(toastMock).toHaveBeenCalledWith("Couldn't copy the price", "error");
    });

    it("shows error toast when navigator.clipboard.writeText is undefined", async () => {
      Object.assign(navigator, {
        clipboard: undefined,
      });

      const toastMock = vi.fn();
      const fakeCtx = {
        pointer: { price: 50.0 },
        toast: toastMock,
      } as any;

      registerCopyPriceAction();
      const copyAction = widgetActions("context:body").find((a) => a.id === "copy-price");

      vi.advanceTimersByTime(500);
      copyAction?.run(fakeCtx);

      expect(toastMock).toHaveBeenCalledWith("Couldn't copy the price", "error");
    });

    it("cleanly unregisters and resets module state allowing re-registration", () => {
      const resolver1 = vi.fn().mockReturnValue({ price: 100, decimals: 2 });
      const unregister1 = registerCopyPriceAction(resolver1);

      expect(widgetActions("context:body").some((a) => a.id === "copy-price")).toBe(true);

      // Unregister
      unregister1();
      expect(widgetActions("context:body").some((a) => a.id === "copy-price")).toBe(false);

      // Re-register with new resolver
      const resolver2 = vi.fn().mockReturnValue({ price: 200, decimals: 2 });
      const unregister2 = registerCopyPriceAction(resolver2);
      expect(widgetActions("context:body").some((a) => a.id === "copy-price")).toBe(true);

      unregister2();
      expect(widgetActions("context:body").some((a) => a.id === "copy-price")).toBe(false);
    });
  });

  describe("enhanceVelaContextMenu", () => {
    it("patches contextMenu.itemsFor to assign icon 'sliders' to settings items", () => {
      const mockContextMenu = {
        itemsFor: vi.fn().mockReturnValue([
          { id: "action:copy-price", label: "Copy price", icon: "copy" },
          { id: "reset-view", label: "Reset chart view", icon: "reset" },
          { id: "remove-drawings", label: "Remove drawings", icon: "eraser" },
          { id: "remove-indicators", label: "Remove indicators", icon: "indicators" },
          { id: "settings:Canvas", label: "Settings…", icon: "gear" },
        ]),
      };

      const container = new MockElement("div");
      document.body.appendChild(container as any);

      const cleanup = enhanceVelaContextMenu(container as any, mockContextMenu);

      const modifiedItems = mockContextMenu.itemsFor("body");
      const settingsItem = modifiedItems.find((i: any) => i.id === "settings:Canvas");
      expect(settingsItem?.icon).toBe("sliders");

      cleanup();
    });

    it("updates settings icon to Sliders SVG on DOM mutation", async () => {
      const container = new MockElement("div");
      document.body.appendChild(container as any);

      const mockContextMenu = {
        itemsFor: vi.fn().mockReturnValue([]),
        run: vi.fn(),
      };

      const cleanup = enhanceVelaContextMenu(container as any, mockContextMenu);

      // Simulate Vela Menu appending items to container
      const menuEl = new MockElement("ul");
      menuEl.className = "vela-menu";

      const settingsLi = new MockElement("li");
      settingsLi.className = "vela-menu-item";
      settingsLi.setAttribute("data-vei-id", "settings:Canvas");
      const settingsIcon = new MockElement("span");
      settingsIcon.className = "vela-icon";
      settingsIcon.innerHTML = "<svg>old-gear-icon</svg>";
      const settingsLabel = new MockElement("span");
      settingsLabel.className = "vela-menu-label";
      settingsLabel.textContent = "Settings…";
      settingsLi.append(settingsIcon, settingsLabel);

      const copyLi = new MockElement("li");
      copyLi.className = "vela-menu-item";
      copyLi.setAttribute("data-vei-id", "action:copy-price");
      const copyIcon = new MockElement("span");
      copyIcon.className = "vela-icon";
      copyIcon.innerHTML = "<svg>old-copy-icon</svg>";
      const copyLabel = new MockElement("span");
      copyLabel.className = "vela-menu-label";
      copyLabel.textContent = "Copy price";
      copyLi.append(copyIcon, copyLabel);

      menuEl.append(settingsLi, copyLi);
      container.appendChild(menuEl);

      // Verify Sliders and Copy icons were applied
      expect(settingsIcon.innerHTML).toBe(SLIDERS_ICON_SVG);
      expect(copyIcon.innerHTML).toBe(COPY_PRICE_ICON_SVG);

      cleanup();
    });

    it("injects VELA_CONTEXT_MENU_CSS to remove boxes from context menu icons leaving them loose/solto", () => {
      expect(VELA_CONTEXT_MENU_CSS).toContain("border: none !important");
      expect(VELA_CONTEXT_MENU_CSS).toContain("background: transparent !important");
      expect(VELA_CONTEXT_MENU_CSS).toContain(".vela-menu:not(.quant-drawing-menu) .vela-menu-item > .vela-icon");
    });
  });
});
