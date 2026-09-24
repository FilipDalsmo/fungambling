import { describe, expect, it } from "vitest";
import {
  planDeal,
  dealPause,
  type RoundView,
} from "../src/components/deal-sequence";
const a = { rank: 8, suit: "h" as const },
  b = { rank: 8, suit: "s" as const },
  c = { rank: 3, suit: "c" as const };
function round(overrides: Partial<RoundView> = {}): RoundView {
  return {
    id: "one",
    revision: 0,
    kind: "blackjack",
    player: [],
    dealer: [c],
    board: [],
    hands: [{ cards: [a, b], bet: 10, done: false, split: false, aces: false }],
    active: 0,
    stage: "play",
    bet: 10,
    side: 0,
    side2: 0,
    target: "player",
    wagered: 10,
    returned: 0,
    message: "",
    play: 0,
    created: 0,
    ...overrides,
  };
}
describe("table presentation", () => {
  it("gives face-down Ultimate deliveries a full beat before the next card", () => {
    const plan = planDeal(
      null,
      round({
        kind: "ultimate",
        player: [a, b],
        dealer: [],
        hands: [],
        stage: "preflop",
      }),
    );
    let elapsed = 0;
    const playerDeals: number[] = [];
    for (const step of plan.steps) {
      if (step.zone === "player" && step.sound === "deal")
        playerDeals.push(elapsed);
      elapsed += dealPause("ultimate", step);
    }
    expect(playerDeals[1] - playerDeals[0]).toBe(1390);
    expect(
      dealPause("ultimate", { zone: "dealer", index: 0, sound: "deal" }),
    ).toBeGreaterThanOrEqual(600);
  });
  it("deals the Ultimate flop as one packet and flips all three together", () => {
    const before = round({
      kind: "ultimate",
      stage: "preflop",
      player: [a, b],
      dealer: [],
      hands: [],
    });
    const plan = planDeal(before, {
      ...before,
      stage: "flop",
      board: [a, b, c],
    });
    expect(plan.steps).toEqual([
      { zone: "board", index: 0, sound: "deal", group: [a, b, c] },
      { zone: "board", index: 0, sound: "flip", group: [a, b, c] },
    ]);
  });
  it("deals alternating seats and keeps the blackjack hole card hidden", () => {
    const plan = planDeal(null, round());
    expect(
      plan.steps.filter((s) => s.sound === "deal").map((s) => s.zone),
    ).toEqual(["hand0", "dealer", "hand0", "dealer"]);
    expect(plan.steps.filter((s) => s.sound === "flip")).toHaveLength(3);
    expect(plan.target.dealer[1]).toEqual({ faceUp: false });
  });
  it("does not replay unchanged snapshots and deals only a hit", () => {
    const before = round();
    expect(planDeal(before, structuredClone(before)).steps).toEqual([]);
    const after = round({ hands: [{ ...before.hands[0], cards: [a, b, c] }] });
    expect(
      planDeal(before, after).steps.map((s) => [s.sound, s.index]),
    ).toEqual([
      ["deal", 2],
      ["flip", 2],
    ]);
  });
  it("turns the dealer hole card before dealing dealer draws", () => {
    expect(
      planDeal(round(), round({ stage: "done", dealer: [c, a, b] })).steps.map(
        (s) => [s.sound, s.index],
      ),
    ).toEqual([
      ["flip", 1],
      ["deal", 2],
      ["flip", 2],
    ]);
  });
  it("preserves moved split cards and deals only new cards", () => {
    const before = round();
    const hand = before.hands[0];
    const plan = planDeal(
      before,
      round({
        hands: [
          { ...hand, cards: [a, c] },
          { ...hand, cards: [b, c] },
        ],
      }),
    );
    expect(plan.initial.hand1[0].card).toEqual(b);
    expect(
      plan.steps
        .filter((s) => s.sound === "deal")
        .map((s) => [s.zone, s.index]),
    ).toEqual([
      ["hand0", 1],
      ["hand1", 1],
    ]);
  });
  it("deals baccarat third cards after the alternating opening", () => {
    const plan = planDeal(
      null,
      round({
        kind: "baccarat",
        stage: "done",
        player: [a, b, c],
        dealer: [b, a, c],
        hands: [],
      }),
    );
    expect(
      plan.steps.filter((s) => s.sound === "deal").map((s) => s.zone),
    ).toEqual(["player", "dealer", "player", "dealer", "player", "dealer"]);
  });
  it("reveals new community cards before the Ultimate dealer at showdown", () => {
    const before = round({
      kind: "ultimate",
      stage: "flop",
      player: [a, b],
      dealer: [],
      board: [a, b, c],
      hands: [],
    });
    const plan = planDeal(before, {
      ...before,
      stage: "done",
      board: [a, b, c, a, b],
      dealer: [b, c],
    });
    expect(plan.steps.map((s) => [s.zone, s.sound])).toEqual([
      ["board", "deal"],
      ["board", "flip"],
      ["board", "deal"],
      ["board", "flip"],
      ["dealer", "flip"],
      ["dealer", "flip"],
    ]);
  });
});
