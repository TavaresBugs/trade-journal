/**
 * Vela Drawing Toolbar Enhancer
 *
 * Replicates official LuxAlgo Vela drawing drawer architecture:
 * 1. Zero-gap connection with active drawing toolbar button.
 * 2. Organic SVG Bézier curve outline expansion (.quant-drawing-menu-outline).
 * 3. Search tools filter input at top (.quant-drawing-menu-search).
 * 4. Section headings with line dividers and item counts (.quant-drawing-section).
 * 5. Keyboard shortcut badges (<kbd>).
 * 6. Dynamic resize observer keeping SVG path locked to flyout height.
 * 7. Magnetic sliding hover pill tracker (.quant-drawing-hover).
 * 8. Informational tool cards (.quant-tool-card) with official descriptions.
 * 9. Active tool indicator synchronization (solid white badge with dark icon).
 */

export const TOOL_DESCRIPTIONS: Record<string, string> = {
  "Trend Line": "Connect two points to mark a trend.",
  "Horizontal Line": "Mark a price level across the chart.",
  "Ray": "Draw a line that extends from a starting point.",
  "Extended Line": "Draw a line that extends in both directions.",
  "Vertical Line": "Mark a specific time on the chart.",
  "Horizontal Ray": "Extend a price level to the right.",
  "Cross Line": "Mark a price and time with crossing lines.",
  "Info Line": "Draw a line with price and time measurements.",
  "Trend Angle": "Draw a trend line and show its angle.",
  "Parallel Channel": "Outline a trend with parallel boundaries.",
  "Disjoint Channel": "Draw a channel with independently angled boundaries.",
  "Flat Top/Bottom": "Draw a channel with one horizontal boundary.",
  "Linear Regression": "Fit a trend channel to a range of prices.",
  "Pitchfork": "Draw a median line and parallel guides from three points.",
  "Schiff Pitchfork": "Draw a pitchfork with a shifted starting point.",
  "Modified Schiff Pitchfork": "Shift the pitchfork origin in both price and time.",
  "Inside Pitchfork": "Draw an inward-facing pitchfork from three points.",
  "Fib Retracement": "Mark Fibonacci levels within a price move.",
  "Fib Extension": "Extend Fibonacci levels beyond a price move.",
  "Trend-Based Fib Extension": "Project Fibonacci levels using three points.",
  "Fib Fan": "Draw angled guides using Fibonacci ratios.",
  "Fib Time Zones": "Mark time intervals using the Fibonacci sequence.",
  "Fib Channel": "Draw a channel with Fibonacci-spaced levels.",
  "Fib Speed Resistance Fan": "Draw price and time guides using Fibonacci ratios.",
  "Trend-Based Fib Time": "Project Fibonacci time intervals from a trend.",
  "Fib Circles": "Draw concentric circles using Fibonacci ratios.",
  "Fib Speed Resistance Arcs": "Draw arcs at Fibonacci distances from an anchor.",
  "Fib Wedge": "Draw Fibonacci arcs between two angled boundaries.",
  "Fib Spiral": "Draw an expanding Fibonacci spiral.",
  "Gann Fan": "Draw a fan of price and time angles.",
  "Gann Box": "Divide a price and time range into a grid.",
  "Gann Square": "Draw a Gann grid with angles and arcs.",
  "Dedekind Tessellation": "Draw a repeating geometric pattern of nested arcs.",
  "Sonic": "Draw a geometric pattern of expanding wave circles.",
  "Supersonic": "Draw wave circles with an angled outer boundary.",
  "Golden Sonic": "Draw sonic wave circles spaced by Fibonacci ratios.",
  "Golden Supersonic": "Draw a supersonic pattern using Fibonacci spacing.",
  "XABCD Pattern": "Connect five points to outline a price pattern.",
  "ABCD Pattern": "Connect four points to outline a price pattern.",
  "Head & Shoulders": "Mark the shoulders, head, and neckline of a pattern.",
  "Elliott Impulse Wave (1-5)": "Label a five-wave impulse sequence.",
  "Elliott Correction Wave (ABC)": "Label a three-wave correction sequence.",
  "Gartley": "Mark a Gartley pattern and its price ratios.",
  "Bat": "Mark a Bat pattern and its price ratios.",
  "Butterfly": "Mark a Butterfly pattern and its price ratios.",
  "Crab": "Mark a Crab pattern and its price ratios.",
  "Shark": "Mark a Shark pattern and its price ratios.",
  "Cypher": "Mark a Cypher pattern and its price ratios.",
  "Long/Short Position": "Map an entry, stop, and target to compare risk and reward.",
  "Date & Price Range": "Measure price change and elapsed time over a range.",
  "Magnifier": "View a selected chart area at a lower timeframe.",
  "Anchored VWAP": "Show volume-weighted average price from a chosen point.",
  "Fixed Range Volume Profile": "Show trading volume by price over a selected range.",
  "Brush": "Draw freehand on the chart.",
  "Highlighter": "Highlight an area with a translucent brush.",
  "Arrow": "Point to a move or area on the chart.",
  "Arrow Mark Up": "Place an upward arrow at a chart point.",
  "Arrow Mark Down": "Place a downward arrow at a chart point.",
  "Rectangle": "Outline a rectangular area on the chart.",
  "Ellipse": "Outline an oval area on the chart.",
  "Triangle": "Connect three points to draw a triangle.",
  "Polyline": "Connect multiple points with straight segments.",
  "Circle": "Mark an area with a circle.",
  "Rotated Rectangle": "Draw a rectangle at an angle.",
  "Path": "Trace a move with a series of connected points.",
  "Arc": "Draw a curved arc between points.",
  "Curve": "Draw a smooth curve on the chart.",
  "Text": "Add a text label to the chart.",
  "Callout": "Point a text bubble at a chart detail.",
  "Note": "Add a note to a chart location.",
  "Price Note": "Attach a note to a specific price point.",
  "Comment": "Add a comment bubble to the chart.",
  "Price Label": "Label a specific price level.",
  "Signpost": "Mark a chart point with a signpost label.",
  "Flag": "Place a flag at a chart point.",
  "Icon": "Place a symbol on the chart.",
  "Cursor": "Select and move drawings on the chart.",
  "Lines": "Connect points and trace trend guides on the chart.",
  "Fibonacci": "Mark price retracements, projections, and Fibonacci levels.",
  "Patterns": "Identify classical chart formations and harmonic ratios.",
  "Measurements": "Measure price distances, ranges, and volume distribution.",
  "Shapes": "Outline areas and geometric zones on the chart.",
  "Magnet snap": "Snap drawing anchor points directly to candle prices.",
  "Measure": "Measure the distance between points on the chart.",
  "Eraser (click/drag to delete)": "Click or drag over drawings to remove them.",
  "Stay in drawing mode": "Keep the drawing tool active after each drawing.",
  "Sync drawings on all charts": "Toggle drawing synchronization across charts.",
  "Collapse toolbar": "Hide the drawing tools to make more room for the chart.",
  "Expand toolbar": "Show the chart's drawing tools.",
  "Off": "Place drawing points freely without snapping.",
  "Weak": "Snap drawing points when they are near candle prices.",
  "Strong": "Keep drawing points snapped to candle prices.",
};

