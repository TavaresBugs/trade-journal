/*
 * The chart's indicator browser, inside the dialog that draft-indicator-library.ts opens.
 * Plain DOM rendered in place: a keystroke re-renders the results, a selection updates
 * only the highlighted row and the detail panel. Built-ins (Basic, Order flow, My scripts)
 * come from the chart over postMessage, Library scripts from library-data.js plus the
 * newest releases fetched live.
 */
"use strict";

const CHANNEL = "quant-draft-library";
const D = window.LIBRARY_DATA;
const library = new Map(D.indicators.map((item) => [item.slug, item]));
const builtins = new Map();
const concepts = new Map(D.concepts.map((concept) => [concept.slug, concept]));
const familyByKey = new Map(D.families.map((family) => [family.key, family]));

const state = {
  mode: "discover",
  family: null,
  cluster: null,
  concept: null,
  query: "",
  sort: "recent",
  layout: "grid",
  limit: 24,
  selected: null,
  favoriteIds: new Set(),
  added: new Set(),
  pending: new Set(),
  personal: { loaded: false, error: null },
  promptAvailable: false,
};
/** Ids in the order they are shown, for arrow keys. */
let visibleIds = [];

const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const PATHS = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  star: '<path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1 6.2-5.6-2.9-5.6 2.9 1-6.2L3.2 9.6l6.2-.9z"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  wave: '<path d="M2 12c3-8 5-8 7 0s4 8 7 0 4-8 6-4"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  bars: '<path d="M5 20V10M10 20V4M15 20v-7M20 20V8"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  arrow: '<path d="m9 6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  shuffle: '<path d="M16 4h4v4M4 20l16-16M20 16v4h-4M15 15l5 5M4 4l5 5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] ?? PATHS.layers}</svg>`;
const familyIcon = (key) =>
  key === "trend"
    ? "trend"
    : ["momentum", "volatility", "statistics", "machine-learning"].includes(key)
      ? "wave"
      : key === "volume-orderflow"
        ? "bars"
        : ["levels", "risk-exits", "smc-ict", "market-structure"].includes(key)
          ? "target"
          : "layers";
const familyLabel = (key) => familyByKey.get(key)?.pillLabel ?? "Other";
const GROUP_LABEL = { basic: "Basic", orderflow: "Order flow", personal: "My scripts" };
const dateLabel = (date) =>
  date
    ? new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";
const highlight = (text) => {
  const query = state.query.trim();
  if (!query) return esc(text);
  const pattern = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  return String(text ?? "")
    .split(pattern)
    .map((part) => (part.toLowerCase() === query.toLowerCase() ? `<mark>${esc(part)}</mark>` : esc(part)))
    .join("");
};
const firstSentence = (text) => {
  const sentence = String(text ?? "").split(/(?<=[.!?])\s/)[0] ?? "";
  const trimmed = sentence.replace(/^The .+? indicator /i, "").replace(/^This indicator /i, "");
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

/* ---------- Items ---------- */

const itemById = (id) => builtins.get(id) ?? library.get(id);
const isBuiltin = (item) => !!item?.group;
const favoriteIdOf = (item) => item.favoriteId ?? `slug:${item.slug}`;
const isFavorite = (item) => state.favoriteIds.has(favoriteIdOf(item));
// Built-ins are keyed by their chart id (`native:rsi`), Library scripts by slug.
const idOf = (item) => (isBuiltin(item) ? item.id : item.slug);

// Precomputed search text, so a keystroke only scans strings.
const haystack = new WeakMap();
function searchText(item) {
  let text = haystack.get(item);
  if (text === undefined) {
    text = [
      item.name,
      item.shortTitle,
      item.summary,
      item.description,
      item.section,
      isBuiltin(item) ? GROUP_LABEL[item.group] : familyLabel(item.displayFamily),
      ...(item.tags ?? []).map((tag) => tag.name),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    haystack.set(item, text);
  }
  return text;
}
const conceptText = (concept) =>
  `${concept.name} ${concept.slug} ${concept.aliases.join(" ")} ${concept.cluster ?? ""}`.toLowerCase();

const familyMatch = (item, key) => !key || (item.families ?? []).includes(key);
const newestFirst = (a, b) =>
  (b.creationDateDisplayed ?? "").localeCompare(a.creationDateDisplayed ?? "") || a.name.localeCompare(b.name);
const byName = (a, b) => a.name.localeCompare(b.name);

function libraryResults() {
  const query = state.query.trim().toLowerCase();
  const matchedConcepts = query
    ? new Set(D.concepts.filter((concept) => conceptText(concept).includes(query)).map((concept) => concept.slug))
    : null;
  const list = [];
  for (const item of library.values()) {
    if (!familyMatch(item, state.family)) continue;
    if (state.concept && !concepts.get(state.concept)?.indicators.includes(item.slug)) continue;
    if (state.cluster && !(item.concepts ?? []).some((c) => concepts.get(c.slug)?.cluster === state.cluster)) continue;
    if (query && !searchText(item).includes(query) && !(item.concepts ?? []).some((c) => matchedConcepts.has(c.slug)))
      continue;
    list.push(item);
  }
  return list.sort(state.sort === "name" ? byName : newestFirst);
}

function builtinResults(group, { ignoreQuery = false } = {}) {
  const query = ignoreQuery ? "" : state.query.trim().toLowerCase();
  return [...builtins.values()].filter(
    (item) => (!group || item.group === group) && (!query || searchText(item).includes(query)),
  );
}

function favoriteResults() {
  const all = [...builtins.values(), ...library.values()];
  return all.filter(isFavorite).sort(byName);
}

function conceptResults() {
  const query = state.query.trim().toLowerCase();
  return D.concepts
    .filter(
      (concept) =>
        (!state.family || concept.family === state.family) &&
        (!query || `${conceptText(concept)} ${concept.blurb ?? ""}`.toLowerCase().includes(query)),
    )
    .sort((a, b) => b.indicators.length - a.indicators.length);
}

/* ---------- Discovery ---------- */

const DISCOVERY_KEY = "vela-discovery-v1";
let discovery = { seen: {}, interests: {}, previous: [] };
try {
  const saved = JSON.parse(localStorage.getItem(DISCOVERY_KEY) || "null");
  if (saved && typeof saved === "object") {
    const counts = (record) =>
      Object.fromEntries(
        Object.entries(record && typeof record === "object" && !Array.isArray(record) ? record : {}).filter(
          ([, value]) => typeof value === "number" && Number.isFinite(value) && value >= 0,
        ),
      );
    discovery = {
      seen: counts(saved.seen),
      interests: counts(saved.interests),
      previous: Array.isArray(saved.previous) ? saved.previous.filter((slug) => typeof slug === "string") : [],
    };
  }
} catch {
  /* Private browsing may disable storage. */
}
let picks = [];
let openedId = null;
let liveFetchedAt = 0;
const saveDiscovery = () => {
  try {
    localStorage.setItem(DISCOVERY_KEY, JSON.stringify(discovery));
  } catch {
    /* The session still works. */
  }
};
function noteInterest(family) {
  if (!familyByKey.has(family)) return;
  discovery.interests[family] = Math.min(6, (discovery.interests[family] || 0) + 1);
  saveDiscovery();
}
function refreshPicks(record = true) {
  const interests = { ...discovery.interests };
  const favoriteSlugs = [...state.favoriteIds].filter((id) => id.startsWith("slug:")).map((id) => id.slice(5));
  for (const slug of favoriteSlugs) {
    const item = library.get(slug);
    if (item) interests[item.displayFamily] = Math.max(interests[item.displayFamily] || 0, 5);
  }
  picks = window.LIBRARY_DISCOVERY.select([...library.values()], {
    ...discovery,
    interests,
    favorites: favoriteSlugs,
  }).picks;
  if (record) {
    for (const item of picks) discovery.seen[item.slug] = (discovery.seen[item.slug] || 0) + 1;
    discovery.previous = picks.map((item) => item.slug);
    saveDiscovery();
  }
}
async function onOpened(id) {
  if (id === openedId) return;
  openedId = id;
  refreshPicks();
  renderResults();
  if (Date.now() - liveFetchedAt < 300_000) return;
  liveFetchedAt = Date.now();
  try {
    const response = await fetch("/api/quant/prod-library/api/library/indicators/query?pageIndex=0&pageQuantity=12");
    if (!response.ok) return;
    const data = await response.json();
    if (!Array.isArray(data?.data?.indicators)) return;
    for (const row of data.data.indicators) {
      if (!row.isPublished || typeof row.slug !== "string" || typeof row.name !== "string") continue;
      const old = library.get(row.slug);
      library.set(row.slug, {
        ...old,
        slug: row.slug,
        name: row.name,
        description: typeof row.description === "string" ? row.description : (old?.description ?? ""),
        imageUrl: typeof row.imageUrl === "string" ? row.imageUrl : (old?.imageUrl ?? ""),
        creationDateDisplayed: row.creationDateDisplayed || old?.creationDateDisplayed || "",
        displayFamily: row.family || old?.displayFamily || "uncategorized",
        families: old?.families ?? (row.family ? [row.family] : []),
        tags: old?.tags ?? [],
        concepts: old?.concepts ?? [],
      });
    }
    renderNav();
    renderResults();
  } catch {
    /* Keep the bundled catalog when offline. */
  }
}

/* ---------- Rendering ---------- */

const thumb = (item, cls) =>
  item.imageUrl && (/^https?:\/\//.test(item.imageUrl) || item.imageUrl.startsWith("/"))
    ? `<img class="${cls}" src="${esc(item.imageUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : "";
