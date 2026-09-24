import { randomUUID } from "node:crypto";
import { achievements, type User } from "@/domain/models";
import { ensure } from "@/domain/errors";
import { cycleAt } from "@/domain/time";
import { newTable } from "@/domain/poker";
import { allTables, allUsers, saveTable, saveUser, type DB } from "./db";
export function changeBalance(user: User, amount: number) {
  ensure(
    Number.isSafeInteger(amount) && Number.isSafeInteger(user.balance + amount),
    "Invalid chip amount",
  );
  ensure(user.balance + amount >= 0, "Not enough chips");
  user.balance += amount;
}
export function profit(db: DB, user: User, amount: number, games = 0) {
  db.prepare(
    "INSERT INTO stats(user_id,cycle,profit,games) VALUES(?,?,?,?) ON CONFLICT(user_id,cycle) DO UPDATE SET profit=profit+excluded.profit,games=games+excluded.games",
  ).run(user.id, user.cycle, amount, games);
}
export function recordResult(db: DB, user: User, net: number) {
  ensure(Number.isSafeInteger(net), "Invalid settlement", 500);
  user.won += Math.max(0, net);
  user.lost += Math.max(0, -net);
  user.games++;
  user.dailyGames++;
  user.xp += 10;
  profit(db, user, net, 1);
  for (const a of achievements)
    if (user.games >= a.games && !user.achievements.includes(a.id)) {
      user.achievements.push(a.id);
      user.xp += a.xp;
      reward(db, user, a.chips * 100);
    }
}
export function reward(db: DB, user: User, amount: number) {
  changeBalance(user, amount);
  user.rewards += amount;
  profit(db, user, amount);
}
export function dailyReset(db: DB, now = Date.now()) {
  const cycle = cycleAt(new Date(now));
  const row = db.prepare("SELECT value FROM meta WHERE key='cycle'").get() as
    { value: string } | undefined;
  if (row?.value === cycle) return;
  if (row) {
    db.prepare("DELETE FROM rounds").run();
    for (const t of allTables(db)) {
      t.seats = Array(6).fill(null);
      t.status = "waiting";
      t.board = [];
      t.deck = [];
      t.deadline = 0;
      t.turn = -1;
      t.revision++;
      t.message = "New daily cycle · take a seat";
      saveTable(db, t);
    }
  }
  for (const user of allUsers(db))
    if (user.cycle !== cycle) {
      user.balance = 1_000_000;
      user.cycle = cycle;
      user.dailyGames = 0;
      user.dailyClaimed = false;
      saveUser(db, user);
    }
  db.prepare(
    "INSERT INTO meta(key,value) VALUES('cycle',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  ).run(cycle);
  if (!allTables(db).some((t) => !t.private)) {
    for (const variant of ["nlhe", "plo"] as const)
      for (const bigBlind of [2000, 10000])
        saveTable(
          db,
          newTable(
            randomUUID(),
            `${variant === "nlhe" ? "Emerald" : "Violet"} ${bigBlind / 200}/${bigBlind / 100}`,
            variant,
            bigBlind,
            null,
            now,
          ),
        );
  }
}
