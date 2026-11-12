import express from "express";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import dotenv from "dotenv";
import http from "http";
import { WebSocketServer } from "ws";
import Database from "better-sqlite3";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(cookieParser());

// Invite-only access gate for this local testing copy. Invite codes are stored
// as hashes and consumed once; passwords are salted and derived with scrypt.
const authDb = new Database("cord-auth.sqlite");
authDb.pragma("journal_mode = WAL");
authDb.exec(`
  CREATE TABLE IF NOT EXISTS access_users (
    username TEXT PRIMARY KEY,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS access_invites (
    code_hash TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    used_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS access_sessions (
    token_hash TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");
const sessionCookie = "cord_test_session";
const sessionDurationMs = 30 * 24 * 60 * 60 * 1000;
const cookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: sessionDurationMs,
};

const insertInvite = authDb.prepare("INSERT OR IGNORE INTO access_invites (code_hash, created_at) VALUES (?, ?)");
for (const invite of (process.env.LOGIN_INVITE_CODES || "").split(",").map((part) => part.trim()).filter(Boolean)) {
  insertInvite.run(hashToken(invite), Date.now());
}

const accessAttempts = new Map<string, { count: number; resetAt: number }>();
function allowAccessAttempt(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const previous = accessAttempts.get(ip);
  const state = !previous || previous.resetAt <= now ? { count: 0, resetAt: now + 10 * 60 * 1000 } : previous;
  state.count += 1;
  accessAttempts.set(ip, state);
  if (state.count > 20) return res.status(429).json({ error: "Too many attempts. Wait a few minutes and try again." });
  next();
}

function issueAccessSession(username: string, res: express.Response) {
  const token = randomBytes(32).toString("base64url");
  authDb.prepare("INSERT INTO access_sessions (token_hash, username, expires_at) VALUES (?, ?, ?)")
    .run(hashToken(token), username, Date.now() + sessionDurationMs);
  res.cookie(sessionCookie, token, cookieOptions);
}

app.get("/api/access/session", (req, res) => {
  const token = req.cookies[sessionCookie];
  if (!token) return res.json({ authenticated: false });
  const session = authDb.prepare("SELECT username, expires_at FROM access_sessions WHERE token_hash = ?")
    .get(hashToken(token)) as { username: string; expires_at: number } | undefined;
  if (!session || session.expires_at <= Date.now()) {
    if (session) authDb.prepare("DELETE FROM access_sessions WHERE token_hash = ?").run(hashToken(token));
    res.clearCookie(sessionCookie, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/" });
    return res.json({ authenticated: false });
  }
  return res.json({ authenticated: true, username: session.username });
});

app.post("/api/access/signup", allowAccessAttempt, (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const inviteCode = typeof req.body?.inviteCode === "string" ? req.body.inviteCode.trim() : "";
  if (!/^[a-z0-9_-]{3,24}$/.test(username)) return res.status(400).json({ error: "Choose a username with 3–24 letters, numbers, dashes, or underscores." });
  if (password.length < 12) return res.status(400).json({ error: "Use a password with at least 12 characters." });
  if (!inviteCode) return res.status(400).json({ error: "An invite code is required. Ask the owner for one." });

  const inviteHash = hashToken(inviteCode);
  const invite = authDb.prepare("SELECT code_hash FROM access_invites WHERE code_hash = ? AND used_at IS NULL").get(inviteHash);
  if (!invite) return res.status(403).json({ error: "That invite code is invalid or already used." });
  if (authDb.prepare("SELECT 1 FROM access_users WHERE username = ?").get(username)) {
    return res.status(409).json({ error: "That username is already taken." });
  }

  const salt = randomBytes(16).toString("hex");
  const passwordHash = scryptSync(password, salt, 64).toString("hex");
  const createAccount = authDb.transaction(() => {
    authDb.prepare("INSERT INTO access_users (username, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?)")
      .run(username, salt, passwordHash, Date.now());
    const used = authDb.prepare("UPDATE access_invites SET used_at = ? WHERE code_hash = ? AND used_at IS NULL")
      .run(Date.now(), inviteHash);
    if (used.changes !== 1) throw new Error("Invite code was already used");
  });
  try {
    createAccount();
    issueAccessSession(username, res);
    return res.status(201).json({ authenticated: true, username });
  } catch (error) {
    console.error("Account creation failed:", error);
    return res.status(409).json({ error: "Could not create the account. Check the username and invite code." });
  }
});

app.post("/api/access/login", allowAccessAttempt, (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const user = authDb.prepare("SELECT password_salt, password_hash FROM access_users WHERE username = ?")
    .get(username) as { password_salt: string; password_hash: string } | undefined;
  const attemptedHash = scryptSync(password || "invalid", user?.password_salt || "cord-test-login-salt", 64);
  const expectedHash = Buffer.from(user?.password_hash || "0".repeat(128), "hex");
  if (!user || !timingSafeEqual(attemptedHash, expectedHash)) {
    return res.status(401).json({ error: "Username or password is incorrect." });
  }
  issueAccessSession(username, res);
  return res.json({ authenticated: true, username });
});

app.post("/api/access/logout", (req, res) => {
  const token = req.cookies[sessionCookie];
  if (token) authDb.prepare("DELETE FROM access_sessions WHERE token_hash = ?").run(hashToken(token));
  res.clearCookie(sessionCookie, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/" });
  return res.json({ authenticated: false });
});

// Protect the app's API endpoints. The client bundle only exposes the login gate;
// app features and their data endpoints require a valid server session.
app.use("/api", (req, res, next) => {
  const token = req.cookies[sessionCookie];
  if (!token) return res.status(401).json({ code: "APP_SESSION_REQUIRED", error: "Please sign in to continue." });
  const session = authDb.prepare("SELECT username FROM access_sessions WHERE token_hash = ? AND expires_at > ?")
    .get(hashToken(token), Date.now());
  if (!session) return res.status(401).json({ code: "APP_SESSION_REQUIRED", error: "Please sign in to continue." });
  next();
});

// Google OAuth Configuration
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL}/auth/google/callback`
);

