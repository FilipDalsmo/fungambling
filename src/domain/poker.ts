import { draw, pokerRank, type Card } from "./cards";
import { ensure } from "./errors";
export type Seat = {
  userId: string;
  username: string;
  avatar: number;
  stack: number;
  startStack: number;
  hole: Card[];
  folded: boolean;
  street: number;
  committed: number;
  actedAt: number | null;
  sittingOut: boolean;
  leaving: boolean;
  timedOut: boolean;
};
export type PokerTable = {
  id: string;
  name: string;
  variant: "nlhe" | "plo";
  bigBlind: number;
  private: boolean;
  owner: string | null;
  seats: (Seat | null)[];
  button: number;
  turn: number;
  street: number;
  board: Card[];
  deck: Card[];
  currentBet: number;
  minRaise: number;
  status: "waiting" | "playing" | "complete";
  deadline: number;
  revision: number;
  hand: number;
  message: string;
  showdown: boolean;
  created: number;
};
export function newTable(
  id: string,
  name: string,
  variant: PokerTable["variant"],
  bigBlind: number,
  owner: string | null,
  now = Date.now(),
): PokerTable {
  return {
    id,
    name,
    variant,
    bigBlind,
    owner,
    private: owner !== null,
    seats: Array(6).fill(null),
    button: -1,
    turn: -1,
    street: 0,
    board: [],
    deck: [],
    currentBet: 0,
    minRaise: bigBlind,
    status: "waiting",
    deadline: 0,
    revision: 0,
    hand: 0,
    message: "Waiting for two players",
    showdown: false,
    created: now,
  };
}
export function newSeat(
  userId: string,
  username: string,
  avatar: number,
  stack: number,
): Seat {
  return {
    userId,
    username,
    avatar,
    stack,
    startStack: stack,
    hole: [],
    folded: true,
    street: 0,
    committed: 0,
    actedAt: null,
    sittingOut: false,
    leaving: false,
    timedOut: false,
  };
}
function nextSeat(
  t: PokerTable,
  after: number,
  predicate: (s: Seat) => boolean,
): number {
  for (let n = 1; n <= 6; n++) {
    const i = (after + n + 6) % 6;
    const s = t.seats[i];
    if (s && predicate(s)) return i;
  }
  return -1;
}
const inHand = (s: Seat) => s.hole.length > 0 && !s.folded;
const canAct = (s: Seat) => inHand(s) && s.stack > 0;
function put(s: Seat, amount: number) {
  s.stack -= amount;
  s.street += amount;
  s.committed += amount;
}
export function startPoker(
  original: PokerTable,
  cards: Card[],
  now = Date.now(),
): PokerTable {
  const t = structuredClone(original);
  ensure(t.status !== "playing", "A hand is already running");
  const ready = (s: Seat) =>
    !s.sittingOut && !s.leaving && s.stack >= t.bigBlind;
  ensure(
    t.seats.filter((s) => s && ready(s)).length >= 2,
    "Two ready players are needed",
  );
  t.deck = [...cards];
  t.board = [];
  t.street = 0;
  t.currentBet = t.bigBlind;
  t.minRaise = t.bigBlind;
  t.button = nextSeat(t, t.button, ready);
  t.status = "playing";
  t.showdown = false;
  t.hand++;
  t.revision++;
  for (const s of t.seats)
    if (s) {
      s.startStack = s.stack;
      s.hole = [];
      s.street = 0;
      s.committed = 0;
      s.actedAt = null;
      s.timedOut = false;
      s.folded = !ready(s);
      if (!s.folded)
        s.hole = Array.from({ length: t.variant === "plo" ? 4 : 2 }, () =>
          draw(t.deck),
        );
    }
  const count = t.seats.filter((s) => s && inHand(s)).length;
  const sb = count === 2 ? t.button : nextSeat(t, t.button, inHand);
  const bb = nextSeat(t, sb, inHand);
  put(t.seats[sb]!, Math.min(t.bigBlind / 2, t.seats[sb]!.stack));
  put(t.seats[bb]!, Math.min(t.bigBlind, t.seats[bb]!.stack));
  t.turn = nextSeat(t, bb, canAct);
  t.deadline = now + 30_000;
  t.message = "Preflop";
  advance(t, bb, now);
  return t;
}
export function pokerLimits(t: PokerTable, index: number) {
  const s = t.seats[index];
  if (!s) return { call: 0, min: 0, max: 0, canRaise: false };
  const call = Math.min(s.stack, Math.max(0, t.currentBet - s.street));
  const pot = t.seats.reduce((n, p) => n + (p?.committed ?? 0), 0);
  const max = Math.min(
    s.street + s.stack,
    t.variant === "plo"
      ? s.street + call + pot + call
      : Number.MAX_SAFE_INTEGER,
  );
  const min = t.currentBet + t.minRaise;
  const opponents = t.seats.some((p, i) => i !== index && p && canAct(p));
  return {
    call,
    min: Math.min(min, s.street + s.stack),
    max,
    canRaise:
      opponents &&
      max > t.currentBet &&
      (s.actedAt === null || t.currentBet - s.actedAt >= t.minRaise),
  };
}
function settle(t: PokerTable, now: number) {
  const live = t.seats.filter((s): s is Seat => !!s && inHand(s));
  t.showdown = live.length > 1;
  const payouts = new Map<string, number>();
  const levels = [
    ...new Set(t.seats.map((s) => s?.committed ?? 0).filter((n) => n > 0)),
  ].sort((a, b) => a - b);
  let previous = 0;
  for (const level of levels) {
    const contributors = t.seats.filter(
      (s): s is Seat => !!s && s.committed >= level,
    );
    const pot = (level - previous) * contributors.length;
    previous = level;
    // Uncalled excess is returned, not contested.
    if (contributors.length === 1) {
      const s = contributors[0];
      payouts.set(s.userId, (payouts.get(s.userId) ?? 0) + pot);
      continue;
    }
    const eligible = contributors.filter(inHand);
    ensure(eligible.length > 0, "Invalid pot eligibility", 500);
    const ranks = eligible.map((s) => ({
      seat: s,
      rank:
        live.length === 1
          ? 0
          : pokerRank(s.hole, t.board, t.variant === "plo").value,
    }));
    const best = Math.max(...ranks.map((r) => r.rank));
    const winners = ranks
      .filter((r) => r.rank === best)
      .map((r) => r.seat)
      .sort(
        (a, b) =>
          ((t.seats.indexOf(a) - t.button + 5) % 6) -
          ((t.seats.indexOf(b) - t.button + 5) % 6),
      );
    const share = Math.floor(pot / winners.length);
    let remainder = pot % winners.length;
    for (const s of winners)
      payouts.set(
        s.userId,
        (payouts.get(s.userId) ?? 0) + share + (remainder-- > 0 ? 1 : 0),
      );
  }
  for (const s of t.seats) if (s) s.stack += payouts.get(s.userId) ?? 0;
  t.message = [...payouts]
    .filter(([, amount]) => amount > 0)
    .map(
      ([id, amount]) =>
        `${t.seats.find((s) => s?.userId === id)!.username} receives ${(amount / 100).toLocaleString("en-GB")} chips`,
    )
    .join(" · ");
  t.status = "complete";
  t.deadline = now + 8_000;
  t.turn = -1;
}
function advance(t: PokerTable, after: number, now: number) {
  const live = t.seats.filter((s): s is Seat => !!s && inHand(s));
  if (live.length === 1) {
    settle(t, now);
    return;
  }
  const actors = live.filter(canAct);
  if (
    actors.length <= 1 &&
    (!actors.length || actors[0].street >= t.currentBet)
  ) {
    while (t.board.length < 5) t.board.push(draw(t.deck));
    settle(t, now);
    return;
  }
  const pending = (s: Seat) =>
    canAct(s) && (s.actedAt === null || s.street < t.currentBet);
  const next = nextSeat(t, after, pending);
  if (next >= 0) {
    t.turn = next;
    t.deadline = now + 30_000;
    return;
  }
  if (t.street === 3) {
    settle(t, now);
    return;
  }
  t.street++;
  t.currentBet = 0;
  t.minRaise = t.bigBlind;
  for (const s of t.seats)
    if (s) {
      s.street = 0;
      s.actedAt = null;
    }
  const count = t.street === 1 ? 3 : 1;
  for (let n = 0; n < count; n++) t.board.push(draw(t.deck));
  t.message = ["Preflop", "Flop", "Turn", "River"][t.street];
  advance(t, t.button, now);
}
export function actPoker(
  original: PokerTable,
  userId: string,
  action: "fold" | "check" | "call" | "raise",
  amount = 0,
  now = Date.now(),
  timeout = false,
): PokerTable {
  const t = structuredClone(original);
  ensure(t.status === "playing", "There is no active hand");
  const s = t.seats[t.turn];
  ensure(s?.userId === userId, "It is not your turn", 409);
  const limits = pokerLimits(t, t.turn);
  if (action === "fold") s.folded = true;
  else if (action === "check")
    ensure(limits.call === 0, "You must call or fold");
  else if (action === "call") {
    ensure(limits.call > 0, "Check when there is no bet");
    put(s, limits.call);
  } else {
    ensure(
      limits.canRaise &&
        Number.isSafeInteger(amount) &&
        amount >= limits.min &&
        amount <= limits.max &&
        amount > t.currentBet,
      "Raise outside the permitted range",
    );
    const raise = amount - t.currentBet;
    put(s, amount - s.street);
    if (raise >= t.minRaise) t.minRaise = raise;
    t.currentBet = amount;
  }
  s.actedAt = t.currentBet;
  if (timeout) {
    s.timedOut = true;
    s.sittingOut = true;
  }
  t.revision++;
  advance(t, t.turn, now);
  return t;
}
export function pokerView(t: PokerTable, userId: string) {
  const { deck: _deck, ...publicTable } = t;
  void _deck;
  return {
    ...publicTable,
    seats: t.seats.map((s) =>
      s
        ? {
            ...s,
            hole:
              s.userId === userId ||
              (t.status === "complete" && t.showdown && !s.folded)
                ? s.hole
                : [],
            cardCount: s.hole.length,
          }
        : null,
    ),
    limits: pokerLimits(
      t,
      t.seats.findIndex((s) => s?.userId === userId),
    ),
  };
}
