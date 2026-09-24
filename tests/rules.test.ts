import { describe, expect, it } from "vitest";
import {
  bestHand,
  deck,
  pokerRank,
  rankFive,
  type Card,
  type Suit,
} from "@/domain/cards";
import {
  actCasino,
  bankerDraws,
  blackjackValue,
  casinoView,
  perfectPairs,
  startCasino,
  twentyOneThree,
} from "@/domain/casino";
import { cycleAt, nextReset, periodStart } from "@/domain/time";
import {
  actPoker,
  newSeat,
  newTable,
  pokerLimits,
  pokerView,
  startPoker,
} from "@/domain/poker";
const cards = (text: string): Card[] =>
  text.split(" ").map((s) => ({
    rank: "--23456789TJQKA".indexOf(s[0]),
    suit: s[1] as Suit,
  }));
const shoe = (text: string) => [...deck(6), ...cards(text).reverse()];
const input = {
  id: "round",
  kind: "blackjack" as const,
  bet: 10000,
  side: 0,
  side2: 0,
  target: "player" as const,
};
describe("London economy calendar", () => {
  it.each([
    ["2026-01-01T11:59:59Z", "2025-12-31"],
    ["2026-01-01T12:00:00Z", "2026-01-01"],
    ["2026-03-29T10:59:59Z", "2026-03-28"],
    ["2026-03-29T11:00:00Z", "2026-03-29"],
    ["2026-10-25T11:59:59Z", "2026-10-24"],
    ["2026-10-25T12:00:00Z", "2026-10-25"],
  ])("assigns %s to %s", (time, cycle) =>
    expect(cycleAt(new Date(time))).toBe(cycle),
  );
  it("computes reset over both DST transitions", () => {
    expect(nextReset(new Date("2026-03-28T12:00Z"))).toBe(
      "2026-03-29T11:00:00.000Z",
    );
    expect(nextReset(new Date("2026-10-24T12:00Z"))).toBe(
      "2026-10-25T12:00:00.000Z",
    );
    expect(periodStart("weekly", new Date("2026-09-28T10:59Z"))).toBe(
      "2026-09-21",
    );
    expect(periodStart("monthly", new Date("2026-10-01T10:59Z"))).toBe(
      "2026-09-01",
    );
  });
});
describe("card evaluation", () => {
  it("orders all nine categories and handles wheel straights", () => {
    const hands = [
      "Ac Jd 9h 7s 2c",
      "Ac Ad 9h 7s 2c",
      "Ac Ad 9h 9s 2c",
      "Ac Ad Ah 7s 2c",
      "Ac 2d 3h 4s 5c",
      "Ac Jc 9c 7c 2c",
      "Ac Ad Ah 7s 7c",
      "Ac Ad Ah As 2c",
      "Tc Jc Qc Kc Ac",
    ].map((s) => rankFive(cards(s)));
    expect(hands.map((h) => h.category)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    for (let i = 1; i < hands.length; i++)
      expect(hands[i].value).toBeGreaterThan(hands[i - 1].value);
    expect(bestHand(cards("Ac Ad Ah Ks Kd Kh 2c")).name).toBe("Full house");
  });
  it("enforces exactly two hole and three board cards in Omaha", () => {
    const board = cards("Tc Jc Qc Kc Ac"),
      hole = cards("2d 3d 4h 5h");
    expect(pokerRank(hole, board, true).category).toBe(0);
    expect(pokerRank(hole.slice(0, 2), board).category).toBe(8);
  });
});
describe("casino rules", () => {
  it("adjusts soft aces and pays natural blackjack 3:2", () => {
    expect(blackjackValue(cards("Ac Ad 9h"))).toEqual({
      total: 21,
      soft: true,
    });
    const r = startCasino(input, shoe("Ac 9h Kd 7s"));
    expect(r.stage).toBe("done");
    expect(r.returned).toBe(25000);
  });
  it("peeks for dealer blackjack and pushes simultaneous naturals", () => {
    expect(startCasino(input, shoe("Ac Ah Kd Ks")).returned).toBe(10000);
    expect(startCasino(input, shoe("9c Ah 8d Ks")).returned).toBe(0);
  });
  it("splits aces once and gives each hand only one card", () => {
    let r = startCasino(input, shoe("Ac 9h Ad 7s Kc Qh 2d"));
    expect(casinoView(r).dealer).toHaveLength(1);
    expect(casinoView(r)).not.toHaveProperty("deck");
    r = actCasino(r, "split");
    expect(r.stage).toBe("done");
    expect(r.wagered).toBe(20000);
    expect(r.returned).toBe(40000);
    expect(() => actCasino(r, "hit")).toThrow();
  });
  it("doubles after splitting and stands on soft 17", () => {
    let r = startCasino(input, shoe("8c Ah 8d 6s 3c 2h Tc 9d"));
    r = actCasino(r, "split");
    r = actCasino(r, "double");
    r = actCasino(r, "stand");
    expect(r.wagered).toBe(30000);
    expect(r.dealer).toHaveLength(2);
    expect(r.returned).toBe(40000);
  });
  it("pays conventional side-bet tables", () => {
    expect(perfectPairs(cards("Ac Ac"))).toBe(26);
    expect(perfectPairs(cards("Ac As"))).toBe(13);
    expect(perfectPairs(cards("Ac Ah"))).toBe(7);
    expect(twentyOneThree(cards("Ac Ac Ac"))).toBe(101);
    expect(twentyOneThree(cards("Ac 2c 3c"))).toBe(41);
    expect(twentyOneThree(cards("Qc Kd As"))).toBe(11);
  });
  it("implements every banker third-card row", () => {
    const allowed = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [0, 1, 2, 3, 4, 5, 6, 7, 9],
      [2, 3, 4, 5, 6, 7],
      [4, 5, 6, 7],
      [6, 7],
      [],
      [],
      [],
    ];
    for (let b = 0; b < 10; b++)
      for (let p = 0; p < 10; p++)
        expect(bankerDraws(b, p)).toBe(allowed[b].includes(p));
    for (let b = 0; b < 10; b++) expect(bankerDraws(b, null)).toBe(b <= 5);
  });
  it("settles baccarat naturals, ties and commission exactly", () => {
    const baccarat = {
      ...input,
      kind: "baccarat" as const,
      target: "banker" as const,
    };
    const r = startCasino(baccarat, shoe("2c 4c 3d 5d"));
    expect(r.returned).toBe(19500);
    expect(r.dealer).toHaveLength(2);
    expect(
      startCasino({ ...baccarat, target: "player" }, shoe("4c 4h 5d 5s"))
        .returned,
    ).toBe(10000);
    expect(
      startCasino({ ...baccarat, target: "tie" }, shoe("4c 4h 5d 5s")).returned,
    ).toBe(90000);
  });
  it("limits Ultimate betting stages and resolves Trips even after folding", () => {
    let r = startCasino(
      { ...input, kind: "ultimate", side: 1000 },
      shoe("Ac 2c Ad 3c Ah Ks Qd 8h 7s"),
    );
    expect(() => actCasino(r, "raise1")).toThrow();
    r = actCasino(r, "check");
    expect(r.board).toHaveLength(3);
    r = actCasino(r, "check");
    r = actCasino(r, "fold");
    expect(r.returned).toBe(4000);
    expect(r.wagered).toBe(21000);
  });
  it("pays the Ultimate royal blind and Trips, pushing an unqualified ante", () => {
    let r = startCasino(
      { ...input, kind: "ultimate", side: 1000 },
      shoe("Ac 2d Kc 3h Qc Jc Tc 8h 7s"),
    );
    r = actCasino(r, "raise4");
    expect(r.returned).toBe(10000 + 80000 + 5010000 + 51000);
  });
});
describe("poker state machine", () => {
  function table(
    variant: "plo" | "nlhe" = "nlhe",
    stacks = [10000, 10000, 10000],
  ) {
    const t = newTable("table", "Test", variant, 200, null, 0);
    stacks.forEach(
      (stack, i) => (t.seats[i] = newSeat(`p${i}`, `Player${i}`, 0, stack)),
    );
    return startPoker(t, deck(), 0);
  }
  it("orders heads-up blinds and postflop turns", () => {
    let t = table("nlhe", [10000, 10000]);
    expect(t.button).toBe(0);
    expect(t.turn).toBe(0);
    t = actPoker(t, "p0", "call");
    t = actPoker(t, "p1", "check");
    expect(t.turn).toBe(1);
    expect(t.board).toHaveLength(3);
  });
  it("does not reopen a check after an incomplete opening all-in", () => {
    let t = table("nlhe", [10000, 10000, 280, 10000]);
    while (t.street === 0) {
      const s = t.seats[t.turn]!;
      t = actPoker(t, s.userId, pokerLimits(t, t.turn).call ? "call" : "check");
    }
    t = actPoker(t, "p1", "check");
    t = actPoker(t, "p2", "raise", 80);
    expect(pokerLimits(t, 3).min).toBe(280);
    t = actPoker(t, "p3", "call");
    t = actPoker(t, "p0", "call");
    expect(t.turn).toBe(1);
    expect(pokerLimits(t, 1).canRaise).toBe(false);
  });
  it("reopens cumulatively after two short all-ins reach a full raise", () => {
    let t = table("nlhe", [250, 400, 10000, 10000]);
    t = actPoker(t, "p3", "call");
    t = actPoker(t, "p0", "raise", 250);
    expect(pokerLimits(t, 3).canRaise).toBe(false);
    t = actPoker(t, "p1", "raise", 400);
    t = actPoker(t, "p2", "call");
    expect(pokerLimits(t, 3).canRaise).toBe(true);
    expect(pokerLimits(t, 3).min).toBe(600);
  });
  it("caps pot-limit raises and rejects out-of-turn play", () => {
    const t = table("plo");
    expect(pokerLimits(t, t.turn).max).toBe(700);
    expect(() => actPoker(t, "p1", "call")).toThrow();
    expect(() => actPoker(t, "p0", "raise", 800)).toThrow();
    expect(actPoker(t, "p0", "raise", 700).currentBet).toBe(700);
  });
  it("does not reopen raising after a short all-in", () => {
    let t = table("nlhe", [10000, 10000, 250]);
    t = actPoker(t, "p0", "call");
    t = actPoker(t, "p1", "call");
    t = actPoker(t, "p2", "raise", 250);
    expect(pokerLimits(t, 0).canRaise).toBe(false);
    expect(pokerLimits(t, 0).call).toBe(50);
    expect(() => actPoker(t, "p0", "raise", 500)).toThrow();
  });
  it("preserves stacks across side pots and all-in runouts", () => {
    let t = table("nlhe", [1000, 2000, 3000]);
    t = actPoker(t, "p0", "raise", 1000);
    t = actPoker(t, "p1", "raise", 2000);
    t = actPoker(t, "p2", "call");
    expect(t.status).toBe("complete");
    expect(t.board).toHaveLength(5);
    expect(t.seats.reduce((n, s) => n + (s?.stack ?? 0), 0)).toBe(6000);
  });
  it("never exposes deck or opponent cards before showdown", () => {
    const t = table();
    const view = pokerView(t, "p0");
    expect(view).not.toHaveProperty("deck");
    expect(view.seats[0]?.hole).toHaveLength(2);
    expect(view.seats[1]?.hole).toHaveLength(0);
    expect(
      pokerView(t, "spectator").seats.every((s) => !s || s.hole.length === 0),
    ).toBe(true);
  });
  it("conserves chips through 100 deterministic mixed-action hands", () => {
    let seed = 12345;
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    for (let hand = 0; hand < 100; hand++) {
      let t = table(
        hand % 2 ? "plo" : "nlhe",
        Array.from(
          { length: 2 + (hand % 5) },
          () => 200 + Math.floor(rand() * 3000),
        ),
      );
      const total = t.seats.reduce(
        (n, s) => n + (s ? s.stack + s.committed : 0),
        0,
      );
      let actions = 0;
      while (t.status === "playing" && actions++ < 200) {
        const s = t.seats[t.turn]!,
          limits = pokerLimits(t, t.turn),
          choice = rand();
        t =
          choice < 0.15
            ? actPoker(t, s.userId, "fold")
            : choice < 0.4 && limits.canRaise && limits.min <= limits.max
              ? actPoker(t, s.userId, "raise", limits.max)
              : actPoker(t, s.userId, limits.call ? "call" : "check");
        expect(t.seats.every((s) => !s || s.stack >= 0)).toBe(true);
      }
      expect(t.status).toBe("complete");
      expect(t.seats.reduce((n, s) => n + (s?.stack ?? 0), 0)).toBe(total);
    }
  });
});
