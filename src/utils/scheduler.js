// src/utils/scheduler.js
const cron = require("node-cron");
const { placeOrder } = require("../orders/orders");
const { findUserById } = require("../users/user.service");

/**
 * Schedule a trading job
 * @param {string} userId
 * @param {string} cronExpression - e.g. '30 9 * * 1-5'
 * @param {object} orderPayload - order object to place
 */
function scheduleTrade(userId, cronExpression, orderPayload) {
  cron.schedule(cronExpression, async () => {
    console.log(`🕒 Triggered trade for user: ${userId}`);

    try {
      const result = await placeOrder(userId, orderPayload);
      console.log(`✅ Trade placed:`, result);
    } catch (err) {
      console.error(
        `❌ Failed to place trade for user ${userId}:`,
        err.message
      );
    }
  });
}

module.exports = { scheduleTrade };
