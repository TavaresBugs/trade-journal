// packages/vela/src/workspace/renderer-patches.ts
import { bindExternalSettingsDialog } from "./settings-engine";

export function getInnerRenderer(inst: any): any {
  if (!inst) return null;
  const r = inst.renderer ?? inst;
  return r?.renderer && r.renderer !== r ? r.renderer : r;
}

export function applyHealthyResolutionViewport(
  inner: any,
  resolution: string,
  preferredRightOffset = 10,
): void {
  if (!inner || typeof inner.applyViewport !== "function") return;
  const isDailyOrHigher = [
    "1d", "1D", "d", "D",
    "1w", "1W", "w", "W",
    "1mo", "1M", "mo", "M",
  ].includes(resolution);
  const targetBarSpacing = isDailyOrHigher ? 21.17 : 14;
  inner.applyViewport({
    barSpacing: targetBarSpacing,
    rightOffset: preferredRightOffset,
  });
}

export function injectLiveBarIntoVela(instance: any, bar: any): void {
  if (!instance || !bar) return;
  try {
    const inner = getInnerRenderer(instance);
    if (typeof instance.updateBar === "function") {
      instance.updateBar(bar);
    } else if (instance.orchestrator && typeof instance.orchestrator.applyBar === "function") {
      instance.orchestrator.applyBar(bar);
    } else if (typeof inner?.updateBar === "function") {
      inner.updateBar(bar);
    }
  } catch {}
}

/**
 * Corrige a projeção de crosshair externo em whitespace e entre múltiplos painéis.
 */
export function patchRendererWhitespaceCrosshair(
  instanceOrRenderer: any,
  onOpenSettings?: (section?: string) => void,
): void {
  if (onOpenSettings) {
    bindExternalSettingsDialog(instanceOrRenderer, onOpenSettings);
  }
  const patch = (r: any) => {
    if (!r) return;
    if (typeof r.externalCrossPx === "function" && !r.__whitespaceCrosshairPatched) {
      r.__whitespaceCrosshairPatched = true;
      r.externalCrossPx = function () {
        const ext = this.externalCross;
        if (!ext || !this.coords || this.coords.barCount === 0) return null;
        const rawLogical = this.coords.timeToLogical(ext.time);
        if (!Number.isFinite(rawLogical)) return null;
        const logical = Math.floor(rawLogical + 1e-6);
        const x = this.coords.logicalToX(logical);
        if (!Number.isFinite(x)) return null;
        const line = x >= 0 && x <= this.coords.width;
        let y: number | null = null;
        if (ext.price != null) {
          const pricePane = this.scene?.orderedPanes?.()?.find((p: any) => p.kind === "price");
          if (pricePane) {
            const rawY = Number(this.coords.priceToY(ext.price, pricePane.scale, pricePane.bounds));
            if (
              Number.isFinite(rawY) &&
              rawY >= pricePane.bounds.top &&
              rawY <= pricePane.bounds.top + pricePane.bounds.height
            ) {
              y = rawY;
            }
          }
        }
        return {
          x,
          y,
          time: this.coords.logicalToTime(logical),
          price: y != null ? ext.price : null,
          line,
        };
      };
    }
    if (r.renderer && r.renderer !== r) {
      patch(r.renderer);
    }
  };
  patch(instanceOrRenderer?.renderer ?? instanceOrRenderer);
}

/**
 * Sombra monocromática oficial 1:1 (backdrop-filter: grayscale(1)) nas velas futuras durante o modo de corte do Replay.
 */
export function attachVelaReplayFutureShading(renderer: any): () => void {
  const t = renderer?.crosshairLayer ? renderer : renderer?.renderer;
  const cursorCanvas = t?.cursorCanvas;
  const crosshairLayer = t?.crosshairLayer;
  if (!cursorCanvas?.parentElement || !crosshairLayer || typeof crosshairLayer.render !== "function") {
    return () => {};
  }

  const a = cursorCanvas.ownerDocument.createElement("div");
  a.className = "quant-replay-future";
  a.setAttribute("aria-hidden", "true");
  a.hidden = true;
  Object.assign(a.style, {
    position: "absolute",
    top: "0",
    pointerEvents: "none",
    backdropFilter: "grayscale(1)",
    WebkitBackdropFilter: "grayscale(1)",
  });
  cursorCanvas.before(a);

  const origRender = crosshairLayer.render;
  let visible = false;
  let lastKey = "";
  const hide = () => {
    if (visible) {
      visible = false;
      a.hidden = true;
    }
  };

  const customRender = function (this: any, chartState: any, viewport: any, ctx: any, d: any, u: any) {
    const m = chartState?.crosshair;
    const h = m && m.x >= 0 && m.x <= viewport.width && m.y >= 0 && m.y <= viewport.height ? m : u;
    if (
      chartState?.crosshairOverride?.shadeRight &&
      chartState.crosshairOverride.vertical !== false &&
      h &&
      Number.isFinite(h.x)
    ) {
      const x = Math.max(
        0,
        Math.min(
          viewport.width,
          Math.round(viewport.logicalToX(Math.round(viewport.xToLogical(h.x)) + 0.5)),
        ),
      );
      if (x >= viewport.width) {
        hide();
      } else {
        const key = `${x}|${viewport.width}|${viewport.height}`;
        if (key !== lastKey) {
          lastKey = key;
          a.style.left = `${x}px`;
          a.style.width = `${viewport.width - x}px`;
          a.style.height = `${viewport.height}px`;
        }
        if (!visible) {
          visible = true;
          a.hidden = false;
        }
      }
      if (a.nextSibling !== cursorCanvas) {
        cursorCanvas.before(a);
      }
    } else {
      hide();
    }
    origRender.call(crosshairLayer, chartState, viewport, ctx, d, u);
  };

  crosshairLayer.render = customRender;

  return () => {
    if (crosshairLayer.render === customRender) {
      crosshairLayer.render = origRender;
    }
    a.remove();
  };
}
