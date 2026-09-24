import { randomUUID } from "node:crypto";
import { operatorDatabase } from "./operator-db.mjs";
const username = process.argv[2];
if (!username) {
  console.error("Usage: npm run admin -- <existing-username>");
  process.exit(1);
}
const db = operatorDatabase();
db.transaction(() => {
  const row = db
    .prepare("SELECT id,data FROM users WHERE username=?")
    .get(username);
  if (!row) throw new Error("Register this account in the application first.");
  const user = JSON.parse(row.data);
  user.role = "admin";
  db.prepare("UPDATE users SET data=? WHERE id=?").run(
    JSON.stringify(user),
    user.id,
  );
  db.prepare(
    "INSERT INTO audit(id,actor,action,target,reason,detail,created) VALUES(?,?,?,?,?,?,?)",
  ).run(
    randomUUID(),
    user.id,
    "grant-admin",
    user.id,
    "Granted by local operator CLI",
    "",
    Date.now(),
  );
  console.log(`Administrator access granted to ${user.username}.`);
}).immediate();
db.close();