export function attachDrawingToolbarCard(
  button: HTMLElement,
  container: HTMLElement,
  description?: string,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let card: HTMLElement | null = null;
  const doc = button.ownerDocument;

  const removeCard = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (card) {
      card.remove();
      card = null;
    }
  };

  if (button.hasAttribute("title")) {
    button.removeAttribute("title");
  }

  const showCard = () => {
    removeCard();
    if (!button.isConnected) return;

    // Do not show tooltip if favorite toolbar is currently dragging
    if (button.closest(".vela-fav-toolbar[data-dragging='1']")) return;

    const label =
      button.getAttribute("aria-label")?.replace(/ — more$/u, "") ??
      button.textContent?.trim() ??
      "";
    if (!label) return;

    // Do not show tooltip for toolbar cell if its flyout drawer is already open
    const isFlyoutItem = button.closest(".vela-dtb-flyout");
    if (!isFlyoutItem && container.querySelector(".vela-dtb-flyout")) return;

    card = doc.createElement("div");
    card.className = "quant-tool-card";
    card.setAttribute("role", "tooltip");

    const heading = doc.createElement("div");
    heading.className = "quant-tool-card-heading";

    const iconSpan =
      button.querySelector(".quant-drawing-menu-icon, .vela-dtb-icon") ?? button;
    const svg = iconSpan.querySelector("svg");
    if (svg) {
      const iconWrap = doc.createElement("span");
      iconWrap.className = "quant-tool-card-icon";
      iconWrap.setAttribute("aria-hidden", "true");
      iconWrap.append(svg.cloneNode(true));
      heading.append(iconWrap);
    }

    const strong = doc.createElement("strong");
    strong.textContent = label;
    heading.append(strong);
    card.append(heading);

    const desc =
      description ??
      TOOL_DESCRIPTIONS[label] ??
      (button.querySelector(".vela-dtb-arrow")
        ? "Click the icon to use this tool. Use the arrow to explore more tools."
        : "Click the icon to use this tool.");

    const p = doc.createElement("p");
    p.textContent = desc;
    card.append(p);

    container.append(card);

    // Compute positioning
    const btnRect = button.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    const isFavBtn = Boolean(button.closest(".vela-fav-toolbar"));
    let left: number;
    let top: number;

    if (isFavBtn) {
      left = Math.max(
        8,
        Math.min(
          btnRect.left + (btnRect.width - cardRect.width) / 2,
          winWidth - cardRect.width - 8,
        ),
      );
      if (btnRect.bottom + 8 + cardRect.height <= winHeight - 8) {
        top = btnRect.bottom + 8;
      } else {
        top = Math.max(8, btnRect.top - cardRect.height - 8);
      }
    } else {
      left =
        btnRect.right + 12 + cardRect.width <= winWidth - 8
          ? btnRect.right + 12
          : Math.max(8, btnRect.left - cardRect.width - 12);
      top = Math.max(
        8,
        Math.min(
          btnRect.top + (btnRect.height - cardRect.height) / 2,
          winHeight - cardRect.height - 8,
        ),
      );
    }

    card.style.left = `${left - contRect.left + container.scrollLeft}px`;
    card.style.top = `${top - contRect.top + container.scrollTop}px`;
  };

  const onPointerEnter = (e: PointerEvent) => {
    if (button.closest(".vela-fav-toolbar[data-dragging='1']")) return;
    if (e.pointerType === "mouse") {
      removeCard();
      timer = setTimeout(showCard, 280);
    }
  };

  button.addEventListener("pointerenter", onPointerEnter);
  button.addEventListener("pointerleave", removeCard);
  button.addEventListener("pointerdown", removeCard);
  button.addEventListener("focus", showCard);
  button.addEventListener("blur", removeCard);

  return () => {
    removeCard();
    button.removeEventListener("pointerenter", onPointerEnter);
    button.removeEventListener("pointerleave", removeCard);
    button.removeEventListener("pointerdown", removeCard);
    button.removeEventListener("focus", showCard);
    button.removeEventListener("blur", removeCard);
  };
}

/**
 * TradingView Parity: Color Picker [+] Custom Color Button Enhancer
 * Replaces text node "+" with crisp 10x10 TradingView SVG plus icon, strips inline borders,
 * and preserves child <input type="color"> element intact.
 */
