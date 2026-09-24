import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ensure } from "@/domain/errors";
import {
  actCasino,
  casinoCost,
  casinoView,
  startCasino,
  type CasinoRound,
} from "@/domain/casino";
import {
  actPoker,
  newSeat,
  newTable,
  startPoker,
  type PokerTable,
} from "@/domain/poker";
import type { User } from "@/domain/models";
import { allTables, getUser, saveTable, saveUser, type DB } from "./db";
import { changeBalance, recordResult } from "./economy";
import { shuffledDeck } from "./random";
const stake = z.number().int().min(1).max(1000);
const side = z.number().int().min(0).max(100).default(0);
export const dealSchema = z.object({
  kind: z.enum(["blackjack", "baccarat", "ultimate"]),
  bet: stake,
  side,
  side2: side,
  target: z.enum(["player", "banker", "tie"]).default("player"),
});
export function getRound(db: DB, userId: string): CasinoRound | undefined {
  const row = db
    .prepare("SELECT data FROM rounds WHERE user_id=?")
    .get(userId) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : undefined;
}
function saveRound(db: DB, user: User, r: CasinoRound) {
  db.prepare(
    "INSERT INTO rounds(user_id,data) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data",
  ).run(user.id, JSON.stringify(r));
  if (r.stage === "done") {
    changeBalance(user, r.returned);
    recordResult(db, user, r.returned - r.wagered);
  }
  saveUser(db, user);
  return casinoView(r);
}
export function deal(db: DB, user: User, input: unknown, now = Date.now()) {
  const data = dealSchema.parse(input);
  ensure(
    getRound(db, user.id)?.stage === "done" || !getRound(db, user.id),
    "Finish your current casino round first",
  );
  ensure(
    !allTables(db).some((t) => t.seats.some((s) => s?.userId === user.id)),
    "Leave your poker seat before playing casino games",
  );
  ensure(
    data.kind !== "baccarat" || data.side + data.side2 === 0,
    "Baccarat has no side bets",
  );
  ensure(
    data.kind !== "ultimate" || data.side2 === 0,
    "Ultimate Hold'em offers Trips only",
  );
  const bet = data.bet * 100,
    side = data.side * 100,
    side2 = data.side2 * 100;
  const cost = bet * (data.kind === "ultimate" ? 2 : 1) + side + side2;
  // Reserve the smallest eventual play bet too; players can always complete UTH.
  ensure(
    user.balance >= cost + (data.kind === "ultimate" ? bet : 0),
    "Not enough chips for this round",
  );
  changeBalance(user, -cost);
  return saveRound(
    db,
    user,
    startCasino(
      { ...data, id: randomUUID(), bet, side, side2 },
      shuffledDeck(
        data.kind === "ultimate" ? 1 : data.kind === "blackjack" ? 6 : 8,
      ),
      now,
    ),
  );
}
export function casinoAction(db: DB, user: User, input: unknown) {
  const data = z
    .object({
      roundId: z.string().uuid(),
      revision: z.number().int().min(0),
      action: z.enum([
        "hit",
        "stand",
        "double",
        "split",
        "check",
        "raise1",
        "raise2",
        "raise3",
        "raise4",
        "fold",
      ]),
    })
    .parse(input);
  const r = getRound(db, user.id);
  ensure(
    r && r.id === data.roundId && r.revision === data.revision,
    "This hand changed. Refresh and try again.",
    409,
  );
  const next = actCasino(r, data.action);
  changeBalance(user, -casinoCost(r, data.action));
  return saveRound(db, user, next);
}
export function tableAccess(db: DB, t: PokerTable, userId: string) {
  return (
    !t.private ||
    t.owner === userId ||
    t.seats.some((s) => s?.userId === userId) ||
    !!db
      .prepare("SELECT 1 FROM invitations WHERE table_id=? AND user_id=?")
      .get(t.id, userId)
  );
}
export function getTable(db: DB, id: string, userId: string) {
  const t = allTables(db).find((t) => t.id === id);
  ensure(t && tableAccess(db, t, userId), "Table not found", 404);
  return t;
}
function settlePoker(
  db: DB,
  before: PokerTable,
  after: PokerTable,
  now: number,
) {
  if (before.status === "playing" && after.status === "complete")
    for (const s of after.seats)
      if (s && s.hole.length > 0) {
        const user = getUser(db, s.userId)!;
        recordResult(db, user, s.stack - s.startStack);
        saveUser(db, user);
        if (
          s.timedOut ||
          user.lastSeen < now - 45_000 ||
          user.bannedUntil > now
        )
          s.sittingOut = true;
      }
  saveTable(db, after);
}
export function pokerAction(
  db: DB,
  user: User,
  input: unknown,
  now = Date.now(),
) {
  const data = z
    .object({
      tableId: z.string().uuid(),
      revision: z.number().int(),
      action: z.enum(["fold", "check", "call", "raise"]),
      amount: z
        .number()
        .nonnegative()
        .max(Number.MAX_SAFE_INTEGER / 100)
        .default(0),
    })
    .parse(input);
  const t = getTable(db, data.tableId, user.id);
  ensure(
    t.revision === data.revision,
    "The table changed. Try your action again.",
    409,
  );
  const next = actPoker(
    t,
    user.id,
    data.action,
    Math.round(data.amount * 100),
    now,
  );
  settlePoker(db, t, next, now);
}
export function seatAction(
  db: DB,
  user: User,
  input: unknown,
  now = Date.now(),
) {
  const data = z
    .object({
      tableId: z.string().uuid(),
      action: z.enum(["join", "leave", "sitout", "resume"]),
      seat: z.number().int().min(0).max(5).default(0),
      buyIn: z.number().int().positive().max(100000).default(1000),
    })
    .parse(input);
  const t = getTable(db, data.tableId, user.id);
  const index = t.seats.findIndex((s) => s?.userId === user.id);
  if (data.action === "join") {
    ensure(index < 0 && !t.seats[data.seat], "This seat is unavailable");
    ensure(
      !allTables(db).some((t) => t.seats.some((s) => s?.userId === user.id)),
      "You can sit at one poker table at a time",
    );
    ensure(
      !getRound(db, user.id) || getRound(db, user.id)?.stage === "done",
      "Finish your casino round first",
    );
    const amount = data.buyIn * 100;
    ensure(
      amount >= t.bigBlind * 20 && amount <= t.bigBlind * 100,
      "Buy in for 20–100 big blinds",
    );
    changeBalance(user, -amount);
    t.seats[data.seat] = newSeat(user.id, user.username, user.avatar, amount);
    // Joining during a hand waits for the next deal.
  } else {
    ensure(index >= 0, "You are not seated here");
    const s = t.seats[index]!;
    if (data.action === "leave") {
      if (t.status === "playing" && s.hole.length > 0) {
        s.leaving = true;
        s.sittingOut = true;
      } else {
        changeBalance(user, s.stack);
        t.seats[index] = null;
      }
    } else {
      ensure(
        data.action !== "resume" || s.stack >= t.bigBlind,
        "Leave and buy in again to replenish this stack",
      );
      s.sittingOut = data.action === "sitout";
      s.leaving = false;
    }
  }
  t.revision++;
  saveUser(db, user);
  saveTable(db, t);
  tickTables(db, now);
}
export function createTable(
  db: DB,
  user: User,
  input: unknown,
  now = Date.now(),
) {
  const data = z
    .object({
      name: z.string().trim().min(3).max(40),
      variant: z.enum(["nlhe", "plo"]),
      bigBlind: z.union([z.literal(20), z.literal(100)]),
    })
    .parse(input);
  ensure(
    allTables(db).filter((t) => t.owner === user.id).length < 3,
    "You can host up to three private tables",
  );
  const t = newTable(
    randomUUID(),
    data.name,
    data.variant,
    data.bigBlind * 100,
    user.id,
    now,
  );
  saveTable(db, t);
  return t.id;
}
export function tickTables(db: DB, now = Date.now()) {
  for (let t of allTables(db)) {
    if (t.status === "playing") {
      const s = t.seats[t.turn];
      if (
        s &&
        (t.deadline <= now ||
          s.leaving ||
          getUser(db, s.userId)!.bannedUntil > now)
      ) {
        const next = actPoker(
          t,
          s.userId,
          t.currentBet <= s.street ? "check" : "fold",
          0,
          now,
          true,
        );
        settlePoker(db, t, next, now);
        t = next;
      }
    }
    if (t.status !== "playing") {
      let changed = false;
      for (let i = 0; i < t.seats.length; i++) {
        const s = t.seats[i];
        if (!s) continue;
        const user = getUser(db, s.userId)!;
        if (
          s.leaving ||
          user.lastSeen < now - 5 * 60_000 ||
          user.bannedUntil > now
        ) {
          changeBalance(user, s.stack);
          saveUser(db, user);
          t.seats[i] = null;
          changed = true;
        } else if (user.lastSeen < now - 45_000 && !s.sittingOut) {
          s.sittingOut = true;
          changed = true;
        }
      }
      if (changed) {
        t.revision++;
        saveTable(db, t);
      }
      if (
        t.deadline <= now &&
        t.seats.filter(
          (s) => s && !s.sittingOut && !s.leaving && s.stack >= t.bigBlind,
        ).length >= 2
      ) {
        const next = startPoker(t, shuffledDeck(), now);
        settlePoker(db, t, next, now);
      }
    }
  }
}
