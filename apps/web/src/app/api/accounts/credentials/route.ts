import { handler, ok } from "@/server/api";
import { getAllAccountsCredentials } from "@/server/account-credentials";

export const GET = handler(async () => {
  return ok(getAllAccountsCredentials());
});
