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
 * @returns {Promise<Object>} - Historical data object with candles
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

  // Normalize resolution format
  // If 'D' or '1D' is passed, use 'D' as required by Fyers API
  const normalizedResolution = resolution.endsWith("D") ? "D" : resolution;

  console.log(
    `Fetching historical data for ${symbol} from ${fromDate} to ${toDate}`
  );

  // According to the error message, when date_format is 1,
  // the Fyers API expects dates in YYYY-MM-DD format, not timestamps
  const historyParams = {
    symbol,
    resolution: normalizedResolution,
    date_format: "1",
    range_from: fromDate, // Use the YYYY-MM-DD format directly
    range_to: toDate, // Use the YYYY-MM-DD format directly
    cont_flag: "1", // Continuous data
  };

  try {
    console.log("Sending request with params:", JSON.stringify(historyParams));
    const result = await fyers.getHistory(historyParams);

    if (!result || result.s !== "ok") {
      throw new Error(result?.message || "Failed to fetch historical data");
    }

    // Format the data for easier consumption
    return {
      candles: result.candles,
      symbol: symbol,
      resolution: normalizedResolution,
    };
  } catch (err) {
    console.error("Historical data fetch error details:", err);
    throw new Error(`Failed to fetch historical data: ${err.message}`);
  }
}

module.exports = { fetchHistoricalData };
