const { createWebSocket } = require("../auth/fyers-client");
const { EventEmitter } = require("events");

// Create a global event emitter for data updates
const marketDataEvents = new EventEmitter();
// Store active websocket connections by user
const activeConnections = new Map();

// Connection state constants
const CONNECTION_STATES = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  ERROR: "error",
};

// Rate limiting config
const RATE_LIMIT = {
  MAX_SYMBOLS_PER_REQUEST: 100,
  RECONNECT_DELAY: 5000,
  MAX_RECONNECT_ATTEMPTS: 5,
  INITIAL_RECONNECT_DELAY: 1000,
};

/**
 * Validates input parameters for subscription.
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

/**
 * Subscribes to live market data for a specific user.
 */
function subscribeToLiveData(userId, accessToken, symbols, callback = null) {
  try {
    validateSubscriptionParams(userId, accessToken, symbols);

    // Close existing connection if it exists
    if (activeConnections.has(userId)) {
      const existing = activeConnections.get(userId);
      existing.close();
      console.log(`Closed existing connection for user ${userId}`);
    }

    // Get or create the WebSocket instance
    let socket;
    try {
      socket = createWebSocket(accessToken);
    } catch (err) {
      if (err.message.includes("Only one instance")) {
        socket =
          require("fyers-api-v3").fyersDataSocket.getInstance(accessToken);
      } else {
        throw err;
      }
    }

    let connectionState = CONNECTION_STATES.DISCONNECTED;
    let reconnectAttempts = 0;
    let subscribedSymbols = [];
    // Declare connection early so that event handlers can reference it
    let connection = {};

    const updateConnectionState = (newState) => {
      connectionState = newState;
      console.log(
        `WebSocket state changed for user ${userId}: ${connectionState}`
      );
      marketDataEvents.emit(`${userId}:state`, connectionState);
    };

    socket.on("connect", () => {
      updateConnectionState(CONNECTION_STATES.CONNECTED);
      reconnectAttempts = 0;
      try {
        if (symbols?.length > 0) {
          // Subscribe with data type flag (3 for full data) and request snapshot if needed
          socket.subscribe(symbols, {
            dataType: 3,
            skipInitialData: false,
          });
          // Enable auto-reconnect
          socket.autoreconnect(true);
          subscribedSymbols = [...symbols];
          // Set periodic ping to keep connection alive
          connection.pingInterval = setInterval(() => {
            if (connectionState === CONNECTION_STATES.CONNECTED) {
              if (typeof socket.ping === "function") {
                socket.ping();
              } else {
                console.warn(`Ping not supported for user ${userId}`);
              }
            }
          }, 30000); // Every 30 seconds
          console.log(
            `Successfully subscribed to ${
              symbols.length
            } symbols for ${userId}: ${symbols.join(", ")}`
          );
          console.debug(`Subscribed symbols:`, subscribedSymbols);
        }
      } catch (err) {
        console.error(`Failed to subscribe to symbols for ${userId}:`, err);
        marketDataEvents.emit(`${userId}:error`, err);
      }
    });

    socket.on("message", (message) => {
      console.log("Raw WS message received:", message);
      try {
        const data =
          typeof message === "string" ? JSON.parse(message) : message;

        // If the message has a symbol and the symbol is not in our subscribed list, skip it.
        if (
          (data.type === "sf" || data.type === "td" || data.type === "dp") &&
          data.symbol &&
          !subscribedSymbols.includes(data.symbol)
        ) {
          console.debug(
            `Skipping message for unsubscribed symbol: ${data.symbol}`
          );
          return;
        }

        // Process different message types.
        switch (data.type) {
          case "sf": // Snapshot data
          case "td": // Trade data
            if (data.symbol) {
              const eventName = `${userId}:${data.symbol}`;
              marketDataEvents.emit(eventName, data);
              marketDataEvents.emit(`${userId}:all`, data);
            }
            break;
          case "cn": // Connection success
            console.log(`Connection successful for ${userId}`);
            break;
          case "er": // Error
            console.error(`Feed error for ${userId}:`, data.message);
            marketDataEvents.emit(`${userId}:error`, new Error(data.message));
            break;
          case "dp": // Data packet (market depth)
            const values = Object.values(data).filter(
              (val) => typeof val === "number"
            );
            if (values.every((val) => val === 0)) {
              console.warn(
                `Received dp packet with no updates for ${data.symbol}. This may indicate a closed market or no trades.`
              );
            } else {
              console.log(
                `Market update for ${data.symbol}:`,
                JSON.stringify(data, null, 2)
              );
            }
            break;
          default:
            console.debug(`Unhandled message type: ${data.type}`);
        }

        if (callback && typeof callback === "function") {
          callback(data);
        }
      } catch (err) {
        console.error(`Error processing feed data for ${userId}:`, err);
        marketDataEvents.emit(`${userId}:error`, err);
      }
    });

    socket.on("error", (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
      updateConnectionState(CONNECTION_STATES.ERROR);
      marketDataEvents.emit(`${userId}:error`, error);
      // Attempt reconnection with exponential backoff if needed
      if (reconnectAttempts < RATE_LIMIT.MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(
          RATE_LIMIT.INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
          RATE_LIMIT.RECONNECT_DELAY
        );
        reconnectAttempts++;
        console.log(
          `Attempting reconnect ${reconnectAttempts}/${RATE_LIMIT.MAX_RECONNECT_ATTEMPTS} for user ${userId} in ${delay}ms`
        );
        setTimeout(() => {
          if (connectionState !== CONNECTION_STATES.CONNECTED) {
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
      marketDataEvents.emit(`${userId}:disconnected`);
    });

    // Define the connection object with helpful helper functions
    connection = {
      socket,
      userId,
      subscribedSymbols,
      connectionState,
      getState: () => connectionState,

      addSymbols: (newSymbols) => {
        try {
          if (!Array.isArray(newSymbols)) newSymbols = [newSymbols];
          if (
            subscribedSymbols.length + newSymbols.length >
            RATE_LIMIT.MAX_SYMBOLS_PER_REQUEST
          ) {
            throw new Error(
              `Cannot subscribe to more than ${RATE_LIMIT.MAX_SYMBOLS_PER_REQUEST} symbols`
            );
          }
          if (connectionState === CONNECTION_STATES.CONNECTED) {
            socket.subscribe(newSymbols, true);
            subscribedSymbols = [...subscribedSymbols, ...newSymbols];
            console.debug(
              `Added symbols. New subscribedSymbols:`,
              subscribedSymbols
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

      removeSymbols: (symbolsToRemove) => {
        if (!Array.isArray(symbolsToRemove))
          symbolsToRemove = [symbolsToRemove];
        if (connectionState === CONNECTION_STATES.CONNECTED && socket) {
          console.log(
            `Unsubscribing symbols for user ${userId}: ${symbolsToRemove.join(
              ", "
            )}`
          );
          socket.unsubscribe(symbolsToRemove);
          subscribedSymbols = subscribedSymbols.filter(
            (sym) => !symbolsToRemove.includes(sym)
          );
          console.debug(
            `Updated subscribedSymbols after removal:`,
            subscribedSymbols
          );

          // If no subscriptions remain, close the socket connection.
          if (subscribedSymbols.length === 0) {
            console.log(
              `No remaining subscriptions for user ${userId}. Closing connection.`
            );
            connection.close();
          }
        }
        return subscribedSymbols;
      },

      close: () => {
        try {
          if (socket) {
            if (connection.pingInterval) {
              clearInterval(connection.pingInterval);
            }
            socket.close();
            activeConnections.delete(userId);
            updateConnectionState(CONNECTION_STATES.DISCONNECTED);
          }
        } catch (err) {
          console.error(`Error closing connection for ${userId}:`, err);
          throw err;
        }
      },
    };

    updateConnectionState(CONNECTION_STATES.CONNECTING);
    socket.connect();
    activeConnections.set(userId, connection);
    console.log(`Active connection registered for user ${userId}`);
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
 * Listen for market data updates for specific symbols.
 * Returns a function to remove all registered listeners.
 */
function onMarketData(userId, symbols, listener) {
  if (!Array.isArray(symbols)) symbols = [symbols];
  const eventHandlers = [];
  symbols.forEach((symbol) => {
    const eventName = `${userId}:${symbol}`;
    marketDataEvents.on(eventName, listener);
    eventHandlers.push({ event: eventName, handler: listener });
  });
  return () => {
    eventHandlers.forEach(({ event, handler }) => {
      marketDataEvents.removeListener(event, handler);
    });
  };
}

/**
 * Get all active connections.
 */
function getActiveConnections() {
  return Array.from(activeConnections.keys());
}

/**
 * Close all websocket connections.
 */
function closeAllConnections() {
  for (const connection of activeConnections.values()) {
    try {
      connection.close();
    } catch (err) {
      console.error("Error closing connection:", err);
    }
  }
  activeConnections.clear();
  // Reset the singleton instance.
  require("fyers-api-v3").fyersDataSocket.destroy();
  console.log("All websocket connections closed");
}

module.exports = {
  subscribeToLiveData,
  onMarketData,
  getActiveConnections,
  closeAllConnections,
  marketDataEvents,
  CONNECTION_STATES, // Export states for external use
  activeConnections, // Export the active connections map
};