export function enhanceColorPickerPopovers(root: ParentNode, documentRef?: Document): void {
  if (!root) return;
  const doc = documentRef || (root as any).ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!doc) return;

  const isElement = (node: any): node is HTMLElement =>
    Boolean(
      node &&
        typeof node === "object" &&
        (typeof HTMLElement !== "undefined"
          ? node instanceof HTMLElement
          : typeof node.tagName === "string"),
    );

  const labels: HTMLElement[] = [];

  // Check if root itself matches
  if (isElement(root)) {
    const el = root;
    const isLabel = el.tagName === "LABEL";
    const hasColorInput = typeof el.querySelector === "function" && Boolean(el.querySelector('input[type="color"]'));
    const isCustomColor = typeof el.hasAttribute === "function" && el.hasAttribute("data-custom-color");
    if ((isLabel && (hasColorInput || el.closest?.(".vela-color-field-pop"))) || isCustomColor) {
      labels.push(el);
    }
  }

  // Find all .vela-color-field-pop label elements (or labels containing input[type="color"])
  if (typeof root.querySelectorAll === "function") {
    try {
      root
        .querySelectorAll<HTMLElement>(
          ".vela-color-field-pop label, .vela-color-field-pop [data-custom-color]",
        )
        .forEach((el) => {
          if (!labels.includes(el)) labels.push(el);
        });
    } catch {}

    try {
      root.querySelectorAll<HTMLInputElement>('input[type="color"]').forEach((input) => {
        const lbl = input.closest?.("label");
        if (lbl && !labels.includes(lbl)) {
          labels.push(lbl);
        }
      });
    } catch {}
  }

  for (const label of labels) {
    if (label.dataset?.tvPlus === "1") continue;
    if (label.dataset) {
      label.dataset.tvPlus = "1";
    } else if (typeof label.setAttribute === "function") {
      label.setAttribute("data-tv-plus", "1");
    }

    // Strip any inline border, outline, or boxShadow attributes
    if (label.style) {
      label.style.border = "none";
      label.style.outline = "none";
      label.style.boxShadow = "none";
    }

    // CRITICAL (Critic Rule): Do NOT destroy or replace the child <input type="color"> element! Leave it intact.
    // Check child nodes: remove any text node whose textContent trims to "+"
    if (label.childNodes) {
      const childNodes = Array.from(label.childNodes);
      for (const child of childNodes) {
        const isText = (child as any).nodeType === 3 || (!(child as any).tagName && typeof child.textContent === "string");
        if (isText && child.textContent?.trim() === "+") {
          if (typeof (child as any).remove === "function") {
            (child as any).remove();
          } else if (typeof (label as any).removeChild === "function") {
            (label as any).removeChild(child);
          }
        }
      }
    }

    // If label does not already have an SVG child, prepend the crisp 10x10 TradingView SVG plus icon
    const hasSvg = typeof label.querySelector === "function" ? label.querySelector("svg") : null;
    if (!hasSvg) {
      const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "10");
      svg.setAttribute("height", "10");
      svg.setAttribute("viewBox", "0 0 10 10");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "1.25");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("class", "pointer-events-none");
      svg.innerHTML = '<path d="M5 2v6M2 5h6" />';
      if (typeof label.prepend === "function") {
        label.prepend(svg);
      } else if (label.firstChild && typeof label.insertBefore === "function") {
        label.insertBefore(svg, label.firstChild);
      } else if (typeof label.appendChild === "function") {
        label.appendChild(svg);
      }
    }
  }
}