// SoundCloud OAuth Configuration (Assuming standard flow)
const SOUNDCLOUD_CLIENT_ID = process.env.SOUNDCLOUD_CLIENT_ID;
const SOUNDCLOUD_CLIENT_SECRET = process.env.SOUNDCLOUD_CLIENT_SECRET;
const SOUNDCLOUD_REDIRECT_URI = `${process.env.APP_URL}/auth/soundcloud/callback`;

// --- AUTH ROUTES ---

// Google Auth URL
app.get("/api/auth/google/url", (req, res) => {
  const url = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/youtube.readonly"],
    prompt: "consent",
  });
  res.json({ url });
});

// Google Callback
app.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await googleClient.getToken(code as string);
    // In a real app, store this in a secure session/database
    // For this demo, we'll send it back to the client via a cookie or postMessage
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', tokens: ${JSON.stringify(tokens)} }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. You can close this window.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(500).send("Authentication failed");
  }
});

// SoundCloud Auth URL
app.get("/api/auth/soundcloud/url", (req, res) => {
  const url = `https://soundcloud.com/connect?client_id=${SOUNDCLOUD_CLIENT_ID}&redirect_uri=${SOUNDCLOUD_REDIRECT_URI}&response_type=code&scope=non-expiring`;
  res.json({ url });
});

// SoundCloud Callback
app.get("/auth/soundcloud/callback", async (req, res) => {
  const { code } = req.query;
  try {
    const response = await axios.post("https://api.soundcloud.com/oauth2/token", {
      client_id: SOUNDCLOUD_CLIENT_ID,
      client_secret: SOUNDCLOUD_CLIENT_SECRET,
      redirect_uri: SOUNDCLOUD_REDIRECT_URI,
      grant_type: "authorization_code",
      code,
    });
    const tokens = response.data;
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'SOUNDCLOUD_AUTH_SUCCESS', tokens: ${JSON.stringify(tokens)} }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. You can close this window.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("SoundCloud Auth Error:", error);
    res.status(500).send("Authentication failed");
  }
});

// --- SEARCH ROUTES ---