const starButton = (item) =>
  `<button class="star" data-star="${esc(idOf(item))}" aria-label="${isFavorite(item) ? "Remove from favorites" : "Add to favorites"}: ${esc(item.name)}" aria-pressed="${isFavorite(item)}">${icon("star")}</button>`;
const placement = (item) =>
  item.overlay === undefined ? "" : `<span class="tag">${item.overlay ? "On chart" : "Pane"}</span>`;

/** A built-in: name and what it plots, no picture. */
function builtinRow(item) {
  const id = idOf(item);
  return `<div class="row builtin" data-id="${esc(id)}" ${item.supported === false ? 'data-unsupported="true"' : ""}>
    <button class="row-main" data-select="${esc(id)}" aria-label="${esc(item.name)}">
      <span class="row-title"><strong>${highlight(item.name)}</strong>${item.shortTitle && item.shortTitle !== item.name ? `<small>${esc(item.shortTitle)}</small>` : ""}${item.beta ? '<span class="tag beta">Beta</span>' : ""}</span>
      <span class="row-summary">${highlight(item.summary || (item.group === "personal" ? "Your script" : `${GROUP_LABEL[item.group] ?? "Built-in"} indicator`))}</span>
    </button>
    ${placement(item)}${starButton(item)}
  </div>`;
}

