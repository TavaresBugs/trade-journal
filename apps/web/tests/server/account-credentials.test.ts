import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";

const previousDir = process.env.JOURNAL_DATA_DIR;
const scratch = mkdtempSync(join(tmpdir(), "journal-credentials-test-"));
process.env.JOURNAL_DATA_DIR = scratch;

const { db, accounts } = await import("../../src/db");
const { decryptJson } = await import("../../src/server/crypto");
const { handler, RequestError } = await import("../../src/server/api");
const {
  deleteAccountCredentials,
  getAccountCredentials,
  getAccountCredentialsInternal,
  getAllAccountsCredentials,
  removeEnvContent,
  saveAccountCredentials,
  updateEnvContent,
} = await import("../../src/server/account-credentials");

afterAll(() => {
  db.$client.close();
  if (previousDir === undefined) delete process.env.JOURNAL_DATA_DIR;
  else process.env.JOURNAL_DATA_DIR = previousDir;
  rmSync(scratch, { recursive: true, force: true });
});

describe("Account Platform Credentials Service", () => {
  const testAccountId = "acc_test_credentials_temp";
  const testAccountNumber = "LFE999888777";

  beforeEach(() => {
    // Ensure clean env
    delete process.env.ACCOUNT_LFE999888777_USERNAME;
    delete process.env.ACCOUNT_LFE999888777_PASSWORD;
    delete process.env.ACCOUNT_LFE999888777_PLATFORMS;
    delete process.env.ACCOUNT_CREDENTIALS;

    // Ensure account exists
    db.insert(accounts)
      .values({
        id: testAccountId,
        name: "Test Prop Account",
        broker: "lucid",
        platform: "tradovate",
        accountNumber: testAccountNumber,
        initialBalance: 50000,
        kind: "manual",
        createdAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: accounts.id,
        set: { accountNumber: testAccountNumber },
      })
      .run();
  });

  afterEach(() => {
    db.delete(accounts).where(eq(accounts.id, testAccountId)).run();
    delete process.env.ACCOUNT_LFE999888777_USERNAME;
    delete process.env.ACCOUNT_LFE999888777_PASSWORD;
    delete process.env.ACCOUNT_LFE999888777_PLATFORMS;
    delete process.env.ACCOUNT_CREDENTIALS;
  });

  it("returns null credentials and a helpful suggestedEnvKey when no env vars are defined", () => {
    const res = getAccountCredentials(testAccountId);
    expect(res).not.toBeNull();
    expect(res?.credentials).toBeNull();
    expect(res?.account.accountNumber).toBe(testAccountNumber);
    expect(res?.suggestedEnvKey).toBe(`ACCOUNT_${testAccountNumber}`);
  });

  it("reads credentials defined via ACCOUNT_<NUMBER>_USERNAME and PASSWORD", () => {
    process.env.ACCOUNT_LFE999888777_USERNAME = "LTT3UY7S8I9";
    process.env.ACCOUNT_LFE999888777_PASSWORD = "SecretPassword123!";
    process.env.ACCOUNT_LFE999888777_PLATFORMS = "ninjatrader,tradovate,tradingview";

    const res = getAccountCredentials(testAccountId);
    expect(res).not.toBeNull();
    expect(res?.credentials).not.toBeNull();
    expect(res?.credentials?.username).toBe("LTT3UY7S8I9");
    expect(res?.credentials?.hasPassword).toBe(true);
    expect(res?.credentials?.password).toBeUndefined();
    expect(res?.credentials?.platforms).toEqual(["ninjatrader", "tradovate", "tradingview"]);

    const internal = getAccountCredentialsInternal(testAccountId);
    expect(internal?.credentials?.password).toBe("SecretPassword123!");
  });

  it("reads credentials defined via ACCOUNT_CREDENTIALS JSON map", () => {
    process.env.ACCOUNT_CREDENTIALS = JSON.stringify({
      [testAccountNumber]: {
        username: "JSON_USER_99",
        password: "JSON_PASS_99",
        platforms: ["ninjatrader", "tradingview"],
      },
    });

    const res = getAccountCredentials(testAccountId);
    expect(res).not.toBeNull();
    expect(res?.credentials).not.toBeNull();
    expect(res?.credentials?.username).toBe("JSON_USER_99");
    expect(res?.credentials?.hasPassword).toBe(true);
    expect(res?.credentials?.password).toBeUndefined();
    expect(res?.credentials?.platforms).toEqual(["ninjatrader", "tradingview"]);

    const internal = getAccountCredentialsInternal(testAccountId);
    expect(internal?.credentials?.password).toBe("JSON_PASS_99");
  });

  it("returns null when the account does not exist in the database", () => {
    const res = getAccountCredentials("non_existent_account_xyz");
    expect(res).toBeNull();
  });

  it("saves credentials to DB and process.env, returning masked credentials", () => {
    const saved = saveAccountCredentials(testAccountId, {
      username: "MY_NEW_TRADER",
      password: "SuperSecretPassword!",
      platforms: ["ninjatrader", "tradovate"],
    });

    expect(saved).not.toBeNull();
    expect(saved?.credentials?.username).toBe("MY_NEW_TRADER");
    expect(saved?.credentials?.hasPassword).toBe(true);
    expect(saved?.credentials?.password).toBeUndefined();
    expect(saved?.credentials?.platforms).toEqual(["ninjatrader", "tradovate"]);

    // In-memory process.env check
    expect(process.env.ACCOUNT_LFE999888777_USERNAME).toBe("MY_NEW_TRADER");
    expect(process.env.ACCOUNT_LFE999888777_PASSWORD).toBe("SuperSecretPassword!");

    // Instant getAccountCredentials check (masked)
    const fetched = getAccountCredentials(testAccountId);
    expect(fetched?.credentials?.username).toBe("MY_NEW_TRADER");
    expect(fetched?.credentials?.hasPassword).toBe(true);
    expect(fetched?.credentials?.password).toBeUndefined();

    // Even if process.env is cleared, DB credentialsEnc persists it
    delete process.env.ACCOUNT_LFE999888777_USERNAME;
    delete process.env.ACCOUNT_LFE999888777_PASSWORD;
    delete process.env.ACCOUNT_LFE999888777_PLATFORMS;

    const fromDb = getAccountCredentials(testAccountId);
    expect(fromDb?.credentials?.username).toBe("MY_NEW_TRADER");
    expect(fromDb?.credentials?.hasPassword).toBe(true);
    expect(fromDb?.credentials?.password).toBeUndefined();

    const fromDbInternal = getAccountCredentialsInternal(testAccountId);
    expect(fromDbInternal?.credentials?.username).toBe("MY_NEW_TRADER");
    expect(fromDbInternal?.credentials?.password).toBe("SuperSecretPassword!");
  });

  it("updateEnvContent updates existing keys and appends new ones safely", () => {
    const initial = "OTHER_VAR=123\nACCOUNT_TEST_USERNAME=old_user\n";
    const updated = updateEnvContent(
      initial,
      {
        ACCOUNT_TEST_USERNAME: "new_user",
        ACCOUNT_TEST_PASSWORD: "secret_password",
      },
      "# Test Comment",
    );

    expect(updated).toContain("OTHER_VAR=123");
    expect(updated).toContain("ACCOUNT_TEST_USERNAME=new_user");
    expect(updated).not.toContain("ACCOUNT_TEST_USERNAME=old_user");
    expect(updated).toContain("ACCOUNT_TEST_PASSWORD=secret_password");
  });

  it("defaults to metatrader5 when account platform is metatrader5 or broker is ftmo", () => {
    const ftmoId = "acc_test_ftmo_temp";
    db.insert(accounts)
      .values({
        id: ftmoId,
        name: "FTMO 10K",
        broker: "ftmo",
        platform: "metatrader5",
        accountNumber: "530319802",
        initialBalance: 10000,
        kind: "manual",
        createdAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: accounts.id,
        set: { platform: "metatrader5" },
      })
      .run();

    const saved = saveAccountCredentials(ftmoId, {
      username: "LTT3UY7S8I9",
      password: "pass",
    });

    expect(saved?.credentials?.platforms).toEqual(["metatrader5"]);

    db.delete(accounts).where(eq(accounts.id, ftmoId)).run();
    delete process.env.ACCOUNT_530319802_USERNAME;
    delete process.env.ACCOUNT_530319802_PASSWORD;
    delete process.env.ACCOUNT_530319802_PLATFORMS;
  });

  it("retrieves credentials for all active accounts with getAllAccountsCredentials", () => {
    const all = getAllAccountsCredentials();
    expect(all).toBeDefined();
    expect(Array.isArray(all.accounts)).toBe(true);
    const found = all.accounts.find((a) => a.account.id === testAccountId);
    expect(found).toBeDefined();
    expect(found?.account.accountNumber).toBe(testAccountNumber);
  });

  it("removeEnvContent removes specific keys and associated comments while preserving others", () => {
    const original = `# Other comment\nOTHER_KEY=123\n\n# Platform credentials for Test (ACC_99)\nACCOUNT_ACC_99_USERNAME=user\nACCOUNT_ACC_99_PASSWORD=pass\n`;
    const cleaned = removeEnvContent(
      original,
      ["ACCOUNT_ACC_99_USERNAME", "ACCOUNT_ACC_99_PASSWORD"],
      ["(ACC_99)"],
    );
    expect(cleaned).toContain("OTHER_KEY=123");
    expect(cleaned).not.toContain("ACCOUNT_ACC_99_USERNAME");
    expect(cleaned).not.toContain("ACCOUNT_ACC_99_PASSWORD");
    expect(cleaned).not.toContain("# Platform credentials for Test (ACC_99)");
  });

  it("deleteAccountCredentials preserves shared credentials if another active account shares the same account number", () => {
    const twin1Id = "acc_twin_test_1";
    const twin2Id = "acc_twin_test_2";
    const sharedNumber = "TWIN_SHARED_777";

    // Insert twin account 1
    db.insert(accounts)
      .values({
        id: twin1Id,
        name: "Twin Account 1",
        broker: "lucid",
        platform: "tradovate",
        accountNumber: sharedNumber,
        initialBalance: 50000,
        kind: "manual",
        createdAt: new Date().toISOString(),
      })
      .run();

    // Insert twin account 2
    db.insert(accounts)
      .values({
        id: twin2Id,
        name: "Twin Account 2",
        broker: "lucid",
        platform: "tradovate",
        accountNumber: sharedNumber,
        initialBalance: 50000,
        kind: "manual",
        createdAt: new Date().toISOString(),
      })
      .run();

    // Save credentials under sharedNumber
    saveAccountCredentials(twin1Id, {
      username: "TWIN_USER",
      password: "TWIN_PASSWORD",
    });

    expect(process.env[`ACCOUNT_${sharedNumber}_USERNAME`]).toBe("TWIN_USER");

    // Deleting twin 1 should NOT remove the shared credentials because twin 2 is still active!
    const delResult1 = deleteAccountCredentials(twin1Id);
    expect(delResult1.removed).toBe(false);
    expect(delResult1.reason).toContain("preserved");
    // Credentials must still be in process.env
    expect(process.env[`ACCOUNT_${sharedNumber}_USERNAME`]).toBe("TWIN_USER");

    // Actually delete twin 1 from DB (simulating the DELETE API route)
    db.delete(accounts).where(eq(accounts.id, twin1Id)).run();

    // Now deleting twin 2 (the last remaining account with sharedNumber) MUST remove the credentials!
    const delResult2 = deleteAccountCredentials(twin2Id);
    expect(delResult2.removed).toBe(true);
    // Credentials must now be cleared from process.env
    expect(process.env[`ACCOUNT_${sharedNumber}_USERNAME`]).toBeUndefined();

    // Cleanup twin 2 from DB
    db.delete(accounts).where(eq(accounts.id, twin2Id)).run();
  });

  it("persists credentials in SQLite with AES-256-GCM encryption (iv.ciphertext.authTag) and never stores plaintext", () => {
    saveAccountCredentials(testAccountId, {
      username: "ENCRYPTED_USER",
      password: "SuperSecretPassword123!",
      platforms: ["ninjatrader", "tradovate"],
    });

    const row = db.select().from(accounts).where(eq(accounts.id, testAccountId)).get();
    expect(row?.credentialsEnc).toBeDefined();

    // Must NOT contain plaintext username or password
    expect(row!.credentialsEnc!).not.toContain("SuperSecretPassword123!");
    expect(row!.credentialsEnc!).not.toContain("ENCRYPTED_USER");

    // Must match iv.ciphertext.authTag format (3 base64 segments joined by dot)
    const parts = row!.credentialsEnc!.split(".");
    expect(parts).toHaveLength(3);
    for (const part of parts) {
      expect(part).toMatch(/^[A-Za-z0-9+/=]+$/);
    }

    // Decrypting with decryptJson restores the payload
    const decrypted = decryptJson<{ username: string; password: string; platforms: string[] }>(
      row!.credentialsEnc!,
    );
    expect(decrypted.username).toBe("ENCRYPTED_USER");
    expect(decrypted.password).toBe("SuperSecretPassword123!");
    expect(decrypted.platforms).toEqual(["ninjatrader", "tradovate"]);
  });

  it("gracefully decrypts legacy plaintext JSON in SQLite credentialsEnc", () => {
    // Simulate legacy plain JSON stored before encryption was implemented
    const legacyPayload = JSON.stringify({
      username: "LEGACY_USER_01",
      password: "LegacyPassword999!",
      platforms: ["tradovate"],
    });

    db.update(accounts)
      .set({ credentialsEnc: legacyPayload })
      .where(eq(accounts.id, testAccountId))
      .run();

    // Masked public getter
    const publicRes = getAccountCredentials(testAccountId);
    expect(publicRes).not.toBeNull();
    expect(publicRes?.credentials?.username).toBe("LEGACY_USER_01");
    expect(publicRes?.credentials?.hasPassword).toBe(true);
    expect(publicRes?.credentials?.password).toBeUndefined();

    // Internal getter with raw password
    const internalRes = getAccountCredentialsInternal(testAccountId);
    expect(internalRes).not.toBeNull();
    expect(internalRes?.credentials?.username).toBe("LEGACY_USER_01");
    expect(internalRes?.credentials?.password).toBe("LegacyPassword999!");
  });

  it("rejects CRLF / newline injection in saveAccountCredentials and updateEnvContent", () => {
    // 1. Username with newline
    expect(() =>
      saveAccountCredentials(testAccountId, {
        username: "admin\nINJECTED_VAR=1",
        password: "safe_password",
      }),
    ).toThrowError(/newline/i);

    // 2. Username with carriage return
    expect(() =>
      saveAccountCredentials(testAccountId, {
        username: "admin\rINJECTED_VAR=1",
        password: "safe_password",
      }),
    ).toThrowError(/newline/i);

    // 3. Password with newline
    expect(() =>
      saveAccountCredentials(testAccountId, {
        username: "valid_admin",
        password: "secret\nATTACK=pwned",
      }),
    ).toThrowError(/newline/i);

    // 4. Password with CRLF
    expect(() =>
      saveAccountCredentials(testAccountId, {
        username: "valid_admin",
        password: "secret\r\nATTACK=pwned",
      }),
    ).toThrowError(/newline/i);

    // 5. updateEnvContent with key containing newline
    expect(() =>
      updateEnvContent("SOME_KEY=1\n", {
        "ATTACK\nKEY": "value",
      }),
    ).toThrowError(/newline/i);

    // 6. updateEnvContent with value containing newline
    expect(() =>
      updateEnvContent("SOME_KEY=1\n", {
        VALID_KEY: "val\nINJECTED_ENV=2",
      }),
    ).toThrowError(/newline/i);

    // 7. updateEnvContent with carriage return
    expect(() =>
      updateEnvContent("SOME_KEY=1\n", {
        VALID_KEY: "val\rINJECTED_ENV=2",
      }),
    ).toThrowError(/newline/i);
  });

  it("api handler sanitizes unexpected 500 errors and preserves RequestError", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Test unexpected internal error (e.g., SQLite constraint/schema error)
    const buggyRoute = handler(async () => {
      throw new Error("SQLITE_ERROR: no such column: sensitive_schema_leak at /var/app/db.sqlite");
    }, { public: true });

    const response500 = await buggyRoute();
    expect(response500.status).toBe(500);
    const body500 = await response500.json();
    expect(body500).toEqual({ error: "An unexpected error occurred." });
    expect(JSON.stringify(body500)).not.toContain("SQLITE_ERROR");
    expect(JSON.stringify(body500)).not.toContain("sensitive_schema_leak");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Internal API error:",
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();

    // Test explicit RequestError (e.g., 400 validation error)
    const validationRoute = handler(async () => {
      throw new RequestError("Username and password cannot contain newline characters", 400);
    }, { public: true });

    const response400 = await validationRoute();
    expect(response400.status).toBe(400);
    const body400 = await response400.json();
    expect(body400).toEqual({ error: "Username and password cannot contain newline characters" });
  });
});
