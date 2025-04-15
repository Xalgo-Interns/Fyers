// src/auth/fyers-client.js
const { fyersModel, fyersDataSocket } = require("fyers-api-v3");
const config = require("../config");

// Store the singleton websocket instance
let websocketInstance = null;

function createFyersClient(accessToken) {
  // Create a new fyers instance with logging enabled
  const fyers = new fyersModel({
    path: config.logPath || "./logs",
    enableLogging: true,
  });

  // Set app ID and access token
  const appId = config.fyersAppId;
  fyers.setAppId(appId);
  fyers.setAccessToken(accessToken);

  return fyers;
}

function createWebSocket(accessToken) {
  try {
    // Close existing websocket if any
    if (websocketInstance) {
      try {
        // Try to close properly first
        if (typeof websocketInstance.close === "function") {
          websocketInstance.close();
          console.log("Closed existing WebSocket instance");
        }

        // Attempt to use destroy() method if available
        if (typeof fyersDataSocket.destroy === "function") {
          fyersDataSocket.destroy();
          console.log("Destroyed WebSocket singleton via API method");
        } else {
          console.log("No destroy method available, using manual cleanup");
        }
      } catch (closeError) {
        console.warn("Error while closing existing socket:", closeError);
      }

      // Reset instance regardless
      websocketInstance = null;
    }

    // Create new instance - Use getInstance method instead of new instance
    console.log("Creating WebSocket instance using getInstance...");
    try {
      websocketInstance = fyersDataSocket.getInstance(accessToken);
      console.log("Successfully got WebSocket instance via getInstance");
    } catch (instanceError) {
      console.error(
        "Error using getInstance, trying alternative approach:",
        instanceError
      );
      // Fallback approach if getInstance fails
      websocketInstance = new fyersDataSocket(accessToken);
    }

    // Add debug logging
    console.log(
      "Created/got WebSocket instance with token:",
      accessToken.substring(0, 10) + "..."
    );

    return websocketInstance;
  } catch (error) {
    console.error("Error creating WebSocket instance:", error);
    websocketInstance = null;
    throw new Error(`WebSocket creation failed: ${error.message}`);
  }
}

/**
 * Clean up WebSocket instance - safe version
 */
function cleanupWebSocket() {
  if (websocketInstance) {
    try {
      // Try standard close method first
      if (typeof websocketInstance.close === "function") {
        websocketInstance.close();
      }

      // Attempt to use API's destroy if available
      try {
        if (typeof fyersDataSocket.destroy === "function") {
          fyersDataSocket.destroy();
        } else {
          // Manual cleanup if destroy is not available
          console.log(
            "WebSocket destroy method not available, using manual cleanup"
          );
        }
      } catch (destroyErr) {
        console.warn("Error in socket destroy call:", destroyErr);
      }
    } catch (error) {
      console.error("Error cleaning up WebSocket:", error);
    } finally {
      // Ensure the instance is nullified
      websocketInstance = null;
    }
  }
}

module.exports = {
  createFyersClient,
  createWebSocket,
  cleanupWebSocket,
};
