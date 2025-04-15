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
  console.log("LIVE FEED REQUEST RECEIVED:", {
    body: req.body,
    query: req.query,
    user: req.user,
    headers: req.headers,
  });

  try {
    // Get userId from either req.user or query parameter for flexibility
    const userId = req.user?.userId || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error:
          "Missing userId - please provide in query or through authentication",
      });
    }

    const { symbols } = req.body;

    console.log(
      `Processing live feed request for user ${userId} with symbols:`,
      symbols
    );

    // Improved validation
    if (!symbols?.length) {
      return res.status(400).json({
        success: false,
        error: "Please provide symbols to subscribe to",
      });
    }

    // Handle and clean up symbols - ensure each is properly formatted
    const cleanedSymbols = symbols
      .flatMap((symbol) => {
        // If symbol contains commas, split it into individual symbols
        if (typeof symbol === "string" && symbol.includes(",")) {
          return symbol
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s);
        }
        return symbol;
      })
      .filter((s) => s);

    console.log(`Cleaned symbols for subscription:`, cleanedSymbols);

    // Validate symbol format
    const invalidSymbols = cleanedSymbols.filter(
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

    // Find user with more detailed error handling
    let user;
    try {
      user = await findUserById(userId);
      console.log(
        `Found user ${userId} with access token? ${!!user?.fyersAccessToken}`
      );
    } catch (err) {
      console.error(`User lookup error for ${userId}:`, err);
      return res.status(404).json({
        success: false,
        error: `User not found: ${err.message}`,
      });
    }

    if (!user?.fyersAccessToken) {
      return res.status(401).json({
        success: false,
        error: "User not authenticated with Fyers - missing access token",
      });
    }

    // Setup WebSocket monitoring for this user
    setupWebSocketMonitoring(userId);

    // Start the WebSocket connection with cleaned symbols
    console.log(
      `Starting WebSocket for user ${userId} with ${cleanedSymbols.length} symbols`
    );
    const connection = subscribeToLiveData(
      userId,
      user.fyersAccessToken,
      cleanedSymbols
    );

    console.log(`Connection established:`, {
      state: connection.getState(),
      subscribedSymbols: connection.subscribedSymbols,
    });

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
    console.error(
      `Live feed error for user ${req.query.userId || req.user?.userId}:`,
      error
    );
    res.status(500).json({
      success: false,
      error: error.message || "Failed to start live feed",
    });
  }
});

// /**
//  * DELETE /data/live-feed
//  * Stop a live data feed
//  */
// router.delete("/live-feed", async (req, res) => {
//   const { userId } = req.user;
//   const { symbols } = req.body;

//   try {
//     const { activeConnections } = require("./live");

//     // Check if user has an active connection
//     if (!activeConnections.has(userId)) {
//       return res.status(404).json({
//         success: false,
//         error: "No active live feed found for this user",
//       });
//     }

//     const connection = activeConnections.get(userId);

//     if (symbols?.length) {
//       // Handle partial unsubscribe
//       try {
//         const unsubscribedSymbols = symbols.map((symbol) => {
//           connection.socket.unsubscribe([symbol], false);
//           return symbol;
//         });

//         return res.json({
//           success: true,
//           message: "Unsubscribed from specified symbols",
//           data: {
//             unsubscribedSymbols,
//             remainingSymbols: connection.subscribedSymbols.filter(
//               (sym) => !symbols.includes(sym)
//             ),
//           },
//         });
//       } catch (err) {
//         return res.status(400).json({
//           success: false,
//           error: err.message || "Failed to unsubscribe symbols",
//         });
//       }
//     } else {
//       // Handle complete disconnect
//       connection.close();
//       return res.json({
//         success: true,
//         message: "Live feed stopped and cleaned up",
//       });
//     }
//   } catch (error) {
//     console.error(`Error stopping live feed for ${userId}:`, error);
//     res.status(500).json({
//       success: false,
//       error: "Internal server error while stopping live feed",
//     });
//   }
// });

/**
 * DELETE /data/live-feed
 * Stop a live data feed
 */
router.delete("/live-feed", async (req, res) => {
  const { userId } = req.user;
  const { symbols } = req.body;

  try {
    const { activeConnections } = require("./live");

    // Check if user has an active connection
    if (!activeConnections.has(userId)) {
      return res.status(404).json({
        success: false,
        error: "No active live feed found for this user",
      });
    }

    const connection = activeConnections.get(userId);

    if (symbols?.length) {
      // Handle partial unsubscribe using the removeSymbols helper,
      // which unsubscribes and updates the internal list.
      try {
        const remainingSymbols = connection.removeSymbols(symbols);

        return res.json({
          success: true,
          message: "Unsubscribed from specified symbols",
          data: {
            unsubscribedSymbols: symbols,
            remainingSymbols,
          },
        });
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: err.message || "Failed to unsubscribe symbols",
        });
      }
    } else {
      // Handle complete disconnect
      connection.close();
      return res.json({
        success: true,
        message: "Live feed stopped and cleaned up",
      });
    }
  } catch (error) {
    console.error(`Error stopping live feed for ${userId}:`, error);
    res.status(500).json({
      success: false,
      error: "Internal server error while stopping live feed",
    });
  }
});

/**
 * GET /data/stream
 * Stream live market data using Server-Sent Events
 */
router.get("/stream", (req, res) => {
  const { userId } = req.query;
  console.log(`Stream connection request for user ${userId}`);

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: "Missing userId parameter",
    });
  }

  // Set headers for SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Disable proxy buffering for Nginx
  });

  // Send initial connection message with timestamp
  const timestamp = new Date().toISOString();
  console.log(`SSE connection established for ${userId} at ${timestamp}`);
  res.write(
    `data: {"type":"connection","status":"connected","timestamp":"${timestamp}"}\n\n`
  );

  // Setup event listener for this user's market data
  const onMarketUpdate = (data) => {
    try {
      console.log(
        `SSE sending data for ${userId}:`,
        data?.symbol
          ? `${data.symbol} @ ${data.ltp || "N/A"}`
          : "No symbol data"
      );

      // Make sure we have valid data to send
      if (!data) {
        console.warn(`Attempted to send invalid data for ${userId}`);
        return;
      }

      // Add a timestamp if not present
      if (!data.timestamp) {
        data.timestamp = new Date().toISOString();
      }

      // Send the data as SSE
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error(`Error sending SSE data for ${userId}:`, error);
    }
  };

  // Listen for heartbeats as well
  const onHeartbeat = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Subscribe to market data and heartbeat events
  marketDataEvents.on(`${userId}:all`, onMarketUpdate);
  marketDataEvents.on(`${userId}:heartbeat`, onHeartbeat);

  // Send a periodic heartbeat to keep the connection alive (more frequent)
  const heartbeatInterval = setInterval(() => {
    try {
      const heartbeatData = {
        type: "heartbeat",
        timestamp: new Date().toISOString(),
      };
      res.write(`data: ${JSON.stringify(heartbeatData)}\n\n`);
    } catch (err) {
      console.error(`Error sending heartbeat to ${userId}:`, err);
    }
  }, 15000); // Every 15 seconds

  // Cleanup on client disconnect
  req.on("close", () => {
    console.log(`SSE connection closed for ${userId}`);
    clearInterval(heartbeatInterval);
    marketDataEvents.removeListener(`${userId}:all`, onMarketUpdate);
    marketDataEvents.removeListener(`${userId}:heartbeat`, onHeartbeat);
  });
});

module.exports = router;
