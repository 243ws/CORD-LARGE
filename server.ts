import express from "express";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import dotenv from "dotenv";
import http from "http";
import { WebSocketServer } from "ws";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(cookieParser());

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