/** A Library script in list layout: a small preview, the name and its first sentence. */
function libraryRow(item) {
  const id = idOf(item);
  return `<div class="row" data-id="${esc(id)}">
    ${thumb(item, "row-thumb") || '<span class="row-thumb"></span>'}
    <button class="row-main" data-select="${esc(id)}" aria-label="${esc(item.name)}">
      <span class="row-title"><strong>${highlight(item.name)}</strong></span>
      <span class="row-summary">${highlight(firstSentence(item.description))}</span>
    </button>
    <span class="row-meta">${esc(familyLabel(item.displayFamily))}${item.creationDateDisplayed ? ` · ${esc(dateLabel(item.creationDateDisplayed))}` : ""}</span>
    ${starButton(item)}
  </div>`;
}

/** A Library script in grid layout. */
function libraryCard(item, label) {
  const id = idOf(item);
  return `<article class="card" data-id="${esc(id)}">
    <button class="card-main" data-select="${esc(id)}" aria-label="${esc(item.name)}">
      <span class="card-image">${thumb(item, "")}</span>
      <span class="card-copy">
        ${label ? `<span class="card-label">${esc(label)}</span>` : ""}
        <strong>${esc(item.name)}</strong>
        <span>${esc(familyLabel(item.displayFamily))}${item.creationDateDisplayed ? ` · ${esc(dateLabel(item.creationDateDisplayed))}` : ""}</span>
      </span>
    </button>
    ${starButton(item)}
  </article>`;
}

function conceptRow(concept) {
  return `<button class="concept" data-concept="${esc(concept.slug)}" data-id="concept:${esc(concept.slug)}">
    <span class="concept-copy"><strong>${highlight(concept.name)}</strong><span>${esc(concept.aliases.length ? concept.aliases.slice(0, 3).join(" · ") : (concept.cluster ?? familyLabel(concept.family)))}</span></span>
    <span class="row-meta">${concept.indicators.length} ${concept.indicators.length === 1 ? "script" : "scripts"}</span>
    ${icon("arrow")}
  </button>`;
}

const sectionHead = (title, count, action = "") =>
  `<div class="section-head"><h2>${esc(title)}${count !== undefined ? ` <span>${count}</span>` : ""}</h2>${action}</div>`;

