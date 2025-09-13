import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

// Tokens in memory (refresh_token comes from env var if already set)
let tokens = {
  access_token: null,
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  expiry_date: null
};

const client_id = process.env.GOOGLE_CLIENT_ID;
const client_secret = process.env.GOOGLE_CLIENT_SECRET;
const redirect_uri = "https://thorndream-production.up.railway.app/oauth2callback";

// OAuth callback — exchange code for tokens
app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id,
        client_secret,
        redirect_uri,
        grant_type: "authorization_code"
      })
    });

    const data = await response.json();
    console.log("OAuth Response:", data);

    if (data.refresh_token) {
      console.log("👉 SAVE THIS REFRESH TOKEN in Railway Env:", data.refresh_token);
    }

    tokens.access_token = data.access_token;
    tokens.refresh_token = data.refresh_token || tokens.refresh_token;
    tokens.expiry_date = Date.now() + data.expires_in * 1000;

    res.send("✅ Rhythm Keeper OAuth flow complete! Check Railway logs for tokens.");
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.status(500).send("❌ OAuth failed. Check logs.");
  }
});

// Refresh access token if needed
async function getAccessToken() {
  if (!tokens.refresh_token) {
    throw new Error("Missing refresh token. Set GOOGLE_REFRESH_TOKEN in Railway.");
  }

  if (!tokens.access_token || Date.now() > tokens.expiry_date) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id,
        client_secret,
        refresh_token: tokens.refresh_token,
        grant_type: "refresh_token"
      })
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(`Failed to refresh access token: ${JSON.stringify(data)}`);
    }

    tokens.access_token = data.access_token;
    tokens.expiry_date = Date.now() + data.expires_in * 1000;
    console.log("🔄 Access token refreshed at", new Date().toISOString());
  }

  return tokens.access_token;
}

// Calendar proxy
app.get("/calendar", async (req, res) => {
  try {
    const token = await getAccessToken();
    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10",
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    const events = await response.json();
    res.json(events);
  } catch (err) {
    console.error("Calendar error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Tasks proxy
app.get("/tasks", async (req, res) => {
  try {
    const token = await getAccessToken();
    const response = await fetch(
      "https://tasks.googleapis.com/tasks/v1/users/@me/lists",
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    const tasks = await response.json();
    res.json(tasks);
  } catch (err) {
    console.error("Tasks error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () =>
  console.log("🚀 Rhythm Keeper backend running on port 3000")
);
