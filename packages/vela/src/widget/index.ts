export * from "../../vendor/widget.js";
// @ts-ignore - vendor bundle exports
import { Topbar as VendorTopbar, Statusline as VendorStatusline } from "../../vendor/widget.js";
import { resolveNativeSymbolIcon } from "./symbol-icon";
import { bindNativeTopbarSymbolGuard, syncNativeTopbarSymbolButton } from "./topbar";
import { attachVelaTimeframePicker, type TimeframePickerOptions } from "./timeframe-picker";
import { attachVelaStylePicker, type StylePickerOptions } from "./style-picker";
import { attachVelaLayoutPicker, type LayoutPickerOptions, type LayoutPickerController } from "./layout-picker";

export * from "./symbol-icon";
export * from "./topbar";
export * from "./timeframe-picker";
export * from "./style-picker";
export * from "./layout-picker";
export * from "./drawing-toolbar";
export * from "./screenshot-menu";
export * from "./context-menu";
export * from "./side-panels";

export class Topbar extends (VendorTopbar as any) {
  private __symbolGuard?: { setSymbol: (s: string) => void; destroy: () => void };
  private __hostContainer?: HTMLElement;
  private __cleanups: Array<() => void> = [];
  public layoutPicker?: LayoutPickerController;

  constructor(container: HTMLElement, options?: any) {
    super(container, options);
    this.__hostContainer = container;
    if (container) {
      this.__symbolGuard = bindNativeTopbarSymbolGuard(container, options?.symbol);

      // Se a instância vanilla criou styleMenu, destrói para usar o Bézier Style Picker
      if (options?.useBezierPickers && (this as any).styleMenu) {
        try {
          (this as any).styleMenu.destroy();
        } catch {}
      }
    }
  }

  setSymbol(symbol: string): void {
    const btn = this.__hostContainer?.querySelector<HTMLElement>(
      "#vela-topbar-symbol, .vela-widget-symbol",
    );
    if (btn) {
      syncNativeTopbarSymbolButton(btn, symbol);
    } else {
      super.setSymbol?.(symbol);
    }
  }

  destroy(): void {
    for (const fn of this.__cleanups.splice(0)) {
      try { fn(); } catch {}
    }
    this.layoutPicker?.destroy();
    this.__symbolGuard?.destroy();
    super.destroy?.();
  }
}

export class Statusline extends (VendorStatusline as any) {
  constructor(
    container: HTMLElement,
    symbol: string,
    resolveIcon?: (sym: string) => string | undefined,
  ) {
    const wrappedResolver = (sym: string): string | undefined => {
      return resolveIcon?.(sym) ?? resolveNativeSymbolIcon(sym);
    };
    super(container, symbol, wrappedResolver);
  }
}
