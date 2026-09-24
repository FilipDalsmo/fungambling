"use client";
import { useState } from "react";
import type { AppState } from "@/server/state";
import { achievements, avatars, chips, levelFor } from "@/domain/models";
import { Empty, Field, Modal, Progress, type Send } from "./ui";
export function Leaderboards({
  state,
  profile,
}: {
  state: AppState;
  profile: (id: string) => void;
}) {
  const [period, setPeriod] = useState<
    "daily" | "weekly" | "monthly" | "all-time"
  >("daily");
  return (
    <section>
      <span className="eyebrow">A LITTLE FRIENDLY COMPETITION</span>
      <h1>The leaderboard</h1>
      <p className="muted">
        Net chip profit, including earned rewards. Every loss counts, too.
      </p>
      <div className="tabs">
        {(["daily", "weekly", "monthly", "all-time"] as const).map((p) => (
          <button
            className={period === p ? "selected" : ""}
            aria-pressed={period === p}
            key={p}
            onClick={() => setPeriod(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="panel leaderboard">
        <div className="leader-row leader-header">
          <span>Rank</span>
          <span>Player</span>
          <span>Net profit</span>
        </div>
        {state.leaderboard[period].map((p) => (
          <button
            className={`leader-row ${p.id === state.me.id ? "is-you" : ""}`}
            key={p.id}
            onClick={() => profile(p.id)}
          >
            <b className="rank">
              {p.rank <= 3 ? ["♕", "②", "③"][p.rank - 1] : p.rank}
            </b>
            <span>
              <span className="avatar">{avatars[p.avatar]}</span>
              {p.username}
              {p.id === state.me.id && <small> YOU</small>}
            </span>
            <strong className={p.profit >= 0 ? "positive" : "negative"}>
              {p.profit > 0 ? "+" : ""}
              {chips(p.profit)}
            </strong>
          </button>
        ))}
      </div>
      <p className="fine-print">
        Periods start at noon Europe/London: daily, Monday for weekly, and the
        first for monthly. All-time never resets. Bankroll refreshes and admin
        adjustments do not count as profit.
      </p>
    </section>
  );
}
export function Progression({
  state,
  send,
  busy,
}: {
  state: AppState;
  send: Send;
  busy: boolean;
}) {
  const u = state.me,
    level = levelFor(u.xp);
  return (
    <section>
      <span className="eyebrow">MAKE EVERY HAND COUNT</span>
      <h1>A little better every day.</h1>
      <p className="muted">
        Your chips refresh. Your accomplishments stay with you.
      </p>
      <div className="progression-hero panel">
        <div className="level-medal">
          ✦<b>{level}</b>
        </div>
        <div>
          <span className="eyebrow">LEVEL {level}</span>
          <h2>{u.xp.toLocaleString()} lifetime XP</h2>
          <Progress
            value={u.xp - (level - 1) ** 2 * 100}
            max={level ** 2 * 100 - (level - 1) ** 2 * 100}
          />
          <p className="muted">
            {level ** 2 * 100 - u.xp} XP to level {level + 1} · 10 XP for every
            completed hand
          </p>
        </div>
      </div>
      <div className="panel daily-challenge">
        <span className="eyebrow">DAILY CHALLENGE</span>
        <h2>The daily five</h2>
        <p>
          Play five hands at any table. Earn {state.dailyReward} chips + 100 XP.
        </p>
        <Progress value={u.dailyGames} max={5} />
        <div className="between">
          <span>{Math.min(u.dailyGames, 5)} / 5 completed</span>
          <button
            className="button primary"
            disabled={busy || u.dailyGames < 5 || u.dailyClaimed}
            onClick={() => send("claim")}
          >
            {u.dailyClaimed ? "Reward collected ✓" : "Collect reward"}
          </button>
        </div>
      </div>
      <h2 className="spaced-title">Your achievements</h2>
      <div className="achievement-grid">
        {achievements.map((a, i) => (
          <section
            className={`panel achievement ${u.achievements.includes(a.id) ? "unlocked" : ""}`}
            key={a.id}
          >
            <span className="achievement-icon">{["✧", "♧", "♕"][i]}</span>
            <span className="eyebrow">
              {u.achievements.includes(a.id) ? "UNLOCKED" : "IN PROGRESS"}
            </span>
            <h3>{a.name}</h3>
            <p>{a.description}</p>
            <Progress value={u.games} max={a.games} />
            <small>
              {a.chips} chips · {a.xp} XP · awarded automatically
            </small>
          </section>
        ))}
      </div>
    </section>
  );
}
export function Friends({
  state,
  send,
  busy,
  profile,
}: {
  state: AppState;
  send: Send;
  busy: boolean;
  profile: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const relation = (id: string) =>
    state.friends.find((f) => f.sender === id || f.recipient === id);
  const players = state.profiles.filter(
    (p) =>
      p.id !== state.me.id &&
      p.username.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section>
      <span className="eyebrow">GOOD GAMES START WITH GOOD COMPANY</span>
      <h1>Your people</h1>
      <p className="muted">
        Make a friend, start a private table, share a little luck.
      </p>
      <Field label="Find a player">
        <input
          type="search"
          placeholder="Search by username"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Field>
      <div className="friend-grid">
        {players.length ? (
          players.map((p) => {
            const f = relation(p.id),
              block = state.blocks.find((b) => b.target === p.id);
            return (
              <article className="panel friend-card" key={p.id}>
                <button className="person-link" onClick={() => profile(p.id)}>
                  <span className="avatar large">{avatars[p.avatar]}</span>
                  <span>
                    <h3>{p.username}</h3>
                    <small className="muted">
                      <span className={p.online ? "live-dot" : "offline-dot"} />{" "}
                      {p.online ? "Online" : "Offline"} · Level {levelFor(p.xp)}
                    </small>
                  </span>
                </button>
                <div className="action-buttons">
                  {block?.muted === 0 ? (
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        send("social", { action: "unblock", target: p.id })
                      }
                    >
                      Unblock
                    </button>
                  ) : f?.accepted ? (
                    <>
                      <span className="positive">✓ Friends</span>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          send("social", { action: "remove", target: p.id })
                        }
                      >
                        Remove
                      </button>
                    </>
                  ) : f?.recipient === state.me.id ? (
                    <>
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() =>
                          send("social", { action: "accept", target: p.id })
                        }
                      >
                        Accept request
                      </button>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          send("social", { action: "remove", target: p.id })
                        }
                      >
                        Decline
                      </button>
                    </>
                  ) : f ? (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        send("social", { action: "remove", target: p.id })
                      }
                    >
                      Cancel request
                    </button>
                  ) : (
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        send("social", { action: "request", target: p.id })
                      }
                    >
                      ＋ Add friend
                    </button>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <Empty>No players found yet. Invite a friend to join the site.</Empty>
        )}
      </div>
    </section>
  );
}
export function ProfileModal({
  id,
  state,
  close,
  send,
  busy,
}: {
  id: string;
  state: AppState;
  close: () => void;
  send: Send;
  busy: boolean;
}) {
  const p = state.profiles.find((p) => p.id === id);
  const [report, setReport] = useState(false);
  if (!p) return null;
  const own = p.id === state.me.id,
    blocked = state.blocks.find((b) => b.target === id);
  return (
    <Modal
      title={own ? "Your player profile" : `${p.username}’s profile`}
      close={close}
    >
      <div className="profile-top">
        <span className="avatar jumbo">{avatars[p.avatar]}</span>
        <div>
          <h2>{p.username}</h2>
          <span className="level-pill">
            Level {levelFor(p.xp)} · Rank {p.rank || "—"}
          </span>
          <p className="muted">
            Joined {new Date(p.created).toLocaleDateString("en-GB")}
          </p>
        </div>
      </div>
      <div className="stat-grid">
        <div>
          <small>Total chip position</small>
          <b>{chips(p.balance)}</b>
        </div>
        <div>
          <small>Today’s profit</small>
          <b className={p.profit >= 0 ? "positive" : "negative"}>
            {chips(p.profit)}
          </b>
        </div>
        <div>
          <small>Lifetime wager winnings</small>
          <b>{chips(p.won)}</b>
        </div>
        <div>
          <small>Lifetime wager losses</small>
          <b>{chips(p.lost)}</b>
        </div>
        <div>
          <small>Lifetime net wagers</small>
          <b>{chips(p.net)}</b>
        </div>
        <div>
          <small>Hands played</small>
          <b>{p.games}</b>
        </div>
      </div>
      <p className="fine-print">
        Wager statistics measure net results per completed hand, excluding
        rewards. Total position includes active wagers and poker stacks.
      </p>
      <div className="badge-row">
        {p.achievements.map((id) => (
          <span className="level-pill" key={id}>
            ✦ {achievements.find((a) => a.id === id)?.name}
          </span>
        ))}
      </div>
      {own ? (
        <>
          <h3>Choose your avatar</h3>
          <div className="avatar-picker">
            {avatars.map((a, i) => (
              <button
                key={i}
                className={p.avatar === i ? "chosen" : ""}
                aria-label={`Avatar ${i + 1}`}
                aria-pressed={p.avatar === i}
                disabled={busy}
                onClick={() => send("profile", { avatar: i })}
              >
                {a}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="action-buttons">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                send("social", {
                  action: blocked?.muted === 0 ? "unblock" : "block",
                  target: id,
                })
              }
            >
              {blocked?.muted === 0 ? "Unblock" : "Block player"}
            </button>
            <button
              className="button secondary"
              disabled={busy || blocked?.muted === 0}
              onClick={() =>
                send("social", {
                  action: blocked?.muted === 1 ? "unmute" : "mute",
                  target: id,
                })
              }
            >
              {blocked?.muted === 1 ? "Unmute" : "Mute chat"}
            </button>
            <button className="text-button" onClick={() => setReport(!report)}>
              Report player
            </button>
          </div>
          {report && (
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const reason = new FormData(e.currentTarget).get("reason");
                if (
                  (await send("social", {
                    action: "report",
                    target: id,
                    reason,
                  })) !== false
                )
                  setReport(false);
              }}
            >
              <Field label="What happened?">
                <textarea
                  name="reason"
                  required
                  minLength={10}
                  maxLength={1000}
                />
              </Field>
              <button className="button primary" disabled={busy}>
                Submit report
              </button>
            </form>
          )}
        </>
      )}
    </Modal>
  );
}
