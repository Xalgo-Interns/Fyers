// src/config.js
require("dotenv").config();

module.exports = {
  port: process.env.PORT || 4001,
  mongoUri: process.env.MONGO_URI,
  fyersAppId: process.env.FYERS_APP_ID,
  fyersSecretKey: process.env.FYERS_SECRET_KEY,
  fyersRedirectUri: process.env.FYERS_REDIRECT_URI,
};