export function enhanceVelaDrawingToolbar(container: HTMLElement): () => void {
  const enhanced = new WeakSet<HTMLElement>();
  const cleanups = new Map<HTMLElement, () => void>();
  const doc = container.ownerDocument || document;

  const enhanceColorPickerPopoversInToolbar = (root: ParentNode) => {
    enhanceColorPickerPopovers(root, doc);
  };

  // Font Leak Shield: strip/override any inline --vela-font: sans-serif or font-family: sans-serif
  const sanitizeFontLeak = (el: Element | null) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.style.getPropertyValue("--vela-font") === "sans-serif") {
      el.style.removeProperty("--vela-font");
    }
    if (el.style.fontFamily === "sans-serif") {
      el.style.fontFamily = "";
    }
  };

  const shieldFontTargets = (root: ParentNode) => {
    if (
      root instanceof HTMLElement &&
      root.matches(".vela-ui, .vela-ui-layer, .vela-dpop, .vela-popover, .vela-menu, .vela-tooltip")
    ) {
      sanitizeFontLeak(root);
    }
    root
      .querySelectorAll<HTMLElement>(
        ".vela-ui, .vela-ui-layer, .vela-dpop, .vela-popover, .vela-menu, .vela-tooltip",
      )
      .forEach(sanitizeFontLeak);
  };

  shieldFontTargets(container);
  if (doc?.body) {
    shieldFontTargets(doc.body);
  }

  // Color Picker Popovers TradingView parity
  enhanceColorPickerPopoversInToolbar(container);
  if (doc?.body) {
    enhanceColorPickerPopoversInToolbar(doc.body);
  }

  // Floating toolbar grip enhancement (Native Vela & Custom Parity)
  enhanceVelaFloatingToolbarGrip(container, doc);
  if (doc?.body) {
    enhanceVelaFloatingToolbarGrip(doc.body, doc);
  }

  // Head observer to sanitize lazy #vela-ui-tokens
  let headObserver: MutationObserver | null = null;
  const sanitizeTokensTag = (tag: Element) => {
    if (
      tag instanceof HTMLElement &&
      tag.id === "vela-ui-tokens" &&
      tag.textContent?.includes("--vela-font: sans-serif")
    ) {
      tag.textContent = tag.textContent.replace(
        /--vela-font:\s*sans-serif/g,
        '--vela-font: var(--font-sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif)',
      );
    }
  };
  if (doc?.head) {
    const existingTokens = doc.getElementById("vela-ui-tokens");
    if (existingTokens) sanitizeTokensTag(existingTokens);

    if (typeof MutationObserver !== "undefined") {
      headObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node instanceof HTMLElement && node.id === "vela-ui-tokens") {
              sanitizeTokensTag(node);
            }
          }
        }
      });
      headObserver.observe(doc.head, { childList: true });
    }
  }

  const enhanceFlyout = (flyout: HTMLElement) => {
    if (enhanced.has(flyout) || flyout.classList.contains("quant-drawing-menu")) return;
    enhanced.add(flyout);

    const doc = flyout.ownerDocument;
    const rawChildren = [...flyout.children] as HTMLElement[];

    // 1. Create scrollable items container
    const scrollArea = doc.createElement("div");
    scrollArea.className = "quant-drawing-menu-scroll";

    interface SectionGroup {
      heading?: HTMLElement;
      title: string;
      count?: HTMLElement;
      rows: HTMLElement[];
    }

    const sections: SectionGroup[] = [];
    let curSection: SectionGroup | null = null;
    const itemCardCleanups: Array<() => void> = [];

    for (const child of rawChildren) {
      if (child.matches(".vela-dtb-item")) {
        if (!curSection) {
          curSection = { title: "", rows: [] };
          sections.push(curSection);
        }
        curSection.rows.push(child);

        // Enhance hint into kbd tags if present
        const hint = child.querySelector(".vela-dtb-hint");
        if (hint && hint.textContent) {
          const rawText = hint.textContent;
          const tokens = rawText.match(/[⌘⌥⇧⌃]|[^⌘⌥⇧⌃+\s]+/gu) ?? [rawText];
          const kbdMap: Record<string, string> = {
            "⌘": "Command",
            "⌥": "Option",
            "⇧": "Shift",
            "⌃": "Control",
          };
          hint.setAttribute(
            "aria-label",
            tokens.map((t) => kbdMap[t] ?? t).join(" + "),
          );
          hint.replaceChildren(
            ...tokens.map((t) => {
              const kbd = doc.createElement("kbd");
              kbd.textContent = t;
              kbd.setAttribute("aria-hidden", "true");
              return kbd;
            }),
          );
        }

        // Add icon helper class to badge container
        const badge = child.querySelector(".vela-dtb-badge") || child.firstElementChild;
        if (badge instanceof HTMLElement && badge.querySelector("svg")) {
          badge.classList.add("quant-drawing-menu-icon");
        }

        // Check if item has a checkmark span (active in base Vela)
        const checkmark = child.querySelector("span:has(> svg:not(.vela-dtb-star svg)):not(.quant-drawing-menu-icon)");
        if (checkmark) {
          child.setAttribute("data-active", "1");
        }

        // Attach tool description card
        const label = child.getAttribute("aria-label") ?? child.textContent?.trim() ?? "";
        if (label) {
          itemCardCleanups.push(
            attachDrawingToolbarCard(
              child,
              container,
              TOOL_DESCRIPTIONS[label] ?? `Use ${label} on the chart.`,
            ),
          );
        }

        // Handle click: set data-active="1"
        child.addEventListener("click", () => {
          rawChildren.forEach((c) => c.removeAttribute("data-active"));
          child.setAttribute("data-active", "1");
        });
      } else if (child.textContent && child.textContent.trim()) {
        const text = child.textContent.trim();
        const titleSpan = doc.createElement("span");
        titleSpan.textContent = text;
        const lineSpan = doc.createElement("span");
        lineSpan.className = "quant-drawing-section-line";
        lineSpan.setAttribute("aria-hidden", "true");
        const countSpan = doc.createElement("span");
        countSpan.className = "quant-drawing-section-count";

        child.classList.add("quant-drawing-section");
        child.replaceChildren(titleSpan, lineSpan, countSpan);

        curSection = { heading: child, title: text, count: countSpan, rows: [] };
        sections.push(curSection);
      } else {
        child.classList.add("quant-drawing-section-separator");
      }
    }

    const allRows = sections.flatMap((s) => s.rows);
    for (const sec of sections) {
      if (sec.count) sec.count.textContent = String(sec.rows.length);
    }

    scrollArea.append(...rawChildren);

    // 2. Search bar
    const searchBar = doc.createElement("div");
    searchBar.className = "quant-drawing-menu-search";
    searchBar.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5"></circle>
        <path d="m16 16 4 4"></path>
      </svg>
      <input type="search" placeholder="Search tools…" aria-label="Search drawing tools" autocomplete="off" spellcheck="false" />
    `;
    const searchInput = searchBar.querySelector("input")!;

    // 3. Footer with count
    const footer = doc.createElement("div");
    footer.className = "quant-drawing-menu-footer";
    footer.setAttribute("role", "status");
    footer.textContent = `${allRows.length} tools`;

    const onSearch = () => {
      const q = searchInput.value.trim().toLowerCase();
      let total = 0;
      for (const sec of sections) {
        let secVisible = 0;
        for (const row of sec.rows) {
          const text = (row.getAttribute("aria-label") || row.textContent || "").toLowerCase();
          const matches = `${sec.title} ${text}`.toLowerCase().includes(q);
          row.hidden = !matches;
          if (matches) secVisible++;
        }
        if (sec.heading) sec.heading.hidden = secVisible === 0;
        if (sec.count) sec.count.textContent = String(secVisible);
        total += secVisible;
      }
      scrollArea.scrollTop = 0;
      footer.textContent = total
        ? `${total} ${total === 1 ? "tool" : "tools"}`
        : "No matching tools";
    };

    searchInput.addEventListener("input", onSearch);

    // Keyboard navigation support in search
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target === searchInput) {
        if (e.key === "Escape" && searchInput.value) {
          e.preventDefault();
          e.stopPropagation();
          searchInput.value = "";
          onSearch();
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const firstVisible = allRows.find((r) => !r.hidden);
          firstVisible?.focus();
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        const arrow = container.querySelector(".vela-dtb-cell.vela-open .vela-dtb-arrow") as HTMLElement;
        arrow?.click();
      }
    };
    flyout.addEventListener("keydown", onKeyDown);

    // 4. Organic SVG Bézier Outline
    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("quant-drawing-menu-outline");
    svg.setAttribute("aria-hidden", "true");

    const pathFill = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    pathFill.classList.add("quant-drawing-menu-fill");

    const pathEdge = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    pathEdge.classList.add("quant-drawing-menu-edge");

    svg.append(pathFill, pathEdge);

    flyout.classList.add("quant-drawing-menu");
    flyout.replaceChildren(svg, searchBar, scrollArea, footer);

    // Constrain height within container boundaries and compute seamless curve
    const updateOutline = () => {
      // Synchronize exact fill and border colors with the left toolbar (.vela-dtb)
      const dtb = container.querySelector(".vela-dtb");
      if (dtb) {
        const dtbStyle = window.getComputedStyle(dtb);
        if (dtbStyle.backgroundColor) {
          pathFill.style.fill = dtbStyle.backgroundColor;
        }
        if (dtbStyle.borderRightColor) {
          pathEdge.style.stroke = dtbStyle.borderRightColor;
        }
      }

      const parent = flyout.parentElement || container;
      const parentRect = parent.getBoundingClientRect();
      const flyoutRect = flyout.getBoundingClientRect();

      const viewportBottom = Math.min(window.innerHeight, parentRect.bottom);
      const availableHeight = viewportBottom - flyoutRect.top - 16;
      if (availableHeight > 80) {
        const targetMaxHeight = `${Math.round(availableHeight)}px`;
        if (flyout.style.maxHeight !== targetMaxHeight) {
          flyout.style.maxHeight = targetMaxHeight;
        }
      }

      const rect = flyout.getBoundingClientRect();
      const T = rect.width;
      const n = rect.height;

      // LuxAlgo canonical SVG Bézier expansion path formula:
      // Starts at (0.5, 0), curves outward to (16.5, 16.5), runs horizontally to (T-10.5, 16.5),
      // curves around top-right corner to (T-0.5, 26.5), runs down right side to (T-0.5, n+5.5),
      // curves around bottom-right corner to (T-10.5, n+15.5), runs horizontally to (16.5, n+15.5),
      // and curves inward back to (0.5, n+32).
      const r = `M 0.5 0 Q 0.5 16.5 16.5 16.5 H ${T - 10.5} Q ${T - 0.5} 16.5 ${T - 0.5} 26.5 V ${n + 5.5} Q ${T - 0.5} ${n + 15.5} ${T - 10.5} ${n + 15.5} H 16.5 Q 0.5 ${n + 15.5} 0.5 ${n + 32}`;

      svg.setAttribute("viewBox", `0 0 ${T} ${n + 32}`);
      pathFill.setAttribute("d", `${r} H 0 V 0 Z`);
      pathEdge.setAttribute("d", r);
    };

    updateOutline();
    const resizeObserver = new ResizeObserver(updateOutline);
    resizeObserver.observe(flyout);

    cleanups.set(flyout, () => {
      resizeObserver.disconnect();
      searchInput.removeEventListener("input", onSearch);
      flyout.removeEventListener("keydown", onKeyDown);
      itemCardCleanups.forEach((c) => c());
      cleanups.delete(flyout);
      enhanced.delete(flyout);
    });
  };

  // Inspect any flyouts already present
  container.querySelectorAll<HTMLElement>(".vela-dtb-flyout").forEach(enhanceFlyout);

  // Attach tool description cards to primary toolbar buttons
  const toolbarCardCleanups: Array<() => void> = [];
  const attachToolbarCards = () => {
    toolbarCardCleanups.forEach((c) => c());
    toolbarCardCleanups.length = 0;
    container
      .querySelectorAll<HTMLElement>(
        ".vela-dtb > :is(.vela-dtb-cell, .vela-dtb-btn:not(.vela-dtb-collapse))",
      )
      .forEach((btn) => {
        const icon = (btn.querySelector(".vela-dtb-icon") as HTMLElement) || btn;
        const label = icon.getAttribute("aria-label") ?? btn.getAttribute("aria-label") ?? "";
        if (label) {
          toolbarCardCleanups.push(
            attachDrawingToolbarCard(btn, container, TOOL_DESCRIPTIONS[label]),
          );
        }
      });
  };
  attachToolbarCards();

  // MutationObserver to capture flyouts and sanitize font leak as soon as elements appear
  const observer = new MutationObserver((mutations) => {
    let rebindToolbar = false;
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName === "style") {
        if (mutation.target instanceof HTMLElement) {
          sanitizeFontLeak(mutation.target);
          if (
            mutation.target.matches?.(".vela-color-field-pop, .vela-color-field-pop *")
          ) {
            enhanceColorPickerPopoversInToolbar(mutation.target);
          }
        }
      }
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          if (
            node.matches(".vela-ui, .vela-ui-layer, .vela-dpop, .vela-popover, .vela-menu, .vela-tooltip")
          ) {
            sanitizeFontLeak(node);
          }
          node
            .querySelectorAll<HTMLElement>(
              ".vela-ui, .vela-ui-layer, .vela-dpop, .vela-popover, .vela-menu, .vela-tooltip",
            )
            .forEach(sanitizeFontLeak);
          if (node.matches(".vela-dtb-flyout")) {
            enhanceFlyout(node);
          } else {
            node.querySelectorAll<HTMLElement>(".vela-dtb-flyout").forEach(enhanceFlyout);
          }
          if (node.matches(".vela-dtb") || node.querySelector(".vela-dtb")) {
            rebindToolbar = true;
          }
          enhanceColorPickerPopoversInToolbar(node);
        }
      }
      for (const node of mutation.removedNodes) {
        if (node instanceof HTMLElement) {
          if (node.matches(".vela-dtb-flyout")) {
            cleanups.get(node)?.();
          } else {
            node.querySelectorAll<HTMLElement>(".vela-dtb-flyout").forEach((el) => {
              cleanups.get(el)?.();
            });
          }
        }
      }
    }
    if (rebindToolbar) attachToolbarCards();
    enhanceVelaFloatingToolbarGrip(container, doc);
    if (doc?.body) {
      enhanceVelaFloatingToolbarGrip(doc.body, doc);
    }
  });

  observer.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style"],
  });

  // 5. Magnetic sliding hover pill tracker (toolbar & drawer)
  const hoverSelector = ".vela-dtb-cell, .vela-dtb-btn, .vela-dtb-item";
  let activeHoverContainer: HTMLElement | null = null;
  let activeHoverTarget: Element | null = null;

  const hideHover = () => {
    if (activeHoverContainer) {
      activeHoverContainer.removeAttribute("data-quant-hover-visible");
      activeHoverContainer.removeAttribute("data-quant-hover-moving");
    }
    activeHoverTarget = null;
  };

  const updateHover = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return;
    const item = target.closest(hoverSelector);
    const hostCont = item?.closest(".vela-dtb, .quant-drawing-menu-scroll") as HTMLElement | null;
    if (!item || !hostCont || !container.contains(hostCont)) return;
    if (item.classList.contains("vela-open") || item.matches(":disabled")) {
      hideHover();
      return;
    }
    if (item === activeHoverTarget && hostCont.hasAttribute("data-quant-hover-visible")) return;

    if (activeHoverContainer !== hostCont) hideHover();

    const isMoving = hostCont.hasAttribute("data-quant-hover-visible");
    const cRect = hostCont.getBoundingClientRect();
    const iRect = item.getBoundingClientRect();

    hostCont.classList.add("quant-drawing-hover");
    if (isMoving) {
      hostCont.setAttribute("data-quant-hover-moving", "");
    } else {
      hostCont.removeAttribute("data-quant-hover-moving");
    }
    hostCont.style.setProperty("--quant-hover-y", `${iRect.top - cRect.top - hostCont.clientTop + hostCont.scrollTop}px`);
    hostCont.style.setProperty("--quant-hover-height", `${iRect.height}px`);
    hostCont.style.setProperty("--quant-hover-x", `${iRect.left - cRect.left - hostCont.clientLeft + hostCont.scrollLeft}px`);
    hostCont.style.setProperty("--quant-hover-width", `${iRect.width}px`);
    hostCont.setAttribute("data-quant-hover-visible", "");

    activeHoverContainer = hostCont;
    activeHoverTarget = item;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "touch") updateHover(e.target);
  };

  const onPointerLeave = (e: PointerEvent) => {
    if (!e.relatedTarget || !activeHoverContainer?.contains(e.relatedTarget as Node)) {
      hideHover();
    }
  };

  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerleave", onPointerLeave);

  let bodyObserver: MutationObserver | null = null;
  if (doc?.body && typeof MutationObserver !== "undefined") {
    bodyObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement) {
            if (
              node.matches?.(".vela-color-field-pop, .vela-popover, .vela-ui-layer") ||
              node.querySelector?.(".vela-color-field-pop")
            ) {
              enhanceColorPickerPopoversInToolbar(node);
            }
          }
        }
      }
      enhanceVelaFloatingToolbarGrip(container, doc);
      if (doc.body) {
        enhanceVelaFloatingToolbarGrip(doc.body, doc);
      }
    });
    bodyObserver.observe(doc.body, { childList: true, subtree: true });
  }

  return () => {
    bodyObserver?.disconnect();
    headObserver?.disconnect();
    observer.disconnect();
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerleave", onPointerLeave);
    toolbarCardCleanups.forEach((c) => c());
    for (const cleanup of cleanups.values()) {
      cleanup();
    }
    cleanups.clear();
  };
}

export const FAV_TOOLBAR_POS_STORAGE_KEY = "tradejournal_vela_fav_toolbar_pos_v1";

export const GRIP_SIX_DOTS_SVG =
  '<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="6" cy="3.5" r="1.1"/><circle cx="10" cy="3.5" r="1.1"/><circle cx="6" cy="8" r="1.1"/><circle cx="10" cy="8" r="1.1"/><circle cx="6" cy="12.5" r="1.1"/><circle cx="10" cy="12.5" r="1.1"/></svg>';

export function enhanceVelaFloatingToolbarGrip(
  root: ParentNode,
  _documentRef?: Document,
): void {
  if (!root) return;
  const grips: HTMLElement[] = [];
  if (
    typeof (root as any).matches === "function" &&
    (root as any).matches(".vela-dpop-grip")
  ) {
    grips.push(root as HTMLElement);
  }
  if (typeof root.querySelectorAll === "function") {
    root.querySelectorAll<HTMLElement>(".vela-dpop-grip").forEach((el) => {
      grips.push(el);
    });
  }

  for (const grip of grips) {
    const isEnhanced =
      grip.dataset?.gripEnhanced === "1" ||
      (typeof grip.getAttribute === "function" &&
        grip.getAttribute("data-grip-enhanced") === "1");
    if (isEnhanced) continue;

    if (grip.dataset) {
      grip.dataset.gripEnhanced = "1";
    }
    if (typeof grip.setAttribute === "function") {
      grip.setAttribute("data-grip-enhanced", "1");
    }
    // CRITICAL: Do NOT remove, replace, or rebind Vela's pointerdown listener on the button!
    // Replacing innerHTML preserves all event listeners registered directly on the grip element.
    grip.innerHTML = GRIP_SIX_DOTS_SVG;
  }
}

export interface FavoriteToolbarOptions {
  resolveToolMeta?: (type: string) => { label?: string; icon?: string } | undefined;
  onFavoritesChange?: (favorites: string[]) => void;
}

export const DEFAULT_TOOL_META: Record<string, { label: string; icon: string }> = {
  trendline: {
    label: "Trend Line",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="19" x2="20" y2="5"/></svg>',
  },
  ray: {
    label: "Ray",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="20" x2="21" y2="6"/><circle cx="3" cy="20" r="1.6" fill="currentColor"/></svg>',
  },
  extendedline: {
    label: "Extended Line",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5"/><path d="M5 19 8.5 19M5 19 5 15.5"/><path d="M19 5 15.5 5M19 5 19 8.5"/></svg>',
  },
  hline: {
    label: "Horizontal Line",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12"/></svg>',
  },
  vline: {
    label: "Vertical Line",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="3" x2="12" y2="21"/></svg>',
  },
  hray: {
    label: "Horizontal Ray",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="21" y2="12"/><circle cx="5" cy="12" r="1.6" fill="currentColor"/></svg>',
  },
  crossline: {
    label: "Cross Line",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="3" x2="12" y2="21"/></svg>',
  },
  infoline: {
    label: "Info Line",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20 20 4"/><rect x="9" y="9" width="9" height="6" rx="1"/></svg>',
  },
  trendangle: {
    label: "Trend Angle",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20 20 6"/><path d="M4 20 15 20"/><path d="M11 20a7 7 0 0 0-2-4.9"/></svg>',
  },
  parallelchannel: {
    label: "Parallel Channel",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="16" x2="21" y2="8"/><line x1="3" y1="21" x2="21" y2="13"/></svg>',
  },
  disjointchannel: {
    label: "Disjoint Channel",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="7" x2="21" y2="10"/><line x1="3" y1="18" x2="21" y2="14"/></svg>',
  },
  flattopbottom: {
    label: "Flat Top/Bottom",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="18" x2="21" y2="11"/></svg>',
  },
  pitchfork: {
    label: "Pitchfork",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="4" cy="12" r="1.6" fill="currentColor"/><line x1="4" y1="12" x2="10" y2="12"/><line x1="10" y1="6" x2="10" y2="18"/><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/></svg>',
  },
  fibretracement: {
    label: "Fib Retracement",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="19" x2="21" y2="19"/></svg>',
  },
  fibextension: {
    label: "Fib Extension",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="11" x2="21" y2="11"/><line x1="3" y1="15" x2="14" y2="15"/><line x1="3" y1="20" x2="14" y2="20"/></svg>',
  },
  box: {
    label: "Rectangle",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="1"/></svg>',
  },
  rectangle: {
    label: "Rectangle",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="1"/></svg>',
  },
  circle: {
    label: "Circle",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>',
  },
  polyline: {
    label: "Polyline",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="4" cy="18" r="1.6"/><circle cx="12" cy="6" r="1.6"/><circle cx="20" cy="14" r="1.6"/><path d="m4 18 8-12 8 8"/></svg>',
  },
  brush: {
    label: "Brush",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 4 6 6-9 9a2 2 0 0 1-2.8 0L5 15.8a2 2 0 0 1 0-2.8l9-9Z"/></svg>',
  },
  freehand: {
    label: "Brush",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 4 6 6-9 9a2 2 0 0 1-2.8 0L5 15.8a2 2 0 0 1 0-2.8l9-9Z"/></svg>',
  },
  highlighter: {
    label: "Highlighter",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 11-6 6v3h3l6-6"/><path d="m22 7-5-5-8 8 5 5 8-8Z"/></svg>',
  },
  position: {
    label: "Long/Short Position",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="7.5" rx="1" fill="currentColor" fill-opacity="0.25"/><rect x="4.5" y="12" width="15" height="7.5" rx="1"/></svg>',
  },
  longposition: {
    label: "Long Position",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="7.5" rx="1" fill="currentColor" fill-opacity="0.25"/><rect x="4.5" y="12" width="15" height="7.5" rx="1"/></svg>',
  },
  shortposition: {
    label: "Short Position",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="7.5" rx="1"/><rect x="4.5" y="12" width="15" height="7.5" rx="1" fill="currentColor" fill-opacity="0.25"/></svg>',
  },
  text: {
    label: "Text",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6h14M12 6v13"/></svg>',
  },
  callout: {
    label: "Callout",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-5 5v-5H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/></svg>',
  },
  note: {
    label: "Note",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7l-4 4v-4H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M8 8.5h8M8 12h5"/></svg>',
  },
  pricenote: {
    label: "Price Note",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="10" y="4.5" width="11" height="8" rx="1.5"/><path d="M10 8.5 4 16"/><circle cx="3.5" cy="16.5" r="1.6" fill="currentColor" stroke="none"/></svg>',
  },
  comment: {
    label: "Comment",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4.5h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-7l-4 4v-4H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z"/></svg>',
  },
  pricelabel: {
    label: "Price Label",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12 7 8h12a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7Z"/><path d="M10.5 12.5h6" stroke-width="1.4"/></svg>',
  },
  signpost: {
    label: "Signpost",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 11.5V21"/><rect x="5" y="4" width="14" height="7" rx="1"/><path d="M9 7.5h6"/></svg>',
  },
  magnifier: {
    label: "Magnifier",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.3 15.3 5.2 5.2"/><path d="M8 12.5v-3M10.5 13.5v-5.5M13 12v-2"/></svg>',
  },
  measure: {
    label: "Measure",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14.5 14.5 4l5.5 5.5-10.5 10.5Z"/><path d="m8 10.5 2-2M11 13.5 13 11.5M14 16.5 16 14.5"/></svg>',
  },
  eraser: {
    label: "Eraser (click/drag to delete)",
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 21-4-4a2 2 0 0 1 0-2.8L14.7 2.5a2 2 0 0 1 2.8 0l4 4a2 2 0 0 1 0 2.8L10 21"/></svg>',
  },
};

export function resolveToolMeta(
  type: string,
  hostEl?: HTMLElement,
  options?: FavoriteToolbarOptions,
): { label: string; icon: string } {
  // 1. Try options?.resolveToolMeta
  const custom = options?.resolveToolMeta?.(type);
  if (custom?.label && custom?.icon) {
    return { label: custom.label, icon: custom.icon };
  }

  // 2. Try inspecting existing button/item in hostEl
  let foundLabel = custom?.label;
  let foundIcon = custom?.icon;

  if (hostEl) {
    const existingEl = hostEl.querySelector<HTMLElement>(
      `[data-tool="${type}"], [data-drawing-type="${type}"]`,
    );
    if (existingEl) {
      if (!foundLabel) {
        foundLabel =
          existingEl.getAttribute("aria-label")?.replace(/ — more$/u, "") ||
          existingEl.textContent?.trim() ||
          undefined;
      }
      if (!foundIcon) {
        const svg = existingEl.querySelector("svg");
        if (svg) {
          foundIcon = svg.outerHTML;
        }
      }
    }
  }

  // 3. Fallback map
  const fallback = DEFAULT_TOOL_META[type.toLowerCase()];
  const finalLabel =
    foundLabel ||
    fallback?.label ||
    type.charAt(0).toUpperCase() + type.slice(1);
  const finalIcon =
    foundIcon ||
    fallback?.icon ||
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="19" x2="20" y2="5"/></svg>';

  return { label: finalLabel, icon: finalIcon };
}

export function attachVelaFavoriteToolbar(
  instance: any,
  hostEl: HTMLElement,
  options?: FavoriteToolbarOptions,
): () => void {
  const doc = hostEl.ownerDocument || document;

  const toolbar = doc.createElement("div");
  toolbar.className = "vela-dpop vela-fav-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Favorite drawing tools");

  const inner = doc.createElement("div");
  inner.className = "vela-fav-toolbar-inner";

  const grip = doc.createElement("button");
  grip.type = "button";
  grip.className = "vela-dpop-grip vela-fav-toolbar-grip";
  grip.setAttribute("aria-label", "Drag favorite tools toolbar");
  grip.innerHTML = GRIP_SIX_DOTS_SVG;

  const itemsContainer = doc.createElement("div");
  itemsContainer.className = "vela-fav-toolbar-items";

  inner.append(grip, itemsContainer);
  toolbar.append(inner);

  const cardCleanups: Array<() => void> = [];

  const updateActiveState = (activeType: string | null) => {
    const buttons = itemsContainer.querySelectorAll<HTMLElement>(".vela-fav-toolbar-btn");
    buttons.forEach((btn) => {
      const tool = btn.getAttribute("data-tool");
      const isActive = Boolean(activeType && tool === activeType);
      btn.setAttribute("data-active", isActive ? "1" : "0");
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  const renderItems = (favorites: string[]) => {
    cardCleanups.forEach((c) => c());
    cardCleanups.length = 0;
    itemsContainer.replaceChildren();

    if (!favorites || favorites.length === 0) {
      toolbar.hidden = true;
      toolbar.setAttribute("data-empty", "1");
      return;
    }

    toolbar.hidden = false;
    toolbar.removeAttribute("data-empty");

    const currentTool = instance?.drawings?.getTool?.() ?? null;

    for (const type of favorites) {
      const meta = resolveToolMeta(type, hostEl, options);
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "vela-dpop-btn vela-fav-toolbar-btn";
      btn.setAttribute("data-tool", type);
      btn.setAttribute("aria-label", meta.label);

      const isActive = Boolean(currentTool && currentTool === type);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      btn.setAttribute("data-active", isActive ? "1" : "0");
      btn.removeAttribute("title");

      btn.innerHTML = meta.icon;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const cur = instance?.drawings?.getTool?.() ?? null;
        const next = cur === type ? null : type;
        instance?.drawings?.setTool?.(next);
        updateActiveState(next);
      });

      const desc = TOOL_DESCRIPTIONS[meta.label] ?? `Use ${meta.label} on the chart.`;
      cardCleanups.push(attachDrawingToolbarCard(btn, hostEl, desc));

      itemsContainer.append(btn);
    }
  };

  // Position management
  let currentPos = { x: 68, y: 12 };
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(FAV_TOOLBAR_POS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          currentPos = { x: parsed.x, y: parsed.y };
        }
      }
    }
  } catch {}

  const clampPosition = (x: number, y: number): { x: number; y: number } => {
    const hostRect = hostEl.getBoundingClientRect ? hostEl.getBoundingClientRect() : { width: 800, height: 600 };
    const barRect = toolbar.getBoundingClientRect ? toolbar.getBoundingClientRect() : { width: 120, height: 38 };
    const hostWidth = hostRect.width || (hostEl as any).offsetWidth || 800;
    const hostHeight = hostRect.height || (hostEl as any).offsetHeight || 600;
    const barWidth = barRect.width || (toolbar as any).offsetWidth || 120;
    const barHeight = barRect.height || (toolbar as any).offsetHeight || 38;

    const minX = 58;
    const minY = 8;
    const maxX = Math.max(minX, hostWidth - barWidth - 8);
    const maxY = Math.max(minY, hostHeight - barHeight - 8);

    const clampedX = Math.round(Math.max(minX, Math.min(x, maxX)));
    const clampedY = Math.round(Math.max(minY, Math.min(y, maxY)));
    return { x: clampedX, y: clampedY };
  };

  const applyPosition = (pos: { x: number; y: number }) => {
    toolbar.style.left = `${pos.x}px`;
    toolbar.style.top = `${pos.y}px`;
  };

  currentPos = clampPosition(currentPos.x, currentPos.y);
  applyPosition(currentPos);

  const resizeObserver = typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(() => {
        currentPos = clampPosition(currentPos.x, currentPos.y);
        applyPosition(currentPos);
      })
    : null;
  resizeObserver?.observe(hostEl);

  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let posStartX = 0;
  let posStartY = 0;

  const win = doc.defaultView || (typeof window !== "undefined" ? window : null);

  const onPointerDown = (e: any) => {
    if (e.button !== undefined && e.button !== 0) return;
    isDragging = true;
    dragStartX = e.clientX ?? 0;
    dragStartY = e.clientY ?? 0;
    posStartX = currentPos.x;
    posStartY = currentPos.y;
    toolbar.setAttribute("data-dragging", "1");
    try {
      grip.setPointerCapture?.(e.pointerId);
    } catch {}
    if (typeof e.preventDefault === "function") e.preventDefault();
  };

  const onPointerMove = (e: any) => {
    if (!isDragging) return;
    const dx = (e.clientX ?? 0) - dragStartX;
    const dy = (e.clientY ?? 0) - dragStartY;
    currentPos = clampPosition(posStartX + dx, posStartY + dy);
    applyPosition(currentPos);
  };

  const onPointerUp = (e: any) => {
    if (!isDragging) return;
    isDragging = false;
    toolbar.removeAttribute("data-dragging");
    try {
      if (e.pointerId !== undefined) {
        grip.releasePointerCapture?.(e.pointerId);
      }
    } catch {}
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(FAV_TOOLBAR_POS_STORAGE_KEY, JSON.stringify(currentPos));
      }
    } catch {}
  };

  grip.addEventListener("pointerdown", onPointerDown);
  grip.addEventListener("pointermove", onPointerMove);
  grip.addEventListener("pointerup", onPointerUp);
  if (win) {
    win.addEventListener("pointermove", onPointerMove);
    win.addEventListener("pointerup", onPointerUp);
    win.addEventListener("pointercancel", onPointerUp);
  }

  const initialFavs = instance?.drawings?.favorites?.() ?? [];
  renderItems(initialFavs);

  const onFavsEvent = (evt: { favorites: string[] }) => {
    const list = evt?.favorites ?? [];
    renderItems(list);
    options?.onFavoritesChange?.(list);
  };

  const onToolEvent = (evt: { type: string | null }) => {
    updateActiveState(evt?.type ?? null);
  };

  const unsubFavs = instance?.on?.("drawing:favorites", onFavsEvent);
  const unsubTool = instance?.on?.("drawing:tool", onToolEvent);

  hostEl.append(toolbar);

  return () => {
    cardCleanups.forEach((c) => c());
    cardCleanups.length = 0;
    if (typeof toolbar.remove === "function") {
      toolbar.remove();
    } else if (toolbar.parentElement) {
      toolbar.parentElement.removeChild(toolbar);
    }
    resizeObserver?.disconnect();
    grip.removeEventListener("pointerdown", onPointerDown);
    grip.removeEventListener("pointermove", onPointerMove);
    grip.removeEventListener("pointerup", onPointerUp);
    if (win) {
      win.removeEventListener("pointermove", onPointerMove);
      win.removeEventListener("pointerup", onPointerUp);
      win.removeEventListener("pointercancel", onPointerUp);
    }
    if (typeof unsubFavs === "function") {
      unsubFavs();
    } else {
      instance?.off?.("drawing:favorites", onFavsEvent);
    }
    if (typeof unsubTool === "function") {
      unsubTool();
    } else {
      instance?.off?.("drawing:tool", onToolEvent);
    }
  };
}
