import { bestHand, draw, type Card } from "./cards";
import { ensure } from "./errors";

export type CasinoKind = "blackjack" | "baccarat" | "ultimate";
export type BlackjackHand = {
  cards: Card[];
  bet: number;
  done: boolean;
  split: boolean;
  aces: boolean;
};
export type CasinoRound = {
  id: string;
  revision: number;
  kind: CasinoKind;
  deck: Card[];
  player: Card[];
  dealer: Card[];
  board: Card[];
  hands: BlackjackHand[];
  active: number;
  stage: "preflop" | "flop" | "river" | "play" | "done";
  bet: number;
  side: number;
  side2: number;
  target: "player" | "banker" | "tie";
  wagered: number;
  returned: number;
  message: string;
  play: number;
  created: number;
};
export type CasinoAction =
  | "hit"
  | "stand"
  | "double"
  | "split"
  | "check"
  | "raise3"
  | "raise4"
  | "raise2"
  | "raise1"
  | "fold";
export function blackjackValue(cards: Card[]) {
  let total = cards.reduce(
    (n, c) => n + (c.rank === 14 ? 11 : Math.min(c.rank, 10)),
    0,
  );
  let aces = cards.filter((c) => c.rank === 14).length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}
export function perfectPairs(cards: Card[]): number {
  const [a, b] = cards;
  if (a.rank !== b.rank) return 0;
  if (a.suit === b.suit) return 26;
  const red = (c: Card) => c.suit === "d" || c.suit === "h";
  return red(a) === red(b) ? 13 : 7;
}
export function twentyOneThree(cards: Card[]): number {
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const trips = ranks[0] === ranks[2];
  const straight =
    new Set(ranks).size === 3 &&
    (ranks[2] - ranks[0] === 2 || ranks.join() === "2,3,14");
  return trips && flush
    ? 101
    : straight && flush
      ? 41
      : trips
        ? 31
        : straight
          ? 11
          : flush
            ? 6
            : 0;
}
export const baccaratValue = (cards: Card[]) =>
  cards.reduce(
    (n, c) => n + (c.rank === 14 ? 1 : c.rank >= 10 ? 0 : c.rank),
    0,
  ) % 10;
