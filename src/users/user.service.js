// src/users/user.service.js
const User = require("./user.model");

async function findUserById(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  return user;
}

async function getFyersAccessToken(userId) {
  const user = await findUserById(userId);
  if (!user.fyersAccessToken)
    throw new Error("No access token found for this user");
  return user.fyersAccessToken;
}

async function saveStrategy(userId, strategy) {
  const user = await findUserById(userId);
  user.strategies.push(strategy);
  await user.save();
  return user.strategies;
}

module.exports = {
  findUserById,
  getFyersAccessToken,
  saveStrategy,
};
