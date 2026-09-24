import { randomInt } from "node:crypto";
import { deck, type Card } from "@/domain/cards";
export function shuffledDeck(copies = 1): Card[] {
  const cards = deck(copies);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