const searchYoutubeHtml = async (query: string) => {
  const response = await axios.get("https://www.youtube.com/results", {
    params: { search_query: query },
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36" },
    timeout: 12000,
  });
  const html = String(response.data);
  const initialData = html.match(/(?:var\s+)?ytInitialData\s*=\s*(\{.*?\})\s*;\s*<\/script>/s)?.[1]
    || html.match(/"ytInitialData"\s*:\s*(\{.*?\})\s*,\s*"ytInitialPlayerResponse"/s)?.[1];
  if (!initialData) throw new Error("YouTube search page did not include video results");
  const parsed = JSON.parse(initialData);
  const videos: any[] = [];
  const visit = (value: any) => {
    if (!value || typeof value !== "object" || videos.length >= 10) return;
    if (value.videoRenderer?.videoId) {
      const video = value.videoRenderer;
      videos.push({
        id: { videoId: video.videoId },
        snippet: {
          title: video.title?.runs?.map((run: any) => run.text).join("") || video.title?.simpleText || "YouTube video",
          channelTitle: video.ownerText?.runs?.map((run: any) => run.text).join("") || "YouTube",
          thumbnails: video.thumbnail,
        },
      });
      return;
    }
    if (Array.isArray(value)) value.forEach(visit);
    else Object.values(value).forEach(visit);
  };
  visit(parsed);
  return videos;
};

