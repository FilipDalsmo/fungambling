"use client";
import { useState, type FormEvent } from "react";
import { Field, Modal } from "./ui";
export function AuthPanel({
  close,
  done,
}: {
  close: () => void;
  done: (recovery?: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"register" | "login" | "recover">(
    "register",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, action: mode }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      await done(result.recovery);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to connect");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        mode === "register"
          ? "Your seat is waiting"
          : mode === "login"
            ? "Welcome back"
            : "Recover your account"
      }
      close={close}
    >
      <p className="muted">
        {mode === "register"
          ? "Create an account and start with 10,000 fictional chips. No payments. Ever."
          : mode === "recover"
            ? "Use the recovery code you saved when you joined. All existing sessions will be signed out."
            : "Pick up where you left off."}
      </p>
      <form onSubmit={submit} className="form-stack">
        <Field label="Username">
          <input
            name="username"
            autoComplete="username"
            required
            pattern="[a-zA-Z0-9_]{3,20}"
            minLength={3}
            maxLength={20}
          />
        </Field>
        {mode === "recover" && (
          <Field label="Recovery code">
            <input
              name="recovery"
              autoComplete="off"
              required
              minLength={48}
              maxLength={48}
            />
          </Field>
        )}
        <Field label={mode === "recover" ? "New password" : "Password"}>
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
            minLength={12}
            maxLength={128}
          />
        </Field>
        <small className="muted">
          At least 12 characters. A password manager is a good place to keep
          your recovery code.
        </small>
        {error && (
          <p role="alert" className="error-inline">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy
            ? "One moment…"
            : mode === "register"
              ? "Let’s play →"
              : mode === "login"
                ? "Sign in →"
                : "Reset password"}
        </button>
      </form>
      <div className="auth-options">
        {mode !== "register" && (
          <button className="text-button" onClick={() => setMode("register")}>
            Create an account
          </button>
        )}
        {mode !== "login" && (
          <button className="text-button" onClick={() => setMode("login")}>
            Already a member? Sign in
          </button>
        )}
        {mode !== "recover" && (
          <button className="text-button" onClick={() => setMode("recover")}>
            Recover account
          </button>
        )}
      </div>
    </Modal>
  );
}
