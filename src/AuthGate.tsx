import { FormEvent, useEffect, useState } from "react";
import { CordApp } from "./App";
import "./auth.css";

type SessionState = { authenticated: boolean; username?: string };

export default function AuthGate() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [showDownloadPage, setShowDownloadPage] = useState(() => window.location.pathname === "/download");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/access/session", { credentials: "same-origin" })
      .then((response) => response.json())
      .then(setSession)
      .catch(() => setSession({ authenticated: false }));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/access/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password, inviteCode }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not sign in.");
      if (mode === "signup") {
        window.history.replaceState(null, "", "/download");
        setShowDownloadPage(true);
      } else if (window.location.pathname === "/download") {
        window.history.replaceState(null, "", "/");
        setShowDownloadPage(false);
      }
      setSession(result);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not sign in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/access/logout", { method: "POST", credentials: "same-origin" });
    window.history.replaceState(null, "", "/");
    setShowDownloadPage(false);
    setSession({ authenticated: false });
    setPassword("");
  }

  if (!session) return <main className="access-loading"><span className="access-spinner" />Checking access…</main>;

  if (session.authenticated) {
    return <>
      <button className="access-signout" onClick={logout} type="button" title={`Signed in as ${session.username}`}>
        <span className="access-online-dot" /> {session.username} · Sign out
      </button>
      {showDownloadPage ? (
        <main className="download-screen">
          <div className="access-orbit access-orbit-one" />
          <div className="access-orbit access-orbit-two" />
          <section className="download-card" aria-labelledby="download-title">
            <div className="access-mark" aria-hidden="true"><span>SC</span></div>
            <div className="access-kicker">ACCOUNT READY · LIVE UPDATE BUILD</div>
            <h1 id="download-title">Download SlendoCord</h1>
            <p className="download-copy">
              Get the Windows app in one file. It includes the runtime and checks for published module updates when you open it.
            </p>
            <a className="download-primary" href="https://github.com/243ws/SlendoCord-Updates/releases/latest/download/SlendoCord.exe">
              Download SlendoCord.exe
            </a>
            <p className="download-note">No separate Node.js installation or project folder is needed. Internet access is required to check for updates.</p>
            <div className="download-divider"><span>OR PREVIEW IN YOUR BROWSER</span></div>
            <button
              className="download-preview"
              type="button"
              onClick={() => {
                window.history.replaceState(null, "", "/");
                setShowDownloadPage(false);
              }}
            >
              Preview Cord
            </button>
          </section>
          <div className="access-footer">SLENDO CORD <span>—</span> DOWNLOAD & PREVIEW</div>
        </main>
      ) : <CordApp />}
    </>;
  }

  const isSignup = mode === "signup";
  return (
    <main className="access-screen">
      <div className="access-orbit access-orbit-one" />
      <div className="access-orbit access-orbit-two" />
      <section className="access-card" aria-labelledby="access-title">
        <div className="access-mark" aria-hidden="true"><span>SC</span></div>
        <div className="access-kicker">PRIVATE ACCESS · INVITE ONLY</div>
        <h1 id="access-title">{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="access-subtitle">
          {isSignup ? "A one-time invite is required to join." : "Sign in to continue to Slendo Cord."}
        </p>

        <form className="access-form" onSubmit={submit}>
          <label htmlFor="access-username">Username</label>
          <input id="access-username" autoComplete="username" maxLength={24} minLength={3} onChange={(event) => setUsername(event.target.value)} placeholder="your username" required value={username} />

          <label htmlFor="access-password">Password</label>
          <input id="access-password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={isSignup ? 12 : undefined} onChange={(event) => setPassword(event.target.value)} placeholder={isSignup ? "At least 12 characters" : "Your password"} required type="password" value={password} />

          {isSignup && <>
            <label htmlFor="access-invite">One-time invite code</label>
            <input id="access-invite" autoComplete="off" onChange={(event) => setInviteCode(event.target.value)} placeholder="Ask the owner for an invite" required value={inviteCode} />
          </>}

          {error && <div className="access-error" role="alert">{error}</div>}
          <button className="access-submit" disabled={busy} type="submit">{busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}</button>
        </form>

        <div className="access-switch">
          {isSignup ? "Already have an account?" : "Have an invite?"}{" "}
          <button type="button" onClick={() => { setMode(isSignup ? "login" : "signup"); setError(""); }}>
            {isSignup ? "Sign in" : "Create an account"}
          </button>
        </div>
        <div className="access-lock-note"><span>◈</span> Accounts require a unique invite code. Public sign-up is disabled.</div>
      </section>
      <div className="access-footer">SLENDO CORD <span>—</span> PRIVATE TEST BUILD</div>
    </main>
  );
}
