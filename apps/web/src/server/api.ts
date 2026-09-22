import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE, passwordConfigured, verifySession } from "./auth";

export class RequestError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

export class NotFoundError extends RequestError {
  constructor(message = "Not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends RequestError {
  constructor(message: string) {
    super(message, 400);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends RequestError {
  constructor(message = "Unauthorized") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ConflictError extends RequestError {
  constructor(message: string) {
    super(message, 409);
    this.name = "ConflictError";
  }
}

export function requireValue(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new RequestError(message, status);
}

export function requireFound<T>(
  value: T | null | undefined,
  message = "Resource not found.",
): asserts value is T {
  if (value === null || value === undefined) throw new NotFoundError(message);
}

export const ok = (data: unknown, init?: ResponseInit) => {
  const headers = new Headers(init?.headers);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(data, { ...init, headers });
};

export const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

/** Route-handler wrapper: uniform error JSON instead of HTML 500 pages. */
export const handler =
  <A extends unknown[]>(
    fn: (...args: A) => Promise<Response> | Response,
    options: { public?: boolean } = {},
  ) =>
  async (...args: A): Promise<Response> => {
    try {
      if (!options.public && passwordConfigured()) {
        const token = (await cookies()).get(AUTH_COOKIE)?.value;
        if (!verifySession(token)) return bad("Unauthorized", 401);
      }
      return await fn(...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal error";
      const status = error instanceof RequestError ? error.status : 500;
      return NextResponse.json({ error: message }, { status });
    }
  };
