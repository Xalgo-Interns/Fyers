/**
 * Data validation and monitoring utilities
 */
const { marketDataEvents } = require("../data/live");

/**
 * Monitor data flow for a specific user to diagnose issues
 * @param {string} userId - User ID to monitor
 * @param {number} timeoutMs - Timeout in milliseconds to wait for data
 * @returns {Promise} - Resolves when data is received or timeout occurs
 */
function monitorDataFlow(userId, timeoutMs = 10000) {
  return new Promise((resolve) => {
    console.log(`Starting data flow monitor for user ${userId} (timeout: ${timeoutMs}ms)`);
    
    let dataReceived = false;
    let timer;
    
    // Listen for any data for this user
    const onData = (data) => {
      console.log(`✅ Data received for ${userId}:`, 
        data.symbol ? `${data.symbol} (${data.type})` : 'No symbol');
      dataReceived = true;
      marketDataEvents.removeListener(`${userId}:all`, onData);
      clearTimeout(timer);
      resolve({ success: true, data });
    };
    
    // Set timeout to detect if no data flows
    timer = setTimeout(() => {
      if (!dataReceived) {
        console.warn(`⚠️ No data received for user ${userId} after ${timeoutMs}ms`);
        marketDataEvents.removeListener(`${userId}:all`, onData);
        resolve({ success: false, reason: 'timeout' });
      }
    }, timeoutMs);
    
    // Register listener
    marketDataEvents.on(`${userId}:all`, onData);
    console.log(`Data flow monitor registered for ${userId}`);
  });
}

/**
 * Validate index symbol format
 * @param {string} symbol - Symbol to validate
 * @returns {boolean} - True if valid index symbol
 */
function isValidIndexSymbol(symbol) {
  // Common index symbols
  const commonIndices = [
    'NIFTY50-INDEX',
    'BANKNIFTY-INDEX',
    'FINNIFTY-INDEX',
    'MIDCPNIFTY-INDEX',
    'SENSEX-INDEX'
  ];
  
  if (!symbol) return false;
  
  // Check generic pattern
  if (!symbol.includes(':') || !symbol.endsWith('-INDEX')) {
    return false;
  }
  
  // Extract the index name
  const parts = symbol.split(':');
  if (parts.length !== 2) return false;
  
  const indexName = parts[1];
  
  // For common indices, validate exactly
  for (const idx of commonIndices) {
    if (idx === indexName) return true;
  }
  
  // For other indices, just check it ends with -INDEX
  return indexName.endsWith('-INDEX');
}

module.exports = {
  monitorDataFlow,
  isValidIndexSymbol
};
