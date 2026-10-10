/**
 * Enhanced Timeframe Picker (quant-tfp) for TradeJournal Vela Chart
 * Exactly reproduces the official LuxAlgo Vela Timeframe Picker popup
 * with instant input parsing, 4-column chip grid, favorites pinning,
 * and keyboard navigation.
 */

export interface TimeframePickerOptions {
  container: HTMLElement;
  currentTimeframe: string;
  getCurrentTimeframe?: () => string;
  timeframeFavorites?: string[];
  availableTimeframes?: Set<string>;
  onSelectTimeframe: (tf: string) => void;
  onFavoritesChange?: (favs: string[]) => void;
}

interface TfItem {
  id: string;
  label: string;
}

const GROUPS: { title: string; timeframes: TfItem[] }[] = [
  {
    title: "MINUTES",
    timeframes: [
      { id: "1", label: "1m" },
      { id: "3", label: "3m" },
      { id: "5", label: "5m" },
      { id: "15", label: "15m" },
      { id: "30", label: "30m" },
    ],
  },
  {
    title: "HOURS",
    timeframes: [
      { id: "60", label: "1h" },
      { id: "240", label: "4h" },
    ],
  },
  {
    title: "DAYS AND UP",
    timeframes: [
      { id: "D", label: "1D" },
      { id: "W", label: "1W" },
      { id: "M", label: "1M" },
    ],
  },
];

import { VELA_ICONS } from "./vela-icons";

const STAR_SVG = VELA_ICONS.star;

const STAR_OUTLINE_SVG = VELA_ICONS.starOutline;

const CLOCK_SVG = VELA_ICONS.clock;

