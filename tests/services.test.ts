import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  allTables,
  atomic,
  getUser,
  openDatabase,
  saveTable,
  saveUser,
  type DB,
} from "@/server/db";
import {
  hashToken,
  hashPassword,
  limit,
  login,
  recover,
  register,
  sessionUser,
} from "@/server/auth";
import { command } from "@/server/commands";
import { maintain } from "@/server/maintenance";
import { snapshot } from "@/server/state";
import { getRound } from "@/server/games";
import { recordResult } from "@/server/economy";
import { checkOrigin, readBody } from "@/server/http";
import { startCasino } from "@/domain/casino";
import { deck, type Card } from "@/domain/cards";
let db: DB;
const now = new Date("2026-09-24T15:00Z").getTime();
const password = "a-secure-testing-password";
const make = (username: string) => register(db, { username, password }, now);
const run = (
  id: string,
  name: string,
  data: unknown = {},
  time = now,
  actionId = randomUUID(),
) => command(db, id, { id: actionId, command: name, data }, time);
beforeEach(() => {
  db = openDatabase(":memory:");
  maintain(db, now);
});
afterEach(() => db.close());
describe("account security", () => {
  it("does not create a session from a password replaced during verification", async () => {
    const a = await make("Alice"),
      replacement = await hashPassword("replacement-long-password");
    const pending = login(db, { username: "Alice", password }, now);
    db.prepare("UPDATE users SET password=? WHERE id=?").run(
      replacement,
      a.user.id,
    );
    await expect(pending).rejects.toThrow("Credentials changed");
    expect(
      db.prepare("SELECT * FROM sessions WHERE user_id=?").all(a.user.id),
    ).toHaveLength(1);
  });
  it("hashes passwords, session tokens and recovery codes; rejects duplicate case variants", async () => {
    const a = await make("Alice");
    const row = db
      .prepare("SELECT password,recovery FROM users WHERE id=?")
      .get(a.user.id) as { password: string; recovery: string };
    expect(row.password).not.toContain(password);
    expect(row.recovery).toBe(hashToken(a.recovery));
    expect(sessionUser(db, a.token, now)?.id).toBe(a.user.id);
    expect(sessionUser(db, a.token, now + 8 * 86400_000)).toBeUndefined();
    await expect(make("aLiCe")).rejects.toThrow("already taken");
    await expect(
      login(db, { username: "Alice", password: "wrong-password-value" }, now),
    ).rejects.toThrow("incorrect");
    expect(
      (await login(db, { username: "alice", password }, now)).user.id,
    ).toBe(a.user.id);
  });
  it("rotates one-time recovery codes and revokes all old sessions", async () => {
    const a = await make("Alice");
    const recovery = await recover(
      db,
      {
        username: "Alice",
        password: "a-new-long-password",
        recovery: a.recovery,
      },
      now,
    );
    expect(recovery.recovery).not.toBe(a.recovery);
    expect(sessionUser(db, a.token, now)).toBeUndefined();
    expect(sessionUser(db, recovery.token, now)?.id).toBe(a.user.id);
    await expect(
      recover(db, { username: "Alice", password, recovery: a.recovery }, now),
    ).rejects.toThrow("incorrect");
  });
  it("expires persistent rate limits", () => {
    limit(db, "test", 2, 1000, now);
    limit(db, "test", 2, 1000, now);
    expect(() => limit(db, "test", 2, 1000, now)).toThrow("Too many");
    expect(() => limit(db, "test", 2, 1000, now + 1000)).not.toThrow();
  });
  it("rejects foreign origins and oversized or invalid bodies", async () => {
    expect(() =>
      checkOrigin(
        new Request("http://localhost:3000/api/action", {
          method: "POST",
          headers: {
            Origin: "https://evil.example",
            "Content-Type": "application/json",
          },
        }),
      ),
    ).toThrow("origin");
    await expect(
      readBody(
        new Request("http://localhost:3000/api/action", {
          method: "POST",
          body: "x".repeat(9000),
        }),
      ),
    ).rejects.toThrow("too large");
    await expect(
      readBody(
        new Request("http://localhost:3000/api/action", {
          method: "POST",
          body: "oops",
        }),
      ),
    ).rejects.toThrow("Invalid JSON");
  });
});
describe("transactional bankroll", () => {
  it("settles once and rejects duplicate IDs, invalid amounts and stale revisions", async () => {
    const a = await make("Alice"),
      id = randomUUID();
    run(a.user.id, "deal", { kind: "baccarat", bet: 100 }, now, id);
    const balance = getUser(db, a.user.id)!.balance;
    expect(() =>
      run(a.user.id, "deal", { kind: "baccarat", bet: 100 }, now, id),
    ).toThrow("already processed");
    expect(getUser(db, a.user.id)!.balance).toBe(balance);
    expect(() =>
      run(a.user.id, "deal", { kind: "baccarat", bet: -10 }),
    ).toThrow();
    const u = getUser(db, a.user.id)!;
    u.balance = 1;
    saveUser(db, u);
    expect(() => run(u.id, "deal", { kind: "baccarat", bet: 10 })).toThrow(
      "Not enough",
    );
    expect(getUser(db, u.id)!.balance).toBe(1);
  });
  it("rejects stale actions even with new request IDs, preserving the wager", async () => {
    const a = await make("Alice");
    const card = (rank: number): Card => ({ rank, suit: "c" });
    const r = startCasino(
      {
        id: randomUUID(),
        kind: "blackjack",
        bet: 10000,
        side: 0,
        side2: 0,
        target: "player",
      },
      [...deck(6), card(2), card(7), card(8), card(9), card(5)],
      now,
    );
    db.prepare("INSERT INTO rounds(user_id,data) VALUES(?,?)").run(
      a.user.id,
      JSON.stringify(r),
    );
    a.user.balance -= 10000;
    saveUser(db, a.user);
    run(a.user.id, "casino", { roundId: r.id, revision: 0, action: "hit" });
    expect(() =>
      run(a.user.id, "casino", { roundId: r.id, revision: 0, action: "stand" }),
    ).toThrow("changed");
    expect(getRound(db, a.user.id)!.revision).toBe(1);
  });
  it("claims a challenge exactly once while preserving wager and reward statistics", async () => {
    const a = await make("Alice");
    const u = getUser(db, a.user.id)!;
    atomic(db, () => {
      for (let i = 0; i < 5; i++) recordResult(db, u, -100);
      saveUser(db, u);
    });
    run(u.id, "claim");
    const updated = getUser(db, u.id)!;
    expect(updated.lost).toBe(500);
    expect(updated.rewards).toBe(30000);
    expect(updated.xp).toBe(200);
    expect(() => run(u.id, "claim")).toThrow("once");
    const state = snapshot(db, u.id, undefined, now);
    expect(state.leaderboard.daily.find((p) => p.id === u.id)?.profit).toBe(
      29500,
    );
  });
  it("resets active games exactly once and preserves permanent aggregates", async () => {
    const a = await make("Alice");
    run(a.user.id, "deal", { kind: "ultimate", bet: 100 });
    const u = getUser(db, a.user.id)!;
    u.won = 4000;
    u.xp = 100;
    saveUser(db, u);
    const boundary = new Date("2026-09-25T11:00Z").getTime();
    maintain(db, boundary);
    maintain(db, boundary);
    expect(getUser(db, u.id)).toMatchObject({
      balance: 1000000,
      xp: 100,
      won: 4000,
      dailyGames: 0,
      cycle: "2026-09-25",
    });
    expect(getRound(db, u.id)).toBeUndefined();
    expect(() =>
      run(
        u.id,
        "casino",
        { roundId: randomUUID(), revision: 0, action: "check" },
        boundary,
      ),
    ).toThrow();
  });
  it("persists rollback on a failed split/double and never charges twice", async () => {
    const a = await make("Alice");
    const r = startCasino(
      {
        id: randomUUID(),
        kind: "blackjack",
        bet: 10000,
        side: 0,
        side2: 0,
        target: "player",
      },
      deck(6),
      now,
    );
    db.prepare("INSERT INTO rounds(user_id,data) VALUES(?,?)").run(
      a.user.id,
      JSON.stringify(r),
    );
    a.user.balance = 0;
    saveUser(db, a.user);
    expect(() =>
      run(a.user.id, "casino", {
        roundId: r.id,
        revision: 0,
        action: "double",
      }),
    ).toThrow();
    expect(getRound(db, a.user.id)!.revision).toBe(0);
    expect(getUser(db, a.user.id)!.balance).toBe(0);
  });
});
describe("multiplayer, social and administration", () => {
  it("blocking a private host revokes invitations and returns a waiting stack safely", async () => {
    const a = await make("Alice"),
      b = await make("Bobby");
    const tableId = run(a.user.id, "createTable", {
      name: "Private game",
      variant: "nlhe",
      bigBlind: 20,
    }) as string;
    run(a.user.id, "social", { action: "request", target: b.user.id });
    run(b.user.id, "social", { action: "accept", target: a.user.id });
    run(a.user.id, "social", { action: "invite", target: b.user.id, tableId });
    run(b.user.id, "seat", { action: "join", seat: 1, buyIn: 1000, tableId });
    run(b.user.id, "social", { action: "block", target: a.user.id });
    maintain(db, now + 1000);
    expect(getUser(db, b.user.id)!.balance).toBe(1000000);
    expect(() => snapshot(db, b.user.id, tableId, now + 1000)).toThrow(
      "not found",
    );
    expect(
      db.prepare("SELECT * FROM invitations WHERE table_id=?").all(tableId),
    ).toHaveLength(0);
  });
  it("removes chat with evidence in the audit and supports both suspensions and bans", async () => {
    const a = await make("Alice"),
      b = await make("Bobby");
    a.user.role = "admin";
    saveUser(db, a.user);
    const tableId = allTables(db)[0].id;
    run(b.user.id, "chat", { tableId, body: "A message to moderate" });
    const message = snapshot(db, a.user.id, tableId, now).chat[0];
    run(a.user.id, "admin", {
      action: "removeChat",
      target: message.id,
      reason: "Moderation policy violation",
    });
    expect(snapshot(db, b.user.id, tableId, now).chat).toHaveLength(0);
    expect(
      snapshot(db, a.user.id, undefined, now).admin!.audit[0].detail,
    ).toContain("A message to moderate");
    run(a.user.id, "admin", {
      action: "suspend",
      target: b.user.id,
      reason: "Temporary suspension test",
    });
    expect(getUser(db, b.user.id)!.bannedUntil).toBe(now + 30 * 86400_000);
    run(a.user.id, "admin", {
      action: "ban",
      target: b.user.id,
      reason: "Permanent suspension test",
    });
    expect(getUser(db, b.user.id)!.bannedUntil).toBe(Number.MAX_SAFE_INTEGER);
    run(a.user.id, "admin", {
      action: "unban",
      target: b.user.id,
      reason: "Successful appeal review",
    });
    expect(getUser(db, b.user.id)!.bannedUntil).toBe(0);
  });
  it("holds poker stacks, hides private cards, handles disconnects and returns funds", async () => {
    const a = await make("Alice"),
      b = await make("Bobby"),
      t = allTables(db)[0];
    run(a.user.id, "seat", {
      tableId: t.id,
      action: "join",
      seat: 0,
      buyIn: 1000,
    });
    run(b.user.id, "seat", {
      tableId: t.id,
      action: "join",
      seat: 1,
      buyIn: 1000,
    });
    const state = snapshot(db, a.user.id, t.id, now);
    expect(state.me.balance).toBe(900000);
    expect(state.profiles.find((p) => p.id === a.user.id)!.balance).toBe(
      1000000,
    );
    expect(state.table?.seats[0]?.hole.length).toBe(2);
    expect(state.table?.seats[1]?.hole.length).toBe(0);
    expect(state.table).not.toHaveProperty("deck");
    const current = allTables(db).find((x) => x.id === t.id)!;
    maintain(db, now + 31_000);
    const after = allTables(db).find((x) => x.id === t.id)!;
    expect(after.status).toBe("complete");
    const actor = current.seats[current.turn]!;
    expect(
      after.seats.find((s) => s?.userId === actor.userId)?.sittingOut,
    ).toBe(true);
    run(a.user.id, "seat", { tableId: t.id, action: "leave" }, now + 31_000);
    run(b.user.id, "seat", { tableId: t.id, action: "leave" }, now + 31_000);
    expect(
      getUser(db, a.user.id)!.balance + getUser(db, b.user.id)!.balance,
    ).toBe(2020000);
  });
  it("restricts private games, handles requests and invitations, filters muted chat", async () => {
    const a = await make("Alice"),
      b = await make("Bobby"),
      c = await make("Carol");
    const id = run(a.user.id, "createTable", {
      name: "Friends only",
      variant: "plo",
      bigBlind: 20,
    }) as string;
    expect(() => snapshot(db, b.user.id, id, now)).toThrow("not found");
    run(a.user.id, "social", { action: "request", target: b.user.id });
    run(b.user.id, "social", { action: "accept", target: a.user.id });
    run(a.user.id, "social", {
      action: "invite",
      target: b.user.id,
      tableId: id,
    });
    expect(snapshot(db, b.user.id, id, now).table?.name).toBe("Friends only");
    expect(() =>
      run(c.user.id, "chat", { tableId: id, body: "hello" }),
    ).toThrow("not found");
    run(b.user.id, "chat", { tableId: id, body: "Hello 👋" });
    expect(snapshot(db, a.user.id, id, now).chat).toHaveLength(1);
    run(a.user.id, "social", { action: "mute", target: b.user.id });
    expect(snapshot(db, a.user.id, id, now).chat).toHaveLength(0);
    run(a.user.id, "social", { action: "block", target: b.user.id });
    expect(snapshot(db, a.user.id, undefined, now).friends).toHaveLength(0);
    expect(() =>
      run(b.user.id, "social", { action: "request", target: a.user.id }),
    ).toThrow("unavailable");
  });
  it("requires administrator authorization and audits support changes without leaderboard profit", async () => {
    const a = await make("Alice"),
      b = await make("Bobby");
    const action = {
      action: "balance",
      target: b.user.id,
      amount: 500,
      reason: "Correcting support issue",
    };
    expect(() => run(a.user.id, "admin", action)).toThrow("Administrator");
    a.user.role = "admin";
    saveUser(db, a.user);
    run(a.user.id, "admin", action);
    expect(getUser(db, b.user.id)!.balance).toBe(1050000);
    expect(
      snapshot(db, b.user.id, undefined, now).leaderboard.daily.find(
        (p) => p.id === b.user.id,
      )?.profit,
    ).toBe(0);
    expect(snapshot(db, a.user.id, undefined, now).admin?.audit).toHaveLength(
      1,
    );
    expect(snapshot(db, b.user.id, undefined, now).admin).toBeNull();
    run(a.user.id, "admin", {
      action: "ban",
      target: b.user.id,
      reason: "Repeated abusive messages",
    });
    expect(sessionUser(db, b.token, now)).toBeUndefined();
    expect(() => run(b.user.id, "deal", { kind: "baccarat", bet: 10 })).toThrow(
      "sign in",
    );
  });
  it("retains aggregates but expires operational records", async () => {
    const a = await make("Alice");
    run(a.user.id, "deal", { kind: "baccarat", bet: 10 });
    run(a.user.id, "chat", { tableId: allTables(db)[0].id, body: "hello" });
    maintain(db, now + 86400_001);
    expect(db.prepare("SELECT * FROM actions").all()).toHaveLength(0);
    expect(db.prepare("SELECT * FROM chat").all()).toHaveLength(0);
    expect(db.prepare("SELECT * FROM stats").all()).toHaveLength(1);
    expect(getUser(db, a.user.id)!.games).toBe(1);
  });
  it("restores persisted poker state rather than re-dealing on reconnect", async () => {
    const a = await make("Alice"),
      b = await make("Bobby"),
      t = allTables(db)[0];
    run(a.user.id, "seat", {
      tableId: t.id,
      action: "join",
      seat: 0,
      buyIn: 1000,
    });
    run(b.user.id, "seat", {
      tableId: t.id,
      action: "join",
      seat: 1,
      buyIn: 1000,
    });
    const original = allTables(db).find((x) => x.id === t.id)!;
    saveTable(db, JSON.parse(JSON.stringify(original)));
    maintain(db, now + 1000);
    const restored = allTables(db).find((x) => x.id === t.id)!;
    expect(restored.deck).toEqual(original.deck);
    expect(restored.seats).toEqual(original.seats);
    expect(restored.deadline).toBe(original.deadline);
  });
});
