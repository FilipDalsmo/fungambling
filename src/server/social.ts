import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ensure } from "@/domain/errors";
import type { User } from "@/domain/models";
import { allTables, getUser, saveTable, saveUser, type DB } from "./db";
import { getTable } from "./games";
import { changeBalance } from "./economy";
import { limit } from "./auth";
export function isBlocked(db: DB, a: string, b: string) {
  return !!db
    .prepare(
      "SELECT 1 FROM blocks WHERE muted=0 AND ((owner=? AND target=?) OR (owner=? AND target=?))",
    )
    .get(a, b, b, a);
}
export function areFriends(db: DB, a: string, b: string) {
  return !!db
    .prepare(
      "SELECT 1 FROM friends WHERE accepted=1 AND ((sender=? AND recipient=?) OR (sender=? AND recipient=?))",
    )
    .get(a, b, b, a);
}
export function socialAction(
  db: DB,
  user: User,
  input: unknown,
  now = Date.now(),
) {
  const data = z
    .object({
      action: z.enum([
        "request",
        "accept",
        "remove",
        "block",
        "mute",
        "unblock",
        "unmute",
        "report",
        "invite",
      ]),
      target: z.string().uuid(),
      reason: z.string().trim().max(1000).default(""),
      tableId: z.string().uuid().optional(),
    })
    .parse(input);
  ensure(
    data.target !== user.id && getUser(db, data.target),
    "Choose another player",
  );
  if (data.action === "block" || data.action === "mute") {
    db.prepare(
      "INSERT INTO blocks(owner,target,muted) VALUES(?,?,?) ON CONFLICT(owner,target) DO UPDATE SET muted=MIN(muted,excluded.muted)",
    ).run(user.id, data.target, data.action === "mute" ? 1 : 0);
    if (data.action === "block") {
      db.prepare(
        "DELETE FROM friends WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)",
      ).run(user.id, data.target, data.target, user.id);
      for (const table of allTables(db)) {
        const guest =
          table.owner === user.id
            ? data.target
            : table.owner === data.target
              ? user.id
              : undefined;
        if (!guest) continue;
        db.prepare(
          "DELETE FROM invitations WHERE table_id=? AND user_id=?",
        ).run(table.id, guest);
        const seat = table.seats.find((s) => s?.userId === guest);
        if (seat) {
          seat.leaving = true;
          seat.sittingOut = true;
          table.revision++;
          saveTable(db, table);
        }
      }
    }
  } else if (data.action === "unblock" || data.action === "unmute")
    db.prepare("DELETE FROM blocks WHERE owner=? AND target=? AND muted=?").run(
      user.id,
      data.target,
      data.action === "unmute" ? 1 : 0,
    );
  else if (data.action === "report") {
    ensure(
      data.reason.length >= 10,
      "Please describe the issue in at least 10 characters",
    );
    limit(db, `report:${user.id}`, 5, 3600_000, now);
    const evidence = db
      .prepare(
        "SELECT body,table_id,created FROM chat WHERE user_id=? ORDER BY created DESC LIMIT 20",
      )
      .all(data.target);
    db.prepare(
      "INSERT INTO reports(id,reporter,target,reason,evidence,created) VALUES(?,?,?,?,?,?)",
    ).run(
      randomUUID(),
      user.id,
      data.target,
      data.reason,
      JSON.stringify(evidence),
      now,
    );
  } else if (data.action === "remove")
    db.prepare(
      "DELETE FROM friends WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)",
    ).run(user.id, data.target, data.target, user.id);
  else {
    ensure(
      !isBlocked(db, user.id, data.target),
      "This interaction is unavailable",
    );
    if (data.action === "request") {
      limit(db, `friend:${user.id}`, 20, 3600_000, now);
      ensure(
        !db
          .prepare(
            "SELECT 1 FROM friends WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)",
          )
          .get(user.id, data.target, data.target, user.id),
        "A friendship or request already exists",
      );
      db.prepare("INSERT INTO friends(sender,recipient) VALUES(?,?)").run(
        user.id,
        data.target,
      );
    } else if (data.action === "accept") {
      ensure(
        db
          .prepare(
            "UPDATE friends SET accepted=1 WHERE sender=? AND recipient=? AND accepted=0",
          )
          .run(data.target, user.id).changes,
        "No pending request",
      );
    } else {
      ensure(data.tableId, "Choose a private table");
      const t = getTable(db, data.tableId, user.id);
      ensure(
        t.owner === user.id && areFriends(db, user.id, data.target),
        "Only hosts can invite accepted friends",
      );
      db.prepare(
        "INSERT OR IGNORE INTO invitations(table_id,user_id) VALUES(?,?)",
      ).run(t.id, data.target);
    }
  }
}
export function sendChat(db: DB, user: User, input: unknown, now = Date.now()) {
  const data = z
    .object({
      tableId: z.string().uuid(),
      body: z.string().trim().min(1).max(300),
    })
    .parse(input);
  getTable(db, data.tableId, user.id);
  ensure(
    user.mutedUntil <= now,
    "Chat is temporarily muted for this account",
    403,
  );
  limit(db, `chat:${user.id}`, 5, 10_000, now);
  db.prepare(
    "INSERT INTO chat(id,table_id,user_id,body,created) VALUES(?,?,?,?,?)",
  ).run(randomUUID(), data.tableId, user.id, data.body, now);
}
export function setting(db: DB, key: string, fallback: string) {
  return (
    (
      db.prepare("SELECT value FROM meta WHERE key=?").get(key) as
        { value: string } | undefined
    )?.value ?? fallback
  );
}
export function adminAction(
  db: DB,
  user: User,
  input: unknown,
  now = Date.now(),
) {
  ensure(user.role === "admin", "Administrator access required", 403);
  const data = z
    .object({
      action: z.enum([
        "suspend",
        "ban",
        "unban",
        "mute",
        "unmute",
        "avatar",
        "balance",
        "announcement",
        "reward",
        "resolve",
        "removeChat",
      ]),
      target: z.string().max(100).default(""),
      reason: z.string().trim().min(10).max(1000),
      amount: z.number().int().min(-100000).max(100000).default(0),
      text: z.string().trim().max(500).default(""),
    })
    .parse(input);
  let detail = "";
  if (data.action === "announcement" || data.action === "reward") {
    ensure(
      data.action !== "reward" || (data.amount >= 0 && data.amount <= 1000),
      "Daily reward must be 0–1,000 chips",
    );
    const key = data.action === "announcement" ? "announcement" : "dailyReward";
    const value =
      data.action === "announcement" ? data.text : String(data.amount);
    detail = JSON.stringify({ before: setting(db, key, ""), after: value });
    db.prepare(
      "INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    ).run(key, value);
  } else if (data.action === "removeChat") {
    const message = db
      .prepare("SELECT user_id,table_id,body,created FROM chat WHERE id=?")
      .get(data.target);
    ensure(message, "Message not found", 404);
    detail = JSON.stringify(message);
    db.prepare("DELETE FROM chat WHERE id=?").run(data.target);
  } else if (data.action === "resolve") {
    ensure(
      db
        .prepare("UPDATE reports SET resolved=1 WHERE id=? AND resolved=0")
        .run(data.target).changes,
      "Open report not found",
    );
  } else {
    const target = getUser(db, data.target);
    ensure(target, "Player not found", 404);
    ensure(
      target.id !== user.id ||
        !["ban", "suspend", "mute"].includes(data.action),
      "You cannot suspend yourself",
    );
    if (data.action === "ban" || data.action === "suspend") {
      target.bannedUntil =
        data.action === "ban" ? Number.MAX_SAFE_INTEGER : now + 30 * 86400_000;
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(target.id);
    }
    if (data.action === "unban") target.bannedUntil = 0;
    if (data.action === "mute") target.mutedUntil = now + 86400_000;
    if (data.action === "unmute") target.mutedUntil = 0;
    if (data.action === "avatar") target.avatar = 0;
    if (data.action === "balance") {
      const before = target.balance;
      changeBalance(target, data.amount * 100);
      detail = JSON.stringify({ before, after: target.balance });
    }
    saveUser(db, target);
  }
  db.prepare(
    "INSERT INTO audit(id,actor,action,target,reason,detail,created) VALUES(?,?,?,?,?,?,?)",
  ).run(
    randomUUID(),
    user.id,
    data.action,
    data.target,
    data.reason,
    detail,
    now,
  );
}
