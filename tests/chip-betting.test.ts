import { expect, it } from "vitest";
import { addChip, wagerTotal, type Bets } from "../src/components/chip-betting";
const empty: Bets = { bet: 0, side: 0, side2: 0, target: "player" };
it("matches Ultimate Ante and Blind and includes both in affordability", () => {
  const bet = addChip("ultimate", empty, "blind", 25, 50);
  expect(bet.bet).toBe(25);
  expect(wagerTotal("ultimate", bet)).toBe(50);
  expect(() => addChip("ultimate", empty, "bet", 25, 49)).toThrow("Not enough");
  expect(empty.bet).toBe(0);
});
it("enforces main and side limits without changing the previous wager", () => {
  expect(() =>
    addChip("blackjack", { ...empty, bet: 1000 }, "bet", 1, 10000),
  ).toThrow("maximum");
  expect(() =>
    addChip("blackjack", { ...empty, side: 100 }, "side", 1, 10000),
  ).toThrow("maximum");
  expect(addChip("blackjack", empty, "side2", 100, 10000).side2).toBe(100);
  expect(() => addChip("ultimate", empty, "side2", 5, 10000)).toThrow("spot");
});
it("rejects foreign drag payloads and unavailable betting spots", () => {
  for (const value of [NaN, -5, 500, Infinity])
    expect(() => addChip("blackjack", empty, "bet", value, 10000)).toThrow(
      "tray",
    );
  expect(() => addChip("ultimate", empty, "play", 25, 10000)).toThrow("spot");
});
it("moves the baccarat selection instead of placing opposing bets", () => {
  const player = addChip("baccarat", empty, "player", 100, 10000);
  const banker = addChip("baccarat", player, "banker", 25, 10000);
  expect(banker).toEqual({ ...empty, bet: 25, target: "banker" });
  expect(addChip("baccarat", banker, "banker", 5, 10000).bet).toBe(30);
});
