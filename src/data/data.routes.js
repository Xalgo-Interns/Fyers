const express = require("express");
const router = express.Router();
const { fetchHistoricalData } = require("./historical");
const { getQuotes, getMarketDepth, getUserProfile } = require("./data.service");

// Setup WebSocket monitoring
function setupWebSocketMonitoring(userId) {
  // Monitor connection state changes
  marketDataEvents.on(`${userId}:state`, (state) => {
    console.log(`WebSocket state for ${userId}:`, state);
    if (state === CONNECTION_STATES.ERROR) {
      console.error(`Critical: WebSocket error state for user ${userId}`);
    }
  });

  // Monitor errors
  marketDataEvents.on(`${userId}:error`, (error) => {
    console.error(`WebSocket error for ${userId}:`, error);
  });

  // Monitor disconnections
  marketDataEvents.on(`${userId}:disconnected`, () => {
    console.log(`WebSocket disconnected for ${userId}`);
  });

  // Monitor max retries reached
  marketDataEvents.on(`${userId}:max_retries_reached`, () => {
    console.error(`WebSocket max retries reached for ${userId}`);
  });
}

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
 * GET /data/debug
 * Debug route to check subscription status and active connections
 */
router.get("/debug", async (req, res) => {
  try {
    const { userId } = req.query;
    const { activeConnections } = require("./live");

    if (userId) {
      // Check specific user
      const connection = activeConnections.get(userId);
      if (!connection) {
        return res.json({
          success: false,
          message: "No active connection for this user",
          userId,
        });
      }

      return res.json({
        success: true,
        data: {
          userId,
          connectionState: connection.getState(),
          subscribedSymbols: connection.subscribedSymbols,
          activeConnection: true,
        },
      });
    } else {
      // List all active connections
      const connections = [];
      for (const [userId, conn] of activeConnections.entries()) {
        connections.push({
          userId,
          state: conn.getState(),
          symbolCount: conn.subscribedSymbols.length,
          symbols: conn.subscribedSymbols,
        });
      }

      return res.json({
        success: true,
        activeConnectionsCount: activeConnections.size,
        connections,
      });
    }
  } catch (error) {
    console.error("Debug route error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