function renderHome() {
  const latest = window.LIBRARY_DISCOVERY.newest([...library.values()]).slice(0, 3);
  if (!picks.length) refreshPicks(false);
  const ids = [...latest, ...picks].map(idOf);
  return {
    ids,
    html: `${sectionHead("New releases", undefined, '<button class="text-button" data-mode="indicators">See all</button>')}
      <div class="grid three">${latest.map((item) => libraryCard(item, "New")).join("")}</div>
      ${sectionHead("More to explore", undefined, `<button class="text-button" data-shuffle>${icon("shuffle")}Shuffle</button>`)}
      <div class="grid three">${picks.map((item) => libraryCard(item)).join("")}</div>
      ${sectionHead("Families")}
      <div class="families">${D.families
        .map(
          (family) =>
            `<button class="family-tile" data-family="${esc(family.key)}">${icon(familyIcon(family.key))}<span><strong>${esc(family.pillLabel)}</strong><small>${familyCounts.get(family.key) ?? 0} scripts</small></span></button>`,
        )
        .join("")}</div>`,
  };
}

/** Built-ins grouped by the guide's sections, in its order. */
function builtinSections(items) {
  const order = state.sectionOrder ?? [];
  const groups = new Map();
  for (const item of items) {
    const key = item.section ?? "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const keys = [...groups.keys()].sort(
    (a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999) || a.localeCompare(b),
  );
  const ids = [];
  const html = keys
    .map((key) => {
      const rows = groups.get(key).sort(byName);
      ids.push(...rows.map(idOf));
      return `<section class="builtin-section" aria-label="${esc(key)}"><h3>${esc(key)}</h3>${rows.map(builtinRow).join("")}</section>`;
    })
    .join("");
  return { ids, html };
}

const emptyMessage = (text, action = "") => `<div class="empty"><p>${esc(text)}</p>${action}</div>`;

function renderTop(title, count, extras = "") {
  $("#catalog-top").hidden = false;
  $("#catalog-top").innerHTML = `<div class="top-row"><h2>${esc(title)} <span>${count}</span></h2>${extras}</div>`;
}

function libraryControls() {
  return `<div class="controls">
    <div class="segmented" role="group" aria-label="Sort">
      <button data-sort="recent" aria-pressed="${state.sort === "recent"}">Newest</button>
      <button data-sort="name" aria-pressed="${state.sort === "name"}">A–Z</button>
    </div>
    <div class="segmented" role="group" aria-label="Layout">
      <button data-layout="grid" aria-pressed="${state.layout === "grid"}" aria-label="Grid">${icon("grid")}</button>
      <button data-layout="list" aria-pressed="${state.layout === "list"}" aria-label="List">${icon("list")}</button>
    </div>
  </div>`;
}

