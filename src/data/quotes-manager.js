const { subscribeToLiveData, onMarketData } = require("./live");
const { findUserById } = require("../users/user.service");

// Store active quote subscriptions by user
const activeSubscriptions = new Map();

/**
 * Start monitoring real-time quotes for a user
 * @param {string} userId - User ID
 * @param {Array<string>} symbols - Array of symbols to monitor
 * @returns {Promise<Object>} - Details about the subscription
 */
async function startQuoteMonitoring(userId, symbols) {
  if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
    throw new Error("Please provide valid symbols to monitor");
  }

  // Get the user to retrieve their access token
  const user = await findUserById(userId);
  if (!user.fyersAccessToken) {
    throw new Error("User not authenticated with Fyers");
  }

  // Check if user already has an active subscription
  let subscription = activeSubscriptions.get(userId);

  if (subscription) {
    // Add more symbols to existing subscription
    const newSymbols = symbols.filter(
      (sym) => !subscription.symbols.includes(sym)
    );

    if (newSymbols.length > 0) {
      subscription.connection.addSymbols(newSymbols);
      subscription.symbols = [...subscription.symbols, ...newSymbols];
    }
  } else {
    // Create a new subscription
    const quoteData = new Map(); // Store latest quote data

    // Create a callback to update the quote data
    const onQuoteUpdate = (data) => {
      if (data && data.symbol) {
        quoteData.set(data.symbol, {
          ...data,
          lastUpdated: new Date(),
        });
      }
    };

    // Start the WebSocket connection with the callback
    const connection = subscribeToLiveData(
      userId,
      user.fyersAccessToken,
      symbols,
      onQuoteUpdate
    );

    // Also listen for all updates for this user
    const removeListener = onMarketData(`${userId}:all`, onQuoteUpdate);

    // Create the subscription object
    subscription = {
      userId,
      symbols: [...symbols],
      connection,
      quoteData,
      removeListener,
      lastActivity: new Date(),
    };

    activeSubscriptions.set(userId, subscription);
  }

  return {
    userId,
    symbols: subscription.symbols,
    active: true,
  };
}

/**
 * Start monitoring real-time index data for a user
 * @param {string} userId - User ID
 * @param {Array<string>} indices - Array of index symbols to monitor (e.g. ['NSE:NIFTY50-INDEX'])
 * @returns {Promise<Object>} - Details about the subscription
 */
async function startIndexMonitoring(userId, indices) {
  if (!indices || !Array.isArray(indices) || indices.length === 0) {
    throw new Error("Please provide valid index symbols to monitor");
  }

  // Validate that all provided symbols are indices
  const nonIndexSymbols = indices.filter(
    (symbol) => !symbol.endsWith("-INDEX")
  );
  if (nonIndexSymbols.length > 0) {
    throw new Error(
      `Invalid index symbols: ${nonIndexSymbols.join(
        ", "
      )}. All symbols must end with -INDEX`
    );
  }

  // Reuse the existing quote monitoring logic
  return startQuoteMonitoring(userId, indices);
}

/**
 * Get the latest quote data for specified symbols
 * @param {string} userId - User ID
 * @param {Array<string>} symbols - Array of symbols to get quotes for (optional)
 * @returns {Object} - Latest quote data for requested symbols
 */
function getLatestQuotes(userId, symbols = null) {
  const subscription = activeSubscriptions.get(userId);
  if (!subscription) {
    throw new Error("No active quote subscription found for this user");
  }

  // Update last activity timestamp
  subscription.lastActivity = new Date();

  const result = {};

  // If specific symbols are requested, only return those
  if (symbols && Array.isArray(symbols) && symbols.length > 0) {
    symbols.forEach((symbol) => {
      const data = subscription.quoteData.get(symbol);
      if (data) {
        result[symbol] = data;
      }
    });
    return result;
  }

  // Otherwise return all available quote data
  for (const [symbol, data] of subscription.quoteData.entries()) {
    result[symbol] = data;
  }

  return result;
}

/**
 * Stop monitoring quotes for a user
 * @param {string} userId - User ID
 * @param {Array<string>} symbols - Optional specific symbols to stop monitoring
 * @returns {Object} - Result of the operation
 */
function stopQuoteMonitoring(userId, symbols = null) {
  const subscription = activeSubscriptions.get(userId);
  if (!subscription) {
    throw new Error("No active quote subscription found for this user");
  }

  if (symbols && Array.isArray(symbols) && symbols.length > 0) {
    // Only unsubscribe from specific symbols
    subscription.connection.removeSymbols(symbols);
    subscription.symbols = subscription.symbols.filter(
      (sym) => !symbols.includes(sym)
    );

    // If no symbols left, clean up the entire subscription
    if (subscription.symbols.length === 0) {
      if (subscription.removeListener) {
        subscription.removeListener();
      }
      subscription.connection.close();
      activeSubscriptions.delete(userId);
      return { stopped: true, remainingSymbols: [] };
    }

    return {
      stopped: true,
      removedSymbols: symbols,
      remainingSymbols: subscription.symbols,
    };
  } else {
    // Stop the entire subscription
    if (subscription.removeListener) {
      subscription.removeListener();
    }
    subscription.connection.close();
    activeSubscriptions.delete(userId);
    return { stopped: true };
  }
}

/**
 * Get status of all active quote monitors
 * @returns {Array<Object>} - List of active subscriptions
 */
function getActiveMonitors() {
  const result = [];

  for (const [userId, subscription] of activeSubscriptions.entries()) {
    result.push({
      userId,
      symbols: subscription.symbols,
      lastActivity: subscription.lastActivity,
      quoteCount: subscription.quoteData.size,
    });
  }

  return result;
}

module.exports = {
  startQuoteMonitoring,
  startIndexMonitoring, // Add the new function to exports
  getLatestQuotes,
  stopQuoteMonitoring,
  getActiveMonitors,

  // Helper for routes - useful for debugging in Postman
  getSubscriptionsCount: () => activeSubscriptions.size,
};
