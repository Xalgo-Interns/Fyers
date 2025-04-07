// src/data/data.routes.js
const express = require("express");
const router = express.Router();
const { fetchHistoricalData } = require("./historical");

/**
 * GET /data/historical?userId=abc123&symbol=NSE:SBIN-EQ&resolution=1D&fromDate=2024-04-01&toDate=2024-04-05
 */
router.get("/historical", async (req, res) => {
  const { userId, symbol, resolution, fromDate, toDate } = req.query;

  if (!userId || !symbol || !resolution || !fromDate || !toDate) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required parameters" });
  }

  try {
    const data = await fetchHistoricalData(
      userId,
      symbol,
      resolution,
      fromDate,
      toDate
    );
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Historical data error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
