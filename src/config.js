// config.js
require("dotenv").config();

const config = {
  appId: process.env.FYERS_APP_ID,
  accessToken: process.env.FYERS_ACCESS_TOKEN,
};

module.exports = config;
