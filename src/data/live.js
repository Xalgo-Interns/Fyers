const { createWebSocket } = require("../auth/fyers-client");
const { EventEmitter } = require("events");

// Create a global event emitter for data updates
const marketDataEvents = new EventEmitter();
// Store active websocket connections by user
const activeConnections = new Map();

/**
 * Subscribe to live market data
 * @param {string} userId - User ID
 * @param {string} accessToken - Fyers access token
 * @param {Array<string>} symbols - Array of symbols to subscribe to
 * @param {Function} callback - Optional callback when data is received
 * @returns {Object} - Control object with functions to manage the connection
 */
function subscribeToLiveData(userId, accessToken, symbols, callback = null) {
  // Close existing connection for this user if it exists
  if (activeConnections.has(userId)) {
    const existing = activeConnections.get(userId);
    existing.socket.close();
    console.log(`Closed existing connection for user ${userId}`);
  }

  // Create a new websocket connection
  const socket = createWebSocket(accessToken);
  let isConnected = false;
  let subscribedSymbols = [];

  // Setup event handlers
  socket.on("connect", () => {
    console.log(`✅ User ${userId} connected to Fyers live feed`);
    isConnected = true;

    // Subscribe to symbols
    if (symbols && symbols.length > 0) {
      socket.subscribe(symbols);
      subscribedSymbols = [...symbols];
      console.log(`Subscribed to symbols: ${symbols.join(", ")}`);
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
    console.error(`❌ WebSocket error for user ${userId}:`, error);
    marketDataEvents.emit(`${userId}:error`, error);

    // Attempt reconnection after a delay
    setTimeout(() => {
      if (socket && !isConnected) {
        console.log(`Attempting to reconnect for user ${userId}...`);
        socket.connect();
      }
    }, 5000); // 5 seconds delay before reconnect attempt
  });

  socket.on("close", () => {
    console.log(`WebSocket closed for user ${userId}`);
    isConnected = false;
    marketDataEvents.emit(`${userId}:disconnected`);
  });

  // Connect to the websocket
  socket.connect();

  // Create a control object for this connection
  const connection = {
    socket,
    userId,
    subscribedSymbols,

    // Function to add more symbols to subscription
    addSymbols: (newSymbols) => {
      if (!Array.isArray(newSymbols)) newSymbols = [newSymbols];
      if (isConnected && socket) {
        socket.subscribe(newSymbols);
        subscribedSymbols = [...subscribedSymbols, ...newSymbols];
        console.log(`Added subscription to: ${newSymbols.join(", ")}`);
      }
      return subscribedSymbols;
    },

    // Function to remove symbols from subscription
    removeSymbols: (symbolsToRemove) => {
      if (!Array.isArray(symbolsToRemove)) symbolsToRemove = [symbolsToRemove];
      if (isConnected && socket) {
        socket.unsubscribe(symbolsToRemove);
        subscribedSymbols = subscribedSymbols.filter(
          (sym) => !symbolsToRemove.includes(sym)
        );
        console.log(`Removed subscription from: ${symbolsToRemove.join(", ")}`);
      }
      return subscribedSymbols;
    },

    // Function to close the connection
    close: () => {
      if (socket) {
        socket.close();
        activeConnections.delete(userId);
        console.log(`Connection closed for user ${userId}`);
      }
    },
  };

  // Store the connection
  activeConnections.set(userId, connection);

  return connection;
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
};
