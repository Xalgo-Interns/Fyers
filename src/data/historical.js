// src/data/historical.js
const { createFyersClient } = require("../auth/fyers-client");
const { findUserById } = require("../users/user.service");

async function fetchHistoricalData(
  userId,
  symbol,
  resolution,
  fromDate,
  toDate
) {
  const user = await findUserById(userId);
  const fyers = createFyersClient(
    process.env.FYERS_APP_ID,
    user.fyersAccessToken
  );

  const fromTimestamp = Math.floor(new Date(fromDate).getTime() / 1000);
  const toTimestamp = Math.floor(new Date(toDate).getTime() / 1000);

  const options = {
    symbol,
    resolution,
    date_format: "1", // UNIX timestamp
    range_from: fromTimestamp,
    range_to: toTimestamp,
    cont_flag: "1", // Continuous data for futures
  };

  const result = await fyers.getHistory(options);
  if (result.s !== "ok") {
    throw new Error(result.message || "Failed to fetch historical data");
  }

  return result.candles;
}

module.exports = { fetchHistoricalData };
