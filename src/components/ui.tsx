"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { cardLabel, rankLabel, suitSymbol, type Card } from "@/domain/cards";
export function PlayingCard({
  card,
  small = false,
}: {
  card?: Card;
  small?: boolean;
}) {
  return (
    <span
      className={`playing-card ${!card ? "card-back" : card.suit === "d" || card.suit === "h" ? "red" : ""} ${small ? "small" : ""}`}
      aria-label={card ? cardLabel(card) : "Face-down card"}
      role="img"
    >
      {card ? (
        <>
          <span className="card-corner">
            {rankLabel(card.rank)}
            <small>{suitSymbol[card.suit]}</small>
          </span>
          <span className="card-suit">{suitSymbol[card.suit]}</span>
          <span className="card-corner bottom">
            {rankLabel(card.rank)}
            <small>{suitSymbol[card.suit]}</small>
          </span>
        </>
      ) : (
        <span>✦</span>
      )}
    </span>
  );
}
export function Cards({
  cards,
  hidden = 0,
  small = false,
}: {
  cards: Card[];
  hidden?: number;
  small?: boolean;
}) {
  return (
    <div className="cards">
      {cards.map((c, i) => (
        <PlayingCard key={i} card={c} small={small} />
      ))}
      {Array.from({ length: hidden }, (_, i) => (
        <PlayingCard key={`h${i}`} small={small} />
      ))}
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="section-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Pill({ children }: { children: ReactNode }) {
  return <span className="pill">{children}</span>;
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
export function Progress({ value, max }: { value: number; max: number }) {
  return (
    <progress
      aria-label="Progress toward completion"
      value={Math.min(value, max)}
      max={max}
    />
  );
}
export type Send = (command: string, data?: unknown) => Promise<unknown>;
