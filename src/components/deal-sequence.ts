import type { AppState } from "@/server/state";
import type { Card } from "@/domain/cards";

export type RoundView = NonNullable<AppState["round"]>;
export type CardSlot = { card?: Card; faceUp: boolean; flop?: boolean };
export type TableCards = Record<string, CardSlot[]>;
export type DealStep = {
  zone: string;
  index: number;
  card?: Card;
  sound: "deal" | "flip";
  group?: Card[];
};
// Milliseconds until the next presentation event; face-down deliveries need
// their own full beat because they have no following flip event.
export function dealPause(kind: RoundView["kind"], step: DealStep) {
  if (step.group) return step.sound === "deal" ? 340 : 960;
  if (kind === "ultimate") {
    if (step.sound === "deal") return step.zone === "dealer" ? 650 : 320;
    return 420;
  }
  return step.sound === "deal"
    ? 300
    : step.zone === "dealer" && step.index > 0
      ? 500
      : 320;
}
export function tableCards(round: RoundView): TableCards {
  const table: TableCards = {
    dealer: round.dealer.map((card) => ({ card, faceUp: true })),
    board: round.board.map((card, i) => ({
      card,
      faceUp: true,
      flop: round.kind === "ultimate" && i < 3,
    })),
  };
  if (round.stage !== "done") {
    while (table.dealer.length < 2) table.dealer.push({ faceUp: false });
  }
  if (round.kind === "blackjack")
    round.hands.forEach((h, i) => {
      table[`hand${i}`] = h.cards.map((card) => ({ card, faceUp: true }));
    });
  else table.player = round.player.map((card) => ({ card, faceUp: true }));
  return table;
}

// Presentation only: this consumes the server's already filtered card view.
export function planDeal(previous: RoundView | null, next: RoundView) {
  const fresh = previous?.id !== next.id;
  const initial = fresh ? {} : tableCards(previous!);
  const target = tableCards(next);
  // A split moves an existing card into the new hand; it is not dealt again.
  if (!fresh && previous!.hands.length < next.hands.length) {
    const at = previous!.active;
    const moved = initial[`hand${at}`][1];
    for (let i = previous!.hands.length - 1; i > at; i--)
      initial[`hand${i + 1}`] = initial[`hand${i}`];
    initial[`hand${at}`] = [initial[`hand${at}`][0]];
    initial[`hand${at + 1}`] = [moved];
  }
  const steps: DealStep[] = [];
  const append = (zone: string, index: number) => {
    const slot = target[zone]?.[index];
    if (!slot) return;
    const old = initial[zone]?.[index];
    if (!old) steps.push({ zone, index, sound: "deal" });
    if (slot.card && !old?.faceUp)
      steps.push({ zone, index, card: slot.card, sound: "flip" });
  };
  if (fresh) {
    const player = next.kind === "blackjack" ? "hand0" : "player";
    for (let i = 0; i < 2; i++) {
      append(player, i);
      // Deal the hole card face-down, even when the response already settled.
      if (next.kind === "ultimate" || (i === 1 && next.kind === "blackjack"))
        steps.push({ zone: "dealer", index: i, sound: "deal" });
      else append("dealer", i);
    }
    for (let i = 2; i < (target[player]?.length ?? 0); i++) append(player, i);
  } else {
    for (const zone of Object.keys(target).filter(
      (z) => z !== "dealer" && z !== "board",
    )) {
      target[zone].forEach((_, i) => append(zone, i));
    }
  }
  const flop =
    next.kind === "ultimate" &&
    !initial.board?.length &&
    target.board.length >= 3;
  if (flop) {
    const group = next.board.slice(0, 3);
    steps.push({ zone: "board", index: 0, sound: "deal", group });
    steps.push({ zone: "board", index: 0, sound: "flip", group });
  }
  target.board.forEach((_, i) => {
    if (!flop || i >= 3) append("board", i);
  });
  if (fresh) {
    if (next.kind === "ultimate" && target.dealer[0]?.card)
      steps.push({
        zone: "dealer",
        index: 0,
        card: target.dealer[0].card,
        sound: "flip",
      });
    if (next.kind !== "baccarat" && target.dealer[1]?.card)
      steps.push({
        zone: "dealer",
        index: 1,
        card: target.dealer[1].card,
        sound: "flip",
      });
    for (let i = 2; i < target.dealer.length; i++) append("dealer", i);
  } else target.dealer.forEach((_, i) => append("dealer", i));
  return { initial, target, steps };
}
