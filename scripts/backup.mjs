import { operatorDatabase } from "./operator-db.mjs";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
const db = operatorDatabase();
const destination = resolve(
  process.argv[2] ??
    `data/backups/fun-gambling-${new Date().toISOString().replaceAll(":", "-")}.sqlite`,
);
mkdirSync(dirname(destination), { recursive: true });
await db.backup(destination);
db.close();
console.log(`Consistent SQLite backup: ${destination}`);
