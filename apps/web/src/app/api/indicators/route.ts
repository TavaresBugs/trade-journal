import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CATALOG_PATH = path.join(process.cwd(), "..", "..", "data", "indicators", "catalog.json");
const ALT_CATALOG_PATH = path.join(process.cwd(), "data", "indicators", "catalog.json");

function getCatalog() {
  let fileToRead = CATALOG_PATH;
  if (!fs.existsSync(fileToRead)) {
    fileToRead = ALT_CATALOG_PATH;
  }
  if (!fs.existsSync(fileToRead)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(fileToRead, "utf-8"));
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") || "").trim().toLowerCase();
  const family = (searchParams.get("family") || "").trim().toLowerCase();
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 1000);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  const catalog = getCatalog();
  if (!catalog || !Array.isArray(catalog.indicators)) {
    return NextResponse.json({
      total: 0,
      indicators: [],
      families: [],
      concepts: [],
    });
  }

  let items = catalog.indicators;

  // Filtro por família
  if (family && family !== "all") {
    items = items.filter((ind: any) => {
      const famKey = (ind.family || ind.displayFamily || "").toLowerCase();
      const famList = Array.isArray(ind.families) ? ind.families.map((f: string) => f.toLowerCase()) : [];
      return famKey === family || famList.includes(family);
    });
  }

  // Filtro por texto de busca (nome, descrição, tags, conceitos)
  if (query) {
    items = items.filter((ind: any) => {
      const name = (ind.name || "").toLowerCase();
      const desc = (ind.description || "").toLowerCase();
      const slug = (ind.slug || "").toLowerCase();
      const tags = Array.isArray(ind.tags) ? ind.tags.map((t: any) => (t.name || "").toLowerCase()).join(" ") : "";
      const concepts = Array.isArray(ind.concepts) ? ind.concepts.map((c: any) => (c.name || c.slug || "").toLowerCase()).join(" ") : "";
      return name.includes(query) || desc.includes(query) || slug.includes(query) || tags.includes(query) || concepts.includes(query);
    });
  }

  const paginated = items.slice(offset, offset + limit);

  return NextResponse.json({
    total: items.length,
    offset,
    limit,
    families: catalog.families || [],
    concepts: catalog.concepts || [],
    indicators: paginated,
  });
}
