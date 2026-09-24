import Database from "better-sqlite3";
// Operators work only on an existing application database; a typo must not create one.
export function operatorDatabase() {
  const db = new Database(
    process.env.DATABASE_PATH ?? "./data/fun-gambling.sqlite",
    { fileMustExist: true },
  );
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  return db;
}
