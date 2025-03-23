// index.js
const express = require("express");
const historical = require("./data/historical");
const live = require("./data/live");
const orders = require("./orders/orders");
const dotenv = require("dotenv");

dotenv.config();

console.log(process.env.FYERS_APP_ID);
console.log(process.env.FYERS_ACCESS_TOKEN);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON requests
app.use(express.json());

// --- Routes ---

// GET / - Root route to check server status
app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "FYERS API server is running",
    timestamp: new Date().toISOString(),
  });
});

// GET /historical - Fetch historical market data
app.get("/historical", async (req, res) => {
  const { symbol, resolution, fromDate, toDate } = req.query;
  if (!symbol || !resolution || !fromDate || !toDate) {
    return res.status(400).json({ error: "Missing required query parameters" });
  }

  try {
    const data = await historical.getHistoricalData(
      symbol,
      resolution,
      fromDate,
      toDate
    );
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /live/subscribe - Subscribe to real-time market data
app.post("/live/subscribe", (req, res) => {
  const { symbols } = req.body;
  if (!Array.isArray(symbols) || symbols.length === 0) {
    return res.status(400).json({ error: "Symbols must be a non-empty array" });
  }

  try {
    live.subscribeSymbols(symbols);
    live.connectMarketData((data) => {
      console.log("Market Data Update:", data); // Placeholder for real-time handling
    });
    res.json({
      success: true,
      message: `Subscribed to ${symbols.length} symbols`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /orders/place - Place a new order
app.post("/orders/place", async (req, res) => {
  const order = req.body;
  if (!order.symbol || !order.quantity || !order.type) {
    return res.status(400).json({ error: "Missing required order fields" });
  }

  try {
    const result = await orders.placeOrder(order);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /orders/modify/:orderId - Modify an existing order
app.put("/orders/modify/:orderId", async (req, res) => {
  const { orderId } = req.params;
  const modifications = req.body;

  if (!orderId || Object.keys(modifications).length === 0) {
    return res
      .status(400)
      .json({ error: "Order ID and modifications are required" });
  }

  try {
    const result = await orders.modifyOrder(orderId, modifications);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /orders/cancel/:orderId - Cancel an existing order
app.delete("/orders/cancel/:orderId", async (req, res) => {
  const { orderId } = req.params;
  if (!orderId) {
    return res.status(400).json({ error: "Order ID is required" });
  }

  try {
    const result = await orders.cancelOrder(orderId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export original modules for non-HTTP use
module.exports = {
  historical,
  live,
  orders,
};
