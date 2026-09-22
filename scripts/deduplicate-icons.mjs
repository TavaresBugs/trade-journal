import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
  statSync,
  existsSync,
  rmdirSync,
} from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ICONS_ROOT = join(ROOT, "apps/web/public/assets/icons");
const MANIFEST_PATH = join(ROOT, "apps/web/src/lib/assets/tv-icons-manifest.json");

function getAllSvgFiles(dir) {
  let results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...getAllSvgFiles(fullPath));
    } else if (entry.endsWith(".svg")) {
      results.push(fullPath);
    }
  }
  return results;
}

// Canonical file priority: lower number = higher priority to be the retained canonical file
function getCanonicalPriority(fullPath) {
  const rel = fullPath.replace(/\\/g, "/");
  const base = basename(rel, ".svg").toLowerCase();

  // 1. Sovereign Country Flags (Foundational ISO-2 country codes ALWAYS win over all other categories)
  if (rel.includes("/flags/")) {
    const sovereignNations = new Set([
      "fr",
      "no",
      "us",
      "br",
      "jp",
      "gb",
      "eu",
      "cn",
      "de",
      "ca",
      "au",
      "ch",
      "nz",
      "za",
      "mx",
      "in",
      "kr",
      "sg",
      "es",
      "it",
      "nl",
      "se",
      "hk",
    ]);
    if (sovereignNations.has(base)) return 1;
    if (base.length === 2) return 2; // standard ISO-2 country code
    return 6; // 3-letter currency code (e.g. usd, brl, eur)
  }

  // 2. Core Indices & Commodities (Branded market assets)
  if (rel.includes("/indices/")) return 10;
  if (rel.includes("/commodities/")) return 15;

  // 3. Funds & ETFs (Dedicated fund managers & benchmark ETFs)
  if (rel.includes("/funds/")) {
    const flagshipFunds = new Set([
      "spy",
      "qqq",
      "voo",
      "ivv",
      "tqqq",
      "smh",
      "arkk",
      "uso",
      "hash11",
      "xlf",
      "xle",
      "xlk",
      "xlv",
      "xli",
      "xlp",
      "xlu",
      "xlb",
      "xlre",
      "xlc",
    ]);
    if (flagshipFunds.has(base)) return 20;
    return 25;
  }

  // 3.5 Brazilian Flagship Equities (Home market primary listing beats US ADRs)
  if (rel.includes("/b3/")) {
    const majorB3 = new Set([
      "petr4",
      "vale3",
      "itub4",
      "bbas3",
      "ggbr4",
      "klbn4",
      "sapr4",
      "taee11",
      "embr3",
    ]);
    if (majorB3.has(base)) return 28; // beats stocks/ (30)
    if (base.endsWith("f")) return 45; // fractional lot
    return 42;
  }

  // 4. Primary US Stocks (Equities)
  if (rel.includes("/stocks/")) {
    return 30;
  }

  // 6. Native Crypto
  if (rel.includes("/crypto/")) {
    const isDerivative =
      base.includes("-p") ||
      base.includes("c-p") ||
      base.includes("eth") ||
      base.includes("sol") ||
      base.includes("jpy") ||
      base.includes("krw") ||
      base.includes("thb") ||
      base.includes("try");
    if (isDerivative) return 55;
    return 50;
  }

  // 7. Brokers and Exchanges
  if (rel.includes("/brokers/")) return 60;
  if (rel.includes("/exchanges/")) return 70;

  // 8. Default and Fallbacks
  if (rel.includes("/default/")) return 90;

  return 100;
}

