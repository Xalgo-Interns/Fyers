// src/auth/auth.routes.js
const express = require("express");
const router = express.Router();
const { exchangeAuthCodeForToken } = require("./token.service");
const config = require("../config");

/**
 * GET /auth/redirect-url?userId=abc123
 * Generates Fyers login redirect URL
 */
router.get("/redirect-url", (req, res) => {
  const { userId } = req.query;
  if (!userId)
    return res.status(400).json({ success: false, error: "Missing userId" });

  const redirectUri = encodeURIComponent(config.fyersRedirectUri);
  const authUrl = `https://api.fyers.in/api/v2/generate-authcode?client_id=${config.fyersAppId}&redirect_uri=${redirectUri}&response_type=code&state=${userId}`;

  res.json({ success: true, url: authUrl });
});

/**
 * GET /auth/callback?auth_code=xyz&state=userId
 * Callback from Fyers after user logs in
 */
router.get("/callback", async (req, res) => {
  const { auth_code, state: userId } = req.query;

  if (!auth_code || !userId) {
    return res.status(400).send("Missing auth_code or user ID");
  }

  try {
    const token = await exchangeAuthCodeForToken(userId, auth_code);
    res.send(
      "✅ Token received and saved successfully. You can now use the platform."
    );
  } catch (err) {
    res.status(500).send("❌ Token exchange failed: " + err.message);
  }
});

module.exports = router;
