// src/auth/token.service.js
const { fyersModel } = require("fyers-api-v3");
const User = require("../users/user.model");
const config = require("../config");
const mongoose = require("mongoose");

const fyers = new fyersModel({});

async function exchangeAuthCodeForToken(userId, authCode) {
  try {
    const response = await fyers.generate_access_token({
      client_id: config.fyersAppId,
      secret_key: config.fyersSecretKey,
      auth_code: authCode,
    });

    if (response.s !== "ok") throw new Error(response.message);

    const accessToken = response.access_token;

    // Validate if userId is a valid MongoDB ObjectId
    let userDocument = null;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(userId);

    if (isValidObjectId) {
      // Try to find the user
      userDocument = await User.findById(userId);
    }

    if (!isValidObjectId || !userDocument) {
      console.log(
        `Creating new user since userId ${userId} is invalid or doesn't exist`
      );
      // Create a new user instead
      const newUser = new User({
        fyersAccessToken: accessToken,
        fyersAuthCode: authCode,
        broker: "fyers",
        lastTokenRefresh: new Date(),
        tokenExpiry: new Date(Date.now() + 23 * 60 * 60 * 1000),
      });

      userDocument = await newUser.save();
      return { accessToken, userId: userDocument._id };
    } else {
      // Update existing user
      userDocument.fyersAccessToken = accessToken;
      userDocument.fyersAuthCode = authCode;
      userDocument.lastTokenRefresh = new Date();
      userDocument.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
      await userDocument.save();

      return { accessToken, userId };
    }
  } catch (err) {
    console.error("❌ Token exchange error:", err);
    throw new Error("Failed to generate access token");
  }
}

module.exports = { exchangeAuthCodeForToken };