function deduplicate() {
  console.log("=== TradeJournal SVG Icon SHA-256 Deduplication & Catalog Sanitization ===\n");

  // ----------------------------------------------------
  // Step 1: Catalog Sanitization (De-polluting categories)
  // ----------------------------------------------------
  console.log("[1/5] Sanitizing Catalog Categories...");
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

  const stockKeys = new Set(Object.keys(manifest.stocks || {}));
  const fundKeys = new Set(Object.keys(manifest.funds || {}));
  const indexKeys = new Set(Object.keys(manifest.indices || {}));
  const commodityKeys = new Set(Object.keys(manifest.commodities || {}));

  // Known non-crypto items that leak into crypto via perpetual futures
  const nonCryptoExclusions = new Set([
    // ETFs & Indices
    "QQQ",
    "SOXL",
    "SPCX",
    "KORU",
    "TOTAL",
    "TOTAL2",
    "TOTAL3",
    "TOTAL3ES",
    "TOTALES",
    "US100",
    "US500",
    "SPX",
    "DXY",
    "NDX",
    // Synthetic Stocks
    "MSTR",
    "MU",
    "CVX",
    "CRCL",
    "SNDK",
    "SKHYNIX",
    "AAPL",
    "NVDA",
    "TSLA",
    "MSFT",
    "AMZN",
    // Commodity perps
    "CL",
    "XTI",
    "XAG",
    "XAU",
    "GOLD",
    "SILVER",
    "NATGAS",
  ]);

  let removedCryptoCount = 0;
  for (const [coin, data] of Object.entries(manifest.crypto || {})) {
    const isExcluded =
      nonCryptoExclusions.has(coin) ||
      coin.endsWith(".P") ||
      coin.startsWith("1000") ||
      coin.includes("TOTAL") ||
      (stockKeys.has(coin) && !["BTC", "ETH", "SOL", "STX", "DASH", "QNT"].includes(coin)) ||
      fundKeys.has(coin) ||
      indexKeys.has(coin) ||
      commodityKeys.has(coin);

    if (isExcluded) {
      delete manifest.crypto[coin];
      removedCryptoCount++;
    }
  }
  console.log(
    `✓ Removed ${removedCryptoCount} contaminated/synthetic entries from manifest.crypto`,
  );

  // ----------------------------------------------------
  // Step 2: Compute SHA-256 Hashes of all SVGs
  // ----------------------------------------------------
  console.log("\n[2/5] Computing SHA-256 hashes of all SVG files...");
  const allFiles = getAllSvgFiles(ICONS_ROOT);
  const hashMap = new Map(); // sha256 -> [fullPath1, fullPath2, ...]

  for (const file of allFiles) {
    const content = readFileSync(file);
    const sha = createHash("sha256").update(content).digest("hex");
    if (!hashMap.has(sha)) {
      hashMap.set(sha, []);
    }
    hashMap.get(sha).push(file);
  }

  console.log(
    `Scanned ${allFiles.length} files. Found ${hashMap.size} unique SHA-256 content hashes.`,
  );

  // ----------------------------------------------------
  // Step 3: Determine Canonical Files & Delete Duplicate Files
  // ----------------------------------------------------
  console.log("\n[3/5] Resolving canonical paths & deleting redundant duplicate files...");
  const fileRemap = new Map(); // oldRelPath -> canonicalRelPath
  let deletedFilesCount = 0;
  let savedBytes = 0;

  for (const [sha, group] of hashMap.entries()) {
    if (group.length <= 1) continue;

    // Sort to determine single canonical file
    group.sort((a, b) => {
      const pa = getCanonicalPriority(a);
      const pb = getCanonicalPriority(b);
      if (pa !== pb) return pa - pb;
      if (a.length !== b.length) return a.length - b.length;
      return a.localeCompare(b);
    });

    const canonicalFile = group[0];
    const duplicates = group.slice(1);

    const canonicalRel = canonicalFile.replace(ROOT, "").replace(/^\/apps\/web\/public/, "");

    for (const dupFile of duplicates) {
      const dupRel = dupFile.replace(ROOT, "").replace(/^\/apps\/web\/public/, "");
      fileRemap.set(dupRel, canonicalRel);

      const size = statSync(dupFile).size;
      savedBytes += size;
      unlinkSync(dupFile);
      deletedFilesCount++;
    }
  }

  console.log(
    `✓ Deleted ${deletedFilesCount} redundant SVG files (${(savedBytes / 1024).toFixed(1)} KB freed).`,
  );

  // ----------------------------------------------------
  // Step 4: Update Manifest to Canonical Paths
  // ----------------------------------------------------
  console.log("\n[4/5] Updating tv-icons-manifest.json references...");
  let remappedManifestEntries = 0;

  function remapCategory(cat) {
    if (!cat) return;
    for (const [key, entry] of Object.entries(cat)) {
      if (entry && entry.icon && fileRemap.has(entry.icon)) {
        entry.icon = fileRemap.get(entry.icon);
        remappedManifestEntries++;
      }
    }
  }

  remapCategory(manifest.flags);
  remapCategory(manifest.indices);
  remapCategory(manifest.commodities);
  remapCategory(manifest.crypto);
  remapCategory(manifest.stocks);
  remapCategory(manifest.b3);
  remapCategory(manifest.funds);
  remapCategory(manifest.brokers);
  remapCategory(manifest.exchanges);

  // ----------------------------------------------------
  // Step 5: Clean Unreferenced Orphan Derivative/Excluded Files
  // ----------------------------------------------------
  console.log("\n[5/5] Checking for unreferenced orphan derivative files...");
  const activeReferencedIcons = new Set();
  for (const cat of Object.values(manifest)) {
    if (typeof cat === "object" && cat !== null) {
      for (const entry of Object.values(cat)) {
        if (entry?.icon) activeReferencedIcons.add(entry.icon);
      }
    }
  }

  // Also include static assets from asset-icons.ts
  const staticActive = [
    "/assets/icons/indices/nasdaq-100.svg",
    "/assets/icons/indices/sp500.svg",
    "/assets/icons/indices/dow-jones.svg",
    "/assets/icons/indices/russell-2000.svg",
    "/assets/icons/indices/us-dollar-index.svg",
    "/assets/icons/commodities/gold.svg",
    "/assets/icons/commodities/silver.svg",
    "/assets/icons/commodities/crude-oil.svg",
    "/assets/icons/commodities/natural-gas.svg",
    "/assets/icons/commodities/copper.svg",
    "/assets/icons/flags/us.svg",
    "/assets/icons/flags/eu.svg",
    "/assets/icons/flags/gb.svg",
    "/assets/icons/flags/jp.svg",
    "/assets/icons/fallback.svg",
  ];
  for (const p of staticActive) activeReferencedIcons.add(p);

  const remainingFiles = getAllSvgFiles(ICONS_ROOT);
  let orphanCount = 0;
  for (const file of remainingFiles) {
    const rel = file.replace(ROOT, "").replace(/^\/apps\/web\/public/, "");
    // Only prune orphaned derivatives from crypto/ or default/
    if (
      (rel.includes("/crypto/") || rel.includes("/default/")) &&
      !activeReferencedIcons.has(rel)
    ) {
      unlinkSync(file);
      orphanCount++;
    }
  }
  if (orphanCount > 0) {
    console.log(`✓ Cleaned ${orphanCount} unreferenced orphan derivative SVGs.`);
  }

  // Check if default directory is empty and remove if so
  const defaultDir = join(ICONS_ROOT, "default");
  if (existsSync(defaultDir) && readdirSync(defaultDir).length === 0) {
    rmdirSync(defaultDir);
    console.log("✓ Removed empty default/ directory.");
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
  console.log(
    `✓ Remapped ${remappedManifestEntries} manifest references to their canonical files.`,
  );
  console.log(`✓ Updated manifest saved to ${MANIFEST_PATH}`);

  const finalFiles = getAllSvgFiles(ICONS_ROOT);
  console.log(`✓ Final unique physical SVG files on disk: ${finalFiles.length}`);
  console.log("\n=== Deduplication & Sanitization Complete! ===");
}

deduplicate();
