import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "../src/proxy";

describe("Next.js 16 proxy (middleware replacement)", () => {
  beforeEach(() => {
    delete process.env.JOURNAL_PASSWORD;
  });

  afterEach(() => {
    delete process.env.JOURNAL_PASSWORD;
  });

  it("passes requests through when JOURNAL_PASSWORD is not configured", () => {
    const request = new NextRequest("http://localhost/trades");
    const response = proxy(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows access to /login and /api/auth even when password protection is enabled", () => {
    process.env.JOURNAL_PASSWORD = "fixture-password";
    for (const pathname of ["/login", "/api/auth"]) {
      const request = new NextRequest(`http://localhost${pathname}`);
      const response = proxy(request);
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("returns 401 JSON for unauthorized API requests without cookie", async () => {
    process.env.JOURNAL_PASSWORD = "fixture-password";
    const request = new NextRequest("http://localhost/api/trades");
    const response = proxy(request);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toEqual({ error: "Unauthorized" });
  });

  it("redirects unauthorized page navigations to /login", () => {
    process.env.JOURNAL_PASSWORD = "fixture-password";
    const request = new NextRequest("http://localhost/trades");
    const response = proxy(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("allows navigation and API calls when session cookie is present", () => {
    process.env.JOURNAL_PASSWORD = "fixture-password";
    const request = new NextRequest("http://localhost/trades", {
      headers: {
        cookie: "journal_session=fixture-session-token",
      },
    });
    const response = proxy(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("exports a valid matcher excluding static assets and favicon", () => {
    expect(config.matcher).toBeDefined();
    expect(config.matcher).toHaveLength(1);
    const pattern = new RegExp(`^${config.matcher[0]}$`);
    expect(pattern.test("/trades")).toBe(true);
    expect(pattern.test("/api/settings")).toBe(true);
    expect(pattern.test("/_next/static/chunk.js")).toBe(false);
    expect(pattern.test("/_next/image?url=foo")).toBe(false);
    expect(pattern.test("/favicon.ico")).toBe(false);
  });
});