function renderResults() {
  const results = $("#results");
  const query = state.query.trim();
  let html = "";
  let ids = [];
  $("#catalog-top").hidden = true;

  if (query) {
    const matchedConcepts = conceptResults();
    const builtIn = builtinResults(null).sort(byName);
    const scripts = libraryResults();
    const shown = scripts.slice(0, state.limit);
    if (builtIn.length) {
      html += `<h3 class="group-label">Built-in <span>${builtIn.length}</span></h3>${builtIn.map(builtinRow).join("")}`;
      ids.push(...builtIn.map(idOf));
    }
    if (scripts.length) {
      html += `<h3 class="group-label">Library <span>${scripts.length}</span></h3>${shown.map(libraryRow).join("")}`;
      ids.push(...shown.map(idOf));
      if (scripts.length > shown.length) html += `<button class="more" data-more>Show more</button>`;
    }
    if (matchedConcepts.length) {
      html += `<h3 class="group-label">Concepts <span>${matchedConcepts.length}</span></h3>${matchedConcepts.slice(0, 5).map(conceptRow).join("")}`;
      if (matchedConcepts.length > 5)
        html += `<button class="more" data-mode="concepts" data-keep-query>All ${matchedConcepts.length} concepts</button>`;
    }
    if (!html)
      html = emptyMessage(
        `Nothing matches “${query}”.`,
        '<button class="text-button" data-clear>Clear search</button>',
      );
  } else if (state.mode === "discover") {
    ({ ids, html } = renderHome());
  } else if (state.mode === "basic" || state.mode === "orderflow") {
    const items = builtinResults(state.mode);
    renderTop(GROUP_LABEL[state.mode], items.length);
    ({ ids, html } = builtinSections(items));
    if (!items.length) html = emptyMessage("Built-in indicators are loading.");
  } else if (state.mode === "personal") {
    const items = builtinResults("personal").sort(byName);
    renderTop("My scripts", items.length);
    ids = items.map(idOf);
    html = items.length
      ? items.map(builtinRow).join("")
      : state.personal.error
        ? emptyMessage(state.personal.error, '<button class="text-button" data-retry-personal>Try again</button>')
        : emptyMessage(
            state.personal.loaded ? "Scripts you save from Quant or the editor show up here." : "Loading your scripts…",
          );
  } else if (state.mode === "favorites") {
    const items = favoriteResults();
    renderTop("Favorites", items.length);
    ids = items.map(idOf);
    html = items.length
      ? items.map((item) => (isBuiltin(item) ? builtinRow(item) : libraryRow(item))).join("")
      : emptyMessage("Star an indicator to keep it here.");
  } else if (state.mode === "concepts") {
    const items = conceptResults();
    renderTop(state.family ? `${familyLabel(state.family)} concepts` : "Concepts", items.length);
    const shown = items.slice(0, state.limit);
    html =
      shown.map(conceptRow).join("") +
      (items.length > shown.length ? `<button class="more" data-more>Show more</button>` : "");
  } else {
    const items = libraryResults();
    const family = state.family ? familyByKey.get(state.family) : null;
    const concept = state.concept ? concepts.get(state.concept) : null;
    const clusters = family
      ? [...new Set(D.concepts.filter((c) => c.family === family.key && c.cluster).map((c) => c.cluster))]
      : [];
    const chips = clusters.length
      ? `<div class="chips"><button data-cluster="" aria-pressed="${!state.cluster}">All</button>${clusters
          .map(
            (cluster) =>
              `<button data-cluster="${esc(cluster)}" aria-pressed="${state.cluster === cluster}">${esc(cluster)}</button>`,
          )
          .join("")}</div>`
      : "";
    renderTop(concept ? concept.name : family ? family.pillLabel : "All scripts", items.length, libraryControls());
    if (chips) $("#catalog-top").insertAdjacentHTML("beforeend", chips);
    const shown = items.slice(0, state.limit);
    ids = shown.map(idOf);
    html =
      (state.layout === "grid"
        ? `<div class="grid">${shown.map((item) => libraryCard(item)).join("")}</div>`
        : shown.map(libraryRow).join("")) +
      (items.length > shown.length
        ? `<button class="more" data-more>Show more · ${shown.length} of ${items.length}</button>`
        : "");
    if (!items.length) html = emptyMessage("No scripts in this view yet.");
  }

  visibleIds = ids;
  results.innerHTML = html;
  // A search or a new list starts on its first result, so Enter adds the top match.
  if (!state.selected || (query && !ids.includes(state.selected)) || !itemById(state.selected)) {
    state.selected = ids[0] ?? state.selected;
  }
  markSelection();
  renderDetail();
}

const familyCounts = new Map();
function countFamilies() {
  familyCounts.clear();
  for (const item of library.values())
    for (const key of item.families ?? []) familyCounts.set(key, (familyCounts.get(key) ?? 0) + 1);
}

function renderNav() {
  countFamilies();
  $("#families").innerHTML = D.families
    .map(
      (family) =>
        `<button class="nav-item" data-family="${esc(family.key)}" aria-pressed="${state.mode === "indicators" && state.family === family.key && !state.query}">${icon(familyIcon(family.key))}<span>${esc(family.pillLabel)}</span><small>${familyCounts.get(family.key) ?? 0}</small></button>`,
    )
    .join("");
  for (const button of document.querySelectorAll(".sections [data-mode]")) {
    button.setAttribute(
      "aria-pressed",
      String(!state.query && button.dataset.mode === state.mode && !state.family && !state.concept),
    );
  }
  const set = (selector, value) => {
    const node = $(selector);
    if (node) node.textContent = value;
  };
  set("#favorite-total", state.favoriteIds.size || "");
  set("#basic-total", builtinResults("basic", { ignoreQuery: true }).length || "");
  set("#orderflow-total", builtinResults("orderflow", { ignoreQuery: true }).length || "");
  set("#indicator-total", library.size);
  set("#concept-total", D.concepts.length);
  set(
    "#selection-count",
    `${library.size} scripts · newest ${dateLabel(
      [...library.values()]
        .map((item) => item.creationDateDisplayed)
        .filter(Boolean)
        .sort()
        .at(-1),
    )}`,
  );
}

function markSelection() {
  for (const node of document.querySelectorAll("#results [data-id].selected")) node.classList.remove("selected");
  if (!state.selected) return;
  for (const node of document.querySelectorAll(`#results [data-id="${CSS.escape(state.selected)}"]`))
    node.classList.add("selected");
}

