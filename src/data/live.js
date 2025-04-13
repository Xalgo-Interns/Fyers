const { createWebSocket } = require("../auth/fyers-client");
const { EventEmitter } = require("events");

// Create a global event emitter for data updates
const marketDataEvents = new EventEmitter();
// Store active websocket connections by user
const activeConnections = new Map();

// Add connection state constants
const CONNECTION_STATES = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  ERROR: "error",
};

// Add rate limiting config
const RATE_LIMIT = {
  MAX_SYMBOLS_PER_REQUEST: 100,
  RECONNECT_DELAY: 5000,
  MAX_RECONNECT_ATTEMPTS: 3,
};

/**
 * Validates input parameters for subscription
 * @private
 */
function validateSubscriptionParams(userId, accessToken, symbols) {
  if (!userId || typeof userId !== "string") {
    throw new Error("Invalid userId provided");
  }
  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("Invalid accessToken provided");
  }
  if (!Array.isArray(symbols)) {
    throw new Error("Symbols must be an array");
  }
  if (symbols.length > RATE_LIMIT.MAX_SYMBOLS_PER_REQUEST) {
    throw new Error(
      `Cannot subscribe to more than ${RATE_LIMIT.MAX_SYMBOLS_PER_REQUEST} symbols at once`
    );
  }
  if (symbols.some((s) => typeof s !== "string")) {
    throw new Error("All symbols must be strings");
  }
}

function subscribeToLiveData(userId, accessToken, symbols, callback = null) {
  try {
    // Validate input parameters
    validateSubscriptionParams(userId, accessToken, symbols);

    // Close existing connection for this user if it exists
    if (activeConnections.has(userId)) {
      const existing = activeConnections.get(userId);
      existing.socket.close();
      console.log(`Closed existing connection for user ${userId}`);
    }

    // Create a new websocket connection
    const socket = createWebSocket(accessToken);
    let connectionState = CONNECTION_STATES.DISCONNECTED;
    let reconnectAttempts = 0;
    let subscribedSymbols = [];
    let heartbeatInterval;

    // Create connection state tracker
    const updateConnectionState = (newState) => {
      connectionState = newState;
      console.log(
        `WebSocket state changed for user ${userId}: ${connectionState}`
      );
      marketDataEvents.emit(`${userId}:state`, connectionState);
    };

    // Setup heartbeat check
    const setupHeartbeat = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(() => {
        if (connectionState === CONNECTION_STATES.CONNECTED) {
          socket.send("ping");
        }
      }, 30000); // 30 second heartbeat
    };

    // Setup event handlers with improved error handling
    socket.on("connect", () => {
      updateConnectionState(CONNECTION_STATES.CONNECTED);
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection

      try {
        // Subscribe to symbols
        if (symbols?.length > 0) {
          socket.subscribe(symbols);
          subscribedSymbols = [...symbols];
          console.log(
            `Subscribed to symbols for ${userId}:`,
            symbols.join(", ")
          );
        }

        setupHeartbeat();
      } catch (err) {
        console.error(`Failed to subscribe to symbols for ${userId}:`, err);
        marketDataEvents.emit(`${userId}:error`, err);
      }
    });

    socket.on("message", (message) => {
      // Process and emit the market data
      console.log(`📡 Live data update for user ${userId}`);

      // Emit on the global event emitter with user ID and symbol as the event
      if (message && message.symbol) {
        const eventName = `${userId}:${message.symbol}`;
        marketDataEvents.emit(eventName, message);
        marketDataEvents.emit(`${userId}:all`, message);
      }

      // Call the callback if provided
      if (callback && typeof callback === "function") {
        callback(message);
      }
    });

    socket.on("error", (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
      updateConnectionState(CONNECTION_STATES.ERROR);
      marketDataEvents.emit(`${userId}:error`, error);

      // Implement exponential backoff for reconnection
      if (reconnectAttempts < RATE_LIMIT.MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        reconnectAttempts++;

        setTimeout(() => {
          if (connectionState !== CONNECTION_STATES.CONNECTED) {
            console.log(
              `Attempting reconnect ${reconnectAttempts} for user ${userId}`
            );
            updateConnectionState(CONNECTION_STATES.RECONNECTING);
            socket.connect();
          }
        }, delay);
      } else {
        console.error(`Max reconnection attempts reached for user ${userId}`);
        marketDataEvents.emit(`${userId}:max_retries_reached`);
      }
    });

    socket.on("close", () => {
      updateConnectionState(CONNECTION_STATES.DISCONNECTED);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      marketDataEvents.emit(`${userId}:disconnected`);
    });

    // Create enhanced connection object with state info
    const connection = {
      socket,
      userId,
      subscribedSymbols,
      connectionState,

      getState: () => connectionState,

      addSymbols: (newSymbols) => {
        try {
          if (!Array.isArray(newSymbols)) newSymbols = [newSymbols];

          // Validate new subscription count
          if (
            subscribedSymbols.length + newSymbols.length >
            RATE_LIMIT.MAX_SYMBOLS_PER_REQUEST
          ) {
            throw new Error(
              `Cannot subscribe to more than ${RATE_LIMIT.MAX_SYMBOLS_PER_REQUEST} symbols`
            );
          }

          if (connectionState === CONNECTION_STATES.CONNECTED) {
            socket.subscribe(newSymbols);
            subscribedSymbols = [...subscribedSymbols, ...newSymbols];
            console.log(
              `Added subscription for ${userId}:`,
              newSymbols.join(", ")
            );
            return subscribedSymbols;
          } else {
            throw new Error(`Cannot add symbols in ${connectionState} state`);
          }
        } catch (err) {
          console.error(`Failed to add symbols for ${userId}:`, err);
          throw err;
        }
      },

      // Function to remove symbols from subscription
      removeSymbols: (symbolsToRemove) => {
        if (!Array.isArray(symbolsToRemove))
          symbolsToRemove = [symbolsToRemove];
        if (connectionState === CONNECTION_STATES.CONNECTED && socket) {
          socket.unsubscribe(symbolsToRemove);
          subscribedSymbols = subscribedSymbols.filter(
            (sym) => !symbolsToRemove.includes(sym)
          );
          console.log(
            `Removed subscription from: ${symbolsToRemove.join(", ")}`
          );
        }
        return subscribedSymbols;
      },

      close: () => {
        try {
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          if (socket) {
            socket.close();
            activeConnections.delete(userId);
            updateConnectionState(CONNECTION_STATES.DISCONNECTED);
            console.log(`Connection closed for user ${userId}`);
          }
        } catch (err) {
          console.error(`Error closing connection for ${userId}:`, err);
          throw err;
        }
      },
    };

    // Connect to the websocket
    updateConnectionState(CONNECTION_STATES.CONNECTING);
    socket.connect();

    // Store the connection
    activeConnections.set(userId, connection);

    return connection;
  } catch (error) {
    console.error(
      `Failed to setup live data subscription for ${userId}:`,
      error
    );
    throw error;
  }
}

