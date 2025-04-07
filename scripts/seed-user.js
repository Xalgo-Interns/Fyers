// scripts/seed-user.js
const mongoose = require("mongoose");
const User = require("../src/users/user.model");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const user = new User({ name: "Test User" });
  await user.save();
  console.log("✅ User created:", user._id);
  mongoose.disconnect();
});
