// src/auth/fyers-client.js
const { fyersModel } = require("fyers-api-v3");

function createFyersClient(appId, accessToken) {
  const client = new fyersModel({
    path: "./logs",
    enableLogging: true,
  });

  client.setAppId(appId);

  const token = accessToken.startsWith(appId + ":")
    ? accessToken
    : `${appId}:${accessToken}`;

  client.setAccessToken(token);

  return client;
}

module.exports = { createFyersClient };
