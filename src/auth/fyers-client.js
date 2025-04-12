// src/auth/fyers-client.js
const { fyersModel, fyersDataSocket } = require("fyers-api-v3");
const config = require("../config");

function createFyersClient(accessToken) {
  // Create a new fyers instance with logging enabled
  const fyers = new fyersModel({
    path: config.logPath || "./logs",
    enableLogging: true,
  });

  // Set app ID and access token
  const appId = config.fyersAppId;
  fyers.setAppId(appId);
  fyers.setAccessToken(accessToken);

  return fyers;
}

function createWebSocket(accessToken) {
  const appId = config.fyersAppId;
  // Create a new websocket connection with the format appId:accessToken
  const socket = new fyersDataSocket(
    `${appId}:${accessToken}`,
    config.logPath || "./logs",
    true
  );
  return socket;
}

module.exports = { createFyersClient, createWebSocket };
