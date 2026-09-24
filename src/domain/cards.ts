export type Suit = "c" | "d" | "h" | "s";
export type Card = { rank: number; suit: Suit };
export const SUITS: Suit[] = ["c", "d", "h", "s"];
export const suitSymbol = { c: "♣", d: "♦", h: "♥", s: "♠" };
export const rankLabel = (rank: number) =>
  ({ 11: "J", 12: "Q", 13: "K", 14: "A" })[rank] ?? String(rank);
export const cardLabel = (card: Card) =>
  `${rankLabel(card.rank)}${suitSymbol[card.suit]}`;
export function deck(copies = 1): Card[] {
  return Array.from({ length: copies }, () =>
    SUITS.flatMap((suit) =>
      Array.from({ length: 13 }, (_, i) => ({ rank: i + 2, suit })),
    ),
  ).flat();
}
export function draw(cards: Card[]): Card {
  const card = cards.pop();
  if (!card) throw new Error("Deck exhausted");
  return card;
}
export function combinations<T>(items: T[], count: number): T[][] {
  if (count === 0) return [[]];
  return items.flatMap((item, i) =>
    combinations(items.slice(i + 1), count - 1).map((rest) => [item, ...rest]),
  );
}
export const handNames = [
  "High card",
  "Pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
];
export type Rank = { category: number; value: number; name: string };
export function rankFive(cards: Card[]): Rank {
  if (cards.length !== 5) throw new Error("Five cards required");
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const groups = [...new Set(ranks)]
    .map((rank) => ({ rank, count: ranks.filter((r) => r === rank).length }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const unique = [...new Set(ranks)];
  const straight =
    unique.length === 5
      ? unique[0] - unique[4] === 4
        ? unique[0]
        : unique.join() === "14,5,4,3,2"
          ? 5
          : 0
      : 0;
  let category = 0;
  let kickers = ranks;
  if (flush && straight) {
    category = 8;
    kickers = [straight];
  } else if (groups[0].count === 4) {
    category = 7;
    kickers = groups.map((g) => g.rank);
  } else if (groups[0].count === 3 && groups[1].count === 2) {
    category = 6;
    kickers = groups.map((g) => g.rank);
  } else if (flush) {
    category = 5;
  } else if (straight) {
    category = 4;
    kickers = [straight];
  } else if (groups[0].count === 3) {
    category = 3;
    kickers = groups.map((g) => g.rank);
  } else if (groups[0].count === 2 && groups[1].count === 2) {
    category = 2;
    kickers = groups.map((g) => g.rank);
  } else if (groups[0].count === 2) {
    category = 1;
    kickers = groups.map((g) => g.rank);
  }
  const value = [
    category,
    ...kickers,
    ...Array(5 - kickers.length).fill(0),
  ].reduce((n, r) => n * 15 + r, 0);
  return {
    category,
    value,
    name:
      category === 8 && straight === 14 ? "Royal flush" : handNames[category],
  };
}
export function bestHand(cards: Card[]): Rank {
  return combinations(cards, 5)
    .map(rankFive)
    .reduce((best, rank) => (rank.value > best.value ? rank : best));
}
export function pokerRank(hole: Card[], board: Card[], omaha = false): Rank {
  if (!omaha) return bestHand([...hole, ...board]);
  return combinations(hole, 2)
    .flatMap((h) => combinations(board, 3).map((b) => rankFive([...h, ...b])))
    .reduce((best, rank) => (rank.value > best.value ? rank : best));
}
