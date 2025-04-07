// src/data/live.js
const { fyersDataSocket } = require("fyers-api-v3");

let socket;

function startLiveFeed(appId, accessToken, symbols = []) {
  if (socket) socket.close();

  socket = new fyersDataSocket(`${appId}:${accessToken}`, "./logs", true);

  socket.on("connect", () => {
    console.log("✅ Connected to Fyers live feed");
    socket.subscribe(symbols); // e.g., ["NSE:SBIN-EQ"]
  });

  socket.on("message", (msg) => {
    console.log("📡 Live Update:", msg);
    // forward to frontend or store
  });

  socket.on("error", (err) => {
    console.error("❌ WebSocket error:", err);
  });

  socket.connect();
}

module.exports = { startLiveFeed };
