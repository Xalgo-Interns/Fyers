// auth/auth.js
const { fyersModel } = require("fyers-api-v3");
const config = require("../config");

/**
 * Initializes the FYERS API client
 * @type {fyersModel}
 */
const client = new fyersModel({
  path: "./logs", // Path where you want to save logs
  enableLogging: true,
});

// Set the app ID first
client.setAppId(config.appId);

// Set access token without app ID prefix since it might be included already
client.setAccessToken(config.accessToken);

// Enable auto-reconnect with 6 retries
client.autoReconnect(6);

module.exports = client;
