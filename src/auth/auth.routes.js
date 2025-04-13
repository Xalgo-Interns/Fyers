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
  console.log(`Generating redirect URL for user ID: ${userId}`);
  
  // Make sure you're using this userId as the state parameter in your redirect URL
  const redirectUrl = `${config.fyersUrl}?client_id=${config.fyersAppId}&redirect_uri=${config.fyersRedirectUrl}&response_type=code&state=${userId}`;
  
  console.log(`Redirect URL created: ${redirectUrl}`);
  res.json({ redirectUrl });
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

    // Get the userId from state parameter
    const userId = state;
    let userDocument = null;

    // Try to find the user by the userId (state parameter)
    // First check if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(userId)) {
      try {
        userDocument = await User.findById(userId);
        console.log("Found user by ObjectId:", userId);
      } catch (error) {
        console.error("Error retrieving user by ID:", error);
      }
    } 
    
    // If we still don't have a user (not a valid ObjectId or user not found)
    if (!userDocument) {
      console.log("User not found by ObjectId, checking if userId is a custom identifier");
      
      // Try to find by customId field
      userDocument = await User.findOne({ customId: userId });
      
      if (!userDocument) {
        console.warn(`No existing user found for ID: ${userId}. Creating a new user.`);
        // Create a new user document
        const newUser = new User({
          customId: userId, // Store the original userId as a custom field
          fyersAccessToken: response.access_token,
          fyersAuthCode: auth_code,
          broker: "fyers",
          lastTokenRefresh: new Date(),
          tokenExpiry: new Date(Date.now() + 23 * 60 * 60 * 1000),
        });

        userDocument = await newUser.save();
        console.log(`Created new user with ID: ${userDocument._id}`);
      } else {
        console.log(`Found user by customId: ${userId}`);
      }
    }

    // Update the user with the new token
    userDocument.fyersAccessToken = response.access_token;
    userDocument.fyersAuthCode = auth_code;
    userDocument.broker = "fyers";
    userDocument.lastTokenRefresh = new Date();
    userDocument.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);

    await userDocument.save();
    console.log(`Updated user ${userDocument._id} with new access token`);

    res.send(
      `✅ Token received and saved successfully for user ${userId}. You can now use the platform.`    );  } catch (err) {    console.error("❌ Token exchange error:", err);    res.status(500).send("❌ Token exchange failed: " + err.message);  }});module.exports = router;