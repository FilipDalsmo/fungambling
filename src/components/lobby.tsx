"use client";
import type { AppState } from "@/server/state";
import { avatars, chips, levelFor } from "@/domain/models";
import { PlayingCard, Progress } from "./ui";
export const games = [
  {
    id: "blackjack",
    name: "Blackjack",
    eyebrow: "THE CLASSIC",
    text: "Find your perfect 21.",
    tag: "3:2 blackjack",
    className: "blackjack-art",
    symbol: "♠",
  },
  {
    id: "ultimate",
    name: "Ultimate Hold’em",
    eyebrow: "YOU VS. THE HOUSE",
    text: "Two cards. Big possibilities.",
    tag: "Trips side bet",
    className: "ultimate-art",
    symbol: "♦",
  },
  {
    id: "baccarat",
    name: "Baccarat",
    eyebrow: "KEEP IT SIMPLE",
    text: "Pick a side. Enjoy the reveal.",
    tag: "Punto Banco",
    className: "baccarat-art",
    symbol: "♣",
  },
];
export function Lobby({
  state,
  open,
  join,
  resumePoker,
}: {
  state: AppState | null;
  open: (view: string) => void;
  join: () => void;
  resumePoker: (id: string) => void;
}) {
  const seat = state?.tables.find((t) => t.seated);
  const round = state?.round?.stage !== "done" ? state?.round : null;
  return (
    <>
      {(seat || round) && (
        <section className="resume-banner">
          <div>
            <span className="eyebrow">RIGHT WHERE YOU LEFT OFF</span>
            <b>
              {seat
                ? `Your seat at ${seat.name} is waiting`
                : `Your ${games.find((g) => g.id === round?.kind)?.name} hand is in play`}
            </b>
          </div>
          <button
            className="button primary"
            onClick={() => (seat ? resumePoker(seat.id) : open(round!.kind))}
          >
            Resume {seat ? "table" : "hand"} →
          </button>
        </section>
      )}
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="live-dot" /> A LITTLE LUCK. A LOT OF FUN.
          </span>
          <h1>
            All play.
            <br />
            <em>No stakes.</em>
          </h1>
          <p>
            Your favourite tables, a fresh stack every day,
            <br className="desktop" /> and absolutely nothing to lose.
          </p>
          <button
            className="button primary"
            onClick={() => (state ? open("blackjack") : join())}
          >
            {state ? "Find your next hand" : "Get your 10,000 chips"}
            <span>↗</span>
          </button>
          <span className="hero-note">
            100% fictional chips. 100% for the fun of it.
          </span>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span className="hero-spark spark-one">✦</span>
          <span className="hero-spark spark-two">✧</span>
          <div className="hero-card card-one">
            <PlayingCard card={{ rank: 14, suit: "s" }} />
          </div>
          <div className="hero-card card-two">
            <PlayingCard card={{ rank: 13, suit: "h" }} />
          </div>
          <div className="chip-stack stack-one">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="chip-stack stack-two">
            <i />
            <i />
            <i />
            <i />
          </div>
          <span className="floating-chip">✦</span>
        </div>
      </section>
      <div className="benefit-strip">
        <span>
          <b>◷</b> Fresh 10,000 chips daily
        </span>
        <span>
          <b>♧</b> Real people. Real fun.
        </span>
        <span>
          <b>✧</b> Play. Progress. Repeat.
        </span>
      </div>
      <section>
        <div className="section-heading">
          <div>
            <span className="eyebrow">PICK YOUR FAVOURITE</span>
            <h2>The house is open</h2>
          </div>
          <span className="muted small-text">
            Your next good hand starts here
          </span>
        </div>
        <div className="game-grid">
          {games.map((game) => (
            <button
              key={game.id}
              className={`game-tile ${game.className}`}
              onClick={() => open(game.id)}
            >
              <div className="game-art" aria-hidden="true">
                <span className="giant-suit">{game.symbol}</span>
                <div className="mini-cards">
                  <PlayingCard
                    small
                    card={{
                      rank: game.id === "blackjack" ? 14 : 13,
                      suit: "s",
                    }}
                  />
                  <PlayingCard
                    small
                    card={{
                      rank: game.id === "blackjack" ? 11 : 12,
                      suit: "h",
                    }}
                  />
                </div>
                <span className="art-chip">✦</span>
                <span className="game-badge">{game.tag}</span>
              </div>
              <div className="game-copy">
                <span className="eyebrow">{game.eyebrow}</span>
                <h3>
                  {game.name}
                  <span>↗</span>
                </h3>
                <p>{game.text}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
      <div className="lobby-bottom">
        <section className="poker-banner">
          <span className="eyebrow">
            <span className="live-dot" /> THE SOCIAL TABLE
          </span>
          <h2>Better with a full table.</h2>
          <p>
            Pull up a chair for Texas Hold’em or Omaha.
            <br />
            Always people. Never poker bots.
          </p>
          <button className="button secondary" onClick={() => open("poker")}>
            Explore poker room <span>→</span>
          </button>
          <div className="avatar-cluster" aria-hidden="true">
            <span>🦊</span>
            <span>🐼</span>
            <span>🐯</span>
            <span>+ you</span>
          </div>
        </section>
        <section className="panel daily-card">
          <span className="eyebrow">A LITTLE SOMETHING TO PLAY FOR</span>
          <h3>
            Your daily five <span>✦</span>
          </h3>
          <p>
            Complete 5 hands. Collect {state?.dailyReward ?? 200} chips and 100
            XP.
          </p>
          <Progress value={state?.me.dailyGames ?? 0} max={5} />
          <div className="between">
            <small>{Math.min(state?.me.dailyGames ?? 0, 5)} / 5 hands</small>
            <button className="text-button" onClick={() => open("progression")}>
              See challenges →
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
export function LobbyRail({
  state,
  open,
  profile,
}: {
  state: AppState | null;
  open: (v: string) => void;
  profile: (id: string) => void;
}) {
  const xp = state?.me.xp ?? 0,
    level = levelFor(xp);
  return (
    <aside className="lobby-rail">
      <section className="panel player-card">
        <div className="avatar large">{avatars[state?.me.avatar ?? 0]}</div>
        <span className="eyebrow">
          {state ? "GOOD TO SEE YOU" : "WELCOME TO THE CLUB"}
        </span>
        <h3>{state?.me.username ?? "Your next adventure"}</h3>
        <span className="level-pill">✦ Level {level}</span>
        <Progress
          value={xp - (level - 1) ** 2 * 100}
          max={level ** 2 * 100 - (level - 1) ** 2 * 100}
        />
        <small className="muted">
          {level ** 2 * 100 - xp} XP to your next level
        </small>
        <button className="text-button" onClick={() => open("progression")}>
          Your progression →
        </button>
      </section>
      <section className="panel">
        <div className="section-heading">
          <h3>Today’s standouts</h3>
          <span>♕</span>
        </div>
        <p className="muted small-text">A little friendly competition.</p>
        <div className="standouts">
          {state?.leaderboard.daily.slice(0, 3).map((p) => (
            <button key={p.id} onClick={() => profile(p.id)}>
              <b className="rank">{p.rank}</b>
              <span className="avatar">{avatars[p.avatar]}</span>
              <span>
                {p.username}
                <small className={p.profit >= 0 ? "positive" : "negative"}>
                  {p.profit > 0 ? "+" : ""}
                  {chips(p.profit)}
                </small>
              </span>
            </button>
          )) ?? <p className="empty">Sign in to meet the players.</p>}
        </div>
        <button className="text-button" onClick={() => open("leaderboards")}>
          View leaderboards →
        </button>
      </section>
      <section className="play-note">
        <span>♡</span>
        <h3>Just for the joy of it.</h3>
        <p>
          Chips have no monetary value. They can’t be bought, sold, transferred
          or cashed out.
        </p>
      </section>
    </aside>
  );
}
