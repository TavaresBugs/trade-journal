import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { handler, ok } from "../../src/server/api";
import { sessionToken, verifyPassword } from "../../src/server/auth";
import { config, proxy } from "../../src/proxy";

const session = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (session.token ? { value: session.token } : undefined) }),
}));

describe("Authentication & Proxy Middleware Suite", () => {
  describe("API Handler Password Protection", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      session.token = undefined;
    });

    it("permits local access when no password is configured", async () => {
      vi.stubEnv("JOURNAL_PASSWORD", "");
      expect((await handler(() => ok({ data: true }))()).status).toBe(200);
    });

    it("rejects both missing and forged cookies before executing any handler", async () => {
      vi.stubEnv("JOURNAL_PASSWORD", "test-password");
      const action = vi.fn(() => ok({ secret: true }));
      for (const token of [undefined, "forged", "0".repeat(64)]) {
        session.token = token;
        expect((await handler(action)()).status).toBe(401);
      }
      expect(action).not.toHaveBeenCalled();
    });

    it("accepts signed sessions and invalidates them when the password changes", async () => {
      vi.stubEnv("JOURNAL_PASSWORD", "test-password");
      session.token = sessionToken();
      expect((await handler(() => ok({ data: true }))()).status).toBe(200);
      vi.stubEnv("JOURNAL_PASSWORD", "new-password");
      expect((await handler(() => ok({ data: true }))()).status).toBe(401);
    });

    it("allows the login endpoint to verify a password without a session", async () => {
      vi.stubEnv("JOURNAL_PASSWORD", "test-password");
      expect(verifyPassword("test-password")).toBe(true);
      expect(verifyPassword("wrong-password")).toBe(false);
      expect((await handler(() => ok({ login: true }), { public: true })()).status).toBe(200);
    });
  });

  describe("Next.js 16 Proxy Routing (Middleware Replacement)", () => {
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
});
