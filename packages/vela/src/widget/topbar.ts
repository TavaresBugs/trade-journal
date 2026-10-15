/**
 * Native Vela Topbar with Permanent Search Icon (🔍) & Property Descriptor Shield
 */

import { VELA_NATIVE_ICONS } from "../ui/chrome-join";
import { cleanRootSymbol } from "./symbol-icon";

const nativeTextContentDescriptor =
  typeof Node !== "undefined"
    ? Object.getOwnPropertyDescriptor(Node.prototype, "textContent")
    : undefined;

function setRawTextContent(el: Node, text: string): void {
  if (nativeTextContentDescriptor?.set) {
    nativeTextContentDescriptor.set.call(el, text);
  } else {
    el.textContent = text;
  }
}

function getRawTextContent(el: Node): string {
  if (nativeTextContentDescriptor?.get) {
    return nativeTextContentDescriptor.get.call(el) ?? "";
  }
  return el.textContent ?? "";
}

/**
 * Installs an instance-level `textContent` setter shield on the symbol button
 * so any internal `btn.textContent = sym` call in vendor/widget.js updates ONLY
 * `[data-vela-symbol-label]` and NEVER destroys `[data-vela-search-icon]`.
 */
export function syncNativeTopbarSymbolButton(
  symbolBtn: HTMLElement,
  rawSymbol?: string,
): void {
  if (!symbolBtn) return;

  if (!symbolBtn.classList.contains("quant-chrome-hover-row")) {
    symbolBtn.classList.add("quant-chrome-hover-row");
  }
  symbolBtn.style.display = "inline-flex";
  symbolBtn.style.alignItems = "center";
  symbolBtn.style.gap = "6px";
  symbolBtn.style.padding = "0 8px";

  let iconSpan = symbolBtn.querySelector<HTMLElement>("[data-vela-search-icon]");
  let labelSpan = symbolBtn.querySelector<HTMLElement>("[data-vela-symbol-label]");

  const fallbackText =
    rawSymbol ||
    labelSpan?.textContent?.trim() ||
    symbolBtn.dataset.enhancedSymbol ||
    getRawTextContent(symbolBtn).trim() ||
    "MES";
  const displaySymbol = cleanRootSymbol(fallbackText) || fallbackText;

  if (!iconSpan || !labelSpan) {
    setRawTextContent(symbolBtn, "");

    iconSpan = symbolBtn.ownerDocument.createElement("span");
    iconSpan.setAttribute("data-vela-search-icon", "true");
    iconSpan.className = "inline-flex items-center shrink-0 pointer-events-none";
    iconSpan.innerHTML = VELA_NATIVE_ICONS.search;

    labelSpan = symbolBtn.ownerDocument.createElement("span");
    labelSpan.setAttribute("data-vela-symbol-label", "true");
    labelSpan.className = "font-bold tracking-tight";

    symbolBtn.append(iconSpan, labelSpan);
  }

  if (getRawTextContent(labelSpan) !== displaySymbol) {
    setRawTextContent(labelSpan, displaySymbol);
  }
  symbolBtn.dataset.enhancedSymbol = displaySymbol;
  symbolBtn.setAttribute("aria-label", `Symbol search — ${displaySymbol}`);

  // Install property descriptor shield once per DOM element
  if (!(symbolBtn as any).__velaSymbolTextShielded && nativeTextContentDescriptor) {
    try {
      Object.defineProperty(symbolBtn, "__velaSymbolTextShielded", {
        value: true,
        configurable: true,
      });
      Object.defineProperty(symbolBtn, "textContent", {
        configurable: true,
        enumerable: true,
        get() {
          const lbl = symbolBtn.querySelector<HTMLElement>("[data-vela-symbol-label]");
          return lbl ? getRawTextContent(lbl) : getRawTextContent(symbolBtn);
        },
        set(newVal: unknown) {
          const nextSym = cleanRootSymbol(String(newVal ?? "").trim()) || String(newVal ?? "").trim();
          if (!nextSym) return;
          let icon = symbolBtn.querySelector<HTMLElement>("[data-vela-search-icon]");
          let lbl = symbolBtn.querySelector<HTMLElement>("[data-vela-symbol-label]");
          if (!icon || !lbl) {
            setRawTextContent(symbolBtn, "");
            icon = symbolBtn.ownerDocument.createElement("span");
            icon.setAttribute("data-vela-search-icon", "true");
            icon.className = "inline-flex items-center shrink-0 pointer-events-none";
            icon.innerHTML = VELA_NATIVE_ICONS.search;

            lbl = symbolBtn.ownerDocument.createElement("span");
            lbl.setAttribute("data-vela-symbol-label", "true");
            lbl.className = "font-bold tracking-tight";
            symbolBtn.append(icon, lbl);
          }
          setRawTextContent(lbl, nextSym);
          symbolBtn.dataset.enhancedSymbol = nextSym;
          symbolBtn.setAttribute("aria-label", `Symbol search — ${nextSym}`);
        },
      });
    } catch {}
  }
}

export function bindNativeTopbarSymbolGuard(
  topbarContainer: HTMLElement,
  initialSymbol?: string,
): {
  setSymbol: (symbol: string) => void;
  destroy: () => void;
} {
  const findBtn = () =>
    topbarContainer.querySelector<HTMLElement>("#vela-topbar-symbol, .vela-widget-symbol");

  const initialBtn = findBtn();
  if (initialBtn) {
    syncNativeTopbarSymbolButton(initialBtn, initialSymbol);
  }

  let isUpdating = false;
  const observer = new MutationObserver(() => {
    if (isUpdating) return;
    const btn = findBtn();
    if (!btn) return;
    const hasIcon = Boolean(btn.querySelector("[data-vela-search-icon]"));
    const isShielded = Boolean((btn as any).__velaSymbolTextShielded);
    if (!hasIcon || !isShielded) {
      isUpdating = true;
      try {
        syncNativeTopbarSymbolButton(btn, btn.dataset.enhancedSymbol || initialSymbol);
      } finally {
        isUpdating = false;
      }
    }
  });

  observer.observe(topbarContainer, {
    childList: true,
    subtree: true,
  });

  return {
    setSymbol: (symbol: string) => {
      const btn = findBtn();
      if (btn) {
        isUpdating = true;
        try {
          syncNativeTopbarSymbolButton(btn, symbol);
        } finally {
          isUpdating = false;
        }
      }
    },
    destroy: () => observer.disconnect(),
  };
}
