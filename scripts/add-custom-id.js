// Create a migration script
// filepath: c:\Users\91700\Desktop\Fyers\src\migrations\add-custom-id.js
const mongoose = require("mongoose");
const User = require("../src/users/user.model");
require("dotenv").config();

async function migrateUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const users = await User.find({ customId: { $exists: false } });
    console.log(`Found ${users.length} users without customId`);

    for (const user of users) {
      // Use their _id string as customId if nothing better is available
      user.customId = user._id.toString();
      await user.save();
      console.log(`Added customId to user ${user._id}`);
    }

    console.log("Migration completed");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrateUsers();
