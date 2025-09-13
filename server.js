import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

// Tokens in memory (refresh_token comes from Render env var)
let tokens = {
  access_token: null,
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  expiry_date: null
};

const client_id = process.env.GOOGLE_CLIENT_ID;
const client_secret = process.env.GOOGLE_CLIENT_SECRET;
const redirect_uri = "https://rhythm-keeper-oauth.onrender.com/oauth2callback";

// OAuth callback (you won’t need this again once refresh token is set)
app.get("/oauth2callback", (req, res) => {
  res.send("✅ Rhythm Keeper is already authorized with a refresh token!");
});

// Refresh access token if needed
async function getAccessToken() {
  if (!tokens.refresh_token) {
    throw new Error("Missing refresh token. Set GOOGLE_REFRESH_TOKEN in Render.");
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
    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const events = await response.json();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tasks proxy
app.get("/tasks", async (req, res) => {
  try {
    const token = await getAccessToken();
    const response = await fetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const tasks = await response.json();
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("🚀 Rhythm Keeper backend running on port 3000"));
