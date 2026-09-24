"use client";
import "./casino-table.css";
import {
  BettingSpots,
  ChipTray,
  useChipBets,
  wagerTotal,
} from "./chip-betting";
import type { AppState } from "@/server/state";
import { chips } from "@/domain/models";
import { blackjackValue, type CasinoKind } from "@/domain/casino";
import { Pill, type Send } from "./ui";
import { DealtCards, useDealtCards, type TableSound } from "./dealt-cards";
import { games } from "./lobby";
import { WinCelebration } from "./win-celebration";
export function CasinoGame({
  kind,
  state,
  send,
  busy: requestBusy,
  playSound,
}: {
  kind: CasinoKind;
  state: AppState;
  send: Send;
  busy: boolean;
  playSound: (sound: TableSound) => void;
}) {
  const r = state.round?.kind === kind ? state.round : null,
    active = !!r && r.stage !== "done";
  const { cards, dealing, win } = useDealtCards(r, playSound);
  const busy = requestBusy || dealing;
  const other =
    state.round && state.round.kind !== kind && state.round.stage !== "done";
  const locked = busy || active || !!other;
  const betting = useChipBets(kind, state.me.balance / 100, locked, () =>
    playSound("chips"),
  );
  const { bet, side, side2, target } = betting.bets;
  const total = wagerTotal(kind, betting.bets);
  const game = games.find((g) => g.id === kind)!;
  const act = (action: string) =>
    send("casino", { roundId: r!.id, revision: r!.revision, action });
  const hand = r?.hands[r.active];
  return (
    <section className="game-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR PRIVATE TABLE</span>
          <h1>{game.name}</h1>
        </div>
        <Pill>♧ Play-money only</Pill>
      </div>
      <p className="muted">
        {kind === "blackjack"
          ? "Dealer stands on all 17s · Blackjack pays 3:2 · No insurance"
          : kind === "baccarat"
            ? "Eight-deck Punto Banco · Banker pays 0.95:1 · Tie pays 8:1"
            : "Ante + Blind to enter · Raise early or see how the board unfolds"}
      </p>
      <div className={`felt-table ${kind}`}>
        {win && <WinCelebration key={win.id} round={win} />}
        <div className="felt-brand">
          FUN GAMBLING <span>♠ ♥ ♣ ♦</span>
        </div>
        {kind === "ultimate" && (
          <>
            <div className="felt-paytable paytable-left">
              <h3>Trips</h3>
              {[
                ["Royal flush", "50:1"],
                ["Straight flush", "40:1"],
                ["Four of a kind", "30:1"],
                ["Full house", "8:1"],
                ["Flush", "7:1"],
                ["Straight", "4:1"],
                ["Three of a kind", "3:1"],
              ].map(([name, pay]) => (
                <div key={name}>
                  <span>{name}</span>
                  <span>{pay}</span>
                </div>
              ))}
            </div>
            <div className="felt-paytable paytable-right">
              <h3>Blind</h3>
              {[
                ["Royal flush", "500:1"],
                ["Straight flush", "50:1"],
                ["Four of a kind", "10:1"],
                ["Full house", "3:1"],
                ["Flush", "3:2"],
                ["Straight", "1:1"],
              ].map(([name, pay]) => (
                <div key={name}>
                  <span>{name}</span>
                  <span>{pay}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {r ? (
          <>
            <div className="dealer-zone">
              <span className="table-label">
                {kind === "baccarat" ? "BANKER" : "DEALER"}
                {kind === "blackjack" && r.stage === "done" && !dealing
                  ? ` · ${blackjackValue(r.dealer).total}`
                  : ""}
              </span>
              <DealtCards key={r.id} slots={cards.dealer} />
            </div>
            {kind === "ultimate" && (
              <div className="board-zone">
                <DealtCards key={r.id} slots={cards.board} capacity={5} />
                <span className="table-label">
                  {r.stage === "done" ? "SHOWDOWN" : r.stage.toUpperCase()}
                </span>
              </div>
            )}
            <div className="player-zone">
              {kind === "blackjack" ? (
                <div className="blackjack-hands">
                  {r.hands.map((h, i) => (
                    <div
                      className={`blackjack-hand ${active && i === r.active ? "active-hand" : ""}`}
                      key={i}
                    >
                      <DealtCards key={r.id} slots={cards[`hand${i}`]} />
                      <span className="table-label">
                        {dealing ? "?" : blackjackValue(h.cards).total} ·{" "}
                        {chips(h.bet)} chips {h.split ? "· split" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <DealtCards key={r.id} slots={cards.player} />
                  <span className="table-label">
                    {kind === "baccarat" ? "PLAYER" : "YOUR CARDS"}
                  </span>
                </>
              )}
            </div>
            <div
              className={`round-message ${!dealing && r.stage === "done" ? (r.returned >= r.wagered ? "win" : "loss") : ""}`}
              role="status"
            >
              {dealing ? "Dealing..." : r.message}
              {!dealing && r.stage === "done" && (
                <strong>
                  {r.returned - r.wagered >= 0 ? "+" : ""}
                  {chips(r.returned - r.wagered)} chips
                </strong>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="dealer-zone">
              <span className="table-label">
                {kind === "baccarat" ? "BANKER" : "DEALER"}
              </span>
              <DealtCards />
            </div>
            {kind === "ultimate" && (
              <div className="board-zone">
                <DealtCards capacity={5} />
                <span className="table-label">PLACE YOUR BETS</span>
              </div>
            )}
            <div className="player-zone">
              <DealtCards />
              <span className="table-label">YOUR HAND</span>
            </div>
          </>
        )}
        <BettingSpots
          kind={kind}
          model={betting}
          locked={locked}
          placed={
            r && (active || dealing)
              ? {
                  bet:
                    (kind === "blackjack"
                      ? r.hands.reduce((sum, h) => sum + h.bet, 0)
                      : r.bet) / 100,
                  side: r.side / 100,
                  side2: r.side2 / 100,
                  target: r.target,
                }
              : undefined
          }
          play={active || dealing ? (r?.play ?? 0) / 100 : 0}
        />
        <span className="felt-caption">
          {kind === "ultimate"
            ? "ANTE = BLIND · DEALER QUALIFIES WITH A PAIR"
            : kind === "blackjack"
              ? "BLACKJACK PAYS 3:2 · DEALER STANDS ON 17"
              : "PLAYER 1:1 · BANKER 0.95:1 · TIE 8:1"}
        </span>
      </div>
      <div className="table-bankroll">
        <span>
          Bankroll <strong>{chips(state.me.balance)}</strong>
        </span>
        <span>
          {active ? "In play" : "Total wager"}{" "}
          <strong>{chips(active ? r.wagered : total * 100)}</strong>
        </span>
        <span>
          {kind === "ultimate"
            ? "Ante and Blind always match"
            : "Fictional chips only"}
        </span>
      </div>
      <div className="panel betting-panel">
        {active ? (
          <>
            <div>
              <span className="eyebrow">
                {kind === "blackjack"
                  ? `HAND ${r.active + 1} OF ${r.hands.length}`
                  : `YOUR MOVE · ${r.stage}`}
              </span>
              <p>{chips(r.wagered)} chips in play</p>
            </div>
            <div className="action-buttons">
              {kind === "blackjack" && (
                <>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => act("hit")}
                  >
                    Hit
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => act("stand")}
                  >
                    Stand
                  </button>
                  <button
                    className="button secondary"
                    disabled={
                      busy ||
                      hand?.cards.length !== 2 ||
                      !!hand?.aces ||
                      state.me.balance < (hand?.bet ?? 0)
                    }
                    onClick={() => act("double")}
                  >
                    Double
                  </button>
                  <button
                    className="button secondary"
                    disabled={
                      busy ||
                      hand?.cards.length !== 2 ||
                      hand?.cards[0].rank !== hand?.cards[1].rank ||
                      r.hands.length >= 4 ||
                      !!hand?.aces ||
                      state.me.balance < (hand?.bet ?? 0)
                    }
                    onClick={() => act("split")}
                  >
                    Split
                  </button>
                </>
              )}
              {kind === "ultimate" && (
                <>
                  {r.stage !== "river" && (
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => act("check")}
                    >
                      Check
                    </button>
                  )}
                  {(r.stage === "preflop"
                    ? [3, 4]
                    : r.stage === "flop"
                      ? [2]
                      : [1]
                  ).map((n) => (
                    <button
                      className="button primary"
                      key={n}
                      disabled={busy || state.me.balance < r.bet * n}
                      onClick={() => act(`raise${n}`)}
                    >
                      Play {n}× · {chips(r.bet * n)}
                    </button>
                  ))}
                  {r.stage === "river" && (
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => act("fold")}
                    >
                      Fold
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <form
            className="bet-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (locked || bet < 1 || total * 100 > state.me.balance) return;
              void send("deal", {
                kind,
                bet,
                side: kind === "baccarat" ? 0 : side,
                side2: kind === "blackjack" ? side2 : 0,
                target,
              });
            }}
          >
            <ChipTray model={betting} locked={locked} />
            <button
              className="button primary"
              disabled={locked || bet < 1 || total * 100 > state.me.balance}
            >
              {busy ? "Dealing…" : "Deal cards →"}
            </button>
            {other && (
              <p role="status">
                Finish your{" "}
                {games.find((g) => g.id === state.round?.kind)?.name} hand
                first.
              </p>
            )}
          </form>
        )}
      </div>
      <details className="rules panel">
        <summary>
          Table rules & paytables <span>＋</span>
        </summary>
        {kind === "blackjack" ? (
          <>
            <p>
              Six decks, freshly shuffled each round. Dealer stands on soft 17
              and checks for blackjack. A natural pays 3:2; ordinary wins pay
              1:1; ties return the wager. Double any first two cards, including
              after splitting. Split equal ranks up to four hands. Split aces
              get one card each, cannot be split again, and a two-card 21 after
              any split pays 1:1. No surrender or insurance.
            </p>
            <p>
              Perfect Pairs profit payouts: mixed pair 6:1, same-colour pair
              12:1, identical pair 25:1. 21+3 uses your first two cards and the
              dealer upcard: flush 5:1, straight 10:1, trips 30:1, straight
              flush 40:1, suited trips 100:1. Side bets settle with the hand.
            </p>
          </>
        ) : kind === "baccarat" ? (
          <p>
            Cards 2–9 are face value, aces 1, tens and faces 0. Totals wrap at
            10. Naturals 8 or 9 stand; otherwise standard Punto Banco third-card
            rules apply automatically. Player pays 1:1, Banker 0.95:1 after
            commission, Tie 8:1. A tie returns Player and Banker wagers.
          </p>
        ) : (
          <>
            <p>
              Place equal Ante and Blind bets. Preflop, check or play 3×/4×
              Ante; on the flop check or play 2×; on the river play 1× or fold.
              You can make only one Play bet. Best five-card poker hand wins;
              dealer qualifies with a pair. Ante pushes if the dealer does not
              qualify; Play and Blind still resolve. All main wagers push on a
              tie. Folding loses Ante and Blind; Trips still resolves.
            </p>
            <p>
              Winning Blind profit payouts: straight 1:1, flush 3:2, full house
              3:1, quads 10:1, straight flush 50:1, royal flush 500:1; lower
              winning hands push. Trips: trips 3:1, straight 4:1, flush 7:1,
              full house 8:1, quads 30:1, straight flush 40:1, royal flush 50:1.
            </p>
          </>
        )}
        <p>
          Main wagers: 1–1,000 chips. Optional side bets: 0–100 chips. At London
          noon, unfinished rounds are voided and every bankroll resets to
          10,000.
        </p>
      </details>
    </section>
  );
}
