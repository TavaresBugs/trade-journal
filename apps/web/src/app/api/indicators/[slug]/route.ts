import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ROOT_DATA_DIR = path.resolve(process.cwd(), "..", "..", "data", "indicators");
const PINE_DIR = path.join(ROOT_DATA_DIR, "pine");
const CATALOG_PATH = path.join(ROOT_DATA_DIR, "catalog.json");

const REMOTE_BASE = "https://vela.luxalgo.com/api/quant/prod-library/api/library/indicators/by-slug";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  if (!slug) {
    return NextResponse.json({ error: "Slug required" }, { status: 400 });
  }

  // 1. Verifica no catálogo local
  let metadata: any = null;
  if (fs.existsSync(CATALOG_PATH)) {
    try {
      const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
      metadata = catalog.indicators?.find((i: any) => i.slug === slug);
    } catch {}
  }

  // 2. Verifica se o script Pine Script já existe localmente em disco
  const pineFile = path.join(PINE_DIR, `${slug}.pine`);
  if (fs.existsSync(pineFile)) {
    try {
      const pineCode = fs.readFileSync(pineFile, "utf-8");
      return NextResponse.json({
        slug,
        indicator: metadata || { slug, name: slug },
        pineScriptCode: pineCode,
        source: "local-cache",
      });
    } catch {}
  }

  // 3. Fallback JIT: busca em tempo real da LuxAlgo
  try {
    const resp = await fetch(`${REMOTE_BASE}/${encodeURIComponent(slug)}`, {
      headers: { "User-Agent": "TradeJournal/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      return NextResponse.json(
        { error: `Remote indicator fetch failed: HTTP ${resp.status}` },
        { status: resp.status }
      );
    }
    const json = await resp.json();
    const data = json?.data || json;
    const indicator = data?.indicator || metadata;
    const pineScriptCode = data?.pineScriptCode || indicator?.pineScriptCode;

    if (pineScriptCode && typeof pineScriptCode === "string") {
      // Salva localmente para próximas consultas
      try {
        if (!fs.existsSync(PINE_DIR)) {
          fs.mkdirSync(PINE_DIR, { recursive: true });
        }
        fs.writeFileSync(pineFile, pineScriptCode, "utf-8");
      } catch {}

      return NextResponse.json({
        slug,
        indicator: indicator || metadata,
        pineScriptCode,
        source: "jit-remote-cached",
      });
    }

    return NextResponse.json(
      { error: "No published Pine Script source available for this indicator" },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
