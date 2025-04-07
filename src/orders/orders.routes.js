// src/orders/orders.routes.js
const express = require("express");
const router = express.Router();
const { placeOrder } = require("./orders");

/**
 * POST /orders/place
 * {
 *   "userId": "abc123",
 *   "symbol": "NSE:SBIN-EQ",
 *   "qty": 15,
 *   "side": 1
 * }
 */
router.post("/place", async (req, res) => {
  const { userId, ...orderPayload } = req.body;

  if (
    !userId ||
    !orderPayload.symbol ||
    !orderPayload.qty ||
    !orderPayload.side
  ) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required order fields" });
  }

  try {
    const result = await placeOrder(userId, orderPayload);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("❌ Order error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
