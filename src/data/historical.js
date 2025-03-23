// data/historical.js
const client = require("../auth/auth");

/**
 * Fetches historical candle data for a given symbol
 * @param {string} symbol - The symbol to fetch data for (e.g., 'NSE:TATAMOTORS-EQ')
 * @param {string} resolution - The time resolution (e.g., '1' for 1-minute candles)
 * @param {string} fromDate - Start date in 'YYYY-MM-DD' format
 * @param {string} toDate - End date in 'YYYY-MM-DD' format
 * @returns {Promise<Object>} - Historical data
 */
async function getHistoricalData(symbol, resolution, fromDate, toDate) {
  try {
    // Convert dates to UNIX timestamp (seconds)
    const fromTimestamp = Math.floor(new Date(fromDate).getTime() / 1000);
    const toTimestamp = Math.floor(new Date(toDate).getTime() / 1000);

    const options = {
      symbol,
      resolution,
      date_format: "1", // 1 for UNIX timestamp
      range_from: fromTimestamp,
      range_to: toTimestamp,
      cont_flag: "1", // For continuous data
    };

    const data = await client.getHistory(options);
    return data;
  } catch (error) {
    console.error("Error fetching historical data:", error);
    throw error;
  }
}

module.exports = { getHistoricalData };
