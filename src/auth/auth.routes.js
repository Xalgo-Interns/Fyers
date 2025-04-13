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
router.get("/redirect-url", async (req, res) => {
  const { userId } = req.query;
  if (!userId)
    return res.status(400).json({ success: false, error: "Missing userId" });

  try {
    // Validate if the user exists before proceeding
    let userDocument = null;

    console.log(`Generating auth URL for userId: ${userId}`);

    // Try to find by ObjectId first
    if (mongoose.Types.ObjectId.isValid(userId)) {
      userDocument = await User.findById(userId);
      console.log(
        `User lookup by ObjectId: ${userDocument ? "found" : "not found"}`
      );
    }

    // If not found, try by customId
    if (!userDocument) {
      userDocument = await User.findOne({ customId: userId });
      console.log(
        `User lookup by customId: ${userDocument ? "found" : "not found"}`
      );
    }

    // If still not found, create a placeholder user to track properly
    if (!userDocument) {
      console.log(`Creating placeholder user for userId: ${userId}`);
      userDocument = new User({
        customId: userId, // Store the provided ID to ensure we can find it later
        name: "Pending Authentication", // Placeholder name until we get more info
      });
      await userDocument.save();
      console.log(
        `Created placeholder user with _id: ${userDocument._id} and customId: ${userId}`
      );
    }

    // Use the MongoDB ObjectId as state to ensure consistent lookup
    const stateParam = userDocument._id.toString();
    console.log(`Using state parameter for Fyers auth: ${stateParam}`);

    // Create a new fyers instance using the official structure
    const fyers = new fyersModel();

    // Configure the fyers instance with required parameters
    fyers.setAppId(config.fyersAppId);
    fyers.setRedirectUrl(config.fyersRedirectUri);

    // First get the base URL from fyers.generateAuthCode() without state
    let generateAuthcodeURL = fyers.generateAuthCode();

    // Then modify the URL to include our custom state parameter
    // Parse the URL and modify the state parameter
    const authUrl = new URL(generateAuthcodeURL);
    authUrl.searchParams.set("state", stateParam);
    generateAuthcodeURL = authUrl.toString();

    console.log(`Generated auth URL with custom state: ${generateAuthcodeURL}`);

    res.json({
      success: true,
      url: generateAuthcodeURL,
      userId: userId,
      dbUserId: stateParam,
      message: "Use the generated URL to authenticate with Fyers",
    });
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
    return res.status(400).json({
      success: false,
      error: "Missing auth_code parameter",
    });
  }

  if (!state) {
    return res.status(400).json({
      success: false,
      error: "Missing state parameter - cannot identify user",
    });
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

    console.log("Successfully generated access token");

    // The state parameter should now be the MongoDB ObjectId
    const userId = state;
    let userDocument = null;

    console.log(`Looking up user with ID from state parameter: ${userId}`);

    // Find the user by the MongoDB ObjectId that we passed as state
    if (mongoose.Types.ObjectId.isValid(userId)) {
      try {
        userDocument = await User.findById(userId);
        if (userDocument) {
          console.log(
            `Found user by ObjectId: ${userId}, customId: ${
              userDocument.customId || "none"
            }`
          );
        } else {
          console.log(`No user found with ObjectId: ${userId}`);
        }
      } catch (error) {
        console.error("Error retrieving user by ID:", error);
      }
    } else {
      console.warn(`Invalid ObjectId in state parameter: ${userId}`);
    }

    if (!userDocument) {
      return res.status(404).json({
        success: false,
        error: "User not found. Authentication flow may be corrupted.",
      });
    }

    // Update the user with the new token
    userDocument.fyersAccessToken = response.access_token;
    userDocument.fyersAuthCode = auth_code;
    userDocument.broker = "fyers";
    userDocument.lastTokenRefresh = new Date();
    userDocument.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
    userDocument.name =
      userDocument.name === "Pending Authentication"
        ? "Authenticated User"
        : userDocument.name;

    await userDocument.save();
    console.log(
      `Updated user ${userDocument._id} (customId: ${userDocument.customId}) with new access token`
    );

    // Return a consistent JSON response with both IDs for clarity
    return res.json({
      success: true,
      message: "Authentication successful! Token received and saved.",
      userId: userDocument.customId || userId, // Return the original custom ID if available
      dbUserId: userDocument._id.toString(),
      tokenExpiry: userDocument.tokenExpiry,
      access_token: response.access_token, // Include the access token in the response
    });
  } catch (err) {
    console.error("❌ Token exchange error:", err);
    return res.status(500).json({
      success: false,
      error: "Token exchange failed: " + err.message,
    });
  }
});

module.exports = router;
