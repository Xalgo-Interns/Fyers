const express = require("express");
const router = express.Router();
const { fetchHistoricalData } = require("./historical");
const { getQuotes, getMarketDepth, getUserProfile } = require("./data.service");
const {
  subscribeToLiveData,
  marketDataEvents,
  CONNECTION_STATES,
} = require("./live");
const { findUserById } = require("../users/user.service");

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
 * POST /data/live-feed
 * Start a live data feed for specified symbols
 */
router.post("/live-feed", async (req, res) => {
  try {
    const { userId } = req.user;
    const { symbols } = req.body;

    // Improved validation
    if (!symbols?.length) {
      return res.status(400).json({
        success: false,
        error: "Please provide symbols to subscribe to",
      });
    }

    // Validate symbol format
    const invalidSymbols = symbols.filter(
      (s) => !s.includes(":") || !s.endsWith("-EQ")
    );
    if (invalidSymbols.length) {
      return res.status(400).json({
        success: false,
        error: `Invalid symbol format: ${invalidSymbols.join(
          ", "
        )}. Expected format: NSE:SYMBOL-EQ`,
      });
    }

    const user = await findUserById(userId);
    if (!user?.fyersAccessToken) {
      return res.status(401).json({
        success: false,
        error: "User not authenticated with Fyers",
      });
    }

    // Setup WebSocket monitoring for this user
    setupWebSocketMonitoring(userId);

    // Start the WebSocket connection
    const connection = subscribeToLiveData(
      userId,
      user.fyersAccessToken,
      symbols
    );

    // Return detailed connection info
    res.json({
      success: true,
      message: "Live feed started",
      data: {
        subscribedSymbols: connection.subscribedSymbols,
        connectionState: connection.getState(),
        userId: userId,
      },
    });
  } catch (error) {
    console.error(`Live feed error for user ${req.user?.userId}:`, error);
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
  const { userId } = req.user;
  const { symbols } = req.body;

  try {
    const activeConnections = require("./live").getActiveConnections();

    if (!activeConnections.includes(userId)) {
      return res.status(404).json({
        success: false,
        error: "No active live feed found",
      });
    }

    const connection = require("./live").activeConnections.get(userId);

    if (symbols?.length) {
      // Validate symbols before unsubscribing
      const invalidSymbols = symbols.filter(
        (s) => !connection.subscribedSymbols.includes(s)
      );
      if (invalidSymbols.length) {
        return res.status(400).json({
          success: false,
          error: `Not subscribed to symbols: ${invalidSymbols.join(", ")}`,
        });
      }

      connection.removeSymbols(symbols);
      res.json({
        success: true,
        message: "Unsubscribed from specified symbols",
        data: {
          removedSymbols: symbols,
          remainingSymbols: connection.subscribedSymbols,
          connectionState: connection.getState(),
        },
      });
    } else {
      connection.close();
      // Remove all event listeners
      marketDataEvents.removeAllListeners(`${userId}:state`);
      marketDataEvents.removeAllListeners(`${userId}:error`);
      marketDataEvents.removeAllListeners(`${userId}:disconnected`);
      marketDataEvents.removeAllListeners(`${userId}:max_retries_reached`);

      res.json({
        success: true,
        message: "Live feed stopped and cleaned up",
      });
    }
  } catch (error) {
    console.error(`Error stopping live feed for ${userId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to stop live feed",
    });
  }
});

module.exports = router;