// YouTube Search
app.post("/api/search/youtube", async (req, res) => {
  const { query, accessToken } = req.body;
  if (typeof query !== "string" || !query.trim()) return res.status(400).json({ error: "Enter a song or artist to search" });
  if (!process.env.GOOGLE_API_KEY && !accessToken) {
    try {
      return res.json(await searchYoutubeHtml(query.trim()));
    } catch (error: any) {
      console.error("YouTube HTML Search Error:", error.message);
      return res.status(502).json({ error: "YouTube search is temporarily unavailable" });
    }
  }
  try {
    const response = await axios.get("https://www.googleapis.com/youtube/v3/search", {
      params: {
        part: "snippet",
        q: query,
        type: "video",
        maxResults: 10,
        key: process.env.GOOGLE_API_KEY, // Optional if using accessToken
      },
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    res.json(response.data.items);
  } catch (error) {
    console.error("YouTube Search Error:", error);
    try {
      return res.json(await searchYoutubeHtml(query.trim()));
    } catch {
      res.status(500).json({ error: "Search failed" });
    }
  }
});

// SoundCloud Search
app.post("/api/search/soundcloud", async (req, res) => {
  const { query, accessToken } = req.body;
  try {
    const response = await axios.get("https://api.soundcloud.com/tracks", {
      params: {
        q: query,
        limit: 10,
        client_id: SOUNDCLOUD_CLIENT_ID,
      },
      headers: accessToken ? { Authorization: `OAuth ${accessToken}` } : {},
    });
    res.json(response.data);
  } catch (error) {
    console.error("SoundCloud Search Error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// --- DISCORD PROXY ROUTE (Enables 100% pure browser/HTML execution without CORS issues or .exe requirements) ---
app.all("/api/discord/*", async (req, res) => {
  const targetPath = req.originalUrl.replace(/^\/api\/discord/, "/api/v9");
  const targetUrl = `https://discord.com${targetPath}`;

  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "*/*",
  };

  if (req.headers["authorization"]) {
    headers["Authorization"] = req.headers["authorization"] as string;
  }
  if (req.headers["content-type"]) {
    headers["Content-Type"] = req.headers["content-type"] as string;
  }

  try {
    const response = await axios({
      method: req.method as any,
      url: targetUrl,
      headers,
      data: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
      validateStatus: () => true, // Forward all status codes (including 204, 400, 403, 404, 429)
      responseType: "arraybuffer",
    });

    res.status(response.status);

    if (response.headers["content-type"]) {
      res.setHeader("content-type", response.headers["content-type"]);
    }
    if (response.headers["retry-after"]) {
      res.setHeader("retry-after", response.headers["retry-after"]);
    }

    if (response.status === 204 || !response.data || response.data.length === 0) {
      return res.end();
    }

    return res.send(Buffer.from(response.data));
  } catch (err: any) {
    console.error("Discord proxy error:", err.message);
    return res.status(502).json({ error: "Discord proxy error", message: err.message });
  }
});

function printBanner() {
  console.log('\x1b[2J\x1b[0;0H'); // Clear screen
  console.log('\x1b[31m');
  console.log('´´´´´´´´´´´´´´´´´´´ ¶¶¶¶¶¶¶¶¶¶¶¶¶¶¶¶¶¶¶ ´´´´´´´´´´´´´´´´´´´');
  console.log('      ´´´´´´´´´´´´´´´´´ ¶¶¶¶¶¶ ´´´´´´´´´´´´´ ¶¶¶¶¶¶¶ ´´´´´´´´´´´´´´´´');
  console.log('      ´´´´´´´´´´´´´´ ¶¶¶¶ ´´´´´´´´´´´´´´´´´´´´´´´ ¶¶¶¶ ´´´´´´´´´´´´´´');
  console.log('      ´´´´´´´´´´´´´ ¶¶¶ ´´´´´´´´´´´´´´´´´´´´´´´´´´´´´ ¶¶ ´´´´´´´´´´´´');
  console.log('      ´´´´´´´´´´´´ ¶¶ ´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´ ¶¶ ´´´´´´´´´´´');
  console.log('      ´´´´´´´´´´´ ¶¶ ´´´´´´´´´´´´´´´´´´´´`´´´´´´´´´´´´ ¶¶ ´´´´´´´´´´');
  console.log('      ´´´´´´´´´´ ¶¶ ´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´ ¶¶ ´´´´´´´´´');
  console.log('      ´´´´´´´´´´ ¶¶´¶¶ ´´´´´´´´´´´´´´´´´´´´´´´´´´´´´ ¶¶´¶¶ ´´´´´´´´´´');
  console.log('      ´´´´´´´´´´ ¶¶´¶¶ ´´´´´´´´´´´´´´´´´´´´´´´´´´´´´ ¶¶´´¶ ´´´´´´´´´´');
  console.log('      ´´´´´´´´´´ ¶¶´¶¶ ´´´´´´´´´´´´´´´´´´´´´´´´´´´´´ ¶¶´´¶ ´´´´´´´´´´');
  console.log('      ´´´´´´´´´´ ¶¶´´¶¶ ´´´´´´´´´´´´´´´´´´´´´´´´´´´ ¶¶´¶¶ ´´´´´´´´´´´');
  console.log('      ´´´´´´´´´´ ¶¶´´¶¶ ´´´´´´´´´´´´´´´´´´´´´´´´´´ ¶¶´´¶¶ ´´´´´´´´´´´');
  console.log('      ´´´´´´´´´´´ ¶¶´¶¶ ´´´¶¶¶¶¶¶¶¶´´´´´¶¶¶¶¶¶¶¶´´´ ¶¶´¶¶ ´´´´´´´´´´´´');
  console.log('      ´´´´´´´´´´´´ ¶¶¶¶´¶¶¶¶¶¶¶¶¶¶´´´´´¶¶¶¶¶¶¶¶¶¶´ ¶¶¶¶¶ ´´´´´´´´´´´´');
  console.log('      ´´´´´´´´´´´´´ ¶¶¶´¶¶¶¶¶¶¶¶¶¶´´´´´¶¶¶¶¶¶¶¶¶¶´ ¶¶¶ ´´´´´´´´´´´´´´');
  console.log('      ´´¶¶¶´´´´´´´´ ¶¶´´¶¶¶¶¶¶¶¶´´´´´´´¶¶¶¶¶¶¶¶¶´´ ¶¶ ´´´´´ ¶¶¶¶´´´');
  console.log('      ´´¶¶¶¶¶´´´´´ ¶¶´´´¶¶¶¶¶¶¶´´´¶¶¶´´´¶¶¶¶¶¶¶´´´ ¶¶ ´´´´´ ¶¶¶¶¶¶´´');
  console.log('      ´¶¶´´´¶¶´´´´ ¶¶´´´´´¶¶¶´´´´¶¶¶¶¶´´´´¶¶¶´´´´´ ¶¶ ´´´ ¶¶´´´¶¶´´');
  console.log('     ´¶¶¶´´´´¶¶¶¶´´¶¶´´´´´´´´´´¶¶¶¶¶¶¶´´´´´´´´´´ ¶¶ ´¶¶¶¶´´´´¶¶¶´');
  console.log('    ¶¶´´´´´´´´´¶¶¶¶¶¶¶´´´´´´´¶¶¶¶¶¶¶´´´´´´´¶¶¶¶¶¶¶¶¶´´´´´´´´¶¶');
  console.log('    ¶¶¶¶¶¶¶¶¶´´´´´¶¶¶¶¶¶¶´´´´¶¶¶¶¶¶¶´´´´¶¶¶¶¶¶¶¶´´´´´´¶¶¶¶¶¶¶¶');
  console.log('     ´´¶¶¶¶´¶¶¶¶¶´´´´´´¶¶¶¶¶´´´´´´´´´´´´´´¶¶¶´¶¶´´´´´¶¶¶¶¶¶´¶¶¶´');
  console.log('     ´´´´´´´´´¶¶¶¶¶¶´´¶¶¶´´¶¶´´´´´´´´´´´¶¶´´¶¶¶´´¶¶¶¶¶¶´´´´´´´´');
  console.log('     ´´´´´´´´´´´´´¶¶¶¶¶¶´¶¶´¶¶¶¶¶¶¶¶¶¶¶´¶¶´¶¶¶¶¶¶´´´´´´´´´´´´´´');
  console.log('     ´´´´´´´´´´´´´´´´´¶¶´¶¶´¶´¶´¶´¶´¶´¶´¶´¶´¶¶´´´´´´´´´´´´´´´´´');
  console.log('     ´´´´´´´´´´´´´´´¶¶¶¶´´¶´¶´¶´¶´¶´¶´¶´¶´´´¶¶¶¶¶´´´´´´´´´´´´´´');
  console.log('     ´´´´´´´´´´´¶¶¶¶¶´¶¶´´´¶¶¶¶¶¶¶¶¶¶¶¶¶´´´¶¶´¶¶¶¶¶´´´´´´´´´´´´');
  console.log('     ´´´¶¶¶¶¶¶¶¶¶¶´´´´´¶¶´´´´´´´´´´´´´´´´´¶¶´´´´´´¶¶¶¶¶¶¶¶¶´´´´');
  console.log('     ´´´¶¶´´´´´´´´´´´¶¶¶¶¶¶¶´´´´´´´´´´´´´¶¶¶¶¶¶¶¶´´´´´´´´´´¶¶´´´');
  console.log('     ´´´´¶¶¶´´´´´¶¶¶¶¶´´´´´¶¶¶¶¶¶¶¶¶¶¶¶¶¶´´´´´¶¶¶¶¶´´´´´¶¶¶´´´´');
  console.log('     ´´´´´´¶¶´´´¶¶¶´´´´´´´´´´´¶¶¶¶¶¶¶¶¶´´´´´´´´´´´¶¶¶´´´¶¶´´´´´´');
  console.log('     ´´´´´´¶¶´´¶¶´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´¶¶´´¶¶´´´´´´');
  console.log('     ´´´´´´´¶¶¶¶´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´¶¶¶¶´´´´´´´');
  console.log('');
  console.log(' __ __ _ ____ _____ ______ __');
  console.log('| \\/ | / \\ | _ \\ | ____| | __ ) \\ / /');
  console.log('| |\\/| | / _ \\ | | | | _| | _ \\\\ V /');
  console.log('| |  | |/ ___ \\| |_| | |___ | |_) || |');
  console.log('|_|  |_|/_/   \\_\\____/ |_____| |____/_|_| _____ ___ _____ _____');
  console.log('| | / _ \\| _ \\| _ \\ |  \\ \\/ / | |_ _ |_ _ / ___| ____|');
  console.log('| | | | | | | |_) | | | | |_ | |\\ // __)| | | | | | _|');
  console.log('| |__| |_/ | _ < | |_| | | |_| |/ \\\\__ \\| | | |___| |___');
  console.log('|_____\\___/|_| \\_\\____/  \\___//_/\\_\\(_/ |_| |___\\____|_____|');
  console.log('                                     |_|');
  console.log('\x1b[0m');
}

// --- VITE MIDDLEWARE & SERVER START ---
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  const server = http.createServer(app);

  // Attach WebSocket Server to the same HTTP server
  try {
    const wss = new WebSocketServer({ server });
    wss.on("connection", (ws) => {
      ws.on("message", (msg) => {
        try {
          const parsed = JSON.parse(msg.toString());
          ws.send(JSON.stringify({ status: "ok", received: parsed }));
        } catch {
          ws.send(JSON.stringify({ status: "ok" }));
        }
      });
    });
  } catch (err: any) {
    console.error("WebSocket attachment error:", err.message);
  }

  server.on("error", (err: any) => {
    console.error("HTTP Server Error:", err);
  });

  server.listen(PORT, "0.0.0.0", () => {
    printBanner();
    console.log(`SLENDO CORD web application running on port ${PORT}`);
  });
}

start();
