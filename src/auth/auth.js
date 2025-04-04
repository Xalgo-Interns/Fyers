// auth/auth.js
const { fyersModel } = require("fyers-api-v3");
const config = require("../config");

if (!config.appId || !config.accessToken) {
  throw new Error(
    "FYERS_APP_ID and FYERS_ACCESS_TOKEN must be provided in .env file"
  );
}

/**
 * Initializes the FYERS API client
 * @type {fyersModel}
 */
const client = new fyersModel({
  path: "./logs", // Path where you want to save logs
  enableLogging: true,
});

try {
  // Set the app ID first
  client.setAppId(config.appId);

  // Set access token without app ID prefix since it might be included already
  client.setAccessToken(config.accessToken);

  console.log("FYERS API client initialized successfully");
} catch (error) {
  console.error("Error initializing FYERS API client:", error);
  throw error;
}

module.exports = client;
