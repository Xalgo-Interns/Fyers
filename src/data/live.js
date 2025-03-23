// data/live.js
const client = require("../auth/auth");

/**
 * Connects to the market data WebSocket and calls the callback for each update
 * @param {Function} callback - Function to handle market data updates
 */
function connectMarketData(callback) {
  client.connectMarketData(callback);
}

/**
 * Subscribes to real-time updates for specific symbols
 * @param {string[]} symbols - Array of symbols to subscribe to
 */
function subscribeSymbols(symbols) {
  client.subscribeSymbols(symbols);
}

module.exports = { connectMarketData, subscribeSymbols };
