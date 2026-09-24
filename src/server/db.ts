import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { User } from "@/domain/models";
import type { PokerTable } from "@/domain/poker";
export type DB = Database.Database;
export function openDatabase(
  path = process.env.DATABASE_PATH ?? "./data/fun-gambling.sqlite",
) {
  if (path !== ":memory:")
    mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE, password TEXT NOT NULL, recovery TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS stats (user_id TEXT NOT NULL REFERENCES users(id), cycle TEXT NOT NULL, profit INTEGER NOT NULL DEFAULT 0, games INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id, cycle));
    CREATE TABLE IF NOT EXISTS rounds (user_id TEXT PRIMARY KEY REFERENCES users(id), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS poker_tables (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS invitations (table_id TEXT NOT NULL REFERENCES poker_tables(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(table_id,user_id));
    CREATE TABLE IF NOT EXISTS friends (sender TEXT NOT NULL REFERENCES users(id), recipient TEXT NOT NULL REFERENCES users(id), accepted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(sender,recipient));
    CREATE TABLE IF NOT EXISTS blocks (owner TEXT NOT NULL REFERENCES users(id), target TEXT NOT NULL REFERENCES users(id), muted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(owner,target));
    CREATE TABLE IF NOT EXISTS chat (id TEXT PRIMARY KEY, table_id TEXT NOT NULL REFERENCES poker_tables(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS chat_table_time ON chat(table_id,created);
    CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, reporter TEXT NOT NULL REFERENCES users(id), target TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL, evidence TEXT NOT NULL, created INTEGER NOT NULL, resolved INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actor TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, target TEXT NOT NULL, reason TEXT NOT NULL, detail TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS actions (user_id TEXT NOT NULL REFERENCES users(id), id TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(user_id,id));
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
    CREATE INDEX IF NOT EXISTS actions_created ON actions(created);
    CREATE INDEX IF NOT EXISTS chat_created ON chat(created);
    CREATE INDEX IF NOT EXISTS rate_limits_expiry ON rate_limits(until);
    CREATE INDEX IF NOT EXISTS stats_cycle ON stats(cycle);
    INSERT OR IGNORE INTO migrations(version) VALUES(1);
  `);
  return db;
}
const globalDb = globalThis as typeof globalThis & { funDb?: DB };
export const database = () => (globalDb.funDb ??= openDatabase());
export function getUser(db: DB, id: string): User | undefined {
  const row = db.prepare("SELECT data FROM users WHERE id=?").get(id) as
    { data: string } | undefined;
  return row ? JSON.parse(row.data) : undefined;
}
export function allUsers(db: DB): User[] {
  return (db.prepare("SELECT data FROM users").all() as { data: string }[]).map(
    (r) => JSON.parse(r.data),
  );
}
export function saveUser(db: DB, user: User) {
  db.prepare("UPDATE users SET data=? WHERE id=?").run(
    JSON.stringify(user),
    user.id,
  );
}
export function allTables(db: DB): PokerTable[] {
  return (
    db.prepare("SELECT data FROM poker_tables").all() as { data: string }[]
  ).map((r) => JSON.parse(r.data));
}
export function saveTable(db: DB, table: PokerTable) {
  db.prepare(
    "INSERT INTO poker_tables(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
  ).run(table.id, JSON.stringify(table));
}
export function atomic<T>(db: DB, action: () => T): T {
  return db.transaction(action).immediate();
}
