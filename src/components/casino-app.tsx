"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState } from "@/server/state";
import type { CasinoKind } from "@/domain/casino";
import { avatars, chips } from "@/domain/models";
import { AuthPanel } from "./auth-panel";
import { Lobby, LobbyRail } from "./lobby";
import { AudioSettings, useCasinoAudio } from "./audio-settings";
import { audioScene, commandSound } from "@/audio/settings";
import { CasinoGame } from "./casino-game";
import { PokerGame, PokerRoom } from "./poker-room";
import { Friends, Leaderboards, ProfileModal, Progression } from "./community";
import { AdminPanel } from "./admin-panel";
import { Modal, type Send } from "./ui";
const navigation = [
  { id: "lobby", icon: "◈", name: "Lobby" },
  { id: "poker", icon: "♠", name: "Poker room" },
  { id: "leaderboards", icon: "♕", name: "Leaderboards" },
  { id: "progression", icon: "✦", name: "Progression" },
  { id: "friends", icon: "♧", name: "Friends" },
];
export function CasinoApp() {
  const [state, setState] = useState<AppState | null>(null),
    [view, setView] = useState("lobby"),
    [tableId, setTableId] = useState<string>();
  const [auth, setAuth] = useState(false),
    [recovery, setRecovery] = useState<string>(),
    [profile, setProfile] = useState<string>();
  const [ready, setReady] = useState(false),
    [signedIn, setSignedIn] = useState(false),
    [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const scene = audioScene(
    view,
    state?.tables.find((table) => table.id === tableId)?.variant ??
      (tableId && state?.table?.id === tableId
        ? state.table.variant
        : undefined),
  );
  const audio = useCasinoAudio(scene);
  const playTableSound = audio.play;
  const previousTable = useRef<AppState["table"]>(null);
  useEffect(() => {
    const next =
      view === "poker" && state?.table && tableId === state.table.id
        ? state.table
        : null;
    const previous = previousTable.current;
    previousTable.current = next;
    if (!previous || !next || previous.id !== next.id) return;
    if (next.hand !== previous.hand) playTableSound("deal");
    else if (next.board.length > previous.board.length) playTableSound("flip");
    else if (
      next.turn !== previous.turn &&
      next.seats[next.turn]?.userId === state?.me.id &&
      next.status === "playing"
    )
      playTableSound("turn");
    else if (previous.seats[previous.turn]?.userId !== state?.me.id) {
      if (
        next.seats.some(
          (seat, i) =>
            seat && seat.committed > (previous.seats[i]?.committed ?? 0),
        )
      )
        playTableSound("chips");
      else if (
        next.seats.some((seat, i) => seat?.folded && !previous.seats[i]?.folded)
      )
        playTableSound("fold");
      else if (next.turn !== previous.turn && next.status === "playing")
        playTableSound("check");
    }
  }, [state?.table, state?.me.id, view, tableId, playTableSound]);
  const accept = useCallback((incoming: AppState) => {
    setState((current) =>
      !current || incoming.serverTime >= current.serverTime
        ? incoming
        : current,
    );
    setSignedIn(true);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/state${tableId ? `?table=${tableId}` : ""}`,
        { cache: "no-store" },
      );
      if (res.status === 401) {
        setSignedIn(false);
        setState(null);
        return;
      }
      if (res.status === 404 && tableId) {
        setTableId(undefined);
        setError("That private table is no longer available to you.");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      accept(data);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to reach the server",
      );
    } finally {
      setReady(true);
    }
  }, [tableId, accept]);
  // This effect synchronizes with HTTP; refresh only sets state after the fetch resolves.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!signedIn) return;
    const events = new EventSource(
      `/api/events${tableId ? `?table=${tableId}` : ""}`,
    );
    events.onmessage = (event) => {
      accept(JSON.parse(event.data));
      setConnected(true);
    };
    events.onerror = () => setConnected(false);
    events.addEventListener("signedout", () => {
      setSignedIn(false);
      setState(null);
      events.close();
    });
    events.addEventListener("unavailable", () => {
      setTableId(undefined);
      setError("That private table is no longer available to you.");
      events.close();
    });
    return () => {
      events.close();
    };
  }, [signedIn, tableId, accept]);
  const send: Send = async (command, data = {}) => {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: crypto.randomUUID(), command, data }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      const effect = commandSound(command, data);
      if (effect) audio.play(effect);
      await refresh();
      return result.result ?? true;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to complete action",
      );
      await refresh();
      return false;
    } finally {
      setBusy(false);
    }
  };
  function open(next: string) {
    if (next !== "lobby" && !state) {
      setAuth(true);
      return;
    }
    setView(next);
    setTableId(undefined);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function logout() {
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!res.ok) throw new Error("Unable to sign out");
      setSignedIn(false);
      setState(null);
      setView("lobby");
      setTableId(undefined);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign out");
    }
  }
  const gameView = ["blackjack", "baccarat", "ultimate"].includes(view);
  const disabled = busy || !connected;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => open("lobby")}
          aria-label="Fun Gambling home"
        >
          <span className="brand-mark">
            f<span>✦</span>
          </span>
          <span>
            fun<span>gambling</span>
          </span>
        </button>
        <div className="sidebar-label">LET’S PLAY</div>
        <nav aria-label="Main navigation">
          {navigation.map((n) => (
            <button
              key={n.id}
              className={
                view === n.id || (n.id === "lobby" && gameView) ? "active" : ""
              }
              onClick={() => open(n.id)}
            >
              <span>{n.icon}</span>
              {n.name}
              {n.id === "poker" && <small>LIVE</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-label casino-label">CASINO TABLES</div>
        <nav aria-label="Casino games">
          {[
            { id: "blackjack", name: "Blackjack", icon: "♠" },
            { id: "ultimate", name: "Ultimate Hold’em", icon: "♦" },
            { id: "baccarat", name: "Baccarat", icon: "♣" },
          ].map((n) => (
            <button
              className={view === n.id ? "active" : ""}
              key={n.id}
              onClick={() => open(n.id)}
            >
              <span>{n.icon}</span>
              {n.name}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="daily-reset-card">
            <span>↻</span>
            <b>A fresh start. Every day.</b>
            <p>
              10,000 chips at noon
              <br />
              Europe/London
            </p>
          </div>
          {state?.me.role === "admin" && (
            <button className="text-button" onClick={() => open("admin")}>
              ⚙ Administration
            </button>
          )}
          <AudioSettings audio={audio} scene={scene} />
          <p className="sidebar-footer">
            Made for fun.
            <br />
            Never for real money.
          </p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span>♧</span> The good kind of playing around.
          </div>
          <div className="topbar-actions">
            {state ? (
              <>
                <span
                  className={`connection ${connected ? "online" : ""}`}
                  title={
                    connected ? "Connected to live server" : "Reconnecting"
                  }
                >
                  <i />
                  {connected ? "Live" : "Reconnecting…"}
                </span>
                <div className="balance-pill">
                  <span className="coin">✦</span>
                  <b data-testid="balance">{chips(state.me.balance)}</b>
                  <small>chips</small>
                </div>
                <button
                  className="profile-button"
                  onClick={() => setProfile(state.me.id)}
                  aria-label="Open your profile"
                >
                  {avatars[state.me.avatar]}
                </button>
                <button className="text-button signout" onClick={logout}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <span className="play-money-pill">PLAY-MONEY ONLY</span>
                <button
                  className="button primary"
                  onClick={() => setAuth(true)}
                >
                  Join the fun ↗
                </button>
              </>
            )}
          </div>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}
        {state?.announcement && (
          <div className="announcement">✦ {state.announcement}</div>
        )}
        <main
          id="main"
          className={view === "lobby" ? "content-grid" : "content-wide"}
        >
          <div className="main-content">
            {view === "lobby" ? (
              <Lobby
                state={state}
                open={open}
                join={() => setAuth(true)}
                resumePoker={(id) => {
                  setView("poker");
                  setTableId(id);
                }}
              />
            ) : state ? (
              gameView ? (
                <CasinoGame
                  key={view}
                  playSound={playTableSound}
                  kind={view as CasinoKind}
                  state={state}
                  send={send}
                  busy={disabled}
                />
              ) : view === "poker" ? (
                tableId ? (
                  <PokerGame
                    tableId={tableId}
                    state={state}
                    send={send}
                    busy={disabled}
                    back={() => setTableId(undefined)}
                    profile={setProfile}
                  />
                ) : (
                  <PokerRoom
                    state={state}
                    send={send}
                    busy={disabled}
                    select={setTableId}
                  />
                )
              ) : view === "leaderboards" ? (
                <Leaderboards state={state} profile={setProfile} />
              ) : view === "progression" ? (
                <Progression state={state} send={send} busy={disabled} />
              ) : view === "friends" ? (
                <Friends
                  state={state}
                  send={send}
                  busy={disabled}
                  profile={setProfile}
                />
              ) : (
                <AdminPanel state={state} send={send} busy={disabled} />
              )
            ) : (
              <div className="panel">
                <h1>Your seat is waiting.</h1>
                <button
                  className="button primary"
                  onClick={() => setAuth(true)}
                >
                  Sign in to play
                </button>
              </div>
            )}
          </div>
          {view === "lobby" && (
            <LobbyRail state={state} open={open} profile={setProfile} />
          )}
        </main>
        <footer className="site-footer">
          <span>✦ Fun Gambling</span>
          <p>
            Entertainment only. Fictional chips have no monetary value and can
            never be purchased, transferred, sold or redeemed.
          </p>
          {state && (
            <small>
              Next reset:{" "}
              {new Date(state.resetAt).toLocaleString("en-GB", {
                timeZone: "Europe/London",
                hour: "2-digit",
                minute: "2-digit",
                day: "numeric",
                month: "short",
              })}{" "}
              London time. Unfinished hands are voided and poker seats released.
            </small>
          )}
          {!ready && <span role="status">Connecting…</span>}
        </footer>
      </div>
      {auth && (
        <AuthPanel
          close={() => setAuth(false)}
          done={async (code) => {
            setAuth(false);
            if (code) setRecovery(code);
            await refresh();
          }}
        />
      )}
      {recovery && (
        <Modal
          title="Save your recovery code"
          close={() => setRecovery(undefined)}
        >
          <p>
            This one-time code is the only way to reset your password. Save it
            in your password manager before closing.
          </p>
          <code className="recovery-code">{recovery}</code>
          <p className="muted">
            Using it replaces the code and signs out existing sessions. We do
            not store the readable code.
          </p>
          <button
            className="button primary"
            onClick={() => setRecovery(undefined)}
          >
            I’ve saved my code
          </button>
        </Modal>
      )}
      {profile && state && (
        <ProfileModal
          id={profile}
          state={state}
          close={() => setProfile(undefined)}
          send={send}
          busy={disabled}
        />
      )}
    </div>
  );
}
