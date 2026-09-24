"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cardLabel } from "@/domain/cards";
import { PlayingCard } from "./ui";
import {
  planDeal,
  dealPause,
  tableCards,
  type RoundView,
  type TableCards,
  type CardSlot,
} from "./deal-sequence";
export type TableSound = "deal" | "flip" | "win" | "loss" | "chips";
export function useDealtCards(
  round: RoundView | null,
  playSound: (sound: TableSound) => void,
) {
  const previous = useRef(round);
  const sound = useRef(playSound);
  useEffect(() => {
    sound.current = playSound;
  }, [playSound]);
  const token = round ? `${round.id}:${round.revision}` : "";
  const [presentation, setPresentation] = useState(() => ({
    token,
    cards: round ? tableCards(round) : ({} as TableCards),
    done: true,
    win: null as RoundView | null,
  }));
  // Serialized snapshots keep the sequence independent of one-second SSE object refreshes.
  const snapshot = JSON.stringify(round);
  useEffect(() => {
    const next = JSON.parse(snapshot) as RoundView | null;
    const key = next ? `${next.id}:${next.revision}` : "";
    if (
      previous.current?.id === next?.id &&
      previous.current?.revision === next?.revision
    )
      return;
    const plan = next ? planDeal(previous.current, next) : null;
    previous.current = next;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    let finished = false;
    let cards = plan?.initial ?? {};
    let index = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const settled = next?.stage === "done" && !document.hidden;
      setPresentation({
        token: key,
        cards: plan?.target ?? {},
        done: true,
        win: settled && next.returned > next.wagered ? next : null,
      });
      if (settled && next.returned !== next.wagered)
        sound.current(next.returned > next.wagered ? "win" : "loss");
    };
    const tick = () => {
      if (cancelled) return;
      if (
        media.matches ||
        document.hidden ||
        !plan ||
        index === plan.steps.length
      ) {
        finish();
        return;
      }
      const step = plan.steps[index++];
      cards = { ...cards, [step.zone]: [...(cards[step.zone] ?? [])] };
      if (step.group)
        step.group.forEach((card, i) => {
          cards[step.zone][i] = {
            card: step.sound === "flip" ? card : undefined,
            faceUp: step.sound === "flip",
            flop: true,
          };
        });
      else
        cards[step.zone][step.index] = {
          card: step.card,
          faceUp: step.sound === "flip",
        };
      setPresentation({ token: key, cards, done: false, win: null });
      sound.current(step.sound);
      timer = setTimeout(tick, dealPause(next!.kind, step));
    };
    timer = setTimeout(tick, 0);
    const skip = () => {
      if (media.matches || document.hidden) {
        cancelled = true;
        finish();
      }
    };
    media.addEventListener("change", skip);
    document.addEventListener("visibilitychange", skip);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      media.removeEventListener("change", skip);
      document.removeEventListener("visibilitychange", skip);
    };
  }, [snapshot]);
  return {
    cards:
      presentation.token.split(":")[0] === (round?.id ?? "")
        ? presentation.cards
        : {},
    dealing: presentation.token !== token || !presentation.done,
    win: presentation.token === token ? presentation.win : null,
  };
}
export function DealtCards({
  slots = [],
  capacity = 2,
}: {
  slots?: CardSlot[];
  capacity?: number;
}) {
  return (
    <div className="cards">
      {Array.from({ length: Math.max(capacity, slots.length) }, (_, i) => {
        const slot = slots[i];
        if (!slot)
          return (
            <span
              key={`empty${i}`}
              className="card-placeholder"
              aria-hidden="true"
            />
          );
        return (
          <span
            key={i}
            className={`dealt-card ${slot.flop ? "flop-card" : ""}`}
            style={{ "--card-index": i } as CSSProperties}
            role="img"
            aria-label={
              slot.faceUp && slot.card ? cardLabel(slot.card) : "Face-down card"
            }
            data-face-up={slot.faceUp}
          >
            <span
              className={`card-turn ${slot.faceUp ? "face-up" : ""}`}
              aria-hidden="true"
            >
              <span className="card-surface card-reverse">
                <PlayingCard />
              </span>
              <span className="card-surface card-obverse">
                <PlayingCard card={slot.card} />
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}
