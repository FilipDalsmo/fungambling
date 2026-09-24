"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { chips } from "@/domain/models";
import type { RoundView } from "./deal-sequence";

/** Mounted only after a newly played, net-positive round finishes revealing. */
export function WinCelebration({ round }: { round: RoundView }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3800);
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVisible(false);
    };
    window.addEventListener("keydown", close);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", close);
    };
  }, []);
  if (!visible) return null;
  return (
    <div className="win-celebration" data-testid="win-celebration">
      <div className="win-sparks" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <i key={i} style={{ "--spark": i } as CSSProperties} />
        ))}
      </div>
      <div className="win-panel">
        <span className="win-emblem" aria-hidden="true">
          ♠
        </span>
        <span className="win-kicker">ROUND COMPLETE</span>
        <h2>You win!</h2>
        <p
          className="win-amount"
          role="status"
          aria-label={`You won ${chips(round.returned - round.wagered)} chips net`}
        >
          <span>+</span>
          {chips(round.returned - round.wagered)}
          <small>CHIPS WON · NET PROFIT</small>
        </p>
        <p className="win-breakdown">
          {chips(round.returned)} returned · {chips(round.wagered)} wagered
        </p>
        <button
          type="button"
          className="win-dismiss"
          onClick={() => setVisible(false)}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
