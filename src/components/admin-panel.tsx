"use client";
import type { AppState } from "@/server/state";
import { chips } from "@/domain/models";
import { Empty, Field, type Send } from "./ui";
export function AdminPanel({
  state,
  send,
  busy,
}: {
  state: AppState;
  send: Send;
  busy: boolean;
}) {
  if (!state.admin) return <Empty>Administrator access required.</Empty>;
  const name = (id: string) =>
    state.profiles.find((p) => p.id === id)?.username ?? id;
  return (
    <section>
      <span className="eyebrow">PLATFORM OPERATIONS</span>
      <h1>Administration</h1>
      <p className="muted">
        Moderation, platform configuration and traceable support adjustments.
      </p>
      <div className="admin-grid">
        <section className="panel">
          <h2>Player support</h2>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void send("admin", {
                action: f.get("action"),
                target: f.get("target"),
                amount: Number(f.get("amount")),
                reason: f.get("reason"),
              });
            }}
          >
            <Field label="Player">
              <select name="target" required>
                {state.admin.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} · {chips(u.balance)}
                    {u.bannedUntil > state.serverTime ? " · Suspended" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Action">
              <select name="action">
                <option value="suspend">Suspend for 30 days</option>
                <option value="ban">Ban until lifted</option>
                <option value="unban">Lift ban / suspension</option>
                <option value="mute">Mute chat for 24 hours</option>
                <option value="unmute">Lift chat mute</option>
                <option value="avatar">Reset avatar</option>
                <option value="balance">Adjust available balance</option>
              </select>
            </Field>
            <Field label="Chip adjustment (balance action only)">
              <input
                name="amount"
                type="number"
                min={-100000}
                max={100000}
                defaultValue={0}
              />
            </Field>
            <Field label="Reason for audit log">
              <textarea
                name="reason"
                minLength={10}
                maxLength={1000}
                required
              />
            </Field>
            <button className="button primary" disabled={busy}>
              Apply & record
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>Announcements & rewards</h2>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void send("admin", {
                action: "announcement",
                text: f.get("text"),
                reason: f.get("reason"),
              });
            }}
          >
            <Field label="Lobby announcement">
              <textarea
                name="text"
                maxLength={500}
                defaultValue={state.announcement}
              />
            </Field>
            <Field label="Reason">
              <input name="reason" minLength={10} maxLength={1000} required />
            </Field>
            <button className="button secondary" disabled={busy}>
              Publish announcement
            </button>
          </form>
          <hr />
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void send("admin", {
                action: "reward",
                amount: Number(f.get("amount")),
                reason: f.get("reason"),
              });
            }}
          >
            <Field label="Daily challenge reward · chips">
              <input
                name="amount"
                type="number"
                min={0}
                max={1000}
                defaultValue={state.dailyReward}
              />
            </Field>
            <Field label="Reason">
              <input name="reason" minLength={10} maxLength={1000} required />
            </Field>
            <button className="button secondary" disabled={busy}>
              Update reward
            </button>
          </form>
        </section>
      </div>
      <section className="panel admin-section">
        <h2>Reports</h2>
        {state.admin.reports.length ? (
          state.admin.reports.map((r) => (
            <article className="report" key={r.id}>
              <div className="between">
                <b>
                  {name(r.reporter)} → {name(r.target)}
                </b>
                <span className="muted">
                  {r.resolved ? "Resolved" : "Open"}
                </span>
              </div>
              <p>{r.reason}</p>
              <details>
                <summary>Retained chat evidence</summary>
                <pre>{r.evidence}</pre>
              </details>
              {!r.resolved && (
                <form
                  className="bet-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send("admin", {
                      action: "resolve",
                      target: r.id,
                      reason: new FormData(e.currentTarget).get("reason"),
                    });
                  }}
                >
                  <Field label="Resolution note">
                    <input
                      name="reason"
                      required
                      minLength={10}
                      maxLength={1000}
                    />
                  </Field>
                  <button className="button secondary" disabled={busy}>
                    Resolve
                  </button>
                </form>
              )}
            </article>
          ))
        ) : (
          <Empty>No reports yet.</Empty>
        )}
      </section>
      <section className="panel admin-section">
        <h2>Chat moderation</h2>
        {state.admin.chat.length ? (
          state.admin.chat.map((message) => (
            <article className="report" key={message.id}>
              <div className="between">
                <b>{name(message.userId)}</b>
                <small className="muted">
                  {
                    state.admin!.tables.find((t) => t.id === message.tableId)
                      ?.name
                  }
                </small>
              </div>
              <p>{message.body}</p>
              <form
                className="bet-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send("admin", {
                    action: "removeChat",
                    target: message.id,
                    reason: new FormData(event.currentTarget).get("reason"),
                  });
                }}
              >
                <Field label="Removal reason">
                  <input
                    name="reason"
                    required
                    minLength={10}
                    maxLength={1000}
                  />
                </Field>
                <button className="button secondary" disabled={busy}>
                  Remove message
                </button>
              </form>
            </article>
          ))
        ) : (
          <Empty>No recent messages.</Empty>
        )}
      </section>
      <section className="panel admin-section">
        <h2>Active tables</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Table</th>
                <th>Status</th>
                <th>Seats</th>
                <th>Hand</th>
              </tr>
            </thead>
            <tbody>
              {state.admin.tables.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.status}</td>
                  <td>{t.players}/6</td>
                  <td>{t.hand}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel admin-section">
        <h2>Audit log</h2>
        {state.admin.audit.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Admin</th>
                  <th>Action / target</th>
                  <th>Reason / adjustment</th>
                </tr>
              </thead>
              <tbody>
                {state.admin.audit.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.created).toLocaleString("en-GB")}</td>
                    <td>{name(a.actor)}</td>
                    <td>
                      {a.action}
                      <br />
                      {name(a.target)}
                    </td>
                    <td>
                      {a.reason}
                      <br />
                      {a.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No administrative changes yet.</Empty>
        )}
      </section>
    </section>
  );
}
