import { bad, handler, ok } from "@/server/api";
import {
  getAccountCredentials,
  getAllAccountsCredentials,
  saveAccountCredentials,
} from "@/server/account-credentials";

type Params = { params: Promise<{ id: string }> };

export const GET = handler(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  if (id === "all") {
    return ok(getAllAccountsCredentials());
  }
  const result = getAccountCredentials(id);
  if (!result) return bad("Account not found", 404);
  return ok(result);
});

export const POST = handler(async (request: Request, { params }: Params) => {
  const { id } = await params;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return bad("Invalid JSON payload", 400);
  }

  const username = typeof body?.username === "string" ? body.username.trim() : "";
  if (!username) {
    return bad("Username is required", 400);
  }

  const password = typeof body?.password === "string" ? body.password : "";
  const platforms = Array.isArray(body?.platforms) ? body.platforms : undefined;

  const result = saveAccountCredentials(id, {
    username,
    password,
    platforms,
  });

  if (!result) return bad("Account not found", 404);
  return ok(result);
});

