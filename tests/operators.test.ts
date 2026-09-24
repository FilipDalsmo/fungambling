import { expect, it } from "vitest";
import { mkdirSync, mkdtempSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { openDatabase, getUser } from "@/server/db";
import { register } from "@/server/auth";
it("grants an audited admin role and makes a restorable consistent backup using production CLIs", async () => {
  mkdirSync("test-results", { recursive: true });
  const directory = mkdtempSync(resolve("test-results", "operators-")),
    path = resolve(directory, "app.sqlite"),
    backup = resolve(directory, "backup.sqlite");
  const db = openDatabase(path);
  const a = await register(db, {
    username: "OperatorTest",
    password: "operator-test-password",
  });
  const env = { ...process.env, DATABASE_PATH: path };
  execFileSync(process.execPath, ["scripts/admin.mjs", a.user.username], {
    env,
  });
  expect(getUser(db, a.user.id)?.role).toBe("admin");
  expect(db.prepare("SELECT action FROM audit").get()).toEqual({
    action: "grant-admin",
  });
  execFileSync(process.execPath, ["scripts/backup.mjs", backup], { env });
  const restored = openDatabase(backup);
  expect(getUser(restored, a.user.id)?.role).toBe("admin");
  expect(restored.pragma("integrity_check", { simple: true })).toBe("ok");
  restored.close();
  db.close();
});
