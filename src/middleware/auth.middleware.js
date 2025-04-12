// src/middleware/auth.middleware.js
const User = require('../users/user.model');

/**
 * Middleware to verify user authentication
 * Either using API key or session, depending on your setup
 */
async function authenticate(req, res, next) {
  try {
    // Option 1: API key in header
    const apiKey = req.headers['x-api-key'];
    
    // Option 2: User ID in query parameter (less secure, for development)
    const queryUserId = req.query.userId;
    
    // Option 3: Session-based authentication
    const sessionUserId = req.session?.userId;
    
    // Check which authentication method is available
    let userId = null;
    
    if (apiKey) {
      // Find user by API key
      const user = await User.findOne({ apiKey });
      if (user) userId = user._id;
    } else if (queryUserId) {
      // For development/testing - in production, prefer API key or session
      userId = queryUserId;
    } else if (sessionUserId) {
      // Session-based authentication
      userId = sessionUserId;
    }
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    // Set user info in request object for route handlers
    req.user = { userId };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

module.exports = { authenticate };