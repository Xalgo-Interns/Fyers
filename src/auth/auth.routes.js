// src/auth/auth.routes.js
const express = require("express");
const router = express.Router();
const { fyersModel } = require("fyers-api-v3");
const User = require("../users/user.model");
const config = require("../config");
const mongoose = require("mongoose");

/**
 * GET /auth/redirect-url?userId=abc123
 * Generates Fyers login redirect URL
 */
router.get("/redirect-url", (req, res) => {
  const { userId } = req.query;
  if (!userId)
    return res.status(400).json({ success: false, error: "Missing userId" });

  try {
    // Create a new fyers instance using the official structure
    const fyers = new fyersModel();

    // Configure the fyers instance
    fyers.setAppId(config.fyersAppId);
    fyers.setRedirectUrl(config.fyersRedirectUri);

    // Generate auth URL with user ID as the state parameter
    const authUrl = fyers.generateAuthCode(userId);

    res.json({ success: true, url: authUrl, userId });
  } catch (err) {
    console.error("Error generating redirect URL:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /auth/callback
 * Callback from Fyers after user logs in
 */
router.get("/callback", async (req, res) => {
  const { auth_code, state, s, code } = req.query;

  // Log the received parameters for debugging
  console.log("Received callback params:", { auth_code, state, s, code });

  if (!auth_code) {
    return res.status(400).send("Missing auth_code parameter");
  }

  try {
    // Create a new fyers instance
    const fyers = new fyersModel();

    // Generate access token with the correct structure for V3 API
    const response = await fyers.generate_access_token({
      client_id: config.fyersAppId,
      secret_key: config.fyersSecretKey,
      auth_code: auth_code,
    });

    if (!response || response.s !== "ok") {
      throw new Error(response?.message || "Failed to generate access token");
    }

    // If state is a valid MongoDB ObjectId, use it as userId
    let userId = state;
    let userDocument = null;
    let isValidObjectId = mongoose.Types.ObjectId.isValid(userId);

    if (isValidObjectId) {
      try {
        userDocument = await User.findById(userId);
      } catch (error) {
        console.error("Error retrieving user by ID:", error);
        isValidObjectId = false; // Reset if lookup failed
      }
    }

    if (!isValidObjectId || !userDocument) {
      console.warn(
        `Invalid or non-existent user ID: ${userId}. Creating a new user.`
      );
      // Create a new user document instead
      const newUser = new User({
        fyersAccessToken: response.access_token,
        fyersAuthCode: auth_code,
        broker: "fyers",
        lastTokenRefresh: new Date(),
        tokenExpiry: new Date(Date.now() + 23 * 60 * 60 * 1000),
      });

      userDocument = await newUser.save();
      userId = userDocument._id;

      console.log(`Created new user with ID: ${userId}`);
    } else {
      // Update existing user
      userDocument.fyersAccessToken = response.access_token;
      userDocument.fyersAuthCode = auth_code;
      userDocument.broker = "fyers";
      userDocument.lastTokenRefresh = new Date();
      userDocument.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);

      await userDocument.save();
    }

    res.send(
      `✅ Token received and saved successfully for user ${userId}. You can now use the platform.`
    );
  } catch (err) {
    console.error("❌ Token exchange error:", err);
    res.status(500).send("❌ Token exchange failed: " + err.message);
  }
});

module.exports = router;