export function attachVelaTimeframePicker(opts: TimeframePickerOptions): () => void {
  const { container } = opts;
  let currentTf = opts.currentTimeframe;
  const rawFavs = opts.timeframeFavorites ?? ["1", "5"];
  const toCanonical = (s: string): string => {
    const m = s.match(/^(\d+)[mM]?$/);
    if (m && m[1]) return m[1];
    return s.toUpperCase();
  };
  let favs = new Set(rawFavs.map(toCanonical));
  let activePopup: HTMLElement | null = null;
  let caretEl: HTMLElement | null = null;
  let onWindowResize: (() => void) | null = null;
  let resizeObserver: ResizeObserver | null = null;

  function findCaret(): HTMLElement | null {
    return (
      container.querySelector<HTMLElement>(".vela-widget-tf-caret") ||
      container.querySelector<HTMLElement>("#vela-topbar-tf")
    );
  }

  function closePopup() {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (onWindowResize) {
      window.removeEventListener("resize", onWindowResize);
      onWindowResize = null;
    }
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
    if (caretEl) {
      caretEl.removeAttribute("data-quant-open");
      caretEl.setAttribute("aria-expanded", "false");
    }
    document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    document.removeEventListener("keydown", handleKeydown, true);
  }

  function handleOutsidePointerDown(e: PointerEvent) {
    if (!activePopup) return;
    const target = e.target as Node;
    if (activePopup.contains(target) || caretEl?.contains(target)) return;
    closePopup();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      closePopup();
    }
  }

  function openPopup() {
    caretEl = findCaret();
    if (!caretEl) return;
    if (activePopup) {
      closePopup();
      return;
    }

    caretEl.dataset.quantOpen = "1";
    caretEl.setAttribute("aria-expanded", "true");

    const popup = document.createElement("div");
    popup.className = "quant-tfp";
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-label", "Timeframe");

    // 0. Organic SVG Bézier Outline (seamless connection with zero line)
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.classList.add("quant-tfp-outline");
    svg.setAttribute("aria-hidden", "true");

    const pathFill = document.createElementNS(NS, "path");
    pathFill.classList.add("quant-tfp-outline-fill");

    const pathEdge = document.createElementNS(NS, "path");
    pathEdge.classList.add("quant-tfp-outline-edge");

    svg.append(pathFill, pathEdge);

    // 1. Search Bar
    const searchLabel = document.createElement("label");
    searchLabel.className = "quant-tfp-search";

    const clockSpan = document.createElement("span");
    clockSpan.className = "vela-icon";
    clockSpan.innerHTML = CLOCK_SVG;

    const input = document.createElement("input");
    input.className = "quant-tfp-input";
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = "Type any interval: 22m, 3h, 2D";
    input.setAttribute("aria-label", "Timeframe");

    searchLabel.append(clockSpan, input);

    // 2. Body
    const body = document.createElement("div");
    body.className = "quant-tfp-body";
    body.dataset.mode = "grid";

    function isCurrent(item: TfItem): boolean {
      const active = opts.getCurrentTimeframe ? opts.getCurrentTimeframe() : currentTf;
      return (
        item.id === active ||
        item.label === active ||
        item.label.toLowerCase() === active.toLowerCase()
      );
    }

    function isPinned(item: TfItem): boolean {
      return favs.has(toCanonical(item.id));
    }

    function renderGrid() {
      body.replaceChildren();
      body.dataset.mode = "grid";

      for (const group of GROUPS) {
        const heading = document.createElement("div");
        heading.className = "quant-tfp-heading";
        heading.textContent = group.title;

        const grid = document.createElement("div");
        grid.className = "quant-tfp-grid";

        for (const item of group.timeframes) {
          const cell = document.createElement("div");
          cell.className = "quant-tfp-cell";

          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "quant-tfp-chip";
          chip.textContent = item.label;

          if (isCurrent(item)) {
            chip.dataset.current = "1";
            chip.setAttribute("aria-current", "true");
          }

          chip.addEventListener("click", () => {
            currentTf = item.id;
            opts.onSelectTimeframe(item.id);
            closePopup();
          });

          cell.appendChild(chip);

          // Star Pin
          const pin = document.createElement("button");
          pin.type = "button";
          pin.className = "quant-tfp-pin";
          const pinned = isPinned(item);
          if (pinned) {
            pin.dataset.on = "1";
            pin.setAttribute("aria-pressed", "true");
            pin.innerHTML = STAR_SVG;
          } else {
            pin.innerHTML = STAR_OUTLINE_SVG;
          }

          pin.addEventListener("click", (e) => {
            e.stopPropagation();
            const cid = toCanonical(item.id);
            if (favs.has(cid)) {
              favs.delete(cid);
            } else {
              favs.add(cid);
            }
            opts.onFavoritesChange?.(Array.from(favs));
            renderGrid();
          });

          cell.appendChild(pin);
          grid.appendChild(cell);
        }

        body.append(heading, grid);
      }
    }

    // 3. Search / Filter logic
    function parseCustom(q: string): { id: string; label: string; desc: string } | null {
      const match = q.trim().match(/^(\d+)\s*([mhdMHDwW]?)$/);
      if (!match || !match[1]) return null;
      const num = parseInt(match[1], 10);
      if (!num || num <= 0) return null;
      let unit = match[2]?.toLowerCase() || "m";
      if (unit === "w") return { id: `${num}W`, label: `${num}W`, desc: `${num} Week${num > 1 ? "s" : ""}` };
      if (unit === "d") return { id: `${num}D`, label: `${num}D`, desc: `${num} Day${num > 1 ? "s" : ""}` };
      if (unit === "h") return { id: String(num * 60), label: `${num}h`, desc: `${num} Hour${num > 1 ? "s" : ""}` };
      return { id: String(num), label: `${num}m`, desc: `${num} Minute${num > 1 ? "s" : ""}` };
    }

    input.addEventListener("input", () => {
      const q = input.value.trim();
      if (!q) {
        renderGrid();
        return;
      }

      body.replaceChildren();
      body.dataset.mode = "list";

      const parsed = parseCustom(q);
      if (!parsed) {
        const empty = document.createElement("div");
        empty.className = "quant-tfp-empty";
        empty.textContent = "Not an interval. Try 15, 4h, 3D, 2W or 6M.";
        body.appendChild(empty);
        return;
      }

      const row = document.createElement("div");
      row.className = "quant-tfp-row";
      row.dataset.highlighted = "1";

      const chooseBtn = document.createElement("button");
      chooseBtn.type = "button";
      chooseBtn.className = "quant-tfp-choose";

      const labelSpan = document.createElement("span");
      labelSpan.className = "quant-tfp-label";
      labelSpan.textContent = parsed.desc;

      const shortSpan = document.createElement("span");
      shortSpan.className = "quant-tfp-short";
      shortSpan.textContent = parsed.label;

      chooseBtn.append(labelSpan, shortSpan);

      chooseBtn.addEventListener("click", () => {
        currentTf = parsed.id;
        opts.onSelectTimeframe(parsed.id);
        closePopup();
      });

      row.appendChild(chooseBtn);
      body.appendChild(row);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const q = input.value.trim();
        const parsed = parseCustom(q);
        if (parsed) {
          currentTf = parsed.id;
          if (e.shiftKey) {
            favs.add(toCanonical(parsed.id));
            opts.onFavoritesChange?.(Array.from(favs));
          }
          opts.onSelectTimeframe(parsed.id);
          closePopup();
        }
      }
    });

    renderGrid();

    // 4. Footer (official Vela qsp-foot & qsp-key keyboard chips)
    const foot = document.createElement("div");
    foot.className = "quant-tfp-foot qsp-foot";

    const btnChart = document.createElement("button");
    btnChart.type = "button";
    btnChart.className = "qsp-key";
    btnChart.title = "Chart it";
    btnChart.setAttribute("aria-label", "Chart it");
    btnChart.innerHTML = "<kbd>↵</kbd>chart it";
    btnChart.addEventListener("click", () => {
      const q = input.value.trim();
      const parsed = parseCustom(q);
      if (parsed) {
        currentTf = parsed.id;
        opts.onSelectTimeframe(parsed.id);
        closePopup();
      } else {
        input.focus();
      }
    });

    const btnPin = document.createElement("button");
    btnPin.type = "button";
    btnPin.className = "qsp-key";
    btnPin.title = "Chart and pin";
    btnPin.setAttribute("aria-label", "Chart and pin");
    btnPin.innerHTML = "<kbd>⇧↵</kbd>chart and pin";
    btnPin.addEventListener("click", () => {
      const q = input.value.trim();
      const parsed = parseCustom(q);
      if (parsed) {
        currentTf = parsed.id;
        favs.add(toCanonical(parsed.id));
        opts.onFavoritesChange?.(Array.from(favs));
        opts.onSelectTimeframe(parsed.id);
        closePopup();
      } else {
        input.focus();
      }
    });

    const btnUp = document.createElement("button");
    btnUp.type = "button";
    btnUp.className = "qsp-key";
    btnUp.title = "Previous interval";
    btnUp.setAttribute("aria-label", "Previous interval");
    btnUp.innerHTML = "<kbd>↑</kbd>";
    btnUp.addEventListener("click", () => {
      const chips = Array.from(body.querySelectorAll<HTMLButtonElement>(".quant-tfp-chip, .quant-tfp-choose"));
      const focusedIdx = chips.findIndex((c) => c === document.activeElement);
      if (focusedIdx > 0) {
        chips[focusedIdx - 1]?.focus();
      } else if (chips.length > 0) {
        chips[chips.length - 1]?.focus();
      }
    });

    const btnDown = document.createElement("button");
    btnDown.type = "button";
    btnDown.className = "qsp-key";
    btnDown.setAttribute("data-pair", "");
    btnDown.title = "Next interval";
    btnDown.setAttribute("aria-label", "Next interval");
    btnDown.innerHTML = "<kbd>↓</kbd>move";
    btnDown.addEventListener("click", () => {
      const chips = Array.from(body.querySelectorAll<HTMLButtonElement>(".quant-tfp-chip, .quant-tfp-choose"));
      const focusedIdx = chips.findIndex((c) => c === document.activeElement);
      if (focusedIdx >= 0 && focusedIdx < chips.length - 1) {
        chips[focusedIdx + 1]?.focus();
      } else if (chips.length > 0) {
        chips[0]?.focus();
      }
    });

    foot.append(btnChart, btnPin, btnUp, btnDown);

    popup.append(svg, searchLabel, body, foot);

    // Position attached directly to topbar row
    const chartCard = container.closest<HTMLElement>(".vela-ui") || container.parentElement || document.body;
    const topbarRow = container.closest<HTMLElement>(".border-b") || container;
    const caretRect = caretEl.getBoundingClientRect();
    const cardRect = chartCard.getBoundingClientRect();

    popup.style.position = "absolute";
    // Place popup top flush with topbarRow bottom, overlapping 1px border
    const topbarHeight = topbarRow.offsetHeight || 39;
    popup.style.top = `${topbarHeight - 1}px`;

    const idealLeft = Math.round(caretRect.left - cardRect.left - 1);
    const maxLeft = Math.max(8, (chartCard.offsetWidth || cardRect.width) - 312);
    popup.style.left = `${Math.max(8, Math.min(maxLeft, idealLeft))}px`;
    popup.style.zIndex = "50";

    const updateOutline = () => {
      // Synchronize exact fill and border colors with topbar row
      pathFill.style.fill = "#151619";
      pathEdge.style.stroke = "var(--vela-border, #2a2b30)";

      const W = popup.offsetWidth || 296;
      const H = popup.offsetHeight || 271;
      const S = 16;
      const totalW = W + 2 * S;

      svg.setAttribute("viewBox", `0 -2 ${totalW} ${H + 2}`);

      // Replicating drawing tools Bézier logic: starts at (0, 0.5), curves down to (S, S+0.5),
      // goes around bottom with rounded corners (r=10), goes up to (totalW-S, S+0.5),
      // and curves outward back to (totalW, 0.5).
      const r = `M 0 0.5 Q ${S} 0.5 ${S} ${S + 0.5} V ${H - 10.5} Q ${S} ${H - 0.5} ${S + 10} ${H - 0.5} H ${totalW - S - 10} Q ${totalW - S} ${H - 0.5} ${totalW - S} ${H - 10.5} V ${S + 0.5} Q ${totalW - S} 0.5 ${totalW} 0.5`;

      // Fill covers topbar bottom border seamlessly by closing above y=0
      pathFill.setAttribute("d", `${r} L ${totalW} -2 L 0 -2 Z`);
      pathEdge.setAttribute("d", r);
    };

    onWindowResize = () => {
      if (!activePopup || !caretEl) return;
      const curCardRect = chartCard.getBoundingClientRect();
      const curCaretRect = caretEl.getBoundingClientRect();
      const curTop = (topbarRow.offsetHeight || 39) - 1;
      activePopup.style.top = `${curTop}px`;
      const curMaxLeft = Math.max(8, (chartCard.offsetWidth || curCardRect.width) - 312);
      const curIdealLeft = Math.round(curCaretRect.left - curCardRect.left - 1);
      activePopup.style.left = `${Math.max(8, Math.min(curMaxLeft, curIdealLeft))}px`;
    };
    window.addEventListener("resize", onWindowResize, { passive: true });

    chartCard.appendChild(popup);
    activePopup = popup;

    updateOutline();
    resizeObserver = new ResizeObserver(updateOutline);
    resizeObserver.observe(popup);

    setTimeout(() => {
      input.focus();
    }, 20);

    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    document.addEventListener("keydown", handleKeydown, true);
  }

  // Intercept caret click
  function onPointerDown(e: PointerEvent) {
    const target = e.target as Element | null;
    const caret = target?.closest<HTMLElement>(".vela-widget-tf-caret, #vela-topbar-tf");
    if (!caret || !container.contains(caret)) return;

    if (e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      if (activePopup) {
        closePopup();
      } else {
        openPopup();
      }
    }
  }

  function onClick(e: MouseEvent) {
    const target = e.target as Element | null;
    const caret = target?.closest<HTMLElement>(".vela-widget-tf-caret, #vela-topbar-tf");
    if (!caret || !container.contains(caret)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  container.addEventListener("pointerdown", onPointerDown, true);
  container.addEventListener("click", onClick, true);

  return () => {
    closePopup();
    container.removeEventListener("pointerdown", onPointerDown, true);
    container.removeEventListener("click", onClick, true);
  };
}
