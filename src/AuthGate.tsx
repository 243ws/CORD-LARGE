import { FormEvent, useEffect, useRef, useState } from "react";
import { CordApp } from "./App";
import "./auth.css";

type SessionState = { authenticated: boolean; username?: string };

const soundtrack = [
  "K638Bkx7REk",
  "OrueixyWEF4",
  "1pdkrcG15Fc",
  "4UmbbK64J8A",
  "zMxqb9NfZrA",
  "smQ2dbSm9ek",
];

type YoutubePlayer = {
  destroy(): void;
  loadVideoById(options: { videoId: string; startSeconds?: number }): void;
  mute(): void;
  unMute(): void;
  playVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  isMuted(): boolean;
};

function shuffleSongs(previousLast: number | null = null) {
  const order = soundtrack.map((_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }
  if (previousLast !== null && order.length > 1 && order[0] === previousLast) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return order;
}

function BackgroundMusic() {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YoutubePlayer | null>(null);
  const queueRef = useRef<number[]>([]);
  const queuePositionRef = useRef(0);
  const historyRef = useRef<number[]>([]);
  const historyPositionRef = useRef(0);
  const currentTrackRef = useRef(0);
  const soundOnRef = useRef(false);
  const nextTrackRef = useRef<() => void>(() => undefined);
  const previousTrackRef = useRef<() => void>(() => undefined);
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [trackNumber, setTrackNumber] = useState(1);

  const enableSound = () => {
    const player = playerRef.current;
    if (!player) return;
    player.setVolume(100);
    player.unMute();
    player.playVideo();
    soundOnRef.current = true;
    setSoundOn(true);
  };

  const playTrack = (trackIndex: number) => {
    const player = playerRef.current;
    if (!player) return;
    currentTrackRef.current = trackIndex;
    setTrackNumber(trackIndex + 1);
    player.loadVideoById({ videoId: soundtrack[trackIndex], startSeconds: 0 });
    player.setVolume(100);
    if (soundOnRef.current) player.unMute();
  };

  const nextTrack = () => {
    if (!playerRef.current) return;
    const history = historyRef.current;
    if (historyPositionRef.current < history.length - 1) {
      historyPositionRef.current += 1;
      const forwardTrack = history[historyPositionRef.current];
      const queueIndex = queueRef.current.indexOf(forwardTrack);
      if (queueIndex >= 0) queuePositionRef.current = queueIndex;
      playTrack(forwardTrack);
      return;
    }

    if (queuePositionRef.current >= queueRef.current.length - 1) {
      queueRef.current = shuffleSongs(currentTrackRef.current);
      queuePositionRef.current = 0;
    } else {
      queuePositionRef.current += 1;
    }
    const nextIndex = queueRef.current[queuePositionRef.current];
    history.push(nextIndex);
    historyPositionRef.current = history.length - 1;
    if (history.length > 120) {
      history.splice(0, history.length - 120);
      historyPositionRef.current = history.length - 1;
    }
    playTrack(nextIndex);
  };

  const previousTrack = () => {
    if (historyPositionRef.current > 0) {
      historyPositionRef.current -= 1;
      const previousIndex = historyRef.current[historyPositionRef.current];
      const queueIndex = queueRef.current.indexOf(previousIndex);
      if (queueIndex >= 0) queuePositionRef.current = queueIndex;
      playTrack(previousIndex);
    } else {
      playerRef.current?.seekTo(0, true);
      playerRef.current?.playVideo();
    }
  };

  nextTrackRef.current = nextTrack;
  previousTrackRef.current = previousTrack;

  useEffect(() => {
    let disposed = false;
    const initialOrder = shuffleSongs();
    queueRef.current = initialOrder;
    queuePositionRef.current = 0;
    historyRef.current = [initialOrder[0]];
    historyPositionRef.current = 0;
    currentTrackRef.current = initialOrder[0];
    setTrackNumber(initialOrder[0] + 1);

    const initializePlayer = () => {
      if (disposed || !mountRef.current || !window.YT?.Player || playerRef.current) return;
      playerRef.current = new window.YT.Player(mountRef.current, {
        width: "1920",
        height: "1080",
        videoId: soundtrack[initialOrder[0]],
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          origin: window.location.origin,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: (event: { target: YoutubePlayer }) => {
            event.target.setVolume(100);
            event.target.unMute();
            event.target.playVideo();
            if (!disposed) setReady(true);
          },
          onStateChange: (event: { data: number }) => {
            if (event.data === window.YT?.PlayerState.ENDED) nextTrackRef.current();
            if (event.data === window.YT?.PlayerState.PLAYING && !playerRef.current?.isMuted()) {
              soundOnRef.current = true;
              setSoundOn(true);
            }
          },
          onAutoplayBlocked: () => {
            if (disposed) return;
            soundOnRef.current = false;
            setSoundOn(false);
            setAutoplayBlocked(true);
            playerRef.current?.mute();
            playerRef.current?.playVideo();
          },
          onError: () => nextTrackRef.current(),
        },
      });
    };

    if (window.YT?.Player) {
      initializePlayer();
    } else {
      const previousReadyHandler = window.onYouTubeIframeAPIReady;
      const readyHandler = () => {
        previousReadyHandler?.();
        initializePlayer();
      };
      window.onYouTubeIframeAPIReady = readyHandler;
      const script = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
      if (!script) {
        const apiScript = document.createElement("script");
        apiScript.src = "https://www.youtube.com/iframe_api";
        apiScript.async = true;
        document.head.appendChild(apiScript);
      }
    }

    return () => {
      disposed = true;
      if (replayTimerRef.current) clearTimeout(replayTimerRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  const handleReplay = () => {
    if (replayTimerRef.current) {
      clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
      if (!soundOnRef.current) enableSound();
      previousTrackRef.current();
      return;
    }
    replayTimerRef.current = setTimeout(() => {
      replayTimerRef.current = null;
      if (!soundOnRef.current) enableSound();
      playerRef.current?.seekTo(0, true);
      playerRef.current?.playVideo();
    }, 330);
  };

  const handleNext = () => {
    if (!soundOnRef.current) enableSound();
    nextTrackRef.current();
  };

  return (
    <div className="access-soundtrack">
      <div className="access-video-backdrop" aria-hidden="true">
        <div className="access-video-player" ref={mountRef} />
        <div className="access-video-shade" />
      </div>
      <div className="access-soundtrack-topline">
        <span className="access-soundtrack-label">LOGIN SOUNDTRACK</span>
        <span className="access-soundtrack-count">6 TRACK SHUFFLE</span>
      </div>
      <div className="access-track-status">
        <span className={`access-track-dot${soundOn ? " is-on" : ""}`} />
        <span>{soundOn ? `NOW PLAYING · TRACK ${trackNumber} / 6` : "MUSIC READY · SHUFFLE ON"}</span>
        <span className="access-equalizer" aria-hidden="true"><i /><i /><i /><i /><i /></span>
      </div>
      <div className="access-track-controls">
        <button type="button" className="access-track-button" onClick={handleReplay} disabled={!ready} aria-label="Replay current track, double click for previous track">
          <span aria-hidden="true">↶</span><span>REPLAY <small>· PREV ×2</small></span>
        </button>
        <span className="access-volume-status">
          {soundOn ? "SOUND ON · 100%" : autoplayBlocked ? "AUTOPLAY BLOCKED BY BROWSER" : ready ? "STARTING SOUND · 100%" : "LOADING VIDEO"}
        </span>
        <button type="button" className="access-track-button access-track-next" onClick={handleNext} disabled={!ready} aria-label="Skip to next shuffled track">
          <span>SKIP</span><span aria-hidden="true">↠</span>
        </button>
      </div>
      <span className="access-music-hint">Tap replay once to restart · twice quickly for previous</span>
    </div>
  );
}

export default function AuthGate() {
  const [session, setSession] = useState<SessionState | null>(null);
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
      setSession(result);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not sign in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/access/logout", { method: "POST", credentials: "same-origin" });
    setSession({ authenticated: false });
    setPassword("");
  }

  if (!session) return <main className="access-loading"><span className="access-spinner" />Checking access…</main>;

  if (session.authenticated) {
    return <>
      <button className="access-signout" onClick={logout} type="button" title={`Signed in as ${session.username}`}>
        <span aria-hidden="true">←</span> SIGN OUT
      </button>
      <CordApp />
    </>;
  }

  const isSignup = mode === "signup";
  return (
    <main className="access-screen">
      <section className="access-card" aria-labelledby="access-title">
        <div className="access-brand-row">
          <div className="access-mark" aria-hidden="true"><span>SC</span></div>
          <div className="access-brand-name">SLENDO <span>CORD</span></div>
          <span className="access-private-tag"><i /> PRIVATE</span>
        </div>
        <div className="access-kicker"><span className="access-kicker-line" /> INVITE-ONLY ACCESS <span className="access-kicker-line" /></div>
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
        <BackgroundMusic />
      </section>
      <div className="access-footer">SLENDO CORD <span>—</span> PRIVATE TEST BUILD</div>
    </main>
  );
}
