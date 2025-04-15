// src/middleware/auth.middleware.js
const User = require("../users/user.model");

/**
 * Middleware to verify user authentication
 * Either using API key or session, depending on your setup
 */
async function authenticate(req, res, next) {
  try {
    console.log("Auth middleware processing request:", {
      path: req.path,
      method: req.method,
      query: req.query,
      headers: Object.keys(req.headers),
      body: req.body ? (req.body.userId ? { userId: req.body.userId } : 'No userId in body') : 'No body'
    });

    // Option 1: API key in header
    const apiKey = req.headers["x-api-key"];

    // Option 2: User ID in query parameter (less secure, for development)
    const queryUserId = req.query.userId;

    // Option 3: Session-based authentication
    const sessionUserId = req.session?.userId;

    // Option 4: User ID in the body (for POST requests)
    const bodyUserId = req.body?.userId;

    // Check which authentication method is available
    let userId = null;

    if (apiKey) {
      // Find user by API key
      const user = await User.findOne({ apiKey });
      if (user) userId = user._id;
      console.log(`Auth by API key: ${!!user}`);
    } else if (queryUserId) {
      // For development/testing - in production, prefer API key or session
      userId = queryUserId;
      console.log(`Auth by query param: ${userId}`);
    } else if (sessionUserId) {
      // Session-based authentication
      userId = sessionUserId;
      console.log(`Auth by session: ${userId}`);
    } else if (bodyUserId) {
      // Body-based auth for POST requests
      userId = bodyUserId;
      console.log(`Auth by request body: ${userId}`);
    }

    // CRITICAL FIX: Always bypass auth check for live-feed and stream paths when userId is in query
    if (!userId && req.path.includes('/live-feed') && req.query.userId) {
      console.log(`Auth bypass enabled for ${req.path} with userId=${req.query.userId}`);
      userId = req.query.userId;
    }

    if (!userId && req.path.includes('/stream') && req.query.userId) {
      console.log(`Auth bypass enabled for ${req.path} with userId=${req.query.userId}`);
      userId = req.query.userId;
    }

    if (!userId) {
      console.log("Authentication failed: No user ID found");
      return res.status(401).json({
        success: false,
        error: "Authentication required: No user ID found in request",
      });
    }

    // Set user info in request object for route handlers
    req.user = { userId };
    console.log(`Authentication successful for user ${userId}`);
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({
      success: false,
      error: "Authentication failed: " + error.message,
    });
  }
}

module.exports = { authenticate };
