"use client";
import { useState, type CSSProperties } from "react";
import type { CasinoKind } from "@/domain/casino";
import { chips } from "@/domain/models";

// Editable bets use whole chips, matching the deal command. Server balances use hundredths.
export type Bets = { bet: number; side: number; side2: number; target: string };
export const denominations = [1, 5, 25, 100, 1000];
export function wagerTotal(kind: CasinoKind, bets: Bets) {
  return bets.bet * (kind === "ultimate" ? 2 : 1) + bets.side + bets.side2;
}
export function addChip(
  kind: CasinoKind,
  bets: Bets,
  spot: string,
  amount: number,
  balance: number,
): Bets {
  if (!denominations.includes(amount))
    throw new Error("Choose a chip from the tray.");
  const next = { ...bets };
  if (kind === "baccarat") {
    if (!["player", "banker", "tie"].includes(spot))
      throw new Error("Choose a betting spot.");
    next.bet = next.target === spot ? next.bet + amount : amount;
    next.target = spot;
  } else if (spot === "side" || (spot === "side2" && kind === "blackjack"))
    next[spot] += amount;
  else if (spot === "bet" || (spot === "blind" && kind === "ultimate"))
    next.bet += amount;
  else throw new Error("Choose a betting spot.");
  if (next.bet > 1000 || next.side > 100 || next.side2 > 100)
    throw new Error("Main bets: maximum 1,000. Side bets: maximum 100 chips.");
  if (wagerTotal(kind, next) > balance)
    throw new Error("Not enough chips for that wager.");
  return next;
}
export function useChipBets(
  kind: CasinoKind,
  balance: number,
  locked: boolean,
  onPlace?: () => void,
) {
  const [bets, setBets] = useState<Bets>({
    bet: 100,
    side: 0,
    side2: 0,
    target: "player",
  });
  const [history, setHistory] = useState<Bets[]>([]);
  const [selected, setSelected] = useState(25);
  const [error, setError] = useState("");
  function update(next: Bets) {
    setHistory((h) => [...h.slice(-99), bets]);
    setBets(next);
    setError("");
  }
  return {
    bets,
    selected,
    setSelected,
    error,
    canUndo: history.length > 0,
    place(spot: string, amount = selected) {
      if (locked) return;
      try {
        update(addChip(kind, bets, spot, amount, balance));
        onPlace?.();
      } catch (e) {
        setError((e as Error).message);
      }
    },
    clear() {
      if (!locked) update({ ...bets, bet: 0, side: 0, side2: 0 });
    },
    undo() {
      if (!locked && history.length) {
        setBets(history[history.length - 1]);
        setHistory((h) => h.slice(0, -1));
        setError("");
      }
    },
  };
}
type Model = ReturnType<typeof useChipBets>;
const colors = ["#c2cd86", "#80bad4", "#b59ac8", "#7d92a1", "#ddb867"];
function Chip({ value }: { value: number }) {
  const index = Math.max(
    0,
    denominations.findLastIndex((d) => d <= value),
  );
  return (
    <span
      className="casino-chip"
      style={{ "--chip-color": colors[index] } as CSSProperties}
    >
      <span>{chips(value * 100)}</span>
    </span>
  );
}
export function BettingSpots({
  kind,
  model,
  locked,
  placed,
  play = 0,
}: {
  kind: CasinoKind;
  model: Model;
  locked: boolean;
  placed?: Bets;
  play?: number;
}) {
  const bets = placed ?? model.bets;
  const spots =
    kind === "ultimate"
      ? ([
          ["side", "Trips", bets.side],
          ["bet", "Ante", bets.bet],
          ["blind", "Blind", bets.bet],
          ["play", "Play", play],
        ] as const)
      : kind === "blackjack"
        ? ([
            ["side", "Perfect Pairs", bets.side],
            ["bet", "Main bet", bets.bet],
            ["side2", "21+3", bets.side2],
          ] as const)
        : ["player", "tie", "banker"].map(
            (id) =>
              [
                id,
                id[0].toUpperCase() + id.slice(1),
                bets.target === id ? bets.bet : 0,
              ] as const,
          );
  return (
    <div
      className={`betting-spots spots-${kind}`}
      aria-label="Table betting spots"
    >
      {spots.map(([id, label, value]) => (
        <button
          key={id}
          type="button"
          className={`bet-spot spot-${id} ${value ? "has-chips" : ""}`}
          disabled={locked || id === "play"}
          aria-label={`${label}: ${chips(value * 100)} chips`}
          data-bet-spot={id}
          onClick={() => model.place(id)}
          onDragOver={(e) => {
            if (!locked && id !== "play") {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (!locked && id !== "play")
              model.place(
                id,
                Number(e.dataTransfer.getData("application/x-casino-chip")),
              );
          }}
        >
          <span className="spot-label">{label}</span>
          {value ? (
            <Chip value={value} />
          ) : (
            <span className="spot-plus">+</span>
          )}
        </button>
      ))}
    </div>
  );
}
export function ChipTray({ model, locked }: { model: Model; locked: boolean }) {
  return (
    <div className="chip-tray-wrap">
      <div className="chip-tray" aria-label="Chip tray">
        {denominations.map((value) => (
          <button
            type="button"
            key={value}
            className="tray-chip"
            disabled={locked}
            aria-label={`${value} chip`}
            aria-pressed={model.selected === value}
            draggable={!locked}
            onDragStart={(e) => {
              model.setSelected(value);
              e.dataTransfer.setData(
                "application/x-casino-chip",
                String(value),
              );
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => model.setSelected(value)}
          >
            <Chip value={value} />
          </button>
        ))}
        <button
          type="button"
          className="button secondary"
          disabled={locked || !model.canUndo}
          onClick={model.undo}
        >
          Undo
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={locked}
          onClick={model.clear}
        >
          Clear bets
        </button>
      </div>
      <p className="tray-help">
        Drag chips onto a bet, or select a chip and tap a spot. {model.selected}{" "}
        chips selected.
      </p>
      {model.error && (
        <p className="bet-error" role="alert">
          {model.error}
        </p>
      )}
    </div>
  );
}
