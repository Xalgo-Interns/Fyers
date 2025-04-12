// src/data/data.service.js
const { createFyersClient } = require("../auth/fyers-client");
const { findUserById } = require("../users/user.service");

async function getQuotes(userId, symbols) {
  try {
    const user = await findUserById(userId);
    const fyers = createFyersClient(user.fyersAccessToken);
    
    // Using the recommended structure for API calls
    const response = await fyers.getQuotes(symbols);
    
    if (response.s !== 'ok') {
      throw new Error(response.message || "Failed to get quotes");
    }
    
    return response.d;
  } catch (err) {
    console.error("Failed to get quotes:", err);
    throw err;
  }
}

async function getMarketDepth(userId, symbols, ohlcvFlag = 1) {
  try {
    const user = await findUserById(userId);
    const fyers = createFyersClient(user.fyersAccessToken);
    
    // Using the recommended structure for market depth
    const response = await fyers.getMarketDepth({
      "symbol": symbols,
      "ohlcv_flag": ohlcvFlag
    });
    
    if (response.s !== 'ok') {
      throw new Error(response.message || "Failed to get market depth");
    }
    
    return response.d;
  } catch (err) {
    console.error("Failed to get market depth:", err);
    throw err;
  }
}

async function getUserProfile(userId) {
  try {
    const user = await findUserById(userId);
    const fyers = createFyersClient(user.fyersAccessToken);
    
    // Using the recommended structure for profile
    const response = await fyers.get_profile();
    
    if (response.s !== 'ok') {
      throw new Error(response.message || "Failed to get user profile");
    }
    
    return response.data;
  } catch (err) {
    console.error("Failed to get user profile:", err);
    throw err;
  }
}

module.exports = {
  getQuotes,
  getMarketDepth,
  getUserProfile
};