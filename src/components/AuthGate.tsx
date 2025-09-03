import { useEffect, useMemo, useState } from "react";
import "./AuthGate.css";
import logo from "../assets/CycSafe.png";

/**
 * Simple client-side access gate (demo-grade).
 * Credentials via Vite env:
 *   VITE_AUTH_ACCOUNT, VITE_AUTH_PASSWORD, (optional) VITE_AUTH_TTL_MS
 *
 * On success, stores a short-lived session flag in localStorage ("cs.auth.v1").
 */

const STORAGE_KEY = "cs.auth.v1";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const EXPECTED_ACCOUNT = String(import.meta.env.VITE_AUTH_ACCOUNT ?? "");
  const EXPECTED_PASSWORD = String(import.meta.env.VITE_AUTH_PASSWORD ?? "");
  const TTL_MS = Number(import.meta.env.VITE_AUTH_TTL_MS ?? 1000 * 60 * 60 * 12); // 12h default

  // If env missing → gate disabled (handy during local dev)
  const disabled = useMemo(
    () => !EXPECTED_ACCOUNT || !EXPECTED_PASSWORD,
    [EXPECTED_ACCOUNT, EXPECTED_PASSWORD]
  );

  const [authed, setAuthed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const { ok, exp } = JSON.parse(raw);
      return !!ok && typeof exp === "number" && Date.now() < exp;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (disabled) {
      console.warn(
        "[AuthGate] Missing VITE_AUTH_ACCOUNT or VITE_AUTH_PASSWORD. Gate is disabled."
      );
    }
  }, [disabled]);

  if (disabled || authed) return <>{children}</>;

  return (
    <LockScreen
      onSuccess={(account, password) => {
        if (account === EXPECTED_ACCOUNT && password === EXPECTED_PASSWORD) {
          try {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({ ok: true, at: Date.now(), exp: Date.now() + TTL_MS })
            );
          } catch {}
          setAuthed(true);
          return true;
        }
        return false;
      }}
    />
  );
}

function LockScreen({ onSuccess }: { onSuccess: (acc: string, pwd: string) => boolean }) {
  const [acc, setAcc] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const ok = onSuccess(acc.trim(), pwd);
    if (!ok) setErr("Invalid account or password.");
  }

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true" aria-label="Access required">
      <div className="auth-card">
        <img src={logo} alt="" className="auth-logo" />
        <h1 className="auth-title">CycSafe</h1>
        <p className="auth-sub">Restricted access</p>

        <form onSubmit={submit} className="auth-form">
          <label className="auth-label">
            Account number
            <input
              className="auth-input"
              inputMode="numeric"
              autoComplete="username"
              value={acc}
              onChange={(e) => setAcc(e.target.value)}
              placeholder="e.g. 123456"
              required
            />
          </label>

          <label className="auth-label">
            Password
            <div className="auth-input-wrap">
              <input
                className="auth-input"
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="Your password"
                required
              />
              <button
                type="button"
                className="auth-toggle"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {err && <div className="auth-error" role="alert">{err}</div>}

          <button type="submit" className="auth-cta">Unlock</button>
        </form>

        
      </div>
    </div>
  );
}