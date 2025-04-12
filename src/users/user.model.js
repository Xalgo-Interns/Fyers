// src/users/user.model.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: String, // optional
    email: { type: String, unique: true, sparse: true }, // optional for future login
    broker: { type: String, enum: ["fyers", "zerodha"], default: "fyers" },

    fyersAccessToken: { type: String },
    fyersAuthCode: { type: String },
    lastTokenRefresh: { type: Date },
    tokenExpiry: { type: Date }, // Added token expiry field

    strategies: [{ type: mongoose.Schema.Types.Mixed }], // can store user-defined algo configs
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
