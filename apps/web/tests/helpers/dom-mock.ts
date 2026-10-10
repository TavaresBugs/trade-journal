/**
 * Shared Headless DOM Mock Harness for Vela Engine Vitest Tests
 * Provides high-fidelity, spec-compliant MockElement, MockStyle, and MockDocument classes.
 */

export class MockStyle {
  private props = new Map<string, string>();
  [key: string]: any;

  constructor() {
    return new Proxy(this, {
      get: (target, prop: string) => {
        if (prop in target || typeof (target as any)[prop] === "function") {
          return (target as any)[prop];
        }
        return target.props.get(prop) ?? "";
      },
      set: (target, prop: string, val: any) => {
        const strVal = String(val);
        target.props.set(prop, strVal);
        (target as any)[prop] = strVal;
        return true;
      },
    });
  }

  setProperty(name: string, value: string) {
    const val = String(value);
    this.props.set(name, val);
    (this as any)[name] = val;
    const camel = name.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
    (this as any)[camel] = val;
  }

  getPropertyValue(name: string): string {
    const camel = name.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
    return this.props.get(name) ?? this.props.get(camel) ?? (this as any)[name] ?? (this as any)[camel] ?? "";
  }

  removeProperty(name: string) {
    this.props.delete(name);
    delete (this as any)[name];
    const camel = name.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
    this.props.delete(camel);
    delete (this as any)[camel];
  }
}

export class MockMutationObserver {
  cb: (mutations: Array<{ addedNodes: any[]; type?: string; target?: any }>) => void;
  static activeObservers: MockMutationObserver[] = [];

  constructor(cb: any) {
    this.cb = cb;
    MockMutationObserver.activeObservers.push(this);
  }

  observe(_target: any, _opts?: any) {}

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

export class MockWindow {
  listeners = new Map<string, Set<Function>>();
  innerWidth = 1024;
  innerHeight = 768;

  addEventListener(type: string, fn: Function) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }

  removeEventListener(type: string, fn: Function) {
    this.listeners.get(type)?.delete(fn);
  }

  dispatchEvent(ev: { type: string; [k: string]: any }) {
    const fns = this.listeners.get(ev.type);
    if (fns) {
      for (const fn of Array.from(fns)) fn(ev);
    }
    return true;
  }
}

function matchCompoundSelector(el: MockElement, sel: string): boolean {
  if (!sel || sel === "*") return true;

  let remaining = sel.trim();

  // Handle :is(...) or :not(...) simplification
  if (remaining.includes(":not(") || remaining.includes(":is(")) {
    remaining = remaining
      .replace(/:not\([^)]+\)/g, "")
      .replace(/:is\(([^)]+)\)/g, "$1")
      .trim();
  }

  // Tag name
  const tagMatch = remaining.match(/^([a-zA-Z0-9_-]+)/);
  if (tagMatch && tagMatch[1]) {
    if (el.tagName !== tagMatch[1].toUpperCase()) return false;
    remaining = remaining.slice(tagMatch[0].length);
  }

  while (remaining.length > 0) {
    if (remaining.startsWith(".")) {
      const classMatch = remaining.match(/^\.([a-zA-Z0-9_-]+)/);
      if (!classMatch || !classMatch[1]) break;
      if (!el.classList.contains(classMatch[1])) return false;
      remaining = remaining.slice(classMatch[0].length);
    } else if (remaining.startsWith("#")) {
      const idMatch = remaining.match(/^#([a-zA-Z0-9_-]+)/);
      if (!idMatch || !idMatch[1]) break;
      if (el.id !== idMatch[1]) return false;
      remaining = remaining.slice(idMatch[0].length);
    } else if (remaining.startsWith("[")) {
      const attrMatch = remaining.match(/^\[([a-zA-Z0-9_-]+)(?:([*^$]?=)(?:['"]?([^'"\]]*)['"]?))?\]/);
      if (!attrMatch || !attrMatch[1]) break;
      const attrName = attrMatch[1];
      const op = attrMatch[2];
      const expectedVal = attrMatch[3];

      let actualVal = el.getAttribute(attrName);
      if (actualVal === null && attrName.startsWith("data-")) {
        const camel = attrName.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        actualVal = el.dataset[camel] ?? null;
      }

      if (op === undefined) {
        if (actualVal === null) return false;
      } else if (expectedVal !== undefined) {
        if (actualVal === null) return false;
        if (op === "=" && actualVal !== expectedVal) return false;
        if (op === "^=" && !actualVal.startsWith(expectedVal)) return false;
        if (op === "$=" && !actualVal.endsWith(expectedVal)) return false;
        if (op === "*=" && !actualVal.includes(expectedVal)) return false;
      }
      remaining = remaining.slice(attrMatch[0].length);
    } else {
      break;
    }
  }

  return true;
}

export class MockElement {
  tagName: string;
  className = "";
  id = "";
  type = "";
  hidden = false;
  style = new MockStyle();
  attributes = new Map<string, string>();
  children: MockElement[] = [];
  parentElement: MockElement | null = null;
  offsetParent: MockElement | null = null;
  private _ownerDocument: MockDocument | null = null;
  listeners = new Map<string, Set<Function>>();