/**
 * Listen for market data updates for specific symbols
 * @param {string} userId - User ID
 * @param {string|Array<string>} symbols - Symbol or array of symbols to listen for
 * @param {Function} listener - Callback function for data updates
 * @returns {Function} - Function to remove the listener
 */
function onMarketData(userId, symbols, listener) {
  if (!Array.isArray(symbols)) symbols = [symbols];

  const eventHandlers = [];

  // Add listeners for each symbol
  symbols.forEach((symbol) => {
    const eventName = `${userId}:${symbol}`;
    marketDataEvents.on(eventName, listener);
    eventHandlers.push({ event: eventName, handler: listener });
  });

  // Return a function to remove all listeners
  return () => {
    eventHandlers.forEach(({ event, handler }) => {
      marketDataEvents.removeListener(event, handler);
    });
  };
}

/**
 * Get all active connections
 * @returns {Array} - Array of user IDs with active connections
 */
function getActiveConnections() {
  return Array.from(activeConnections.keys());
}

/**
 * Close all websocket connections
 */
function closeAllConnections() {
  for (const connection of activeConnections.values()) {
    if (connection.socket) {
      connection.socket.close();
    }
  }
  activeConnections.clear();
  console.log("All websocket connections closed");
}

module.exports = {
  subscribeToLiveData,
  onMarketData,
  getActiveConnections,
  closeAllConnections,
  marketDataEvents,
  CONNECTION_STATES, // Export states for external use
};
