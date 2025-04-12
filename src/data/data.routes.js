// src/data/data.routes.js
const express = require("express");
const router = express.Router();
const { fetchHistoricalData } = require("./historical");
const { getQuotes, getMarketDepth, getUserProfile } = require("./data.service");
const { subscribeToLiveData } = require("./live");
const { findUserById } = require("../users/user.service");

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

/**
 * GET /data/quotes?symbols[]=NSE:SBIN-EQ&symbols[]=NSE:TCS-EQ
 * Get real-time quotes for specified symbols
 */
router.get("/quotes", async (req, res) => {
  try {
    const { userId } = req.user; // Assuming user is authenticated and available in req.user
    const { symbols } = req.query;

    if (!symbols || !symbols.length) {
      return res.status(400).json({
        success: false,
        error: "Please provide at least one symbol",
      });
    }

    // Convert to array if single string is passed
    const symbolsArray = Array.isArray(symbols) ? symbols : [symbols];

    const quotes = await getQuotes(userId, symbolsArray);

    res.json({
      success: true,
      data: quotes,
    });
  } catch (error) {
    console.error("Error fetching quotes:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch quotes",
    });
  }
});

/**
 * GET /data/market-depth?symbols[]=NSE:SBIN-EQ&symbols[]=NSE:TCS-EQ&ohlcvFlag=1
 * Get market depth data for specified symbols
 */
router.get("/market-depth", async (req, res) => {
  try {
    const { userId } = req.user; // Assuming user is authenticated
    const { symbols, ohlcvFlag = 1 } = req.query;

    if (!symbols || !symbols.length) {
      return res.status(400).json({
        success: false,
        error: "Please provide at least one symbol",
      });
    }

    // Convert to array if single string is passed
    const symbolsArray = Array.isArray(symbols) ? symbols : [symbols];

    const marketDepth = await getMarketDepth(
      userId,
      symbolsArray,
      parseInt(ohlcvFlag)
    );

    res.json({
      success: true,
      data: marketDepth,
    });
  } catch (error) {
    console.error("Error fetching market depth:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch market depth",
    });
  }
});

/**
 * GET /data/profile
 * Get user's Fyers profile information
 */
router.get("/profile", async (req, res) => {
  try {
    const { userId } = req.user; // Assuming user is authenticated

    const profileData = await getUserProfile(userId);

    res.json({
      success: true,
      data: profileData,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch user profile",
    });
  }
});

/**
 * POST /data/live-feed
 * Start a live data feed for specified symbols
 */
router.post("/live-feed", async (req, res) => {
  try {
    const { userId } = req.user; // Assuming authentication middleware
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please provide an array of symbols to subscribe to",
      });
    }

    // Get the user to retrieve their access token
    const user = await findUserById(userId);
    if (!user.fyersAccessToken) {
      return res.status(401).json({
        success: false,
        error: "User not authenticated with Fyers",
      });
    }

    // Start the WebSocket connection and subscribe to the symbols
    const connection = subscribeToLiveData(
      userId,
      user.fyersAccessToken,
      symbols
    );

    res.json({
      success: true,
      message: "Live feed started",
      subscribedSymbols: connection.subscribedSymbols,
    });
  } catch (error) {
    console.error("Error starting live feed:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to start live feed",
    });
  }
});

/**
 * DELETE /data/live-feed
 * Stop a live data feed
 */
router.delete("/live-feed", async (req, res) => {
  try {
    const { userId } = req.user; // Assuming authentication middleware
    const { symbols } = req.body;

    // Get all active connections
    const activeConnections = require("./live").getActiveConnections();

    // Check if user has an active connection
    if (!activeConnections.includes(userId)) {
      return res.status(404).json({
        success: false,
        error: "No active live feed found for this user",
      });
    }

    // Get the connection
    const connections = require("./live").activeConnections;
    const connection = connections.get(userId);

    if (symbols && Array.isArray(symbols) && symbols.length > 0) {
      // Only unsubscribe from specific symbols
      connection.removeSymbols(symbols);
      res.json({
        success: true,
        message: "Unsubscribed from specified symbols",
        remainingSymbols: connection.subscribedSymbols,
      });
    } else {
      // Close the entire connection
      connection.close();
      res.json({
        success: true,
        message: "Live feed stopped",
      });
    }
  } catch (error) {
    console.error("Error stopping live feed:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to stop live feed",
    });
  }
});

module.exports = router;