function inputsList(item) {
  if (!item.inputs?.length) return "";
  return `<dl class="inputs">${item.inputs.map((input) => `<div><dt>${esc(input.label)}</dt><dd>${esc(input.value)}</dd></div>`).join("")}</dl>`;
}

function actions(item) {
  const id = idOf(item);
  const unsupported = item.supported === false;
  const busy = state.pending.has(id);
  return `<div class="detail-actions">
    <button class="primary" data-add="${esc(id)}" ${unsupported || busy ? "disabled" : ""}>${busy ? "Adding…" : state.added.has(id) ? "Add again" : "Add to chart"}</button>
    <div class="secondary">
      <button data-star="${esc(id)}" aria-pressed="${isFavorite(item)}">${icon("star")}${isFavorite(item) ? "Favorited" : "Favorite"}</button>
    </div>
  </div>`;
}

function renderDetail() {
  const host = $("#detail");
  const id = state.selected;
  if (id?.startsWith("concept:")) {
    const concept = concepts.get(id.slice(8));
    if (!concept) return void (host.innerHTML = "");
    const implementations = concept.indicators.map((slug) => library.get(slug)).filter(Boolean);
    host.innerHTML = `<div class="detail-body">
      <button class="back" data-close-detail>${icon("back")}Back</button>
      <p class="eyebrow">${esc(familyLabel(concept.family))}${concept.cluster ? ` · ${esc(concept.cluster)}` : ""}</p>
      <h3>${esc(concept.name)}</h3>
      ${concept.blurb ? `<p class="lead">${esc(concept.blurb)}</p>` : ""}
      ${concept.aliases.length ? `<p class="aliases">Also called ${concept.aliases.map(esc).join(", ")}</p>` : ""}
      ${
        implementations.length
          ? `<h4>In the Library</h4><div class="related">${implementations
              .slice(0, 6)
              .map(
                (item) =>
                  `<button data-select="${esc(item.slug)}">${thumb(item, "")}<span>${esc(item.name)}</span>${icon("arrow")}</button>`,
              )
              .join("")}</div>`
          : ""
      }
    </div>
    ${implementations.length > 1 ? `<div class="detail-actions"><button class="primary" data-show-concept="${esc(concept.slug)}">Browse ${implementations.length} scripts</button></div>` : ""}`;
    return;
  }
  const item = id ? itemById(id) : null;
  if (!item) {
    host.innerHTML = `<p class="detail-empty">Select an indicator to see what it does.</p>`;
    return;
  }
  if (isBuiltin(item) && !item.imageUrl) {
    const where = item.overlay === undefined ? "" : item.overlay ? "Plots on the price chart" : "Opens in its own pane";
    host.innerHTML = `<div class="detail-body">
      <button class="back" data-close-detail>${icon("back")}Back</button>
      <p class="eyebrow">${esc(GROUP_LABEL[item.group] ?? "Built-in")}${item.section ? ` · ${esc(item.section)}` : ""}</p>
      <h3>${esc(item.name)}${item.beta ? ' <span class="tag beta">Beta</span>' : ""}</h3>
      ${item.summary ? `<p class="lead">${esc(item.summary)}</p>` : item.group === "personal" ? `<p class="lead">Your saved script.</p>` : ""}
      ${item.read ? `<h4>How it's read</h4><p>${esc(item.read)}</p>` : ""}
      ${where || item.inputs?.length ? `<h4>Defaults</h4>${where ? `<p class="where">${where}</p>` : ""}${inputsList(item)}` : ""}
      ${item.supported === false ? '<p class="notice">Not available for this market. Switch to a supported symbol to add it.</p>' : ""}
    </div>${actions(item)}`;
    return;
  }
  const libraryItem = isBuiltin(item) ? { ...library.get(item.librarySlug), ...item } : item;
  const slug = item.librarySlug ?? item.slug;
  host.innerHTML = `<div class="detail-body">
    <button class="back" data-close-detail>${icon("back")}Back</button>
    ${thumb(libraryItem, "detail-image")}
    <p class="eyebrow">${esc(isBuiltin(item) ? `${GROUP_LABEL[item.group]}${item.section ? ` · ${item.section}` : ""}` : familyLabel(item.displayFamily))}${libraryItem.creationDateDisplayed ? ` · ${esc(dateLabel(libraryItem.creationDateDisplayed))}` : ""}</p>
    <h3>${esc(item.name)}</h3>
    ${item.summary ? `<p class="lead">${esc(item.summary)}</p>` : ""}
    ${libraryItem.description ? `<p class="description">${esc(libraryItem.description)}</p>` : ""}
    ${item.read ? `<h4>How it's read</h4><p>${esc(item.read)}</p>` : ""}
    ${
      (libraryItem.tags ?? []).length
        ? `<div class="tags">${libraryItem.tags
            .slice(0, 5)
            .map((tag) => `<span class="tag">${esc(tag.name)}</span>`)
            .join("")}</div>`
        : ""
    }
    ${slug ? `<a class="library-link" href="https://www.luxalgo.com/library/indicator/${encodeURIComponent(slug)}/" target="_blank" rel="noreferrer">View in the Library${icon("external")}</a>` : ""}
  </div>${actions(item)}`;
}

/* ---------- Actions ---------- */

function post(type, extra = {}) {
  parent.postMessage({ channel: CHANNEL, type, ...extra }, location.origin);
}
function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 4000);
}
function requestAdd(id, keepOpen = false) {
  const item = itemById(id);
  if (!item || state.pending.has(id) || item.supported === false) return;
  state.pending.add(id);
  if (state.selected === id) renderDetail();
  post(isBuiltin(item) ? "add-item" : "add", isBuiltin(item) ? { id, keepOpen } : { slug: id, keepOpen });
}
function requestFavorite(id) {
  const item = itemById(id);
  if (item)
    post(isBuiltin(item) ? "favorite-item" : "favorite", isBuiltin(item) ? { id } : { slug: id, name: item.name });
}
function select(id, { scroll = false } = {}) {
  state.selected = id;
  markSelection();
  renderDetail();
  document.body.dataset.detailOpen = "true";
  if (scroll) document.querySelector(`#results [data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" });
}
function setMode(mode, { keepQuery = false } = {}) {
  state.mode = mode;
  state.family = null;
  state.cluster = null;
  state.concept = null;
  state.limit = 24;
  state.selected = null;
  if (!keepQuery) {
    state.query = "";
    $("#search").value = "";
  }
  if (mode === "personal") {
    state.personal = { loaded: false, error: null };
    post("personal-request");
  }
  document.body.dataset.detailOpen = "false";
  document.body.dataset.searching = String(!!state.query);
  renderNav();
  renderResults();
  $("#results").scrollTop = 0;
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const data = button.dataset;
  if (data.select) return select(data.select);
  if (data.concept) return select(`concept:${data.concept}`);
  if (data.star) return requestFavorite(data.star);
  if (data.add) return requestAdd(data.add);
  if (data.ask) {
    const item = itemById(data.ask);
    if (item) post("ask", { id: data.ask, name: item.name });
    return;
  }
  if ("closeDetail" in data) return void (document.body.dataset.detailOpen = "false");
  if ("shuffle" in data) {
    refreshPicks();
    return renderResults();
  }
  if ("retryPersonal" in data) return setMode("personal");
  if ("clear" in data) {
    state.query = "";
    $("#search").value = "";
    $("#search").focus();
    return setMode(state.mode);
  }
  if (data.mode) return setMode(data.mode, { keepQuery: "keepQuery" in data });
  if (data.family) {
    noteInterest(data.family);
    setMode("indicators");
    state.family = data.family;
    renderNav();
    return renderResults();
  }
  if (data.showConcept) {
    setMode("indicators");
    state.concept = data.showConcept;
    return renderResults();
  }
  if (data.cluster !== undefined && button.closest(".chips")) {
    state.cluster = data.cluster || null;
    state.limit = 24;
    return renderResults();
  }
  if (data.sort) {
    state.sort = data.sort;
    return renderResults();
  }
  if (data.layout) {
    state.layout = data.layout;
    return renderResults();
  }
  if ("more" in data) {
    state.limit += 48;
    return renderResults();
  }
});

