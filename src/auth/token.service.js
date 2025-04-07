// src/auth/token.service.js
const { fyersModel } = require("fyers-api-v3");
const User = require("../users/user.model");
const config = require("../config");

const fyers = new fyersModel({});

async function exchangeAuthCodeForToken(userId, authCode) {
  try {
    const response = await fyers.generate_access_token({
      client_id: config.fyersAppId,
      secret_key: config.fyersSecretKey,
      auth_code: authCode,
    });

    if (response.s !== "ok") throw new Error(response.message);

    const accessToken = response.access_token;

    // Save token to user's record in DB
    await User.findByIdAndUpdate(userId, {
      fyersAccessToken: accessToken,
      fyersAuthCode: authCode,
      broker: "fyers",
      lastTokenRefresh: new Date(),
    });

    return accessToken;
  } catch (err) {
    console.error("❌ Token exchange error:", err.message);
    throw new Error("Failed to generate access token");
  }
}

module.exports = { exchangeAuthCodeForToken };
