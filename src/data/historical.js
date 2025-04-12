const { createFyersClient } = require("../auth/fyers-client");
const { findUserById } = require("../users/user.service");
const config = require("../config");

/**
 * Fetch historical data from Fyers API
 * @param {string} userId - User ID to use for authentication
 * @param {string} symbol - Symbol to fetch (e.g. "NSE:SBIN-EQ")
 * @param {string} resolution - Candle resolution (e.g. "1", "5", "D" for day)
 * @param {string} fromDate - Start date in YYYY-MM-DD format
 * @param {string} toDate - End date in YYYY-MM-DD format
 * @returns {Promise<Array>} - Array of OHLCV candles
 */
async function fetchHistoricalData(
  userId,
  symbol,
  resolution,
  fromDate,
  toDate
) {
  const user = await findUserById(userId);
  if (!user.fyersAccessToken) {
    throw new Error("User not authenticated with Fyers");
  }

  const fyers = createFyersClient(user.fyersAccessToken);

  // Convert dates to UNIX timestamps
  const fromTimestamp = Math.floor(new Date(fromDate).getTime() / 1000);
  const toTimestamp = Math.floor(new Date(toDate).getTime() / 1000);

  // Prepare parameters according to V3 API documentation
  const historyParams = {
    symbol,
    resolution,
    date_format: "1", // UNIX timestamp
    range_from: fromTimestamp,
    range_to: toTimestamp,
    cont_flag: "1", // Continuous data
  };

  try {
    const result = await fyers.getHistory(historyParams);

    if (result.s !== "ok") {
      throw new Error(result.message || "Failed to fetch historical data");
    }

    // Format the data for easier consumption
    return {
      candles: result.candles,
      symbol: result.symbol,
      resolution: result.resolution,
    };
  } catch (err) {
    console.error("Historical data fetch error:", err);
    throw new Error(`Failed to fetch historical data: ${err.message}`);
  }
}

module.exports = { fetchHistoricalData };