  width = 0;
  height = 0;
  offsetWidth = 0;
  offsetHeight = 0;
  clientWidth = 0;
  scrollLeft = 0;
  scrollTop = 0;

  private _textContent = "";
  private _innerHTML = "";
  private rectFn?: () => { left: number; top: number; width: number; height: number };

  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    if (this.tagName === "BUTTON") {
      this.offsetWidth = 30;
      this.offsetHeight = 30;
    }
  }

  setRectFn(fn: () => { left: number; top: number; width: number; height: number }) {
    this.rectFn = fn;
  }

  getBoundingClientRect(): {
    x: number;
    y: number;
    left: number;
    top: number;
    width: number;
    height: number;
    right: number;
    bottom: number;
    toJSON: () => any;
  } {
    if (this.rectFn) {
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
    const width = this.offsetWidth || (this.tagName === "BUTTON" ? 30 : 400);
    const height = this.offsetHeight || (this.tagName === "BUTTON" ? 30 : 300);
    return {
      top: 0,
      left: 0,
      bottom: height,
      right: width,
      width,
      height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
  }

  get isConnected(): boolean {
    let cur: MockElement | null = this;
    while (cur) {
      if (cur.tagName === "BODY" || cur.tagName === "#DOCUMENT" || cur.parentElement) {
        if (cur.tagName === "BODY" || cur.tagName === "#DOCUMENT") return true;
        cur = cur.parentElement;
      } else {
        return false;
      }
    }
    return false;
  }

  get ownerDocument(): any {
    return this._ownerDocument ?? (globalThis as any).document ?? null;
  }

  set ownerDocument(doc: any) {
    this._ownerDocument = doc;
  }

  get classList() {
    return {
      contains: (c: string) => this.className.split(/\s+/).filter(Boolean).includes(c),
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

  get dataset(): Record<string, string> {
    const ds: Record<string, string> = {};
    for (const [k, v] of this.attributes.entries()) {
      if (k.startsWith("data-")) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        ds[camel] = v;
      }
    }
    return new Proxy(ds, {
      set: (_target, prop: string, val: any) => {
        const kebab = "data-" + prop.replace(/([A-Z])/g, "-$1").toLowerCase();
        this.setAttribute(kebab, String(val));
        return true;
      },
      get: (_target, prop: string) => {
        const kebab = "data-" + prop.replace(/([A-Z])/g, "-$1").toLowerCase();
        return this.getAttribute(kebab) ?? undefined;
      },
      deleteProperty: (_target, prop: string) => {
        const kebab = "data-" + prop.replace(/([A-Z])/g, "-$1").toLowerCase();
        this.removeAttribute(kebab);
        return true;
      },
    });
  }

  setAttribute(name: string, val: string) {
    this.attributes.set(name, String(val));
    if (name === "id") this.id = String(val);
    if (name === "class") this.className = String(val);
    if (name === "type") this.type = String(val);
  }

  getAttribute(name: string): string | null {
    if (name === "id" && this.id) return this.id;
    if (name === "class" && this.className) return this.className;
    if (name === "type" && this.type) return this.type;
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
    if (name === "id") this.id = "";
    if (name === "class") this.className = "";
  }

  matches(sel: string): boolean {
    const parts = sel.split(",").map((s) => s.trim());
    return parts.some((part) => matchCompoundSelector(this, part));
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
    if (!other) return false;
    if (this === other) return true;
    let cur: MockElement | null = other.parentElement;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  appendChild(child: MockElement) {
    child.parentElement = this;
    child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    MockMutationObserver.notifyAll([child]);
    return child;
  }

  append(...children: (MockElement | string)[]) {
    for (const c of children) {
      if (typeof c === "string") {
        this.textContent += c;
      } else {
        this.appendChild(c);
      }
    }
  }

  prepend(...children: (MockElement | string)[]) {
    for (let i = children.length - 1; i >= 0; i--) {
      const c = children[i];
      if (c === undefined) continue;
      if (typeof c === "string") {
        this.textContent = c + this.textContent;
      } else {
        c.parentElement = this;
        c.ownerDocument = this.ownerDocument;
        this.children.unshift(c);
        MockMutationObserver.notifyAll([c]);
      }
    }
  }

  insertBefore(newChild: MockElement, refChild: MockElement | null) {
    newChild.parentElement = this;
    newChild.ownerDocument = this.ownerDocument;
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
    this.children.forEach((c) => (c.parentElement = null));
    this.children = [];
    this._textContent = "";
    this._innerHTML = "";
    this.append(...newChildren);
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
      this.parentElement = null;
    }
  }

  removeChild(child: MockElement) {
    this.children = this.children.filter((c) => c !== child);
    child.parentElement = null;
    return child;
  }

  cloneNode(deep = false): MockElement {
    const clone = new MockElement(this.tagName.toLowerCase());
    clone.className = this.className;
    clone.id = this.id;
    clone.type = this.type;
    clone._textContent = this._textContent;
    clone._innerHTML = this._innerHTML;
    for (const [k, v] of this.attributes.entries()) {
      clone.setAttribute(k, v);
    }
    if (deep) {
      for (const child of this.children) {
        clone.appendChild(child.cloneNode(true));
      }
    }
    return clone;
  }

  get innerHTML(): string {
    return this._innerHTML;
  }

  set innerHTML(val: string) {
    this._innerHTML = val;
    this._textContent = val.replace(/<[^>]*>/g, "");
    this.children = [];
    if (!val) return;

    if (val.includes("<svg")) {
      const svg = new MockElement("svg");
      svg.ownerDocument = this.ownerDocument;
      const pathRegex = /<path\s+([^>]+)>/g;
      let match: RegExpExecArray | null;
      while ((match = pathRegex.exec(val)) !== null) {
        const pathEl = new MockElement("path");
        pathEl.ownerDocument = this.ownerDocument;
        const attrs = match[1] || "";
        const classMatch = /class="([^"]+)"/.exec(attrs);
        if (classMatch?.[1]) pathEl.className = classMatch[1];
        const dMatch = /d="([^"]+)"/.exec(attrs);
        if (dMatch?.[1]) pathEl.setAttribute("d", dMatch[1]);
        svg.appendChild(pathEl);
      }
      this.appendChild(svg);
    }
  }

  get textContent(): string {
    if (this._textContent) return this._textContent;
    let text = "";
    for (const child of this.children) {
      text += child.textContent;
    }
    return text;
  }

  set textContent(v: string) {
    this._textContent = v;
  }

  querySelector<T = MockElement>(sel: string): T | null {
    return (this.querySelectorAll<T>(sel)[0] ?? null) as T | null;
  }

  querySelectorAll<T = MockElement>(sel: string): T[] {
    const results: MockElement[] = [];
    const parts = sel.split(",").map((s) => s.trim()).filter(Boolean);

    for (const branch of parts) {
      if (branch.startsWith(":scope > ")) {
        const childSel = branch.slice(9).trim();
        for (const child of this.children) {
          if (matchCompoundSelector(child, childSel)) {
            if (!results.includes(child)) results.push(child);
          }
        }
        continue;
      }

      const tokens = branch.split(/\s+/).filter(Boolean);
      const targetToken = tokens[tokens.length - 1];
      if (!targetToken) continue;

      const walk = (el: MockElement) => {
        for (const child of el.children) {
          if (matchCompoundSelector(child, targetToken)) {
            if (!results.includes(child)) results.push(child);
          }
          walk(child);
        }
      };
      walk(this);
    }

    return results as unknown as T[];
  }

  addEventListener(type: string, fn: Function) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(fn);
  }

  removeEventListener(type: string, fn: Function) {
    this.listeners.get(type)?.delete(fn);
  }

  dispatchEvent(ev: { type: string; [k: string]: any }) {
    const eventWithTarget = {
      target: this,
      currentTarget: this,
      preventDefault: () => {},
      stopPropagation: () => {},
      ...ev,
    };
    const fns = this.listeners.get(ev.type);
    if (fns) {
      for (const fn of Array.from(fns)) {
        fn(eventWithTarget);
      }
    }
    return true;
  }

  click() {
    this.dispatchEvent({
      type: "click",
      preventDefault: () => {},
      stopPropagation: () => {},
      target: this,
    });
  }

  getContext(_type?: string) {
    return {
      fillStyle: "",
      fillRect: () => {},
      drawImage: () => {},
    };
  }

  toDataURL(_type?: string) {
    return "data:image/png;base64,mockpng";
  }

  toBlob(cb: (blob: any) => void, _type?: string) {
    if (typeof (globalThis as any).Blob !== "undefined") {
      cb(new (globalThis as any).Blob(["mock"], { type: "image/png" }));
    } else {
      cb({ type: "image/png" });
    }
  }

  setPointerCapture(_id?: number) {}
  releasePointerCapture(_id?: number) {}
}

export class MockDocument extends MockElement {
  body: MockElement;
  head: MockElement;
  defaultView: MockWindow;

  constructor() {
    super("#document");
    this.defaultView = new MockWindow();
    this.body = new MockElement("body");
    this.head = new MockElement("head");
    this.body.ownerDocument = this;
    this.head.ownerDocument = this;
    this.children = [this.head, this.body];
  }

  createElement(tag: string): MockElement {
    const el = new MockElement(tag);
    el.ownerDocument = this;
    return el;
  }

  createElementNS(_ns: string, tag: string): MockElement {
    const el = new MockElement(tag);
    el.ownerDocument = this;
    return el;
  }

  getElementById(id: string): MockElement | null {
    return this.querySelector(`#${id}`);
  }
}

// Ensure document is never undefined in Node test runners even if a test deletes globalThis.document
try {
  const defaultDoc = new MockDocument();
  let customDoc: any = null;
  const proto = Object.getPrototypeOf(globalThis);
  if (proto && !("document" in proto)) {
    Object.defineProperty(proto, "document", {
      get: () => customDoc || defaultDoc,
      set: (v) => {
        customDoc = v;
      },
      configurable: true,
    });
  }
} catch {}
