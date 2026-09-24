"use client";
import { useState } from "react";
import type { AppState } from "@/server/state";
import { avatars, chips } from "@/domain/models";
import { Cards, Empty, Field, Pill, type Send } from "./ui";
export function PokerRoom({
  state,
  send,
  busy,
  select,
}: {
  state: AppState;
  send: Send;
  busy: boolean;
  select: (id: string) => void;
}) {
  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">GOOD COMPANY. GREAT HANDS.</span>
          <h1>The poker room</h1>
        </div>
        <Pill>Human players only</Pill>
      </div>
      <p className="muted">
        Six seats. No rake. No bots. Take a public seat or get your friends
        together.
      </p>
      <div className="poker-list">
        {state.tables.map((t) => (
          <button
            className={`panel poker-list-item ${t.variant}`}
            key={t.id}
            onClick={() => select(t.id)}
          >
            <span className="table-icon">
              {t.variant === "nlhe" ? "♠" : "♦"}
            </span>
            <div>
              <span className="eyebrow">
                {t.private ? "PRIVATE TABLE" : "PUBLIC TABLE"}{" "}
                {t.seated ? "· YOUR SEAT" : ""}
              </span>
              <h3>{t.name}</h3>
              <span className="muted">
                {t.variant === "nlhe"
                  ? "No-Limit Texas Hold’em"
                  : "Pot-Limit Omaha"}
              </span>
            </div>
            <div className="table-meta">
              <b>
                {chips(t.bigBlind / 2)} / {chips(t.bigBlind)}
              </b>
              <small>Blinds</small>
            </div>
            <div className="table-meta">
              <b>{t.players} / 6</b>
              <small>Players</small>
            </div>
            <span className="join-arrow">↗</span>
          </button>
        ))}
      </div>
      <section className="panel create-table">
        <h2>Your table. Your people.</h2>
        <p className="muted">
          Create a private game, then invite accepted friends from your table.
          Invited friends can also spectate.
        </p>
        <form
          className="bet-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const data = new FormData(form);
            const id = await send("createTable", {
              name: data.get("name"),
              variant: data.get("variant"),
              bigBlind: Number(data.get("blind")),
            });
            if (typeof id === "string") select(id);
          }}
        >
          <Field label="Table name">
            <input
              name="name"
              required
              minLength={3}
              maxLength={40}
              placeholder="Friday night cards"
            />
          </Field>
          <Field label="Game">
            <select name="variant">
              <option value="nlhe">No-Limit Hold’em</option>
              <option value="plo">Pot-Limit Omaha</option>
            </select>
          </Field>
          <Field label="Blinds">
            <select name="blind">
              <option value="20">10 / 20</option>
              <option value="100">50 / 100</option>
            </select>
          </Field>
          <button className="button primary" disabled={busy}>
            Create private table
          </button>
        </form>
      </section>
      <p className="fine-print">
        At 12:00 Europe/London, unfinished hands are voided, seats released and
        bankrolls reset. Leave a table to return your stack to your bankroll.
      </p>
    </section>
  );
}
export function PokerGame({
  state,
  send,
  busy,
  back,
  profile,
  tableId,
}: {
  state: AppState;
  send: Send;
  busy: boolean;
  back: () => void;
  profile: (id: string) => void;
  tableId: string;
}) {
  const t = state.table;
  const [buyIn, setBuyIn] = useState(1000),
    [raise, setRaise] = useState(40),
    [chat, setChat] = useState("");
  if (!t || t.id !== tableId) return <Empty>Opening your table…</Empty>;
  const seatIndex = t.seats.findIndex((s) => s?.userId === state.me.id),
    me = t.seats[seatIndex];
  const myTurn = t.status === "playing" && t.turn === seatIndex;
  const seat = (action: string, index = 0) =>
    send("seat", { tableId: t.id, action, seat: index, buyIn });
  const act = (action: string, amount = 0) =>
    send("poker", { tableId: t.id, revision: t.revision, action, amount });
  const pot = t.seats.reduce((n, s) => n + (s?.committed ?? 0), 0);
  const friends = state.friends
    .filter((f) => f.accepted)
    .map((f) =>
      state.profiles.find(
        (p) => p.id === (f.sender === state.me.id ? f.recipient : f.sender),
      ),
    )
    .filter((p) => !!p);
  return (
    <section>
      <button className="text-button back-button" onClick={back}>
        ← Poker room
      </button>
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {t.variant === "nlhe"
              ? "NO-LIMIT TEXAS HOLD’EM"
              : "POT-LIMIT OMAHA"}{" "}
            · {chips(t.bigBlind / 2)} / {chips(t.bigBlind)}
          </span>
          <h1>{t.name}</h1>
        </div>
        <Pill>
          {me ? "Seated" : "Spectating"} · Hand {t.hand}
        </Pill>
      </div>
      <div className="poker-layout">
        <div>
          <div className="poker-felt">
            <div className="poker-board">
              <span className="eyebrow">
                {t.status === "playing"
                  ? `POT · ${chips(pot)}`
                  : "FUN GAMBLING"}
              </span>
              <Cards cards={t.board} hidden={5 - t.board.length} small />
              <p className="poker-message" role="status">
                {t.message}
              </p>
            </div>
            {t.seats.map((s, i) => (
              <div
                className={`poker-seat seat-${i} ${t.turn === i && t.status === "playing" ? "current-turn" : ""} ${s?.folded ? "folded-seat" : ""}`}
                key={i}
              >
                {s ? (
                  <>
                    <button
                      className="seat-person"
                      onClick={() => profile(s.userId)}
                    >
                      <span className="avatar">{avatars[s.avatar]}</span>
                      <b>{s.username}</b>
                      {t.button === i && (
                        <span className="dealer-button" title="Dealer button">
                          D
                        </span>
                      )}
                    </button>
                    <span className="seat-stack">{chips(s.stack)}</span>
                    <Cards
                      small
                      cards={s.hole}
                      hidden={s.hole.length ? 0 : s.cardCount}
                    />
                    <small>
                      {s.leaving
                        ? "Leaving after hand"
                        : s.sittingOut
                          ? "Sitting out"
                          : s.folded && s.cardCount
                            ? "Folded"
                            : s.street
                              ? `${chips(s.street)} in`
                              : "Ready"}
                    </small>
                    {t.turn === i && t.status === "playing" && (
                      <span className="turn-clock">
                        ◷{" "}
                        {Math.max(
                          0,
                          Math.ceil((t.deadline - state.serverTime) / 1000),
                        )}
                        s
                      </span>
                    )}
                  </>
                ) : (
                  <button
                    className="empty-seat"
                    disabled={busy || !!me}
                    onClick={() => seat("join", i)}
                  >
                    <span>＋</span>Seat {i + 1}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="panel poker-controls">
            {me ? (
              <>
                <div>
                  <b>
                    {myTurn
                      ? "Your move"
                      : t.status === "playing"
                        ? "Waiting for the table"
                        : "Next hand starts shortly"}
                  </b>
                  <p className="muted small-text">
                    {me.leaving
                      ? "Your stack returns after this hand."
                      : `${chips(me.stack)} chips at the table`}
                  </p>
                </div>
                <div className="action-buttons">
                  {myTurn && (
                    <>
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => act("fold")}
                      >
                        Fold
                      </button>
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => act(t.limits.call ? "call" : "check")}
                      >
                        {t.limits.call
                          ? `Call ${chips(t.limits.call)}`
                          : "Check"}
                      </button>
                      {t.limits.canRaise && (
                        <>
                          <Field label="Raise to">
                            <input
                              aria-label="Raise to"
                              type="number"
                              min={t.limits.min / 100}
                              max={t.limits.max / 100}
                              step={0.01}
                              value={raise}
                              onChange={(e) => setRaise(Number(e.target.value))}
                            />
                          </Field>
                          <button
                            className="button secondary"
                            disabled={
                              busy ||
                              raise * 100 < t.limits.min ||
                              raise * 100 > t.limits.max
                            }
                            onClick={() => act("raise", raise)}
                          >
                            Raise
                          </button>
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => setRaise(t.limits.max / 100)}
                          >
                            {t.variant === "plo" ? "Pot" : "All in"}
                          </button>
                        </>
                      )}
                    </>
                  )}
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => seat(me.sittingOut ? "resume" : "sitout")}
                  >
                    {me.sittingOut ? "Resume play" : "Sit out next hand"}
                  </button>
                  <button
                    className="text-button"
                    disabled={busy || me.leaving}
                    onClick={() => seat("leave")}
                  >
                    {t.status === "playing" && me.cardCount
                      ? "Leave after hand"
                      : "Leave table"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <Field
                  label={`Buy-in · ${chips(t.bigBlind * 20)}–${chips(t.bigBlind * 100)} chips`}
                >
                  <input
                    type="number"
                    min={(t.bigBlind * 20) / 100}
                    max={(t.bigBlind * 100) / 100}
                    value={buyIn}
                    onChange={(e) => setBuyIn(Number(e.target.value))}
                  />
                </Field>
                <p className="muted">
                  Choose an empty seat above, or stay and watch.
                </p>
              </>
            )}
          </div>
        </div>
        <aside className="panel chat-panel">
          <h3>
            Table talk <span>♧</span>
          </h3>
          <div className="chat-log" role="log" aria-label="Table chat">
            {state.chat.length ? (
              state.chat.map((c) => (
                <div key={c.id}>
                  <button
                    className="text-button"
                    onClick={() => profile(c.userId)}
                  >
                    {c.username}
                  </button>
                  <p>{c.body}</p>
                </div>
              ))
            ) : (
              <Empty>Say hello to the table.</Empty>
            )}
          </div>
          <div className="reactions">
            {["👋", "👏", "🍀", "😅"].map((emoji) => (
              <button
                aria-label={`Send ${emoji}`}
                key={emoji}
                disabled={busy}
                onClick={() => send("chat", { tableId: t.id, body: emoji })}
              >
                {emoji}
              </button>
            ))}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if ((await send("chat", { tableId: t.id, body: chat })) !== false)
                setChat("");
            }}
          >
            <Field label="Message">
              <input
                value={chat}
                onChange={(e) => setChat(e.target.value)}
                maxLength={300}
                required
                placeholder="Keep it friendly…"
              />
            </Field>
            <button className="button secondary" disabled={busy}>
              Send
            </button>
          </form>
          {t.owner === state.me.id && (
            <form
              className="form-stack invite-form"
              onSubmit={(e) => {
                e.preventDefault();
                const target = new FormData(e.currentTarget).get("target");
                void send("social", {
                  action: "invite",
                  target,
                  tableId: t.id,
                });
              }}
            >
              <Field label="Invite a friend">
                <select name="target" required>
                  <option value="">Choose a friend</option>
                  {friends.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.username}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                className="button secondary"
                disabled={busy || !friends.length}
              >
                Invite to table
              </button>
            </form>
          )}
        </aside>
      </div>
      <details className="rules panel">
        <summary>
          Poker rules & table etiquette <span>＋</span>
        </summary>
        <p>
          Six seats, no rake, 20–100 big blind buy-in. Texas Hold’em uses the
          best five of seven cards. Omaha must use exactly two of your four
          cards and three board cards; raises are capped at the pot after
          calling. A full raise is at least the previous full raise size. A
          short all-in does not reopen betting until cumulative raises reach a
          full raise.
        </p>
        <p>
          Turns last 30 seconds. A timeout checks when possible, otherwise
          folds, and sits you out for the next hand. Reconnect to recover your
          cards and seat. Leaving during a hand takes effect after settlement;
          pending turns check or fold automatically. Inactive seats are released
          after five minutes. Split pots divide equally; odd hundredths go
          clockwise from the dealer. No chip gifting, collusion or leaderboard
          farming.
        </p>
        <p>
          At London noon, unfinished hands are voided and all seats are released
          for the new 10,000-chip cycle. Only players contesting a showdown
          reveal their cards.
        </p>
      </details>
    </section>
  );
}