export function bankerDraws(banker: number, third: number | null) {
  if (third === null) return banker <= 5;
  return (
    banker <= 2 ||
    (banker === 3 && third !== 8) ||
    (banker === 4 && third >= 2 && third <= 7) ||
    (banker === 5 && third >= 4 && third <= 7) ||
    (banker === 6 && (third === 6 || third === 7))
  );
}
export function startCasino(
  input: {
    id: string;
    kind: CasinoKind;
    bet: number;
    side: number;
    side2: number;
    target: CasinoRound["target"];
  },
  cards: Card[],
  now = Date.now(),
): CasinoRound {
  const r: CasinoRound = {
    ...input,
    deck: [...cards],
    player: [],
    dealer: [],
    board: [],
    hands: [],
    active: 0,
    stage: "play",
    wagered: input.bet + input.side + input.side2,
    returned: 0,
    message: "Your move",
    play: 0,
    revision: 0,
    created: now,
  };
  r.player = [draw(r.deck)];
  r.dealer = [draw(r.deck)];
  r.player.push(draw(r.deck));
  r.dealer.push(draw(r.deck));
  if (r.kind === "baccarat") {
    const p = baccaratValue(r.player),
      b = baccaratValue(r.dealer);
    if (p < 8 && b < 8) {
      let third: number | null = null;
      if (p <= 5) {
        const card = draw(r.deck);
        r.player.push(card);
        third = baccaratValue([card]);
      }
      if (bankerDraws(b, third)) r.dealer.push(draw(r.deck));
    }
    const pv = baccaratValue(r.player),
      bv = baccaratValue(r.dealer);
    const winner = pv === bv ? "tie" : pv > bv ? "player" : "banker";
    r.returned =
      winner === r.target
        ? r.bet * (winner === "tie" ? 9 : winner === "banker" ? 1.95 : 2)
        : winner === "tie" && r.target !== "tie"
          ? r.bet
          : 0;
    r.returned = Math.round(r.returned);
    r.message = `${winner[0].toUpperCase() + winner.slice(1)} wins · Player ${pv}, Banker ${bv}`;
    r.stage = "done";
  } else if (r.kind === "blackjack") {
    r.hands = [
      {
        cards: [...r.player],
        bet: r.bet,
        done: false,
        split: false,
        aces: false,
      },
    ];
    r.returned =
      r.side * perfectPairs(r.player) +
      r.side2 * twentyOneThree([...r.player, r.dealer[0]]);
    const playerNatural = blackjackValue(r.player).total === 21,
      dealerNatural = blackjackValue(r.dealer).total === 21;
    if (playerNatural || dealerNatural) {
      r.returned += playerNatural ? (dealerNatural ? r.bet : r.bet * 2.5) : 0;
      r.stage = "done";
      r.message = playerNatural
        ? dealerNatural
          ? "Both have blackjack · push"
          : "Blackjack pays 3:2"
        : "Dealer blackjack";
      r.hands[0].done = true;
    }
  } else {
    r.stage = "preflop";
    r.wagered = r.bet * 2 + r.side;
  }
  return r;
}
export function casinoCost(r: CasinoRound, action: CasinoAction): number {
  if (r.kind === "blackjack" && (action === "double" || action === "split"))
    return r.hands[r.active]?.bet ?? 0;
  if (r.kind === "ultimate" && action.startsWith("raise"))
    return r.bet * Number(action.slice(5));
  return 0;
}
function finishBlackjack(r: CasinoRound) {
  if (r.hands.some((h) => blackjackValue(h.cards).total <= 21)) {
    while (blackjackValue(r.dealer).total < 17) r.dealer.push(draw(r.deck));
  }
  const dealer = blackjackValue(r.dealer).total;
  const outcomes: string[] = [];
  for (const hand of r.hands) {
    const total = blackjackValue(hand.cards).total;
    const factor =
      total > 21
        ? 0
        : dealer > 21 || total > dealer
          ? 2
          : total === dealer
            ? 1
            : 0;
    r.returned += hand.bet * factor;
    outcomes.push(
      total > 21
        ? "Bust"
        : factor === 2
          ? "Win"
          : factor === 1
            ? "Push"
            : "Dealer wins",
    );
  }
  r.stage = "done";
  r.message = outcomes.join(" · ");
}
function finishUltimate(r: CasinoRound, fold: boolean) {
  while (r.board.length < 5) r.board.push(draw(r.deck));
  const player = bestHand([...r.player, ...r.board]),
    dealer = bestHand([...r.dealer, ...r.board]);
  const trips =
    player.name === "Royal flush"
      ? 50
      : [0, 0, 0, 3, 4, 7, 8, 30, 40][player.category];
  r.returned = trips ? r.side * (trips + 1) : 0;
  if (!fold) {
    const compare = Math.sign(player.value - dealer.value);
    // Dealer needs a pair to qualify: ante pushes when unqualified; play/blind still resolve.
    r.returned +=
      dealer.category === 0
        ? r.bet
        : compare > 0
          ? r.bet * 2
          : compare === 0
            ? r.bet
            : 0;
    if (compare === 0) r.returned += r.play + r.bet;
    if (compare > 0) {
      r.returned += r.play * 2;
      const blind =
        player.name === "Royal flush"
          ? 500
          : [0, 0, 0, 0, 1, 1.5, 3, 10, 50][player.category];
      r.returned += r.bet * (1 + blind);
    }
    r.message = `${compare > 0 ? "You win" : compare === 0 ? "Push" : "Dealer wins"} · ${player.name}${dealer.category === 0 ? " · Ante pushes" : ""}`;
  } else r.message = `Folded · ${player.name}${trips ? " · Trips wins" : ""}`;
  r.stage = "done";
}
export function actCasino(
  original: CasinoRound,
  action: CasinoAction,
): CasinoRound {
  const r = structuredClone(original);
  ensure(r.stage !== "done", "This round is already complete");
  if (r.kind === "blackjack") {
    const h = r.hands[r.active];
    ensure(h && !h.done, "No active hand");
    ensure(
      ["hit", "stand", "double", "split"].includes(action),
      "Invalid blackjack action",
    );
    if (action === "split") {
      ensure(
        h.cards.length === 2 &&
          h.cards[0].rank === h.cards[1].rank &&
          r.hands.length < 4 &&
          !h.aces,
        "This hand cannot be split",
      );
      const aces = h.cards[0].rank === 14;
      const second = h.cards.pop()!;
      h.cards.push(draw(r.deck));
      h.split = true;
      h.aces = aces;
      h.done = aces;
      r.hands.splice(r.active + 1, 0, {
        cards: [second, draw(r.deck)],
        bet: h.bet,
        split: true,
        aces,
        done: aces,
      });
      r.wagered += h.bet;
    } else if (action === "double") {
      ensure(
        h.cards.length === 2 && !h.aces,
        "Double is only available on the first two cards",
      );
      r.wagered += h.bet;
      h.bet *= 2;
      h.cards.push(draw(r.deck));
      h.done = true;
    } else if (action === "hit") {
      ensure(!h.aces, "Split aces receive one card");
      h.cards.push(draw(r.deck));
      h.done = blackjackValue(h.cards).total >= 21;
    } else h.done = true;
    while (r.active < r.hands.length && r.hands[r.active].done) r.active++;
    if (r.active >= r.hands.length) finishBlackjack(r);
  } else if (r.kind === "ultimate") {
    const allowed =
      r.stage === "preflop"
        ? ["check", "raise3", "raise4"]
        : r.stage === "flop"
          ? ["check", "raise2"]
          : ["raise1", "fold"];
    ensure(
      allowed.includes(action),
      "Action unavailable at this betting stage",
    );
    if (action === "check") {
      const count = r.stage === "preflop" ? 3 : 5;
      while (r.board.length < count) r.board.push(draw(r.deck));
      r.stage = count === 3 ? "flop" : "river";
    } else {
      r.play = casinoCost(r, action);
      r.wagered += r.play;
      finishUltimate(r, action === "fold");
    }
  } else ensure(false, "Baccarat has no further actions");
  r.revision++;
  return r;
}
export function casinoView(r: CasinoRound) {
  const { deck: _deck, ...view } = r;
  void _deck;
  return {
    ...view,
    dealer:
      r.stage === "done"
        ? r.dealer
        : r.kind === "blackjack"
          ? [r.dealer[0]]
          : [],
    returned: r.stage === "done" ? r.returned : 0,
  };
}