// Results follow each keystroke on the next frame; keystrokes inside one frame render once.
let searchFrame = 0;
$("#search").addEventListener("input", (event) => {
  cancelAnimationFrame(searchFrame);
  const value = event.target.value;
  $("#clear-search").hidden = !value;
  searchFrame = requestAnimationFrame(() => {
    state.query = value;
    state.limit = 24;
    state.selected = null;
    document.body.dataset.searching = String(!!value.trim());
    document.body.dataset.detailOpen = "false";
    renderNav();
    renderResults();
    $("#results").scrollTop = 0;
  });
});
$("#clear-search").addEventListener("click", () => {
  $("#search").value = "";
  $("#search").dispatchEvent(new Event("input"));
  $("#search").focus();
});
$("#close-library").addEventListener("click", () => post("close"));

function move(delta) {
  if (!visibleIds.length) return;
  const index = visibleIds.indexOf(state.selected);
  const next = visibleIds[Math.max(0, Math.min(visibleIds.length - 1, (index < 0 ? -1 : index) + delta))];
  if (next) select(next, { scroll: true });
}
document.addEventListener("keydown", (event) => {
  const inField = event.target.matches("input, select, textarea");
  if (event.key === "Escape") {
    event.preventDefault();
    if (state.query) {
      $("#search").value = "";
      $("#search").dispatchEvent(new Event("input"));
    } else post("close");
    return;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    return move(event.key === "ArrowDown" ? 1 : -1);
  }
  if (event.key === "Enter" && state.selected && !state.selected.startsWith("concept:")) {
    // Enter on another card selects it, as a click would; on the selected one it adds.
    const card = event.target.closest("[data-select]");
    if (!inField && event.target.closest("button") && card?.dataset.select !== state.selected) return;
    event.preventDefault();
    return requestAdd(state.selected, event.shiftKey);
  }
  if (inField) return;
  if (event.key === "/") {
    event.preventDefault();
    $("#search").focus();
  } else if (event.key.toLowerCase() === "f" && state.selected && !state.selected.startsWith("concept:")) {
    event.preventDefault();
    requestFavorite(state.selected);
  }
});

