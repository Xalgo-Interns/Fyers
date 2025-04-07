// src/orders/orders.js
const { createFyersClient } = require("../auth/fyers-client");
const { findUserById } = require("../users/user.service");

async function placeOrder(userId, orderPayload) {
  const user = await findUserById(userId);
  const fyers = createFyersClient(
    process.env.FYERS_APP_ID,
    user.fyersAccessToken
  );

  const payload = {
    symbol: orderPayload.symbol, // e.g., NSE:SBIN-EQ
    qty: orderPayload.qty, // e.g., 15
    type: orderPayload.type || 2, // 2 = Market Order
    side: orderPayload.side, // 1 = Buy, -1 = Sell
    productType: orderPayload.productType || "INTRADAY",
    limitPrice: orderPayload.limitPrice || 0,
    stopPrice: orderPayload.stopPrice || 0,
    disclosedQty: 0,
    validity: "DAY",
    offlineOrder: "False",
    stopLoss: orderPayload.stopLoss || 0,
    takeProfit: orderPayload.takeProfit || 0,
  };

  const response = await fyers.placeOrder(payload);

  if (response.s !== "ok") {
    throw new Error(response.message || "Order failed");
  }

  return response;
}

module.exports = { placeOrder };
