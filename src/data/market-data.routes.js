const express = require("express");
const router = express.Router();
const socketManager = require("./socket-manager");
const { findUserById } = require("../users/user.service");

// POST /monitor-ltp - For regular market data
router.post("/monitor-ltp", async (req, res) => {
  try {
    const { userId } = req.user;
    const { symbols, enableDepth = false } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({
        success: false,
        error: "Please provide an array of symbols",
      });
    }

    // Validate that none are index symbols
    if (symbols.some((s) => s.endsWith("-INDEX"))) {
      return res.status(400).json({
        success: false,
        error: "Please use /monitor-indices for index symbols",
      });
    }

    const user = await findUserById(userId);
    const connection = socketManager.createSocket(
      userId,
      user.fyersAccessToken
    );

    // Subscribe with lite mode for regular symbols
    socketManager.subscribeToSymbols(userId, symbols, enableDepth, false);

    res.json({
      success: true,
      message: `Started monitoring ${
        enableDepth ? "market depth" : "LTP"
      } data`,
      data: { symbols },
    });
  } catch (error) {
    console.error("Monitor LTP error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /monitor-indices - For index data only
router.post("/monitor-indices", async (req, res) => {
  try {
    const { userId } = req.user;
    const { indices } = req.body;

    if (!indices || !Array.isArray(indices)) {
      return res.status(400).json({
        success: false,
        error: "Please provide an array of index symbols",
      });
    }

    // Validate index symbols
    const validIndices = indices.every(
      (symbol) => symbol.endsWith("-INDEX") && symbol.includes(":")
    );

    if (!validIndices) {
      return res.status(400).json({
        success: false,
        error: "Invalid index format. Use format: NSE:NIFTY50-INDEX",
      });
    }

    const user = await findUserById(userId);
    const connection = socketManager.createSocket(
      userId,
      user.fyersAccessToken
    );

    // Subscribe to indices with isIndex flag
    socketManager.subscribeToSymbols(userId, indices, false, true);

    res.json({
      success: true,
      message: "Started monitoring indices",
      data: { indices },
    });
  } catch (error) {
    console.error("Monitor indices error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /stream/ltp
router.get("/stream/ltp", async (req, res) => {
  const { userId } = req.user;

  // Set headers for SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Listen for raw messages for debugging
  const onRawData = (data) => {
    console.log(`[${userId}] Raw socket data:`, data);
  };

  const onData = (data) => {
    if (data.type === "sf") {
      const liteData = {
        symbol: data.symbol,
        ltp: data.ltp,
        type: "sf",
        timestamp: new Date().toISOString(),
      };
      console.log(`[${userId}] Sending LTP update:`, liteData);
      res.write(`data: ${JSON.stringify(liteData)}\n\n`);
    }
  };

  socketManager.events.on(`${userId}:raw`, onRawData);
  socketManager.events.on(`${userId}:data`, onData);

  // Cleanup on disconnect
  req.on("close", () => {
    socketManager.events.removeListener(`${userId}:raw`, onRawData);
    socketManager.events.removeListener(`${userId}:data`, onData);
  });
});

// GET /stream/index
router.get("/stream/index", async (req, res) => {
  const { userId } = req.user;

  // Set headers for SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const onData = (data) => {
    if (data.type === "if") {
      // Index feed data
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  socketManager.events.on(`${userId}:data`, onData);

  // Cleanup on disconnect
  req.on("close", () => {
    socketManager.events.removeListener(`${userId}:data`, onData);
  });
});

module.exports = router;