/* ---------- Messages from the chart ---------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
}
try {
  applyTheme(parent.document.documentElement.classList.contains("dark") ? "dark" : "light");
} catch {
  applyTheme("dark");
}

window.addEventListener("message", (event) => {
  if (event.origin !== location.origin || event.source !== parent || event.data?.channel !== CHANNEL) return;
  const data = event.data;
  if (data.type === "theme") return applyTheme(data.theme);
  if (data.type === "opened") return void onOpened(data.id);
  if (data.type === "error") return toast(data.message);
  if (data.type === "catalog") {
    if (data.items) {
      // The chart sends its whole catalog each time; Library-backed built-ins borrow their
      // Library entry's picture and description.
      builtins.clear();
      for (const item of data.items) {
        const entry = item.librarySlug ? library.get(item.librarySlug) : null;
        builtins.set(
          item.id,
          entry
            ? {
                ...item,
                imageUrl: entry.imageUrl,
                description: entry.description,
                tags: entry.tags,
                creationDateDisplayed: entry.creationDateDisplayed,
              }
            : item,
        );
      }
    }
    if (data.sections) state.sectionOrder = data.sections;
    if (data.personalLoaded) state.personal = { loaded: true, error: null };
    if (data.personalError) state.personal = { loaded: true, error: data.personalError };
    if (typeof data.promptAvailable === "boolean") state.promptAvailable = data.promptAvailable;
    renderNav();
    return renderResults();
  }
  if (data.type === "favorites") {
    state.favoriteIds = new Set(data.ids || []);
    renderNav();
    for (const node of document.querySelectorAll("[data-star]")) {
      const item = itemById(node.dataset.star);
      if (item) node.setAttribute("aria-pressed", String(isFavorite(item)));
    }
    if (state.mode === "favorites") renderResults();
    else renderDetail();
    return;
  }
  if (data.type === "add-result" || data.type === "item-result") {
    const id = data.id || data.slug;
    if (!state.pending.delete(id)) return;
    if (!data.error) state.added.add(id);
    if (state.selected === id) renderDetail();
    toast(data.error || `${itemById(id)?.name || "Indicator"} added to the chart`);
  }
});

// Preload built-in catalog locally so Basic (80) and Order flow (17) are available immediately
(async () => {
  try {
    const res = await fetch("/draft-indicator-library/builtin-catalog.json");
    if (res.ok) {
      const data = await res.json();
      if (data.items && builtins.size === 0) {
        for (const item of data.items) {
          const entry = item.librarySlug ? library.get(item.librarySlug) : null;
          builtins.set(
            item.id,
            entry
              ? {
                  ...item,
                  imageUrl: entry.imageUrl,
                  description: entry.description,
                  tags: entry.tags,
                  creationDateDisplayed: entry.creationDateDisplayed,
                }
              : item,
          );
        }
        if (data.sections) state.sectionOrder = data.sections;
        renderNav();
        renderResults();
      }
    }
  } catch {}
})();

renderNav();
renderResults();
post("ready");
$("#search").focus();

