import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { cycleAt } from "@/domain/time";
import { ensure } from "@/domain/errors";
import type { User } from "@/domain/models";
import { atomic, getUser, type DB } from "./db";
let activeDerivations = 0;
const derive = (password: string, salt: string) => {
  ensure(
    activeDerivations < 4,
    "Sign-in is busy. Please try again shortly.",
    429,
  );
  activeDerivations++;
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 },
      (error, key) => {
        activeDerivations--;
        if (error) reject(error);
        else resolve(key);
      },
    ),
  );
};
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128);
const usernameSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_]{3,20}$/, "Use 3–20 letters, numbers or underscores");
export const credentialsSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt);
  return `${salt}:${key.toString("hex")}`;
}
async function checkPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}
export function limit(
  db: DB,
  key: string,
  max: number,
  window: number,
  now = Date.now(),
) {
  atomic(db, () => {
    const row = db
      .prepare("SELECT count,until FROM rate_limits WHERE key=?")
      .get(key) as { count: number; until: number } | undefined;
    ensure(
      !row || row.until <= now || row.count < max,
      "Too many requests. Please try again shortly.",
      429,
    );
    if (!row || row.until <= now)
      db.prepare(
        "INSERT INTO rate_limits(key,count,until) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=1,until=excluded.until",
      ).run(key, now + window);
    else
      db.prepare("UPDATE rate_limits SET count=count+1 WHERE key=?").run(key);
  });
}
function createSession(db: DB, userId: string, now: number) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions(hash,user_id,expires) VALUES(?,?,?)").run(
    hashToken(token),
    userId,
    now + 7 * 86400_000,
  );
  return token;
}
export async function register(db: DB, input: unknown, at?: number) {
  const { username, password } = credentialsSchema.parse(input);
  const hash = await hashPassword(password);
  const recovery = randomBytes(24).toString("hex");
  const now = at ?? Date.now();
  return atomic(db, () => {
    ensure(
      !db.prepare("SELECT id FROM users WHERE username=?").get(username),
      "That username is already taken",
      409,
    );
    const user: User = {
      id: randomUUID(),
      username,
      avatar: 0,
      created: now,
      lastSeen: now,
      balance: 1_000_000,
      cycle: cycleAt(new Date(now)),
      xp: 0,
      games: 0,
      dailyGames: 0,
      won: 0,
      lost: 0,
      rewards: 0,
      achievements: [],
      dailyClaimed: false,
      role: "player",
      bannedUntil: 0,
      mutedUntil: 0,
    };
    db.prepare(
      "INSERT INTO users(id,username,password,recovery,data) VALUES(?,?,?,?,?)",
    ).run(user.id, username, hash, hashToken(recovery), JSON.stringify(user));
    return { user, token: createSession(db, user.id, now), recovery };
  });
}
export async function login(db: DB, input: unknown, at?: number) {
  const { username, password } = credentialsSchema.parse(input);
  const row = db
    .prepare("SELECT id,password FROM users WHERE username=?")
    .get(username) as { id: string; password: string } | undefined;
  // Same expensive derivation for unknown usernames avoids a cheap timing oracle.
  const valid = await checkPassword(
    password,
    row?.password ?? `${"0".repeat(32)}:${"0".repeat(128)}`,
  );
  ensure(row && valid, "Username or password is incorrect", 401);
  const now = at ?? Date.now();
  return atomic(db, () => {
    // A password recovery can commit while scrypt is running. An old password
    // must not mint a new session after that recovery revokes existing sessions.
    const current = db
      .prepare("SELECT password FROM users WHERE id=?")
      .get(row.id) as { password: string };
    ensure(
      current.password === row.password,
      "Credentials changed. Please sign in again.",
      401,
    );
    const user = getUser(db, row.id)!;
    ensure(user.bannedUntil <= now, "This account is suspended", 403);
    return { user, token: createSession(db, user.id, now) };
  });
}
export async function recover(db: DB, input: unknown, at?: number) {
  const data = z
    .object({
      username: usernameSchema,
      password: passwordSchema,
      recovery: z.string().length(48),
    })
    .parse(input);
  const hash = await hashPassword(data.password);
  const recovery = randomBytes(24).toString("hex");
  const now = at ?? Date.now();
  return atomic(db, () => {
    const row = db
      .prepare("SELECT id,recovery FROM users WHERE username=?")
      .get(data.username) as { id: string; recovery: string } | undefined;
    ensure(
      row &&
        timingSafeEqual(
          Buffer.from(row.recovery, "hex"),
          Buffer.from(hashToken(data.recovery), "hex"),
        ),
      "Username or recovery code is incorrect",
      401,
    );
    const user = getUser(db, row.id)!;
    ensure(user.bannedUntil <= now, "This account is suspended", 403);
    db.prepare("UPDATE users SET password=?,recovery=? WHERE id=?").run(
      hash,
      hashToken(recovery),
      row.id,
    );
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(row.id);
    return { user, recovery, token: createSession(db, row.id, now) };
  });
}
export function sessionUser(
  db: DB,
  token: string | undefined,
  now = Date.now(),
) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return undefined;
  const row = db
    .prepare("SELECT user_id FROM sessions WHERE hash=? AND expires>?")
    .get(hashToken(token), now) as { user_id: string } | undefined;
  const user = row ? getUser(db, row.user_id) : undefined;
  return user && user.bannedUntil <= now ? user : undefined;
}
