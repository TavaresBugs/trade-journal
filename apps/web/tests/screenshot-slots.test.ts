import { describe, it, expect } from "vitest";
import {
  TIMEFRAME_CONFIG,
  buildSlotKey,
  parseSlotKey,
  extractImageFromDataTransfer,
} from "../src/components/screenshots/screenshot-types";
import { attachments } from "../src/db/schema";
import { GET, POST } from "../src/app/api/attachments/route";
import { DELETE } from "../src/app/api/attachments/[id]/route";

describe("screenshot slots configurations", () => {
  it("defines the 8 standard timeframes (Monthly to M3/M1)", () => {
    const keys = TIMEFRAME_CONFIG.map((t) => t.key);
    expect(keys).toHaveLength(8);
    expect(keys).toEqual(["tfM", "tfW", "tfD", "tfH4", "tfH1", "tfM15", "tfM5", "tfM3"]);
    expect(TIMEFRAME_CONFIG.find((t) => t.key === "tfM")?.label).toBe("Monthly");
    expect(TIMEFRAME_CONFIG.find((t) => t.key === "tfW")?.label).toBe("Weekly");
    expect(TIMEFRAME_CONFIG.find((t) => t.key === "tfD")?.label).toBe("Daily");
    expect(TIMEFRAME_CONFIG.find((t) => t.key === "tfM3")?.label).toBe("M3/M1");
  });

  it("builds and parses pre and post slot keys properly", () => {
    expect(buildSlotKey("pre", "tfM")).toBe("pre_tfM");
    expect(buildSlotKey("post", "tfM3")).toBe("post_tfM3");

    expect(parseSlotKey("pre_tfW")).toEqual({ category: "pre", timeframeKey: "tfW" });
    expect(parseSlotKey("post_tfH1")).toEqual({ category: "post", timeframeKey: "tfH1" });
    // Legacy fallback without prefix defaults to pre
    expect(parseSlotKey("tfD")).toEqual({ category: "pre", timeframeKey: "tfD" });
    expect(parseSlotKey(null)).toBeNull();
  });

  it("extracts image files from clipboard DataTransfer items or files", () => {
    const pngFile = new File([new Uint8Array([1, 2, 3])], "paste.png", { type: "image/png" });

    // 1. From items
    const dtWithItems = {
      items: [
        { type: "text/plain", getAsFile: () => null, kind: "string" },
        { type: "image/png", getAsFile: () => pngFile, kind: "file" },
      ],
      files: [],
      getData: () => "",
    } as unknown as DataTransfer;
    expect(extractImageFromDataTransfer(dtWithItems)).toBe(pngFile);

    // 2. From files list
    const dtWithFiles = {
      items: [],
      files: [pngFile],
      getData: () => "",
    } as unknown as DataTransfer;
    expect(extractImageFromDataTransfer(dtWithFiles)).toBe(pngFile);

    // 3. Null or text only returns null
    const dtTextOnly = {
      items: [{ type: "text/plain", getAsFile: () => null, kind: "string" }],
      files: [],
      getData: () => "",
    } as unknown as DataTransfer;
    expect(extractImageFromDataTransfer(dtTextOnly)).toBeNull();
    expect(extractImageFromDataTransfer(null)).toBeNull();
  });

  it("schema attachments table includes the optional slot column", () => {
    expect(attachments.slot).toBeDefined();
    expect(attachments.slot.name).toBe("slot");
  });

  it("API /api/attachments handles POST and GET with slot correctly", async () => {
    // Standard PNG header bytes
    const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    const file = new File([pngBytes], "test-slot.png", { type: "image/png" });
    const formData = new FormData();
    formData.append("type", "day");
    formData.append("id", "2026-08-06");
    formData.append("slot", "tfH1");
    formData.append("file", file);

    const postReq = new Request("http://localhost/api/attachments", {
      method: "POST",
      body: formData,
    });
    const postRes = await POST(postReq);
    expect(postRes.status).toBe(200);
    const postData = (await postRes.json()) as { id: string };
    expect(postData.id).toBeDefined();

    const getReq = new Request("http://localhost/api/attachments?type=day&id=2026-08-06");
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(200);
    const getData = (await getRes.json()) as {
      attachments: { id: string; name: string; mime: string; size: number; slot: string | null }[];
    };
    const found = getData.attachments.find((a) => a.id === postData.id);
    expect(found).toBeDefined();
    expect(found?.slot).toBe("tfH1");

    // Cleanup
    const delRes = await DELETE(new Request(`http://localhost/api/attachments/${postData.id}`), {
      params: Promise.resolve({ id: postData.id }),
    });
    expect(delRes.status).toBe(200);
  });
});
